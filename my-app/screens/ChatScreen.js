import React, { useRef, useState, useEffect } from 'react';
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
  TouchableWithoutFeedback,
  Keyboard,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const mockThreads = [
  {
    id: '1',
    name: 'John Smith',
    lastMessage: 'Yeah, I’ll be there at 2.',
    timestamp: '2h ago',
    messages: [
      { id: 'a1', text: 'Hey, are you going to class today?', sender: 'other', timestamp: new Date() },
      { id: 'a2', text: 'Yeah, I’ll be there at 2.', sender: 'user', timestamp: new Date() },
    ],
  },
  {
    id: '2',
    name: 'Paige Turner',
    lastMessage: 'Clem 4! Grab a table near the windows.',
    timestamp: '1d ago',
    messages: [
      { id: 'b1', text: 'Where’s the study group today?', sender: 'user', timestamp: new Date() },
      { id: 'b2', text: 'Clem 4! Grab a table near the windows.', sender: 'other', timestamp: new Date() },
    ],
  },
];

const ChatScreen = ({ navigation }) => {
  const [currentThread, setCurrentThread] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const flatListRef = useRef(null);

  // Swipe-to-go-back gesture
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dx > 25 && Math.abs(gestureState.dy) < 20,
      onPanResponderEnd: (_, gestureState) => {
        if (gestureState.dx > 50) setCurrentThread(null);
      },
    })
  ).current;

  const openThread = (thread) => {
    setCurrentThread(thread);
    setMessages(thread.messages);
  };

  const handleSend = () => {
    if (message.trim().length === 0) return;

    const newMessage = {
      id: Date.now().toString(),
      text: message,
      sender: 'user',
      timestamp: new Date(),
    };

    const updated = [...messages, newMessage];
    setMessages(updated);
    setMessage('');

    // Scroll to bottom (last message)
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // TODO: Push new message to Firebase
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
        keyboardVerticalOffset={0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.flex} {...(currentThread ? panResponder.panHandlers : {})}>
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

            {/* Inbox */}
            {!currentThread && (
              <FlatList
                data={mockThreads}
                keyExtractor={(item) => item.id}
                renderItem={renderInboxItem}
                contentContainerStyle={styles.messagesContainer}
                keyboardShouldPersistTaps="handled"
              />
            )}

            {/* Conversation */}
            {currentThread && (
              <>
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  renderItem={renderMessage}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={[styles.messagesContainer, { flexGrow: 1 }]}
                  keyboardShouldPersistTaps="handled"
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
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  messagesContainer: { paddingHorizontal: 20, paddingBottom: 20 },
  threadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  threadName: { fontSize: 16, fontWeight: '600', color: '#333' },
  threadMessage: { fontSize: 14, color: '#666', marginTop: 2 },
  threadTime: { fontSize: 12, color: '#999', marginLeft: 10 },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  bubbleLeft: {
    backgroundColor: '#b3afaf',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 0,
  },
  bubbleRight: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 0,
  },
  messageText: { fontSize: 16, color: '#fff' },
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