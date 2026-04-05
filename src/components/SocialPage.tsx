import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { Card, Button } from './Layout';
import { Users, UserPlus, Search, Check, X, Clock, Shield, MessageCircle } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { ChatView } from './ChatView';
import { useAlert } from '../context/AlertContext';

interface SocialPageProps {
  user: UserProfile;
  onBack: () => void;
}

interface Chat {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount?: Record<string, number>;
  otherUser: UserProfile;
}

export function SocialPage({ user, onBack }: SocialPageProps) {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search' | 'chats'>('friends');
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<UserProfile[]>([]);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<UserProfile | null>(null);
  const { showAlert } = useAlert();

  useEffect(() => {
    fetchFriendsAndRequests();
    fetchChats();
  }, [user]);

  const fetchChats = async () => {
    try {
      const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
      const querySnapshot = await getDocs(q);
      const chatsData = await Promise.all(querySnapshot.docs.map(async (chatDoc): Promise<Chat | null> => {
        const data = chatDoc.data();
        const otherUserId = data.participants.find((id: string) => id !== user.uid);
        if (!otherUserId) return null;
        
        const userDoc = await getDoc(doc(db, 'users', otherUserId));
        if (!userDoc.exists()) return null;
        
        return {
          id: chatDoc.id,
          ...data,
          otherUser: { uid: userDoc.id, ...userDoc.data() } as UserProfile
        } as Chat;
      }));
      
      setChats((chatsData.filter(c => c !== null) as Chat[]).sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()));
    } catch (err) {
      console.error("Error fetching chats", err);
    }
  };

  const fetchFriendsAndRequests = async () => {
    setLoading(true);
    try {
      // Fetch friends
      if (user.friends && user.friends.length > 0) {
        const friendsData = await Promise.all(
          user.friends.map(async (uid) => {
            const docRef = doc(db, 'users', uid);
            const docSnap = await getDoc(docRef);
            return { uid: docSnap.id, ...docSnap.data() } as UserProfile;
          })
        );
        setFriends(friendsData);
      } else {
        setFriends([]);
      }

      // Fetch requests
      if (user.friendRequests && user.friendRequests.length > 0) {
        const requestsData = await Promise.all(
          user.friendRequests.map(async (uid) => {
            const docRef = doc(db, 'users', uid);
            const docSnap = await getDoc(docRef);
            return { uid: docSnap.id, ...docSnap.data() } as UserProfile;
          })
        );
        setRequests(requestsData);
      } else {
        setRequests([]);
      }
    } catch (err) {
      console.error("Error fetching friends", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm || searchTerm.length < 3) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('pseudo', '>=', searchTerm), where('pseudo', '<=', searchTerm + '\uf8ff'));
      const querySnapshot = await getDocs(q);
      const results: UserProfile[] = [];
      querySnapshot.forEach((doc) => {
        if (doc.id !== user.uid) {
          results.push({ uid: doc.id, ...doc.data() } as UserProfile);
        }
      });
      setSearchResults(results);
    } catch (err) {
      console.error("Error searching users", err);
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (targetUser: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        friendRequests: arrayUnion(user.uid)
      });
      showAlert({
        title: `Demande d'ami envoyée à ${targetUser.pseudo}`,
        type: 'success'
      });
    } catch (err) {
      console.error("Error sending friend request", err);
    }
  };

  const acceptFriendRequest = async (targetUser: UserProfile) => {
    try {
      // Add to both friends lists
      await updateDoc(doc(db, 'users', user.uid), {
        friends: arrayUnion(targetUser.uid),
        friendRequests: arrayRemove(targetUser.uid)
      });
      await updateDoc(doc(db, 'users', targetUser.uid), {
        friends: arrayUnion(user.uid)
      });
      fetchFriendsAndRequests();
      showAlert({
        title: `${targetUser.pseudo} a accepté votre invitation`,
        type: 'success'
      });
    } catch (err) {
      console.error("Error accepting friend request", err);
    }
  };

  const declineFriendRequest = async (targetUser: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        friendRequests: arrayRemove(targetUser.uid)
      });
      fetchFriendsAndRequests();
      showAlert({
        title: `Vous avez refusé l'invitation de ${targetUser.pseudo}`,
        type: 'success'
      });
    } catch (err) {
      console.error("Error declining friend request", err);
    }
  };

  const removeFriend = async (targetUid: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet ami ?')) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        friends: arrayRemove(targetUid)
      });
      await updateDoc(doc(db, 'users', targetUid), {
        friends: arrayRemove(user.uid)
      });
      fetchFriendsAndRequests();
    } catch (err) {
      console.error("Error removing friend", err);
    }
  };

  if (selectedFriend) {
    return (
      <ChatView 
        currentUser={user} 
        friend={selectedFriend} 
        onBack={() => setSelectedFriend(null)} 
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Tabs */}
      <div className="flex gap-1 p-4 bg-[#111111]/50 border-b border-white/5">
        <button 
          onClick={() => setActiveTab('chats')}
          className={`flex-1 px-1 py-2 rounded-lg font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all ${activeTab === 'chats' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
        >
          Discussions
        </button>
        <button 
          onClick={() => setActiveTab('friends')}
          className={`flex-1 px-1 py-2 rounded-lg font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all ${activeTab === 'friends' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
        >
          Amis ({friends.length})
        </button>
        <button 
          onClick={() => setActiveTab('requests')}
          className={`flex-1 px-1 py-2 rounded-lg font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all relative ${activeTab === 'requests' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
        >
          Demandes
          {requests.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center text-white">
              {requests.length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('search')}
          className={`flex-1 px-1 py-2 rounded-lg font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all ${activeTab === 'search' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
        >
          Ajouter
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
          </div>
        ) : activeTab === 'chats' ? (
          chats.length === 0 ? (
            <div className="text-center py-10 text-gray-500 font-bold italic text-sm">Aucune discussion pour le moment.</div>
          ) : (
            chats.map(chat => (
              <div 
                key={chat.id} 
                className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => setSelectedFriend(chat.otherUser)}
              >
                <div className="flex items-center gap-3">
                  <img src={chat.otherUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.otherUser.uid}`} alt={chat.otherUser.pseudo} className="w-12 h-12 rounded-full bg-white/10" />
                  <div>
                    <div className="font-black text-white">{chat.otherUser.pseudo}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-1">
                      {chat.lastMessage ? (
                        <span>Dernier message envoyé</span>
                      ) : (
                        <span className="italic">Nouvelle discussion</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] text-gray-500 font-bold">
                    {new Date(chat.lastMessageTime).toLocaleDateString()}
                  </span>
                  {chat.unreadCount?.[user.uid] > 0 && (
                    <span className="w-5 h-5 bg-blue-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold">
                      {chat.unreadCount[user.uid]}
                    </span>
                  )}
                </div>
              </div>
            ))
          )
        ) : activeTab === 'friends' ? (
          friends.length === 0 ? (
            <div className="text-center py-10 text-gray-500 font-bold italic text-sm">Aucun ami pour le moment.</div>
          ) : (
            friends.map(friend => (
              <div key={friend.uid} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={friend.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.uid}`} alt={friend.pseudo} className="w-10 h-10 rounded-full bg-white/10" />
                  <div>
                    <div className="font-black text-white">{friend.pseudo}</div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold">Niv. {friend.level}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedFriend(friend)} className="p-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors">
                    <MessageCircle className="w-4 h-4" />
                  </button>
                  <button onClick={() => removeFriend(friend.uid)} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )
        ) : activeTab === 'requests' ? (
          requests.length === 0 ? (
            <div className="text-center py-10 text-gray-500 font-bold italic text-sm">Aucune demande en attente.</div>
          ) : (
            requests.map(request => (
              <div key={request.uid} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={request.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${request.uid}`} alt={request.pseudo} className="w-10 h-10 rounded-full bg-white/10" />
                  <div>
                    <div className="font-black text-white">{request.pseudo}</div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold">Niv. {request.level}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => acceptFriendRequest(request)} className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-colors">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => declineFriendRequest(request)} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  type="text"
                  placeholder="Rechercher par pseudo..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm font-bold focus:outline-none focus:border-blue-500/50 transition-all text-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <button 
                onClick={handleSearch}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-xl font-black uppercase tracking-widest transition-colors"
              >
                Go
              </button>
            </div>
            
            <div className="space-y-3">
              {searchResults.map(result => {
                const isFriend = user.friends?.includes(result.uid);
                const hasRequested = result.friendRequests?.includes(user.uid);
                
                return (
                  <div key={result.uid} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <img src={result.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.uid}`} alt={result.pseudo} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10" />
                      <div>
                        <div className="font-black text-white sm:text-lg">{result.pseudo}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500 uppercase font-bold">Niv. {result.level}</div>
                      </div>
                    </div>
                    {isFriend ? (
                      <div className="flex gap-2">
                        <button onClick={() => setSelectedFriend(result)} className="p-2 sm:p-2.5 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors">
                          <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <span className="text-xs sm:text-sm text-green-500 font-bold uppercase flex items-center px-2">Ami</span>
                      </div>
                    ) : hasRequested ? (
                      <div className="flex gap-2">
                        <button onClick={() => setSelectedFriend(result)} className="p-2 sm:p-2.5 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors">
                          <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <span className="text-xs sm:text-sm text-gray-500 font-bold uppercase flex items-center px-2">En attente</span>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => setSelectedFriend(result)} className="p-2 sm:p-2.5 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors">
                          <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button 
                          onClick={() => sendFriendRequest(result)}
                          className="p-2 sm:p-2.5 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors"
                        >
                          <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
