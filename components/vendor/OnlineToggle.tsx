'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useVendorStore } from '@/lib/store/vendorStore'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface OnlineToggleProps {
  variant?: 'prominent' | 'compact'
}

export function OnlineToggle({ variant = 'prominent' }: OnlineToggleProps) {
  const { vendor, isOnline, setIsOnline } = useVendorStore()
  const [loading, setLoading]       = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function applyToggle(online: boolean) {
    if (!vendor) return
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('vendors')
      .update({ is_online: online })
      .eq('id', vendor.id)

    if (error) {
      toast.error('Failed to update status')
    } else {
      setIsOnline(online)
      toast.success(online ? "You're live — accepting orders" : "You're now offline")
    }
    setLoading(false)
    setConfirmOpen(false)
  }

  function handleClick() {
    if (isOnline) {
      setConfirmOpen(true) // confirm before going offline
    } else {
      applyToggle(true)
    }
  }

  /* ── Compact version (sidebar footer) ── */
  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={handleClick}
          disabled={loading}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all w-full',
            isOnline
              ? 'bg-[#21A053]/15 text-[#21A053] hover:bg-[#21A053]/25'
              : 'bg-white/8 text-white/50 hover:bg-white/15'
          )}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#21A053] opacity-75" />}
            <span className={cn('relative inline-flex rounded-full h-2 w-2', isOnline ? 'bg-[#21A053]' : 'bg-white/30')} />
          </span>
          {loading ? 'Updating…' : isOnline ? 'Live' : 'Offline'}
          <span className="ml-auto">
            <ToggleSwitch on={isOnline} size="xs" />
          </span>
        </button>

        <OfflineConfirmModal
          open={confirmOpen}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => applyToggle(false)}
          loading={loading}
        />
      </>
    )
  }

  /* ── Prominent version (dashboard top) ── */
  return (
    <>
      <div
        className={cn(
          'flex items-center justify-between px-5 py-4 rounded-2xl border transition-all',
          isOnline
            ? 'bg-[#21A053]/8 border-[#21A053]/25'
            : 'bg-slate-50 border-slate-200'
        )}
      >
        <div className="flex items-center gap-3">
          {/* Pulsing dot */}
          <span className="relative flex h-3.5 w-3.5 shrink-0">
            {isOnline && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#21A053] opacity-60" />
            )}
            <span className={cn(
              'relative inline-flex rounded-full h-3.5 w-3.5',
              isOnline ? 'bg-[#21A053]' : 'bg-slate-300'
            )} />
          </span>

          <div>
            <p className={cn('text-sm font-bold', isOnline ? 'text-[#21A053]' : 'text-slate-400')}>
              {isOnline ? "You're Live — Accepting Orders" : "You're Offline"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {isOnline
                ? 'Customers can find and order from your pharmacy'
                : 'Your pharmacy is hidden from customers'}
            </p>
          </div>
        </div>

        <button
          onClick={handleClick}
          disabled={loading}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0',
            isOnline
              ? 'bg-white border border-[#21A053]/30 text-[#022135] hover:bg-red-50 hover:border-red-200 hover:text-red-600'
              : 'bg-gradient-to-r from-[#21A053] to-[#00326F] text-white hover:opacity-90'
          )}
        >
          {loading ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : isOnline ? 'Go Offline' : 'Go Live'}
        </button>
      </div>

      <OfflineConfirmModal
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => applyToggle(false)}
        loading={loading}
      />
    </>
  )
}

/* ── Confirm modal ── */
function OfflineConfirmModal({
  open, onCancel, onConfirm, loading,
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  loading: boolean
}) {
  return (
    <Modal open={open} onClose={onCancel} title="Go Offline?" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-500 leading-relaxed">
          Going offline will <strong className="text-[#022135]">hide your pharmacy from customers</strong>.
          Any pending orders will not be affected.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Updating…' : 'Go Offline'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ── Tiny toggle switch ── */
function ToggleSwitch({ on, size = 'xs' }: { on: boolean; size?: 'xs' | 'sm' }) {
  const h = size === 'xs' ? 'h-4 w-7' : 'h-5 w-9'
  const thumb = size === 'xs' ? 'h-3 w-3 translate-x-3.5' : 'h-4 w-4 translate-x-4'
  return (
    <span className={cn('relative inline-flex shrink-0 rounded-full border-2 border-transparent transition-colors', on ? 'bg-[#21A053]' : 'bg-white/20', h)}>
      <span className={cn('inline-block rounded-full bg-white shadow transition-transform', on ? thumb : 'h-3 w-3 translate-x-0')} />
    </span>
  )
}
