import { solveVisibleBoard } from "../game/solver";
import type { Board, LearningModel, SolverOptions, SolverResult } from "../game/types";

type SolveRequest = {
  id: number;
  board: Board;
  learningModel: LearningModel;
  options: SolverOptions;
};

type SolveResponse = {
  id: number;
  result?: SolverResult;
  error?: string;
};

self.addEventListener("message", (event: MessageEvent<SolveRequest>) => {
  const { id, board, learningModel, options } = event.data;
  try {
    const result = solveVisibleBoard(board, learningModel, options);
    const response: SolveResponse = { id, result };
    self.postMessage(response);
  } catch (error) {
    const response: SolveResponse = { id, error: error instanceof Error ? error.message : String(error) };
    self.postMessage(response);
  }
});

export {};
