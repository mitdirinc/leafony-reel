import React, { useEffect, useRef, useState } from 'react'
import { Composition, registerRoot, useCurrentFrame, useVideoConfig, delayRender, continueRender, cancelRender, staticFile } from 'remotion'
import { Stage } from './Stage'
import type { KitDefinition, SceneAssets } from './types'
import definition from '../kits/cellular-lpwa-cat-m1.json'

const kit=definition as KitDefinition
const AssemblyFilm: React.FC = () => {
  const [assets,setAssets]=useState<SceneAssets | null>(null), [handle]=useState(()=>delayRender('Loading Leafony scene'))
  const released=useRef(false), frame=useCurrentFrame(), {fps,width,height}=useVideoConfig()
  useEffect(()=>{
    fetch(staticFile('generated/scene.json')).then(r=>{if(!r.ok)throw new Error('Run npm run leafony:prepare first');return r.json()})
      .then(setAssets).catch(cancelRender)
  },[])
  if(!assets)return null
  return <Stage assets={assets} kit={kit} time={frame/fps} width={width} height={height} onReady={()=>{
    if(!released.current){released.current=true;continueRender(handle)}
  }}/>
}
const Root=()=><Composition id="leafony-assembly" component={AssemblyFilm} durationInFrames={kit.duration*30} fps={30} width={1920} height={1080}/>
registerRoot(Root)
