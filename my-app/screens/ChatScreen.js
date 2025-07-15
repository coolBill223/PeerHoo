import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const mockThreads = [ //Will be pulled from Firestore later
  { id: '1', name: 'John Smith', lastMessage: 'Did you go to class today?', timestamp: '2h ago' },
  { id: '2', name: 'Paige Turner', lastMessage: 'The study group is on Clem 4', timestamp: '1d ago' },
];

const ChatScreen = ({ navigation }) => {
  const [currentThread, setCurrentThread] = useState(null); // null = inbox view
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);

  const openThread = (thread) => {
    //Load messages from Firebase for this thread
    setCurrentThread(thread);
    setMessages([
      { id: 'a1', text: 'Hey there!', sender: 'other', timestamp: new Date() },
      { id: 'a2', text: 'Ready to study?', sender: 'user', timestamp: new Date() },
    ]);
  };

  const handleSend = () => {
    if (message.trim().length === 0) return;

    const newMessage = {
      id: Date.now().toString(),
      text: message,
      sender: 'user',
      timestamp: new Date(),
    };

    // 🚧 Later: Send to Firestore here
    setMessages((prev) => [...prev, newMessage]);
    setMessage('');
  };

  const renderInboxItem = ({ item }) => (
    <TouchableOpacity style={styles.threadCard} onPress={() => openThread(item)}>
      <Ionicons name="person-circle-outline" size={40} color="#007AFF" style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.threadName}>{item.name}</Text>
        <Text style={styles.threadMessage}>{item.lastMessage}</Text>
      </View>
      <Text style={styles.threadTime}>{item.timestamp}</Text>
    </TouchableOpacity>
  );

  const renderMessage = ({ item }) => (
    <View
      style={[
        styles.messageBubble,
        item.sender === 'user' ? styles.bubbleRight : styles.bubbleLeft,
      ]}
    >
      <Text style={styles.messageText}>{item.text}</Text>
      <Text style={styles.timestamp}>
        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Header */}
        <View style={styles.header}>
          {currentThread ? (
            <TouchableOpacity onPress={() => setCurrentThread(null)} style={{ marginRight: 10 }}>
              <Ionicons name="chevron-back" size={24} color="#007AFF" />
            </TouchableOpacity>
          ) : null}
          <Text style={styles.title}>
            {currentThread ? currentThread.name : 'Messages'}
          </Text>
        </View>

        {/* Inbox View */}
        {!currentThread && (
          <FlatList
            data={mockThreads}
            keyExtractor={(item) => item.id}
            renderItem={renderInboxItem}
            contentContainerStyle={styles.messagesContainer}
          />
        )}

        {/* Conversation View */}
        {currentThread && (
          <>
            <FlatList
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesContainer}
            />

            {/* Input */}
            <View style={styles.inputContainer}>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Type a message..."
                style={styles.textInput}
              />
              <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
                <Ionicons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  messagesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  threadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  threadName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  threadMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  threadTime: {
    fontSize: 12,
    color: '#999',
    marginLeft: 10,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  bubbleLeft: {
    backgroundColor: '#e0e0e0',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 0,
  },
  bubbleRight: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 0,
  },
  messageText: {
    fontSize: 16,
    color: '#fff',
  },
  timestamp: {
    fontSize: 10,
    color: '#d0d0d0',
    marginTop: 4,
    textAlign: 'right',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f1f1f1',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    fontSize: 16,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 20,
  },
});

export default ChatScreen;