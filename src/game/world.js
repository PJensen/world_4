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
  const starterRoadA = world.create();
  world.add(starterRoadA, Building, { kind: 'road', x: 64 });
  const starterFarm = world.create();
  world.add(starterFarm, Building, { kind: 'farm', x: 128 });
  const starterFarmRoad = world.create();
  world.add(starterFarmRoad, Building, { kind: 'road', x: 128 });
  const starterRoadB = world.create();
  world.add(starterRoadB, Building, { kind: 'road', x: 192 });
  const starterFactory = world.create();
  world.add(starterFactory, Building, { kind: 'factory', x: 256 });
  const starterFactoryRoad = world.create();
  world.add(starterFactoryRoad, Building, { kind: 'road', x: 256 });

  return world;
}
