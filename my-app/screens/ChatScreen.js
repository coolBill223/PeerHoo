// The purpose of this file: This is the stack container for the chat feature,

// imports 
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import InboxScreen from './InboxScreen'; // Inbox screen showing all chat threads
import ChatThreadScreen from './ChatThreadScreen'; // Individual chat conversation screen

const Stack = createNativeStackNavigator();

const ChatScreen = () => {
  return (
    <Stack.Navigator>
      {/* This is the Inbox screen - main chat list view */}
      <Stack.Screen
        name="Inbox"
        component={InboxScreen}
        options={{ headerShown: false }} 
      />
      {/* This is the individual chat thread screen */}
      <Stack.Screen
        name="ChatThread"
        component={ChatThreadScreen}
        options={({ route }) => ({ 
          title: route.params?.thread?.name ?? 'Chat' 
        })}
      />
    </Stack.Navigator>
  );
};

export default ChatScreen;