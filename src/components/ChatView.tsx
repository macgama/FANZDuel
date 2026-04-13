import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, setDoc, getDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, Send } from 'lucide-react';
import { getImageUrl } from '../lib/utils';
import { FanzTemplate, FanzEmote } from '../types';

interface ChatViewProps {
  currentUser: UserProfile;
  friend: UserProfile;
  onBack: () => void;
}

export function ChatView({ currentUser, friend, onBack }: ChatViewProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEmotes, setShowEmotes] = useState(false);
  const [allEmotes, setAllEmotes] = useState<FanzEmote[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatId = [currentUser.uid, friend.uid].sort().join('_');

  useEffect(() => {
    const fetchEmotes = async () => {
      try {
        const emotes: FanzEmote[] = [];
        
        // Fetch from fanz_templates
        const templatesSnap = await getDocs(collection(db, 'fanz_templates'));
        templatesSnap.forEach(doc => {
          const template = doc.data() as FanzTemplate;
          if (template.emotes) {
            emotes.push(...template.emotes);
          }
        });

        // Fetch from emotes collection
        try {
          const emotesSnap = await getDocs(collection(db, 'emotes'));
          emotesSnap.forEach(doc => {
            emotes.push({ id: doc.id, ...doc.data() } as FanzEmote);
          });
        } catch (e) {
          console.warn("Could not fetch from emotes collection", e);
        }

        setAllEmotes(emotes);
      } catch (err) {
        console.error("Error fetching emotes", err);
      }
    };
    fetchEmotes();

    let unsubscribe: () => void;

    // Initialize chat document if it doesn't exist
    const initChatAndListen = async () => {
      try {
        const chatRef = doc(db, 'chats', chatId);
        const chatSnap = await getDoc(chatRef);
        if (!chatSnap.exists()) {
          await setDoc(chatRef, {
            id: chatId,
            participants: [currentUser.uid, friend.uid],
            lastMessage: '',
            lastMessageTime: new Date().toISOString(),
            unreadCount: {
              [currentUser.uid]: 0,
              [friend.uid]: 0
            }
          });
        }

        const q = query(
          collection(db, 'chats', chatId, 'messages'),
          orderBy('timestamp', 'asc')
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
          const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setMessages(msgs);
          setLoading(false);
          scrollToBottom();
        }, (error) => {
          console.error("Error in chat messages listener:", error);
        });
      } catch (error) {
        console.error("Error initializing chat:", error);
        setLoading(false);
      }
    };
    
    initChatAndListen();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [chatId, currentUser.uid, friend.uid]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendEmote = async (emoteId: string) => {
    setShowEmotes(false);
    try {
      const messageData = {
        senderId: currentUser.uid,
        receiverId: friend.uid,
        emoteId: emoteId,
        timestamp: new Date().toISOString(),
        read: false
      };
      
      await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
      
      await setDoc(doc(db, 'chats', chatId), {
        lastMessage: emoteId,
        lastMessageTime: new Date().toISOString(),
      }, { merge: true });
      
    } catch (err) {
      console.error("Error sending message", err);
    }
  };

  // Filter available emotes based on what the user has unlocked
  const availableEmotes = allEmotes.filter(e => currentUser.emotes?.includes(e.id));

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-[#111111]/50 border-b border-white/5">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <img src={friend.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.uid}`} alt={friend.pseudo} className="w-10 h-10 rounded-full bg-white/10" />
        <div>
          <div className="font-black text-white">{friend.pseudo}</div>
          <div className="text-[10px] text-gray-500 uppercase font-bold">Niv. {friend.level}</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10 text-gray-500 font-bold italic text-sm">
            Envoyez une emote pour commencer la discussion !
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === currentUser.uid;
            const emote = allEmotes.find(e => e.id === msg.emoteId);
            
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  <div className={`p-2 rounded-2xl ${isMine ? 'bg-blue-600/20 rounded-tr-sm' : 'bg-white/10 rounded-tl-sm'}`}>
                    {emote ? (
                      <img src={getImageUrl(emote.imageUrl)} alt={emote.name} className="w-16 h-16 object-contain" />
                    ) : (
                      <span className="text-white text-xs">Emote inconnue</span>
                    )}
                  </div>
                  <span className="text-[8px] text-gray-500 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#111111]/50 border-t border-white/5 relative">
        {showEmotes && (
          <div className="absolute bottom-full left-0 right-0 p-4 bg-gray-900 border-t border-white/10 max-h-48 overflow-y-auto">
            {availableEmotes.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {availableEmotes.map((emote, idx) => (
                  <button 
                    key={`${emote.id}-${idx}`}
                    onClick={() => handleSendEmote(emote.id)}
                    className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center"
                  >
                    <img src={getImageUrl(emote.imageUrl)} alt={emote.name} className="w-10 h-10 object-contain" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm font-bold">
                Vous n'avez pas encore débloqué d'emotes.
              </div>
            )}
          </div>
        )}
        
        <button 
          onClick={() => setShowEmotes(!showEmotes)}
          className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-black text-sm uppercase tracking-widest text-white transition-colors flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          {showEmotes ? 'Fermer' : 'Envoyer une Emote'}
        </button>
      </div>
    </div>
  );
}
