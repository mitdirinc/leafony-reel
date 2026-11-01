import React from 'react'
import { AbsoluteFill, cancelRender, getRemotionEnvironment, useCurrentFrame, useVideoConfig } from 'remotion'
import type { Timeline } from '@silk-reel/choreo'
import { drawFrame, buildScene, postOptionsFor } from './film'
import type { Scene } from './film'
import { createPost } from './post'
import type { Post } from './post'
import { createTraceGL } from './trace-gl'
import type { Annotation, TraceGL, TraceQuality } from './trace-gl'
import { drawTitle } from './title'
import { FONT, useFont } from './font'

export type RenderQuality = 'draft' | 'final'

export interface FilmProps {
  timeline: Timeline
  grain?: boolean
  /** final: full motion blur and map resolution; draft: one sample, lighter maps (studio preview, quick renders) */
  quality?: RenderQuality
  children?: React.ReactNode
}

const QUALITY: Record<RenderQuality, TraceQuality> = {
  final: { subframes: 5, mapScale: 1.6 },
  draft: { subframes: 1, mapScale: 1.25 }
}

/** a caption set in the frame's top-left safe corner, shadowed so it reads on a white board or a black one */
export function drawAnnotations(ctx: CanvasRenderingContext2D, anns: Annotation[], W: number, H: number): void {
  const u = Math.min(W, H) / 1080
  let y = H * 0.085
  for (const a of anns) {
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = 18 * u
    ctx.fillStyle = 'rgba(244,244,240,0.97)'
    ctx.strokeStyle = 'rgba(244,244,240,0.9)'
    ctx.textBaseline = 'alphabetic'
    if (a.anchor !== undefined) {
      // a leader out of the part, up and away from the frame's centre, then a rule the name sits on
      const { x, y: ay } = a.anchor
      ctx.font = `600 ${Math.round(40 * u)}px ${FONT}`
      const named = ctx.measureText(a.text).width
      ctx.font = `${Math.round(22 * u)}px ${FONT}`
      const rule = Math.max(named, a.sub === undefined ? 0 : ctx.measureText(a.sub).width) + 16 * u
      const rise = Math.min(0.2 * H, Math.max(0.08 * H, ay - 0.16 * H))
      const fits = (d: number): boolean => x + d * (rise + rule) > W * 0.06 && x + d * (rise + rule) < W * 0.94
      const away = x < W / 2 ? -1 : 1
      const dir = fits(away) ? away : -away
      // the whole label stays inside the safe area, however the part moves
      const ex = Math.min(W * 0.94 - (dir > 0 ? rule : 0), Math.max(W * 0.06 + (dir < 0 ? rule : 0), x + dir * rise))
      const ey = Math.max(H * 0.08 + 40 * u, ay - rise)
      const rx = ex + dir * rule
      const k = a.alpha
      ctx.lineWidth = 1.6 * u
      ctx.globalAlpha = Math.min(1, k * 2)
      ctx.beginPath()
      ctx.arc(x, ay, 7 * u, 0, Math.PI * 2)
      ctx.stroke()
      const d1 = Math.min(1, k * 1.6)
      ctx.beginPath()
      ctx.moveTo(x + (ex - x) * (7 * u / Math.hypot(ex - x, ey - ay)), ay + (ey - ay) * (7 * u / Math.hypot(ex - x, ey - ay)))
      ctx.lineTo(x + (ex - x) * d1, ay + (ey - ay) * d1)
      if (k > 0.62) ctx.lineTo(ex + (rx - ex) * Math.min(1, (k - 0.62) / 0.38), ey)
      ctx.stroke()
      ctx.globalAlpha = Math.max(0, (k - 0.6) / 0.4)
      ctx.textAlign = dir < 0 ? 'right' : 'left'
      const tx = ex + dir * 8 * u
      ctx.font = `600 ${Math.round(40 * u)}px ${FONT}`
      ctx.fillText(a.text, tx, ey - 14 * u)
      if (a.sub !== undefined) {
        ctx.globalAlpha *= 0.78
        ctx.font = `${Math.round(22 * u)}px ${FONT}`
        ctx.fillText(a.sub, tx, ey + 32 * u)
      }
      ctx.restore()
      continue
    }
    ctx.globalAlpha = a.alpha
    ctx.textAlign = 'left'
    ctx.font = `600 ${Math.round(46 * u)}px ${FONT}`
    ctx.fillText(a.text, W * 0.075, y + 46 * u)
    if (a.sub !== undefined) {
      ctx.globalAlpha = a.alpha * 0.78
      ctx.font = `${Math.round(24 * u)}px ${FONT}`
      ctx.fillText(a.sub, W * 0.075, y + 84 * u)
    }
    ctx.restore()
    y += 110 * u
  }
}

export const Film: React.FC<FilmProps> = ({ timeline, grain = true, quality, children }) => {
  useFont()
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const postRef = React.useRef<Post | null>(null)
  const traceRef = React.useRef<TraceGL | null>(null)
  const readyRef = React.useRef(false)

  const scene = React.useMemo<Scene>(() => buildScene(timeline), [timeline])
  const offscreen = React.useMemo(() => {
    const c = document.createElement('canvas')
    c.width = timeline.width
    c.height = timeline.height
    return c
  }, [timeline])
  // the live preview is always draft; renders default to final
  const level: RenderQuality = getRemotionEnvironment().isRendering ? (quality ?? 'final') : 'draft'

  // pick the pipeline once per mounted canvas: the lit trace renderer, else
  // the flat 2d draw through the webgl2 post pass, else plain 2d
  React.useLayoutEffect(() => {
    postRef.current = createPost() ?? null
    if (timeline.style === 'trace') traceRef.current = createTraceGL(timeline.width, timeline.height, QUALITY[level]) ?? null
    if (timeline.style === 'trace' && traceRef.current === null && getRemotionEnvironment().isRendering) {
      cancelRender(new Error('The trace look needs WebGL2, and the headless browser has none. Run again with SILK_REEL_GL=swangle (slower, CPU only), or use --style glyph.'))
    }
    readyRef.current = true
    return () => {
      postRef.current?.dispose()
      postRef.current = null
      traceRef.current?.dispose()
      traceRef.current = null
      readyRef.current = false
    }
  }, [timeline.style, timeline.width, timeline.height, level])

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !readyRef.current) return
    const target = canvas.getContext('2d')
    if (!target) return
    if (timeline.style === 'trace' && traceRef.current !== null) {
      const out = traceRef.current.render(timeline, frame)
      target.clearRect(0, 0, canvas.width, canvas.height)
      target.drawImage(out, 0, 0)
      drawAnnotations(target, traceRef.current.annotations(), canvas.width, canvas.height)
      drawTitle(target, timeline, frame / timeline.totalFrames, 1)
      return
    }
    const ctx = offscreen.getContext('2d')
    if (!ctx) return
    drawFrame(ctx, timeline, scene, frame)
    const out = postRef.current?.render(offscreen, { ...postOptionsFor(timeline, grain), frame }) ?? offscreen
    target.clearRect(0, 0, canvas.width, canvas.height)
    target.drawImage(out, 0, 0)
  }, [frame, timeline, scene, offscreen, grain])

  return React.createElement(
    AbsoluteFill,
    { style: { backgroundColor: timeline.transparent ? 'transparent' : timeline.palette.bg } },
    React.createElement('canvas', {
      ref: canvasRef,
      width,
      height,
      style: { width, height, display: 'block' }
    }),
    children
  )
}

