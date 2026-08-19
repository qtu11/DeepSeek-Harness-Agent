# Prompt templates & intake

Everything here is fill-in-the-slots. Keep the **style preamble** byte-for-byte identical
across all scene stills — that identical text is what makes the world feel like one place.

## Intake checklist (Step 1)

Collect and write down:

- `SUBJECT` — the business + one-line pitch.
- `BRAND_NAME` — display name.
- `PALETTE` — 4–6 named hexes, e.g. `taro #9B7EBD, cream #F5EDE0, caramel #C88A5A, matcha #8FB98A, plum #3A2E48`. Pick ONE as the scene **background** colour (usually the lightest) and one as the primary **accent**.
- `TONE` — a word or two (cozy/premium, playful, industrial…).
- `STYLE` — the art direction (default below).
- `SECTIONS[]` — ordered list; for each: `id`, `label`, `subject` (what's in the diorama), `eyebrow`, `title`, `body` (≤ 1 sentence), `tags[]` (0–3). Last section = hero product + CTA.
- `MOBILE` — yes/no. **Always asked** (SKILL Step 1.5), presented to the user as **beta**. Gates the `-m.mp4` encodes (pipeline §6) + `clipMobile`/`connectorsMobile` wiring + the full mobile QA.

## Style preamble (default: clay diorama)

Reuse verbatim in every scene prompt. Swap the bracketed bits for the brand's palette/bg.

```
Isometric low-poly 3D diorama floating as a small rounded island on a plain solid
[BG_HEX] background with a soft contact shadow beneath it. Soft matte clay 3D render,
rounded toy-model shapes, gentle warm studio lighting, soft long shadows, tilt-shift
miniature look. Cohesive color palette of [PALETTE]. Highly detailed, centered
composition, absolutely no text, no letters, no numbers, no logos.
```

Alternate directions (swap the first two sentences, keep the palette/no-text tail):
- **Flat papercraft:** "Isometric layered paper-craft diorama, matte cardstock, clean die-cut edges, subtle drop shadows between layers."
- **Glossy toy:** "Isometric glossy vinyl-toy diorama, smooth plastic shading, soft rim light, collectible figurine look."
- **Claymation:** "Isometric stop-motion clay set, visible thumbprints, handmade plasticine texture, soft studio softbox light."
- **Neon night:** "Isometric miniature at night, warm interior glow and neon signage, moody rim light, wet reflective ground."
- **Photoreal architectural** (real estate, hospitality, premium/luxury): "Ultra-photorealistic architectural photography of a single cohesive [subject], cinematic wide-angle, warm golden-hour light, natural materials, restrained designer furnishings, a breathtaking view, editorial magazine quality (Architectural Digest), shallow depth of field, no people." For photoreal, drop the floating-island framing and the knockout (Step 3) — the scenes are **full-bleed** (a dark page background reads premium), the "dive" glides *through doorways/glass* rather than opening a roof, and cohesion comes entirely from the identical preamble (do NOT pass a reference image via `gpt-image-2-image-to-image` — it clones the same room). Interiors trip Seedance's NSFW filter often; see SKILL Gotchas.

## Scene still prompt (Step 2)

```
[STYLE PREAMBLE]
Subject: [SECTION.subject — describe the miniature scene: the building/space, a few
characters doing the work, the props that signal this stage of the business].
```

Tips:
- Name concrete props (they anchor the scene): tanks, cauldrons, conveyor, crates, awning, string lights, benches, scooters, map pins.
- For the final "hero product" section, drop the diorama-island framing and prompt a
  single oversized product centerpiece floating on the same background with a few small
  orbiting props.
- **Compose for the centre.** The page renders every clip `object-fit:cover`, and a portrait
  phone crops a 16:9 frame to roughly its centre half. Keep the focal subject horizontally
  centred with a little headroom, and don't park anything essential at the far left/right
  edges — it will be cut off on phones. This also keeps the dive's focal point (which the
  camera flies toward) inside the mobile crop. For a scene that absolutely must show its full
  width on mobile, generate a separate 9:16 variant for it.
- Aspect `4:3` on `gpt-image-2-text-to-image` (MuAPI's gpt-image-2 has no 3:2; use
  `nano-banana-pro` if you want true 3:2), `-i resolution=2K -i quality=high`.

## Leg prompt — architecture A, continuous forward take (Step 4)

Start frame = previous leg's ACTUAL last frame (leg 0: the first scene's still),
extracted, uploaded (`muapi upload file`), and passed as a hosted URL.
**No end/last frame.** The bolded clauses are the motion-handoff contract — keep them
verbatim; the mid-leg move is where the expression goes.

