import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MatchingScreen = ({ navigation }) => { //Will pull from Firebase later
  const courses = ['CS 2100', 'MATH 3100', 'PSYC 2500'];
  const matchData = {
    'CS 2100': [
      { id: '1', name: 'John Smith', course: 'CS 2100' },
      { id: '2', name: 'Bob Lee', course: 'CS 2100' },
    ],
    'MATH 3100': [
      { id: '3', name: 'Marsha Mello', course: 'MATH 3100' },
      { id: '4', name: 'Paige Turner', course: 'MATH 3100' },
    ],
    'PSYC 2500': [
      { id: '5', name: 'Noah Dia', course: 'PSYC 2500' },
    ],
  };

  const [selectedCourse, setSelectedCourse] = useState('CS 1010');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Find Study Partners</Text>
        </View>

        {/* Course Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select a Course</Text>
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
          <Text style={styles.sectionTitle}>Suggested Matches</Text>
          {matchData[selectedCourse]?.length > 0 ? (
            matchData[selectedCourse].map((match) => (
              <View key={match.id} style={styles.matchCard}>
                <Ionicons name="person-circle" size={32} color="#007AFF" style={{ marginRight: 10 }} />
                <View>
                  <Text style={styles.matchName}>{match.name}</Text>
                  <Text style={styles.matchCourse}>{match.course}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.placeholderText}>No matches found for this course</Text>
          )}
        </View>

        {/* Match Again Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.matchAgainButton}>
            <Ionicons name="refresh" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.matchAgainText}>Match Again</Text>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
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
  placeholderText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
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
});

export default MatchingScreen;