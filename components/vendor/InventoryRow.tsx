'use client'

import { useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { Toggle } from '@/components/ui/Toggle'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { InventoryWithCatalog } from '@/types/database.types'
import toast from 'react-hot-toast'

interface InventoryRowProps {
  item: InventoryWithCatalog
  onUpdate?: (id: string, data: Partial<InventoryWithCatalog>) => void
}

export function InventoryRow({ item, onUpdate }: InventoryRowProps) {
  const [isAvailable, setIsAvailable] = useState(item.is_available)
  const [editing, setEditing] = useState(false)
  const [stockQty, setStockQty] = useState(String(item.stock_qty))
  const [vendorPrice, setVendorPrice] = useState(String(item.vendor_price))
  const [saving, setSaving] = useState(false)

  async function saveEdits() {
    const qty = parseInt(stockQty, 10)
    const price = parseFloat(vendorPrice)
    if (isNaN(qty) || qty < 0 || isNaN(price) || price < 0) {
      toast.error('Please enter valid quantity and price')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('vendor_inventory')
      .update({ stock_qty: qty, vendor_price: price })
      .eq('id', item.id)

    if (error) {
      toast.error('Failed to update inventory')
    } else {
      toast.success('Inventory updated')
      onUpdate?.(item.id, { stock_qty: qty, vendor_price: price })
      setEditing(false)
    }
    setSaving(false)
  }

  async function toggleAvailability(available: boolean) {
    const supabase = createClient()
    const { error } = await supabase
      .from('vendor_inventory')
      .update({ is_available: available })
      .eq('id', item.id)

    if (error) {
      toast.error('Failed to update availability')
      setIsAvailable(!available)
    } else {
      setIsAvailable(available)
      onUpdate?.(item.id, { is_available: available })
    }
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
      {/* Image placeholder */}
      <div className="shrink-0 w-10 h-10 rounded-[8px] bg-slate-100 flex items-center justify-center overflow-hidden">
        {item.catalog_item.image_url ? (
          <img src={item.catalog_item.image_url} alt={item.catalog_item.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-slate-300 text-lg">💊</span>
        )}
      </div>

      {/* Name + salt */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#022135] truncate">{item.catalog_item.name}</p>
        {item.catalog_item.salt_name && (
          <p className="text-xs text-slate-400 truncate">{item.catalog_item.salt_name}</p>
        )}
        <p className="text-[10px] text-slate-400">MRP {formatCurrency(item.catalog_item.mrp)}</p>
      </div>

      {/* Stock / Price (editing or display) */}
      {editing ? (
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 font-medium">Stock</label>
            <input
              type="number"
              min={0}
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              className="w-16 h-7 px-2 text-xs rounded-[6px] border border-slate-200 focus:outline-none focus:border-[#21A053]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 font-medium">Price ₹</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={vendorPrice}
              onChange={(e) => setVendorPrice(e.target.value)}
              className="w-20 h-7 px-2 text-xs rounded-[6px] border border-slate-200 focus:outline-none focus:border-[#21A053]"
            />
          </div>
          <button
            onClick={saveEdits}
            disabled={saving}
            className="p-1.5 rounded-[6px] text-[#21A053] hover:bg-[#21A053]/10 transition-colors mt-4"
          >
            <Check size={14} />
          </button>
          <button
            onClick={() => setEditing(false)}
            className="p-1.5 rounded-[6px] text-slate-400 hover:bg-slate-100 transition-colors mt-4"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-sm font-semibold text-[#022135]">{formatCurrency(item.vendor_price)}</p>
            <p className="text-[10px] text-slate-400">Qty: {item.stock_qty}</p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded-[8px] text-slate-400 hover:text-[#022135] hover:bg-slate-100 transition-colors"
          >
            <Pencil size={14} />
          </button>
        </div>
      )}

      {/* Availability toggle */}
      <Toggle
        checked={isAvailable}
        onChange={toggleAvailability}
        size="sm"
      />
    </div>
  )
}
