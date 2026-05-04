export type Cell = {
  x: number;
  y: number;
  hasMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  adjacentMines: number;
};

export type DifficultyId = "principiante" | "facil" | "normal" | "dificil" | "experto" | "custom";

export type Difficulty = {
  id: DifficultyId;
  label: string;
  width: number;
  height: number;
  mines: number;
};

export type GameStatus = "ready" | "playing" | "won" | "lost";

export type Board = {
  width: number;
  height: number;
  mineCount: number;
  safeOpening: boolean;
  cells: Cell[][];
  status: GameStatus;
  hasStarted: boolean;
  revealedCount: number;
  flagsPlaced: number;
  moves: number;
  startedAt: number | null;
  endedAt: number | null;
};

export type Coord = {
  x: number;
  y: number;
};

export type SolverAction = {
  type: "reveal" | "flag";
  coord: Coord;
  reason: string;
  confidence: number;
  isGuess: boolean;
};

export type CellHint = {
  risk: number;
  reason: string;
  actionType?: SolverAction["type"];
};

export type SolverResult = {
  actions: SolverAction[];
  hints: Map<string, CellHint>;
  summary: string;
};

export type AiLevel = 1 | 2 | 3 | 4 | 5;

export type SolverOptions = {
  aiLevel: AiLevel;
};

export type LearningModel = {
  weights: Float32Array;
  bias: number;
  examples: number;
  mistakes: number;
};

export type GameStats = {
  games: number;
  wins: number;
  losses: number;
  moves: number;
  guesses: number;
  safeMoves: number;
  flags: number;
  totalTimeMs: number;
};
