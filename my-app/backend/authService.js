
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

/**
 * Sign up User
 */
export const registerUser = async ({ email, password, name, computingId }) => {
  // check computingId 
  const idPattern = /^[a-zA-Z0-9]{6}$/;
  if (!idPattern.test(computingId)) {
    throw new Error("Computing ID must be exactly 6 letters or numbers");
  }

  // check computingId exists or not
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("computingId", "==", computingId));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    throw new Error("Computing ID is already registered");
  }

  // create auth user
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // show user name
  await updateProfile(user, { displayName: name });

  // wrrite the user info into db
  await setDoc(doc(db, "users", user.uid), {
    name,
    email,
    computingId,
    photoURL: '', //profile pics
    createdAt: serverTimestamp(),
  });

  return user;
};
