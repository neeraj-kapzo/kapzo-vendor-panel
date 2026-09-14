'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Crosshair, MapPin, MapPinOff, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The pharmacy's map pin.
 *
 * Kapzo never derives this from the address text. A geocoded address is only
 * as good as what someone typed, and when it is wrong it is wrong quietly —
 * riders arrive somewhere plausible but not at the shop. So the pin is always
 * a deliberate act: drag the marker to your door.
 *
 * The Google Maps JS API is loaded lazily, once per page, and only when this
 * component actually renders. When `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is absent
 * or the script fails to load, this degrades to two coordinate fields plus a
 * "paste a Google Maps link" box rather than an empty grey rectangle — a
 * vendor without a working map must still be able to get approved.
 */

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

/**
 * AdvancedMarkerElement (replacing the deprecated `google.maps.Marker`)
 * only renders on a vector map, which requires a Map ID. `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`
 * is unset for now, so this falls back to Google's 'DEMO_MAP_ID' — that
 * renders correctly but stamps a "for development purposes only" watermark
 * on the map. Create a real Map ID in Google Cloud Console (Maps Platform >
 * Map Management) and set the env var to drop the watermark.
 */
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'

/** Falls back to Chennai Central when the vendor has no pin yet. */
const DEFAULT_CENTER = { lat: 13.0836, lng: 80.2750 }

export interface LatLng {
  lat: number
  lng: number
}

/**
 * `AdvancedMarkerElement.position` is a union of the classic `LatLng` (whose
 * `lat`/`lng` are methods) and the newer literal/altitude shapes (whose
 * `lat`/`lng` are plain numbers) — this normalises either into `LatLng`.
 */
function toLatLng(
  pos:
    | google.maps.LatLng
    | google.maps.LatLngLiteral
    | google.maps.LatLngAltitude
    | google.maps.LatLngAltitudeLiteral
    | null
    | undefined,
): LatLng | null {
  if (!pos) return null
  if (typeof (pos as google.maps.LatLng).lat === 'function') {
    const p = pos as google.maps.LatLng
    return { lat: p.lat(), lng: p.lng() }
  }
  const p = pos as google.maps.LatLngLiteral
  return { lat: p.lat, lng: p.lng }
}

/* ─── Google Maps script loading ─────────────────────────────────── */

type MapsStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

/** Shared across mounts: the API must only ever be injected once per page. */
let mapsPromise: Promise<void> | null = null

/**
 * Loads the bootstrap script that defines `google.maps.importLibrary` — the
 * currently-recommended way to load Maps JS
 * (https://developers.google.com/maps/documentation/javascript/load-maps-js-api#dynamic-library-import),
 * superseding the classic `<script src=...&libraries=...>` tag. Individual
 * libraries ("maps", "marker", "places") are fetched lazily by each caller
 * via `importLibrary`, not upfront here — this only makes that function
 * available.
 */
function loadGoogleMaps(): Promise<void> {
  if (!MAPS_API_KEY) return Promise.reject(new Error('No Maps API key'))
  if (mapsPromise) return mapsPromise

  mapsPromise = new Promise<void>((resolve, reject) => {
    // Another bundle (or a previous mount) may have got there first.
    if (typeof window !== 'undefined' && typeof window.google?.maps?.importLibrary === 'function') {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_API_KEY)}&loading=async&v=weekly`
    script.async = true
    script.onload = () => {
      // `loading=async` finishes initialising `importLibrary` a tick after
      // the script's own load event fires — waiting for the function to
      // actually exist avoids a race where the first `importLibrary` call
      // (made right after this resolves) fires too early.
      const waitForImportLibrary = () => {
        if (typeof window.google?.maps?.importLibrary === 'function') resolve()
        else setTimeout(waitForImportLibrary, 20)
      }
      waitForImportLibrary()
    }
    script.onerror = () => {
      // Let a later mount retry — a failed load is often a transient network
      // problem, and caching the rejection forever would strand the vendor.
      mapsPromise = null
      reject(new Error('Google Maps failed to load'))
    }
    document.head.appendChild(script)
  })
  return mapsPromise
}

/* ─── Coordinate parsing (shared by the manual fallback) ─────────── */

/**
 * Accepts "12.9716, 77.5946" or a Google Maps URL. In a *place* URL the `@`
 * coordinates are the viewport centre, which can sit a street away from the
 * place itself, so the precise `!3d/!4d` form is tried first.
 */
export function parsePin(input: string): LatLng | null {
  const text = input.trim()
  if (!text) return null
  const patterns = [
    /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (!m) continue
    const lat = Number(m[1])
    const lng = Number(m[2])
    if (
      Number.isFinite(lat) && Number.isFinite(lng) &&
      Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ) {
      return { lat, lng }
    }
  }
  return null
}

/* ─── Component ──────────────────────────────────────────────────── */

interface LocationPickerProps {
  /** The saved pin, or null when none has been set yet. */
  value: LatLng | null
  onChange: (next: LatLng) => void
  /** Read-only rendering (not editing, or a suspended account). */
  disabled?: boolean
}

