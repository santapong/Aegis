# Aegis comet asset-generation prompt

Attach the concept image before submitting this prompt to a 3D, image, or video
generation tool:

`ChatGPT Image Aug 12, 2026, 06_24_53 PM.png`

## Objective

Create a production-quality cosmic energy comet for the Aegis financial web
application.

Use the attached image as the primary visual reference. Match its elegant,
flowing silhouette and luminous energy structure, but isolate the comet from
the original background.

This is not a rocky meteor or a fireball. It is an abstract celestial structure
made from light, plasma, orbital energy, fine particles, and transparent
volumetric wisps.

The asset will appear inside a dark website hero and move according to
page-scroll position.

## Visual identity

The comet should feel:

- Elegant
- Intelligent
- Futuristic
- Premium
- Atmospheric
- Weightless
- Energetic without appearing aggressive
- Appropriate for a financial-planning application

It should resemble a gravitational or financial energy flow rather than a
destructive meteor.

### Color palette

Use primarily:

- Brilliant white at the nucleus
- Electric blue
- Cool cyan
- Deep ultramarine blue
- Restrained violet highlights

Suggested colors:

- White: `#FFFFFF`
- Pale cyan: `#BDEFFF`
- Electric blue: `#52A8FF`
- Deep blue: `#173B8F`
- Violet: `#7A6CFF`

The nucleus should be nearly white. Color should gradually transition into
cyan, blue, and subtle violet through the tail.

Do not use orange fire, red flames, brown rock, yellow smoke, or warm meteor
colors.

## Final composition

Design the comet as a long horizontal-diagonal composition.

At its final website position:

- The luminous head is near 78% of the viewport width.
- The head is near 42% of the viewport height.
- The head points slightly upward and toward the right.
- The tail extends behind it toward the upper-left.
- The tail crosses most of the viewport.
- The central tail drops gently through the middle before curving back upward.
- The overall silhouette forms a graceful elongated S-curve.
- The head remains relatively small compared with the total tail length.
- Large areas around the comet remain transparent.

The head must not look like a large glowing ball. It should be a compact,
brilliant nucleus contained within a larger structure of orbital energy loops.

## Comet head

Create a compact, extremely luminous nucleus.

The head should include:

1. A small white-hot central nucleus.
2. A soft cyan-blue volumetric halo.
3. Three or more fine elliptical orbital energy loops.
4. One loop crossing in front of the nucleus.
5. One loop passing behind the nucleus.
6. A subtle horizontal star flare.
7. A smaller vertical flare.
8. Fine sparks and energy fragments around the orbital structure.
9. Clear depth separation between the nucleus, rings, and surrounding plasma.

The brightest point should sit toward the forward-right edge of the orbital
structure.

The orbital rings should be thin, elegant, partially transparent, and slightly
irregular. They must look like flowing energy, not solid metal rings.

Avoid:

- A solid planet
- A rocky sphere
- A thick circular portal
- A flat glowing disc
- A large opaque ball
- Mechanical machinery

## Tail design

The tail is the most important visual element. It should be dramatically longer
than the head and occupy most of the total composition.

Build it from several distinct depth layers.

### Primary plasma ribbon

- A soft, semi-transparent blue plasma volume
- Narrow where it connects to the head
- Broadest through the middle
- Gradually dissolving at the distant end
- Curving downward through the middle and upward toward the far-left end
- Irregular enough to feel organic
- Never shaped like a solid tube or cone

### Energy filaments

Include approximately 7–12 fine luminous strands:

- Some tightly follow the primary ribbon.
- Some arc above or below it.
- Some cross through the main ribbon.
- Some reconnect near the head.
- Vary their width, brightness, curvature, and depth.
- Use white, cyan, electric blue, and restrained violet.
- Keep them extremely thin and elegant.

### Particle field

Add many small particles and energy fragments:

- Dense around the head and middle tail
- Sparse at the distant end
- Mixed depths and sizes
- Mostly tiny blue and cyan points
- A few brighter white star-like accents
- Some faint square or geometric energy fragments are acceptable
- Avoid uniform particle spacing

### Volumetric wisps

Add transparent cloud-like energy around the ribbon:

- Soft and smoky without looking like ordinary smoke
- Layered at different depths
- Broken into irregular wisps
- Visible through additive blue light
- No hard outer boundary

The complete tail must remain visibly connected to the nucleus.

## Scroll motion reference

Create a separate motion-reference video showing how the website should animate
the comet.

### Movement

- Begin outside or partly outside the upper-left of the frame.
- Travel diagonally downward and toward the right.
- Follow a smooth curved trajectory, not a straight line.
- Dip gently through the middle of the frame.
- Rise slightly as the head reaches its final right-center position.
- Finish with the head near 78% width and 42% height.
- Rotate naturally so the head follows the trajectory.
- Keep the tail physically connected throughout the movement.
- The movement must feel guided and suspended, not like uncontrolled falling.
- Do not loop the entrance.
- Do not use sudden acceleration or an abrupt stop.
- Ease smoothly into the final composition.

### Final state

After arriving:

- Stop large-scale translation.
- Keep subtle internal energy movement.
- Allow a very small breathing or floating motion.
- Continue orbital-ring movement.
- Continue plasma pulses and particle flow.
- Do not replay the entrance.

