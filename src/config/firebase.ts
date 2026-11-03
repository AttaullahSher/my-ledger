import type { FirebaseOptions } from 'firebase/app'

/**
 * Cloud sync settings (Firebase → Project settings → Your apps → Web app).
 * These values are public by design; Firestore security rules (firestore.rules) make sure
 * every signed-in user can only read and write their own records.
 */
export const firebaseConfig: FirebaseOptions | null = {
  apiKey: 'AIzaSyD6lHQCOrZS62bWoOSAk4ZFAtrxXH5yHv4',
  authDomain: 'my-ledger-e1957.firebaseapp.com',
  projectId: 'my-ledger-e1957',
  storageBucket: 'my-ledger-e1957.firebasestorage.app',
  messagingSenderId: '1054441757753',
  appId: '1:1054441757753:web:2fa7dbd4c2d53346b241e8',
}
