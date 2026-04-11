import { World } from '../src/lib/ecs-js/index.js';
import { BUILDING_DEFS, BuildMode, Building, Camera, World3State } from '../src/game/components.js';
import { createPlacementSystem } from '../src/game/systems/placementSystem.js';
import { world3System } from '../src/game/systems/world3System.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

Deno.test('placement charges treasury and blocks unaffordable builds', () => {
  const world = new World({ seed: 42, store: 'map' });
  const stateId = world.create();
  world.add(stateId, Camera);
  world.add(stateId, BuildMode);
  world.add(stateId, World3State, { money: 2000 });

  const controls = {
    consumePlacementRequests() {
      return [
        { screenX: 32, kind: 'house' },
        { screenX: 96, kind: 'factory' },
      ];
    },
  };

  createPlacementSystem(controls)(world);

  const buildings = [...world.query(Building)];
  assert(buildings.length === 1, `expected 1 building, got ${buildings.length}`);
  assert(buildings[0][1].kind === 'house', `expected placed building to be house, got ${buildings[0][1].kind}`);

  const model = world.get(stateId, World3State);
  assert(model.money === 2000 - BUILDING_DEFS.house.cost, `expected treasury to drop to $500, got ${model.money}`);
  assert(model.lastActionText.includes('Need $4,000'), `expected affordability message, got ${model.lastActionText}`);
});

Deno.test('world3System collects taxes and preserves farm-driven food output', () => {
  const world = new World({ seed: 42, store: 'map' });
  const stateId = world.create();
  world.add(stateId, World3State, {
    money: 10000,
    population: 120,
  });

  const lots = [
    { kind: 'house', x: 0 },
    { kind: 'farm', x: 64 },
    { kind: 'factory', x: 128 },
  ];
  lots.forEach(({ kind, x }) => {
    const id = world.create();
    world.add(id, Building, { kind, x });
  });

  world3System(world, 1);

  const model = world.get(stateId, World3State);
  assert(model.money > 10000, `expected taxes to increase treasury, got ${model.money}`);
  assert(model.taxRevenueAnnual > model.serviceCostsAnnual, 'expected positive tax base for starter town');
  assert(model.foodOutput > model.foodDemand, `expected farms to overproduce food, got ${model.foodOutput} vs ${model.foodDemand}`);
  assert(model.factories === 1 && model.farms === 1 && model.houses === 1, 'expected building counts to be tracked');
});