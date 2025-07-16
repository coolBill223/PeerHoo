import { db } from '../firebaseConfig';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';

/**
 * submit form
 * @param {Object} param0 - senderId, course, studyTime, meetingPreference, bio
 * @returns {Promise<string>} - new appplication id
 */
export const sendMatchRequest = async ({
  senderId,
  course,
  studyTime,
  meetingPreference,
  bio,
}) => {
  const docRef = await addDoc(collection(db, 'matchRequests'), {
    senderId,
    course,
    studyTime,
    meetingPreference,
    bio,
    receiverId: null,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * @param {string} senderId
 * @param {string|null} course
 */

export const getMyMatchRequests = async (uid) => {
  const q = query(
    collection(db, 'matchRequests'),
    where('senderId', '==', uid)     
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * the pending match
 * @param {string} userId
 */
export const getIncomingMatchRequests = async (userId) => {
  const q = query(
    collection(db, 'matchRequests'),
    where('receiverId', '==', userId),
    where('status', '==', 'pending')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

/**
 * update the status
 * @param {string} requestId
 * @param {'accepted' | 'rejected'} status
 */
export const updateMatchRequestStatus = async (requestId, status) => {
  const ref = doc(db, 'matchRequests', requestId);
  await updateDoc(ref, { status });
};

/**
 * public request, same class, no one accept, status pending, not from me
 * @param {string} courseCode
 * @param {string} uid  
 */
export const getOpenMatchRequests = async (courseCode, uid) => {
  const q = query(
    collection(db, 'matchRequests'),
    where('course', '==', courseCode),
    where('status', '==', 'pending'),
    where('receiverId', '==', null)
  );
  const snap = await getDocs(q);
  return snap.docs
           .map((d) => ({ id: d.id, ...d.data() }))
           .filter((m) => m.senderId !== uid);
};

/**
 * applied
 * @param {string} reqId
 * @param {string} uid
 */
export const applyToMatchRequest = async (reqId, uid) => {
  await updateDoc(doc(db, 'matchRequests', reqId), {
    receiverId: uid,
    status: 'applied',
  });
};
