'use client'

import { useEffect, useState } from 'react'
import { fetchVendorMe } from '@/lib/api'
import { waitForUser } from '@/lib/firebase'
import { useVendorStore } from '@/lib/store/vendorStore'
import { isDemoMode, DEMO_VENDOR } from '@/lib/demo'

export function useVendor() {
  const { vendor, setVendor } = useVendorStore()
  const [loading, setLoading] = useState(!vendor && !isDemoMode)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Demo mode — seed store immediately, no backend needed
    if (isDemoMode) {
      if (!vendor) setVendor(DEMO_VENDOR)
      setLoading(false)
      return
    }

    if (vendor) return

    async function load() {
      const user = await waitForUser()
      if (!user) {
        setLoading(false)
        return
      }
      try {
        setVendor(await fetchVendorMe())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load vendor')
      }
      setLoading(false)
    }

    void load()
  }, [vendor, setVendor])

  return { vendor, loading, error }
}
