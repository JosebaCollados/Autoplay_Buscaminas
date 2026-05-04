import { getNeighbors, keyOf } from "./engine";
import { predictMineRisk } from "./learning";
import type { AiLevel, Board, Cell, CellHint, Coord, LearningModel, SolverAction, SolverOptions, SolverResult } from "./types";

type Constraint = {
  cells: string[];
  mineCount: number;
  source: Coord;
};

type Component = {
  cells: string[];
  constraints: Constraint[];
};

type ExactResult = {
  probabilities: Map<string, number>;
  hints: Map<string, string>;
  solvedComponents: number;
};

type AiLevelConfig = {
  label: string;
  maxExactComponentSize: number;
  useLearning: boolean;
  learningMinExamples: number;
  learningWeight: number;
};

const AI_LEVELS: Record<AiLevel, AiLevelConfig> = {
  1: { label: "Basico", maxExactComponentSize: 0, useLearning: false, learningMinExamples: 999999, learningWeight: 0 },
  2: { label: "Logico", maxExactComponentSize: 14, useLearning: false, learningMinExamples: 999999, learningWeight: 0 },
  3: { label: "Probable", maxExactComponentSize: 24, useLearning: false, learningMinExamples: 999999, learningWeight: 0 },
  4: { label: "Experto", maxExactComponentSize: 28, useLearning: true, learningMinExamples: 25, learningWeight: 0.28 },
  5: { label: "Genio", maxExactComponentSize: 30, useLearning: true, learningMinExamples: 10, learningWeight: 0.42 },
};

export function getAiLevelLabel(level: AiLevel): string {
  return AI_LEVELS[level].label;
}

export function solveVisibleBoard(board: Board, learningModel?: LearningModel, options: SolverOptions = { aiLevel: 3 }): SolverResult {
  const config = AI_LEVELS[options.aiLevel];
  const actions = new Map<string, SolverAction>();
  const hints = new Map<string, CellHint>();

  if (!board.hasStarted) {
    const center = { x: Math.floor(board.width / 2), y: Math.floor(board.height / 2) };
    return {
      actions: [
        {
          type: "reveal",
          coord: center,
          reason: "Primer movimiento: abrir el centro crea una apertura inicial estable.",
          confidence: 1,
          isGuess: false,
        },
      ],
      hints,
      summary: "La IA empezara por el centro. El generador evita minas en la zona inicial cuando hay espacio.",
    };
  }

  addBasicDeductions(board, actions, hints);
  const exact = solveFrontierExactly(board, config.maxExactComponentSize);

  for (const [id, probability] of exact.probabilities) {
    const coord = coordFromKey(id);
    const reason = exact.hints.get(id) ?? "Probabilidad calculada por restricciones visibles.";
    if (probability === 0) {
      setAction(actions, hints, {
        type: "reveal",
        coord,
        reason: `${reason} Aparece en 0 soluciones validas como mina.`,
        confidence: 1,
        isGuess: false,
      });
    } else if (probability === 1) {
      setAction(actions, hints, {
        type: "flag",
        coord,
        reason: `${reason} Aparece en todas las soluciones validas como mina.`,
        confidence: 1,
        isGuess: false,
      });
    } else if (!hints.has(id)) {
      hints.set(id, {
        risk: probability,
        reason: `${reason} Riesgo exacto local: ${Math.round(probability * 100)}%.`,
      });
    }
  }

  if (actions.size > 0) {
    const ordered = orderActions([...actions.values()]);
    return {
      actions: ordered,
      hints,
      summary: `Solver exacto: ${ordered.length} jugadas seguras/minas deducidas en ${exact.solvedComponents} grupo(s) de frontera.`,
    };
  }

  const fallback = chooseBestMove(board, exact, hints, config.useLearning ? learningModel : undefined, config);
  return {
    actions: fallback ? [fallback] : [],
    hints,
    summary: fallback
      ? `Nivel ${config.label}: sin certeza matematica. Mejor jugada por riesgo: ${Math.round((1 - fallback.confidence) * 100)}%.`
      : "No quedan acciones disponibles.",
  };
}

function addBasicDeductions(board: Board, actions: Map<string, SolverAction>, hints: Map<string, CellHint>): void {
  for (const row of board.cells) {
    for (const cell of row) {
      if (!cell.isRevealed || cell.adjacentMines === 0) continue;
      const neighbors = getNeighbors(board, cell);
      const flagged = neighbors.filter((neighbor) => neighbor.isFlagged).length;
      const unknown = neighbors.filter((neighbor) => !neighbor.isRevealed && !neighbor.isFlagged);
      const remainingMines = cell.adjacentMines - flagged;

      if (unknown.length === 0) continue;

      if (remainingMines === 0) {
        for (const safeCell of unknown) {
          setAction(actions, hints, {
            type: "reveal",
            coord: safeCell,
            reason: `Todas las minas alrededor de ${label(cell)} ya estan marcadas.`,
            confidence: 1,
            isGuess: false,
          });
        }
      }

      if (remainingMines === unknown.length) {
        for (const mineCell of unknown) {
          setAction(actions, hints, {
            type: "flag",
            coord: mineCell,
            reason: `La pista ${cell.adjacentMines} en ${label(cell)} obliga a marcar todas sus ocultas.`,
            confidence: 1,
            isGuess: false,
          });
        }
      }
    }
  }
}

