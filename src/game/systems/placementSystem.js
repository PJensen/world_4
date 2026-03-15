import { BuildMode, Building, Camera } from '../components.js';

function tileSnap(value, tileSize) {
  return Math.floor(value / tileSize) * tileSize;
}

export function createPlacementSystem(controls) {
  return function placementSystem(world) {
    const requests = controls.consumePlacementRequests();
    if (!requests.length) return;

    const cameraRef = world.query(Camera);
    const modeRef = world.query(BuildMode);
    const cameraTuple = cameraRef[Symbol.iterator]().next().value;
    const modeTuple = modeRef[Symbol.iterator]().next().value;
    if (!cameraTuple || !modeTuple) return;

    const camera = cameraTuple[1];
    const mode = modeTuple[1];
    const occupied = new Set();
    for (const [id, building] of world.query(Building)) occupied.add(building.x);

    for (const request of requests) {
      const worldX = camera.x + request.screenX;
      const snappedX = tileSnap(worldX, mode.tileSize);
      if (occupied.has(snappedX)) continue;
      const e = world.create();
      world.add(e, Building, { kind: request.kind, x: snappedX });
      occupied.add(snappedX);
    }
  };
}
