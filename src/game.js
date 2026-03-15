import { createRealtimeRafLoop } from './lib/ecs-js/index.js';
import { createBuildControls } from './game/input.js';
import { createGameWorld } from './game/world.js';

const canvas = document.getElementById('game');
const hud = document.getElementById('hud');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Expected #game canvas element');
}

const context = canvas.getContext('2d');
if (!context) {
  throw new Error('Unable to acquire 2D rendering context');
}

const controls = createBuildControls(canvas);
const world = createGameWorld({ canvas, context, hud, controls });

const loop = createRealtimeRafLoop({
  world,
  maxDt: 0.05,
});

loop.stepWorldImmediate(0);
loop.start();
