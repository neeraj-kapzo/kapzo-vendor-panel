'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchActiveOrders, type NewOrderEvent, type OrderStatusEvent } from '@/lib/api'
import { getSocket } from '@/lib/realtime'
import { startAlertLoop, stopAlertLoop } from '@/lib/alertSound'
import { useDemoStore } from '@/lib/demo/demoStore'
import { useOnSimulationReset } from '@/lib/hooks/useSimulationReset'
import type { Order } from '@/types/database.types'

export interface NewOrderAlert {
  id: string
  order: Order
}

/**
 * Window event the demo "Simulate New Order" button fires so the shell-level
 * alert (beep + tab flash + toast) runs exactly like a real `new-order`.
 */
export const DEMO_NEW_ORDER_EVENT = 'kapzo:demo-new-order'

/**
 * The single new-order alert, mounted once by the vendor shell
 * (`app/vendor/layout.tsx`) so it fires on every page, not just the
 * Dashboard. Pages keep their own `new-order` listeners for data only.
 * The alarm rings continuously until every alerted order has left PENDING —
 * accepted or rejected here or elsewhere, or auto-rejected at `expiresAt`.
 * Pass `enabled = false` on shell-less pages and before an active vendor loads;
 * `listenDemo` also subscribes to `DEMO_NEW_ORDER_EVENT` (demo mode).
 */
export function useNewOrderAlerts(vendorId: string | undefined, enabled: boolean, listenDemo = false) {
  const [alerts, setAlerts] = useState<NewOrderAlert[]>([])
  const titleRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const titleOffRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ringing = useRef(new Map<string, ReturnType<typeof setTimeout> | null>())

  const silence = useCallback((orderId: string) => {
    const timer = ringing.current.get(orderId)
    if (timer) clearTimeout(timer)
    if (!ringing.current.delete(orderId)) return
    if (ringing.current.size === 0) stopAlertLoop()
  }, [])

  const alertFor = useCallback((order: Order) => {
    setAlerts((prev) => (prev.some((a) => a.id === order.id) ? prev : [...prev, { id: order.id, order }]))
    if (!ringing.current.has(order.id)) {
      // Backstop: the server auto-rejects at expiresAt, so never ring past it.
      const left = order.expires_at ? new Date(order.expires_at).getTime() - Date.now() : NaN
      const timer = Number.isFinite(left) ? setTimeout(() => silence(order.id), Math.max(left, 0) + 1_000) : null
      ringing.current.set(order.id, timer)
    }
    startAlertLoop()
    if (titleRef.current) return
    const original = document.title
    let on = true
    titleRef.current = setInterval(() => {
      document.title = on ? '🔔 New Order!' : original
      on = !on
    }, 1_000)
    titleOffRef.current = setTimeout(() => {
      if (titleRef.current) clearInterval(titleRef.current)
      titleRef.current = null
      document.title = original
    }, 10_000)
  }, [silence])

  useEffect(() => {
    if (!enabled || !vendorId) return
    const socket = getSocket()
    const onNewOrder = async (event: NewOrderEvent) => {
      try {
        // Thin event — pull the full pending row for the toast
        const orders = await fetchActiveOrders(vendorId)
        const order = orders.find((o) => o.id === event.orderId)
        if (order) alertFor(order)
      } catch {
        /* transient failure — pages still refetch on their own listeners */
      }
    }
    // Any move out of PENDING (accept, reject, auto-reject, cancel) stops its ring
    const onOrderStatus = (event: OrderStatusEvent) => {
      if (event.status !== 'PENDING') silence(event.orderId)
    }
    // Missed events while offline: re-sync from the server of record
    const onReconnect = async () => {
      if (ringing.current.size === 0) return
      try {
        const pending = new Set(
          (await fetchActiveOrders(vendorId)).filter((o) => o.status === 'pending').map((o) => o.id),
        )
        for (const id of [...ringing.current.keys()]) if (!pending.has(id)) silence(id)
      } catch {
        /* keep ringing — safer than silencing an unaccepted order */
      }
    }
    socket.on('new-order', onNewOrder)
    socket.on('order-status', onOrderStatus)
    socket.io.on('reconnect', onReconnect)
    return () => {
      socket.off('new-order', onNewOrder)
      socket.off('order-status', onOrderStatus)
      socket.io.off('reconnect', onReconnect)
    }
  }, [vendorId, enabled, alertFor, silence])

  useEffect(() => {
    if (!listenDemo) return
    const onDemo = (e: Event) => alertFor((e as CustomEvent<Order>).detail)
    window.addEventListener(DEMO_NEW_ORDER_EVENT, onDemo)
    // Demo orders resolve in the demo store: silence once not pending any more
    const unsub = useDemoStore.subscribe((state) => {
      for (const id of [...ringing.current.keys()]) {
        const o = state.simulatedOrders.find((x) => x.id === id)
        if (!o || o.status !== 'pending') silence(id)
      }
    })
    return () => {
      window.removeEventListener(DEMO_NEW_ORDER_EVENT, onDemo)
      unsub()
    }
  }, [listenDemo, alertFor, silence])

  useEffect(() => {
    const rings = ringing.current
    return () => {
      if (titleRef.current) clearInterval(titleRef.current)
      if (titleOffRef.current) clearTimeout(titleOffRef.current)
      rings.forEach((t) => t && clearTimeout(t))
      rings.clear()
      stopAlertLoop()
    }
  }, [])

  /* Admin wiped the simulated orders: drop their alerts */
  const onSimulationReset = useCallback(() => {
    setAlerts((prev) => {
      prev.filter((a) => a.order.is_simulated).forEach((a) => silence(a.id))
      return prev.filter((a) => !a.order.is_simulated)
    })
  }, [silence])
  useOnSimulationReset(onSimulationReset)

  const dismiss = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }, [])

  return { alerts, dismiss }
}
