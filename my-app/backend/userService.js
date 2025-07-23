import { db, auth } from '../firebaseConfig';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
/**
 * Get user info by UID with enhanced name resolution
 */
export const getUserInfo = async (uid) => {
  try {
    console.log('Fetching user info for UID:', uid);
    
    // First try to get from Firestore users collection
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log('Found user in Firestore:', userData);
      
      // If it's a placeholder or generic name, try to find better data
      if (userData.isPlaceholder || 
          userData.name?.includes('Unknown') || 
          userData.name?.includes('Study Partner') ||
          userData.name?.startsWith('User ')) {
        console.log('Found placeholder user, attempting to find real name...');
        const realUserInfo = await findRealUserInfo(uid);
        if (realUserInfo && realUserInfo.name !== userData.name) {
          // Update the document with better information
          const updatedData = { ...userData, ...realUserInfo, lastUpdated: serverTimestamp() };
          await setDoc(doc(db, 'users', uid), updatedData, { merge: true });
          return updatedData;
        }
      }
      
      return userData;
    }
    
    console.log('User not found in Firestore for UID:', uid);
    
    // Try to get from Firebase Auth if it's the current user
    if (auth.currentUser && auth.currentUser.uid === uid) {
      const authUser = auth.currentUser;
      console.log('Using current auth user data:', {
        name: authUser.displayName,
        email: authUser.email
      });
      
      const userData = {
        name: authUser.displayName || 'Unknown User',
        email: authUser.email || 'Unknown Email',
        computingId: authUser.email ? authUser.email.split('@')[0] : 'unknown',
        createdAt: serverTimestamp(),
      };
      
      await setDoc(doc(db, 'users', uid), userData);
      console.log('Created user document from auth data:', userData);
      return userData;
    }
    
    // Try to find real user info from other sources
    const realUserInfo = await findRealUserInfo(uid);
    if (realUserInfo) {
      await setDoc(doc(db, 'users', uid), realUserInfo);
      console.log('Created user document from found data:', realUserInfo);
      return realUserInfo;
    }
    
    // Last resort: return a descriptive placeholder
    const fallbackData = {
      name: `Student ${uid.slice(0, 8)}`,
      computingId: uid.slice(0, 8),
      email: `${uid.slice(0, 8)}@virginia.edu`,
      isPlaceholder: true,
      createdAt: serverTimestamp(),
    };
    
    await setDoc(doc(db, 'users', uid), fallbackData);
    return fallbackData;
    
  } catch (error) {
    console.error('Error fetching user info for UID:', uid, error);
    return {
      name: `Student ${uid.slice(0, 8)}`,
      computingId: uid.slice(0, 8),
      email: `${uid.slice(0, 8)}@virginia.edu`,
      isPlaceholder: true,
    };
  }
};

/**
 * Get current user's profile data
 */
export const getCurrentUserProfile = async () => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('No authenticated user found');
    }

    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    if (userDoc.exists()) {
      return { id: currentUser.uid, ...userDoc.data() };
    }

    // If no document exists, create one from auth data
    const userData = {
      name: currentUser.displayName || 'Your Name',
      email: currentUser.email || 'your.email@virginia.edu',
      computingId: currentUser.email ? currentUser.email.split('@')[0] : 'unknown',
      bio: '',
      courses: [],
      studyTimes: ['Evenings', 'Weekends'],
      meetingPreference: 'In-person & Virtual',
      selectedAvatar: 'person-circle',
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', currentUser.uid), userData);
    return { id: currentUser.uid, ...userData };
    
  } catch (error) {
    console.error('Error getting current user profile:', error);
    throw error;
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (profileData) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('No authenticated user found');
    }

    const { name, bio, courses, studyTimes, meetingPreference, selectedAvatar, photoURL } = profileData;

    // Prepare update data
    const updateData = {
      lastUpdated: serverTimestamp(),
    };

    // Only update fields that are provided
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (courses !== undefined) updateData.courses = courses;
    if (studyTimes !== undefined) updateData.studyTimes = studyTimes;
    if (meetingPreference !== undefined) updateData.meetingPreference = meetingPreference;
    if (selectedAvatar !== undefined) updateData.selectedAvatar = selectedAvatar;
    if (photoURL !== undefined) updateData.photoURL = photoURL;
    
    // Update Firestore document
    await updateDoc(doc(db, 'users', currentUser.uid), updateData);
    console.log('Updated user profile in Firestore:', updateData);

    // Update Firebase Auth displayName if name is being changed
    if (name !== undefined && name !== currentUser.displayName) {
      try {
        await updateProfile(currentUser, { displayName: name });
        console.log('Updated Firebase Auth displayName:', name);
      } catch (authError) {
        console.warn('Failed to update Firebase Auth displayName:', authError);
        // Don't throw error here as Firestore update was successful
      }
    }

    return { success: true, message: 'Profile updated successfully!' };
    
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw new Error(`Failed to update profile: ${error.message}`);
  }
};

