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
  setDoc,
} from 'firebase/firestore';

/**
 * Uploads a media-based note (PDF or image).
 * 
 * @param {Object} param0 - Note data
 * @param {string} param0.uid - Author's UID
 * @param {string} param0.title - Note title
 * @param {string} param0.course - Course code
 * @param {string} param0.mediaURL - Link to media file
 * @returns {Promise<string>} - ID of the new note
 * @throws {Error} - If mediaURL is missing
 */
export const uploadMediaNote = async ({ uid, title, course, mediaURL }) => {
  if (!mediaURL) throw new Error('mediaURL is required');

  const noteData = {
    authorId: uid,
    title,
    course,
    mediaURL,
    createdAt: serverTimestamp(),
    rating: 0, // Default rating
  };

  const docRef = await addDoc(collection(db, 'notes'), noteData);
  return docRef.id;
};

/**
 * Retrieves all notes for a specific course, sorted by creation time (newest first).
 * 
 * @param {string} course - Course code
 * @returns {Promise<Array>} - List of notes
 */
export const getNotesByCourse = async (course) => {
  const q = query(
    collection(db, 'notes'),
    where('course', '==', course));
  const snap = await getDocs(q);
  const notes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  return notes.sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return b.createdAt.toMillis() - a.createdAt.toMillis();
  });
};

/**
 * Alias for getNotesByCourse, used in search contexts.
 * 
 * @param {string} course - Course code
 * @returns {Promise<Array>} - List of notes
 */
export const searchNotesByCourse = async (course) => {
  return await getNotesByCourse(course);
};

/**
 * Retrieves all notes authored by a specific user, sorted by creation time.
 * 
 * @param {string} uid - User ID
 * @returns {Promise<Array>} - List of user's notes
 */
export const getNotesByUser = async (uid) => {
  const q = query(
    collection(db, 'notes'),
    where('authorId', '==', uid));
  const snap = await getDocs(q);
  const notes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  return notes.sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return b.createdAt.toMillis() - a.createdAt.toMillis();
  });
};

/**
 * Searches notes whose titles contain a specific keyword.
 * 
 * @param {string} keyword - Keyword to search
 * @returns {Promise<Array>} - Matching notes
 */
export const searchNotesByTitle = async (keyword) => {
  const snap = await getDocs(collection(db, 'notes'));
  const notes = snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(note => note.title?.toLowerCase().includes(keyword.toLowerCase()));
  
  return notes.sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return b.createdAt.toMillis() - a.createdAt.toMillis();
  });
};

/**
 * Searches notes where the title or course contains the keyword.
 * 
 * @param {string} searchTerm - Keyword to match
 * @returns {Promise<Array>} - List of relevant notes
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
  
  return notes.sort((a, b) => {
    const aCourseMatch = a.course?.toLowerCase() === searchTermLower;
    const bCourseMatch = b.course?.toLowerCase() === searchTermLower;
    if (aCourseMatch && !bCourseMatch) return -1;
    if (!aCourseMatch && bCourseMatch) return 1;
    
    if (!a.createdAt && !b.createdAt) return 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return b.createdAt.toMillis() - a.createdAt.toMillis();
  });
};

/**
 * Deletes a note if the current user is the author.
 * 
 * @param {string} noteId - Note ID
 * @param {string} currentUid - UID of the user requesting deletion
 * @throws {Error} - If note not found or user is not the author
 */
export const deleteNote = async (noteId, currentUid) => {
  const noteRef = doc(db, 'notes', noteId);
  const snap = await getDoc(noteRef);
  if (!snap.exists()) throw new Error('Note not found');
  if (snap.data().authorId !== currentUid) throw new Error('Unauthorized delete attempt');
  await deleteDoc(noteRef);
};

/**
 * Retrieves available course names from existing notes based on a search term.
 * 
 * @param {string} searchTerm - Course name filter
 * @returns {Promise<Array>} - Array of course info with note counts
 */
export const getAvailableCourses = async (searchTerm) => {
  const snap = await getDocs(collection(db, 'notes'));
  const notes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  const searchTermLower = searchTerm.toLowerCase();
  
  const courseMap = new Map();
  
  notes.forEach(note => {
    if (!note.course) return;
    
    const course = note.course;
    const courseLower = course.toLowerCase();
    
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
      
      const sectionMatch = course.match(/sec\s+(\w+)/i);
      if (sectionMatch) {
        courseData.sections.add(sectionMatch[1]);
      }
    }
  });
  
  const courses = Array.from(courseMap.values()).map(course => ({
    ...course,
    sections: Array.from(course.sections)
  }));
  
  return courses.sort((a, b) => a.code.localeCompare(b.code));
};
  
