

export enum GamePhase {
  LOBBY = 'LOBBY',
  SETUP = 'SETUP',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  TURN_TRANSITION = 'TURN_TRANSITION',
}

export enum CellState {
  EMPTY = 'EMPTY',
  SHIP = 'SHIP',
  HIT = 'HIT',
  MISS = 'MISS',
  SUNK = 'SUNK',
  DECOY = 'DECOY',
  RADAR_CONTACT = 'RADAR_CONTACT',
}

export type ShipType = 'Mothership' | 'Radarship' | 'Repairship' | 'Commandship' | 'Decoyship' | 'Jamship';

export interface Ship {
  name: string;
  type: ShipType;
  length: number;
  positions: { x: number; y: number }[];
  isSunk: boolean;
  isDamaged: boolean;
  hasBeenRepaired: boolean;
  hasBeenRelocated: boolean;
}

export type Grid = CellState[][];

export type GameMode = 'CLASSIC' | 'TACTICAL';

export interface Player {
  id: string;
  name: string;
  isAI: boolean;
  grid: Grid;
  ships: Ship[];
  shots: { [key: string]: Grid }; // Key is opponent player ID
  isReady: boolean;
  isEliminated: boolean;
  score: number;
  skillCooldowns: { [key in ShipType]?: number };
  skillUses: { [key in ShipType]?: number };
  decoyPositions: { x: number; y: number }[];
  jammedPositions?: { x: number; y: number }[];
  jamTurnsRemaining?: number;
  escapeSkillUnlocked?: boolean;
}

export interface GameLogEntry {
  turn: number;
  playerId: string;
  playerName: string;
  targetId?: string | null;
  targetName?: string;
  coords?: { x: number; y: number };
  result: 'HIT' | 'MISS' | 'SUNK_SHIP' | 'SHOT_FIRED' | 'SKILL_USED';
  sunkShipName?: string;
  hitShipName?: string;
  message?: string;
}

export interface GameState {
  gameId: string;
  phase: GamePhase;
  players: Player[];
  currentPlayerId: string | null;
  winner: string | null;
  maxPlayers: number;
  turn: number;
  gridDimensions: { rows: number; cols: number };
  shipsConfig: Omit<Ship, 'positions' | 'isSunk' | 'isDamaged' | 'hasBeenRepaired' | 'hasBeenRelocated'>[];
  gameMode: GameMode;
  log: GameLogEntry[];
  hasActedThisTurn: boolean;
  // Fields for Tactical Mode
  activeAction?: {
    playerId: string;
    type: 'ATTACK' | 'SKILL';
    shipType?: ShipType;
    stage?: 'SELECT_SHIP' | 'PLACE_SHIP' | 'PLACE_DECOY';
    shipToMove?: Ship;
    isHorizontal?: boolean;
    originalPositions?: { x: number; y: number; state: CellState }[];
  } | null;
  radarScanResult?: {
    playerId: string;
    results: { x: number; y: number; state: CellState }[];
  } | null;
  jammedArea?: {
    playerId: string;
    coords: { x: number; y: number }[];
  } | null;
  hitLog?: { [playerId: string]: { [coord: string]: number } }; // coord: 'x,y', value: turn number
  lastHitTurn?: { [shipName: string]: number };
}

export type PlayerId = string;