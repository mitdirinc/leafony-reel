import * as T from 'three'
import type { Footprint, Vec2 } from '@silk-reel/ingest'
import { assemblyState, closedContours, item, smooth, toBus } from './mechanics'
import type { KitDefinition, LeafAsset, MeshData, SceneAssets } from './types'

const metal = (color = '#aeb6b3') => new T.MeshStandardMaterial({ color, metalness: 0.72, roughness: 0.32 })
const plastic = (color: string) => new T.MeshStandardMaterial({ color, roughness: 0.62 })

function cadMesh(data: MeshData): T.Mesh {
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(data.positions, 3))
  geometry.setAttribute('normal', new T.Float32BufferAttribute(data.normals, 3))
  const colors = data.colors.map(c => c<=0.04045 ? c/12.92 : Math.pow((c+.055)/1.055,2.4))
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  geometry.setIndex(data.indices)
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.57, metalness: 0.12 }))
  mesh.castShadow = true; mesh.receiveShadow = true
  return mesh
}

function unpack(value: string, kind: 'float' | 'normal' | 'color' | 'index'): number[] {
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0))
  if (kind === 'float') return Array.from(new Float32Array(bytes.buffer))
  if (kind === 'index') return Array.from(new Uint32Array(bytes.buffer))
  if (kind === 'normal') return Array.from(new Int8Array(bytes.buffer), v => v / 127)
  return Array.from(bytes, v => v / 255)
}

function shapeOf(leaf: LeafAsset): T.Shape {
  const paths = closedContours(leaf.board)
  const area = (points: Vec2[]) => Math.abs(points.reduce((s, p, i) => {
    const q = item(points,(i + 1) % points.length)
    return s + p.x * q.y - q.x * p.y
  }, 0))
  paths.sort((a, b) => area(b) - area(a))
  if (!paths[0]) throw new Error(`${leaf.id}: no closed PCB outline`)
  const vertices = paths[0].map(p => toBus(p, leaf.frame))
  const shape = new T.Shape(vertices.map(p => new T.Vector2(p.x, -p.y)))
  // Small vias stay in the texture; actual mounting and breakout holes are geometry.
  for (const drill of leaf.board.drill.filter(d => d.dia >= 0.4)) {
    const p = toBus(drill.pos, leaf.frame), hole = new T.Path()
    hole.absarc(p.x, -p.y, drill.dia / 2, 0, Math.PI * 2, true)
    shape.holes.push(hole)
  }
  return shape
}

function surfaceTexture(leaf: LeafAsset, side: 'F' | 'B', bounds: T.Box2): T.CanvasTexture {
  const canvas = document.createElement('canvas'), scale = 60
  const size = bounds.getSize(new T.Vector2())
  canvas.width = Math.ceil(size.x * scale); canvas.height = Math.ceil(size.y * scale)
  const c = canvas.getContext('2d')
  if (!c) throw new Error('Canvas2D is not available')
  c.scale(scale, scale); c.translate(-bounds.min.x, -bounds.min.y)
  c.fillStyle = '#184c36'; c.fillRect(bounds.min.x, bounds.min.y, size.x, size.y)
  const point = (p: Vec2) => toBus(p, leaf.frame)
  const line = (points: Vec2[], width: number, color: string) => {
    if (points.length < 2) return
    c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'
    c.beginPath(); points.forEach((p, i) => { const q = point(p); if (i === 0) c.moveTo(q.x, q.y); else c.lineTo(q.x, q.y) }); c.stroke()
  }
  const copper = leaf.board.copper[`${side}.Cu`]
  if (copper) {
    for (const zone of copper.zones) for (const polygon of zone.fills) {
      c.fillStyle = '#1c533b'; c.beginPath()
      polygon.forEach((p, i) => { const q = point(p); if (i === 0) c.moveTo(q.x, q.y); else c.lineTo(q.x, q.y) }); c.closePath(); c.fill()
    }
    for (const trace of copper.traces) line(trace.points, trace.width, '#286146')
    for (const via of copper.vias) {
      const p = point(via.pos); c.fillStyle = '#315c3f'; c.beginPath(); c.arc(p.x, p.y, via.dia / 2, 0, Math.PI * 2); c.fill()
    }
    for (const pad of copper.pads) {
      const p = point(pad.pos); c.save(); c.translate(p.x, p.y); c.rotate(-pad.rot * Math.PI / 180)
      c.fillStyle = '#c9ad65'; c.beginPath()
      if (pad.shape === 'circle') c.ellipse(0, 0, pad.size.x / 2, pad.size.y / 2, 0, 0, Math.PI * 2)
      else c.roundRect(-pad.size.x / 2, -pad.size.y / 2, pad.size.x, pad.size.y,
        pad.shape === 'oval' ? Math.min(pad.size.x, pad.size.y) / 2 : Math.min(pad.size.x, pad.size.y) * 0.16)
      c.fill(); c.restore()
    }
  }
  const silk = leaf.board.silkscreen[`${side}.SilkS`]
  if (silk) {
    for (const stroke of silk.lines) line(stroke.points, stroke.width, '#e6e9d6')
    c.fillStyle = '#e6e9d6'; c.textAlign = 'center'; c.textBaseline = 'middle'
    for (const text of silk.texts) {
      const p = point(text.pos)
      c.save(); c.translate(p.x, p.y); c.rotate(-text.rot * Math.PI / 180)
      if (text.mirrored) c.scale(-1, 1)
      c.font = `${text.height}mm monospace`.replace('mm', 'px')
      c.fillText(text.value, 0, 0); c.restore()
    }
  }
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8
  return texture
}