/**
 * Updates the title or course of an existing note.
 * 
 * @param {string} noteId - Note ID
 * @param {Object} updates - Fields to update (title, course)
 * @param {string|null} currentUid - Optional: verify that the updater is the author
 */
export const updateNote = async (noteId, updates, currentUid = null) => {
  const noteRef = doc(db, 'notes', noteId);
  
  if (currentUid) {
    const snap = await getDoc(noteRef);
    if (!snap.exists()) throw new Error('Note not found');
    if (snap.data().authorId !== currentUid) throw new Error('Unauthorized update attempt');
  }
  
  await updateDoc(noteRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Retrieves full detail of a specific note.
 * 
 * @param {string} noteId - Note ID
 * @returns {Promise<Object>} - Note data
 * @throws {Error} - If note not found
 */
export const getNoteDetail = async (noteId) => {
  const snap = await getDoc(doc(db, 'notes', noteId));
  if (!snap.exists()) throw new Error('Note not found');
  return { id: snap.id, ...snap.data() };
};

/**
 * Rates a note. One rating per user.
 * 
 * @param {string} noteId - Note ID
 * @param {number} ratingValue - 1 to 5
 * @param {string} userId - Current user UID
 * @returns {Promise<number>} - Updated average rating
 * @throws {Error} - If rating is outside 1–5
 */
export const rateNote = async (noteId, ratingValue, userId) => {
  if (ratingValue < 1 || ratingValue > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  const noteRef = doc(db, 'notes', noteId);
  const ratingRef = doc(db, 'notes', noteId, 'ratings', userId);

  await setDoc(ratingRef, {
    userId,
    value: ratingValue,
    updatedAt: serverTimestamp(),
  });

  const ratingsSnap = await getDocs(collection(db, 'notes', noteId, 'ratings'));
  const ratings = ratingsSnap.docs.map(doc => doc.data().value);
  const avgRating = ratings.reduce((sum, val) => sum + val, 0) / ratings.length;

  await updateDoc(noteRef, {
    rating: avgRating,
  });

  return avgRating;
};

/**
 * Adds a comment to a note.
 * 
 * @param {string} noteId - Note ID
 * @param {string} userId - Comment author's UID
 * @param {string} content - Text content of the comment
 * @throws {Error} - If comment is empty
 */
export const addCommentToNote = async (noteId, userId, content) => {
  if (!content.trim()) throw new Error('Comment cannot be empty');
  
  const commentRef = collection(db, 'notes', noteId, 'comments');
  await addDoc(commentRef, {
    userId,
    content: content.trim(),
    createdAt: serverTimestamp(),
  });
};


/**
 * Retrieves all comments for a given note, sorted by timestamp.
 * 
 * @param {string} noteId - Note ID
 * @returns {Promise<Array>} - List of comments
 */
export const getCommentsForNote = async (noteId) => {
  const q = query(collection(db, 'notes', noteId, 'comments'));
  const snap = await getDocs(q);
  
  const comments = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  return comments.sort((a, b) => {
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return a.createdAt.toMillis() - b.createdAt.toMillis();
  });
};

/**
 * Deletes a comment from a note if the user is the author.
 * 
 * @param {string} noteId - Note ID
 * @param {string} commentId - Comment ID
 * @param {string} currentUid - UID of the deleting user
 * @throws {Error} - If unauthorized or comment not found
 */
export const deleteCommentFromNote = async (noteId, commentId, currentUid) => {
  const commentRef = doc(db, 'notes', noteId, 'comments', commentId);
  const snap = await getDoc(commentRef);

  if (!snap.exists()) throw new Error('Comment not found');
  if (snap.data().userId !== currentUid) throw new Error('Unauthorized');

  await deleteDoc(commentRef);
};

/**
 * Edits an existing comment (only by the original author).
 * 
 * @param {string} noteId - Note ID
 * @param {string} commentId - Comment ID
 * @param {string} currentUid - UID of the user editing
 * @param {string} newContent - Updated comment text
 * @throws {Error} - If unauthorized or invalid content
 */
export const updateCommentOnNote = async (noteId, commentId, currentUid, newContent) => {
  const commentRef = doc(db, 'notes', noteId, 'comments', commentId);
  const snap = await getDoc(commentRef);

  if (!snap.exists()) throw new Error('Comment not found');
  if (snap.data().userId !== currentUid) throw new Error('Unauthorized');

  await updateDoc(commentRef, {
    content: newContent.trim(),
    updatedAt: serverTimestamp(),
  });
};
