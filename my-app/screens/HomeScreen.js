// The purpose of this file: This is the ui and functionality for the home screen

// Imports

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { getAcceptedPartners, isPartnerBlocked } from '../backend/partnerService';
import { ensureUserDocument } from '../backend/userService';
import { getNotesByUser } from '../backend/noteService';
import { getUserInfo } from '../backend/userService';
import { getMyMatchRequests } from '../backend/matchService';
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { getUnreadCount } from '../backend/chatService';

// this is the tip bank
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
  const [blockedPartners, setBlockedPartners] = useState([]);
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);
  const [userNotes, setUserNotes] = useState([]);
  const [userCourseCount, setUserCourseCount] = useState(0);
  const [currentTip, setCurrentTip] = useState('');
  const [recentMessages, setRecentMessages] = useState([]);
  const [partnersWithTimestamps, setPartnersWithTimestamps] = useState([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const intervalRef = useRef(null);
  const authUnsubscribeRef = useRef(null);
  const isMountedRef = useRef(true);

  // Track component mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!isMountedRef.current) return;
      
      if (currentUser && !isLoggingOut) {
        setUser(currentUser);
        initializeUserData(currentUser);
      } else if (!currentUser) {
        // User is signed out, clear all data
        clearAllData();
      }
    });

    authUnsubscribeRef.current = unsubscribe;
    return () => {
      if (authUnsubscribeRef.current) {
        authUnsubscribeRef.current();
      }
    };
  }, [isLoggingOut]);

  // Clear all data when user logs out
  const clearAllData = () => {
    if (!isMountedRef.current) return;
    
    setUser(null);
    setUserProfile(null);
    setPartners([]);
    setBlockedPartners([]);
    setTotalUnreadMessages(0);
    setUserNotes([]);
    setUserCourseCount(0);
    setRecentMessages([]);
    setPartnersWithTimestamps([]);
    
    // Clear any intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Initialize user data
  const initializeUserData = async (currentUser) => {
    if (!currentUser || !isMountedRef.current || isLoggingOut) return;

    try {
      // Ensure user document exists
      await ensureUserDocument();
      
      // Load profile data
      await loadUserProfile(currentUser.uid);
      
      // Fetch all data
      await loadPartnersData(currentUser.uid);
      await loadUserNotes(currentUser.uid);
      await loadUserCourseCount(currentUser.uid);
      
      // Set random tip
      const randomTip = tipBank[Math.floor(Math.random() * tipBank.length)];
      if (isMountedRef.current) {
        setCurrentTip(randomTip);
      }
    } catch (error) {
      console.error('Error initializing user data:', error);
    }
  };

  // Set up interval to refresh messages periodically
  useEffect(() => {
    if (user?.uid && !isLoggingOut) {
      // Load messages immediately
      loadRecentMessages(user.uid);
      
      // Set up interval to reload messages every 10 seconds
      intervalRef.current = setInterval(() => {
        if (user?.uid && !isLoggingOut && isMountedRef.current) {
          loadRecentMessages(user.uid);
        }
      }, 10000); // 10 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user?.uid, partners.length, isLoggingOut]);

  // Load recent messages for activity timeline
  const loadRecentMessages = async (uid) => {
    if (!uid || isLoggingOut || !isMountedRef.current) return;

    try {
      // Get all chats where user is a participant
      const chatsQuery = query(
        collection(db, 'chats'), 
        where('participants', 'array-contains', uid)
      );
      
      const chatDocs = await getDocs(chatsQuery);
      
      if (!isMountedRef.current || isLoggingOut) return;
      
      const messages = [];
      const blockedPartnerIds = new Set(blockedPartners.map(p => p.partnerId || p.id));

      // Get recent messages from each chat
      for (const chatDoc of chatDocs.docs) {
        if (!isMountedRef.current || isLoggingOut) return;
        
        const chatData = chatDoc.data();
        const otherUserId = chatData.participants.find(id => id !== uid);
        
        // Skip blocked partners
        if (blockedPartnerIds.has(otherUserId)) {
          continue;
        }
        
        // Get the partner name
        let partnerName = 'Study Partner';
        const partner = partners.find(p => 
          p.partnerId === otherUserId || 
          p.id === otherUserId ||
          p.partnerUserId === otherUserId
        );
        
        if (partner) {
          partnerName = partner.partnerName || partner.name || 'Study Partner';
        } else {
          // This is just a fall back that we inserted later in the process
          try {
            const userInfo = await getUserInfo(otherUserId);
            partnerName = userInfo?.name || `Partner ${otherUserId.slice(0, 6)}`;
          } catch (error) {
            partnerName = `Partner ${otherUserId.slice(0, 6)}`;
          }
        }

        // Get recent messages from this chat (last 5 messages to ensure we catch recent ones)
        const messagesQuery = query(
          collection(db, 'chats', chatDoc.id, 'messages'),
          orderBy('sentAt', 'desc'), 
        );
        
        const messageDocs = await getDocs(messagesQuery);
        
        if (!isMountedRef.current || isLoggingOut) return;
        
        // Add each recent message, but only messages from others
        messageDocs.docs.forEach(messageDoc => {
          const messageData = messageDoc.data();
          const isFromOther = messageData.senderId !== uid;
          
          // Only add messages from other users (not our own messages) and exclude system messages
          if (isFromOther && messageData.sentAt && messageData.senderId !== 'system') {
            messages.push({
              type: 'message',
              title: `Message from ${partnerName}`,
              timestamp: messageData.sentAt, 
              chatId: chatDoc.id,
              partnerName,
              senderId: messageData.senderId,
              isFromOther: true,
              messageText: messageData.text || 'New message'
            });
          }
        });
      }

      if (!isMountedRef.current || isLoggingOut) return;

      // Sort messages by timestamp and we will do most recent first
      messages.sort((a, b) => {
        if (!a.timestamp || !b.timestamp) return 0;
        return b.timestamp.toDate() - a.timestamp.toDate();
      });

      // Keep only the 3 most recent messages from others
      const recentMessagesFromOthers = messages.slice(0, 3);
      
      if (isMountedRef.current && !isLoggingOut) {
        setRecentMessages(recentMessagesFromOthers);
      }
    } catch (error) {
      console.error('Error loading recent messages:', error);
      if (isMountedRef.current && !isLoggingOut) {
        setRecentMessages([]);
      }
    }
  };

  // here we are loading partners and then filter out blocked ones
  const loadPartnersData = async (uid) => {
    if (!uid || isLoggingOut || !isMountedRef.current) return;

    try {
      const allPartners = await getAcceptedPartners(uid);
      
      if (!isMountedRef.current || isLoggingOut) return;
      
      // Check blocked status for each partner AND get current user info
      const partnerStatusPromises = allPartners.map(async (partner) => {
        if (!isMountedRef.current || isLoggingOut) return null;
        
        const isBlocked = await isPartnerBlocked(partner.id, uid);
        
        // Fetch current user information to get updated name
        let currentUserInfo = null;
        try {
          currentUserInfo = await getUserInfo(partner.partnerId || partner.id);
        } catch (error) {
          // dont do anythign hereif there is a error
        }
        
        return {
          ...partner,
          isBlocked,
          partnerName: currentUserInfo?.name || partner.partnerName || partner.name || 'Study Partner',
          partnerComputingId: currentUserInfo?.computingId || partner.partnerComputingId || partner.computingId,
          currentUserInfo
        };
      });
      
      const partnersWithStatus = await Promise.all(partnerStatusPromises);
      const validPartners = partnersWithStatus.filter(p => p !== null);
      
      if (!isMountedRef.current || isLoggingOut) return;
      
      const activePartners = validPartners.filter(p => !p.isBlocked);
      const blocked = validPartners.filter(p => p.isBlocked);
      
      setPartners(activePartners);
      setBlockedPartners(blocked);

      // Getting timestamps
      await loadPartnershipTimestamps(uid, activePartners);
      
      // Now I will load unread messages
      await loadUnreadMessageCount(uid, activePartners, blocked);
      
      // Load recent messages after partners are loaded
      await loadRecentMessages(uid);
      
    } catch (error) {
      console.error('Error loading partners data:', error);
      if (isMountedRef.current && !isLoggingOut) {
        setPartners([]);
        setBlockedPartners([]);
        setTotalUnreadMessages(0);
      }
    }
  };

  // here we are loading partnership timestamps from match requests
  const loadPartnershipTimestamps = async (uid, activePartners) => {
    if (!uid || isLoggingOut || !isMountedRef.current) return;

    try {
      const matchRequests = await getMyMatchRequests(uid);
      
      if (!isMountedRef.current || isLoggingOut) return;
      
      const partnersWithTime = activePartners.map(partner => {
        // here we are looking for the right match request
        const matchRequest = matchRequests.find(req => 
          (req.senderId === uid && req.receiverId === partner.partnerId) ||
          (req.receiverId === uid && req.senderId === partner.partnerId)
        );
        
        return {
          ...partner,
          matchTimestamp: matchRequest?.createdAt || null
        };
      });

      if (isMountedRef.current && !isLoggingOut) {
        setPartnersWithTimestamps(partnersWithTime);
      }
    } catch (error) {
      console.error('Error loading partnership timestamps:', error);
      if (isMountedRef.current && !isLoggingOut) {
        setPartnersWithTimestamps(activePartners);
      }
    }
  };

  // This is for loading the user course counts
  const loadUserCourseCount = async (uid) => {
    if (!uid || isLoggingOut || !isMountedRef.current) return;

    try {
      const matchRequests = await getMyMatchRequests(uid);
      
      if (!isMountedRef.current || isLoggingOut) return;
      
      const userCourses = matchRequests
        .filter((m) => m.senderId === uid)
        .map((m) => m.course);
      
      const uniqueCourses = [...new Set(userCourses)];
      
      if (isMountedRef.current && !isLoggingOut) {
        setUserCourseCount(uniqueCourses.length);
      }
    } catch (error) {
      console.error('Error loading user course count:', error);
      if (isMountedRef.current && !isLoggingOut) {
        setUserCourseCount(0);
      }
    }
  };

  // This is for loading user profile data
  const loadUserProfile = async (uid) => {
    if (!uid || isLoggingOut || !isMountedRef.current) return;

    try {
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!isMountedRef.current || isLoggingOut) return;
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserProfile(userData);
      } else {
        const current = auth.currentUser;
        if (current && !isLoggingOut) {
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

  const loadUserNotes = async (uid) => {
    if (!uid || isLoggingOut || !isMountedRef.current) return;

    try {
      const notes = await getNotesByUser(uid);
      
      if (!isMountedRef.current || isLoggingOut) return;
      
      const notesWithAuthors = await Promise.all(
        notes.map(async (note) => {
          if (!isMountedRef.current || isLoggingOut) return null;
          
          try {
            const authorInfo = await getUserInfo(note.authorId);
            return {
              ...note,
              authorName: authorInfo?.name || 'You',
              authorComputingId: authorInfo?.computingId || note.authorId.slice(0, 8)
            };
          } catch (error) {
            return {
              ...note,
              authorName: 'You',
              authorComputingId: note.authorId.slice(0, 8)
            };
          }
        })
      );
      
      const validNotes = notesWithAuthors.filter(note => note !== null);
      
      if (isMountedRef.current && !isLoggingOut) {
        setUserNotes(validNotes);
      }
    } catch (error) {
      console.error('Error loading user notes:', error);
      if (isMountedRef.current && !isLoggingOut) {
        setUserNotes([]);
      }
    }
  };

  // this is for loading total unread message count but not from blocked partners
  const loadUnreadMessageCount = async (userId, activePartners = partners, blockedPartners = []) => {
    if (!userId || isLoggingOut || !isMountedRef.current) return;

    try {
      // getting all chats
      const chatsQuery = query(
        collection(db, 'chats'), 
        where('participants', 'array-contains', userId)
      );
      
      const chatDocs = await getDocs(chatsQuery);
      
      if (!isMountedRef.current || isLoggingOut) return;
      
      if (chatDocs.empty) {
        if (isMountedRef.current && !isLoggingOut) {
          setTotalUnreadMessages(0);
        }
        return;
      }
      // these are ids for faster look ups
      const blockedPartnerIds = new Set(blockedPartners.map(p => p.partnerId));

      // Geting unread count for each chat
      const unreadPromises = chatDocs.docs.map(async (chatDoc) => {
        if (!isMountedRef.current || isLoggingOut) return 0;
        
        const chatData = chatDoc.data();
        const otherUserId = chatData.participants.find(id => id !== userId);
        
        if (blockedPartnerIds.has(otherUserId)) {
          return 0;
        }
        
        return await getUnreadCount(chatDoc.id, userId);
      });
      
      const unreadCounts = await Promise.all(unreadPromises);
      
      if (!isMountedRef.current || isLoggingOut) return;
      
      const totalUnread = unreadCounts.reduce((sum, count) => sum + count, 0);
      
      setTotalUnreadMessages(totalUnread);
    } catch (error) {
      console.error('Error loading unread message count:', error);
      if (isMountedRef.current && !isLoggingOut) {
        setTotalUnreadMessages(0);
      }
    }
  };

  // this is to reload partners after updating
  const reloadPartners = async () => {
    const current = auth.currentUser;
    if (current && !isLoggingOut && isMountedRef.current) {
      try {
        await loadPartnersData(current.uid);
        
        // Reloading
        await loadUserNotes(current.uid);
        await loadUserCourseCount(current.uid);
      } catch (error) {
        console.error('Error reloading data:', error);
      }
    }
  };

  // Reloading user profile, unread count, and notes when screen comes 
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (auth.currentUser?.uid && !isLoggingOut && isMountedRef.current) {
        loadUserProfile(auth.currentUser.uid);
        loadPartnersData(auth.currentUser.uid);
        loadUserNotes(auth.currentUser.uid);
        loadUserCourseCount(auth.currentUser.uid);
      }
    });

    return unsubscribe;
  }, [navigation, isLoggingOut]);

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
              setIsLoggingOut(true);
              
              // Clearing interval immediately
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              
              // Also we have clear all data before signing out
              clearAllData();
              
              // Sign out
              await signOut(auth);
              
            } catch (error) {
              console.error('Logout error:', error);
              setIsLoggingOut(false);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          }
        },
      ]
    );
  };

  const handleViewBlockedPartners = () => {
    navigation.navigate('BlockedPartners', { 
      blockedPartners, 
      onPartnersUpdated: reloadPartners 
    });
  };

  // here I will be getting recent activity from actual data with real timestamps
  const getRecentActivity = () => {
    const activities = [];
    
    // Add recent notes with real timestamps
    const recentNotes = userNotes
      .filter(note => note.createdAt) // Only notes with timestamps
      .sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate()) // Sort by newest first
      .slice(0, 2); // Take only 2 most recent
    
    recentNotes.forEach(note => {
      const timeAgo = getTimeAgo(note.createdAt.toDate());
      activities.push({
        type: 'note',
        title: `${note.course} - ${note.title} uploaded`,
        time: timeAgo,
        timestamp: note.createdAt.toDate()
      });
    });
    
    const recentPartners = partnersWithTimestamps
      .filter(partner => partner.matchTimestamp) // Only partners with timestamps
      .sort((a, b) => b.matchTimestamp.toDate() - a.matchTimestamp.toDate()) // Sort by newest first
      .slice(0, 1); // Take only 1 most recent
    
    recentPartners.forEach(partner => {
      const timeAgo = getTimeAgo(partner.matchTimestamp.toDate());
      activities.push({
        type: 'match',
        title: `New study partner: ${partner.partnerName}`,
        time: timeAgo,
        timestamp: partner.matchTimestamp.toDate()
      });
    });
    
    recentMessages.forEach(message => {
      if (message.timestamp) {
        const timeAgo = getTimeAgo(message.timestamp.toDate());
        activities.push({
          type: 'message',
          title: message.title,
          time: timeAgo,
          timestamp: message.timestamp.toDate()
        });
      }
    });
    
    // We will sort all activities by timestamp (newest first) and take top 3
    const sortedActivities = activities
      .filter(activity => activity.timestamp) // Only activities with timestamps
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 3);
    
    return sortedActivities;
  };

  // get time 
  const getTimeAgo = (date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return '1 day ago';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks === 1) return '1 week ago';
    if (diffInWeeks < 4) return `${diffInWeeks} weeks ago`;
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths === 1) return '1 month ago';
    if (diffInMonths < 12) return `${diffInMonths} months ago`;
    
    return date.toLocaleDateString();
  };

  // this is to get the first name
  const getFirstName = () => {
    if (userProfile?.name && typeof userProfile.name === 'string' && userProfile.name.trim()) {
      const firstName = userProfile.name.split(' ')[0];
      return `, ${firstName}`;
    }
    
    if (user?.displayName && typeof user.displayName === 'string' && user.displayName.trim()) {
      const firstName = user.displayName.split(' ')[0];
      return `, ${firstName}`;
    }
    
    return '';
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

  const recentActivity = getRecentActivity();

  // Don't render if logging out
  if (isLoggingOut) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Logging out...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>

        {/* There are the stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color="#007AFF" />
            <Text style={styles.statNumber}>{partners.length}</Text>
            <Text style={styles.statLabel}>Active Partners</Text>
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

        {/* These are the blocked partners notice */}
        {blockedPartners.length > 0 && (
          <TouchableOpacity 
            style={styles.blockedNotice}
            onPress={handleViewBlockedPartners}
          >
            <Ionicons name="ban" size={20} color="#FF3B30" />
            <Text style={styles.blockedNoticeText}>
              {blockedPartners.length} blocked partner{blockedPartners.length > 1 ? 's' : ''}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#FF3B30" />
          </TouchableOpacity>
        )}

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
        
        {/* Study Partners */}
        {partners.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Study Partners</Text>
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

        {/* Finally, Tips Section */}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoutButton: {
    padding: 8,
  },
  blockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    marginHorizontal: 20,
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  blockedNoticeText: {
    flex: 1,
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '500',
    marginLeft: 8,
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
// end of styles
export default HomeScreen;