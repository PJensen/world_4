import { Building, World3State } from '../components.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function world3System(world, dt) {
  const counts = { house: 0, farm: 0, factory: 0 };
  for (const [id, building] of world.query(Building)) {
    counts[building.kind] = (counts[building.kind] || 0) + 1;
  }

  const houses = counts.house;
  const farms = counts.farm;
  const factories = counts.factory;

  const factoryScale = Math.max(0, factories * 0.9);
  const farmScale = Math.max(0, farms * 220);
  const housingCapacity = Math.max(0, houses * 180);

  const dtYears = dt * 0.65;
  const MIN_POPULATION = 24;
  const LABOR_SHARE = 0.44;
  const WORKERS_PER_FACTORY = 90;

  for (const [id, model] of world.query(World3State)) {
    const resources = clamp(model.resources, 0, 1);
    const pollution = Math.max(0, model.pollution);
    const populationBase = Math.max(MIN_POPULATION, model.population);
    const foodOutput = Math.max(0, farmScale * clamp(1.15 - pollution * 0.28, 0.45, 1.2));
    const foodDemand = Math.max(18, populationBase * 1.05);
    const foodPerCapita = clamp(foodOutput / foodDemand, 0, 2.2);
    const housingPressure = housingCapacity > 0
      ? clamp(populationBase / housingCapacity, 0, 1.4)
      : 1.4;

    const birthRate = 0.018
      * clamp(foodPerCapita, 0.55, 1.35)
      * clamp(1.04 - pollution * 0.12, 0.72, 1.08)
      * clamp(1.08 - Math.max(0, housingPressure - 1) * 0.45, 0.7, 1.08);

    const deathRate = 0.008
      + 0.018 * clamp(1 - foodPerCapita, 0, 1)
      + 0.012 * clamp(pollution, 0, 2)
      + 0.008 * clamp(housingPressure - 1, 0, 1);

    const growthFactor = 1 + (birthRate - deathRate) * dtYears;
    const nextPopulationRaw = Math.max(MIN_POPULATION, populationBase * growthFactor);
    const nextPopulation = housingCapacity > 0
      ? clamp(nextPopulationRaw, MIN_POPULATION, housingCapacity)
      : MIN_POPULATION;

    const workersAvailable = nextPopulation * LABOR_SHARE;
    const workersNeeded = factories * WORKERS_PER_FACTORY;
    const factoryUtilization = workersNeeded > 0
      ? clamp(workersAvailable / workersNeeded, 0, 1)
      : 0;
    const workersUsed = Math.min(workersAvailable, workersNeeded);

    const industrialOutput = Math.max(
      0,
      factoryScale
      * factoryUtilization
      * (0.35 + resources * 0.75)
      * clamp(1 - pollution * 0.35, 0.2, 1),
    );

    const resourceUse = (industrialOutput * 0.01 + nextPopulation * 0.00025) * dtYears;
    const pollutionInflow = (industrialOutput * 0.018 + nextPopulation * 0.00018) * dtYears;
    const pollutionDecay = pollution * 0.015 * dtYears;

    const nextResources = clamp(resources - resourceUse, 0, 1);
    const nextPollution = Math.max(0, pollution + pollutionInflow - pollutionDecay);
    const nextTimeOfDay = (model.timeOfDay + dt * 0.01) % 1;

    const taxRevenueAnnual = houses * 320
      + farms * 220
      + factories * 900 * factoryUtilization;
    const serviceCostsAnnual = houses * 95
      + farms * 70
      + factories * 260
      + nextPopulation * 0.55
      + nextPollution * 180;
    const netRevenueAnnual = taxRevenueAnnual - serviceCostsAnnual;
    const nextMoney = Math.max(0, model.money + netRevenueAnnual * dtYears);

    const qualityOfLife = clamp(
      foodPerCapita * 0.4
      + clamp(1 - nextPollution * 0.4, 0, 1) * 0.35
      + clamp(1.1 - Math.max(0, housingPressure - 1), 0, 1.1) * 0.25,
      0,
      2,
    );

    const nextActionTimer = Math.max(0, (model.lastActionTimer || 0) - dt);

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
      workersAvailable,
      workersUsed,
      factoryUtilization,
      money: nextMoney,
      taxRevenueAnnual,
      serviceCostsAnnual,
      netRevenueAnnual,
      lastActionText: nextActionTimer > 0 ? model.lastActionText : 'Expand carefully. Farms stabilize growth, factories drive taxes.',
      lastActionTimer: nextActionTimer,
      timeOfDay: nextTimeOfDay,
    });
  }
}
