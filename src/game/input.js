const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const TOOL_KEYS = Object.freeze({
  '1': 'house',
  '2': 'farm',
  '3': 'factory',
  '4': 'road',
});

function eventToCanvasPosition(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const normalizedX = (event.clientX - rect.left) / rect.width;
  const normalizedY = (event.clientY - rect.top) / rect.height;
  return {
    x: clamp(normalizedX * canvas.width, 0, canvas.width),
    y: clamp(normalizedY * canvas.height, 0, canvas.height),
  };
}

export function createBuildControls(canvas, target = window) {
  const state = {
    moveLeft: false,
    moveRight: false,
    selectedKind: 'house',
    overlayMode: 'stats',
    pointerX: canvas.width * 0.5,
    placementRequests: [],
    pointerId: null,
    pointerStartX: 0,
    pointerStartY: 0,
    pointerLastX: 0,
    pointerMoved: false,
    pointerType: 'mouse',
    panDelta: 0,
  };

  const onKeyDown = (event) => {
    const key = event.key.toLowerCase();
    if (TOOL_KEYS[key]) {
      state.selectedKind = TOOL_KEYS[key];
      event.preventDefault();
      return;
    }
    if (key === 'a' || key === 'arrowleft') {
      state.moveLeft = true;
      event.preventDefault();
      return;
    }
    if (key === 'd' || key === 'arrowright') {
      state.moveRight = true;
      event.preventDefault();
      return;
    }
    if (key === 'x' || key === 'backspace' || key === 'delete') {
      state.selectedKind = 'bulldoze';
      event.preventDefault();
      return;
    }
    if (key === 'tab' || key === 'g') {
      state.overlayMode = state.overlayMode === 'overview' ? 'stats' : 'overview';
      event.preventDefault();
    }
  };

  const onKeyUp = (event) => {
    const key = event.key.toLowerCase();
    if (key === 'a' || key === 'arrowleft') {
      state.moveLeft = false;
      event.preventDefault();
      return;
    }
    if (key === 'd' || key === 'arrowright') {
      state.moveRight = false;
      event.preventDefault();
    }
  };

  const onPointerDown = (event) => {
    if (event.button != null && event.button !== 0) return;
    const pos = eventToCanvasPosition(event, canvas);

    if (pos.y <= 56) {
      const toolKinds = ['house', 'farm', 'factory', 'road', 'bulldoze'];
      const toggleWidth = 132;
      const toolAreaWidth = canvas.width - toggleWidth;
      if (pos.x < toolAreaWidth) {
        const segmentWidth = toolAreaWidth / toolKinds.length;
        const toolIndex = Math.max(0, Math.min(toolKinds.length - 1, Math.floor(pos.x / segmentWidth)));
        state.selectedKind = toolKinds[toolIndex];
      } else {
        state.overlayMode = state.overlayMode === 'overview' ? 'stats' : 'overview';
      }
      state.pointerX = pos.x;
      return;
    }

    state.pointerId = event.pointerId;
    state.pointerType = event.pointerType || 'mouse';
    state.pointerStartX = pos.x;
    state.pointerStartY = pos.y;
    state.pointerLastX = pos.x;
    state.pointerMoved = false;
    state.pointerX = pos.x;

    if (typeof canvas.setPointerCapture === 'function' && state.pointerId != null) {
      try { canvas.setPointerCapture(state.pointerId); } catch (_) { }
    }
    event.preventDefault();
  };

  const onPointerMove = (event) => {
    const pos = eventToCanvasPosition(event, canvas);
    state.pointerX = pos.x;
    if (state.pointerId == null || event.pointerId !== state.pointerId) return;

    const dx = pos.x - state.pointerLastX;
    const totalDx = Math.abs(pos.x - state.pointerStartX);
    const totalDy = Math.abs(pos.y - state.pointerStartY);
    if (totalDx > 8 || totalDy > 8) state.pointerMoved = true;

    if (state.pointerType === 'touch' || state.pointerType === 'pen') {
      state.panDelta -= dx;
    }
    state.pointerLastX = pos.x;
    event.preventDefault();
  };

  const onPointerUp = (event) => {
    const pos = eventToCanvasPosition(event, canvas);
    state.pointerX = pos.x;
    if (state.pointerId == null || event.pointerId !== state.pointerId) return;

    if (!state.pointerMoved && pos.y > 54) {
      state.placementRequests.push({ screenX: pos.x, kind: state.selectedKind });
    }

    if (typeof canvas.releasePointerCapture === 'function' && state.pointerId != null) {
      try { canvas.releasePointerCapture(state.pointerId); } catch (_) { }
    }

    state.pointerId = null;
    state.pointerMoved = false;
    event.preventDefault();
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  return {
    isMovingLeft: () => state.moveLeft,
    isMovingRight: () => state.moveRight,
    getSelectedKind: () => state.selectedKind,
    getOverlayMode: () => state.overlayMode,
    getPointerX: () => state.pointerX,
    consumePanDelta: () => {
      const delta = state.panDelta;
      state.panDelta = 0;
      return delta;
    },
    consumePlacementRequests: () => state.placementRequests.splice(0),
  };
}
