import { BUILDING_DEFS, Building, World3State } from '../components.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const TILE_SIZE = 64;

function appendHistory(history, sample) {
  return history.concat(sample);
}

function buildLots(buildings) {
  const lots = new Map();
  for (const entry of buildings) {
    const lot = lots.get(entry.building.x) || { x: entry.building.x, road: null, structure: null };
    if (entry.building.kind === 'road') lot.road = entry;
    else lot.structure = entry;
    lots.set(entry.building.x, lot);
  }
  return lots;
}

function buildRoadComponents(lots) {
  const roadPositions = [...lots.values()]
    .filter((lot) => lot.road)
    .map((lot) => lot.x)
    .sort((left, right) => left - right);
  const componentByX = new Map();
  const components = [];

  let current = null;
  for (const x of roadPositions) {
    if (!current || x - current.maxX > TILE_SIZE) {
      current = {
        minX: x,
        maxX: x,
        roadXs: [],
        houses: [],
        farms: [],
        factories: [],
        commercials: [],
        civics: [],
        logistics: [],
      };
      components.push(current);
    }
    current.maxX = x;
    current.roadXs.push(x);
    componentByX.set(x, current);
  }

  for (const lot of lots.values()) {
    if (!lot.structure || !lot.road) continue;
    const component = componentByX.get(lot.x);
    if (!component) continue;
    const bucketByKind = {
      house: 'houses',
      farm: 'farms',
      factory: 'factories',
      commercial: 'commercials',
      civic: 'civics',
      logistics: 'logistics',
    };
    const bucket = bucketByKind[lot.structure.building.kind];
    if (bucket) component[bucket].push(lot);
  }

  return { componentByX, components };
}

