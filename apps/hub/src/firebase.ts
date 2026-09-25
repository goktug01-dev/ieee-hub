import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const env = import.meta.env;

export const firebaseApp = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

export const useEmulators = env.VITE_USE_EMULATORS === '1';

export const auth = getAuth(firebaseApp);

// Yerel önbellek, okuma sayısını (ve Spark kotasını) önemli ölçüde azaltır.
export const db = initializeFirestore(firebaseApp, {
  localCache: useEmulators ? undefined : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (useEmulators) {
  const authPort = Number(env.VITE_AUTH_EMULATOR_PORT || 9099);
  const firestorePort = Number(env.VITE_FIRESTORE_EMULATOR_PORT || 8080);
  connectAuthEmulator(auth, `http://127.0.0.1:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', firestorePort);
}
