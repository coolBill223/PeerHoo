import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebaseConfig';
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, getDocs, orderBy, limit } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

const InboxScreen = () => {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'chats'), where('participants', 'array-contains', auth.currentUser.uid)),
      async (snap) => {
        const promises = snap.docs.map(async (doc) => {
          const data = doc.data();
          const otherUid = data.participants.find((id) => id !== auth.currentUser.uid);

          // get partner name
          const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', otherUid)));
          const userName = userSnap.empty ? 'Unknown' : userSnap.docs[0].data().name;

          // Get newst message
          const msgQuery = query(
            collection(db, 'chats', doc.id, 'messages'),
            orderBy('sentAt', 'desc'),
            limit(1)
          );
          const msgSnap = await getDocs(msgQuery);
          const lastMsg = msgSnap.empty ? null : msgSnap.docs[0].data();

          return {
            id: doc.id,
            name: userName,
            lastMessage: lastMsg?.text ?? '',
            timestamp: lastMsg?.sentAt?.toDate()?.toLocaleTimeString() ?? '',
            course: data.sharedCourses?.[0] ?? '',
            messages: [], // placeholder
          };
        });

        const result = await Promise.all(promises);
        setThreads(result);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}
      onPress={() => navigation.navigate('ChatThread', { thread: item })}
    >
      <Ionicons name="person-circle-outline" size={40} color="#007AFF" style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
        <Text style={{ fontSize: 14, color: '#666', marginTop: 2 }}>{item.lastMessage}</Text>
      </View>
      <Text style={{ fontSize: 12, color: '#999' }}>{item.timestamp}</Text>
    </TouchableOpacity>
  );

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold', margin: 20 }}>Messages</Text>
      <FlatList data={threads} keyExtractor={(item) => item.id} renderItem={renderItem} />
    </SafeAreaView>
  );
};

export default InboxScreen;