function pcb(leaf: LeafAsset): T.Group {
  const group = new T.Group(), shape = shapeOf(leaf)
  const body = new T.ExtrudeGeometry(shape, { depth: leaf.board.stackup.thickness, bevelEnabled: false, curveSegments: 16 })
  const solid = new T.Mesh(body, plastic('#69633a'))
  solid.rotation.x = -Math.PI / 2; solid.position.y = -leaf.board.stackup.thickness
  solid.castShadow = true; solid.receiveShadow = true; group.add(solid)
  const points = shape.getPoints(), bounds = new T.Box2().setFromPoints(points.map(p => new T.Vector2(p.x, -p.y)))
  for (const side of ['F', 'B'] as const) {
    const geometry = new T.ShapeGeometry(shape, 16), position = geometry.getAttribute('position')
    const uv = [] as number[]
    for (let i = 0; i < position.count; i++) uv.push(
      (position.getX(i) - bounds.min.x) / (bounds.max.x - bounds.min.x),
      1 - (-position.getY(i) - bounds.min.y) / (bounds.max.y - bounds.min.y))
    geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
    const face = new T.Mesh(geometry, new T.MeshStandardMaterial({ map:surfaceTexture(leaf, side, bounds),
      roughness:0.52, metalness:0.12, side:T.DoubleSide }))
    face.rotation.x = -Math.PI / 2
    face.position.y = side === 'F' ? 0.01 : -leaf.board.stackup.thickness - 0.01
    face.receiveShadow = true; group.add(face)
  }
  return group
}

function footprintPoint(fp: Footprint, x: number, y: number): Vec2 {
  const a = fp.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a)
  return { x:fp.pos.x + c * x + s * y, y:fp.pos.y - s * x + c * y }
}

