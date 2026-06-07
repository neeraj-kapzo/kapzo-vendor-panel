'use client'

import { useState } from 'react'
import {
  HelpCircle, Headphones, Ticket, ShoppingBag, Wrench,
  ChevronDown, ChevronUp, ExternalLink, Mail, Phone, MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── FAQ data ── */
const faqs = [
  {
    q: 'How do I accept or reject an incoming order?',
    a: 'Go to the Orders page. Each pending order shows Accept and Reject buttons. You must act within 2 minutes or the order is auto-rejected by the system.',
  },
  {
    q: 'What happens if I miss an order?',
    a: 'Orders not accepted within 120 seconds are automatically rejected. The customer is notified and can reorder from another pharmacy.',
  },
  {
    q: 'How do I update my inventory?',
    a: 'Navigate to the Inventory page, search for the medicine, and use the edit controls to adjust stock levels. Changes take effect immediately.',
  },
  {
    q: 'How do I go offline temporarily?',
    a: 'Use the Online/Offline toggle in the sidebar footer. When offline, your pharmacy is hidden from customers and no new orders will arrive.',
  },
  {
    q: 'How are payments processed?',
    a: 'Payments are collected from customers via Razorpay at checkout. Settlements are transferred to your registered bank account per the agreed payout schedule.',
  },
  {
    q: 'Can I partially fulfil an order?',
    a: 'Currently, orders must be fully accepted or rejected. Partial fulfilment is on our roadmap — contact support to express interest.',
  },
]

/* ── Sections config ── */
const sections = [
  {
    id: 'faqs',
    label: 'FAQs',
    icon: HelpCircle,
    description: 'Answers to the most common questions',
  },
  {
    id: 'contact',
    label: 'Contact Support',
    icon: Headphones,
    description: 'Reach our team directly',
  },
  {
    id: 'ticket',
    label: 'Raise a Ticket',
    icon: Ticket,
    description: 'Log a formal support request',
  },
  {
    id: 'orders',
    label: 'Order-related Help',
    icon: ShoppingBag,
    description: 'Issues with specific orders',
  },
  {
    id: 'technical',
    label: 'Technical Support',
    icon: Wrench,
    description: 'App, login, or integration issues',
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      onClick={() => setOpen(!open)}
      className="w-full text-left border border-gray-100 rounded-xl overflow-hidden transition-all hover:border-[#21A053]/30"
    >
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <span className="text-sm font-medium text-gray-800">{q}</span>
        {open
          ? <ChevronUp size={16} className="text-[#21A053] shrink-0 mt-0.5" />
          : <ChevronDown size={16} className="text-gray-400 shrink-0 mt-0.5" />
        }
      </div>
      {open && (
        <div className="px-5 pb-4 text-sm text-gray-500 border-t border-gray-100 bg-gray-50/60">
          <p className="pt-3">{a}</p>
        </div>
      )}
    </button>
  )
}

function ContactCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType
  label: string
  value: string
  href: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-[#21A053]/40 hover:bg-[#21A053]/3 transition-all group"
    >
      <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#21A053]/10 text-[#21A053] shrink-0 group-hover:bg-[#21A053]/15 transition-colors">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-400 uppercase tracking-widest">{label}</p>
        <p className="text-sm font-medium text-gray-800 truncate">{value}</p>
      </div>
      <ExternalLink size={13} className="ml-auto text-gray-300 group-hover:text-[#21A053] shrink-0 transition-colors" />
    </a>
  )
}

function SectionCard({
  id,
  label,
  icon: Icon,
  description,
  active,
  onClick,
}: {
  id: string
  label: string
  icon: React.ElementType
  description: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left transition-all',
        active
          ? 'bg-[#21A053] text-white shadow-[0_2px_8px_rgba(33,160,83,0.25)]'
          : 'text-gray-600 hover:bg-gray-100'
      )}
    >
      <Icon size={18} className="shrink-0" />
      <div className="min-w-0">
        <p className={cn('text-sm font-medium', active ? 'text-white' : 'text-gray-800')}>{label}</p>
        <p className={cn('text-[11px] truncate', active ? 'text-white/70' : 'text-gray-400')}>{description}</p>
      </div>
    </button>
  )
}

