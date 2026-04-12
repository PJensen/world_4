import { BUILDING_DEFS, BuildMode, Building, Camera, TOOL_SEGMENT_WIDTH, UNDERLAY_KINDS, VIEW_ZOOM, World3State } from '../components.js';

const styleByKind = {
  house: { width: 52, height: 38 },
  farm: { width: 60, height: 30 },
  factory: { width: 62, height: 48 },
  commercial: { width: 60, height: 42 },
  civic: { width: 58, height: 54 },
  logistics: { width: 62, height: 34 },
  plumbing: { width: 58, height: 44 },
  power: { width: 64, height: 50 },
  road: { width: 64, height: 18 },
  pipe: { width: 64, height: 8 },
  powerline: { width: 64, height: 56 },
};

const BUILD_TOOL_ORDER = Object.freeze(Object.keys(BUILDING_DEFS));
const TOOL_ORDER = [...BUILD_TOOL_ORDER, 'bulldoze'];
const TRIP_COLOR_BY_ORIGIN = Object.freeze({
  house: '#f8fafc',
  farm: '#84cc16',
  factory: '#f59e0b',
  commercial: '#60a5fa',
  civic: '#cbd5e1',
  logistics: '#22c55e',
  plumbing: '#38bdf8',
  power: '#fbbf24',
});

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

function getPowerPlantStackOrigins(x, groundY, style) {
  const y = groundY - style.height;
  const left = x + 2;
  return [
    { x: left + 17, y: y + 2 },
    { x: left + 47, y: y + 6 },
  ];
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
    `Placed H/F/Fx/C/Cv/L/Pw/Pm/R/Pi/El: ${model.houses} / ${model.farms} / ${model.factories} / ${model.commercials} / ${model.civics} / ${model.logistics} / ${model.plumbings} / ${model.powerPlants} / ${model.roads} / ${model.pipes} / ${model.powerLines}`,
    `Road access all: ${model.connectedHouses}/${model.connectedFarms}/${model.connectedFactories}/${model.connectedCommercials}/${model.connectedCivics}/${model.connectedLogistics}/${model.connectedPlumbings}/${model.connectedPowerPlants}`,
    `Utilities W/S/P: ${Math.round(model.waterDelivered)} / ${Math.round(model.sewerHandled)} / ${Math.round(model.powerDelivered)}`,
    `Utility demand W/S/P: ${Math.round(model.waterDemand)} / ${Math.round(model.sewerDemand)} / ${Math.round(model.powerDemand)}`,
    `Food delivered: ${Math.round(model.foodDelivered)} / ${Math.round(model.foodDemand)}`,
    `Goods delivered: ${Math.round(model.goodsDelivered)} / ${Math.round(model.goodsDemand)}`,
    `Services delivered: ${Math.round(model.servicesDelivered)} / ${Math.round(model.servicesDemand)}`,
    `Workers: ${Math.round(model.workersUsed)} / ${Math.round(model.workersAvailable)}`,
    `Factory util: ${(model.factoryUtilization * 100).toFixed(0)}%  •  Civic ${(model.civicEffect * 100).toFixed(0)}%`,
    `Traffic C/F/S: ${Math.round(model.commuterTraffic)} / ${Math.round(model.freightTraffic)} / ${Math.round(model.serviceTraffic)}`,
    `Congestion: ${(model.trafficLoad * 100).toFixed(0)}%  •  Logistics ${(model.logisticsEffect * 100).toFixed(0)}%`,
    `Pipe ${(model.pipeCoverage * 100).toFixed(0)}%  •  Power ${(model.powerCoverage * 100).toFixed(0)}%`,
    `Plumbing: ${(model.plumbingEffect * 100).toFixed(0)}%  •  Power ${(model.powerEffect * 100).toFixed(0)}%`,
    `Pollution: ${model.pollution.toFixed(2)}`,
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
  const labelGutter = Math.max(110, Math.min(148, Math.floor(width * 0.34)));
  const plotX = x + 8;
  const plotY = y + 22;
  const plotWidth = width - labelGutter - 18;
  const plotHeight = height - 42;
  const labelX = plotX + plotWidth + 10;
  const bounds = getSeriesBounds(history, seriesList);

  drawFittedText(context, title, plotX + plotWidth - 4, y + 14, plotWidth - 8, {
    maxFontSize: 11,
    fontWeight: 'bold',
    color: '#e2e8f0',
    align: 'right',
  });
  drawPlotFrame(context, plotX, plotY, plotWidth, plotHeight, bounds);

  const endpointLabels = [];

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

    endpointLabels.push({
      label: `${series.label} ${formatCompactNumber(latest)}`,
      color: series.color,
      x: labelX,
      y: latestY + 3,
      anchorX: latestX,
    });
  });

  drawFittedText(context, formatCompactNumber(bounds.max), plotX, plotY - 4, 72, {
    maxFontSize: 9,
    color: '#94a3b8',
  });
  drawFittedText(context, formatCompactNumber(bounds.min), plotX, plotY + plotHeight + 12, 72, {
    maxFontSize: 9,
    color: '#94a3b8',
  });

  endpointLabels
    .sort((left, right) => left.y - right.y)
    .forEach((entry, index) => {
      const previous = index > 0 ? endpointLabels[index - 1] : null;
      if (previous && entry.y - previous.y < 12) entry.y = previous.y + 12;
      entry.y = Math.max(plotY + 8, Math.min(plotY + plotHeight + 10, entry.y));
    });

  endpointLabels.forEach((entry) => {
    context.strokeStyle = entry.color;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(entry.anchorX + 3, entry.y - 3);
    context.lineTo(labelX - 4, entry.y - 3);
    context.stroke();

    drawFittedText(context, entry.label, entry.x, entry.y, labelGutter - 10, {
      maxFontSize: 9,
      minFontSize: 8,
      color: entry.color,
    });
  });

  context.strokeStyle = 'rgba(148, 163, 184, 0.1)';
  context.beginPath();
  context.moveTo(labelX - 8, plotY);
  context.lineTo(labelX - 8, plotY + plotHeight);
  context.stroke();
}

