import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebaseConfig';
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { getAcceptedPartners } from '../backend/partnerService';
import { getOrCreateChat } from '../backend/chatService';

const InboxScreen = () => {
  const [threads, setThreads] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    if (!auth.currentUser?.uid) {
      console.log('No authenticated user found');
      setLoading(false);
      return;
    }

    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('Loading data...');
      
      // Load partners first
      const partnersData = await getAcceptedPartners(auth.currentUser.uid);
      console.log('Partners loaded:', partnersData.length);
      setPartners(partnersData);
      
      // Load existing chats
      const chatsQuery = query(
        collection(db, 'chats'), 
        where('participants', 'array-contains', auth.currentUser.uid)
      );
      
      const chatDocs = await getDocs(chatsQuery);
      console.log('Found chats:', chatDocs.docs.length);
      
      if (chatDocs.empty) {
        console.log('No existing chats found');
        setThreads([]);
        setLoading(false);
        return;
      }

      // Process each chat
      const threadPromises = chatDocs.docs.map(async (chatDoc) => {
        try {
          const chatData = chatDoc.data();
          const otherUid = chatData.participants.find((id) => id !== auth.currentUser.uid);

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

          return {
            id: chatDoc.id,
            name: userName,
            lastMessage: lastMessage?.text || 'No messages yet',
            timestamp: lastMessage?.sentAt?.toDate()?.toLocaleTimeString() || '',
            otherUid: otherUid,
          };
        } catch (error) {
          console.error('Error processing chat:', chatDoc.id, error);
          return null;
        }
      });

      const threadsResults = await Promise.all(threadPromises);
      const validThreads = threadsResults.filter(thread => thread !== null);
      
      console.log('Threads processed:', validThreads.length);
      setThreads(validThreads);
      setLoading(false);
      
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const startChatWithPartner = async (partner) => {
    try {
      console.log('Starting chat with partner:', partner.partnerName);
      const chatId = await getOrCreateChat(auth.currentUser.uid, partner.partnerId);
      
      const thread = {
        id: chatId,
        name: partner.partnerName,
        lastMessage: 'Start your conversation!',
        timestamp: new Date().toLocaleTimeString(),
      };

      navigation.navigate('ChatThread', { thread });
    } catch (error) {
      console.error('Error starting chat:', error);
      Alert.alert('Error', 'Failed to start chat. Please try again.');
    }
  };

  const renderExistingThread = ({ item }) => (
    <TouchableOpacity
      style={styles.threadItem}
      onPress={() => navigation.navigate('ChatThread', { thread: item })}
    >
      <Ionicons name="person-circle-outline" size={40} color="#007AFF" style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.threadName}>{item.name}</Text>
        <Text style={styles.lastMessage}>{item.lastMessage}</Text>
      </View>
      <Text style={styles.timestamp}>{item.timestamp}</Text>
    </TouchableOpacity>
  );

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

  // Filter partners that don't already have active chats
  const partnersWithoutChats = partners.filter(partner => 
    !threads.some(thread => thread.otherUid === partner.partnerId)
  );

  const hasContent = threads.length > 0 || partnersWithoutChats.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Messages</Text>
      
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
          
          {/* Available Partners */}
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    margin: 20,
    color: '#333',
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
  threadName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
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