export function LocationPicker({ value, onChange, disabled }: LocationPickerProps) {
  const [status, setStatus] = useState<MapsStatus>(MAPS_API_KEY ? 'loading' : 'unavailable')
  const [locating, setLocating] = useState(false)
  const [manual, setManual] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([])
  const [selecting, setSelecting] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  // A session groups the keystrokes of one search with the eventual
  // `fetchFields` call for Places billing purposes — reset once a place is
  // picked (a new search starts a new session), per Google's guidance.
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Discards a stale suggestions response that resolves after a newer
  // keystroke has already fired its own request.
  const suggestionsRequestIdRef = useRef(0)
  // Selecting a suggestion fills the input with its full text, which would
  // otherwise re-trigger the suggestions effect below and reopen the
  // dropdown right after picking something from it.
  const justSelectedRef = useRef(false)
  // Kept in a ref so the map's long-lived listeners never close over a stale
  // callback (they are attached once, when the map is built).
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  /* Load the API once. */
  useEffect(() => {
    if (!MAPS_API_KEY) return
    let cancelled = false
    loadGoogleMaps()
      .then(() => !cancelled && setStatus('ready'))
      .catch(() => !cancelled && setStatus('unavailable'))
    return () => { cancelled = true }
  }, [])

  /* Build the map once the API is ready and the container is mounted. Both
     classes come from `importLibrary` rather than the `google.maps.*`
     globals directly — the globals are only populated for libraries the
     classic `libraries=` script param requested, which this loader no
     longer passes. */
  useEffect(() => {
    if (status !== 'ready' || !containerRef.current || mapRef.current) return
    let cancelled = false

    void (async () => {
      const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
        google.maps.importLibrary('maps') as Promise<google.maps.MapsLibrary>,
        google.maps.importLibrary('marker') as Promise<google.maps.MarkerLibrary>,
      ])
      if (cancelled || !containerRef.current || mapRef.current) return

      const center = value ?? DEFAULT_CENTER
      const map = new Map(containerRef.current, {
        center,
        // Zoomed in when we have a real pin, wider when guessing a city centre.
        zoom: value ? 17 : 12,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'cooperative',
        mapId: MAP_ID,
      })
      const marker = new AdvancedMarkerElement({
        map,
        position: center,
        gmpDraggable: !disabled,
      })

      marker.addListener('dragend', () => {
        const pos = toLatLng(marker.position)
        if (pos) onChangeRef.current(pos)
      })
      // Tapping the map is faster than dragging on a phone.
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (disabled || !e.latLng) return
        marker.position = e.latLng
        onChangeRef.current({ lat: e.latLng.lat(), lng: e.latLng.lng() })
      })

      mapRef.current = map
      markerRef.current = marker
    })()

    return () => { cancelled = true }
  }, [status, value, disabled])

  /* As-you-type suggestions, debounced. Uses `AutocompleteSuggestion` (Places
     API New, loaded via `importLibrary`) rather than the `PlaceAutocompleteElement`
     web component, so the dropdown is plain markup we style ourselves instead
     of an opaque closed-shadow-DOM element. Needs "Places API (New)" enabled
     on the key's project — the legacy `Autocomplete` widget uses the older
     "Places API", which this key's project doesn't have enabled. */
  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false
      return
    }
    const query = searchQuery.trim()
    if (status !== 'ready' || !query) {
      setSuggestions([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const requestId = ++suggestionsRequestIdRef.current

    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const { AutocompleteSessionToken, AutocompleteSuggestion } =
            await google.maps.importLibrary('places') as google.maps.PlacesLibrary
          if (requestId !== suggestionsRequestIdRef.current) return
          if (!sessionTokenRef.current) sessionTokenRef.current = new AutocompleteSessionToken()

          const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: query,
            sessionToken: sessionTokenRef.current,
            locationBias: mapRef.current?.getBounds() ?? undefined,
          })
          if (requestId === suggestionsRequestIdRef.current) setSuggestions(results)
        } catch {
          if (requestId === suggestionsRequestIdRef.current) setSuggestions([])
        }
      })()
    }, 250)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery, status])

  /* Fetches the picked suggestion's location, moves the marker and
     re-centres the map on it — a shortcut to dragging, not a replacement
     for it, so the result still lands as an explicit pin. */
  const selectSuggestion = useCallback(async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    const prediction = suggestion.placePrediction
    if (!prediction) return
    justSelectedRef.current = true
    setSearchQuery(prediction.text.toString())
    setSuggestions([])
    setSelecting(true)
    setSearchError(null)
    try {
      const { place } = await prediction.toPlace().fetchFields({ fields: ['location'] })
      const location = place.location
      const map = mapRef.current
      if (!location || !map) return
      const next = { lat: location.lat(), lng: location.lng() }
      map.panTo(next)
      map.setZoom(17)
      if (markerRef.current) markerRef.current.position = next
      onChangeRef.current(next)
    } catch {
      setSearchError('Search failed — try again')
    } finally {
      setSelecting(false)
      // The session ends once a place is fetched — the next search starts a
      // fresh one.
      sessionTokenRef.current = null
    }
  }, [])

  /* Keep the marker in step when the pin changes from outside (e.g. "use my
     current location", or a cancelled edit restoring the saved value). */
  useEffect(() => {
    if (!markerRef.current || !mapRef.current || !value) return
    markerRef.current.position = value
    mapRef.current.panTo(value)
  }, [value])

  useEffect(() => {
    if (markerRef.current) markerRef.current.gmpDraggable = !disabled
  }, [disabled])

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        onChangeRef.current({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }, [])

  function applyManual() {
    const pin = parsePin(manual)
    if (!pin) {
      setManualError('Paste a Google Maps link, or coordinates as "12.9716, 77.5946"')
      return
    }
    setManualError(null)
    setManual('')
    onChange(pin)
  }

  return (
    <div className="space-y-3">
      {status === 'unavailable' ? (
        <ManualEntry
          value={value}
          manual={manual}
          error={manualError}
          disabled={disabled}
          onManualChange={(v) => { setManual(v); setManualError(null) }}
          onApply={applyManual}
        />
      ) : (
        <div className="space-y-2">
          {!disabled && status === 'ready' && (
            <div className="relative space-y-1.5">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchError(null) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (suggestions[0]) void selectSuggestion(suggestions[0])
                    } else if (e.key === 'Escape') {
                      setSuggestions([])
                    }
                  }}
                  onBlur={() => setSuggestions([])}
                  placeholder="Search for your shop or area…"
                  className="w-full rounded-[8px] border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-[#022135] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#21A053]/30 focus:border-[#21A053]"
                />
              </div>
              {suggestions.length > 0 && (
                <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-lg">
                  {suggestions.map((suggestion) => {
                    const prediction = suggestion.placePrediction
                    if (!prediction) return null
                    return (
                      <li key={prediction.placeId}>
                        <button
                          type="button"
                          // Fires before the input's blur (which clears the
                          // list), unlike onClick.
                          onMouseDown={(e) => { e.preventDefault(); void selectSuggestion(suggestion) }}
                          className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />
                          <span className="min-w-0">
                            <span className="block truncate text-[#022135]">
                              {(prediction.mainText ?? prediction.text).toString()}
                            </span>
                            {prediction.secondaryText && (
                              <span className="block truncate text-xs text-slate-400">
                                {prediction.secondaryText.toString()}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              {selecting && <p className="text-xs text-slate-400">Loading location…</p>}
              {searchError && <p className="text-xs text-red-500">{searchError}</p>}
            </div>
          )}
          <div
            className={cn(
              'relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50',
              disabled && 'opacity-90',
            )}
          >
            <div ref={containerRef} className="h-64 w-full" />
            {status === 'loading' && (
              <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">
                Loading map…
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          {value ? (
            <>
              <MapPin size={13} className="text-[#21A053]" />
              <span className="tabular-nums">{value.lat.toFixed(6)}, {value.lng.toFixed(6)}</span>
            </>
          ) : (
            <>
              <MapPinOff size={13} className="text-amber-500" />
              <span className="text-amber-700 font-medium">No pin set yet</span>
            </>
          )}
        </p>

        {!disabled && status !== 'unavailable' && (
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#00326F] hover:underline disabled:opacity-50"
          >
            <Crosshair size={13} />
            {locating ? 'Finding you…' : 'Use my current location'}
          </button>
        )}
      </div>

      {!disabled && status !== 'unavailable' && (
        <p className="text-xs text-slate-400">
          Drag the marker (or tap the map) to your shop door. Riders are sent to this exact
          point, so it matters more than the address text above.
        </p>
      )}
    </div>
  )
}

/* ─── Fallback when the map can't load ───────────────────────────── */

function ManualEntry({
  value, manual, error, disabled, onManualChange, onApply,
}: {
  value: LatLng | null
  manual: string
  error: string | null
  disabled?: boolean
  onManualChange: (v: string) => void
  onApply: () => void
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
      <p className="text-xs text-slate-500 leading-relaxed">
        The map couldn’t load here. You can still set your location: open Google Maps, find your
        shop, and paste the link (or its coordinates) below.
      </p>
      {!disabled && (
        <>
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => onManualChange(e.target.value)}
              placeholder="Paste a Google Maps link, or 12.9716, 77.5946"
              className="flex-1 min-w-0 rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-sm text-[#022135] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#21A053]/30 focus:border-[#21A053]"
            />
            <button
              type="button"
              onClick={onApply}
              className="shrink-0 rounded-[8px] bg-[#21A053] px-3 py-2 text-sm font-medium text-white hover:bg-[#1c8c47] transition-colors"
            >
              Set
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </>
      )}
      {value && (
        <p className="text-xs text-slate-500 tabular-nums">
          Current pin: {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
        </p>
      )}
    </div>
  )
}