function drawStatsOverlay(context, canvas, model) {
  const marginX = 18;
  const panelWidth = canvas.width - marginX * 2;
  const panelHeight = 186;
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
    const innerGap = 10;
    const groupWidth = (panelWidth - 24 - innerGap * (groups.length - 1)) / groups.length;
    groups.forEach((group, index) => {
      drawSeriesGroup(context, history, {
        x: x + 12 + index * (groupWidth + innerGap),
        y: y + 34,
        width: groupWidth,
        height: 126,
        title: group.title,
        seriesList: group.seriesList,
      });
    });
  } else {
    context.fillStyle = 'rgba(15, 23, 42, 0.7)';
    context.fillRect(x + 12, y + 34, panelWidth - 24, 126);
    context.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    context.strokeRect(x + 12, y + 34, panelWidth - 24, 126);
    drawFittedText(context, 'Collecting enough history for a real graph...', x + panelWidth / 2, y + 92, panelWidth - 80, {
      maxFontSize: 16,
      minFontSize: 12,
      color: '#e2e8f0',
      fontWeight: 'bold',
      align: 'center',
    });
    drawFittedText(context, `${history.length}/${warmupThreshold} samples captured`, x + panelWidth / 2, y + 116, panelWidth - 80, {
      maxFontSize: 12,
      color: '#94a3b8',
      align: 'center',
    });
  }
}

