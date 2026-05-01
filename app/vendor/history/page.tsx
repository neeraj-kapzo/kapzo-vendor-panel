import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HistoryClient } from './HistoryClient'
import { isDemoMode, DEMO_VENDOR_ID } from '@/lib/demo'

export default async function HistoryPage() {
  /* ── Demo mode ── */
  if (isDemoMode) {
    return <HistoryClient vendorId={DEMO_VENDOR_ID} />
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

  /* All data fetching is client-driven (date filters + pagination) */
  return <HistoryClient vendorId={vendor.id} />
}
