import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  type Auth,
  type User,
} from 'firebase/auth'

/**
 * Lazily-initialised Firebase client. Initialisation is deferred to first use
 * so demo mode (and the static build) never needs Firebase env vars.
 */
let app: FirebaseApp | undefined
let auth: Auth | undefined

export function getFirebaseAuth(): Auth {
  if (!auth) {
    if (getApps().length === 0) {
      app = initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      })
    } else {
      app = getApps()[0]
    }
    auth = getAuth(app)
    void setPersistence(auth, browserLocalPersistence)
  }
  return auth
}

/**
 * Resolves once Firebase has restored (or ruled out) a persisted session.
 * `auth.currentUser` is unreliable before this settles on a fresh page load.
 */
export function waitForUser(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (user) => {
      unsubscribe()
      resolve(user)
    })
  })
}

/** Fresh (SDK-cached) Firebase ID token, or null when signed out. */
export async function getIdToken(): Promise<string | null> {
  const user = getFirebaseAuth().currentUser ?? (await waitForUser())
  if (!user) return null
  return user.getIdToken()
}
