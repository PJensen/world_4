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
    const occupied = new Map();
    for (const [id, building] of world.query(Building)) {
      const lot = occupied.get(building.x) || { road: null, structure: null };
      if (building.kind === 'road') lot.road = { id, building };
      else lot.structure = { id, building };
      occupied.set(building.x, lot);
    }

    for (const request of requests) {
      const worldX = camera.x + request.screenX;
      const snappedX = tileSnap(worldX, mode.tileSize);
      const lot = occupied.get(snappedX) || { road: null, structure: null };

      if (request.kind === 'bulldoze') {
        const target = lot.structure || lot.road;
        if (!target) {
          model = setWorldMessage(world, stateId, model, 'Nothing to bulldoze on that lot.');
          continue;
        }

        world.destroy(target.id);
        if (lot.structure && lot.structure.id === target.id) lot.structure = null;
        else if (lot.road && lot.road.id === target.id) lot.road = null;
        if (!lot.structure && !lot.road) occupied.delete(snappedX);
        else occupied.set(snappedX, lot);

        const rule = BUILDING_DEFS[target.building.kind];
        const refund = rule ? Math.round(rule.cost * rule.refundRate) : 0;
        model = {
          ...model,
          money: model.money + refund,
          lastActionText: refund > 0
            ? `${rule.label} demolished. Recovered $${refund.toLocaleString()}.`
            : 'Lot cleared.',
          lastActionTimer: 3.5,
        };
        world.set(stateId, World3State, model);
        continue;
      }

      if (request.kind === 'road') {
        if (lot.road) {
          model = setWorldMessage(world, stateId, model, 'That lot already has a road.');
          continue;
        }
      } else if (lot.structure) {
        model = setWorldMessage(world, stateId, model, 'That lot already has a building.');
        continue;
      }

      const rule = BUILDING_DEFS[request.kind] || BUILDING_DEFS.house;
      if (model.money < rule.cost) {
        model = setWorldMessage(world, stateId, model, `Need $${rule.cost.toLocaleString()} for a ${rule.label.toLowerCase()}.`);
        continue;
      }

      const e = world.create();
      world.add(e, Building, { kind: request.kind, x: snappedX });
      if (request.kind === 'road') lot.road = { id: e, building: { kind: request.kind, x: snappedX } };
      else lot.structure = { id: e, building: { kind: request.kind, x: snappedX } };
      occupied.set(snappedX, lot);
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
