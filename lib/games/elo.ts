/**
 * Simple Elo rating used for the leaderboard & statistics.
 * K-factor 32; rating drift is computed purely from real completed games.
 */

const K = 32;

function expected(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

export interface RatingOutcome {
  winner: number;
  loser: number;
}

export interface DrawOutcome {
  a: number;
  b: number;
}

export function ratingAfterWin(winner: number, loser: number): RatingOutcome {
  const ea = expected(winner, loser);
  const eb = expected(loser, winner);
  return {
    winner: Math.round(winner + K * (1 - ea)),
    loser: Math.round(loser + K * (0 - eb)),
  };
}

export function ratingAfterDraw(a: number, b: number): DrawOutcome {
  const ea = expected(a, b);
  const eb = expected(b, a);
  return { a: Math.round(a + K * (0.5 - ea)), b: Math.round(b + K * (0.5 - eb)) };
}
