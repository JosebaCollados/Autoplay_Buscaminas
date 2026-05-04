import type { Board, Cell, Coord } from "./types";

const dirs = [-1, 0, 1];

export function createBoard(width: number, height: number, mineCount: number, options = { safeOpening: true }): Board {
  const maxMines = Math.max(1, width * height - 1);
  const safeMineCount = Math.min(Math.max(1, mineCount), maxMines);
  const cells = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x): Cell => ({
      x,
      y,
      hasMine: false,
      isRevealed: false,
      isFlagged: false,
      adjacentMines: 0,
    })),
  );

  return {
    width,
    height,
    mineCount: safeMineCount,
    safeOpening: options.safeOpening,
    cells,
    status: "ready",
    hasStarted: false,
    revealedCount: 0,
    flagsPlaced: 0,
    moves: 0,
    startedAt: null,
    endedAt: null,
  };
}

export function cloneBoard(board: Board): Board {
  return {
    ...board,
    cells: board.cells.map((row) => row.map((cell) => ({ ...cell }))),
  };
}

export function keyOf(coord: Coord): string {
  return `${coord.x},${coord.y}`;
}

export function inBounds(board: Board, x: number, y: number): boolean {
  return x >= 0 && x < board.width && y >= 0 && y < board.height;
}

export function getCell(board: Board, coord: Coord): Cell | null {
  return inBounds(board, coord.x, coord.y) ? board.cells[coord.y][coord.x] : null;
}

export function getNeighbors(board: Board, coord: Coord): Cell[] {
  const neighbors: Cell[] = [];
  for (const dy of dirs) {
    for (const dx of dirs) {
      if (dx === 0 && dy === 0) continue;
      const x = coord.x + dx;
      const y = coord.y + dy;
      if (inBounds(board, x, y)) neighbors.push(board.cells[y][x]);
    }
  }
  return neighbors;
}

export function revealCell(board: Board, coord: Coord): Board {
  const next = cloneBoard(board);
  if (next.status === "won" || next.status === "lost") return next;

  const cell = getCell(next, coord);
  if (!cell || cell.isRevealed || cell.isFlagged) return next;

  if (!next.hasStarted) {
    placeMines(next, coord);
    next.hasStarted = true;
    next.status = "playing";
    next.startedAt = Date.now();
  }

  next.moves += 1;

  if (cell.hasMine) {
    cell.isRevealed = true;
    next.status = "lost";
    next.endedAt = Date.now();
    revealAllMines(next);
    return next;
  }

  floodReveal(next, coord);
  updateWinState(next);
  return next;
}

export function toggleFlag(board: Board, coord: Coord): Board {
  const next = cloneBoard(board);
  if (next.status === "won" || next.status === "lost") return next;

  const cell = getCell(next, coord);
  if (!cell || cell.isRevealed) return next;

  cell.isFlagged = !cell.isFlagged;
  next.flagsPlaced += cell.isFlagged ? 1 : -1;
  next.moves += 1;
  return next;
}

export function resetBoard(board: Board): Board {
  return createBoard(board.width, board.height, board.mineCount, { safeOpening: board.safeOpening });
}

function placeMines(board: Board, firstClick: Coord): void {
  const opening = board.safeOpening
    ? ([getCell(board, firstClick), ...getNeighbors(board, firstClick)].filter(Boolean) as Cell[])
    : ([getCell(board, firstClick)].filter(Boolean) as Cell[]);
  const forbidden = new Set(opening.map(keyOf));
  const options: Coord[] = [];
  for (let y = 0; y < board.height; y += 1) {
    for (let x = 0; x < board.width; x += 1) {
      if (!forbidden.has(`${x},${y}`)) options.push({ x, y });
    }
  }

  if (options.length < board.mineCount) {
    forbidden.clear();
    forbidden.add(keyOf(firstClick));
    options.length = 0;
    for (let y = 0; y < board.height; y += 1) {
      for (let x = 0; x < board.width; x += 1) {
        if (!forbidden.has(`${x},${y}`)) options.push({ x, y });
      }
    }
  }

  shuffle(options);
  for (const coord of options.slice(0, board.mineCount)) {
    board.cells[coord.y][coord.x].hasMine = true;
  }

  for (const row of board.cells) {
    for (const cell of row) {
      cell.adjacentMines = getNeighbors(board, cell).filter((neighbor) => neighbor.hasMine).length;
    }
  }
}

function shuffle<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function floodReveal(board: Board, coord: Coord): void {
  const queue: Coord[] = [coord];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    const cell = getCell(board, current);
    if (!cell || visited.has(keyOf(current)) || cell.isFlagged || cell.isRevealed) continue;

    visited.add(keyOf(current));
    cell.isRevealed = true;
    board.revealedCount += 1;

    if (cell.adjacentMines === 0) {
      for (const neighbor of getNeighbors(board, cell)) {
        if (!neighbor.isRevealed && !neighbor.isFlagged) queue.push(neighbor);
      }
    }
  }
}

function revealAllMines(board: Board): void {
  for (const row of board.cells) {
    for (const cell of row) {
      if (cell.hasMine) cell.isRevealed = true;
    }
  }
}

function updateWinState(board: Board): void {
  const safeCells = board.width * board.height - board.mineCount;
  if (board.revealedCount >= safeCells) {
    board.status = "won";
    board.endedAt = Date.now();
    for (const row of board.cells) {
      for (const cell of row) {
        if (cell.hasMine && !cell.isFlagged) {
          cell.isFlagged = true;
          board.flagsPlaced += 1;
        }
      }
    }
  }
}
