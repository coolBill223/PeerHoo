import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot, orderBy, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getPartnersForCourseWithNames } from './partnerService'

/**
 * Get an existing chat between two users, or create a new one if not found.
 * Only creates a chat if the users are confirmed study partners.
 * 
 * @param {string} uid1 - UID of the first user
 * @param {string} uid2 - UID of the second user
 * @returns {Promise<string>} - The ID of the chat document
 * @throws {Error} - If users are not partners
 */
export const getOrCreateChat = async (uid1, uid2) => {
  const allCourses = await getPartnerCoursesBetween(uid1, uid2);

  if (allCourses.length === 0) {
    throw new Error('You are not study partners yet. Chat is only enabled after both users accept a match.');
  }

  const participants = [uid1, uid2].sort(); // sort to ensure consistent ordering
  const q = query(collection(db, 'chats'), where('participants', '==', participants));
  const existing = await getDocs(q);

  if (!existing.empty) {
    return existing.docs[0].id;  // Return existing chat ID
  }

  // Create new chat document
  const newChat = await addDoc(collection(db, 'chats'), {
    participants,
    createdAt: new Date(),
    sharedCourses: allCourses,
    lastReadBy: {
      [uid1]: serverTimestamp(),
      [uid2]: serverTimestamp()
    }
  });

  // Add a welcome message from the system
  await addDoc(collection(db, 'chats', newChat.id, 'messages'), {
    senderId: 'system',
    text: 'You are now connected with your study partner!',
    sentAt: serverTimestamp(),
  });
  return newChat.id;
};

/**
 * Returns a list of courses shared between two users if they are study partners.
 * 
 * @param {string} uid1 - First user's UID
 * @param {string} uid2 - Second user's UID
 * @returns {Promise<string[]>} - List of shared course names
 */
const getPartnerCoursesBetween = async (uid1, uid2) => {
  const q = query(collection(db, 'partners'));
  const snap = await getDocs(q);

  const matches = snap.docs
    .map((doc) => doc.data())
    .filter((p) =>
      (p.userA === uid1 && p.userB === uid2) ||
      (p.userA === uid2 && p.userB === uid1)
    );

  return matches.map((m) => m.course);
};

/**
 * Sends a message to a specific chat.
 * 
 * @param {string} chatId - ID of the chat
 * @param {string} senderId - UID of the message sender
 * @param {string} text - Text content of the message
 */
export const sendMessage = async (chatId, senderId, text) => {
  const ref = collection(db, 'chats', chatId, 'messages');
  await addDoc(ref, {
    senderId,
    text,
    sentAt: serverTimestamp(),
  });
};

/**
 * Subscribes to real-time message updates in a chat.
 * 
 * @param {string} chatId - ID of the chat
 * @param {Function} callback - Function to call with the latest messages
 * @returns {Function} - Unsubscribe function
 */
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

/**
 * Updates the chat document to mark messages as read by a user.
 * 
 * @param {string} chatId - ID of the chat
 * @param {string} userId - UID of the user who read the chat
 */
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

/**
 * Calculates how many unread messages a user has in a chat.
 * 
 * @param {string} chatId - ID of the chat
 * @param {string} userId - UID of the user
 * @returns {Promise<number>} - Number of unread messages
 */
export const getUnreadCount = async (chatId, userId) => {
  try {
    const chatDoc = await getDoc(doc(db, 'chats', chatId));
    if (!chatDoc.exists()) return 0;
    
    const chatData = chatDoc.data();
    const lastRead = chatData.lastReadBy?.[userId]?.toDate() || new Date(0);
    
    const messagesQuery = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('sentAt', 'desc')
    );
    
    const messageDocs = await getDocs(messagesQuery);
    let unreadCount = 0;
    
    messageDocs.forEach(doc => {
      const messageData = doc.data();
      const sentAt = messageData.sentAt?.toDate();
      
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

/**
 * Subscribes to updates to the chat document, including read status.
 * 
 * @param {string} chatId - ID of the chat
 * @param {Function} callback - Function to call when chat data changes
 * @returns {Function} - Unsubscribe function
 */
export const listenToChatUpdates = (chatId, callback) => {
  const chatRef = doc(db, 'chats', chatId);
  return onSnapshot(chatRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data());
    }
  });
};