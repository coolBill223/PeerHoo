import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getOrCreateChat } from '../backend/chatService';
import { auth } from '../firebaseConfig';

const PartnerProfileScreen = ({ route, navigation }) => {
  const { partner } = route.params;
  const [partnerData, setPartnerData] = useState(partner);

  useEffect(() => {
    // Use only the real partner data passed in
    setPartnerData(partner);
  }, [partner]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Partner Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Avatar + Chat Icon + Name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={80} color="#007AFF" />
            <TouchableOpacity
              onPress={async () => {
                const currentUser = auth.currentUser;
                const partnerId = partnerData?.partnerId ?? partnerData?.id;
                if (!currentUser || !partnerId) return;

                try {
                  const chatId = await getOrCreateChat(currentUser.uid, partnerId);

                  navigation.navigate('MainTabs', {
                    screen: 'Chat',
                    params: {
                      screen: 'ChatThread',
                      params: {
                        thread: {
                          id: chatId,
                          name: partner.partnerName,
                        },
                      },
                    },
                  });

                  
                } catch (error) {
                  console.error('Failed to start chat:', error);
                }
              }}
              style={styles.chatIconButton}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.name}>
            {partnerData.partnerName || 'Study Partner'}
          </Text>
          {partnerData.partnerComputingId && (
            <Text style={styles.computingId}>
              Computing ID: {partnerData.partnerComputingId}
            </Text>
          )}
          {partnerData.course && (
            <View style={styles.sharedCourseContainer}>
              <Ionicons name="book" size={16} color="#34C759" />
              <Text style={styles.sharedCourse}>
                Shared Course: {partnerData.course}
              </Text>
            </View>
          )}
        </View>

        {/* Bio Section - only show if exists */}
        {partnerData.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.bioContainer}>
              <Text style={styles.bioText}>{partnerData.bio}</Text>
            </View>
          </View>
        )}

        {/* Study Preferences - only show available data */}
        {(partnerData.studyTime || partnerData.meetingPreference) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Study Preferences</Text>
            <View style={styles.preferencesContainer}>
              
              {/* Study Time - only if available */}
              {partnerData.studyTime && (
                <View style={styles.preferenceItem}>
                  <Ionicons name="time" size={20} color="#FF9500" />
                  <View style={styles.preferenceText}>
                    <Text style={styles.preferenceLabel}>Preferred Study Time</Text>
                    <Text style={styles.preferenceValue}>
                      {partnerData.studyTime}
                    </Text>
                  </View>
                </View>
              )}

              {/* Meeting Preference - only if available */}
              {partnerData.meetingPreference && (
                <View style={styles.preferenceItem}>
                  <Ionicons name="location" size={20} color="#34C759" />
                  <View style={styles.preferenceText}>
                    <Text style={styles.preferenceLabel}>Meeting Preference</Text>
                    <Text style={styles.preferenceValue}>
                      {partnerData.meetingPreference}
                    </Text>
                  </View>
                </View>
              )}

            </View>
          </View>
        )}

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.contactContainer}>
            
            {/* Name */}
            <View style={styles.contactItem}>
              <Ionicons name="person" size={16} color="#666" />
              <Text style={styles.contactLabel}>Name:</Text>
              <Text style={styles.contactValue}>
                {partnerData.partnerName || 'Not available'}
              </Text>
            </View>

            {/* Computing ID */}
            {partnerData.partnerComputingId && (
              <View style={styles.contactItem}>
                <Ionicons name="id-card" size={16} color="#666" />
                <Text style={styles.contactLabel}>Computing ID:</Text>
                <Text style={styles.contactValue}>
                  {partnerData.partnerComputingId}
                </Text>
              </View>
            )}

            {/* Course */}
            {partnerData.course && (
              <View style={styles.contactItem}>
                <Ionicons name="book" size={16} color="#666" />
                <Text style={styles.contactLabel}>Course:</Text>
                <Text style={styles.contactValue}>
                  {partnerData.course}
                </Text>
              </View>
            )}

          </View>
        </View>

        {/* Partnership Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Partnership Status</Text>
          <View style={styles.statusContainer}>
            <View style={styles.statusItem}>
              <Ionicons name="checkmark-circle" size={24} color="#34C759" />
              <View style={styles.statusText}>
                <Text style={styles.statusLabel}>Status</Text>
                <Text style={styles.statusValue}>Active Study Partner</Text>
              </View>
            </View>
            
            {partnerData.course && (
              <View style={styles.statusItem}>
                <Ionicons name="school" size={24} color="#007AFF" />
                <View style={styles.statusText}>
                  <Text style={styles.statusLabel}>Shared Course</Text>
                  <Text style={styles.statusValue}>{partnerData.course}</Text>
                </View>
              </View>
            )}
          </View>
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
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 0,
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 25,
    position: 'relative',
  },
  avatarContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatIconButton: {
    position: 'absolute',
    top: 0,
    right: -130,
    backgroundColor: '#007AFF',
    padding: 6,
    borderRadius: 16,
    zIndex: 2,
  },  
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    paddingTop: 10,
    marginBottom: 5,
  },
  computingId: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  sharedCourseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 5,
  },
  sharedCourse: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
    marginLeft: 5,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  bioContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  bioText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
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
    marginBottom: 15,
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
  contactContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    marginRight: 8,
    fontWeight: '500',
    minWidth: 80,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  statusContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusText: {
    marginLeft: 12,
    flex: 1,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    marginTop: 2,
  },
});

export default PartnerProfileScreen;