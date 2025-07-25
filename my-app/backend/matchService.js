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
 * Get current user's full info for storing in match requests
 */
const getCurrentUserInfo = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('No authenticated user');
  }

  // Try to get user info from Firestore first
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

  // Fallback to auth data
  return {
    uid: currentUser.uid,
    name: currentUser.displayName || 'Unknown User',
    email: currentUser.email,
    computingId: currentUser.email ? currentUser.email.split('@')[0] : 'unknown',
  };
};

/**
 * Submit match request form with enhanced user data storage
 * @param {Object} param0 - senderId, course, studyTime, meetingPreference, bio
 * @returns {Promise<string>} - new application id
 */
export const sendMatchRequest = async ({
  senderId,
  course,
  studyTime,
  meetingPreference,
  bio,
  professorName
}) => {
  // Get current user info to store with the match request
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
    // Store sender information for future reference
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
 * Get user's match requests
 * @param {string} uid
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
 * Get incoming match requests for a user - updated to include rejected applications
 * @param {string} uid
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

  // New query for rejected applications where user was the receiver
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
    .filter(m => m.receiverId); // Only include if someone has applied
  
  // Include rejected applications where user was the receiver (applied to someone else's request)
  const rejectedRecv = rejectedRecvSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
  return [...recv, ...send, ...rejectedRecv];
};

/**
 * Update match request status
 * @param {string} requestId
 * @param {'accepted' | 'rejected'} status
 */
export const updateMatchRequestStatus = async (requestId, status) => {
  const ref = doc(db, 'matchRequests', requestId);
  await updateDoc(ref, { status });
};

/**
 * Get open match requests for a course (available for applying)
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
 * Apply to a match request with user info
 * @param {string} reqId
 * @param {string} uid
 */
export const applyToMatchRequest = async (reqId, uid) => {
  // Get current user info to store as receiver
  const userInfo = await getCurrentUserInfo();
  
  await updateDoc(doc(db, 'matchRequests', reqId), {
    receiverId: uid,
    // Store receiver information for future reference
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
 * Accept a match request and create partnership
 */
export const acceptMatchRequest = async (req) => {
  const { senderId, receiverId, course, id: clickedId } = req;

  // Helper function to get the opposite uid for a given row
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
          acceptedAt: serverTimestamp(),
          receiverId: data.receiverId || counterpart(data), // fill if it was null
        })
      );
    }
  });

  // Make sure the clicked doc (already pending) is also accepted
  updates.push(
    updateDoc(doc(db, 'matchRequests', clickedId), { 
      status: 'accepted',
      acceptedAt: serverTimestamp(),
    })
  );

  await Promise.all(updates);

  // Create the partnership with enhanced info
  await createPartnerPair({
    userA: senderId,
    userB: receiverId,
    course,
  });
  
  console.log('Created partnership between users:', { senderId, receiverId, course });
};

/**
 * Reject a match request
 * @param {string} requestId
 */
export const rejectMatchRequest = async (requestId) => {
  await updateDoc(doc(db, 'matchRequests', requestId), {
    status: 'rejected',
    rejectedAt: serverTimestamp(),
  });
};