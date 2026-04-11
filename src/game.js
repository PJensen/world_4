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

function resizeCanvasToViewport() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(320, Math.floor(window.innerWidth * dpr));
  const height = Math.max(320, Math.floor(window.innerHeight * dpr));
  if (canvas.width === width && canvas.height === height) return;
  canvas.width = width;
  canvas.height = height;
}

resizeCanvasToViewport();
window.addEventListener('resize', resizeCanvasToViewport, { passive: true });

const controls = createBuildControls(canvas);
const world = createGameWorld({ canvas, context, hud, controls });

const loop = createRealtimeRafLoop({
  world,
  maxDt: 0.05,
});

loop.stepWorldImmediate(0);
loop.start();
