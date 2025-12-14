import { create } from 'zustand';

export type GestureType = 'NONE' | 'OPEN_PALM' | 'PINCH' | 'FIST' | 'THUMBS_UP' | 'WAVE' | 'POINTING_UP';

interface AppState {
  // Hand State
  handPresent: boolean;
  cursorPosition: { x: number; y: number }; // Normalized -1 to 1
  gesture: GestureType;
  rotation: number; // Wrist rotation in radians
  
  // Scene State
  blocks: BlockData[];
  particles: ParticleData[];
  selectedBlockId: string | null;
  grabbedBlockId: string | null;
  cameraPan: number;

  // Actions
  setHandState: (present: boolean, x: number, y: number, gesture: GestureType, rotation: number) => void;
  addBlock: (block: BlockData) => void;
  removeBlock: (id: string) => void;
  updateBlockPosition: (id: string, position: [number, number, number], rotation?: [number, number, number]) => void;
  setSelectedBlock: (id: string | null) => void;
  setGrabbedBlock: (id: string | null) => void;
  triggerExplosion: (position: [number, number, number], color: string) => void;
  clearParticles: (id: string) => void;
  panCamera: (delta: number) => void;
}

export interface BlockData {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
  scale: [number, number, number];
}

export interface ParticleData {
  id: string;
  position: [number, number, number];
  color: string;
  createdAt: number;
}

export const useStore = create<AppState>((set) => ({
  handPresent: false,
  cursorPosition: { x: 0, y: 0 },
  gesture: 'NONE',
  rotation: 0,
  
  blocks: Array.from({ length: 12 }).map((_, i) => ({
    id: `block-${i}`,
    position: [
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 4
    ],
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0],
    color: i % 2 === 0 ? '#60a5fa' : i % 3 === 0 ? '#c084fc' : '#f472b6', // Blue, Purple, Pink
    scale: [1, 1, 1]
  })),
  particles: [],
  selectedBlockId: null,
  grabbedBlockId: null,
  cameraPan: 0,

  setHandState: (present, x, y, gesture, rotation) => set({ handPresent: present, cursorPosition: { x, y }, gesture, rotation }),
  
  addBlock: (block) => set((state) => ({ blocks: [...state.blocks, block] })),
  
  removeBlock: (id) => set((state) => ({ 
    blocks: state.blocks.filter(b => b.id !== id),
    selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
    grabbedBlockId: state.grabbedBlockId === id ? null : state.grabbedBlockId
  })),

  updateBlockPosition: (id, position, rotation) => set((state) => ({
    blocks: state.blocks.map(b => b.id === id ? { ...b, position, rotation: rotation || b.rotation } : b)
  })),

  setSelectedBlock: (id) => set({ selectedBlockId: id }),
  
  setGrabbedBlock: (id) => set({ grabbedBlockId: id }),

  triggerExplosion: (position, color) => {
    const newParticles: ParticleData[] = [];
    const count = 20;
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: Math.random().toString(36),
        position: [
          position[0] + (Math.random() - 0.5) * 0.5,
          position[1] + (Math.random() - 0.5) * 0.5,
          position[2] + (Math.random() - 0.5) * 0.5,
        ],
        color,
        createdAt: Date.now()
      });
    }
    set(state => ({ particles: [...state.particles, ...newParticles] }));
  },

  clearParticles: (id) => set(state => ({ particles: state.particles.filter(p => p.id !== id) })),
  
  panCamera: (delta) => set(state => ({ cameraPan: state.cameraPan + delta }))
}));
