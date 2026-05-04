import { getCell, getNeighbors, inBounds } from "./engine";
import type { Board, Coord, LearningModel } from "./types";

const WEIGHT_COUNT = 8192;
const STORAGE_KEY = "autoplay-buscaminas-learning-v1";
const WINDOWS = [
  { width: 4, height: 6, anchorX: 1, anchorY: 2 },
  { width: 4, height: 6, anchorX: 2, anchorY: 2 },
  { width: 6, height: 4, anchorX: 2, anchorY: 1 },
  { width: 6, height: 4, anchorX: 2, anchorY: 2 },
];

type StoredModel = {
  weights: number[];
  bias: number;
  examples: number;
  mistakes: number;
};

export function createLearningModel(): LearningModel {
  return {
    weights: new Float32Array(WEIGHT_COUNT),
    bias: 0,
    examples: 0,
    mistakes: 0,
  };
}

export function loadLearningModel(): LearningModel {
  if (typeof window === "undefined") return createLearningModel();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return createLearningModel();

  try {
    const stored = JSON.parse(raw) as StoredModel;
    const model = createLearningModel();
    model.bias = stored.bias ?? 0;
    model.examples = stored.examples ?? 0;
    model.mistakes = stored.mistakes ?? 0;
    model.weights.set((stored.weights ?? []).slice(0, WEIGHT_COUNT));
    return model;
  } catch {
    return createLearningModel();
  }
}

export function saveLearningModel(model: LearningModel): void {
  if (typeof window === "undefined") return;
  const stored: StoredModel = {
    weights: Array.from(model.weights),
    bias: model.bias,
    examples: model.examples,
    mistakes: model.mistakes,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function resetLearningModel(): LearningModel {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  return createLearningModel();
}

export function predictMineRisk(model: LearningModel, board: Board, coord: Coord): number {
  const features = extractFeatures(board, coord);
  let score = model.bias;
  for (const feature of features) score += model.weights[feature];
  return sigmoid(score / Math.sqrt(features.length));
}

export function trainMineRisk(model: LearningModel, board: Board, coord: Coord, hasMine: boolean): LearningModel {
  const features = extractFeatures(board, coord);
  const next: LearningModel = {
    weights: new Float32Array(model.weights),
    bias: model.bias,
    examples: model.examples + 1,
    mistakes: model.mistakes,
  };
  const prediction = predictMineRisk(model, board, coord);
  const target = hasMine ? 1 : 0;
  const error = target - prediction;
  const rate = 0.11 / Math.sqrt(features.length);

  for (const feature of features) {
    next.weights[feature] += rate * error;
  }
  next.bias += 0.04 * error;
  if ((prediction >= 0.5) !== hasMine) next.mistakes += 1;
  saveLearningModel(next);
  return next;
}

function extractFeatures(board: Board, coord: Coord): number[] {
  const features = [
    hashFeature(`density:${Math.round((board.mineCount / (board.width * board.height)) * 20)}`),
    hashFeature(`edge:${edgeBucket(board, coord)}`),
    hashFeature(`local:${localSummary(board, coord)}`),
  ];

  WINDOWS.forEach((windowShape, index) => {
    let pattern = `${index}|`;
    for (let dy = 0; dy < windowShape.height; dy += 1) {
      for (let dx = 0; dx < windowShape.width; dx += 1) {
        const x = coord.x + dx - windowShape.anchorX;
        const y = coord.y + dy - windowShape.anchorY;
        pattern += encodeVisibleCell(board, x, y);
      }
    }
    features.push(hashFeature(pattern));
  });

  return features;
}

function encodeVisibleCell(board: Board, x: number, y: number): string {
  if (!inBounds(board, x, y)) return "B";
  const cell = getCell(board, { x, y })!;
  if (cell.isFlagged) return "F";
  if (!cell.isRevealed) return "U";
  return String(cell.adjacentMines);
}

function localSummary(board: Board, coord: Coord): string {
  const neighbors = getNeighbors(board, coord);
  const revealed = neighbors.filter((cell) => cell.isRevealed).length;
  const flagged = neighbors.filter((cell) => cell.isFlagged).length;
  const unknown = neighbors.length - revealed - flagged;
  const numberSum = neighbors.reduce((sum, cell) => sum + (cell.isRevealed ? cell.adjacentMines : 0), 0);
  return `${revealed}:${flagged}:${unknown}:${numberSum}`;
}

function edgeBucket(board: Board, coord: Coord): string {
  const left = coord.x;
  const right = board.width - 1 - coord.x;
  const top = coord.y;
  const bottom = board.height - 1 - coord.y;
  return `${Math.min(left, right, 3)}:${Math.min(top, bottom, 3)}`;
}

function hashFeature(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % WEIGHT_COUNT;
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-Math.max(-18, Math.min(18, value))));
}
