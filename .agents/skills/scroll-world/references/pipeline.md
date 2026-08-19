# Pipeline: copy-paste scripts (bash 3.2 safe)

Run these with **bash**, not zsh — the `$INPUTS`/word-split pattern below relies on bash's
unquoted-expansion splitting, which zsh doesn't do by default (in zsh the whole flag string
arrives as one argument and the payload comes out mangled; verified via `--dry-run`).

Set these once. `NAMES` is the ordered section ids; the last is the hero/finale.

```bash
WORK=/tmp/scroll-world           # scratch dir for prompts, sources, frames
ASSETS=./assets                  # where the site reads stills (webp) + clips (mp4)
mkdir -p "$WORK" "$ASSETS/vid"
NAMES="farm kitchen shop delivery plaza finale"   # <-- your section ids, in order

# Auth: MUAPI_API_KEY env var, or `muapi auth configure --api-key <key>` once.
# Verify: `muapi auth whoami`; credits: `muapi account balance`.

# Chain — ONE model family for every chained clip (SKILL Step 4 roster).
# Legs/dives need a start frame; connectors also need an end/last frame
# (verify any endpoint's live schema: muapi run <endpoint> -h).
VMODEL=seedance-2
case "$VMODEL" in                                  # per-family endpoints + durations (bash 3.2 safe)
  kling-v3.0)    I2V=kling-v3.0-standard-image-to-video; FLF=$I2V
                 DIVE_DUR=10; CONN_DUR=5 ;;        # image_url [+ last_image]; ALWAYS generate_audio=false
  seedance-lite) I2V=seedance-lite-i2v; FLF=$I2V
                 DIVE_DUR=8;  CONN_DUR=5 ;;        # cheap frame-locked previz; image_url [+ last_image], resolution=720p
  *)             I2V=seedance-2-image-to-video; FLF=seedance-2-first-last-frame
                 DIVE_DUR=8;  CONN_DUR=5 ;;        # seedance-2 default; images_list=[start] / [start,end]
esac
```

MuAPI generations take minutes — every `muapi run ... --wait` call below is meant
to run inside a **backgrounded** script. Launch the whole script with your tool's
background/detached mode and poll the progress log; never block the foreground.
(One-off re-rolls can also go through the MCP tools — submit with `muapi_image_generate`
/ `muapi_video_from_image`, poll `muapi_predict_result` — but connectors can't: the MCP
video tool has no end-frame parameter.)

## 0. Upload helper — endpoints take hosted URLs, never local paths

```bash
up() { # file -> hosted URL on stdout
  muapi upload file "$1" --output-json | jq -r '.url // .outputs[0] // empty'
}
```

(If the field comes back empty, run `muapi upload file <f> --output-json` once by hand
and read the actual field name from the JSON.)

## 1. Scene stills (Step 2)

Write one prompt file per section to `$WORK/still_<name>.txt` (see prompts.md), then:

```bash
gen_still() { # name
  muapi run gpt-image-2-text-to-image --prompt "$(cat "$WORK/still_$1.txt")" \
    -i aspect_ratio=4:3 -i resolution=2K -i quality=high --wait --output-json \
    > "$WORK/still_$1.json" 2> "$WORK/still_$1.err"
  url=$(jq -r '.outputs[0] // empty' "$WORK/still_$1.json")
  [ -n "$url" ] && curl -fsSL "$url" -o "$WORK/still_$1.png" && echo "still $1 ok" || echo "still $1 FAIL"
}
for n in $NAMES; do gen_still "$n" & done ; wait
```

Convert to webp for the site (and optionally run knockout.py first for transparency):

```bash
for n in $NAMES; do cwebp -quiet -q 84 -resize 1800 0 "$WORK/still_$n.png" -o "$ASSETS/$n.webp"; done
```

Review the stills for cohesion before continuing. Re-roll any off-style one (to lock
style, switch that re-roll to `gpt-image-2-image-to-image` with an approved still's
hosted URL in `images_list`).

Then upload each approved still once — the dive gens condition on these URLs:

```bash
for n in $NAMES; do up "$WORK/still_$n.png" > "$WORK/still_$n.url" & done ; wait
```

## 2. Dive-in clips (Step 4)

Prompt files at `$WORK/dive_<name>.txt`. Start frame = the solid-bg still's hosted URL.

