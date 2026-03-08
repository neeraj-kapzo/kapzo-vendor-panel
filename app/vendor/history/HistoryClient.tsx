'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import {
  Download, ChevronLeft, ChevronRight, X, Copy, Check,
  Clock, Package, FileText, AlertTriangle, History,
  IndianRupee, ShoppingBag, TrendingUp, Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { OrderStatus } from '@/types/database.types'

/* ─── Types ─── */
type DatePreset = 'today' | 'week' | 'month' | 'custom'

type HistoryOrderItem = {
  quantity:     number
  unit_price:   number
  catalog_item: { name: string }
}

type HistoryOrder = {
  id:                   string
  status:               OrderStatus
  total_amount:         number
  created_at:           string
  updated_at:           string
  rejection_reason:     string | null
  prescription_verified: boolean
  order_items:          HistoryOrderItem[]
}

type Summary = { orders: number; revenue: number }

/* ─── Constants ─── */
const PAGE_SIZE = 20

const PRESET_LABELS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
]

const STATUS_STYLES: Partial<Record<OrderStatus, string>> = {
  delivered: 'bg-green-100 text-green-700',
  rejected:  'bg-red-100   text-red-700',
  cancelled: 'bg-gray-100  text-gray-500',
}

/* ─── Helpers ─── */
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function getDateRange(preset: DatePreset, customFrom: string, customTo: string): [string, string] {
  const now  = new Date()
  if (preset === 'today') {
    const s = new Date(now); s.setHours(0, 0, 0, 0)
    const e = new Date(now); e.setHours(23, 59, 59, 999)
    return [s.toISOString(), e.toISOString()]
  }
  if (preset === 'week') {
    const s = new Date(now); s.setDate(now.getDate() - 6); s.setHours(0, 0, 0, 0)
    return [s.toISOString(), now.toISOString()]
  }
  if (preset === 'month') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1)
    return [s.toISOString(), now.toISOString()]
  }
  /* custom */
  const s = customFrom ? new Date(customFrom + 'T00:00:00') : new Date(0)
  const e = customTo   ? new Date(customTo   + 'T23:59:59') : now
  return [s.toISOString(), e.toISOString()]
}

function itemsPreview(items: HistoryOrderItem[]): string {
  if (!items.length) return '—'
  const first = items[0].catalog_item.name
  const rest  = items.length - 1
  return rest > 0 ? `${first} +${rest} more` : first
}

function fmtDate(iso: string) {
  return format(new Date(iso), 'd MMM, h:mm a')
}

function getPageNums(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const near: number[] = []
  for (let i = Math.max(2, current - 2); i <= Math.min(total - 1, current + 2); i++) near.push(i)
  const pages: (number | '…')[] = [1]
  if (near[0] > 2) pages.push('…')
  pages.push(...near)
  if (near[near.length - 1] < total - 1) pages.push('…')
  if (total > 1) pages.push(total)
  return pages
}

/* ═══════════════════════════════════════════════════════════
   Animated counter hook — counts from 0 to target over 700ms
═══════════════════════════════════════════════════════════ */
function useCountUp(target: number, durationMs = 700): number {
  const [displayed, setDisplayed] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const t0 = performance.now()

    function tick(now: number) {
      const elapsed = Math.min((now - t0) / durationMs, 1)
      const eased   = 1 - Math.pow(1 - elapsed, 3)   // cubic ease-out
      setDisplayed(Math.round(target * eased))
      if (elapsed < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, durationMs])

  return displayed
}

