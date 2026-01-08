
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
 * 전역 배치의 총 점수를 계산합니다.
 */
const calculateGlobalScore = (
  slots: Slot[],
  placements: Map<string, Hero>
): number => {
  let total = 0;
  const processedEdges = new Set<string>();

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
 * 업그레이드된 최적화 알고리즘: Greedy + Local Search (Swapping)
 */
export const optimizeAllPlacements = (
  ownedHeroes: Hero[],
  puzzles: PuzzleDefinition[],
  activeClassesMap: Record<number, HeroClass[]>
): Record<string, number> => {
  if (ownedHeroes.length === 0) return {};

  // 1. 모든 슬롯 데이터 평탄화
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

  // 2. 초기 Greedy 배치
  const currentPlacements = new Map<string, Hero>();
  const availableHeroes = [...ownedHeroes];
  
  // 연결도(Degree)가 높은 순서대로 슬롯 정렬
  const sortedSlots = [...allSlots].sort((a, b) => b.edges.length - a.edges.length);

  sortedSlots.forEach(slot => {
    let bestHeroIdx = -1;
    let maxGain = -1;

    // 후보군 필터링 (클래스 만족 여부)
    const candidates = availableHeroes.map((h, i) => ({ h, i }))
      .filter(item => (activeClassesMap[item.h.id] || []).includes(slot.requiredClass));

    candidates.forEach(({ h, i }) => {
      let gain = 0;
      slot.edges.forEach(nId => {
        const nKey = `${slot.puzzleType}_${nId}`;
        const nHero = currentPlacements.get(nKey);
        if (nHero) gain += calculateEdgeScore(h, nHero);
      });

      // 점수가 높거나, 점수가 같으면 클래스 보유수가 적은(희귀한) 영웅 우선
      if (gain > maxGain) {
        maxGain = gain;
        bestHeroIdx = i;
      } else if (gain === maxGain && maxGain !== -1) {
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

  // 3. 반복적 지역 탐색 (Hill Climbing / Swapping)
  // 최대 20회 루프 또는 점수 변화가 없을 때까지 수행
  let improved = true;
  let iterations = 0;
  while (improved && iterations < 20) {
    improved = false;
    iterations++;

    // A. 배치된 영웅들 간의 스왑 시도
    for (let i = 0; i < allSlots.length; i++) {
      for (let j = i + 1; j < allSlots.length; j++) {
        const slotA = allSlots[i];
        const slotB = allSlots[j];
        const heroA = currentPlacements.get(slotA.key);
        const heroB = currentPlacements.get(slotB.key);

        if (!heroA || !heroB || heroA.id === heroB.id) continue;

        // 서로의 클래스 요구사항을 만족하는지 확인
        const aFitsB = (activeClassesMap[heroA.id] || []).includes(slotB.requiredClass);
        const bFitsA = (activeClassesMap[heroB.id] || []).includes(slotA.requiredClass);

        if (aFitsB && bFitsA) {
          const scoreBefore = calculateGlobalScore(allSlots, currentPlacements);
          
          // 임시 스왑
          currentPlacements.set(slotA.key, heroB);
          currentPlacements.set(slotB.key, heroA);
          
          const scoreAfter = calculateGlobalScore(allSlots, currentPlacements);
          
          if (scoreAfter > scoreBefore) {
            improved = true;
          } else {
            // 원복
            currentPlacements.set(slotA.key, heroA);
            currentPlacements.set(slotB.key, heroB);
          }
        }
      }
    }

    // B. 배치된 영웅과 대기 중인 영웅 간의 교체 시도
    for (let i = 0; i < allSlots.length; i++) {
      const slot = allSlots[i];
      const currentHero = currentPlacements.get(slot.key);

      for (let j = 0; j < availableHeroes.length; j++) {
        const poolHero = availableHeroes[j];
        
        // 클래스 만족 확인
        if ((activeClassesMap[poolHero.id] || []).includes(slot.requiredClass)) {
          const scoreBefore = calculateGlobalScore(allSlots, currentPlacements);
          
          // 임시 교체
          currentPlacements.set(slot.key, poolHero);
          
          const scoreAfter = calculateGlobalScore(allSlots, currentPlacements);
          
          if (scoreAfter > scoreBefore) {
            // 교체 확정 및 대기열 업데이트
            availableHeroes[j] = currentHero!;
            improved = true;
            break; // 다음 슬롯으로
          } else {
            // 원복
            currentPlacements.set(slot.key, currentHero!);
          }
        }
      }
    }
  }

  // 4. 최종 결과 포맷팅
  const result: Record<string, number> = {};
  currentPlacements.forEach((hero, key) => {
    result[key] = hero.id;
  });

  return result;
};
