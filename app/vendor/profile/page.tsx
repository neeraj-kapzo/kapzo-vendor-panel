import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isDemoMode, DEMO_VENDOR } from '@/lib/demo'
import { ProfileClient } from './ProfileClient'

export default async function ProfilePage() {
  if (isDemoMode) {
    return <ProfileClient vendor={DEMO_VENDOR} />
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/vendor/login')

  const { data: vendor } = await supabase
    .from('vendors')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!vendor) redirect('/vendor/login')

  return <ProfileClient vendor={vendor} />
}
