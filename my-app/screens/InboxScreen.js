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
import { collection, query, where, onSnapshot, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

const InboxScreen = () => {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
  if (!auth.currentUser?.uid) {
    setLoading(false);
    return;
  }

  const unsubscribe = onSnapshot(
    query(collection(db, 'chats'), where('participants', 'array-contains', auth.currentUser.uid)),
    (snap) => {
      const fetchThreads = async () => {
        const promises = snap.docs.map(async (doc) => {
          const data = doc.data();
          const otherUid = data.participants.find((id) => id !== auth.currentUser.uid);

          const userDoc = await getDoc(doc(db, 'users', otherUid));
          const userName = userDoc.exists() ? userDoc.data().name : 'Unknown';

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
          };
        });

        const result = await Promise.all(promises);
        setThreads(result);
        setLoading(false);
      };

      fetchThreads();
    }
  );

  return () => unsubscribe();
}, [auth.currentUser?.uid]);



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

  if (!auth.currentUser?.uid) {
  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 16, color: '#999' }}>No user signed in.</Text>
    </SafeAreaView>
  );
}

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold', margin: 20 }}>Messages</Text>
      <FlatList data={threads} keyExtractor={(item) => item.id} renderItem={renderItem} />
    </SafeAreaView>
  );
};

export default InboxScreen;
