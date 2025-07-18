import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot, orderBy, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getPartnersForCourseWithNames } from './partnerService'

export const getOrCreateChat = async (uid1, uid2) => {
  // console.log(" Creating chat between:", uid1, uid2);

  //check is partner
  const allCourses = await getPartnerCoursesBetween(uid1, uid2);

  if (allCourses.length === 0) {
    throw new Error('You are not study partners yet. Chat is only enabled after both users accept a match.');
  }

  const participants = [uid1, uid2].sort();
  const q = query(collection(db, 'chats'), where('participants', '==', participants));
  const existing = await getDocs(q);

  if (!existing.empty) {
    return existing.docs[0].id;
  }

  //create new chat room
  const newChat = await addDoc(collection(db, 'chats'), {
    participants,
    createdAt: new Date(),
    sharedCourses: allCourses,
    // Initialize last read timestamps for each participant
    lastReadBy: {
      [uid1]: serverTimestamp(),
      [uid2]: serverTimestamp()
    }
  });

  //create defult welcome message, to remind you have successfully add the partner
  await addDoc(collection(db, 'chats', newChat.id, 'messages'), {
    senderId: 'system',
    text: 'You are now connected with your study partner!',
    sentAt: serverTimestamp(),
  });
  return newChat.id;
};

const getPartnerCoursesBetween = async (uid1, uid2) => {
  const q = query(collection(db, 'partners'));
  const snap = await getDocs(q);

  // console.log("Loaded partners:");
  // console.log(snap.docs.map(doc => doc.data()));
  // console.log("Filtering between:", uid1, uid2);

  const matches = snap.docs
    .map((doc) => doc.data())
    .filter((p) =>
      (p.userA === uid1 && p.userB === uid2) ||
      (p.userA === uid2 && p.userB === uid1)
    );

  return matches.map((m) => m.course);
};

export const sendMessage = async (chatId, senderId, text) => {
  const ref = collection(db, 'chats', chatId, 'messages');
  await addDoc(ref, {
    senderId,
    text,
    sentAt: serverTimestamp(),
  });
};

export const listenToMessages = (chatId, callback) => {
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('sentAt', 'asc')
  );
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(messages);
  });
};

// Mark messages as read when user opens a chat
export const markChatAsRead = async (chatId, userId) => {
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      [`lastReadBy.${userId}`]: serverTimestamp()
    });
  } catch (error) {
    console.error('Error marking chat as read:', error);
  }
};

// Get unread message count for a specific chat
export const getUnreadCount = async (chatId, userId) => {
  try {
    const chatDoc = await getDoc(doc(db, 'chats', chatId));
    if (!chatDoc.exists()) return 0;
    
    const chatData = chatDoc.data();
    const lastRead = chatData.lastReadBy?.[userId]?.toDate() || new Date(0);
    
    // Get messages after last read time
    const messagesQuery = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('sentAt', 'desc')
    );
    
    const messageDocs = await getDocs(messagesQuery);
    let unreadCount = 0;
    
    messageDocs.forEach(doc => {
      const messageData = doc.data();
      const sentAt = messageData.sentAt?.toDate();
      
      // Count messages sent after last read time and not by current user
      if (sentAt && sentAt > lastRead && messageData.senderId !== userId && messageData.senderId !== 'system') {
        unreadCount++;
      }
    });
    
    return unreadCount;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

// Listen to chat updates including read status
export const listenToChatUpdates = (chatId, callback) => {
  const chatRef = doc(db, 'chats', chatId);
  return onSnapshot(chatRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data());
    }
  });
};