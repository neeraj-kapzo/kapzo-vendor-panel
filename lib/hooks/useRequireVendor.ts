'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchVendorMe, ApiError } from '@/lib/api'
import { waitForUser } from '@/lib/firebase'
import { useVendorStore } from '@/lib/store/vendorStore'
import { isDemoMode, DEMO_VENDOR } from '@/lib/demo'
import type { Vendor } from '@/types/database.types'

interface RequireVendorOptions {
  /**
   * Let a vendor whose verification is still PENDING through. Only the profile
   * page sets this: a pending pharmacy has no orders, inventory or settlements
   * to look at and cannot go online, but it *can* review and correct the
   * details that are under review — which is the whole point of being pending
   * (and the backend's `PATCH /vendors/me` allows it for the same reason).
   */
  allowPending?: boolean
}

/**
 * Client-side replacement for the old server-side page guards: resolves the
 * signed-in vendor (redirecting to login/onboarding when that fails) and
 * seeds the vendor store. Render nothing while `loading` is true.
 */
export function useRequireVendor(
  options: RequireVendorOptions = {},
): { vendor: Vendor | null; loading: boolean } {
  const { allowPending = false } = options
  const router = useRouter()
  const { vendor, setVendor } = useVendorStore()
  const [loading, setLoading] = useState(!vendor && !isDemoMode)
  const started = useRef(false)

  useEffect(() => {
    if (isDemoMode) {
      if (!vendor) setVendor(DEMO_VENDOR)
      return
    }
    if (vendor || started.current) return
    started.current = true

    let cancelled = false
    async function resolve() {
      const user = await waitForUser()
      if (cancelled) return
      if (!user) {
        router.replace('/vendor/login')
        return
      }

      try {
        // No `/auth/bootstrap` here: a vendor reaching a guarded page already
        // has a User row (the login screen bootstraps only the self-signup
        // path), and calling it can 409 on a phone/email that legitimately
        // belongs to this very account — see afterAuth in the login page.
        const me = await fetchVendorMe()
        if (cancelled) return
        if (me.status === 'banned') {
          // A banned vendor gets signed out to the login screen, which
          // explains the suspension and points at support.
          router.replace('/vendor/login')
          return
        }
        if (me.status === 'pending' && !allowPending) {
          // Not a dead end any more: send them to the one page they can act
          // on instead of bouncing them out of the app they just signed into.
          // The store is seeded first so the profile page and the shell can
          // read the vendor without a second fetch.
          setVendor(me)
          router.replace('/vendor/profile')
          return
        }
        setVendor(me)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        if (
          err instanceof ApiError &&
          (err.status === 404 || err.status === 403)
        ) {
          // Signed in but no Vendor row yet — finish onboarding. 403 because
          // GET /vendors/me is @Roles(VENDOR) and pre-registration users are
          // still role CUSTOMER; 404 kept for a vendor whose row is gone.
          router.replace('/vendor/onboarding')
          return
        }
        router.replace('/vendor/login')
      }
    }

    void resolve()
    return () => {
      cancelled = true
    }
  }, [vendor, setVendor, router, allowPending])

  // The fetch above is skipped once the store holds a vendor, so the status
  // rule has to be re-applied here too: seeding the store on the way to the
  // profile page must not leave a pending vendor able to client-side navigate
  // into the dashboard. (The sidebar hides those links while pending, so this
  // is the guard holding on its own rather than a reachable path.)
  useEffect(() => {
    if (isDemoMode || !vendor) return
    if (vendor.status === 'banned') {
      router.replace('/vendor/login')
      return
    }
    if (vendor.status === 'pending' && !allowPending) {
      router.replace('/vendor/profile')
    }
  }, [vendor, allowPending, router])

  return { vendor, loading: loading && !vendor }
}
