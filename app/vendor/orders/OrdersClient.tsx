'use client'

import { useState, useEffect, Fragment } from 'react'
import {
  ShoppingBag, Clock, X, AlertTriangle, Package,
  FileText, CheckCircle2, ChevronRight, Loader2,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { OrderStatusBadge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency, timeAgo, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Order, OrderItem, CatalogItem, OrderStatus } from '@/types/database.types'

/* ─── Types ─── */
export type OrderWithItems = Order & {
  order_items: (OrderItem & { catalog_item: CatalogItem })[]
}

type Tab = 'active' | 'completed' | 'rejected'

/* ─── Constants ─── */
const SVG_R           = 52
const CIRCUMFERENCE   = 2 * Math.PI * SVG_R   // ≈ 326.7
const TIMEOUT_SECS    = 120

const REJECT_REASONS = [
  'Medicine Out of Stock',
  'Stock Damaged',
  'Pharmacy Closing Soon',
  'Cannot Fulfill Quantity',
  'Other',
] as const
type RejectReason = typeof REJECT_REASONS[number]

const STATUS_STEPS: OrderStatus[] = ['accepted', 'packing', 'packed', 'dispatched']

const STATUS_FLOW: Partial<Record<OrderStatus, OrderStatus>> = {
  pending:  'accepted',
  accepted: 'packing',
  packing:  'packed',
  packed:   'dispatched',
}

const ACTION_CONFIG: Partial<Record<OrderStatus, { label: string; bgClass: string; note?: string }>> = {
  pending:  { label: 'Accept Order',      bgClass: 'bg-[#21A053] hover:bg-[#178040]' },
  accepted: { label: 'Start Packing',     bgClass: 'bg-[#00326F] hover:bg-[#002a5c]' },
  packing:  { label: 'Mark as Packed',    bgClass: 'bg-[#21A053] hover:bg-[#178040]' },
  packed:   { label: 'Confirm Dispatched', bgClass: 'bg-slate-700 hover:bg-slate-800',
               note: 'Enable once rider confirms pickup' },
}

const STATUS_DOT: Record<OrderStatus, string> = {
  pending:    'bg-amber-400 animate-pulse',
  accepted:   'bg-blue-400',
  packing:    'bg-purple-400',
  packed:     'bg-indigo-400',
  dispatched: 'bg-[#21A053]',
  delivered:  'bg-[#21A053]',
  rejected:   'bg-red-400',
  cancelled:  'bg-slate-400',
}

/* ─── Helpers ─── */
function deadlineMs(order: Order) {
  return new Date(order.created_at).getTime() + TIMEOUT_SECS * 1_000
}

function fmtCountdown(secs: number) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

function ringStroke(secs: number) {
  if (secs <= 30) return '#EF4444'
  if (secs <= 60) return '#F59E0B'
  return '#21A053'
}

/* ═══════════════════════════════════════════════════════════
   V-05 — Pending Order Timer Card
═══════════════════════════════════════════════════════════ */
interface TimerCardProps {
  order: OrderWithItems
  queueCount: number
  onAccept: () => Promise<void>
  onReject: () => void
  busy: boolean
}

function PendingTimerCard({ order, queueCount, onAccept, onReject, busy }: TimerCardProps) {
  const dl = deadlineMs(order)
  const [timeLeft, setTimeLeft] = useState(
    Math.max(0, Math.ceil((dl - Date.now()) / 1_000))
  )
  const expired = timeLeft === 0

  useEffect(() => {
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((dl - Date.now()) / 1_000)))
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [dl])

  const progress   = timeLeft / TIMEOUT_SECS
  const dashOffset = CIRCUMFERENCE * (1 - progress)
  const color      = ringStroke(timeLeft)
  const isUrgent   = timeLeft <= 30 && !expired

  const totalQty = order.order_items.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className={cn(
      'rounded-2xl border-2 overflow-hidden shadow-lg transition-all duration-500',
      expired  ? 'border-slate-300'
      : isUrgent ? 'border-red-400   shadow-[0_0_0_4px_rgba(239,68,68,0.12)]'
      : timeLeft <= 60 ? 'border-amber-400 shadow-[0_0_0_4px_rgba(245,158,11,0.1)]'
      : 'border-[#21A053] shadow-[0_0_0_4px_rgba(33,160,83,0.1)]'
    )}>
      {/* Header strip */}
      <div className={cn(
        'flex items-center justify-between px-5 py-2.5',
        expired    ? 'bg-slate-500 text-white'
        : isUrgent  ? 'bg-red-500 text-white'
        : timeLeft <= 60 ? 'bg-amber-500 text-white'
        : 'bg-[#21A053] text-white'
      )}>
        <span className="flex items-center gap-2 text-sm font-semibold">
          {!expired && <span className="animate-pulse">●</span>}
          {expired
            ? 'Order Expired — Awaiting server auto-reject'
            : `New Order — Accept within ${fmtCountdown(timeLeft)}`}
        </span>
        {queueCount > 0 && (
          <span className="bg-white/25 px-2 py-0.5 rounded-full text-xs font-bold">
            +{queueCount} waiting
          </span>
        )}
      </div>

      {/* Body */}
      <div className="bg-white p-5 flex flex-col sm:flex-row gap-6 items-start">

        {/* SVG countdown ring */}
        <div className="relative shrink-0 w-36 h-36 mx-auto sm:mx-0">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            {/* Track */}
            <circle cx="60" cy="60" r={SVG_R} fill="none" stroke="#e2e8f0" strokeWidth="8" />
            {/* Progress arc */}
            <circle
              cx="60" cy="60" r={SVG_R}
              fill="none"
              stroke={expired ? '#cbd5e1' : color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.5s ease' }}
            />
          </svg>
          {/* Centered label (un-rotated) */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="font-bold tabular-nums leading-none text-5xl"
              style={{ color: expired ? '#94a3b8' : color }}
            >
              {fmtCountdown(timeLeft)}
            </span>
            <span className="text-[10px] text-slate-400 mt-2 font-semibold uppercase tracking-widest">
              {expired ? 'expired' : 'remaining'}
            </span>
          </div>
        </div>

        {/* Order info */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-[#022135]">
              #{order.id.slice(-6).toUpperCase()}
            </span>
            {order.prescription_verified && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#21A053] bg-[#21A053]/10 px-2 py-0.5 rounded-full">
                <FileText size={10} /> Rx Verified
              </span>
            )}
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock size={11} /> {timeAgo(order.created_at)}
            </span>
          </div>

          {/* Items preview */}
          <div className="bg-slate-50 rounded-xl overflow-hidden divide-y divide-slate-100">
            {order.order_items.slice(0, 4).map((item) => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#022135] truncate">{item.catalog_item.name}</p>
                  {item.catalog_item.salt_name && (
                    <p className="text-[10px] text-slate-400 truncate">{item.catalog_item.salt_name}</p>
                  )}
                </div>
                <span className="text-xs text-slate-500 shrink-0 ml-3 tabular-nums">
                  ×{item.quantity} · {formatCurrency(item.unit_price * item.quantity)}
                </span>
              </div>
            ))}
            {order.order_items.length > 4 && (
              <p className="px-3 py-1.5 text-xs text-slate-400 text-center">
                +{order.order_items.length - 4} more items
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {totalQty} item{totalQty !== 1 ? 's' : ''} total
            </span>
            <span className="text-lg font-bold text-[#022135] tabular-nums">
              {formatCurrency(order.total_amount)}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onReject}
              disabled={busy}
              className="flex-1 h-11 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
            <button
              onClick={onAccept}
              disabled={busy || expired}
              className="flex-1 h-11 rounded-xl bg-[#21A053] text-white text-sm font-bold hover:bg-[#178040] active:bg-[#178040] transition-colors disabled:opacity-50 shadow-[0_2px_12px_rgba(33,160,83,0.3)]"
            >
              {busy
                ? <Loader2 size={16} className="animate-spin mx-auto" />
                : expired ? 'Expired' : 'Accept Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   V-06 — Order Progress Timeline
═══════════════════════════════════════════════════════════ */
function OrderTimeline({ status }: { status: OrderStatus }) {
  const currentIdx = STATUS_STEPS.indexOf(status)

  return (
    <div className="flex items-start">
      {STATUS_STEPS.map((step, i) => {
        const done   = i < currentIdx
        const active = i === currentIdx

        return (
          <Fragment key={step}>
            {i > 0 && (
              <div className={cn(
                'flex-1 h-0.5 mt-[11px]',
                done || active ? 'bg-[#21A053]' : 'bg-slate-200'
              )} />
            )}
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className={cn(
                'w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center transition-all',
                active ? 'border-[#21A053] bg-[#21A053]'
                  : done  ? 'border-[#21A053] bg-[#21A053]'
                  : 'border-slate-200 bg-white'
              )}>
                {(done || active) && (
                  <CheckCircle2 size={12} className="text-white" strokeWidth={3} />
                )}
              </div>
              <span className={cn(
                'text-[10px] font-semibold capitalize',
                active ? 'text-[#21A053]'
                  : done ? 'text-[#21A053]'
                  : 'text-slate-400'
              )}>
                {step}
              </span>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   V-06 — Order Detail Side Panel
═══════════════════════════════════════════════════════════ */
interface DetailPanelProps {
  order: OrderWithItems
  onClose: () => void
  onAdvance: () => Promise<void>
  onReject: () => void
  busy: boolean
}

function OrderDetailPanel({ order, onClose, onAdvance, onReject, busy }: DetailPanelProps) {
  const action    = ACTION_CONFIG[order.status]
  const canReject = ['pending', 'accepted', 'packing'].includes(order.status)
  const showSteps = STATUS_STEPS.includes(order.status as OrderStatus)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-[#022135]/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[460px] z-50 bg-white flex flex-col overflow-hidden shadow-[-8px_0_40px_rgba(2,33,53,0.14)] animate-slide-in-right">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Order Details</p>
            <h2 className="text-xl font-bold text-[#022135] mt-0.5">
              #{order.id.slice(-6).toUpperCase()}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-[#022135] hover:bg-slate-100 transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Progress timeline */}
          {showSteps && (
            <div className="px-5 py-5 border-b border-slate-100">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-4">
                Workflow Progress
              </p>
              <OrderTimeline status={order.status} />
            </div>
          )}

          {/* Meta */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock size={12} />
              Placed {timeAgo(order.created_at)} — {formatDate(order.created_at)}
            </span>
            {order.prescription_verified && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#21A053] bg-[#21A053]/10 px-2 py-0.5 rounded-full">
                <FileText size={10} /> Rx Verified
              </span>
            )}
          </div>

          {/* Items table */}
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-3">
              Items
            </p>
            <div className="rounded-xl overflow-hidden border border-slate-100">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Medicine</th>
                    <th className="text-center px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Qty</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Unit</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.order_items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3 py-2.5">
                        <p className="text-xs font-semibold text-[#022135]">{item.catalog_item.name}</p>
                        {item.catalog_item.salt_name && (
                          <p className="text-[10px] text-slate-400 mt-0.5">{item.catalog_item.salt_name}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-slate-600 tabular-nums">{item.quantity}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-slate-500 tabular-nums">{formatCurrency(item.unit_price)}</td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold text-[#022135] tabular-nums">
                        {formatCurrency(item.unit_price * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-100">
                    <td colSpan={3} className="px-3 py-2.5 text-xs font-semibold text-slate-500">Order Total</td>
                    <td className="px-3 py-2.5 text-right text-sm font-bold text-[#022135] tabular-nums">
                      {formatCurrency(order.total_amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Rejection reason (if rejected) */}
          {order.rejection_reason && (
            <div className="px-5 py-4">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-2">
                Rejection Reason
              </p>
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{order.rejection_reason}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {action && (
          <div className="shrink-0 border-t border-slate-100 px-5 py-4 space-y-2 bg-white">
            {action.note && (
              <p className="text-[11px] text-slate-400 text-center">{action.note}</p>
            )}
            <button
              onClick={onAdvance}
              disabled={busy}
              className={cn(
                'w-full h-11 rounded-xl text-white text-sm font-bold transition-colors disabled:opacity-50',
                action.bgClass
              )}
            >
              {busy
                ? <Loader2 size={16} className="animate-spin mx-auto" />
                : action.label}
            </button>
            {canReject && (
              <button
                onClick={onReject}
                disabled={busy}
                className="w-full h-9 rounded-xl text-red-500 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Reject Order
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════
   V-07 — Rejection Modal
═══════════════════════════════════════════════════════════ */
interface RejectionModalProps {
  order: OrderWithItems | null
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
  busy: boolean
}

function RejectionModal({ order, onClose, onConfirm, busy }: RejectionModalProps) {
  const [reason, setReason] = useState<RejectReason | ''>('')
  const [custom, setCustom] = useState('')

  useEffect(() => {
    if (!order) { setReason(''); setCustom('') }
  }, [order])

  const finalReason = reason === 'Other' ? custom.trim() : reason
  const canSubmit   = reason !== '' && (reason !== 'Other' || custom.trim().length > 0)

  return (
    <Modal open={!!order} onClose={onClose} size="md">
      {/* Red warning header — extends to modal edges */}
      <div className="-mx-5 -mt-4 mb-5 bg-red-50 border-b border-red-100 px-5 py-4 flex items-center gap-3 rounded-t-[12px]">
        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
          <AlertTriangle size={20} className="text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-red-700 text-sm">
            Reject Order #{order?.id.slice(-6).toUpperCase()}
          </p>
          <p className="text-xs text-red-400 mt-0.5">This action cannot be undone. Customer will be notified.</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-red-300 hover:text-red-500 hover:bg-red-100 transition-colors shrink-0"
        >
          <X size={15} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Reason dropdown */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Select Reason
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as RejectReason | '')}
            className="w-full h-10 px-3 rounded-[8px] border border-slate-200 text-sm text-[#022135] bg-white focus:outline-none focus:ring-2 focus:ring-[#21A053]/30 focus:border-[#21A053] appearance-none cursor-pointer"
          >
            <option value="" disabled>Choose a reason…</option>
            {REJECT_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Free-text for "Other" */}
        {reason === 'Other' && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Specify Reason
            </label>
            <textarea
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Describe the reason for rejection…"
              rows={3}
              className="w-full px-3 py-2.5 rounded-[8px] border border-slate-200 text-sm text-[#022135] resize-none focus:outline-none focus:ring-2 focus:ring-[#21A053]/30 focus:border-[#21A053]"
            />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => order && onConfirm(finalReason)}
            disabled={!canSubmit || busy}
            className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin mx-auto" /> : 'Reject Order'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ═══════════════════════════════════════════════════════════
   Order Row — single row in the list
═══════════════════════════════════════════════════════════ */
function OrderRow({
  order,
  onView,
}: {
  order: OrderWithItems | Order
  onView: () => void
}) {
  const hasItems  = 'order_items' in order
  const totalQty  = hasItems
    ? (order as OrderWithItems).order_items.reduce((s, i) => s + i.quantity, 0)
    : null
  const isPending = order.status === 'pending'

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3.5 bg-white rounded-2xl border transition-all hover:shadow-md group',
      isPending
        ? 'border-amber-200 shadow-[0_0_0_2px_rgba(245,158,11,0.1)]'
        : 'border-slate-100 shadow-sm hover:border-[#21A053]/25'
    )}>
      {/* Status dot */}
      <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', STATUS_DOT[order.status])} />

      {/* Order ID */}
      <span className="font-mono text-sm font-bold text-[#022135] shrink-0 w-20">
        #{order.id.slice(-6).toUpperCase()}
      </span>

      {/* Middle info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {totalQty !== null && (
            <span className="flex items-center gap-1">
              <Package size={11} />
              {totalQty} item{totalQty !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-slate-300">·</span>
          <span className="font-bold text-[#022135] tabular-nums">{formatCurrency(order.total_amount)}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
          <Clock size={10} />
          {timeAgo(order.created_at)}
          {order.prescription_verified && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-[#21A053] font-semibold flex items-center gap-0.5">
                <FileText size={9} /> Rx
              </span>
            </>
          )}
        </div>
      </div>

      {/* Status badge (desktop) */}
      <div className="shrink-0 hidden sm:block">
        <OrderStatusBadge status={order.status} />
      </div>

      {/* View button */}
      <button
        onClick={onView}
        className="shrink-0 flex items-center gap-0.5 text-xs font-semibold text-[#21A053] hover:text-[#178040] px-3 py-1.5 rounded-[8px] hover:bg-[#21A053]/8 transition-all"
      >
        View <ChevronRight size={13} />
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Empty State
═══════════════════════════════════════════════════════════ */
function EmptyState({ title, subtitle, tab }: { title: string; subtitle: string; tab: Tab }) {
  const isRejected = tab === 'rejected'
  return (
    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className={cn(
        'w-16 h-16 rounded-2xl flex items-center justify-center mb-4',
        isRejected ? 'bg-red-50' : 'bg-[#21A053]/8'
      )}>
        {isRejected
          ? <AlertTriangle size={28} className="text-red-200" />
          : <ShoppingBag   size={28} className="text-[#21A053]/30" />}
      </div>
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="text-xs text-slate-400 mt-1 text-center max-w-xs px-4">{subtitle}</p>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Main exported component
═══════════════════════════════════════════════════════════ */
interface OrdersClientProps {
  vendorId: string
  initialActive: OrderWithItems[]
  initialClosed: Order[]
}

export function OrdersClient({ vendorId, initialActive, initialClosed }: OrdersClientProps) {
  const [activeOrders, setActiveOrders] = useState<OrderWithItems[]>(
    [...initialActive].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  )
  const [closedOrders, setClosedOrders] = useState<Order[]>(initialClosed)
  const [tab, setTab]                   = useState<Tab>('active')
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null)
  const [rejectTarget, setRejectTarget]   = useState<OrderWithItems | null>(null)
  const [busyId, setBusyId]               = useState<string | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  /* ── Pending queue for timer ── */
  const pendingQueue = activeOrders
    .filter((o) => o.status === 'pending')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const currentPending = pendingQueue[0]
  const queueCount     = pendingQueue.length - 1

  /* ── Fetch full order with items (for realtime INSERTs + detail view) ── */
  async function fetchOrderWithItems(orderId: string): Promise<OrderWithItems | null> {
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*, catalog_item:catalog_items(*))')
      .eq('id', orderId)
      .single()
    return data as OrderWithItems | null
  }

  /* ── Realtime subscription ── */
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('orders-client-v2')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `vendor_id=eq.${vendorId}` },
        async (payload) => {
          const full = await fetchOrderWithItems((payload.new as Order).id)
          if (!full) return
          setActiveOrders((prev) => {
            if (prev.some((o) => o.id === full.id)) return prev
            return [...prev, full]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `vendor_id=eq.${vendorId}` },
        (payload) => {
          const updated = payload.new as Order
          const closed  = ['delivered', 'rejected', 'cancelled'].includes(updated.status)

          if (closed) {
            setActiveOrders((prev) => prev.filter((o) => o.id !== updated.id))
            setClosedOrders((prev) => {
              if (prev.some((o) => o.id === updated.id)) {
                return prev.map((o) => o.id === updated.id ? { ...o, ...updated } : o)
              }
              return [updated, ...prev]
            })
            setSelectedOrder((prev) => prev?.id === updated.id ? null : prev)
          } else {
            setActiveOrders((prev) =>
              prev.map((o) => o.id === updated.id ? { ...o, ...updated } : o)
            )
            setSelectedOrder((prev) =>
              prev?.id === updated.id ? { ...prev, ...updated } : prev
            )
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId])

  /* ── Open detail (fetch items if needed) ── */
  async function openDetail(orderId: string) {
    const cached = activeOrders.find((o) => o.id === orderId)
    if (cached) { setSelectedOrder(cached); return }
    setLoadingDetail(true)
    const full = await fetchOrderWithItems(orderId)
    setLoadingDetail(false)
    if (full) setSelectedOrder(full)
  }

  /* ── Advance order to next status ── */
  async function advanceStatus(order: OrderWithItems) {
    const next = STATUS_FLOW[order.status]
    if (!next) return

    setBusyId(order.id)
    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', order.id)

    if (error) {
      toast.error('Failed to update order')
      setBusyId(null)
      return
    }

    if (next === 'accepted')   toast.success('Order accepted!')
    else if (next === 'packed') toast.success('Order packed — notifying riders', { icon: '🛵' })
    else                        toast.success(`Order is now ${next}`)

    setActiveOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: next } : o))
    setSelectedOrder((prev) => prev?.id === order.id ? { ...prev, status: next } : prev)
    setBusyId(null)
  }

  /* ── Reject order ── */
  async function rejectOrder(orderId: string, reason: string) {
    setBusyId(orderId)
    const found   = activeOrders.find((o) => o.id === orderId)
    const supabase = createClient()

    const { error } = await supabase
      .from('orders')
      .update({ status: 'rejected', rejection_reason: reason, updated_at: new Date().toISOString() })
      .eq('id', orderId)

    if (error) {
      toast.error('Failed to reject order')
      setBusyId(null)
      return
    }

    toast.success('Order rejected — customer notified')
    setActiveOrders((prev) => prev.filter((o) => o.id !== orderId))
    if (found) {
      setClosedOrders((prev) => [
        { ...found, status: 'rejected', rejection_reason: reason },
        ...prev,
      ])
    }
    setRejectTarget(null)
    setSelectedOrder((prev) => prev?.id === orderId ? null : prev)
    setBusyId(null)
  }

  /* ── Tab config ── */
  const tabData: Record<Tab, (OrderWithItems | Order)[]> = {
    active:    activeOrders,
    completed: closedOrders.filter((o) => o.status === 'delivered'),
    rejected:  closedOrders.filter((o) => ['rejected', 'cancelled'].includes(o.status)),
  }

  const TAB_CONFIG: { key: Tab; label: string }[] = [
    { key: 'active',    label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'rejected',  label: 'Rejected' },
  ]

  const EMPTY: Record<Tab, { title: string; subtitle: string }> = {
    active:    { title: 'No active orders', subtitle: 'New orders will appear here in real-time as customers place them' },
    completed: { title: 'No completed orders yet', subtitle: 'Delivered orders will appear here' },
    rejected:  { title: 'No rejected orders', subtitle: 'Rejected or cancelled orders will appear here' },
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">

      {/* ── Page header ── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#022135]">Orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeOrders.length} active
            {pendingQueue.length > 0 && (
              <span className="ml-1 text-amber-600 font-semibold">
                · {pendingQueue.length} pending response
              </span>
            )}
          </p>
        </div>
        {loadingDetail && (
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Loader2 size={13} className="animate-spin" /> Loading…
          </span>
        )}
      </div>

      {/* ── V-05: Pending timer card ── */}
      {currentPending && (
        <PendingTimerCard
          order={currentPending}
          queueCount={queueCount}
          onAccept={async () => advanceStatus(currentPending)}
          onReject={() => setRejectTarget(currentPending)}
          busy={busyId === currentPending.id}
        />
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TAB_CONFIG.map(({ key, label }) => {
          const count = tabData[key].length
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-[8px] text-sm font-medium transition-all',
                tab === key
                  ? 'bg-white text-[#022135] shadow-sm'
                  : 'text-slate-500 hover:text-[#022135]'
              )}
            >
              {label}
              {count > 0 && (
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
                  tab === key
                    ? key === 'rejected'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-[#21A053]/12 text-[#21A053]'
                    : 'bg-slate-200 text-slate-500'
                )}>
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Orders list ── */}
      {tabData[tab].length === 0 ? (
        <EmptyState tab={tab} {...EMPTY[tab]} />
      ) : (
        <div className="flex flex-col gap-2">
          {tabData[tab].map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              onView={() => openDetail(order.id)}
            />
          ))}
        </div>
      )}

      {/* ── V-06: Detail panel ── */}
      {selectedOrder && (
        <OrderDetailPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onAdvance={async () => advanceStatus(selectedOrder)}
          onReject={() => setRejectTarget(selectedOrder)}
          busy={busyId === selectedOrder.id}
        />
      )}

      {/* ── V-07: Rejection modal ── */}
      <RejectionModal
        order={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={async (reason) => {
          if (rejectTarget) await rejectOrder(rejectTarget.id, reason)
        }}
        busy={!!busyId && busyId === rejectTarget?.id}
      />
    </div>
  )
}
