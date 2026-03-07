'use client'

import { useEffect, useState } from 'react'
import { ShoppingBag, X, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatCurrency, timeAgo } from '@/lib/utils'
import type { Order } from '@/types/database.types'

interface NewOrderAlert {
  id: string
  order: Order
}

interface NewOrderToastProps {
  alerts: NewOrderAlert[]
  onDismiss: (id: string) => void
}

export function NewOrderToastContainer({ alerts, onDismiss }: NewOrderToastProps) {
  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
      {alerts.map((a) => (
        <NewOrderToastItem key={a.id} alert={a} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function NewOrderToastItem({
  alert,
  onDismiss,
}: {
  alert: NewOrderAlert
  onDismiss: (id: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 10)
    const hide = setTimeout(() => dismiss(), 8000)
    return () => { clearTimeout(show); clearTimeout(hide) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function dismiss() {
    setLeaving(true)
    setTimeout(() => onDismiss(alert.id), 350)
  }

  return (
    <div
      className={cn(
        'pointer-events-auto w-72 bg-white rounded-2xl shadow-[0_8px_32px_rgba(2,33,53,0.18)]',
        'border-l-4 border-[#21A053] overflow-hidden',
        'transition-all duration-350',
        visible && !leaving ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
      )}
    >
      {/* Progress bar */}
      <div className="h-0.5 bg-[#21A053]/20 relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-[#21A053] animate-[progress-fill_8s_linear_forwards]" style={{ width: '100%' }} />
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-[#21A053]/10 flex items-center justify-center">
            <ShoppingBag size={17} className="text-[#21A053]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-[#21A053] uppercase tracking-wider">New Order!</p>
              <button onClick={dismiss} className="text-slate-300 hover:text-slate-500 transition-colors -mt-0.5">
                <X size={13} />
              </button>
            </div>
            <p className="text-sm font-semibold text-[#022135] mt-0.5">
              #{alert.order.id.slice(-6).toUpperCase()}
            </p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-slate-400">{timeAgo(alert.order.created_at)}</span>
              <span className="text-xs font-bold text-[#022135]">{formatCurrency(alert.order.total_amount)}</span>
            </div>
          </div>
        </div>

        <Link
          href="/vendor/orders"
          onClick={dismiss}
          className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-[#21A053] text-white text-xs font-semibold hover:bg-[#178040] transition-colors"
        >
          View Order <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  )
}
