import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sources from '../sources.json'

export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const cacheRoot = path.join(packageRoot, '.cache')
export function sourcePath(source: typeof sources[number]): string {
  return path.join(cacheRoot, source.repo, source.path)
}
export function gitBlobHash(bytes: Uint8Array): string {
  return createHash('sha1').update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex')
}
export async function downloadSources(): Promise<void> {
  for (const source of sources) {
    const destination = sourcePath(source)
    let bytes: Buffer | undefined
    try { bytes = await readFile(destination) } catch { /* fetch missing cache */ }
    if (bytes && gitBlobHash(bytes) === source.blobSha) continue
    const url = `https://raw.githubusercontent.com/${source.repo}/${source.revision}/${source.path}`
    if (source.access === 'authorized') {
      bytes = execFileSync('gh', ['api', `repos/${source.repo}/contents/${source.path}?ref=${source.revision}`,
        '-H', 'Accept: application/vnd.github.raw+json'], { maxBuffer: 32 * 1024 * 1024 })
    } else {
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
      if (!response.ok) throw new Error(`${source.id}: download failed (${response.status})`)
      bytes = Buffer.from(await response.arrayBuffer())
    }
    if (gitBlobHash(bytes) !== source.blobSha) throw new Error(`${source.id}: source checksum mismatch`)
    await mkdir(path.dirname(destination), { recursive: true })
    await writeFile(destination, bytes)
    console.log(`Downloaded ${source.id}: ${path.basename(source.path)}`)
  }
}

if (process.argv.includes('--download-only')) await downloadSources()
