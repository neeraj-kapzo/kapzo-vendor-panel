import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettlementsClient } from './SettlementsClient'
import {
  isDemoMode, DEMO_VENDOR_ID, DEMO_SETTLEMENTS,
  getDemoSettlementStats,
} from '@/lib/demo'

export default async function SettlementsPage() {
  /* ── Demo mode ── */
  if (isDemoMode) {
    const stats = getDemoSettlementStats()
    return (
      <SettlementsClient
        vendorId={DEMO_VENDOR_ID}
        initialSettlements={DEMO_SETTLEMENTS}
        totalSettled={stats.totalSettled}
        pendingAmount={stats.pendingAmount}
        completedCount={stats.completedCount}
        failedCount={stats.failedCount}
        lastStatus={stats.lastStatus}
      />
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/vendor/login')

  const { data: vendor } = await supabase
    .from('vendors')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!vendor) redirect('/vendor/dashboard')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: settlements }, { data: pendingOrders }] = await Promise.all([
    (supabase as any)
      .from('settlements')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select('total_amount')
      .eq('vendor_id', vendor.id)
      .eq('status', 'delivered'),
  ])

  const rows       = (settlements ?? []) as any[]
  const completed  = rows.filter((s: any) => s.status === 'completed')
  const failed     = rows.filter((s: any) => s.status === 'failed')

  const totalSettled   = completed.reduce((sum: number, s: any) => sum + Number(s.amount), 0)
  const completedCount = completed.length
  const failedCount    = failed.length

  const grossRevenue  = (pendingOrders ?? []).reduce((sum, o) => sum + Number(o.total_amount), 0)
  const pendingAmount = Math.max(0, grossRevenue - totalSettled)
  const lastStatus    = rows[0]?.status ?? 'pending'

  return (
    <SettlementsClient
      vendorId={vendor.id}
      initialSettlements={rows}
      totalSettled={totalSettled}
      pendingAmount={pendingAmount}
      completedCount={completedCount}
      failedCount={failedCount}
      lastStatus={lastStatus}
    />
  )
}
