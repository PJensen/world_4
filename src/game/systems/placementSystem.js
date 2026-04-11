import { BUILDING_DEFS, BuildMode, Building, Camera, World3State } from '../components.js';

function tileSnap(value, tileSize) {
  return Math.floor(value / tileSize) * tileSize;
}

function setWorldMessage(world, id, model, lastActionText) {
  const nextModel = {
    ...model,
    lastActionText,
    lastActionTimer: 3.5,
  };
  world.set(id, World3State, nextModel);
  return nextModel;
}

export function createPlacementSystem(controls) {
  return function placementSystem(world) {
    const requests = controls.consumePlacementRequests();
    if (!requests.length) return;

    const cameraRef = world.query(Camera);
    const modeRef = world.query(BuildMode);
    const cameraTuple = cameraRef[Symbol.iterator]().next().value;
    const modeTuple = modeRef[Symbol.iterator]().next().value;
    const stateTuple = world.query(World3State)[Symbol.iterator]().next().value;
    if (!cameraTuple || !modeTuple || !stateTuple) return;

    const camera = cameraTuple[1];
    const mode = modeTuple[1];
    const stateId = stateTuple[0];
    let model = stateTuple[1];
    const occupied = new Set();
    for (const [id, building] of world.query(Building)) occupied.add(building.x);

    for (const request of requests) {
      const worldX = camera.x + request.screenX;
      const snappedX = tileSnap(worldX, mode.tileSize);
      if (occupied.has(snappedX)) {
        model = setWorldMessage(world, stateId, model, 'That lot is already occupied.');
        continue;
      }

      const rule = BUILDING_DEFS[request.kind] || BUILDING_DEFS.house;
      if (model.money < rule.cost) {
        model = setWorldMessage(world, stateId, model, `Need $${rule.cost.toLocaleString()} for a ${rule.label.toLowerCase()}.`);
        continue;
      }

      const e = world.create();
      world.add(e, Building, { kind: request.kind, x: snappedX });
      occupied.add(snappedX);
      model = {
        ...model,
        money: model.money - rule.cost,
        lastActionText: `${rule.label} placed for $${rule.cost.toLocaleString()}.`,
        lastActionTimer: 3.5,
      };
      world.set(stateId, World3State, model);
    }
  };
}
