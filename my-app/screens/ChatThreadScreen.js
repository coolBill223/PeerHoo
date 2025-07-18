import React, { useEffect, useState, useRef } from 'react';
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
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';

const ChatThreadScreen = ({ route, navigation }) => {
  const { thread } = route.params;
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const flatListRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'chats', thread.id, 'messages'), orderBy('sentAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          text: d.text,
          sender: d.senderId === auth.currentUser.uid ? 'user' : 'other',
          timestamp: d.sentAt?.toDate() ?? new Date(),
        };
      });
      setMessages(list);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => unsubscribe();
  }, [thread.id]);

  const handleSend = async () => {
    if (!message.trim()) return;
    await addDoc(collection(db, 'chats', thread.id, 'messages'), {
      senderId: auth.currentUser.uid,
      text: message,
      sentAt: serverTimestamp(),
    });
    setMessage('');
  };

  const renderMessage = ({ item }) => (
    <View
      style={{
        alignSelf: item.sender === 'user' ? 'flex-end' : 'flex-start',
        backgroundColor: item.sender === 'user' ? '#007AFF' : '#ccc',
        borderRadius: 16,
        marginVertical: 4,
        marginHorizontal: 10,
        padding: 10,
        maxWidth: '75%',
      }}
    >
      <Text style={{ color: '#fff', fontSize: 16 }}>{item.text}</Text>
      <Text style={{ fontSize: 10, color: '#eee', marginTop: 4, textAlign: 'right' }}>
        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }}>
          {/* FIXED: Use navigation.goBack() instead of navigate('Inbox') */}
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '600', marginLeft: 10 }}>{thread.name}</Text>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingBottom: 80 }}
        />

        <View style={{ flexDirection: 'row', padding: 10, backgroundColor: '#fff' }}>
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
          <TouchableOpacity onPress={handleSend} style={{ backgroundColor: '#007AFF', padding: 10, borderRadius: 20 }}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ChatThreadScreen;