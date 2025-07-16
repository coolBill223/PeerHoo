import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MatchingScreen = ({ navigation }) => {
  // Mock existing matches (replace with Firebase data later)
  const courses = ['CS 2100', 'MATH 3100', 'PSYC 2500'];
  const matchData = {
    'CS 2100': [
      { id: '1', name: 'John Smith', course: 'CS 2100', bio: 'Computer Science major, loves algorithms' },
      { id: '2', name: 'Bob Lee', course: 'CS 2100', bio: 'Looking for project partners' },
    ],
    'MATH 3100': [
      { id: '3', name: 'Marsha Mello', course: 'MATH 3100', bio: 'Math enthusiast, study group organizer' },
      { id: '4', name: 'Paige Turner', course: 'MATH 3100', bio: 'Pre-med student, detailed note taker' },
    ],
    'PSYC 2500': [
      { id: '5', name: 'Noah Dia', course: 'PSYC 2500', bio: 'Psychology major, research focused' },
    ],
  };

  const [selectedCourse, setSelectedCourse] = useState('CS 2100');
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    courseCode: '',
    studyGoals: '',
    meetingPreference: 'In-person',
    availability: '',
  });

  // Available courses dropdown options
  const availableCourses = [
    'CS 1010 - Introduction to Information Technology',
    'CS 2100 - Data Structures and Algorithms 1', 
    'CS 2110 - Software Development Methods',
    'CS 3240 - Advanced Software Development',
    'CS 4414 - Operating Systems',
    'CS 4720 - Web and Mobile Systems',
    'MATH 1310 - Calculus I',
    'MATH 1320 - Calculus II', 
    'MATH 2310 - Calculus III',
    'MATH 3100 - Introduction to Probability',
    'PHYS 1425 - Physics I',
    'PHYS 1429 - Physics II',
    'CHEM 1410 - General Chemistry I',
    'CHEM 1420 - General Chemistry II',
    'ECON 2010 - Principles of Microeconomics',
    'ECON 2020 - Principles of Macroeconomics',
    'PSYC 1010 - Introduction to Psychology',
    'PSYC 2500 - Research Methods in Psychology',
    'STAT 2120 - Introduction to Statistical Analysis',
    'APMA 3080 - Linear Algebra',
  ];

  const [showCourseDropdown, setShowCourseDropdown] = useState(false);

  const meetingOptions = ['In-person', 'Virtual', 'Both'];

  const handleFormSubmit = () => {
    if (!formData.courseCode.trim()) {
      Alert.alert('Error', 'Please select a course');
      return;
    }

    // Here you would save to Firebase
    Alert.alert(
      'Course Added!', 
      `Successfully added ${formData.courseCode.split(' - ')[0]} to your matching preferences.`,
      [
        {
          text: 'OK',
          onPress: () => {
            setShowForm(false);
            setFormData({
              courseCode: '',
              studyGoals: '',
              meetingPreference: 'In-person',
              availability: '',
            });
          }
        }
      ]
    );
  };

  const handleConnect = (match) => {
    Alert.alert(
      'Connect with ' + match.name,
      'Would you like to send a connection request?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Connect', 
          onPress: () => {
            // Here you would create a chat room or send connection request
            Alert.alert('Success', `Connection request sent to ${match.name}!`);
          }
        }
      ]
    );
  };

  if (showForm) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setShowForm(false)}
          >
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.formTitle}>Add Course for Matching</Text>
        </View>

        <ScrollView style={styles.formContainer}>
          <View style={styles.formSection}>
            <Text style={styles.label}>Select Course *</Text>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setShowCourseDropdown(!showCourseDropdown)}
            >
              <Text style={[styles.dropdownButtonText, !formData.courseCode && styles.placeholderText]}>
                {formData.courseCode || 'Select a course...'}
              </Text>
              <Ionicons 
                name={showCourseDropdown ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>
            
            {showCourseDropdown && (
              <View style={styles.dropdownContainer}>
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                  {availableCourses.map((course, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFormData({...formData, courseCode: course});
                        setShowCourseDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{course}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Study Goals</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What are you hoping to achieve? (e.g., exam prep, project collaboration, homework help)"
              value={formData.studyGoals}
              onChangeText={(text) => setFormData({...formData, studyGoals: text})}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Meeting Preference</Text>
            <View style={styles.optionsContainer}>
              {meetingOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionButton,
                    formData.meetingPreference === option && styles.optionButtonActive
                  ]}
                  onPress={() => setFormData({...formData, meetingPreference: option})}
                >
                  <Text style={[
                    styles.optionText,
                    formData.meetingPreference === option && styles.optionTextActive
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Enter a timeslot in which you are free to study</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 6pm-7:30pm, 2:00pm-4:00pm"
              value={formData.availability}
              onChangeText={(text) => setFormData({...formData, availability: text})}
            />
          </View>

          <TouchableOpacity style={styles.submitButton} onPress={handleFormSubmit}>
            <Ionicons name="add-circle" size={20} color="#fff" style={{marginRight: 8}} />
            <Text style={styles.submitButtonText}>Add Course</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Find Study Partners</Text>
        </View>

        {/* Add Course Button */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.addCourseMainButton}
            onPress={() => setShowForm(true)}
          >
            <Ionicons name="add-circle" size={20} color="#fff" style={{marginRight: 8}} />
            <Text style={styles.addCourseMainButtonText}>Add Course for Matching</Text>
          </TouchableOpacity>
        </View>

        {/* Course Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Courses</Text>
          <View style={styles.courseList}>
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
        </View>

        {/* Suggested Matches */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suggested Matches for {selectedCourse}</Text>
          {matchData[selectedCourse]?.length > 0 ? (
            matchData[selectedCourse].map((match) => (
              <View key={match.id} style={styles.matchCard}>
                <View style={styles.matchInfo}>
                  <Ionicons name="person-circle" size={40} color="#007AFF" style={styles.matchAvatar} />
                  <View style={styles.matchDetails}>
                    <Text style={styles.matchName}>{match.name}</Text>
                    <Text style={styles.matchCourse}>{match.course}</Text>
                    <Text style={styles.matchBio}>{match.bio}</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.connectButton}
                  onPress={() => handleConnect(match)}
                >
                  <Text style={styles.connectButtonText}>Connect</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.noMatchesContainer}>
              <Ionicons name="search" size={48} color="#ccc" />
              <Text style={styles.noMatchesText}>No matches found for this course</Text>
              <Text style={styles.noMatchesSubtext}>Try adding more courses or check back later!</Text>
            </View>
          )}
        </View>

        {/* Match Again Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.matchAgainButton}>
            <Ionicons name="refresh" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.matchAgainText}>Refresh Matches</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    paddingBottom: 40,
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
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginRight: 15,
  },
  addCourseMainButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  addCourseMainButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginRight: 15,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 25,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  courseList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  courseButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  courseButtonActive: {
    backgroundColor: '#007AFF',
  },
  courseButtonText: {
    color: '#333',
    fontWeight: '500',
  },
  courseButtonTextActive: {
    color: '#fff',
  },
  matchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  matchInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  matchAvatar: {
    marginRight: 12,
  },
  matchDetails: {
    flex: 1,
  },
  matchName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  matchCourse: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  matchBio: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
    lineHeight: 18,
  },
  connectButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-end',
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  noMatchesContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noMatchesText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    fontWeight: '500',
  },
  noMatchesSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  matchAgainButton: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
  },
  matchAgainText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  // Form styles
  formContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  formSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  optionButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionText: {
    color: '#333',
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#fff',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  // Dropdown styles
  dropdownButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  dropdownContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 5,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#333',
  },
});

export default MatchingScreen;