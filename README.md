# Leafony Kit Motion

Leafonyの単体リーフ紹介と、キットを重ねてネジで固定する流れを動画にするための、[silkreel](https://github.com/hridaya423/silkreel)のフォークです。

最初の対象は[Cellular LPWA Cat-M1 Kit](https://docs.leafony.com/products/cellular-lpwa-cat-m1/)。6段の積層、AZ61コネクタの共通配置、AX04 Spacer、AZ63 Nut Plate、M2×18mmネジの交互締め付けを表示します。

## Leafony版を使う

Node.js 22以降、ffmpeg、ffprobe、unzipが必要です。AC09設計データを取得できるGitHubアカウントで `gh auth login` を済ませてください。

```sh
npm ci
npm run leafony:prepare
npm run leafony:dev
```

プレビューは http://127.0.0.1:3190/ で開きます。再生・一時停止・場面への移動・分解表示に対応しています。自動再生はしません。

```sh
# 24秒・1920×1080・30fpsのMP4と表紙を出力（無音）
npm run leafony:render -- --out exports/cat-m1-kit.mp4

# 全編を書き出す前に、6場面を画像で確認
npm run leafony:render -- --stills --out exports/cat-m1-kit.mp4
```

## 構成と共通部品

- `packages/leafony/kits/cellular-lpwa-cat-m1.json`：下から上の積層順、付属品、ネジ、表示時間。
- `packages/leafony/sources.json`：公式設計ファイルの取得元、固定リビジョン、Git blobチェックサム。
- `packages/leafony/src/prepare.ts`：KiCadとSTEPから表示データを準備。
- `packages/leafony/src/mechanics.ts`：16.5mm間隔の取付穴を基準とした位置合わせと、積層・交互締め付けの時間制御。
- `packages/leafony/src/scene.ts`：画面とMP4で共有する3D描画。

上からの順番は **AI05 → AZ01C → AP03B → AX04 → AC09 → AV06**。同梱のAX02Bは、この組み立てには含めません。[公式組み立て手順](https://docs.leafony.com/getting-started/cellular-lpwa-cat-m1/)を基準にしています。

積層順と基板形状は出典に基づきます。接点間隔2mm、ねじの回転・移動、Nut Plateの高さは映像用の初期設定です。実機の圧縮量・干渉・締付トルクを検証した組立治具やシミュレータではありません。未提供の部品モデルには推定形状を使い、準備時の `manifest.json` に不足を記録します。現物確認後はキット定義と共通部品の配置を更新してください。

取得したCADと生成シーンはローカルの `.cache/` と `public/generated/` に保存し、Gitには含めません。AC09の非公開設計データは、既存のアクセス権で取得します。認証情報を保存したり、CAD・生成シーンを公開フォークへ同梱したりしません。生成データを含むWebビルドの公開は別途判断してください。

## Leafony Docsで動画を見せる

このリポジトリは映像の生成と確認用です。読者には、既存のLeafony Docsのキットページ内に動画を埋め込んで見せる想定です。MP4と表紙をR2などの動画配信先へ配置し、DocsのMDXから標準の動画プレーヤーで参照できます。元CADや生成シーンを配信する必要はありません。

キットページでは概要の後に「動画で組み立てを見る」を置き、その後に内容物と詳細手順を続けます。自動再生せず、表紙を表示して再生操作を待つ構成です。公開前に実機との整合と映像を確認し、実在する配信URLを設定してください。

R2を本番配信に使う場合は、開発用のr2.devではなく独自ドメインを使います。HTMLはGitHub側、動画と表紙はR2側で別々に更新できます。[R2公式資料](https://developers.cloudflare.com/r2/buckets/public-buckets/)

## 確認

```sh
npm run typecheck
npx eslint packages/leafony
npx vitest run packages/leafony/src/mechanics.test.ts
npm run build --workspace=@leafony/reel
```

動画は全編と5fpsの一覧で確認します。レビュー記録は、上流の方針に従いローカルの `docs/reviews/` に残します。

上流のApache-2.0ライセンスとクレジットは維持します。以下は上流の説明です。

---

<p align="center">
  <img src="packages/site/public/og.png" alt="silk reel: a circuit board in, a film out" width="100%" />
</p>

<p align="center">
  <b>A KiCad board in. A release film out.</b><br />
  silk reel reads a <code>.kicad_pcb</code> and renders a film of that board, built from its real copper, parts and silkscreen.<br />
  <a href="https://silkreel.hridya.tech/studio">Try it in your browser</a> with your own board. You do not need to install anything.
</p>

<p align="center">
  <img alt="License: Apache 2.0" src="https://img.shields.io/badge/license-Apache%202.0-ecede9?style=flat-square&labelColor=0b0b0b" />
  <img alt="Node.js 22 or later" src="https://img.shields.io/badge/node-%E2%89%A522-ecede9?style=flat-square&labelColor=0b0b0b&logo=nodedotjs&logoColor=white" />
  <img alt="TypeScript, strict" src="https://img.shields.io/badge/TypeScript-strict-ecede9?style=flat-square&labelColor=0b0b0b&logo=typescript&logoColor=white" />
  <img alt="Input: .kicad_pcb" src="https://img.shields.io/badge/input-.kicad__pcb-ecede9?style=flat-square&labelColor=0b0b0b&logo=kicad&logoColor=white" />
  <img alt="Output: MP4, GIF, WebM, ProRes" src="https://img.shields.io/badge/output-MP4%20%C2%B7%20GIF%20%C2%B7%20WebM%20%C2%B7%20ProRes-ecede9?style=flat-square&labelColor=0b0b0b" />
  <img alt="Sound: CC0" src="https://img.shields.io/badge/sound-CC0-d7261e?style=flat-square&labelColor=0b0b0b" />
</p>

## Two looks, one board

| Trace | Glyph |
|---|---|
| ![The Glasgow board as a trace film](.github/media/glasgow-trace.gif) | ![The Glasgow board as a glyph film](.github/media/glasgow-glyph.gif) |
| A camera films the lit board. The copper routes extend out from the hero chip. The mask and silkscreen go on, and the parts drop onto paste and reflow. Then the board powers on. The film runs 12 seconds, with sound. | silk reel sets every part of the board as type. The routes of the hero chip extend out, the plan of the board appears, and a frame closes around it. The film is an 11.2-second loop with no visible seam. |

Both films above are the [Glasgow](https://github.com/GlasgowEmbedded/glasgow) rev C3 board, rendered with the commands below.

## Quick start

You need Node.js 22 or later, and `ffmpeg` and `ffprobe` on your PATH.

```bash
git clone https://github.com/hridaya423/silkreel
cd silkreel
npm ci
npm run reel -- fixtures/boards/glasgow.kicad_pcb --style trace --aspect 16:9 -o glasgow.mp4
```

The first render downloads a headless Chrome of about 90 MB. Later renders use the same copy.

## Render your own board

Give the CLI the `.kicad_pcb` file of your board. silk reel reads files from KiCad 4 or later. It does not read Gerber, Eagle or Altium files.

```bash
npm run reel -- path/to/your-board.kicad_pcb --aspect 9:16 --title "Your Board" --version v1.0
```

A trace film takes about 30 seconds to render on an Apple M4 Pro, and the file is near 8 MB. The CLI also writes `<name>.poster.png`, the last frame, for a cover image. A glyph film renders in about ten seconds. `--draft` renders faster at a lower quality.

If your machine has no GPU, put `SILK_REEL_GL=swangle` in front of the command. To list every flag, run `npm run reel -- --help`.

### Part models

A trace film shows each part's own 3D model when it can find the STEP file. It reads the model paths in your board, as KiCad does: `${KIPRJMOD}` and relative paths start at the board's folder, and `${KICADn_3DMODEL_DIR}` uses that variable or the KiCad library install. Where a footprint names a `.wrl`, silk reel looks for the `.step` beside it. Add folders with `--models DIR`; silk reel searches them by the model's library path, then by file name. This suits models exported from Fusion 360 into one folder. A part without a model, or with a model that does not sit on its pads, keeps an estimated body, and the CLI lists both cases.

The film is about one part, the hero. silk reel picks the IC with the most pads, then any other part with eight or more pads, then the connector with the most pads. Name a different part with `--hero U3`.

## Options

| flag | values | default |
|---|---|---|
| `--style` | `trace` (the lit board) · `glyph` (parts set as type) | `trace` |
| `--aspect` | `4:5` 1080×1350 · `1:1` 1080×1080 · `9:16` 1080×1920 · `16:9` 1920×1080 | `4:5` |
| `--palette` | `copper` · `mono` · `blueprint` · `phosphor` | `copper` (trace), `mono` (glyph) |
| `--accent` | `#rrggbb` for the hero highlight | the palette's |
| `--hero` | the reference of the part the film is about, e.g. `U3` | the IC with the most pads |
| `--mask` | `green` · `black` · `white` · `blue` · `red` · `yellow` · `purple` (trace) | the board file's, else `green` |
| `--title` | the board's name on a title card; leave it out for no card | none |
| `--version` | a version under the title; needs `--title` | none |
| `--format` | `mp4` · `gif` (720 px wide at most) · `webm-alpha` · `prores-alpha` (4444) | `mp4` |
| `--seed` | any number; each one gives a different variation | `42` |
| `--tempo` | the speed of the film, from `0.75` to `1.5` | `1` |
| `--draft` | fast preview quality | off |
| `--no-audio` | leave the score out of a trace film | off |
| `--models` | another folder of STEP models; repeat it for more | the board's paths and the KiCad library |
| `--no-models` | estimated part bodies only | off |
| `-o` | output path | `<board>-<style>-<aspect>.<ext>` beside the input |
| `-h`, `--help` | list every flag | |

The alpha formats have a transparent background, so you can put the film over your own footage. The same board and flags always render the same film.

## Studio

The [browser studio](https://silkreel.hridya.tech/studio) plays a draft of both looks, for the sample boards and for your own board. The tab reads your board file and does not upload it. The studio records WebM, saves stills, and writes the CLI command for everything else. Its source is in [`packages/site`](packages/site).

Run the full studio on your machine to render every format from a queue:

```bash
npm run start --workspace=@silk-reel/render-api   # render API on :3102
npm run dev --workspace=@silk-reel/studio         # studio on :3101
```

## How it works

1. **`ingest`** parses the `.kicad_pcb` into a board model: outline, copper on every layer, pads, vias, zones, footprints and silkscreen.
2. **`choreo`** compiles the board into a timeline. A trace film is four camera shots on a 24-beat grid. It starts as a flat drawing of the copper and turns into the built board. Then it pauses, powers on, and holds on the finished board. A glyph film picks the hero chip and sets the parts as glyphs across four acts.
3. **`render`** draws each frame. Trace uses WebGL2: a lit plate with component bodies, a perspective camera, depth of field, HDR bloom and motion blur. Glyph draws with Canvas2D.
4. **`render-api`** encodes the frames with Remotion and ffmpeg. For trace films, it adds the sound, mastered to −14 LUFS.

| package | role |
|---|---|
| [`ingest`](packages/ingest) | `.kicad_pcb` parser to `BoardModel` |
| [`choreo`](packages/choreo) | the style engine: board to `Timeline`, palettes, aspect layout |
| [`render`](packages/render) | frame drawing, the WebGL2 post pass, the Remotion composition |
| [`render-api`](packages/render-api) | Fastify API, render queue, `renderFilm()` for every format |
| [`cli`](packages/cli) | `npm run reel` |
| [`studio`](packages/studio) | the local studio (Vite and the Remotion Player) |
| [`site`](packages/site) | the website and its in-browser studio (Astro) |
| [`metrics`](packages/metrics) | ffmpeg probes and an advisory numeric gate |

## Development

```bash
npx tsc --noEmit         # typecheck
npx vitest run           # tests
npx eslint packages      # lint
npm run test:production  # build the studio and smoke-test it
```

Every change to how a film looks goes through a full-video review. [AGENTS.md](AGENTS.md) has the commands and the rubric.

## Credits

- **Sample boards:** [iCEBreaker](https://github.com/icebreaker-fpga/icebreaker) © 2019 1BitSquared, CC BY-SA 4.0. [Glasgow](https://github.com/GlasgowEmbedded/glasgow) rev C3, Glasgow Embedded, 0BSD. StickHub, the ECC83 preamp, the ColdFire dev kit and the video board are KiCad demo projects.
- **Sound:** CC0 recordings from Freesound, listed in [CREDITS.md](packages/render-api/assets/sound/CREDITS.md).
- **STEP reading:** [occt-import-js](https://github.com/kovacsv/occt-import-js) and Open CASCADE Technology, both LGPL 2.1, used unmodified as an npm dependency.
- **Type:** title cards use JetBrains Mono (SIL Open Font License 1.1, [`OFL.txt`](packages/render/src/assets/OFL.txt)), bundled so renders match on every machine.

## License

silk reel is licensed under the [Apache License 2.0](LICENSE). The sample boards, the sound recordings and the fonts keep their own licenses, listed under Credits.
