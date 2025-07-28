// The purpose of this file: This is for the individual chat conversation screen that displays messages

// Imports
import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { markChatAsRead } from '../backend/chatService';
import { getPartnersForCourseWithNames } from '../backend/partnerService';

const ChatThreadScreen = ({ route, navigation }) => {
  const { thread } = route.params;
  
  // This is state management
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const flatListRef = useRef(null);

  // Set up custom header with back button if coming from partner profile
  useLayoutEffect(() => {
    if (thread?.canGoBackToProfile && thread?.partnerData) {
      navigation.setOptions({
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => {
              // Go back to the previous screen instead of creating a new one
              navigation.goBack();
            }}
            style={{ 
              marginLeft: 10, 
              padding: 8,
              flexDirection: 'row',
              alignItems: 'center'
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
        ),
        headerTitle: thread.name || 'Chat',
      });
    }
  }, [navigation, thread]);

  // this is a real time listener
  useEffect(() => {
    // messages by timestamp
    const q = query(collection(db, 'chats', thread.id, 'messages'), orderBy('sentAt', 'asc'));
    
    // listening for real time updates
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          text: d.text,
          sender: d.senderId === auth.currentUser.uid ? 'user' : 'other',
          senderId: d.senderId,
          timestamp: d.sentAt?.toDate() ?? new Date(),
        };
      });
      setMessages(list);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => unsubscribe();
  }, [thread.id]);

  // This is marking chat as read
  useEffect(() => {
    const markAsRead = async () => {
      await markChatAsRead(thread.id, auth.currentUser.uid);
    };
    
    markAsRead();

    const unsubscribe = navigation.addListener('focus', () => {
      markAsRead();
    });

    return unsubscribe;
  }, [thread.id, navigation]);

  // mark as read if new messages arrive and the screen is active
  useEffect(() => {
    const markAsRead = async () => {
      if (messages.length > 0) {
        await markChatAsRead(thread.id, auth.currentUser.uid);
      }
    };
    
    // a small delay for processing
    const timeoutId = setTimeout(markAsRead, 500);
    return () => clearTimeout(timeoutId);
  }, [messages.length, thread.id]);

  const handleSend = async () => {
    if (!message.trim()) return;
    
    // Adding this message to Firestore collection
    await addDoc(collection(db, 'chats', thread.id, 'messages'), {
      senderId: auth.currentUser.uid,
      text: message,
      sentAt: serverTimestamp(),
    });
    
    // clear
    setMessage('');
  };

  // rendering individual texts
  const renderMessage = ({ item }) => (
    <View
      style={{
        alignSelf: item.sender === 'user' ? 'flex-end' : 'flex-start',
        backgroundColor: item.senderId === 'system' ? '#f0f0f0' :
                        item.sender === 'user' ? '#007AFF' : '#e5e5ea',
        borderRadius: 16,
        marginVertical: 4,
        marginHorizontal: 10,
        padding: 10,
        maxWidth: '75%',
      }}
    >
      <Text style={{
        color: item.senderId === 'system' ? '#666' :
               item.sender === 'user' ? '#fff' : '#000',
        fontSize: 16,
        fontStyle: item.senderId === 'system' ? 'italic' : 'normal',
      }}>
        {item.text}
      </Text>
      {item.senderId !== 'system' && (
        <Text style={{
          fontSize: 10,
          color: item.sender === 'user' ? '#eee' : '#666',
          marginTop: 4,
          textAlign: 'right',
        }}>
          {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={{ flex: 1 }}>
          {/* Messages list */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
  
          <View style={{
            flexDirection: 'row',
            padding: 10,
            backgroundColor: '#fff',
            alignItems: 'flex-end',
          }}>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Type a message..."
              style={{
                flex: 1,
                backgroundColor: '#f1f1f1',
                borderRadius: 20,
                paddingHorizontal: 15,
                paddingVertical: 10,
                fontSize: 16,
                marginRight: 10,
              }}
            />
            {/* This is the send button */}
            <TouchableOpacity
              onPress={handleSend}
              style={{ backgroundColor: '#007AFF', padding: 10, borderRadius: 20 }}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );  
};

export default ChatThreadScreen;