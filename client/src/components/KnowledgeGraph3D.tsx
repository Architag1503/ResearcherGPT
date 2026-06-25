'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { useState, useMemo } from 'react';

interface GraphNode {
  id: string;
  label: string;
  type: 'paper' | 'author' | 'method' | 'dataset' | 'keyword' | 'concept';
  val?: number;
  color?: string;
}

interface GraphLink {
  source: string;
  target: string;
  label: string;
}

interface KnowledgeGraph3DProps {
  nodes: GraphNode[];
  links: GraphLink[];
  onNodeClick?: (nodeId: string, nodeType: string, nodeLabel: string) => void;
}

// Subcomponent: Individual Node Sphere
function NodeItem({ node, position, onClick }: { node: GraphNode; position: [number, number, number]; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const size = (node.val || 1) * 0.25;

  return (
    <mesh
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick();
      }}
    >
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial
        color={node.color || '#cbd5e1'}
        emissive={node.color || '#cbd5e1'}
        emissiveIntensity={hovered ? 0.4 : 0.05}
        roughness={0.2}
      />
      {hovered && (
        <Html distanceFactor={8}>
          <div className="px-2.5 py-1.5 rounded-lg bg-zinc-950/90 border border-zinc-800 text-[10px] text-zinc-100 whitespace-nowrap shadow-xl">
            <p className="font-bold">{node.label}</p>
            <p className="text-zinc-500 capitalize text-[9px] mt-0.5">{node.type}</p>
          </div>
        </Html>
      )}
    </mesh>
  );
}

// Subcomponent: Connecting Lines
function EdgeItem({ start, end }: { start: [number, number, number]; end: [number, number, number] }) {
  const points = useMemo(() => [start, end], [start, end]);
  
  return (
    <line>
      <bufferGeometry>
        <float32BufferAttribute
          attach="attributes-position"
          args={[new Float32Array(points.flat()), 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#3f3f46" linewidth={1} opacity={0.4} transparent />
    </line>
  );
}

export default function KnowledgeGraph3D({ nodes, links, onNodeClick }: KnowledgeGraph3DProps) {
  // 1. Calculate 3D positions for nodes using a simple sphere/fibonacci spiral projection
  const nodePositions = useMemo(() => {
    const positions: Record<string, [number, number, number]> = {};
    const count = nodes.length;
    
    nodes.forEach((node, i) => {
      // Fibonacci spiral coordinate layout in 3D
      const k = i + 0.5;
      const phi = Math.acos(1 - (2 * k) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * k;
      
      const radius = Math.min(8, 3 + Math.sqrt(count) * 0.8);
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      positions[node.id] = [x, y, z];
    });
    
    return positions;
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="h-[400px] border border-zinc-800 rounded-xl bg-zinc-950/40 flex items-center justify-center text-zinc-500">
        No papers in workspace. Upload articles to construct a 3D research knowledge map.
      </div>
    );
  }

  return (
    <div className="relative border border-zinc-800 rounded-xl bg-zinc-950 overflow-hidden h-[450px]">
      {/* 3D Canvas scene */}
      <Canvas camera={{ position: [0, 0, 12], fov: 60 }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1.2} />
        
        {/* Render edges */}
        {links.map((link, idx) => {
          const start = nodePositions[link.source];
          const end = nodePositions[link.target];
          if (!start || !end) return null;
          return <EdgeItem key={idx} start={start} end={end} />;
        })}

        {/* Render node items */}
        {nodes.map((node) => {
          const pos = nodePositions[node.id];
          if (!pos) return null;
          return <NodeItem key={node.id} node={node} position={pos} onClick={() => onNodeClick?.(node.id, node.type, node.label)} />;
        })}

        <OrbitControls enableDamping dampingFactor={0.05} maxDistance={20} minDistance={4} />
      </Canvas>

      {/* Map Legend Display Overlay */}
      <div className="absolute bottom-4 left-4 p-3 rounded-lg bg-zinc-950/80 border border-zinc-850 backdrop-blur-sm space-y-1.5 pointer-events-none">
        <p className="text-[10px] font-semibold text-zinc-400 tracking-wider uppercase">Graph Key</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6366f1]" /> Paper
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" /> Author
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /> Method
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ec4899]" /> Dataset
          </div>
        </div>
      </div>
    </div>
  );
}
