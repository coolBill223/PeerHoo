import { createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from "firebase/auth";
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

/**
 * Registers a new user with Firebase Authentication and Firestore.
 * 
 * @param {Object} param0 - An object containing user registration info.
 * @param {string} param0.email - The user's email address.
 * @param {string} param0.password - The user's password.
 * @param {string} param0.name - The display name for the user.
 * @param {string} param0.computingId - A unique 6-character ID (used to identify users).
 * @returns {Promise<User>} The newly created Firebase user object.
 * @throws Will throw an error if computingId is not 6 alphanumeric characters
 *         or if the computingId is already registered.
 */
export const registerUser = async ({ email, password, name, computingId }) => {
  // check computingId 
  const idPattern = /^[a-zA-Z0-9]{6}$/;
  if (!idPattern.test(computingId)) {
    throw new Error("Computing ID must be exactly 6 letters or numbers");
  }
  
  // Check if computingId already exists in Firestore
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("computingId", "==", computingId));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    throw new Error("Computing ID is already registered");
  }
  
  // Create user in Firebase Authentication
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  
  // Set user's display name
  await updateProfile(user, { displayName: name });
  
  // Store user data in Firestore with additional profile details
  await setDoc(doc(db, "users", user.uid), {
    name,
    email,
    computingId,
    photoURL: '', // Placeholder for profile picture
    bio: '',
    courses: [],
    studyTimes: ['Evenings', 'Weekends'], // Default preferences
    meetingPreference: 'In-person & Virtual', 
    selectedAvatar: 'person-circle', // Default avatar icon
    createdAt: serverTimestamp(), // Timestamp of registration
  });
  
  return user;
};

/**
 * Sends a password reset email to the provided email address.
 * 
 * @param {string} email - The user's email address to receive the reset link.
 * @returns {Promise<void>} A promise that resolves when the email has been sent.
 */
export const forgotPassword = async (email) => {
  await sendPasswordResetEmail(auth, email);
};