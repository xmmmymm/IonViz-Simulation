export enum SubstanceType {
  None = 'NONE',
  HCl = 'HCL',
  CH3COOH = 'CH3COOH',
  NH3H2O = 'NH3H2O',
}

export enum ParticleState {
  Molecule = 'MOLECULE',
  Cation = 'CATION',
  Anion = 'ANION',
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  state: ParticleState;
  color: string;
  // For molecules, we might visualize them as two joined circles, so we track an angle
  angle: number; 
  rotationSpeed: number;
  // Visual highlight for events (0 = no highlight, >0 = frames remaining)
  highlightFrames: number;
  // ID of the dissociation event or parent molecule. Used to prevent immediate recombination.
  parentId: number; 
}

export interface SimulationConfig {
  substance: SubstanceType;
  temperature: number; // 0 to 100 scale
  concentration: number; // 0.1 to 2.0 scale (multiplier for particle count)
}

export interface SubstanceData {
  id: SubstanceType;
  name: string;
  formula: string;
  equation: string;
  kType: string;
  kValue: string;
  description: string;
  strong: boolean; // if true, 100% ionization
  colors: {
    molecule: string;
    cation: string;
    anion: string;
  };
  labels: {
    molecule: string;
    cation: string;
    anion: string;
  };
}