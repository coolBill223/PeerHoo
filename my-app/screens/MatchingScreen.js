import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MatchingScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Find Study Partners</Text>
      </View>
      
      <View style={styles.content}>
        <Ionicons name="people-outline" size={80} color="#007AFF" />
        <Text style={styles.placeholderText}>Course Matching Coming Soon!</Text>
        <Text style={styles.placeholderSubtext}>
          Find students in your courses and connect with them
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default MatchingScreen;