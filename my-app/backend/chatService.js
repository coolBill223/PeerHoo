import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot, orderBy } from 'firebase/firestore';
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