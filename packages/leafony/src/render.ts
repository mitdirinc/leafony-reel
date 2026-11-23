import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { bundle } from '@remotion/bundler'
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer'
import { packageRoot } from './download'
import definition from '../kits/cellular-lpwa-cat-m1.json'

const args=process.argv.slice(2), outputAt=args.indexOf('--out')
if(outputAt>=0&&!args[outputAt+1])throw new Error('--out requires a file path')
const output=path.resolve(outputAt>=0 ? args[outputAt+1] as string : path.join(packageRoot,'../../exports/cat-m1-kit-assembly.mp4'))
await mkdir(path.dirname(output),{recursive:true})
const serveUrl=await bundle({entryPoint:path.join(packageRoot,'src/remotion-entry.tsx'),publicDir:path.join(packageRoot,'public')})
const chromiumOptions={gl:'angle' as const}
const composition=await selectComposition({serveUrl,id:'leafony-assembly',chromiumOptions})
if(args.includes('--stills')) {
  for(const time of [0,5.5,13.5,15.5,18.5,23.5]) {
    await renderStill({composition,serveUrl,output:output.replace(/\.mp4$/i,`-${time}.png`),frame:Math.round(time*30),chromiumOptions})
  }
} else {
  let reported=-1
  await renderMedia({composition,serveUrl,outputLocation:output,codec:'h264',crf:18,pixelFormat:'yuv420p',muted:true,
    chromiumOptions,concurrency:Math.max(1,Math.min(4,Number(process.env['SILK_REEL_CONCURRENCY']??2))),
    onProgress:({progress})=>{const pct=Math.floor(progress*10);if(pct>reported){reported=pct;console.log(`${pct*10}%`)}}})
  await renderStill({composition,serveUrl,output:output.replace(/\.mp4$/i,'.poster.png'),frame:definition.duration*30-1,chromiumOptions})
}
console.log(`Rendered: ${output}`)
