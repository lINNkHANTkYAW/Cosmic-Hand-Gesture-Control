import React, { useState } from 'react';
import Scene3D from './components/Scene3D';
import HandController from './components/HandController';
import { Hand, Info, RotateCcw, X } from 'lucide-react';

const App: React.FC = () => {
  const [showInstructions, setShowInstructions] = useState(true);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <Scene3D />
      </div>

      {/* Hand Controller (Hidden/Minimized UI, Logic runs) */}
      <HandController />

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 p-6 z-10 pointer-events-none">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 drop-shadow-lg">
          Cosmic Manipulator
        </h1>
        <p className="text-blue-200 text-sm mt-2 opacity-80 max-w-md">
          Use your hands to control the universe. Allow camera access to begin.
        </p>
      </div>

      {/* Instructions Modal */}
      {showInstructions && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-auto">
          <div className="bg-gray-900 border border-gray-700 p-8 rounded-2xl max-w-2xl w-full shadow-2xl relative">
            <button 
              onClick={() => setShowInstructions(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            
            <div className="flex items-center gap-3 mb-6">
              <Hand className="text-purple-400" size={32} />
              <h2 className="text-2xl font-bold text-white">Gesture Controls</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InstructionItem 
                icon="✋" 
                title="Select" 
                desc="Open Palm facing camera to highlight nearest block." 
              />
              <InstructionItem 
                icon="👌" 
                title="Grab & Drag" 
                desc="Pinch Thumb & Index finger to move blocks." 
              />
              <InstructionItem 
                icon="🔄" 
                title="Rotate" 
                desc="Rotate wrist while pinching to spin block." 
              />
              <InstructionItem 
                icon="✊" 
                title="Explode" 
                desc="Clench Fist to destroy selected block." 
              />
              <InstructionItem 
                icon="👋" 
                title="Pan View" 
                desc="Wave hand left/right quickly to move camera." 
              />
              <InstructionItem 
                icon="👍" 
                title="Duplicate" 
                desc="Thumbs Up to copy selected block." 
              />
            </div>

            <button 
              onClick={() => setShowInstructions(false)}
              className="mt-8 w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-bold hover:opacity-90 transition-opacity"
            >
              Enter The Void
            </button>
          </div>
        </div>
      )}

      {/* Footer / Toggle Info */}
      {!showInstructions && (
        <button 
          onClick={() => setShowInstructions(true)}
          className="absolute bottom-6 left-6 z-20 p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-colors pointer-events-auto"
        >
          <Info size={24} />
        </button>
      )}

      {/* Cursor Indicator (Optional, visualizing hand tracking in 2D space) */}
      <CursorOverlay />
    </div>
  );
};

const InstructionItem: React.FC<{icon: string, title: string, desc: string}> = ({ icon, title, desc }) => (
  <div className="flex items-start gap-4 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
    <span className="text-3xl">{icon}</span>
    <div>
      <h3 className="font-bold text-blue-300">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
    </div>
  </div>
);

import { useStore } from './store';

const CursorOverlay = () => {
  const { x, y } = useStore(state => state.cursorPosition);
  const gesture = useStore(state => state.gesture);
  const handPresent = useStore(state => state.handPresent);

  if (!handPresent) return null;

  // Map -1..1 to 0..100%
  const screenX = (x + 1) * 50;
  const screenY = (-y + 1) * 50; // Invert Y for CSS top

  const color = 
    gesture === 'PINCH' ? 'border-green-400 bg-green-400/30' : 
    gesture === 'FIST' ? 'border-red-500 bg-red-500/30' :
    'border-blue-400';

  return (
    <div 
      className={`absolute w-8 h-8 rounded-full border-2 ${color} transform -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-75 z-50`}
      style={{ left: `${screenX}%`, top: `${screenY}%` }}
    >
      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-mono text-white whitespace-nowrap bg-black/50 px-1 rounded">
        {gesture}
      </div>
    </div>
  );
};

export default App;