/* ═══════════════════════════════════════════════════════════
   Summary card with animated number
═══════════════════════════════════════════════════════════ */
function SummaryCard({
  label, rawValue, display, icon: Icon, accentColor, loading,
}: {
  label:       string
  rawValue:    number
  display:     (n: number) => string
  icon:        React.ElementType
  accentColor: string
  loading:     boolean
}) {
  const animated = useCountUp(Math.round(rawValue))

  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
      style={{ borderLeft: `4px solid ${accentColor}` }}
    >
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
          {loading ? (
            <div className="mt-2 h-8 w-24 rounded-lg bg-slate-100 animate-pulse" />
          ) : (
            <p className="mt-1.5 text-3xl font-bold text-[#022135] leading-none tabular-nums">
              {display(animated)}
            </p>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accentColor}15` }}
        >
          <Icon size={18} style={{ color: accentColor }} />
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Order detail slide-over
═══════════════════════════════════════════════════════════ */
function DetailPanel({ order, onClose }: { order: HistoryOrder; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  function copyId() {
    navigator.clipboard.writeText(order.id).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => toast.error('Could not copy'))
  }

  const timelineEvents = [
    { label: 'Order Placed',  time: order.created_at,  color: '#21A053' },
    ...(order.updated_at !== order.created_at ? [{
      label: `Order ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}`,
      time:  order.updated_at,
      color: order.status === 'delivered' ? '#21A053'
           : order.status === 'rejected'  ? '#EF4444'
           : '#94a3b8',
    }] : []),
  ]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#022135]/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full sm:w-[460px] z-50 bg-white flex flex-col overflow-hidden shadow-[-8px_0_40px_rgba(2,33,53,0.14)] animate-slide-in-right">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Order Details</p>
            <div className="flex items-center gap-2 mt-0.5">
              <h2 className="font-mono text-xl font-bold text-[#00326F]">
                #{order.id.slice(-8).toUpperCase()}
              </h2>
              <button
                onClick={copyId}
                className="p-1 rounded-lg text-slate-300 hover:text-[#00326F] hover:bg-slate-100 transition-colors"
                title="Copy full Order ID"
              >
                {copied ? <Check size={13} className="text-[#21A053]" /> : <Copy size={13} />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize',
              STATUS_STYLES[order.status] ?? 'bg-slate-100 text-slate-500'
            )}>
              {order.status}
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-[#022135] hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">

          {/* Meta */}
          <div className="px-5 py-4 space-y-1">
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Clock size={13} />
              {format(new Date(order.updated_at), 'd MMMM yyyy, h:mm a')}
            </p>
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <Package size={13} />
              Customer Zone: Area info not available
            </p>
            {order.prescription_verified && (
              <span className="inline-flex items-center gap-1.5 mt-1 text-[11px] font-semibold text-[#21A053] bg-[#21A053]/10 px-2.5 py-0.5 rounded-full">
                <FileText size={11} /> Prescription Verified
              </span>
            )}
          </div>

          {/* Items table */}
          <div className="px-5 py-4">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-3">Items</p>
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
                  {order.order_items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5 text-xs font-medium text-[#022135]">
                        {item.catalog_item.name}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-slate-500 tabular-nums">{item.quantity}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-slate-400 tabular-nums">{formatCurrency(item.unit_price)}</td>
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

          {/* Rejection reason */}
          {order.rejection_reason && (
            <div className="px-5 py-4">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-2">Rejection Reason</p>
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{order.rejection_reason}</p>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="px-5 py-4">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-4">Timeline</p>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-100" />
              <div className="space-y-4">
                {timelineEvents.map((ev, i) => (
                  <div key={i} className="flex items-start gap-3 pl-1">
                    <div
                      className="w-3.5 h-3.5 rounded-full border-2 border-white shrink-0 mt-0.5 shadow-sm"
                      style={{ background: ev.color }}
                    />
                    <div>
                      <p className="text-xs font-semibold text-[#022135]">{ev.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {format(new Date(ev.time), 'd MMM yyyy, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════
   Pagination bar
═══════════════════════════════════════════════════════════ */
function PaginationBar({
  page, total, pageSize, onChange,
}: {
  page:     number
  total:    number
  pageSize: number
  onChange: (p: number) => void
}) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  const from  = (page - 1) * pageSize + 1
  const to    = Math.min(page * pageSize, total)
  const pages = getPageNums(page, totalPages)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
      <p className="text-xs text-slate-400">
        Showing <span className="font-semibold text-[#022135]">{from}–{to}</span> of{' '}
        <span className="font-semibold text-[#022135]">{total}</span> orders
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-xs font-medium border border-slate-200 text-slate-500 hover:border-[#21A053] hover:text-[#21A053] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={13} /> Prev
        </button>

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="w-8 text-center text-xs text-slate-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={cn(
                'w-8 h-8 rounded-[8px] text-xs font-semibold transition-colors',
                page === p
                  ? 'bg-[#21A053] text-white'
                  : 'border border-slate-200 text-slate-500 hover:border-[#21A053] hover:text-[#21A053]'
              )}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-xs font-medium border border-slate-200 text-slate-500 hover:border-[#21A053] hover:text-[#21A053] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Main exported component
═══════════════════════════════════════════════════════════ */
export function HistoryClient({ vendorId }: { vendorId: string }) {
  const [preset,     setPreset]     = useState<DatePreset>('today')
  const [customFrom, setCustomFrom] = useState(todayStr())
  const [customTo,   setCustomTo]   = useState(todayStr())
  const [page,       setPage]       = useState(1)
  const [orders,     setOrders]     = useState<HistoryOrder[]>([])
  const [total,      setTotal]      = useState(0)
  const [summary,    setSummary]    = useState<Summary>({ orders: 0, revenue: 0 })
  const [loading,    setLoading]    = useState(true)
  const [exporting,  setExporting]  = useState(false)
  const [selected,   setSelected]   = useState<HistoryOrder | null>(null)
  const [copiedId,   setCopiedId]   = useState<string | null>(null)

  /* ── Fetch orders ── */
  const fetchData = useCallback(async () => {
    if (preset === 'custom' && (!customFrom || !customTo || customFrom > customTo)) return

    setLoading(true)
    const [from, to] = getDateRange(preset, customFrom, customTo)
    const offset     = (page - 1) * PAGE_SIZE
    const supabase   = createClient()

    const [tableRes, summaryRes, countRes] = await Promise.all([
      /* Paginated table rows with items */
      supabase
        .from('orders')
        .select('id, status, total_amount, created_at, updated_at, rejection_reason, prescription_verified, order_items(quantity, unit_price, catalog_item:catalog_items(name))')
        .eq('vendor_id', vendorId)
        .in('status', ['delivered', 'rejected', 'cancelled'])
        .gte('updated_at', from)
        .lte('updated_at', to)
        .order('updated_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1),

      /* Summary: all delivered orders in range (amounts only) */
      supabase
        .from('orders')
        .select('total_amount')
        .eq('vendor_id', vendorId)
        .eq('status', 'delivered')
        .gte('updated_at', from)
        .lte('updated_at', to),

      /* Total count for pagination */
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vendorId)
        .in('status', ['delivered', 'rejected', 'cancelled'])
        .gte('updated_at', from)
        .lte('updated_at', to),
    ])

    setOrders((tableRes.data ?? []) as unknown as HistoryOrder[])
    setTotal(countRes.count ?? 0)

    const delivered = summaryRes.data ?? []
    setSummary({
      orders:  delivered.length,
      revenue: delivered.reduce((s, o) => s + o.total_amount, 0),
    })
    setLoading(false)
  }, [preset, customFrom, customTo, page, vendorId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /* Reset page on filter change */
  function changePreset(p: DatePreset) { setPreset(p); setPage(1) }
  function changeCustomFrom(v: string) { setCustomFrom(v); setPage(1) }
  function changeCustomTo(v: string)   { setCustomTo(v);   setPage(1) }

  /* ── CSV export ── */
  async function handleExport() {
    setExporting(true)
    const [from, to] = getDateRange(preset, customFrom, customTo)
    const supabase   = createClient()

    const { data } = await supabase
      .from('orders')
      .select('id, status, total_amount, updated_at, rejection_reason, order_items(quantity, catalog_item:catalog_items(name))')
      .eq('vendor_id', vendorId)
      .in('status', ['delivered', 'rejected', 'cancelled'])
      .gte('updated_at', from)
      .lte('updated_at', to)
      .order('updated_at', { ascending: false })

    if (data && data.length > 0) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const rows = (data as any[]).map((o) => [
        o.id,
        format(new Date(o.updated_at), 'd MMM yyyy, h:mm a'),
        (o.order_items as any[]).map((i: any) => `${i.catalog_item.name} x${i.quantity}`).join('; '),
        o.total_amount.toFixed(2),
        o.status,
        o.rejection_reason ?? '',
      ])
      /* eslint-enable @typescript-eslint/no-explicit-any */

      const header = ['Order ID', 'Date', 'Items', 'Total (INR)', 'Status', 'Rejection Reason']
      const csv    = [header, ...rows]
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\n')

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `kapzo-history-${todayStr()}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Exported ${data.length} orders`)
    } else {
      toast.error('No orders to export')
    }
    setExporting(false)
  }

  /* ── Copy order ID ── */
  function copyId(id: string) {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    }).catch(() => toast.error('Could not copy'))
  }

  /* ── Derived ── */
  const aov = summary.orders > 0 ? Math.round(summary.revenue / summary.orders) : 0

  /* ════════════════ JSX ════════════════ */
  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start max-w-7xl mx-auto">

      {/* ═══ LEFT PANEL — Filters + Summary ═══ */}
      <div className="w-full lg:w-[244px] shrink-0 lg:sticky lg:top-0 space-y-4">

        {/* Date range label */}
        <div>
          <h1 className="text-xl font-bold text-[#022135]">History</h1>
          <p className="text-xs text-slate-400 mt-0.5">Order history & earnings</p>
        </div>

        {/* Date preset pills */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Date Range</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESET_LABELS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => changePreset(key)}
                className={cn(
                  'px-3 py-2 rounded-[8px] text-xs font-semibold transition-all text-center',
                  preset === key
                    ? 'bg-[#21A053] text-white shadow-[0_2px_8px_rgba(33,160,83,0.3)]'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-[#022135] border border-slate-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Custom range pickers */}
          {preset === 'custom' && (
            <div className="space-y-2 pt-1">
              <div>
                <label className="block text-[10px] text-slate-400 font-medium mb-1">From</label>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || todayStr()}
                  onChange={(e) => changeCustomFrom(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs rounded-[8px] border border-slate-200 text-[#022135] focus:outline-none focus:ring-2 focus:ring-[#21A053]/30 focus:border-[#21A053] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-medium mb-1">To</label>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  max={todayStr()}
                  onChange={(e) => changeCustomTo(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs rounded-[8px] border border-slate-200 text-[#022135] focus:outline-none focus:ring-2 focus:ring-[#21A053]/30 focus:border-[#21A053] transition-colors"
                />
              </div>
            </div>
          )}
        </div>

        {/* Summary cards */}
        <SummaryCard
          label="Total Orders"
          rawValue={summary.orders}
          display={(n) => n.toLocaleString('en-IN')}
          icon={ShoppingBag}
          accentColor="#21A053"
          loading={loading}
        />
        <SummaryCard
          label="Total Revenue"
          rawValue={summary.revenue}
          display={(n) => formatCurrency(n)}
          icon={IndianRupee}
          accentColor="#00326F"
          loading={loading}
        />
        <SummaryCard
          label="Avg. Order Value"
          rawValue={aov}
          display={(n) => summary.orders > 0 ? formatCurrency(n) : '—'}
          icon={TrendingUp}
          accentColor="#21A053"
          loading={loading}
        />
      </div>

      {/* ═══ RIGHT PANEL — Orders Table ═══ */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Table header row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-[#022135]">
              {total > 0 ? `${total} orders` : 'Orders'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 capitalize">
              {preset === 'custom'
                ? `${customFrom} → ${customTo}`
                : PRESET_LABELS.find((p) => p.key === preset)?.label}
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || total === 0}
            className="flex items-center gap-2 h-9 px-4 rounded-[8px] text-xs font-semibold border border-slate-200 text-slate-600 hover:border-[#21A053] hover:text-[#21A053] transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-white"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Export CSV
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-4 border-b border-slate-50 flex items-center gap-4">
                <div className="h-4 w-28 rounded-md bg-slate-100 animate-pulse" />
                <div className="h-4 w-32 rounded-md bg-slate-100 animate-pulse" />
                <div className="h-4 flex-1 rounded-md bg-slate-100 animate-pulse" />
                <div className="h-4 w-20 rounded-md bg-slate-100 animate-pulse" />
                <div className="h-5 w-16 rounded-full bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-[#21A053]/8 flex items-center justify-center mb-4">
              <History size={28} className="text-[#21A053]/30" />
            </div>
            <p className="text-sm font-semibold text-slate-500">No orders for this period</p>
            <p className="text-xs text-slate-400 mt-1">Try a different date range</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Order ID</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Date & Time</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Items</th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/60 transition-colors group"
                    >
                      {/* Order ID — click to copy */}
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => copyId(order.id)}
                          className="flex items-center gap-1.5 group/copy"
                          title="Click to copy full Order ID"
                        >
                          <span className="font-mono text-sm font-bold text-[#00326F]">
                            #{order.id.slice(-8).toUpperCase()}
                          </span>
                          <span className="text-slate-300 group-hover/copy:text-[#00326F] transition-colors">
                            {copiedId === order.id
                              ? <Check size={11} className="text-[#21A053]" />
                              : <Copy size={11} />}
                          </span>
                        </button>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {fmtDate(order.updated_at)}
                      </td>

                      {/* Items preview */}
                      <td className="px-4 py-3.5 text-xs text-slate-500 max-w-[180px]">
                        <span className="truncate block">{itemsPreview(order.order_items)}</span>
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3.5 text-right text-sm font-bold text-[#022135] tabular-nums whitespace-nowrap">
                        {formatCurrency(order.total_amount)}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={cn(
                          'inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize',
                          STATUS_STYLES[order.status] ?? 'bg-slate-100 text-slate-500'
                        )}>
                          {order.status}
                        </span>
                      </td>

                      {/* View details */}
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => setSelected(order)}
                          className="text-xs font-semibold text-[#21A053] hover:text-[#178040] px-2.5 py-1 rounded-[6px] hover:bg-[#21A053]/8 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {!loading && total > 0 && (
          <PaginationBar
            page={page}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          />
        )}
      </div>

      {/* Detail slide-over */}
      {selected && (
        <DetailPanel order={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
