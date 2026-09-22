import { FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Marks an admin-simulated (training) order. Same size as the Rx pill. */
export function SimulatedBadge({ className }: { className?: string }) {
  return (
    <span
      title="Simulated by Kapzo for training — no real customer, not paid out"
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 border border-amber-300 bg-amber-50 px-2 py-0.5 rounded-[999px]',
        className,
      )}
    >
      <FlaskConical size={10} /> Simulated
    </span>
  )
}
