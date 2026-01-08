
import React, { useMemo, useRef, useState, useLayoutEffect, useEffect } from 'react';
import { PuzzleDefinition, Hero, PuzzleNode, PuzzleType, HeroClass } from '../types';
import { calculateEdgeScore } from '../utils/scoring';

interface PuzzleBoardProps {
  definition: PuzzleDefinition;
  placements: Record<string, Hero | undefined>;
  onSocketClick: (nodeId: string) => void;
  onDrop: (nodeId: string, heroId: number) => void;
  selectedHeroId: number | null;
  mini?: boolean;
}

const PuzzleBoard: React.FC<PuzzleBoardProps> = ({ 
  definition, 
  placements, 
  onSocketClick,
  onDrop,
  selectedHeroId,
  mini = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number, y: number }>>({});
  const [dragOverNode, setDragOverNode] = useState<string | null>(null);

  const safeType = useMemo(() => {
    const map: Record<string, string> = {
      [PuzzleType.CITY_HALL]: 'cityhall',
      [PuzzleType.FOREST_LEAGUE]: 'forest',
      [PuzzleType.EARTH_INSTITUTE]: 'earth',
      [PuzzleType.IRON_BROTHERHOOD]: 'iron'
    };
    return map[definition.type] || 'puzzle';
  }, [definition.type]);

  const filterId = `glow-filter-${safeType}-${mini ? 'mini' : 'main'}`;

  const updatePositions = () => {
    if (!containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newPositions: Record<string, { x: number, y: number }> = {};
    let foundCount = 0;

    definition.nodes.forEach(node => {
      const socketId = `socket-${safeType}-${mini ? 'mini' : 'main'}-${node.id}`;
      const el = document.getElementById(socketId);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0) {
          newPositions[node.id] = {
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top + rect.height / 2
          };
          foundCount++;
        }
      }
    });

    if (foundCount === definition.nodes.length) {
      setNodePositions(newPositions);
    } else {
      requestAnimationFrame(updatePositions);
    }
  };

  useLayoutEffect(() => {
    updatePositions();
    const observer = new ResizeObserver(updatePositions);
    if (containerRef.current) observer.observe(containerRef.current);

    const timers = [
      setTimeout(updatePositions, 100),
      setTimeout(updatePositions, 400)
    ];

    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [definition, mini]);

  useEffect(() => {
    updatePositions();
  }, [placements]);

  const rows = useMemo(() => {
    const r = { top: [] as PuzzleNode[], mid: [] as PuzzleNode[], bot: [] as PuzzleNode[] };
    definition.nodes.forEach(n => r[n.row].push(n));
    return r;
  }, [definition]);

  const getRowGap = (rowKey: string) => {
    if (definition.type === PuzzleType.EARTH_INSTITUTE) {
      if (rowKey === 'mid') return mini ? 'gap-4' : 'gap-12 md:gap-24';
      return mini ? 'gap-10' : 'gap-32 md:gap-64';
    }
    return mini ? 'gap-4' : 'gap-8 md:gap-16';
  };

  return (
    <div 
      className={`relative w-full overflow-hidden transition-all ${
        mini 
          ? 'h-full flex flex-col justify-around p-2 bg-transparent' 
          : 'max-w-3xl aspect-[4/3] bg-slate-900/40 rounded-[40px] border border-slate-800/50 p-8 flex flex-col justify-between shadow-inner'
      }`} 
      ref={containerRef}
    >
      {!mini && (
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      )}

      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
        <defs>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation={mini ? "1.2" : "3"} result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {definition.edges.map(([a, b], i) => {
          const posA = nodePositions[a];
          const posB = nodePositions[b];
          if (!posA || !posB) return null;
          
          const heroA = placements[a];
          const heroB = placements[b];
          const isConnected = !!(heroA && heroB);
          
          let strokeColor = '#1e293b'; 
          let strokeWidth = mini ? 0.8 : 1.5;
          let dashArray = '3 3';
          let filter = 'none';
          let opacity = 0.4;

          const y2Adjusted = posA.y === posB.y ? posB.y + 0.01 : posB.y;
          const x2Adjusted = posA.x === posB.x ? posB.x + 0.01 : posB.x;

          if (isConnected && heroA && heroB) {
            const score = calculateEdgeScore(heroA, heroB);
            dashArray = '0';
            opacity = 1;
            
            if (score === 0) {
              strokeColor = '#f1f5f9';
              strokeWidth = mini ? 1.2 : 2;
            } else if (score === 1) {
              strokeColor = '#0ea5e9';
              strokeWidth = mini ? 2 : 4;
            } else if (score === 2) {
              strokeColor = '#38bdf8';
              strokeWidth = mini ? 3.5 : 8;
              filter = `url(#${filterId})`;
            }
          }

          return (
            <line 
              key={`edge-${safeType}-${a}-${b}-${i}-${mini ? 'mini' : 'main'}`} 
              x1={posA.x} y1={posA.y} x2={x2Adjusted} y2={y2Adjusted} 
              stroke={strokeColor} 
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeLinecap="round"
              filter={filter}
              style={{ opacity, transition: 'all 0.4s ease-out' }}
            />
          );
        })}
      </svg>

      {(['top', 'mid', 'bot'] as const).map(rowKey => (
        <div key={rowKey} className={`flex justify-center z-10 transition-all ${getRowGap(rowKey)}`}>
          {rows[rowKey].map(node => {
            const placedHero = placements[node.id];
            const isTarget = dragOverNode === node.id;
            const socketId = `socket-${safeType}-${mini ? 'mini' : 'main'}-${node.id}`;
            
            return (
              <button
                key={node.id}
                id={socketId}
                onClick={mini ? undefined : () => onSocketClick(node.id)}
                onDragOver={mini ? undefined : (e) => { e.preventDefault(); setDragOverNode(node.id); }}
                onDragLeave={mini ? undefined : () => setDragOverNode(null)}
                onDrop={mini ? undefined : (e) => {
                  e.preventDefault();
                  setDragOverNode(null);
                  const hId = parseInt(e.dataTransfer.getData('heroId'));
                  if (!isNaN(hId)) onDrop(node.id, hId);
                }}
                className={`transition-all flex flex-col items-center justify-center relative group
                  ${mini ? 'w-6 h-6 rounded-lg border' : 'w-14 h-14 md:w-20 md:h-20 rounded-2xl md:rounded-3xl border-2'}
                  ${placedHero 
                    ? 'bg-slate-800 border-amber-500 shadow-lg shadow-amber-500/20' 
                    : 'bg-slate-950/80 border-slate-800 border-dashed'}
                  ${!mini && selectedHeroId && !placedHero ? 'ring-4 ring-amber-500/20 animate-pulse border-amber-500/50' : ''}
                  ${!mini && isTarget ? 'scale-110 border-amber-400 bg-amber-500/10 ring-4 ring-amber-500/20 z-20 shadow-2xl' : ''}
                `}
              >
                {!mini && placedHero && (
                  <div className="text-center scale-90 md:scale-100 pointer-events-none">
                    <div className="text-amber-500 font-black text-[10px] md:text-sm leading-tight truncate px-1">{placedHero.name}</div>
                    <div className="flex gap-0.5 mt-1 justify-center">
                      {placedHero.factions.map((_, i) => (
                        <div key={i} className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-slate-500/50" />
                      ))}
                    </div>
                  </div>
                )}
                {!mini && !placedHero && (
                  <>
                    <div className="text-[9px] md:text-[11px] font-black text-slate-700 pointer-events-none mb-1">
                      {node.requiredClass}
                    </div>
                    <span className="text-slate-800 group-hover:text-slate-600 transition-colors pointer-events-none">
                      <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </span>
                  </>
                )}
                {mini && placedHero && (
                  <div className="w-full h-full bg-amber-500 rounded-sm" />
                )}
                {mini && !placedHero && (
                  <div className="text-[6px] text-slate-700 font-bold">{node.requiredClass.charAt(0)}</div>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default PuzzleBoard;
