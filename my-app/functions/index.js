const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();


// Login function：frontend get email, password, name, computing ID
// Require inputs: email, password, name, and computing ID
exports.registerUser = functions.https.onCall(async (data, context) => {
  const { email, password, name, computingID } = data;

  //check input
  if (!email || !password || !name || !computingID) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }

  //check user computing ID, must comeup with 6 digits, letters and numbers
  const idPattern = /^[a-zA-Z0-9]{6}$/;
  if (!idPattern.test(computingId)) {
    throw new functions.https.HttpsError('invalid-argument', 'Computing ID must be exactly 6 letters or numbers');
  }

  try {
    //check if computing ID exists or not
    const existing = await admin.firestore()
      .collection('users')
      .where('computingId', '==', computingId)
      .get();

    if (!existing.empty) {
      throw new functions.https.HttpsError('already-exists', 'Computing ID is already in use');
    }

    // Create Firebase Auth User
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    // Initialize Firebase User data
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      name,
      email,
      computingID,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { uid: userRecord.uid };
  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});
