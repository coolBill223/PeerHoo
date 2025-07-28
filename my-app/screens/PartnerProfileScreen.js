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
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getOrCreateChat } from '../backend/chatService';
import { getUserInfo } from '../backend/userService';
import { blockPartner, reportPartner, isPartnerBlocked, unblockPartner } from '../backend/partnerService';
import { auth } from '../firebaseConfig';

const PartnerProfileScreen = ({ route, navigation }) => {
  const { partner } = route.params;
  const [partnerData, setPartnerData] = useState(partner);
  const [fullPartnerInfo, setFullPartnerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportingInProgress, setReportingInProgress] = useState(false);

  const reportReasons = [
    'Inappropriate behavior',
    'Harassment',
    'Fake profile',
    'No-show to study sessions',
    'Spam or irrelevant messages',
    'Other'
  ];

  useEffect(() => {
    loadFullPartnerInfo();
    checkBlockStatus();
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

  const checkBlockStatus = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser && partner.id) {
        const blocked = await isPartnerBlocked(partner.id, currentUser.uid);
        setIsBlocked(blocked);
      }
    } catch (error) {
      console.error('Error checking block status:', error);
    }
  };

  const handleBlockPartner = async () => {
    Alert.alert(
      'Block Partner',
      `Are you sure you want to block ${partnerData.partnerName || 'this partner'}? This will prevent them from contacting you and you won't see their messages.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              const currentUser = auth.currentUser;
              if (currentUser && partner.id) {
                await blockPartner(partner.id, currentUser.uid);
                setIsBlocked(true);
                Alert.alert(
                  'Partner Blocked',
                  'You have successfully blocked this partner. You can unblock them anytime from this screen.',
                  [
                    {
                      text: 'OK'
                    }
                  ]
                );
              }
            } catch (error) {
              console.error('Error blocking partner:', error);
              Alert.alert('Error', 'Failed to block partner. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleUnblockPartner = async () => {
    Alert.alert(
      'Unblock Partner',
      `Are you sure you want to unblock ${partnerData.partnerName || 'this partner'}? They will be able to contact you again.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Unblock',
          style: 'default',
          onPress: async () => {
            try {
              const currentUser = auth.currentUser;
              if (currentUser && partner.id) {
                await unblockPartner(partner.id, currentUser.uid);
                setIsBlocked(false);
                Alert.alert(
                  'Partner Unblocked',
                  'You have successfully unblocked this partner. You can now chat with them again.',
                  [
                    {
                      text: 'OK'
                    }
                  ]
                );
              }
            } catch (error) {
              console.error('Error unblocking partner:', error);
              Alert.alert('Error', 'Failed to unblock partner. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleReportPartner = async () => {
    if (!reportReason.trim()) {
      Alert.alert('Error', 'Please select or enter a reason for reporting.');
      return;
    }

    setReportingInProgress(true);
    try {
      const currentUser = auth.currentUser;
      if (currentUser && partner.id) {
        await reportPartner(partner.id, currentUser.uid, reportReason);
        setShowReportModal(false);
        setReportReason('');
        
        Alert.alert(
          'Report Submitted',
          'Thank you for your report. Our team will review it and take appropriate action if necessary.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error reporting partner:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setReportingInProgress(false);
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

  const renderReportModal = () => (
    <Modal
      visible={showReportModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowReportModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Report Partner</Text>
            <TouchableOpacity 
              onPress={() => setShowReportModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.modalSubtitle}>
            Please select a reason for reporting this partner:
          </Text>
          
          <ScrollView style={styles.reasonsList}>
            {reportReasons.map((reason, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.reasonItem,
                  reportReason === reason && styles.reasonItemSelected
                ]}
                onPress={() => setReportReason(reason)}
              >
                <Text style={[
                  styles.reasonText,
                  reportReason === reason && styles.reasonTextSelected
                ]}>
                  {reason}
                </Text>
                {reportReason === reason && (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {reportReason === 'Other' && (
            <TextInput
              style={styles.customReasonInput}
              placeholder="Please describe the issue..."
              multiline
              value={reportReason === 'Other' ? '' : reportReason}
              onChangeText={(text) => setReportReason(text)}
            />
          )}
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowReportModal(false)}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.modalSubmitButton,
                (!reportReason.trim() || reportingInProgress) && styles.modalSubmitButtonDisabled
              ]}
              onPress={handleReportPartner}
              disabled={!reportReason.trim() || reportingInProgress}
            >
              {reportingInProgress ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalSubmitButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

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
          <TouchableOpacity 
            style={styles.moreButton}
            onPress={() => {
              const actions = [
                {
                  text: 'Report Partner',
                  onPress: () => setShowReportModal(true),
                  style: 'destructive'
                }
              ];

              if (isBlocked) {
                actions.push({
                  text: 'Unblock Partner',
                  onPress: handleUnblockPartner,
                  style: 'default'
                });
              } else {
                actions.push({
                  text: 'Block Partner',
                  onPress: handleBlockPartner,
                  style: 'destructive'
                });
              }

              actions.push({
                text: 'Cancel',
                style: 'cancel'
              });

              Alert.alert(
                'Partner Actions',
                'What would you like to do?',
                actions
              );
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Blocked Status Banner */}
        {isBlocked && (
          <View style={styles.blockedBanner}>
            <Ionicons name="ban" size={20} color="#FF3B30" />
            <Text style={styles.blockedText}>This partner has been blocked</Text>
            <TouchableOpacity
              style={styles.unblockQuickButton}
              onPress={handleUnblockPartner}
            >
              <Text style={styles.unblockQuickButtonText}>Unblock</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Avatar + Chat Icon + Name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            {renderProfileImage()}
            {!isBlocked && (
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
            )}
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

          </View>
        </View>

        {/* Partnership Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Partnership Status</Text>
          <View style={styles.statusContainer}>
            <View style={styles.statusItem}>
              <Ionicons 
                name={isBlocked ? "ban" : "checkmark-circle"} 
                size={24} 
                color={isBlocked ? "#FF3B30" : "#34C759"} 
              />
              <View style={styles.statusText}>
                <Text style={styles.statusLabel}>Status</Text>
                <Text style={[
                  styles.statusValue,
                  isBlocked && { color: '#FF3B30' }
                ]}>
                  {isBlocked ? 'Blocked Partner' : 'Active Study Partner'}
                </Text>
              </View>
            </View>
            


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

        {/* Action Buttons Section */}
        <View style={styles.section}>
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.reportButton}
              onPress={() => setShowReportModal(true)}
            >
              <Ionicons name="flag" size={18} color="#FF3B30" />
              <Text style={styles.reportButtonText}>Report Partner</Text>
            </TouchableOpacity>
            
            {isBlocked ? (
              <TouchableOpacity
                style={styles.unblockButton}
                onPress={handleUnblockPartner}
              >
                <Ionicons name="checkmark-circle" size={18} color="#34C759" />
                <Text style={styles.unblockButtonText}>Unblock Partner</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.blockButton}
                onPress={handleBlockPartner}
              >
                <Ionicons name="ban" size={18} color="#FF3B30" />
                <Text style={styles.blockButtonText}>Block Partner</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

      </ScrollView>
      
      {renderReportModal()}
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
  moreButton: {
    padding: 8,
    marginRight: -8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    flex: 1,
  },
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffebee',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  blockedText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  unblockQuickButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  unblockQuickButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  reportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#FF3B30',
    gap: 8,
  },
  reportButtonText: {
    color: '#FF3B30',
    fontWeight: '600',
    fontSize: 16,
  },
  blockButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  blockButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  unblockButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  unblockButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  reasonsList: {
    maxHeight: 300,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  reasonItemSelected: {
    backgroundColor: '#f0f8ff',
    borderColor: '#007AFF',
  },
  reasonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  reasonTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  customReasonInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalSubmitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  modalSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default PartnerProfileScreen;