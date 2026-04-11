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
  const starterFarm = world.create();
  world.add(starterFarm, Building, { kind: 'farm', x: 128 });
  const starterFactory = world.create();
  world.add(starterFactory, Building, { kind: 'factory', x: 256 });

  return world;
}
