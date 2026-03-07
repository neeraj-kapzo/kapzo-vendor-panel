'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  Search, LayoutList, LayoutGrid, Plus, Minus,
  Save, Package, X, Loader2, AlertCircle, Check,
} from 'lucide-react'
import { Toggle } from '@/components/ui/Toggle'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

/* ─── Exported type used by page.tsx ─── */
export type MergedInventoryItem = {
  catalog_id:   string
  name:         string
  salt_name:    string | null
  image_url:    string | null
  mrp:          number
  inv_id:       string | null
  vendor_price: number
  stock_qty:    number
  is_available: boolean
}

type LocalItem = MergedInventoryItem & {
  priceStr: string   // controlled input value
  stockStr: string   // controlled input value
  isDirty:  boolean  // price or stock changed since last save
}

type FilterType = 'all' | 'available' | 'unavailable'
type ViewType   = 'table' | 'grid'

interface InventoryClientProps {
  vendorId:     string
  initialItems: MergedInventoryItem[]
}

/* ═══════════════════════════════════════════════════════════
   Price input — green border valid, red + tooltip if > MRP
═══════════════════════════════════════════════════════════ */
function PriceInput({
  value, mrp, onChange,
}: {
  value: string
  mrp: number
  onChange: (v: string) => void
}) {
  const num     = parseFloat(value)
  const invalid = !isNaN(num) && num > mrp
  const valid   = !isNaN(num) && num >= 0 && num <= mrp

  return (
    <div className="relative group">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">₹</span>
      <input
        type="number"
        min={0}
        step={0.5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-24 h-8 pl-6 pr-2 text-xs rounded-[8px] border transition-colors',
          'focus:outline-none focus:ring-2',
          invalid
            ? 'border-red-400 text-red-600 bg-red-50 focus:ring-red-200'
            : valid
            ? 'border-[#21A053] bg-[#21A053]/5 focus:ring-[#21A053]/20'
            : 'border-slate-200 focus:ring-[#21A053]/20'
        )}
      />
      {/* MRP exceeded tooltip */}
      {invalid && (
        <div className="absolute bottom-full left-0 mb-1.5 z-20 pointer-events-none">
          <div className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-semibold px-2 py-1 rounded-[6px] whitespace-nowrap shadow-lg">
            <AlertCircle size={10} />
            Cannot exceed MRP ({formatCurrency(mrp)})
          </div>
          <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-red-600 ml-2" />
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Stock stepper — number input with +/- buttons
═══════════════════════════════════════════════════════════ */
function StockStepper({
  value, onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const num = parseInt(value, 10)

  return (
    <div className="flex items-center h-8 border border-slate-200 rounded-[8px] overflow-hidden">
      <button
        onClick={() => onChange(String(Math.max(0, (isNaN(num) ? 0 : num) - 1)))}
        className="px-2 h-full text-slate-400 hover:text-[#022135] hover:bg-slate-100 transition-colors border-r border-slate-200"
      >
        <Minus size={12} />
      </button>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-12 h-full text-center text-xs text-[#022135] border-0 outline-none tabular-nums bg-white"
      />
      <button
        onClick={() => onChange(String((isNaN(num) ? 0 : num) + 1))}
        className="px-2 h-full text-slate-400 hover:text-[#022135] hover:bg-slate-100 transition-colors border-l border-slate-200"
      >
        <Plus size={12} />
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Medicine image — with pill-emoji fallback
═══════════════════════════════════════════════════════════ */
function MedImage({ url, name, className }: { url: string | null; name: string; className?: string }) {
  return (
    <div className={cn('rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center shrink-0', className)}>
      {url
        ? <img src={url} alt={name} className="w-full h-full object-cover" />
        : <span className="text-slate-300 text-xl select-none">💊</span>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════════ */
export function InventoryClient({ vendorId, initialItems }: InventoryClientProps) {
  const [items, setItems] = useState<LocalItem[]>(() =>
    initialItems.map((i) => ({
      ...i,
      priceStr: String(i.vendor_price),
      stockStr: String(i.stock_qty),
      isDirty:  false,
    }))
  )
  const [search,      setSearch]      = useState('')
  const [filter,      setFilter]      = useState<FilterType>('all')
  const [view,        setView]        = useState<ViewType>('table')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [saving,      setSaving]      = useState(false)
  const [bulkBusy,    setBulkBusy]    = useState(false)

  /* ── Derived ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return items.filter((i) => {
      const matchSearch = !q
        || i.name.toLowerCase().includes(q)
        || (i.salt_name ?? '').toLowerCase().includes(q)
      const matchFilter = filter === 'all'
        || (filter === 'available'   && i.is_available)
        || (filter === 'unavailable' && !i.is_available)
      return matchSearch && matchFilter
    })
  }, [items, search, filter])

  const dirtyItems   = useMemo(() => items.filter((i) => i.isDirty), [items])
  const hasErrors    = dirtyItems.some((i) => {
    const p = parseFloat(i.priceStr)
    return !isNaN(p) && p > i.mrp
  })
  const availCount   = items.filter((i) => i.is_available).length
  const allSelected  = filtered.length > 0 && filtered.every((i) => selectedIds.has(i.catalog_id))
  const someSelected = filtered.some((i) => selectedIds.has(i.catalog_id))

  /* ── Checkbox for "Select All" header ── */
  const selectAllRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected
    }
  }, [allSelected, someSelected])

  /* ── Update helpers ── */
  const updateItem = useCallback((catalogId: string, patch: Partial<LocalItem>) => {
    setItems((prev) =>
      prev.map((i) => i.catalog_id === catalogId ? { ...i, ...patch } : i)
    )
  }, [])

  const markDirty = useCallback((catalogId: string, patch: Partial<LocalItem>) => {
    setItems((prev) =>
      prev.map((i) => i.catalog_id === catalogId ? { ...i, ...patch, isDirty: true } : i)
    )
  }, [])

  /* ── Optimistic availability toggle ── */
  const toggleAvailability = useCallback(async (catalogId: string) => {
    const item = items.find((i) => i.catalog_id === catalogId)
    if (!item) return
    const next = !item.is_available

    /* Optimistic flip */
    updateItem(catalogId, { is_available: next })

    const supabase = createClient()
    let error: { message: string } | null = null

    if (item.inv_id) {
      const res = await supabase
        .from('vendor_inventory')
        .update({ is_available: next })
        .eq('id', item.inv_id)
      error = res.error
    } else {
      const res = await supabase
        .from('vendor_inventory')
        .insert({
          vendor_id:       vendorId,
          catalog_item_id: catalogId,
          vendor_price:    item.vendor_price,
          stock_qty:       item.stock_qty,
          is_available:    next,
        })
        .select('id')
        .single()
      error = res.error
      if (!error && res.data) {
        updateItem(catalogId, { inv_id: res.data.id })
      }
    }

    if (error) {
      /* Revert */
      updateItem(catalogId, { is_available: !next })
      toast.error('Failed to update availability')
    }
  }, [items, vendorId, updateItem])

  /* ── Bulk availability mark ── */
  const bulkMark = useCallback(async (available: boolean) => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return

    const targets = items.filter((i) => ids.includes(i.catalog_id))

    /* Optimistic */
    setItems((prev) =>
      prev.map((i) => ids.includes(i.catalog_id) ? { ...i, is_available: available } : i)
    )

    setBulkBusy(true)
    const supabase = createClient()

    const toUpdate = targets.filter((i) => i.inv_id)
    const toInsert = targets.filter((i) => !i.inv_id)

    const results = await Promise.all([
      toUpdate.length
        ? supabase.from('vendor_inventory')
            .update({ is_available: available })
            .in('id', toUpdate.map((i) => i.inv_id!))
        : Promise.resolve({ error: null }),
      toInsert.length
        ? supabase.from('vendor_inventory')
            .insert(toInsert.map((i) => ({
              vendor_id:       vendorId,
              catalog_item_id: i.catalog_id,
              vendor_price:    i.vendor_price,
              stock_qty:       i.stock_qty,
              is_available:    available,
            })))
            .select('id, catalog_item_id')
        : Promise.resolve({ error: null, data: [] as { id: string; catalog_item_id: string }[] }),
    ])

    const hasError = results.some((r) => r.error)
    if (hasError) {
      toast.error('Failed to update some items')
      /* Revert */
      setItems((prev) =>
        prev.map((i) => ids.includes(i.catalog_id) ? { ...i, is_available: !available } : i)
      )
    } else {
      /* Update inv_ids for newly inserted */
      const inserted = (results[1] as { data: { id: string; catalog_item_id: string }[] | null }).data ?? []
      if (inserted.length) {
        setItems((prev) =>
          prev.map((i) => {
            const ins = inserted.find((d) => d.catalog_item_id === i.catalog_id)
            return ins ? { ...i, inv_id: ins.id } : i
          })
        )
      }
      toast.success(`${ids.length} item${ids.length > 1 ? 's' : ''} marked ${available ? 'available' : 'unavailable'}`)
      setSelectedIds(new Set())
    }
    setBulkBusy(false)
  }, [selectedIds, items, vendorId])

  /* ── Save price + stock changes ── */
  const saveChanges = useCallback(async () => {
    if (!dirtyItems.length || hasErrors) return
    setSaving(true)

    const toUpdate = dirtyItems.filter((i) => i.inv_id)
    const toInsert = dirtyItems.filter((i) => !i.inv_id)

    const supabase = createClient()
    const [upd, ins] = await Promise.all([
      toUpdate.length
        ? supabase.from('vendor_inventory')
            .upsert(toUpdate.map((i) => ({
              id:           i.inv_id!,
              vendor_id:    vendorId,
              catalog_item_id: i.catalog_id,
              vendor_price: parseFloat(i.priceStr) || 0,
              stock_qty:    parseInt(i.stockStr, 10)   || 0,
              is_available: i.is_available,
            })))
            .select('id, catalog_item_id')
        : Promise.resolve({ error: null, data: [] }),
      toInsert.length
        ? supabase.from('vendor_inventory')
            .insert(toInsert.map((i) => ({
              vendor_id:    vendorId,
              catalog_item_id: i.catalog_id,
              vendor_price: parseFloat(i.priceStr) || 0,
              stock_qty:    parseInt(i.stockStr, 10)   || 0,
              is_available: i.is_available,
            })))
            .select('id, catalog_item_id')
        : Promise.resolve({ error: null, data: [] }),
    ])

    if (upd.error || ins.error) {
      toast.error('Failed to save some items')
    } else {
      const allSaved = [
        ...((upd.data as { id: string; catalog_item_id: string }[] | null) ?? []),
        ...((ins.data as { id: string; catalog_item_id: string }[] | null) ?? []),
      ]
      setItems((prev) =>
        prev.map((i) => {
          if (!i.isDirty) return i
          const saved = allSaved.find((d) => d.catalog_item_id === i.catalog_id)
          return {
            ...i,
            isDirty:      false,
            inv_id:       saved?.id ?? i.inv_id,
            vendor_price: parseFloat(i.priceStr) || 0,
            stock_qty:    parseInt(i.stockStr, 10)   || 0,
          }
        })
      )
      toast.success(`${dirtyItems.length} item${dirtyItems.length > 1 ? 's' : ''} saved`)
    }
    setSaving(false)
  }, [dirtyItems, hasErrors, vendorId])

  /* ── Selection helpers ── */
  const toggleSelect = (catalogId: string, on: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      on ? next.add(catalogId) : next.delete(catalogId)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((i) => i.catalog_id)))
    }
  }

  /* ════════════════ JSX ════════════════ */
  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-24">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#022135]">Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-semibold text-[#21A053]">{availCount}</span>
            <span className="text-slate-400"> of </span>
            <span className="font-semibold text-[#022135]">{items.length}</span>
            {' '}medicines marked available
          </p>
        </div>
        {/* View toggle */}
        <div className="flex gap-1 border border-slate-200 rounded-[8px] p-0.5 bg-white shrink-0">
          <button
            onClick={() => setView('table')}
            title="Table view"
            className={cn(
              'p-1.5 rounded-[6px] transition-colors',
              view === 'table' ? 'bg-[#022135] text-white' : 'text-slate-400 hover:text-[#022135]'
            )}
          >
            <LayoutList size={16} />
          </button>
          <button
            onClick={() => setView('grid')}
            title="Card grid"
            className={cn(
              'p-1.5 rounded-[6px] transition-colors',
              view === 'grid' ? 'bg-[#022135] text-white' : 'text-slate-400 hover:text-[#022135]'
            )}
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* ── Search + Filter ── */}
      <div className="flex gap-3 flex-wrap items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by medicine name or salt…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-[8px] border border-slate-200 bg-white text-sm text-[#022135] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#21A053]/30 focus:border-[#21A053]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-[8px] p-1 shrink-0">
          {(['all', 'available', 'unavailable'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1 rounded-[6px] text-xs font-medium capitalize transition-colors',
                filter === f
                  ? f === 'unavailable'
                    ? 'bg-red-500 text-white'
                    : f === 'available'
                    ? 'bg-[#21A053] text-white'
                    : 'bg-[#022135] text-white'
                  : 'text-slate-500 hover:text-[#022135]'
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Result count */}
        <span className="text-xs text-slate-400 shrink-0">
          {filtered.length} of {items.length}
        </span>
      </div>

      {/* ── Bulk action bar ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-5 py-3 bg-[#022135] text-white rounded-xl shadow-lg">
          <span className="text-sm font-semibold">
            {selectedIds.size} selected
          </span>
          <div className="h-4 w-px bg-white/20" />
          <button
            onClick={() => bulkMark(true)}
            disabled={bulkBusy}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-lg bg-[#21A053] hover:bg-[#178040] transition-colors disabled:opacity-50"
          >
            {bulkBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Mark {selectedIds.size} Available
          </button>
          <button
            onClick={() => bulkMark(false)}
            disabled={bulkBusy}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 transition-colors disabled:opacity-50"
          >
            Mark {selectedIds.size} Unavailable
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Empty state ── */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-20 h-20 rounded-2xl bg-[#21A053]/8 flex items-center justify-center mb-5">
            <Package size={36} className="text-[#21A053]/40" />
          </div>
          <h3 className="text-base font-bold text-[#022135]">Your pharmacy&apos;s inventory is empty</h3>
          <p className="text-sm text-slate-400 mt-2 text-center max-w-sm leading-relaxed">
            All medicines are from the Kapzo Master Catalog.
            Toggle availability and set your prices below.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Search size={28} className="text-slate-200 mb-3" />
          <p className="text-sm font-semibold text-slate-500">No medicines match your search</p>
          <button onClick={() => { setSearch(''); setFilter('all') }} className="mt-2 text-xs text-[#21A053] hover:underline">
            Clear filters
          </button>
        </div>
      ) : view === 'table' ? (

        /* ════ TABLE VIEW ════ */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {/* Select all */}
                  <th className="w-10 px-4 py-3 text-left">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded accent-[#21A053] cursor-pointer"
                    />
                  </th>
                  <th className="w-12 px-3 py-3" />
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Medicine</th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wider">MRP</th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Your Price</th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Stock</th>
                  <th className="px-3 py-3 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((item) => {
                  const isSelected = selectedIds.has(item.catalog_id)
                  const priceNum   = parseFloat(item.priceStr)
                  const priceInval = !isNaN(priceNum) && priceNum > item.mrp

                  return (
                    <tr
                      key={item.catalog_id}
                      className={cn(
                        'group hover:bg-slate-50/60 transition-colors',
                        isSelected && 'bg-[#21A053]/4'
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleSelect(item.catalog_id, e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-[#21A053] cursor-pointer"
                        />
                      </td>

                      {/* Image */}
                      <td className="px-3 py-3">
                        <MedImage url={item.image_url} name={item.name} className="w-10 h-10" />
                      </td>

                      {/* Name + Salt */}
                      <td className="px-3 py-3 min-w-[160px]">
                        <p className="text-sm font-semibold text-[#022135] truncate max-w-[220px]">{item.name}</p>
                        {item.salt_name && (
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[220px]">{item.salt_name}</p>
                        )}
                        {item.isDirty && (
                          <span className="inline-block mt-0.5 text-[9px] font-bold text-amber-500 uppercase tracking-wider">
                            unsaved
                          </span>
                        )}
                      </td>

                      {/* MRP (reference, struck-through) */}
                      <td className="px-3 py-3 text-right">
                        <span className="text-xs text-slate-300 line-through tabular-nums">
                          {formatCurrency(item.mrp)}
                        </span>
                      </td>

                      {/* Your Price — editable */}
                      <td className="px-3 py-3">
                        <PriceInput
                          value={item.priceStr}
                          mrp={item.mrp}
                          onChange={(v) => markDirty(item.catalog_id, { priceStr: v })}
                        />
                        {priceInval && (
                          <p className="text-[9px] text-red-500 mt-0.5 font-medium">Exceeds MRP</p>
                        )}
                      </td>

                      {/* Stock qty — stepper */}
                      <td className="px-3 py-3">
                        <StockStepper
                          value={item.stockStr}
                          onChange={(v) => markDirty(item.catalog_id, { stockStr: v })}
                        />
                      </td>

                      {/* Available toggle */}
                      <td className="px-3 py-3 text-center">
                        <Toggle
                          checked={item.is_available}
                          onChange={() => toggleAvailability(item.catalog_id)}
                          size="sm"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      ) : (

        /* ════ CARD GRID VIEW ════ */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const isSelected = selectedIds.has(item.catalog_id)
            return (
              <div
                key={item.catalog_id}
                className={cn(
                  'relative bg-white rounded-2xl border overflow-hidden shadow-sm transition-all',
                  isSelected ? 'border-[#21A053] shadow-[0_0_0_2px_rgba(33,160,83,0.15)]' : 'border-slate-100'
                )}
              >
                {/* Checkbox — top-left */}
                <div className="absolute top-2.5 left-2.5 z-10">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => toggleSelect(item.catalog_id, e.target.checked)}
                    className="w-4 h-4 rounded accent-[#21A053] cursor-pointer shadow"
                  />
                </div>

                {/* Image */}
                <div className="aspect-square bg-slate-50 relative overflow-hidden">
                  <MedImage url={item.image_url} name={item.name} className="w-full h-full rounded-none" />

                  {/* Unavailable overlay */}
                  {!item.is_available && (
                    <div className="absolute inset-0 bg-[#022135]/55 flex items-end p-2.5">
                      <span className="text-[10px] font-bold text-white bg-[#022135]/70 px-2.5 py-1 rounded-full">
                        Unavailable
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-3">
                  <p className="text-sm font-semibold text-[#022135] leading-tight truncate">{item.name}</p>
                  {item.salt_name && (
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{item.salt_name}</p>
                  )}

                  <div className="flex items-end justify-between mt-2.5">
                    <div>
                      <p className="text-[9px] text-slate-400 font-medium">Your price</p>
                      <p className="text-sm font-bold text-[#022135] tabular-nums">
                        {formatCurrency(item.vendor_price)}
                      </p>
                      <p className="text-[9px] text-slate-300 line-through tabular-nums">
                        MRP {formatCurrency(item.mrp)}
                      </p>
                    </div>
                    <Toggle
                      checked={item.is_available}
                      onChange={() => toggleAvailability(item.catalog_id)}
                      size="sm"
                    />
                  </div>

                  {item.isDirty && (
                    <div className="mt-1.5 flex items-center gap-1 text-[9px] text-amber-500 font-bold uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Unsaved changes — switch to table view to edit
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ════ Floating save button ════ */}
      {dirtyItems.length > 0 && (
        <div className="fixed bottom-6 right-6 z-30 flex items-center gap-3 animate-fade-in">
          {/* Unsaved indicator pill */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 shadow-lg rounded-xl px-4 py-2.5 text-sm text-slate-500">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            {dirtyItems.length} unsaved change{dirtyItems.length > 1 ? 's' : ''}
            {hasErrors && (
              <span className="ml-1 text-red-500 font-semibold flex items-center gap-1">
                <AlertCircle size={12} /> fix errors first
              </span>
            )}
          </div>

          {/* Save button */}
          <button
            onClick={saveChanges}
            disabled={saving || hasErrors}
            className={cn(
              'flex items-center gap-2 h-11 px-5 rounded-xl text-white text-sm font-bold transition-all',
              'shadow-[0_4px_20px_rgba(33,160,83,0.4)] hover:shadow-[0_6px_24px_rgba(33,160,83,0.5)]',
              'disabled:opacity-50 disabled:shadow-none',
              'bg-[#21A053] hover:bg-[#178040]'
            )}
          >
            {saving
              ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
              : <><Save size={15} /> Save Changes</>}
          </button>
        </div>
      )}
    </div>
  )
}
