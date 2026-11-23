import React, { useEffect, useRef, useState } from 'react'
import { Stage } from './Stage'
import { assemblyState } from './mechanics'
import type { KitDefinition, SceneAssets } from './types'
import definition from '../kits/cellular-lpwa-cat-m1.json'
import './style.css'

const kit=definition as KitDefinition
const checkpoints=[{time:0,label:'部品を見る'},{time:2.5,label:'重ねる'},{time:14,label:'ネジを通す'},{time:16,label:'交互に締める'},{time:23.5,label:'完成'}]
export function App() {
  const [assets,setAssets]=useState<SceneAssets | null>(null), [error,setError]=useState('')
  const [time,setTime]=useState(0), [playing,setPlaying]=useState(false), [exploded,setExploded]=useState(false)
  const [size,setSize]=useState({width:960,height:540}), container=useRef<HTMLDivElement>(null)
  useEffect(() => {
    const controller=new AbortController()
    fetch('/generated/scene.json',{signal:controller.signal}).then(r => {
      if (!r.ok) throw new Error('準備した部品データが見つかりません。最初に npm run leafony:prepare を実行してください。')
      return r.json()
    }).then(setAssets).catch((e:unknown) => {if (e instanceof Error && e.name!=='AbortError') setError(e.message)})
    return () => { controller.abort() }
  },[])
  useEffect(() => {
    const observer=new ResizeObserver(entries => {
      const entry=entries[0];if(!entry)return
      const w=Math.floor(entry.contentRect.width); setSize({width:w,height:Math.round(w*9/16)})
    })
    if (container.current) observer.observe(container.current)
    return () => { observer.disconnect() }
  },[])
  useEffect(() => {
    if (!playing) return
    let animation=0, last=performance.now()
    const tick=(now: number) => {
      const dt=Math.min(.1,(now-last)/1000)
      if (dt>=1/30) {
        last=now; setTime(t => {const next=Math.min(kit.duration,t+dt); if(next>=kit.duration) setPlaying(false); return next})
      }
      animation=requestAnimationFrame(tick)
    }
    animation=requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(animation) }
  },[playing])
  const seek=(value: number) => {setPlaying(false); setExploded(false); setTime(value)}
  const state=assemblyState(kit,time)
  return <main>
    <header><a className="brand" href={kit.source} target="_blank" rel="noreferrer">Leafony</a><span>キットの組み立て</span></header>
    <div className="heading"><h1>Cat-M1 Kit</h1><p>リーフの順番と、固定するまでの流れを確かめる。</p></div>
    <div className="workspace">
      <section className="viewer" aria-label="組み立てプレビュー">
        <div className="viewport" ref={container}>
          {assets ? <Stage assets={assets} kit={kit} time={time} {...size} {...(exploded?{explosion:1}:{})} />
            : <div className="loading">{error || '部品を読み込んでいます…'}</div>}
        </div>
        <div className="transport">
          <button className="play" disabled={!assets} onClick={() => {setExploded(false);if(time>=kit.duration)setTime(0);setPlaying(!playing)}}>{playing?'一時停止':'再生する'}</button>
          <input type="range" min="0" max={kit.duration} step="0.033333" aria-label="再生位置" value={time} onChange={e=>{seek(Number(e.target.value))}}/>
          <output aria-label="再生時間">{time.toFixed(1)} / {kit.duration}秒</output>
          <button aria-pressed={exploded} onClick={()=>{setPlaying(false);setExploded(!exploded)}}>{exploded?'再生位置に戻す':'分解して見る'}</button>
        </div>
        <nav className="steps" aria-label="組み立ての場面">{checkpoints.map(c=><button key={c.time} onClick={()=>{seek(c.time)}}>{c.label}</button>)}</nav>
      </section>
      <aside>
        <h2>積み重ねるリーフ</h2><p className="direction">上から下の順番</p>
        <ol reversed className="leaves">{[...kit.layers].reverse().map((layer,i)=>{
          const index=kit.layers.length-1-i
          return <li key={layer.id} className={state.stage==='stack'&&state.activeLayer===index?'active':''}>
            <span className="layer-number">{i+1}</span><div><strong>{layer.name}</strong><small>{layer.role}</small></div>
          </li>
        })}</ol>
        <p className="separate">AX02B 29-pinは同梱品です。この組み立てでは積み重ねません。</p>
        <a className="guide" href={kit.assemblySource} target="_blank" rel="noreferrer">公式の組み立て手順を読む</a>
      </aside>
    </div>
    <footer><p>組立イメージ。積層順は公式ガイドに準拠しています。リーフ間隔と締め付け動作は実機確認前の仮設定です。</p></footer>
  </main>
}
