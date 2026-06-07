import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HelpClient } from './HelpClient'
import { isDemoMode } from '@/lib/demo'

export default async function HelpPage() {
  if (isDemoMode) {
    return <HelpClient />
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/vendor/login')

  return <HelpClient />
}