/**
 * Find real user information from various sources in the database
 */
const findRealUserInfo = async (uid) => {
  try {
    let foundName = null;
    let foundEmail = null;
    let foundComputingId = null;
    let dataSource = null;
    
    // Method 1: Search match requests for sender information
    try {
      const matchRequestsSnapshot = await getDocs(collection(db, 'matchRequests'));
      matchRequestsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.senderId === uid) {
          console.log(`Found match request from ${uid}:`, data);
          
          // Look for various name fields that might be stored
          if (data.senderName) {
            foundName = data.senderName;
            dataSource = 'matchRequests.senderName';
          }
          if (data.senderEmail) {
            foundEmail = data.senderEmail;
            foundComputingId = data.senderEmail.split('@')[0];
          }
          if (data.name) {
            foundName = data.name;
            dataSource = 'matchRequests.name';
          }
          
          // Try to extract name from bio if it contains "I am [name]" or similar
          if (data.bio && !foundName) {
            const namePatterns = [
              /I am ([A-Za-z\s]+)/i,
              /My name is ([A-Za-z\s]+)/i,
              /Hi, I'm ([A-Za-z\s]+)/i,
              /Hello, I'm ([A-Za-z\s]+)/i,
            ];
            
            for (const pattern of namePatterns) {
              const match = data.bio.match(pattern);
              if (match) {
                foundName = match[1].trim();
                dataSource = 'matchRequests.bio';
                break;
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Error searching match requests:', error);
    }
    
    // Method 2: Search partners collection for stored names
    try {
      const partnersSnapshot = await getDocs(collection(db, 'partners'));
      partnersSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userA === uid || data.userB === uid) {
          console.log(`Found partnership involving ${uid}:`, data);
          
          // Check if partnership has user names stored
          if (data.userAName && data.userA === uid) {
            foundName = data.userAName;
            dataSource = 'partners.userAName';
          }
          if (data.userBName && data.userB === uid) {
            foundName = data.userBName;
            dataSource = 'partners.userBName';
          }
          
          // Look for any other name fields
          if (data.nameA && data.userA === uid) {
            foundName = data.nameA;
            dataSource = 'partners.nameA';
          }
          if (data.nameB && data.userB === uid) {
            foundName = data.nameB;
            dataSource = 'partners.nameB';
          }
        }
      });
    } catch (error) {
      console.error('Error searching partners collection:', error);
    }
    
    // Method 3: Check other collections that might have user data
    try {
      // Search any notes, messages, or other collections if they exist
      const collections = ['notes', 'messages', 'chats'];
      
      for (const collectionName of collections) {
        try {
          const snapshot = await getDocs(collection(db, collectionName));
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.userId === uid || data.authorId === uid || data.senderId === uid) {
              if (data.userName && !foundName) {
                foundName = data.userName;
                dataSource = `${collectionName}.userName`;
              }
              if (data.authorName && !foundName) {
                foundName = data.authorName;
                dataSource = `${collectionName}.authorName`;
              }
              if (data.senderName && !foundName) {
                foundName = data.senderName;
                dataSource = `${collectionName}.senderName`;
              }
            }
          });
        } catch (error) {
          // Collection might not exist, continue
          console.log(`Collection ${collectionName} not found or error:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error searching additional collections:', error);
    }
    
    // If we found any real data, return it
    if (foundName || foundEmail) {
      const shortUid = uid.slice(0, 8);
      const userInfo = {
        name: foundName || `Student ${shortUid}`,
        email: foundEmail || `${shortUid}@virginia.edu`,
        computingId: foundComputingId || shortUid,
        createdAt: serverTimestamp(),
        dataSource,
        foundOriginalData: !!foundName,
        isReconstructed: true,
      };
      
      console.log(`Found real user info for ${uid}:`, userInfo);
      return userInfo;
    }
    
    return null;
  } catch (error) {
    console.error('Error finding real user info:', error);
    return null;
  }
};

/**
 * Ensure current user has a document in Firestore
 */
export const ensureUserDocument = async () => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('No current user to create document for');
      return null;
    }

    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    if (userDoc.exists()) {
      console.log('User document already exists');
      return userDoc.data();
    }

    // Create user document
    const userData = {
      name: currentUser.displayName || 'Unknown User',
      email: currentUser.email || 'Unknown Email',
      computingId: currentUser.email ? currentUser.email.split('@')[0] : 'unknown',
      bio: '',
      courses: [],
      studyTimes: ['Evenings', 'Weekends'],
      meetingPreference: 'In-person & Virtual',
      selectedAvatar: 'person-circle',
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', currentUser.uid), userData);
    console.log('Created user document:', userData);
    
    return userData;
  } catch (error) {
    console.error('Error ensuring user document:', error);
    return null;
  }
};

/**
 * Force refresh all partner names by re-fetching user info
 */
export const refreshAllPartnerNames = async () => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('No current user');
    }

    // Get all partnerships for current user
    const partnersSnapshot = await getDocs(collection(db, 'partners'));
    const userPartnerIds = new Set();
    
    partnersSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.userA === currentUser.uid) {
        userPartnerIds.add(data.userB);
      } else if (data.userB === currentUser.uid) {
        userPartnerIds.add(data.userA);
      }
    });
    
    console.log('Refreshing names for partner IDs:', [...userPartnerIds]);
    
    // Force refresh each partner's user info
    const refreshPromises = [...userPartnerIds].map(async (partnerId) => {
      // Delete existing document to force fresh lookup
      try {
        const userDocRef = doc(db, 'users', partnerId);
        const currentDoc = await getDoc(userDocRef);
        
        if (currentDoc.exists()) {
          const currentData = currentDoc.data();
          // Only refresh if it's placeholder or generic data
          if (currentData.isPlaceholder || 
              currentData.name?.includes('Unknown') || 
              currentData.name?.includes('Study Partner') ||
              currentData.name?.startsWith('User ')) {
            
            console.log(`Refreshing data for ${partnerId}`);
            const newUserInfo = await findRealUserInfo(partnerId);
            
            if (newUserInfo && newUserInfo.name !== currentData.name) {
              await setDoc(userDocRef, newUserInfo);
              console.log(`Updated ${partnerId} with better name: ${newUserInfo.name}`);
              return { partnerId, oldName: currentData.name, newName: newUserInfo.name };
            }
          }
        }
      } catch (error) {
        console.error(`Error refreshing ${partnerId}:`, error);
      }
      
      return null;
    });
    
    const results = await Promise.all(refreshPromises);
    const successful = results.filter(r => r !== null);
    
    return {
      success: true,
      message: `Refreshed ${successful.length} partner names`,
      updates: successful
    };
    
  } catch (error) {
    console.error('Error refreshing partner names:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Get all users (for debugging)
 */
export const getAllUsers = async () => {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = [];
    usersSnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    console.log('All users in database:', users);
    return users;
  } catch (error) {
    console.error('Error fetching all users:', error);
    return [];
  }
};

/**
 * Get all partners (for debugging)
 */
export const getAllPartners = async () => {
  try {
    const partnersSnapshot = await getDocs(collection(db, 'partners'));
    const partners = [];
    partnersSnapshot.forEach((doc) => {
      partners.push({ id: doc.id, ...doc.data() });
    });
    console.log('All partners in database:', partners);
    return partners;
  } catch (error) {
    console.error('Error fetching all partners:', error);
    return [];
  }
};

// Keep the existing functions for backward compatibility
export const debugPartnersAndUsers = async (currentUid) => {
  try {
    const [users, partners] = await Promise.all([getAllUsers(), getAllPartners()]);
    
    const userIds = users.map(u => u.id);
    const partnerUserIds = new Set();
    
    partners.forEach(p => {
      partnerUserIds.add(p.userA);
      partnerUserIds.add(p.userB);
    });
    
    const missingUsers = [...partnerUserIds].filter(uid => !userIds.includes(uid));
    
    return {
      users,
      partners,
      userIds,
      partnerUserIds: [...partnerUserIds],
      missingUsers,
      currentUid,
      userPartnerships: partners.filter(p => p.userA === currentUid || p.userB === currentUid)
    };
  } catch (error) {
    console.error('Error in debug function:', error);
    return null;
  }
};

// Update the forceRecreateUserDocuments to use the new refresh function
export const forceRecreateUserDocuments = async () => {
  try {
    const result = await refreshAllPartnerNames();
    
    if (result.success) {
      const foundRealNames = result.updates ? result.updates.length : 0;
      
      return {
        success: true,
        message: result.message,
        foundRealNames,
        totalProcessed: foundRealNames
      };
    } else {
      return { success: false, message: result.message };
    }
  } catch (error) {
    console.error('Error forcing recreation:', error);
    return { success: false, message: error.message };
  }
};


/*
*upload user profile pictures
*/
export const uploadProfilePicture = async (uid, fileBlob) => {
  const storage = getStorage();
  const profilePicRef = ref(storage, `profilePics/${uid}.jpg`);

  await uploadBytes(profilePicRef, fileBlob);
  const downloadURL = await getDownloadURL(profilePicRef);
  return downloadURL;
};

// update user profile pictures
export const updateUserPhotoURL = async (uid, photoURL) => {
  await updateDoc(doc(db, 'users', uid), {
    photoURL,
    lastUpdated: serverTimestamp(),
  });
};
