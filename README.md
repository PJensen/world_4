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
- `4`: select road
- `X` or `Delete`: bulldoze tool
- `Tab` or `G`: toggle live/stats overlay tab
- Left click: place selected tool on snapped grid
- Mobile: drag to pan, tap top bar tools to select, tap the right-side tab button to switch overlays, tap world to place or bulldoze

## Economy loop

- You start with `$10,000` in the treasury.
- Every placement costs money: house `$1,500`, farm `$1,200`, factory `$4,000`, road `$300`.
- Roads can be placed under buildings, so a finished lot can contain both a road and a structure.
- Bulldozing refunds part of the original lot cost.
- Houses provide housing capacity and taxpayers.
- Farms feed the city, which improves survival and growth.
- Factories drive industrial output and the strongest tax intake, but add pollution.
- Road-connected lots exchange labor, food, goods, and services through contiguous road networks.
- Taxes and service costs are collected continuously, so the treasury rises or falls while the sim runs.

## Traffic and stats

- Three traffic classes are simulated: commuter, freight, and service.
- Traffic is visualized directly on roads as moving vehicle pips.
- The graph tab is the primary overlay and sits below the building selector instead of covering it.
- The overlay has two tabs: a graph-first flow view and a smaller live city readout.
- The graph tracks delivered food, goods, services, treasury, net revenue, pollution, and each traffic class.

## Live overlay

- World3-inspired metrics panel (treasury, tax flow, services, population, food, pollution, QoL)
- Driven in real-time by placed buildings and simulated each tick

## Next extension points

- Add zoning rules or adjacency bonuses so road placement becomes more than basic access.
- Add intersections, one-way segments, and heavier freight congestion rules.
- Add bulldoze mode and road placement.
- Add save/load snapshots for city layouts.
