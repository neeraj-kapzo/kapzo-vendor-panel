'use client'

import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import {
  Wallet, Clock, CheckCircle, Activity, ChevronLeft, ChevronRight,
  X, Download, AlertCircle, ArrowDownToLine, Loader2, IndianRupee,
  CalendarDays, Hash, FileText, TrendingUp,
} from 'lucide-react'
import { StatsCard } from '@/components/vendor/StatsCard'
import { cn, formatCurrency } from '@/lib/utils'
import { isDemoMode, type DemoSettlement } from '@/lib/demo'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

/* ─── Types ─── */
type SettlementStatus = 'pending' | 'processing' | 'completed' | 'failed'
type StatusFilter = 'all' | SettlementStatus
type DatePreset   = 'all' | 'month' | 'quarter' | 'custom'

type Settlement = DemoSettlement

/* ─── Constants ─── */
const PAGE_SIZE = 10

const STATUS_STYLES: Record<SettlementStatus, { badge: string; dot: string; label: string }> = {
  pending:    { badge: 'bg-amber-100  text-amber-700',  dot: 'bg-amber-400',  label: 'Pending'    },
  processing: { badge: 'bg-blue-100   text-blue-700',   dot: 'bg-blue-400',   label: 'Processing' },
  completed:  { badge: 'bg-green-100  text-green-700',  dot: 'bg-green-500',  label: 'Completed'  },
  failed:     { badge: 'bg-red-100    text-red-700',    dot: 'bg-red-400',    label: 'Failed'     },
}

const FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all',        label: 'All'        },
  { key: 'pending',    label: 'Pending'    },
  { key: 'processing', label: 'Processing' },
  { key: 'completed',  label: 'Completed'  },
  { key: 'failed',     label: 'Failed'     },
]

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'all',     label: 'All Time'       },
  { key: 'month',   label: 'This Month'     },
  { key: 'quarter', label: 'Last 3 Months'  },
  { key: 'custom',  label: 'Custom Range'   },
]

/* ─── Helpers ─── */
function fmtPeriod(start: string, end: string) {
  return `${format(new Date(start), 'd MMM')} – ${format(new Date(end), 'd MMM yyyy')}`
}