function component(leaf: LeafAsset, fp: Footprint): T.Object3D | undefined {
  if (fp.ref === 'CN1' || /^(TP|LOGO|G\*|JP)/.test(fp.ref)) return undefined
  const back = fp.layer.startsWith('B.'), id = leaf.byRef[fp.ref], mesh = id === undefined ? undefined : leaf.meshes[id]
  if (mesh) {
    const pos = unpack(mesh.pos, 'float'), nor = unpack(mesh.nor, 'normal')
    const positions = [] as number[], normals = [] as number[]
    const a = fp.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a)
    for (let i = 0; i < pos.length; i += 3) {
      const p = toBus(footprintPoint(fp, item(pos,i), item(pos,i+1)), leaf.frame)
      positions.push(p.x, back ? -leaf.board.stackup.thickness - item(pos,i+2) : item(pos,i+2), p.y)
      const nx = c * item(nor,i) + s * item(nor,i+1), ny = -s * item(nor,i) + c * item(nor,i+1)
      normals.push(nx * leaf.frame.u.x + ny * leaf.frame.u.y,
        (back ? -1 : 1) * item(nor,i+2), nx * leaf.frame.v.x + ny * leaf.frame.v.y)
    }
    return cadMesh({ positions, normals, colors:unpack(mesh.col, 'color'), indices:unpack(mesh.idx, 'index') })
  }
  const pads = Object.values(leaf.board.copper).flatMap(c => c.pads).filter(p => p.footprintRef === fp.ref)
  if (!pads.length) return undefined
  const points = pads.map(p => toBus(p.pos, leaf.frame)), minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x))
  const minZ = Math.min(...points.map(p => p.y)), maxZ = Math.max(...points.map(p => p.y))
  const passive = /^[CRDL]/.test(fp.ref)
  const w = Math.max(0.5, maxX - minX + (passive ? 0.1 : 0.3)), d = Math.max(0.4, maxZ - minZ + (passive ? 0.1 : 0.3))
  const h = passive ? 0.45 : fp.ref.startsWith('SW') ? 1.4 : 0.9
  const p = toBus(fp.pos, leaf.frame)
  const color = fp.ref.startsWith('C') ? '#9d875d' : /BME280/.test(fp.value ?? '') ? '#a6aba9' : '#292d2d'
  const body = new T.Mesh(new T.BoxGeometry(w, h, d), /BME280/.test(fp.value ?? '') ? metal(color) : plastic(color))
  body.position.set((minX + maxX) / 2 || p.x, back ? -leaf.board.stackup.thickness - h / 2 : h / 2, (minZ + maxZ) / 2 || p.y)
  body.castShadow = true; body.receiveShadow = true
  // An unprovided USB model gets a recognizable open shell, never an opaque block.
  if (fp.value?.includes('CX90M')) {
    const shell = new T.Group(), material = metal('#c1c8c8')
    for (const [x,y,z,sx,sy,sz] of [[0,1.3,0,8.8,.25,6.5],[0,.15,0,8.8,.25,6.5],[-4.3,.7,0,.2,1.1,6.5],[4.3,.7,0,.2,1.1,6.5]] as const) {
      const part = new T.Mesh(new T.BoxGeometry(sx,sy,sz),material); part.position.set(x,y,z); part.castShadow = true; shell.add(part)
    }
    const tongue = new T.Mesh(new T.BoxGeometry(6.2,.45,4),plastic('#252c2b')); tongue.position.set(0,.65,.2); shell.add(tongue)
    shell.position.set(p.x,0,p.y); return shell
  }
  return body
}

function screw(length: number): T.Group {
  const group = new T.Group(), material = metal('#b5bec1')
  const shaft = new T.Mesh(new T.CylinderGeometry(.91,.91,length,24),material)
  shaft.position.y = -length / 2; shaft.castShadow = true; group.add(shaft)
  const head = new T.Mesh(new T.CylinderGeometry(1.6,1.8,1.1,32),material)
  head.position.y = .55; head.castShadow = true; group.add(head)
  const points = Array.from({length:451},(_,i) => {
    const q = i / 450, angle = q * (length / .4) * Math.PI * 2
    return new T.Vector3(Math.cos(angle)*.96,-q*length,Math.sin(angle)*.96)
  })
  const thread = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),450,.075,5,false),material); group.add(thread)
  for (const rotation of [0,Math.PI / 2]) {
    const slot = new T.Mesh(new T.BoxGeometry(2.1,.04,.31),plastic('#394243'))
    slot.position.y = 1.12; slot.rotation.y = rotation; group.add(slot)
  }
  return group
}