function drawPlacementHud(context, canvas, selectedKind, money, message, overlayMode, toolbarScrollX) {
  const toggleWidth = 132;
  const segmentWidth = TOOL_SEGMENT_WIDTH;
  const toolAreaWidth = canvas.width - toggleWidth;
  const totalToolsWidth = TOOL_ORDER.length * segmentWidth;
  const maxScroll = Math.max(0, totalToolsWidth - toolAreaWidth);
  const scrollX = Math.max(0, Math.min(maxScroll, toolbarScrollX || 0));

  context.fillStyle = '#020617';
  context.fillRect(0, 0, canvas.width, 56);

  context.save();
  context.beginPath();
  context.rect(0, 0, toolAreaWidth, 56);
  context.clip();

  TOOL_ORDER.forEach((kind, index) => {
    const rule = BUILDING_DEFS[kind];
    const canAfford = kind === 'bulldoze' || (rule ? money >= rule.cost : true);
    const isSelected = kind === selectedKind;
    const x = index * segmentWidth - scrollX;
    if (x + segmentWidth < 0 || x > toolAreaWidth) return;
    const label = kind === 'bulldoze' ? 'Bulldoze' : rule.label;
    const priceLabel = kind === 'bulldoze' ? 'refund' : formatMoney(rule.cost);

    context.fillStyle = isSelected
      ? (canAfford ? 'rgba(14, 116, 144, 0.6)' : 'rgba(153, 27, 27, 0.55)')
      : 'rgba(15, 23, 42, 0.35)';
    context.fillRect(x + 1, 1, segmentWidth - 2, 54);

    drawFittedText(context, label, x + 12, 22, segmentWidth - 22, {
      maxFontSize: 15,
      minFontSize: 10,
      fontWeight: 'bold',
      color: isSelected ? '#f8fafc' : '#cbd5e1',
    });
    drawFittedText(context, priceLabel, x + 12, 42, segmentWidth - 22, {
      maxFontSize: 14,
      minFontSize: 10,
      color: canAfford ? '#93c5fd' : '#fca5a5',
    });
  });

  context.restore();

  if (scrollX > 0) {
    const fadeL = context.createLinearGradient(0, 0, 36, 0);
    fadeL.addColorStop(0, '#020617');
    fadeL.addColorStop(1, 'rgba(2, 6, 23, 0)');
    context.fillStyle = fadeL;
    context.fillRect(0, 0, 36, 56);
    context.fillStyle = '#94a3b8';
    context.font = '18px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText('\u25C0', 14, 34);
    context.textAlign = 'left';
  }
  if (scrollX < maxScroll) {
    const fadeR = context.createLinearGradient(toolAreaWidth - 36, 0, toolAreaWidth, 0);
    fadeR.addColorStop(0, 'rgba(2, 6, 23, 0)');
    fadeR.addColorStop(1, '#020617');
    context.fillStyle = fadeR;
    context.fillRect(toolAreaWidth - 36, 0, 36, 56);
    context.fillStyle = '#94a3b8';
    context.font = '18px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText('\u25B6', toolAreaWidth - 14, 34);
    context.textAlign = 'left';
  }

  const toggleX = canvas.width - toggleWidth;
  context.fillStyle = '#020617';
  context.fillRect(toggleX, 0, toggleWidth, 56);
  const statsActive = overlayMode === 'stats';
  context.fillStyle = statsActive ? 'rgba(30, 41, 59, 0.9)' : 'rgba(14, 116, 144, 0.72)';
  context.fillRect(toggleX + 1, 1, toggleWidth - 2, 54);
  context.fillStyle = '#f8fafc';
  context.font = 'bold 13px system-ui, sans-serif';
  context.fillText(statsActive ? 'Live Tab' : 'Graph Tab', toggleX + 18, 24);
  context.font = '12px system-ui, sans-serif';
  context.fillStyle = '#cbd5e1';
  context.fillText(statsActive ? 'show metrics' : 'show flows', toggleX + 18, 41);

  context.strokeStyle = '#334155';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, 56);
  context.lineTo(canvas.width, 56);
  context.stroke();

  context.fillStyle = '#e2e8f0';
  context.font = '13px system-ui, sans-serif';
  context.fillText(`Treasury ${formatMoney(money)}`, 12, canvas.height - 18);
  context.fillStyle = '#cbd5e1';
  context.fillText(message, 180, canvas.height - 18);
}

function drawRoad(context, x, groundY, style) {
  const top = groundY;
  context.fillStyle = '#1c1c1c';
  context.fillRect(x, top, style.width, style.height);
  context.fillStyle = '#4a4a4a';
  context.fillRect(x, top, style.width, 2);
  context.fillRect(x, top + style.height - 1, style.width, 1);
  context.fillStyle = '#ca8a04';
  for (let dash = 0; dash < 4; dash += 1) {
    context.fillRect(x + 5 + dash * 15, top + 8, 9, 2);
  }
  context.fillStyle = 'rgba(255, 255, 255, 0.1)';
  context.fillRect(x, top + 5, style.width, 1);
  context.fillRect(x, top + 13, style.width, 1);
}

