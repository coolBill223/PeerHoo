import { db } from '../firebaseConfig';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  or,
  serverTimestamp,
} from 'firebase/firestore';
import { createPartnerPair } from './partnerService';

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
export const getIncomingMatchRequests = async (uid) => {
  
  const recvQ = query(
    collection(db, 'matchRequests'),
    where('receiverId', '==', uid),
    where('status', '==', 'pending')
  );
  
  const sendQ = query(
    collection(db, 'matchRequests'),
    where('senderId', '==', uid),
    where('status', '==', 'pending')
  );
  const [recvSnap, sendSnap] = await Promise.all([getDocs(recvQ), getDocs(sendQ)]);

  const recv = recvSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const send = sendSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(m => m.receiverId);             
  return [...recv, ...send];
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
  });
};

export const acceptMatchRequest = async (req) => {
  const { senderId, receiverId, course, id: clickedId } = req;

  // helper – returns the opposite uid for a given row
  const counterpart = (row) =>
    row.senderId === senderId ? receiverId : senderId;

  const q = query(
    collection(db, 'matchRequests'),
    where('course', '==', course),
    where('status', '==', 'pending')
  );

  const snap = await getDocs(q);
  const updates = [];

  snap.forEach((d) => {
    const data = d.data();
    const docId = d.id;

    // Same two users in either direction
    const samePair =
      (data.senderId === senderId && data.receiverId === receiverId) ||
      (data.senderId === receiverId && data.receiverId === senderId);

    // Requests posted by either side but still open (receiverId == null)
    const openByEitherSide =
      (data.senderId === senderId && data.receiverId === null) ||
      (data.senderId === receiverId && data.receiverId === null);

    if (samePair || openByEitherSide) {
      updates.push(
        updateDoc(doc(db, 'matchRequests', docId), {
          status: 'accepted',
          receiverId:
            data.receiverId || counterpart(data), // fill if it was null
        })
      );
    }
  });

  // make sure the clicked doc (already pending) is also accepted
  updates.push(
    updateDoc(doc(db, 'matchRequests', clickedId), { status: 'accepted' })
  );

  await Promise.all(updates);

  await createPartnerPair({
    userA: senderId,
    userB: receiverId,
    course,
  })
};
