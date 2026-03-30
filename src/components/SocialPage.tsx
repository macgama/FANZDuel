import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { Card, Button } from './Layout';
import { Users, UserPlus, Search, Check, X, Clock, Shield } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';

interface SocialPageProps {
  user: UserProfile;
  onBack: () => void;
}

export function SocialPage({ user, onBack }: SocialPageProps) {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<UserProfile[]>([]);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFriendsAndRequests();
  }, [user]);

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

  const sendFriendRequest = async (targetUid: string) => {
    try {
      await updateDoc(doc(db, 'users', targetUid), {
        friendRequests: arrayUnion(user.uid)
      });
      alert('Demande d\'ami envoyée !');
    } catch (err) {
      console.error("Error sending friend request", err);
    }
  };

  const acceptFriendRequest = async (targetUid: string) => {
    try {
      // Add to both friends lists
      await updateDoc(doc(db, 'users', user.uid), {
        friends: arrayUnion(targetUid),
        friendRequests: arrayRemove(targetUid)
      });
      await updateDoc(doc(db, 'users', targetUid), {
        friends: arrayUnion(user.uid)
      });
      fetchFriendsAndRequests();
    } catch (err) {
      console.error("Error accepting friend request", err);
    }
  };

  const declineFriendRequest = async (targetUid: string) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        friendRequests: arrayRemove(targetUid)
      });
      fetchFriendsAndRequests();
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

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Tabs */}
      <div className="flex gap-1 p-4 bg-[#111111]/50 border-b border-white/5">
        <button 
          onClick={() => setActiveTab('friends')}
          className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${activeTab === 'friends' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
        >
          Amis ({friends.length})
        </button>
        <button 
          onClick={() => setActiveTab('requests')}
          className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all relative ${activeTab === 'requests' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
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
          className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${activeTab === 'search' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
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
                <button onClick={() => removeFriend(friend.uid)} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors">
                  <X className="w-4 h-4" />
                </button>
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
                  <button onClick={() => acceptFriendRequest(request.uid)} className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-colors">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => declineFriendRequest(request.uid)} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors">
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
                    <div className="flex items-center gap-3">
                      <img src={result.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.uid}`} alt={result.pseudo} className="w-10 h-10 rounded-full bg-white/10" />
                      <div>
                        <div className="font-black text-white">{result.pseudo}</div>
                        <div className="text-[10px] text-gray-500 uppercase font-bold">Niv. {result.level}</div>
                      </div>
                    </div>
                    {isFriend ? (
                      <span className="text-xs text-green-500 font-bold uppercase">Ami</span>
                    ) : hasRequested ? (
                      <span className="text-xs text-gray-500 font-bold uppercase">En attente</span>
                    ) : (
                      <button 
                        onClick={() => sendFriendRequest(result.uid)}
                        className="p-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
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
