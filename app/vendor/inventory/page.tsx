import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InventoryClient } from './InventoryClient'
import type { MergedInventoryItem } from './InventoryClient'

export default async function InventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/vendor/login')

  const { data: vendor } = await supabase
    .from('vendors')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!vendor) redirect('/vendor/dashboard')

  /* ── Parallel fetch: full catalog + vendor's inventory overlay ── */
  const [{ data: catalog }, { data: invRows }] = await Promise.all([
    supabase.from('catalog_items').select('*').order('name'),
    supabase.from('vendor_inventory').select('*').eq('vendor_id', vendor.id),
  ])

  /* ── LEFT JOIN in-memory: every catalog item, inventory data if it exists ── */
  const invMap = new Map((invRows ?? []).map((r) => [r.catalog_item_id, r]))

  const initialItems: MergedInventoryItem[] = (catalog ?? []).map((c) => {
    const inv = invMap.get(c.id)
    return {
      catalog_id:   c.id,
      name:         c.name,
      salt_name:    c.salt_name,
      image_url:    c.image_url,
      mrp:          c.mrp,
      inv_id:       inv?.id          ?? null,
      vendor_price: inv?.vendor_price ?? c.mrp,
      stock_qty:    inv?.stock_qty    ?? 0,
      is_available: inv?.is_available ?? false,
    }
  })

  return <InventoryClient vendorId={vendor.id} initialItems={initialItems} />
}
