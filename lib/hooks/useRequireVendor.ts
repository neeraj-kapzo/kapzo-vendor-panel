'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { bootstrap, fetchVendorMe, ApiError } from '@/lib/api'
import { waitForUser } from '@/lib/firebase'
import { useVendorStore } from '@/lib/store/vendorStore'
import { isDemoMode, DEMO_VENDOR } from '@/lib/demo'
import type { Vendor } from '@/types/database.types'

/** Bootstrap runs once per tab; repeat visits skip the extra round-trip. */
let bootstrapped = false

/**
 * Client-side replacement for the old server-side page guards: resolves the
 * signed-in vendor (redirecting to login/onboarding when that fails) and
 * seeds the vendor store. Render nothing while `loading` is true.
 */
export function useRequireVendor(): { vendor: Vendor | null; loading: boolean } {
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
        if (!bootstrapped) {
          await bootstrap(await user.getIdToken())
          bootstrapped = true
        }
        const me = await fetchVendorMe()
        if (cancelled) return
        if (me.status !== 'active') {
          // PENDING (awaiting approval) and BANNED both land on the login
          // screen, which explains the account state — same as the old flow.
          router.replace('/vendor/login')
          return
        }
        setVendor(me)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
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
  }, [vendor, setVendor, router])

  return { vendor, loading: loading && !vendor }
}
