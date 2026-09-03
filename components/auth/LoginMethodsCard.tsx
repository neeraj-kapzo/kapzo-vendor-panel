'use client'

import { useEffect, useRef, useState } from 'react'
import { Phone, Mail, KeyRound, CheckCircle2, Plus, X } from 'lucide-react'
import {
  EmailAuthProvider,
  RecaptchaVerifier,
  linkWithCredential,
  linkWithPhoneNumber,
  onAuthStateChanged,
  type ConfirmationResult,
  type User,
} from 'firebase/auth'
import toast from 'react-hot-toast'
import { getFirebaseAuth } from '@/lib/firebase'
import { bootstrap } from '@/lib/api'
import { isDemoMode } from '@/lib/demo'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { OtpInput } from '@/components/auth/OtpInput'

/**
 * "Login methods" card for the profile page.
 *
 * Firebase treats phone-OTP and email/password as separate identity
 * providers. Signing in with a phone number that is not *linked* to the
 * current account mints a brand-new Firebase uid — and therefore a second
 * Kapzo user. This card lets a signed-in vendor link the other method to the
 * account they already have, so both sign-in paths resolve to the same uid.
 *
 * After a successful link we call POST /auth/bootstrap again: the backend
 * fills the newly-verified phone/email onto the existing User row, which is
 * what lets it reject a later duplicate sign-in with a clear 409.
 */

type LinkFlow = 'idle' | 'phone' | 'email'
type PhoneStep = 'number' | 'otp'

const RECAPTCHA_ID = 'link-recaptcha-container'

function firebaseErrorMessage(err: unknown, fallback: string): string {
  const code = (err as { code?: string })?.code
  switch (code) {
    case 'auth/credential-already-in-use':
    case 'auth/account-exists-with-different-credential':
      return 'That login is already used by a different account. Contact Kapzo support to merge them.'
    case 'auth/provider-already-linked':
      return 'This login method is already linked to your account.'
    case 'auth/email-already-in-use':
      return 'That email is already used by a different account.'
    case 'auth/invalid-verification-code':
      return 'Invalid OTP. Please try again.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/requires-recent-login':
      return 'For security, please sign out and sign in again before adding a login method.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.'
    default:
      return err instanceof Error && err.message ? err.message : fallback
  }
}

