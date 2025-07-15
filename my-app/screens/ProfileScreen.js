import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const avatarOptions = [
  'school',
  'book',
  'laptop',
  'code-slash',
  'bulb',
  'leaf',
  'cloud',
];

const ProfileScreen = () => {
  const [selectedAvatar, setSelectedAvatar] = useState('person-circle');
  const [bio, setBio] = useState('');
  const [email] = useState('computingID@virginia.edu'); //Replace with Firebase-auth
  const [computingID] = useState('a1b2c3'); //Placeholder for computing ID
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>My Profile</Text>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <Ionicons name={selectedAvatar} size={100} color="#007AFF" />
          <Text style={styles.avatarLabel}>Select Your Avatar</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarPicker}>
            {avatarOptions.map((icon) => (
              <TouchableOpacity
                key={icon}
                onPress={() => setSelectedAvatar(icon)}
                style={[
                  styles.avatarOption,
                  selectedAvatar === icon && styles.avatarOptionSelected,
                ]}
              >
                <Ionicons name={icon} size={32} color={selectedAvatar === icon ? '#fff' : '#007AFF'} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Bio */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Bio</Text>
          <TextInput
            style={styles.input}
            placeholder="Tell us about yourself..."
            multiline
            numberOfLines={4}
            value={bio}
            onChangeText={setBio}
          />
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Contact Information</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{email}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Computing ID:</Text>
            <Text style={styles.infoValue}>{computingID}</Text>
          </View>
        </View>

        {/* Save Button (for future Firebase update) */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.saveButton}>
            <Ionicons name="save-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.saveText}>Save Profile</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  scrollView: { paddingBottom: 40 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  avatarSection: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  avatarLabel: {
    fontSize: 16,
    color: '#555',
    marginVertical: 10,
  },
  avatarPicker: {
    paddingHorizontal: 10,
    flexDirection: 'row',
  },
  avatarOption: {
    padding: 12,
    marginHorizontal: 6,
    borderRadius: 40,
    backgroundColor: '#e0e0e0',
  },
  avatarOptionSelected: {
    backgroundColor: '#007AFF',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  infoItem: {
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: '#555',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#34C759',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;