```bash
gen_dive() { # name          ($INPUTS is unquoted on purpose — word-split flags; URLs have no spaces)
  STILL_URL=$(cat "$WORK/still_$1.url")
  case "$VMODEL" in
    kling-v3.0)    INPUTS="-i image_url=$STILL_URL -i generate_audio=false" ;;
    seedance-lite) INPUTS="-i image_url=$STILL_URL -i resolution=720p" ;;
    *)             INPUTS="-i images_list=[\"$STILL_URL\"] -i aspect_ratio=16:9" ;;
  esac
  muapi run "$I2V" --prompt "$(cat "$WORK/dive_$1.txt")" \
    $INPUTS -i duration="$DIVE_DUR" \
    --wait --output-json > "$WORK/dive_$1.json" 2> "$WORK/dive_$1.err"
  url=$(jq -r '.outputs[0] // empty' "$WORK/dive_$1.json")
  [ -n "$url" ] && curl -fsSL "$url" -o "$WORK/dive_$1.mp4" && echo "dive $1 ok" || echo "dive $1 FAIL"
}
for n in $NAMES; do gen_dive "$n" & done ; wait
```

Re-roll individual failures (5xx / 429 rate-limit are transient; HTTP 402 = actually out
of credits): `gen_dive shop`  (just that one).

## 3. Extract boundary frames — the seam handoff (Step 5)

For each adjacent pair, the connector's start = dive_i's LAST frame, end = dive_{i+1}'s
FIRST frame — extracted from the **rendered videos**, never the stills.

```bash
set -- $NAMES
prev=""
for n in "$@"; do
  ffmpeg -v error -ss 0 -i "$WORK/dive_$n.mp4" -frames:v 1 -q:v 2 "$WORK/first_$n.png"      # establishing
  ffmpeg -v error -sseof -0.15 -i "$WORK/dive_$n.mp4" -frames:v 1 -q:v 2 "$WORK/last_$n.png" # interior
done
```

Upload the boundary frames (connectors condition on their URLs):

```bash
for n in $NAMES; do
  up "$WORK/first_$n.png" > "$WORK/first_$n.url" &
  up "$WORK/last_$n.png"  > "$WORK/last_$n.url" &
done ; wait
```

## 4. Connector clips (Step 5)

Prompt files at `$WORK/conn_<i>.txt` (i = 1..N-1). Iterate adjacent pairs:

```bash
gen_conn() { # i startUrlFile endUrlFile        (end frame required → seedance-2 FLF / kling / lite only;
             #                                   $INPUTS unquoted on purpose — word-split flags)
  S=$(cat "$2"); E=$(cat "$3")
  case "$VMODEL" in
    kling-v3.0)    INPUTS="-i image_url=$S -i last_image=$E -i generate_audio=false" ;;
    seedance-lite) INPUTS="-i image_url=$S -i last_image=$E -i resolution=720p" ;;
    *)             INPUTS="-i images_list=[\"$S\",\"$E\"] -i aspect_ratio=adaptive" ;;
  esac
  muapi run "$FLF" --prompt "$(cat "$WORK/conn_$1.txt")" \
    $INPUTS -i duration="$CONN_DUR" \
    --wait --output-json > "$WORK/conn_$1.json" 2> "$WORK/conn_$1.err"
  url=$(jq -r '.outputs[0] // empty' "$WORK/conn_$1.json")
  [ -n "$url" ] && curl -fsSL "$url" -o "$WORK/conn_$1.mp4" && echo "conn $1 ok" || echo "conn $1 FAIL"
}
set -- $NAMES ; i=0 ; prev=""
for n in "$@"; do
  if [ -n "$prev" ]; then i=$((i+1)); gen_conn "$i" "$WORK/last_$prev.url" "$WORK/first_$n.url" & fi
  prev="$n"
done ; wait
```

## 5. Encode everything for scrubbing (Step 6)

Native resolution (whatever ffprobe reports from your chain endpoint — the plain
Seedance 2 endpoints pick their own res; the `seedance-2-vip-*-1080p` variants pin
1080p — **never upscale**, encode what ffprobe reports), crf 20, GOP 8, light sharpen,
no audio, faststart. Same for dives + connectors.

