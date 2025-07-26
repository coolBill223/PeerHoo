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
  arrayUnion,
} from 'firebase/firestore';
import { getUserInfo } from './userService';

/**
 * Creates a partner record between two users for a specific course.
 * Stores display names and computing IDs for efficient querying and fallback display.
 *
 * @param {Object} param0
 * @param {string} param0.userA - First user's UID
 * @param {string} param0.userB - Second user's UID
 * @param {string} param0.course - Course code
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

  if (alreadyExists) {
    console.log('Partnership already exists between', userA, 'and', userB, 'for', course);
    return;
  }

  const [userAInfo, userBInfo] = await Promise.all([
    getUserInfo(userA),
    getUserInfo(userB)
  ]);

  const partnershipData = {
    userA,
    userB,
    course,
    createdAt: serverTimestamp(),
    deleteRequestedBy: [],
    userAName: userAInfo?.name || `Student ${userA.slice(0, 8)}`,
    userBName: userBInfo?.name || `Student ${userB.slice(0, 8)}`,
    userAComputingId: userAInfo?.computingId || userA.slice(0, 8),
    userBComputingId: userBInfo?.computingId || userB.slice(0, 8),
  };

  await addDoc(collection(db, 'partners'), partnershipData);
  
  console.log('Created partnership with user info:', partnershipData);
};

/**
 * Retrieves all partners of a user for a given course.
 *
 * @param {string} uid - User UID
 * @param {string} course - Course code
 * @returns {Promise<Array>} - List of partnership records
 */
export const getPartnersForCourse = async (uid, course) => {
  const q = query(collection(db, 'partners'), where('course', '==', course));
  const snap = await getDocs(q);

  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((p) => p.userA === uid || p.userB === uid);
};


/**
 * Same as getPartnersForCourse, but includes partner names and computing IDs.
 *
 * @param {string} uid - User UID
 * @param {string} course - Course code
 * @returns {Promise<Array>} - List of partners with name/computingId
 */
export const getPartnersForCourseWithNames = async (uid, course) => {
  const partners = await getPartnersForCourse(uid, course);
  
  const partnersWithNames = await Promise.all(
    partners.map(async (partner) => {
      const partnerId = partner.userA === uid ? partner.userB : partner.userA;
      
      let partnerName = null;
      let partnerComputingId = null;
      
      if (partner.userA === uid && partner.userBName) {
        partnerName = partner.userBName;
        partnerComputingId = partner.userBComputingId;
      } else if (partner.userB === uid && partner.userAName) {
        partnerName = partner.userAName;
        partnerComputingId = partner.userAComputingId;
      }
      
      if (!partnerName) {
        const userInfo = await getUserInfo(partnerId);
        partnerName = userInfo?.name || `Student ${partnerId.slice(0, 8)}`;
        partnerComputingId = userInfo?.computingId || partnerId.slice(0, 8);
        
        try {
          const updateData = {};
          if (partner.userA === partnerId) {
            updateData.userAName = partnerName;
            updateData.userAComputingId = partnerComputingId;
          } else {
            updateData.userBName = partnerName;
            updateData.userBComputingId = partnerComputingId;
          }
          
          await updateDoc(doc(db, 'partners', partner.id), updateData);
          console.log('Updated partnership with missing names:', updateData);
        } catch (error) {
          console.error('Error updating partnership names:', error);
        }
      }
      
      return {
        id: partner.id,
        partnerId,
        course: partner.course,
        partnerName,
        partnerComputingId,
      };
    })
  );
  
  return partnersWithNames.sort((a, b) => a.partnerName.localeCompare(b.partnerName));
};

/**
 * Checks whether the user can send more match requests for a course.
 * Users can have at most 2 partners per course.
 *
 * @param {string} uid - User UID
 * @param {string} course - Course code
 * @returns {Promise<boolean>}
 */
export const canSendMatchRequest = async (uid, course) => {
  const partners = await getPartnersForCourse(uid, course);
  return partners.length < 2;
};

/**
 * Sends a delete request for a partnership.
 * Deletes if both users have requested deletion.
 *
 * @param {string} partnerId - Partnership document ID
 * @param {string} uid - UID of the requester
 */
export const requestDeletePartner = async (partnerId, uid) => {
  const ref = doc(db, 'partners', partnerId);
  const partnerDoc = await getDoc(ref);
  
  if (!partnerDoc.exists()) {
    console.log('Partnership not found:', partnerId);
    return;
  }

  const partnerData = partnerDoc.data();
  const current = partnerData.deleteRequestedBy || [];

  if (!current.includes(uid)) {
    const updated = [...current, uid];

    if (updated.length >= 2) {
      await deleteDoc(ref);
      console.log('Partnership deleted by mutual request:', partnerId);
    } else {
      await updateDoc(ref, { deleteRequestedBy: updated });
      console.log('Delete request added for partnership:', partnerId);
    }
  }
};

