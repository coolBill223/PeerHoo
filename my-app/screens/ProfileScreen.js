import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebaseConfig';

const avatarOptions = [
  'school',
  'book',
  'laptop',
  'code-slash',
  'bulb',
  'leaf',
  'cloud',
  'star',
  'heart',
];

const ProfileScreen = () => {
  const [selectedAvatar, setSelectedAvatar] = useState('person-circle');
  const [bio, setBio] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [computingID, setComputingID] = useState('');
  const [courses, setCourses] = useState([]);
  const [newCourse, setNewCourse] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [studyTimes, setStudyTimes] = useState(['Evenings', 'Weekends']);
  const [meetingPreference, setMeetingPreference] = useState('In-person & Virtual');

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setName(user.displayName || 'Your Name');
      setEmail(user.email || 'your.email@virginia.edu');
      if (user.email) {
        const computingId = user.email.split('@')[0];
        setComputingID(computingId);
      }
    }
  }, []);

  const handleSaveProfile = () => {
    // Here you would save to Firebase Firestore
    Alert.alert(
      'Profile Updated',
      'Your profile has been saved successfully!',
      [{ text: 'OK', onPress: () => setIsEditing(false) }]
    );
  };
  
  const handleAddCourse = () => {
    if (newCourse.trim() && !courses.includes(newCourse.trim())) {
      setCourses([...courses, newCourse.trim()]);
      setNewCourse('');
    }
  };
  
  const handleRemoveCourse = (courseToRemove) => {
    setCourses(courses.filter(course => course !== courseToRemove));
  };

  const studyTimeOptions = ['Mornings', 'Evenings', 'Nights', 'Weekdays', 'Weekends'];
  const meetingOptions = ['In-person', 'Virtual', 'Both'];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>My Profile</Text>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => setIsEditing(!isEditing)}
          >
            <Ionicons 
              name={isEditing ? "checkmark" : "pencil"} 
              size={20} 
              color={isEditing ? "#34C759" : "#007AFF"} 
            />
          </TouchableOpacity>
        </View>

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <Ionicons name={selectedAvatar} size={100} color="#007AFF" />
          {isEditing && (
          <>
            <Text style={styles.avatarLabel}>Select Your Avatar</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarPicker}>
              {avatarOptions.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  onPress={() => setSelectedAvatar(icon)}
                  style={[
                    styles.avatarOption,
                    selectedAvatar === icon && styles.avatarOptionSelected,
                  ]}
                >
                  <Ionicons 
                    name={icon} 
                    size={32} 
                    color={selectedAvatar === icon ? '#fff' : '#007AFF'} 
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
        </View>

        {/* Name Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Name</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              value={name}
              onChangeText={setName}
            />
          ) : (
            <View style={styles.displayField}>
              <Text style={styles.displayText}>{name}</Text>
            </View>
          )}
        </View>

        {/* Bio Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Bio</Text>
          {isEditing ? (
            <TextInput
              style={[styles.input, styles.bioInput]}
              placeholder="Tell us about yourself..."
              multiline
              numberOfLines={4}
              value={bio}
              onChangeText={setBio}
            />
          ) : (
            <View style={[styles.displayField, styles.bioDisplay]}>
              <Text style={styles.displayText}>
                {bio || "No bio added yet. Edit your profile to add a bio!"}
              </Text>
            </View>
          )}
        </View>

        {/* Contact Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Contact Information</Text>
          <View style={styles.infoContainer}>
            <View style={styles.infoItem}>
              <Ionicons name="mail" size={16} color="#666" />
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{email}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="person" size={16} color="#666" />
              <Text style={styles.infoLabel}>Computing ID:</Text>
              <Text style={styles.infoValue}>{computingID}</Text>
            </View>
          </View>
        </View>

        {/* Courses Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>My Courses</Text>
          <View style={styles.coursesContainer}>
          {courses.length === 0 ? (
          <Text style={styles.emptyCoursesText}>
            {isEditing ? "No courses yet, add some!" : "No courses added yet."}
          </Text>
        ) : (
          courses.map((course, index) => (
            <View key={index} style={styles.courseChip}>
              <Text style={styles.courseText}>{course}</Text>
              {isEditing && (
                <TouchableOpacity 
                  onPress={() => handleRemoveCourse(course)}
                  style={styles.removeCourseButton}
                >
                  <Ionicons name="close" size={16} color="#FF3B30" />
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
            
            {isEditing && (
              <View style={styles.addCourseContainer}>
                <TextInput
                  style={styles.addCourseInput}
                  placeholder="Add course (e.g., CS 4720)"
                  value={newCourse}
                  onChangeText={setNewCourse}
                  autoCapitalize="characters"
                />
                <TouchableOpacity 
                  style={styles.addCourseButton}
                  onPress={handleAddCourse}
                >
                  <Ionicons name="add" size={20} color="#007AFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Study Preferences */}
        <View style={styles.section}>
  <Text style={styles.sectionLabel}>Study Preferences</Text>
  <View style={styles.preferencesContainer}>
    
    {/* Preferred Study Time */}
    <View style={styles.preferenceItem}>
      <Ionicons name="time" size={20} color="#FF9500" />
      <View style={styles.preferenceText}>
        <Text style={styles.preferenceLabel}>Preferred Study Time</Text>
        {isEditing ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
            {studyTimeOptions.map(option => {
              const isSelected = studyTimes.includes(option);
              return (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionButton,
                    isSelected && styles.optionSelected,
                  ]}
                  onPress={() => {
                    if (isSelected) {
                      setStudyTimes(prev => prev.filter(t => t !== option));
                    } else {
                      setStudyTimes(prev => [...prev, option]);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <Text style={styles.preferenceValue}>
            {studyTimes.length > 0 ? studyTimes.join(', ') : 'None selected'}
          </Text>
        )}
      </View>
    </View>

          {/* Meeting Preference */}
          <View style={styles.preferenceItem}>
            <Ionicons name="location" size={20} color="#34C759" />
            <View style={styles.preferenceText}>
              <Text style={styles.preferenceLabel}>Meeting Preference</Text>
              {isEditing ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                  {meetingOptions.map(option => {
                    const isSelected = meetingPreference === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.optionButton,
                          isSelected && styles.optionSelected,
                        ]}
                        onPress={() => setMeetingPreference(option)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            isSelected && styles.optionTextSelected,
                          ]}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.preferenceValue}>{meetingPreference}</Text>
              )}
            </View>
          </View>

        </View>
      </View>

        {/* Save Button */}
        {isEditing && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
              <Ionicons name="save-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.saveText}>Save Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>My Activity</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Ionicons name="people" size={24} color="#007AFF" />
              <Text style={styles.statNumber}>3</Text>
              <Text style={styles.statLabel}>Study Partners</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="document-text" size={24} color="#34C759" />
              <Text style={styles.statNumber}>12</Text>
              <Text style={styles.statLabel}>Notes Shared</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="star" size={24} color="#FF9500" />
              <Text style={styles.statNumber}>4.8</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
    color: '#333' 
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  avatarLabel: {
    fontSize: 16,
    color: '#555',
    marginVertical: 10,
  },
  avatarPicker: {
    paddingHorizontal: 10,
    flexDirection: 'row',
  },
  avatarOption: {
    padding: 12,
    marginHorizontal: 6,
    borderRadius: 40,
    backgroundColor: '#e0e0e0',
  },
  avatarOptionSelected: {
    backgroundColor: '#007AFF',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  bioInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  displayField: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  bioDisplay: {
    minHeight: 60,
  },
  displayText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  infoContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    marginRight: 8,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  coursesContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  emptyCoursesText: {
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 8,
    fontSize: 14,
  },  
  courseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  courseText: {
    color: '#007AFF',
    fontWeight: '500',
    fontSize: 14,
  },
  removeCourseButton: {
    marginLeft: 6,
  },
  addCourseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  addCourseInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginRight: 8,
  },
  addCourseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preferencesContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  preferenceText: {
    marginLeft: 12,
    flex: 1,
  },
  preferenceLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  preferenceValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    marginTop: 2,
  },
  optionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginRight: 8,
    marginBottom: 8,
  },
  optionSelected: {
    backgroundColor: '#007AFF',
  },
  optionText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#fff',
  },  
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#34C759',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default ProfileScreen;