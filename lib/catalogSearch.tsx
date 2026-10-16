import type { CatalogScope, CatalogSortKey } from '@/lib/api'

/** The API refuses shorter text searches (too broad for the index)... */
export const MIN_QUERY_LENGTH = 3
/** ...except a strength like "5" or "40", which is a real search. */
export const isNumberQuery = (q: string) => /^[0-9]+$/.test(q)

/** Can this (trimmed) text be sent to the API as a search? */
export const isSearchable = (typed: string) =>
  typed.length === 0 || typed.length >= MIN_QUERY_LENGTH || isNumberQuery(typed)

export const SCOPES: { value: CatalogScope; label: string; placeholder: string }[] = [
  { value: 'all', label: 'All fields', placeholder: 'Search products' },
  { value: 'name', label: 'Product', placeholder: 'Search by product name' },
  { value: 'composition', label: 'Composition', placeholder: 'Search by composition' },
  { value: 'manufacturer', label: 'Manufacturer', placeholder: 'Search by manufacturer' },
]

/** For sentences: "3 results for “x” in compositions". */
export const scopeNoun = (scope: CatalogScope): string =>
  ({ all: 'all fields', name: 'product names', composition: 'compositions', manufacturer: 'manufacturers' })[scope]

export const sortOptions = (searching: boolean): { value: CatalogSortKey; label: string }[] => [
  // With no search text "best match" is just A-Z, so say so and drop the duplicate.
  { value: 'relevance', label: searching ? 'Best match' : 'Name A–Z' },
  ...(searching ? [{ value: 'name' as const, label: 'Name A–Z' }] : []),
  { value: 'priceAsc', label: 'Price: low to high' },
  { value: 'priceDesc', label: 'Price: high to low' },
]

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Bolds the part of `text` that matched the query. Mirrors the backend, where
 * hyphens / spaces / punctuation are interchangeable: "co trimoxazole" lights
 * up "Co-Trimoxazole", and "dolo650" lights up "Dolo 650" / "Dolo-650".
 */
export function Highlight({ text, query }: { text: string; query: string }) {
  const tokens = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
  if (tokens.length === 0) return <>{text}</>
  const SEP = '[^\\p{L}\\p{N}]'
  // The whole query with optional separators between every character, then each word.
  const letters = tokens.join('').split('').map(escapeRegExp)
  const alternatives = [letters.join(`${SEP}*`), ...tokens.map(escapeRegExp)]
  const pattern = new RegExp(`(${alternatives.join('|')})`, 'iug')
  return (
    <>
      {text.split(pattern).map((part, i) =>
        // split() with a capture group puts the matches at odd indexes.
        i % 2 === 1 ? (
          <mark key={i} className="bg-transparent font-bold text-[#022135]">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  )
}
