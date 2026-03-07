import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/vendor/login')

  const { data: vendor, error: vendorError } = await supabase
    .from('vendors')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!vendor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#21A053]/10 flex items-center justify-center text-2xl">🏥</div>
        <div>
          <h2 className="text-lg font-bold text-[#022135]">Pharmacy profile not found</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-xs">
            Your account is not linked to a pharmacy. Contact Kapzo support to get set up.
          </p>
          {vendorError && <p className="text-xs text-red-400 mt-2 font-mono">{vendorError.message}</p>}
        </div>
      </div>
    )
  }

  if (vendor.status === 'pending') redirect('/vendor/login')
  if (vendor.status === 'banned')  redirect('/vendor/login')

  /* ── Stats queries (parallel) ── */
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    { data: todayOrders },
    { data: activeOrders },
    { data: last7DaysOrders },
  ] = await Promise.all([
    /* today's orders — for count + revenue */
    supabase
      .from('orders')
      .select('id, status, total_amount')
      .eq('vendor_id', vendor.id)
      .gte('created_at', todayStart.toISOString()),

    /* active orders feed — include item count via inner join */
    supabase
      .from('orders')
      .select('id, vendor_id, customer_id, rider_id, status, total_amount, created_at, updated_at, rejection_reason, prescription_verified')
      .eq('vendor_id', vendor.id)
      .in('status', ['pending', 'accepted', 'packing', 'packed', 'dispatched'])
      .order('created_at', { ascending: false })
      .limit(20),

    /* last 7 days for acceptance rate */
    supabase
      .from('orders')
      .select('id, status')
      .eq('vendor_id', vendor.id)
      .gte('created_at', sevenDaysAgo.toISOString()),
  ])

  const today = todayOrders ?? []
  const active = activeOrders ?? []
  const last7  = last7DaysOrders ?? []

  const todayCount    = today.length
  const todayRevenue  = today.filter((o) => o.status === 'delivered').reduce((s, o) => s + o.total_amount, 0)
  const pendingCount  = active.filter((o) => ['pending', 'accepted', 'packing'].includes(o.status)).length
  const total7        = last7.length
  const accepted7     = last7.filter((o) => !['rejected', 'cancelled'].includes(o.status)).length
  const acceptanceRate = total7 > 0 ? Math.round((accepted7 / total7) * 100) : 100

  return (
    <DashboardClient
      vendor={vendor}
      initialStats={{ todayCount, todayRevenue, pendingCount, acceptanceRate }}
      initialOrders={active}
    />
  )
}
