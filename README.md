# world_4

Side-scrolling placement simulator built with the `ecs-js` submodule.

[Play Now](https://pjensen.github.io/world_4/src)

## Run locally

From the repo root:

```bash
python3 -m http.server 5173
```

Then open:

- http://localhost:5173/src/index.html

## Included starter

- `src/game.js`: Thin bootstrap entrypoint loaded by `index.html`.
- `src/game/`: Modular game code (`components`, `input`, `systems`, `world`).
- `src/index.html`: Canvas + HUD shell that loads the starter module.
- `src/assets/factory.svg`: Visual backdrop reference used in-scene.
- `src/lib/ecs-js`: Git submodule used directly via ESM imports (no bundler required).

## Controls

- `A/D` or `←/→`: scroll camera
- `1`: select house
- `2`: select farm
- `3`: select factory
- Left click: place selected building on snapped grid
- Mobile: drag to pan, tap top bar thirds to select (house/farm/factory), tap world to place

## Economy loop

- You start with `$10,000` in the treasury.
- Every placement costs money: house `$1,500`, farm `$1,200`, factory `$4,000`.
- Houses provide housing capacity and taxpayers.
- Farms feed the city, which improves survival and growth.
- Factories drive industrial output and the strongest tax intake, but add pollution.
- Taxes and service costs are collected continuously, so the treasury rises or falls while the sim runs.

## Live overlay

- World3-inspired metrics panel (treasury, tax flow, services, population, food, pollution, QoL)
- Driven in real-time by placed buildings and simulated each tick

## Next extension points

- Add roads and traffic types (commuter, freight, service).
- Add a stats tab with multi-series line graphs for treasury, population, food, pollution, and utilization.
- Add bulldoze mode and road placement.
- Add save/load snapshots for city layouts.
