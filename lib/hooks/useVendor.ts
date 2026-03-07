'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVendorStore } from '@/lib/store/vendorStore'
import type { Vendor } from '@/types/database.types'

export function useVendor() {
  const { vendor, setVendor } = useVendorStore()
  const [loading, setLoading] = useState(!vendor)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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
