import { defineComponent } from '../lib/ecs-js/index.js';

export const BUILDING_DEFS = Object.freeze({
	house: Object.freeze({
		label: 'House',
		cost: 1500,
	}),
	farm: Object.freeze({
		label: 'Farm',
		cost: 1200,
	}),
	factory: Object.freeze({
		label: 'Factory',
		cost: 4000,
	}),
});

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
	population: 120,
	resources: 1,
	pollution: 0.12,
	foodOutput: 140,
	foodDemand: 120,
	foodPerCapita: 1.16,
	industrialOutput: 0.85,
	birthRate: 0.021,
	deathRate: 0.012,
	qualityOfLife: 0.72,
	houses: 0,
	farms: 0,
	factories: 0,
	workersAvailable: 0,
	workersUsed: 0,
	factoryUtilization: 0,
	money: 10000,
	taxRevenueAnnual: 0,
	serviceCostsAnnual: 0,
	netRevenueAnnual: 0,
	lastActionText: 'Start zoning. Every building costs money.',
	lastActionTimer: 0,
	timeOfDay: 0.58,
});
