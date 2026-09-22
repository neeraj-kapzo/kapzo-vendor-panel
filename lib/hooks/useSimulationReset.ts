'use client'

import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { getSocket } from '@/lib/realtime'
import { useVendorStore } from '@/lib/store/vendorStore'

/**
 * Window event fired after an admin wipes this vendor's simulated orders.
 * Pages holding their own order/money state (Orders, Dashboard, History,
 * Settlements) listen for it and drop simulated rows or refetch.
 */
export const SIMULATION_RESET_EVENT = 'kapzo:simulation-reset'

/**
 * The single `simulation-reset` socket listener, mounted once by the vendor
 * shell (`app/vendor/layout.tsx`). On reset: drop simulated orders from the
 * Zustand store, tell pages via `SIMULATION_RESET_EVENT`, and show a quiet
 * toast. Pass `enabled = false` in demo mode, on shell-less pages (login /
 * onboarding) and before an active vendor is loaded.
 */
export function useSimulationResetListener(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const socket = getSocket()

    const onSimulationReset = () => {
      useVendorStore.getState().removeSimulatedOrders()
      window.dispatchEvent(new Event(SIMULATION_RESET_EVENT))
      toast('Simulated orders were cleared by Kapzo', { icon: '🧪' })
    }

    socket.on('simulation-reset', onSimulationReset)
    return () => {
      socket.off('simulation-reset', onSimulationReset)
    }
  }, [enabled])
}

/** Subscribe a page to `SIMULATION_RESET_EVENT`. `onReset` should be stable. */
export function useOnSimulationReset(onReset: () => void) {
  useEffect(() => {
    window.addEventListener(SIMULATION_RESET_EVENT, onReset)
    return () => window.removeEventListener(SIMULATION_RESET_EVENT, onReset)
  }, [onReset])
}