function drawPipe(context, x, groundY, style) {
  const waterY = groundY + 26;
  context.fillStyle = '#0369a1';
  context.fillRect(x, waterY - 3, style.width, 6);
  context.fillStyle = '#38bdf8';
  context.fillRect(x, waterY - 3, style.width, 2);
  context.fillStyle = '#7dd3fc';
  context.beginPath();
  context.arc(x + style.width * 0.25, waterY, 1.5, 0, Math.PI * 2);
  context.arc(x + style.width * 0.5, waterY, 1.5, 0, Math.PI * 2);
  context.arc(x + style.width * 0.75, waterY, 1.5, 0, Math.PI * 2);
  context.fill();

  const sewerY = groundY + 46;
  context.fillStyle = '#365314';
  context.fillRect(x, sewerY - 4, style.width, 8);
  context.fillStyle = '#1a2e05';
  context.fillRect(x, sewerY + 2, style.width, 2);
  context.fillStyle = '#4d7c0f';
  context.fillRect(x, sewerY - 4, style.width, 2);
}

function drawPowerLine(context, x, groundY, style) {
  const leftPoleX = x + 10;
  const rightPoleX = x + style.width - 10;
  const poleTop = groundY - style.height + 8;
  const poleBottom = groundY;

  context.strokeStyle = '#78350f';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(leftPoleX, poleTop);
  context.lineTo(leftPoleX, poleBottom);
  context.moveTo(rightPoleX, poleTop);
  context.lineTo(rightPoleX, poleBottom);
  context.stroke();

  context.strokeStyle = '#92400e';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(leftPoleX - 6, poleTop + 2);
  context.lineTo(leftPoleX + 6, poleTop + 2);
  context.moveTo(rightPoleX - 6, poleTop + 2);
  context.lineTo(rightPoleX + 6, poleTop + 2);
  context.stroke();

  context.fillStyle = '#d4d4d8';
  context.fillRect(leftPoleX - 5, poleTop, 2, 4);
  context.fillRect(leftPoleX + 4, poleTop, 2, 4);
  context.fillRect(rightPoleX - 5, poleTop, 2, 4);
  context.fillRect(rightPoleX + 4, poleTop, 2, 4);

  context.strokeStyle = '#fbbf24';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(leftPoleX, poleTop + 3);
  context.quadraticCurveTo(x + style.width * 0.5, poleTop + 14, rightPoleX, poleTop + 3);
  context.stroke();

  context.strokeStyle = '#f59e0b';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(leftPoleX, poleTop + 6);
  context.quadraticCurveTo(x + style.width * 0.5, poleTop + 18, rightPoleX, poleTop + 6);
  context.stroke();
}

function drawPowerLineConnection(context, fromScreenX, toScreenX, groundY, tileWidth, style) {
  const fromPoleX = fromScreenX + tileWidth - 10;
  const toPoleX = toScreenX + 10;
  const poleTop = groundY - style.height + 8;
  const midX = (fromPoleX + toPoleX) * 0.5;

  context.strokeStyle = '#fbbf24';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(fromPoleX, poleTop + 3);
  context.quadraticCurveTo(midX, poleTop + 16, toPoleX, poleTop + 3);
  context.stroke();

  context.strokeStyle = '#f59e0b';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(fromPoleX, poleTop + 6);
  context.quadraticCurveTo(midX, poleTop + 20, toPoleX, poleTop + 6);
  context.stroke();
}

function drawUnderground(context, canvasWidth, groundY, canvasHeight) {
  context.fillStyle = '#292524';
  context.fillRect(0, groundY, canvasWidth, 18);
  context.fillStyle = '#57534e';
  context.fillRect(0, groundY, canvasWidth, 2);

  context.fillStyle = '#3b2507';
  context.fillRect(0, groundY + 18, canvasWidth, 14);
  context.fillStyle = 'rgba(14, 116, 144, 0.06)';
  context.fillRect(0, groundY + 20, canvasWidth, 14);

  context.fillStyle = '#2d1b06';
  context.fillRect(0, groundY + 32, canvasWidth, 18);
  context.fillStyle = 'rgba(63, 98, 18, 0.05)';
  context.fillRect(0, groundY + 40, canvasWidth, 14);

  context.fillStyle = '#1f1505';
  context.fillRect(0, groundY + 50, canvasWidth, Math.max(0, canvasHeight - groundY - 50));

  const bedrockY = groundY + 66;
  if (bedrockY < canvasHeight) {
    context.fillStyle = '#1c1917';
    context.fillRect(0, bedrockY, canvasWidth, canvasHeight - bedrockY);
    context.fillStyle = '#292524';
    for (let rx = 0; rx < canvasWidth; rx += 40) {
      context.fillRect(rx + 3, bedrockY + 3, 20, 2);
      context.fillRect(rx + 14, bedrockY + 9, 16, 2);
    }
  }
}

