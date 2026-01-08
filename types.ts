
export enum Faction {
  PROTAGONIST = '주역',
  LEGION_OF_GLORY = '빛',
  EMPIRE_HONOR = '제국',
  ORIGINS_OF_LIGHT = '기원',
  PRINCESS_ALLIANCE = '공주',
  METEOR_STRIKE = '메테오',
  YELESS_LEGENDS = '전설',
  STRATEGIC_MASTERS = '전략',
  DARK_REINCARNATION = '어둠',
  TIME_AND_SPACE = '시공',
  RE_INCARNATION_TENSEI = '리인카',
  TRANSCENDENCE = '초월'
}

export enum HeroClass {
  INFANTRY = '보병',
  CAVALRY = '기병',
  LANCER = '창병',
  ARCHER = '궁병',
  FLYER = '비병',
  AQUATIC = '수병',
  ASSASSIN = '암살자',
  MAGE = '마법사',
  HOLY = '승려',
  DEMON = '마물',
  DRAGON = '용족'
}

export interface Hero {
  id: number;
  name: string;
  factions: Faction[];
  classes: HeroClass[];
}

export enum PuzzleType {
  CITY_HALL = '시청',
  FOREST_LEAGUE = '푸른숨결산림보호연맹',
  EARTH_INSTITUTE = '대지의아이연구원',
  IRON_BROTHERHOOD = '철의의지형제회'
}

export interface PuzzleNode {
  id: string;
  label: string;
  row: 'top' | 'mid' | 'bot';
  requiredClass: HeroClass; // 해당 슬롯에 배치 가능한 클래스
}

export interface PuzzleDefinition {
  type: PuzzleType;
  nodes: PuzzleNode[];
  edges: [string, string][];
  totalSlots: number;
}
