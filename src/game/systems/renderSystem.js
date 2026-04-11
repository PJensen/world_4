import { BUILDING_DEFS, BuildMode, Building, Camera, World3State } from '../components.js';

const styleByKind = {
  house: { width: 52, height: 38 },
  farm: { width: 60, height: 30 },
  factory: { width: 62, height: 48 },
  commercial: { width: 60, height: 42 },
  civic: { width: 58, height: 54 },
  logistics: { width: 62, height: 34 },
  road: { width: 64, height: 18 },
};

const BUILD_TOOL_ORDER = Object.freeze(Object.keys(BUILDING_DEFS));
const TOOL_ORDER = [...BUILD_TOOL_ORDER, 'bulldoze'];

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
    `Placed H/F/Fx/C/Cv/L/R: ${model.houses} / ${model.farms} / ${model.factories} / ${model.commercials} / ${model.civics} / ${model.logistics} / ${model.roads}`,
    `Road access all: ${model.connectedHouses}/${model.connectedFarms}/${model.connectedFactories}/${model.connectedCommercials}/${model.connectedCivics}/${model.connectedLogistics}`,
    `Food delivered: ${Math.round(model.foodDelivered)} / ${Math.round(model.foodDemand)}`,
    `Goods delivered: ${Math.round(model.goodsDelivered)} / ${Math.round(model.goodsDemand)}`,
    `Services delivered: ${Math.round(model.servicesDelivered)} / ${Math.round(model.servicesDemand)}`,
    `Workers: ${Math.round(model.workersUsed)} / ${Math.round(model.workersAvailable)}`,
    `Factory util: ${(model.factoryUtilization * 100).toFixed(0)}%  •  Civic ${(model.civicEffect * 100).toFixed(0)}%`,
    `Traffic C/F/S: ${Math.round(model.commuterTraffic)} / ${Math.round(model.freightTraffic)} / ${Math.round(model.serviceTraffic)}`,
    `Congestion: ${(model.trafficLoad * 100).toFixed(0)}%  •  Logistics ${(model.logisticsEffect * 100).toFixed(0)}%`,
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

