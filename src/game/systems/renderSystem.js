import { BuildMode, Building, Camera, World3State } from '../components.js';

const styleByKind = {
  house: { width: 52, height: 38 },
  farm: { width: 60, height: 30 },
  factory: { width: 62, height: 48 },
};

const backdropImage = new Image();
backdropImage.src = new URL('../../assets/factory.svg', import.meta.url).href;
const BACKDROP_SKY_CROP = 0.56;

function drawWorld3Overlay(context, canvas, model) {
  const panelWidth = 260;
  const panelHeight = 138;
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
    `Resources: ${(model.resources * 100).toFixed(1)}%`,
    `Pollution: ${model.pollution.toFixed(2)}`,
    `Food / cap: ${model.foodPerCapita.toFixed(2)}`,
    `Industry idx: ${model.industrialOutput.toFixed(2)}`,
    `Birth/Death: ${(model.birthRate * 100).toFixed(2)}% / ${(model.deathRate * 100).toFixed(2)}%`,
    `QoL: ${model.qualityOfLife.toFixed(2)}`,
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
  const variantSeed = Math.abs(Math.floor(worldX / 16));
  const stackCount = 1 + (variantSeed % 3);
  const toothCount = 2 + (variantSeed % 2);
  const bodyTint = variantSeed % 2 === 0 ? '#374151' : '#3f3f46';
  const roofTint = variantSeed % 2 === 0 ? '#4b5563' : '#52525b';

  context.fillStyle = bodyTint;
  context.fillRect(left, y + 8, style.width, style.height - 8);

  context.fillStyle = roofTint;
  context.beginPath();
  const toothWidth = style.width / (toothCount + 1);
  context.moveTo(left, y + 8);
  for (let index = 0; index < toothCount; index += 1) {
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

  for (let stack = 0; stack < stackCount; stack += 1) {
    const offsetX = left + style.width - 14 - stack * 11;
    const stackHeight = 20 + stack * 3;
    context.fillStyle = '#52525b';
    context.fillRect(offsetX, y - stackHeight + 8, 8, stackHeight);

    context.fillStyle = 'rgba(148, 163, 184, 0.45)';
    context.beginPath();
    context.arc(offsetX + 4, y - stackHeight - 1, 5, 0, Math.PI * 2);
    context.arc(offsetX + 8, y - stackHeight - 8, 4, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = '#fcd34d';
  const windows = 3 + (variantSeed % 2);
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

export function createRenderSystem(canvas, context, hud, controls) {
  return function renderSystem(world) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#0f172a';
    context.fillRect(0, 0, canvas.width, canvas.height);

    let cameraX = 0;
    let tileSize = 64;
    let groundY = 420;
    let selectedKind = controls.getSelectedKind();
    for (const [id, camera, mode] of world.query(Camera, BuildMode)) {
      cameraX = camera.x;
      tileSize = mode.tileSize;
      groundY = mode.groundY;
      selectedKind = mode.selectedKind;
      break;
    }

    if (backdropImage.complete && backdropImage.naturalWidth > 0) {
      const parallaxX = -((cameraX * 0.2) % canvas.width);
      const sourceWidth = backdropImage.naturalWidth;
      const sourceHeight = backdropImage.naturalHeight * BACKDROP_SKY_CROP;
      context.globalAlpha = 0.55;
      context.drawImage(backdropImage, 0, 0, sourceWidth, sourceHeight, parallaxX - canvas.width, 0, canvas.width, groundY + 40);
      context.drawImage(backdropImage, 0, 0, sourceWidth, sourceHeight, parallaxX, 0, canvas.width, groundY + 40);
      context.drawImage(backdropImage, 0, 0, sourceWidth, sourceHeight, parallaxX + canvas.width, 0, canvas.width, groundY + 40);
      context.globalAlpha = 1;
    }

    context.fillStyle = 'rgba(251, 191, 36, 0.22)';
    context.beginPath();
    context.arc(canvas.width * 0.82, 84, 48, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(253, 224, 71, 0.8)';
    context.beginPath();
    context.arc(canvas.width * 0.82, 84, 24, 0, Math.PI * 2);
    context.fill();

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
    for (const [id, building] of world.query(Building)) {
      const sx = building.x - cameraX;
      if (sx < -120 || sx > canvas.width + 120) continue;
      drawBuilding(context, building.kind, sx, groundY, building.x);
      counts[building.kind] = (counts[building.kind] || 0) + 1;
    }

    const pointerX = controls.getPointerX();
    const snappedWorldX = Math.floor((cameraX + pointerX) / tileSize) * tileSize;
    const ghostScreenX = snappedWorldX - cameraX;
    context.globalAlpha = 0.45;
    drawBuilding(context, selectedKind, ghostScreenX, groundY, snappedWorldX);
    context.globalAlpha = 1;

    context.fillStyle = '#cbd5e1';
    context.font = '13px system-ui, sans-serif';
    context.fillText('1:House  2:Farm  3:Factory  •  A/D or ←/→ to scroll  •  Click/Tap to place', 12, 22);

    const modelTuple = world.query(World3State)[Symbol.iterator]().next().value;
    if (modelTuple) drawWorld3Overlay(context, canvas, modelTuple[1]);

    if (hud) {
      const model = modelTuple ? modelTuple[1] : null;
      hud.textContent = [
        `camera ${cameraX.toFixed(0)}m`,
        `selected ${selectedKind}`,
        `houses ${counts.house}`,
        `farms ${counts.farm}`,
        `factories ${counts.factory}`,
        model ? `pop ${(model.population / 1e9).toFixed(2)}B` : null,
      ].filter(Boolean).join(' · ');
    }
  };
}
