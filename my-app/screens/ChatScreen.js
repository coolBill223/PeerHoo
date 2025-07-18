import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import InboxScreen from './InboxScreen'; // from inbox screen
import ChatThreadScreen from './ChatThreadScreen'; // chat thread

const Stack = createNativeStackNavigator();

const ChatScreen = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Inbox"
        component={InboxScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ChatThread"
        component={ChatThreadScreen}
        options={({ route }) => ({ title: route.params?.thread?.name ?? 'Chat' })}
      />
    </Stack.Navigator>
  );
};

export default ChatScreen;