function formatCompactNumber(value) {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

function getSeriesBounds(history, seriesList) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const series of seriesList) {
    for (const sample of history) {
      const value = Number(sample[series.key] || 0);
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    if (series.includeZero !== false) {
      min = Math.min(min, 0);
      max = Math.max(max, 0);
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (min === max) {
    const spread = Math.max(1, Math.abs(max) * 0.1);
    return { min: min - spread, max: max + spread };
  }

  const padding = (max - min) * 0.08;
  return { min: min - padding, max: max + padding };
}

function drawPlotFrame(context, x, y, width, height, bounds) {
  context.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  context.strokeRect(x, y, width, height);

  for (let row = 0; row <= 3; row += 1) {
    const lineY = y + (height / 3) * row;
    context.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    context.beginPath();
    context.moveTo(x, lineY);
    context.lineTo(x + width, lineY);
    context.stroke();
  }

  if (bounds.min < 0 && bounds.max > 0) {
    const zeroY = y + height - ((0 - bounds.min) / (bounds.max - bounds.min)) * height;
    context.strokeStyle = 'rgba(248, 250, 252, 0.3)';
    context.beginPath();
    context.moveTo(x, zeroY);
    context.lineTo(x + width, zeroY);
    context.stroke();
  }
}

function drawSeriesGroup(context, history, panel) {
  const { x, y, width, height, title, seriesList } = panel;
  const legendWidth = 138;
  const plotX = x + 8;
  const plotY = y + 22;
  const plotWidth = width - legendWidth - 20;
  const plotHeight = height - 42;
  const legendX = plotX + plotWidth + 12;
  const bounds = getSeriesBounds(history, seriesList);

  drawFittedText(context, title, x + 8, y + 14, width - 16, {
    maxFontSize: 11,
    fontWeight: 'bold',
    color: '#e2e8f0',
  });
  drawPlotFrame(context, plotX, plotY, plotWidth, plotHeight, bounds);

  seriesList.forEach((series) => {
    context.strokeStyle = series.color;
    context.lineWidth = 1.6;
    context.beginPath();
    history.forEach((sample, index) => {
      const value = Number(sample[series.key] || 0);
      const px = plotX + (index / Math.max(1, history.length - 1)) * plotWidth;
      const py = plotY + plotHeight - ((value - bounds.min) / (bounds.max - bounds.min)) * plotHeight;
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    });
    context.stroke();

    const latest = Number(history[history.length - 1]?.[series.key] || 0);
    const latestX = plotX + plotWidth;
    const latestY = plotY + plotHeight - ((latest - bounds.min) / (bounds.max - bounds.min)) * plotHeight;
    context.fillStyle = series.color;
    context.beginPath();
    context.arc(latestX, latestY, 2.5, 0, Math.PI * 2);
    context.fill();
  });

  drawFittedText(context, formatCompactNumber(bounds.max), plotX, plotY - 4, 72, {
    maxFontSize: 9,
    color: '#94a3b8',
  });
  drawFittedText(context, formatCompactNumber(bounds.min), plotX, plotY + plotHeight + 12, 72, {
    maxFontSize: 9,
    color: '#94a3b8',
  });

  seriesList.forEach((series, index) => {
    const latest = Number(history[history.length - 1]?.[series.key] || 0);
    const legendY = plotY + 10 + index * 16;
    context.fillStyle = series.color;
    context.fillRect(legendX, legendY - 6, 10, 4);
    drawFittedText(context, series.label, legendX + 16, legendY, legendWidth - 20, {
      maxFontSize: 10,
      fontWeight: 'bold',
      color: '#e2e8f0',
    });
    drawFittedText(context, formatCompactNumber(latest), legendX + 16, legendY + 11, legendWidth - 20, {
      maxFontSize: 10,
      minFontSize: 8,
      color: '#94a3b8',
    });
  });
}

function drawStatsOverlay(context, canvas, model) {
  const marginX = 18;
  const panelWidth = canvas.width - marginX * 2;
  const panelHeight = 336;
  const x = marginX;
  const y = 72;

  context.fillStyle = 'rgba(2, 6, 23, 0.82)';
  context.fillRect(x, y, panelWidth, panelHeight);
  context.strokeStyle = '#334155';
  context.strokeRect(x, y, panelWidth, panelHeight);

  drawFittedText(context, 'Flow Graphs', x + 12, y + 18, 110, {
    maxFontSize: 12,
    fontWeight: 'bold',
    color: '#e2e8f0',
  });
  drawFittedText(context, 'Conventional full-history charts for economy, flows, and traffic', x + 104, y + 18, panelWidth - 116, {
    maxFontSize: 12,
    minFontSize: 9,
    color: '#cbd5e1',
  });

  const history = Array.isArray(model.history) ? model.history : [];
  const warmupThreshold = 12;
  const groups = [
    {
      title: 'Economy',
      seriesList: [
        { key: 'money', label: 'Bankroll', color: '#fca5a5' },
        { key: 'population', label: 'Population', color: '#f8fafc' },
        { key: 'netRevenue', label: 'Net', color: '#fde047' },
        { key: 'qualityOfLife', label: 'QoL', color: '#a7f3d0', includeZero: false },
      ],
    },
    {
      title: 'Delivered Flows',
      seriesList: [
        { key: 'foodDelivered', label: 'Food', color: '#86efac' },
        { key: 'goodsDelivered', label: 'Goods', color: '#93c5fd' },
        { key: 'servicesDelivered', label: 'Services', color: '#c084fc' },
      ],
    },
    {
      title: 'Traffic And Load',
      seriesList: [
        { key: 'commuterTraffic', label: 'Commuters', color: '#22d3ee' },
        { key: 'freightTraffic', label: 'Freight', color: '#f97316' },
        { key: 'serviceTraffic', label: 'Service', color: '#facc15' },
        { key: 'pollution', label: 'Pollution', color: '#f59e0b' },
      ],
    },
  ];

  if (history.length >= warmupThreshold) {
    groups.forEach((group, index) => {
      drawSeriesGroup(context, history, {
        x: x + 12,
        y: y + 34 + index * 92,
        width: panelWidth - 24,
        height: 86,
        title: group.title,
        seriesList: group.seriesList,
      });
    });
  } else {
    context.fillStyle = 'rgba(15, 23, 42, 0.7)';
    context.fillRect(x + 12, y + 34, panelWidth - 24, 276);
    context.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    context.strokeRect(x + 12, y + 34, panelWidth - 24, 276);
    drawFittedText(context, 'Collecting enough history for a real graph...', x + panelWidth / 2, y + 146, panelWidth - 80, {
      maxFontSize: 16,
      minFontSize: 12,
      color: '#e2e8f0',
      fontWeight: 'bold',
      align: 'center',
    });
    drawFittedText(context, `${history.length}/${warmupThreshold} samples captured`, x + panelWidth / 2, y + 170, panelWidth - 80, {
      maxFontSize: 12,
      color: '#94a3b8',
      align: 'center',
    });
  }
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

function drawCommercial(context, x, groundY, style) {
  const y = groundY - style.height;
  const left = x + 2;

  context.fillStyle = '#1d4ed8';
  context.fillRect(left, y + 10, style.width, style.height - 10);
  context.fillStyle = '#f8fafc';
  context.fillRect(left + 4, y + 18, style.width - 8, 10);
  context.fillStyle = '#0f172a';
  context.fillRect(left + 24, y + 28, 12, style.height - 18);

  const awningColors = ['#ef4444', '#f8fafc', '#ef4444', '#f8fafc', '#ef4444'];
  awningColors.forEach((color, index) => {
    context.fillStyle = color;
    context.fillRect(left + 4 + index * 10, y + 8, 10, 12);
  });
}

function drawCivic(context, x, groundY, style) {
  const y = groundY - style.height;
  const left = x + 3;

  context.fillStyle = '#cbd5e1';
  context.fillRect(left + 6, y + 18, style.width - 12, style.height - 18);
  context.fillStyle = '#94a3b8';
  context.beginPath();
  context.moveTo(left, y + 18);
  context.lineTo(left + style.width * 0.5, y + 2);
  context.lineTo(left + style.width, y + 18);
  context.closePath();
  context.fill();
  context.fillStyle = '#1e293b';
  for (let index = 0; index < 3; index += 1) {
    context.fillRect(left + 13 + index * 10, y + 26, 4, style.height - 26);
  }
  context.fillStyle = '#f59e0b';
  context.beginPath();
  context.arc(left + style.width * 0.5, y + 10, 5, 0, Math.PI * 2);
  context.fill();
}

function drawLogistics(context, x, groundY, style) {
  const y = groundY - style.height;
  const left = x + 1;

  context.fillStyle = '#475569';
  context.fillRect(left, y + 12, style.width, style.height - 12);
  context.fillStyle = '#64748b';
  context.fillRect(left + 6, y + 4, 20, 12);
  context.fillRect(left + 30, y + 18, 24, 8);
  context.fillStyle = '#22c55e';
  context.fillRect(left + 8, y + 18, 14, 8);
  context.fillStyle = '#0f172a';
  context.fillRect(left + 8, y + 28, 16, 12);
  context.fillRect(left + 32, y + 28, 22, 12);
  context.fillStyle = '#f8fafc';
  context.fillRect(left + 41, y + 8, 3, 16);
  context.fillRect(left + 44, y + 8, 8, 3);
}

function drawBuilding(context, kind, x, groundY, worldX = 0) {
  const style = styleByKind[kind] || styleByKind.house;
  if (kind === 'road') {
    drawRoad(context, x, groundY, style);
    return;
  }
  if (kind === 'logistics') {
    drawLogistics(context, x, groundY, style);
    return;
  }
  if (kind === 'civic') {
    drawCivic(context, x, groundY, style);
    return;
  }
  if (kind === 'commercial') {
    drawCommercial(context, x, groundY, style);
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
        model ? `lots ${model.houses}/${model.farms}/${model.factories}/${model.commercials}/${model.civics}/${model.logistics}/${model.roads}` : null,
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
