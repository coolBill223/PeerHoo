// The purpose of this file: This is the ui for the screen that manages blocked study partners,
// here they can manage their blocked partners all at once

// imports
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAcceptedPartners, isPartnerBlocked, unblockPartner } from '../backend/partnerService';
import { auth } from '../firebaseConfig';

const BlockedPartnersScreen = ({ route, navigation }) => {

  const { onPartnersUpdated } = route.params || {};
  
  // this is the ctate management 
  const [blockedPartners, setBlockedPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unblockingPartners, setUnblockingPartners] = useState(new Set());

  // Here it will load blocked partners 
  useEffect(() => {
    loadBlockedPartners();
  }, []);

  // here we fetch all partners and filter for blocked ones
  const loadBlockedPartners = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      // Then we get all the partners first 
      const allPartners = await getAcceptedPartners(currentUser.uid);
      
      // Then we check block status for each partner
      const partnerStatusPromises = allPartners.map(async (partner) => {
        const isBlocked = await isPartnerBlocked(partner.id, currentUser.uid);
        return {
          ...partner,
          isBlocked
        };
      });
      
      const partnersWithStatus = await Promise.all(partnerStatusPromises);
      
      // Then we filter to only show blocked partners
      const blocked = partnersWithStatus.filter(p => p.isBlocked);
      
      setBlockedPartners(blocked);
    } catch (error) {
      console.error('Error loading blocked partners:', error);
      Alert.alert('Error', 'Failed to load blocked partners');
    } finally {
      setLoading(false);
    }
  };

  // Then we handle unblocking a single partner and we also put a confirmation
  const handleUnblockPartner = async (partner) => {
    Alert.alert(
      'Unblock Partner',
      `Are you sure you want to unblock ${partner.partnerName}? They will be able to contact you again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'default',
          onPress: async () => {
            // adding partner
            setUnblockingPartners(prev => new Set([...prev, partner.id]));
            
            try {
              const currentUser = auth.currentUser;
              if (currentUser && partner.id) {
                // here is backend service integration
                await unblockPartner(partner.id, currentUser.uid);
                
                // removing from local partners list
                setBlockedPartners(prev => prev.filter(p => p.id !== partner.id));
                
                Alert.alert(
                  'Partner Unblocked',
                  `${partner.partnerName} has been unblocked and can now contact you.`
                );
                
                // here parent screen will reload
                if (onPartnersUpdated) {
                  onPartnersUpdated();
                }
              }
            } catch (error) {
              console.error('Error unblocking partner:', error);
              Alert.alert('Error', 'Failed to unblock partner. Please try again.');
            } finally {
              setUnblockingPartners(prev => {
                const newSet = new Set(prev);
                newSet.delete(partner.id);
                return newSet;
              });
            }
          }
        }
      ]
    );
  };

  // This is to unblock all! 
  const handleUnblockAll = () => {
    if (blockedPartners.length === 0) return;

    Alert.alert(
      'Unblock All Partners',
      `Are you sure you want to unblock all ${blockedPartners.length} partners? They will all be able to contact you again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock All',
          style: 'default',
          onPress: async () => {
            setLoading(true);
            
            try {
              const currentUser = auth.currentUser;
              if (!currentUser) return;

              // this uses promises
              const unblockPromises = blockedPartners.map(partner => 
                unblockPartner(partner.id, currentUser.uid)
              );
              
              await Promise.all(unblockPromises);
              
              // clearing the blocked list
              setBlockedPartners([]);
              
              Alert.alert(
                'All Partners Unblocked',
                'All blocked partners have been unblocked successfully.'
              );
              
              // refreshing screen
              if (onPartnersUpdated) {
                onPartnersUpdated();
              }
            } catch (error) {
              console.error('Error unblocking all partners:', error);
              Alert.alert('Error', 'Failed to unblock some partners. Please try again.');
              // Reload 
              loadBlockedPartners();
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked Partners</Text>
        {blockedPartners.length > 0 && (
          <TouchableOpacity 
            style={styles.unblockAllButton}
            onPress={handleUnblockAll}
            disabled={loading}
          >
            <Text style={styles.unblockAllText}>Unblock All</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading blocked partners...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* This shows empty state if no blocked partners */}
          {blockedPartners.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle" size={64} color="#34C759" />
              <Text style={styles.emptyTitle}>No Blocked Partners</Text>
              <Text style={styles.emptySubtitle}>
                You haven't blocked any study partners. All your partners can contact you.
              </Text>
            </View>
          ) : (
            <>
              {/* This is a explanation explaining blocked partners */}
              <View style={styles.infoSection}>
                <View style={styles.infoCard}>
                  <Ionicons name="information-circle" size={20} color="#007AFF" />
                  <Text style={styles.infoText}>
                    You have blocked {blockedPartners.length} partner{blockedPartners.length > 1 ? 's' : ''}. 
                    Blocked partners cannot message you and won't appear in your active partners list.
                  </Text>
                </View>
              </View>

              {/* List of blocked partners here */}
              <View style={styles.partnersSection}>
                <Text style={styles.sectionTitle}>Blocked Partners</Text>
                
                {/* each will be a card*/}
                {blockedPartners.map((partner) => {
                  const isUnblocking = unblockingPartners.has(partner.id);
                  
                  return (
                    <View key={partner.id} style={styles.partnerCard}>
                      {/* Partner info */}
                      <View style={styles.partnerInfo}>
                        <View style={styles.avatarContainer}>
                          <Ionicons name="person" size={24} color="#666" />
                        </View>
                        <View style={styles.partnerDetails}>
                          <Text style={styles.partnerName}>{partner.partnerName}</Text>
                          <Text style={styles.partnerCourse}>{partner.course}</Text>
                          {partner.partnerComputingId && (
                            <Text style={styles.partnerComputingId}>
                              {partner.partnerComputingId}
                            </Text>
                          )}
                        </View>
                      </View>
                      
                      {/* Unblock button */}
                      <TouchableOpacity
                        style={[styles.unblockButton, isUnblocking && styles.unblockButtonDisabled]}
                        onPress={() => handleUnblockPartner(partner)}
                        disabled={isUnblocking}
                      >
                        {isUnblocking ? (
                          <ActivityIndicator size="small" color="#34C759" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle" size={18} color="#34C759" />
                            <Text style={styles.unblockButtonText}>Unblock</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

// Styles 
const styles = StyleSheet.create({
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
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    textAlign: 'center',
  },
  unblockAllButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  unblockAllText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#f0f8ff',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginLeft: 10,
  },
  partnersSection: {
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 15,
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  partnerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  partnerDetails: {
    flex: 1,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  partnerCourse: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 2,
  },
  partnerComputingId: {
    fontSize: 12,
    color: '#666',
  },
  unblockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#34C759',
    gap: 6,
  },
  unblockButtonDisabled: {
    opacity: 0.6,
  },
  unblockButtonText: {
    color: '#34C759',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default BlockedPartnersScreen;