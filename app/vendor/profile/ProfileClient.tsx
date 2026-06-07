'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Building2, Phone, Mail, MapPin, Clock, CreditCard,
  FileText, ShieldCheck, Edit2, Save, X, Upload, Loader2,
  Eye, EyeOff, CheckCircle2, AlertCircle, User,
} from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useVendorStore } from '@/lib/store/vendorStore'
import { isDemoMode } from '@/lib/demo'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Vendor } from '@/types/database.types'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface FormState {
  pharmacy_name: string
  contact_person: string
  address: string
  phone: string
  alt_phone: string
  email: string
  bank_account_holder: string
  bank_name: string
  bank_account_number: string
  bank_ifsc: string
  working_hours_start: string
  working_hours_end: string
  working_days: string[]
}

function initForm(v: Vendor): FormState {
  return {
    pharmacy_name:       v.pharmacy_name,
    contact_person:      v.contact_person,
    address:             v.address,
    phone:               v.phone,
    alt_phone:           v.alt_phone ?? '',
    email:               v.email,
    bank_account_holder: v.bank_account_holder ?? '',
    bank_name:           v.bank_name ?? '',
    bank_account_number: v.bank_account_number ?? '',
    bank_ifsc:           v.bank_ifsc ?? '',
    working_hours_start: v.working_hours_start ?? '09:00',
    working_hours_end:   v.working_hours_end ?? '21:00',
    working_days:        v.working_days ?? [],
  }
}

function maskAccount(num: string) {
  if (num.length <= 4) return num
  return '•'.repeat(num.length - 4) + num.slice(-4)
}

function fmt24to12(time: string) {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour   = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

/* ─── Document upload tile ─────────────────────────────────────────── */

interface DocUploadProps {
  label: string
  optional?: boolean
  storagePath: string | null
  previewUrl: string | null
  editing: boolean
  uploading: boolean
  onUpload: (file: File) => void
}

function DocUpload({ label, optional, storagePath, previewUrl, editing, uploading, onUpload }: DocUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const isImage = storagePath ? /\.(jpg|jpeg|png|webp)$/i.test(storagePath) : false

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-[#022135]">
        {label}
        {optional && <span className="text-slate-400 font-normal text-xs ml-1.5">(optional)</span>}
      </p>

      <div
        className={cn(
          'relative rounded-xl border-2 border-dashed transition-colors overflow-hidden',
          editing
            ? 'border-[#21A053]/40 bg-[#21A053]/[0.03] cursor-pointer hover:border-[#21A053]/60'
            : 'border-slate-200 bg-slate-50',
        )}
        onClick={editing ? () => fileRef.current?.click() : undefined}
      >
        {storagePath && previewUrl ? (
          <div className="relative">
            {isImage ? (
              <div className="relative h-40">
                <Image src={previewUrl} alt={label} fill className="object-contain p-3" />
              </div>
            ) : (
              <div className="flex items-center gap-3 px-5 py-5">
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#022135]">PDF Document</p>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-xs text-[#21A053] hover:underline"
                  >
                    View document →
                  </a>
                </div>
              </div>
            )}
            {editing && (
              <div className="absolute inset-0 bg-[#022135]/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <span className="bg-white text-[#022135] text-xs font-semibold px-4 py-2 rounded-lg shadow">
                  Click to replace
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            {uploading ? (
              <Loader2 size={22} className="text-[#21A053] animate-spin mb-2" />
            ) : (
              <Upload size={22} className={cn('mb-2', editing ? 'text-[#21A053]' : 'text-slate-300')} />
            )}
            <p className={cn('text-sm font-medium', editing ? 'text-[#21A053]' : 'text-slate-400')}>
              {uploading ? 'Uploading…' : editing ? 'Click to upload' : 'Not uploaded'}
            </p>
            <p className="text-xs text-slate-400 mt-1">JPG, PNG, PDF — up to 10 MB</p>
          </div>
        )}
      </div>

      {editing && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) onUpload(file)
              e.target.value = ''
            }}
          />
          <Button variant="outline" size="sm" type="button" loading={uploading} onClick={() => fileRef.current?.click()}>
            <Upload size={14} />
            {storagePath ? 'Replace' : 'Upload'}
          </Button>
        </>
      )}
    </div>
  )
}

