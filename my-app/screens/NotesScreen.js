import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { auth } from '../firebaseConfig';
import { 
  getNotesByCourse, 
  uploadMediaNote, 
  getNoteDetail,
  deleteNote,
  searchNotesByCourse,
  getAvailableCourses,
  getNotesByUser,
  updateNote,
  rateNote,
  addCommentToNote,
  getCommentsForNote,
  deleteCommentFromNote,
  updateCommentOnNote
} from '../backend/noteService';
import { getUserInfo } from '../backend/userService';
import { getMyMatchRequests } from '../backend/matchService';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const NotesScreen = () => {
  const [view, setView] = useState('browse'); // 'browse', 'detail', 'upload', 'myNotes', 'editNote'
  const [selectedNote, setSelectedNote] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [userCourses, setUserCourses] = useState([]);
  
  // My Notes state
  const [myNotes, setMyNotes] = useState([]);
  const [loadingMyNotes, setLoadingMyNotes] = useState(false);
  
  // Edit Note state
  const [editTitle, setEditTitle] = useState('');
  const [editCourse, setEditCourse] = useState('');
  
  // Rating state
  const [userRating, setUserRating] = useState(0);
  const [isRating, setIsRating] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [courseSearchResults, setCourseSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [selectedSearchCourse, setSelectedSearchCourse] = useState(null);
  
  // Upload form state
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCourse, setUploadCourse] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  // Comments state
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  useEffect(() => {
    loadUserCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse && !searchMode) {
      loadNotesForCourse(selectedCourse);
    }
  }, [selectedCourse, searchMode]);

  // Load comments when viewing note details
  useEffect(() => {
    if (view === 'detail' && selectedNote) {
      loadComments();
    }
  }, [view, selectedNote]);

  // Comments functions
  const loadComments = async () => {
    if (!selectedNote) return;
    
    setLoadingComments(true);
    try {
      const noteComments = await getCommentsForNote(selectedNote.id);
      
      // Get user info for each comment
      const commentsWithUserInfo = await Promise.all(
        noteComments.map(async (comment) => {
          try {
            const userInfo = await getUserInfo(comment.userId);
            return {
              ...comment,
              userName: userInfo?.name || `Student ${comment.userId.slice(0, 8)}`,
              userComputingId: userInfo?.computingId || comment.userId.slice(0, 8)
            };
          } catch (error) {
            console.error('Error fetching user info for comment:', error);
            return {
              ...comment,
              userName: `Student ${comment.userId.slice(0, 8)}`,
              userComputingId: comment.userId.slice(0, 8)
            };
          }
        })
      );
      
      setComments(commentsWithUserInfo);
    } catch (error) {
      console.error('Error loading comments:', error);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedNote || !auth.currentUser) return;

    setIsAddingComment(true);
    try {
      await addCommentToNote(selectedNote.id, auth.currentUser.uid, newComment.trim());
      setNewComment('');
      await loadComments(); // Reload comments
      Alert.alert('Success', 'Comment added successfully!');
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment. Please try again.');
    } finally {
      setIsAddingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!auth.currentUser) return;

    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCommentFromNote(selectedNote.id, commentId, auth.currentUser.uid);
              await loadComments(); // Reload comments
              Alert.alert('Success', 'Comment deleted successfully');
            } catch (error) {
              console.error('Error deleting comment:', error);
              Alert.alert('Error', error.message || 'Failed to delete comment');
            }
          }
        }
      ]
    );
  };

  const handleEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.content);
  };

  const handleUpdateComment = async () => {
    if (!editingCommentText.trim() || !editingCommentId || !auth.currentUser) return;

    try {
      await updateCommentOnNote(selectedNote.id, editingCommentId, auth.currentUser.uid, editingCommentText.trim());
      setEditingCommentId(null);
      setEditingCommentText('');
      await loadComments(); // Reload comments
      Alert.alert('Success', 'Comment updated successfully!');
    } catch (error) {
      console.error('Error updating comment:', error);
      Alert.alert('Error', error.message || 'Failed to update comment');
    }
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  // Format comment timestamp
  const formatCommentDate = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Handle rating submission
  const handleRateNote = async (rating) => {
    if (!selectedNote || !auth.currentUser) return;
    
    if (selectedNote.authorId === auth.currentUser.uid) {
      Alert.alert('Error', 'You cannot rate your own note');
      return;
    }

    setIsRating(true);
    try {
      const newAvgRating = await rateNote(selectedNote.id, rating, auth.currentUser.uid);
      setUserRating(rating);
      setSelectedNote(prev => ({
        ...prev,
        rating: newAvgRating
      }));
      Alert.alert('Success', 'Thank you for rating this note!');
    } catch (error) {
      console.error('Error rating note:', error);
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    } finally {
      setIsRating(false);
    }
  };

  // Reset rating state when viewing a new note
  const resetRatingState = () => {
    setUserRating(0);
    setComments([]);
    setNewComment('');
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  // Handle search functionality
  const handleSearch = async (query) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchMode(false);
      setSearchResults([]);
      setCourseSearchResults([]);
      setSelectedSearchCourse(null);
      return;
    }

    setSearchMode(true);
    setIsSearching(true);
    setSelectedSearchCourse(null);
    
    try {
      const courses = await getAvailableCourses(query);
      setCourseSearchResults(courses);
      setSearchResults([]);
    } catch (error) {
      console.error('Error searching courses:', error);
      setCourseSearchResults([]);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle course card selection from search
  const handleSearchCourseSelect = async (course) => {
    setSelectedSearchCourse(course);
    setIsSearching(true);
    
    try {
      const courseNotes = await searchNotesByCourse(course);
      
      const notesWithAuthors = await Promise.all(
        courseNotes.map(async (note) => {
          try {
            const authorInfo = await getUserInfo(note.authorId);
            return {
              ...note,
              authorName: authorInfo?.name || 'Unknown Author',
              authorComputingId: authorInfo?.computingId || note.authorId.slice(0, 8)
            };
          } catch (error) {
            console.error('Error fetching author info:', error);
            return {
              ...note,
              authorName: `Student ${note.authorId.slice(0, 8)}`,
              authorComputingId: note.authorId.slice(0, 8)
            };
          }
        })
      );
      
      setSearchResults(notesWithAuthors);
      setCourseSearchResults([]);
    } catch (error) {
      console.error('Error loading notes for course:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Clear search and return to user courses
  const clearSearch = () => {
    setSearchQuery('');
    setSearchMode(false);
    setSearchResults([]);
    setCourseSearchResults([]);
    setSelectedSearchCourse(null);
    if (userCourses.length > 0 && !selectedCourse) {
      setSelectedCourse(userCourses[0]);
    }
  };

  // Go back to course search results from notes view
  const backToCourseSearch = () => {
    setSelectedSearchCourse(null);
    setSearchResults([]);
    handleSearch(searchQuery);
  };

  // Load user's notes
  const loadMyNotes = async () => {
    setLoadingMyNotes(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userNotes = await getNotesByUser(user.uid);
      setMyNotes(userNotes);
    } catch (error) {
      console.error('Error loading my notes:', error);
      setMyNotes([]);
    } finally {
      setLoadingMyNotes(false);
    }
  };

  // Handle edit note
  const handleEditNote = (note) => {
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditCourse(note.course);
    setView('editNote');
  };

  // Handle update note
  const handleUpdateNote = async () => {
    if (!editTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for your note');
      return;
    }
    if (!editCourse.trim()) {
      Alert.alert('Error', 'Please enter a course');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'You must be logged in to update notes');
        return;
      }

      await updateNote(selectedNote.id, {
        title: editTitle.trim(),
        course: editCourse.trim(),
      }, user.uid);

      Alert.alert('Success', 'Note updated successfully!');
      
      // Reset form and reload
      setEditTitle('');
      setEditCourse('');
      await loadMyNotes();
      setView('myNotes');
    } catch (error) {
      console.error('Error updating note:', error);
      Alert.alert('Error', 'Failed to update note. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle delete note from my notes
  const handleDeleteMyNote = async (noteId) => {
    const user = auth.currentUser;
    if (!user) return;

    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteNote(noteId, user.uid);
              Alert.alert('Success', 'Note deleted successfully');
              await loadMyNotes();
            } catch (error) {
              console.error('Error deleting note:', error);
              Alert.alert('Error', error.message || 'Failed to delete note');
            }
          }
        }
      ]
    );
  };

  const uploadFileToFirebase = async (fileUri, uid) => {
    console.log('Start uploading file:', fileUri);

    const storage = getStorage();
    const fileExt = fileUri.split('.').pop();
    const mimeType = getMimeType(fileUri);
    console.log('Detected MIME type:', mimeType);

    const response = await fetch(fileUri);
    console.log('Fetch response ok?', response.ok);
    const blob = await response.blob();
    console.log('Blob size:', blob.size);

    const filename = `notes/${uid}_${Date.now()}.${fileExt}`;
    const storageRef = ref(storage, filename);
    console.log('Uploading to Firebase Storage:', filename);

    await uploadBytes(storageRef, blob, { contentType: mimeType });
    console.log('Upload successful');

    const downloadURL = await getDownloadURL(storageRef);
    console.log('File URL:', downloadURL);
    return downloadURL;
  };

  const getMimeType = (uri) => {
    if (uri.endsWith('.pdf')) return 'application/pdf';
    if (uri.endsWith('.jpg') || uri.endsWith('.jpeg')) return 'image/jpeg';
    if (uri.endsWith('.png')) return 'image/png';
    return 'application/octet-stream';
  };

  // Load user's courses from match requests
  const loadUserCourses = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const matchRequests = await getMyMatchRequests(user.uid);
      const userCoursesList = matchRequests
        .filter((m) => m.senderId === user.uid)
        .map((m) => m.course);
      
      const uniqueCourses = [...new Set(userCoursesList)];
      setUserCourses(uniqueCourses);
      
      if (uniqueCourses.length > 0 && !selectedCourse && !searchMode) {
        setSelectedCourse(uniqueCourses[0]);
      }
    } catch (error) {
      console.error('Error loading user courses:', error);
      setUserCourses([]);
    }
  };

  // Load notes for a specific course
  const loadNotesForCourse = async (course) => {
    setLoading(true);
    try {
      const courseNotes = await getNotesByCourse(course);
      
      const notesWithAuthors = await Promise.all(
        courseNotes.map(async (note) => {
          try {
            const authorInfo = await getUserInfo(note.authorId);
            return {
              ...note,
              authorName: authorInfo?.name || 'Unknown Author',
              authorComputingId: authorInfo?.computingId || note.authorId.slice(0, 8)
            };
          } catch (error) {
            console.error('Error fetching author info:', error);
            return {
              ...note,
              authorName: `Student ${note.authorId.slice(0, 8)}`,
              authorComputingId: note.authorId.slice(0, 8)
            };
          }
        })
      );
      
      setNotes(prev => ({
        ...prev,
        [course]: notesWithAuthors
      }));
    } catch (error) {
      console.error('Error loading notes:', error);
      setNotes(prev => ({
        ...prev,
        [course]: []
      }));
    } finally {
      setLoading(false);
    }
  };

  // Handle note selection and load details
  const handleNoteSelect = async (note) => {
    try {
      const noteDetail = await getNoteDetail(note.id);
      
      let authorInfo = null;
      if (!noteDetail.authorName) {
        try {
          authorInfo = await getUserInfo(noteDetail.authorId);
        } catch (error) {
          console.error('Error fetching author info for detail:', error);
        }
      }
      
      const noteWithAuthor = {
        ...noteDetail,
        authorName: noteDetail.authorName || authorInfo?.name || `Student ${noteDetail.authorId.slice(0, 8)}`,
        authorComputingId: noteDetail.authorComputingId || authorInfo?.computingId || noteDetail.authorId.slice(0, 8)
      };
      
      setSelectedNote(noteWithAuthor);
      resetRatingState();
      setView('detail');
    } catch (error) {
      console.error('Error loading note details:', error);
      Alert.alert('Error', 'Failed to load note details');
    }
  };

  // Handle file upload
  const handleUploadPress = async () => {
    Alert.alert(
      "Upload Note",
      "Choose a file source",
      [
        {
          text: "Take Photo",
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert("Permission Denied", "Camera access is required to take a photo.");
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: [ImagePicker.MediaType.Image],
              allowsEditing: false,
              quality: 0.8,
            });
            if (!result.canceled) {
              setSelectedFile(result.assets[0]);
            }
          },
        },
        {
          text: "Photo Library",
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: false,
              quality: 0.8,
            });
            if (!result.canceled) {
              setSelectedFile(result.assets[0]);
            }
          },
        },
        {
          text: "Browse Files",
          onPress: async () => {
            const result = await DocumentPicker.getDocumentAsync({
              type: ['application/pdf', 'image/*'],
            });
            if (!result.canceled) {
              setSelectedFile(result.assets[0]);
            }
          },
        },
        {
          text: "Cancel",
          style: "cancel"
        },
      ],
      { cancelable: true }
    );
  };

  // Handle note submission
  const handleSubmitNote = async () => {
    if (!uploadTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for your note');
      return;
    }
    if (!uploadCourse.trim()) {
      Alert.alert('Error', 'Please enter a course');
      return;
    }
    if (!selectedFile) {
      Alert.alert('Error', 'Please select a file to upload');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'You must be logged in to upload notes');
        return;
      }

      const mediaURL = await uploadFileToFirebase(selectedFile.uri, user.uid);
      await uploadMediaNote({
        uid: user.uid,
        title: uploadTitle.trim(),
        course: uploadCourse.trim(),
        mediaURL: mediaURL,
      });

      Alert.alert('Success', 'Note uploaded successfully!');
      
      setUploadTitle('');
      setUploadCourse('');
      setSelectedFile(null);
      
      await loadNotesForCourse(uploadCourse.trim());
      await loadUserCourses();
      
      setView('browse');
    } catch (error) {
      console.error('Error uploading note:', error);
      Alert.alert('Error', 'Failed to upload note. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle note deletion
  const handleDeleteNote = async (noteId) => {
    const user = auth.currentUser;
    if (!user) return;

    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteNote(noteId, user.uid);
              Alert.alert('Success', 'Note deleted successfully');
              setView('browse');
              if (selectedCourse) {
                await loadNotesForCourse(selectedCourse);
              }
            } catch (error) {
              console.error('Error deleting note:', error);
              Alert.alert('Error', error.message || 'Failed to delete note');
            }
          }
        }
      ]
    );
  };

  // Handle download/view note
  const handleViewNote = async () => {
    if (selectedNote?.mediaURL) {
      try {
        const supported = await Linking.canOpenURL(selectedNote.mediaURL);
        if (supported) {
          await Linking.openURL(selectedNote.mediaURL);
        } else {
          Alert.alert('Error', 'Cannot open this file type');
        }
      } catch (error) {
        console.error('Error opening file:', error);
        Alert.alert('Error', 'Failed to open file');
      }
    }
  };

  // Render star rating component
  const renderStarRating = (currentRating = 0, onRatingPress = null, size = 20) => {
    const stars = [];
    const isInteractive = onRatingPress !== null;
    
    for (let i = 1; i <= 5; i++) {
      const filled = i <= currentRating;
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => isInteractive && onRatingPress(i)}
          disabled={!isInteractive || isRating}
          style={styles.starButton}
        >
          <Ionicons
            name={filled ? "star" : "star-outline"}
            size={size}
            color={filled ? "#FFD700" : "#ddd"}
          />
        </TouchableOpacity>
      );
    }
    
    return <View style={styles.starContainer}>{stars}</View>;
  };

  // Get author name for display
  const getAuthorName = (note) => {
    return note.authorName || `Student ${note.authorId?.slice(0, 8) || 'Unknown'}`;
  };

  // Get author computing ID for display
  const getAuthorComputingId = (note) => {
    return note.authorComputingId || note.authorId?.slice(0, 8) || 'unknown';
  };

  // Format timestamp
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  // Render comments section
  const renderCommentsSection = () => (
    <View style={styles.commentsSection}>
      <Text style={styles.commentsSectionTitle}>
        Comments ({comments.length})
      </Text>
      
      {/* Add comment input */}
      <View style={styles.addCommentContainer}>
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment..."
          value={newComment}
          onChangeText={setNewComment}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.addCommentButton, (!newComment.trim() || isAddingComment) && styles.addCommentButtonDisabled]}
          onPress={handleAddComment}
          disabled={!newComment.trim() || isAddingComment}
        >
          <Ionicons 
            name={isAddingComment ? "hourglass-outline" : "send"} 
            size={16} 
            color={(!newComment.trim() || isAddingComment) ? "#999" : "#007AFF"} 
          />
        </TouchableOpacity>
      </View>

      {/* Comments list */}
      {loadingComments ? (
        <Text style={styles.loadingCommentsText}>Loading comments...</Text>
      ) : comments.length > 0 ? (
        <View style={styles.commentsList}>
          {comments.map((comment) => (
            <View key={comment.id} style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <View style={styles.commentUserInfo}>
                  <Text style={styles.commentUserName}>{comment.userName}</Text>
                  <Text style={styles.commentTime}>{formatCommentDate(comment.createdAt)}</Text>
                </View>
                {comment.userId === auth.currentUser?.uid && (
                  <View style={styles.commentActions}>
                    <TouchableOpacity
                      onPress={() => handleEditComment(comment)}
                      style={styles.commentActionButton}
                    >
                      <Ionicons name="pencil" size={14} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteComment(comment.id)}
                      style={styles.commentActionButton}
                    >
                      <Ionicons name="trash" size={14} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              
              {editingCommentId === comment.id ? (
                <View style={styles.editCommentContainer}>
                  <TextInput
                    style={styles.editCommentInput}
                    value={editingCommentText}
                    onChangeText={setEditingCommentText}
                    multiline
                    maxLength={500}
                    autoFocus
                  />
                  <View style={styles.editCommentActions}>
                    <TouchableOpacity
                      onPress={handleCancelEdit}
                      style={styles.cancelEditButton}
                    >
                      <Text style={styles.cancelEditText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleUpdateComment}
                      style={[styles.saveEditButton, !editingCommentText.trim() && styles.saveEditButtonDisabled]}
                      disabled={!editingCommentText.trim()}
                    >
                      <Text style={[styles.saveEditText, !editingCommentText.trim() && styles.saveEditTextDisabled]}>
                        Save
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.commentContent}>{comment.content}</Text>
              )}
              
              {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                <Text style={styles.editedIndicator}>Edited</Text>
              )}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.noCommentsContainer}>
          <Ionicons name="chatbubble-outline" size={32} color="#ccc" />
          <Text style={styles.noCommentsText}>No comments yet</Text>
          <Text style={styles.noCommentsSubtext}>Be the first to comment!</Text>
        </View>
      )}
    </View>
  );

  // --- BROWSE VIEW ---
  const renderBrowseView = () => (
    <ScrollView contentContainerStyle={styles.scrollView}>
      <View style={styles.header}>
        <Text style={styles.title}>Browse Notes</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            onPress={() => {
              loadMyNotes();
              setView('myNotes');
            }}
            style={styles.headerButton}
          >
            <Ionicons name="folder-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setView('upload')} style={styles.headerButton}>
            <Ionicons name="cloud-upload-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by course (e.g., CS 2100) or title"
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="characters"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
        
        {searchMode && (
          <View style={styles.searchModeIndicator}>
            {selectedSearchCourse ? (
              <View style={styles.breadcrumbContainer}>
                <TouchableOpacity onPress={backToCourseSearch} style={styles.breadcrumbButton}>
                  <Ionicons name="chevron-back" size={16} color="#007AFF" />
                  <Text style={styles.breadcrumbText}>Back to courses</Text>
                </TouchableOpacity>
                <Text style={styles.searchModeText}>
                  Showing {searchResults.length} notes for {selectedSearchCourse}
                </Text>
              </View>
            ) : (
              <Text style={styles.searchModeText}>
                {isSearching ? 'Searching courses...' : `Found ${courseSearchResults.length} courses matching "${searchQuery}"`}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* User Courses Section - Only show when not in search mode */}
      {!searchMode && (
        <View style={styles.courseSelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {userCourses.length > 0 ? (
              userCourses.map((course) => (
                <TouchableOpacity
                  key={course}
                  style={[
                    styles.courseButton,
                    selectedCourse === course && styles.courseButtonActive,
                  ]}
                  onPress={() => setSelectedCourse(course)}
                >
                  <Text
                    style={[
                      styles.courseButtonText,
                      selectedCourse === course && styles.courseButtonTextActive,
                    ]}
                  >
                    {course}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.noCoursesContainer}>
                <Text style={styles.noCoursesText}>No courses added yet</Text>
                <Text style={styles.noCoursesSubtext}>Add courses in the Find Partners section first</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      <View style={styles.section}>
        {searchMode ? (
          // Search Results
          isSearching ? (
            <Text style={styles.loadingText}>Searching...</Text>
          ) : selectedSearchCourse ? (
            // Show notes for selected course
            searchResults.length > 0 ? (
              searchResults.map((note) => (
                <TouchableOpacity
                  key={note.id}
                  style={styles.noteCard}
                  onPress={() => handleNoteSelect(note)}
                >
                  <Ionicons name="document-text-outline" size={28} color="#34C759" style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.noteTitle}>{note.title}</Text>
                    <Text style={styles.noteMeta}>{getAuthorName(note)}</Text>
                    <Text style={styles.noteDate}>{formatDate(note.createdAt)}</Text>
                  </View>
                  <View style={styles.noteRatingContainer}>
                    {renderStarRating(note.rating || 0, null, 16)}
                    <Text style={styles.noteRatingText}>{(note.rating || 0).toFixed(1)}</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="document-outline" size={48} color="#999" />
                <Text style={styles.placeholderText}>No notes found</Text>
                <Text style={styles.placeholderSubtext}>
                  No notes available for {selectedSearchCourse} yet.
                </Text>
              </View>
            )
          ) : courseSearchResults.length > 0 ? (
            // Show course cards
            courseSearchResults.map((course) => (
              <TouchableOpacity
                key={course.code}
                style={styles.courseCard}
                onPress={() => handleSearchCourseSelect(course.code)}
              >
                <View style={styles.courseCardIcon}>
                  <Ionicons name="school-outline" size={24} color="#007AFF" />
                </View>
                <View style={styles.courseCardContent}>
                  <Text style={styles.courseCardTitle}>{course.code}</Text>
                  <Text style={styles.courseCardSubtitle}>{course.noteCount} notes available</Text>
                  {course.sections && course.sections.length > 0 && (
                    <Text style={styles.courseCardSections}>
                      Sections: {course.sections.slice(0, 3).join(', ')}
                      {course.sections.length > 3 && ` +${course.sections.length - 3} more`}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color="#999" />
              <Text style={styles.placeholderText}>No courses found</Text>
              <Text style={styles.placeholderSubtext}>
                Try searching for a course like "CS", "MATH", or "PSYC"
              </Text>
            </View>
          )
        ) : userCourses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="school-outline" size={48} color="#999" />
            <Text style={styles.placeholderText}>No courses added yet</Text>
            <Text style={styles.placeholderSubtext}>
              Add courses in the Find Partners section to start browsing and sharing notes!
            </Text>
          </View>
        ) : !selectedCourse ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={48} color="#999" />
            <Text style={styles.placeholderText}>Select a course above</Text>
            <Text style={styles.placeholderSubtext}>Choose a course to view notes</Text>
          </View>
        ) : loading ? (
          <Text style={styles.loadingText}>Loading notes...</Text>
        ) : notes[selectedCourse]?.length ? (
          notes[selectedCourse].map((note) => (
            <TouchableOpacity
              key={note.id}
              style={styles.noteCard}
              onPress={() => handleNoteSelect(note)}
            >
              <Ionicons name="document-text-outline" size={28} color="#34C759" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.noteTitle}>{note.title}</Text>
                <Text style={styles.noteMeta}>{getAuthorName(note)}</Text>
                <Text style={styles.noteDate}>{formatDate(note.createdAt)}</Text>
              </View>
              <View style={styles.noteRatingContainer}>
                {renderStarRating(note.rating || 0, null, 16)}
                <Text style={styles.noteRatingText}>{(note.rating || 0).toFixed(1)}</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={48} color="#999" />
            <Text style={styles.placeholderText}>No notes available for this course.</Text>
            <Text style={styles.placeholderSubtext}>Be the first to share your notes!</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  // --- DETAIL VIEW ---
  const renderDetailView = () => (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setView('browse')}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Note Details</Text>
        {selectedNote?.authorId === auth.currentUser?.uid && (
          <TouchableOpacity onPress={() => handleDeleteNote(selectedNote.id)}>
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.section} showsVerticalScrollIndicator={false}>
        <View style={styles.detailCard}>
          <Text style={styles.detailLabel}>Title</Text>
          <Text style={styles.detailText}>{selectedNote?.title}</Text>

          <Text style={styles.detailLabel}>Author</Text>
          <Text style={styles.detailText}>{getAuthorName(selectedNote)}</Text>
          {selectedNote?.authorComputingId && (
            <>
              <Text style={styles.detailLabel}>Computing ID</Text>
              <Text style={styles.detailText}>{getAuthorComputingId(selectedNote)}</Text>
            </>
          )}

          <Text style={styles.detailLabel}>Course</Text>
          <Text style={styles.detailText}>{selectedNote?.course}</Text>

          <Text style={styles.detailLabel}>Uploaded</Text>
          <Text style={styles.detailText}>{formatDate(selectedNote?.createdAt)}</Text>

          <Text style={styles.detailLabel}>Current Rating</Text>
          <View style={styles.ratingDisplayContainer}>
            {renderStarRating(selectedNote?.rating || 0, null, 24)}
            <Text style={styles.ratingText}>({(selectedNote?.rating || 0).toFixed(1)})</Text>
          </View>

          {/* Rating Section - Only show if user is not the author */}
          {selectedNote?.authorId !== auth.currentUser?.uid && (
            <>
              <Text style={styles.detailLabel}>Rate this Note</Text>
              <View style={styles.userRatingContainer}>
                {renderStarRating(userRating, handleRateNote, 32)}
                <Text style={styles.ratingInstructions}>
                  {userRating > 0 ? `You rated: ${userRating} star${userRating > 1 ? 's' : ''}` : 'Tap a star to rate'}
                </Text>
              </View>
            </>
          )}

          <TouchableOpacity style={styles.downloadButton} onPress={handleViewNote}>
            <Ionicons name="eye-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.downloadText}>View/Download File</Text>
          </TouchableOpacity>
        </View>

        {/* Comments Section */}
        {renderCommentsSection()}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // --- UPLOAD VIEW ---
  const renderUploadView = () => (
    <ScrollView contentContainerStyle={styles.scrollView}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setView('browse')}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Upload Note</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.section}>
        <View style={styles.uploadCard}>
          <Text style={styles.detailLabel}>Title *</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g., Week 2 Summary"
            value={uploadTitle}
            onChangeText={setUploadTitle}
          />

          <Text style={styles.detailLabel}>Course *</Text>
          <View style={styles.courseDropdownContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.courseDropdown}>
              {userCourses.map((course) => (
                <TouchableOpacity
                  key={course}
                  style={[
                    styles.courseDropdownItem,
                    uploadCourse === course && styles.courseDropdownItemActive,
                  ]}
                  onPress={() => setUploadCourse(course)}
                >
                  <Text
                    style={[
                      styles.courseDropdownText,
                      uploadCourse === course && styles.courseDropdownTextActive,
                    ]}
                  >
                    {course}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {uploadCourse && (
              <Text style={styles.selectedCourseText}>Selected: {uploadCourse}</Text>
            )}
          </View>

          {selectedFile && (
            <View style={styles.selectedFileContainer}>
              <Text style={styles.detailLabel}>Selected File</Text>
              <View style={styles.selectedFile}>
                <Ionicons name="document-outline" size={20} color="#007AFF" />
                <Text style={styles.selectedFileName} numberOfLines={1}>
                  {selectedFile.name || selectedFile.uri?.split('/').pop() || 'Selected file'}
                </Text>
                <TouchableOpacity onPress={() => setSelectedFile(null)}>
                  <Ionicons name="close-circle" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.uploadFileButton} onPress={handleUploadPress}>
            <Ionicons name="document-attach-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.uploadFileText}>
              {selectedFile ? 'Change File' : 'Select PDF or Image'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.submitButton, loading && styles.submitButtonDisabled]} 
            onPress={handleSubmitNote}
            disabled={loading}
          >
            <Ionicons name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.submitText}>
              {loading ? 'Uploading...' : 'Submit Note'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  // --- MY NOTES VIEW ---
  const renderMyNotesView = () => (
    <ScrollView contentContainerStyle={styles.scrollView}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setView('browse')}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>My Notes</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.section}>
        {loadingMyNotes ? (
          <Text style={styles.loadingText}>Loading your notes...</Text>
        ) : myNotes.length > 0 ? (
          myNotes.map((note) => (
            <View key={note.id} style={styles.myNoteCard}>
              <View style={styles.myNoteContent}>
                <Text style={styles.noteTitle}>{note.title}</Text>
                <Text style={styles.noteMeta}>{note.course}</Text>
                <Text style={styles.noteDate}>{formatDate(note.createdAt)}</Text>
                <View style={styles.myNoteRating}>
                  {renderStarRating(note.rating || 0, null, 14)}
                  <Text style={styles.myNoteRatingText}>({(note.rating || 0).toFixed(1)})</Text>
                </View>
              </View>
              <View style={styles.myNoteActions}>
                <TouchableOpacity 
                  onPress={() => handleEditNote(note)}
                  style={styles.editButton}
                >
                  <Ionicons name="pencil" size={18} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => handleDeleteMyNote(note.id)}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash" size={18} color="#FF3B30" />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => handleNoteSelect(note)}
                  style={styles.viewButton}
                >
                  <Ionicons name="eye" size={18} color="#34C759" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={48} color="#999" />
            <Text style={styles.placeholderText}>No notes uploaded yet</Text>
            <Text style={styles.placeholderSubtext}>
              Upload your first note to get started!
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  // --- EDIT NOTE VIEW ---
  const renderEditNoteView = () => (
    <ScrollView contentContainerStyle={styles.scrollView}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setView('myNotes')}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Note</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.section}>
        <View style={styles.uploadCard}>
          <Text style={styles.detailLabel}>Title *</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g., Week 2 Summary"
            value={editTitle}
            onChangeText={setEditTitle}
          />

          <Text style={styles.detailLabel}>Course *</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g., CS 2100"
            value={editCourse}
            onChangeText={setEditCourse}
            autoCapitalize="characters"
          />

          <View style={styles.noteInfoCard}>
            <Text style={styles.detailLabel}>File</Text>
            <Text style={styles.detailText}>
              Original file will be kept. To change the file, please delete this note and upload a new one.
            </Text>
          </View>

          <TouchableOpacity 
            style={[styles.submitButton, loading && styles.submitButtonDisabled]} 
            onPress={handleUpdateNote}
            disabled={loading}
          >
            <Ionicons name="checkmark" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.submitText}>
              {loading ? 'Updating...' : 'Update Note'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {view === 'browse' && renderBrowseView()}
      {view === 'detail' && renderDetailView()}
      {view === 'upload' && renderUploadView()}
      {view === 'myNotes' && renderMyNotesView()}
      {view === 'editNote' && renderEditNoteView()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8f9fa' 
  },
  scrollView: { 
    paddingBottom: 40 
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#333', 
    flex: 1, 
    textAlign: 'center' 
  },
  
  // Header buttons
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  headerSpacer: {
    width: 40,
  },
  
  // Search bar styles
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  searchModeIndicator: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  searchModeText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  
  // Breadcrumb styles
  breadcrumbContainer: {
    flexDirection: 'column',
    gap: 4,
  },
  breadcrumbButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  breadcrumbText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
  },
  
  courseSelector: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  courseButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  courseButtonActive: {
    backgroundColor: '#007AFF',
  },
  courseButtonText: { 
    fontWeight: '500', 
    color: '#333' 
  },
  courseButtonTextActive: { 
    color: '#fff' 
  },
  
  section: { 
    paddingHorizontal: 20, 
    marginTop: 10 
  },
  loadingText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 20,
  },
  
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  noteTitle: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#333' 
  },
  noteMeta: { 
    fontSize: 14, 
    color: '#666', 
    marginTop: 2 
  },
  noteDate: { 
    fontSize: 12, 
    color: '#999', 
    marginTop: 1 
  },
  noteRatingContainer: {
    alignItems: 'flex-end',
  },
  noteRatingText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  
  // Star rating styles
  starContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starButton: {
    marginHorizontal: 1,
  },
  
  // Rating display styles
  ratingDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  
  // User rating styles
  userRatingContainer: {
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginTop: 8,
  },
  ratingInstructions: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  
  // Course card styles
  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  courseCardIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  courseCardContent: {
    flex: 1,
  },
  courseCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  courseCardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  courseCardSections: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  placeholderText: { 
    textAlign: 'center', 
    color: '#666', 
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500'
  },
  placeholderSubtext: {
    textAlign: 'center',
    color: '#999',
    marginTop: 4,
    fontSize: 14,
  },
  
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  detailLabel: { 
    fontSize: 14, 
    fontWeight: '600', 
    marginTop: 20, 
    color: '#555',
    marginBottom: 4,
  },
  detailText: { 
    fontSize: 16, 
    color: '#333' 
  },
  downloadButton: {
    flexDirection: 'row',
    marginTop: 30,
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600' 
  },
  
  // Comments section styles
  commentsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  commentsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  
  // Add comment styles
  addCommentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  commentInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    maxHeight: 100,
    paddingRight: 8,
  },
  addCommentButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  addCommentButtonDisabled: {
    backgroundColor: '#f5f5f5',
  },
  
  // Comments list styles
  loadingCommentsText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
    marginVertical: 20,
  },
  commentsList: {
    gap: 12,
  },
  commentCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  commentUserInfo: {
    flex: 1,
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  commentTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  commentActionButton: {
    padding: 4,
  },
  commentContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  editedIndicator: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
  
  // Edit comment styles
  editCommentContainer: {
    marginTop: 4,
  },
  editCommentInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e9ecef',
    maxHeight: 100,
  },
  editCommentActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelEditButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  cancelEditText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  saveEditButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  saveEditButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveEditText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  saveEditTextDisabled: {
    color: '#999',
  },
  
  // No comments styles
  noCommentsContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  noCommentsText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginTop: 8,
  },
  noCommentsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  
  uploadCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  selectedFileContainer: {
    marginTop: 10,
  },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedFileName: {
    flex: 1,
    marginLeft: 8,
    color: '#007AFF',
    fontWeight: '500',
  },
  uploadFileButton: {
    flexDirection: 'row',
    marginTop: 20,
    backgroundColor: '#5856D6',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadFileText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600' 
  },
  submitButton: {
    flexDirection: 'row',
    marginTop: 20,
    backgroundColor: '#34C759',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#999',
  },
  submitText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600' 
  },
  
  // Course dropdown styles
  courseDropdownContainer: {
    marginBottom: 8,
  },
  courseDropdown: {
    marginBottom: 8,
  },
  courseDropdownItem: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  courseDropdownItemActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  courseDropdownText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  courseDropdownTextActive: {
    color: '#fff',
  },
  selectedCourseText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginTop: 4,
  },
  
  // My Notes styles
  myNoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  myNoteContent: {
    flex: 1,
  },
  myNoteRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  myNoteRatingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  myNoteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f7ff',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fff0f0',
  },
  viewButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0fff0',
  },
  noteInfoCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  
  // No courses styles
  noCoursesContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noCoursesText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
  },
  noCoursesSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default NotesScreen;