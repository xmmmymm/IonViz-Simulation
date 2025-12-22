import React, { useRef, useEffect } from 'react';
import { Particle, ParticleState, SimulationConfig, SubstanceType } from '../types';
import { SUBSTANCES, INITIAL_PARTICLE_COUNT_BASE, CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';

interface SimulationCanvasProps {
  config: SimulationConfig;
  isInitial: boolean;
  isPaused: boolean;
  onStatsUpdate: (stats: { 
    moleculeCount: number; 
    ionCount: number; 
    ionizationRate: number; 
    recombinationRate: number 
  }) => void;
}

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ config, isInitial, isPaused, onStatsUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();
  const lastStatsUpdateRef = useRef<number>(0);
  
  // Track events per interval for rate calculation
  const eventCounters = useRef({ ionization: 0, recombination: 0 });

  // --- Helper: Create a single particle ---
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
    const speed = baseSpeed * (0.5 + Math.random()); 
    
    let color = '#94a3b8'; 
    if (substanceId !== SubstanceType.None && !isInitial) {
      const data = SUBSTANCES[substanceId];
      if (data) {
        if (state === ParticleState.Molecule) color = data.colors.molecule;
        else if (state === ParticleState.Cation) color = data.colors.cation;
        else if (state === ParticleState.Anion) color = data.colors.anion;
      }
    }

    let radius = 6;
    if (state === ParticleState.Molecule) radius = 9;
    
    // H+ drawn smaller
    if (state === ParticleState.Cation && (substanceId === SubstanceType.HCl || substanceId === SubstanceType.CH3COOH)) {
        radius = 4;
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
      highlightFrames: highlight ? 30 : 0, // Highlight for 30 frames (~0.5s)
      parentId,
    };
  };

  // --- Initialization Effect ---
  useEffect(() => {
    const count = Math.floor(INITIAL_PARTICLE_COUNT_BASE * config.concentration);
    
    // Speed Logic: Map -50C to 100C to a speed vector magnitude
    const normalizedTemp = (config.temperature + 50) / 150; // 0.0 to 1.0
    const baseSpeed = 0.3 + (normalizedTemp * 3.5);

    let startState = ParticleState.Molecule;
    const substanceData = SUBSTANCES[config.substance];

    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const x = Math.random() * (CANVAS_WIDTH - 40) + 20;
      const y = Math.random() * (CANVAS_HEIGHT - 40) + 20;
      // Initialize with 0 parentId (no specific parent constraint initially)
      newParticles.push(createParticle(i, startState, x, y, baseSpeed, config.substance, false, 0));
    }
    particlesRef.current = newParticles;
    eventCounters.current = { ionization: 0, recombination: 0 };
    
  }, [config.substance, config.concentration, isInitial]);

  // --- Simulation Loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = (time: number) => {
      // 1. Drawing (Always draw, even if paused)
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      const particles = particlesRef.current;
      const substanceData = SUBSTANCES[config.substance];
      
      // Filter for blur
      if (isInitial) {
          ctx.filter = 'blur(6px)';
      } else {
          ctx.filter = 'none';
      }

      // Draw Loop
      particles.forEach(p => {
          // --- Draw Highlight Ring (if active) ---
          if (p.highlightFrames > 0) {
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(255, 220, 100, ${p.highlightFrames / 30 * 0.6})`; // Fading yellow glow
              ctx.fill();
              if (!isPaused) p.highlightFrames--;
          }

          ctx.beginPath();
          ctx.fillStyle = p.color;
          
          if (p.state === ParticleState.Molecule) {
              ctx.save();
              ctx.translate(p.x, p.y);
              ctx.rotate(p.angle);
              ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
              ctx.fill();
              // Detail
              ctx.fillStyle = 'rgba(255,255,255,0.3)';
              ctx.beginPath();
              ctx.arc(-2, -2, p.radius/2, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
          } else {
              ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
              ctx.fill();
              if (!isInitial) {
                  ctx.fillStyle = '#fff';
                  ctx.font = 'bold 10px sans-serif';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  const symbol = p.state === ParticleState.Cation ? '+' : '-';
                  if (p.radius > 3) ctx.fillText(symbol, p.x, p.y + 1);
              }
          }
      });

      // 2. Physics & Chemistry Update (Skip if paused)
      if (!isPaused) {
        
        // Stats Calculation (Every 500ms)
        if (time - lastStatsUpdateRef.current > 500) {
            let mols = 0;
            let ions = 0;
            particles.forEach(p => {
                if (p.state === ParticleState.Molecule) mols++;
                else ions++; 
            });
            
            // Normalize rates to "events per second approx"
            const rateMultiplier = 1000 / (time - lastStatsUpdateRef.current);

            onStatsUpdate({ 
                moleculeCount: mols, 
                ionCount: Math.floor(ions / 2),
                ionizationRate: Math.round(eventCounters.current.ionization * rateMultiplier),
                recombinationRate: Math.round(eventCounters.current.recombination * rateMultiplier)
            });
            
            // Reset event counters
            eventCounters.current = { ionization: 0, recombination: 0 };
            lastStatsUpdateRef.current = time;
        }

        // Temp factor for Chemistry (-50 to 100 range)
        const normalizedTemp = (config.temperature + 50) / 150; 
        
        let dissociationChance = 0.0;
        if (substanceData?.strong) {
             dissociationChance = 0.8; 
        } else if (substanceData) {
             // Weak electrolyte chance - ADJUSTED FOR REALISM
             // Real alpha for weak acids is often < 1%.
             // We lower the base chance significantly.
             // 0.00015 base chance per frame.
             dissociationChance = 0.00015 * (0.5 + normalizedTemp * 2.5); 
        }

        const recombineEnabled = substanceData && !substanceData.strong && !isInitial;
        const targetSpeedScale = 0.3 + normalizedTemp * 3.5; 

        const particlesToRemove: number[] = [];
        const particlesToAdd: Particle[] = [];

        particles.forEach((p, index) => {
            if (particlesToRemove.includes(index)) return;

            // Physics
            p.x += p.vx;
            p.y += p.vy;
            p.angle += p.rotationSpeed;

            // Bounds
            if (p.x < p.radius || p.x > CANVAS_WIDTH - p.radius) p.vx *= -1;
            if (p.y < p.radius || p.y > CANVAS_HEIGHT - p.radius) p.vy *= -1;
            p.x = Math.max(p.radius, Math.min(CANVAS_WIDTH - p.radius, p.x));
            p.y = Math.max(p.radius, Math.min(CANVAS_HEIGHT - p.radius, p.y));

            // Temp Speed Control
            const currentSpeed = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
            const speedDiff = targetSpeedScale - currentSpeed;
            if (Math.abs(speedDiff) > 0.1) {
                const adjustFactor = 0.05;
                p.vx += p.vx * (speedDiff / currentSpeed) * adjustFactor;
                p.vy += p.vy * (speedDiff / currentSpeed) * adjustFactor;
            }

            // Chemistry: Dissociation
            if (!isInitial && p.state === ParticleState.Molecule && substanceData) {
                if (Math.random() < dissociationChance) {
                    particlesToRemove.push(index);
                    eventCounters.current.ionization++; 
                    
                    // Increased pop speed
                    const popSpeed = 2.5 + Math.random() * 1.5; 
                    const angle = Math.random() * Math.PI * 2;
                    
                    const splitId = Date.now() + Math.random() + index;

                    const cat = createParticle(Date.now() + Math.random(), ParticleState.Cation, p.x, p.y, targetSpeedScale, config.substance, true, splitId);
                    cat.vx = Math.cos(angle) * popSpeed;
                    cat.vy = Math.sin(angle) * popSpeed;

                    const an = createParticle(Date.now() + Math.random() + 1, ParticleState.Anion, p.x, p.y, targetSpeedScale, config.substance, true, splitId);
                    an.vx = Math.cos(angle + Math.PI) * popSpeed; 
                    an.vy = Math.sin(angle + Math.PI) * popSpeed;

                    particlesToAdd.push(cat, an);
                }
            }
        });

        // Chemistry: Recombination
        if (recombineEnabled) {
            for (let i = 0; i < particles.length; i++) {
                if (particlesToRemove.includes(i)) continue;
                const p1 = particles[i];
                if (p1.state === ParticleState.Molecule) continue;

                for (let j = i + 1; j < particles.length; j++) {
                    if (particlesToRemove.includes(j)) continue;
                    const p2 = particles[j];
                    if (p2.state === ParticleState.Molecule || p1.state === p2.state) continue;

                    // --- CHECK: Parent ID ---
                    if (p1.parentId !== 0 && p1.parentId === p2.parentId) {
                        continue;
                    }

                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);

                    if (dist < (p1.radius + p2.radius + 2)) {
                        // Increased recombination chance to 0.5 to keep ions scarce
                        const recombinationChance = 0.5; 
                        
                        if (Math.random() < recombinationChance) {
                            particlesToRemove.push(i);
                            particlesToRemove.push(j);
                            eventCounters.current.recombination++; 

                            const midX = (p1.x + p2.x) / 2;
                            const midY = (p1.y + p2.y) / 2;
                            const mol = createParticle(Date.now(), ParticleState.Molecule, midX, midY, targetSpeedScale, config.substance, true, 0);
                            particlesToAdd.push(mol);
                            break; 
                        } else {
                            // Elastic bounce
                            const tempVx = p1.vx; p1.vx = p2.vx; p2.vx = tempVx;
                            const tempVy = p1.vy; p1.vy = p2.vy; p2.vy = tempVy;
                        }
                    }
                }
            }
        }

        if (particlesToRemove.length > 0) {
            particlesToRemove.sort((a, b) => b - a);
            const uniqueIndices = new Set(particlesToRemove);
            particlesRef.current = particles.filter((_, idx) => !uniqueIndices.has(idx));
        }
        if (particlesToAdd.length > 0) {
            particlesRef.current.push(...particlesToAdd);
        }
      } 
      
      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [config.substance, config.temperature, config.concentration, isInitial, isPaused]);

  return (
    <div className="relative w-full h-full bg-cyan-100/50 rounded-xl overflow-hidden border border-cyan-200 shadow-inner group">
        <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-b from-cyan-200/50 to-transparent z-10 pointer-events-none"></div>
        <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full h-full block"
        />
        
        {isInitial && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full text-slate-500 font-medium shadow-sm">
                    未知溶液 (请选择物质)
                </span>
            </div>
        )}

        {isPaused && !isInitial && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="bg-black/5 absolute inset-0"></div> 
                <span className="bg-white/95 px-4 py-2 rounded-lg text-slate-600 font-bold shadow-md z-30 flex items-center gap-2 border border-slate-200">
                    ⏸ 已暂停
                </span>
            </div>
        )}
    </div>
  );
};

export default SimulationCanvas;