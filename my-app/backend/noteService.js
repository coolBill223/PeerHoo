import { db } from '../firebaseConfig';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
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
 * get notes by course - FIXED: Removed orderBy to avoid index requirement
 */
export const getNotesByCourse = async (course) => {
  const q = query(
    collection(db, 'notes'),
    where('course', '==', course)
    // Removed orderBy - we'll sort in JavaScript instead
  );
  const snap = await getDocs(q);
  const notes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Sort in JavaScript instead of Firestore
  return notes.sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return b.createdAt.toMillis() - a.createdAt.toMillis();
  });
};

/**
 * Search notes by course - NEW FUNCTION for search functionality
 * This is the same as getNotesByCourse but with a more explicit name for search
 */
export const searchNotesByCourse = async (course) => {
  return await getNotesByCourse(course);
};

/**
 * get notes by specific user - FIXED: Removed orderBy to avoid index requirement
 */
export const getNotesByUser = async (uid) => {
  const q = query(
    collection(db, 'notes'),
    where('authorId', '==', uid)
    // Removed orderBy - we'll sort in JavaScript instead
  );
  const snap = await getDocs(q);
  const notes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Sort in JavaScript instead of Firestore
  return notes.sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return b.createdAt.toMillis() - a.createdAt.toMillis();
  });
};

/**
 * Search notes by title keyword - UPDATED: More efficient search
 */
export const searchNotesByTitle = async (keyword) => {
  const snap = await getDocs(collection(db, 'notes'));
  const notes = snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(note => note.title?.toLowerCase().includes(keyword.toLowerCase()));
  
  // Sort search results too
  return notes.sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return b.createdAt.toMillis() - a.createdAt.toMillis();
  });
};

/**
 * Search notes by course or title - NEW FUNCTION for comprehensive search
 * This function searches both course names and titles
 */
export const searchNotes = async (searchTerm) => {
  const snap = await getDocs(collection(db, 'notes'));
  const searchTermLower = searchTerm.toLowerCase();
  
  const notes = snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(note => {
      const titleMatch = note.title?.toLowerCase().includes(searchTermLower);
      const courseMatch = note.course?.toLowerCase().includes(searchTermLower);
      return titleMatch || courseMatch;
    });
  
  // Sort search results by relevance (exact course matches first, then by date)
  return notes.sort((a, b) => {
    const aCourseMatch = a.course?.toLowerCase() === searchTermLower;
    const bCourseMatch = b.course?.toLowerCase() === searchTermLower;
    
    // Prioritize exact course matches
    if (aCourseMatch && !bCourseMatch) return -1;
    if (!aCourseMatch && bCourseMatch) return 1;
    
    // Then sort by date
    if (!a.createdAt && !b.createdAt) return 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return b.createdAt.toMillis() - a.createdAt.toMillis();
  });
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
 * Get available courses that match search term
 * Returns course information with note counts
 */
export const getAvailableCourses = async (searchTerm) => {
  const snap = await getDocs(collection(db, 'notes'));
  const notes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  const searchTermLower = searchTerm.toLowerCase();
  
  // Group notes by course
  const courseMap = new Map();
  
  notes.forEach(note => {
    if (!note.course) return;
    
    const course = note.course;
    const courseLower = course.toLowerCase();
    
    // Check if course matches search term
    if (courseLower.includes(searchTermLower)) {
      if (!courseMap.has(course)) {
        courseMap.set(course, {
          code: course,
          noteCount: 0,
          sections: new Set()
        });
      }
      
      const courseData = courseMap.get(course);
      courseData.noteCount++;
      
      // Extract section if course is in format like "CS 2100 sec 1"
      const sectionMatch = course.match(/sec\s+(\w+)/i);
      if (sectionMatch) {
        courseData.sections.add(sectionMatch[1]);
      }
    }
  });
  
  // Convert to array and sort by course code
  const courses = Array.from(courseMap.values()).map(course => ({
    ...course,
    sections: Array.from(course.sections)
  }));
  
  return courses.sort((a, b) => a.code.localeCompare(b.code));
};
  
/**
 * Update note details (title, course)
 * @param {string} noteId - Note ID to update
 * @param {Object} updates - Object containing title and/or course
 * @param {string} currentUid - Current user ID for authorization
 */
export const updateNote = async (noteId, updates, currentUid = null) => {
  const noteRef = doc(db, 'notes', noteId);
  
  // If currentUid is provided, verify ownership
  if (currentUid) {
    const snap = await getDoc(noteRef);
    if (!snap.exists()) throw new Error('Note not found');
    if (snap.data().authorId !== currentUid) throw new Error('Unauthorized update attempt');
  }
  
  // Update the note with new data
  await updateDoc(noteRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

/**
 * get notes detail, preview
 */
export const getNoteDetail = async (noteId) => {
  const snap = await getDoc(doc(db, 'notes', noteId));
  if (!snap.exists()) throw new Error('Note not found');
  return { id: snap.id, ...snap.data() };
};