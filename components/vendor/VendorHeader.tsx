'use client'

import { Bell, Menu, X } from 'lucide-react'
import { useVendorStore } from '@/lib/store/vendorStore'

interface VendorHeaderProps {
  onMenuToggle?: () => void
  sidebarOpen?: boolean
  title?: string
}

export function VendorHeader({ onMenuToggle, sidebarOpen, title }: VendorHeaderProps) {
  const { vendor } = useVendorStore()

  return (
    <header className="sticky top-0 z-40 h-14 bg-white border-b border-slate-100 shadow-[0_1px_4px_rgba(2,33,53,0.05)]">
      <div className="flex items-center h-full px-4 gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
        >
          {sidebarOpen ? <X size={19} /> : <Menu size={19} />}
        </button>

        {/* Mobile pharmacy name */}
        <span className="lg:hidden font-semibold text-[#022135] text-sm truncate">
          {vendor?.pharmacy_name ?? 'Kapzo Vendor'}
        </span>

        {/* Desktop page title */}
        {title && (
          <span className="hidden lg:block font-semibold text-[#022135] text-sm">{title}</span>
        )}

        <div className="flex-1" />

        {/* Notification bell */}
        <button className="relative p-2 rounded-xl text-slate-400 hover:text-[#022135] hover:bg-slate-100 transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#21A053] rounded-full ring-2 ring-white" />
        </button>
      </div>
    </header>
  )
}
