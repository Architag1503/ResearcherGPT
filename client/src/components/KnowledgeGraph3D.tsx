'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { useState, useMemo, useRef } from 'react';
import {
  Search,
  RotateCw,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  ZoomIn,
  Sparkles,
  Layers,
  Info
} from 'lucide-react';

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  val?: number;
  color?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  label: string;
}

interface KnowledgeGraph3DProps {
  nodes: GraphNode[];
  links: GraphLink[];
  onNodeClick?: (nodeId: string, nodeType: string, nodeLabel: string, nodeColor?: string) => void;
}

// Subcomponent: Individual Luminous Node Sphere
function NodeItem({
  node,
  position,
  isHovered,
  isSelected,
  isConnected,
  isDimmed,
  showLabel,
  onPointerOver,
  onPointerOut,
  onClick
}: {
  node: GraphNode;
  position: [number, number, number];
  isHovered: boolean;
  isSelected: boolean;
  isConnected: boolean;
  isDimmed: boolean;
  showLabel: boolean;
  onPointerOver: () => void;
  onPointerOut: () => void;
  onClick?: () => void;
}) {
  const baseSize = Math.max(0.4, (node.val || 2) * 0.18);
  const size = (isHovered || isSelected) ? baseSize * 1.35 : isConnected ? baseSize * 1.15 : baseSize;
  const nodeColor = node.color || '#6366f1';

  return (
    <group position={position}>
      {/* Outer Luminous Halo for Hover / Selection */}
      {(isHovered || isSelected || isConnected) && (
        <mesh>
          <sphereGeometry args={[size * 1.5, 16, 16]} />
          <meshBasicMaterial
            color={nodeColor}
            transparent
            opacity={isHovered || isSelected ? 0.35 : 0.18}
          />
        </mesh>
      )}

      {/* Core Node Sphere */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          onPointerOver();
        }}
        onPointerOut={() => onPointerOut()}
        onClick={(e) => {
          e.stopPropagation();
          if (onClick) onClick();
        }}
      >
        <sphereGeometry args={[size, 24, 24]} />
        <meshStandardMaterial
          color={nodeColor}
          emissive={nodeColor}
          emissiveIntensity={isHovered || isSelected ? 0.95 : isConnected ? 0.7 : isDimmed ? 0.08 : 0.5}
          roughness={0.15}
          metalness={0.2}
          transparent
          opacity={isDimmed ? 0.2 : 1.0}
        />
      </mesh>

      {/* Node Label Pill (visible on hover, selection, or when global showLabel is on) */}
      {(showLabel || isHovered || isSelected) && !isDimmed && (
        <Html distanceFactor={14} position={[0, size + 0.35, 0]} center>
          <div
            className={`px-2 py-0.5 rounded-md text-[10px] whitespace-nowrap transition-all duration-200 pointer-events-none select-none flex items-center gap-1.5 shadow-xl backdrop-blur-md ${
              isHovered || isSelected
                ? 'bg-zinc-900/95 border border-zinc-600 text-zinc-100 font-semibold scale-110 z-50'
                : 'bg-zinc-950/85 border border-zinc-800/90 text-zinc-300 opacity-90'
            }`}
            style={{
              borderLeftColor: nodeColor,
              borderLeftWidth: 3,
              boxShadow: isHovered ? `0 0 12px ${nodeColor}60` : undefined
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: nodeColor }}
            />
            <span className="truncate max-w-[150px]">{node.label}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

// Subcomponent: Connecting Luminous Edges
function EdgeItem({
  start,
  end,
  label,
  isHighlighted,
  isDimmed
}: {
  start: [number, number, number];
  end: [number, number, number];
  label?: string;
  isHighlighted: boolean;
  isDimmed: boolean;
}) {
  const points = useMemo(() => [start, end], [start, end]);
  const midPoint = useMemo(
    () => [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2,
      (start[2] + end[2]) / 2
    ] as [number, number, number],
    [start, end]
  );

  const edgeColor = isHighlighted ? '#38bdf8' : '#94a3b8';
  const edgeOpacity = isHighlighted ? 0.95 : isDimmed ? 0.12 : 0.55;

  return (
    <group>
      <line>
        <bufferGeometry>
          <float32BufferAttribute
            attach="attributes-position"
            args={[new Float32Array(points.flat()), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={edgeColor}
          linewidth={isHighlighted ? 2 : 1}
          opacity={edgeOpacity}
          transparent
        />
      </line>

      {/* Relationship label on highlighted edge */}
      {isHighlighted && label && (
        <Html position={midPoint} distanceFactor={14} center>
          <div className="px-1.5 py-0.5 rounded bg-zinc-900/95 border border-sky-500/50 text-[9px] font-mono text-sky-300 whitespace-nowrap shadow-md pointer-events-none">
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

export default function KnowledgeGraph3D({ nodes, links, onNodeClick }: KnowledgeGraph3DProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLabels, setShowLabels] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const orbitRef = useRef<any>(null);

  // 1. Calculate 3D positions for nodes using a 3D spherical Fibonacci projection
  const nodePositions = useMemo(() => {
    const positions: Record<string, [number, number, number]> = {};
    const count = nodes.length;

    nodes.forEach((node, i) => {
      const k = i + 0.5;
      const phi = Math.acos(1 - (2 * k) / Math.max(1, count));
      const theta = Math.PI * (1 + Math.sqrt(5)) * k;
      const radius = Math.min(9, 3.2 + Math.sqrt(count) * 0.9);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      positions[node.id] = [x, y, z];
    });

    return positions;
  }, [nodes]);

  // 2. Compute connected nodes and links for the active (hovered/selected) node
  const activeNodeId = hoveredNodeId || selectedNodeId;

  const { connectedNodeIds, connectedLinkIndices } = useMemo(() => {
    const nodeIds = new Set<string>();
    const linkIndices = new Set<number>();

    if (!activeNodeId) {
      return { connectedNodeIds: nodeIds, connectedLinkIndices: linkIndices };
    }

    nodeIds.add(activeNodeId);
    links.forEach((link, idx) => {
      if (link.source === activeNodeId) {
        nodeIds.add(link.target);
        linkIndices.add(idx);
      } else if (link.target === activeNodeId) {
        nodeIds.add(link.source);
        linkIndices.add(idx);
      }
    });

    return { connectedNodeIds: nodeIds, connectedLinkIndices: linkIndices };
  }, [activeNodeId, links]);

  // 3. Dynamic Categories present in the current graph
  // ONLY extracts node types that ACTUALLY exist in the graph, with their ACTUAL colors!
  const presentCategories = useMemo(() => {
    const map = new Map<string, { count: number; color: string }>();

    nodes.forEach((n) => {
      const t = (n.type || 'concept').toLowerCase();
      const c = n.color || '#6366f1';

      if (!map.has(t)) {
        map.set(t, { count: 0, color: c });
      }
      const entry = map.get(t)!;
      entry.count++;
      if (n.color) {
        entry.color = n.color;
      }
    });

    return Array.from(map.entries())
      .map(([type, data]) => ({
        type,
        count: data.count,
        color: data.color
      }))
      .sort((a, b) => b.count - a.count);
  }, [nodes]);

  // 4. Filter nodes by search query & category filter
  const isNodeDimmed = (node: GraphNode) => {
    // Category filter active
    if (filterCategory && node.type.toLowerCase() !== filterCategory.toLowerCase()) {
      return true;
    }
    // Search active
    if (searchQuery.trim()) {
      const matches = node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      node.type.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matches) return true;
    }
    // Node hover/select focus active
    if (activeNodeId) {
      return !connectedNodeIds.has(node.id);
    }
    return false;
  };

  const handleResetCamera = () => {
    if (orbitRef.current) {
      orbitRef.current.reset();
    }
  };

  if (nodes.length === 0) {
    return (
      <div className="h-[450px] border border-zinc-800 rounded-2xl bg-zinc-950/60 flex flex-col items-center justify-center gap-3 text-zinc-500">
        <Sparkles className="w-8 h-8 text-indigo-500/50" />
        <p className="text-sm text-zinc-400 font-medium">No knowledge graph nodes available</p>
        <p className="text-xs text-zinc-600">Run an Agent Run or upload papers to synthesize a 3D research concept graph.</p>
      </div>
    );
  }

  const activeNodeObj = activeNodeId ? nodes.find((n) => n.id === activeNodeId) : null;

  return (
    <div
      className={`relative border border-zinc-800/90 rounded-2xl bg-[#09090d] overflow-hidden transition-all duration-300 select-none ${
        isFullscreen ? 'fixed inset-4 z-50 h-[calc(100vh-2rem)]' : 'h-[500px]'
      }`}
    >
      {/* Background Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-950/20 via-[#09090d]/60 to-[#09090d] pointer-events-none" />

      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 z-10 pointer-events-none">
        {/* Left: Search Input */}
        <div className="pointer-events-auto flex items-center gap-2 bg-zinc-950/85 border border-zinc-800/80 rounded-xl px-3 py-1.5 shadow-lg backdrop-blur-md">
          <Search className="w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search nodes in 3D space..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 outline-none w-44 md:w-56"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-zinc-500 hover:text-zinc-300 text-[10px]"
            >
              ✕
            </button>
          )}
        </div>

        {/* Right: Controls Toolbar */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-zinc-950/85 border border-zinc-800/80 rounded-xl p-1 shadow-lg backdrop-blur-md">
          {/* Label Toggle */}
          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              showLabels
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
            title={showLabels ? 'Hide Labels' : 'Show Labels'}
          >
            {showLabels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          {/* Auto Rotate Toggle */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              autoRotate
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
            title={autoRotate ? 'Stop Rotation' : 'Auto Rotate'}
          >
            <RotateCw className={`w-4 h-4 ${autoRotate ? 'animate-spin' : ''}`} />
          </button>

          {/* Reset Camera */}
          <button
            onClick={handleResetCamera}
            className="p-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
            title="Reset View"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 3D Canvas Scene */}
      <Canvas camera={{ position: [0, 0, 13], fov: 60 }}>
        <ambientLight intensity={0.8} />
        <pointLight position={[12, 12, 12]} intensity={1.5} />
        <pointLight position={[-12, -12, -12]} intensity={0.6} color="#818cf8" />

        {/* Render Connecting Links */}
        {links.map((link, idx) => {
          const start = nodePositions[link.source];
          const end = nodePositions[link.target];
          if (!start || !end) return null;

          const isHighlighted = connectedLinkIndices.has(idx);
          const isDimmed = activeNodeId ? !isHighlighted : false;

          return (
            <EdgeItem
              key={idx}
              start={start}
              end={end}
              label={link.label}
              isHighlighted={isHighlighted}
              isDimmed={isDimmed}
            />
          );
        })}

        {/* Render Luminous Nodes */}
        {nodes.map((node) => {
          const pos = nodePositions[node.id];
          if (!pos) return null;

          const isHovered = hoveredNodeId === node.id;
          const isSelected = selectedNodeId === node.id;
          const isConnected = connectedNodeIds.has(node.id);
          const dimmed = isNodeDimmed(node);

          return (
            <NodeItem
              key={node.id}
              node={node}
              position={pos}
              isHovered={isHovered}
              isSelected={isSelected}
              isConnected={isConnected}
              isDimmed={dimmed}
              showLabel={showLabels}
              onPointerOver={() => setHoveredNodeId(node.id)}
              onPointerOut={() => setHoveredNodeId(null)}
              onClick={() => {
                setSelectedNodeId(node.id);
                onNodeClick?.(node.id, node.type, node.label, node.color);
              }}
            />
          );
        })}

        <OrbitControls
          ref={orbitRef}
          enableDamping
          dampingFactor={0.05}
          autoRotate={autoRotate}
          autoRotateSpeed={0.8}
          maxDistance={25}
          minDistance={3.5}
        />
      </Canvas>

      {/* Top Right: Node Inspector HUD (Active on hover / select) */}
      {activeNodeObj && (
        <div className="absolute top-16 right-4 p-3.5 rounded-xl bg-zinc-950/90 border border-zinc-700/80 backdrop-blur-md shadow-2xl max-w-xs space-y-2 pointer-events-none animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between gap-2">
            <span
              className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border"
              style={{
                backgroundColor: `${activeNodeObj.color || '#6366f1'}20`,
                color: activeNodeObj.color || '#6366f1',
                borderColor: `${activeNodeObj.color || '#6366f1'}50`
              }}
            >
              {activeNodeObj.type}
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              {connectedNodeIds.size - 1} Link{connectedNodeIds.size - 1 === 1 ? '' : 's'}
            </span>
          </div>
          <p className="text-xs font-bold text-zinc-100 leading-snug line-clamp-2">
            {activeNodeObj.label}
          </p>
          <div className="flex items-center gap-1 text-[9px] text-zinc-500 pt-1 border-t border-zinc-900">
            <Info className="w-3 h-3 text-zinc-500" />
            <span>Click sphere to load full research matrix & AI insights</span>
          </div>
        </div>
      )}

      {/* Bottom Left: DYNAMIC "Graph Key" / Legend Box */}
      {/* MENTIONS ONLY NODES PRESENT IN GRAPH WITH THEIR EXACT COLORS & COUNTS */}
      <div className="absolute bottom-4 left-4 p-3.5 rounded-xl bg-zinc-950/90 border border-zinc-800/90 backdrop-blur-md space-y-2.5 shadow-2xl max-w-[340px]">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-850 pb-2">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-indigo-400" />
            <p className="text-[10px] font-bold text-zinc-300 tracking-wider uppercase">
              Present Entities ({nodes.length})
            </p>
          </div>
          {filterCategory && (
            <button
              onClick={() => setFilterCategory(null)}
              className="text-[9px] text-indigo-400 hover:text-indigo-300 underline font-medium"
            >
              Reset Filter
            </button>
          )}
        </div>

        {/* Dynamic Category Chips */}
        <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
          {presentCategories.map((cat) => {
            const isActive = filterCategory?.toLowerCase() === cat.type.toLowerCase();
            return (
              <button
                key={cat.type}
                onClick={() => setFilterCategory(isActive ? null : cat.type)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border ${
                  isActive
                    ? 'bg-zinc-800 text-white border-zinc-600 shadow-md scale-105'
                    : 'bg-zinc-900/70 text-zinc-400 border-zinc-800/80 hover:text-zinc-200 hover:bg-zinc-850'
                }`}
                title={`Filter by ${cat.type}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: cat.color,
                    boxShadow: `0 0 6px ${cat.color}90`
                  }}
                />
                <span className="capitalize">{cat.type}</span>
                <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 text-[9px] font-mono">
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Right: Graph Stats Pill */}
      <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-xl bg-zinc-950/80 border border-zinc-850 backdrop-blur-sm text-[10px] text-zinc-400 flex items-center gap-2 pointer-events-none">
        <span>Nodes: <strong className="text-zinc-200 font-mono">{nodes.length}</strong></span>
        <span>•</span>
        <span>Edges: <strong className="text-zinc-200 font-mono">{links.length}</strong></span>
      </div>
    </div>
  );
}
