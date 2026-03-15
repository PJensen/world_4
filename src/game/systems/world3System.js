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

  const factoryScale = Math.max(0, factories * 0.085);
  const farmScale = Math.max(0.15, farms * 0.11);
  const housingScale = Math.max(0.15, houses * 0.065);

  const dtYears = dt * 0.65;
  const PEOPLE_PER_HOUSE = 120000;
  const LABOR_SHARE = 0.42;
  const WORKERS_PER_FACTORY = 52000;

  for (const [id, model] of world.query(World3State)) {
    const resources = clamp(model.resources, 0, 1);
    const pollution = Math.max(0, model.pollution);

    const population = Math.max(0.1e9, houses * PEOPLE_PER_HOUSE);
    const workersAvailable = population * LABOR_SHARE;
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
    const foodOutput = Math.max(0.02, farmScale * clamp(1.18 - pollution * 0.38, 0.35, 1.25));
    const populationNorm = Math.max(0.2, population / 4e9);
    const foodPerCapita = foodOutput / populationNorm;

    const birthRate = 0.024
      * clamp(foodPerCapita, 0.45, 1.45)
      * clamp(1.03 - pollution * 0.18, 0.6, 1.08)
      * clamp(0.6 + housingScale * 0.4, 0.65, 1.25);

    const deathRate = 0.009
      + 0.017 * clamp(1 - foodPerCapita, 0, 1)
      + 0.013 * clamp(pollution, 0, 2)
      + 0.005 * clamp(0.45 - housingScale, 0, 0.45);

    const resourceUse = (industrialOutput * 0.015 + populationNorm * 0.0022) * dtYears;
    const pollutionInflow = (industrialOutput * 0.017 + populationNorm * 0.0032) * dtYears;
    const pollutionDecay = pollution * 0.015 * dtYears;

    const nextResources = clamp(resources - resourceUse, 0, 1);
    const nextPollution = Math.max(0, pollution + pollutionInflow - pollutionDecay);
    const nextTimeOfDay = (model.timeOfDay + dt * 0.01) % 1;

    const qualityOfLife = clamp(
      foodPerCapita * 0.4
      + clamp(1 - nextPollution * 0.4, 0, 1) * 0.35
      + clamp(housingScale, 0, 1.4) * 0.25,
      0,
      2,
    );

    world.set(id, World3State, {
      population,
      resources: nextResources,
      pollution: nextPollution,
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
      timeOfDay: nextTimeOfDay,
    });
  }
}
