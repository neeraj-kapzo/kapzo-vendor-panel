'use client'

import { useEffect, useCallback } from 'react'
import { fetchActiveOrders } from '@/lib/api'
import { getSocket } from '@/lib/realtime'
import { useVendorStore } from '@/lib/store/vendorStore'
import { isDemoMode } from '@/lib/demo'
import { useOnSimulationReset } from '@/lib/hooks/useSimulationReset'

/**
 * Legacy hook — still used by OrdersClient for its internal refetch pattern.
 * For new code prefer useRealtimeOrders which handles new-order vs
 * order-status events separately.
 */
export function useOrders(vendorId: string | undefined) {
  const { activeOrders, setActiveOrders } = useVendorStore()

  const fetchOrders = useCallback(async () => {
    // In demo mode the store is seeded by the page; skip the backend
    if (!vendorId || isDemoMode) return
    try {
      setActiveOrders(await fetchActiveOrders(vendorId))
    } catch {
      /* transient fetch failure — keep current list */
    }
  }, [vendorId, setActiveOrders])

  useEffect(() => {
    void fetchOrders()
  }, [fetchOrders])

  // Real-time subscription (catch-all fallback) — refetch on any order event
  useEffect(() => {
    if (!vendorId || isDemoMode) return
    const socket = getSocket()
    const refetch = () => void fetchOrders()

    socket.on('payment-updated', refetch)
    socket.on('new-order', refetch)
    socket.on('order-status', refetch)

    return () => {
      socket.off('payment-updated', refetch)
      socket.off('new-order', refetch)
      socket.off('order-status', refetch)
    }
  }, [vendorId, fetchOrders])

  // Admin simulation reset (dispatched by the vendor shell) — resync the list
  useOnSimulationReset(fetchOrders)

  return { orders: activeOrders, refetch: fetchOrders }
}
