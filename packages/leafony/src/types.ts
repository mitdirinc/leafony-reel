import type { BoardModel, Vec2 } from '@silk-reel/ingest'
import type { PartMesh } from '@silk-reel/choreo'

export interface BusFrame { origin: Vec2; u: Vec2; v: Vec2; holeSpacing: number }
export interface MeshData { positions: number[]; normals: number[]; colors: number[]; indices: number[] }
export interface LeafAsset {
  id: string
  board: BoardModel
  frame: BusFrame
  meshes: PartMesh[]
  byRef: Record<string, number>
  omitted: string[]
  missingModels: string[]
}
export interface SceneAssets {
  version: 1
  leaves: Record<string, LeafAsset>
  connector: MeshData[]
  spacer: MeshData[]
  nutPlate: MeshData[]
  sources: Array<{ id: string; repo: string; revision: string; path: string; blobSha: string; access: string }>
}
export interface KitDefinition {
  id: string
  name: string
  source: string
  assemblySource: string
  /** Bottom to top, in the orientation shown by the official assembly guide. */
  layers: Array<{ id: string; name: string; role: string; thickness: number }>
  suppliedSeparately: string[]
  fastener: { diameter: number; length: number; count: number; nutPlate: string }
  mechanical: { contactGap: number; status: 'illustrative'; note: string }
  duration: number
}