```bash
enc() { ffmpeg -v error -y -i "$1" -an -vf "unsharp=5:5:0.8:5:5:0.0" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart "$2"; echo "enc $2 $(du -h "$2"|cut -f1)"; }

for n in $NAMES; do enc "$WORK/dive_$n.mp4" "$ASSETS/vid/$n.mp4"; done
i=0; for f in "$WORK"/conn_*.mp4; do i=$((i+1)); enc "$f" "$ASSETS/vid/conn$i.mp4"; done
```

Now the engine config's `sections[k].clip = assets/vid/<name>.mp4` and
`connectors = [assets/vid/conn1.mp4, …]` (length N-1, in order).

## 6. Mobile encodes (Step 6) — mobile beta, only if the user opted in

**Skip this section unless the user chose the mobile (beta) version in the Step 1
interview.** Scrubbing sets `currentTime` every frame, and a phone decoder's **seek cost scales with
how many frames it must decode from the nearest keyframe** — so a 1080p `-g 8` master
that scrubs fine on a laptop stutters on a phone. A **smaller frame + tighter GOP** fixes
that (and halves the bytes on cellular). Produce a `-m.mp4` sibling for every clip:

```bash
# 720p, GOP 4 (twice the keyframes = ~half the seek-decode work), crf 23, same sharpen/faststart.
encm() { ffmpeg -v error -y -i "$1" -an -vf "scale=-2:720,unsharp=5:5:0.6:5:5:0.0" \
  -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p \
  -g 4 -keyint_min 4 -sc_threshold 0 -movflags +faststart "$2"; echo "encm $2 $(du -h "$2"|cut -f1)"; }

for n in $NAMES; do encm "$WORK/dive_$n.mp4" "$ASSETS/vid/$n-m.mp4"; done
i=0; for f in "$WORK"/conn_*.mp4; do i=$((i+1)); encm "$f" "$ASSETS/vid/conn$i-m.mp4"; done
```

Wire the variants in the engine config — the engine serves them automatically on phones,
falling back to the desktop `clip` when a mobile one is absent:

```js
sections[k].clipMobile = 'assets/vid/<name>-m.mp4';
connectorsMobile = ['assets/vid/conn1-m.mp4', …];   // length N-1, in order
```

If phone scrubbing still stutters, tighten the GOP further (`-g 2`, or `-g 1` for all-intra
= instant seeks at the cost of larger files); if cellular weight is the bigger worry, raise
`crf` (24–26) or drop to `scale=-2:600`. If the master is already 720p (e.g. a 720p-native
endpoint or the seedance-lite previz), the mobile encode still pays off — the tighter GOP
is what makes phone seeks cheap. All-mobile encodes stay 16:9 — the engine
centre-crops them; see the portrait note in SKILL Step 8 / prompts.md.

## Notes

- `.outputs[0]` is the result-URL field on a completed prediction (`status: completed`;
  poll is `GET /api/v1/predictions/{id}/result` with `x-api-key` under the hood —
  `muapi run --wait`, `muapi predict wait <id>`, and the MCP `muapi_predict_result` all
  wrap it). `--download <dir>` on `muapi run`/`muapi predict wait` saves outputs directly
  if you'd rather skip the curl.
- **NSFW fallback across models**: if one clip keeps getting flagged on seedance after
  re-rolls + prompt scrubbing, regenerate just that clip on Kling v3 with the SAME
  start/end frame URLs:
  `muapi run kling-v3.0-standard-image-to-video -i image_url="$S" -i last_image="$E" -i generate_audio=false -i duration=5 ...`
  — then restore your chain model. See SKILL Gotchas for the trade-off.
- **Previz on the cheap**: run the whole chain once with `VMODEL=seedance-lite`
  (frame-locking intact, 720p) to validate the journey and seams before spending
  full-model credits — because it's still seamless, the previz translates directly to the
  final render. Don't reach for reference-only endpoints here: without start/last-frame
  inputs they can't hold a seam, so their output can't be chained (Step 4 rule).
- If a whole batch stalls, check `muapi account balance` for credits (HTTP 402 = out of
  credits) and `$WORK/*.err` for the reason. CLI exit codes: 4 = rate limited, 7 = timeout.
- Concurrency: launching ~5–6 gens at once is fine; much more can trigger transient
  429/5xx errors — stagger or re-roll.