function solveFrontierExactly(board: Board, maxExactComponentSize: number): ExactResult {
  const constraints = buildConstraints(board);
  const probabilities = new Map<string, number>();
  const hints = new Map<string, string>();
  let solvedComponents = 0;
  if (maxExactComponentSize <= 0) return { probabilities, hints, solvedComponents };

  for (const component of buildComponents(constraints)) {
    if (component.cells.length > maxExactComponentSize) continue;
    const result = enumerateComponent(component);
    if (!result) continue;
    solvedComponents += 1;
    for (const cellId of component.cells) {
      probabilities.set(cellId, result.mineCounts.get(cellId)! / result.validAssignments);
      hints.set(cellId, `Analizadas ${result.validAssignments} configuraciones posibles en su grupo.`);
    }
  }

  return { probabilities, hints, solvedComponents };
}

function buildConstraints(board: Board): Constraint[] {
  const constraints: Constraint[] = [];

  for (const row of board.cells) {
    for (const cell of row) {
      if (!cell.isRevealed || cell.adjacentMines === 0) continue;
      const neighbors = getNeighbors(board, cell);
      const flagged = neighbors.filter((neighbor) => neighbor.isFlagged).length;
      const unknown = neighbors.filter((neighbor) => !neighbor.isRevealed && !neighbor.isFlagged);
      const mineCount = cell.adjacentMines - flagged;

      if (unknown.length > 0 && mineCount >= 0) {
        constraints.push({
          cells: unknown.map(keyOf),
          mineCount,
          source: { x: cell.x, y: cell.y },
        });
      }
    }
  }

  return constraints;
}

function buildComponents(constraints: Constraint[]): Component[] {
  const cellToConstraints = new Map<string, Constraint[]>();
  for (const constraint of constraints) {
    for (const cellId of constraint.cells) {
      const list = cellToConstraints.get(cellId) ?? [];
      list.push(constraint);
      cellToConstraints.set(cellId, list);
    }
  }

  const seen = new Set<string>();
  const components: Component[] = [];

  for (const start of cellToConstraints.keys()) {
    if (seen.has(start)) continue;
    const queue = [start];
    const cells = new Set<string>();
    const componentConstraints = new Set<Constraint>();

    while (queue.length > 0) {
      const cellId = queue.shift()!;
      if (seen.has(cellId)) continue;
      seen.add(cellId);
      cells.add(cellId);

      for (const constraint of cellToConstraints.get(cellId) ?? []) {
        componentConstraints.add(constraint);
        for (const nextCell of constraint.cells) {
          if (!seen.has(nextCell)) queue.push(nextCell);
        }
      }
    }

    components.push({
      cells: [...cells],
      constraints: [...componentConstraints],
    });
  }

  return components;
}

function enumerateComponent(component: Component): { validAssignments: number; mineCounts: Map<string, number> } | null {
  const cellIndex = new Map(component.cells.map((cellId, index) => [cellId, index]));
  const constraintState = component.constraints.map((constraint) => ({
    ...constraint,
    indexes: constraint.cells.map((cellId) => cellIndex.get(cellId)!),
    assigned: 0,
    mines: 0,
  }));
  const constraintsByCell = component.cells.map((_, index) =>
    constraintState.filter((constraint) => constraint.indexes.includes(index)),
  );
  const assignment = Array(component.cells.length).fill(false);
  const mineCounts = new Map(component.cells.map((cellId) => [cellId, 0]));
  let validAssignments = 0;

  function backtrack(index: number): void {
    if (index === component.cells.length) {
      if (!constraintState.every((constraint) => constraint.mines === constraint.mineCount)) return;
      validAssignments += 1;
      for (let i = 0; i < assignment.length; i += 1) {
        if (assignment[i]) {
          const cellId = component.cells[i];
          mineCounts.set(cellId, mineCounts.get(cellId)! + 1);
        }
      }
      return;
    }

    assign(index, false);
    if (isStillPossible()) backtrack(index + 1);
    unassign(index, false);

    assign(index, true);
    if (isStillPossible()) backtrack(index + 1);
    unassign(index, true);
  }

  function assign(index: number, isMine: boolean): void {
    assignment[index] = isMine;
    for (const constraint of constraintsByCell[index]) {
      constraint.assigned += 1;
      if (isMine) constraint.mines += 1;
    }
  }

  function unassign(index: number, isMine: boolean): void {
    for (const constraint of constraintsByCell[index]) {
      constraint.assigned -= 1;
      if (isMine) constraint.mines -= 1;
    }
    assignment[index] = false;
  }

  function isStillPossible(): boolean {
    return constraintState.every((constraint) => {
      const unassigned = constraint.indexes.length - constraint.assigned;
      return constraint.mines <= constraint.mineCount && constraint.mines + unassigned >= constraint.mineCount;
    });
  }

  backtrack(0);
  return validAssignments > 0 ? { validAssignments, mineCounts } : null;
}

