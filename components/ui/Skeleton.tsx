import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-[8px] bg-slate-200',
        className
      )}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-[12px] border border-slate-100 shadow-[0_2px_8px_rgba(2,33,53,0.08)] p-5 space-y-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-3/4" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-7 w-20 rounded-[8px]" />
        <Skeleton className="h-7 w-20 rounded-[8px]" />
      </div>
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3 px-5 border-b border-slate-100">
      <Skeleton className="h-10 w-10 rounded-[8px] shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-6 w-16 rounded-[999px]" />
      <Skeleton className="h-8 w-8 rounded-[8px]" />
    </div>
  )
}
