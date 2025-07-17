import { db } from '../firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

/**
 * create partner (used by match service)
 */
export const createPartnerPair = async ({ userA, userB, course }) => {
  const q = query(collection(db, 'partners'), where('course', '==', course));
  const snap = await getDocs(q);

  const alreadyExists = snap.docs.some(d => {
    const data = d.data();
    return (
      (data.userA === userA && data.userB === userB) ||
      (data.userA === userB && data.userB === userA)
    );
  });

  if (alreadyExists) return;

  await addDoc(collection(db, 'partners'), {
    userA,
    userB,
    course,
    createdAt: serverTimestamp(),
    deleteRequestedBy: [],
  });
};

/**
 * Get user's one courses' partner(s)
 */
export const getPartnersForCourse = async (uid, course) => {
  const q = query(collection(db, 'partners'), where('course', '==', course));
  const snap = await getDocs(q);

  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((p) => p.userA === uid || p.userB === uid);
};

/**
 * check can send match or not
 * one course can have max=2 partners
 */
export const canSendMatchRequest = async (uid, course) => {
  const partners = await getPartnersForCourse(uid, course);
  return partners.length < 2;
};

/**
 * create delete partner requests
 */
export const requestDeletePartner = async (partnerId, uid) => {
  const ref = doc(db, 'partners', partnerId);
  const snap = await getDocs(query(collection(db, 'partners'), where('__name__', '==', partnerId)));
  if (snap.empty) return;

  const partnerData = snap.docs[0].data();
  const current = partnerData.deleteRequestedBy || [];

  // add delete requests
  if (!current.includes(uid)) {
    const updated = [...current, uid];

    if (updated.length >= 2) {
      // if both users request to delete, then delete
      await deleteDoc(ref);
    } else {
      await updateDoc(ref, { deleteRequestedBy: updated });
    }
  }
};

/**
 * get the partner record
 */
export const getAcceptedPartners = async (uid) =>{
  const q = query(collection(db, 'partners'));
  const snap = await getDocs(q);

  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((p) => p.userA === uid || p.userB === uid)
    .map((p) => ({
      id: p.id,
      partnerId: p.userA === uid ? p.userB : p.userA,
      course: p.course,
    }));
};