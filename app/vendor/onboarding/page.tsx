'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, User, Phone, Mail, MapPin,
  FileText, CheckCircle2, Upload, ArrowRight, ArrowLeft, Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel'
import { KapzoLogo } from '@/components/auth/KapzoLogo'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

/* ─── Form data shape ────────────────────────────────────────── */
interface FormData {
  pharmacyName: string
  contactPerson: string
  phone: string
  email: string
  address: string
  licenseFile: File | null
  licenseUrl: string
}

const INITIAL: FormData = {
  pharmacyName: '', contactPerson: '', phone: '', email: '',
  address: '', licenseFile: null, licenseUrl: '',
}

const STEPS = [
  { id: 1, label: 'Pharmacy Details',     icon: Building2 },
  { id: 2, label: 'Location & Documents', icon: MapPin },
  { id: 3, label: 'Review & Submit',      icon: CheckCircle2 },
]

/* ─── Page ───────────────────────────────────────────────────── */
export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep]       = useState(1)
  const [form, setForm]       = useState<FormData>(INITIAL)
  const [errors, setErrors]   = useState<Partial<Record<keyof FormData, string>>>({})
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)

  /* pre-fill phone + email from auth user */
  useEffect(() => {
    async function prefill() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/vendor/login'); return }
      setForm((f) => ({
        ...f,
        phone: user.phone ?? '',
        email: user.email ?? '',
      }))
    }
    prefill()
  }, [router])

  function set(key: keyof FormData, value: string | File | null) {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  /* ── Validation per step ── */
  function validate(s: number): boolean {
    const errs: typeof errors = {}
    if (s === 1) {
      if (!form.pharmacyName.trim())   errs.pharmacyName   = 'Pharmacy name is required'
      if (!form.contactPerson.trim())  errs.contactPerson  = 'Contact person name is required'
      if (!form.phone.replace(/\D/g, '') || form.phone.replace(/\D/g, '').length < 10)
        errs.phone = 'Enter a valid 10-digit phone number'
      if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        errs.email = 'Enter a valid email address'
    }
    if (s === 2) {
      if (!form.address.trim())    errs.address    = 'Full address is required'
      if (!form.licenseUrl)        errs.licenseFile = 'Drug license document is required'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function next() {
    if (validate(step)) setStep((s) => s + 1)
  }
  function back() { setStep((s) => s - 1) }

  /* ── Final submit ── */
  async function submit() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      /* Insert vendor row */
      const { error: vendorErr } = await supabase.from('vendors').insert({
        user_id:        user.id,
        pharmacy_name:  form.pharmacyName.trim(),
        contact_person: form.contactPerson.trim(),
        phone:          form.phone.replace(/\D/g, ''),
        email:          form.email.trim(),
        address:        form.address.trim(),
        license_url:    form.licenseUrl,
        status:         'pending',
        is_online:      false,
      })
      if (vendorErr) throw vendorErr

      /* Insert admin notification */
      await supabase.from('notifications').insert({
        type:    'vendor_onboarded',
        title:   'New Pharmacy Application',
        message: `${form.pharmacyName} has submitted an onboarding application.`,
        data:    { pharmacy_name: form.pharmacyName, email: form.email, user_id: user.id },
        recipient_role: 'admin',
      })

      setDone(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    }
    setLoading(false)
  }

  /* ─── Success screen ─── */
  if (done) {
    return (
      <div className="min-h-screen flex">
        <AuthBrandPanel
          heading={<>Application<br /><span className="text-[#21A053]">Submitted!</span></>}
          subheading="Our team reviews every application within 24 hours. You'll get an SMS once approved."
        />
        <div className="flex-1 flex items-center justify-center p-6 bg-white">
          <div className="w-full max-w-sm text-center space-y-6 animate-fade-in-up">
            <div className="w-24 h-24 rounded-2xl bg-[#21A053]/10 flex items-center justify-center mx-auto">
              <CheckCircle2 size={48} className="text-[#21A053]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#022135]">You're on the list!</h2>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                <strong className="text-[#022135]">{form.pharmacyName}</strong> has been submitted for verification.
                Our team will review your details and get back to you within 24 hours.
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left space-y-1">
              <p className="text-amber-700 text-sm font-semibold">What happens next?</p>
              {['Our team verifies your drug license', 'You receive an approval SMS', 'Start accepting orders on Kapzo'].map((s, i) => (
                <p key={i} className="text-amber-600 text-xs flex gap-2">
                  <span className="font-bold">{i + 1}.</span>{s}
                </p>
              ))}
            </div>
            <a
              href="mailto:support@kapzo.in"
              className="inline-flex items-center justify-center w-full py-3 rounded-xl border border-gray-200 text-sm font-medium text-[#022135] hover:bg-slate-50 transition-colors"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      <AuthBrandPanel
        heading={<>Partner with<br /><span className="text-[#21A053]">Kapzo today.</span></>}
        subheading="Complete the short onboarding form and start receiving medicine orders in your area."
      />

      {/* Right — wizard */}
      <div className="flex-1 flex flex-col bg-white overflow-y-auto">
        <div className="flex-1 flex flex-col items-center justify-start pt-10 pb-16 px-6 sm:px-10">
          <div className="w-full max-w-[440px]">

            {/* Mobile logo */}
            <div className="flex lg:hidden items-center gap-2.5 mb-8">
              <KapzoLogo size={34} />
              <span className="font-bold text-[#022135]">Kapzo Vendor</span>
            </div>

            {/* Step indicator */}
            <StepIndicator step={step} />

            {/* Steps */}
            <div className="mt-8 animate-step-in" key={step}>
              {step === 1 && <Step1 form={form} set={set} errors={errors} />}
              {step === 2 && <Step2 form={form} set={set} errors={errors} />}
              {step === 3 && <Step3 form={form} />}
            </div>

            {/* Navigation */}
            <div className={cn('mt-8 flex gap-3', step > 1 ? 'justify-between' : 'justify-end')}>
              {step > 1 && (
                <button
                  onClick={back}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <ArrowLeft size={15} /> Back
                </button>
              )}
              {step < 3 ? (
                <GradientButton onClick={next}>
                  Continue <ArrowRight size={15} />
                </GradientButton>
              ) : (
                <GradientButton onClick={submit} loading={loading}>
                  Submit Application
                </GradientButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Step indicator ─────────────────────────────────────────── */
function StepIndicator({ step }: { step: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0',
              step > s.id  ? 'bg-[#21A053] text-white'
              : step === s.id ? 'bg-gradient-to-br from-[#21A053] to-[#00326F] text-white shadow-md'
              : 'bg-slate-100 text-slate-400'
            )}>
              {step > s.id ? <CheckCircle2 size={14} /> : s.id}
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('flex-1 h-0.5 rounded-full transition-all', step > s.id ? 'bg-[#21A053]' : 'bg-slate-100')} />
            )}
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs text-slate-400">Step {step} of {STEPS.length}</p>
        <p className="text-base font-bold text-[#022135] mt-0.5">{STEPS[step - 1].label}</p>
      </div>
    </div>
  )
}

/* ─── Step 1: Pharmacy Details ───────────────────────────────── */
function Step1({ form, set, errors }: StepProps) {
  return (
    <div className="space-y-4">
      <FormField label="Pharmacy / Store Name" error={errors.pharmacyName} icon={<Building2 size={15} />}>
        <input
          type="text"
          placeholder="e.g. Sharma Medical Store"
          value={form.pharmacyName}
          onChange={(e) => set('pharmacyName', e.target.value)}
          className={inputCls(!!errors.pharmacyName)}
        />
      </FormField>
      <FormField label="Contact Person Name" error={errors.contactPerson} icon={<User size={15} />}>
        <input
          type="text"
          placeholder="Full name"
          value={form.contactPerson}
          onChange={(e) => set('contactPerson', e.target.value)}
          className={inputCls(!!errors.contactPerson)}
        />
      </FormField>
      <FormField label="Phone Number" error={errors.phone} icon={<Phone size={15} />}>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 px-3 rounded-xl border border-gray-200 bg-slate-50 text-sm text-slate-500 shrink-0">
            🇮🇳 +91
          </div>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="98765 43210"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
            className={cn(inputCls(!!errors.phone), 'flex-1')}
          />
        </div>
      </FormField>
      <FormField label="Email Address" error={errors.email} icon={<Mail size={15} />}>
        <input
          type="email"
          placeholder="pharmacy@example.com"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          className={inputCls(!!errors.email)}
        />
      </FormField>
    </div>
  )
}

/* ─── Step 2: Location & Documents ──────────────────────────── */
function Step2({ form, set, errors }: StepProps) {
  const fileRef   = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)

  async function uploadLicense(file: File) {
    setUploading(true)
    setProgress(0)

    /* Animate progress to 85% while uploading */
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 12, 85))
    }, 200)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const ext  = file.name.split('.').pop()
    const path = `${user?.id ?? 'unknown'}/${Date.now()}_license.${ext}`

    const { data, error } = await supabase.storage
      .from('vendor-licenses')
      .upload(path, file, { upsert: true })

    clearInterval(interval)

    if (error) {
      toast.error('Upload failed: ' + error.message)
      setProgress(0)
    } else {
      setProgress(100)
      const { data: url } = supabase.storage.from('vendor-licenses').getPublicUrl(data.path)
      set('licenseUrl', url.publicUrl)
      set('licenseFile', file)
      toast.success('License uploaded!')
    }
    setUploading(false)
  }

  return (
    <div className="space-y-5">
      <FormField label="Full Address" error={errors.address} icon={<MapPin size={15} />}>
        <textarea
          placeholder="Shop no., street, area, city, state, PIN"
          rows={3}
          value={form.address}
          onChange={(e) => set('address', e.target.value)}
          className={cn(inputCls(!!errors.address), 'resize-none h-auto py-3 leading-relaxed')}
        />
      </FormField>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[#022135] flex items-center gap-1.5">
          <FileText size={15} className="text-slate-400" />
          Drug License <span className="text-red-400">*</span>
        </label>

        {form.licenseUrl ? (
          /* Uploaded state */
          <div className="flex items-center justify-between p-4 bg-[#21A053]/8 border border-[#21A053]/30 rounded-xl">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2 size={18} className="text-[#21A053] shrink-0" />
              <span className="text-sm font-medium text-[#022135] truncate">
                {form.licenseFile?.name ?? 'License uploaded'}
              </span>
            </div>
            <button
              onClick={() => { set('licenseUrl', ''); set('licenseFile', null); setProgress(0) }}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors ml-3 shrink-0"
            >
              Remove
            </button>
          </div>
        ) : (
          /* Drop zone */
          <div
            onClick={() => fileRef.current?.click()}
            className={cn(
              'relative flex flex-col items-center justify-center gap-2 py-8 px-4 rounded-xl border-2 border-dashed cursor-pointer transition-all',
              errors.licenseFile ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-[#21A053]/50 hover:bg-[#21A053]/3',
              uploading && 'pointer-events-none'
            )}
          >
            {uploading ? (
              <Loader2 size={28} className="text-[#21A053] animate-spin" />
            ) : (
              <Upload size={28} className="text-slate-300" />
            )}
            <p className="text-sm font-medium text-slate-500">
              {uploading ? 'Uploading…' : 'Click to upload drug license'}
            </p>
            <p className="text-xs text-slate-400">PDF, JPG, PNG — max 10 MB</p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLicense(f) }}
            />

            {/* Progress bar */}
            {(uploading || progress > 0) && progress < 100 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100 rounded-b-xl overflow-hidden">
                <div
                  className="h-full bg-[#21A053] transition-all duration-300 rounded-b-xl"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        )}
        {errors.licenseFile && <p className="text-xs text-red-500">{errors.licenseFile}</p>}
      </div>
    </div>
  )
}

