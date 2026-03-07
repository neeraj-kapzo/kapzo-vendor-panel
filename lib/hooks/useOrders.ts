'use client'

import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVendorStore } from '@/lib/store/vendorStore'
import type { Order } from '@/types/database.types'

/**
 * Legacy hook — still used by OrdersClient for its internal refetch pattern.
 * For new code prefer useRealtimeOrders which handles INSERT vs UPDATE separately.
 */
export function useOrders(vendorId: string | undefined) {
  const { activeOrders, setActiveOrders } = useVendorStore()

  const fetchOrders = useCallback(async () => {
    if (!vendorId) return
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('vendor_id', vendorId)
      .in('status', ['pending', 'accepted', 'packing', 'packed', 'dispatched'])
      .order('created_at', { ascending: false })

    if (data) setActiveOrders(data as Order[])
  }, [vendorId, setActiveOrders])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Real-time subscription (catch-all fallback)
  useEffect(() => {
    if (!vendorId) return
    const supabase = createClient()

    const channel = supabase
      .channel('vendor-orders-legacy')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `vendor_id=eq.${vendorId}`,
        },
        () => { fetchOrders() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [vendorId, fetchOrders])

  return { orders: activeOrders, refetch: fetchOrders }
}
