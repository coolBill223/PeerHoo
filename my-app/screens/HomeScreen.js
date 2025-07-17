import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { getAcceptedPartners } from '../backend/partnerService';
import { ensureUserDocument, refreshAllPartnerNames } from '../backend/userService';

const HomeScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    const initializeUser = async () => {
      const current = auth.currentUser;
      setUser(current);

      if (current) {
        // Ensure user document exists in Firestore
        await ensureUserDocument();
        
        // fetch all documents where status === 'accepted'
        try {
          const partnersData = await getAcceptedPartners(current.uid);
          console.log('Partners data:', partnersData);
          setPartners(partnersData);
        } catch (error) {
          console.error('Error fetching partners:', error);
        }
      }
    };

    initializeUser();
  }, []);

  // Function to reload partners after updating
  const reloadPartners = async () => {
    const current = auth.currentUser;
    if (current) {
      try {
        console.log('Reloading partners...');
        
        const partnersData = await getAcceptedPartners(current.uid);
        console.log('Reloaded partners data:', partnersData);
        
        // Only update state if we actually got data
        if (partnersData && Array.isArray(partnersData)) {
          setPartners(partnersData);
        } else {
          console.log('No partners data received, keeping current state');
        }
      } catch (error) {
        console.error('Error reloading partners:', error);
        // Don't clear partners on error, just log it
      }
    }
  };

  // Function to search thoroughly for real names
  const findRealNames = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'No authenticated user found');
        return;
      }
      
      // Don't clear partners - keep them visible during search
      console.log('Starting real name search...');
      
      // Use the new refresh function
      const result = await refreshAllPartnerNames();
      
      if (result.success) {
        let message = 'Search completed!\n\n';
        let foundImprovements = 0;
        
        const userUpdates = result.updates || [];
        foundImprovements += userUpdates.length;
        
        if (userUpdates.length > 0) {
          message += `✅ Updated ${userUpdates.length} user names:\n`;
          userUpdates.forEach(update => {
            message += `• ${update.oldName} → ${update.newName}\n`;
          });
          message += '\n';
        }
        
        if (foundImprovements > 0) {
          message += `🎉 Found ${foundImprovements} improved names!`;
        } else {
          message += '⚠️ No name improvements found. This might mean:\n';
          message += '• Partners are already showing correct names\n';
          message += '• Partners haven\'t been active recently\n';
          message += '• Original registration data is not available';
        }
        
        // Always reload partners after search, regardless of result
        await reloadPartners();
        
        Alert.alert(
          'Search Complete!',
          message,
          [
            { 
              text: 'OK', 
              onPress: async () => {
                // Force another refresh when user dismisses alert
                await reloadPartners();
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', result.message);
        // Reload partners even on error
        await reloadPartners();
      }
    } catch (error) {
      console.error('Error in findRealNames:', error);
      Alert.alert('Error', `Failed to search for names: ${error.message}`);
      await reloadPartners();
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          }
        },
      ]
    );
  };

  const quickActions = [
    { 
      title: 'Find Study Partners', 
      icon: 'people', 
      screen: 'Find Partners',
      description: 'Match with peers in your courses',
      color: '#007AFF' 
    },
    { 
      title: 'Browse Notes', 
      icon: 'document-text', 
      screen: 'Notes',
      description: 'Access shared course materials',
      color: '#34C759' 
    },
    { 
      title: 'Messages', 
      icon: 'chatbubble', 
      screen: 'Chat',
      description: 'Chat with study partners',
      color: '#FF9500' 
    },
    { 
      title: 'My Profile', 
      icon: 'person', 
      screen: 'Profile',
      description: 'Manage courses and profile',
      color: '#5856D6' 
    },
  ];

  const recentActivity = [
    { type: 'note', title: 'CS 4720 Lecture Notes uploaded', time: '2 hours ago' },
    { type: 'match', title: 'New study partner match!', time: '1 day ago' },
    { type: 'message', title: 'Message from Alex about project', time: '2 days ago' },
  ];

  // Helper function to get the first name safely
  const getFirstName = () => {
    if (user?.displayName && typeof user.displayName === 'string' && user.displayName.trim()) {
      return `, ${user.displayName.split(' ')[0]}`;
    }
    return '';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Welcome back{getFirstName()}!
            </Text>
            <Text style={styles.subtitle}>Ready to study together?</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Find real names button */}
            <TouchableOpacity style={styles.updateButton} onPress={findRealNames}>
              <Ionicons name="search" size={20} color="#5856D6" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color="#007AFF" />
            <Text style={styles.statNumber}>{partners.length}</Text>
            <Text style={styles.statLabel}>Study Partners</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="document-text" size={24} color="#34C759" />
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Notes Shared</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="school" size={24} color="#5856D6" />
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Courses</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.actionCard}
                onPress={() => navigation.navigate(action.screen)}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.color }]}>
                  <Ionicons name={action.icon} size={24} color="#fff" />
                </View>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionDescription}>{action.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Study Partners – shows only when you have ≥1 */}
        {partners.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Study Partners</Text>
            {partners.map((p) => {
              return (
                <TouchableOpacity
                  key={p.id}
                  style={styles.partnerCard}
                  onPress={() => Alert.alert(
                    `${p.partnerName} - ${p.course}`,
                    `Computing ID: ${p.partnerComputingId || 'Not available'}`
                  )}
                >
                  <Ionicons name="person-circle" size={36} color="#007AFF" />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ fontWeight: '600', fontSize: 16 }}>{p.partnerName}</Text>
                    <Text style={{ fontSize: 14, color: '#007AFF', marginTop: 2 }}>{p.course}</Text>
                    {p.partnerComputingId && (
                      <Text style={{ fontSize: 12, color: '#888', marginTop: 1 }}>
                        {p.partnerComputingId}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#ccc" />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityContainer}>
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <View key={index} style={styles.activityItem}>
                  <View style={styles.activityIcon}>
                    <Ionicons 
                      name={
                        activity.type === 'note' ? 'document-text' :
                        activity.type === 'match' ? 'people' : 'chatbubble'
                      } 
                      size={16} 
                      color="#007AFF" 
                    />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>{activity.title}</Text>
                    <Text style={styles.activityTime}>{activity.time}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyActivity}>
                <Ionicons name="time-outline" size={40} color="#999" />
                <Text style={styles.emptyText}>No recent activity</Text>
                <Text style={styles.emptySubtext}>Start by finding study partners or uploading notes!</Text>
              </View>
            )}
          </View>
        </View>

        {/* Tips Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Study Tips</Text>
          <View style={styles.tipCard}>
            <Ionicons name="bulb" size={20} color="#FF9500" />
            <Text style={styles.tipText}>
              Share your notes after each lecture to help your classmates and build your reputation!
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  logoutButton: {
    padding: 8,
  },
  updateButton: {
    padding: 8,
    marginRight: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '48%',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  actionDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  partnerCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
  },

  activityContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  activityTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
    textAlign: 'center',
  },
  tipCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
    lineHeight: 20,
  },
});

export default HomeScreen;