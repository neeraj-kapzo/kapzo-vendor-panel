'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  Search, LayoutList, LayoutGrid, Package, X, Loader2, Check,
  ChevronLeft, ChevronRight, Info, ShieldAlert,
} from 'lucide-react'
import { Toggle } from '@/components/ui/Toggle'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import { fetchInventory, upsertInventory, type BackendInventoryRow } from '@/lib/api'
import { isDemoMode } from '@/lib/demo'
import { cn, formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

/* ─── Exported type used by page.tsx ─── */
export type MergedInventoryItem = {
  catalog_id:            string
  name:                  string
  salt_name:             string | null
  image_url:             string | null
  mrp:                   number
  inv_id:                string | null
  vendor_price:          number
  stock_qty:             number
  is_available:          boolean
  // Shown in the "view details" modal, not the table/grid — deliberately
  // excludes the catalog's Product ID (externalId), which is an internal
  // import key with no meaning to a vendor.
  // Null on imported OTC/FMCG rows whose source names no company; the
  // details modal already falls back to an em dash.
  manufacturer:          string | null
  // Pack size ("Strip of 10 tablets") — the table's Nos column.
  pack_size:             string | null
  category:              string
  requires_prescription: boolean
}

type FilterType = 'all' | 'available' | 'unavailable'
type ViewType   = 'table' | 'grid'

const PAGE_SIZE = 20 // matches the backend's page size exactly
const MIN_SEARCH_CHARS = 3 // matches the backend's search-term minimum

interface InventoryClientProps {
  vendorId:   string
  /** Present only in demo mode — the fixed mock catalog, paginated client-side. */
  demoItems?: MergedInventoryItem[]
}

function mapInventoryRow(row: BackendInventoryRow): MergedInventoryItem {
  return {
    catalog_id:   row.catalogItem.id,
    name:         row.catalogItem.name,
    salt_name:    row.catalogItem.saltComposition || null,
    image_url:    row.catalogItem.imageUrl,
    mrp:          Number(row.catalogItem.mrp),
    // The list endpoint doesn't expose the VendorInventory row id; the
    // client only uses inv_id as a "row exists" hint, so the catalog id
    // stands in once a row is known to exist.
    inv_id:       row.price !== null ? row.catalogItem.id : null,
    vendor_price: row.price !== null ? Number(row.price) : Number(row.catalogItem.mrp),
    stock_qty:    0, // backend tracks availability only, no stock counts
    is_available: row.isAvailable,
    manufacturer: row.catalogItem.manufacturer,
    pack_size:    row.catalogItem.packSize,
    category:     row.catalogItem.category,
    requires_prescription: row.catalogItem.requiresPrescription,
  }
}

/* ═══════════════════════════════════════════════════════════
   Product details modal — everything about the catalog item
   except its internal Product ID (externalId).
═══════════════════════════════════════════════════════════ */
function ProductDetailsModal({ item, onClose }: { item: MergedInventoryItem | null; onClose: () => void }) {
  return (
    <Modal open={item !== null} onClose={onClose} title="Product Details" size="sm">
      {item && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
              {item.image_url
                ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                : <span className="text-slate-300 text-2xl select-none">💊</span>}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#022135] leading-tight">{item.name}</p>
              {item.salt_name && (
                <p className="text-xs text-slate-400 mt-0.5">{item.salt_name}</p>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Manufacturer</dt>
              <dd className="text-[#022135] mt-0.5">{item.manufacturer || '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Pack Size</dt>
              <dd className="text-[#022135] mt-0.5">{item.pack_size || '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Category</dt>
              <dd className="text-[#022135] mt-0.5">{item.category || '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Salt Composition</dt>
              <dd className="text-[#022135] mt-0.5">{item.salt_name || '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">MRP</dt>
              <dd className="text-[#022135] mt-0.5 font-semibold tabular-nums">{formatCurrency(item.mrp)}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Availability</dt>
              <dd className="mt-0.5">
                <span className={cn(
                  'inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold',
                  item.is_available ? 'bg-[#21A053]/10 text-[#178040]' : 'bg-slate-100 text-slate-500'
                )}>
                  {item.is_available ? 'Available' : 'Unavailable'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Prescription</dt>
              <dd className="mt-0.5">
                {item.requires_prescription ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                    <ShieldAlert size={12} /> Required
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-500">Not required</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </Modal>
  )
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
   Pagination bar
═══════════════════════════════════════════════════════════ */
function PaginationBar({
  page, total, onChange,
}: {
  page:     number
  total:    number
  onChange: (p: number) => void
}) {
  const totalPages = Math.ceil(total / PAGE_SIZE)
  if (totalPages <= 1) return null
  const pages = getPageNums(page, totalPages)

  return (
    <div className="flex items-center justify-end gap-3 pt-2">
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
export function InventoryClient({ vendorId, demoItems }: InventoryClientProps) {
  // Demo mode keeps the *entire* mock catalog here (so toggling a row works
  // the same way it always did) and paginates/searches it client-side below.
  // Real mode keeps only the current page — the backend already applied the
  // search and pagination before this state is ever set.
  const [items,       setItems]       = useState<MergedInventoryItem[]>(() => demoItems ?? [])
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(1)
  const [loading,     setLoading]     = useState(!isDemoMode)
  const [search,      setSearch]      = useState('')
  // Debounced separately from `search` so keystrokes don't each trigger a
  // backend round trip — only what the user pauses on does.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filter,      setFilter]      = useState<FilterType>('all')
  const [view,        setView]        = useState<ViewType>('table')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy,    setBulkBusy]    = useState(false)
  const [detailsItem, setDetailsItem] = useState<MergedInventoryItem | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      // The backend rejects search terms under 3 characters (they match most
      // of the 665k-row catalog), so shorter input is treated as "no search"
      // — which also keeps "d" → "do" from firing duplicate list requests.
      const term = search.trim()
      setDebouncedSearch(term.length >= MIN_SEARCH_CHARS ? term : '')
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  /* ── Fetch one page from the backend at a time — the catalog can run to
     1000+ items, so pulling every page up front (as this used to) turned a
     single visit into dozens of requests. "Latest request wins": each fetch
     gets an id, and only applies its result if it's still current, so a
     fast page-flip or search edit can't have a slower, older response land
     after a newer one. ── */
  const fetchIdRef = useRef(0)
  useEffect(() => {
    if (isDemoMode) return
    const fetchId = ++fetchIdRef.current
    // `setLoading(true)` is deferred into the microtask queue (rather than
    // called synchronously here) to satisfy react-hooks/set-state-in-effect.
    Promise.resolve()
      .then(() => {
        if (fetchIdRef.current === fetchId) setLoading(true)
      })
      .then(() => fetchInventory(debouncedSearch || undefined, page))
      .then((result) => {
        if (fetchIdRef.current !== fetchId) return
        setItems(result.items.map(mapInventoryRow))
        setTotal(result.total)
        setLoading(false)
      })
      .catch(() => {
        if (fetchIdRef.current !== fetchId) return
        setItems([])
        setTotal(0)
        setLoading(false)
      })
  }, [debouncedSearch, page])

  /* ── Demo mode: search + paginate the mutable mock list client-side —
     same end shape as the real fetch above, so rendering below doesn't need
     to know which mode it's in. ── */
  const demoSearched = useMemo(() => {
    if (!isDemoMode) return items
    // Same rule as the backend: every word must appear in the brand name,
    // salt or manufacturer (not necessarily the same one).
    const words = debouncedSearch.toLowerCase().split(/\s+/).filter(Boolean)
    return items.filter((i) => {
      const haystack = [i.name, i.salt_name, i.manufacturer].join(' ').toLowerCase()
      return words.every((w) => haystack.includes(w))
    })
  }, [items, debouncedSearch])

  const pageItems = isDemoMode
    ? demoSearched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : items
  const pageTotal = isDemoMode ? demoSearched.length : total

  /* ── Derived — the availability pill only narrows what's on this page;
     the backend has no isAvailable filter, so it can't be applied globally
     without pulling every page again (exactly what this rewrite removes). ── */
  const filtered = useMemo(() => {
    return pageItems.filter((i) =>
      filter === 'all'
      || (filter === 'available'   && i.is_available)
      || (filter === 'unavailable' && !i.is_available)
    )
  }, [pageItems, filter])

  const allSelected  = filtered.length > 0 && filtered.every((i) => selectedIds.has(i.catalog_id))
  const someSelected = filtered.some((i) => selectedIds.has(i.catalog_id))

  /* ── Checkbox for "Select All" header ── */
  const selectAllRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected
    }
  }, [allSelected, someSelected])

  /* ── Update helper ── */
  const updateItem = useCallback((catalogId: string, patch: Partial<MergedInventoryItem>) => {
    setItems((prev) =>
      prev.map((i) => i.catalog_id === catalogId ? { ...i, ...patch } : i)
    )
  }, [])

  /* ── Optimistic availability toggle ── */
  const toggleAvailability = useCallback(async (catalogId: string) => {
    const item = items.find((i) => i.catalog_id === catalogId)
    if (!item) return
    const next = !item.is_available

    /* Optimistic flip */
    updateItem(catalogId, { is_available: next })

    // Demo mode — no backend, local state is sufficient
    if (isDemoMode) return

    try {
      // Price is admin-set (the catalog MRP) — the vendor no longer has a
      // price of their own to send here, but the endpoint still requires one.
      const row = await upsertInventory(catalogId, { isAvailable: next, price: item.mrp })
      if (!item.inv_id) updateItem(catalogId, { inv_id: row.id })
    } catch (err) {
      /* Revert */
      updateItem(catalogId, { is_available: !next })
      toast.error(err instanceof Error ? err.message : 'Failed to update availability')
    }
  }, [items, updateItem])

  /* ── Bulk availability mark ── */
  const bulkMark = useCallback(async (available: boolean) => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return

    const targets = items.filter((i) => ids.includes(i.catalog_id))

    /* Optimistic */
    setItems((prev) =>
      prev.map((i) => ids.includes(i.catalog_id) ? { ...i, is_available: available } : i)
    )

    // Demo mode — local update is all we need
    if (isDemoMode) {
      toast.success(`${ids.length} item${ids.length > 1 ? 's' : ''} marked ${available ? 'available' : 'unavailable'}`)
      setSelectedIds(new Set())
      return
    }

    setBulkBusy(true)

    // One upsert per item (the backend keys inventory on catalogItemId)
    const results = await Promise.all(
      targets.map(async (i) => {
        try {
          const row = await upsertInventory(i.catalog_id, { isAvailable: available, price: i.mrp })
          return { catalogId: i.catalog_id, invId: row.id, ok: true as const }
        } catch {
          return { catalogId: i.catalog_id, invId: null, ok: false as const }
        }
      })
    )

    const failed = results.filter((r) => !r.ok)
    if (failed.length) {
      toast.error('Failed to update some items')
      /* Revert the failed ones */
      const failedIds = new Set(failed.map((r) => r.catalogId))
      setItems((prev) =>
        prev.map((i) => failedIds.has(i.catalog_id) ? { ...i, is_available: !available } : i)
      )
    } else {
      toast.success(`${ids.length} item${ids.length > 1 ? 's' : ''} marked ${available ? 'available' : 'unavailable'}`)
      setSelectedIds(new Set())
    }
    /* Record inv_ids for rows that now exist */
    setItems((prev) =>
      prev.map((i) => {
        const saved = results.find((r) => r.ok && r.catalogId === i.catalog_id)
        return saved?.invId && !i.inv_id ? { ...i, inv_id: saved.invId } : i
      })
    )
    setBulkBusy(false)
  }, [selectedIds, items])

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
            placeholder="Search by brand, salt or manufacturer (min. 3 letters)…"
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

        {/* Result count — scoped to this page */}
        <span className="text-xs text-slate-400 shrink-0">
          {filtered.length} of {pageItems.length} on this page
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

      {/* ── Loading / Empty state ── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : pageTotal === 0 && !debouncedSearch && filter === 'all' ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-20 h-20 rounded-2xl bg-[#21A053]/8 flex items-center justify-center mb-5">
            <Package size={36} className="text-[#21A053]/40" />
          </div>
          <h3 className="text-base font-bold text-[#022135]">Your pharmacy&apos;s inventory is empty</h3>
          <p className="text-sm text-slate-400 mt-2 text-center max-w-sm leading-relaxed">
            All medicines are from the Kapzo Master Catalog.
            Toggle availability below — prices are set by Kapzo.
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
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Price</th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Nos</th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Manufacturer</th>
                  <th className="px-3 py-3 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Available</th>
                  <th className="w-10 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((item) => {
                  const isSelected = selectedIds.has(item.catalog_id)

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
                      </td>

                      {/* Price — set by Kapzo, not editable here */}
                      <td className="px-3 py-3 text-right">
                        <span className="text-sm font-semibold text-[#022135] tabular-nums">
                          {formatCurrency(item.mrp)}
                        </span>
                      </td>

                      {/* Nos — pack size */}
                      <td className="px-3 py-3">
                        <p className="text-xs text-slate-500 whitespace-nowrap truncate max-w-[180px]" title={item.pack_size ?? undefined}>
                          {item.pack_size || '—'}
                        </p>
                      </td>

                      {/* Manufacturer */}
                      <td className="px-3 py-3">
                        <p className="text-xs text-slate-500 truncate max-w-[200px]" title={item.manufacturer ?? undefined}>
                          {item.manufacturer || '—'}
                        </p>
                      </td>

                      {/* Available toggle */}
                      <td className="px-3 py-3 text-center">
                        <Toggle
                          checked={item.is_available}
                          onChange={() => toggleAvailability(item.catalog_id)}
                          size="sm"
                        />
                      </td>

                      {/* View full product details */}
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => setDetailsItem(item)}
                          title="View product details"
                          className="p-1.5 rounded-[6px] text-slate-300 hover:text-[#00326F] hover:bg-slate-100 transition-colors"
                        >
                          <Info size={15} />
                        </button>
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

                {/* View full product details — top-right */}
                <button
                  onClick={() => setDetailsItem(item)}
                  title="View product details"
                  className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/90 text-slate-500 hover:text-[#00326F] shadow transition-colors"
                >
                  <Info size={14} />
                </button>

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
                  {item.pack_size && (
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">{item.pack_size}</p>
                  )}

                  <div className="flex items-end justify-between mt-2.5">
                    <div>
                      <p className="text-[9px] text-slate-400 font-medium">Price</p>
                      <p className="text-sm font-bold text-[#022135] tabular-nums">
                        {formatCurrency(item.mrp)}
                      </p>
                    </div>
                    <Toggle
                      checked={item.is_available}
                      onChange={() => toggleAvailability(item.catalog_id)}
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && (
        <PaginationBar page={page} total={pageTotal} onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
      )}

      <ProductDetailsModal item={detailsItem} onClose={() => setDetailsItem(null)} />
    </div>
  )
}