/* ─── Step 3: Review ─────────────────────────────────────────── */
function Step3({ form }: { form: FormData }) {
  const rows: [string, string][] = [
    ['Pharmacy Name',   form.pharmacyName],
    ['Contact Person',  form.contactPerson],
    ['Phone',          '+91 ' + form.phone],
    ['Email',           form.email],
    ['Address',         form.address],
    ['Drug License',    form.licenseFile?.name ?? '—'],
  ]
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Please review your details before submitting.</p>
      <div className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-4 px-4 py-3">
            <p className="text-xs font-medium text-slate-400 w-28 shrink-0 pt-0.5">{label}</p>
            <p className="text-sm text-[#022135] font-medium break-words">{value || '—'}</p>
          </div>
        ))}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <span className="text-amber-500 text-lg shrink-0">ℹ️</span>
        <p className="text-amber-700 text-xs leading-relaxed">
          After submission, your application enters <strong>pending review</strong>. Kapzo's team will verify your drug license and pharmacy details within 24 hours.
        </p>
      </div>
    </div>
  )
}

/* ─── Shared helpers ─────────────────────────────────────────── */
interface StepProps {
  form: FormData
  set: (key: keyof FormData, value: string | File | null) => void
  errors: Partial<Record<keyof FormData, string>>
}

function FormField({
  label, error, icon, children,
}: {
  label: string
  error?: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[#022135] flex items-center gap-1.5">
        {icon && <span className="text-slate-400">{icon}</span>}
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function inputCls(hasError: boolean) {
  return cn(
    'w-full h-11 px-3.5 rounded-xl border bg-white text-sm text-[#022135] placeholder:text-slate-300 transition-all',
    'focus:outline-none focus:ring-2 focus:ring-[#21A053]/30 focus:border-[#21A053]',
    hasError ? 'border-red-400 focus:ring-red-300' : 'border-gray-200'
  )
}

function GradientButton({
  children, onClick, loading, disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  loading?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white text-sm transition-all
        bg-gradient-to-r from-[#21A053] to-[#00326F]
        hover:opacity-90 active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-[#21A053]/40"
    >
      {loading ? <><Loader2 size={15} className="animate-spin" /> Submitting…</> : children}
    </button>
  )
}
