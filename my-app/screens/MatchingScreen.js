import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCourseSections } from '../backend/courseService';
import { sendMatchRequest, getIncomingMatchRequests } from '../backend/matchService';
import { auth } from '../firebaseConfig';

const MatchingScreen = ({ navigation }) => {
  const uid = auth.currentUser?.uid ?? 'test-uid';

  const [myCourses, setMyCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [incoming, setIncoming] = useState([]);
  const [loadingIncoming, setLoadingIncoming] = useState(false);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    subject: '',
    catalog: '',
    courseCode: '',
    availability: '',
    studyTime: '',
    goals: '',
    meeting: 'In-person',
  });
  const [sections, setSections] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const meetingOptions = ['In-person', 'Virtual', 'Both'];

  //helper
  const loadIncoming = async () => {
    try {
      setLoadingIncoming(true);
      const data = await getIncomingMatchRequests(uid);
      setIncoming(data);
    } catch (e) {
      console.log(e);
    } finally {
      setLoadingIncoming(false);
    }
  };

  useEffect(() => {
    loadIncoming();
  }, []);

  //course submit
  const handleSubmit = async () => {
    if (!form.courseCode) {
      Alert.alert('Missing Course', 'Please select a course');
      return;
    }
    try {
      await sendMatchRequest({
        senderId: uid,
        course: form.courseCode,
        studyTime: form.studyTime,
        meetingPreference: form.meeting,
        bio: form.goals.slice(0, 100),
      });
      Alert.alert('Success', 'Match request submitted.');
      setMyCourses((prev) =>
        prev.includes(form.courseCode) ? prev : [...prev, form.courseCode]
      );
      setSelectedCourse(form.courseCode);
      setShowForm(false);
      setForm({
        subject: '',
        catalog: '',
        courseCode: '',
        availability: '',
        goals: '',
        meeting: 'In-person',
      });
      setSections([]);
      loadIncoming();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  if (showForm) {
    return (
      <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={80}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="arrow-back" size={24} color="#007AFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Add Course</Text>
            </View>

        <ScrollView contentContainerStyle={styles.formScroll}>
          {/* subject + catalog */}
          <Text style={styles.label}>Subject *</Text>
          <TextInput
            style={styles.input}
            placeholder="CS"
            value={form.subject}
            autoCapitalize="characters"
            onChangeText={(t) => setForm({ ...form, subject: t.toUpperCase() })}
          />
          <Text style={[styles.label, { marginTop: 12 }]}>Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="2100"
            keyboardType="numeric"
            value={form.catalog}
            onChangeText={(t) => setForm({ ...form, catalog: t })}
          />

          {/* search sections */}
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={async () => {
              if (!form.subject || !form.catalog) {
                return Alert.alert('Enter subject & number');
              }
              try {
                setLoadingSections(true);
                const secs = await getCourseSections(
                  form.subject,
                  form.catalog
                );
                setSections(secs);
                if (secs.length === 0) Alert.alert('No sections found');
              } catch (e) {
                Alert.alert('Error', e.message);
              } finally {
                setLoadingSections(false);
              }
            }}
          >
            <Ionicons name="search" size={18} color="#fff" />
            <Text style={styles.searchText}>Search Sections</Text>
          </TouchableOpacity>

          {/* section list */}
          {loadingSections && <ActivityIndicator />}
          {sections.map((s) => {
            const code = `${s.subject} ${s.catalog} sec ${s.section}`;
            const chosen = form.courseCode === code;
            return (
              <TouchableOpacity
                key={s.classNbr}
                style={[styles.secBtn, chosen && styles.secBtnActive]}
                onPress={() =>
                  setForm({
                    ...form,
                    courseCode: code,
                    availability: `${s.meetDays} ${s.startTime}-${s.endTime}`,
                  })
                }
              >
                <Text
                  style={[styles.secTxt, chosen && styles.secTxtActive]}
                >{`${code}\n${s.meetDays} ${s.startTime}-${s.endTime} · ${s.component}`}</Text>
              </TouchableOpacity>
            );
          })}

          {/* goals */}
          <Text style={[styles.label, { marginTop: 20 }]}>Goals / Notes</Text>
          <TextInput
            style={[styles.input, { height: 80 }]}
            multiline
            value={form.goals}
            onChangeText={(t) => setForm({ ...form, goals: t })}
          />

          {/* study time */}
          <Text style={[styles.label, { marginTop: 20 }]}>Preferred Study Time</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. evenings, weekends"
            value={form.studyTime}
            onChangeText={(t) => setForm({ ...form, studyTime: t })}
          />

          {/* meeting pref */}
          <Text style={[styles.label, { marginTop: 20 }]}>Meeting Mode</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            {meetingOptions.map((o) => (
              <TouchableOpacity
                key={o}
                style={[
                  styles.meetBtn,
                  form.meeting === o && styles.meetBtnActive,
                ]}
                onPress={() => setForm({ ...form, meeting: o })}
              >
                <Text
                  style={[
                    styles.meetTxt,
                    form.meeting === o && styles.meetTxtActive,
                  ]}
                >
                  {o}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* submit */}
          <TouchableOpacity style={styles.submit} onPress={handleSubmit}>
            <Ionicons name="send" size={18} color="#fff" />
            <Text style={styles.submitTxt}>Submit</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  </KeyboardAvoidingView>
</SafeAreaView>
    );
  }

  /* 2️⃣  main-page */
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.headerRow}>
          <Text style={styles.mainTitle}>Find Study Partners</Text>
          <TouchableOpacity onPress={loadIncoming}>
            <Ionicons name="refresh" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* add course btn */}
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.addTxt}>Add Course</Text>
        </TouchableOpacity>

        {/* my courses */}
        <Text style={[styles.label, { marginTop: 30 }]}>My Courses</Text>
        <View style={styles.courseRow}>
          {myCourses.length === 0 && (
            <Text style={{ color: '#666', marginTop: 8 }}>
              No course added yet.
            </Text>
          )}
          {myCourses.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.courseChip,
                selectedCourse === c && styles.courseChipActive,
              ]}
              onPress={() => setSelectedCourse(c)}
            >
              <Text
                style={[
                  styles.courseChipTxt,
                  selectedCourse === c && styles.courseChipTxtActive,
                ]}
              >
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* incoming matches */}
        <Text style={[styles.label, { marginTop: 30 }]}>Incoming Requests</Text>
        {loadingIncoming && <ActivityIndicator />}
        {incoming
          .filter((m) => m.course === selectedCourse || selectedCourse === '')
          .map((m) => (
            <View key={m.id} style={styles.matchCard}>
              <Ionicons name="person-circle" size={38} color="#007AFF" />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>{m.course}</Text>
                <Text style={{ fontSize: 12, color: '#666' }}>
                  {m.studyTime} · {m.meetingPreference}
                </Text>
                <Text style={{ fontSize: 12, color: '#888' }}>{m.bio}</Text>
              </View>
            </View>
          ))}
        {incoming.length === 0 && !loadingIncoming && (
          <Text style={{ color: '#666', marginTop: 8 }}>
            No requests yet.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── styles ─────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  mainTitle: { fontSize: 28, fontWeight: 'bold', color: '#333', flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#333', marginLeft: 12 },

  /* main page */
  addBtn: {
    marginTop: 15,
    marginHorizontal: 20,
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addTxt: { color: '#fff', fontWeight: '600', fontSize: 16 },
  courseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  courseChip: {
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  courseChipActive: { backgroundColor: '#007AFF' },
  courseChipTxt: { color: '#333', fontWeight: '500' },
  courseChipTxtActive: { color: '#fff' },
  matchCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },

  /* add-form */
  formScroll: { paddingHorizontal: 20, paddingBottom: 40 },
  label: { fontSize: 16, fontWeight: '600', color: '#333' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 4,
  },
  searchBtn: {
    marginTop: 12,
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
    justifyContent: 'center',
    gap: 6,
  },
  searchText: { color: '#fff', fontWeight: '600' },
  secBtn: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  secBtnActive: { backgroundColor: '#007AFF' },
  secTxt: { color: '#333', fontWeight: '500' },
  secTxtActive: { color: '#fff' },
  meetBtn: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  meetBtnActive: { backgroundColor: '#007AFF' },
  meetTxt: { color: '#333', fontWeight: '500' },
  meetTxtActive: { color: '#fff' },
  submit: {
    flexDirection: 'row',
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 28,
  },
  submitTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default MatchingScreen;