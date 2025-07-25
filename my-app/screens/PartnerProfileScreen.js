import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getOrCreateChat } from '../backend/chatService';
import { getUserInfo } from '../backend/userService';
import { auth } from '../firebaseConfig';

const PartnerProfileScreen = ({ route, navigation }) => {
  const { partner } = route.params;
  const [partnerData, setPartnerData] = useState(partner);
  const [fullPartnerInfo, setFullPartnerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    loadFullPartnerInfo();
  }, [partner]);

  const loadFullPartnerInfo = async () => {
    try {
      setLoading(true);
      
      // Get the partner's UID - could be stored as partnerId, id, or other field
      const partnerId = partner.partnerId || partner.id || partner.uid;
      
      if (partnerId) {
        // Fetch full user information including profile picture
        const fullInfo = await getUserInfo(partnerId);
        setFullPartnerInfo(fullInfo);
        
        // Merge with existing partner data
        setPartnerData({
          ...partner,
          ...fullInfo,
          // Preserve original partner-specific fields
          partnerName: partner.partnerName || fullInfo.name,
          partnerComputingId: partner.partnerComputingId || fullInfo.computingId,
        });
      } else {
        console.warn('No partner ID found to load full info');
        setPartnerData(partner);
      }
    } catch (error) {
      console.error('Error loading full partner info:', error);
      // Fallback to original partner data
      setPartnerData(partner);
    } finally {
      setLoading(false);
    }
  };

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  const renderProfileImage = () => {
    const photoURL = fullPartnerInfo?.photoURL || partnerData?.photoURL;
    const selectedAvatar = fullPartnerInfo?.selectedAvatar || partnerData?.selectedAvatar || 'person-circle';

    if (photoURL && !imageError) {
      return (
        <View style={styles.profileImageContainer}>
          <Image
            source={{ uri: photoURL }}
            style={styles.profileImage}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
          {imageLoading && (
            <View style={styles.imageLoadingOverlay}>
              <ActivityIndicator size="small" color="#007AFF" />
            </View>
          )}
        </View>
      );
    } else {
      // Fallback to icon avatar
      return (
        <View style={styles.avatarIconContainer}>
          <Ionicons name={selectedAvatar} size={80} color="#007AFF" />
        </View>
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading partner profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
            {renderProfileImage()}
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
                          name: partnerData.partnerName || partnerData.name,
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
            {partnerData.partnerName || partnerData.name || 'Study Partner'}
          </Text>
          {(partnerData.partnerComputingId || partnerData.computingId) && (
            <Text style={styles.computingId}>
              Computing ID: {partnerData.partnerComputingId || partnerData.computingId}
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

        {/* Bio Section - show from full info or partner data */}
        {(fullPartnerInfo?.bio || partnerData.bio) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.bioContainer}>
              <Text style={styles.bioText}>
                {fullPartnerInfo?.bio || partnerData.bio}
              </Text>
            </View>
          </View>
        )}

        {/* Courses Section - show from full info if available */}
        {fullPartnerInfo?.courses && fullPartnerInfo.courses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Courses</Text>
            <View style={styles.coursesContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {fullPartnerInfo.courses.map((course, index) => (
                  <View key={index} style={styles.courseChip}>
                    <Text style={styles.courseText}>{course}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Study Preferences - prefer full info, fallback to partner data */}
        {(fullPartnerInfo?.studyTimes || fullPartnerInfo?.meetingPreference || 
          partnerData.studyTime || partnerData.meetingPreference) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Study Preferences</Text>
            <View style={styles.preferencesContainer}>
              
              {/* Study Time */}
              {(fullPartnerInfo?.studyTimes || partnerData.studyTime) && (
                <View style={styles.preferenceItem}>
                  <Ionicons name="time" size={20} color="#FF9500" />
                  <View style={styles.preferenceText}>
                    <Text style={styles.preferenceLabel}>Preferred Study Time</Text>
                    <Text style={styles.preferenceValue}>
                      {fullPartnerInfo?.studyTimes ? 
                        fullPartnerInfo.studyTimes.join(', ') : 
                        partnerData.studyTime}
                    </Text>
                  </View>
                </View>
              )}

              {/* Meeting Preference */}
              {(fullPartnerInfo?.meetingPreference || partnerData.meetingPreference) && (
                <View style={styles.preferenceItem}>
                  <Ionicons name="location" size={20} color="#34C759" />
                  <View style={styles.preferenceText}>
                    <Text style={styles.preferenceLabel}>Meeting Preference</Text>
                    <Text style={styles.preferenceValue}>
                      {fullPartnerInfo?.meetingPreference || partnerData.meetingPreference}
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
                {partnerData.partnerName || partnerData.name || 'Not available'}
              </Text>
            </View>

            {/* Computing ID */}
            {(partnerData.partnerComputingId || partnerData.computingId) && (
              <View style={styles.contactItem}>
                <Ionicons name="id-card" size={16} color="#666" />
                <Text style={styles.contactLabel}>Computing ID:</Text>
                <Text style={styles.contactValue}>
                  {partnerData.partnerComputingId || partnerData.computingId}
                </Text>
              </View>
            )}

            {/* Email */}
            {(fullPartnerInfo?.email || partnerData.email) && (
              <View style={styles.contactItem}>
                <Ionicons name="mail" size={16} color="#666" />
                <Text style={styles.contactLabel}>Email:</Text>
                <Text style={styles.contactValue}>
                  {fullPartnerInfo?.email || partnerData.email}
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

            {fullPartnerInfo?.createdAt && (
              <View style={styles.statusItem}>
                <Ionicons name="calendar" size={24} color="#FF9500" />
                <View style={styles.statusText}>
                  <Text style={styles.statusLabel}>Member Since</Text>
                  <Text style={styles.statusValue}>
                    {fullPartnerInfo.createdAt?.toDate ? 
                      fullPartnerInfo.createdAt.toDate().toLocaleDateString() : 
                      'Recently'}
                  </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
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
  profileImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    position: 'relative',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(248, 249, 250, 0.8)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
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
  courseChip: {
    backgroundColor: '#f0f8ff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  courseText: {
    color: '#007AFF',
    fontWeight: '500',
    fontSize: 14,
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