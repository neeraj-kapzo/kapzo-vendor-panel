'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  LayoutDashboard, ShoppingBag, Package,
  Clock as HistoryIcon, LogOut, ChevronLeft, FlaskConical,
  Wallet, HelpCircle, UserCircle, Clock,
} from 'lucide-react'
import { VendorHeader } from '@/components/vendor/VendorHeader'
import { OnlineToggle } from '@/components/vendor/OnlineToggle'
import { useVendorStore } from '@/lib/store/vendorStore'
import { useVendor } from '@/lib/hooks/useVendor'
import { useSimulationResetListener } from '@/lib/hooks/useSimulationReset'
import { useNewOrderAlerts } from '@/lib/hooks/useNewOrderAlerts'
import { NewOrderToastContainer } from '@/components/vendor/NewOrderToast'
import { signOutVendor } from '@/lib/session'
import { isDemoMode } from '@/lib/demo'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard', href: '/vendor/dashboard', icon: LayoutDashboard, badge: false },
  { label: 'Orders',    href: '/vendor/orders',    icon: ShoppingBag,     badge: true  },
  { label: 'Inventory', href: '/vendor/inventory', icon: Package,         badge: false },
  { label: 'History',      href: '/vendor/history',     icon: HistoryIcon,  badge: false },
  { label: 'Settlements',  href: '/vendor/settlements', icon: Wallet,       badge: false },
  { label: 'Help Centre',  href: '/vendor/help',        icon: HelpCircle,   badge: false }
]

/**
 * What a pending pharmacy sees in the sidebar. Everything else needs an
 * approved account to mean anything — there are no orders, no inventory and no
 * settlements before verification — and `useRequireVendor` would bounce them
 * back to the profile anyway, so offering the links would just be a trap.
 * Help Centre stays because that is where their questions go.
 */
const PENDING_NAV_HREFS = new Set(['/vendor/help'])

/* Pages that render full-screen without the sidebar shell */
const SHELL_EXCLUDED = ['/vendor/login', '/vendor/onboarding']

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed]     = useState(false)

  const { vendor } = useVendor()
  const { unreadOrderCount: pendingOrderCount } = useVendorStore()

  const isPending = vendor?.status === 'pending'
  const inShell = !SHELL_EXCLUDED.some((p) => pathname.startsWith(p))

  /* One shell-level listener for admin simulation resets (see useSimulationReset) */
  useSimulationResetListener(!isDemoMode && inShell && vendor?.status === 'active')

  /* One shell-level new-order alert (beep + tab flash + toast) for every page */
  const isActive = vendor?.status === 'active'
  const { alerts, dismiss: dismissAlert } = useNewOrderAlerts(
    vendor?.id,
    !isDemoMode && inShell && isActive,
    isDemoMode && inShell,
  )
  const visibleNav = isPending
    ? navItems.filter((item) => PENDING_NAV_HREFS.has(item.href))
    : navItems

  if (!inShell) return <>{children}</>

  async function handleLogout() {
    if (isDemoMode) {
      router.push('/vendor/login')
      return
    }
    await signOutVendor()
    router.push('/vendor/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sliding new-order toasts — fixed top-right, on every page */}
      <NewOrderToastContainer alerts={alerts} onDismiss={dismissAlert} />

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
          {visibleNav.map(({ label, href, icon: Icon, badge }) => {
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
          {/* Pharmacy name — links to profile page (both expanded + collapsed) */}
          <Link
            href="/vendor/profile"
            onClick={() => setSidebarOpen(false)}
            title={collapsed ? (vendor?.pharmacy_name ?? 'Profile') : undefined}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group',
              pathname.startsWith('/vendor/profile')
                ? 'bg-[#21A053] text-white shadow-[0_2px_8px_rgba(33,160,83,0.35)]'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white',
            )}
          >
            <UserCircle size={18} className="shrink-0" />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-[10px] uppercase tracking-widest',
                  pathname.startsWith('/vendor/profile') ? 'text-white/70' : 'text-white/35 group-hover:text-white/50',
                )}>
                  Pharmacy
                </p>
                <p className="text-xs font-semibold truncate">
                  {vendor?.pharmacy_name ?? '—'}
                </p>
              </div>
            )}
          </Link>

          {!collapsed && (isPending ? (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-400/10 border border-amber-300/25">
              <Clock size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-amber-300">Awaiting approval</p>
                <p className="text-[10px] text-white/40 leading-snug mt-0.5">
                  You can go online once Kapzo verifies your pharmacy.
                </p>
              </div>
            </div>
          ) : (
            <OnlineToggle variant="compact" />
          ))}

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

        {/* Verification-pending banner */}
        {isPending && (
          <div className="shrink-0 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 bg-amber-400/15 border-b border-amber-300/40">
            <Clock size={13} className="text-amber-600 shrink-0" />
            <p className="text-[11px] font-semibold text-amber-800">
              Verification pending — Kapzo is reviewing your pharmacy.
            </p>
            <p className="text-[11px] text-amber-700">
              You can keep your profile up to date in the meantime; orders open up once you’re approved.
            </p>
          </div>
        )}

        {/* Demo mode banner */}
        {isDemoMode && (
          <div className="shrink-0 flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-400/15 border-b border-amber-300/40">
            <FlaskConical size={13} className="text-amber-600 shrink-0" />
            <p className="text-[11px] font-semibold text-amber-700">
              Demo Mode — data is simulated and nothing is persisted
            </p>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
