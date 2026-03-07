import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
}

export function Card({ hover, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-[12px] border border-slate-100',
        'shadow-[0_2px_8px_rgba(2,33,53,0.08)]',
        hover && 'transition-shadow hover:shadow-[0_4px_16px_rgba(2,33,53,0.14)] cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-5 py-4 border-b border-slate-100', className)} {...props}>
      {children}
    </div>
  )
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-5 py-4', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-5 py-3 border-t border-slate-100 bg-slate-50/50 rounded-b-[12px]', className)} {...props}>
      {children}
    </div>
  )
}
