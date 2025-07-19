import { db } from '../firebaseConfig';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';

/**
 * Upload pdf or pictures
 * @param {Object} param0 - Including user id, title, course, notes link
 * @returns {string} new note's ID
 */
export const uploadMediaNote = async ({ uid, title, course, mediaURL }) => {
  if (!mediaURL) throw new Error('mediaURL is required');

  const noteData = {
    authorId: uid,
    title,
    course,
    mediaURL,
    createdAt: serverTimestamp(),
    rating: 0, // default rating be 0
  };

  const docRef = await addDoc(collection(db, 'notes'), noteData);
  return docRef.id;
};

/**
 * get notes by course
 */
export const getNotesByCourse = async (course) => {
  const q = query(
    collection(db, 'notes'),
    where('course', '==', course),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * get notes by specific user
 */
export const getNotesByUser = async (uid) => {
  const q = query(
    collection(db, 'notes'),
    where('authorId', '==', uid),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * only search title, not content
 */
export const searchNotesByTitle = async (keyword) => {
  const snap = await getDocs(collection(db, 'notes'));
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(note => note.title?.toLowerCase().includes(keyword.toLowerCase()));
};

/**
 * delete your own notes
 */
export const deleteNote = async (noteId, currentUid) => {
  const noteRef = doc(db, 'notes', noteId);
  const snap = await getDoc(noteRef);
  if (!snap.exists()) throw new Error('Note not found');
  if (snap.data().authorId !== currentUid) throw new Error('Unauthorized delete attempt');
  await deleteDoc(noteRef);
};

/**
 * get notes detail, preview
 */
export const getNoteDetail = async (noteId) => {
  const snap = await getDoc(doc(db, 'notes', noteId));
  if (!snap.exists()) throw new Error('Note not found');
  return { id: snap.id, ...snap.data() };
};
