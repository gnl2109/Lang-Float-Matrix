
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { HERO_DATABASE, PUZZLE_DEFINITIONS } from './constants';
import { Hero, PuzzleType, Faction, HeroClass } from './types';
import HeroCard from './components/HeroCard';
import PuzzleBoard from './components/PuzzleBoard';
import { calculateTotalScore } from './utils/scoring';
import { optimizeAllPlacements } from './utils/solver';

const App: React.FC = () => {
  const [ownedHeroIds, setOwnedHeroIds] = useState<Set<number>>(new Set());
  const [allPlacements, setAllPlacements] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<'single' | 'batch' | 'database'>('batch');
  const [activePuzzle, setActivePuzzle] = useState<PuzzleType>(PuzzleType.CITY_HALL);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFaction, setSelectedFaction] = useState<Faction | 'ALL'>('ALL');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);
  
  const getInitialHeroClasses = useCallback(() => {
    const initial: Record<number, HeroClass[]> = {};
    HERO_DATABASE.forEach(h => {
      initial[h.id] = [...h.classes];
    });
    return initial;
  }, []);

  const [heroActiveClasses, setHeroActiveClasses] = useState<Record<number, HeroClass[]>>(getInitialHeroClasses);

  const triggerToast = useCallback((msg: string) => {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 3000);
  }, []);

  const toggleHero = useCallback((id: number) => {
    setOwnedHeroIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        setAllPlacements(prevPlacements => {
          const nextPlacements = { ...prevPlacements };
          Object.keys(nextPlacements).forEach(key => {
            if (nextPlacements[key] === id) delete nextPlacements[key];
          });
          return nextPlacements;
        });
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleHeroClass = useCallback((heroId: number, hc: HeroClass) => {
    setHeroActiveClasses(prev => {
      const current = prev[heroId] || [];
      const next = current.includes(hc) ? current.filter(c => c !== hc) : [...current, hc];
      
      const nextPlacements = { ...allPlacements };
      let changed = false;
      Object.entries(nextPlacements).forEach(([key, placedId]) => {
        if (placedId === heroId) {
          const [pType, nodeId] = key.split('_');
          const puzzle = PUZZLE_DEFINITIONS.find(p => p.type === pType);
          const node = puzzle?.nodes.find(n => n.id === nodeId);
          if (node && !next.includes(node.requiredClass)) {
            delete nextPlacements[key];
            changed = true;
          }
        }
      });
      if (changed) setAllPlacements(nextPlacements);
      return { ...prev, [heroId]: next };
    });
  }, [allPlacements]);

  const getPlacementsForPuzzle = useCallback((type: PuzzleType) => {
    const puzzlePlacements: Record<string, Hero | undefined> = {};
    const prefix = `${type}_`;
    Object.entries(allPlacements).forEach(([key, heroId]) => {
      if (key.startsWith(prefix)) {
        const nodeId = key.replace(prefix, '');
        puzzlePlacements[nodeId] = HERO_DATABASE.find(h => h.id === heroId);
      }
    });
    return puzzlePlacements;
  }, [allPlacements]);

  const currentPuzzlePlacements = useMemo(() => {
    return getPlacementsForPuzzle(activePuzzle);
  }, [getPlacementsForPuzzle, activePuzzle]);

  const handleSocketClick = useCallback((nodeId: string) => {
    setAllPlacements(prev => {
      const key = `${activePuzzle}_${nodeId}`;
      const next = { ...prev };
      if (next[key]) delete next[key];
      return next;
    });
  }, [activePuzzle]);

  const handleDrop = useCallback((nodeId: string, heroId: number) => {
    const hero = HERO_DATABASE.find(h => h.id === heroId);
    if (!hero) return;
    const puzzle = PUZZLE_DEFINITIONS.find(p => p.type === activePuzzle);
    const node = puzzle?.nodes.find(n => n.id === nodeId);
    const activeClasses = heroActiveClasses[heroId] || [];

    if (node && !activeClasses.includes(node.requiredClass)) {
      alert(`[${node.requiredClass}] 클래스 활성화가 필요합니다.`);
      return;
    }

    setAllPlacements(prev => {
      const key = `${activePuzzle}_${nodeId}`;
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (next[k] === heroId) delete next[k]; });
      next[key] = heroId;
      return next;
    });
  }, [activePuzzle, heroActiveClasses]);

  const handleAutoOptimize = useCallback(() => {
    if (ownedHeroIds.size === 0) {
      triggerToast('영웅을 먼저 선택해주세요.');
      return;
    }
    setIsOptimizing(true);
    setTimeout(() => {
      try {
        const ownedHeroes = HERO_DATABASE.filter(h => ownedHeroIds.has(h.id));
        const optimized = optimizeAllPlacements(ownedHeroes, PUZZLE_DEFINITIONS, heroActiveClasses);
        setAllPlacements(optimized);
        triggerToast('최적 배치가 완료되었습니다.');
      } catch (err) {
        triggerToast('최적화 중 오류가 발생했습니다.');
      } finally {
        setIsOptimizing(false);
      }
    }, 50);
  }, [ownedHeroIds, heroActiveClasses, triggerToast]);

  const sidebarFilteredHeroes = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return HERO_DATABASE.filter(h => {
      const matchesSearch = h.name.toLowerCase().includes(term) || h.factions.some(f => f.toLowerCase().includes(term));
      const matchesFaction = selectedFaction === 'ALL' || h.factions.includes(selectedFaction as Faction);
      return matchesSearch && matchesFaction;
    });
  }, [searchTerm, selectedFaction]);

  const managedHeroes = useMemo(() => {
    return HERO_DATABASE.filter(h => ownedHeroIds.has(h.id));
  }, [ownedHeroIds]);

  const activePuzzleDef = useMemo(() => PUZZLE_DEFINITIONS.find(p => p.type === activePuzzle)!, [activePuzzle]);
  const totalRequiredSlots = useMemo(() => PUZZLE_DEFINITIONS.reduce((acc, p) => acc + p.totalSlots, 0), []);
  const totalBatchScore = useMemo(() => PUZZLE_DEFINITIONS.reduce((acc, p) => acc + calculateTotalScore(p, getPlacementsForPuzzle(p.type)), 0), [getPlacementsForPuzzle]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col md:flex-row h-screen overflow-hidden">
      {showToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-amber-500 text-slate-950 px-6 py-3 rounded-2xl font-black text-sm shadow-2xl animate-bounce shadow-amber-500/40">
          {showToast}
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-full md:w-80 bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl z-40 h-[45vh] md:h-full flex-shrink-0">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex-shrink-0">
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span className="w-2 h-6 bg-amber-500 rounded-full" />
              보유 영웅 Pool
            </h2>
          </div>
          <p className="text-slate-500 text-[10px] mt-1 font-bold uppercase tracking-wider">
            {ownedHeroIds.size} / {totalRequiredSlots} 영웅 선택됨
          </p>
          <div className="mt-4 relative group">
            <input 
              type="text"
              placeholder="영웅 또는 진영 검색..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:ring-2 ring-amber-500/40 outline-none text-slate-200 transition-all placeholder-slate-600"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 p-1"
                title="검색어 초기화"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-700 bg-slate-900/20">
          <div className="grid grid-cols-3 gap-1.5 pb-4">
            {sidebarFilteredHeroes.map(hero => (
              <HeroCard 
                key={hero.id}
                hero={hero} 
                isSelected={ownedHeroIds.has(hero.id)}
                isPlaced={Object.values(allPlacements).includes(hero.id)}
                onClick={() => toggleHero(hero.id)}
                compact
              />
            ))}
            {sidebarFilteredHeroes.length === 0 && (
              <div className="col-span-3 py-10 text-center text-[10px] font-black text-slate-700 uppercase">
                검색 결과가 없습니다.
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-[#020617] relative overflow-hidden z-10">
        <header className="px-8 py-6 flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900/50 bg-slate-950/30 backdrop-blur-sm z-20">
          <div>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 leading-none">
              CONTRACT STRATEGY
            </h1>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">부유도시 통합 최적화 시스템</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
              <button onClick={() => setViewMode('batch')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${viewMode === 'batch' ? 'bg-amber-500 text-slate-950' : 'text-slate-500 hover:text-slate-300'}`}>일괄 보기</button>
              <button onClick={() => setViewMode('single')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${viewMode === 'single' ? 'bg-amber-500 text-slate-950' : 'text-slate-500 hover:text-slate-300'}`}>상세 배치</button>
              <button onClick={() => setViewMode('database')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${viewMode === 'database' ? 'bg-amber-500 text-slate-950' : 'text-slate-500 hover:text-slate-300'}`}>내 영웅 관리</button>
            </div>

            {viewMode !== 'database' && (
              <button
                onClick={handleAutoOptimize}
                disabled={isOptimizing || ownedHeroIds.size === 0}
                className={`flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 px-6 py-2.5 rounded-xl text-xs font-black shadow-lg hover:scale-105 transition-all ${isOptimizing || ownedHeroIds.size === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isOptimizing ? <><div className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" /> 연산 중</> : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> 고정밀 자동 최적화</>}
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-950/20">
          {viewMode === 'database' ? (
            <div className="max-w-7xl mx-auto">
              <div className="mb-10">
                <h2 className="text-3xl font-black text-white">내 영웅 관리</h2>
                <p className="text-slate-500 text-sm mt-1">실제로 개방한 클래스를 활성화하세요. (비활성 시 배치 제외)</p>
              </div>

              {ownedHeroIds.size === 0 ? (
                <div className="py-24 text-center border-2 border-dashed border-slate-800 rounded-[40px] text-slate-600">
                  왼쪽 사이드바에서 보유 영웅을 먼저 선택하세요.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {managedHeroes.map(hero => (
                    <HeroCard 
                      key={hero.id}
                      hero={hero} 
                      isSelected={ownedHeroIds.has(hero.id)}
                      isPlaced={Object.values(allPlacements).includes(hero.id)}
                      onClick={() => toggleHero(hero.id)}
                      onToggleClass={(hc) => toggleHeroClass(hero.id, hc)}
                      activeClasses={heroActiveClasses[hero.id] || []}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : viewMode === 'batch' ? (
            <div className="max-w-7xl mx-auto">
              <div className="mb-8 flex justify-between items-end">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-white">배치 대시보드</h2>
                  <p className="text-slate-500 text-sm mt-1">전체 구역의 시너지 상태를 한눈에 파악합니다.</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">통합 최적화 점수</span>
                  <span className="text-4xl font-black text-amber-500 tabular-nums">{totalBatchScore}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {PUZZLE_DEFINITIONS.map(p => (
                  <div key={p.type} onClick={() => { setActivePuzzle(p.type); setViewMode('single'); }} className="bg-slate-900/40 border border-slate-800/60 rounded-[32px] p-8 hover:bg-slate-900/60 transition-all cursor-pointer relative flex flex-col min-h-[400px]">
                    <h3 className="text-xl font-black text-white mb-6 flex items-center justify-between">
                      {p.type}
                      <span className="text-[10px] text-amber-500/60 font-black">{calculateTotalScore(p, getPlacementsForPuzzle(p.type))} pts</span>
                    </h3>
                    <div className="flex-1 relative">
                      <PuzzleBoard definition={p} placements={getPlacementsForPuzzle(p.type)} onSocketClick={() => {}} onDrop={() => {}} selectedHeroId={null} mini />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto flex flex-col items-center">
               <div className="flex gap-2 mb-8 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800/50 overflow-x-auto max-w-full no-scrollbar">
                {PUZZLE_DEFINITIONS.map(p => (
                  <button key={p.type} onClick={() => setActivePuzzle(p.type)} className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black transition-all ${activePuzzle === p.type ? 'bg-slate-800 text-amber-500 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                    {p.type.split('(')[0].replace('푸른숨결산림보호연맹', '산림연맹').replace('대지의아이연구원', '연구원').replace('철의의지형제회', '형제회')}
                  </button>
                ))}
              </div>
              <h2 className="text-3xl font-black text-white mb-2">{activePuzzle}</h2>
              <p className="text-amber-500 font-black text-xl mb-8">{calculateTotalScore(activePuzzleDef, currentPuzzlePlacements)} pts</p>
              <PuzzleBoard definition={activePuzzleDef} placements={currentPuzzlePlacements} onSocketClick={handleSocketClick} onDrop={handleDrop} selectedHeroId={null} />
            </div>
          )}
        </div>

        <footer className="px-8 py-3 bg-slate-950 border-t border-slate-900/80 flex-shrink-0 flex justify-between items-center text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 z-20">
           <div>© 2024 LANGRISSER FLOATING CITY TACTICS</div>
           <div>ITERATIVE LOCAL SEARCH OPTIMIZER ACTIVE</div>
        </footer>
      </main>
    </div>
  );
};

export default App;
