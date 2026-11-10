import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { parseKicadPcb } from '@silk-reel/ingest'
import { loadPartBodies } from '@silk-reel/render-api'
import { busFrame, item } from './mechanics'
import { downloadSources, packageRoot, cacheRoot, sourcePath } from './download'
import type { MeshData, SceneAssets } from './types'
import sources from '../sources.json'

interface CadMesh {
  name?: string
  color?: number[]
  attributes: { position: { array: number[] }; normal?: { array: number[] } }
  index: { array: number[] }
  brep_faces: Array<{ first: number; last: number; color: number[] | null }>
}
const require = createRequire(import.meta.url)
type Occt = {ReadStepFile:(bytes:Uint8Array,options:object)=>{success:boolean;meshes:CadMesh[]}}
const factory=require('occt-import-js') as ()=>Promise<Occt>
const occt = await factory()
await downloadSources()

function mechanical(id: string): MeshData[] {
  const source = sources.find(s => s.id === id && s.kind === 'zip')
  if(!source)throw new Error(`${id}: missing source`)
  const zip = sourcePath(source)
  const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split(/\r?\n/)
  const entry = entries.find(e => /^[^/\\]+\.(?:step|stp)$/i.test(e))
  if (!entry) throw new Error(`${id}: expected one STEP file at archive root`)
  const bytes = execFileSync('unzip', ['-p', zip, entry], { maxBuffer: 64 * 1024 * 1024 })
  const result = occt.ReadStepFile(bytes, { linearDeflectionType: 'absolute_value', linearDeflection: 0.06, angularDeflection: 0.3 })
  if (!result.success) throw new Error(`${id}: STEP tessellation failed`)
  return result.meshes.map((m, meshIndex) => {
    const positions: number[] = [], normals: number[] = [], colors: number[] = []
    const p = m.attributes.position.array, n = m.attributes.normal?.array
    const color = id === 'AZ61' ? meshIndex === 3 ? [0.40, 0.67, 0.10] : [0.74, 0.77, 0.72]
      : id === 'AX04' ? meshIndex === 0 ? [0.045, 0.22, 0.11] : meshIndex === 3 ? [0.40, 0.67, 0.10] : [0.72, 0.76, 0.70]
      : meshIndex === 0 ? [0.12, 0.14, 0.13] : [0.25, 0.29, 0.25]
    for (let i = 0; i < p.length; i += 3) {
      // All shared meshes use mm: X along mounting holes, Y up, Z into leaf.
      if (id === 'AZ61') {
        positions.push(item(p,i) - 11.5, item(p,i+1), item(p,i+2) - 3)
        normals.push(n?.[i] ?? 0, n?.[i + 1] ?? 1, n?.[i + 2] ?? 0)
      } else {
        const depthOffset = id === 'AX04' ? 2.5 : 0
        const heightOffset = id === 'AX04' ? 0.8 : 0
        positions.push(item(p,i), item(p,i+2) - heightOffset, item(p,i+1) - depthOffset)
        normals.push(n?.[i] ?? 0, n?.[i + 2] ?? 1, n?.[i + 1] ?? 0)
      }
      colors.push(...color)
    }
    // Swapping CAD Y/Z reverses winding for spacer and nut plate.
    const indices = [...m.index.array]
    if (id !== 'AZ61') for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [item(indices,i+2),item(indices,i+1)]
    return { positions, normals, colors, indices }
  })
}

const omitted: Record<string, string[]> = {
  AI05: ['U1','U2','U4','C20','C2','C3','R10','C23','C24','R18','R19','J1'],
  AP03B: ['R5','R7','R12','R14']
}
const scene: SceneAssets = {
  version: 1, leaves: {}, connector: mechanical('AZ61'),
  spacer: mechanical('AX04'), nutPlate: mechanical('AZ63'), sources
}
for (const source of sources.filter(s => s.kind === 'board')) {
  const file = sourcePath(source)
  const board = parseKicadPcb(await readFile(file, 'utf8'), source.id)
  const frame = busFrame(board)
  board.footprints = board.footprints.filter(f => !omitted[source.id]?.includes(f.ref))
  const loaded = await loadPartBodies(board, { boardDir: path.dirname(file), dirs: [cacheRoot] })
  scene.leaves[source.id] = { id: source.id, board, frame,
    meshes: loaded.bodies.meshes, byRef: loaded.bodies.byRef,
    omitted: omitted[source.id] ?? [], missingModels: [...loaded.missing, ...loaded.misplaced] }
  console.log(`Prepared ${source.id}: ${board.footprints.length} footprints; bus ${frame.holeSpacing}mm`)
}
const out = path.join(packageRoot, 'public/generated')
await mkdir(out, { recursive: true })
await writeFile(path.join(out, 'scene.json'), JSON.stringify(scene))
await writeFile(path.join(out, 'manifest.json'), JSON.stringify({
  preparedAt: new Date().toISOString(), sources,
  boards: Object.values(scene.leaves).map(l => ({ id:l.id, frame:l.frame,
    omitted:l.omitted, missingModels:l.missingModels, warnings:l.board.warnings }))
}, null, 2))
console.log(`Scene assets ready: ${out}`)
