'use client'

import { cn } from '@/lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  size?: 'sm' | 'md'
}

export function Toggle({ checked, onChange, label, disabled, size = 'md' }: ToggleProps) {
  const isSmall = size === 'sm'

  return (
    <label className={cn('inline-flex items-center gap-2.5', disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer')}>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex shrink-0 rounded-[999px] border-2 border-transparent',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#21A053]/50',
          'disabled:cursor-not-allowed',
          checked ? 'bg-[#21A053]' : 'bg-slate-200',
          isSmall ? 'h-5 w-9' : 'h-6 w-11'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block rounded-full bg-white shadow-sm',
            'transform transition-transform duration-200',
            isSmall ? 'h-4 w-4' : 'h-5 w-5',
            checked
              ? isSmall ? 'translate-x-4' : 'translate-x-5'
              : 'translate-x-0'
          )}
        />
      </button>
      {label && <span className="text-sm font-medium text-[#022135]">{label}</span>}
    </label>
  )
}
