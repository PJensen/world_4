import { BUILDING_DEFS, BuildMode, Building, Camera, World3State } from '../components.js';

const styleByKind = {
  house: { width: 52, height: 38 },
  farm: { width: 60, height: 30 },
  factory: { width: 62, height: 48 },
  road: { width: 64, height: 18 },
};

const TOOL_ORDER = ['house', 'farm', 'factory', 'road', 'bulldoze'];

function formatMoney(amount) {
  return `$${Math.round(amount).toLocaleString()}`;
}

function drawFittedText(context, text, x, y, maxWidth, options = {}) {
  const {
    minFontSize = 10,
    maxFontSize = 12,
    fontWeight = '',
    color = '#cbd5e1',
    align = 'left',
  } = options;

  let fontSize = maxFontSize;
  const weightPrefix = fontWeight ? `${fontWeight} ` : '';
  context.textAlign = align;
  context.textBaseline = 'alphabetic';
  context.fillStyle = color;

  while (fontSize > minFontSize) {
    context.font = `${weightPrefix}${fontSize}px system-ui, sans-serif`;
    if (context.measureText(text).width <= maxWidth) break;
    fontSize -= 1;
  }

  context.fillText(text, x, y);
  context.textAlign = 'left';
}

function getFactoryVariant(style, worldX = 0) {
  const variantSeed = Math.abs(Math.floor(worldX / 16));
  return {
    variantSeed,
    stackCount: 1 + (variantSeed % 3),
    toothCount: 2 + (variantSeed % 2),
    bodyTint: variantSeed % 2 === 0 ? '#374151' : '#3f3f46',
    roofTint: variantSeed % 2 === 0 ? '#4b5563' : '#52525b',
    style,
  };
}

function getFactoryStackOrigins(x, groundY, style, worldX = 0) {
  const y = groundY - style.height;
  const left = x + 1;
  const variant = getFactoryVariant(style, worldX);
  const origins = [];

  for (let stack = 0; stack < variant.stackCount; stack += 1) {
    const offsetX = left + style.width - 14 - stack * 11;
    const stackHeight = 20 + stack * 3;
    origins.push({
      x: offsetX + 4,
      y: y - stackHeight,
    });
  }

  return origins;
}