/* ─── Section card wrapper ──────────────────────────────────────────── */

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100">
        <span className="text-[#00326F]">{icon}</span>
        <h2 className="text-sm font-semibold text-[#022135]">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

/* ─── Read-only info row ───────────────────────────────────────────── */

function InfoRow({ icon, label, value, action }: {
  icon?: React.ReactNode
  label: string
  value: string
  action?: React.ReactNode
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
        <p className="text-sm text-[#022135] font-medium break-all">{value}</p>
        {action}
      </div>
    </div>
  )
}

/* ─── Main component ───────────────────────────────────────────────── */

export function ProfileClient({ vendor: initialVendor }: { vendor: Vendor }) {
  const { setVendor: updateStore } = useVendorStore()

  const [vendor, setVendor]           = useState(initialVendor)
  const [editing, setEditing]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [form, setForm]               = useState<FormState>(() => initForm(initialVendor))

  // Document paths + signed preview URLs
  const [licensePath, setLicensePath]     = useState(initialVendor.license_url)
  const [fssaiPath, setFssaiPath]         = useState(initialVendor.fssai_url ?? null)
  const [licensePreview, setLicensePreview] = useState<string | null>(null)
  const [fssaiPreview, setFssaiPreview]   = useState<string | null>(null)
  const [uploadingLicense, setUploadingLicense] = useState(false)
  const [uploadingFssai, setUploadingFssai]     = useState(false)

  // Account number visibility
  const [showAccount, setShowAccount] = useState(false)

  // Load signed preview URLs on mount / when paths change
  useEffect(() => {
    if (isDemoMode) return
    async function loadPreviews() {
      const supabase = createClient()
      if (licensePath) {
        const { data } = await supabase.storage.from('vendor-licenses').createSignedUrl(licensePath, 3600)
        setLicensePreview(data?.signedUrl ?? null)
      }
      if (fssaiPath) {
        const { data } = await supabase.storage.from('vendor-licenses').createSignedUrl(fssaiPath, 3600)
        setFssaiPreview(data?.signedUrl ?? null)
      }
    }
    loadPreviews()
  }, [licensePath, fssaiPath])

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function toggleDay(day: string) {
    patch(
      'working_days',
      form.working_days.includes(day)
        ? form.working_days.filter(d => d !== day)
        : [...form.working_days, day],
    )
  }

  function cancelEdit() {
    setForm(initForm(vendor))
    setLicensePath(vendor.license_url)
    setFssaiPath(vendor.fssai_url ?? null)
    setSaveError(null)
    setEditing(false)
  }

  async function uploadDoc(file: File, type: 'license' | 'fssai') {
    if (isDemoMode) {
      const url = URL.createObjectURL(file)
      if (type === 'license') {
        setLicensePath('demo-license.' + file.name.split('.').pop())
        setLicensePreview(url)
      } else {
        setFssaiPath('demo-fssai.' + file.name.split('.').pop())
        setFssaiPreview(url)
      }
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/${type}-${Date.now()}.${ext}`

    const { error } = await supabase.storage.from('vendor-licenses').upload(path, file, { upsert: true })
    if (error) throw error

    const { data: urlData } = await supabase.storage.from('vendor-licenses').createSignedUrl(path, 3600)

    if (type === 'license') {
      setLicensePath(path)
      setLicensePreview(urlData?.signedUrl ?? null)
    } else {
      setFssaiPath(path)
      setFssaiPreview(urlData?.signedUrl ?? null)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    try {
      const updates: Partial<Vendor> = {
        pharmacy_name:       form.pharmacy_name.trim(),
        contact_person:      form.contact_person.trim(),
        address:             form.address.trim(),
        phone:               form.phone.trim(),
        alt_phone:           form.alt_phone.trim() || null,
        email:               form.email.trim(),
        bank_account_holder: form.bank_account_holder.trim() || null,
        bank_name:           form.bank_name.trim() || null,
        bank_account_number: form.bank_account_number.trim() || null,
        bank_ifsc:           form.bank_ifsc.trim().toUpperCase() || null,
        working_hours_start: form.working_hours_start || null,
        working_hours_end:   form.working_hours_end || null,
        working_days:        form.working_days.length > 0 ? form.working_days : null,
        license_url:         licensePath,
        fssai_url:           fssaiPath,
      }

      if (!isDemoMode) {
        const supabase = createClient()
        const { error } = await supabase.from('vendors').update(updates).eq('id', vendor.id)
        if (error) throw error
      }

      const updated = { ...vendor, ...updates }
      setVendor(updated)
      updateStore(updated)
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#022135]">Pharmacy Profile</h1>
          <p className="text-sm text-slate-500 mt-0.5">View and manage your pharmacy information</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saved && (
            <span className="flex items-center gap-1.5 text-[#21A053] text-sm font-medium">
              <CheckCircle2 size={15} /> Saved
            </span>
          )}
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                <X size={15} /> Cancel
              </Button>
              <Button size="sm" loading={saving} onClick={handleSave}>
                <Save size={15} /> Save Changes
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit2 size={15} /> Edit Profile
            </Button>
          )}
        </div>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          <AlertCircle size={15} className="shrink-0" />
          {saveError}
        </div>
      )}

      {/* ── Basic Information ── */}
      <SectionCard title="Basic Information" icon={<Building2 size={18} />}>
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Pharmacy Name"
              value={form.pharmacy_name}
              onChange={e => patch('pharmacy_name', e.target.value)}
              leftIcon={<Building2 size={14} />}
            />
            <Input
              label="Contact Person"
              value={form.contact_person}
              onChange={e => patch('contact_person', e.target.value)}
              leftIcon={<User size={14} />}
            />
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-[#022135] mb-1.5">Address</label>
              <textarea
                value={form.address}
                onChange={e => patch('address', e.target.value)}
                rows={3}
                className="w-full rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm text-[#022135] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#21A053]/30 focus:border-[#21A053] transition-colors resize-none"
              />
            </div>
            <Input
              label="Contact Number"
              type="tel"
              value={form.phone}
              onChange={e => patch('phone', e.target.value)}
              leftIcon={<Phone size={14} />}
            />
            <Input
              label="Alternative Contact Number"
              type="tel"
              value={form.alt_phone}
              onChange={e => patch('alt_phone', e.target.value)}
              leftIcon={<Phone size={14} />}
              hint="Optional"
            />
            <div className="sm:col-span-2">
              <Input
                label="Mail ID"
                type="email"
                value={form.email}
                onChange={e => patch('email', e.target.value)}
                leftIcon={<Mail size={14} />}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InfoRow icon={<Building2 size={13} />} label="Pharmacy Name" value={vendor.pharmacy_name} />
            <InfoRow icon={<User size={13} />} label="Contact Person" value={vendor.contact_person} />
            <div className="sm:col-span-2">
              <InfoRow icon={<MapPin size={13} />} label="Address" value={vendor.address} />
            </div>
            <InfoRow icon={<Phone size={13} />} label="Contact Number" value={vendor.phone} />
            <InfoRow icon={<Phone size={13} />} label="Alternative Contact" value={vendor.alt_phone ?? '—'} />
            <div className="sm:col-span-2">
              <InfoRow icon={<Mail size={13} />} label="Mail ID" value={vendor.email} />
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Bank Account Details ── */}
      <SectionCard title="Bank Account Details" icon={<CreditCard size={18} />}>
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Account Holder Name"
              value={form.bank_account_holder}
              onChange={e => patch('bank_account_holder', e.target.value)}
            />
            <Input
              label="Bank Name"
              value={form.bank_name}
              onChange={e => patch('bank_name', e.target.value)}
            />
            <Input
              label="Account Number"
              type={showAccount ? 'text' : 'password'}
              value={form.bank_account_number}
              onChange={e => patch('bank_account_number', e.target.value.replace(/\D/g, ''))}
              rightIcon={
                <button type="button" onClick={() => setShowAccount(v => !v)} className="text-slate-400 hover:text-slate-600">
                  {showAccount ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
            />
            <Input
              label="IFSC Code"
              value={form.bank_ifsc}
              onChange={e => patch('bank_ifsc', e.target.value.toUpperCase())}
              hint="e.g. SBIN0001234"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InfoRow label="Account Holder" value={vendor.bank_account_holder ?? '—'} />
            <InfoRow label="Bank Name" value={vendor.bank_name ?? '—'} />
            <InfoRow
              label="Account Number"
              value={
                vendor.bank_account_number
                  ? (showAccount ? vendor.bank_account_number : maskAccount(vendor.bank_account_number))
                  : '—'
              }
              action={
                vendor.bank_account_number ? (
                  <button
                    type="button"
                    onClick={() => setShowAccount(v => !v)}
                    className="text-slate-400 hover:text-slate-600 ml-1"
                  >
                    {showAccount ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                ) : undefined
              }
            />
            <InfoRow label="IFSC Code" value={vendor.bank_ifsc ?? '—'} />
          </div>
        )}
      </SectionCard>

      {/* ── Working Hours ── */}
      <SectionCard title="Working Hours" icon={<Clock size={18} />}>
        {editing ? (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-[#022135] mb-2">Working Days</p>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={cn(
                      'px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                      form.working_days.includes(day)
                        ? 'bg-[#21A053] text-white border-[#21A053]'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-[#21A053]/50 hover:text-[#21A053]',
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#022135] mb-1.5">Opening Time</label>
                <input
                  type="time"
                  value={form.working_hours_start}
                  onChange={e => patch('working_hours_start', e.target.value)}
                  className="w-full h-10 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm text-[#022135] focus:outline-none focus:ring-2 focus:ring-[#21A053]/30 focus:border-[#21A053] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#022135] mb-1.5">Closing Time</label>
                <input
                  type="time"
                  value={form.working_hours_end}
                  onChange={e => patch('working_hours_end', e.target.value)}
                  className="w-full h-10 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm text-[#022135] focus:outline-none focus:ring-2 focus:ring-[#21A053]/30 focus:border-[#21A053] transition-colors"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Working Days</p>
              {vendor.working_days && vendor.working_days.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(day => (
                    <span
                      key={day}
                      className={cn(
                        'px-3 py-1 rounded-lg text-sm font-medium border',
                        vendor.working_days!.includes(day)
                          ? 'bg-[#21A053]/10 text-[#21A053] border-[#21A053]/20'
                          : 'bg-slate-50 text-slate-300 border-slate-100',
                      )}
                    >
                      {day}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Not set</p>
              )}
            </div>
            <div className="flex items-center gap-8">
              <InfoRow
                icon={<Clock size={13} />}
                label="Opens"
                value={vendor.working_hours_start ? fmt24to12(vendor.working_hours_start) : '—'}
              />
              <InfoRow
                icon={<Clock size={13} />}
                label="Closes"
                value={vendor.working_hours_end ? fmt24to12(vendor.working_hours_end) : '—'}
              />
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Documents ── */}
      <SectionCard title="Documents" icon={<ShieldCheck size={18} />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <DocUpload
            label="Drug License"
            storagePath={licensePath}
            previewUrl={licensePreview}
            editing={editing}
            uploading={uploadingLicense}
            onUpload={async (file) => {
              setUploadingLicense(true)
              try { await uploadDoc(file, 'license') }
              catch { setSaveError('Failed to upload drug license. Please try again.') }
              finally { setUploadingLicense(false) }
            }}
          />
          <DocUpload
            label="FSSAI Certificate"
            optional
            storagePath={fssaiPath}
            previewUrl={fssaiPreview}
            editing={editing}
            uploading={uploadingFssai}
            onUpload={async (file) => {
              setUploadingFssai(true)
              try { await uploadDoc(file, 'fssai') }
              catch { setSaveError('Failed to upload FSSAI certificate. Please try again.') }
              finally { setUploadingFssai(false) }
            }}
          />
        </div>
      </SectionCard>

    </div>
  )
}
