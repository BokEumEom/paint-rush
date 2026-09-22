# PAINT RUSH — Reference Match V2

A browser FPS prototype recreated from the supplied gameplay video. This V2 uses the extracted frame library as the visual implementation reference rather than only reproducing the mechanics.

## Stack

- React 19.2
- TypeScript
- Three.js / React Three Fiber 9.7
- Drei 10.7
- Rapier 2.2
- Zustand 5
- Vite 8

## Run

```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`).

## Controls

- WASD — move
- Mouse — look
- Shift — dash
- Space — jump / grapple launch
- Q / E — grapple
- Left click — paint gun
- Right click — katana
- Esc — release mouse / pause

## Reference-match improvements

V2 specifically matches the supplied video more closely:

- paper/marker art direction with black outlines
- cream doodle walls + perspective floor grid
- tall colored pillars, low rectangular cover and floating platforms
- left-hand white katana / right-hand colorful paint gun
- round cartoon-face enemies instead of generic humanoid spheres
- irregular persistent paint splats and large screen-hit paint blobs
- faster FOV response for dash/grapple launches
- reference-position HUD and crosshair
- 3-card `PICK A PERK` paper UI
- ruled-paper `PAUSED` UI

See `reference/IMPLEMENTATION_MAP.md` for the implementation mapping. The extracted JPG frame library used during development is intentionally not committed because it is analysis/reference material and not required at runtime.

## Build

```bash
npm run build
```

If npm reports an old dependency tree from the first prototype, delete both `node_modules` and `package-lock.json` before installing this version.
