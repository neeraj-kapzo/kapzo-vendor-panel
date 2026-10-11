import { getFirebaseAuth } from '@/lib/firebase'
import { disconnectSocket } from '@/lib/realtime'
import { useVendorStore } from '@/lib/store/vendorStore'

/**
 * Signs the vendor out and drops everything held in memory for that account.
 *
 * The store must be cleared too: this is an SPA, so the Zustand store outlives
 * the Firebase session, and `useRequireVendor` / `useVendor` skip the
 * `GET /vendors/me` fetch whenever the store already holds a vendor — a stale
 * vendor would otherwise keep showing after a different account signs in,
 * until a full page refresh.
 *
 * Order matters: the store is reset only after Firebase has signed out, so
 * the shell's `useVendor` (which refetches as soon as `vendor` goes null)
 * sees no user rather than re-resolving the account being signed out.
 */
export async function signOutVendor(): Promise<void> {
  disconnectSocket()
  await getFirebaseAuth().signOut()
  useVendorStore.getState().reset()
}
