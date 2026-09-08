/**
 * Tic Tac Toe engine — pure, serializable, server-authoritative.
 * Client-safe: no server imports (mirrors the other Darknote engines).
 *
 * State lives in the Game.gameState JSON blob:
 *   v: 1
 *   board: ("X" | "O" | null)[9]        — row-major, index r*3+c
 *   turn: playerNumber (seat) of the player to move
 *   started: boolean (first move also starts the game record)
 *   winner: playerNumber | null
 *   winCells: number[] | null           — the three winning cells (highlight)
 *   over: boolean (terminal: win or draw)
 *   draws: boolean
 */

export const TTT_CELLS = 9;

export const TTT_WIN_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8], // rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8], // columns
  [0, 4, 8],
  [2, 4, 6], // diagonals
];

export interface TicTacToeState {
  v: 1;
  /** X or O per cell; null = empty */
  board: Array<"X" | "O" | null>;
  /** playerNumber whose turn it is */
  turn: number;
  winner: number | null;
  winCells: number[] | null;
  over: boolean;
  draws: boolean;
}

export interface TicTacToeStep {
  state: TicTacToeState;
  /** true if this move ended the game (win/draw) */
  terminal: boolean;
}

export function createTicTacToeState(players: number[]): TicTacToeState {
  return {
    v: 1,
    board: Array(9).fill(null),
    turn: players[0] ?? 1,
    winner: null,
    winCells: null,
    over: false,
    draws: false,
  };
}

/** X/O symbols: seat index 0 -> X, seat index 1 -> O (sorted playerNumbers). */
export function symbolOf(playerNumber: number, players: number[]): "X" | "O" {
  return players.indexOf(playerNumber) === 0 ? "X" : "O";
}

export function legalTicTacToeMoves(state: TicTacToeState): number[] {
  if (state.over) return [];
  const cells: number[] = [];
  for (let i = 0; i < state.board.length; i++) if (!state.board[i]) cells.push(i);
  return cells;
}

/** Detect win for the mark at `cell`; returns {winnerCellLine} or null. */
function winLineAfter(board: Array<"X" | "O" | null>, cell: number): number[] | null {
  const mark = board[cell];
  if (!mark) return null;
  for (const line of TTT_WIN_LINES) {
    if (line.includes(cell) && line.every((c) => board[c] === mark)) return line;
  }
  return null;
}

/**
 * Apply a legal move for `playerNumber` onto `cell`.
 * The caller (server route) must already have validated identity/turn/status.
 * Mutates & returns the state (engine style used across Darknote games).
 */
export function applyTicTacToeMove(state: TicTacToeState, playerNumber: number, cell: number, players: number[]): TicTacToeStep {
  if (state.over || cell < 0 || cell >= TTT_CELLS || state.board[cell] !== null) {
    return { state, terminal: false };
  }
  state.board[cell] = symbolOf(playerNumber, players);

  const line = winLineAfter(state.board, cell);
  if (line) {
    state.winner = playerNumber;
    state.winCells = line;
    state.over = true;
    return { state, terminal: true };
  }

  const empties = legalTicTacToeMoves(state);
  if (empties.length === 0) {
    state.over = true;
    state.draws = true;
    return { state, terminal: true };
  }

  // Advance to the other player.
  const idx = players.indexOf(playerNumber);
  state.turn = players[(idx + 1) % players.length];
  return { state, terminal: false };
}

/** True if placing a wall-like move is impossible -> not used by TTT. */
export function ticTacToeWinnerText(state: TicTacToeState): string | null {
  if (!state.over) return null;
  if (state.draws) return "draw";
  return state.winner != null ? String(state.winner) : null;
}
