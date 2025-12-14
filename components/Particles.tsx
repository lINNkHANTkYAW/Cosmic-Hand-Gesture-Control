import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Color } from 'three';
import { ParticleData, useStore } from '../store';

interface Props {
  data: ParticleData;
}

const Particles: React.FC<Props> = ({ data }) => {
  const meshRef = useRef<InstancedMesh>(null);
  const clearParticles = useStore(state => state.clearParticles);
  const count = 30;
  
  // Initialize particle velocities
  const velocities = useMemo(() => {
    const v = [];
    for (let i = 0; i < count; i++) {
      v.push({
        x: (Math.random() - 0.5) * 0.2,
        y: (Math.random() - 0.5) * 0.2,
        z: (Math.random() - 0.5) * 0.2
      });
    }
    return v;
  }, []);

  const dummy = useMemo(() => new Object3D(), []);

  useFrame((state) => {
    if (!meshRef.current) return;

    const timeAlive = (Date.now() - data.createdAt) / 1000;
    
    // Remove after 2 seconds
    if (timeAlive > 2) {
        clearParticles(data.id);
        return;
    }

    for (let i = 0; i < count; i++) {
        // Update positions based on velocity and gravity
        dummy.position.set(
            data.position[0] + velocities[i].x * timeAlive * 20,
            data.position[1] + velocities[i].y * timeAlive * 20,
            data.position[2] + velocities[i].z * timeAlive * 20
        );
        
        // Spin
        dummy.rotation.set(
            Math.random() * timeAlive, 
            Math.random() * timeAlive, 
            Math.random() * timeAlive
        );

        // Fade out scale
        const s = Math.max(0, 1 - timeAlive);
        dummy.scale.set(s * 0.2, s * 0.2, s * 0.2);
        
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color={data.color} toneMapped={false} />
    </instancedMesh>
  );
};

export default Particles;