function chooseBestMove(
  board: Board,
  exact: ExactResult,
  hints: Map<string, CellHint>,
  learningModel?: LearningModel,
  config: AiLevelConfig = AI_LEVELS[3],
): SolverAction | null {
  const hiddenCells = board.cells.flat().filter((cell) => !cell.isRevealed && !cell.isFlagged);
  if (hiddenCells.length === 0) return null;

  const remainingMines = board.mineCount - board.flagsPlaced;
  const unconstrainedRisk = remainingMines / hiddenCells.length;
  let best = hiddenCells[0];
  let bestRisk = blendedRisk(board, best, exact, unconstrainedRisk, learningModel, config).risk;
  let bestReason = exact.hints.get(keyOf(best)) ?? "Casilla fuera de la frontera: riesgo global estimado.";

  for (const cell of hiddenCells) {
    const id = keyOf(cell);
    const blended = blendedRisk(board, cell, exact, unconstrainedRisk, learningModel, config);
    const risk = blended.risk;
    const reason = exact.hints.get(id) ?? "Casilla fuera de la frontera: riesgo global estimado.";
    if (isBetterGuess(board, cell, risk, best, bestRisk)) {
      best = cell;
      bestRisk = risk;
      bestReason = `${reason}${blended.detail}`;
    }
    hints.set(id, {
      risk,
      reason: `${reason}${blended.detail} Riesgo usado: ${Math.round(risk * 100)}%.`,
      actionType: id === keyOf(best) ? "reveal" : undefined,
    });
  }

  hints.set(keyOf(best), {
    risk: bestRisk,
    reason: `${bestReason} Mejor opcion sin certeza.`,
    actionType: "reveal",
  });

  return {
    type: "reveal",
    coord: { x: best.x, y: best.y },
    reason: `${bestReason} No existe jugada segura demostrable.`,
    confidence: Math.max(0, 1 - bestRisk),
    isGuess: true,
  };
}

function blendedRisk(
  board: Board,
  cell: Cell,
  exact: ExactResult,
  unconstrainedRisk: number,
  learningModel?: LearningModel,
  config: AiLevelConfig = AI_LEVELS[3],
): { risk: number; detail: string } {
  const id = keyOf(cell);
  const exactRisk = exact.probabilities.get(id);
  const baseRisk = exactRisk ?? unconstrainedRisk;
  if (!learningModel || learningModel.examples < config.learningMinExamples) {
    return { risk: baseRisk, detail: "" };
  }

  const learnedRisk = predictMineRisk(learningModel, board, cell);
  const learningWeight = exactRisk === undefined ? config.learningWeight : config.learningWeight * 0.45;
  const risk = baseRisk * (1 - learningWeight) + learnedRisk * learningWeight;
  return {
    risk,
    detail: ` Modelo N-Tuple 4x6: ${Math.round(learnedRisk * 100)}% mina.`,
  };
}

function isBetterGuess(board: Board, cell: Cell, risk: number, best: Cell, bestRisk: number): boolean {
  if (risk !== bestRisk) return risk < bestRisk;
  const cellInfo = getNeighbors(board, cell).filter((neighbor) => neighbor.isRevealed).length;
  const bestInfo = getNeighbors(board, best).filter((neighbor) => neighbor.isRevealed).length;
  if (cellInfo !== bestInfo) return cellInfo > bestInfo;
  return compareDistanceToCenter(board, cell, best) < 0;
}

function setAction(actions: Map<string, SolverAction>, hints: Map<string, CellHint>, action: SolverAction): void {
  const id = keyOf(action.coord);
  const existing = actions.get(id);
  if (existing?.type === "flag" && action.type === "reveal") return;
  actions.set(id, action);
  hints.set(id, {
    risk: action.type === "flag" ? 1 : 0,
    reason: action.reason,
    actionType: action.type,
  });
}

function orderActions(actions: SolverAction[]): SolverAction[] {
  return actions.sort((a, b) => {
    if (a.type !== b.type) return a.type === "flag" ? -1 : 1;
    return keyOf(a.coord).localeCompare(keyOf(b.coord));
  });
}

function compareDistanceToCenter(board: Board, a: Coord, b: Coord): number {
  const cx = (board.width - 1) / 2;
  const cy = (board.height - 1) / 2;
  const da = Math.abs(a.x - cx) + Math.abs(a.y - cy);
  const db = Math.abs(b.x - cx) + Math.abs(b.y - cy);
  return da - db;
}

function coordFromKey(key: string): Coord {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

function label(coord: Coord): string {
  return `(${coord.x + 1}, ${coord.y + 1})`;
}
