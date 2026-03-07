import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database.types'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do NOT remove this
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect all /vendor/* routes (except login)
  const { pathname } = request.nextUrl
  const isVendorRoute = pathname.startsWith('/vendor')
  const isLoginRoute = pathname === '/vendor/login'

  if (isVendorRoute && !isLoginRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/vendor/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
