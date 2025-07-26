import { db, auth } from '../firebaseConfig';
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
  getDoc,
} from 'firebase/firestore';
import { createPartnerPair } from './partnerService';

/**
 * Retrieves the current authenticated user's detailed profile information.
 * Falls back to auth data if Firestore data is unavailable.
 * 
 * @returns {Promise<Object>} - User info: uid, name, email, computingId
 * @throws {Error} - If no user is signed in
 */
const getCurrentUserInfo = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('No authenticated user');
  }

  try {
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        uid: currentUser.uid,
        name: userData.name || currentUser.displayName || 'Unknown User',
        email: userData.email || currentUser.email,
        computingId: userData.computingId || (currentUser.email ? currentUser.email.split('@')[0] : 'unknown'),
      };
    }
  } catch (error) {
    console.log('Could not fetch user from Firestore, using auth data');
  }

  // Fallback if Firestore fails
  return {
    uid: currentUser.uid,
    name: currentUser.displayName || 'Unknown User',
    email: currentUser.email,
    computingId: currentUser.email ? currentUser.email.split('@')[0] : 'unknown',
  };
};

/**
 * Submits a new match request to Firestore.
 * Stores sender info for display and filtering purposes.
 * 
 * @param {Object} param0 - Match request details
 * @returns {Promise<string>} - ID of the newly created match request
 */
export const sendMatchRequest = async ({
  senderId,
  course,
  studyTime,
  meetingPreference,
  bio,
  professorName
}) => {
  const userInfo = await getCurrentUserInfo();
  
  const docRef = await addDoc(collection(db, 'matchRequests'), {
    senderId,
    course,
    studyTime,
    meetingPreference,
    bio,
    professorName: professorName || '',
    receiverId: null,
    status: 'pending',
    createdAt: serverTimestamp(),
    senderName: userInfo.name,
    senderEmail: userInfo.email,
    senderComputingId: userInfo.computingId,
  });
  
  console.log('Created match request with user info:', {
    id: docRef.id,
    senderName: userInfo.name,
    senderEmail: userInfo.email,
    course,
  });
  
  return docRef.id;
};

/**
 * Retrieves all match requests created by the current user.
 * 
 * @param {string} uid - User ID of the sender
 * @returns {Promise<Array>} - List of match requests sent by the user
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
 * Retrieves all incoming, pending, and rejected match requests relevant to the user.
 * Includes:
 *   - requests sent to the user
 *   - user-sent requests that have a receiver
 *   - requests the user applied to but were rejected
 * 
 * @param {string} uid - Current user's ID
 * @returns {Promise<Array>} - List of relevant incoming requests
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

  const rejectedRecvQ = query(
    collection(db, 'matchRequests'),
    where('receiverId', '==', uid),
    where('status', '==', 'rejected')
  );
  
  const [recvSnap, sendSnap, rejectedRecvSnap] = await Promise.all([
    getDocs(recvQ), 
    getDocs(sendQ), 
    getDocs(rejectedRecvQ)
  ]);

  const recv = recvSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const send = sendSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(m => m.receiverId); // Filter those that were applied to
  
  const rejectedRecv = rejectedRecvSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
  return [...recv, ...send, ...rejectedRecv];
};

/**
 * Updates the status of a match request (accepted or rejected).
 * 
 * @param {string} requestId - ID of the match request
 * @param {'accepted' | 'rejected'} status - New status to set
 */
export const updateMatchRequestStatus = async (requestId, status) => {
  const ref = doc(db, 'matchRequests', requestId);
  await updateDoc(ref, { status });
};

/**
 * Retrieves all open (pending, unclaimed) match requests for a given course.
 * Filters out any requests created by the current user.
 * 
 * @param {string} courseCode - Course code to search by (e.g., "CS 2100")
 * @param {string} uid - Current user ID
 * @returns {Promise<Array>} - List of open match requests
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
 * Applies to an existing match request.
 * Stores the current user's info as receiver metadata.
 * 
 * @param {string} reqId - ID of the match request
 * @param {string} uid - UID of the user applying
 */
export const applyToMatchRequest = async (reqId, uid) => {
  const userInfo = await getCurrentUserInfo();
  
  await updateDoc(doc(db, 'matchRequests', reqId), {
    receiverId: uid,
    receiverName: userInfo.name,
    receiverEmail: userInfo.email,
    receiverComputingId: userInfo.computingId,
    appliedAt: serverTimestamp(),
  });
  
  console.log('Applied to match request with user info:', {
    reqId,
    receiverName: userInfo.name,
    receiverEmail: userInfo.email,
  });
};

/**
 * Accepts a match request and updates related pending requests.
 * Automatically marks other matching requests for the same two users as accepted.
 * Creates a partner record after acceptance.
 * 
 * @param {Object} req - Match request data (must include senderId, receiverId, course, id)
 */
export const acceptMatchRequest = async (req) => {
  const { senderId, receiverId, course, id: clickedId } = req;

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

    const samePair =
      (data.senderId === senderId && data.receiverId === receiverId) ||
      (data.senderId === receiverId && data.receiverId === senderId);

    const openByEitherSide =
      (data.senderId === senderId && data.receiverId === null) ||
      (data.senderId === receiverId && data.receiverId === null);

    if (samePair || openByEitherSide) {
      updates.push(
        updateDoc(doc(db, 'matchRequests', docId), {
          status: 'accepted',
          acceptedAt: serverTimestamp(),
          receiverId: data.receiverId || counterpart(data),
        })
      );
    }
  });

  // Also accept the clicked match request
  updates.push(
    updateDoc(doc(db, 'matchRequests', clickedId), { 
      status: 'accepted',
      acceptedAt: serverTimestamp(),
    })
  );

  await Promise.all(updates);

   // Create official partnership
  await createPartnerPair({
    userA: senderId,
    userB: receiverId,
    course,
  });
  
  console.log('Created partnership between users:', { senderId, receiverId, course });
};

/**
 * Rejects a match request and logs the time of rejection.
 * 
 * @param {string} requestId - ID of the request to reject
 */
export const rejectMatchRequest = async (requestId) => {
  await updateDoc(doc(db, 'matchRequests', requestId), {
    status: 'rejected',
    rejectedAt: serverTimestamp(),
  });
};