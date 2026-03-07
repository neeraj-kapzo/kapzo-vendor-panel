'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  LayoutDashboard, ShoppingBag, Package,
  Clock as HistoryIcon, LogOut, ChevronLeft,
} from 'lucide-react'
import { VendorHeader } from '@/components/vendor/VendorHeader'
import { OnlineToggle } from '@/components/vendor/OnlineToggle'
import { useVendorStore } from '@/lib/store/vendorStore'
import { useVendor } from '@/lib/hooks/useVendor'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard', href: '/vendor/dashboard', icon: LayoutDashboard, badge: false },
  { label: 'Orders',    href: '/vendor/orders',    icon: ShoppingBag,     badge: true  },
  { label: 'Inventory', href: '/vendor/inventory', icon: Package,         badge: false },
  { label: 'History',   href: '/vendor/history',   icon: HistoryIcon,     badge: false },
]

/* Pages that render full-screen without the sidebar shell */
const SHELL_EXCLUDED = ['/vendor/login', '/vendor/onboarding']

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed]     = useState(false)

  const { vendor } = useVendor()
  const { unreadOrderCount: pendingOrderCount } = useVendorStore()

  if (SHELL_EXCLUDED.some((p) => pathname.startsWith(p))) return <>{children}</>

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/vendor/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#022135]/50 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={cn(
        'fixed top-0 left-0 h-full z-40 flex flex-col bg-[#022135] transition-all duration-300',
        'lg:static lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        collapsed ? 'w-[72px]' : 'w-64'
      )}>

        {/* Logo */}
        <div className="flex items-center justify-center h-16 px-4 border-b border-white/8 shrink-0">
          {collapsed ? (
            <Image
              src="/logos/logo-white.png"
              alt="Kapzo"
              width={32}
              height={32}
              className="w-8 h-8 object-contain"
            />
          ) : (
            <Image
              src="/logos/logo-white.png"
              alt="Kapzo"
              width={120}
              height={36}
              className="h-10 w-auto object-contain"
            />
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {navItems.map(({ label, href, icon: Icon, badge }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            const count  = badge ? pendingOrderCount : 0

            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                title={collapsed ? label : undefined}
                className={cn(
                  'flex items-center gap-3 mx-3 px-3 py-2.5 rounded-xl transition-all group',
                  active
                    ? 'bg-[#21A053] text-white shadow-[0_2px_8px_rgba(33,160,83,0.35)]'
                    : 'text-white/55 hover:text-white hover:bg-white/8'
                )}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && (
                  <>
                    <span className="text-sm font-medium flex-1 whitespace-nowrap">{label}</span>
                    {count > 0 && (
                      <span className={cn(
                        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
                        active ? 'bg-white text-[#21A053]' : 'bg-[#21A053] text-white'
                      )}>
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </>
                )}
                {/* Badge when collapsed */}
                {collapsed && count > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#21A053]" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* ── Sidebar footer ── */}
        <div className="border-t border-white/8 p-3 space-y-2 shrink-0">
          {!collapsed && (
            <>
              {/* Pharmacy name */}
              <div className="px-3 py-2 rounded-xl bg-white/5">
                <p className="text-[10px] text-white/35 uppercase tracking-widest">Pharmacy</p>
                <p className="text-white text-xs font-semibold mt-0.5 truncate">
                  {vendor?.pharmacy_name ?? '—'}
                </p>
              </div>

              {/* Online/offline compact toggle */}
              <OnlineToggle variant="compact" />
            </>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sign out' : undefined}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium"
          >
            <LogOut size={17} className="shrink-0" />
            {!collapsed && 'Sign out'}
          </button>
        </div>

        {/* Collapse toggle — desktop */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center h-8 border-t border-white/8 text-white/25 hover:text-white/60 hover:bg-white/5 transition-all"
        >
          <ChevronLeft size={15} className={cn('transition-transform duration-300', collapsed && 'rotate-180')} />
        </button>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <VendorHeader
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
        />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
