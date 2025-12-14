import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Vector3, Euler } from 'three';
import { Edges } from '@react-three/drei';
import { BlockData, useStore } from '../store';

interface Props {
  data: BlockData;
}

const FloatingBlock: React.FC<Props> = ({ data }) => {
  const meshRef = useRef<Mesh>(null);
  const { id, color, scale } = data;
  
  const selectedBlockId = useStore(s => s.selectedBlockId);
  const grabbedBlockId = useStore(s => s.grabbedBlockId);
  const cursorPosition = useStore(s => s.cursorPosition);
  const gesture = useStore(s => s.gesture);
  const rotationInput = useStore(s => s.rotation);
  const updateBlockPosition = useStore(s => s.updateBlockPosition);

  const isSelected = selectedBlockId === id;
  const isGrabbed = grabbedBlockId === id;

  // Random floating parameters
  const floatSpeed = useMemo(() => 0.5 + Math.random() * 0.5, []);
  const floatOffset = useMemo(() => Math.random() * 100, []);
  const rotationSpeed = useMemo(() => (Math.random() - 0.5) * 0.02, []);

  // Smoothed position for dragging
  const targetPos = useRef(new Vector3(...data.position));

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    if (isGrabbed && gesture === 'PINCH') {
      // Logic for dragging
      // Map normalized cursor (-1 to 1) to 3D frustum plane at current Z depth
      const vector = new Vector3(cursorPosition.x, cursorPosition.y, 0.5); // 0.5 is roughly mid depth
      vector.unproject(state.camera);
      
      const dir = vector.sub(state.camera.position).normalize();
      const distance = -state.camera.position.z / dir.z; // Project to Z=0 plane (rough approximation)
      
      // We want to maintain the object's original Z depth relative to camera or move it on a plane
      // Simple approach: Move x/y, keep z mostly stable but allow some drift
      // Better approach for "no code" feel: Follow cursor on a plane at the object's current distance
      const distToObj = state.camera.position.distanceTo(new Vector3(...data.position));
      const pos = state.camera.position.clone().add(dir.multiplyScalar(distToObj));
      
      targetPos.current.lerp(pos, 0.2); // Smooth follow
      
      // Update global store
      updateBlockPosition(id, [targetPos.current.x, targetPos.current.y, targetPos.current.z]);

    } else if (isGrabbed && (gesture === 'OPEN_PALM' || gesture === 'NONE')) {
        // Released
        // Note: The store handles the 'release' logic in Scene interaction loop, 
        // but here we just ensure we resume physics if not pinched
    } else {
      // Idle Floating Animation
      const time = state.clock.getElapsedTime();
      const yOffset = Math.sin(time * floatSpeed + floatOffset) * 0.002;
      
      meshRef.current.position.y += yOffset;
      meshRef.current.rotation.x += rotationSpeed;
      meshRef.current.rotation.y += rotationSpeed;

      // Sync physics drift back to store occasionally or just let it be visual?
      // For this prototype, visual drift is fine, but if we grab it again, it snaps to store position.
      // Better: Update mesh from store, and add visual offset in a child group? 
      // Simplified: Just update the mesh position from props + visual noise.
      meshRef.current.position.set(...data.position);
      meshRef.current.position.y += Math.sin(time * floatSpeed + floatOffset) * 0.5; // Larger float amplitude
      
      // Rotation logic
      if (isSelected && gesture === 'OPEN_PALM') {
         // Maybe rotate slightly to face camera?
      }
    }
    
    // Manual Wrist Rotation
    if (isGrabbed) {
       // Apply wrist rotation to Z axis
       meshRef.current.rotation.z = -rotationInput * 2; // amplify effect
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={data.position}
      scale={scale}
      rotation={data.rotation as any}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshPhysicalMaterial
        color={color}
        transparent
        opacity={0.6}
        roughness={0.1}
        transmission={0.6}
        thickness={1.5}
        iridescence={1}
        iridescenceIOR={1.3}
        clearcoat={1}
      />
      {/* Selection Outline */}
      {isSelected && (
        <Edges
          scale={1.05}
          threshold={15} // Display edges only when the angle between two faces exceeds this value (degrees)
          color={isGrabbed ? "white" : "#ffff00"}
        />
      )}
      {/* Inner Glow */}
      <mesh scale={[0.9, 0.9, 0.9]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={color} transparent opacity={0.2} wireframe />
      </mesh>
    </mesh>
  );
};

export default FloatingBlock;
