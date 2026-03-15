# world_4

Side-scrolling placement simulator built with the `ecs-js` submodule.

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

## Live overlay

- World3-inspired metrics panel (population, resources, pollution, food/capita, QoL)
- Driven in real-time by placed buildings and simulated each tick

## Next extension points

- Add build costs and production chains (farm food, factory goods, house workers).
- Add bulldoze mode and road placement.
- Add save/load snapshots for city layouts.