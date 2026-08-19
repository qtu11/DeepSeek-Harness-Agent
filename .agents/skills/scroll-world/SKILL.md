---
name: scroll-world
description: >
  Build an immersive scroll-scrubbed "fly through the world" landing page for any
  industry or brand using MuAPI (muapi.ai). As the visitor scrolls, a pre-rendered camera
  flies from outside each scene into its interior, then flows on to the next scene
  with NO cuts — one continuous connected flight (Emons-style isometric diorama world,
  or any art direction you pick). The skill interviews the user for the topic, the
  story beats/sections, and brand kit, then generates cohesive scenes + seamless camera
  clips with MuAPI and wires a portable, framework-agnostic scroll-scrub engine.
  Use when the user wants a "3D world" / "browse-through-the-industry" hero, a scroll
  cinematic, a diorama landing, or to turn a business into a scrollable world.
allowed-tools: Bash, Read, Write, Edit, AskUserQuestion, Skill
---

# scroll-world

Produces a landing page where **scroll drives a camera**: it dives from outside a scene
into its interior, then flies out and into the next scene, continuously, with no visible
cuts. The visuals are AI-generated (MuAPI); the page just scrubs pre-rendered video
by scroll position. This is the same technique behind Apple's scroll-through product
pages — the camera genuinely moves, scroll only drives time.

**What you generate:** N scene stills → N "dive-in" camera clips → N-1 "connector" clips
that join consecutive scenes seamlessly → a portable scrub engine that plays the whole
chain as one flight.

