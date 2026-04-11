import { BuildMode, Building, Camera, World3State } from '../components.js';

const styleByKind = {
  house: { width: 52, height: 38 },
  farm: { width: 60, height: 30 },
  factory: { width: 62, height: 48 },
};

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
  const panelWidth = 260;
  const panelHeight = 190;
  const x = canvas.width - panelWidth - 12;
  const y = 12;

  context.fillStyle = 'rgba(2, 6, 23, 0.8)';
  context.fillRect(x, y, panelWidth, panelHeight);
  context.strokeStyle = '#334155';
  context.strokeRect(x, y, panelWidth, panelHeight);

  context.fillStyle = '#e2e8f0';
  context.font = '12px system-ui, sans-serif';
  context.fillText('World3 Live Overlay', x + 10, y + 18);

  const rows = [
    `Population: ${(model.population / 1e9).toFixed(2)} B`,
    `Placed H/F/Fx: ${model.houses} / ${model.farms} / ${model.factories}`,
    `Resources: ${(model.resources * 100).toFixed(1)}%`,
    `Pollution: ${model.pollution.toFixed(2)}`,
    `Food / cap: ${model.foodPerCapita.toFixed(2)}`,
    `Industry idx: ${model.industrialOutput.toFixed(2)}`,
    `Workers: ${(model.workersUsed / 1e6).toFixed(2)}M / ${(model.workersAvailable / 1e6).toFixed(2)}M`,
    `Factory util: ${(model.factoryUtilization * 100).toFixed(0)}%`,
    `Birth/Death: ${(model.birthRate * 100).toFixed(2)}% / ${(model.deathRate * 100).toFixed(2)}%`,
    `QoL: ${model.qualityOfLife.toFixed(2)}  •  TOD: ${Math.round(model.timeOfDay * 24)}:00`,
  ];

  context.fillStyle = '#cbd5e1';
  rows.forEach((line, index) => {
    context.fillText(line, x + 10, y + 36 + index * 14);
  });
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

export function createRenderSystem(canvas, context, hud, controls, smokeFx) {
  return function renderSystem(world, dt = 1 / 60) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#0f172a';
    context.fillRect(0, 0, canvas.width, canvas.height);

    let cameraX = 0;
    let tileSize = 64;
    let groundY = 420;
    let selectedKind = controls.getSelectedKind();
    let model = null;
    for (const [id, camera, mode] of world.query(Camera, BuildMode)) {
      cameraX = camera.x;
      tileSize = mode.tileSize;
      groundY = mode.groundY;
      selectedKind = mode.selectedKind;
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

    const counts = { house: 0, farm: 0, factory: 0 };
    const smokeOrigins = [];
    const activeSmokeKeys = new Set();
    for (const [id, building] of world.query(Building)) {
      const sx = building.x - cameraX;
      if (sx < -120 || sx > canvas.width + 120) continue;
      drawBuilding(context, building.kind, sx, groundY, building.x);
      counts[building.kind] = (counts[building.kind] || 0) + 1;

      if (building.kind === 'factory') {
        const style = styleByKind.factory;
        const stacks = getFactoryStackOrigins(sx, groundY, style, building.x);
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
    context.globalAlpha = 0.45;
    drawBuilding(context, selectedKind, ghostScreenX, groundY, snappedWorldX);
    context.globalAlpha = 1;

    context.fillStyle = '#cbd5e1';
    context.font = '13px system-ui, sans-serif';
    context.fillText('1:House  2:Farm  3:Factory  •  A/D or ←/→ to scroll  •  Click/Tap to place', 12, 22);

    if (model) drawWorld3Overlay(context, canvas, model);

    if (hud) {
      const smokeStats = smokeFx.stats();
      hud.textContent = [
        `camera ${cameraX.toFixed(0)}m`,
        `selected ${selectedKind}`,
        `houses ${counts.house}`,
        `farms ${counts.farm}`,
        `factories ${counts.factory}`,
        `smoke ${smokeStats.activeParticles}/${smokeStats.emitters}`,
        model ? `workers ${(model.workersUsed / 1e6).toFixed(2)}M/${(model.workersAvailable / 1e6).toFixed(2)}M` : null,
        model ? `util ${(model.factoryUtilization * 100).toFixed(0)}%` : null,
        model ? `pop ${(model.population / 1e9).toFixed(2)}B` : null,
      ].filter(Boolean).join(' · ');
    }
  };
}
