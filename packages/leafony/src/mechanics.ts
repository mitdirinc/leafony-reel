import type { BoardModel, Vec2 } from '@silk-reel/ingest'
import type { BusFrame, KitDefinition } from './types'

export function item<T>(array: readonly T[], index: number): T {
  const value=array[index]
  if (value===undefined) throw new Error(`Missing item ${index}`)
  return value
}

export function closedContours(board: BoardModel): Vec2[][] {
  const loops=board.outline.filter(p=>p.closed).map(p=>[...p.points])
  const open=board.outline.filter(p=>!p.closed&&p.points.length>=2).map(p=>[...p.points])
  const near=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.y-b.y)<0.02
  while(open.length){
    const chain=open.pop() as Vec2[]
    while(!near(item(chain,0),item(chain,chain.length-1))){
      const end=item(chain,chain.length-1)
      const next=open.findIndex(p=>near(end,item(p,0))||near(end,item(p,p.length-1)))
      if(next<0)throw new Error(`${board.source.boardName}: open PCB contour`)
      const segment=open.splice(next,1)[0] as Vec2[]
      if(!near(end,item(segment,0)))segment.reverse()
      chain.push(...segment.slice(1))
    }
    if(chain.length>=4)loops.push(chain)
  }
  return loops
}

export function busFrame(board: BoardModel): BusFrame {
  const connector = board.footprints.find(f => f.ref === 'CN1' && /Leafony|Bus/i.test(f.value ?? ''))
  if (!connector) throw new Error(`${board.source.boardName}: Leafony Bus CN1 not found`)
  const pads = [...new Map(Object.values(board.copper).flatMap(c => c.pads)
    .filter(p => p.footprintRef === connector.ref && p.shape === 'circle')
    .map(p => [p.id, p])).values()].sort((a, b) => a.pos.x - b.pos.x || a.pos.y - b.pos.y)
  if (pads.length !== 2) throw new Error('Expected exactly two connector mounting holes')
  const [a, b] = pads.map(p => p.pos) as [Vec2, Vec2]
  const holeSpacing = Math.hypot(b.x - a.x, b.y - a.y)
  if (Math.abs(holeSpacing - 16.5) > 0.03) throw new Error(`Unexpected bus hole spacing: ${holeSpacing}`)
  const u = { x: (b.x - a.x) / holeSpacing, y: (b.y - a.y) / holeSpacing }
  const origin = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  // A rigid frame preserves handedness; never mirror a PCB to align its holes.
  return { origin, u, v: { x: -u.y, y: u.x }, holeSpacing }
}

export function toBus(p: Vec2, f: BusFrame): Vec2 {
  const dx = p.x - f.origin.x, dy = p.y - f.origin.y
  return { x: dx * f.u.x + dy * f.u.y, y: dx * f.v.x + dy * f.v.y }
}

export function layerHeights(kit: KitDefinition): number[] {
  const heights = [0]
  for (let i = 1; i < kit.layers.length; i++) {
    heights.push(item(heights,i-1) + kit.mechanical.contactGap + item(kit.layers,i).thickness)
  }
  return heights
}

export const clamp = (v: number): number => Math.max(0, Math.min(1, v))
export const smooth = (v: number): number => { const q = clamp(v); return q * q * (3 - 2 * q) }
export const span = (time: number, a: number, b: number): number => smooth((time - a) / (b - a))

export function assemblyState(kit: KitDefinition, seconds: number, explosion?: number) {
  const t = Math.max(0, Math.min(kit.duration, seconds))
  const heights = layerHeights(kit)
  const layers = kit.layers.map((_, i) => {
    const start = 2.5 + Math.max(0, i - 1) * 2
    const progress = i === 0 ? 1 : span(t, start, start + 1.5)
    const lift = explosion === undefined ? 1 - progress : clamp(explosion)
    return { y: item(heights,i) + i * 9 * lift, landed: progress >= 1 }
  })
  const insertion = span(t, 14, 16)
  // Alternating half-second turns illustrate balanced tightening, not torque.
  const turns = [0, 0]
  for (let pulse = 0; pulse < 8; pulse++) turns[pulse % 2] = item(turns,pulse%2) + span(t, 16 + pulse * 0.5, 16.5 + pulse * 0.5)
  const screws = turns.map(turn => ({
    y: item(heights,heights.length-1) + 2 + 10 * (1 - insertion) + 0.8 * (1 - turn / 4),
    angle: -turn * Math.PI,
    visible: t >= 14 && explosion === undefined
  }))
  const activeLayer = t < 2.5 ? -1 : Math.min(kit.layers.length - 1, 1 + Math.floor((t - 2.5) / 2))
  const stage = t < 2.5 ? 'parts' : t < 13.5 ? 'stack' : t < 14 ? 'align' : t < 16 ? 'insert' : t < 20 ? 'tighten' : 'complete'
  return { layers, screws, stage, activeLayer, time: t }
}
