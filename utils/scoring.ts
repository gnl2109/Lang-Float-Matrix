
import { Hero, PuzzleDefinition } from '../types';

/**
 * 두 영웅 간의 진영 중첩 점수를 계산합니다.
 */
export const calculateEdgeScore = (heroA: Hero, heroB: Hero): number => {
  const overlaps = heroA.factions.filter(f => heroB.factions.includes(f)).length;
  // 진영 3개 이상 겹침 시 3점, 2개 겹침 시 2점, 1개 겹침 시 1점
  if (overlaps >= 3) return 3;
  if (overlaps === 2) return 2;
  if (overlaps === 1) return 1;
  return 0;
};

/**
 * 퍼즐 전체의 현재 배치에 대한 총 점수를 계산합니다.
 */
export const calculateTotalScore = (
  puzzle: PuzzleDefinition,
  placements: Record<string, Hero | undefined>
): number => {
  let total = 0;
  puzzle.edges.forEach(([nodeAId, nodeBId]) => {
    const heroA = placements[nodeAId];
    const heroB = placements[nodeBId];
    if (heroA && heroB) {
      total += calculateEdgeScore(heroA, heroB);
    }
  });
  return total;
};
