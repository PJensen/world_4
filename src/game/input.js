import { BUILDING_DEFS, TOOL_SEGMENT_WIDTH, VIEW_ZOOM } from './components.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const BUILD_TOOL_KINDS = Object.freeze(Object.keys(BUILDING_DEFS));

const TOOL_KEYS = Object.freeze(Object.fromEntries(
  BUILD_TOOL_KINDS.slice(0, 9).map((kind, index) => [String(index + 1), kind]),
));

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
    toolbarScrollX: 0,
    toolbarDragging: false,
    toolbarDragStartX: 0,
    toolbarScrollStart: 0,
    toolbarDragMoved: false,
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
      const toggleWidth = 132;
      if (pos.x >= canvas.width - toggleWidth) {
        state.overlayMode = state.overlayMode === 'overview' ? 'stats' : 'overview';
        state.pointerX = pos.x;
        return;
      }
      state.toolbarDragging = true;
      state.toolbarDragStartX = pos.x;
      state.toolbarScrollStart = state.toolbarScrollX;
      state.toolbarDragMoved = false;
      state.pointerId = event.pointerId;
      state.pointerX = pos.x;
      if (typeof canvas.setPointerCapture === 'function' && event.pointerId != null) {
        try { canvas.setPointerCapture(event.pointerId); } catch (_) { }
      }
      event.preventDefault();
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

    if (state.toolbarDragging && event.pointerId === state.pointerId) {
      const tdx = pos.x - state.toolbarDragStartX;
      if (Math.abs(tdx) > 5) state.toolbarDragMoved = true;
      if (state.toolbarDragMoved) {
        const toggleWidth = 132;
        const toolAreaWidth = canvas.width - toggleWidth;
        const toolKinds = [...BUILD_TOOL_KINDS, 'bulldoze'];
        const totalWidth = toolKinds.length * TOOL_SEGMENT_WIDTH;
        const maxScroll = Math.max(0, totalWidth - toolAreaWidth);
        state.toolbarScrollX = clamp(state.toolbarScrollStart - tdx, 0, maxScroll);
      }
      event.preventDefault();
      return;
    }

    if (state.pointerId == null || event.pointerId !== state.pointerId) return;

    const dx = pos.x - state.pointerLastX;
    const totalDx = Math.abs(pos.x - state.pointerStartX);
    const totalDy = Math.abs(pos.y - state.pointerStartY);
    if (totalDx > 8 || totalDy > 8) state.pointerMoved = true;

    if (state.pointerType === 'touch' || state.pointerType === 'pen') {
      state.panDelta -= dx / VIEW_ZOOM;
    }
    state.pointerLastX = pos.x;
    event.preventDefault();
  };

  const onPointerUp = (event) => {
    const pos = eventToCanvasPosition(event, canvas);
    state.pointerX = pos.x;

    if (state.toolbarDragging && event.pointerId === state.pointerId) {
      state.toolbarDragging = false;
      if (!state.toolbarDragMoved) {
        const toggleWidth = 132;
        const toolAreaWidth = canvas.width - toggleWidth;
        if (pos.x < toolAreaWidth) {
          const toolKinds = [...BUILD_TOOL_KINDS, 'bulldoze'];
          const toolIndex = Math.floor((pos.x + state.toolbarScrollX) / TOOL_SEGMENT_WIDTH);
          if (toolIndex >= 0 && toolIndex < toolKinds.length) {
            state.selectedKind = toolKinds[toolIndex];
          }
        }
      }
      if (typeof canvas.releasePointerCapture === 'function' && state.pointerId != null) {
        try { canvas.releasePointerCapture(state.pointerId); } catch (_) { }
      }
      state.pointerId = null;
      event.preventDefault();
      return;
    }

    if (state.pointerId == null || event.pointerId !== state.pointerId) return;

    if (!state.pointerMoved && pos.y > 54) {
      state.placementRequests.push({ screenX: pos.x / VIEW_ZOOM, kind: state.selectedKind });
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

  canvas.addEventListener('wheel', (event) => {
    const pos = eventToCanvasPosition(event, canvas);
    if (pos.y <= 56) {
      const toggleWidth = 132;
      const toolAreaWidth = canvas.width - toggleWidth;
      const toolKinds = [...BUILD_TOOL_KINDS, 'bulldoze'];
      const totalWidth = toolKinds.length * TOOL_SEGMENT_WIDTH;
      const maxScroll = Math.max(0, totalWidth - toolAreaWidth);
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      state.toolbarScrollX = clamp(state.toolbarScrollX + delta, 0, maxScroll);
      event.preventDefault();
    }
  }, { passive: false });

  return {
    isMovingLeft: () => state.moveLeft,
    isMovingRight: () => state.moveRight,
    getSelectedKind: () => state.selectedKind,
    getOverlayMode: () => state.overlayMode,
    getPointerX: () => state.pointerX,
    getToolbarScrollX: () => state.toolbarScrollX,
    consumePanDelta: () => {
      const delta = state.panDelta;
      state.panDelta = 0;
      return delta;
    },
    consumePlacementRequests: () => state.placementRequests.splice(0),
  };
}
