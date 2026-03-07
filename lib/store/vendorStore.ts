import { create } from 'zustand'
import type { Vendor, Order, OrderStatus } from '@/types/database.types'

interface VendorStore {
  vendor: Vendor | null
  isOnline: boolean
  pendingOrders: Order[]        // incoming, not yet actioned
  activeOrders: Order[]         // pending + accepted + packing + packed + dispatched
  unreadOrderCount: number      // badge on Orders nav

  setVendor: (vendor: Vendor | null) => void
  setIsOnline: (online: boolean) => void
  setActiveOrders: (orders: Order[]) => void
  addPendingOrder: (order: Order) => void
  clearPendingOrder: (orderId: string) => void
  updateOrderStatus: (orderId: string, status: OrderStatus) => void
}

const ACTIVE_STATUSES = ['pending', 'accepted', 'packing', 'packed', 'dispatched']

export const useVendorStore = create<VendorStore>((set) => ({
  vendor: null,
  isOnline: false,
  pendingOrders: [],
  activeOrders: [],
  unreadOrderCount: 0,

  setVendor: (vendor) => set({ vendor, isOnline: vendor?.is_online ?? false }),

  setIsOnline: (online) => set({ isOnline: online }),

  setActiveOrders: (orders) =>
    set((state) => {
      const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status))
      // Sync pendingOrders to only those still in the fresh list
      const pendingIds = new Set(orders.filter((o) => o.status === 'pending').map((o) => o.id))
      const pendingOrders = state.pendingOrders.filter((o) => pendingIds.has(o.id))
      return {
        activeOrders: active,
        pendingOrders,
        unreadOrderCount: pendingOrders.length,
      }
    }),

  addPendingOrder: (order) =>
    set((state) => {
      const alreadyExists = state.pendingOrders.some((o) => o.id === order.id)
      if (alreadyExists) return state
      const pendingOrders = [order, ...state.pendingOrders]
      const activeOrders = state.activeOrders.some((o) => o.id === order.id)
        ? state.activeOrders
        : [order, ...state.activeOrders]
      return {
        pendingOrders,
        activeOrders,
        unreadOrderCount: pendingOrders.length,
      }
    }),

  clearPendingOrder: (orderId) =>
    set((state) => {
      const pendingOrders = state.pendingOrders.filter((o) => o.id !== orderId)
      return { pendingOrders, unreadOrderCount: pendingOrders.length }
    }),

  updateOrderStatus: (orderId, status) =>
    set((state) => {
      const activeOrders = state.activeOrders
        .map((o) => (o.id === orderId ? { ...o, status } : o))
        .filter((o) => ACTIVE_STATUSES.includes(o.status))
      const pendingOrders = state.pendingOrders.filter((o) => o.id !== orderId)
      return {
        activeOrders,
        pendingOrders,
        unreadOrderCount: pendingOrders.length,
      }
    }),
}))
