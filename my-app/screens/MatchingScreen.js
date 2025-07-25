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
  Keyboard,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCourseSections } from '../backend/courseService';
import { sendMatchRequest, getIncomingMatchRequests, getMyMatchRequests, getOpenMatchRequests, applyToMatchRequest,
  acceptMatchRequest, rejectMatchRequest } from '../backend/matchService';
import { getPartnersForCourseWithNames, blockPartner, reportPartner, isPartnerBlocked } from '../backend/partnerService';
import { auth } from '../firebaseConfig';

const MatchingScreen = ({ navigation }) => {
  const [uid, setUid] = useState(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUid(user.uid);
      loadMyCourses(user.uid);
    }
  }, []);

  const [myCourses, setMyCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [currentPartners, setCurrentPartners] = useState([]);
  const [blockedPartners, setBlockedPartners] = useState([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [incoming, setIncoming] = useState([]);
  const [loadingIncoming, setLoadingIncoming] = useState(false);
  const [open, setOpen] = useState([]);
  const [loadingOpen, setLoadingOpen] = useState(false);
  
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
  
  // Report/Block modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportingInProgress, setReportingInProgress] = useState(false);
  
  const meetingOptions = ['In-person', 'Virtual', 'Both'];
  const reportReasons = [
    'Inappropriate behavior',
    'Harassment',
    'Fake profile',
    'No-show to study sessions',
    'Spam or irrelevant messages',
    'Other'
  ];

  //helper functions
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

  const loadMyCourses = async (uid) => {
    try {
      const all = await getMyMatchRequests(uid);
      const userCourses = all
        .filter((m) => m.senderId === uid)
        .map((m) => m.course);
      setMyCourses([...new Set(userCourses)]);
    } catch (err) {
      console.error('Failed to load my courses:', err);
    }
  };

  const loadCurrentPartners = async (course) => {
    if (!course || !uid) return;
    try {
      setLoadingPartners(true);
      const allPartners = await getPartnersForCourseWithNames(uid, course);
      
      // Check block status for each partner
      const partnerStatusPromises = allPartners.map(async (partner) => {
        const isBlocked = await isPartnerBlocked(partner.id, uid);
        return {
          ...partner,
          isBlocked
        };
      });
      
      const partnersWithStatus = await Promise.all(partnerStatusPromises);
      
      // Separate blocked and unblocked partners
      const activePartners = partnersWithStatus.filter(p => !p.isBlocked);
      const blocked = partnersWithStatus.filter(p => p.isBlocked);
      
      setCurrentPartners(activePartners);
      setBlockedPartners(blocked);
    } catch (error) {
      console.error('Failed to load current partners:', error);
    } finally {
      setLoadingPartners(false);
    }
  };

  const handleApply = async (reqId) => {
    try {
      await applyToMatchRequest(reqId, uid);
      Alert.alert('Applied', 'Your request has been sent.');
      loadIncoming();
      const data = await getOpenMatchRequests(selectedCourse, uid);
      setOpen(data);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handleReportUser = async () => {
    if (!reportReason.trim()) {
      Alert.alert('Error', 'Please select or enter a reason for reporting.');
      return;
    }

    setReportingInProgress(true);
    try {
      if (reportTarget && reportTarget.partnershipId) {
        await reportPartner(reportTarget.partnershipId, uid, reportReason);
        setShowReportModal(false);
        setReportReason('');
        setReportTarget(null);
        
        Alert.alert(
          'Report Submitted',
          'Thank you for your report. Our team will review it and take appropriate action if necessary.'
        );
      }
    } catch (error) {
      console.error('Error reporting user:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setReportingInProgress(false);
    }
  };

  const handleBlockUser = async (partner) => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${partner.partnerName || 'this user'}? This will prevent them from contacting you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              if (partner.id) {
                await blockPartner(partner.id, uid);
                Alert.alert('User Blocked', 'You have successfully blocked this user.');
                loadCurrentPartners(selectedCourse);
              }
            } catch (error) {
              console.error('Error blocking user:', error);
              Alert.alert('Error', 'Failed to block user. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handlePartnerLongPress = (partner) => {
    Alert.alert(
      'Partner Actions',
      `What would you like to do with ${partner.partnerName || 'this partner'}?`,
      [
        {
          text: 'Report User',
          onPress: () => {
            setReportTarget({
              partnershipId: partner.id,
              partnerName: partner.partnerName
            });
            setShowReportModal(true);
          },
          style: 'destructive'
        },
        {
          text: 'Block User',
          onPress: () => handleBlockUser(partner),
          style: 'destructive'
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleViewBlockedPartners = () => {
    const allBlockedPartners = [...blockedPartners];
    navigation.navigate('BlockedPartners', { 
      blockedPartners: allBlockedPartners, 
      onPartnersUpdated: () => loadCurrentPartners(selectedCourse)
    });
  };

  useEffect(() => {
    const loadOpen = async () => {
      if (!selectedCourse || !uid) return;
      try {
        setLoadingOpen(true);
        const data = await getOpenMatchRequests(selectedCourse, uid);
        setOpen(data);
      } finally {
        setLoadingOpen(false);
      }
    };
    loadOpen();
    loadCurrentPartners(selectedCourse);
  }, [selectedCourse, uid]); 

  useEffect(() => {
    if (uid) {
      loadIncoming();
    }
  }, [uid]);

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
      await loadMyCourses(uid);
      setSelectedCourse(form.courseCode);
      setShowForm(false);
      setForm({
        subject: '',
        catalog: '',
        courseCode: '',
        availability: '',
        studyTime: '',
        goals: '',
        meeting: 'In-person',
      });
      setSections([]);
      loadIncoming();
    } catch (e) {
      Alert.alert('Error', e.message);
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
            <Text style={styles.modalTitle}>Report User</Text>
            <TouchableOpacity 
              onPress={() => setShowReportModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.modalSubtitle}>
            Please select a reason for reporting {reportTarget?.partnerName || 'this user'}:
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
              onPress={handleReportUser}
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
                <TouchableOpacity onPress={() => setShowForm(false)} style={styles.backButton}>
                  <Ionicons name="arrow-back" size={24} color="#007AFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add Course</Text>
                <View style={styles.headerSpacer} />
              </View>

              <ScrollView contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false}>
                {/* Subject + Catalog */}
                <View style={styles.formSection}>
                  <Text style={styles.label}>Subject *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="CS"
                    value={form.subject}
                    autoCapitalize="characters"
                    onChangeText={(t) => setForm({ ...form, subject: t.toUpperCase() })}
                  />
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.label}>Number *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="2100"
                    keyboardType="numeric"
                    value={form.catalog}
                    onChangeText={(t) => setForm({ ...form, catalog: t })}
                  />
                </View>

                {/* Search sections */}
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

                {/* Loading indicator */}
                {loadingSections && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading sections...</Text>
                  </View>
                )}

                {/* Section list */}
                {sections.length > 0 && (
                  <View style={styles.sectionsContainer}>
                    <Text style={styles.sectionHeader}>Available Sections</Text>
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
                          <Text style={[styles.secTxt, chosen && styles.secTxtActive]}>
                            {code}
                          </Text>
                          <Text style={[styles.secSubtxt, chosen && styles.secSubtxtActive]}>
                            {s.meetDays} {s.startTime}-{s.endTime} · {s.component}
                          </Text>
                          <Text style={[styles.secInstructorTxt, chosen && styles.secInstructorTxtActive]}>
                            Professor: {s.instructor}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Study Time */}
                <View style={styles.formSection}>
                  <Text style={styles.label}>Preferred Study Time</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. evenings, weekends"
                    value={form.studyTime}
                    onChangeText={(t) => setForm({ ...form, studyTime: t })}
                  />
                </View>

                {/* Goals */}
                <View style={styles.formSection}>
                  <Text style={styles.label}>Goals / Notes</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Tell potential study partners about your goals..."
                    multiline
                    value={form.goals}
                    onChangeText={(t) => setForm({ ...form, goals: t })}
                  />
                </View>

                {/* Meeting preference */}
                <View style={styles.formSection}>
                  <Text style={styles.label}>Meeting Mode</Text>
                  <View style={styles.meetingOptionsContainer}>
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
                </View>

                {/* Submit button */}
                <TouchableOpacity style={styles.submit} onPress={handleSubmit}>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.submitTxt}>Submit Request</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  /* Main page */
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.mainScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.mainTitle}>Find Study Partners</Text>
          <TouchableOpacity onPress={loadIncoming} style={styles.refreshButton}>
            <Ionicons name="refresh" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Add course button */}
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.addTxt}>Add Course</Text>
        </TouchableOpacity>

        {/* My courses section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Courses</Text>
          {myCourses.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="school-outline" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No courses added yet</Text>
              <Text style={styles.emptyStateSubtext}>Add a course to start finding study partners</Text>
            </View>
          ) : (
            <View style={styles.courseRow}>
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
          )}
        </View>

        {/* Current Partners for Selected Course */}
        {selectedCourse !== '' && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Active Partners - {selectedCourse}</Text>
              {blockedPartners.length > 0 && (
                <TouchableOpacity 
                  style={styles.blockedButton}
                  onPress={handleViewBlockedPartners}
                >
                  <Ionicons name="ban" size={16} color="#FF3B30" />
                  <Text style={styles.blockedButtonText}>{blockedPartners.length}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Blocked Partners Notice */}
            {blockedPartners.length > 0 && (
              <TouchableOpacity 
                style={styles.blockedNotice}
                onPress={handleViewBlockedPartners}
              >
                <Ionicons name="ban" size={18} color="#FF3B30" />
                <Text style={styles.blockedNoticeText}>
                  {blockedPartners.length} blocked partner{blockedPartners.length > 1 ? 's' : ''} for this course
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#FF3B30" />
              </TouchableOpacity>
            )}

            {loadingPartners ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.loadingText}>Loading partners...</Text>
              </View>
            ) : currentPartners.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>No active partners</Text>
                <Text style={styles.emptyStateSubtext}>Find study partners for this course below</Text>
              </View>
            ) : (
              currentPartners.map((partner) => (
                <TouchableOpacity
                  key={partner.id}
                  style={styles.partnerCard}
                  onPress={() => navigation.navigate('PartnerProfile', { partner })}
                  onLongPress={() => handlePartnerLongPress(partner)}
                >
                  <View style={styles.avatarContainer}>
                    <Ionicons name="person" size={24} color="#007AFF" />
                  </View>
                  <View style={styles.partnerInfo}>
                    <Text style={styles.partnerName}>{partner.partnerName}</Text>
                    <Text style={styles.partnerDetails}>
                      Computing ID: {partner.partnerComputingId || 'Not available'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#ccc" />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Incoming Applications section */}
        {(incoming.filter((m) => (m.course === selectedCourse || selectedCourse === '') && m.senderId === uid && m.receiverId !== null && m.status === 'pending').length > 0 || loadingIncoming) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Incoming Applications</Text>

            {loadingIncoming && <ActivityIndicator />}

            {incoming
              .filter((m) => (m.course === selectedCourse || selectedCourse === '') && m.senderId === uid && m.receiverId !== null && m.status === 'pending')
              .map((m) => {
                return (
                  <View key={m.id} style={styles.matchCard}>
                    <Ionicons name="person-circle" size={38} color="#007AFF" />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={{ fontWeight: '600', fontSize: 16 }}>{m.course}</Text>
                      <Text style={{ fontSize: 13, color: '#666' }}>
                        {m.studyTime} · {m.meetingPreference}
                      </Text>
                      <Text style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{m.bio}</Text>
                      <Text style={{ fontSize: 12, color: '#007AFF', marginTop: 2 }}>
                        Applied by: {m.receiverName || 'Unknown'}
                      </Text>
                    </View>

                    {/* Action buttons */}
                    <View style={{ flexDirection: 'row', marginLeft: 10 }}>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={async () => {
                          await acceptMatchRequest(m);
                          loadIncoming();
                          setOpen(await getOpenMatchRequests(selectedCourse, uid));
                          loadCurrentPartners(selectedCourse);
                        }}
                      >
                        <Text style={styles.btnTxt}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={async () => {
                          await rejectMatchRequest(m.id);
                          loadIncoming();
                          setOpen(await getOpenMatchRequests(selectedCourse, uid));
                        }}
                      >
                        <Text style={styles.btnTxt}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

            {incoming.filter((m) => (m.course === selectedCourse || selectedCourse === '') && m.senderId === uid && m.receiverId !== null && m.status === 'pending').length === 0 && !loadingIncoming && (
              <Text style={{ color: '#666', marginTop: 8 }}>No applications yet.</Text>
            )}
          </View>
        )}

        {/* My Applications to Others */}
        {(incoming.filter((m) => (m.course === selectedCourse || selectedCourse === '') && m.receiverId === uid).length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Applications</Text>
            
            {incoming
              .filter((m) => (m.course === selectedCourse || selectedCourse === '') && m.receiverId === uid)
              .map((m) => (
                <View key={m.id} style={styles.matchCard}>
                  <View style={styles.avatarContainer}>
                    <Ionicons 
                      name={m.status === 'rejected' ? "close-circle" : "paper-plane"} 
                      size={24} 
                      color={m.status === 'rejected' ? "#FF3B30" : "#007AFF"} 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', fontSize: 16 }}>{m.course}</Text>
                    <Text style={{ fontSize: 13, color: '#666' }}>
                      {m.studyTime} · {m.meetingPreference}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{m.bio}</Text>
                    <Text style={{ fontSize: 12, color: '#FFA500', marginTop: 2 }}>
                      Applied to: {m.senderName || 'Unknown'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'center', marginLeft: 10 }}>
                    <Ionicons 
                      name={m.status === 'rejected' ? "close-circle" : "hourglass"} 
                      size={20} 
                      color={m.status === 'rejected' ? "#FF3B30" : "#FFA500"} 
                    />
                    <Text style={{ 
                      fontSize: 12, 
                      color: m.status === 'rejected' ? '#FF3B30' : '#888', 
                      marginTop: 2,
                      fontWeight: m.status === 'rejected' ? '600' : 'normal'
                    }}>
                      {m.status === 'rejected' ? 'Rejected' : 'Pending'}
                    </Text>
                  </View>
                </View>
              ))
            }
          </View>
        )}

        {/* My Open Posted Requests section */}
        {incoming.filter((m) => (m.course === selectedCourse || selectedCourse === '') && m.senderId === uid && m.receiverId === null).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Open Requests</Text>
            
            {incoming
              .filter((m) => (m.course === selectedCourse || selectedCourse === '') && m.senderId === uid && m.receiverId === null)
              .map((m) => (
                <View key={m.id} style={styles.matchCard}>
                  <View style={styles.avatarContainer}>
                    <Ionicons name="time" size={24} color="#FFA500" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', fontSize: 16 }}>{m.course}</Text>
                    <Text style={{ fontSize: 13, color: '#666' }}>
                      {m.studyTime} · {m.meetingPreference}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{m.bio}</Text>
                  </View>
                  <View style={{ alignItems: 'center', marginLeft: 10 }}>
                    <Ionicons name="eye" size={20} color="#007AFF" />
                    <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                      Waiting
                    </Text>
                  </View>
                </View>
              ))
            }
          </View>
        )}

        {/* Open requests section */}
        {selectedCourse !== '' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Open Requests - {selectedCourse}</Text>
            {loadingOpen ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.loadingText}>Loading open requests...</Text>
              </View>
            ) : open.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>No open requests</Text>
                <Text style={styles.emptyStateSubtext}>Be the first to create a request for this course</Text>
              </View>
            ) : (
              open.map((m) => (
                <View key={m.id} style={styles.matchCard}>
                  <View style={styles.avatarContainer}>
                    <Ionicons name="person-outline" size={24} color="#999" />
                  </View>
                  <View style={styles.matchInfo}>
                    <Text style={styles.matchCourse}>{m.course}</Text>
                    <Text style={styles.matchDetails}>
                      {m.studyTime} · {m.meetingPreference}
                    </Text>
                    <Text style={styles.matchBio}>{m.bio}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.applyBtn}
                    onPress={() => handleApply(m.id)}
                  >
                    <Text style={styles.applyTxt}>Apply</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
      
      {renderReportModal()}
    </SafeAreaView>
  );
};

/* Styles */
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8f9fa' 
  },
  
  // Header styles
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerSpacer: {
    width: 40,
  },
  mainTitle: { 
    fontSize: 27, 
    fontWeight: 'bold', 
    color: '#1a1a1a',
    textAlign: 'center',
    flex: 1,
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: '600', 
    color: '#1a1a1a',
    textAlign: 'center',
    flex: 1,
  },
  refreshButton: {
    padding: 8,
    marginRight: -8,
  },

  // Main page styles
  mainScroll: { 
    paddingBottom: 40 
  },
  addBtn: {
    marginTop: 15,
    marginHorizontal: 20,
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addTxt: { 
    color: '#fff', 
    fontWeight: '600', 
    fontSize: 16 
  },

  // Section styles
  section: {
    marginTop: 30,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  blockedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  blockedButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF3B30',
  },
  blockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF3B30',
  },
  blockedNoticeText: {
    flex: 1,
    fontSize: 13,
    color: '#FF3B30',
    fontWeight: '500',
    marginLeft: 6,
  },

  // Course chips
  courseRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8,
  },
  courseChip: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  courseChipActive: { 
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  courseChipTxt: { 
    color: '#333', 
    fontWeight: '500',
    fontSize: 14,
  },
  courseChipTxtActive: { 
    color: '#fff' 
  },

  // Current Partners styles
  partnerCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
  },
  partnerInfo: {
    flex: 1,
  },
  partnerName: { 
    fontWeight: '600',
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 4,
  },
  partnerDetails: { 
    fontSize: 13, 
    color: '#666',
  },

  // Match cards
  matchCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  matchInfo: {
    flex: 1,
  },
  matchCourse: { 
    fontWeight: '600',
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 4,
  },
  matchDetails: { 
    fontSize: 13, 
    color: '#666',
    marginBottom: 4,
  },
  matchBio: { 
    fontSize: 13, 
    color: '#888',
    lineHeight: 18,
  },

  // Button styles
  acceptBtn: {
    backgroundColor: '#34C759',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  rejectBtn: {
    backgroundColor: '#FF3B30',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  btnTxt: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  applyBtn: {
    backgroundColor: '#34C759',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 12,
  },
  applyTxt: { 
    color: '#fff', 
    fontWeight: '600', 
    fontSize: 14 
  },

  // Empty states
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },

  // Loading states
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },

  // Form styles
  formScroll: { 
    paddingHorizontal: 20, 
    paddingBottom: 40 
  },
  formSection: {
    marginBottom: 20,
  },
  label: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#1a1a1a',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  
  // Search button
  searchBtn: {
    marginBottom: 20,
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  searchText: { 
    color: '#fff', 
    fontWeight: '600',
    fontSize: 16,
  },

  // Sections
  sectionsContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  secBtn: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  secBtnActive: { 
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  secTxt: { 
    color: '#333', 
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 4,
  },
  secTxtActive: { 
    color: '#fff' 
  },
  secSubtxt: {
    color: '#666',
    fontSize: 14,
    marginBottom: 4,
  },
  secSubtxtActive: {
    color: '#fff',
    opacity: 0.9,
  },
  secInstructorTxt: {
    color: '#666',
    fontSize: 13,
    fontStyle: 'italic',
  },
  secInstructorTxtActive: {
    color: '#fff',
    opacity: 0.85,
    fontStyle: 'italic',
  },

  // Meeting options
  meetingOptionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  meetBtn: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flex: 1,
    alignItems: 'center',
  },
  meetBtnActive: { 
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  meetTxt: { 
    color: '#333', 
    fontWeight: '500',
    fontSize: 14,
  },
  meetTxtActive: { 
    color: '#fff' 
  },

  // Submit button
  submit: {
    flexDirection: 'row',
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitTxt: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600' 
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

export default MatchingScreen;