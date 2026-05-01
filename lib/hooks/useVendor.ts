'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVendorStore } from '@/lib/store/vendorStore'
import { isDemoMode, DEMO_VENDOR } from '@/lib/demo'
import type { Vendor } from '@/types/database.types'

export function useVendor() {
  const { vendor, setVendor } = useVendorStore()
  const [loading, setLoading] = useState(!vendor && !isDemoMode)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Demo mode — seed store immediately, no Supabase needed
    if (isDemoMode) {
      if (!vendor) setVendor(DEMO_VENDOR)
      setLoading(false)
      return
    }

    if (vendor) return

    async function fetchVendor() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data, error: err } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (err) {
        setError(err.message)
      } else {
        setVendor(data as Vendor)
      }
      setLoading(false)
    }

    fetchVendor()
  }, [vendor, setVendor])

  return { vendor, loading, error }
}
