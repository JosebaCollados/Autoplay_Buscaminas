import { useEffect, useMemo, useRef, useState } from "react";
import { Bomb, Bot, Flag, Gamepad2, Gauge, Github, Linkedin, MousePointerClick, Pause, Play, RotateCcw, Sparkles, Timer, Trophy } from "lucide-react";
import { useSolverWorker } from "./ai/useSolverWorker";
import { difficulties, defaultDifficulty } from "./game/difficulties";
import { createBoard, getCell, keyOf, revealCell, toggleFlag } from "./game/engine";
import { loadLearningModel, trainMineRisk } from "./game/learning";
import { solveVisibleBoard } from "./game/solver";
import type { Board, Cell, Difficulty, GameStats, LearningModel, SolverAction, SolverOptions, SolverResult } from "./game/types";

const emptyStats: GameStats = {
  games: 0,
  wins: 0,
  losses: 0,
  moves: 0,
  guesses: 0,
  safeMoves: 0,
  flags: 0,
  totalTimeMs: 0,
};

type Preferences = {
  safeOpening: boolean;
  strictAutoplay: boolean;
  speedMultiplier: number;
};

const defaultPreferences: Preferences = {
  safeOpening: true,
  strictAutoplay: false,
  speedMultiplier: 1,
};

const preferencesKey = "autoplay-buscaminas-preferences-v1";

