import { World, composeScheduler } from '../lib/ecs-js/index.js';
import {
  BuildMode,
  Building,
  Camera,
  World3State,
} from './components.js';
import { createCameraSystem } from './systems/cameraSystem.js';
import { createPlacementSystem } from './systems/placementSystem.js';
import { createSmokeFx } from './systems/particleFx.js';
import { createRenderSystem } from './systems/renderSystem.js';
import { world3System } from './systems/world3System.js';

export function createGameWorld({ canvas, context, hud, controls }) {
  const world = new World({ seed: 42, store: 'map' });
  const smokeFx = createSmokeFx();

  world.system(createCameraSystem(controls), 'input');
  world.system(createPlacementSystem(controls), 'build');
  world.system(world3System, 'simulate');
  world.system(createRenderSystem(canvas, context, hud, controls, smokeFx), 'render');
  world.setScheduler(composeScheduler('input', 'build', 'simulate', 'render'));

  const state = world.create();
  world.add(state, Camera);
  world.add(state, BuildMode);
  world.add(state, World3State);

  const starterHouse = world.create();
  world.add(starterHouse, Building, { kind: 'house', x: 0 });
  const starterHouseRoad = world.create();
  world.add(starterHouseRoad, Building, { kind: 'road', x: 0 });
  const starterHousePipe = world.create();
  world.add(starterHousePipe, Building, { kind: 'pipe', x: 0 });
  const starterHousePower = world.create();
  world.add(starterHousePower, Building, { kind: 'powerline', x: 0 });
  const starterRoadA = world.create();
  world.add(starterRoadA, Building, { kind: 'road', x: 64 });
  const starterPipeA = world.create();
  world.add(starterPipeA, Building, { kind: 'pipe', x: 64 });
  const starterPowerA = world.create();
  world.add(starterPowerA, Building, { kind: 'powerline', x: 64 });
  const starterFarm = world.create();
  world.add(starterFarm, Building, { kind: 'farm', x: 128 });
  const starterFarmRoad = world.create();
  world.add(starterFarmRoad, Building, { kind: 'road', x: 128 });
  const starterFarmPipe = world.create();
  world.add(starterFarmPipe, Building, { kind: 'pipe', x: 128 });
  const starterFarmPower = world.create();
  world.add(starterFarmPower, Building, { kind: 'powerline', x: 128 });
  const starterRoadB = world.create();
  world.add(starterRoadB, Building, { kind: 'road', x: 192 });
  const starterPipeB = world.create();
  world.add(starterPipeB, Building, { kind: 'pipe', x: 192 });
  const starterPowerB = world.create();
  world.add(starterPowerB, Building, { kind: 'powerline', x: 192 });
  const starterFactory = world.create();
  world.add(starterFactory, Building, { kind: 'factory', x: 256 });
  const starterFactoryRoad = world.create();
  world.add(starterFactoryRoad, Building, { kind: 'road', x: 256 });
  const starterFactoryPipe = world.create();
  world.add(starterFactoryPipe, Building, { kind: 'pipe', x: 256 });
  const starterFactoryPower = world.create();
  world.add(starterFactoryPower, Building, { kind: 'powerline', x: 256 });
  const starterRoadC = world.create();
  world.add(starterRoadC, Building, { kind: 'road', x: 320 });
  const starterPipeC = world.create();
  world.add(starterPipeC, Building, { kind: 'pipe', x: 320 });
  const starterPowerC = world.create();
  world.add(starterPowerC, Building, { kind: 'powerline', x: 320 });
  const starterPumpHouse = world.create();
  world.add(starterPumpHouse, Building, { kind: 'plumbing', x: 320 });
  const starterRoadD = world.create();
  world.add(starterRoadD, Building, { kind: 'road', x: 384 });
  const starterPowerD = world.create();
  world.add(starterPowerD, Building, { kind: 'powerline', x: 384 });
  const starterPowerPlant = world.create();
  world.add(starterPowerPlant, Building, { kind: 'power', x: 384 });

  return world;
}
