import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Vector3, Raycaster } from 'three';
import { useStore } from '../store';
import FloatingBlock from './FloatingBlock';
import Particles from './Particles';

// Interaction Manager inside Canvas context
const InteractionManager = () => {
  const { camera, scene, size } = useThree();
  const raycaster = useRef(new Raycaster());
  
  const blocks = useStore(state => state.blocks);
  const cursorPosition = useStore(state => state.cursorPosition);
  const gesture = useStore(state => state.gesture);
  const handPresent = useStore(state => state.handPresent);
  
  const setSelectedBlock = useStore(state => state.setSelectedBlock);
  const setGrabbedBlock = useStore(state => state.setGrabbedBlock);
  const triggerExplosion = useStore(state => state.triggerExplosion);
  const removeBlock = useStore(state => state.removeBlock);
  const addBlock = useStore(state => state.addBlock);
  
  // Refs to track previous states to detect edges
  const prevGesture = useRef(gesture);
  const prevSelectedId = useRef<string | null>(null);

  useFrame(() => {
    if (!handPresent) {
        setSelectedBlock(null);
        setGrabbedBlock(null);
        return;
    }

    // 1. Raycasting to find hovered object
    raycaster.current.setFromCamera(cursorPosition, camera);
    const intersects = raycaster.current.intersectObjects(scene.children, true);
    
    // Filter intersections to only find our blocks (Mesh type)
    // We assume blocks are the primary meshes, excluding helper objects
    const blockIntersects = intersects.filter(hit => 
      hit.object.type === 'Mesh' && 
      hit.object.userData?.isParticle !== true && // Ignore particles
      hit.object.parent?.type !== 'Scene' // Ensure it's not skybox/stars if they are meshes
    );

    // Find the closest block
    let closestId: string | null = null;
    let closestDist = Infinity;

    // Map mesh uuid back to block id? 
    // Easier: Just check distance to known block positions for robustness against scene graph complexity
    // Or attach userData to blocks. Let's do distance check for simplicity in this prototype structure
    if (blocks.length > 0) {
        // Find block closest to ray
        // Project block positions to screen space and check distance to cursor?
        // Or standard raycast. Standard raycast is better for occlusion.
        
        // Since we are iterating standard Threejs raycasts, we need to map the hit object back to our store ID.
        // But our store ID is abstract. The FloatingBlock component doesn't write back its UUID.
        // Fix: Use simple spatial query. Find block closest to the ray line.
        
        const ray = raycaster.current.ray;
        blocks.forEach(block => {
            const blockPos = new Vector3(...block.position);
            // Calculate distance from point to line
            const dist = ray.distanceSqToPoint(blockPos);
            
            // Threshold for selection
            if (dist < 2 && dist < closestDist) { // 2 is heuristic radius
                closestDist = dist;
                closestId = block.id;
            }
        });
    }

    const currentlySelected = useStore.getState().selectedBlockId;
    const currentlyGrabbed = useStore.getState().grabbedBlockId;

    // 2. State Machine for Gestures
    
    // SELECT: If not holding anything, open palm selects nearest
    if (!currentlyGrabbed) {
        if (gesture === 'OPEN_PALM' || gesture === 'NONE') {
            if (closestId !== currentlySelected) {
                setSelectedBlock(closestId);
            }
        }
    }

    // GRAB: Pinch to grab selected
    if (currentlySelected && gesture === 'PINCH' && prevGesture.current !== 'PINCH') {
        setGrabbedBlock(currentlySelected);
    }
    
    // RELEASE: Open palm releases grab
    if (currentlyGrabbed && gesture === 'OPEN_PALM' && prevGesture.current !== 'OPEN_PALM') {
        setGrabbedBlock(null);
    }

    // EXPLODE: Fist on selected/grabbed
    if (currentlySelected && gesture === 'FIST' && prevGesture.current !== 'FIST') {
        const block = blocks.find(b => b.id === currentlySelected);
        if (block) {
            triggerExplosion(block.position, block.color);
            removeBlock(currentlySelected);
            setGrabbedBlock(null);
            setSelectedBlock(null);
        }
    }

    // DUPLICATE: Thumbs up on selected
    if (currentlySelected && gesture === 'THUMBS_UP' && prevGesture.current !== 'THUMBS_UP') {
        const block = blocks.find(b => b.id === currentlySelected);
        if (block) {
            addBlock({
                ...block,
                id: Math.random().toString(36),
                position: [block.position[0] + 1.5, block.position[1], block.position[2]]
            });
        }
    }

    prevGesture.current = gesture;
    prevSelectedId.current = currentlySelected;
  });

  return null;
};

// Camera Controller for Panning
const CameraController = () => {
    const { camera } = useThree();
    const cameraPan = useStore(state => state.cameraPan);
    const targetPan = useRef(0);

    useFrame(() => {
        // Smoothly interpolate current rotation to target rotation
        targetPan.current += (cameraPan - targetPan.current) * 0.1;
        // camera.rotation.y = targetPan.current * 0.5; // Rotate around Y axis
        // OR move camera position x
        camera.position.x = -targetPan.current * 2; 
        camera.lookAt(0, 0, 0);
    });
    return null;
}


const Scene3D: React.FC = () => {
  const blocks = useStore(state => state.blocks);
  const particles = useStore(state => state.particles);

  return (
    <div className="w-full h-screen">
      <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
        <color attach="background" args={['#050510']} />
        
        {/* Environment */}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#ff00ff" />
        <pointLight position={[-10, -10, -10]} intensity={1.5} color="#00ffff" />
        <spotLight position={[0, 10, 0]} intensity={0.8} />

        {/* Interaction & Logic */}
        <InteractionManager />
        <CameraController />

        {/* Objects */}
        {blocks.map(block => (
          <FloatingBlock key={block.id} data={block} />
        ))}
        
        {particles.map(p => (
            <Particles key={p.id} data={p} />
        ))}

        {/* Post Processing */}
        <EffectComposer>
          <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} height={300} intensity={1.5} />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default Scene3D;