function drawSmokeSource(context, x, y) {
  context.save();
  const plume = context.createRadialGradient(x, y - 2, 1, x, y - 2, 16);
  plume.addColorStop(0, 'rgba(71, 85, 105, 0.38)');
  plume.addColorStop(0.6, 'rgba(100, 116, 139, 0.18)');
  plume.addColorStop(1, 'rgba(148, 163, 184, 0)');
  context.fillStyle = plume;
  context.beginPath();
  context.arc(x, y - 2, 16, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSky(context, canvas, groundY, timeOfDay = 0.58) {
  const daylight = Math.max(0, Math.sin(timeOfDay * Math.PI));
  const horizonMix = 0.25 + daylight * 0.55;

  const sky = context.createLinearGradient(0, 0, 0, groundY + 30);
  sky.addColorStop(0, `rgba(${Math.round(22 + daylight * 25)}, ${Math.round(20 + daylight * 20)}, ${Math.round(65 + daylight * 70)}, 1)`);
  sky.addColorStop(0.35, `rgba(${Math.round(70 + daylight * 55)}, ${Math.round(45 + daylight * 25)}, ${Math.round(96 + daylight * 40)}, 1)`);
  sky.addColorStop(0.72, `rgba(${Math.round(150 + daylight * 70)}, ${Math.round(90 + daylight * 55)}, ${Math.round(80 + daylight * 20)}, 1)`);
  sky.addColorStop(1, `rgba(${Math.round(190 + daylight * 55)}, ${Math.round(120 + daylight * 80)}, ${Math.round(90 + daylight * 30)}, 1)`);
  context.fillStyle = sky;
  context.fillRect(0, 0, canvas.width, groundY + 30);

  const sunX = canvas.width * (0.12 + timeOfDay * 0.76);
  const sunY = 66 + (1 - daylight) * 72;

  context.fillStyle = `rgba(255, 205, 120, ${0.18 + daylight * 0.22})`;
  context.beginPath();
  context.arc(sunX, sunY, 52 * horizonMix, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = `rgba(255, 210, 122, ${0.55 + daylight * 0.35})`;
  context.beginPath();
  context.arc(sunX, sunY, 24 * horizonMix, 0, Math.PI * 2);
  context.fill();
}

function drawWorld3Overlay(context, canvas, model) {
  const panelWidth = 328;
  const panelHeight = 254;
  const x = canvas.width - panelWidth - 12;
  const y = 72;

  context.fillStyle = 'rgba(2, 6, 23, 0.8)';
  context.fillRect(x, y, panelWidth, panelHeight);
  context.strokeStyle = '#334155';
  context.strokeRect(x, y, panelWidth, panelHeight);

  drawFittedText(context, 'World3 Live Overlay', x + 12, y + 18, panelWidth - 24, {
    maxFontSize: 12,
    fontWeight: 'bold',
    color: '#e2e8f0',
  });

  const rows = [
    `Treasury: ${formatMoney(model.money)}`,
    `Tax flow: ${formatMoney(model.taxRevenueAnnual)}/yr`,
    `Services: ${formatMoney(model.serviceCostsAnnual)}/yr`,
    `Net: ${formatMoney(model.netRevenueAnnual)}/yr`,
    `Population: ${Math.round(model.population).toLocaleString()}`,
    `Placed H/F/Fx/R: ${model.houses} / ${model.farms} / ${model.factories} / ${model.roads}`,
    `Road access H/F/Fx: ${model.connectedHouses}/${model.connectedFarms}/${model.connectedFactories} (${(model.roadCoverage * 100).toFixed(0)}%)`,
    `Food delivered: ${Math.round(model.foodDelivered)} / ${Math.round(model.foodDemand)}`,
    `Goods delivered: ${Math.round(model.goodsDelivered)} / ${Math.round(model.goodsDemand)}`,
    `Services delivered: ${Math.round(model.servicesDelivered)} / ${Math.round(model.servicesDemand)}`,
    `Workers: ${Math.round(model.workersUsed)} / ${Math.round(model.workersAvailable)}`,
    `Factory util: ${(model.factoryUtilization * 100).toFixed(0)}%`,
    `Traffic C/F/S: ${Math.round(model.commuterTraffic)} / ${Math.round(model.freightTraffic)} / ${Math.round(model.serviceTraffic)}`,
    `Congestion: ${(model.trafficLoad * 100).toFixed(0)}%  •  Pollution: ${model.pollution.toFixed(2)}`,
    `QoL: ${model.qualityOfLife.toFixed(2)}  •  TOD: ${Math.round(model.timeOfDay * 24)}:00`,
  ];

  rows.forEach((line, index) => {
    drawFittedText(context, line, x + 12, y + 36 + index * 14, panelWidth - 24, {
      maxFontSize: 11,
      minFontSize: 9,
      color: '#cbd5e1',
    });
  });
}

function drawStatsOverlay(context, canvas, model) {
  const panelWidth = Math.min(canvas.width - 24, 720);
  const panelHeight = 266;
  const x = 12;
  const y = 72;
  const plotX = x + 14;
  const plotY = y + 34;
  const plotWidth = panelWidth - 28;
  const plotHeight = 124;

  context.fillStyle = 'rgba(2, 6, 23, 0.82)';
  context.fillRect(x, y, panelWidth, panelHeight);
  context.strokeStyle = '#334155';
  context.strokeRect(x, y, panelWidth, panelHeight);

  drawFittedText(context, 'Flow Graphs', x + 12, y + 18, 110, {
    maxFontSize: 12,
    fontWeight: 'bold',
    color: '#e2e8f0',
  });
  drawFittedText(context, 'Road-network deliveries, bankroll, population, and traffic over time', x + 104, y + 18, panelWidth - 116, {
    maxFontSize: 12,
    minFontSize: 9,
    color: '#cbd5e1',
  });

  context.strokeStyle = 'rgba(148, 163, 184, 0.18)';
  for (let row = 0; row <= 4; row += 1) {
    const lineY = plotY + (plotHeight / 4) * row;
    context.beginPath();
    context.moveTo(plotX, lineY);
    context.lineTo(plotX + plotWidth, lineY);
    context.stroke();
  }

  const history = Array.isArray(model.history) ? model.history : [];
  const seriesDefs = [
    { key: 'foodDelivered', label: 'Food', color: '#86efac', formatter: (value) => Math.round(value).toLocaleString() },
    { key: 'goodsDelivered', label: 'Goods', color: '#93c5fd', formatter: (value) => Math.round(value).toLocaleString() },
    { key: 'servicesDelivered', label: 'Services', color: '#c084fc', formatter: (value) => Math.round(value).toLocaleString() },
    { key: 'money', label: 'Bankroll', color: '#fca5a5', formatter: (value) => formatMoney(value) },
    { key: 'population', label: 'Population', color: '#f8fafc', formatter: (value) => Math.round(value).toLocaleString() },
    { key: 'netRevenue', label: 'Net', color: '#fde047', formatter: (value) => `${formatMoney(value)}/yr` },
    { key: 'pollution', label: 'Pollution', color: '#f59e0b', formatter: (value) => value.toFixed(2) },
    { key: 'commuterTraffic', label: 'Commuters', color: '#22d3ee', formatter: (value) => Math.round(value).toLocaleString() },
    { key: 'freightTraffic', label: 'Freight', color: '#f97316', formatter: (value) => Math.round(value).toLocaleString() },
    { key: 'serviceTraffic', label: 'Service', color: '#facc15', formatter: (value) => Math.round(value).toLocaleString() },
  ];

  if (history.length > 1) {
    seriesDefs.forEach((series) => {
      const values = history.map((sample) => Number(sample[series.key] || 0));
      const min = Math.min(...values);
      const max = Math.max(...values);
      const span = max - min || 1;

      context.strokeStyle = series.color;
      context.lineWidth = 1.5;
      context.beginPath();
      history.forEach((sample, index) => {
        const value = Number(sample[series.key] || 0);
        const px = plotX + (index / (history.length - 1)) * plotWidth;
        const py = plotY + plotHeight - ((value - min) / span) * plotHeight;
        if (index === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      });
      context.stroke();
    });
  } else {
    drawFittedText(context, 'History will populate as the city runs.', plotX, plotY + plotHeight * 0.55, plotWidth, {
      maxFontSize: 12,
      color: '#94a3b8',
    });
  }

  seriesDefs.forEach((series, index) => {
    const column = index < 5 ? 0 : 1;
    const row = index % 5;
    const legendColumnWidth = (panelWidth - 40) / 2;
    const legendX = x + 14 + column * legendColumnWidth;
    const legendY = y + 182 + row * 14;
    const latest = history.length ? history[history.length - 1][series.key] : 0;
    context.fillStyle = series.color;
    context.fillRect(legendX, legendY - 7, 10, 4);
    drawFittedText(
      context,
      `${series.label}: ${series.formatter(Number(latest || 0))}`,
      legendX + 16,
      legendY,
      legendColumnWidth - 28,
      {
        maxFontSize: 11,
        minFontSize: 9,
        color: '#cbd5e1',
      },
    );
  });
}

function drawPlacementHud(context, canvas, selectedKind, money, message, overlayMode) {
  const toggleWidth = 132;
  const segmentWidth = (canvas.width - toggleWidth) / TOOL_ORDER.length;

  context.fillStyle = 'rgba(2, 6, 23, 0.86)';
  context.fillRect(0, 0, canvas.width, 56);
  context.strokeStyle = '#334155';
  context.beginPath();
  context.moveTo(0, 56);
  context.lineTo(canvas.width, 56);
  context.stroke();

  TOOL_ORDER.forEach((kind, index) => {
    const rule = BUILDING_DEFS[kind];
    const canAfford = kind === 'bulldoze' || (rule ? money >= rule.cost : true);
    const isSelected = kind === selectedKind;
    const x = index * segmentWidth;
    const label = kind === 'bulldoze' ? 'Bulldoze' : rule.label;
    const priceLabel = kind === 'bulldoze' ? 'refund' : formatMoney(rule.cost);

    context.fillStyle = isSelected
      ? (canAfford ? 'rgba(14, 116, 144, 0.6)' : 'rgba(153, 27, 27, 0.55)')
      : 'rgba(15, 23, 42, 0.35)';
    context.fillRect(x + 1, 1, segmentWidth - 2, 54);

    context.fillStyle = isSelected ? '#f8fafc' : '#cbd5e1';
    context.font = 'bold 13px system-ui, sans-serif';
    context.fillText(label, x + 10, 21);
    context.font = '12px system-ui, sans-serif';
    context.fillStyle = canAfford ? '#93c5fd' : '#fca5a5';
    context.fillText(priceLabel, x + 10, 40);
  });

  const toggleX = canvas.width - toggleWidth;
  const statsActive = overlayMode === 'stats';
  context.fillStyle = statsActive ? 'rgba(30, 41, 59, 0.9)' : 'rgba(14, 116, 144, 0.72)';
  context.fillRect(toggleX + 1, 1, toggleWidth - 2, 54);
  context.fillStyle = '#f8fafc';
  context.font = 'bold 13px system-ui, sans-serif';
  context.fillText(statsActive ? 'Live Tab' : 'Graph Tab', toggleX + 18, 24);
  context.font = '12px system-ui, sans-serif';
  context.fillStyle = '#cbd5e1';
  context.fillText(statsActive ? 'show metrics' : 'show flows', toggleX + 18, 41);

  context.fillStyle = '#e2e8f0';
  context.font = '13px system-ui, sans-serif';
  context.fillText(`Treasury ${formatMoney(money)}`, 12, canvas.height - 18);
  context.fillStyle = '#cbd5e1';
  context.fillText(message, 180, canvas.height - 18);
}

function drawRoad(context, x, groundY, style) {
  const top = groundY + 16;
  context.fillStyle = '#0f172a';
  context.fillRect(x, top, style.width, style.height);
  context.fillStyle = '#475569';
  for (let dash = 0; dash < 4; dash += 1) {
    context.fillRect(x + 6 + dash * 14, top + 8, 8, 2);
  }
  context.strokeStyle = '#64748b';
  context.strokeRect(x, top, style.width, style.height);
}

function drawHouse(context, x, groundY, style) {
  const y = groundY - style.height;
  const left = x + 3;

  context.fillStyle = '#4b5563';
  context.fillRect(left, y, style.width, style.height);

  context.fillStyle = '#6b7280';
  context.beginPath();
  context.moveTo(left - 2, y);
  context.lineTo(left + style.width * 0.5, y - 14);
  context.lineTo(left + style.width + 2, y);
  context.closePath();
  context.fill();

  context.fillStyle = '#fde68a';
  context.fillRect(left + 8, y + 9, 8, 7);
  context.fillRect(left + 22, y + 9, 8, 7);
  context.fillStyle = '#1f2937';
  context.fillRect(left + 35, y + 18, 10, style.height - 18);
}

function drawFarm(context, x, groundY, style) {
  const y = groundY - style.height;
  const left = x + 2;

  context.fillStyle = '#475569';
  context.fillRect(left, y + 5, style.width * 0.74, style.height - 5);
  context.fillStyle = '#64748b';
  context.fillRect(left + 4, y, style.width * 0.66, 6);

  context.fillStyle = '#84cc16';
  context.fillRect(left + style.width * 0.76, y + 10, style.width * 0.22, style.height - 10);
  context.fillStyle = '#65a30d';
  context.fillRect(left + style.width * 0.76, y + 10, style.width * 0.22, 5);

  context.fillStyle = '#fde68a';
  context.fillRect(left + 8, y + 12, 6, 6);
  context.fillRect(left + 18, y + 12, 6, 6);
  context.fillRect(left + 28, y + 12, 6, 6);
}

function drawFactory(context, x, groundY, style, worldX = 0) {
  const y = groundY - style.height;
  const left = x + 1;
  const variant = getFactoryVariant(style, worldX);

  context.fillStyle = variant.bodyTint;
  context.fillRect(left, y + 8, style.width, style.height - 8);

  context.fillStyle = variant.roofTint;
  context.beginPath();
  const toothWidth = style.width / (variant.toothCount + 1);
  context.moveTo(left, y + 8);
  for (let index = 0; index < variant.toothCount; index += 1) {
    const toothLeft = left + index * toothWidth;
    const peakX = toothLeft + toothWidth * 0.6;
    context.lineTo(peakX, y - 3);
    context.lineTo(peakX, y + 8);
  }
  context.lineTo(left + style.width, y + 8);
  context.lineTo(left + style.width, y + 14);
  context.lineTo(left, y + 14);
  context.closePath();
  context.fill();

  for (const stack of getFactoryStackOrigins(x, groundY, style, worldX)) {
    context.fillStyle = '#52525b';
    context.fillRect(stack.x - 4, stack.y + 8, 8, groundY - style.height - stack.y);
  }

  context.fillStyle = '#fcd34d';
  const windows = 3 + (variant.variantSeed % 2);
  for (let i = 0; i < windows; i += 1) {
    context.fillRect(left + 8 + i * 11, y + 18, 7, 6);
  }
}

function drawBuilding(context, kind, x, groundY, worldX = 0) {
  const style = styleByKind[kind] || styleByKind.house;
  if (kind === 'road') {
    drawRoad(context, x, groundY, style);
    return;
  }
  if (kind === 'factory') {
    drawFactory(context, x, groundY, style, worldX);
    return;
  }
  if (kind === 'farm') {
    drawFarm(context, x, groundY, style);
    return;
  }
  drawHouse(context, x, groundY, style);
}

function drawBulldozeGhost(context, x, groundY, tileSize, occupied) {
  context.save();
  context.strokeStyle = occupied ? '#fca5a5' : '#7f1d1d';
  context.lineWidth = 2;
  context.setLineDash([8, 6]);
  context.strokeRect(x + 4, groundY - 72, tileSize - 8, occupied ? 92 : 72);
  context.beginPath();
  context.moveTo(x + 10, groundY - 66);
  context.lineTo(x + tileSize - 10, groundY + 6);
  context.moveTo(x + tileSize - 10, groundY - 66);
  context.lineTo(x + 10, groundY + 6);
  context.stroke();
  context.restore();
}

function drawTraffic(context, roads, cameraX, groundY, model) {
  if (!roads.length) return;

  const layers = [
    { trips: model.commuterTraffic, color: '#7dd3fc', speed: 0.9, yOffset: 22, divisor: 18, radius: 3 },
    { trips: model.freightTraffic, color: '#fb923c', speed: 0.55, yOffset: 28, divisor: 14, radius: 4 },
    { trips: model.serviceTraffic, color: '#fde047', speed: 0.72, yOffset: 34, divisor: 20, radius: 2.5 },
  ];

  layers.forEach((layer) => {
    const vehicleCount = Math.min(18, Math.max(0, Math.round(layer.trips / layer.divisor)));
    for (let index = 0; index < vehicleCount; index += 1) {
      const seed = model.simTime * layer.speed + index * 0.618;
      const roadIndex = Math.floor(seed * 1.7) % roads.length;
      const phase = seed - Math.floor(seed);
      const roadX = roads[(roadIndex + roads.length) % roads.length];
      const x = roadX - cameraX + 8 + phase * 48;
      const y = groundY + layer.yOffset;
      context.fillStyle = layer.color;
      context.beginPath();
      context.arc(x, y, layer.radius, 0, Math.PI * 2);
      context.fill();
    }
  });
}

function collectVisibleLots(world, cameraX, canvasWidth) {
  const lots = new Map();
  for (const [id, building] of world.query(Building)) {
    const sx = building.x - cameraX;
    if (sx < -120 || sx > canvasWidth + 120) continue;
    const lot = lots.get(building.x) || { x: building.x, screenX: sx, road: null, structure: null };
    if (building.kind === 'road') lot.road = { id, building };
    else lot.structure = { id, building };
    lots.set(building.x, lot);
  }
  return [...lots.values()].sort((left, right) => left.x - right.x);
}

export function createRenderSystem(canvas, context, hud, controls, smokeFx) {
  return function renderSystem(world, dt = 1 / 60) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#0f172a';
    context.fillRect(0, 0, canvas.width, canvas.height);

    let cameraX = 0;
    let tileSize = 64;
    let groundY = 420;
    let selectedKind = controls.getSelectedKind();
    let overlayMode = controls.getOverlayMode ? controls.getOverlayMode() : 'overview';
    let model = null;
    for (const [id, camera, mode] of world.query(Camera, BuildMode)) {
      cameraX = camera.x;
      tileSize = mode.tileSize;
      groundY = mode.groundY;
      selectedKind = mode.selectedKind;
      overlayMode = mode.overlayMode;
      break;
    }

    const modelTuple = world.query(World3State)[Symbol.iterator]().next().value;
    model = modelTuple ? modelTuple[1] : null;

    drawSky(context, canvas, groundY, model ? model.timeOfDay : 0.58);

    context.fillStyle = '#1e293b';
    context.fillRect(0, groundY, canvas.width, canvas.height - groundY);

    context.strokeStyle = '#334155';
    context.lineWidth = 1;
    const startGridX = -((cameraX % tileSize + tileSize) % tileSize);
    for (let x = startGridX; x <= canvas.width; x += tileSize) {
      context.beginPath();
      context.moveTo(x, groundY);
      context.lineTo(x, canvas.height);
      context.stroke();
    }

    const counts = { house: 0, farm: 0, factory: 0, road: 0 };
    const smokeOrigins = [];
    const activeSmokeKeys = new Set();
    const occupied = new Map();
    const visibleLots = collectVisibleLots(world, cameraX, canvas.width);
    const visibleRoads = [];
    for (const lot of visibleLots) {
      if (lot.road) {
        visibleRoads.push(lot.x);
        counts.road += 1;
        drawBuilding(context, 'road', lot.screenX, groundY, lot.x);
      }
      if (lot.structure) {
        counts[lot.structure.building.kind] = (counts[lot.structure.building.kind] || 0) + 1;
      }
      occupied.set(lot.x, Boolean(lot.road || lot.structure));
    }

    drawTraffic(context, visibleRoads, cameraX, groundY, model || { commuterTraffic: 0, freightTraffic: 0, serviceTraffic: 0, simTime: 0 });

    for (const lot of visibleLots) {
      if (!lot.structure) continue;
      const { id, building } = lot.structure;
      drawBuilding(context, building.kind, lot.screenX, groundY, building.x);

      if (building.kind === 'factory') {
        const style = styleByKind.factory;
        const stacks = getFactoryStackOrigins(lot.screenX, groundY, style, building.x);
        for (let stackIndex = 0; stackIndex < stacks.length; stackIndex += 1) {
          drawSmokeSource(context, stacks[stackIndex].x, stacks[stackIndex].y);
          const key = `factory:${id}:stack:${stackIndex}`;
          activeSmokeKeys.add(key);
          smokeFx.ensureEmitter(key, {
            rate: 20,
            speed: 18,
            speedJitter: 0.5,
            spread: Math.PI / 5,
            life: 3.4,
            lifeJitter: 0.35,
            size: 14,
            sizeEnd: 38,
            alpha0: 0.52,
            alpha1: 0,
            ax: 6,
            ay: -8,
            offsetY: -3,
            blur: 10,
            colorA: { r: 68, g: 72, b: 82 },
            colorB: { r: 140, g: 149, b: 160 },
          });
          smokeOrigins.push({
            key,
            x: stacks[stackIndex].x,
            y: stacks[stackIndex].y,
          });
        }
      }
    }

    smokeFx.syncEmitters(activeSmokeKeys);
    smokeFx.step(dt, smokeOrigins);
    smokeFx.render(context);

    const pointerX = controls.getPointerX();
    const snappedWorldX = Math.floor((cameraX + pointerX) / tileSize) * tileSize;
    const ghostScreenX = snappedWorldX - cameraX;
    const selectedRule = BUILDING_DEFS[selectedKind] || BUILDING_DEFS.house;
    const canAffordSelection = selectedKind === 'bulldoze' || !model || model.money >= selectedRule.cost;
    if (selectedKind === 'bulldoze') {
      drawBulldozeGhost(context, ghostScreenX, groundY, tileSize, occupied.get(snappedWorldX));
    } else {
      if (selectedKind === 'road') {
        context.globalAlpha = canAffordSelection ? 0.5 : 0.2;
        drawBuilding(context, selectedKind, ghostScreenX, groundY, snappedWorldX);
      } else {
        if (!occupied.get(snappedWorldX)) {
          context.globalAlpha = 0.25;
          drawBuilding(context, 'road', ghostScreenX, groundY, snappedWorldX);
        }
        context.globalAlpha = canAffordSelection ? 0.45 : 0.2;
        drawBuilding(context, selectedKind, ghostScreenX, groundY, snappedWorldX);
      }
      context.globalAlpha = 1;

      if (!canAffordSelection) {
        context.fillStyle = 'rgba(239, 68, 68, 0.18)';
        context.fillRect(ghostScreenX, groundY - 72, tileSize, 72);
      }
    }

    drawPlacementHud(
      context,
      canvas,
      selectedKind,
      model ? model.money : 0,
      model ? model.lastActionText : 'Build carefully.',
      overlayMode,
    );

    if (model) {
      if (overlayMode === 'stats') drawStatsOverlay(context, canvas, model);
      else drawWorld3Overlay(context, canvas, model);
    }

    if (hud) {
      const smokeStats = smokeFx.stats();
      hud.textContent = [
        `camera ${cameraX.toFixed(0)}m`,
        `selected ${selectedKind}${selectedKind === 'bulldoze' ? '' : ` ${formatMoney(selectedRule.cost)}`}`,
        `tab ${overlayMode}`,
        model ? `treasury ${formatMoney(model.money)}` : null,
        model ? `net ${formatMoney(model.netRevenueAnnual)}/yr` : null,
        model ? `lots ${model.houses}/${model.farms}/${model.factories}/${model.roads}` : null,
        model ? `flows ${Math.round(model.foodDelivered)}/${Math.round(model.goodsDelivered)}/${Math.round(model.servicesDelivered)}` : null,
        model ? `traffic ${Math.round(model.commuterTraffic)}/${Math.round(model.freightTraffic)}/${Math.round(model.serviceTraffic)}` : null,
        `smoke ${smokeStats.activeParticles}/${smokeStats.emitters}`,
        model ? `workers ${Math.round(model.workersUsed)}/${Math.round(model.workersAvailable)}` : null,
        model ? `util ${(model.factoryUtilization * 100).toFixed(0)}%` : null,
        model ? `pop ${Math.round(model.population).toLocaleString()}` : null,
      ].filter(Boolean).join(' · ');
    }
  };
}
