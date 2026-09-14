'use client'

import { ProfileClient } from './ProfileClient'
import { useRequireVendor } from '@/lib/hooks/useRequireVendor'
import { Skeleton } from '@/components/ui/Skeleton'
import { isDemoMode, DEMO_VENDOR } from '@/lib/demo'

export default function ProfilePage() {
  // The only page that accepts a pending vendor — they sign in to check where
  // their application stands and to correct the details under review.
  const { vendor, loading } = useRequireVendor({ allowPending: true })

  if (isDemoMode) {
    return <ProfileClient vendor={DEMO_VENDOR} />
  }

  if (loading || !vendor) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  return <ProfileClient vendor={vendor} />
}