function fmtSettledDate(iso: string | null) {
  if (!iso) return '—'
  return format(new Date(iso), 'd MMM yyyy')
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function getDateBound(preset: DatePreset, customFrom: string, customTo: string): [Date, Date] {
  const now = new Date()
  if (preset === 'month') {
    return [new Date(now.getFullYear(), now.getMonth(), 1), now]
  }
  if (preset === 'quarter') {
    const s = new Date(now); s.setMonth(s.getMonth() - 3); s.setHours(0, 0, 0, 0)
    return [s, now]
  }
  if (preset === 'custom') {
    const s = customFrom ? new Date(customFrom + 'T00:00:00') : new Date(0)
    const e = customTo   ? new Date(customTo   + 'T23:59:59') : now
    return [s, e]
  }
  return [new Date(0), now]
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

/* ─── Sub-components ─── */
function PaginationBar({
  page, total, pageSize, onChange,
}: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
      <p className="text-xs text-slate-400">
        Showing{' '}
        <span className="font-semibold text-[#022135]">{from}–{to}</span>
        {' '}of{' '}
        <span className="font-semibold text-[#022135]">{total}</span> settlements
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg text-slate-400 hover:text-[#022135] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={15} />
        </button>
        {getPageNums(page, totalPages).map((n, i) =>
          n === '…'
            ? <span key={`ellipsis-${i}`} className="px-1 text-slate-300 text-sm">…</span>
            : (
              <button
                key={n}
                onClick={() => onChange(n as number)}
                className={cn(
                  'min-w-[30px] h-7 rounded-lg text-xs font-medium transition-colors',
                  page === n
                    ? 'bg-[#21A053] text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100'
                )}
              >
                {n}
              </button>
            )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg text-slate-400 hover:text-[#022135] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}

/* ─── Withdraw Modal ─── */
function WithdrawModal({
  pendingAmount,
  onClose,
  onConfirm,
  loading,
}: {
  pendingAmount: number
  onClose: () => void
  onConfirm: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#022135]/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#21A053]/10 flex items-center justify-center">
              <ArrowDownToLine size={16} className="text-[#21A053]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#022135]">Request Withdrawal</p>
              <p className="text-[10px] text-slate-400">Initiate payout to your bank account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="rounded-xl bg-[#21A053]/5 border border-[#21A053]/20 px-4 py-4 text-center">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Amount to Withdraw</p>
            <p className="text-3xl font-bold text-[#022135] tabular-nums">{formatCurrency(pendingAmount)}</p>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200/60 px-3.5 py-3">
            <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Funds are typically transferred within <strong>2–3 business days</strong> to your registered bank account ending in <strong>••••3456</strong>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 pb-5">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-10 rounded-xl bg-[#21A053] hover:bg-[#178040] text-white text-sm font-bold shadow-[0_2px_10px_rgba(33,160,83,0.3)] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownToLine size={14} />}
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Detail Panel ─── */
function DetailPanel({
  settlement,
  onClose,
}: {
  settlement: Settlement
  onClose: () => void
}) {
  const s = STATUS_STYLES[settlement.status]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end p-4 sm:p-6">
      <div className="absolute inset-0 bg-[#022135]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm h-full max-h-[calc(100vh-3rem)] flex flex-col overflow-hidden animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-sm font-bold text-[#022135]">Settlement Detail</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{fmtPeriod(settlement.period_start, settlement.period_end)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Amount */}
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Settlement Amount</p>
                <p className="mt-1 text-2xl font-bold text-[#022135] tabular-nums">{formatCurrency(settlement.amount)}</p>
              </div>
              <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-semibold', s.badge)}>
                {s.label}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2">
            {[
              { icon: CalendarDays, label: 'Period',          value: fmtPeriod(settlement.period_start, settlement.period_end) },
              { icon: CheckCircle,  label: 'Settled On',      value: fmtSettledDate(settlement.settled_at) },
              { icon: Hash,         label: 'Transaction Ref', value: settlement.transaction_ref ?? '—' },
              { icon: FileText,     label: 'Notes',           value: settlement.notes ?? '—' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3 px-3 py-3 rounded-xl border border-slate-100 bg-white">
                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                  <Icon size={13} className="text-slate-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{label}</p>
                  <p className="text-xs font-semibold text-[#022135] mt-0.5 break-all">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Status timeline */}
          <div className="rounded-xl border border-slate-100 bg-white overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status Timeline</p>
            </div>
            <div className="px-3 py-3 space-y-3">
              {(['pending', 'processing', 'completed'] as SettlementStatus[]).map((step, idx) => {
                const statusOrder = ['pending', 'processing', 'completed', 'failed']
                const currentIdx  = statusOrder.indexOf(settlement.status)
                const stepIdx     = statusOrder.indexOf(step)
                const done        = settlement.status !== 'failed' && stepIdx <= currentIdx
                const active      = step === settlement.status && settlement.status !== 'failed'

                return (
                  <div key={step} className="flex items-center gap-3">
                    <div className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold',
                      done && !active ? 'bg-[#21A053] text-white'
                        : active     ? 'bg-[#21A053]/20 text-[#21A053] ring-2 ring-[#21A053]/30'
                        : 'bg-slate-100 text-slate-400'
                    )}>
                      {done && !active ? '✓' : idx + 1}
                    </div>
                    <p className={cn(
                      'text-xs capitalize',
                      done ? 'font-semibold text-[#022135]' : 'text-slate-400'
                    )}>
                      {step}
                    </p>
                    {active && (
                      <span className="ml-auto text-[9px] font-bold text-[#21A053] uppercase tracking-wider">Current</span>
                    )}
                  </div>
                )
              })}
              {settlement.status === 'failed' && (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <X size={9} className="text-red-500" />
                  </div>
                  <p className="text-xs font-semibold text-red-600">Failed</p>
                  <span className="ml-auto text-[9px] font-bold text-red-500 uppercase tracking-wider">Current</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Component ─── */
interface SettlementsClientProps {
  vendorId:         string
  initialSettlements: Settlement[]
  totalSettled:     number
  pendingAmount:    number
  completedCount:   number
  failedCount:      number
  lastStatus:       SettlementStatus
}

export function SettlementsClient({
  vendorId,
  initialSettlements,
  totalSettled,
  pendingAmount,
  completedCount,
  failedCount,
  lastStatus,
}: SettlementsClientProps) {
  const [settlements, setSettlements] = useState<Settlement[]>(initialSettlements)
  const [currentPending, setCurrentPending] = useState(pendingAmount)

  /* Filters */
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [datePreset,   setDatePreset]   = useState<DatePreset>('all')
  const [customFrom,   setCustomFrom]   = useState(todayStr())
  const [customTo,     setCustomTo]     = useState(todayStr())

  /* Pagination */
  const [page, setPage] = useState(1)

  /* Detail panel */
  const [selected, setSelected] = useState<Settlement | null>(null)

  /* Withdraw modal */
  const [showWithdraw, setShowWithdraw]     = useState(false)
  const [withdrawLoading, setWithdrawLoading] = useState(false)

  /* ── Filtering ── */
  const [dateFrom, dateTo] = getDateBound(datePreset, customFrom, customTo)

  const filtered = settlements.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    const created = new Date(s.created_at)
    if (created < dateFrom || created > dateTo) return false
    return true
  })

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const pageSlice   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleFilterChange(filter: StatusFilter) {
    setStatusFilter(filter)
    setPage(1)
  }

  function handlePresetChange(p: DatePreset) {
    setDatePreset(p)
    setPage(1)
  }

  /* ── Withdraw ── */
  const handleWithdraw = useCallback(async () => {
    setWithdrawLoading(true)

    if (isDemoMode) {
      await new Promise((r) => setTimeout(r, 1000))
      const newSettlement: Settlement = {
        id:              `settle-demo-${Date.now()}`,
        vendor_id:       vendorId,
        amount:          currentPending,
        status:          'processing',
        period_start:    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        period_end:      new Date().toISOString(),
        settled_at:      null,
        transaction_ref: null,
        notes:           'Withdrawal requested',
        created_at:      new Date().toISOString(),
      }
      setSettlements((prev) => [newSettlement, ...prev])
      setCurrentPending(0)
      setWithdrawLoading(false)
      setShowWithdraw(false)
      toast.success('Withdrawal request submitted!')
      return
    }

    const supabase = createClient()
    const now      = new Date()
    const weekAgo  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('settlements')
      .insert({
        vendor_id:    vendorId,
        amount:       currentPending,
        status:       'pending',
        period_start: weekAgo.toISOString(),
        period_end:   now.toISOString(),
      })
      .select()
      .single()

    setWithdrawLoading(false)
    if (error) {
      toast.error('Failed to submit withdrawal request')
      return
    }
    setSettlements((prev) => [data as Settlement, ...prev])
    setCurrentPending(0)
    setShowWithdraw(false)
    toast.success('Withdrawal request submitted!')
  }, [vendorId, currentPending])

  /* ── Last status display ── */
  const lastS = STATUS_STYLES[lastStatus] ?? STATUS_STYLES.pending

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#022135]">Settlements</h1>
          <p className="mt-0.5 text-sm text-slate-400">Track payouts, pending balances, and transaction history</p>
        </div>
        <button className="hidden sm:flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors">
          <Download size={13} />
          Export
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Settled"
          value={formatCurrency(totalSettled)}
          subtitle={`${completedCount} completed`}
          icon={Wallet}
          accentColor="green"
        />
        <StatsCard
          title="Pending Amount"
          value={formatCurrency(currentPending)}
          subtitle="Awaiting payout"
          icon={Clock}
          accentColor="amber"
        />
        <StatsCard
          title="Completed"
          value={completedCount}
          subtitle="Successful settlements"
          icon={CheckCircle}
          accentColor="navy"
        />
        <StatsCard
          title="Last Status"
          value={lastS.label}
          subtitle={failedCount > 0 ? `${failedCount} failed` : 'No failures'}
          icon={Activity}
          accentColor={lastStatus === 'failed' ? 'amber' : lastStatus === 'completed' ? 'green' : 'purple'}
        />
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <IndianRupee size={15} className="text-[#21A053] shrink-0" />
            <h2 className="text-sm font-bold text-[#022135]">Transaction History</h2>
            <span className="text-xs text-slate-400">({filtered.length})</span>
          </div>

          {/* Date presets */}
          <div className="flex items-center gap-1 flex-wrap">
            {DATE_PRESETS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handlePresetChange(key)}
                className={cn(
                  'h-7 px-2.5 rounded-lg text-xs font-medium transition-colors',
                  datePreset === key
                    ? 'bg-[#022135] text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date inputs */}
        {datePreset === 'custom' && (
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">From</span>
            <input
              type="date"
              value={customFrom}
              max={customTo || todayStr()}
              onChange={(e) => { setCustomFrom(e.target.value); setPage(1) }}
              className="h-7 px-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#21A053]/20 focus:border-[#21A053]"
            />
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">To</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={todayStr()}
              onChange={(e) => { setCustomTo(e.target.value); setPage(1) }}
              className="h-7 px-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#21A053]/20 focus:border-[#21A053]"
            />
          </div>
        )}

        {/* Status filter chips */}
        <div className="flex items-center gap-1.5 px-5 py-3 border-b border-slate-100 overflow-x-auto">
          {FILTER_OPTIONS.map(({ key, label }) => {
            const count = key === 'all' ? settlements.length : settlements.filter((s) => s.status === key).length
            return (
              <button
                key={key}
                onClick={() => handleFilterChange(key)}
                className={cn(
                  'flex items-center gap-1 h-7 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-colors',
                  statusFilter === key
                    ? 'bg-[#21A053] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                )}
              >
                {label}
                <span className={cn(
                  'text-[10px] font-bold rounded-full min-w-[16px] h-[16px] px-0.5 flex items-center justify-center',
                  statusFilter === key ? 'bg-white/20 text-white' : 'bg-white text-slate-500'
                )}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Table */}
        {pageSlice.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14">
            <TrendingUp size={28} className="text-slate-200 mb-3" />
            <p className="text-sm font-semibold text-slate-500">No settlements found</p>
            <button
              onClick={() => { setStatusFilter('all'); setDatePreset('all'); setPage(1) }}
              className="mt-2 text-xs text-[#21A053] hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Period', 'Settled On', 'Transaction Ref', 'Amount', 'Status', ''].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        'px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider',
                        h === 'Amount' ? 'text-right' : h === '' ? 'text-right' : 'text-left'
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pageSlice.map((s) => {
                  const st = STATUS_STYLES[s.status]
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSelected(s)}
                      className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <span className={cn('w-2 h-2 rounded-full shrink-0', st.dot)} />
                          <span className="text-xs font-medium text-[#022135]">{fmtPeriod(s.period_start, s.period_end)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                        {fmtSettledDate(s.settled_at)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-mono text-slate-500">
                          {s.transaction_ref ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-bold text-[#022135] tabular-nums">{formatCurrency(s.amount)}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold', st.badge)}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelected(s) }}
                          className="text-[10px] text-[#21A053] font-semibold hover:underline whitespace-nowrap"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="px-5 py-4 border-t border-slate-100">
            <PaginationBar
              page={safePage}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Floating withdraw button */}
      {currentPending > 0 && (
        <div className="fixed bottom-6 right-6 z-30">
          <button
            onClick={() => setShowWithdraw(true)}
            className="flex items-center gap-2 h-11 px-5 rounded-xl text-white text-sm font-bold bg-[#21A053] hover:bg-[#178040] shadow-[0_4px_20px_rgba(33,160,83,0.4)] transition-all"
          >
            <ArrowDownToLine size={15} />
            Request Withdrawal · {formatCurrency(currentPending)}
          </button>
        </div>
      )}

      {/* Modals */}
      {showWithdraw && (
        <WithdrawModal
          pendingAmount={currentPending}
          onClose={() => setShowWithdraw(false)}
          onConfirm={handleWithdraw}
          loading={withdrawLoading}
        />
      )}
      {selected && (
        <DetailPanel
          settlement={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
