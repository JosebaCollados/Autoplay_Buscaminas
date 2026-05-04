import { useEffect, useMemo, useRef, useState } from "react";
import type { Board, LearningModel, SolverOptions, SolverResult } from "../game/types";

type SolverWorkerState = {
  result: SolverResult;
  status: "thinking" | "ready" | "error";
  error: string | null;
};

type SolveResponse = {
  id: number;
  result?: SolverResult;
  error?: string;
};

function emptyResult(): SolverResult {
  return {
    actions: [],
    hints: new Map(),
    summary: "La IA esta preparando el analisis.",
  };
}

export function useSolverWorker(board: Board, learningModel: LearningModel, options: SolverOptions): SolverWorkerState {
  const worker = useMemo(() => new Worker(new URL("./solverWorker.ts", import.meta.url), { type: "module" }), []);
  const requestId = useRef(0);
  const [state, setState] = useState<SolverWorkerState>(() => ({
    result: emptyResult(),
    status: "thinking",
    error: null,
  }));

  useEffect(() => {
    return () => worker.terminate();
  }, [worker]);

  useEffect(() => {
    const id = ++requestId.current;
    setState((current) => ({ ...current, status: "thinking", error: null }));

    const onMessage = (event: MessageEvent<SolveResponse>) => {
      if (event.data.id !== requestId.current) return;
      if (event.data.error) {
        setState((current) => ({ ...current, status: "error", error: event.data.error ?? "Error desconocido" }));
        return;
      }
      if (event.data.result) {
        setState({ result: event.data.result, status: "ready", error: null });
      }
    };

    worker.addEventListener("message", onMessage);
    worker.postMessage({ id, board, learningModel, options });
    return () => worker.removeEventListener("message", onMessage);
  }, [board, learningModel, options, worker]);

  return state;
}