```
Single continuous cinematic camera move, no cuts. **Continue the same slow, steady
forward glide.** [MID-LEG MOVE — optional, from the library below.] The camera moves
into [SCENE i] toward [FOCAL POINT]. **In the final second, settle back into a slow,
steady forward glide toward [the doorway / opening / direction of the next scene].**
[STYLE tail + PALETTE]. Smooth, graceful, slow motion, subtle parallax. No text, no captions.
```

### Mid-leg move library (pick by concept; omit for a plain glide)

Reversals are safe *inside* a leg (it's one continuous render) — only a seam may never
reverse. That's why "ease back out" is fine mid-leg.

- **Half-orbit** (product, luxury): "sweeping in a slow half-orbit around [the hero
  object], keeping it centered, then continuing past it"
- **Crane-up reveal** (scale, atriums, campuses): "rising smoothly as the full scale of
  [the space] reveals below"
- **Low lateral track** (production lines, counters, shelves): "tracking low and level
  alongside [the line], foreground objects sliding past in parallax"
- **Push-in + ease back** (craft, detail): "pushing in close to [the craft moment] until
  it nearly fills the frame, then easing gently back out"
- **Rise-and-swoop** (travel, outdoors): "climbing in a gentle arc over [the terrain],
  then swooping down toward [the next focal point]"

After rendering each leg, **check its last frame** before generating the next: it should
read as a frame from a calm forward glide (no motion blur sideways, no half-finished
orbit). If it doesn't, re-roll this leg — a bad handoff frame poisons every leg after it.

## Dive-in clip prompt (Step 4)

Start frame = the scene still (solid-bg version), uploaded once, passed as a hosted URL.

```
Single continuous cinematic camera move, no cuts. Begin high and far, looking down at the
whole [SECTION.subject] from outside like a tiny model. The camera slowly glides forward
and descends toward it, sweeping in toward [FOCAL POINT — the counter/the cauldrons/the
people], as if flying inside. As the camera pushes in, the roof and upper structure
gently lift and open away to reveal the warm interior. [STYLE tail: soft matte clay
diorama, tilt-shift miniature, warm light, [PALETTE]]. Smooth, graceful, slow motion,
subtle parallax. No text, no captions.
```

For scenes with no building to open (a field, a plaza, a road), replace the roof clause
with "the camera flies low across [the scene] toward [focal point]."

Params by chain (SKILL Step 4 table): Seedance 2 (`seedance-2-image-to-video`) —
`-i images_list='["<start URL>"]' -i aspect_ratio=16:9 -i duration=8`, no audio param;
Kling v3 (`kling-v3.0-standard-image-to-video`) — `-i image_url='<start URL>'
-i duration=10 -i generate_audio=false` (no aspect-ratio or resolution params). Same for
architecture-A legs.

## Connector clip prompt (Step 5)

Start frame = dive_i's LAST frame (extracted), end frame = dive_{i+1}'s FIRST frame
(extracted). Both from the RENDERED videos, not the stills — and both uploaded
(`muapi upload file`) so you can pass their hosted URLs.

```
Single continuous cinematic camera move, no cuts. The camera smoothly pulls up and back
out of [SCENE i], rising into the sky, then glides forward across the connected miniature
world and arrives above [SCENE i+1], beginning to descend toward it. One connected
miniature clay world, seamless flowing aerial transition. [STYLE tail + PALETTE]. Smooth
graceful slow motion. No text, no captions.
```

For the last connector into a hero-product finale: "…glides forward and the world
dissolves toward a single giant [PRODUCT] floating in soft [BG] space, arriving in front
of it."

Seedance 2 (`seedance-2-first-last-frame`): `-i images_list='["<start URL>","<end URL>"]'
-i aspect_ratio=adaptive -i duration=5`; Kling v3: `-i image_url='<start URL>'
-i last_image='<end URL>' -i generate_audio=false -i duration=5`. Connectors need an end
frame → use a roster endpoint that accepts one, via `muapi run` (the MCP video tool has
no end-frame param — Step 4/5).

## Copy per section (for the engine config)

- `eyebrow` — 2–4 words, uppercase feel (a value-prop label).
- `title` — 3–6 words, the beat's headline. First section = the site's hero line; last =
  the payoff + it carries the CTA.
- `body` — one sentence, plain-spoken, from the visitor's side.
- `tags` — 0–3 short proof chips (e.g. "Fresh-cooked", "30-min delivery").
