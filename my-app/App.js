import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getUnreadCount } from './backend/chatService';
import { View, Text } from 'react-native';
import 'react-native-gesture-handler';

// Import screens
import WelcomeScreen from './screens/WelcomeScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import HomeScreen from './screens/HomeScreen';
import MatchingScreen from './screens/MatchingScreen';
import ChatScreen from './screens/ChatScreen';
import NotesScreen from './screens/NotesScreen';
import ProfileScreen from './screens/ProfileScreen';
import PartnerProfileScreen from './screens/PartnerProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Custom tab bar icon component with notification badge
const TabBarIcon = ({ name, focused, color, size, hasNotification, notificationCount }) => {
  const iconName = focused ? name : `${name}-outline`;
  
  return (
    <View style={{ position: 'relative' }}>
      <Ionicons name={iconName} size={size} color={color} />
      {hasNotification && notificationCount > 0 && (
        <View style={{
          position: 'absolute',
          top: -2,
          right: -6,
          backgroundColor: '#FF3B30',
          borderRadius: 8,
          minWidth: 16,
          height: 16,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 4,
          borderWidth: 2,
          borderColor: '#fff',
        }}>
          <Text style={{
            color: '#fff',
            fontSize: 10,
            fontWeight: 'bold',
          }}>
            {notificationCount > 9 ? '9+' : notificationCount}
          </Text>
        </View>
      )}
    </View>
  );
};

// Main Tab Navigator for authenticated users
function MainTabNavigator() {
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);

  useEffect(() => {
    if (!auth.currentUser?.uid) {
      setTotalUnreadMessages(0);
      return;
    }

    // Set up real-time listener for chats
    const chatsQuery = query(
      collection(db, 'chats'), 
      where('participants', 'array-contains', auth.currentUser.uid)
    );
    
    const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
      try {
        if (snapshot.empty) {
          setTotalUnreadMessages(0);
          return;
        }

        // Get unread count for each chat
        const unreadPromises = snapshot.docs.map(async (chatDoc) => {
          return await getUnreadCount(chatDoc.id, auth.currentUser.uid);
        });
        
        const unreadCounts = await Promise.all(unreadPromises);
        const totalUnread = unreadCounts.reduce((sum, count) => sum + count, 0);
        
        console.log('Navigation: Total unread messages:', totalUnread);
        setTotalUnreadMessages(totalUnread);
      } catch (error) {
        console.error('Error calculating unread messages for navigation:', error);
        setTotalUnreadMessages(0);
      }
    });

    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'Find Partners') {
            iconName = 'people';
          } else if (route.name === 'Chat') {
            iconName = 'chatbubble';
          } else if (route.name === 'Notes') {
            iconName = 'document-text';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          }

          return (
            <TabBarIcon 
              name={iconName} 
              focused={focused}
              color={color} 
              size={size} 
              hasNotification={route.name === 'Chat' && totalUnreadMessages > 0}
              notificationCount={totalUnreadMessages}
            />
          );
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Find Partners" component={MatchingScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Notes" component={NotesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// Auth Stack Navigator for unauthenticated users
function AuthStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}

// Main App Stack Navigator (includes the tab navigator and modal screens)
function MainStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen 
        name="PartnerProfile" 
        component={PartnerProfileScreen}
        options={{
          presentation: 'card', // Use 'modal' for iOS-style modal presentation
        }}
      />
    </Stack.Navigator>
  );
}

// Main App Component
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe;
    
    try {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setLoading(false);
      }, (error) => {
        console.error('Authentication error:', error);
        setLoading(false);
      });
    } catch (error) {
      console.error('Firebase initialization error:', error);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          // User is logged in - show main app with stack navigator
          <Stack.Screen name="Main" component={MainStackNavigator} />
        ) : (
          // User is not logged in - show auth flow starting with welcome screen
          <Stack.Screen name="Auth" component={AuthStackNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}