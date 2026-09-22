'use client'

import React, { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { fetchActiveOrders, mapOrderStatus } from '@/lib/api'
import type { NewOrderEvent, OrderStatusEvent } from '@/lib/api'
import { getSocket } from '@/lib/realtime'
import { useVendorStore } from '@/lib/store/vendorStore'
import { isDemoMode } from '@/lib/demo'

/* ─── Audio alert (Web Audio API — no files needed) ─── */
function playAlertBeep() {
  try {
    const ctx = new AudioContext()
    const freqs = [880, 1100, 880]
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0.4, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
      osc.start(t)
      osc.stop(t + 0.15)
    })
  } catch {
    // Autoplay policy blocked — silent fail
  }
}

/* ─── Tab title flash ─── */
function flashTitle(intervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>) {
  if (intervalRef.current) return // already flashing
  const orig = document.title
  let on = false
  intervalRef.current = setInterval(() => {
    document.title = on ? orig : '🔔 New Order!'
    on = !on
  }, 800)
  setTimeout(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    document.title = orig
  }, 8000)
}

/** Window event pages listen to so they refetch money/history after a simulation reset. */
export const SIMULATION_RESET_EVENT = 'kapzo:simulation-reset'

/**
 * Live vendor order feed over the backend's Socket.IO gateway. The server
 * auto-joins this connection to `vendor:{vendorId}` after verifying the
 * Firebase token, so no explicit subscribe call is needed:
 *  - `new-order`    → alert UX (beep, tab flash, toast) + fetch the full row
 *  - `order-status` → silent store sync (covers auto-reject, rider updates…)
 *  - `simulation-reset` → drop simulated orders from the store, notify pages to refetch
 */
export function useRealtimeOrders(vendorId: string | undefined) {
  const { addPendingOrder, updateOrderStatus, setActiveOrders, removeSimulatedOrders } =
    useVendorStore()
  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ── Initial fetch ── */
  useEffect(() => {
    if (!vendorId || isDemoMode) return
    fetchActiveOrders(vendorId)
      .then(setActiveOrders)
      .catch(() => {})
  }, [vendorId, setActiveOrders])

  /* ── Realtime subscription ── */
  useEffect(() => {
    if (!vendorId || isDemoMode) return
    const socket = getSocket()

    const onNewOrder = async (event: NewOrderEvent) => {
      // The event is a thin ping — fetch the full pending row for the store.
      const orders = await fetchActiveOrders(vendorId)
      const order = orders.find((o) => o.id === event.orderId)
      if (!order || order.status !== 'pending') return

      addPendingOrder(order)
      playAlertBeep()
      flashTitle(flashIntervalRef)
      toast.custom(
        (t) => (
          <div
            className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg transition-all
              bg-white border border-green-200 ${t.visible ? 'opacity-100' : 'opacity-0'}`}
          >
            <span className="text-xl">🛒</span>
            <div>
              <p className="font-semibold text-[#022135] text-sm">
                {order.is_simulated ? 'New Order! (Simulated)' : 'New Order!'}
              </p>
              <p className="text-xs text-gray-500">₹{order.total_amount} · Accept within 2 min</p>
            </div>
          </div>
        ),
        { duration: 6000 },
      )
    }

    const onOrderStatus = (event: OrderStatusEvent) => {
      updateOrderStatus(event.orderId, mapOrderStatus(event.status))
    }

    const onSimulationReset = () => {
      removeSimulatedOrders()
      window.dispatchEvent(new Event(SIMULATION_RESET_EVENT))
      toast('Simulated orders were cleared by Kapzo', { icon: '🧪' })
    }

    socket.on('new-order', onNewOrder)
    socket.on('order-status', onOrderStatus)
    socket.on('simulation-reset', onSimulationReset)

    return () => {
      socket.off('new-order', onNewOrder)
      socket.off('order-status', onOrderStatus)
      socket.off('simulation-reset', onSimulationReset)
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current)
        flashIntervalRef.current = null
      }
    }
  }, [vendorId, addPendingOrder, updateOrderStatus, removeSimulatedOrders])
}
