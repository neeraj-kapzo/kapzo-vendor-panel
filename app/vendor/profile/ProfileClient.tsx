'use client'

import { useState } from 'react'
import {
  Building2, Phone, Mail, MapPin, Clock, CreditCard,
  FileText, ShieldCheck, Edit2, Save, X, ExternalLink,
  Eye, EyeOff, CheckCircle2, AlertCircle, User, Lock, Hourglass, Navigation,
} from 'lucide-react'
import { updateVendorMe, ApiError } from '@/lib/api'
import { useVendorStore } from '@/lib/store/vendorStore'
import { isDemoMode } from '@/lib/demo'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoginMethodsCard } from '@/components/auth/LoginMethodsCard'
import { LocationPicker, type LatLng } from '@/components/vendor/LocationPicker'
import type { Vendor } from '@/types/database.types'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * What a vendor may change about themselves (PATCH /vendors/me) — including,
 * deliberately, the map pin: riders are routed to that point, and the person
 * who knows where the shop door actually is, is the vendor. Everything else on
 * this page is admin-owned and renders read-only:
 *   • drug licence + number, FSSAI certificate — changing them without
 *     re-review is a compliance hole, so they go through Kapzo support
 *   • contact phone + email — they double as the Firebase login identity, and
 *     have to be changed in step with it
 *   • bank details — letting a vendor redirect their own settlements is a
 *     payout-fraud hole; support owns them
 *   • commission, verification status
 * Rendering an input for a field the backend will discard is worse than
 * showing it locked, so those sections deliberately have no edit state.
 */
interface FormState {
  pharmacy_name: string
  address: string
  alt_phone: string
  working_days: string[]
  working_hours_start: string
  working_hours_end: string
  /** The map pin, null until the vendor drops one. */
  pin: LatLng | null
}

function initForm(v: Vendor): FormState {
  return {
    pharmacy_name: v.pharmacy_name,
    address: v.address,
    alt_phone: v.alt_phone ?? '',
    working_days: v.working_days ?? [],
    working_hours_start: v.working_hours_start ?? '',
    working_hours_end: v.working_hours_end ?? '',
    pin: v.lat !== null && v.lng !== null ? { lat: v.lat, lng: v.lng } : null,
  }
}

const PHONE_RE = /^(\+91)?[6-9]\d{9}$/

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

