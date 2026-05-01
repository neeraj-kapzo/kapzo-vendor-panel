'use client'

/**
 * Zustand store used exclusively in demo mode to share simulated orders
 * between DashboardClient (which triggers them) and OrdersClient (which displays them).
 */

import { create } from 'zustand'
import type { DemoOrderWithItems } from './index'
import type { OrderStatus } from '@/types/database.types'

interface DemoStore {
  simulatedOrders: DemoOrderWithItems[]
  addSimulatedOrder:     (order: DemoOrderWithItems) => void
  advanceSimulatedOrder: (orderId: string) => void
  rejectSimulatedOrder:  (orderId: string, reason: string) => void
  removeSimulatedOrder:  (orderId: string) => void
}

const STATUS_FLOW: Partial<Record<OrderStatus, OrderStatus>> = {
  pending:  'accepted',
  accepted: 'packing',
  packing:  'packed',
  packed:   'dispatched',
}

export const useDemoStore = create<DemoStore>((set) => ({
  simulatedOrders: [],

  addSimulatedOrder: (order) =>
    set((s) => ({
      simulatedOrders: [order, ...s.simulatedOrders],
    })),

  advanceSimulatedOrder: (orderId) =>
    set((s) => ({
      simulatedOrders: s.simulatedOrders.map((o) => {
        if (o.id !== orderId) return o
        const next = STATUS_FLOW[o.status]
        return next ? { ...o, status: next } : o
      }),
    })),

  rejectSimulatedOrder: (orderId, reason) =>
    set((s) => ({
      simulatedOrders: s.simulatedOrders.map((o) =>
        o.id === orderId
          ? { ...o, status: 'rejected' as OrderStatus, rejection_reason: reason }
          : o
      ),
    })),

  removeSimulatedOrder: (orderId) =>
    set((s) => ({
      simulatedOrders: s.simulatedOrders.filter((o) => o.id !== orderId),
    })),
}))
