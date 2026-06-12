import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { Card, Button } from './Layout';
import { Users, UserPlus, Search, Check, X, Clock, Shield, MessageCircle, Share2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, arrayRemove, getDoc, onSnapshot } from 'firebase/firestore';
import { ChatView } from './ChatView';
import { useAlert } from '../context/AlertContext';
import { motion, AnimatePresence } from 'motion/react';
import { getImageUrl } from '../lib/utils';
import { MrFanzHelp } from './MrFanzHelp';
import { PublicProfileModal } from './PublicProfileModal';

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
  const [friendToRemove, setFriendToRemove] = useState<UserProfile | null>(null);
  const [viewingProfileUid, setViewingProfileUid] = useState<string | null>(null);
  const { showAlert } = useAlert();

  const friendsStr = JSON.stringify(user.friends || []);
  const requestsStr = JSON.stringify(user.friendRequests || []);

  useEffect(() => {
    fetchFriendsAndRequests();
  }, [friendsStr, requestsStr]);

  useEffect(() => {
    if (!user?.uid) return;
    
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      try {
        const chatsData = await Promise.all(querySnapshot.docs.map(async (chatDoc): Promise<Chat | null> => {
          const data = chatDoc.data();
          const otherUserId = data.participants.find((id: string) => id !== user.uid);
          if (!otherUserId) return null;
          
          // Check for new unread messages to show alert
          const currentUnread = data.unreadCount?.[user.uid] || 0;
          
          // Identify if this chat changed and unread count increased
          const prevChat = chats.find(c => c.id === chatDoc.id);
          const prevUnread = prevChat?.unreadCount?.[user.uid] || 0;
          
          if (currentUnread > prevUnread && (!selectedFriend || selectedFriend.uid !== otherUserId)) {
            const userDoc = await getDoc(doc(db, 'users', otherUserId));
            const otherUser = { uid: userDoc.id, ...userDoc.data() } as UserProfile;
            showAlert({
              title: 'Nouveau message !',
              subtitle: `${otherUser.pseudo} vous a envoyé une emote.`,
              type: 'unlock'
            });
          }

          const userDoc = await getDoc(doc(db, 'users', otherUserId));
          if (!userDoc.exists()) return null;
          
          return {
            id: chatDoc.id,
            ...data,
            otherUser: { uid: userDoc.id, ...userDoc.data() } as UserProfile
          } as Chat;
        }));
        
        setChats((chatsData.filter(c => c !== null) as Chat[]).sort((a, b) => {
          const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
          const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
          return timeB - timeA;
        }));
      } catch (err) {
        console.error("Error processing chats", err);
      }
    }, (error) => {
      console.error("Error fetching chats snapshot", error);
    });

    return () => unsubscribe();
  }, [user.uid]);

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
      setSearchResults(prev => prev.map(u => {
        if (u.uid === targetUser.uid) {
          return { ...u, friendRequests: [...(u.friendRequests || []), user.uid] };
        }
        return u;
      }));
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
      showAlert({
        title: `Vous êtes maintenant ami avec ${targetUser.pseudo}`,
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
      showAlert({
        title: `Vous avez refusé l'invitation de ${targetUser.pseudo}`,
        type: 'success'
      });
    } catch (err) {
      console.error("Error declining friend request", err);
    }
  };

  const removeFriend = async (targetUid: string) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        friends: arrayRemove(targetUid)
      });
      await updateDoc(doc(db, 'users', targetUid), {
        friends: arrayRemove(user.uid)
      });
      setFriendToRemove(null);
    } catch (err) {
      console.error("Error removing friend", err);
    }
  };

  const handleShareInvite = async () => {
    const shareData = {
      title: 'Rejoins-moi sur TheBestFan!',
      text: 'Viens défier les autres fans de foot sur TheBestFan.Online et deviens le meilleur fan!',
      url: window.location.origin
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        showAlert({
          title: 'Lien copié !',
          type: 'success'
        });
      }
    } catch (err) {
      console.error('Error sharing', err);
    }
  };

  const unreadChatsCount = chats.reduce((acc, chat) => acc + (chat.unreadCount?.[user.uid] || 0), 0);

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
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex items-center justify-between px-4">
        <h1 className="text-lg sm:text-xl font-black italic uppercase tracking-tighter flex items-center">
          Social
          <MrFanzHelp contextId="social" />
        </h1>
        <button 
          onClick={handleShareInvite}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 text-orange-500 rounded-lg hover:bg-orange-500/20 transition-all border border-orange-500/20"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span className="text-[10px] font-black uppercase tracking-widest italic">Inviter</span>
        </button>
      </div>
      {/* Tabs */}
      <div className="flex gap-1 p-4 bg-[#111111]/50 border-b border-white/5">
        <button 
          onClick={() => setActiveTab('chats')}
          className={`relative flex-1 px-1 py-2 rounded-lg font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all ${activeTab === 'chats' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
        >
          Discussions
          {unreadChatsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center text-white">
              {unreadChatsCount}
            </span>
          )}
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
                  <img src={getImageUrl(chat.otherUser.photoURL) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.otherUser.uid}`} alt={chat.otherUser.pseudo} className="w-12 h-12 rounded-full bg-white/10" referrerPolicy="no-referrer" />
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
                <div 
                  className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-opacity"
                  onClick={() => setViewingProfileUid(friend.uid)}
                >
                  <img src={getImageUrl(friend.photoURL) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.uid}`} alt={friend.pseudo} className="w-10 h-10 rounded-full bg-white/10" referrerPolicy="no-referrer" />
                  <div>
                    <div className="font-black text-white hover:text-blue-400 transition-colors">{friend.pseudo}</div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold">Niv. {friend.level}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedFriend(friend)} className="p-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors">
                    <MessageCircle className="w-4 h-4" />
                  </button>
                  <button onClick={() => setFriendToRemove(friend)} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors">
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
                <div 
                  className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-opacity"
                  onClick={() => setViewingProfileUid(request.uid)}
                >
                  <img src={getImageUrl(request.photoURL) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${request.uid}`} alt={request.pseudo} className="w-10 h-10 rounded-full bg-white/10" referrerPolicy="no-referrer" />
                  <div>
                    <div className="font-black text-white hover:text-blue-400 transition-colors">{request.pseudo}</div>
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
                const hasRequestedUs = user.friendRequests?.includes(result.uid);
                
                return (
                  <div key={result.uid} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                    <div 
                      className="flex items-center gap-3 sm:gap-4 cursor-pointer hover:opacity-85 transition-opacity"
                      onClick={() => setViewingProfileUid(result.uid)}
                    >
                      <img src={getImageUrl(result.photoURL) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.uid}`} alt={result.pseudo} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10" referrerPolicy="no-referrer" />
                      <div>
                        <div className="font-black text-white sm:text-lg hover:text-blue-400 transition-colors">{result.pseudo}</div>
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
                    ) : hasRequestedUs ? (
                      <div className="flex gap-2">
                        <button onClick={() => setSelectedFriend(result)} className="p-2 sm:p-2.5 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors">
                          <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button 
                          onClick={() => acceptFriendRequest(result)}
                          className="px-3 py-1.5 sm:px-4 sm:py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold text-xs sm:text-sm uppercase tracking-wider transition-colors"
                        >
                          Accepter
                        </button>
                      </div>
                    ) : hasRequested ? (
                      <div className="flex gap-2">
                        <button onClick={() => setSelectedFriend(result)} className="p-2 sm:p-2.5 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors">
                          <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <span className="text-xs sm:text-sm text-gray-500 font-bold uppercase flex items-center px-2">Demande en attente</span>
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

      {/* Public Profile Modal */}
      <AnimatePresence>
        {viewingProfileUid && (
          <PublicProfileModal
            targetUid={viewingProfileUid}
            currentUser={user}
            onClose={() => setViewingProfileUid(null)}
          />
        )}
      </AnimatePresence>

      {/* Remove Friend Confirmation Modal */}
      <AnimatePresence>
        {friendToRemove && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative"
            >
              <button
                onClick={() => setFriendToRemove(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center mb-6">
                <h3 className="text-xl font-black italic uppercase text-white mb-2">Supprimer l'ami</h3>
                <p className="text-sm text-gray-400">Êtes-vous sûr de vouloir supprimer cet ami ?</p>
                <p className="text-lg font-bold text-red-500 mt-1">{friendToRemove.pseudo}</p>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => removeFriend(friendToRemove.uid)}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-black uppercase"
                >
                  Oui, supprimer
                </Button>

                <Button
                  onClick={() => setFriendToRemove(null)}
                  className="w-full bg-white/10 hover:bg-white/20 text-white font-bold uppercase"
                >
                  Annuler
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