/**
 * Retrieves all accepted partnerships for a user, with updated names.
 *
 * @param {string} uid - User UID
 * @returns {Promise<Array>} - List of partner records
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
      
      let partnerName = null;
      let partnerComputingId = null;
      
      if (p.userA === uid && p.userBName) {
        partnerName = p.userBName;
        partnerComputingId = p.userBComputingId;
      } else if (p.userB === uid && p.userAName) {
        partnerName = p.userAName;
        partnerComputingId = p.userAComputingId;
      }
      
      if (!partnerName || 
          partnerName.includes('Unknown') || 
          partnerName.includes('Study Partner') ||
          partnerName.startsWith('User ')) {
        
        console.log(`Refreshing name for partner ${partnerId}`);
        const userInfo = await getUserInfo(partnerId);
        const freshName = userInfo?.name || `Student ${partnerId.slice(0, 8)}`;
        const freshComputingId = userInfo?.computingId || partnerId.slice(0, 8);
        
        if (freshName !== partnerName && !freshName.includes('Unknown')) {
          try {
            const updateData = {};
            if (p.userA === partnerId) {
              updateData.userAName = freshName;
              updateData.userAComputingId = freshComputingId;
            } else {
              updateData.userBName = freshName;
              updateData.userBComputingId = freshComputingId;
            }
            updateData.lastNameUpdate = serverTimestamp();
            
            await updateDoc(doc(db, 'partners', p.id), updateData);
            console.log('Updated partnership with better names:', updateData);
            
            partnerName = freshName;
            partnerComputingId = freshComputingId;
          } catch (error) {
            console.error('Error updating partnership names:', error);
          }
        } else {
          partnerName = freshName;
          partnerComputingId = freshComputingId;
        }
      }
      
      return {
        id: p.id,
        partnerId,
        course: p.course,
        partnerName,
        partnerComputingId,
      };
    })
  );

  return partnersWithNames.sort((a, b) => {
    const courseCompare = a.course.localeCompare(b.course);
    if (courseCompare !== 0) return courseCompare;
    return a.partnerName.localeCompare(b.partnerName);
  });
};

/**
 * Refreshes all partnership names for a given user.
 * Useful if display names have changed.
 *
 * @param {string} uid - User UID
 * @returns {Promise<Object>} - Summary of refresh result
 */
export const refreshAllPartnershipNames = async (uid) => {
  try {
    const q = query(collection(db, 'partners'));
    const snap = await getDocs(q);
    
    const userPartnerships = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((p) => p.userA === uid || p.userB === uid);
    
    console.log(`Found ${userPartnerships.length} partnerships to refresh for user ${uid}`);
    
    const refreshPromises = userPartnerships.map(async (partnership) => {
      try {
        const [userAInfo, userBInfo] = await Promise.all([
          getUserInfo(partnership.userA),
          getUserInfo(partnership.userB)
        ]);
        
        const updateData = {
          userAName: userAInfo?.name || `Student ${partnership.userA.slice(0, 8)}`,
          userBName: userBInfo?.name || `Student ${partnership.userB.slice(0, 8)}`,
          userAComputingId: userAInfo?.computingId || partnership.userA.slice(0, 8),
          userBComputingId: userBInfo?.computingId || partnership.userB.slice(0, 8),
          lastNameRefresh: serverTimestamp(),
        };
        
        await updateDoc(doc(db, 'partners', partnership.id), updateData);
        console.log(`Refreshed partnership ${partnership.id}:`, updateData);
        return {
          partnershipId: partnership.id,
          course: partnership.course,
          userAName: updateData.userAName,
          userBName: updateData.userBName,
        };
      } catch (error) {
        console.error(`Error refreshing partnership ${partnership.id}:`, error);
        return null;
      }
    });
    
    const results = await Promise.all(refreshPromises);
    const successful = results.filter(r => r !== null);
    
    return {
      success: true,
      message: `Refreshed ${successful.length} partnerships`,
      refreshedPartnerships: successful,
    };
    
  } catch (error) {
    console.error('Error refreshing partnership names:', error);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Blocks a partner (one-way).
 *
 * @param {string} partnershipId - Partnership document ID
 * @param {string} uid - UID of the user blocking
 */
export const blockPartner = async (partnershipId, uid) => {
  const ref = doc(db, 'partners', partnershipId);
  const docSnap = await getDoc(ref);
  if (!docSnap.exists()) throw new Error('Partnership not found');

  const data = docSnap.data();
  const blockedBy = data.blockedBy || [];

  if (!blockedBy.includes(uid)) {
    blockedBy.push(uid);
    await updateDoc(ref, { blockedBy });
  }
};

/**
 * Unblocks a previously blocked partner.
 *
 * @param {string} partnershipId - Partnership document ID
 * @param {string} uid - UID of the user unblocking
 */
export const unblockPartner = async (partnershipId, uid) => {
  const ref = doc(db, 'partners', partnershipId);
  const docSnap = await getDoc(ref);
  if (!docSnap.exists()) throw new Error('Partnership not found');

  const data = docSnap.data();
  const blockedBy = data.blockedBy || [];

  const updatedBlockedBy = blockedBy.filter(id => id !== uid);
  
  await updateDoc(ref, { blockedBy: updatedBlockedBy });
};

/**
 * Checks whether a user has blocked a partnership.
 *
 * @param {string} partnershipId - Partnership document ID
 * @param {string} uid - UID to check
 * @returns {Promise<boolean>}
 */
export const isPartnerBlocked = async (partnershipId, uid) => {
  const ref = doc(db, 'partners', partnershipId);
  const docSnap = await getDoc(ref);
  if (!docSnap.exists()) return false;

  const data = docSnap.data();
  const blockedBy = data.blockedBy || [];
  return blockedBy.includes(uid);
};

/**
 * Submits a report for inappropriate behavior in a partnership.
 *
 * @param {string} partnershipId - Partnership ID
 * @param {string} reporterId - UID of the reporting user
 * @param {string} reason - Reason for the report
 */
export const reportPartner = async (partnershipId, reporterId, reason) => {
  const ref = doc(db, 'partners', partnershipId);
  
  const newReport = {
    reporterId,
    reason,
    reportedAt: new Date(),  // Not serverTimestamp for client consistency
  };

  await updateDoc(ref, {
    reports: arrayUnion(newReport)
  });
};