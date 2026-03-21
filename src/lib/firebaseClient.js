import { initializeApp, getApps } from 'firebase/app';
import {
  collection,
  getDocs,
  getFirestore,
  orderBy,
  query,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);

const app = hasFirebaseConfig
  ? getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig)
  : null;

const db = app ? getFirestore(app) : null;

const fetchInstructors = async () => {
  if (!db) {
    return { data: [], error: new Error('Firebase is not configured.') };
  }

  try {
    const snapshot = await getDocs(
      query(collection(db, 'instructors'), orderBy('created_at', 'desc'))
    );
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return { data, error: null };
  } catch (error) {
    return { data: [], error };
  }
};

export { hasFirebaseConfig as isFirebaseEnabled, fetchInstructors };
