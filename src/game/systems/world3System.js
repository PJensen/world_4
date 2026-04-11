import { BUILDING_DEFS, Building, World3State } from '../components.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const TILE_SIZE = 64;
const STRUCTURE_BUCKET_BY_KIND = Object.freeze({
  house: 'houses',
  farm: 'farms',
  factory: 'factories',
  commercial: 'commercials',
  civic: 'civics',
  logistics: 'logistics',
  plumbing: 'plumbings',
  power: 'powerPlants',
});
const STRUCTURE_KINDS = Object.freeze(Object.keys(STRUCTURE_BUCKET_BY_KIND));
const STRUCTURE_BUCKETS = Object.freeze(Object.values(STRUCTURE_BUCKET_BY_KIND));

function appendHistory(history, sample) {
  return history.concat(sample);
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

function buildLots(buildings) {
  const lots = new Map();
  for (const entry of buildings) {
    const lot = lots.get(entry.building.x) || createLot(entry.building.x);
    if (entry.building.kind === 'road') lot.road = entry;
    else if (entry.building.kind === 'pipe') lot.pipe = entry;
    else if (entry.building.kind === 'powerline') lot.powerline = entry;
    else lot.structure = entry;
    lots.set(entry.building.x, lot);
  }
  return lots;
}

function createComponent(x, lineKey) {
  const component = {
    minX: x,
    maxX: x,
    lineXs: [],
    lineKey,
  };
  for (const bucket of STRUCTURE_BUCKETS) component[bucket] = [];
  return component;
}

function buildNetworkComponents(lots, lineKey) {
  const linePositions = [...lots.values()]
    .filter((lot) => lot[lineKey])
    .map((lot) => lot.x)
    .sort((left, right) => left - right);
  const componentByX = new Map();
  const components = [];

  let current = null;
  for (const x of linePositions) {
    if (!current || x - current.maxX > TILE_SIZE) {
      current = createComponent(x, lineKey);
      components.push(current);
    }
    current.maxX = x;
    current.lineXs.push(x);
    componentByX.set(x, current);
  }

  for (const lot of lots.values()) {
    if (!lot.structure || !lot[lineKey]) continue;
    const component = componentByX.get(lot.x);
    if (!component) continue;
    const bucket = STRUCTURE_BUCKET_BY_KIND[lot.structure.building.kind];
    if (bucket) component[bucket].push(lot);
  }

  return components;
}

function countConnectedByKind(components) {
  const connected = {
    house: 0,
    farm: 0,
    factory: 0,
    commercial: 0,
    civic: 0,
    logistics: 0,
    plumbing: 0,
    power: 0,
  };
  for (const component of components) {
    connected.house += component.houses.length;
    connected.farm += component.farms.length;
    connected.factory += component.factories.length;
    connected.commercial += component.commercials.length;
    connected.civic += component.civics.length;
    connected.logistics += component.logistics.length;
    connected.plumbing += component.plumbings.length;
    connected.power += component.powerPlants.length;
  }
  return connected;
}

function createConsumer(lot, destKind, amount) {
  return {
    lot,
    x: lot.x,
    destKind,
    amount,
    remaining: amount,
    received: 0,
  };
}

function allocateFlows(suppliers, consumers, category, trips, strategy = 'nearest') {
  let deliveredTotal = 0;

  for (const supplier of suppliers) {
    let remainingSupply = supplier.remaining;
    if (remainingSupply <= 0) continue;

    const targets = consumers.filter((consumer) => consumer.remaining > 0);

    if (strategy === 'weighted') {
      while (remainingSupply > 1e-6) {
        const activeTargets = targets.filter((consumer) => consumer.remaining > 1e-6);
        if (!activeTargets.length) break;

        const weights = activeTargets.map((consumer) => {
          const distance = Math.abs(consumer.x - supplier.x) / TILE_SIZE;
          return consumer.remaining / (1 + distance);
        });
        const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
        if (weightTotal <= 0) break;

        let deliveredThisPass = 0;
        activeTargets.forEach((consumer, index) => {
          if (remainingSupply <= 1e-6) return;
          const requested = remainingSupply * (weights[index] / weightTotal);
          const delivered = Math.min(requested, consumer.remaining, remainingSupply);
          if (delivered <= 1e-6) return;

          remainingSupply -= delivered;
          supplier.remaining -= delivered;
          consumer.remaining -= delivered;
          consumer.received += delivered;
          deliveredTotal += delivered;
          deliveredThisPass += delivered;
          trips.push({
            category,
            originKind: supplier.originKind,
            destKind: consumer.destKind,
            fromX: supplier.x,
            toX: consumer.x,
            amount: delivered,
          });
        });

        if (deliveredThisPass <= 1e-6) break;
      }
      continue;
    }

    targets.sort((left, right) => {
      const distanceDelta = Math.abs(left.x - supplier.x) - Math.abs(right.x - supplier.x);
      if (distanceDelta !== 0) return distanceDelta;
      return left.x - right.x;
    });

    for (const consumer of targets) {
      if (remainingSupply <= 0) break;
      const delivered = Math.min(remainingSupply, consumer.remaining);
      if (delivered <= 0) continue;

      remainingSupply -= delivered;
      supplier.remaining -= delivered;
      consumer.remaining -= delivered;
      consumer.received += delivered;
      deliveredTotal += delivered;
      trips.push({
        category,
        originKind: supplier.originKind,
        destKind: consumer.destKind,
        fromX: supplier.x,
        toX: consumer.x,
        amount: delivered,
      });
    }
  }

  return deliveredTotal;
}

function collapseTrips(trips) {
  const tripMap = new Map();
  for (const trip of trips) {
    if (trip.amount <= 1e-4) continue;
    const key = [trip.category, trip.originKind, trip.destKind, trip.fromX, trip.toX].join(':');
    const existing = tripMap.get(key);
    if (existing) existing.amount += trip.amount;
    else tripMap.set(key, { ...trip });
  }
  return [...tripMap.values()];
}

function buildFulfillmentMap(consumers) {
  const map = new Map();
  for (const consumer of consumers) {
    map.set(consumer.x, consumer.amount > 0 ? consumer.received / consumer.amount : 1);
  }
  return map;
}

function getScale(map, lot, fallback = 0) {
  return clamp(map.get(lot.x) ?? fallback, 0, 1.2);
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function demandFor(kind, table) {
  return table[kind] || 0;
}

export function world3System(world, dt) {
  const counts = {
    house: 0,
    farm: 0,
    factory: 0,
    commercial: 0,
    civic: 0,
    logistics: 0,
    plumbing: 0,
    power: 0,
    road: 0,
    pipe: 0,
    powerline: 0,
  };
  const buildings = [];
  for (const [id, building] of world.query(Building)) {
    buildings.push({ id, building });
    counts[building.kind] = (counts[building.kind] || 0) + 1;
  }

  const lots = buildLots(buildings);
  const roadComponents = buildNetworkComponents(lots, 'road');
  const pipeComponents = buildNetworkComponents(lots, 'pipe');
  const powerComponents = buildNetworkComponents(lots, 'powerline');

  const houses = counts.house;
  const farms = counts.farm;
  const factories = counts.factory;
  const commercials = counts.commercial;
  const civics = counts.civic;
  const logistics = counts.logistics;
  const plumbings = counts.plumbing;
  const powerPlants = counts.power;
  const roads = counts.road;
  const pipes = counts.pipe;
  const powerLines = counts.powerline;

  const connectedRoad = countConnectedByKind(roadComponents);
  const connectedPipe = countConnectedByKind(pipeComponents);
  const connectedPower = countConnectedByKind(powerComponents);

  const totalStructures = houses + farms + factories + commercials + civics + logistics + plumbings + powerPlants;
  const totalRoadConnected = connectedRoad.house + connectedRoad.farm + connectedRoad.factory + connectedRoad.commercial + connectedRoad.civic + connectedRoad.logistics + connectedRoad.plumbing + connectedRoad.power;
  const totalPipeConnected = connectedPipe.house + connectedPipe.farm + connectedPipe.factory + connectedPipe.commercial + connectedPipe.civic + connectedPipe.logistics + connectedPipe.plumbing + connectedPipe.power;
  const totalPowerConnected = connectedPower.house + connectedPower.farm + connectedPower.factory + connectedPower.commercial + connectedPower.civic + connectedPower.logistics + connectedPower.plumbing + connectedPower.power;

  const roadCoverage = totalStructures > 0 ? totalRoadConnected / totalStructures : 0;
  const pipeCoverage = totalStructures > 0 ? totalPipeConnected / totalStructures : 0;
  const powerCoverage = totalStructures > 0 ? totalPowerConnected / totalStructures : 0;

  const houseAccessRatio = houses > 0 ? connectedRoad.house / houses : 1;
  const farmAccessRatio = farms > 0 ? connectedRoad.farm / farms : 1;
  const factoryAccessRatio = factories > 0 ? connectedRoad.factory / factories : 1;
  const commercialAccessRatio = commercials > 0 ? connectedRoad.commercial / commercials : 1;

  const dtYears = dt * 0.65;
  const MIN_POPULATION = 24;
  const LABOR_SHARE = 0.44;
  const WORKERS_PER_FACTORY = 90;
  const COMMERCIAL_LABOR_PER_BUILDING = 55;
  const CIVIC_LABOR_PER_BUILDING = 26;
  const LOGISTICS_LABOR_PER_BUILDING = 38;
  const PLUMBING_LABOR_PER_BUILDING = 24;
  const POWER_LABOR_PER_BUILDING = 32;
  const FOOD_PER_FARM = 220;
  const GOODS_PER_FACTORY = 180;
  const SERVICES_PER_COMMERCIAL = 170;
  const SERVICES_PER_CIVIC = 90;
  const POWER_SUPPLY_PER_PLANT = 520;
  const WATER_SUPPLY_PER_PUMP = 260;
  const SEWER_SUPPLY_PER_PUMP = 240;
  const CIVIC_QOL_PER_BUILDING = 0.06;
  const LOGISTICS_THROUGHPUT_PER_BUILDING = 0.22;
  const POWER_DEMAND = Object.freeze({
    house: 18,
    farm: 12,
    factory: 52,
    commercial: 28,
    civic: 24,
    logistics: 20,
    plumbing: 18,
    power: 8,
  });
  const WATER_DEMAND = Object.freeze({
    house: 16,
    farm: 12,
    factory: 10,
    commercial: 8,
    civic: 8,
    logistics: 4,
    plumbing: 6,
    power: 6,
  });
  const SEWER_DEMAND = Object.freeze({
    house: 14,
    farm: 4,
    factory: 10,
    commercial: 8,
    civic: 8,
    logistics: 5,
    plumbing: 0,
    power: 2,
  });
  const GOODS_DEMAND = Object.freeze({
    house: 18,
    farm: 10,
    factory: 8,
    commercial: 36,
    civic: 10,
    logistics: 14,
    plumbing: 8,
    power: 10,
  });
  const SERVICE_DEMAND = Object.freeze({
    house: 15,
    farm: 8,
    factory: 14,
    commercial: 10,
    civic: 12,
    logistics: 8,
    plumbing: 6,
    power: 6,
  });

  for (const [id, model] of world.query(World3State)) {
    const resources = clamp(model.resources, 0, 1);
    const pollution = Math.max(0, model.pollution);
    const simTime = (model.simTime || 0) + dt;
    const populationBase = Math.max(MIN_POPULATION, model.population);
    const housingCapacity = Math.max(0, houses * 180);
    const laborSupply = populationBase * LABOR_SHARE * clamp(0.35 + houseAccessRatio * 0.65, 0.2, 1);
    const housingPressure = housingCapacity > 0 ? clamp(populationBase / housingCapacity, 0, 1.4) : 1.4;
    const connectedHouseTotal = Math.max(1, connectedRoad.house);

    const currentTrips = [];
    const laborScaleByX = new Map();
    let laborDelivered = 0;

    for (const component of roadComponents) {
      const componentHouses = component.houses.length;
      const componentPopulation = populationBase * (componentHouses / connectedHouseTotal);
      const laborSuppliers = component.houses.map((lot) => ({
        x: lot.x,
        originKind: 'house',
        amount: (componentHouses > 0 ? componentPopulation / componentHouses : 0) * LABOR_SHARE,
        remaining: (componentHouses > 0 ? componentPopulation / componentHouses : 0) * LABOR_SHARE,
      }));
      const laborConsumers = [
        ...component.factories.map((lot) => createConsumer(lot, 'factory', WORKERS_PER_FACTORY)),
        ...component.commercials.map((lot) => createConsumer(lot, 'commercial', COMMERCIAL_LABOR_PER_BUILDING)),
        ...component.civics.map((lot) => createConsumer(lot, 'civic', CIVIC_LABOR_PER_BUILDING)),
        ...component.logistics.map((lot) => createConsumer(lot, 'logistics', LOGISTICS_LABOR_PER_BUILDING)),
        ...component.plumbings.map((lot) => createConsumer(lot, 'plumbing', PLUMBING_LABOR_PER_BUILDING)),
        ...component.powerPlants.map((lot) => createConsumer(lot, 'power', POWER_LABOR_PER_BUILDING)),
      ];
      laborDelivered += allocateFlows(laborSuppliers, laborConsumers, 'commute', currentTrips, 'weighted');
      for (const consumer of laborConsumers) {
        laborScaleByX.set(consumer.x, consumer.amount > 0 ? consumer.received / consumer.amount : 0);
      }
    }

    const powerScaleByX = new Map();
    let powerDemand = 0;
    let powerDelivered = 0;
    for (const component of powerComponents) {
      const suppliers = component.powerPlants.map((lot) => {
        const laborScale = getScale(laborScaleByX, lot, 0);
        const amount = POWER_SUPPLY_PER_PLANT * laborScale;
        return { x: lot.x, originKind: 'power', amount, remaining: amount };
      });
      const consumers = [];
      for (const kind of STRUCTURE_KINDS) {
        const bucket = STRUCTURE_BUCKET_BY_KIND[kind];
        for (const lot of component[bucket]) {
          const demand = demandFor(kind, POWER_DEMAND);
          if (demand <= 0) continue;
          consumers.push(createConsumer(lot, kind, demand));
        }
      }
      powerDemand += consumers.reduce((sum, consumer) => sum + consumer.amount, 0);
      powerDelivered += allocateFlows(suppliers, consumers, 'power', currentTrips);
      const scaleMap = buildFulfillmentMap(consumers);
      for (const [x, scale] of scaleMap.entries()) powerScaleByX.set(x, scale);
    }

    const waterScaleByX = new Map();
    const sewerScaleByX = new Map();
    let waterDemand = 0;
    let waterDelivered = 0;
    let sewerDemand = 0;
    let sewerHandled = 0;
    for (const component of pipeComponents) {
      const waterSuppliers = component.plumbings.map((lot) => {
        const laborScale = getScale(laborScaleByX, lot, 0);
        const powerScale = getScale(powerScaleByX, lot, 0);
        const amount = WATER_SUPPLY_PER_PUMP * laborScale * powerScale;
        return { x: lot.x, originKind: 'plumbing', amount, remaining: amount };
      });
      const sewerSuppliers = component.plumbings.map((lot) => {
        const laborScale = getScale(laborScaleByX, lot, 0);
        const powerScale = getScale(powerScaleByX, lot, 0);
        const amount = SEWER_SUPPLY_PER_PUMP * laborScale * powerScale;
        return { x: lot.x, originKind: 'plumbing', amount, remaining: amount };
      });
      const waterConsumers = [];
      const sewerConsumers = [];
      for (const kind of STRUCTURE_KINDS) {
        const bucket = STRUCTURE_BUCKET_BY_KIND[kind];
        for (const lot of component[bucket]) {
          const waterNeed = demandFor(kind, WATER_DEMAND);
          const sewerNeed = demandFor(kind, SEWER_DEMAND);
          if (waterNeed > 0) waterConsumers.push(createConsumer(lot, kind, waterNeed));
          if (sewerNeed > 0) sewerConsumers.push(createConsumer(lot, kind, sewerNeed));
        }
      }
      waterDemand += waterConsumers.reduce((sum, consumer) => sum + consumer.amount, 0);
      sewerDemand += sewerConsumers.reduce((sum, consumer) => sum + consumer.amount, 0);
      waterDelivered += allocateFlows(waterSuppliers, waterConsumers, 'water', currentTrips);
      sewerHandled += allocateFlows(sewerSuppliers, sewerConsumers, 'sewer', currentTrips);
      for (const [x, scale] of buildFulfillmentMap(waterConsumers).entries()) waterScaleByX.set(x, scale);
      for (const [x, scale] of buildFulfillmentMap(sewerConsumers).entries()) sewerScaleByX.set(x, scale);
    }

    let foodDelivered = 0;
    let goodsDemand = 0;
    let goodsDelivered = 0;
    let servicesDemand = 0;
    let servicesDelivered = 0;
    let civicEffect = 1;
    let logisticsEffect = 1;

    for (const component of roadComponents) {
      const componentHouses = component.houses.length;
      const componentPopulation = populationBase * (componentHouses / connectedHouseTotal);
      const houseNodes = component.houses.map((lot) => ({ lot, population: componentHouses > 0 ? componentPopulation / componentHouses : 0 }));
      const logisticsBonus = component.logistics.reduce((sum, lot) => {
        const laborScale = getScale(laborScaleByX, lot, 0);
        const utilityScale = average([getScale(powerScaleByX, lot, 0), getScale(waterScaleByX, lot, 0)]);
        return sum + LOGISTICS_THROUGHPUT_PER_BUILDING * laborScale * utilityScale;
      }, 0);
      const componentLogisticsEffect = 1 + logisticsBonus;

      const foodSuppliers = component.farms.map((lot) => {
        const waterScale = getScale(waterScaleByX, lot, 0);
        const powerScale = getScale(powerScaleByX, lot, 0);
        const amount = FOOD_PER_FARM
          * average([waterScale, powerScale])
          * clamp(1.15 - pollution * 0.28, 0.45, 1.2);
        return { x: lot.x, originKind: 'farm', amount, remaining: amount };
      });
      const foodConsumers = houseNodes.map(({ lot, population }) => createConsumer(lot, 'house', population * 1.05));
      foodDelivered += allocateFlows(foodSuppliers, foodConsumers, 'freight', currentTrips);

      const goodsSuppliers = component.factories.map((lot) => {
        const laborScale = getScale(laborScaleByX, lot, 0);
        const utilityScale = average([
          getScale(powerScaleByX, lot, 0),
          getScale(waterScaleByX, lot, 0),
          getScale(sewerScaleByX, lot, 0),
        ]);
        const amount = GOODS_PER_FACTORY
          * laborScale
          * utilityScale
          * componentLogisticsEffect
          * (0.35 + resources * 0.75)
          * clamp(1 - pollution * 0.35, 0.2, 1);
        return { x: lot.x, originKind: 'factory', amount, remaining: amount };
      });
      const goodsConsumers = [];
      for (const kind of STRUCTURE_KINDS) {
        const bucket = STRUCTURE_BUCKET_BY_KIND[kind];
        for (const lot of component[bucket]) {
          const demand = demandFor(kind, GOODS_DEMAND);
          if (demand > 0) goodsConsumers.push(createConsumer(lot, kind, demand));
        }
      }
      goodsDemand += goodsConsumers.reduce((sum, consumer) => sum + consumer.amount, 0);
      goodsDelivered += allocateFlows(goodsSuppliers, goodsConsumers, 'freight', currentTrips);

      const commercialGoodsScale = component.commercials.length > 0
        ? average(component.commercials.map((lot) => {
          const consumer = goodsConsumers.find((entry) => entry.x === lot.x && entry.destKind === 'commercial');
          return consumer && consumer.amount > 0 ? consumer.received / consumer.amount : 0;
        }))
        : 0;
      const civicGoodsScale = component.civics.length > 0
        ? average(component.civics.map((lot) => {
          const consumer = goodsConsumers.find((entry) => entry.x === lot.x && entry.destKind === 'civic');
          return consumer && consumer.amount > 0 ? consumer.received / consumer.amount : 0;
        }))
        : 0;

      const serviceSuppliers = [
        ...component.commercials.map((lot) => {
          const laborScale = getScale(laborScaleByX, lot, 0);
          const utilityScale = average([
            getScale(powerScaleByX, lot, 0),
            getScale(waterScaleByX, lot, 0),
            getScale(sewerScaleByX, lot, 0),
          ]);
          const amount = SERVICES_PER_COMMERCIAL * laborScale * utilityScale * commercialGoodsScale * componentLogisticsEffect;
          return { x: lot.x, originKind: 'commercial', amount, remaining: amount };
        }),
        ...component.civics.map((lot) => {
          const laborScale = getScale(laborScaleByX, lot, 0);
          const utilityScale = average([
            getScale(powerScaleByX, lot, 0),
            getScale(waterScaleByX, lot, 0),
            getScale(sewerScaleByX, lot, 0),
          ]);
          const amount = SERVICES_PER_CIVIC * laborScale * utilityScale * civicGoodsScale;
          return { x: lot.x, originKind: 'civic', amount, remaining: amount };
        }),
      ];
      const serviceConsumers = [];
      for (const kind of STRUCTURE_KINDS) {
        const bucket = STRUCTURE_BUCKET_BY_KIND[kind];
        for (const lot of component[bucket]) {
          const demand = demandFor(kind, SERVICE_DEMAND);
          if (demand > 0) serviceConsumers.push(createConsumer(lot, kind, demand));
        }
      }
      servicesDemand += serviceConsumers.reduce((sum, consumer) => sum + consumer.amount, 0);
      servicesDelivered += allocateFlows(serviceSuppliers, serviceConsumers, 'service', currentTrips);

      civicEffect += component.civics.reduce((sum, lot) => {
        const laborScale = getScale(laborScaleByX, lot, 0);
        const utilityScale = average([
          getScale(powerScaleByX, lot, 0),
          getScale(waterScaleByX, lot, 0),
          getScale(sewerScaleByX, lot, 0),
        ]);
        return sum + CIVIC_QOL_PER_BUILDING * laborScale * utilityScale * Math.max(0.4, civicGoodsScale);
      }, 0);
      logisticsEffect += logisticsBonus;
    }

    const foodDemand = Math.max(18, populationBase * 1.05);
    const foodOutput = foodDelivered;
    const foodPerCapita = clamp(foodDelivered / Math.max(1, foodDemand), 0, 2.2);
    const goodsFulfillment = clamp(goodsDelivered / Math.max(1, goodsDemand), 0, 1.2);
    const servicesFulfillment = clamp(servicesDelivered / Math.max(1, servicesDemand), 0, 1.2);
    const waterFulfillment = clamp(waterDelivered / Math.max(1, waterDemand), 0, 1.2);
    const sewerFulfillment = clamp(sewerHandled / Math.max(1, sewerDemand), 0, 1.2);
    const powerFulfillment = clamp(powerDelivered / Math.max(1, powerDemand), 0, 1.2);
    const plumbingEffect = 1 + average([waterFulfillment, sewerFulfillment]) * 0.22;
    const powerEffect = 1 + powerFulfillment * 0.24;
    const foodShortfall = Math.max(0, foodDemand - foodDelivered);

    const birthRate = 0.018
      * clamp(foodPerCapita, 0.55, 1.35)
      * clamp(0.75 + goodsFulfillment * 0.25, 0.75, 1.1)
      * clamp(0.7 + servicesFulfillment * 0.3, 0.65, 1.1)
      * clamp(0.72 + waterFulfillment * 0.32, 0.6, 1.12)
      * clamp(0.72 + sewerFulfillment * 0.32, 0.6, 1.12)
      * clamp(0.76 + powerFulfillment * 0.28, 0.6, 1.1)
      * clamp(1.04 - pollution * 0.12, 0.72, 1.08)
      * clamp(1.08 - Math.max(0, housingPressure - 1) * 0.45, 0.7, 1.08);

    const deathRate = 0.008
      + 0.018 * clamp(1 - foodPerCapita, 0, 1)
      + 0.008 * clamp(1 - servicesFulfillment, 0, 1)
      + 0.014 * clamp(1 - waterFulfillment, 0, 1)
      + 0.016 * clamp(1 - sewerFulfillment, 0, 1)
      + 0.009 * clamp(1 - powerFulfillment, 0, 1)
      + 0.012 * clamp(pollution, 0, 2)
      + 0.008 * clamp(housingPressure - 1, 0, 1);

    const growthFactor = 1 + (birthRate - deathRate) * dtYears;
    const nextPopulationRaw = Math.max(MIN_POPULATION, populationBase * growthFactor);
    const nextPopulation = housingCapacity > 0 ? clamp(nextPopulationRaw, MIN_POPULATION, housingCapacity) : MIN_POPULATION;

    const workersNeeded = factories * WORKERS_PER_FACTORY
      + commercials * COMMERCIAL_LABOR_PER_BUILDING
      + civics * CIVIC_LABOR_PER_BUILDING
      + logistics * LOGISTICS_LABOR_PER_BUILDING
      + plumbings * PLUMBING_LABOR_PER_BUILDING
      + powerPlants * POWER_LABOR_PER_BUILDING;
    const factoryUtilization = factories > 0
      ? average(roadComponents.flatMap((component) => component.factories.map((lot) => getScale(laborScaleByX, lot, 0))))
      : 0;
    const workersAvailable = laborSupply;
    const workersUsed = laborDelivered;

    const mergedTrips = collapseTrips(currentTrips);
    const commuterTraffic = mergedTrips.filter((trip) => trip.category === 'commute').reduce((sum, trip) => sum + trip.amount, 0);
    const freightTraffic = mergedTrips.filter((trip) => trip.category === 'freight').reduce((sum, trip) => sum + trip.amount, 0);
    const serviceTraffic = mergedTrips.filter((trip) => trip.category === 'service').reduce((sum, trip) => sum + trip.amount, 0);
    const roadCapacity = Math.max(120, roads * 160 * logisticsEffect);
    const trafficLoad = roads > 0 ? clamp((commuterTraffic + freightTraffic + serviceTraffic) / roadCapacity, 0, 2.5) : 0;

    const industrialOutput = Math.max(
      0,
      factories
      * 0.9
      * factoryUtilization
      * logisticsEffect
      * powerEffect
      * (0.35 + resources * 0.75)
      * clamp(0.55 + goodsFulfillment * 0.45, 0.55, 1.1)
      * clamp(1 - pollution * 0.35, 0.2, 1)
      * clamp(1 - Math.max(0, trafficLoad - 1) * 0.18, 0.6, 1),
    );

    const resourceUse = (industrialOutput * 0.01 + nextPopulation * 0.00025) * dtYears;
    const pollutionInflow = (industrialOutput * 0.018 + nextPopulation * 0.00018 + trafficLoad * 0.004) * dtYears * clamp(1.04 - sewerFulfillment * 0.26, 0.68, 1.04);
    const pollutionDecay = pollution * 0.015 * dtYears * clamp(plumbingEffect, 1, 1.35);

    const nextResources = clamp(resources - resourceUse, 0, 1);
    const nextPollution = Math.max(0, pollution + pollutionInflow - pollutionDecay);
    const nextTimeOfDay = (model.timeOfDay + dt * 0.01) % 1;

    const taxRevenueAnnual = houses * 320 * (0.45 + houseAccessRatio * 0.55)
      + farms * 220 * (0.45 + farmAccessRatio * 0.55)
      + factories * 900 * factoryUtilization * (0.35 + factoryAccessRatio * 0.65)
      + commercials * 540 * commercialAccessRatio
      + goodsDelivered * 0.8
      + servicesDelivered * 0.65;
    const serviceCostsAnnual = houses * BUILDING_DEFS.house.upkeepAnnual
      + farms * BUILDING_DEFS.farm.upkeepAnnual
      + factories * BUILDING_DEFS.factory.upkeepAnnual
      + commercials * BUILDING_DEFS.commercial.upkeepAnnual
      + civics * BUILDING_DEFS.civic.upkeepAnnual
      + logistics * BUILDING_DEFS.logistics.upkeepAnnual
      + plumbings * BUILDING_DEFS.plumbing.upkeepAnnual
      + powerPlants * BUILDING_DEFS.power.upkeepAnnual
      + roads * BUILDING_DEFS.road.upkeepAnnual
      + pipes * BUILDING_DEFS.pipe.upkeepAnnual
      + powerLines * BUILDING_DEFS.powerline.upkeepAnnual
      + nextPopulation * 0.55
      + nextPollution * 180
      + foodShortfall * 2.5
      + Math.max(0, trafficLoad - 1) * 220;
    const netRevenueAnnual = taxRevenueAnnual - serviceCostsAnnual;
    const nextMoney = Math.max(0, model.money + netRevenueAnnual * dtYears);

    const qualityOfLife = clamp(
      foodPerCapita * 0.36
      + goodsFulfillment * 0.1
      + servicesFulfillment * 0.1
      + waterFulfillment * 0.14
      + sewerFulfillment * 0.14
      + powerFulfillment * 0.1
      + Math.min(0.3, civicEffect - 1)
      + Math.min(0.2, plumbingEffect - 1)
      + clamp(1 - nextPollution * 0.4, 0, 1) * 0.32
      + clamp(1.1 - Math.max(0, housingPressure - 1), 0, 1.1) * 0.18
      + clamp(roadCoverage, 0, 1) * 0.08
      - Math.max(0, trafficLoad - 1) * 0.05,
      0,
      2,
    );

    const nextActionTimer = Math.max(0, (model.lastActionTimer || 0) - dt);
    const nextHistoryTimer = (model.historySampleTimer || 0) - dt;
    const nextHistory = nextHistoryTimer <= 0
      ? appendHistory(Array.isArray(model.history) ? model.history : [], {
        time: simTime,
        money: nextMoney,
        population: nextPopulation,
        foodDelivered,
        goodsDelivered,
        servicesDelivered,
        qualityOfLife,
        pollution: nextPollution,
        netRevenue: netRevenueAnnual,
        commuterTraffic,
        freightTraffic,
        serviceTraffic,
      })
      : (Array.isArray(model.history) ? model.history : []);

    world.set(id, World3State, {
      population: nextPopulation,
      resources: nextResources,
      pollution: nextPollution,
      foodOutput,
      foodDemand,
      foodPerCapita,
      industrialOutput,
      birthRate,
      deathRate,
      qualityOfLife,
      houses,
      farms,
      factories,
      commercials,
      civics,
      logistics,
      plumbings,
      powerPlants,
      roads,
      pipes,
      powerLines,
      connectedHouses: connectedRoad.house,
      connectedFarms: connectedRoad.farm,
      connectedFactories: connectedRoad.factory,
      connectedCommercials: connectedRoad.commercial,
      connectedCivics: connectedRoad.civic,
      connectedLogistics: connectedRoad.logistics,
      connectedPlumbings: connectedRoad.plumbing,
      connectedPowerPlants: connectedRoad.power,
      roadCoverage,
      pipeCoverage,
      powerCoverage,
      foodDelivered,
      foodShortfall,
      laborDelivered,
      goodsDemand,
      goodsDelivered,
      waterDemand,
      waterDelivered,
      sewerDemand,
      sewerHandled,
      powerDemand,
      powerDelivered,
      servicesDemand,
      servicesDelivered,
      civicEffect,
      logisticsEffect,
      plumbingEffect,
      powerEffect,
      workersAvailable,
      workersUsed,
      factoryUtilization,
      commuterTraffic,
      freightTraffic,
      serviceTraffic,
      trafficLoad,
      currentTrips: mergedTrips,
      money: nextMoney,
      taxRevenueAnnual,
      serviceCostsAnnual,
      netRevenueAnnual,
      history: nextHistory,
      historySampleTimer: nextHistoryTimer <= 0 ? 0.2 : nextHistoryTimer,
      lastActionText: nextActionTimer > 0 ? model.lastActionText : 'Utilities matter now. Roads move people, pipes move water and sewer, lines move power.',
      lastActionTimer: nextActionTimer,
      simTime,
      timeOfDay: nextTimeOfDay,
    });
  }
}
