import { defineComponent } from '../lib/ecs-js/index.js';

export const Camera = defineComponent('Camera', {
	x: 0,
	speed: 420,
	minX: 0,
});

export const BuildMode = defineComponent('BuildMode', {
	selectedKind: 'house',
	tileSize: 64,
	groundY: 420,
});

export const Building = defineComponent('Building', {
	kind: 'house',
	x: 0,
});

export const World3State = defineComponent('World3State', {
	population: 3.8e9,
	resources: 1,
	pollution: 0.12,
	foodPerCapita: 1,
	industrialOutput: 0.35,
	birthRate: 0.026,
	deathRate: 0.011,
	qualityOfLife: 0.72,
	houses: 0,
	farms: 0,
	factories: 0,
	workersAvailable: 0,
	workersUsed: 0,
	factoryUtilization: 0,
	timeOfDay: 0.58,
});
