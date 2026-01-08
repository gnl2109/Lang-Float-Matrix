
import { Hero, PuzzleDefinition } from '../types';

/**
 * 두 영웅 간의 진영 중첩 점수를 계산합니다.
 * 진영 1개 겹침 시 1점, 2개 겹침 시 2점, 3개 겹침 시 3점을 반환합니다.
 */
export const calculateEdgeScore = (heroA: Hero, heroB: Hero): number => {
  const overlaps = heroA.factions.filter(f => heroB.factions.includes(f)).length;
  // 게임 규칙상 최대 3점(진영 3개 중첩)까지 발생하지만, 
  // 확장성을 위해 중첩 개수 그대로를 점수로 반환합니다.
  return overlaps;
};

/**
 * 퍼즐 전체의 현재 배치에 대한 총 점수를 계산합니다.
 * 점수 = (배치된 영웅 수 * 1점) + (연결된 영웅 간의 진영 시너지 합계)
 */
export const calculateTotalScore = (
  puzzle: PuzzleDefinition,
  placements: Record<string, Hero | undefined>
): number => {
  let synergyScore = 0;
  let placementScore = 0;

  // 1. 배치된 영웅 수 계산 (영웅 당 1점)
  Object.values(placements).forEach(hero => {
    if (hero) placementScore += 1;
  });

  // 2. 연결된 노드 간 시너지 점수 계산
  puzzle.edges.forEach(([nodeAId, nodeBId]) => {
    const heroA = placements[nodeAId];
    const heroB = placements[nodeBId];
    if (heroA && heroB) {
      synergyScore += calculateEdgeScore(heroA, heroB);
    }
  });

  return placementScore + synergyScore;
};
