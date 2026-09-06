'use client'

import { useState } from 'react'
import {
  Building2, Phone, Mail, MapPin, Clock, CreditCard,
  FileText, ShieldCheck, Edit2, Save, X,
  Eye, EyeOff, CheckCircle2, AlertCircle, User, Lock,
} from 'lucide-react'
import { updateVendorMe, ApiError } from '@/lib/api'
import { useVendorStore } from '@/lib/store/vendorStore'
import { isDemoMode } from '@/lib/demo'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoginMethodsCard } from '@/components/auth/LoginMethodsCard'
import type { Vendor } from '@/types/database.types'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * Only these two fields are vendor-editable (PATCH /vendors/me). Everything
 * else on this page is admin-owned and renders read-only:
 *   • drug licence + number — changing them without re-review is a compliance
 *     hole, so they go through Kapzo support
 *   • contact phone — doubles as the Firebase login identity, and has to be
 *     changed in step with it
 *   • bank details, working hours, FSSAI — not modelled by the backend at all
 *     (lib/api/mappers.ts maps them to null)
 * Rendering an input for a field the backend will discard is worse than
 * showing it locked, so those sections deliberately have no edit state.
 */
interface FormState {
  pharmacy_name: string
  address: string
}

function initForm(v: Vendor): FormState {
  return {
    pharmacy_name: v.pharmacy_name,
    address: v.address,
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

/* ─── Document tile (read-only) ────────────────────────────────────── */

function DocTile({ label, optional, storagePath }: {
  label: string
  optional?: boolean
  storagePath: string | null
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-[#022135]">
        {label}
        {optional && <span className="text-slate-400 font-normal text-xs ml-1.5">(optional)</span>}
      </p>

      <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden">
        {storagePath ? (
          <div className="flex items-center gap-3 px-5 py-5">
            <div className="w-10 h-10 rounded-lg bg-[#21A053]/10 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-[#21A053]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#022135]">On file</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Verified by Kapzo — contact support to replace
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <FileText size={22} className="text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-400">Not uploaded</p>
            <p className="text-xs text-slate-400 mt-1">Contact Kapzo support to add this document</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Section card wrapper ──────────────────────────────────────────── */

function SectionCard({ title, icon, note, children }: {
  title: string
  icon: React.ReactNode
  note?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100">
        <span className="text-[#00326F]">{icon}</span>
        <h2 className="text-sm font-semibold text-[#022135]">{title}</h2>
        {note && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
            <Lock size={11} /> {note}
          </span>
        )}
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

  const [vendor, setVendor]       = useState(initialVendor)
  const [editing, setEditing]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm]           = useState<FormState>(() => initForm(initialVendor))

  // Account number visibility
  const [showAccount, setShowAccount] = useState(false)

  const isBanned = vendor.status === 'banned'

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function cancelEdit() {
    setForm(initForm(vendor))
    setSaveError(null)
    setEditing(false)
  }

  async function handleSave() {
    const pharmacyName = form.pharmacy_name.trim()
    const addressLine  = form.address.trim()

    if (!pharmacyName) {
      setSaveError('Pharmacy name cannot be empty.')
      return
    }
    if (!addressLine) {
      setSaveError('Address cannot be empty.')
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      let updated: Vendor

      if (isDemoMode) {
        updated = { ...vendor, pharmacy_name: pharmacyName, address: addressLine }
      } else {
        // Send only what actually changed: an unchanged address must not
        // trigger a re-geocode server-side.
        updated = await updateVendorMe({
          ...(pharmacyName !== vendor.pharmacy_name && { pharmacyName }),
          ...(addressLine !== vendor.address && { addressLine }),
        })
      }

      setVendor(updated)
      updateStore(updated)
      setForm(initForm(updated))
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      // The backend's 400 for an unplaceable address is written for the
      // vendor to read ("add more detail…"), so surface it as-is.
      setSaveError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Failed to save changes',
      )
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
          ) : isBanned ? (
            <span className="text-xs text-slate-400 max-w-[220px] text-right">
              This account is suspended — contact Kapzo support
            </span>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit2 size={15} /> Edit Profile
            </Button>
          )}
        </div>
      </div>

      {saveError && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          {saveError}
        </div>
      )}

      {/* ── Basic Information ── */}
      <SectionCard title="Basic Information" icon={<Building2 size={18} />}>
        {editing ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Pharmacy Name"
                value={form.pharmacy_name}
                onChange={e => patch('pharmacy_name', e.target.value)}
                leftIcon={<Building2 size={14} />}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#022135] mb-1.5">Address</label>
              <textarea
                value={form.address}
                onChange={e => patch('address', e.target.value)}
                rows={3}
                className="w-full rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm text-[#022135] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#21A053]/30 focus:border-[#21A053] transition-colors resize-none"
              />
              <p className="text-xs text-slate-400 mt-1.5">
                Include street, area, city and PIN code — this is what riders and
                nearby-pharmacy matching use to find you.
              </p>
            </div>

            {/* Locked fields stay visible while editing so it's clear they
                exist and why they can't be changed here. */}
            <div className="pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <InfoRow icon={<Phone size={13} />} label="Contact Number" value={vendor.phone} />
              <InfoRow icon={<Mail size={13} />} label="Mail ID" value={vendor.email} />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <Lock size={11} />
              Your contact number and email are your sign-in details — contact
              Kapzo support to change them.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InfoRow icon={<Building2 size={13} />} label="Pharmacy Name" value={vendor.pharmacy_name} />
            <InfoRow icon={<User size={13} />} label="Contact Person" value={vendor.contact_person || '—'} />
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
      <SectionCard
        title="Bank Account Details"
        icon={<CreditCard size={18} />}
        note="Managed by Kapzo"
      >
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
      </SectionCard>

      {/* ── Working Hours ── */}
      <SectionCard title="Working Hours" icon={<Clock size={18} />} note="Managed by Kapzo">
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
      </SectionCard>

      {/* ── Documents ── */}
      <SectionCard title="Documents" icon={<ShieldCheck size={18} />} note="Managed by Kapzo">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <DocTile label="Drug License" storagePath={vendor.license_url ?? vendor.license_file_key ?? null} />
          <DocTile label="FSSAI Certificate" optional storagePath={vendor.fssai_url ?? null} />
        </div>
      </SectionCard>

      {/* ── Login methods (Firebase provider linking) ── */}
      <LoginMethodsCard />

    </div>
  )
}