export function HelpClient() {
  const [active, setActive] = useState('faqs')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[#022135]">Help Centre</h1>
        <p className="text-sm text-gray-500 mt-1">Find answers, contact support, or raise a ticket</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left nav ── */}
        <div className="lg:w-64 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-3 space-y-1">
            {sections.map((s) => (
              <SectionCard
                key={s.id}
                {...s}
                active={active === s.id}
                onClick={() => setActive(s.id)}
              />
            ))}
          </div>
        </div>

        {/* ── Right content ── */}
        <div className="flex-1 min-w-0">
          {/* FAQs */}
          {active === 'faqs' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-3">
              <h2 className="text-base font-semibold text-[#022135]">Frequently Asked Questions</h2>
              <div className="space-y-2">
                {faqs.map((f) => (
                  <FAQItem key={f.q} q={f.q} a={f.a} />
                ))}
              </div>
            </div>
          )}

          {/* Contact Support */}
          {active === 'contact' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4">
              <h2 className="text-base font-semibold text-[#022135]">Contact Support</h2>
              <p className="text-sm text-gray-500">Our team is available Monday–Saturday, 9 AM – 8 PM IST.</p>
              <div className="space-y-3">
                <ContactCard
                  icon={Mail}
                  label="Email"
                  value="support@kapzo.in"
                  href="mailto:support@kapzo.in"
                />
                <ContactCard
                  icon={Phone}
                  label="Phone / WhatsApp"
                  value="+91 98765 43210"
                  href="tel:+919876543210"
                />
                <ContactCard
                  icon={MessageSquare}
                  label="Live Chat"
                  value="Start a chat session"
                  href="https://kapzo.in/support"
                />
              </div>
            </div>
          )}

          {/* Raise a Ticket */}
          {active === 'ticket' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-[#022135]">Raise a Ticket</h2>
                <p className="text-sm text-gray-500 mt-1">Describe your issue and our team will follow up within 24 hours.</p>
              </div>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  alert('Your ticket has been submitted. We will reach out shortly.')
                }}
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Subject</label>
                  <input
                    required
                    type="text"
                    placeholder="Brief description of the issue"
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#21A053]/30 focus:border-[#21A053] placeholder:text-gray-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Category</label>
                  <select className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#21A053]/30 focus:border-[#21A053] text-gray-700 bg-white">
                    <option>Order Issue</option>
                    <option>Inventory / Catalogue</option>
                    <option>Payment / Settlement</option>
                    <option>Technical / App Bug</option>
                    <option>Account / Login</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wider">Details</label>
                  <textarea
                    required
                    rows={5}
                    placeholder="Please provide as much detail as possible, including order IDs or screenshots if relevant."
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#21A053]/30 focus:border-[#21A053] placeholder:text-gray-300 resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#21A053] text-white text-sm font-semibold rounded-xl hover:bg-[#1a8a44] transition-colors shadow-[0_2px_8px_rgba(33,160,83,0.25)]"
                >
                  Submit Ticket
                </button>
              </form>
            </div>
          )}

          {/* Order-related Help */}
          {active === 'orders' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-5">
              <h2 className="text-base font-semibold text-[#022135]">Order-related Help</h2>
              <div className="space-y-4">
                {[
                  {
                    title: 'Order not showing up',
                    body: 'Ensure you are online (toggle in sidebar). If an order was placed but not received, it may have been auto-rejected. Check Order History for details.',
                  },
                  {
                    title: 'Customer claims order not delivered',
                    body: 'Check the order status in History. If marked Delivered but the customer has not received it, email support@kapzo.in with the Order ID for investigation.',
                  },
                  {
                    title: 'Wrong items in an order',
                    body: 'Contact support immediately with the Order ID. Do not dispatch if items are incorrect — the order can be adjusted or cancelled.',
                  },
                  {
                    title: 'Refund or cancellation request',
                    body: 'Cancellations can be initiated by the customer before dispatch. Post-dispatch refunds are handled by the Kapzo support team on a case-by-case basis.',
                  },
                  {
                    title: 'Payment not received for an order',
                    body: 'Payments are settled per the agreed payout cycle. If a settlement is overdue, raise a ticket with the relevant Order IDs.',
                  },
                ].map((item) => (
                  <div key={item.title} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                    <p className="text-sm text-gray-500 mt-1">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technical Support */}
          {active === 'technical' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-5">
              <h2 className="text-base font-semibold text-[#022135]">Technical Support</h2>
              <div className="space-y-4">
                {[
                  {
                    title: 'Login / OTP not received',
                    body: 'Check your spam folder. OTPs expire after 60 seconds — request a new one. If the issue persists, contact support with your registered email.',
                  },
                  {
                    title: 'Page not loading or showing errors',
                    body: 'Hard-refresh the page (Ctrl+Shift+R / Cmd+Shift+R). Clear browser cache if the issue continues. Try an incognito/private window to rule out extension conflicts.',
                  },
                  {
                    title: 'Realtime orders not appearing',
                    body: 'Check your internet connection. The dashboard uses a live socket connection — a network interruption will pause updates until reconnected.',
                  },
                  {
                    title: 'Inventory changes not saving',
                    body: 'Ensure you are not in demo mode (yellow banner at top). If in production and saves are failing, check your internet connection and try again.',
                  },
                  {
                    title: 'Browser or device compatibility',
                    body: 'The vendor panel is optimised for Chrome, Edge, and Safari (latest versions). Firefox is supported. Internet Explorer is not supported.',
                  },
                ].map((item) => (
                  <div key={item.title} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                    <p className="text-sm text-gray-500 mt-1">{item.body}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#21A053]/5 border border-[#21A053]/15">
                <Wrench size={16} className="text-[#21A053] mt-0.5 shrink-0" />
                <p className="text-sm text-gray-600">
                  Still stuck?{' '}
                  <button
                    onClick={() => setActive('ticket')}
                    className="text-[#21A053] font-medium hover:underline"
                  >
                    Raise a support ticket
                  </button>{' '}
                  and our technical team will assist within 24 hours.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
