'use client'

import { useRef, KeyboardEvent, ClipboardEvent } from 'react'
import { cn } from '@/lib/utils'

interface OtpInputProps {
  value: string
  onChange: (val: string) => void
  length?: number
  disabled?: boolean
  error?: boolean
}

export function OtpInput({ value, onChange, length = 6, disabled, error }: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.padEnd(length, '').split('').slice(0, length)

  function updateDigit(index: number, char: string) {
    const next = digits.slice()
    next[index] = char.slice(-1)
    onChange(next.join('').trimEnd())
  }

  function handleKey(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        updateDigit(index, '')
      } else if (index > 0) {
        inputsRef.current[index - 1]?.focus()
        updateDigit(index - 1, '')
      }
      return
    }
    if (e.key === 'ArrowLeft' && index > 0) inputsRef.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < length - 1) inputsRef.current[index + 1]?.focus()
  }

  function handleChange(index: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1)
    if (!digit) return
    updateDigit(index, digit)
    if (index < length - 1) inputsRef.current[index + 1]?.focus()
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    onChange(pasted)
    const focusIdx = Math.min(pasted.length, length - 1)
    inputsRef.current[focusIdx]?.focus()
  }

  return (
    <div className="flex gap-2.5 justify-center">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] ?? ''}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            'w-11 h-12 text-center text-lg font-bold rounded-xl border-2 outline-none transition-all',
            'bg-white text-[#022135] caret-transparent',
            error
              ? 'border-red-400 bg-red-50'
              : digits[i]
                ? 'border-[#21A053] bg-[#21A053]/5 text-[#21A053]'
                : 'border-gray-200 focus:border-[#21A053] focus:ring-2 focus:ring-[#21A053]/20',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        />
      ))}
    </div>
  )
}
