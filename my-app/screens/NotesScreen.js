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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { auth } from '../firebaseConfig';
import { 
  getNotesByCourse, 
  uploadMediaNote, 
  getNoteDetail,
  deleteNote 
} from '../backend/noteService';
import { getUserInfo } from '../backend/userService';
import { getMyMatchRequests } from '../backend/matchService';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const NotesScreen = () => {
  const [view, setView] = useState('browse'); // 'browse', 'detail', 'upload'
  const [selectedNote, setSelectedNote] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [userCourses, setUserCourses] = useState([]); // User's actual courses
  
  // Upload form state
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCourse, setUploadCourse] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const courses = ['CS 2100', 'MATH 3100', 'PSYC 2500', 'CS 1010', 'CS 3240'];

  useEffect(() => {
    loadUserCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      loadNotesForCourse(selectedCourse);
    }
  }, [selectedCourse]);


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
      
      // Set the first course as selected if available
      if (uniqueCourses.length > 0 && !selectedCourse) {
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
      
      // Fetch author information for each note
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
      // Set empty array instead of showing alert immediately
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
      
      // Fetch author information if not already available
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

      // In a real app, you'd upload the file to Firebase Storage first
      // and get the download URL. For now, we'll use the local URI
      const mediaURL = await uploadFileToFirebase(selectedFile.uri, user.uid);
      await uploadMediaNote({
        uid: user.uid,
        title: uploadTitle.trim(),
        course: uploadCourse.trim(),
        mediaURL: mediaURL,
      });


      Alert.alert('Success', 'Note uploaded successfully!');
      
      // Reset form
      setUploadTitle('');
      setUploadCourse('');
      setSelectedFile(null);
      
      // Reload notes for the course and refresh user courses
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
              await loadNotesForCourse(selectedCourse);
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

  // --- BROWSE VIEW ---
  const renderBrowseView = () => (
    <ScrollView contentContainerStyle={styles.scrollView}>
      <View style={styles.header}>
        <Text style={styles.title}>Browse Notes</Text>
        <TouchableOpacity onPress={() => setView('upload')}>
          <Ionicons name="cloud-upload-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

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

      <View style={styles.section}>
        {userCourses.length === 0 ? (
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
                <Text style={styles.noteRating}>⭐ {note.rating?.toFixed(1) || '0.0'}</Text>
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
    <View style={styles.container}>
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

      <ScrollView style={styles.section}>
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

          <Text style={styles.detailLabel}>Rating</Text>
          <Text style={styles.detailText}>⭐ {selectedNote?.rating?.toFixed(1) || '0.0'}</Text>

          <TouchableOpacity style={styles.downloadButton} onPress={handleViewNote}>
            <Ionicons name="eye-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.downloadText}>View/Download File</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  // --- UPLOAD VIEW ---
  const renderUploadView = () => (
    <ScrollView contentContainerStyle={styles.scrollView}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setView('browse')}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Upload Note</Text>
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

  return (
    <SafeAreaView style={styles.container}>
      {view === 'browse' && renderBrowseView()}
      {view === 'detail' && renderDetailView()}
      {view === 'upload' && renderUploadView()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  scrollView: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', flex: 1, textAlign: 'center' },
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
  courseButtonText: { fontWeight: '500', color: '#333' },
  courseButtonTextActive: { color: '#fff' },
  section: { paddingHorizontal: 20, marginTop: 10 },
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
  noteTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  noteMeta: { fontSize: 14, color: '#666', marginTop: 2 },
  noteDate: { fontSize: 12, color: '#999', marginTop: 1 },
  noteRatingContainer: {
    alignItems: 'flex-end',
  },
  noteRating: { fontSize: 14, color: '#007AFF', fontWeight: 'bold' },
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
  detailText: { fontSize: 16, color: '#333' },
  downloadButton: {
    flexDirection: 'row',
    marginTop: 30,
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadText: { color: '#fff', fontSize: 16, fontWeight: '600' },
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
  uploadFileText: { color: '#fff', fontSize: 16, fontWeight: '600' },
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
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  
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