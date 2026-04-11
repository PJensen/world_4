function makeRng(seed = 1) {
  let state = seed >>> 0;
  return function rng() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashKey(key) {
  const text = String(key);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

export class ParticlePool {
  constructor(capacity = 512) {
    this.capacity = capacity;
    this.count = 0;
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.ax = new Float32Array(capacity);
    this.ay = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.lifeMax = new Float32Array(capacity);
    this.size0 = new Float32Array(capacity);
    this.size1 = new Float32Array(capacity);
    this.alpha0 = new Float32Array(capacity);
    this.alpha1 = new Float32Array(capacity);
    this.r = new Float32Array(capacity);
    this.g = new Float32Array(capacity);
    this.b = new Float32Array(capacity);
    this.blur = new Float32Array(capacity);
  }

  spawn(particle) {
    const index = this.count < this.capacity ? this.count++ : 0;
    this.x[index] = particle.x;
    this.y[index] = particle.y;
    this.vx[index] = particle.vx;
    this.vy[index] = particle.vy;
    this.ax[index] = particle.ax;
    this.ay[index] = particle.ay;
    this.life[index] = particle.life;
    this.lifeMax[index] = particle.life;
    this.size0[index] = particle.size0;
    this.size1[index] = particle.size1;
    this.alpha0[index] = particle.alpha0;
    this.alpha1[index] = particle.alpha1;
    this.r[index] = particle.r ?? 148;
    this.g[index] = particle.g ?? 163;
    this.b[index] = particle.b ?? 184;
    this.blur[index] = particle.blur ?? 0;
  }

  step(dt) {
    let writeIndex = 0;
    for (let index = 0; index < this.count; index += 1) {
      const nextLife = this.life[index] - dt;
      if (nextLife <= 0) continue;

      const nextVx = this.vx[index] + this.ax[index] * dt;
      const nextVy = this.vy[index] + this.ay[index] * dt;

      this.vx[index] = nextVx;
      this.vy[index] = nextVy;
      this.x[index] += nextVx * dt;
      this.y[index] += nextVy * dt;
      this.life[index] = nextLife;

      if (writeIndex !== index) {
        this.x[writeIndex] = this.x[index];
        this.y[writeIndex] = this.y[index];
        this.vx[writeIndex] = this.vx[index];
        this.vy[writeIndex] = this.vy[index];
        this.ax[writeIndex] = this.ax[index];
        this.ay[writeIndex] = this.ay[index];
        this.life[writeIndex] = this.life[index];
        this.lifeMax[writeIndex] = this.lifeMax[index];
        this.size0[writeIndex] = this.size0[index];
        this.size1[writeIndex] = this.size1[index];
        this.alpha0[writeIndex] = this.alpha0[index];
        this.alpha1[writeIndex] = this.alpha1[index];
        this.r[writeIndex] = this.r[index];
        this.g[writeIndex] = this.g[index];
        this.b[writeIndex] = this.b[index];
        this.blur[writeIndex] = this.blur[index];
      }
      writeIndex += 1;
    }
    this.count = writeIndex;
  }

  render(context) {
    context.save();
    context.globalCompositeOperation = 'source-over';
    for (let index = 0; index < this.count; index += 1) {
      const progress = 1 - this.life[index] / this.lifeMax[index];
      const size = this.size0[index] + (this.size1[index] - this.size0[index]) * progress;
      const alpha = this.alpha0[index] + (this.alpha1[index] - this.alpha0[index]) * progress;
      context.globalAlpha = alpha;
      context.fillStyle = `rgb(${this.r[index] | 0}, ${this.g[index] | 0}, ${this.b[index] | 0})`;
      context.shadowColor = `rgba(${this.r[index] | 0}, ${this.g[index] | 0}, ${this.b[index] | 0}, ${Math.min(0.45, alpha)})`;
      context.shadowBlur = this.blur[index];
      context.beginPath();
      context.arc(this.x[index], this.y[index], size * 0.5, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    context.globalAlpha = 1;
  }
}

class ParticleEmitter {
  constructor(options = {}) {
    this.rate = options.rate ?? 12;
    this.angle = options.angle ?? -Math.PI / 2;
    this.spread = options.spread ?? Math.PI / 10;
    this.speed = options.speed ?? 16;
    this.speedJitter = options.speedJitter ?? 0.35;
    this.life = options.life ?? 2.4;
    this.lifeJitter = options.lifeJitter ?? 0.4;
    this.size = options.size ?? 11;
    this.sizeEnd = options.sizeEnd ?? 26;
    this.alpha0 = options.alpha0 ?? 0.36;
    this.alpha1 = options.alpha1 ?? 0;
    this.ax = options.ax ?? 3;
    this.ay = options.ay ?? -5;
    this.offsetX = options.offsetX ?? 0;
    this.offsetY = options.offsetY ?? 0;
    this.colorA = options.colorA ?? { r: 90, g: 96, b: 110 };
    this.colorB = options.colorB ?? { r: 148, g: 163, b: 184 };
    this.blur = options.blur ?? 8;
    this.accumulator = 0;
    this.rng = makeRng(options.seed ?? 1);
  }

  step(pool, dt, x, y) {
    this.accumulator += dt * this.rate;
    const count = this.accumulator | 0;
    if (count <= 0) return;
    this.accumulator -= count;
    for (let index = 0; index < count; index += 1) {
      this.spawnOne(pool, x, y);
    }
  }

  spawnOne(pool, x, y) {
    const angle = this.angle + (this.rng() * 2 - 1) * this.spread;
    const speed = this.speed * (1 - this.speedJitter * 0.5 + this.rng() * this.speedJitter);
    const life = this.life * (1 - this.lifeJitter * 0.5 + this.rng() * this.lifeJitter);
    const colorMix = this.rng();
    pool.spawn({
      x: x + this.offsetX,
      y: y + this.offsetY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      ax: this.ax,
      ay: this.ay,
      life,
      size0: this.size,
      size1: this.sizeEnd,
      alpha0: this.alpha0,
      alpha1: this.alpha1,
      r: this.colorA.r + (this.colorB.r - this.colorA.r) * colorMix,
      g: this.colorA.g + (this.colorB.g - this.colorA.g) * colorMix,
      b: this.colorA.b + (this.colorB.b - this.colorA.b) * colorMix,
      blur: this.blur,
    });
  }
}

export class ParticleFx {
  constructor({ capacity = 512, seedBase = 42 } = {}) {
    this.pool = new ParticlePool(capacity);
    this.emitters = new Map();
    this.seedBase = seedBase >>> 0;
  }

  ensureEmitter(key, options) {
    if (this.emitters.has(key)) return this.emitters.get(key);
    const emitter = new ParticleEmitter({
      ...options,
      seed: this.seedBase ^ hashKey(key),
    });
    this.emitters.set(key, emitter);
    return emitter;
  }

  syncEmitters(activeKeys) {
    for (const key of this.emitters.keys()) {
      if (!activeKeys.has(key)) this.emitters.delete(key);
    }
  }

  step(dt, origins) {
    for (const origin of origins) {
      const emitter = this.emitters.get(origin.key);
      if (!emitter) continue;
      emitter.step(this.pool, dt, origin.x, origin.y);
    }
    this.pool.step(dt);
  }

  render(context) {
    this.pool.render(context);
  }

  stats() {
    return {
      activeParticles: this.pool.count,
      emitters: this.emitters.size,
      capacity: this.pool.capacity,
    };
  }
}

export function createSmokeFx() {
  return new ParticleFx({ capacity: 768, seedBase: 0xc0ffee });
}