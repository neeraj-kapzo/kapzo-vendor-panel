import { Banknote, CreditCard, Hourglass } from 'lucide-react'
import { paymentLabel } from '@/lib/api/mappers'
import { cn } from '@/lib/utils'
import type { OrderPaymentStatus, PaymentMode } from '@/types/database.types'

/**
 * Confirm-then-pay chip: how the customer is paying. Green once prepaid,
 * amber for cash on delivery, muted while unchosen or mid-payment — shown
 * even at PENDING, because the vendor is accepting on trust. Same size as
 * the Rx and Simulated pills.
 */
export function PaymentBadge({
  order,
  className,
}: {
  order: { payment_mode: PaymentMode; payment_status: OrderPaymentStatus }
  className?: string
}) {
  const label = paymentLabel(order)
  const prepaid = label === 'Prepaid'
  const cod = label === 'Cash on delivery'
  const Icon = prepaid ? CreditCard : cod ? Banknote : Hourglass
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-[999px] border',
        prepaid && 'text-[#21A053] border-[#21A053]/30 bg-[#21A053]/10',
        cod && 'text-amber-700 border-amber-300 bg-amber-50',
        !prepaid && !cod && 'text-slate-500 border-slate-200 bg-slate-50',
        className,
      )}
    >
      <Icon size={10} /> {label}
    </span>
  )
}