function DocTile({ label, optional, url, onFile }: {
  label: string
  optional?: boolean
  /** Signed read URL from the backend (valid ~15 min). */
  url: string | null
  /** True when a document exists even if signing its URL failed. */
  onFile: boolean
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-[#022135]">
        {label}
        {optional && <span className="text-slate-400 font-normal text-xs ml-1.5">(optional)</span>}
      </p>

      <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden">
        {onFile ? (
          <div className="flex items-center gap-3 px-5 py-5">
            <div className="w-10 h-10 rounded-lg bg-[#21A053]/10 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-[#21A053]" />
            </div>
            <div className="min-w-0">
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-[#00326F] hover:underline"
                >
                  View document <ExternalLink size={12} />
                </a>
              ) : (
                <p className="text-sm font-medium text-[#022135]">On file</p>
              )}
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

/* ─── Verification-pending notice ──────────────────────────────────── */

/**
 * Shown while the pharmacy is awaiting approval. A pending vendor can sign in
 * and reach exactly this page, so this card carries the whole story: where the
 * application stands, what is still missing, and that editing is not only
 * allowed but the useful thing to do while waiting.
 *
 * `licenceMissing` is the common case for a pharmacy Kapzo bulk-imported from
 * a spreadsheet — the licence number is on record but the scan is not, and
 * that document is what approval is waiting on. Saying so is more useful than
 * a generic "under review", since the vendor would otherwise have no idea
 * anything was needed from them.
 */
function PendingNotice({
  licenceMissing,
  pinMissing,
}: {
  licenceMissing: boolean
  pinMissing: boolean
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <Hourglass size={18} className="text-amber-600" />
        </span>
        <div className="min-w-0 space-y-2">
          <div>
            <h2 className="text-sm font-semibold text-amber-900">Verification pending</h2>
            <p className="text-[13px] leading-relaxed text-amber-800 mt-0.5">
              Kapzo is reviewing your pharmacy. You’ll get an SMS once you’re approved —
              after that your dashboard, orders and settlements open up and you can go online.
            </p>
          </div>
          {(licenceMissing || pinMissing) && (
            <div className="text-[13px] leading-relaxed text-amber-800">
              <p className="font-semibold">Before we can approve you:</p>
              <ul className="mt-1 space-y-0.5 list-disc pl-4">
                {pinMissing && (
                  <li>
                    <span className="font-medium">Set your shop location.</span> Scroll down to
                    the map, choose Edit Profile and drag the pin to your door — riders are sent
                    to that exact point, so we can’t go live without it.
                  </li>
                )}
                {licenceMissing && (
                  <li>
                    <span className="font-medium">Send us your drug licence.</span> Your licence
                    number is on record but the document isn’t — email it to Kapzo support and
                    we’ll attach it for you.
                  </li>
                )}
              </ul>
            </div>
          )}
          {!licenceMissing && !pinMissing && (
            <p className="text-[13px] leading-relaxed text-amber-800">
              Nothing is needed from you right now. If any detail below is wrong, correct it
              here — that’s faster than waiting for the review to bounce back.
            </p>
          )}
          <a
            href="mailto:support@kapzo.in"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700"
          >
            <Mail size={13} /> Contact Kapzo support
          </a>
        </div>
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

  // Only a banned account is read-only. Pending stays editable on purpose —
  // the backend's PATCH /vendors/me allows it, since fixing the details that
  // are under review is exactly what a waiting vendor should be able to do.
  const isBanned  = vendor.status === 'banned'
  const isPending = vendor.status === 'pending'

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function toggleDay(day: string) {
    setForm(prev => ({
      ...prev,
      working_days: prev.working_days.includes(day)
        ? prev.working_days.filter(d => d !== day)
        : [...prev.working_days, day],
    }))
  }

  function cancelEdit() {
    setForm(initForm(vendor))
    setSaveError(null)
    setEditing(false)
  }

  async function handleSave() {
    const pharmacyName = form.pharmacy_name.trim()
    const addressLine  = form.address.trim()
    const altPhone     = form.alt_phone.trim().replace(/[\s-]/g, '')
    const opensAt      = form.working_hours_start
    const closesAt     = form.working_hours_end
    // Keep calendar order regardless of the order the chips were tapped.
    const workingDays  = DAYS.filter(d => form.working_days.includes(d))

    if (!pharmacyName) {
      setSaveError('Pharmacy name cannot be empty.')
      return
    }
    if (!addressLine) {
      setSaveError('Address cannot be empty.')
      return
    }
    if (altPhone && !PHONE_RE.test(altPhone)) {
      setSaveError('Alternative contact must be a 10-digit Indian mobile number.')
      return
    }
    if (Boolean(opensAt) !== Boolean(closesAt)) {
      setSaveError('Set both an opening and a closing time, or leave both blank.')
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      let updated: Vendor

      if (isDemoMode) {
        updated = {
          ...vendor,
          pharmacy_name:       pharmacyName,
          address:             addressLine,
          alt_phone:           altPhone || null,
          working_days:        workingDays,
          working_hours_start: opensAt || null,
          working_hours_end:   closesAt || null,
          lat:                 form.pin?.lat ?? null,
          lng:                 form.pin?.lng ?? null,
        }
      } else {
        // Send only what actually changed: an unchanged address must not
        // trigger a re-geocode server-side.
        updated = await updateVendorMe({
          ...(pharmacyName !== vendor.pharmacy_name && { pharmacyName }),
          ...(addressLine !== vendor.address && { addressLine }),
          ...((altPhone || null) !== vendor.alt_phone && { altPhone: altPhone || null }),
          ...(workingDays.join() !== (vendor.working_days ?? []).join() && { workingDays }),
          ...((opensAt || null) !== vendor.working_hours_start && { workingHoursStart: opensAt || null }),
          ...((closesAt || null) !== vendor.working_hours_end && { workingHoursEnd: closesAt || null }),
          // lat and lng always travel together, and only when the marker moved.
          ...(form.pin &&
            (form.pin.lat !== vendor.lat || form.pin.lng !== vendor.lng) && {
              lat: form.pin.lat,
              lng: form.pin.lng,
            }),
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

      {isPending && (
        <PendingNotice
          licenceMissing={!(vendor.license_url ?? vendor.license_file_key)}
          pinMissing={vendor.lat === null || vendor.lng === null}
        />
      )}

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Alternative Contact"
                type="tel"
                placeholder="Optional"
                value={form.alt_phone}
                onChange={e => patch('alt_phone', e.target.value)}
                leftIcon={<Phone size={14} />}
              />
            </div>

            {/* Locked fields stay visible while editing so it's clear they
                exist and why they can't be changed here. */}
            <div className="pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <InfoRow icon={<User size={13} />} label="Contact Person" value={vendor.contact_person || '—'} />
              <InfoRow icon={<Phone size={13} />} label="Contact Number" value={vendor.phone} />
              <div className="sm:col-span-2">
                <InfoRow icon={<Mail size={13} />} label="Mail ID" value={vendor.email || '—'} />
              </div>
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
              <InfoRow icon={<Mail size={13} />} label="Mail ID" value={vendor.email || '—'} />
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

      {/* ── Working Hours (vendor-editable) ── */}
      <SectionCard title="Working Hours" icon={<Clock size={18} />}>
        <div className="space-y-5">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Working Days</p>
            {editing ? (
              <div className="flex flex-wrap gap-2">
                {DAYS.map(day => {
                  const on = form.working_days.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleDay(day)}
                      className={cn(
                        'px-3 py-1 rounded-lg text-sm font-medium border transition-colors',
                        on
                          ? 'bg-[#21A053]/10 text-[#21A053] border-[#21A053]/20'
                          : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300',
                      )}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            ) : vendor.working_days && vendor.working_days.length > 0 ? (
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
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Opens at"
                type="time"
                value={form.working_hours_start}
                onChange={e => patch('working_hours_start', e.target.value)}
              />
              <Input
                label="Closes at"
                type="time"
                value={form.working_hours_end}
                onChange={e => patch('working_hours_end', e.target.value)}
              />
            </div>
          ) : (
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
          )}
        </div>
      </SectionCard>

      {/* ── Location (vendor-editable) ── */}
      <SectionCard title="Shop Location" icon={<Navigation size={18} />}>
        <div className="space-y-4">
          <p className="text-sm text-slate-500 leading-relaxed">
            This pin is where riders are sent to collect orders — it is separate from the
            address text above, and Kapzo can’t approve your pharmacy without it.
          </p>
          <LocationPicker
            value={editing ? form.pin : (vendor.lat !== null && vendor.lng !== null ? { lat: vendor.lat, lng: vendor.lng } : null)}
            onChange={(pin) => patch('pin', pin)}
            disabled={!editing}
          />
          <p className="text-xs text-slate-500">
            Delivery zone:{' '}
            <span className="font-medium text-[#022135]">
              {vendor.zone_name ?? 'Not in a service zone yet'}
            </span>
          </p>
          {!editing && !isBanned && (
            <p className="text-xs text-slate-400">
              Choose <span className="font-medium text-slate-500">Edit Profile</span> to move the pin.
            </p>
          )}
        </div>
      </SectionCard>

      {/* ── Documents ── */}
      <SectionCard title="Documents" icon={<ShieldCheck size={18} />} note="Managed by Kapzo">
        <div className="space-y-6">
          <InfoRow icon={<FileText size={13} />} label="Drug License Number" value={vendor.license_number || '—'} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <DocTile
              label="Drug License"
              url={vendor.license_url ?? null}
              onFile={Boolean(vendor.license_url ?? vendor.license_file_key)}
            />
            <DocTile
              label="FSSAI Certificate"
              optional
              url={vendor.fssai_url ?? null}
              onFile={Boolean(vendor.fssai_url)}
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Login methods (Firebase provider linking) ── */}
      <LoginMethodsCard />

    </div>
  )
}
