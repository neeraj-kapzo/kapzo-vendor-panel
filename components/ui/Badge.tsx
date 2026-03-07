import { cn } from '@/lib/utils'
import type { OrderStatus, VendorStatus } from '@/types/database.types'

type BadgeVariant = 'green' | 'navy' | 'amber' | 'red' | 'gray' | 'blue'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  green: 'bg-[#21A053]/10 text-[#178040] border border-[#21A053]/20',
  navy: 'bg-[#00326F]/10 text-[#00326F] border border-[#00326F]/20',
  amber: 'bg-amber-50 text-amber-700 border border-amber-200',
  red: 'bg-red-50 text-red-700 border border-red-200',
  gray: 'bg-slate-100 text-slate-600 border border-slate-200',
  blue: 'bg-blue-50 text-blue-700 border border-blue-200',
}

export function Badge({ variant = 'gray', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-[999px] text-xs font-medium',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

/* ─── Order status badge ─── */
const orderStatusMap: Record<OrderStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Pending', variant: 'amber' },
  accepted: { label: 'Accepted', variant: 'blue' },
  packing: { label: 'Packing', variant: 'navy' },
  packed: { label: 'Packed', variant: 'navy' },
  dispatched: { label: 'Dispatched', variant: 'blue' },
  delivered: { label: 'Delivered', variant: 'green' },
  rejected: { label: 'Rejected', variant: 'red' },
  cancelled: { label: 'Cancelled', variant: 'gray' },
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, variant } = orderStatusMap[status]
  return <Badge variant={variant}>{label}</Badge>
}

/* ─── Vendor status badge ─── */
const vendorStatusMap: Record<VendorStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Pending Approval', variant: 'amber' },
  active: { label: 'Active', variant: 'green' },
  banned: { label: 'Banned', variant: 'red' },
}

export function VendorStatusBadge({ status }: { status: VendorStatus }) {
  const { label, variant } = vendorStatusMap[status]
  return <Badge variant={variant}>{label}</Badge>
}
