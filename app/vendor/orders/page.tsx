import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrdersClient } from './OrdersClient'
import type { OrderWithItems } from './OrdersClient'

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/vendor/login')

  const { data: vendor } = await supabase
    .from('vendors')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!vendor) redirect('/vendor/dashboard')

  const [{ data: activeOrders }, { data: closedOrders }] = await Promise.all([
    /* Active orders — full join with items */
    supabase
      .from('orders')
      .select('*, order_items(*, catalog_item:catalog_items(*))')
      .eq('vendor_id', vendor.id)
      .in('status', ['pending', 'accepted', 'packing', 'packed', 'dispatched'])
      .order('created_at', { ascending: true }),

    /* Closed orders — no items needed for list view */
    supabase
      .from('orders')
      .select('id, vendor_id, customer_id, rider_id, status, total_amount, created_at, updated_at, rejection_reason, prescription_verified')
      .eq('vendor_id', vendor.id)
      .in('status', ['delivered', 'rejected', 'cancelled'])
      .order('updated_at', { ascending: false })
      .limit(60),
  ])

  return (
    <OrdersClient
      vendorId={vendor.id}
      initialActive={(activeOrders ?? []) as OrderWithItems[]}
      initialClosed={closedOrders ?? []}
    />
  )
}
