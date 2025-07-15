import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NotesScreen = () => {
  const [view, setView] = useState('browse'); // 'browse', 'detail', 'upload'
  const [selectedNote, setSelectedNote] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState('CS 1010');

  const courses = ['CS 2100', 'MATH 3100', 'PSYC 2500'];

  const notes = {
    'CS 2100': [
      { id: '1', title: 'Week 1 Summary', student: 'Alex Rivera', rating: 4.5 },
      { id: '2', title: 'Project Guidelines', student: 'Jordan Molina', rating: 4.8 },
    ],
    'MATH 3100': [
      { id: '3', title: 'Lecture 3 Notes', student: 'Taylor Brooks', rating: 4.2 },
    ],
    'PSYC 2500': [],
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
        {courses.map((course) => (
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
        ))}
      </View>

      <View style={styles.section}>
        {notes[selectedCourse]?.length ? (
          notes[selectedCourse].map((note) => (
            <TouchableOpacity
              key={note.id}
              style={styles.noteCard}
              onPress={() => {
                setSelectedNote(note);
                setView('detail');
              }}
            >
              <Ionicons name="document-text-outline" size={28} color="#34C759" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.noteTitle}>{note.title}</Text>
                <Text style={styles.noteMeta}>{note.student}</Text>
              </View>
              <Text style={styles.noteRating}>⭐ {note.rating.toFixed(1)}</Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.placeholderText}>No notes available for this course.</Text>
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
      </View>

      <View style={styles.section}>
        <Text style={styles.detailLabel}>Title</Text>
        <Text style={styles.detailText}>{selectedNote.title}</Text>

        <Text style={styles.detailLabel}>Student</Text>
        <Text style={styles.detailText}>{selectedNote.student}</Text>

        <Text style={styles.detailLabel}>Course</Text>
        <Text style={styles.detailText}>{selectedCourse}</Text>

        <Text style={styles.detailLabel}>Rating</Text>
        <Text style={styles.detailText}>⭐ {selectedNote.rating.toFixed(1)}</Text>

        <TouchableOpacity style={styles.downloadButton}>
          <Ionicons name="download-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.downloadText}>Download PDF</Text>
        </TouchableOpacity>
      </View>
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
        <Text style={styles.detailLabel}>Title</Text>
        <TextInput style={styles.input} placeholder="e.g., Week 2 Summary" />

        <Text style={styles.detailLabel}>Course</Text>
        <TextInput style={styles.input} placeholder="e.g., CS 1010" />

        <TouchableOpacity style={styles.uploadFileButton}>
          <Ionicons name="document-attach-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.uploadFileText}>Upload PDF or Image</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.submitButton}>
          <Ionicons name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.submitText}>Submit Note</Text>
        </TouchableOpacity>
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
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  courseSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  courseButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  noteMeta: { fontSize: 14, color: '#666' },
  noteRating: { fontSize: 14, color: '#007AFF', fontWeight: 'bold' },
  placeholderText: { textAlign: 'center', color: '#999', marginTop: 20 },
  detailLabel: { fontSize: 14, fontWeight: '600', marginTop: 20, color: '#555' },
  detailText: { fontSize: 16, color: '#333', marginTop: 4 },
  downloadButton: {
    flexDirection: 'row',
    marginTop: 30,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginTop: 8,
  },
  uploadFileButton: {
    flexDirection: 'row',
    marginTop: 20,
    backgroundColor: '#5856D6',
    padding: 12,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadFileText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  submitButton: {
    flexDirection: 'row',
    marginTop: 20,
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default NotesScreen;