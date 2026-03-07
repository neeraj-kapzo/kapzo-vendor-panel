'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Phone, Mail, Lock, Eye, EyeOff, ArrowLeft, RefreshCw, Clock, Ban } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel'
import { OtpInput } from '@/components/auth/OtpInput'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

/* ─── Types ─────────────────────────────────────────────────── */
type Screen   = 'login' | 'pending' | 'banned'
type AuthTab  = 'phone' | 'email'
type OtpStep  = 'phone' | 'verify'

/* ─── Post-auth routing ─────────────────────────────────────── */
async function resolveVendorRoute(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: vendor } = await supabase
    .from('vendors')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!vendor)                        return 'onboarding'
  if (vendor.status === 'pending')    return 'pending'
  if (vendor.status === 'banned')     return 'banned'
  if (vendor.status === 'active')     return 'dashboard'
  return 'pending'
}

/* ─── Main page ─────────────────────────────────────────────── */
export default function VendorLoginPage() {
  const router  = useRouter()
  const [screen, setScreen]   = useState<Screen>('login')
  const [tab, setTab]         = useState<AuthTab>('phone')

  /* phone OTP state */
  const [otpStep, setOtpStep]   = useState<OtpStep>('phone')
  const [phone, setPhone]       = useState('')
  const [otp, setOtp]           = useState('')
  const [otpError, setOtpError] = useState(false)
  const [resendSecs, setResendSecs] = useState(0)

  /* email/password state */
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors]   = useState<Record<string, string>>({})

  const [loading, setLoading] = useState(false)

  /* ── countdown timer for OTP resend ── */
  function startResendCountdown() {
    setResendSecs(30)
    const id = setInterval(() => {
      setResendSecs((s) => {
        if (s <= 1) { clearInterval(id); return 0 }
        return s - 1
      })
    }, 1000)
  }

  /* ── post-auth: route based on vendor status ── */
  async function afterAuth() {
    const supabase = createClient()
    const dest = await resolveVendorRoute(supabase)

    if (dest === 'onboarding') { router.push('/vendor/onboarding'); return }
    if (dest === 'dashboard')  { router.push('/vendor/dashboard');  return }
    if (dest === 'pending')    { setScreen('pending'); return }
    if (dest === 'banned')     { setScreen('banned');  return }
  }

  /* ── Phone OTP: step 1 — send OTP ── */
  async function sendOtp() {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 10) {
      toast.error('Enter a valid 10-digit phone number')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      phone: `+91${cleaned}`,
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('OTP sent to your phone')
      setOtpStep('verify')
      startResendCountdown()
    }
    setLoading(false)
  }

  /* ── Phone OTP: step 2 — verify OTP ── */
  async function verifyOtp() {
    if (otp.length < 6) { setOtpError(true); return }
    setOtpError(false)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      phone: `+91${phone.replace(/\D/g, '')}`,
      token: otp,
      type: 'sms',
    })
    if (error) {
      setOtpError(true)
      toast.error('Invalid OTP. Please try again.')
    } else {
      toast.success('Phone verified!')
      await afterAuth()
    }
    setLoading(false)
  }

  /* ── Email/Password login ── */
  async function loginWithEmail(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!email) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email'
    if (!password) errs.password = 'Password is required'
    setFieldErrors(errs)
    if (Object.keys(errs).length) return

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
    } else {
      await afterAuth()
    }
    setLoading(false)
  }

  /* ─── Pending screen ─── */
  if (screen === 'pending') return <StatusScreen type="pending" />

  /* ─── Banned screen ─── */
  if (screen === 'banned') return <StatusScreen type="banned" />

  /* ─── Login form ─── */
  return (
    <div className="min-h-screen flex">
      <AuthBrandPanel />

      {/* Right — form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:pb-8 xl:pb-12 sm:p-10 bg-white min-h-screen">
        <div className="w-full max-w-[400px] animate-fade-in-up">
          {/* Logo — always visible above headings */}
          <div className="mb-8">
            <Image
              src="/logos/Logo.png"
              alt="Kapzo"
              width={240}
              height={36}
              className="h-20 w-auto mx-auto object-contain block"
              priority
            />
          </div>

          {/* OTP verify step */}
          {tab === 'phone' && otpStep === 'verify' ? (
            <div className="animate-step-in space-y-6">
              <button
                onClick={() => { setOtpStep('phone'); setOtp(''); setOtpError(false) }}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-[#022135] transition-colors mb-2"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <div>
                <h2 className="text-2xl font-bold text-[#022135]">Enter OTP</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Sent to <span className="font-medium text-[#022135]">+91 {phone}</span>
                </p>
              </div>

              <OtpInput value={otp} onChange={(v) => { setOtp(v); setOtpError(false) }} error={otpError} disabled={loading} />
              {otpError && <p className="text-center text-xs text-red-500 -mt-2">Incorrect OTP. Please try again.</p>}

              <GradientButton onClick={verifyOtp} loading={loading} disabled={otp.length < 6}>
                Verify & Continue
              </GradientButton>

              {/* Resend */}
              <div className="text-center">
                {resendSecs > 0 ? (
                  <p className="text-sm text-slate-400">
                    Resend in <span className="font-semibold text-[#022135]">{resendSecs}s</span>
                  </p>
                ) : (
                  <button onClick={sendOtp} className="inline-flex items-center gap-1.5 text-sm text-[#21A053] font-medium hover:underline">
                    <RefreshCw size={13} /> Resend OTP
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="animate-step-in">
              <div className="mb-7">
                <h2 className="text-2xl font-bold text-[#022135]">Welcome back</h2>
                <p className="text-slate-400 text-sm mt-1">Sign in to your pharmacy dashboard</p>
              </div>

              {/* Tab switcher */}
              <div className="flex bg-slate-100 rounded-xl p-1 mb-7">
                {(['phone', 'email'] as AuthTab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 rounded-[10px] text-sm font-medium transition-all',
                      tab === t
                        ? 'bg-white text-[#022135] shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    )}
                  >
                    {t === 'phone' ? <Phone size={14} /> : <Mail size={14} />}
                    {t === 'phone' ? 'Phone OTP' : 'Email'}
                  </button>
                ))}
              </div>

              {/* Phone tab */}
              {tab === 'phone' && (
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-medium text-[#022135] block mb-1.5">Phone number</label>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-2 px-3 rounded-xl border border-gray-200 bg-slate-50 text-sm font-medium text-slate-500 shrink-0">
                        🇮🇳 +91
                      </div>
                      <input
                        type="tel"
                        inputMode="numeric"
                        placeholder="98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        onKeyDown={(e) => { if (e.key === 'Enter') sendOtp() }}
                        className="flex-1 h-11 px-3.5 rounded-xl border border-gray-200 text-sm text-[#022135] placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#21A053]/30 focus:border-[#21A053] transition-all"
                      />
                    </div>
                  </div>
                  <GradientButton onClick={sendOtp} loading={loading} disabled={phone.replace(/\D/g, '').length < 10}>
                    Send OTP
                  </GradientButton>
                </div>
              )}

              {/* Email tab */}
              {tab === 'email' && (
                <form onSubmit={loginWithEmail} className="space-y-4" noValidate>
                  <AuthInput
                    label="Email address"
                    type="email"
                    placeholder="pharmacy@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={fieldErrors.email}
                    icon={<Mail size={15} />}
                    autoComplete="email"
                  />
                  <AuthInput
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    error={fieldErrors.password}
                    icon={<Lock size={15} />}
                    autoComplete="current-password"
                    rightAction={
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-300 hover:text-slate-500 transition-colors">
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    }
                  />
                  <GradientButton type="submit" loading={loading}>
                    Sign in to Dashboard
                  </GradientButton>
                </form>
              )}
            </div>
          )}

          <p className="mt-8 text-center text-xs text-slate-400">
            New pharmacy?{' '}
            <a href="mailto:partner@kapzo.in" className="text-[#21A053] font-medium hover:underline">
              Apply to partner with Kapzo
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

/* ─── Status screens ─────────────────────────────────────────── */
function StatusScreen({ type }: { type: 'pending' | 'banned' }) {
  const router  = useRouter()
  const isPending = type === 'pending'

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/vendor/login')
  }

  return (
    <div className="min-h-screen flex">
      <AuthBrandPanel />
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-sm text-center animate-fade-in-up space-y-5">
          <div className={cn(
            'w-20 h-20 rounded-2xl flex items-center justify-center mx-auto',
            isPending ? 'bg-amber-50' : 'bg-red-50'
          )}>
            {isPending
              ? <Clock size={36} className="text-amber-500" />
              : <Ban  size={36} className="text-red-500" />}
          </div>

          <div>
            <h2 className="text-xl font-bold text-[#022135]">
              {isPending ? 'Verification Pending' : 'Account Suspended'}
            </h2>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
              {isPending
                ? 'Your pharmacy application is under review. Our team will verify your details within 24 hours. You\'ll receive an SMS once approved.'
                : 'Your pharmacy account has been suspended. Please contact Kapzo support for assistance.'}
            </p>
          </div>

          <a
            href="mailto:support@kapzo.in"
            className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl border border-gray-200 text-sm font-medium text-[#022135] hover:bg-slate-50 transition-colors"
          >
            Contact Support
          </a>
          <button
            onClick={handleLogout}
            className="w-full text-sm text-slate-400 hover:text-[#022135] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Reusable styled components ─────────────────────────────── */
function GradientButton({
  children, onClick, loading, disabled, type = 'button',
}: {
  children: React.ReactNode
  onClick?: () => void
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all
        bg-gradient-to-r from-[#21A053] to-[#00326F]
        hover:opacity-90 active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-[#21A053]/40"
    >
      {loading ? (
        <span className="inline-flex items-center gap-2 justify-center">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Please wait…
        </span>
      ) : children}
    </button>
  )
}

function AuthInput({
  label, error, icon, rightAction, ...props
}: {
  label: string
  error?: string
  icon?: React.ReactNode
  rightAction?: React.ReactNode
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[#022135]">{label}</label>
      <div className="relative flex items-center">
        {icon && <span className="absolute left-3.5 text-slate-300 pointer-events-none">{icon}</span>}
        <input
          {...props}
          className={cn(
            'w-full h-11 rounded-xl border bg-white text-sm text-[#022135] placeholder:text-slate-300 transition-all',
            'focus:outline-none focus:ring-2 focus:ring-[#21A053]/30 focus:border-[#21A053]',
            icon ? 'pl-10' : 'pl-3.5',
            rightAction ? 'pr-10' : 'pr-3.5',
            error ? 'border-red-400 focus:ring-red-300' : 'border-gray-200'
          )}
        />
        {rightAction && <span className="absolute right-3.5">{rightAction}</span>}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
