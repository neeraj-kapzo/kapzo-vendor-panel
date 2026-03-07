'use client'

import { useState } from 'react'
import { Clock, MapPin, Package, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent, CardFooter } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { OrderStatusBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, timeAgo } from '@/lib/utils'
import type { Order, OrderItem, CatalogItem, OrderStatus } from '@/types/database.types'
import toast from 'react-hot-toast'

type OrderItemWithCatalog = OrderItem & { catalog_item: CatalogItem }

interface OrderCardProps {
  order: Order & { order_items?: OrderItemWithCatalog[] }
  onStatusChange?: (orderId: string, status: OrderStatus) => void
}

const nextStatusMap: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'accepted',
  accepted: 'packing',
  packing: 'packed',
  packed: 'dispatched',
}

const actionLabels: Partial<Record<OrderStatus, string>> = {
  pending: 'Accept Order',
  accepted: 'Start Packing',
  packing: 'Mark Packed',
  packed: 'Dispatch',
}

export function OrderCard({ order, onStatusChange }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState(false)

  const nextStatus = nextStatusMap[order.status]
  const actionLabel = actionLabels[order.status]
  const canReject = order.status === 'pending' || order.status === 'accepted'

  async function advanceStatus() {
    if (!nextStatus) return
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', order.id)

    if (error) {
      toast.error('Failed to update order status')
    } else {
      toast.success(`Order marked as ${nextStatus}`)
      onStatusChange?.(order.id, nextStatus)
    }
    setLoading(false)
  }

  async function rejectOrder() {
    if (!rejectReason.trim()) return
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'rejected',
        rejection_reason: rejectReason.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    if (error) {
      toast.error('Failed to reject order')
    } else {
      toast.success('Order rejected')
      onStatusChange?.(order.id, 'rejected')
      setRejectOpen(false)
    }
    setLoading(false)
  }

  return (
    <>
      <Card hover className="overflow-hidden">
        {/* Top: Order ID + status + time */}
        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-[#022135]">
                #{order.id.slice(-6).toUpperCase()}
              </span>
              <OrderStatusBadge status={order.status} />
              {order.prescription_verified && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#21A053] bg-[#21A053]/8 px-2 py-0.5 rounded-[999px]">
                  <FileText size={10} /> Rx Verified
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
              <Clock size={11} />
              <span>{timeAgo(order.created_at)}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-base font-bold text-[#022135]">{formatCurrency(order.total_amount)}</p>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#022135] mt-0.5 ml-auto"
            >
              {expanded ? 'Less' : 'Details'}
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>

        {/* Expanded items */}
        {expanded && order.order_items && (
          <div className="mx-5 mb-3 bg-slate-50 rounded-[8px] divide-y divide-slate-100">
            {order.order_items.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#022135] truncate">{item.catalog_item.name}</p>
                  {item.catalog_item.salt_name && (
                    <p className="text-[10px] text-slate-400 truncate">{item.catalog_item.salt_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className="text-xs text-slate-500">×{item.quantity}</span>
                  <span className="text-xs font-semibold text-[#022135]">{formatCurrency(item.unit_price)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        {(actionLabel || canReject) && (
          <CardFooter className="flex gap-2 justify-end">
            {canReject && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRejectOpen(true)}
                className="text-red-500 hover:bg-red-50 hover:text-red-600"
              >
                Reject
              </Button>
            )}
            {actionLabel && nextStatus && (
              <Button size="sm" onClick={advanceStatus} loading={loading}>
                {actionLabel}
              </Button>
            )}
          </CardFooter>
        )}
      </Card>

      {/* Reject modal */}
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject Order">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Please provide a reason for rejecting order <strong>#{order.id.slice(-6).toUpperCase()}</strong>.
          </p>
          <Input
            label="Rejection Reason"
            placeholder="e.g. Medicine out of stock, Cannot fulfil prescription..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" size="sm" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={rejectOrder} loading={loading} disabled={!rejectReason.trim()}>
              Reject Order
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