export function LoginMethodsCard() {
  const [user, setUser] = useState<User | null>(null)
  const [flow, setFlow] = useState<LinkFlow>('idle')
  const [busy, setBusy] = useState(false)

  // phone linking
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('number')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState(false)
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null)
  const confirmationRef = useRef<ConfirmationResult | null>(null)

  // email linking
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isDemoMode) return
    const unsub = onAuthStateChanged(getFirebaseAuth(), setUser)
    return () => {
      unsub()
      recaptchaRef.current?.clear()
      recaptchaRef.current = null
    }
  }, [])

  const providers = new Set(user?.providerData.map((p) => p.providerId) ?? [])
  const hasPhone = providers.has('phone')
  const hasEmail = providers.has('password')

  function reset() {
    setFlow('idle')
    setPhoneStep('number')
    setPhone('')
    setOtp('')
    setOtpError(false)
    setEmail('')
    setPassword('')
    setEmailErrors({})
    confirmationRef.current = null
    recaptchaRef.current?.clear()
    recaptchaRef.current = null
  }

  /** Re-bootstrap so the backend records the newly-linked contact. */
  async function syncBackend(u: User) {
    try {
      await bootstrap(await u.getIdToken(true))
    } catch (err) {
      // The link itself succeeded; the backend fill-in is best-effort here
      // and will happen on the next sign-in anyway.
      toast.error(firebaseErrorMessage(err, 'Linked, but could not sync with the Kapzo server yet.'))
    }
  }

  /* ── phone: send OTP via linkWithPhoneNumber ── */
  async function sendLinkOtp() {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length !== 10) {
      toast.error('Enter a valid 10-digit phone number')
      return
    }
    if (!user) return
    setBusy(true)
    try {
      const auth = getFirebaseAuth()
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, RECAPTCHA_ID, { size: 'invisible' })
      }
      confirmationRef.current = await linkWithPhoneNumber(user, `+91${cleaned}`, recaptchaRef.current)
      setPhoneStep('otp')
      toast.success('OTP sent to your phone')
    } catch (err) {
      toast.error(firebaseErrorMessage(err, 'Failed to send OTP'))
      recaptchaRef.current?.clear()
      recaptchaRef.current = null
    } finally {
      setBusy(false)
    }
  }

  async function confirmLinkOtp() {
    if (otp.length < 6 || !confirmationRef.current) {
      setOtpError(true)
      return
    }
    setOtpError(false)
    setBusy(true)
    try {
      const cred = await confirmationRef.current.confirm(otp)
      toast.success('Phone login added')
      reset()
      await syncBackend(cred.user)
    } catch (err) {
      setOtpError(true)
      toast.error(firebaseErrorMessage(err, 'Could not verify OTP'))
    } finally {
      setBusy(false)
    }
  }

  /* ── email: linkWithCredential(EmailAuthProvider) ── */
  async function linkEmail(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!email) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email'
    if (!password) errs.password = 'Password is required'
    else if (password.length < 6) errs.password = 'At least 6 characters'
    setEmailErrors(errs)
    if (Object.keys(errs).length || !user) return

    setBusy(true)
    try {
      const cred = await linkWithCredential(user, EmailAuthProvider.credential(email, password))
      toast.success('Email login added')
      reset()
      await syncBackend(cred.user)
    } catch (err) {
      toast.error(firebaseErrorMessage(err, 'Could not add email login'))
    } finally {
      setBusy(false)
    }
  }

  /* ── render ── */
  const phoneValue = user?.phoneNumber ?? null
  const emailValue = user?.email ?? null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100">
        <span className="text-[#00326F]"><KeyRound size={18} /></span>
        <h2 className="text-sm font-semibold text-[#022135]">Login Methods</h2>
      </div>
      <div className="p-6 space-y-5">
        <p className="text-xs text-slate-500 -mt-1">
          Link both methods to this account so you can sign in with either. Signing in with an
          unlinked phone number or email creates a separate account.
        </p>

        {isDemoMode ? (
          <p className="text-sm text-slate-400">Login methods can&apos;t be changed in demo mode.</p>
        ) : (
          <>
            <MethodRow
              icon={<Phone size={15} />}
              label="Phone OTP"
              value={hasPhone ? phoneValue : null}
              linked={hasPhone}
              onAdd={() => { reset(); setFlow('phone') }}
              disabled={flow !== 'idle' || !user}
            />
            <MethodRow
              icon={<Mail size={15} />}
              label="Email & password"
              value={hasEmail ? emailValue : null}
              linked={hasEmail}
              onAdd={() => { reset(); setFlow('email') }}
              disabled={flow !== 'idle' || !user}
            />

            {flow === 'phone' && (
              <div className="rounded-xl border border-gray-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#022135]">Add phone login</p>
                  <button type="button" onClick={reset} className="text-slate-400 hover:text-slate-600" aria-label="Cancel">
                    <X size={16} />
                  </button>
                </div>
                {phoneStep === 'number' ? (
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                    <div className="flex-1">
                      <Input
                        label="Phone number"
                        type="tel"
                        inputMode="numeric"
                        placeholder="10-digit mobile number"
                        leftIcon={<span className="text-xs font-medium">+91</span>}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        disabled={busy}
                      />
                    </div>
                    <Button size="sm" onClick={sendLinkOtp} loading={busy}>Send OTP</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">Enter the 6-digit code sent to +91 {phone}</p>
                    <OtpInput value={otp} onChange={setOtp} disabled={busy} error={otpError} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={confirmLinkOtp} loading={busy}>Verify &amp; link</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setPhoneStep('number'); setOtp(''); setOtpError(false) }} disabled={busy}>
                        Change number
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {flow === 'email' && (
              <form onSubmit={linkEmail} className="rounded-xl border border-gray-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#022135]">Add email login</p>
                  <button type="button" onClick={reset} className="text-slate-400 hover:text-slate-600" aria-label="Cancel">
                    <X size={16} />
                  </button>
                </div>
                <Input
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={emailErrors.email}
                  disabled={busy}
                />
                <Input
                  label="Password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={emailErrors.password}
                  hint="You'll use this password to sign in with email."
                  disabled={busy}
                />
                <Button size="sm" type="submit" loading={busy}>Add email login</Button>
              </form>
            )}

            <div id={RECAPTCHA_ID} />
          </>
        )}
      </div>
    </div>
  )
}

function MethodRow({ icon, label, value, linked, onAdd, disabled }: {
  icon: React.ReactNode
  label: string
  value: string | null
  linked: boolean
  onAdd: () => void
  disabled: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 shrink-0">{icon}</span>
          {linked ? (
            <>
              <p className="text-sm text-[#022135] font-medium break-all">{value ?? 'Linked'}</p>
              <CheckCircle2 size={14} className="text-[#21A053] shrink-0" />
            </>
          ) : (
            <p className="text-sm text-slate-400">Not linked</p>
          )}
        </div>
      </div>
      {!linked && (
        <Button size="sm" variant="outline" onClick={onAdd} disabled={disabled}>
          <Plus size={14} /> Add
        </Button>
      )}
    </div>
  )
}
