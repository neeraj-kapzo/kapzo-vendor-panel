import { Clock, Package, FileText } from 'lucide-react'
import { cn, formatCurrency, timeAgo } from '@/lib/utils'
import type { Order, OrderStatus } from '@/types/database.types'

interface OrderFeedCardProps {
  order: Order & { itemCount?: number }
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; bg: string; text: string; dot: string }> = {
  pending:    { label: 'Pending',    bg: 'bg-amber-100',   text: 'text-amber-700',  dot: 'bg-amber-400' },
  accepted:   { label: 'Accepted',   bg: 'bg-blue-100',    text: 'text-blue-700',   dot: 'bg-blue-400' },
  packing:    { label: 'Packing',    bg: 'bg-purple-100',  text: 'text-purple-700', dot: 'bg-purple-400' },
  packed:     { label: 'Packed',     bg: 'bg-indigo-100',  text: 'text-indigo-700', dot: 'bg-indigo-400' },
  dispatched: { label: 'Dispatched', bg: 'bg-[#21A053]/12', text: 'text-[#178040]', dot: 'bg-[#21A053]' },
  delivered:  { label: 'Delivered',  bg: 'bg-[#21A053]/10', text: 'text-[#21A053]', dot: 'bg-[#21A053]' },
  rejected:   { label: 'Rejected',   bg: 'bg-red-100',     text: 'text-red-600',    dot: 'bg-red-400' },
  cancelled:  { label: 'Cancelled',  bg: 'bg-slate-100',   text: 'text-slate-500',  dot: 'bg-slate-400' },
}

export function OrderFeedCard({ order }: OrderFeedCardProps) {
  const s = STATUS_CONFIG[order.status]
  const isPending = order.status === 'pending'

  return (
    <div className={cn(
      'flex items-center gap-4 px-5 py-4 rounded-2xl bg-white border transition-all',
      isPending ? 'border-amber-200 shadow-[0_0_0_2px_rgba(245,158,11,0.12)]' : 'border-slate-100 shadow-sm'
    )}>
      {/* Status dot */}
      <div className={cn('shrink-0 w-2.5 h-2.5 rounded-full', s.dot,
        isPending && 'animate-pulse'
      )} />

      {/* Order ID + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-[#022135]">
            #{order.id.slice(-6).toUpperCase()}
          </span>
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold', s.bg, s.text)}>
            {s.label}
          </span>
          {order.prescription_verified && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[#21A053]/10 text-[#21A053]">
              <FileText size={9} /> Rx
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Clock size={10} />{timeAgo(order.created_at)}
          </span>
          {order.itemCount !== undefined && (
            <span className="flex items-center gap-1">
              <Package size={10} />{order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-[#022135] tabular-nums">{formatCurrency(order.total_amount)}</p>
      </div>
    </div>
  )
}
