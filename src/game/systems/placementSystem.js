import { BUILDING_DEFS, BuildMode, Building, Camera, UNDERLAY_KINDS, World3State } from '../components.js';

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

function createLot(x) {
  return {
    x,
    road: null,
    pipe: null,
    powerline: null,
    structure: null,
  };
}

function getBulldozeTarget(lot) {
  if (lot.structure) return lot.structure;
  if (lot.road) return lot.road;
  if (lot.pipe) return lot.pipe;
  if (lot.powerline) return lot.powerline;
  return null;
}

function isLotEmpty(lot) {
  return !lot.structure && !lot.road && !lot.pipe && !lot.powerline;
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
      const lot = occupied.get(building.x) || createLot(building.x);
      if (UNDERLAY_KINDS.includes(building.kind)) lot[building.kind] = { id, building };
      else lot.structure = { id, building };
      occupied.set(building.x, lot);
    }

    for (const request of requests) {
      const worldX = camera.x + request.screenX;
      const snappedX = tileSnap(worldX, mode.tileSize);
      const lot = occupied.get(snappedX) || createLot(snappedX);

      if (request.kind === 'bulldoze') {
        const target = getBulldozeTarget(lot);
        if (!target) {
          model = setWorldMessage(world, stateId, model, 'Nothing to bulldoze on that lot.');
          continue;
        }

        world.destroy(target.id);
        if (lot.structure && lot.structure.id === target.id) lot.structure = null;
        else if (lot.road && lot.road.id === target.id) lot.road = null;
        else if (lot.pipe && lot.pipe.id === target.id) lot.pipe = null;
        else if (lot.powerline && lot.powerline.id === target.id) lot.powerline = null;
        if (isLotEmpty(lot)) occupied.delete(snappedX);
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

      if (UNDERLAY_KINDS.includes(request.kind)) {
        if (lot[request.kind]) {
          model = setWorldMessage(world, stateId, model, `That lot already has a ${BUILDING_DEFS[request.kind].label.toLowerCase()}.`);
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
  if (UNDERLAY_KINDS.includes(request.kind)) lot[request.kind] = { id: e, building: { kind: request.kind, x: snappedX } };
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
