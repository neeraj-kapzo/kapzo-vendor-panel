import { getIdToken } from '@/lib/firebase'

/** Error envelope thrown for any non-2xx API response. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly requestId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1`

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? ''
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  /** Skip the Authorization header (only /auth/bootstrap sets its own). */
  token?: string
}

/**
 * Fetch wrapper for kapzo-backend. Attaches the Firebase ID token, JSON-encodes
 * the body, and normalises Nest's error envelope
 * `{ statusCode, error, message, requestId }` into ApiError.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = options

  const token = options.token ?? (await getIdToken())
  if (!token) throw new ApiError(401, 'Not signed in')

  const url = new URL(API_BASE + path, window.location.origin)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
  }

  let response: Response
  try {
    response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Network error — could not reach the Kapzo server')
  }

  if (!response.ok) {
    let message = response.statusText
    let requestId: string | undefined
    try {
      const payload = (await response.json()) as {
        message?: string | string[]
        requestId?: string
      }
      if (Array.isArray(payload.message)) message = payload.message.join(', ')
      else if (payload.message) message = payload.message
      requestId = payload.requestId
    } catch {
      /* non-JSON error body — keep statusText */
    }
    throw new ApiError(response.status, message, requestId)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
