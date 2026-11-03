import type { FirebaseOptions } from 'firebase/app'

/**
 * Cloud sync settings (from Firebase console → Project settings → Your apps → Web app).
 * These values are public by design; Firestore security rules (firestore.rules) make sure
 * every signed-in user can only read and write their own records.
 * Leave as null to run the app without cloud sync.
 */
export const firebaseConfig: FirebaseOptions | null = null