The website will map this movement to scroll position. Scrolling backward should
naturally reverse the large-scale movement.

## Preferred production package

Create the following deliverables where supported.

### 1. Three-dimensional head asset

Format:

- glTF 2.0 binary
- Single `.glb` file
- Target file size below 10 MB
- Target fewer than 50,000 triangles
- Suitable for desktop and mobile WebGL

Coordinate system:

- Place the bright nucleus at world origin `(0, 0, 0)`.
- Point the comet forward along positive X.
- The procedural website tail will extend along negative X.
- Y is up.
- Apply or freeze all transforms before export.
- Use a consistent real-world scale.
- Do not bake website translation into the model.

Suggested named nodes:

- `CometCore`
- `CoreHalo`
- `OrbitRing_A`
- `OrbitRing_B`
- `OrbitRing_C`
- `ForwardFlare`
- `EnergyFragments`

Materials:

- Use emissive PBR or unlit-compatible materials.
- Use `alphaMode: BLEND` where transparency is needed.
- Avoid unsupported proprietary shaders.
- Avoid transmission, refraction, or expensive glass materials.
- Pack textures efficiently.
- Use 2K textures or smaller.
- Do not include an environment, background, camera, or lights.

### 2. Internal animation

If animation is supported, include an `idle_energy_loop` clip:

- Four-second seamless loop
- Slow orbital-ring movement
- Subtle halo breathing
- Small energy-fragment motion
- No world-space comet translation
- No large rotation
- No visible loop discontinuity

The website will control the model's position, rotation, and scroll progress
separately.

### 3. Motion-reference video

Provide:

- MP4 or WebM
- `1920×1080` or `3840×2160`
- 16:9 aspect ratio
- 30 or 60 FPS
- Approximately 6–8 seconds
- Clean black or transparent background
- No text or interface
- The complete arrival and final settled state
- A final-state hold of at least two seconds

The video is a motion reference. It should not be baked into the final website
unless it includes a clean alpha channel.

### 4. Transparent layered textures

If the tool cannot create a usable `.glb`, produce these transparent RGBA PNG
assets instead.

#### `aegis-comet-core.png`

- `1024×1024`
- Transparent background
- Nucleus, halo, orbital loops, and flares
- Glow contained inside the image boundaries
- No cropped flare

#### `aegis-comet-tail-density.png`

- `4096×1024`
- Transparent background
- Horizontal orientation
- Tail extending from the left toward a connection point at the right edge
- Plasma volume only, with no nucleus
- Narrow near both endpoints and widest through the middle
- Preserve the S-curved silhouette

#### `aegis-comet-filaments.png`

- `4096×1024`
- Transparent background
- Fine orbital and tail filaments only
- No broad plasma cloud or nucleus
- Separate white, cyan, blue, and violet energy lines

#### `aegis-comet-particles.png`

- `4096×1024`
- Transparent background
- Particles and energy fragments only
- No continuous ribbon
- No baked black background

Use straight alpha with clean transparent pixels. Do not leave dark or white
matte edges.

## Reference frames

Also provide:

1. `arrival-start.png`: comet partly outside the upper-left.
2. `arrival-midpoint.png`: comet descending diagonally through the scene.
3. `arrival-final.png`: head near 78% width and 42% height, with the tail
   extending toward the upper-left.
4. `head-closeup.png`: detailed view of the nucleus and orbital loops.
5. `asset-turntable.mp4`: slow turntable of the 3D head when a `.glb` is
   supplied.

## Background and transparency

The production asset must be isolated.

Do not include:

- Black background
- Stars unrelated to the comet
- Planet or planetary horizon
- Website text
- Aegis logo
- Buttons
- Financial charts
- Candlestick charts
- Interface elements
- Borders
- Frames
- Watermarks
- Artist signature

A temporary dark background may be used only in preview renders. Production
PNGs must retain transparency.

## Technical quality

Ensure that:

- Transparent edges are clean.
- Bloom does not create a rectangular boundary.
- No visible texture seams exist.
- No flare is cropped.
- The head-to-tail connection is continuous.
- Orbital loops have convincing front/back depth.
- The silhouette remains readable at mobile size.
- The model renders correctly without proprietary plugins.
- Animation loops are seamless.
- Materials remain visible against a nearly black background.
- The result is optimized for real-time browser rendering.

## Negative prompt

Do not create:

- A rocky meteor
- A burning asteroid
- Orange flames
- Red fire
- Yellow smoke
- A spaceship
- A rocket
- An engine exhaust plume
- A solid blue tube
- A thick laser beam
- A portal
- A galaxy disc
- A magical wand effect
- Cartoon art
- Anime styling
- Low-resolution particles
- Heavy fog covering the nucleus
- A large opaque spherical head
- A flat two-dimensional sticker
- Text, logos, watermarks, or interface elements

## Priority order

If every requested output cannot be produced, prioritize:

1. Accurate final silhouette and proportions
2. High-quality transparent comet head
3. Usable optimized `.glb`
4. Motion-reference video
5. Tail-density and filament PNG layers
6. Turntable and additional reference frames

The final result should closely match the attached reference image's luminous,
elegant, flowing energy while remaining suitable for a scroll-directed,
real-time WebGL website.