function drawBuildingShadow(context, x, groundY, width) {
  context.save();
  context.fillStyle = 'rgba(0, 0, 0, 0.18)';
  context.beginPath();
  context.ellipse(x + width * 0.5, groundY + 2, width * 0.55, 4, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
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

function drawPlumbing(context, x, groundY, style) {
  const y = groundY - style.height;
  const left = x + 3;

  context.fillStyle = '#0f766e';
  context.fillRect(left + 8, y + 16, style.width - 16, style.height - 16);
  context.fillStyle = '#38bdf8';
  context.fillRect(left + 4, y + 10, 12, 10);
  context.fillRect(left + style.width - 16, y + 10, 12, 10);
  context.fillRect(left + 18, y + 6, style.width - 36, 8);
  context.fillStyle = '#e0f2fe';
  context.fillRect(left + 24, y + 24, 10, style.height - 24);
  context.fillRect(left + style.width - 34, y + 24, 10, style.height - 24);
  context.beginPath();
  context.arc(left + style.width * 0.5, y + 28, 6, 0, Math.PI * 2);
  context.fill();
}

function drawPowerPlant(context, x, groundY, style) {
  const y = groundY - style.height;
  const left = x + 2;

  context.fillStyle = '#78350f';
  context.fillRect(left + 4, y + 14, style.width - 8, style.height - 14);
  context.fillStyle = '#451a03';
  context.fillRect(left + 4, y + style.height - 8, style.width - 8, 8);

  context.fillStyle = '#fbbf24';
  context.fillRect(left + 10, y + 20, 12, 12);
  context.fillRect(left + 28, y + 20, 12, 12);
  context.fillRect(left + 46, y + 20, 10, 12);
  context.fillStyle = '#92400e';
  context.fillRect(left + 12, y + 23, 8, 2);
  context.fillRect(left + 30, y + 23, 8, 2);
  context.fillRect(left + 48, y + 23, 6, 2);

  context.fillStyle = '#57534e';
  context.fillRect(left + 12, y + 2, 10, 18);
  context.fillStyle = '#78716c';
  context.fillRect(left + 12, y + 2, 10, 3);
  context.fillStyle = '#dc2626';
  context.fillRect(left + 12, y + 4, 10, 2);
  context.fillRect(left + 12, y + 10, 10, 2);

  context.fillStyle = '#57534e';
  context.fillRect(left + 42, y + 6, 10, 14);
  context.fillStyle = '#78716c';
  context.fillRect(left + 42, y + 6, 10, 3);
  context.fillStyle = '#dc2626';
  context.fillRect(left + 42, y + 8, 10, 2);
}

function drawBuilding(context, kind, x, groundY, worldX = 0) {
  const style = styleByKind[kind] || styleByKind.house;
  if (kind === 'pipe') {
    drawPipe(context, x, groundY, style);
    return;
  }
  if (kind === 'powerline') {
    drawPowerLine(context, x, groundY, style);
    return;
  }
  if (kind === 'road') {
    drawRoad(context, x, groundY, style);
    return;
  }
  if (kind === 'power') {
    drawPowerPlant(context, x, groundY, style);
    return;
  }
  if (kind === 'plumbing') {
    drawPlumbing(context, x, groundY, style);
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

function drawTraffic(context, cameraX, groundY, model) {
  const trips = Array.isArray(model.currentTrips) ? model.currentTrips : [];
  if (!trips.length) return;

  const laneByCategory = {
    commute: { yOffset: 5, speed: 0.85, divisor: 42, radius: 2.8 },
    freight: { yOffset: 10, speed: 0.5, divisor: 56, radius: 3.8 },
    service: { yOffset: 15, speed: 0.7, divisor: 48, radius: 2.4 },
  };

  trips.forEach((trip, tripIndex) => {
    const lane = laneByCategory[trip.category];
    if (!lane) return;

    const pathStart = Math.min(trip.fromX, trip.toX) - cameraX;
    const pathEnd = Math.max(trip.fromX, trip.toX) - cameraX;
    if (pathEnd < -20 || pathStart > context.canvas.width + 20) return;

    const vehicleCount = Math.min(4, Math.max(1, Math.round(trip.amount / lane.divisor)));
    for (let vehicleIndex = 0; vehicleIndex < vehicleCount; vehicleIndex += 1) {
      const phase = (model.simTime * lane.speed + tripIndex * 0.173 + vehicleIndex * 0.31) % 1;
      const routeDelta = trip.toX - trip.fromX;
      const worldX = routeDelta === 0
        ? trip.fromX + Math.sin((model.simTime + vehicleIndex) * 3) * 6
        : trip.fromX + routeDelta * phase;
      const screenX = worldX - cameraX;
      const screenY = groundY + lane.yOffset;
      context.fillStyle = TRIP_COLOR_BY_ORIGIN[trip.originKind] || '#e2e8f0';
      context.beginPath();
      context.arc(screenX, screenY, lane.radius, 0, Math.PI * 2);
      context.fill();
    }
  });
}

function collectVisibleLots(world, cameraX, canvasWidth) {
  const lots = new Map();
  for (const [id, building] of world.query(Building)) {
    const sx = building.x - cameraX;
    if (sx < -120 || sx > canvasWidth + 120) continue;
    const lot = lots.get(building.x) || { x: building.x, screenX: sx, road: null, pipe: null, powerline: null, structure: null };
    if (UNDERLAY_KINDS.includes(building.kind)) lot[building.kind] = { id, building };
    else lot.structure = { id, building };
    lots.set(building.x, lot);
  }
  return [...lots.values()].sort((left, right) => left.x - right.x);
}

export function createRenderSystem(canvas, context, hud, controls, smokeFx) {
  let prevCameraX = 0;

  return function renderSystem(world, dt = 1 / 60) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#0f172a';
    context.fillRect(0, 0, canvas.width, canvas.height);

    let cameraX = 0;
    let tileSize = 64;
    let selectedKind = controls.getSelectedKind();
    let overlayMode = controls.getOverlayMode ? controls.getOverlayMode() : 'overview';
    let model = null;
    for (const [id, camera, mode] of world.query(Camera, BuildMode)) {
      cameraX = camera.x;
      tileSize = mode.tileSize;
      selectedKind = mode.selectedKind;
      overlayMode = mode.overlayMode;
      break;
    }

    const modelTuple = world.query(World3State)[Symbol.iterator]().next().value;
    model = modelTuple ? modelTuple[1] : null;

    const cameraDeltaX = cameraX - prevCameraX;
    prevCameraX = cameraX;
    if (cameraDeltaX !== 0) {
      const pool = smokeFx.pool;
      for (let i = 0; i < pool.count; i += 1) {
        pool.x[i] -= cameraDeltaX;
      }
    }

    const vw = canvas.width / VIEW_ZOOM;
    const vh = canvas.height / VIEW_ZOOM;
    const groundY = Math.max(200, Math.min(vh - 70, Math.round(vh * 0.64)));

    context.save();
    context.scale(VIEW_ZOOM, VIEW_ZOOM);

    drawSky(context, { width: vw, height: vh }, groundY, model ? model.timeOfDay : 0.58);
    drawUnderground(context, vw, groundY, vh);

    context.strokeStyle = 'rgba(100, 80, 60, 0.15)';
    context.lineWidth = 1;
    const startGridX = -((cameraX % tileSize + tileSize) % tileSize);
    for (let gx = startGridX; gx <= vw; gx += tileSize) {
      context.beginPath();
      context.moveTo(gx, groundY);
      context.lineTo(gx, vh);
      context.stroke();
    }

    const counts = { house: 0, farm: 0, factory: 0, road: 0, pipe: 0, powerline: 0 };
    const smokeOrigins = [];
    const activeSmokeKeys = new Set();
    const occupied = new Map();
    const visibleLots = collectVisibleLots(world, cameraX, vw);

    for (const lot of visibleLots) {
      if (lot.pipe) {
        counts.pipe += 1;
        drawBuilding(context, 'pipe', lot.screenX, groundY, lot.x);
      }
    }

    for (const lot of visibleLots) {
      if (lot.road) {
        counts.road += 1;
        drawBuilding(context, 'road', lot.screenX, groundY, lot.x);
      }
    }

    const powerLineLots = [];
    for (const lot of visibleLots) {
      if (lot.powerline) {
        counts.powerline += 1;
        drawBuilding(context, 'powerline', lot.screenX, groundY, lot.x);
        powerLineLots.push(lot);
      }
      if (lot.structure) {
        counts[lot.structure.building.kind] = (counts[lot.structure.building.kind] || 0) + 1;
      }
      occupied.set(lot.x, Boolean(lot.road || lot.pipe || lot.powerline || lot.structure));
    }

    const plStyle = styleByKind.powerline;
    for (let i = 0; i < powerLineLots.length - 1; i += 1) {
      const curr = powerLineLots[i];
      const next = powerLineLots[i + 1];
      if (next.x - curr.x === tileSize) {
        drawPowerLineConnection(context, curr.screenX, next.screenX, groundY, tileSize, plStyle);
      }
    }

    drawTraffic(context, cameraX, groundY, model || { currentTrips: [], simTime: 0 });

    for (const lot of visibleLots) {
      if (!lot.structure) continue;
      const { id, building } = lot.structure;
      const bStyle = styleByKind[building.kind] || styleByKind.house;
      drawBuildingShadow(context, lot.screenX, groundY, bStyle.width);
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

      if (building.kind === 'power') {
        const style = styleByKind.power;
        const stacks = getPowerPlantStackOrigins(lot.screenX, groundY, style);
        for (let stackIndex = 0; stackIndex < stacks.length; stackIndex += 1) {
          drawSmokeSource(context, stacks[stackIndex].x, stacks[stackIndex].y);
          const key = `power:${id}:stack:${stackIndex}`;
          activeSmokeKeys.add(key);
          smokeFx.ensureEmitter(key, {
            rate: 14,
            speed: 14,
            speedJitter: 0.4,
            spread: Math.PI / 6,
            life: 2.8,
            lifeJitter: 0.3,
            size: 10,
            sizeEnd: 30,
            alpha0: 0.4,
            alpha1: 0,
            ax: 5,
            ay: -10,
            offsetY: -4,
            blur: 8,
            colorA: { r: 80, g: 80, b: 80 },
            colorB: { r: 160, g: 160, b: 170 },
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

    const pointerX = controls.getPointerX() / VIEW_ZOOM;
    const snappedWorldX = Math.floor((cameraX + pointerX) / tileSize) * tileSize;
    const ghostScreenX = snappedWorldX - cameraX;
    const selectedRule = BUILDING_DEFS[selectedKind] || BUILDING_DEFS.house;
    const canAffordSelection = selectedKind === 'bulldoze' || !model || model.money >= selectedRule.cost;
    if (selectedKind === 'bulldoze') {
      drawBulldozeGhost(context, ghostScreenX, groundY, tileSize, occupied.get(snappedWorldX));
    } else {
      if (UNDERLAY_KINDS.includes(selectedKind)) {
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

    context.restore();

    drawPlacementHud(
      context,
      canvas,
      selectedKind,
      model ? model.money : 0,
      model ? model.lastActionText : 'Build carefully.',
      overlayMode,
      controls.getToolbarScrollX ? controls.getToolbarScrollX() : 0,
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
        model ? `lots ${model.houses}/${model.farms}/${model.factories}/${model.commercials}/${model.civics}/${model.logistics}/${model.plumbings}/${model.powerPlants}/${model.roads}/${model.pipes}/${model.powerLines}` : null,
        model ? `utility ${Math.round(model.waterDelivered)}/${Math.round(model.sewerHandled)}/${Math.round(model.powerDelivered)}` : null,
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
