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
  getDoc,
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
 * Get user info by UID
 */
const getUserInfo = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data();
    }
    return null;
  } catch (error) {
    console.error('Error fetching user info:', error);
    return null;
  }
};

/**
 * Get partners for a specific course with user names
 */
export const getPartnersForCourseWithNames = async (uid, course) => {
  const partners = await getPartnersForCourse(uid, course);
  
  const partnersWithNames = await Promise.all(
    partners.map(async (partner) => {
      const partnerId = partner.userA === uid ? partner.userB : partner.userA;
      const userInfo = await getUserInfo(partnerId);
      
      return {
        id: partner.id,
        partnerId,
        course: partner.course,
        partnerName: userInfo?.name || 'Unknown User',
        partnerComputingId: userInfo?.computingId || '',
      };
    })
  );
  
  return partnersWithNames.sort((a, b) => a.partnerName.localeCompare(b.partnerName));
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
 * get the partner record with user names
 */
export const getAcceptedPartners = async (uid) => {
  const q = query(collection(db, 'partners'));
  const snap = await getDocs(q);

  const partners = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((p) => p.userA === uid || p.userB === uid);

  const partnersWithNames = await Promise.all(
    partners.map(async (p) => {
      const partnerId = p.userA === uid ? p.userB : p.userA;
      const userInfo = await getUserInfo(partnerId);
      
      return {
        id: p.id,
        partnerId,
        course: p.course,
        partnerName: userInfo?.name || 'Unknown User',
        partnerComputingId: userInfo?.computingId || '',
      };
    })
  );

  // Sort by course first, then by partner name
  return partnersWithNames.sort((a, b) => {
    const courseCompare = a.course.localeCompare(b.course);
    if (courseCompare !== 0) return courseCompare;
    return a.partnerName.localeCompare(b.partnerName);
  });
};