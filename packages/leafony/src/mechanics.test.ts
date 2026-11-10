import { describe, expect, it } from 'vitest'
import type { BoardModel, Pad, Vec2 } from '@silk-reel/ingest'
import type { KitDefinition } from './types'
import { assemblyState, busFrame, closedContours, item, layerHeights, toBus } from './mechanics'
import definition from '../kits/cellular-lpwa-cat-m1.json'

const kit=definition as KitDefinition
function board(a: Vec2,b: Vec2): BoardModel {
  const pad=(id:string,pos:Vec2):Pad=>({id,pos,shape:'circle',size:{x:2.05,y:2.05},rot:0,footprintRef:'CN1'})
  return {source:{format:'kicad',files:[],boardName:'fixture'},stackup:{thickness:.8},bbox:{min:a,max:b},outline:[],layers:[],
    copper:{'F.Cu':{pads:[pad('a',a),pad('b',b)],traces:[],vias:[],zones:[]}},silkscreen:{},
    footprints:[{ref:'CN1',value:'Leafony Bus',pos:a,rot:0,layer:'F.Cu',padRefs:[],silkRefs:[],models:[]}],
    drill:[],nets:[],stats:{traces:0,pads:2,vias:0,zones:0,texts:0,drills:2},warnings:[]}
}
describe('shared mechanical datum',()=>{
  it('aligns translated boards by both actual mounting holes',()=>{
    const f=busFrame(board({x:101.75,y:102.5},{x:118.25,y:102.5}))
    expect(toBus({x:101.75,y:102.5},f)).toEqual({x:-8.25,y:0})
    expect(toBus({x:118.25,y:102.5},f)).toEqual({x:8.25,y:0})
    expect(toBus({x:110,y:112.5},f)).toEqual({x:0,y:10})
  })
  it('rotates the frame without mirroring the board',()=>{
    const f=busFrame(board({x:20,y:30},{x:20,y:46.5}))
    expect(toBus({x:10,y:38.25},f)).toEqual({x:0,y:10})
    expect(f.u.x*f.v.y-f.u.y*f.v.x).toBe(1)
  })
  it('rejects a model that cannot share the bus mounting holes',()=>{
    expect(()=>busFrame(board({x:0,y:0},{x:17,y:0}))).toThrow('hole spacing')
  })
})
describe('official Cat-M1 assembly sequence',()=>{
  it('keeps the documented six layers, with AX02B separate',()=>{
    expect(kit.layers.map(l=>l.id)).toEqual(['AV06','AC09','AX04','AP03B','AZ01C','AI05'])
    expect(kit.suppliedSeparately).toContain('AX02B 29-pin')
    expect(kit.fastener).toEqual({diameter:2,length:18,count:2,nutPlate:'AZ63'})
  })
  it('lands bottom-up and leaves the base stationary',()=>{
    expect(item(assemblyState(kit,0).layers,0).y).toBe(0)
    const s=assemblyState(kit,6.1)
    expect(s.layers.slice(0,3).every(l=>l.landed)).toBe(true)
    expect(item(s.layers,3).landed).toBe(false)
    expect(assemblyState(kit,13.5).layers.map(l=>l.y)).toEqual(layerHeights(kit))
  })
  it('alternates screws only after all leaves have landed',()=>{
    expect(assemblyState(kit,13.5).screws.every(s=>!s.visible)).toBe(true)
    const a=assemblyState(kit,16.5),b=assemblyState(kit,17)
    expect(item(a.screws,0).angle).toBeLessThan(item(a.screws,1).angle)
    expect(item(b.screws,0).angle).toBeCloseTo(item(b.screws,1).angle)
    expect(assemblyState(kit,20).screws.map(s=>s.angle)).toEqual([-4*Math.PI,-4*Math.PI])
  })
  it('holds a stable completed assembly at and after the end',()=>{
    const end=assemblyState(kit,kit.duration)
    expect(end.stage).toBe('complete');expect(end.layers.every(l=>l.landed)).toBe(true)
    expect(assemblyState(kit,100)).toEqual(end)
    expect(kit.mechanical.status).toBe('illustrative')
  })
})

describe('KiCad outline reconstruction',()=>{
  it('joins unordered and reversed Edge.Cuts without replacing a notch by a box',()=>{
    const b=board({x:0,y:0},{x:16.5,y:0})
    const points=[{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:12,y:20},{x:12,y:15},{x:8,y:15},{x:8,y:20},{x:0,y:20}]
    b.outline=points.map((p,i)=>({id:String(i),layerId:'Edge.Cuts',closed:false,points:[p,item(points,(i+1)%points.length)]})).reverse()
    b.outline[2]?.points.reverse()
    const loops=closedContours(b)
    expect(loops).toHaveLength(1)
    expect(item(loops,0)).toContainEqual({x:12,y:15})
    expect(item(loops,0)).toContainEqual({x:8,y:15})
  })
  it('reports an incomplete outline instead of drawing invented geometry',()=>{
    const b=board({x:0,y:0},{x:16.5,y:0})
    b.outline=[{id:'open',layerId:'Edge.Cuts',closed:false,points:[{x:0,y:0},{x:10,y:0}]}]
    expect(()=>closedContours(b)).toThrow('open PCB contour')
  })
})
