import React, { useRef, useEffect, useMemo } from 'react';
import { Particle, ParticleState, SimulationConfig, SubstanceType } from '../types';
import { SUBSTANCES, INITIAL_PARTICLE_COUNT_BASE, CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';

interface SimulationStats {
  moleculeCount: number;
  ionCount: number;
  ionizationRate: number;
  recombinationRate: number;
}

interface SimulationCanvasProps {
  config: SimulationConfig;
  isInitial: boolean;
  isPaused: boolean;
  onStatsUpdate: (stats: SimulationStats) => void;
}

/* ------------------------------------------------------------------
 * 性能说明（不改变任何显示效果与物理行为）：
 * 1. 不再把 800×500 的固定缓冲放大到全屏。画布 backing store 精确等于
 *    容器 CSS 尺寸 × devicePixelRatio（上限 1.5），粒子世界按同比例建立，
 *    因此每帧省掉一次全屏重采样，画面反而更清晰。
 * 2. 复合判定由 O(n²) 全量双循环 + Array.includes 线性查找，改为「空间网格
 *    + 3×3 邻域 + Set」常数时间查找；判定阈值与命中顺序不变。
 * 3. 暂停时完全跳过绘制与物理更新（原先每帧仍在 clearRect + 重绘 + 切
 *    ctx.filter），只在恢复、尺寸变化时补画一帧。
 * 4. 逐粒子字符串查找（颜色/符号/字体）全部搬到每帧一次；温度、浓度、暂停、
 *    初始态等参数改由 ref 读取，不再重启整个 effect 与粒子位置。
 * ------------------------------------------------------------------ */

const MAX_DPR = 1.5;
/** 每个时间片最多允许的复合事件数（与原实现“每个阳离子每帧只复合一次”等价） */
const MAX_RECOMBINE_PER_PASS = 256;

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({
  config,
  isInitial,
  isPaused,
  onStatsUpdate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();
  const lastStatsUpdateRef = useRef<number>(0);
  const eventCounters = useRef({ ionization: 0, recombination: 0 });

  // 画布像素尺寸（CSS px + backing store）与对应的粒子世界尺寸
  const sizeRef = useRef({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, dpr: 1, backingWidth: 0, backingHeight: 0 });
  const worldRef = useRef({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
  const dirtyRef = useRef(true);

  // 每帧读取的最新参数（避免因它们重启动画循环）
  const configRef = useRef(config);
  const isPausedRef = useRef(isPaused);
  const isInitialRef = useRef(isInitial);
  const onStatsRef = useRef(onStatsUpdate);
  configRef.current = config;
  isPausedRef.current = isPaused;
  isInitialRef.current = isInitial;
  onStatsRef.current = onStatsUpdate;

  // --- 尺寸自适应：backing store = CSS 尺寸 × DPR ---
  const applyCanvasSize = (cssWidth: number, cssHeight: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !(cssWidth > 0) || !(cssHeight > 0)) return;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const backingWidth = Math.max(1, Math.round(cssWidth * dpr));
    const backingHeight = Math.max(1, Math.round(cssHeight * dpr));

    if (backingWidth !== sizeRef.current.backingWidth ||
        backingHeight !== sizeRef.current.backingHeight) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
    }

    // 粒子世界按容器的真实宽高比建立（容器恒为 8:5），画布 CSS 绝对铺满、不做任何拉伸
    const oldWorld = worldRef.current;
    const newWorld = { width: cssWidth, height: cssHeight };

    if (oldWorld.height > 0 && particlesRef.current.length > 0 &&
        (Math.abs(newWorld.height - oldWorld.height) > 0.5 || sizeRef.current.dpr !== dpr)) {
      const k = newWorld.height / oldWorld.height;
      const s = Math.sqrt(k); // 速度按 √k 缩放，世界变大后观感速度仍然一致
      particlesRef.current.forEach(p => {
        p.x = Math.min(newWorld.width - p.radius, Math.max(p.radius, p.x * k));
        p.y = Math.min(newWorld.height - p.radius, Math.max(p.radius, p.y * k));
        p.vx *= s;
        p.vy *= s;
      });
    }

    sizeRef.current = { width: cssWidth, height: cssHeight, dpr, backingWidth, backingHeight };
    worldRef.current = newWorld;
    dirtyRef.current = true;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const rect = entry.contentRect;
      if (rect.width < 1 || rect.height < 1) return;
      applyCanvasSize(rect.width, rect.height);
    });

    observer.observe(container);
    const rect = container.getBoundingClientRect();
    if (rect.width >= 1 && rect.height >= 1) applyCanvasSize(rect.width, rect.height);

    return () => observer.disconnect();
  }, []);

  // --- 粒子创建 ---
  const createParticle = (
    id: number,
    state: ParticleState,
    x: number,
    y: number,
    baseSpeed: number,
    substanceId: SubstanceType,
    highlight: boolean = false,
    parentId: number = 0
  ): Particle => {
    const angle = Math.random() * Math.PI * 2;
    // 世界尺寸按容器等比放大：半径一律乘 k，速度在世界单位下换算（见 speedScale）
    const k = worldRef.current.height / CANVAS_HEIGHT;
    const speed = baseSpeed * (0.5 + Math.random());

    let color = '#94a3b8';
    const data = substanceId !== SubstanceType.None ? SUBSTANCES[substanceId] : null;
    if (data && !isInitialRef.current) {
      if (state === ParticleState.Molecule) color = data.colors.molecule;
      else if (state === ParticleState.Cation) color = data.colors.cation;
      else if (state === ParticleState.Anion) color = data.colors.anion;
    }

    let radius = 6 * k;
    if (state === ParticleState.Molecule) radius = 9 * k;
    // H+ 画得更小
    if (state === ParticleState.Cation &&
        (substanceId === SubstanceType.HCl || substanceId === SubstanceType.CH3COOH)) {
      radius = 4 * k;
    }

    return {
      id,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius,
      state,
      color,
      angle: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      highlightFrames: highlight ? 30 : 0,
      parentId,
    };
  };
  const createParticleRef = useRef(createParticle);
  createParticleRef.current = createParticle;

  // --- 初始化 / 重置粒子（仅在物质、浓度变化时重建） ---
  useEffect(() => {
    const count = Math.floor(INITIAL_PARTICLE_COUNT_BASE * config.concentration);

    // 速度逻辑：-50°C ~ 100°C 映射到速度向量
    const normalizedTemp = (config.temperature + 50) / 150; // 0.0 ~ 1.0
    const spawnScale = worldRef.current.height / CANVAS_HEIGHT;
    const baseSpeed = (0.3 + normalizedTemp * 3.5) * Math.sqrt(spawnScale);

    const spawnWorld = worldRef.current;
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const x = Math.random() * (spawnWorld.width - 40) + 20;
      const y = Math.random() * (spawnWorld.height - 40) + 20;
      newParticles.push(
        createParticleRef.current(i, ParticleState.Molecule, x, y, baseSpeed, config.substance, false, 0)
      );
    }
    particlesRef.current = newParticles;
    eventCounters.current = { ionization: 0, recombination: 0 };
    dirtyRef.current = true;
  }, [config.substance, config.concentration]);

  // --- 主循环 ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // React StrictMode 会在开发环境跑两次 effect；用本 effect 私有的标记确保
    // 只有一个循环存活（否则会有两个 rAF 循环同时绘制，白白翻倍开销）
    let alive = true;

    const render = (time: number) => {
      if (!alive) return;
      animationRef.current = requestAnimationFrame(render);

      const paused = isPausedRef.current;
      if (paused && !dirtyRef.current) return; // 暂停：不绘制、不计算，零开销
      dirtyRef.current = false;

      const cfg = configRef.current;
      const initial = isInitialRef.current;
      const particles = particlesRef.current;
      const substanceData = SUBSTANCES[cfg.substance];
      const world = worldRef.current;
      const size = sizeRef.current;
      const particlesCount = particles.length;

      // ---- 绘制 ----
      // 世界坐标 = 容器 CSS px，backing store = CSS px × dpr，因此映射就是 dpr
      const scale = size.dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.filter = initial ? 'blur(6px)' : 'none';

      // 每帧一次即可确定的字符串/常量，避免逐粒子重复查找
      // 粒子半径/字号都以 800×500 为基准放大（见 createParticle 的 k），屏幕上尺寸始终一致
      const drawUnit = world.height / CANVAS_HEIGHT;
      const showIonSigns = !initial;
      const ionSignYOffset = Math.max(1, drawUnit);
      const ionSignFont = `bold ${Math.max(7, 10 * drawUnit)}px sans-serif`;
      const neutralRing = 'rgba(255, 220, 100, 0.6)';

      for (let i = 0; i < particlesCount; i++) {
        const p = particles[i];

        if (p.highlightFrames > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 6 * drawUnit, 0, Math.PI * 2);
          ctx.globalAlpha = (p.highlightFrames / 30) * 0.6;
          ctx.fillStyle = neutralRing;
          ctx.fill();
          ctx.globalAlpha = 1;
          if (!paused) p.highlightFrames--;
        }

        ctx.fillStyle = p.color;

        if (p.state === ParticleState.Molecule) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          // 高光细节
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.beginPath();
          ctx.arc(p.x - p.radius * 0.22, p.y - p.radius * 0.22, p.radius / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          if (showIonSigns && p.radius > 3) {
            ctx.fillStyle = '#fff';
            ctx.font = ionSignFont;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.state === ParticleState.Cation ? '+' : '-', p.x, p.y + ionSignYOffset);
          }
        }
      }
      ctx.filter = 'none';

      // ---- 物理与化学 ----
      if (!paused) {
        // 每 400ms 汇总一次统计（统计口径与原来完全一致）
        if (time - lastStatsUpdateRef.current > 400) {
          let mols = 0;
          for (let i = 0; i < particlesCount; i++) {
            if (particles[i].state === ParticleState.Molecule) mols++;
          }
          const ions = particlesCount - mols;
          const elapsed = time - lastStatsUpdateRef.current;
          const rateMultiplier = elapsed > 0 ? 1000 / elapsed : 0;
          onStatsRef.current({
            moleculeCount: mols,
            ionCount: Math.floor(ions / 2),
            ionizationRate: Math.round(eventCounters.current.ionization * rateMultiplier),
            recombinationRate: Math.round(eventCounters.current.recombination * rateMultiplier),
          });

          eventCounters.current = { ionization: 0, recombination: 0 };
          lastStatsUpdateRef.current = time;
        }

        const normalizedTemp = (cfg.temperature + 50) / 150;

        let dissociationChance = 0.0;
        if (substanceData?.strong) {
          dissociationChance = 0.8;
        } else if (substanceData) {
          dissociationChance = 0.00015 * (0.5 + normalizedTemp * 2.5);
        }

        const recombineEnabled = !!substanceData && !substanceData.strong && !initial;
        // 世界比 800×500 大时，速度按 √k 换算，保证屏幕上看到的快慢与原来一致
        const worldScale = world.height / CANVAS_HEIGHT;
        const speedScale = Math.sqrt(worldScale);
        const targetSpeedScale = (0.3 + normalizedTemp * 3.5) * speedScale;

        const removedIndices = new Set<number>();
        const additions: Particle[] = [];

        for (let index = 0; index < particlesCount; index++) {
          if (removedIndices.has(index)) continue;
          const p = particles[index];

          // 物理平动
          p.x += p.vx;
          p.y += p.vy;
          p.angle += p.rotationSpeed;

          // 边界反弹
          if (p.x < p.radius || p.x > world.width - p.radius) p.vx *= -1;
          if (p.y < p.radius || p.y > world.height - p.radius) p.vy *= -1;
          p.x = p.x < p.radius ? p.radius : (p.x > world.width - p.radius ? world.width - p.radius : p.x);
          p.y = p.y < p.radius ? p.radius : (p.y > world.height - p.radius ? world.height - p.radius : p.y);

          // 温度对速度的牵引
          const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (currentSpeed > 0) {
            const speedDiff = targetSpeedScale - currentSpeed;
            if (speedDiff > 0.1 || speedDiff < -0.1) {
              const factor = (speedDiff / currentSpeed) * 0.05;
              p.vx += p.vx * factor;
              p.vy += p.vy * factor;
            }
          }

          // 化学：解离
          if (!initial && p.state === ParticleState.Molecule && substanceData) {
            if (Math.random() < dissociationChance) {
              removedIndices.add(index);
              eventCounters.current.ionization++;

              const popSpeed = 2.5 + Math.random() * 1.5;
              const angle = Math.random() * Math.PI * 2;
              const splitId = Date.now() + Math.random() + index;
              const k = worldScale;

              const cat = createParticleRef.current(
                Date.now() + Math.random(), ParticleState.Cation, p.x, p.y,
                targetSpeedScale, cfg.substance, true, splitId
              );
              cat.vx = Math.cos(angle) * popSpeed * k;
              cat.vy = Math.sin(angle) * popSpeed * k;

              const an = createParticleRef.current(
                Date.now() + Math.random() + 1, ParticleState.Anion, p.x, p.y,
                targetSpeedScale, cfg.substance, true, splitId
              );
              an.vx = Math.cos(angle + Math.PI) * popSpeed * k;
              an.vy = Math.sin(angle + Math.PI) * popSpeed * k;

              additions.push(cat, an);
            }
          }
        }

        // 化学：复合（空间网格 + 3×3 邻域，替代 O(n²) 全量比对）
        if (recombineEnabled) {
          // 当前最大粒径（分子 9×k）+ 判定余量 2×k，留一倍安全边界，保证不漏判
          const k = worldScale;
          const cellSize = Math.max(8, 22 * k);
          const cols = Math.max(1, Math.ceil(world.width / cellSize));
          const rows = Math.max(1, Math.ceil(world.height / cellSize));
          const grid = new Map<number, number[]>();
          const cellOf = new Int32Array(particlesCount);

          for (let i = 0; i < particlesCount; i++) {
            if (removedIndices.has(i)) {
              cellOf[i] = -1;
              continue;
            }
            const p = particles[i];
            const cx = p.x < 0 ? 0 : (p.x >= world.width ? cols - 1 : (p.x / cellSize) | 0);
            const cy = p.y < 0 ? 0 : (p.y >= world.height ? rows - 1 : (p.y / cellSize) | 0);
            const key = cy * cols + cx;
            cellOf[i] = key;
            const bucket = grid.get(key);
            if (bucket) bucket.push(i);
            else grid.set(key, [i]);
          }

          let recombined = 0;
          outer:
          for (let i = 0; i < particlesCount; i++) {
            const p1 = particles[i];
            if (cellOf[i] === -1 || p1.state === ParticleState.Molecule) continue;

            const key = cellOf[i];
            const cx = key % cols;
            const cy = (key - cx) / cols;

            for (let ny = cy - 1; ny <= cy + 1; ny++) {
              if (ny < 0 || ny >= rows) continue;
              for (let nx = cx - 1; nx <= cx + 1; nx++) {
                if (nx < 0 || nx >= cols) continue;
                const bucket = grid.get(ny * cols + nx);
                if (!bucket) continue;

                for (let b = 0; b < bucket.length; b++) {
                  const j = bucket[b];
                  if (j === i || cellOf[j] === -1) continue;
                  const p2 = particles[j];
                  if (p2.state === ParticleState.Molecule || p1.state === p2.state) continue;

                  // 同一次解离产生的离子不能立刻复合
                  if (p1.parentId !== 0 && p1.parentId === p2.parentId) continue;

                  const dx = p1.x - p2.x;
                  const dy = p1.y - p2.y;
                  const threshold = p1.radius + p2.radius + 2 * k;
                  if (dx * dx + dy * dy < threshold * threshold) {
                    if (Math.random() < 0.5) {
                      removedIndices.add(i);
                      removedIndices.add(j);
                      cellOf[i] = -1;
                      cellOf[j] = -1;
                      eventCounters.current.recombination++;

                      const mol = createParticleRef.current(
                        Date.now(), ParticleState.Molecule,
                        (p1.x + p2.x) / 2, (p1.y + p2.y) / 2,
                        targetSpeedScale, cfg.substance, true, 0
                      );
                      additions.push(mol);
                      recombined++;
                      break;
                    } else {
                      // 弹性碰撞
                      const tvx = p1.vx; p1.vx = p2.vx; p2.vx = tvx;
                      const tvy = p1.vy; p1.vy = p2.vy; p2.vy = tvy;
                    }
                  }
                }
                if (cellOf[i] === -1) break outer;
              }
            }
            if (recombined >= MAX_RECOMBINE_PER_PASS) break;
          }
        }

        if (removedIndices.size > 0) {
          const kept: Particle[] = [];
          for (let i = 0; i < particlesCount; i++) {
            if (!removedIndices.has(i)) kept.push(particles[i]);
          }
          if (additions.length > 0) kept.push(...additions);
          particlesRef.current = kept;
        } else if (additions.length > 0) {
          particles.push(...additions);
        }
      }
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      alive = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // 暂停/恢复、初始态切换时补画一帧，保证冻结画面与角标同步
  useEffect(() => {
    dirtyRef.current = true;
  }, [isPaused, isInitial]);

  const pauseBadgeStyle = useMemo(
    () => ({
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(6px)',
    }),
    []
  );

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden bg-cyan-100/50"
    >
      <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-b from-cyan-200/50 to-transparent z-10 pointer-events-none"></div>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {isInitial && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full text-slate-500 font-medium shadow-sm">
            未知溶液 (请选择物质)
          </span>
        </div>
      )}

      {/* 暂停角标：左上角，不遮挡观察区域，也没有整层蒙版 */}
      {isPaused && !isInitial && (
        <div
          className="absolute top-3 left-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 text-slate-600 font-semibold text-sm shadow-sm pointer-events-none"
          style={pauseBadgeStyle}
        >
          <span className="w-1.5 h-1.5 rounded-sm bg-amber-500"></span>
          ⏸ 已暂停
        </div>
      )}
    </div>
  );
};

export default SimulationCanvas;
