
import { Hero, PuzzleDefinition, PuzzleType, HeroClass } from '../types';
import { calculateEdgeScore } from './scoring';

interface Slot {
  key: string;
  puzzleType: PuzzleType;
  nodeId: string;
  edges: string[];
  requiredClass: HeroClass;
}

/**
 * 전역 배치의 총 점수를 계산합니다 (기본 점수 + 시너지).
 */
const calculateGlobalScore = (
  slots: Slot[],
  placements: Map<string, Hero>
): number => {
  let total = 0;
  const processedEdges = new Set<string>();

  // 1. 기본 점수 (배치된 영웅 수)
  total += placements.size;

  // 2. 시너지 점수
  slots.forEach(slot => {
    const heroA = placements.get(slot.key);
    if (!heroA) return;

    slot.edges.forEach(neighborId => {
      const neighborKey = `${slot.puzzleType}_${neighborId}`;
      const edgeKey = [slot.key, neighborKey].sort().join('-');
      
      if (!processedEdges.has(edgeKey)) {
        const heroB = placements.get(neighborKey);
        if (heroB) {
          total += calculateEdgeScore(heroA, heroB);
        }
        processedEdges.add(edgeKey);
      }
    });
  });
  return total;
};

/**
 * 최적화 알고리즘: Greedy Seed + Iterative Swap
 */
export const optimizeAllPlacements = (
  ownedHeroes: Hero[],
  puzzles: PuzzleDefinition[],
  activeClassesMap: Record<number, HeroClass[]>
): Record<string, number> => {
  if (ownedHeroes.length === 0) return {};

  const allSlots: Slot[] = [];
  puzzles.forEach(p => {
    p.nodes.forEach(n => {
      const edges = p.edges
        .filter(e => e.includes(n.id))
        .map(e => (e[0] === n.id ? e[1] : e[0]));
      
      allSlots.push({
        key: `${p.type}_${n.id}`,
        puzzleType: p.type,
        nodeId: n.id,
        edges,
        requiredClass: n.requiredClass
      });
    });
  });

  const currentPlacements = new Map<string, Hero>();
  const availableHeroes = [...ownedHeroes];
  const sortedSlots = [...allSlots].sort((a, b) => b.edges.length - a.edges.length);

  sortedSlots.forEach(slot => {
    let bestHeroIdx = -1;
    let maxGain = -1;

    const candidates = availableHeroes.map((h, i) => ({ h, i }))
      .filter(item => (activeClassesMap[item.h.id] || []).includes(slot.requiredClass));

    candidates.forEach(({ h, i }) => {
      let gain = 0;
      slot.edges.forEach(nId => {
        const nKey = `${slot.puzzleType}_${nId}`;
        const nHero = currentPlacements.get(nKey);
        if (nHero) gain += calculateEdgeScore(h, nHero);
      });

      if (gain > maxGain) {
        maxGain = gain;
        bestHeroIdx = i;
      } else if (gain === maxGain && maxGain !== -1) {
        // 동률일 경우 진영이 많은 영웅을 아끼기 위해 클래스가 적은 영웅 우선 사용
        if (h.classes.length < availableHeroes[bestHeroIdx].classes.length) {
          bestHeroIdx = i;
        }
      }
    });

    if (bestHeroIdx !== -1) {
      const chosen = availableHeroes.splice(bestHeroIdx, 1)[0];
      currentPlacements.set(slot.key, chosen);
    }
  });

  let improved = true;
  let iterations = 0;
  while (improved && iterations < 30) {
    improved = false;
    iterations++;

    // 스왑 최적화
    for (let i = 0; i < allSlots.length; i++) {
      for (let j = i + 1; j < allSlots.length; j++) {
        const slotA = allSlots[i];
        const slotB = allSlots[j];
        const heroA = currentPlacements.get(slotA.key);
        const heroB = currentPlacements.get(slotB.key);

        if (!heroA || !heroB || heroA.id === heroB.id) continue;

        if ((activeClassesMap[heroA.id] || []).includes(slotB.requiredClass) && 
            (activeClassesMap[heroB.id] || []).includes(slotA.requiredClass)) {
          
          const scoreBefore = calculateGlobalScore(allSlots, currentPlacements);
          currentPlacements.set(slotA.key, heroB);
          currentPlacements.set(slotB.key, heroA);
          const scoreAfter = calculateGlobalScore(allSlots, currentPlacements);
          
          if (scoreAfter > scoreBefore) {
            improved = true;
          } else {
            currentPlacements.set(slotA.key, heroA);
            currentPlacements.set(slotB.key, heroB);
          }
        }
      }
    }

    // 대기 영웅 교체 최적화
    for (let i = 0; i < allSlots.length; i++) {
      const slot = allSlots[i];
      const currentHero = currentPlacements.get(slot.key);

      for (let j = 0; j < availableHeroes.length; j++) {
        const poolHero = availableHeroes[j];
        if ((activeClassesMap[poolHero.id] || []).includes(slot.requiredClass)) {
          const scoreBefore = calculateGlobalScore(allSlots, currentPlacements);
          currentPlacements.set(slot.key, poolHero);
          const scoreAfter = calculateGlobalScore(allSlots, currentPlacements);
          
          if (scoreAfter > scoreBefore) {
            if (currentHero) availableHeroes[j] = currentHero;
            else availableHeroes.splice(j, 1);
            improved = true;
            break;
          } else {
            if (currentHero) currentPlacements.set(slot.key, currentHero);
            else currentPlacements.delete(slot.key);
          }
        }
      }
    }
  }

  const result: Record<string, number> = {};
  currentPlacements.forEach((hero, key) => {
    result[key] = hero.id;
  });

  return result;
};
