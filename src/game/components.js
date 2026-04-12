import { defineComponent } from '../lib/ecs-js/index.js';

export const BUILDING_DEFS = Object.freeze({
	house: Object.freeze({
		label: 'House',
		cost: 1500,
		upkeepAnnual: 95,
		refundRate: 0.5,
	}),
	farm: Object.freeze({
		label: 'Farm',
		cost: 1200,
		upkeepAnnual: 70,
		refundRate: 0.5,
	}),
	factory: Object.freeze({
		label: 'Factory',
		cost: 4000,
		upkeepAnnual: 260,
		refundRate: 0.45,
	}),
	commercial: Object.freeze({
		label: 'Commercial',
		cost: 2600,
		upkeepAnnual: 180,
		refundRate: 0.45,
	}),
	civic: Object.freeze({
		label: 'Civic',
		cost: 3400,
		upkeepAnnual: 340,
		refundRate: 0.4,
	}),
	logistics: Object.freeze({
		label: 'Logistics',
		cost: 3000,
		upkeepAnnual: 190,
		refundRate: 0.4,
	}),
	plumbing: Object.freeze({
		label: 'Pump House',
		cost: 2800,
		upkeepAnnual: 210,
		refundRate: 0.4,
	}),
	power: Object.freeze({
		label: 'Power Plant',
		cost: 3600,
		upkeepAnnual: 260,
		refundRate: 0.4,
	}),
	road: Object.freeze({
		label: 'Road',
		cost: 300,
		upkeepAnnual: 55,
		refundRate: 0.35,
	}),
	pipe: Object.freeze({
		label: 'Pipe',
		cost: 180,
		upkeepAnnual: 28,
		refundRate: 0.35,
	}),
	powerline: Object.freeze({
		label: 'Power Line',
		cost: 220,
		upkeepAnnual: 34,
		refundRate: 0.35,
	}),
});

export const UNDERLAY_KINDS = Object.freeze(['road', 'pipe', 'powerline']);

export const VIEW_ZOOM = 1.3;

export const TOOL_SEGMENT_WIDTH = 140;

export const Camera = defineComponent('Camera', {
	x: 0,
	speed: 420,
	minX: 0,
});

export const BuildMode = defineComponent('BuildMode', {
	selectedKind: 'house',
	overlayMode: 'stats',
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
	commercials: 0,
	civics: 0,
	logistics: 0,
	plumbings: 0,
	powerPlants: 0,
	roads: 0,
	pipes: 0,
	powerLines: 0,
	connectedHouses: 0,
	connectedFarms: 0,
	connectedFactories: 0,
	connectedCommercials: 0,
	connectedCivics: 0,
	connectedLogistics: 0,
	connectedPlumbings: 0,
	connectedPowerPlants: 0,
	roadCoverage: 0,
	pipeCoverage: 0,
	powerCoverage: 0,
	foodDelivered: 0,
	foodShortfall: 0,
	laborDelivered: 0,
	goodsDemand: 0,
	goodsDelivered: 0,
	waterDemand: 0,
	waterDelivered: 0,
	sewerDemand: 0,
	sewerHandled: 0,
	powerDemand: 0,
	powerDelivered: 0,
	servicesDemand: 0,
	servicesDelivered: 0,
	civicEffect: 1,
	logisticsEffect: 1,
	plumbingEffect: 1,
	powerEffect: 1,
	workersAvailable: 0,
	workersUsed: 0,
	factoryUtilization: 0,
	commuterTraffic: 0,
	freightTraffic: 0,
	serviceTraffic: 0,
	trafficLoad: 0,
	currentTrips: [],
	money: 100000,
	taxRevenueAnnual: 0,
	serviceCostsAnnual: 0,
	netRevenueAnnual: 0,
	history: [],
	historySampleTimer: 0,
	lastActionText: 'Start zoning. Every building costs money.',
	lastActionTimer: 0,
	simTime: 0,
	timeOfDay: 0.58,
});
