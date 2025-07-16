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
export const getMyMatchRequests = async (senderId, course = null) => {
  let q = query(
    collection(db, 'matchRequests'),
    where('senderId', '==', senderId)
  );

  if (course) {
    q = query(
      collection(db, 'matchRequests'),
      where('senderId', '==', senderId),
      where('course', '==', course)
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
