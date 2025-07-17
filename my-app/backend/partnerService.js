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
import { getUserInfo } from './userService';

/**
 * Create partner pair with enhanced user info storage
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

  // Get user info for both users to store with the partnership
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
    // Store user names for easier querying and display
    userAName: userAInfo?.name || `Student ${userA.slice(0, 8)}`,
    userBName: userBInfo?.name || `Student ${userB.slice(0, 8)}`,
    userAComputingId: userAInfo?.computingId || userA.slice(0, 8),
    userBComputingId: userBInfo?.computingId || userB.slice(0, 8),
  };

  await addDoc(collection(db, 'partners'), partnershipData);
  
  console.log('Created partnership with user info:', partnershipData);
};

/**
 * Get user's partners for one course
 */
export const getPartnersForCourse = async (uid, course) => {
  const q = query(collection(db, 'partners'), where('course', '==', course));
  const snap = await getDocs(q);

  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((p) => p.userA === uid || p.userB === uid);
};

/**
 * Get partners for a specific course with user names (enhanced version)
 */
export const getPartnersForCourseWithNames = async (uid, course) => {
  const partners = await getPartnersForCourse(uid, course);
  
  const partnersWithNames = await Promise.all(
    partners.map(async (partner) => {
      const partnerId = partner.userA === uid ? partner.userB : partner.userA;
      
      // First try to use stored names from partnership data
      let partnerName = null;
      let partnerComputingId = null;
      
      if (partner.userA === uid && partner.userBName) {
        partnerName = partner.userBName;
        partnerComputingId = partner.userBComputingId;
      } else if (partner.userB === uid && partner.userAName) {
        partnerName = partner.userAName;
        partnerComputingId = partner.userAComputingId;
      }
      
      // If no stored names, fetch from user service
      if (!partnerName) {
        const userInfo = await getUserInfo(partnerId);
        partnerName = userInfo?.name || `Student ${partnerId.slice(0, 8)}`;
        partnerComputingId = userInfo?.computingId || partnerId.slice(0, 8);
        
        // Update the partnership document with the found names
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
 * Check if user can send match request (max 2 partners per course)
 */
export const canSendMatchRequest = async (uid, course) => {
  const partners = await getPartnersForCourse(uid, course);
  return partners.length < 2;
};

/**
 * Request to delete a partnership
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

  // Add delete request if not already requested
  if (!current.includes(uid)) {
    const updated = [...current, uid];

    if (updated.length >= 2) {
      // If both users request to delete, then delete
      await deleteDoc(ref);
      console.log('Partnership deleted by mutual request:', partnerId);
    } else {
      await updateDoc(ref, { deleteRequestedBy: updated });
      console.log('Delete request added for partnership:', partnerId);
    }
  }
};

/**
 * Get all accepted partners for a user with enhanced name resolution
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
      
      // First try to use stored names from partnership data
      let partnerName = null;
      let partnerComputingId = null;
      
      if (p.userA === uid && p.userBName) {
        partnerName = p.userBName;
        partnerComputingId = p.userBComputingId;
      } else if (p.userB === uid && p.userAName) {
        partnerName = p.userAName;
        partnerComputingId = p.userAComputingId;
      }
      
      // If no stored names or they look like placeholders, fetch fresh data
      if (!partnerName || 
          partnerName.includes('Unknown') || 
          partnerName.includes('Study Partner') ||
          partnerName.startsWith('User ')) {
        
        console.log(`Refreshing name for partner ${partnerId}`);
        const userInfo = await getUserInfo(partnerId);
        const freshName = userInfo?.name || `Student ${partnerId.slice(0, 8)}`;
        const freshComputingId = userInfo?.computingId || partnerId.slice(0, 8);
        
        // Update the partnership document with better names if we found them
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

  // Sort by course first, then by partner name
  return partnersWithNames.sort((a, b) => {
    const courseCompare = a.course.localeCompare(b.course);
    if (courseCompare !== 0) return courseCompare;
    return a.partnerName.localeCompare(b.partnerName);
  });
};

/**
 * Force refresh all partnership names
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
        // Get fresh user info for both users in the partnership
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