export function App() {
  const [preferences, setPreferences] = useState<Preferences>(() => loadPreferences());
  const [difficulty, setDifficulty] = useState<Difficulty>(defaultDifficulty);
  const [board, setBoard] = useState(() =>
    createBoard(defaultDifficulty.width, defaultDifficulty.height, defaultDifficulty.mines, { safeOpening: loadPreferences().safeOpening }),
  );
  const [autoplay, setAutoplay] = useState(false);
  const [stats, setStats] = useState<GameStats>(emptyStats);
  const [learningModel, setLearningModel] = useState<LearningModel>(() => loadLearningModel());
  const [lastAction, setLastAction] = useState<SolverAction | null>(null);
  const recordedBoard = useRef<Board | null>(null);

  const solverOptions = useMemo<SolverOptions>(() => ({ aiLevel: 3 }), []);
  const solverState = useSolverWorker(board, learningModel, solverOptions);
  const localSolver = useMemo(() => solveVisibleBoard(board, learningModel, solverOptions), [board, learningModel, solverOptions]);
  const solver = solverState.status === "ready" ? solverState.result : localSolver;
  const speed = 420 / preferences.speedMultiplier;

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    if (!autoplay || board.status === "won" || board.status === "lost") return;
    if (preferences.strictAutoplay && solver.actions[0]?.isGuess) {
      setAutoplay(false);
      return;
    }
    if (solver.actions.length === 0) {
      setAutoplay(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setBoard((current) => {
        const fresh = solveVisibleBoard(current, learningModel, solverOptions);
        const action = fresh.actions.find((item) => item.type === "flag") ?? fresh.actions[0];
        if (!action) {
          setAutoplay(false);
          return current;
        }
        setLastAction(action);
        learnFromAction(current, action);
        setStats((statsCurrent) => ({
          ...statsCurrent,
          guesses: statsCurrent.guesses + (action.isGuess ? 1 : 0),
          safeMoves: statsCurrent.safeMoves + (action.type === "reveal" && !action.isGuess ? 1 : 0),
          flags: statsCurrent.flags + (action.type === "flag" ? 1 : 0),
        }));
        return action.type === "flag" ? toggleFlag(current, action.coord) : revealCell(current, action.coord);
      });
    }, speed);
    return () => window.clearTimeout(timer);
  }, [autoplay, board, learningModel, preferences.strictAutoplay, solver, solverOptions, speed]);

  useEffect(() => {
    if (board.status !== "won" && board.status !== "lost") return;
    if (recordedBoard.current === board) return;
    recordedBoard.current = board;
    const elapsed = board.startedAt && board.endedAt ? board.endedAt - board.startedAt : 0;
    setStats((current) => ({
      ...current,
      games: current.games + 1,
      wins: current.wins + (board.status === "won" ? 1 : 0),
      losses: current.losses + (board.status === "lost" ? 1 : 0),
      moves: current.moves + board.moves,
      totalTimeMs: current.totalTimeMs + elapsed,
    }));
    setAutoplay(false);
  }, [board]);

  function newGame(nextDifficulty = difficulty) {
    recordedBoard.current = null;
    setBoard(createBoard(nextDifficulty.width, nextDifficulty.height, nextDifficulty.mines, { safeOpening: preferences.safeOpening }));
    setLastAction(null);
    setAutoplay(false);
  }

  function selectDifficulty(id: string) {
    const next = difficulties.find((item) => item.id === id);
    if (!next) return;
    setDifficulty(next);
    newGame(next);
  }



  function reveal(coord: { x: number; y: number }) {
    if (autoplay) return;
    setBoard((current) => revealCell(current, coord));
  }

  function flag(event: React.MouseEvent, coord: { x: number; y: number }) {
    event.preventDefault();
    if (autoplay) return;
    setBoard((current) => toggleFlag(current, coord));
  }

  function applySolverAction(result = solver) {
    const action = result.actions.find((item: SolverAction) => item.type === "flag") ?? result.actions[0];
    if (!action) return;
    setLastAction(action);
    learnFromAction(board, action);
    setStats((current) => ({
      ...current,
      guesses: current.guesses + (action.isGuess ? 1 : 0),
      safeMoves: current.safeMoves + (action.type === "reveal" && !action.isGuess ? 1 : 0),
      flags: current.flags + (action.type === "flag" ? 1 : 0),
    }));
    setBoard((current) => (action.type === "flag" ? toggleFlag(current, action.coord) : revealCell(current, action.coord)));
  }

  function learnFromAction(sourceBoard: Board, action: SolverAction) {
    if (!sourceBoard.hasStarted || (!action.isGuess && action.type !== "flag")) return;
    const cell = getCell(sourceBoard, action.coord);
    if (!cell) return;
    setLearningModel((current) => trainMineRisk(current, sourceBoard, action.coord, cell.hasMine));
  }

  const elapsedMs = board.startedAt ? (board.endedAt ?? Date.now()) - board.startedAt : 0;
  const winRate = stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0;
  const visibleSolver = autoplay ? solver : { ...solver, actions: [], hints: new Map() };
  const appMode = autoplay ? "autoplay" : "manual";
  const effectiveSolverStatus = solver.actions.length > 0 || solver.summary ? "ready" : solverState.status;
  const effectiveSolverError = effectiveSolverStatus === "error" ? solverState.error : null;
  const boardDensity = board.width >= 30 || board.height >= 20 ? "expert" : board.width >= 24 || board.height >= 16 ? "dense" : "normal";

  return (
    <main className="appShell" data-status={board.status}>
      <section className="workspace">
        <header className="mainHeader">
          <div className="brandBlock">
            <div className={`robotAvatar ${autoplay ? "active" : ""}`}>
              <svg viewBox="0 0 64 70" className="robotSvg" role="img" aria-labelledby="robotTitle robotDesc">
                <title id="robotTitle">Robot de Autoplay Buscaminas</title>
                <desc id="robotDesc">Icono animado del asistente de juego.</desc>
                <defs>
                  <linearGradient id="robotFace" x1="12" y1="12" x2="52" y2="56" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#193427" />
                    <stop offset="1" stopColor="#315b45" />
                  </linearGradient>
                  <filter id="robotGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <path className="signalRing" d="M16 10 C26 2, 38 2, 48 10" />
                <line x1="32" y1="17" x2="32" y2="7" className="antennaLine" />
                <circle cx="32" cy="6" r="3.5" className="antennaTip">
                  <animate attributeName="r" values="3.5;5;3.5" dur="2s" repeatCount="indefinite" />
                </circle>
                <rect x="13" y="16" width="38" height="29" rx="9" className="robotHeadMain" />
                <g className="robotEyes">
                  <ellipse cx="24" cy="29" rx="3.2" ry="3" className="eye">
                    <animate attributeName="ry" values="3;3;0.5;3;3" dur="4s" repeatCount="indefinite" />
                  </ellipse>
                  <ellipse cx="40" cy="29" rx="3.2" ry="3" className="eye">
                    <animate attributeName="ry" values="3;3;0.5;3;3" dur="4s" repeatCount="indefinite" />
                  </ellipse>
                </g>
                <path d="M19 46 Q19 42 23 42 L41 42 Q45 42 45 46 L49 61 Q49 65 45 65 L19 65 Q15 65 15 61 Z" className="robotBodyMain" />
                <path d="M24 53 H40" className="processingTrack" />
                <rect x="24" y="50.5" width="16" height="5" rx="2.5" className="processingBar">
                  {autoplay && <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" />}
                </rect>
              </svg>
            </div>
            <div className="titleGroup">
              <h1>Autoplay Buscaminas</h1>
              <div className="difficultyTabs">
                {difficulties.map((item) => (
                  <button
                    key={item.id}
                    className={difficulty.id === item.id ? "active" : ""}
                    onClick={() => selectDifficulty(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <BotStatusLight active={autoplay} />
        </header>

        <section className="playLayout">
          <aside className="sidePanel left">
            <div className="howToPanel">
              <div className="howToHeader">
                <div className="howToIconWrapper">
                  <Gamepad2 size={16} />
                </div>
                <h2>Cómo se juega</h2>
              </div>
              <div className="helpList">
                <div className="helpItem">
                  <div className="iconBox click">
                    <MousePointerClick size={16} />
                  </div>
                  <div className="helpText">
                    <strong>Click Izquierdo</strong>
                    <span>Descubre la casilla</span>
                  </div>
                </div>
                <div className="helpItem">
                  <div className="iconBox flag">
                    <Flag size={16} fill="currentColor" />
                  </div>
                  <div className="helpText">
                    <strong>Click Derecho</strong>
                    <span>Marca una mina</span>
                  </div>
                </div>
                <div className="helpItem">
                  <div className="iconBox number">
                    <span className="numberToken">3</span>
                  </div>
                  <div className="helpText">
                    <strong>Números</strong>
                    <span>Minas alrededor</span>
                  </div>
                </div>
              </div>
            </div>
            
            <StatsPanel board={board} stats={stats} winRate={winRate} />
          </aside>

          <section className="centerPanel">
            <section className="gameToolbar">
              <div className="gameMetrics">
                <Metric icon={<Timer size={16} />} label="Time" value={formatClock(elapsedMs)} />
                <Metric icon={<Flag size={16} />} label="Mines" value={`${board.mineCount - board.flagsPlaced}`} />
                <Metric icon={<Sparkles size={16} />} label="Moves" value={board.moves} />
              </div>
              <div className="modeSwitch" aria-label="Modo actual">
                <span className={appMode === "manual" ? "active" : ""}>Manual</span>
                <span className={appMode === "autoplay" ? "active" : ""}>AI</span>
              </div>
            </section>

            <div className="boardFrame">
              <div className="boardHeader">
                <div>
                  <span>{difficulty.label}</span>
                  <strong>{board.width}x{board.height} - {board.mineCount} minas</strong>
                </div>
              </div>
              <BoardView board={board} density={boardDensity} solver={visibleSolver} lastAction={lastAction} onReveal={reveal} onFlag={flag} />
            </div>
            
            <HowItWorksPanel />
          </section>

          <aside className="sidePanel right">
            <div className="autoplayCard">
              <button className="iconButton primary" onClick={() => setAutoplay((value) => !value)}>
                {autoplay ? <Pause size={19} /> : <Play size={19} />}
                <span>{autoplay ? "Pausar" : "AI Play"}</span>
              </button>
              <div className="autoplaySubControls">
                <button className="iconButton resetButton" onClick={() => newGame()} title="Nueva partida">
                  <RotateCcw size={19} />
                </button>
                <button className="iconButton stepButton" onClick={() => applySolverAction()}>
                  <Bot size={19} />
                  <span>Step</span>
                </button>
              </div>
            </div>

            <div className="speedCard">
              <strong>Velocidad AI</strong>
              <div className="speedPicker">
                {[1, 2, 5, 10].map((value) => (
                  <button
                    key={value}
                    className={preferences.speedMultiplier === value ? "active" : ""}
                    onClick={() => setPreferences((current) => ({ ...current, speedMultiplier: value }))}
                  >
                    x{value}
                  </button>
                ))}
              </div>
            </div>

            <ReasoningPanel
              solver={autoplay ? solver : null}
              lastAction={lastAction}
              learningModel={learningModel}
              autoplay={autoplay}
              solverStatus={effectiveSolverStatus}
              solverError={effectiveSolverError}
            />
            
            <ProjectCreditsPanel />
          </aside>
        </section>
      </section>
    </main>
  );
}

function BoardView({
  board,
  density,
  solver,
  lastAction,
  onReveal,
  onFlag,
}: {
  board: Board;
  density: "normal" | "dense" | "expert";
  solver: SolverResult;
  lastAction: SolverAction | null;
  onReveal: (coord: { x: number; y: number }) => void;
  onFlag: (event: React.MouseEvent, coord: { x: number; y: number }) => void;
}) {
  return (
    <div
      className={`board ${density}`}
      style={{
        gridTemplateColumns: `repeat(${board.width}, minmax(0, 1fr))`,
      }}
    >
      {board.cells.flat().map((cell, index) => (
        <CellView
          key={keyOf(cell)}
          cell={cell}
          hint={solver.hints.get(keyOf(cell))}
          isLastAction={lastAction ? keyOf(lastAction.coord) === keyOf(cell) : false}
          onReveal={() => onReveal(cell)}
          onFlag={(event) => onFlag(event, cell)}
          index={index}
        />
      ))}
    </div>
  );
}

function CellView({
  cell,
  hint,
  isLastAction,
  onReveal,
  onFlag,
  index,
}: {
  cell: Cell;
  hint?: { risk: number; actionType?: "reveal" | "flag"; reason: string };
  isLastAction: boolean;
  onReveal: () => void;
  onFlag: (event: React.MouseEvent) => void;
  index: number;
}) {
  const content = cell.isFlagged ? <Flag size={15} fill="currentColor" /> : cell.isRevealed && cell.hasMine ? <Bomb size={15} /> : cell.isRevealed && cell.adjacentMines > 0 ? cell.adjacentMines : "";
  const title = hint ? `${hint.reason} Riesgo ${Math.round(hint.risk * 100)}%.` : "";
  const animationDelay = `${(index % 20) * 20}ms`;
  return (
    <button
      className={[
        "cell",
        cell.isRevealed ? "revealed" : "hidden",
        cell.hasMine && cell.isRevealed ? "mine" : "",
        cell.isFlagged ? "flagged" : "",
        hint?.actionType === "reveal" ? "safeHint" : "",
        hint?.actionType === "flag" ? "mineHint" : "",
        isLastAction ? "lastActionCell" : "",
      ].join(" ")}
      style={{ animationDelay }}
      data-number={cell.isRevealed ? cell.adjacentMines : undefined}
      onClick={onReveal}
      onContextMenu={onFlag}
      title={title}
    >
      {content}
    </button>
  );
}

function BotStatusLight({ active }: { active: boolean }) {
  return (
    <div className={`botStatusLight ${active ? "active" : ""}`} aria-live="polite" aria-label={active ? "Bot activo" : "Bot en espera"}>
      <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
        <defs>
          <radialGradient id="botLampGlow" cx="50%" cy="50%" r="55%">
            <stop className="lampGlowStart" offset="0%" />
            <stop className="lampGlowEnd" offset="100%" />
          </radialGradient>
        </defs>
        <circle className="lampOuter" cx="24" cy="24" r="18" />
        <circle className="lampGlow" cx="24" cy="24" r="13" fill="url(#botLampGlow)" />
        <circle className="lampCore" cx="24" cy="24" r="7">
          {active && <animate attributeName="r" values="7;9;7" dur="1.1s" repeatCount="indefinite" />}
        </circle>
        <path className="lampSpark" d="M24 5 V11 M24 37 V43 M5 24 H11 M37 24 H43" />
      </svg>
      <div>
        <span>{active ? "Bot activo" : "Bot listo"}</span>
        <small>{active ? "calculando jugadas" : "en espera"}</small>
      </div>
    </div>
  );
}

function ProjectCreditsPanel() {
  return (
    <div className="creatorPanel creditsSidebar">
      <h2>CREDITS</h2>
      <p>
        <strong>Autoplay Buscaminas</strong> - MIT (c) 2026 Joseba Collados.
      </p>
      <p>
        Inspirado en <a href="https://autoplay2048.ponyo877.com/" target="_blank" rel="noreferrer">AutoPlay 2048</a> y en el Buscaminas clasico. La version de Microsoft aparecio en Microsoft Entertainment Pack en 1990 y llego a Windows 3.1 en 1992.
      </p>
      <div className="creatorLinks">
        <a href="https://github.com/JosebaCollados" target="_blank" rel="noreferrer">
          <Github size={18} />
          <span>GitHub</span>
        </a>
        <a href="https://www.linkedin.com/in/josebacollados/" target="_blank" rel="noreferrer">
          <Linkedin size={18} />
          <span>LinkedIn</span>
        </a>
      </div>
    </div>
  );
}

function StatsPanel({ board, stats, winRate }: { board: Board; stats: GameStats; winRate: number }) {
  return (
    <div className="panel">
      <h2><Gauge size={17} /> Estadisticas</h2>
      <div className="statGrid">
        <Metric icon={<Sparkles size={15} />} label="Partida" value={board.moves} />
        <Metric icon={<Flag size={15} />} label="Banderas" value={`${board.flagsPlaced}/${board.mineCount}`} />
        <Metric icon={<Trophy size={15} />} label="Sesion" value={`${winRate}%`} />
        <Metric icon={<Bot size={15} />} label="Guess" value={stats.guesses} />
      </div>
      <div className="sessionStats">
        <span>Partidas {stats.games}</span>
        <span>Victorias {stats.wins}</span>
        <span>Derrotas {stats.losses}</span>
        <span>Guess {stats.guesses}</span>
      </div>
    </div>
  );
}

function ReasoningPanel({
  solver,
  lastAction,
  learningModel,
  autoplay,
  solverStatus,
  solverError,
}: {
  solver: SolverResult | null;
  lastAction: SolverAction | null;
  learningModel: LearningModel;
  autoplay: boolean;
  solverStatus: "thinking" | "ready" | "error";
  solverError: string | null;
}) {
  const modelError = learningModel.examples > 0 ? Math.round((learningModel.mistakes / learningModel.examples) * 100) : 0;
  const nextAction = solver?.actions[0] ?? null;
  return (
    <div className="panel">
      <h2><Bot size={17} /> IA</h2>
      {autoplay && (
        <div className="thinkingBadge active">
          <span />
          {solverStatus === "error" ? "Error IA" : solverStatus === "thinking" ? "Calculando" : "Pensando"}
        </div>
      )}
      <p className="solverSummary">
        {solverError ?? (solver ? solver.summary : "Modo manual: las pistas de la IA estan ocultas hasta activar Autoplay.")}
      </p>
      {nextAction && (
        <div className="nextMoveCard">
          <strong>{nextAction.type === "flag" ? "Marcar mina" : "Revelar casilla"}</strong>
          <span>({nextAction.coord.x + 1}, {nextAction.coord.y + 1})</span>
          <small>Confianza {Math.round(nextAction.confidence * 100)}%</small>
        </div>
      )}
      <p className="modelSummary">
        N-Tuple 4x6: {learningModel.examples} ejemplos - error {modelError}%
      </p>
      {lastAction && (
        <p className="lastAction">
          Ultima accion: {lastAction.type === "flag" ? "marcar" : "abrir"} ({lastAction.coord.x + 1}, {lastAction.coord.y + 1}) - {lastAction.reason}
        </p>
      )}
      <div className="actionList">
        {solver?.actions.slice(0, 5).map((action) => (
          <div key={`${action.type}-${keyOf(action.coord)}`} className="actionItem">
            <strong>{action.type === "flag" ? "Mina" : "Segura"}</strong>
            <span>({action.coord.x + 1}, {action.coord.y + 1})</span>
            <small>{Math.round(action.confidence * 100)}%</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowItWorksPanel() {
  return (
    <div className="infoStack">
      <section className="infoNote">
        <h2>COMO FUNCIONA</h2>
        <p>
          La IA modela el tablero como una frontera de restricciones: cada numero visible impone cuantas minas deben existir
          entre sus vecinas ocultas. El solver separa esa frontera en componentes y enumera asignaciones binarias validas;
          riesgo 0% se abre, riesgo 100% se marca.
        </p>
        <p>
          Si no hay certeza, ordena la mejor jugada por probabilidad local exacta o densidad global restante. El modelo N-Tuple
          4x6 ajusta el riesgo con patrones visibles, se entrena online y guarda pesos en localStorage; el calculo del solver
          corre en Web Worker para no bloquear la UI.
        </p>
      </section>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="metric">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}



function formatTime(ms: number) {
  return `${Math.floor(ms / 1000)}s`;
}

function formatClock(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function loadPreferences(): Preferences {
  if (typeof window === "undefined") return defaultPreferences;
  const raw = window.localStorage.getItem(preferencesKey);
  if (!raw) return defaultPreferences;
  try {
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      ...defaultPreferences,
      ...parsed,
      strictAutoplay: false,
      speedMultiplier: parsed.speedMultiplier && [1, 2, 5, 10].includes(parsed.speedMultiplier) ? parsed.speedMultiplier : 1,
    };
  } catch {
    return defaultPreferences;
  }
}

function savePreferences(preferences: Preferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(preferencesKey, JSON.stringify(preferences));
}
