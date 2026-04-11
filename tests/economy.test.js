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

Deno.test('roads can be placed under buildings and buildings can be placed on roads', () => {
  const world = new World({ seed: 42, store: 'map' });
  const stateId = world.create();
  world.add(stateId, Camera);
  world.add(stateId, BuildMode);
  world.add(stateId, World3State, { money: 10000 });

  let callCount = 0;
  const controls = {
    consumePlacementRequests() {
      callCount += 1;
      if (callCount === 1) return [{ screenX: 32, kind: 'house' }];
      if (callCount === 2) return [{ screenX: 32, kind: 'road' }];
      if (callCount === 3) return [{ screenX: 96, kind: 'road' }];
      if (callCount === 4) return [{ screenX: 96, kind: 'factory' }];
      return [];
    },
  };

  const placement = createPlacementSystem(controls);
  placement(world);
  placement(world);
  placement(world);
  placement(world);

  const buildings = [...world.query(Building)];
  const byKind = buildings.reduce((acc, entry) => {
    acc[entry[1].kind] = (acc[entry[1].kind] || 0) + 1;
    return acc;
  }, {});

  assert(byKind.house === 1, `expected one house, got ${byKind.house || 0}`);
  assert(byKind.factory === 1, `expected one factory, got ${byKind.factory || 0}`);
  assert(byKind.road === 2, `expected two roads, got ${byKind.road || 0}`);

  const model = world.get(stateId, World3State);
  const expectedMoney = 10000
    - BUILDING_DEFS.house.cost
    - BUILDING_DEFS.road.cost
    - BUILDING_DEFS.road.cost
    - BUILDING_DEFS.factory.cost;
  assert(model.money === expectedMoney, `expected treasury ${expectedMoney}, got ${model.money}`);
});

Deno.test('bulldoze removes lots and refunds part of the build cost', () => {
  const world = new World({ seed: 42, store: 'map' });
  const stateId = world.create();
  world.add(stateId, Camera);
  world.add(stateId, BuildMode);
  world.add(stateId, World3State, { money: 5000 });

  const roadId = world.create();
  world.add(roadId, Building, { kind: 'road', x: 64 });

  let issued = false;
  const controls = {
    consumePlacementRequests() {
      if (issued) return [];
      issued = true;
      return [{ screenX: 96, kind: 'bulldoze' }];
    },
  };

  createPlacementSystem(controls)(world);

  const buildings = [...world.query(Building)];
  assert(buildings.length === 0, `expected road to be removed, got ${buildings.length} buildings`);

  const model = world.get(stateId, World3State);
  const expectedMoney = 5000 + Math.round(BUILDING_DEFS.road.cost * BUILDING_DEFS.road.refundRate);
  assert(model.money === expectedMoney, `expected treasury ${expectedMoney}, got ${model.money}`);
  assert(model.lastActionText.includes('Road demolished'), `expected demolition message, got ${model.lastActionText}`);
});

Deno.test('world3System tracks roads, traffic, and history while collecting taxes', () => {
  const world = new World({ seed: 42, store: 'map' });
  const stateId = world.create();
  world.add(stateId, World3State, {
    money: 10000,
    population: 120,
  });

  const lots = [
    { kind: 'house', x: 0 },
    { kind: 'road', x: 0 },
    { kind: 'road', x: 64 },
    { kind: 'farm', x: 128 },
    { kind: 'road', x: 128 },
    { kind: 'road', x: 192 },
    { kind: 'factory', x: 256 },
    { kind: 'road', x: 256 },
    { kind: 'road', x: 320 },
    { kind: 'commercial', x: 384 },
    { kind: 'road', x: 384 },
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
  assert(model.factories === 1 && model.farms === 1 && model.houses === 1 && model.commercials === 1 && model.roads === 7, 'expected building counts to be tracked');
  assert(model.connectedHouses === 1 && model.connectedFarms === 1 && model.connectedFactories === 1 && model.connectedCommercials === 1, 'expected all starter lots to have road access');
  assert(model.commuterTraffic > 0 && model.freightTraffic > 0 && model.serviceTraffic > 0, 'expected all traffic classes to register');
  assert(model.foodDelivered > 0 && model.goodsDelivered > 0 && model.servicesDelivered > 0, 'expected legitimate delivered flows between connected buildings');
  assert(model.goodsDelivered <= model.goodsDemand, 'expected goods delivery bounded by demand');
  assert(model.servicesDelivered <= model.servicesDemand, 'expected services delivery bounded by demand');
  assert(Array.isArray(model.history) && model.history.length === 1, 'expected simulation history sample');
});

Deno.test('commercial civic and logistics buildings change services quality and throughput', () => {
  function buildWorld(includeAdvancedBuildings) {
    const world = new World({ seed: 42, store: 'map' });
    const stateId = world.create();
    world.add(stateId, World3State, {
      money: 10000,
      population: 240,
    });

    const lots = [
      { kind: 'house', x: 0 },
      { kind: 'road', x: 0 },
      { kind: 'road', x: 64 },
      { kind: 'house', x: 128 },
      { kind: 'road', x: 128 },
      { kind: 'road', x: 192 },
      { kind: 'farm', x: 256 },
      { kind: 'road', x: 256 },
      { kind: 'road', x: 320 },
      { kind: 'factory', x: 384 },
      { kind: 'road', x: 384 },
    ];

    if (includeAdvancedBuildings) {
      lots.push(
        { kind: 'road', x: 448 },
        { kind: 'commercial', x: 512 },
        { kind: 'road', x: 512 },
        { kind: 'road', x: 576 },
        { kind: 'civic', x: 640 },
        { kind: 'road', x: 640 },
        { kind: 'road', x: 704 },
        { kind: 'logistics', x: 768 },
        { kind: 'road', x: 768 },
      );
    }

    lots.forEach(({ kind, x }) => {
      const id = world.create();
      world.add(id, Building, { kind, x });
    });

    world3System(world, 1);
    return world.get(stateId, World3State);
  }

  const baseModel = buildWorld(false);
  const advancedModel = buildWorld(true);

  assert(advancedModel.commercials === 1 && advancedModel.civics === 1 && advancedModel.logistics === 1, 'expected advanced building counts');
  assert(advancedModel.servicesDelivered > baseModel.servicesDelivered, 'expected commercial buildings to increase delivered services');
  assert(advancedModel.qualityOfLife > baseModel.qualityOfLife, 'expected civic buildings to improve quality of life');
  assert(advancedModel.logisticsEffect > 1, 'expected logistics building to increase throughput');
  assert(advancedModel.trafficLoad < baseModel.trafficLoad, 'expected logistics building to reduce traffic load pressure');
});

Deno.test('world3System keeps full graph history instead of trimming old samples', () => {
  const world = new World({ seed: 42, store: 'map' });
  const stateId = world.create();
  world.add(stateId, World3State, {
    money: 10000,
    population: 120,
    historySampleTimer: 0,
  });

  [
    { kind: 'house', x: 0 },
    { kind: 'road', x: 0 },
    { kind: 'road', x: 64 },
    { kind: 'farm', x: 128 },
    { kind: 'road', x: 128 },
    { kind: 'road', x: 192 },
    { kind: 'factory', x: 256 },
    { kind: 'road', x: 256 },
  ].forEach(({ kind, x }) => {
    const id = world.create();
    world.add(id, Building, { kind, x });
  });

  for (let index = 0; index < 220; index += 1) {
    world3System(world, 0.2);
  }

  const model = world.get(stateId, World3State);
  assert(Array.isArray(model.history), 'expected history array');
  assert(model.history.length === 220, `expected full history of 220 samples, got ${model.history.length}`);
});