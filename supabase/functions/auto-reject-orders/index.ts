import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const cutoff = new Date(Date.now() - 120_000).toISOString() // 2 minutes ago

  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'rejected',
      rejection_reason: 'Auto-rejected: vendor did not respond in time',
      updated_at: new Date().toISOString(),
    })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('id')

  if (error) {
    console.error('Auto-reject error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const count = data?.length ?? 0
  console.log(`Auto-rejected ${count} orders`)
  return new Response(JSON.stringify({ rejected: count }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