function makeNode(lot, amount, destKind) {
  return {
    x: lot.x,
    originKind: lot.structure?.building.kind,
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

export function world3System(world, dt) {
  const counts = { house: 0, farm: 0, factory: 0, commercial: 0, civic: 0, logistics: 0, road: 0 };
  const buildings = [];
  for (const [id, building] of world.query(Building)) {
    buildings.push({ id, building });
    counts[building.kind] = (counts[building.kind] || 0) + 1;
  }

  const lots = buildLots(buildings);
  const { components } = buildRoadComponents(lots);

  const houses = counts.house;
  const farms = counts.farm;
  const factories = counts.factory;
  const commercials = counts.commercial;
  const civics = counts.civic;
  const logistics = counts.logistics;
  const roads = counts.road;

  const connected = { house: 0, farm: 0, factory: 0, commercial: 0, civic: 0, logistics: 0 };
  for (const component of components) {
    connected.house += component.houses.length;
    connected.farm += component.farms.length;
    connected.factory += component.factories.length;
    connected.commercial += component.commercials.length;
    connected.civic += component.civics.length;
    connected.logistics += component.logistics.length;
  }

  const totalServiceLots = houses + farms + factories + commercials + civics + logistics;
  const connectedLots = connected.house + connected.farm + connected.factory + connected.commercial + connected.civic + connected.logistics;
  const roadCoverage = totalServiceLots > 0 ? connectedLots / totalServiceLots : 0;
  const houseAccessRatio = houses > 0 ? connected.house / houses : 1;
  const farmAccessRatio = farms > 0 ? connected.farm / farms : 1;
  const factoryAccessRatio = factories > 0 ? connected.factory / factories : 1;
  const commercialAccessRatio = commercials > 0 ? connected.commercial / commercials : 1;
  const civicAccessRatio = civics > 0 ? connected.civic / civics : 1;
  const logisticsAccessRatio = logistics > 0 ? connected.logistics / logistics : 1;

  const factoryScale = Math.max(0, factories * 0.9);
  const farmScale = Math.max(0, farms * 220);
  const housingCapacity = Math.max(0, houses * 180);

  const dtYears = dt * 0.65;
  const MIN_POPULATION = 24;
  const LABOR_SHARE = 0.44;
  const WORKERS_PER_FACTORY = 90;
  const FOOD_PER_FARM = 220;
  const GOODS_PER_FACTORY = 180;
  const SERVICES_PER_FACTORY = 130;
  const GOODS_DEMAND_PER_HOUSE = 18;
  const GOODS_DEMAND_PER_FARM = 10;
  const GOODS_DEMAND_PER_FACTORY = 8;
  const GOODS_INPUT_PER_COMMERCIAL = 36;
  const GOODS_INPUT_PER_CIVIC = 10;
  const GOODS_INPUT_PER_LOGISTICS = 14;
  const SERVICE_DEMAND_PER_HOUSE = 15;
  const SERVICE_DEMAND_PER_FARM = 8;
  const SERVICE_DEMAND_PER_FACTORY = 14;
  const SERVICE_DEMAND_PER_COMMERCIAL = 10;
  const SERVICE_DEMAND_PER_CIVIC = 12;
  const SERVICE_DEMAND_PER_LOGISTICS = 8;
  const COMMERCIAL_LABOR_PER_BUILDING = 55;
  const CIVIC_LABOR_PER_BUILDING = 26;
  const LOGISTICS_LABOR_PER_BUILDING = 38;
  const SERVICES_PER_COMMERCIAL = 170;
  const CIVIC_QOL_PER_BUILDING = 0.06;
  const LOGISTICS_THROUGHPUT_PER_BUILDING = 0.22;

  for (const [id, model] of world.query(World3State)) {
    const resources = clamp(model.resources, 0, 1);
    const pollution = Math.max(0, model.pollution);
    const simTime = (model.simTime || 0) + dt;
    const populationBase = Math.max(MIN_POPULATION, model.population);
    const foodSupply = Math.max(
      0,
      farmScale
      * (0.35 + farmAccessRatio * 0.65)
      * clamp(1.15 - pollution * 0.28, 0.45, 1.2),
    );
    const foodDemand = Math.max(18, populationBase * 1.05);
    const laborSupply = populationBase * LABOR_SHARE * clamp(0.35 + houseAccessRatio * 0.65, 0.2, 1);
    const housingPressure = housingCapacity > 0
      ? clamp(populationBase / housingCapacity, 0, 1.4)
      : 1.4;

    let foodDelivered = 0;
    let laborDelivered = 0;
    let goodsDemand = 0;
    let goodsDelivered = 0;
    let servicesDemand = 0;
    let servicesDelivered = 0;
    let civicEffect = 1;
    let logisticsEffect = 1;
    const currentTrips = [];

    const connectedHouseTotal = Math.max(1, connected.house);
    for (const component of components) {
      const componentHouses = component.houses.length;
      const componentFarms = component.farms.length;
      const componentFactories = component.factories.length;
      const componentCommercials = component.commercials.length;
      const componentCivics = component.civics.length;
      const componentLogistics = component.logistics.length;
      const componentPopulation = populationBase * (componentHouses / connectedHouseTotal);

      const houseNodes = component.houses.map((lot) => makeNode(
        lot,
        componentHouses > 0 ? componentPopulation / componentHouses : 0,
        'house',
      ));
      const farmNodes = component.farms.map((lot) => makeNode(
        lot,
        FOOD_PER_FARM * clamp(1.15 - pollution * 0.28, 0.45, 1.2),
        'farm',
      ));
      const factoryNodes = component.factories.map((lot) => makeNode(lot, WORKERS_PER_FACTORY, 'factory'));
      const commercialNodes = component.commercials.map((lot) => makeNode(lot, COMMERCIAL_LABOR_PER_BUILDING, 'commercial'));
      const civicNodes = component.civics.map((lot) => makeNode(lot, CIVIC_LABOR_PER_BUILDING, 'civic'));
      const logisticsNodes = component.logistics.map((lot) => makeNode(lot, LOGISTICS_LABOR_PER_BUILDING, 'logistics'));

      const componentFoodDemand = houseNodes.reduce((sum, node) => sum + node.amount * 1.05, 0);
      const componentLaborSupply = houseNodes.reduce((sum, node) => sum + node.amount * LABOR_SHARE, 0);
      const factoryLaborDemand = componentFactories * WORKERS_PER_FACTORY;
      const commercialLaborDemand = componentCommercials * COMMERCIAL_LABOR_PER_BUILDING;
      const civicLaborDemand = componentCivics * CIVIC_LABOR_PER_BUILDING;
      const logisticsLaborDemand = componentLogistics * LOGISTICS_LABOR_PER_BUILDING;
      const componentLaborDemand = factoryLaborDemand + commercialLaborDemand + civicLaborDemand + logisticsLaborDemand;
      const foodSuppliers = farmNodes.map((node) => ({ ...node, remaining: node.amount }));
      const foodConsumers = houseNodes.map((node) => ({
        x: node.x,
        destKind: 'house',
        amount: node.amount * 1.05,
        remaining: node.amount * 1.05,
        received: 0,
      }));
      const componentFoodDelivered = allocateFlows(foodSuppliers, foodConsumers, 'freight', currentTrips);

      const laborSuppliers = houseNodes.map((node) => ({
        x: node.x,
        originKind: 'house',
        amount: node.amount * LABOR_SHARE,
        remaining: node.amount * LABOR_SHARE,
      }));
      const laborConsumers = [
        ...factoryNodes.map((node) => ({ x: node.x, destKind: 'factory', amount: WORKERS_PER_FACTORY, remaining: WORKERS_PER_FACTORY, received: 0 })),
        ...commercialNodes.map((node) => ({ x: node.x, destKind: 'commercial', amount: COMMERCIAL_LABOR_PER_BUILDING, remaining: COMMERCIAL_LABOR_PER_BUILDING, received: 0 })),
        ...civicNodes.map((node) => ({ x: node.x, destKind: 'civic', amount: CIVIC_LABOR_PER_BUILDING, remaining: CIVIC_LABOR_PER_BUILDING, received: 0 })),
        ...logisticsNodes.map((node) => ({ x: node.x, destKind: 'logistics', amount: LOGISTICS_LABOR_PER_BUILDING, remaining: LOGISTICS_LABOR_PER_BUILDING, received: 0 })),
      ];
      allocateFlows(laborSuppliers, laborConsumers, 'commute', currentTrips, 'weighted');
      const laborByKind = laborConsumers.reduce((map, consumer) => {
        map[consumer.destKind] = (map[consumer.destKind] || 0) + consumer.received;
        return map;
      }, {});
      const factoryLaborDelivered = laborByKind.factory || 0;
      const commercialLaborDelivered = laborByKind.commercial || 0;
      const civicLaborDelivered = laborByKind.civic || 0;
      const logisticsLaborDelivered = laborByKind.logistics || 0;
      const componentLaborDelivered = factoryLaborDelivered + commercialLaborDelivered + civicLaborDelivered + logisticsLaborDelivered;
      const factoryLaborUtilization = factoryLaborDemand > 0 ? factoryLaborDelivered / factoryLaborDemand : 0;
      const commercialLaborUtilization = commercialLaborDemand > 0 ? commercialLaborDelivered / commercialLaborDemand : 0;
      const civicLaborUtilization = civicLaborDemand > 0 ? civicLaborDelivered / civicLaborDemand : 0;
      const logisticsLaborUtilization = logisticsLaborDemand > 0 ? logisticsLaborDelivered / logisticsLaborDemand : 0;
      const componentLogisticsEffect = 1 + componentLogistics * LOGISTICS_THROUGHPUT_PER_BUILDING * logisticsLaborUtilization;

      const goodsSuppliers = component.factories.map((lot) => ({
        x: lot.x,
        originKind: 'factory',
        amount: GOODS_PER_FACTORY
          * factoryLaborUtilization
          * componentLogisticsEffect
          * (0.35 + resources * 0.75)
          * clamp(1 - pollution * 0.35, 0.2, 1),
        remaining: GOODS_PER_FACTORY
          * factoryLaborUtilization
          * componentLogisticsEffect
          * (0.35 + resources * 0.75)
          * clamp(1 - pollution * 0.35, 0.2, 1),
      }));
      const goodsConsumers = [
        ...component.houses.map((lot) => ({ x: lot.x, destKind: 'house', amount: GOODS_DEMAND_PER_HOUSE, remaining: GOODS_DEMAND_PER_HOUSE, received: 0 })),
        ...component.farms.map((lot) => ({ x: lot.x, destKind: 'farm', amount: GOODS_DEMAND_PER_FARM, remaining: GOODS_DEMAND_PER_FARM, received: 0 })),
        ...component.factories.map((lot) => ({ x: lot.x, destKind: 'factory', amount: GOODS_DEMAND_PER_FACTORY, remaining: GOODS_DEMAND_PER_FACTORY, received: 0 })),
        ...component.commercials.map((lot) => ({ x: lot.x, destKind: 'commercial', amount: GOODS_INPUT_PER_COMMERCIAL, remaining: GOODS_INPUT_PER_COMMERCIAL, received: 0 })),
        ...component.civics.map((lot) => ({ x: lot.x, destKind: 'civic', amount: GOODS_INPUT_PER_CIVIC, remaining: GOODS_INPUT_PER_CIVIC, received: 0 })),
        ...component.logistics.map((lot) => ({ x: lot.x, destKind: 'logistics', amount: GOODS_INPUT_PER_LOGISTICS, remaining: GOODS_INPUT_PER_LOGISTICS, received: 0 })),
      ];
      const componentGoodsDelivered = allocateFlows(goodsSuppliers, goodsConsumers, 'freight', currentTrips);
      const totalComponentGoodsDemand = goodsConsumers.reduce((sum, consumer) => sum + consumer.amount, 0);
      const commercialGoodsReceived = goodsConsumers.filter((consumer) => consumer.destKind === 'commercial').reduce((sum, consumer) => sum + consumer.received, 0);
      const civicGoodsReceived = goodsConsumers.filter((consumer) => consumer.destKind === 'civic').reduce((sum, consumer) => sum + consumer.received, 0);
      const commercialGoodsScale = componentCommercials > 0 ? clamp(commercialGoodsReceived / Math.max(1, componentCommercials * GOODS_INPUT_PER_COMMERCIAL), 0, 1) : 0;
      const civicGoodsScale = componentCivics > 0 ? clamp(civicGoodsReceived / Math.max(1, componentCivics * GOODS_INPUT_PER_CIVIC), 0, 1) : 0;

      const serviceSuppliers = [
        ...component.commercials.map((lot) => ({
          x: lot.x,
          originKind: 'commercial',
          amount: SERVICES_PER_COMMERCIAL * commercialLaborUtilization * commercialGoodsScale * componentLogisticsEffect,
          remaining: SERVICES_PER_COMMERCIAL * commercialLaborUtilization * commercialGoodsScale * componentLogisticsEffect,
        })),
        ...component.civics.map((lot) => ({
          x: lot.x,
          originKind: 'civic',
          amount: 90 * civicLaborUtilization * civicGoodsScale,
          remaining: 90 * civicLaborUtilization * civicGoodsScale,
        })),
      ];
      const serviceConsumers = [
        ...component.houses.map((lot) => ({ x: lot.x, destKind: 'house', amount: SERVICE_DEMAND_PER_HOUSE, remaining: SERVICE_DEMAND_PER_HOUSE, received: 0 })),
        ...component.farms.map((lot) => ({ x: lot.x, destKind: 'farm', amount: SERVICE_DEMAND_PER_FARM, remaining: SERVICE_DEMAND_PER_FARM, received: 0 })),
        ...component.factories.map((lot) => ({ x: lot.x, destKind: 'factory', amount: SERVICE_DEMAND_PER_FACTORY, remaining: SERVICE_DEMAND_PER_FACTORY, received: 0 })),
        ...component.commercials.map((lot) => ({ x: lot.x, destKind: 'commercial', amount: SERVICE_DEMAND_PER_COMMERCIAL, remaining: SERVICE_DEMAND_PER_COMMERCIAL, received: 0 })),
        ...component.civics.map((lot) => ({ x: lot.x, destKind: 'civic', amount: SERVICE_DEMAND_PER_CIVIC, remaining: SERVICE_DEMAND_PER_CIVIC, received: 0 })),
        ...component.logistics.map((lot) => ({ x: lot.x, destKind: 'logistics', amount: SERVICE_DEMAND_PER_LOGISTICS, remaining: SERVICE_DEMAND_PER_LOGISTICS, received: 0 })),
      ];
      const componentServicesDelivered = allocateFlows(serviceSuppliers, serviceConsumers, 'service', currentTrips);
      const extendedServicesDemand = serviceConsumers.reduce((sum, consumer) => sum + consumer.amount, 0);

      foodDelivered += componentFoodDelivered;
      laborDelivered += componentLaborDelivered;
      goodsDemand += totalComponentGoodsDemand;
      goodsDelivered += componentGoodsDelivered;
      servicesDemand += extendedServicesDemand;
      servicesDelivered += componentServicesDelivered;
      civicEffect += componentCivics * CIVIC_QOL_PER_BUILDING * civicLaborUtilization * civicGoodsScale;
      logisticsEffect += componentLogistics * LOGISTICS_THROUGHPUT_PER_BUILDING * logisticsLaborUtilization;
    }

    const foodOutput = foodSupply;
    const foodPerCapita = clamp(foodDelivered / Math.max(1, foodDemand), 0, 2.2);
    const goodsFulfillment = clamp(goodsDelivered / Math.max(1, goodsDemand), 0, 1.2);
    const servicesFulfillment = clamp(servicesDelivered / Math.max(1, servicesDemand), 0, 1.2);
    const foodShortfall = Math.max(0, foodDemand - foodDelivered);

    const birthRate = 0.018
      * clamp(foodPerCapita, 0.55, 1.35)
      * clamp(0.75 + goodsFulfillment * 0.25, 0.75, 1.1)
      * clamp(0.7 + servicesFulfillment * 0.3, 0.65, 1.1)
      * clamp(1.04 - pollution * 0.12, 0.72, 1.08)
      * clamp(1.08 - Math.max(0, housingPressure - 1) * 0.45, 0.7, 1.08);

    const deathRate = 0.008
      + 0.018 * clamp(1 - foodPerCapita, 0, 1)
      + 0.008 * clamp(1 - servicesFulfillment, 0, 1)
      + 0.012 * clamp(pollution, 0, 2)
      + 0.008 * clamp(housingPressure - 1, 0, 1);

    const growthFactor = 1 + (birthRate - deathRate) * dtYears;
    const nextPopulationRaw = Math.max(MIN_POPULATION, populationBase * growthFactor);
    const nextPopulation = housingCapacity > 0
      ? clamp(nextPopulationRaw, MIN_POPULATION, housingCapacity)
      : MIN_POPULATION;

    const workersAvailable = laborSupply;
    const workersNeeded = factories * WORKERS_PER_FACTORY
      + commercials * COMMERCIAL_LABOR_PER_BUILDING
      + civics * CIVIC_LABOR_PER_BUILDING
      + logistics * LOGISTICS_LABOR_PER_BUILDING;
    const factoryUtilization = workersNeeded > 0
      ? clamp(laborDelivered / workersNeeded, 0, 1)
      : 0;
    const workersUsed = laborDelivered;

    const mergedTrips = collapseTrips(currentTrips);
    const commuterTraffic = mergedTrips.filter((trip) => trip.category === 'commute').reduce((sum, trip) => sum + trip.amount, 0);
    const freightTraffic = mergedTrips.filter((trip) => trip.category === 'freight').reduce((sum, trip) => sum + trip.amount, 0);
    const serviceTraffic = mergedTrips.filter((trip) => trip.category === 'service').reduce((sum, trip) => sum + trip.amount, 0);
    const roadCapacity = Math.max(120, roads * 160 * logisticsEffect);
    const trafficLoad = roads > 0
      ? clamp((commuterTraffic + freightTraffic + serviceTraffic) / roadCapacity, 0, 2.5)
      : 0;

    const industrialOutput = Math.max(
      0,
      factoryScale
      * factoryUtilization
      * logisticsEffect
      * (0.35 + resources * 0.75)
      * clamp(0.55 + goodsFulfillment * 0.45, 0.55, 1.1)
      * clamp(1 - pollution * 0.35, 0.2, 1)
      * clamp(1 - Math.max(0, trafficLoad - 1) * 0.18, 0.6, 1),
    );

    const resourceUse = (industrialOutput * 0.01 + nextPopulation * 0.00025) * dtYears;
    const pollutionInflow = (industrialOutput * 0.018 + nextPopulation * 0.00018 + trafficLoad * 0.004) * dtYears;
    const pollutionDecay = pollution * 0.015 * dtYears;

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
      + roads * BUILDING_DEFS.road.upkeepAnnual
      + nextPopulation * 0.55
      + nextPollution * 180
      + foodShortfall * 2.5
      + Math.max(0, trafficLoad - 1) * 220;
    const netRevenueAnnual = taxRevenueAnnual - serviceCostsAnnual;
    const nextMoney = Math.max(0, model.money + netRevenueAnnual * dtYears);

    const qualityOfLife = clamp(
      foodPerCapita * 0.4
      + goodsFulfillment * 0.1
      + servicesFulfillment * 0.12
      + Math.min(0.3, civicEffect - 1)
      + clamp(1 - nextPollution * 0.4, 0, 1) * 0.35
      + clamp(1.1 - Math.max(0, housingPressure - 1), 0, 1.1) * 0.18
      + clamp(roadCoverage, 0, 1) * 0.12
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
      roads,
      connectedHouses: connected.house,
      connectedFarms: connected.farm,
      connectedFactories: connected.factory,
      connectedCommercials: connected.commercial,
      connectedCivics: connected.civic,
      connectedLogistics: connected.logistics,
      roadCoverage,
      foodDelivered,
      foodShortfall,
      laborDelivered,
      goodsDemand,
      goodsDelivered,
      servicesDemand,
      servicesDelivered,
      civicEffect,
      logisticsEffect,
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
      lastActionText: nextActionTimer > 0 ? model.lastActionText : 'Expand carefully. Farms stabilize growth, factories drive taxes.',
      lastActionTimer: nextActionTimer,
      simTime,
      timeOfDay: nextTimeOfDay,
    });
  }
}
