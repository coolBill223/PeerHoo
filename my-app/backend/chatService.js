import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const getOrCreateChat = async (uid1, uid2) => {
  // Sort uids to ensure consistent pairing
  const participants = [uid1, uid2].sort();

  // Check if chat exists
  const chatsRef = collection(db, 'chats');
  const q = query(
    chatsRef,
    where('participants', '==', participants)
  );
  const existing = await getDocs(q);

  if (!existing.empty) {
    // Chat already exists
    return existing.docs[0].id;
  }

  // Else, create new chat
  const newChat = await addDoc(chatsRef, {
    participants,
    createdAt: new Date()
  });

  return newChat.id;
};
