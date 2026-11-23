import React, { useLayoutEffect, useRef } from 'react'
import { KitScene } from './scene'
import { assemblyState, item } from './mechanics'
import type { KitDefinition, SceneAssets } from './types'

export function caption(kit: KitDefinition, time: number): { title: string; detail: string } {
  const state=assemblyState(kit,time)
  if (state.stage==='parts') return {title:'リーフを重ねて組み立てる',detail:'電源を外し、SIMを先に装着'}
  if (state.stage==='stack') {
    const layer=item(kit.layers,state.activeLayer)
    return {title:layer.name,detail:layer.id==='AX04'?'AP03BとAC09の間に挟む':layer.role}
  }
  if (state.stage==='align') return {title:'バス接点とネジ穴をそろえる',detail:'向きと、部品の接触を確認'}
  if (state.stage==='insert') return {title:'M2×18mmネジで固定する',detail:'最下段のAZ63 Nut Plateへ通す'}
  if (state.stage==='tighten') return {title:'2本を交互に締める',detail:'片寄りがないことを確認'}
  return {title:'組み立て完了',detail:'環境計測とセルラー通信を、このキットで'}
}

export interface StageProps {
  assets: SceneAssets; kit: KitDefinition; time: number; width: number; height: number
  explosion?: number; onReady?: () => void
}
export function Stage({assets,kit,time,width,height,explosion,onReady}: StageProps) {
  const canvas=useRef<HTMLCanvasElement>(null), scene=useRef<KitScene | null>(null)
  const ready=useRef(onReady)
  useLayoutEffect(() => {
    if (!canvas.current) return
    const engine=new KitScene(canvas.current,assets,kit)
    scene.current=engine; engine.resize(width,height); engine.draw(time,explosion)
    ready.current?.()
    return () => { scene.current=null; engine.dispose() }
  },[assets,kit])
  useLayoutEffect(() => { scene.current?.resize(width,height); scene.current?.draw(time,explosion) },[time,width,height,explosion])
  const text=caption(kit,time), scale=width/1920
  return <div style={{position:'relative',width,height,overflow:'hidden',background:'#e8eff2',fontFamily:'"Hiragino Sans", "Noto Sans JP", sans-serif',color:'#193e34'}}>
    <canvas ref={canvas} aria-label="Cat-M1キットの3D組み立て表示" style={{display:'block',width,height}} />
    <div style={{position:'absolute',left:64*scale,top:52*scale,pointerEvents:'none'}}>
      <div style={{fontSize:24*scale,fontWeight:600,marginBottom:12*scale}}>Leafony</div>
      <div style={{fontSize:42*scale,fontWeight:600,letterSpacing:'-.04em'}}>Cellular LPWA Cat-M1 Kit</div>
    </div>
    <div style={{position:'absolute',left:64*scale,bottom:56*scale,pointerEvents:'none',maxWidth:'86%'}}>
      <div style={{fontSize:64*scale,fontWeight:600,marginBottom:14*scale}}>{text.title}</div>
      <div style={{fontSize:56*scale,color:'#4b655f'}}>{text.detail}</div>
    </div>
  </div>
}
