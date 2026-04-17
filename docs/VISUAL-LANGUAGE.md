# ToneGlyph Visual Language

Design principles for encoding five-pillar audio analysis into a deterministic visual artifact.

---

## Academic Foundations

### Jacques Bertin — Semiology of Graphics (1967)

Bertin identified seven **retinal variables** for encoding data visually: position, size, shape, value (lightness), color (hue), orientation, and texture. Each has different strengths for different data types.

ToneGlyph uses six of the seven:

| Bertin Variable | ToneGlyph Mapping | Source Pillar | Why This Variable |
|---|---|---|---|
| **Position** | Sector angle on radial form | Pillar 3 — pitch class (C→B) | Nominal data → angular position is the natural encoding for cyclic pitch space |
| **Size** | Petal radius / lobe amplitude | Pillar 3 — chroma energy per bin | Quantitative data → size is the most preattentive variable for magnitude |
| **Shape** | Organic outline distortion, symmetry | Pillar 2 — MFCC profile, DNA score | Nominal/ordinal → shape distinguishes songs at a glance without color |
| **Value** | Gradient lightness within sectors | Pillar 4 — hidden_complexity | Ordered data → dark-to-light conveys depth/complexity intuitively |
| **Color** | Sector hues (chromatic circle) | Pillar 3 — pitch class identity | Nominal data → hue is the strongest associative variable (Bertin's finding) |
| **Texture** | Gradient smoothness / stop count | Pillar 4 — hidden_complexity | Ordinal data → coarser texture = simpler, finer = more layered |

The seventh variable, **orientation**, is reserved for future use (e.g., influence lineage direction).

### Edward Tufte — The Visual Display of Quantitative Information

Tufte's core principle: **maximize the data-ink ratio**. Every pixel should encode information; decoration without data meaning is chartjunk.

ToneGlyph application:
- Every sector color encodes a pitch class energy value
- Every gradient stop encodes a complexity dimension
- The mood palette shift encodes genre/era context — not decoration
- The organic outline shape encodes the MFCC spectral profile — not random noise
- The Bertin model enforces maximum data-ink ratio; the Chromatic model trades some for emotional resonance (justified: the artifact is both analytical and experiential)

### Josef Albers — Interaction of Color (1963)

Albers demonstrated that **colors behave differently depending on their neighbors**. The same hue appears warmer next to blue, cooler next to red. Simultaneous contrast affects perceived saturation and lightness.

ToneGlyph application:
- Adjacent chroma sectors interact perceptually — C (red) next to B (magenta) and C# (red-orange) creates different contrast than D (orange) next to D# (gold)
- The mood palette shift rotates ALL sectors together, preserving relative contrast relationships while shifting the overall temperature
- Screen blending of overlapping petals creates emergent colors at intersections — these are not random but determined by which pitch classes co-occur with high energy
- Testing must verify that no two adjacent high-energy sectors produce muddy or indistinguishable blends

### Gestalt Principles

- **Proximity**: Sectors with similar energy naturally group (large petals cluster visually)
- **Similarity**: Same-hue sectors across the glyph register as a group, even at distance
- **Continuity**: The organic outline connects all sectors into a single continuous form
- **Closure**: The radial arrangement implies a complete circle even where low-energy sectors are minimal
- **Figure-ground**: The glow backdrop separates the glyph from the #080c18 background

---

## Visual Models

### Chromatic (default)

The flagship model. Prioritizes emotional resonance and genre legibility over strict data-ink ratio.

- 12 sectors, one per pitch class, colored by chromatic circle
- 3 overlapping petal layers with screen blending for depth
- Mood-tinted palette: genre DNA and era shift the entire hue wheel warm/cool
- Organic outline: MFCC-modulated radial curve for spectral personality
- Animated: slow rotation, pulse on beat, per-sector luminance from chroma_beat_sync

### Bertin

The analytical model. Prioritizes Tufte's data-ink ratio and Bertin's retinal variables.

- 12 sectors, same geometry
- Single hue (dominant pitch class), value (lightness) encodes energy
- No mood tinting — data speaks for itself
- Geometric outline — no organic distortion
- Static (no rotation) — animation only for beat-sync sector luminance

---

## Mood Palette Logic

The raw chromatic circle (C=0° red, D=60° orange, E=120° yellow, ...) provides base hues. Genre and era shift the entire palette:

| Genre Signal | Warmth Shift | Saturation | Lightness | Feel |
|---|---|---|---|---|
| Folk / singer-songwriter | +50° warm | ×0.85 | normal | Warm ambers, earth tones |
| Jazz / modal / swing | −40° cool | ×0.9 | normal | Cool indigos, steely blues |
| Classical / impressionist | −20° cool | ×0.42 | +35% | Soft pastels, ethereal |
| Rock / prog / metal | +28° warm | ×1.15 | normal | Reds, oranges, high contrast |
| Electronic / ambient | −28° cool | ×1.1 | normal | Cyans, cool greens |

Era reinforcement:
- 1970s Laurel Canyon → additional +6° warm
- 1959 modal jazz → additional −8° cool
- 19th-century French → additional desaturation + lightness

The shift preserves **relative** hue relationships between sectors (Albers) while changing the **absolute** temperature (Bertin's selective color encoding).

---

## Design Rules

1. **Determinism**: Same song always produces the same glyph. No randomness in rendering.

2. **Multi-scale legibility**: The glyph must read at full-screen (hero), thumbnail (catalog), social share (cropped), and print (poster). Shape and dominant color carry at small sizes; sector detail emerges at full size.

3. **Genre legibility**: A viewer should be able to guess the genre family from the glyph's color temperature alone, before reading any labels. Warm = folk/rock, cool = jazz/classical.

4. **Complexity encoding**: Visually simple songs produce visually simple glyphs (fewer active sectors, cleaner gradients, more symmetrical outline). Complex songs produce complex glyphs (many active sectors, deep gradients, organic distortion).

5. **No chartjunk**: Every visual element traces to a pillar output via the active binding. If it doesn't encode data, it doesn't belong. The Bertin model enforces this strictly; the Chromatic model allows atmospheric elements (glow, bloom) because they encode emissive_power and transmission.

6. **Color interaction testing**: Adjacent high-energy sectors must produce distinct, non-muddy blends under screen compositing. If two adjacent hues blend to gray, the mood shift needs tuning.

---

## Pillar Binding Reference

The default binding (`bindings/default.json`) maps:

| Visual Property | Data Source | Pillar |
|---|---|---|
| Sector hue angles | `pillar3.chroma.mean` | 3 — Music Theory |
| Overall saturation | `pillar5.novelty_score` | 5 — IP Novelty |
| Palette warmth/coolness | `pillar1.genre_position` | 1 — Zeitgeist |
| Gradient depth (stops) | `pillar4.hidden_complexity_score` | 4 — Johari |
| Era mood overlay | `pillar1.era_alignment` | 1 — Zeitgeist |
| Shape complexity | `cas.geometry.shape_complexity` | 2 — Artistic DNA |
| Shape symmetry | `cas.geometry.shape_symmetry` | 2 — Artistic DNA |
| Glow intensity | `cas.lighting.emissive_power` | 4 — Johari |
| Rotation speed | `cas.motion.spin_rate` | 3 — Music Theory |
| Pulse amplitude | `cas.motion.pulse_amplitude` | 3 — Music Theory |
| Beat-sync per sector | `pillar3.chroma.beat_sync` | 3 — Music Theory |
