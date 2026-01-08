
import React, { useState, useMemo, useEffect } from 'react';
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
  const [selectedClassesFilter, setSelectedClassesFilter] = useState<Set<HeroClass>>(new Set());
  const [isOptimizing, setIsOptimizing] = useState(false);

  // 영웅별 활성화된 클래스 상태
  const [heroActiveClasses, setHeroActiveClasses] = useState<Record<number, HeroClass[]>>(() => {
    const initial: Record<number, HeroClass[]> = {};
    HERO_DATABASE.forEach(h => {
      initial[h.id] = [...h.classes];
    });
    return initial;
  });

  const toggleHero = (id: number) => {
    const next = new Set(ownedHeroIds);
    if (next.has(id)) {
      const nextPlacements = { ...allPlacements };
      Object.keys(nextPlacements).forEach(key => {
        if (nextPlacements[key] === id) delete nextPlacements[key];
      });
      setAllPlacements(nextPlacements);
      next.delete(id);
    } else {
      next.add(id);
    }
    setOwnedHeroIds(next);
  };

  const toggleHeroClass = (heroId: number, hc: HeroClass) => {
    setHeroActiveClasses(prev => {
      const current = prev[heroId] || [];
      const next = current.includes(hc) 
        ? current.filter(c => c !== hc) 
        : [...current, hc];
      
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
  };

  const toggleClassFilter = (hc: HeroClass) => {
    const next = new Set(selectedClassesFilter);
    if (next.has(hc)) next.delete(hc);
    else next.add(hc);
    setSelectedClassesFilter(next);
  };

  const getPlacementsForPuzzle = (type: PuzzleType) => {
    const puzzlePlacements: Record<string, Hero | undefined> = {};
    const prefix = `${type}_`;
    Object.entries(allPlacements).forEach(([key, heroId]) => {
      if (key.startsWith(prefix)) {
        const nodeId = key.replace(prefix, '');
        puzzlePlacements[nodeId] = HERO_DATABASE.find(h => h.id === heroId);
      }
    });
    return puzzlePlacements;
  };

  const currentPuzzlePlacements = useMemo(() => {
    return getPlacementsForPuzzle(activePuzzle);
  }, [allPlacements, activePuzzle]);

  const handleSocketClick = (nodeId: string) => {
    const key = `${activePuzzle}_${nodeId}`;
    const nextPlacements = { ...allPlacements };
    if (nextPlacements[key]) {
      delete nextPlacements[key];
      setAllPlacements(nextPlacements);
    }
  };

  const handleDrop = (nodeId: string, heroId: number) => {
    const hero = HERO_DATABASE.find(h => h.id === heroId);
    if (!hero) return;

    const puzzle = PUZZLE_DEFINITIONS.find(p => p.type === activePuzzle);
    const node = puzzle?.nodes.find(n => n.id === nodeId);
    const activeClasses = heroActiveClasses[heroId] || [];

    if (node && !activeClasses.includes(node.requiredClass)) {
      alert(`이 슬롯은 [${node.requiredClass}] 클래스가 활성화된 영웅만 배치 가능합니다.\n[${hero.name}]은(는) 현재 해당 클래스가 비활성 상태입니다.`);
      return;
    }

    const key = `${activePuzzle}_${nodeId}`;
    const nextPlacements = { ...allPlacements };
    Object.keys(nextPlacements).forEach(k => {
      if (nextPlacements[k] === heroId) delete nextPlacements[k];
    });
    nextPlacements[key] = heroId;
    setAllPlacements(nextPlacements);
  };

  const handleAutoOptimize = () => {
    if (ownedHeroIds.size === 0) return;
    setIsOptimizing(true);
    // 복잡한 연산을 위해 setTimeout으로 UI 스레드 분리
    setTimeout(() => {
      const ownedHeroes = HERO_DATABASE.filter(h => ownedHeroIds.has(h.id));
      const optimized = optimizeAllPlacements(ownedHeroes, PUZZLE_DEFINITIONS, heroActiveClasses);
      setAllPlacements(optimized);
      setIsOptimizing(false);
    }, 100);
  };

  // 사이드바용 필터링 (전체 영웅 대상)
  const sidebarFilteredHeroes = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return HERO_DATABASE.filter(h => {
      const matchesSearch = h.name.toLowerCase().includes(term) || h.factions.some(f => f.toLowerCase().includes(term));
      const matchesFaction = selectedFaction === 'ALL' || h.factions.includes(selectedFaction as Faction);
      return matchesSearch && matchesFaction;
    });
  }, [searchTerm, selectedFaction]);

  // 도감(관리) 뷰용 필터링 (선택된 영웅들 중에서만)
  const managedHeroes = useMemo(() => {
    return HERO_DATABASE.filter(h => {
      if (!ownedHeroIds.has(h.id)) return false;
      const matchesClassFilter = selectedClassesFilter.size === 0 || h.classes.some(c => selectedClassesFilter.has(c));
      return matchesClassFilter;
    });
  }, [ownedHeroIds, selectedClassesFilter]);

  const activePuzzleDef = useMemo(() => {
    return PUZZLE_DEFINITIONS.find(p => p.type === activePuzzle)!;
  }, [activePuzzle]);

  const totalRequiredSlots = useMemo(() => {
    return PUZZLE_DEFINITIONS.reduce((acc, p) => acc + p.totalSlots, 0);
  }, []);

  const totalBatchScore = useMemo(() => {
    return PUZZLE_DEFINITIONS.reduce((acc, p) => {
      return acc + calculateTotalScore(p, getPlacementsForPuzzle(p.type));
    }, 0);
  }, [allPlacements]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col md:flex-row h-screen overflow-hidden">
      <aside className="w-full md:w-80 bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl z-20">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <span className="w-2 h-6 bg-amber-500 rounded-full" />
            보유 영웅 Pool
          </h2>
          <p className="text-slate-500 text-[10px] mt-1 font-bold uppercase tracking-wider">
            {ownedHeroIds.size} / {totalRequiredSlots} 영웅 선택됨
          </p>
          <div className="mt-4 relative">
            <input 
              type="text"
              placeholder="영웅 이름 검색..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:ring-2 ring-amber-500/40 outline-none placeholder-slate-600 text-slate-200 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-700">
          <div className="grid grid-cols-3 gap-1.5">
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
          </div>
        </div>
        
        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <button 
            onClick={() => { setOwnedHeroIds(new Set()); setAllPlacements({}); }}
            className="w-full py-2.5 text-[10px] font-black text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-[0.2em]"
          >
            전체 초기화
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-[#020617] relative overflow-hidden">
        <header className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900/50 bg-slate-950/30 backdrop-blur-sm z-10">
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

            {viewMode !== 'database' && ownedHeroIds.size > 0 && (
              <button
                onClick={handleAutoOptimize}
                disabled={isOptimizing}
                className={`flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 px-6 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 hover:scale-105 transition-all ${isOptimizing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isOptimizing ? <><div className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" /> 연산 중</> : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> 고정밀 자동 최적화</>}
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-950/20">
          {viewMode === 'database' ? (
            <div className="max-w-7xl mx-auto">
              <div className="mb-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                  <div>
                    <h2 className="text-3xl font-black text-white">내 영웅 관리</h2>
                    <p className="text-slate-500 text-sm mt-1">보유한 영웅 중 실제로 개방한 클래스만 활성화하세요.</p>
                  </div>
                  {ownedHeroIds.size > 0 && (
                    <div className="bg-slate-900/30 border border-slate-800/50 rounded-2xl p-4 flex flex-wrap gap-2 max-w-xl">
                      {Object.values(HeroClass).map(hc => (
                        <button
                          key={hc}
                          onClick={() => toggleClassFilter(hc)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border ${selectedClassesFilter.has(hc) ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                        >
                          {hc}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {ownedHeroIds.size === 0 ? (
                <div className="py-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-[40px] bg-slate-900/20">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-6 text-slate-600">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                  </div>
                  <h3 className="text-xl font-black text-slate-400">Pool이 비어있습니다.</h3>
                  <p className="text-slate-600 text-sm mt-2">왼쪽 사이드바에서 보유한 영웅을 클릭하여 추가해 주세요.</p>
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>
          ) : viewMode === 'batch' ? (
            <div className="max-w-7xl mx-auto">
              <div className="mb-8 flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-black text-white">배치 대시보드</h2>
                  <p className="text-slate-500 text-sm mt-1">통합 최적화 알고리즘이 적용된 전체 배치도입니다.</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">총 합계 점수</span>
                  <span className="text-4xl font-black text-amber-500 tracking-tighter tabular-nums">{totalBatchScore}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full content-start">
                {PUZZLE_DEFINITIONS.map(p => {
                  const placements = getPlacementsForPuzzle(p.type);
                  const count = Object.keys(placements).length;
                  const score = calculateTotalScore(p, placements);
                  return (
                    <div key={p.type} onClick={() => { setActivePuzzle(p.type); setViewMode('single'); }} className="bg-slate-900/40 border border-slate-800/60 rounded-[32px] p-8 hover:bg-slate-900/60 transition-all group cursor-pointer relative overflow-hidden flex flex-col min-h-[400px]">
                      <div className="flex justify-between items-start mb-6 z-10">
                        <div>
                          <h3 className="text-xl font-black text-white group-hover:text-amber-500 transition-colors">{p.type}</h3>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex flex-col"><span className="text-[9px] font-black text-slate-600 uppercase">진척도</span><span className="text-xs font-black text-slate-300">{count} / {p.totalSlots}</span></div>
                            <div className="w-px h-6 bg-slate-800" /><div className="flex flex-col"><span className="text-[9px] font-black text-slate-600 uppercase">구역 점수</span><span className="text-xs font-black text-amber-500">{score} pts</span></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 relative">
                        <PuzzleBoard definition={p} placements={placements} onSocketClick={() => {}} onDrop={() => {}} selectedHeroId={null} mini />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto flex flex-col items-center h-full">
               <div className="flex gap-2 mb-8 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800/50 overflow-x-auto max-w-full no-scrollbar">
                {PUZZLE_DEFINITIONS.map(p => (
                  <button key={p.type} onClick={() => setActivePuzzle(p.type)} className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black transition-all ${activePuzzle === p.type ? 'bg-slate-800 text-amber-500 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                    {p.type.split('(')[0].replace('푸른숨결산림보호연맹', '산림연맹').replace('대지의아이연구원', '연구원').replace('철의의지형제회', '형제회')}
                  </button>
                ))}
              </div>
              <div className="text-center mb-8">
                <h2 className="text-4xl font-black text-white tracking-tight">{activePuzzle}</h2>
                <div className="mt-4 flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">현재 구역 점수</span>
                  <span className="text-4xl font-black text-amber-500 tabular-nums">{calculateTotalScore(activePuzzleDef, currentPuzzlePlacements)}</span>
                </div>
              </div>
              <PuzzleBoard definition={activePuzzleDef} placements={currentPuzzlePlacements} onSocketClick={handleSocketClick} onDrop={handleDrop} selectedHeroId={null} />
            </div>
          )}
        </div>

        <footer className="px-8 py-3 bg-slate-950 border-t border-slate-900/80 flex justify-between items-center text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">
           <div className="flex items-center gap-4">
             <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> SYSTEM READY</span>
             <span className="text-slate-800">|</span>
             <span>ITERATIVE LOCAL SEARCH OPTIMIZER ACTIVE</span>
           </div>
           <div>© 2024 LANGRISSER FLOATING CITY TACTICS</div>
        </footer>
      </main>
    </div>
  );
};

export default App;
