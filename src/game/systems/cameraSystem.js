import { BuildMode, Camera } from '../components.js';

export function createCameraSystem(controls) {
  return function cameraSystem(world, dt) {
    const touchPanDelta = controls.consumePanDelta ? controls.consumePanDelta() : 0;
    for (const [id, camera] of world.query(Camera)) {
      let axis = 0;
      if (controls.isMovingLeft()) axis -= 1;
      if (controls.isMovingRight()) axis += 1;
      const nextX = camera.x + axis * camera.speed * dt + touchPanDelta;
      world.set(id, Camera, { x: Math.max(camera.minX, nextX) });
    }

    for (const [id, mode] of world.query(BuildMode)) {
      const selectedKind = controls.getSelectedKind();
      if (mode.selectedKind !== selectedKind) {
        world.set(id, BuildMode, { selectedKind });
      }
    }
  };
}
