import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getUnreadCount } from './backend/chatService';
import { View, Text, TouchableOpacity } from 'react-native';
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
import BlockedPartnersScreen from './screens/BlockedPartners';
import ChatThreadScreen from './screens/ChatThreadScreen';
import { getAcceptedPartners, isPartnerBlocked } from './backend/partnerService';

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
  const [refreshKey, setRefreshKey] = useState(0);

  // Function to force refresh all screens
  const forceRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    if (!auth.currentUser?.uid) {
      setTotalUnreadMessages(0);
      return;
    }

    const calculateBlockedPartnerIds = async () => {
      try {
        // Get blocked partners first
        const allPartners = await getAcceptedPartners(auth.currentUser.uid);
        const partnerStatusPromises = allPartners.map(async (partner) => {
          const isBlocked = await isPartnerBlocked(partner.id, auth.currentUser.uid);
          return {
            ...partner,
            isBlocked
          };
        });
        
        const partnersWithStatus = await Promise.all(partnerStatusPromises);
        const blockedPartnerIds = new Set(
          partnersWithStatus
            .filter(p => p.isBlocked)
            .map(p => p.partnerId)
        );

        return blockedPartnerIds;
      } catch (error) {
        console.error('Error getting blocked partners:', error);
        return new Set();
      }
    };

    // Set up real-time listener for chats
    const chatsQuery = query(
      collection(db, 'chats'), 
      where('participants', 'array-contains', auth.currentUser.uid)
    );
    
    const unsubscribe = onSnapshot(
      chatsQuery,
      async (snapshot) => {
        try {
          if (snapshot.empty) {
            setTotalUnreadMessages(0);
            return;
          }

          const blockedPartnerIds = await calculateBlockedPartnerIds();
          const unreadPromises = snapshot.docs.map(async (chatDoc) => {
            const chatData   = chatDoc.data();
            const otherUid   = chatData.participants.find(
              id => id !== auth.currentUser.uid
            );
            if (blockedPartnerIds.has(otherUid)) return 0;
            return await getUnreadCount(chatDoc.id, auth.currentUser.uid);
         });
          const unreadCounts = await Promise.all(unreadPromises);
          const totalUnread  = unreadCounts.reduce((s, c) => s + c, 0);

          console.log(
            'Navigation: Total unread messages (excluding blocked):',
            totalUnread
          );
          setTotalUnreadMessages(totalUnread);
        } catch (error) {
          console.error(
            'Error calculating unread messages for navigation:',
            error
          );
          setTotalUnreadMessages(0);
        }
      },
      (err) => {
        if (err.code === 'permission-denied') {
          console.log('onSnapshot cancelled (user signed out)');
          return;
        }
        if (err.code === 'permission-denied') return;
       console.error('❌ chatslist snapshot error', err);
      }
    );
   return () => unsubscribe();
  }, [auth.currentUser?.uid, refreshKey]);

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
        // Force unmount and remount on tab change for fresh data
        unmountOnBlur: false, // Keep false to maintain state but use focus listeners
        lazy: false, // Load all tabs immediately
      })}
      screenListeners={{
        tabPress: (e) => {
          // Force refresh when any tab is pressed
          forceRefresh();
        },
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        initialParams={{ refreshKey }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Additional refresh logic for Home screen
            console.log('Home tab pressed - refreshing...');
          },
        })}
      />
      <Tab.Screen 
        name="Find Partners" 
        component={MatchingScreen}
        initialParams={{ refreshKey }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            console.log('Find Partners tab pressed - refreshing...');
          },
        })}
      />
      <Tab.Screen 
        name="Chat" 
        component={ChatScreen}
        initialParams={{ refreshKey }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            console.log('Chat tab pressed - refreshing...');
          },
        })}
      />
      <Tab.Screen 
        name="Notes" 
        component={NotesScreen}
        initialParams={{ refreshKey }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            console.log('Notes tab pressed - refreshing...');
          },
        })}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        initialParams={{ refreshKey }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            console.log('Profile tab pressed - refreshing...');
          },
        })}
      />
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
          presentation: 'card',
        }}
      />
      <Stack.Screen 
        name="BlockedPartners" 
        component={BlockedPartnersScreen}
        options={{
          presentation: 'card',
        }}
      />
      {/* Add ChatThread to the main stack so it can be accessed from partner profile */}
      <Stack.Screen 
        name="ChatThread" 
        component={ChatThreadScreen}
        options={{
          headerShown: false, // We'll handle header in the component
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