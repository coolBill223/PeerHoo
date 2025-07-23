import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { getAcceptedPartners } from '../backend/partnerService';
import { ensureUserDocument } from '../backend/userService';
import { getNotesByUser } from '../backend/noteService'; // Import notes service
import { getUserInfo } from '../backend/userService'; // Import user service
import { getMyMatchRequests } from '../backend/matchService'; // Import match service
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { getUnreadCount } from '../backend/chatService';

const tipBank = [
  "Share your notes after each lecture to help your classmates and build your reputation!",
  "Use flashcards to reinforce your memory of key concepts.",
  "Teach a concept to someone else to make sure you really understand it.",
  "Review your notes within 24 hours of class to retain information better.",
  "Form small study groups to compare notes and quiz each other.",
  "Organize your files and notes so you can easily find them before exams.",
  "Take short breaks to recharge your brain and reduce burnout.",
  "Use spaced repetition to retain concepts over the long term.",
  "Having a study buddy can keep you accountable and motivated, as long as you both stay focused (minimal yaping).",
  "Write down questions while studying and bring them to class."
];

const HomeScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [partners, setPartners] = useState([]);
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);
  const [userNotes, setUserNotes] = useState([]); // Add state for user's notes
  const [userCourseCount, setUserCourseCount] = useState(0); // Add state for course count
  const [currentTip, setCurrentTip] = useState('');

  useEffect(() => {
    const initializeUser = async () => {
      const current = auth.currentUser;
      setUser(current);

      if (current) {
        // Ensure user document exists in Firestore
        await ensureUserDocument();
        
        // Load user profile data
        await loadUserProfile(current.uid);
        
        // fetch all documents where status === 'accepted'
        try {
          const partnersData = await getAcceptedPartners(current.uid);
          setPartners(partnersData);
          
          // Load user's notes
          await loadUserNotes(current.uid);
          
          // Load user's course count
          await loadUserCourseCount(current.uid);
          
          // Load unread message count
          await loadUnreadMessageCount(current.uid);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      }
      const randomTip = tipBank[Math.floor(Math.random() * tipBank.length)];
      setCurrentTip(randomTip);
    };

  // Load user's course count from match requests
  const loadUserCourseCount = async (uid) => {
    try {
      const matchRequests = await getMyMatchRequests(uid);
      const userCourses = matchRequests
        .filter((m) => m.senderId === uid)
        .map((m) => m.course);
      
      const uniqueCourses = [...new Set(userCourses)];
      setUserCourseCount(uniqueCourses.length);
    } catch (error) {
      console.error('Error loading user course count:', error);
      setUserCourseCount(0);
    }
  };

    initializeUser();
  }, []);

  // Load user profile data from Firestore
  const loadUserProfile = async (uid) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserProfile(userData);
      } else {
        // Fallback to auth data
        const current = auth.currentUser;
        if (current) {
          setUserProfile({
            name: current.displayName || 'User',
            email: current.email || 'unknown@email.com'
          });
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  // Load user's notes
  const loadUserNotes = async (uid) => {
    try {
      const notes = await getNotesByUser(uid);
      
      // Fetch author information for each note (even though they're all from the current user)
      const notesWithAuthors = await Promise.all(
        notes.map(async (note) => {
          try {
            const authorInfo = await getUserInfo(note.authorId);
            return {
              ...note,
              authorName: authorInfo?.name || 'You',
              authorComputingId: authorInfo?.computingId || note.authorId.slice(0, 8)
            };
          } catch (error) {
            console.error('Error fetching author info:', error);
            return {
              ...note,
              authorName: 'You',
              authorComputingId: note.authorId.slice(0, 8)
            };
          }
        })
      );
      
      setUserNotes(notesWithAuthors);
    } catch (error) {
      console.error('Error loading user notes:', error);
      // Don't show alert for notes loading error on home screen
      setUserNotes([]);
    }
  };

  // Load user's course count from match requests
  const loadUserCourseCount = async (uid) => {
    try {
      const matchRequests = await getMyMatchRequests(uid);
      const userCourses = matchRequests
        .filter((m) => m.senderId === uid)
        .map((m) => m.course);
      
      const uniqueCourses = [...new Set(userCourses)];
      setUserCourseCount(uniqueCourses.length);
    } catch (error) {
      console.error('Error loading user course count:', error);
      setUserCourseCount(0);
    }
  };

  // Function to load total unread message count
  const loadUnreadMessageCount = async (userId) => {
    try {
      // Get all chats for this user
      const chatsQuery = query(
        collection(db, 'chats'), 
        where('participants', 'array-contains', userId)
      );
      
      const chatDocs = await getDocs(chatsQuery);
      
      if (chatDocs.empty) {
        setTotalUnreadMessages(0);
        return;
      }

      // Get unread count for each chat
      const unreadPromises = chatDocs.docs.map(async (chatDoc) => {
        return await getUnreadCount(chatDoc.id, userId);
      });
      
      const unreadCounts = await Promise.all(unreadPromises);
      const totalUnread = unreadCounts.reduce((sum, count) => sum + count, 0);
      
      setTotalUnreadMessages(totalUnread);
    } catch (error) {
      console.error('Error loading unread message count:', error);
      setTotalUnreadMessages(0);
    }
  };

  // Function to reload partners after updating
  const reloadPartners = async () => {
    const current = auth.currentUser;
    if (current) {
      try {
        const partnersData = await getAcceptedPartners(current.uid);
        
        // Only update state if we actually got data
        if (partnersData && Array.isArray(partnersData)) {
          setPartners(partnersData);
        }
        
        // Reload unread count and notes
        await loadUnreadMessageCount(current.uid);
        await loadUserNotes(current.uid);
        await loadUserCourseCount(current.uid);
      } catch (error) {
        console.error('Error reloading data:', error);
      }
    }
  };

  // Reload user profile, unread count, and notes when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (auth.currentUser?.uid) {
        loadUserProfile(auth.currentUser.uid);
        loadUnreadMessageCount(auth.currentUser.uid);
        loadUserNotes(auth.currentUser.uid);
        loadUserCourseCount(auth.currentUser.uid);
      }
    });

    return unsubscribe;
  }, [navigation]);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          }
        },
      ]
    );
  };

  // Get unique courses from user's notes (keep as fallback)
  const getUserCourses = () => {
    const courses = new Set(userNotes.map(note => note.course));
    return courses.size;
  };

  const quickActions = [
    { 
      title: 'Find Study Partners', 
      icon: 'people', 
      screen: 'Find Partners',
      description: 'Match with peers in your courses',
      color: '#007AFF' 
    },
    { 
      title: 'Browse Notes', 
      icon: 'document-text', 
      screen: 'Notes',
      description: 'Access shared course materials',
      color: '#34C759' 
    },
    { 
      title: 'Messages', 
      icon: 'chatbubble', 
      screen: 'Chat',
      description: 'Chat with study partners',
      color: '#FF9500',
      hasNotification: totalUnreadMessages > 0,
      notificationCount: totalUnreadMessages
    },
    { 
      title: 'My Profile', 
      icon: 'person', 
      screen: 'Profile',
      description: 'Manage courses and profile',
      color: '#5856D6' 
    },
  ];

  // Generate recent activity from actual data
  const getRecentActivity = () => {
    const activities = [];
    
    // Add recent notes
    const recentNotes = userNotes.slice(0, 2);
    recentNotes.forEach(note => {
      const timeAgo = note.createdAt ? getTimeAgo(note.createdAt.toDate()) : 'Recently';
      activities.push({
        type: 'note',
        title: `${note.course} - ${note.title} uploaded`,
        time: timeAgo
      });
    });
    
    // Add recent partners
    const recentPartners = partners.slice(0, 1);
    recentPartners.forEach(partner => {
      activities.push({
        type: 'match',
        title: `New study partner: ${partner.partnerName}`,
        time: '1 day ago'
      });
    });
    
    // Add placeholder message activity if there are partners
    if (partners.length > 0) {
      activities.push({
        type: 'message',
        title: `Message from ${partners[0].partnerName}`,
        time: '2 days ago'
      });
    }
    
    return activities.slice(0, 3); // Limit to 3 activities
  };

  // Helper function to calculate time ago
  const getTimeAgo = (date) => {
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return '1 day ago';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    return date.toLocaleDateString();
  };

  // Helper function to get the first name safely from profile data
  const getFirstName = () => {
    // First try to get from loaded profile
    if (userProfile?.name && typeof userProfile.name === 'string' && userProfile.name.trim()) {
      const firstName = userProfile.name.split(' ')[0];
      return `, ${firstName}`;
    }
    
    // Fallback to auth data
    if (user?.displayName && typeof user.displayName === 'string' && user.displayName.trim()) {
      const firstName = user.displayName.split(' ')[0];
      return `, ${firstName}`;
    }
    
    return '';
  };

  const recentActivity = getRecentActivity();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Welcome back{getFirstName()}!
            </Text>
            <Text style={styles.subtitle}>Ready to study together?</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color="#007AFF" />
            <Text style={styles.statNumber}>{partners.length}</Text>
            <Text style={styles.statLabel}>Study Partners</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="document-text" size={24} color="#34C759" />
            <Text style={styles.statNumber}>{userNotes.length}</Text>
            <Text style={styles.statLabel}>Notes Shared</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="school" size={24} color="#5856D6" />
            <Text style={styles.statNumber}>{userCourseCount}</Text>
            <Text style={styles.statLabel}>Courses</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.actionCard}
                onPress={() => navigation.navigate(action.screen)}
              >
                <View style={styles.actionIconContainer}>
                  <View style={[styles.actionIcon, { backgroundColor: action.color }]}>
                    <Ionicons name={action.icon} size={24} color="#fff" />
                  </View>
                  {action.hasNotification && (
                    <View style={styles.actionNotificationBadge}>
                      <Text style={styles.actionNotificationText}>
                        {action.notificationCount > 9 ? '9+' : action.notificationCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionDescription}>{action.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Study Partners – shows only when you have ≥1 */}
        {partners.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Study Partners</Text>
            {partners.map((p) => {
              return (
                <TouchableOpacity
                  key={p.id}
                  style={styles.partnerCard}
                  onPress={() => navigation.navigate('PartnerProfile', { partner: p })}
                >
                  <Ionicons name="person-circle" size={36} color="#007AFF" />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ fontWeight: '600', fontSize: 16 }}>{p.partnerName}</Text>
                    <Text style={{ fontSize: 14, color: '#007AFF', marginTop: 2 }}>{p.course}</Text>
                    {p.partnerComputingId && (
                      <Text style={{ fontSize: 12, color: '#888', marginTop: 1 }}>
                        {p.partnerComputingId}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#ccc" />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityContainer}>
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <View key={index} style={styles.activityItem}>
                  <View style={styles.activityIcon}>
                    <Ionicons 
                      name={
                        activity.type === 'note' ? 'document-text' :
                        activity.type === 'match' ? 'people' : 'chatbubble'
                      } 
                      size={16} 
                      color="#007AFF" 
                    />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>{activity.title}</Text>
                    <Text style={styles.activityTime}>{activity.time}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyActivity}>
                <Ionicons name="time-outline" size={40} color="#999" />
                <Text style={styles.emptyText}>No recent activity</Text>
                <Text style={styles.emptySubtext}>Start by finding study partners or uploading notes!</Text>
              </View>
            )}
          </View>
        </View>

        {/* Tips Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Study Tips</Text>
          <View style={styles.tipCard}>
          <Ionicons name="bulb" size={20} color="#FF9500" />
          <Text style={styles.tipText}>{currentTip}</Text>
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  logoutButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '48%',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIconContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionNotificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  actionNotificationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  actionDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  partnerCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
  },
  activityContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  activityTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
    textAlign: 'center',
  },
  tipCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
    lineHeight: 20,
  },
});

export default HomeScreen;