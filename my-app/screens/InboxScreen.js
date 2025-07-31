import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebaseConfig';
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, getDocs, orderBy, limit, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getAcceptedPartners, isPartnerBlocked } from '../backend/partnerService';
import { getOrCreateChat, getUnreadCount } from '../backend/chatService';
import { Swipeable } from 'react-native-gesture-handler';

const InboxScreen = () => {
  const [threads, setThreads] = useState([]);
  const [partners, setPartners] = useState([]);
  const [blockedPartners, setBlockedPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState({});
  const navigation = useNavigation();

  // Add focus effect to reload data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('InboxScreen: Screen focused - reloading data...');
      if (auth.currentUser?.uid) {
        loadData();
      }
    }, [])
  );

  useEffect(() => {
    if (!auth.currentUser?.uid) {
      console.log('No authenticated user found');
      setLoading(false);
      return;
    }

    loadData();
    
    // Set up real-time listener for chats
    const chatsQuery = query(
      collection(db, 'chats'), 
      where('participants', 'array-contains', auth.currentUser.uid)
    );
    
    const unsubscribe = onSnapshot(chatsQuery, () => {
      // Reload data when chats change
      console.log('InboxScreen: Chat changes detected - reloading data...');
      loadData();
    });

    return () => unsubscribe();
  }, []);

  // Reload data when navigation focus changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('InboxScreen: Navigation focus event - reloading data...');
      if (auth.currentUser?.uid) {
        loadData();
      }
    });

    return unsubscribe;
  }, [navigation]);

  const loadData = async () => {
    try {
      console.log('InboxScreen: Loading data...');
      setLoading(true); // Set loading to true each time we reload
      
      // Load partners first and separate blocked from active
      const allPartners = await getAcceptedPartners(auth.currentUser.uid);
      
      // Check block status for each partner
      const partnerStatusPromises = allPartners.map(async (partner) => {
        const isBlocked = await isPartnerBlocked(partner.id, auth.currentUser.uid);
        return {
          ...partner,
          isBlocked
        };
      });
      
      const partnersWithStatus = await Promise.all(partnerStatusPromises);
      
      // Separate blocked and unblocked partners
      const activePartners = partnersWithStatus.filter(p => !p.isBlocked);
      const blocked = partnersWithStatus.filter(p => p.isBlocked);
      
      console.log('InboxScreen: Active partners loaded:', activePartners.length);
      console.log('InboxScreen: Blocked partners:', blocked.length);
      
      setPartners(activePartners);
      setBlockedPartners(blocked);
      
      // Load existing chats
      const chatsQuery = query(
        collection(db, 'chats'), 
        where('participants', 'array-contains', auth.currentUser.uid)
      );
      
      const chatDocs = await getDocs(chatsQuery);
      console.log('InboxScreen: Found chats:', chatDocs.docs.length);
      
      if (chatDocs.empty) {
        console.log('InboxScreen: No existing chats found');
        setThreads([]);
        setUnreadCounts({});
        setLoading(false);
        return;
      }

      // Process each chat and get unread counts (exclude blocked partners)
      const threadPromises = chatDocs.docs.map(async (chatDoc) => {
        try {
          const chatData = chatDoc.data();
          const otherUid = chatData.participants.find((id) => id !== auth.currentUser.uid);

          // Check if this partner is blocked
          const partnership = partnersWithStatus.find(p => p.partnerId === otherUid);
          
          // Skip blocked partners' chats
          if (partnership?.isBlocked) {
            console.log('InboxScreen: Skipping blocked partner chat:', otherUid);
            return null;
          }

          // Get other user's name
          const userDoc = await getDoc(doc(db, 'users', otherUid));
          const userName = userDoc.exists() ? userDoc.data().name : 'Unknown User';

          // Get last message
          const messagesQuery = query(
            collection(db, 'chats', chatDoc.id, 'messages'),
            orderBy('sentAt', 'desc'),
            limit(1)
          );
          const messagesDocs = await getDocs(messagesQuery);
          const lastMessage = messagesDocs.empty ? null : messagesDocs.docs[0].data();

          // Get unread count
          const unreadCount = await getUnreadCount(chatDoc.id, auth.currentUser.uid);

          return {
            id: chatDoc.id,
            name: userName,
            lastMessage: lastMessage?.text || 'No messages yet',
            timestamp: lastMessage?.sentAt?.toDate()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '',
            otherUid: otherUid,
            unreadCount: unreadCount,
            course: chatData.course || '',
          };
          
        } catch (error) {
          console.error('InboxScreen: Error processing chat:', chatDoc.id, error);
          return null;
        }
      });

      const threadsResults = await Promise.all(threadPromises);
      const validThreads = threadsResults.filter(thread => thread !== null);
      
      // Create unread counts object
      const newUnreadCounts = {};
      validThreads.forEach(thread => {
        newUnreadCounts[thread.id] = thread.unreadCount;
      });
      
      console.log('InboxScreen: Threads processed:', validThreads.length);
      console.log('InboxScreen: Unread counts:', newUnreadCounts);
      
      setThreads(validThreads);
      setUnreadCounts(newUnreadCounts);
      setLoading(false);
      
    } catch (error) {
      console.error('InboxScreen: Error loading data:', error);
      setLoading(false);
    }
  };

  const handleDeleteChat = async (chatId) => {
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      const deletePromises = messagesSnapshot.docs.map((msgDoc) =>
        deleteDoc(doc(db, 'chats', chatId, 'messages', msgDoc.id))
      );
      await Promise.all(deletePromises);
  
      await deleteDoc(doc(db, 'chats', chatId));
  
      setThreads(prev => prev.filter(thread => thread.id !== chatId));
      
      // Reload data to refresh everything
      await loadData();
    } catch (error) {
      console.error('InboxScreen: Error deleting chat:', error);
      Alert.alert('Error', 'Failed to delete the chat.');
    }
  };

  const handleViewBlockedPartners = () => {
    navigation.navigate('BlockedPartners', { 
      blockedPartners, 
      onPartnersUpdated: loadData 
    });
  };
  
  const startChatWithPartner = async (partner) => {
    try {
      console.log('InboxScreen: Starting chat with partner:', partner.partnerName);
      const chatId = await getOrCreateChat(auth.currentUser.uid, partner.partnerId);
      
      const thread = {
        id: chatId,
        name: partner.partnerName,
        lastMessage: 'Start your conversation!',
        timestamp: new Date().toLocaleTimeString(),
        unreadCount: 0,
      };

      navigation.navigate('ChatThread', { thread });
    } catch (error) {
      console.error('InboxScreen: Error starting chat:', error);
      Alert.alert('Error', 'Failed to start chat. Please try again.');
    }
  };

  const renderExistingThread = ({ item }) => {
    const renderRightActions = () => (
      <TouchableOpacity
        style={{ backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center', width: 60 }}
        onPress={() => confirmDelete(item.id)}
      >
        <Ionicons name="close" size={28} color="#fff" />
      </TouchableOpacity>
    );
  
    const confirmDelete = (chatId) => {
      Alert.alert(
        'Delete Chat',
        'Are you sure you want to delete this chat?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => handleDeleteChat(chatId) }
        ]
      );
    };
  
    return (
      <Swipeable renderRightActions={renderRightActions}>
        <TouchableOpacity
          style={styles.threadItem}
          onPress={() => navigation.navigate('ChatThread', { thread: item })}
          onLongPress={() => confirmDelete(item.id)}
        >
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle-outline" size={40} color="#007AFF" />
            {item.unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationText}>
                  {item.unreadCount > 9 ? '9+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.threadName, item.unreadCount > 0 && styles.unreadThreadName]}>
              {item.name}
            </Text>
            <Text style={[styles.lastMessage, item.unreadCount > 0 && styles.unreadLastMessage]}>
              {item.lastMessage}
            </Text>
          </View>
          <View style={styles.timestampContainer}>
            <Text style={styles.timestamp}>{item.timestamp}</Text>
            {item.unreadCount > 0 && <View style={styles.unreadDot} />}
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };  

  const renderPartnerItem = ({ item }) => (
    <TouchableOpacity
      style={styles.partnerItem}
      onPress={() => startChatWithPartner(item)}
    >
      <Ionicons name="person-circle" size={40} color="#34C759" style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.partnerName}>{item.partnerName}</Text>
        <Text style={styles.partnerCourse}>{item.course}</Text>
      </View>
      <View style={styles.startChatContainer}>
        <Ionicons name="chatbubble-outline" size={20} color="#34C759" />
        <Text style={styles.startChatText}>Start Chat</Text>
      </View>
    </TouchableOpacity>
  );

  // Calculate total unread messages (already excludes blocked partners)
  const totalUnreadCount = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  if (!auth.currentUser?.uid) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.noUserText}>No user signed in.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Filter partners that don't already have active chats (only active partners)
  const partnersWithoutChats = partners.filter(partner => 
    !threads.some(thread => thread.otherUid === partner.partnerId)
  );

  const hasContent = threads.length > 0 || partnersWithoutChats.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Messages</Text>
        <View style={styles.headerActions}>
          {blockedPartners.length > 0 && (
            <TouchableOpacity 
              style={styles.blockedButton} 
              onPress={handleViewBlockedPartners}
            >
              <Ionicons name="ban" size={18} color="#FF3B30" />
              <Text style={styles.blockedCount}>{blockedPartners.length}</Text>
            </TouchableOpacity>
          )}
          {totalUnreadCount > 0 && (
            <View style={styles.totalUnreadBadge}>
              <Text style={styles.totalUnreadText}>
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Blocked Partners Notice */}
      {blockedPartners.length > 0 && (
        <TouchableOpacity 
          style={styles.blockedNotice}
          onPress={handleViewBlockedPartners}
        >
          <Ionicons name="ban" size={20} color="#FF3B30" />
          <Text style={styles.blockedNoticeText}>
            {blockedPartners.length} blocked partner{blockedPartners.length > 1 ? 's' : ''} (tap to manage)
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#FF3B30" />
        </TouchableOpacity>
      )}
      
      {!hasContent ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#999" />
          <Text style={styles.emptyTitle}>No Conversations Yet</Text>
          <Text style={styles.emptySubtitle}>
            Find study partners and start chatting with them!
          </Text>
          <TouchableOpacity 
            style={styles.findPartnersButton}
            onPress={() => navigation.navigate('Find Partners')}
          >
            <Text style={styles.findPartnersButtonText}>Find Study Partners</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Existing Conversations */}
          {threads.length > 0 && (
            <View>
              <Text style={styles.sectionTitle}>Recent Conversations</Text>
              <FlatList
                data={threads}
                keyExtractor={(item) => `thread-${item.id}`}
                renderItem={renderExistingThread}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
              />
            </View>
          )}
          
          {/* Available Partners (only active ones) */}
          {partnersWithoutChats.length > 0 && (
            <View>
              <Text style={styles.sectionTitle}>Start New Conversation</Text>
              <FlatList
                data={partnersWithoutChats}
                keyExtractor={(item) => `partner-${item.id}`}
                renderItem={renderPartnerItem}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
              />
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  blockedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  blockedCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF3B30',
  },
  totalUnreadBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  totalUnreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  blockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    marginHorizontal: 20,
    marginBottom: 15,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
  },
  threadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
  },
  avatarContainer: {
    position: 'relative',
  },
  notificationBadge: {
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
  notificationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  threadName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  unreadThreadName: {
    fontWeight: 'bold',
    color: '#000',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  unreadLastMessage: {
    fontWeight: '600',
    color: '#333',
  },
  timestampContainer: {
    alignItems: 'flex-end',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    marginTop: 4,
  },
  partnerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#f8f9fa',
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  partnerCourse: {
    fontSize: 14,
    color: '#34C759',
    marginTop: 2,
  },
  startChatContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  startChatText: {
    fontSize: 12,
    color: '#34C759',
    marginLeft: 4,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  findPartnersButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  findPartnersButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noUserText: {
    fontSize: 16,
    color: '#999',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
});

export default InboxScreen;