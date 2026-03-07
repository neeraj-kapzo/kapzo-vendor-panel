import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  accentColor?: 'green' | 'navy' | 'amber' | 'purple'
  className?: string
  loading?: boolean
}

const accent = {
  green:  { border: '#21A053', iconBg: 'bg-[#21A053]/10',   iconText: 'text-[#21A053]' },
  navy:   { border: '#00326F', iconBg: 'bg-[#00326F]/10',   iconText: 'text-[#00326F]' },
  amber:  { border: '#F59E0B', iconBg: 'bg-amber-50',        iconText: 'text-amber-500' },
  purple: { border: '#8B5CF6', iconBg: 'bg-violet-50',       iconText: 'text-violet-500' },
}

export function StatsCard({
  title, value, subtitle, icon: Icon, accentColor = 'green', className, loading,
}: StatsCardProps) {
  const a = accent[accentColor]
  return (
    <div
      className={cn(
        'relative bg-white rounded-2xl shadow-sm overflow-hidden',
        'border border-slate-100',
        className
      )}
      style={{ borderLeft: `4px solid ${a.border}` }}
    >
      {/* Icon — top right */}
      <div className={cn('absolute top-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center', a.iconBg, a.iconText)}>
        <Icon size={18} />
      </div>

      <div className="px-5 pt-5 pb-4 pr-16">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{title}</p>
        {loading ? (
          <div className="mt-2 h-8 w-20 rounded-lg bg-slate-100 animate-pulse" />
        ) : (
          <p className="mt-1.5 text-3xl font-bold text-[#022135] leading-none tabular-nums">{value}</p>
        )}
        {subtitle && (
          <p className="mt-1.5 text-xs text-slate-400">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
