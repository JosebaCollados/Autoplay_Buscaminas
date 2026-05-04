import type { Difficulty } from "./types";

export const difficulties: Difficulty[] = [
  { id: "principiante", label: "Principiante", width: 9, height: 9, mines: 10 },
  { id: "facil", label: "Facil", width: 12, height: 10, mines: 18 },
  { id: "normal", label: "Normal", width: 16, height: 16, mines: 40 },
  { id: "dificil", label: "Dificil", width: 24, height: 16, mines: 72 },
];

export const defaultDifficulty = difficulties[0];
