'use client'

import { HelpClient } from './HelpClient'
import { useRequireVendor } from '@/lib/hooks/useRequireVendor'
import { Skeleton } from '@/components/ui/Skeleton'
import { isDemoMode } from '@/lib/demo'

export default function HelpPage() {
  const { vendor, loading } = useRequireVendor()

  if (isDemoMode) {
    return <HelpClient />
  }

  if (loading || !vendor) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-56 rounded-xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    )
  }

  return <HelpClient />
}