**The one rule that makes or breaks it:** seams must be *frame-identical*. Read
[The seamless chain](#step-5--the-seamless-chain-the-critical-part) before generating any
connector. Getting this wrong is the single most common failure and produces a visible
"pop" between scenes.

Do not assume a frontend framework. The scrub engine in `references/scrub-engine.js` is
self-contained vanilla JS (it builds its own DOM + injects its own CSS into a container
you give it), so it drops into plain HTML, Next.js, Vue, a Python-served page, anything.
The value of this skill is the MuAPI pipeline, the prompts, and the seam method —
not the framework.

---

## Step 0 — Bootstrap

1. **MuAPI MCP + CLI.** The MuAPI MCP server is the `muapi` CLI binary running in stdio
   mode, so one install gives you both. If the `muapi_*` MCP tools aren't available and
   `muapi` is not on `$PATH`: `npm install -g muapi-cli` (or `pip install muapi-cli`),
   then register the MCP server:
   `claude mcp add muapi -e MUAPI_API_KEY=<key> -- muapi mcp serve`
   (use **stdio**, not the hosted HTTP URL — MuAPI's own docs note Claude Code's HTTP
   transport doesn't inject the tools). The key comes from the muapi.ai dashboard
   (Access Keys); for the CLI alone, `muapi auth configure --api-key <key>` or the
   `MUAPI_API_KEY` env var. Verify with `muapi auth whoami`. Confirm there are enough
   credits (`muapi_account_balance` MCP tool, or `muapi account balance`): a full run is
   roughly `N` image gens + `(2N-1)` video gens.
2. **ffmpeg / ffprobe** on `$PATH` (frame extraction + encoding).
3. **An image tool** for background knockout if you want floating scenes: PIL
   (`python3 -c "import PIL"`), or `cwebp`/`sips`. Optional — see Step 3.
4. Caveats: macOS ships **bash 3.2** (no `declare -A`); don't use associative arrays in
   scripts. MuAPI video generations take **minutes each** — always run them detached
   (background) and poll, never a foreground blocking call. Every media input is a
   **hosted URL, never a local file path** — upload stills/frames first
   (`muapi upload file <path>` / MCP `muapi_upload_file`) and pass the returned URL.
   Endpoints differ in accepted params (e.g. Kling v3 has no `resolution`) and in whether
   they support start/end-frame conditioning at all — before batching, confirm the chosen
   endpoint's live schema with `muapi run <endpoint> -h` and see the Step 4 model table.
   The MCP tools cover single generations, uploads, polling, and balance; the batch
   pipeline shells out to the same binary (`muapi run`), which is also the only interface
   that exposes the first+last-frame endpoints connectors need.

---

## Step 1 — Interview the user

The **subject is the user's to state — ask it as an open question in plain prose**, never a
fabricated multiple-choice. A made-up list of industries biases them and reads as you
deciding their business for them; let them answer in their own words (their real business,
a client's, or any idea). Reserve structured multiple-choice (`AskUserQuestion` in Claude
Code; a plain either/or question elsewhere) for the genuinely
enumerable, lower-stakes choices below — art direction and brand-kit approach — and even
there, signal they can go their own way ("Other"). Ask only what you can't sensibly
default. Cover:

1. **Subject** (ask openly, not multiple-choice) — "What should this world be about? Your
   business, a client's, or any idea — a word or a sentence is fine." Capture the
   industry/product + a one-line pitch (e.g. "a bubble tea company, from leaf to last
   sip"), and a brand name if they have one; otherwise you'll propose one below.
2. **Brand kit** — offer three paths, pick one:
   - Import from a URL: fetch the user's site yourself (WebFetch / curl) and extract the
     display name, 4–6 palette hexes from its CSS/design, and a tone read.
   - The user hands you palette + name + tone directly.
   - You propose a palette + name and let them approve.
   Capture **4–6 named hex values**, a display name, and a tone word or two.
3. **Art direction** — default is "soft matte low-poly **clay diorama**, isometric,
   tilt-shift miniature, warm light." Offer alternatives (flat papercraft, glossy toy,
   claymation, neon night). Whatever is chosen becomes the shared **style preamble**
   reused verbatim in every scene prompt (this is what makes the world cohesive).
4. **The journey (sections)** — the ordered scenes the camera flies through. Propose a
   set derived from the subject's own value chain and let the user edit. 5–7 works well.
   Boba example: farms → pearl kitchen → flagship shop → delivery → community plaza →
   the hero product. Each section needs: a short subject description (what's IN the
   diorama), an eyebrow, a headline, one line of body, and 0–3 tag pills. The last
   section is usually the hero product + the CTA.
5. **Mobile version (beta) — ALWAYS ask this; never silently generate both.** Ask as a
   two-option choice (`AskUserQuestion` in Claude Code; a plain question elsewhere):
   *"Want a mobile-optimized version too? Mobile support is in
   **beta** — the scroll-scrub mechanic is desktop-native; on phones you get lighter
   encodes and engine hardening, but portrait crops the 16:9 frame and low-end devices
   may still stutter."* Options: "Desktop only" / "Desktop + mobile (beta)". The beta
   disclaimer must be stated to the user, not just implied. What the answer gates:
   - **Yes** → produce the `-m.mp4` mobile encodes (Step 6) and wire
     `clipMobile`/`connectorsMobile` (Step 7); run the full mobile QA (Step 8). If any
     scene's focal subject sits off-centre, offer the 9:16 hero-variant escape hatch
     (extra MuAPI credits — say so).
   - **No** → skip the mobile encodes and wiring entirely. The engine's phone hardening
     (seek-coalescing, iOS priming, safe-area CSS) is always on regardless — that's not
     a "mobile version," it's just the page not breaking when a phone visits — so a
     desktop-only build still degrades gracefully.

Video model is **not** an interview question — default **Seedance 2**
(`seedance-2-image-to-video` + `seedance-2-first-last-frame`) silently. If the user
names a preference, honor it **only if it can frame-lock seams** (Step 4 roster:
Seedance 2, `kling-v3.0-standard/pro-image-to-video`, `seedance-lite-i2v`). This skill
only ships seamless output, so a model that can't frame-lock is declined with a one-line
why, not substituted in — use a roster model instead.

Keep the scroll mechanic fixed (continuous fly-through) — that's the point of the skill.
See `references/prompts.md` for the intake checklist and copy structure.

---

## Step 2 — Generate the scene stills

One image per section, **all sharing the same style preamble** for cohesion. Default
endpoint **`gpt-image-2-text-to-image`** (crisp, great at isometric illustration; returns
a solid/white background which is perfect for floating diorama "islands"). Use
**`nano-banana-pro`** only if the brief is character/cartoon-heavy. Aspect note: MuAPI's
gpt-image-2 has no 3:2 — use **4:3** (its closest); nano-banana-pro does support 3:2.

Prompt shape (full templates in `references/prompts.md`):

```
<STYLE PREAMBLE, identical every time>. On a plain solid <bg> background with a soft
contact shadow. <PALETTE hexes>. No text, no letters, no logos, centered, 4:3.
Subject: <what is in THIS diorama>.
```

- Run all N concurrently, detached. Command per scene:
  `muapi run gpt-image-2-text-to-image --prompt "$(cat scene_i.txt)" -i aspect_ratio=4:3 -i resolution=2K -i quality=high --wait --output-json > scene_i.json 2>scene_i.err`
- Result URL is `.outputs[0]` in the `--wait --output-json` output. `curl` it down.
- (MCP path for one-offs/re-rolls: `muapi_image_generate` with
  `model: "gpt-image-2-text-to-image"` returns a `request_id`; poll `muapi_predict_result`.
  Batches belong in the detached script.)
- A generation may fail transiently (5xx / 429 rate limit) — re-roll that one
  individually; don't restart the batch.
- **Review the stills before continuing.** They must read as one cohesive world (same
  angle, palette, light). If one is off-style, regenerate it — to lock style, switch that
  re-roll to `gpt-image-2-image-to-image` with an approved scene's hosted URL as the
  reference image.

See `references/pipeline.md` for the exact batch script.

---

## Step 3 — (Optional) Float the scenes

If you want the dioramas to float over an atmospheric background instead of sitting in a
solid box, knock out the flat background to transparency with
`references/knockout.py` (border-connected flood fill — preserves interior colour that
matches the bg, e.g. cream walls). Then encode to webp. If you'd rather keep it simple,
just make the page background the same colour as the scene background and skip this.

These stills double as **video posters and lazy-load fallbacks**, so keep them.

---

## Step 4 — Camera architecture (pick one — this makes or breaks the feel)

How the camera moves *between* scenes is the single biggest quality lever. Two shapes;
pick by aesthetic.

### Video model — pick ONE for the whole chain

**This skill only ships seamless output**, so the only usable models are ones that can
frame-lock a seam: every chained clip must accept a **start frame**, and connectors also
need an **end/last frame**. That capability — not preference — is the selection rule.
Check any endpoint's live schema with `muapi run <endpoint> -h` and **skip anything whose
image inputs are reference-only** (no start/end frame): it can only *condition* a
generation, not *continue* a shot, so it physically can't hold a seam. Schemas below were
confirmed against MuAPI's OpenAPI spec:

| Chain | start/end frame | Notes |
|---|---|---|
| **Seedance 2** (default): `seedance-2-image-to-video` + `seedance-2-first-last-frame` | ✓ / ✓ | Legs/dives on the i2v endpoint (`images_list=[start]`, `aspect_ratio=16:9`); connectors on the first-last endpoint (`images_list=[start,end]`, `aspect_ratio=adaptive` so it matches the input frames). Duration 4–15s. No resolution param — encode what ffprobe reports; the `seedance-2-vip-image-to-video-1080p` / `seedance-2-vip-first-last-frame-1080p` variants pin 1080p (same request shape). No audio param. `-fast` siblings are the cheap tier. Its NSFW filter is the touchy one (see Gotchas). |
| `kling-v3.0-standard-image-to-video` (or `-pro-`) | ✓ / ✓ | One endpoint does both: `image_url` + optional `last_image` (omit `last_image` for legs, pass it for connectors). Duration 3–15, default 5, try 10 for legs. **`generate_audio` defaults ON → always pass `generate_audio=false`.** No aspect-ratio or resolution params — it follows the input frame; encode what ffprobe reports, never upscale. Different content filter than Seedance — the sanctioned NSFW fallback. |
| `seedance-lite-i2v` | ✓ / ✓ | Cheap draft tier that keeps frame-locking: `image_url` + optional `last_image`, `resolution` 480p/720p/1080p. The previz tier: run the whole chain here first, then re-render final legs on the full model — still seamless, so it translates directly. |

Those three are the roster — all do both architectures. (`seedance-2-mini-image-to-video`
also frame-locks via a start image, but has **no last-frame input** — its extra
`images_list` entries are style references, not endpoint frames — so it's
architecture-A-only and can't make connectors. It's not in the default roster; it's only
worth reaching for as an even cheaper architecture-A previz, and `seedance-lite-i2v`
usually wins anyway because it keeps the full frame-lock.)

One MuAPI-specific wrinkle: the MCP tool `muapi_video_from_image` covers legs/dives (its
`model` param accepts the roster i2v endpoints) but exposes **no end-frame parameter**, so
**connectors always go through `muapi run`** (same binary, same key) or the raw REST
endpoint — never through the MCP video tool.

Rules:
- **One model family for all chained clips.** Each renderer has its own motion/color/grain
  character; mixing models mid-chain keeps *position* continuity (frames still hand off)
  but the render-character shift reads as a subtle pop. (Seedance 2's i2v + first-last
  endpoints are the same renderer — that pairing is one family, not a mix.) The one
  sanctioned exception is the NSFW fallback for a single stubborn clip (Gotchas) — a
  slight character shift on one 5s connector beats a missing connector.
- Default to Seedance 2; honor a user's stated preference **only if the model
  qualifies** (frame-locking). If it doesn't, say so and use a supported model — never
  ship a non-seamless build to satisfy a model request.
- The pipeline scripts take the chain as `$VMODEL` with per-endpoint inputs already cased
  out (`references/pipeline.md`).

### A) Continuous forward take — RECOMMENDED for grounded / realistic / walkthrough
One camera that only ever glides **forward**, first scene through last, as a single take.
Generate the legs **sequentially**: leg 0 from scene-0's still (glide forward into it);
then each leg's start frame = the **previous leg's ACTUAL last frame** (extract with
ffmpeg, upload, pass the hosted URL), prompt *"continue gliding smoothly FORWARD into
[scene i], never pulling back"* (or an expressive mid-leg move under the motion-handoff
contract — see **Camera grammar** below), and **no end/last frame** — an end frame of a
wide establishing shot forces the camera to pull back, which is the #1 cause of stutter.
Extract each leg's last frame to feed the
next. Result: every seam is frame-identical **and** the camera never reverses. There are
**no connectors** (skip Step 5) — the legs ARE the journey. Wire each leg as a section
clip with `connectors: []` and a small `crossfade` (~0.08). Even without an end frame
the legs still arrive at distinct rooms (the prompt steers the content). Cost: strictly
**sequential** (can't parallelize) and slower; interiors trip the NSFW filter, so build in
re-rolls (3 attempts/leg).

### B) Dive-in + aerial connector — only for diorama / miniature / god's-eye worlds
A "dive into each scene" clip + a connector that pulls **up and out** and flies over to the
next scene (Step 5). The pull-out **reverses camera direction at every seam** (forward dive
→ backward pull-out). In a miniature/diorama world that reads as an intentional "zoom out
to the map, fly to the next island"; in a grounded first-person walkthrough it reads as a
jarring **rewind/stutter**. Use B only for the map-like aesthetic. When in doubt, use A.

### Camera grammar — the move should fit the concept (A is NOT "forward only")

"Forward only" is the *seam* rule, not the *leg* rule. The physics of the chain:

- **Position continuity** at a seam comes from the frame handoff (next leg starts from the
  previous leg's actual last frame).
- **Velocity continuity** at a seam means the camera must never *reverse across a seam* —
  that's the rewind stutter.
- **Inside a single leg the camera is free.** One leg is one continuous render — there is
  no seam to break mid-leg, so orbits, crane-ups, lateral tracking, even a push-in that
  eases back out are all safe *within* the clip. Reversals are only fatal *across* seams.

So give each leg an expressive move chosen from the scene's own logic, under a **motion
handoff contract**: every leg **ends by settling into a slow, steady forward drift** toward
the next destination (final ~1 s), and every leg **begins by continuing that same drift**.
Keep both clauses in the prompts verbatim (templates in `references/prompts.md`).

Pick the grammar from the concept:

| Concept / tone | Mid-leg move |
|---|---|
| Product / luxury retail | slow half-orbit around the hero object, then continue past it |
| Real estate / hospitality | steadicam glide through doorways; gentle crane-up in atria |
| Industrial / process / logistics | low lateral track alongside the line, foreground parallax |
| Travel / outdoors / campus | drone-style rise-and-reveal, then a descending swoop |
| Food / craft / detail-driven | push in close to the craft moment, ease back, carry on |
| Playful miniature (arch. B) | dives + aerial hops — the connector IS the grammar |

Honest costs: expressive mid-leg moves raise re-roll odds — the model can end a fancy move
in a state that isn't a clean forward drift. Mitigations: keep the final-second settle
clause verbatim; **eyeball each leg's last frame before chaining the next** (it should look
like a frame from a gentle forward glide — if not, re-roll before wasting the next leg);
budget ~1 extra re-roll per expressive leg. A plain forward glide stays the zero-risk
default — use it for legs where the scene itself is the show.

Two related pacing knobs live in the engine (Step 7): per-section `scroll` (more scroll
distance = longer dwell in that scene) and `linger` (the camera settles mid-scene exactly
while the copy peaks, then picks up speed toward the seam). Prefer expressive motion in the
*clip* and restraint in the *scrub mapping* — they compound.

And remember scroll is a scrubber: visitors can scroll **up**, so every move also plays in
reverse. That's free and expected — no extra work — but it's another reason seam velocity
must be consistent in both directions (a seam that reads fine forward reads as a stutter
backward too if velocity flips).

**For B**, one camera flight per scene: starts high/outside, descends into the interior,
structure opens. Model: the chain you picked above (default **Seedance 2**), start
frame = the scene still's hosted URL (upload each still once, reuse the URL).

- Use the **solid-background still** (not the knocked-out transparent one) as the
  start image, so the video has a full frame.
- Prompt: "Single continuous cinematic camera move, no cuts. Begin high and far looking
  at the whole <scene> from outside … descend and fly inside toward <focal point> … the
  roof/walls gently open to reveal the interior. <style>, smooth graceful slow motion.
  No text." (Template in `references/prompts.md`.)
- Params (Seedance 2): `-i images_list='["<still URL>"]' -i aspect_ratio=16:9 -i duration=8`.
  For Kling v3: `-i image_url='<still URL>' -i duration=10 -i generate_audio=false` (no
  aspect-ratio or resolution params). Audio is wasted anyway — you'll mute — so wherever
  an endpoint has a `generate_audio` param (Kling v3, seedance-2-mini), pass `false`;
  Seedance 2's own endpoints have no audio param at all.
- Run concurrently, detached, then download each `.outputs[0]`. Re-roll individual
  failures. Keep the raw full-res sources — you need their frames next.

---

## Step 5 — Connectors (architecture B only)

Skip this whole step for architecture **A** — the forward take has no connectors; its legs
already chain seamlessly. This step applies to **B** (diorama/miniature), and note the
reversal caveat from Step 4.

The connector clips are what make the world feel *connected* instead of cut. A connector
flies from the end of scene i out and into the start of scene i+1. **Both of its
endpoints must be the ACTUAL RENDERED FRAMES of the neighbouring clips — never the
original diorama still.**

Why: every generation renders slightly differently. If a connector *ends* on
a fresh render of "the kitchen diorama," but the next dive clip *starts* on its own
different render of that same diorama, the two won't match and you get a pop at the seam.
The fix is to hand off the exact pixels:

```
For each connector between dive_i and dive_{i+1}:
  start-image = the LAST frame extracted from dive_i's rendered video
  end-image   = the FIRST frame extracted from dive_{i+1}'s rendered video
```

Now every seam is frame-identical on *both* sides:
`dive_i.end == connector.start` and `connector.end == dive_{i+1}.start`.

Extract the boundary frames from the rendered dives (not the stills), then upload them —
MuAPI endpoints take hosted URLs, not local paths:

```bash
ffmpeg -sseof -0.15 -i dive_i.mp4   -frames:v 1 -q:v 2 dive_i_last.png    # interior of i
ffmpeg -ss 0      -i dive_{i+1}.mp4 -frames:v 1 -q:v 2 dive_next_first.png # establishing of i+1

S_URL=$(muapi upload file dive_i_last.png    --output-json | jq -r '.url // .outputs[0] // empty')
E_URL=$(muapi upload file dive_next_first.png --output-json | jq -r '.url // .outputs[0] // empty')
```

Generate the connector (`duration 5` is plenty). Connectors need an end frame, so use a
roster endpoint that accepts one — and note this is `muapi run` territory: the MCP
`muapi_video_from_image` tool has no end-frame parameter (Step 4):

```bash
muapi run seedance-2-first-last-frame \
  --prompt "$(cat connector_i.txt)" \
  -i images_list="[\"$S_URL\",\"$E_URL\"]" \
  -i aspect_ratio=adaptive -i duration=5 --wait --output-json
# kling v3 instead: muapi run kling-v3.0-standard-image-to-video \
#   -i image_url="$S_URL" -i last_image="$E_URL" -i generate_audio=false -i duration=5
```

Connector prompt: "Single continuous camera move, no cuts. Pull up and back out of
<scene i>, rise into the sky, glide across the connected miniature world, and arrive
above <scene i+1>, beginning to descend toward it. Seamless flowing aerial transition.
<style>. No text." (Template in `references/prompts.md`.)

Insurance: Seedance lands *close* to the end frame but not always pixel-perfect, so the
engine still applies a **short crossfade** (a few frames) at each seam. Frame-matched
endpoints + a small crossfade = no visible cut. Never skip the actual-frame handoff and
rely on the crossfade alone; a big content jump can't be hidden by a crossfade.

---

## Step 6 — Encode for smooth scrubbing

Scrubbing = setting `video.currentTime` from scroll. Two things matter, and they are
often gotten wrong:

1. **Seekability, not keyframe density, is what makes scrubbing work.** Many static
   hosts (and `python -m http.server`) don't serve HTTP byte-range requests, which pins
   `video.seekable` to `[0,0]` and clamps *every* seek to frame 0 — the video looks
   frozen. The robust fix is to **fetch each clip as a `Blob` and play it from an
   in-memory object URL** (blobs are always fully seekable). The engine does this.
   Because of it, you do **not** need all-intra video.
2. **Don't shrink quality to get smooth seeks.** Encode at the **native resolution**
   (whatever ffprobe reports from your chain endpoint — don't downscale; the Seedance 2
   VIP `-1080p` endpoints pin 1080p if you want it guaranteed), `crf ~20`, a **small GOP** (`-g 8`) rather
   than all-intra (all-intra bloats an 8s clip to ~25 MB; GOP 8 is ~8 MB and scrubs
   fine via blob). Strip audio, add faststart, and a light `unsharp` counters video
   softness:

```bash
ffmpeg -i src.mp4 -an -vf "unsharp=5:5:0.8:5:5:0.0" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart out.mp4
```

Encode all 2N-1 clips (dives + connectors) with the same settings for uniform quality.

**Mobile encodes (beta — only if the user opted in at Step 1.5).** Phone video decoders seek
far slower than a laptop's, and seek cost scales with GOP length, so the 1080p `-g 8` master
that scrubs smoothly on desktop can stutter on a phone. Produce a lighter `-m.mp4` sibling for
every clip — **720p, `-g 4`** (more keyframes = cheaper seeks), crf 23 — and wire them as
`clipMobile` / `connectorsMobile` (Step 7). The engine serves them automatically on phones and
falls back to the desktop clip when absent. The exact `encm()` script is in
`references/pipeline.md` §6. If the user chose desktop-only, skip this — the engine still
hardens phone scrubbing regardless (seek-coalescing, iOS priming), so the page degrades
gracefully rather than breaking.

---

## Step 7 — Assemble the page

Copy `references/scrub-engine.js` (and, if you want a fully standalone page, the tiny
`references/index-template.html`) into the user's project — or adapt into their
framework. It's config-driven and self-contained:

```js
mountScrollWorld(document.getElementById('world'), {
  brand: { name: 'Pearl & Co.' },
  diveScroll: 1.3, connScroll: 0.9,          // viewport-heights of scroll per clip
  sections: [
    { id:'farm', label:'The Farms', still:'assets/farm.webp',
      clip:'assets/vid/farm.mp4', clipMobile:'assets/vid/farm-m.mp4',   // mobile beta only
      scroll: 1.6, linger: 0.45,   // optional pacing: longer dwell + camera settles mid-scene
      accent:'#8FB98A', eyebrow:'From leaf to last sip', title:'It starts in the hills.',
      body:'…', tags:['Single-origin','Hand-picked'] },
    // …one per section; last may carry a `cta`
  ],
  connectors:       ['assets/vid/conn1.mp4','assets/vid/conn2.mp4',   /* … length = sections-1 */],
  connectorsMobile: ['assets/vid/conn1-m.mp4','assets/vid/conn2-m.mp4' /* … same length; mobile beta only */],
});
```

The engine handles: the ordered dive/connector chain, scroll→currentTime with rAF
smoothing, blob loading, lazy prefetch of nearby clips, frame-matched crossfades, pinned
per-section copy (first section greets on landing, last holds its CTA), a route rail,
`prefers-reduced-motion`, and mobile. **Pacing per section:** `scroll` overrides
`diveScroll` for that scene (more scroll = longer dwell) and `linger` (0–1, keep ≤ 0.6)
remaps time so the camera settles mid-scene — exactly while the copy peaks — then speeds
up toward the seam; seam frames are untouched (f(0)=0, f(1)=1). Give the hero and finale
scenes a higher `scroll` + some `linger`; keep transit scenes brisk. Theme it with CSS variables (`--accent`,
`--sw-bg`, `--sw-ink`, …) — the visual identity comes from the generated clips, so the
chrome stays quiet. See the header of `scrub-engine.js` for the full config + CSS vars.

**On phones the engine adapts automatically** (coarse pointer or ≤860px): it serves
`clipMobile` / `connectorsMobile` when present, **coalesces seeks** (never queues a new
`currentTime` while the decoder is still seeking — this is what stops a fast flick from
freezing the clip), **keeps the still as a poster until the clip paints its first frame**
and **primes each video on first touch** (fixes iOS's blank-until-played video), drops the
drifting particles, ignores URL-bar-only resizes (no scroll jump), and uses safe-area
insets so copy clears the notch/home indicator. All of this hardening is on by default —
no config needed. The `clipMobile`/`connectorsMobile` encodes are the opt-in **mobile
beta** part (Step 1.5): only wire them when the user asked for the mobile version.

For non-JS backends (Python/Rails/etc.): serve the assets and drop the engine `<script>`
into the rendered HTML; nothing about it is framework-specific.

---

## Step 8 — QA the seams (don't skip)

Drive the page in a headless browser and **verify frame continuity at the seams**, which
is the thing most likely to be wrong:

- Screenshot at scroll positions just before and just after each seam. The two frames
  must be near-identical (the dive's last frame == the connector's first frame). If they
  pop, you used the diorama still instead of the actual rendered frame (redo Step 5), or
  the crossfade band is too short.
- Check the console for errors, confirm `video.seekable.end(0) > 0` (blob working), and
  that `currentTime` tracks scroll across each clip's band.
- **Mobile — full checklist only if the user opted into the mobile beta (Step 1.5).**
  For a desktop-only build, just sanity-check a phone viewport once: page loads, still
  posters show, nothing overlaps — the engine's hardening covers graceful degradation.
  For the beta (do this on a real phone or an emulated one, portrait + landscape):
  - Emulate a phone viewport **with CPU throttled 4–6×** and scroll fast — the clip should
    track without freezing (the seek-coalescing + `-m.mp4` encodes are what make this hold).
  - Confirm the first scene shows immediately (its still is the poster) and the video takes
    over the instant you scroll — no blank/black scene (the iOS priming fix). Test iOS Safari
    specifically; it's the one that goes blank if this regresses.
  - Verify the `-m.mp4` variant is actually served on mobile (Network panel), and the
    heavy 1080p master on desktop.
  - Slowly scroll so the URL bar collapses — the page must **not jump** (height-only resizes
    are ignored on touch). Rotate the device — layout should recompose cleanly.
  - Portrait crops a 16:9 clip to its centre; confirm the focal subject still reads. If a
    hero scene's subject sits off-centre and gets cut, recompose it (prompts.md) or generate
    a 9:16 variant for that scene.
- Check reduced-motion (should fall back to the stills, no video, no particles).

---

## Gotchas (hard-won)

- **Seam pop** → connector endpoints were the diorama stills, not the neighbouring
  clips' actual frames. Always extract real frames (Step 5).
- **Seam stutter / camera "jumps backward"** → even with frame-matched seams, if the
  camera *velocity reverses* (forward dive, then a connector that pulls back out) it
  reads as a rewind. This is inherent to architecture B. For any grounded walkthrough use
  architecture A (one continuous forward take — legs chained from actual last frames, no
  pull-back, no end frame); see Step 4.
- **Frozen video / stuck at frame 0** → `seekable=[0,0]`; the host isn't serving byte
  ranges. Use blob URLs (engine does).
- **Huge files** → you used all-intra. Use `-g 8` + blob instead.
- **Soft / low quality** → you downscaled or over-compressed. Encode at native
  resolution, crf ≤ 20, add `unsharp`. Video is inherently softer than the stills — keep
  the stills as the lite fallback for max fidelity.
- **Concurrent gens failing at launch (5xx / 429 / credit errors)** → transient when many
  launch at once; re-roll the individual failure (HTTP 402 is the real out-of-credits
  signal — verify with `muapi account balance` / `muapi_account_balance`; 429 is rate
  limiting, CLI exit code 4 — stagger and retry).
- **NSFW false-positives (Seedance rejects with a content-filter error)** → the video
  content filter flags
  perfectly innocuous clips, especially **bedroom, pool, spa/wellness** contexts and
  trigger words like "bed", "pool", "waterfall", "wine", "swim". It's partly the prompt
  wording and partly the reference frames. Fixes, in order: (1) re-roll — it's often
  non-deterministic and passes on the 2nd–3rd try; (2) strip trigger words and add
  "empty, unoccupied, no people, no figures, architectural, tasteful"; (3) regenerate
  just that clip on **`kling-v3.0-standard-image-to-video`** with the same start/end
  frames (`image_url` + `last_image`, `generate_audio=false`) — a different
  provider's filter often passes what Seedance blocks. Expect a slight render-character
  shift on that one clip (each model has its own grain/motion feel); for a 5s connector
  behind a crossfade that usually beats option (4): set the connector slot to `null` —
  the engine crossfades that seam directly (optional connectors), so the page still
  completes. Budget extra credits/time for these re-rolls on interiors/real-estate content.
- **Dark / custom theme** → the engine wraps its default tokens in `@layer sw`, so a
  page-level `:root` / `.sw-root { --sw-bg; --sw-ink; --sw-accent; --sw-font-* }` block
  wins cleanly (no specificity hacks). `--sw-ink` is your primary **text/heading** colour;
  the **accent** fills the primary button and active nav. For a dark theme, set `--sw-bg`
  dark and `--sw-ink` light — the copy scrim and title shadow follow `--sw-bg` automatically.
- **Phone scrub stutters / freezes on a fast flick** → the 1080p master is too heavy for a
  phone decoder and seeks pile up. Ship the `-m.mp4` mobile encodes (720p, `-g 4`) and wire
  `clipMobile`/`connectorsMobile` (Step 6/7). The engine already coalesces seeks; the lighter
  encode is the other half. Still choppy on a low-end device? Tighten GOP (`-g 2` / all-intra).
- **Blank / black scene on iOS (desktop was fine)** → an iOS Safari quirk: a muted video that
  was never played won't paint a seeked frame. The engine fixes this by keeping the still as a
  poster until the clip paints and priming each video on first touch — so **don't** hide the
  still on `loadedmetadata` or strip the `playsinline`/`muted` attributes if you adapt the
  engine into a framework.
- **Page jumps while scrolling on mobile** → something is re-running layout on the URL-bar
  show/hide `resize`. The engine ignores height-only resizes on touch; if you ported it, gate
  your resize handler on a width change (keep the `orientationchange` path for rotation).
- **Copy hidden behind the URL bar / notch on mobile** → use the engine's safe-area-aware
  bottom offset (`env(safe-area-inset-bottom)` + `dvh`); make sure the page's
  `<meta viewport>` includes `viewport-fit=cover` (the template does).
- **Portrait crops the scene** → a 16:9 clip on a tall phone shows only its centre. Keep each
  scene's focal subject centred with a little headroom (prompts.md), or generate a 9:16 hero
  for the scenes that matter most. The engine centre-crops (`object-fit:cover`); it can't
  un-crop a widescreen composition.
- **Unwanted audio track / wasted credits on sound** → Kling v3 and seedance-2-mini
  default `generate_audio` to **on** — always pass `generate_audio=false` (Seedance 2's
  own endpoints have no audio param); mute in HTML and `-an` on encode regardless.
- **Endpoint rejects your inputs** → schemas differ per endpoint: Kling v3 i2v has **no
  `aspect_ratio` or `resolution` params** (it follows the input frame — encode at
  whatever native res ffprobe reports), Seedance 2 takes `images_list` (an array), Kling
  takes `image_url`/`last_image` (strings). Check the live schema with
  `muapi run <endpoint> -h` before batching. Duration defaults are 5; legs/dives want 8–10.
- **"Video looks generated from the wrong image"** → you passed a local file path instead
  of a hosted URL, or uploaded the wrong frame. MuAPI endpoints only accept URLs — upload
  via `muapi upload file` / `muapi_upload_file` and double-check which frame each URL is.
- **Connector came back ignoring the end frame** → you generated it through the MCP
  `muapi_video_from_image` tool, which has no end-frame parameter. Use
  `muapi run seedance-2-first-last-frame` (or Kling v3 with `last_image`) — Step 5.
- **Seam pop only where you "saved credits"** → you swapped models mid-chain, or used a
  start-frame-only endpoint where a connector needs an end frame. One model family for
  the whole chain; the cheap tiers that keep frame-locking are `seedance-lite-i2v` and
  the Seedance 2 `-fast` siblings, so previz stays seamless. (Any endpoint with
  reference-only image inputs can't hold a seam at all — Step 4.)
- **White-box scenes** → `gpt-image-2` returns a solid bg; either match the page bg to it
  or knock it out (Step 3).
- **bash 3.2** on macOS → no associative arrays in scripts.

## References

- `references/prompts.md` — the intake checklist, style-preamble pattern, and every
  prompt template (scene still, dive, connector) with fill-in slots.
- `references/pipeline.md` — copy-paste batch scripts for the whole run (generate →
  extract frames → connectors → encode → mobile encode), bash-3.2-safe.
- `references/scrub-engine.js` — the portable, config-driven scrub engine (builds DOM +
  injects CSS; blob-seek, lazy load, seam crossfade, copy, route rail, reduced-motion, and
  phone hardening: mobile encodes, seek-coalescing, iOS priming, safe-area, no-jump resize).
- `references/index-template.html` — a minimal standalone page that mounts the engine.
- `references/knockout.py` — border-connected background knockout for floating scenes.