export class KitScene {
  private renderer: T.WebGLRenderer
  private scene = new T.Scene()
  private camera = new T.OrthographicCamera(-1,1,1,-1,.1,1000)
  private layers: T.Group[] = []
  private bolts: T.Group[] = []
  private nut = new T.Group()
  private width = 1
  private height = 1
  constructor(canvas: HTMLCanvasElement, assets: SceneAssets, private kit: KitDefinition) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias:true, alpha:false, preserveDrawingBuffer:true })
    this.renderer.setPixelRatio(1)
    this.renderer.outputColorSpace = T.SRGBColorSpace
    this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.15
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFShadowMap
    this.scene.background = new T.Color('#e8eff2')
    this.scene.add(new T.HemisphereLight('#ffffff','#a2b1ad',2.2))
    const key = new T.DirectionalLight('#fff9eb',3.2); key.position.set(-30,85,55); key.castShadow = true
    key.shadow.mapSize.set(2048,2048); key.shadow.camera.left=-80; key.shadow.camera.right=80
    key.shadow.camera.top=100; key.shadow.camera.bottom=-60; key.shadow.camera.far=250
    key.shadow.normalBias=.04; key.shadow.bias=-.00015; this.scene.add(key)
    const fill = new T.DirectionalLight('#d4e5ff',1.3); fill.position.set(45,25,-35); this.scene.add(fill)
    const floor = new T.Mesh(new T.PlaneGeometry(1000,1000), new T.MeshStandardMaterial({color:'#e8eff2',roughness:1}))
    floor.rotation.x=-Math.PI/2; floor.position.y=-7; floor.receiveShadow=true; this.scene.add(floor)
    this.layers = kit.layers.map(layer => {
      const group = new T.Group()
      if (layer.id === 'AX04') assets.spacer.forEach(mesh => group.add(cadMesh(mesh)))
      else {
        const leaf = assets.leaves[layer.id]
        if (!leaf) throw new Error(`${layer.id}: run npm run leafony:prepare first`)
        group.add(pcb(leaf))
        for (const fp of leaf.board.footprints) { const object = component(leaf,fp); if (object) group.add(object) }
        assets.connector.forEach(mesh => group.add(cadMesh(mesh)))
      }
      this.scene.add(group); return group
    })
    assets.nutPlate.forEach(mesh => this.nut.add(cadMesh(mesh)))
    this.nut.position.y=-2.12; this.scene.add(this.nut)
    this.bolts = [-8.25,8.25].map(x => { const group=screw(kit.fastener.length); group.position.x=x; this.scene.add(group); return group })
  }
  resize(width: number, height: number): void {
    this.width=Math.max(1,Math.round(width)); this.height=Math.max(1,Math.round(height))
    this.renderer.setSize(this.width,this.height,false)
  }
  draw(time: number, explosion?: number): void {
    const state = assemblyState(this.kit,time,explosion)
    this.layers.forEach((layer,i) => { layer.position.y=item(state.layers,i).y })
    this.bolts.forEach((bolt,i) => {
      const pose=item(state.screws,i); bolt.position.y=pose.y; bolt.rotation.y=pose.angle; bolt.visible=pose.visible
    })
    const bounds = new T.Box3()
    this.layers.forEach(layer => bounds.expandByObject(layer)); bounds.expandByObject(this.nut)
    this.bolts.filter(b => b.visible).forEach(b => bounds.expandByObject(b))
    const center=bounds.getCenter(new T.Vector3()), angle=.62 + .18*smooth((time-20)/3)
    this.camera.position.copy(center).add(new T.Vector3(Math.sin(angle)*180,100,Math.cos(angle)*180))
    this.camera.lookAt(center); this.camera.updateMatrixWorld()
    const projected = new T.Box3()
    for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z])
      projected.expandByPoint(new T.Vector3(x,y,z).applyMatrix4(this.camera.matrixWorldInverse))
    const aspect=this.width/this.height
    const halfHeight=Math.max((projected.max.y-projected.min.y)/2,(projected.max.x-projected.min.x)/2/aspect)*1.34
    this.camera.top=halfHeight; this.camera.bottom=-halfHeight
    this.camera.left=-halfHeight*aspect*1.12; this.camera.right=halfHeight*aspect*.88
    this.camera.updateProjectionMatrix(); this.renderer.render(this.scene,this.camera)
  }
  dispose(): void {
    this.scene.traverse(object => {
      if (!(object instanceof T.Mesh)) return
      const mesh=object as T.Mesh
      mesh.geometry.dispose()
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (m instanceof T.MeshStandardMaterial) m.map?.dispose()
        m.dispose()
      }
    })
    this.renderer.dispose()
  }
}
