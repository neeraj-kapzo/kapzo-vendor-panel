// Post-build fix for Next.js static export on Windows.
//
// Next's exporter derives each segment-prefetch filename from a path built with
// `path.relative`, so on Windows the nested part carries backslashes
// (`/admin\support`). The encoder only replaces forward slashes with dots and
// therefore writes `__next.admin\support.txt`, which Windows turns into the
// folder `__next.admin/` holding `support.txt`. The client router requests the
// flat name `__next.admin.support.txt`, gets a 404, and falls back to full page
// loads on every navigation.
//
// This script moves every file under an `out/**/__next.*/` folder to its flat
// dotted name. It is a no-op on Linux/macOS, where the export is already flat.
import { promises as fs } from 'node:fs'
import path from 'node:path'

const outDir = path.resolve(process.argv[2] ?? 'out')
let moved = 0

async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('__next.')) {
      await flatten(dir, full, entry.name)
      await fs.rm(full, { recursive: true, force: true })
    } else {
      await walk(full)
    }
  }
}

async function flatten(routeDir, dir, prefix) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await flatten(routeDir, full, `${prefix}.${entry.name}`)
    } else {
      const flatName = `${prefix}.${entry.name}`
      await fs.rename(full, path.join(routeDir, flatName))
      moved++
    }
  }
}

await walk(outDir)
console.log(`fix-segment-files: flattened ${moved} segment file(s) under ${outDir}`)
