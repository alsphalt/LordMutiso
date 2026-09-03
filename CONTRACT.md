# DARKNOTE GAMING ARENA — Build Contract

Read this entire file BEFORE writing any code, plus:
- `package.json`, `tsconfig.json` (path alias `@/*` → project root)
- `prisma/schema.prisma` (models & enums)
- `lib/db.ts`, `lib/api.ts`, `lib/constants.ts`, `lib/utils.ts`, `lib/auth-types.ts`
- `lib/auth/session.ts`, `lib/auth/password.ts`, `lib/validation/schemas.ts`, `lib/stats.ts`, `lib/notifications.ts`
- `lib/games/types.ts`, `lib/games/snapshot.ts`, `lib/games/elo.ts`
- `lib/games/ludo/engine.ts`, `lib/games/checkers/engine.ts`, `lib/games/chess/engine.ts`

## Non-negotiables
- TypeScript strict; Next.js 14 App Router; React 18; Tailwind.
- `.env` has ONLY `DATABASE_URL`. NEVER read another env var. NEVER expose DB to client.
- All data in Neon via Prisma. No localStorage/sessionStorage persistence of state.
- Every route handler: server-side auth via `requireUser()` / `getSessionUser()` from `lib/auth/session`; body parse via `readBody`; errors via `ApiError` subclasses or `fail()`; wrap handlers with `handle()` from `lib/api`. Client never sends userId — the server derives it from the session.
- Success JSON always includes `ok: true` (except `ok()` helper does this automatically). Errors: `{ ok:false, error: string }`.
- Client components need `"use client"` at the top. NEVER import server-only modules (`lib/db`, `lib/api`, `lib/auth/*`, `lib/stats.ts`, `lib/notifications.ts`, `@prisma/client`) into client components or pages. `lib/games/types.ts`, `lib/constants.ts`, `lib/utils.ts`, `lib/games/ludo/engine.ts`, `lib/games/checkers/engine.ts` are client-safe.
- Every fetch on the client passes `cache: "no-store"`.
- No third-party realtime/Socket libraries. Polling only.
- Do NOT run `tsc`, `prisma`, or `next build` — the orchestrator integrates and type-checks. Just write clean code.
- Only create files listed in your ownership section below.

## Shared server helpers (already written — use them)
- `ok(data)` / `fail(msg, status)` / `handle(handler)` / `readBody(req)` / `ApiError` + factories `badRequest|unauthorized|forbidden|notFound|conflict|tooMany` / `zodMessage(e)`.
- `requireUser()` → `AuthUser` or throws 401. `getSessionUser()` for optional auth.
- `buildGameSnapshot(gameId, viewerId)` → full `GameSnapshot` (throws 403/404 as appropriate).
- `ensureUserStats`, `applyFinishedStats(tx, {participantIds, winnerId, gameType})`.
- `notifyAll(items, tx?)` (types: `INVITATION|PLAYER_JOINED|GAME_STARTED|YOUR_TURN|GAME_ENDED|REMATCH|CHAT|SYSTEM`).
- Engines: see the type-safe public API below.
- `sanitizeText(msg, max)`, `randomRoomCode(alphabet, len)`, `winRatePercent`, `timeAgo`, `fmtDate` etc. in `lib/utils.ts`.
- `GAME_TYPES` meta & `avatarFor(username)` in `lib/constants.ts`; `COLOR_HEX`/`COLOR_LABEL`/`colorForSeat` in `lib/games/types.ts`.

## TypeScript JSON note
Prisma `Json` fields arrive as `Prisma.JsonValue`. Treat game state with:
```ts
const state = (game.gameState ?? {}) as unknown as Record<string, unknown>;
```
Engine state objects must be persisted with `JSON.parse(JSON.stringify(state))` (prisma accepts plain objects).

---

## 1) HTTP API — Agent A implements all of these

### Auth
| Method/Path | Auth | Body | Response |
|---|---|---|---|
| POST `/api/auth/register` | no | `{username,email,password}` | `{user: PublicUser}` + session cookie. 409 on dup username/email. |
| POST `/api/auth/login` | no | `{identifier,password}` (identifier = email OR username) | `{user}` + cookie. 401 bad creds. |
| POST `/api/auth/logout` | yes | — | `{ok:true}` |
| GET `/api/auth/me` | no | — | `{user: PublicUser \| null}` (200 always) |

`PublicUser = {id, username, email, image, createdAt}` (createdAt ISO string).
Register/login must call `ensureUserStats(userId)` after user creation, and use `createSession(userId)`.

### Rooms
| Method/Path | Auth | Body/Query | Response |
|---|---|---|---|
| GET `/api/rooms?type=LUDO\|CHESS\|CHECKERS` | yes | type optional; WAITING rooms of that type (all types when omitted), newest first, cap 50 | `{rooms: RoomRow[]}` |
| POST `/api/rooms` | yes | `{type}` | `{room: RoomRow}` (creator seat 1, game WAITING, room code 6 chars from `ROOM_CODE_ALPHABET`, must be unique — retry loop) |
| POST `/api/rooms/join` | yes | `{roomCode}` | `{room}` — errors: not found / already in game (seat exists) / room full / not WAITING |
| POST `/api/rooms/[id]/start` | yes (creator) | — | `{ok:true, gameId}`; needs ≥2 seats & WAITING; initializes engine state, sets `startedAt`, `currentTurn`, status PLAYING; notifies players. |
| POST `/api/rooms/[id]/leave` | yes (member) | — | `{ok:true}`; only while WAITING. Removes seat; delete game+room when empty; notify remaining players. |

`RoomRow = { id, gameId, roomCode, type: GameTypeName, status: GameStatusName, maxPlayers, players: {userId,username,image,playerNumber,color}[] , createdAt }`.

### My games
GET `/api/games/mine` (auth) → `{games: MyGameRow[]}` where viewer is a player & status WAITING/PLAYING. `MyGameRow = {id, type, status, roomCode, createdAt, seats: string[]}` (seats = usernames). Newest first.

### Game snapshot & actions
| Method/Path | Auth | Response |
|---|---|---|
| GET `/api/games/[id]` | player or creator | `{snapshot: GameSnapshot}` (via `buildGameSnapshot`) |
| POST `/api/games/[id]/action` | player or creator | body `{action, token?, from?, to?, promotion?}` (see below) → `{snapshot}` for all actions; `{snapshot, newGameId}` for rematch |

Action semantics (validate strictly server-side; throw `badRequest/forbidden` on any violation):
- `start` — creator only, WAITING, ≥2 seats → same as room start above; returns snapshot.
- `roll` — LUDO only, PLAYING, my turn. Server generates die via `crypto.randomInt(1,7)`, calls engine. Persist state. If game.status becomes over handle end.
- `move` — by type:
  - LUDO: body `{token}` → `moveLudoToken`. MoveRecord = `{kind:'ludo-move', token, fromR, toR, capture, die, playerNumber, extraRoll}`.
  - CHESS: body `{from,to,promotion?}` → `stepChess(state,{from,to,promotion},Date.now())`. MoveRecord = `{kind:'chess-move', from, to, san, playerNumber}`. Reject when not mover's turn (chess turn seat must equal my seat).
  - CHECKERS: body `{from,to}` → `stepCheckers`. MoveRecord = `{kind:'checkers-move', from, to, capture, captureIdx, crowned, playerNumber}`.
- `resign` — PLAYING only; engine `resignLudo/resignChess/resignCheckers`; finish game (winner = opponent / last standing). MoveRecord = `{kind:'resign', playerNumber}` (only for ludo? Record resign as a move for all types for history). Notify.
- `rematch` — status FINISHED/DRAW only, seats ≥ 2 (all original seats still there). Create NEW game: same type, status PLAYING, same players/colors/seats (playerNumber preserved), fresh engine state, `startedAt`, `currentTurn=1`; notify `REMATCH`; respond `{snapshot, newGameId}` of the NEW game.
- `leave` — WAITING only, member → same as room leave above. Errors if PLAYING (must resign instead).

**Move persistence**: within the SAME transaction that updates the game, insert `gameMove` with `moveNumber = (count of moves for the game)+1`, `playerId` = the acting GamePlayer row id, `moveData` = MoveRecord JSON. On unique-constraint race → 409 "Please retry".

**Finish flow (single place, shared `lib/server/finish.ts` owned by Agent A)**: `finishGame(tx, gameId, { winnerId: string|null, status: 'FINISHED'|'DRAW'|'CANCELLED' })`:
1. Atomic guard: `updateMany({where:{id, status:{in:['WAITING','PLAYING']}}, data:{status, winnerId, endedAt:new Date(), currentTurn:null}})`; if count===0 → abort (already ended).
2. If status is FINISHED or DRAW and game had started (startedAt != null) → `applyFinishedStats(tx, {participantIds, winnerId, gameType})` (all seat user ids).
3. `notifyAll` GAME_ENDED to every seat (title e.g. `Game finished`, body describes result).
Return whether transition happened.

### Chat
| Method/Path | Auth | Body/Query | Response |
|---|---|---|---|
| GET `/api/chat?before=<ISO>&limit=30` | yes | before optional cursor (ISO createdAt of oldest seen); limit ≤ 100. gameId=null messages only | `{messages: ChatMsg[], nextCursor: string\|null}` — order **newest first**, page size = limit+1 to compute nextCursor (createdAt of last kept item). |
| POST `/api/chat` | yes | `{message}` | `{message: ChatMsg}`. Validate `chatMessageSchema` + `sanitizeText`. Rate limit: reject 429 if the sender has any global message newer than 4s (`CHAT_RATE_WINDOW_MS`). |
| DELETE `/api/chat/[id]` | owner | — | `{ok:true}` (403 otherwise) |
| GET `/api/games/[id]/chat?before=` | member/creator | same pagination, gameId = game | `{messages, nextCursor}` |
| POST `/api/games/[id]/chat` | member/creator | `{message}` | `{message}` + rate limit per game |

`ChatMsg = {id, senderId, username, image, message, createdAt}`.
Message flow: sanitize via `sanitizeText(msg, CHAT_MAX_LENGTH)`; zod min 1 after trim.

### Leaderboard / History / Users / Notifications / presence
- GET `/api/leaderboard?game=OVERALL|LUDO|CHESS|CHECKERS` (auth optional? make auth optional — public) → `{rows: LeaderRow[]}` limit 100 sorted by `rating` desc, then gamesWon desc. `LeaderRow = {userId, username, image, rating, gamesPlayed, gamesWon, gamesLost, draws, ludoWins, chessWins, checkersWins}`. Wins for game filter columns exist anyway; rank computed client-side.
- GET `/api/history?before=&game=` (auth) → viewer's games (seats include viewer), newest first, statuses all, paginated like chat, limit 30. `HistoryRow = {id, type, status, roomCode, result: 'win'|'loss'|'draw'|null, winnerId, winnerUsername: string|null, opponentNames: string[], createdAt, startedAt, endedAt, durationMs}`.
- GET `/api/users/[username]` (public) → `{user: {id, username, image, createdAt}, stats: {gamesPlayed,gamesWon,gamesLost,draws,rating,ludoWins,chessWins,checkersWins}|null, recent: HistoryRow[] (limit 8, viewer=that user), isSelf: boolean}`. 404 unknown.
- PATCH `/api/profile` (auth) `{username?, image?, currentPassword?, newPassword?}` → `{user}`. Validate `profileSchema`; uniqueness conflict 409; verify currentPassword with `verifyPassword` when changing password; rehash with `hashPassword`. When username changes check conflicts.
- GET `/api/notifications` (auth) → `{items: NotificationRow[], unread: number}` limit 30 newest first. `NotificationRow={id,type,title,body,gameId,read,createdAt}`.
- POST `/api/notifications/read` (auth) `{ids?: string[]}` (absent = mark all) → `{ok:true}`.
- POST `/api/heartbeat` (auth) → updates `user.lastSeen = new Date()` → `{ok:true}`.
- GET `/api/online` (auth) → `{count, users: {username, image}[]}` — users with lastSeen within `ONLINE_WINDOW_MS`, cap 25, online desc.

### Engine API quick reference (Agent A)
- Ludo: `createLudoState(players:number[])`; `rollLudo(state, die)` → `{die, legal: LudoMove[], autoPassed}`; `legalLudoMoves(state)`; `moveLudoToken(state, tokenIndex)` → `{result:{done,winner,reason}, move, captured, extraRoll}`; `resignLudo(state, player)` → result; `activePlayers(state)`; state fields `tokens{playerNumber:[r,r,r,r]}, turn, die, phase, players, done, resigned`.
- Checkers: `createCheckersState()`; `legalCheckersMoves(state)`; `checkersMovesFor(state, side)`; `stepCheckers(state, from, to)` → `{result:{done,winner,draw}, move, chainContinues}`; `resignCheckers(state, player:1|2)`.
- Chess: `createChessState(clockMs, nowMs)`; `chessTurnSeat(fen)`; `stepChess(state,{from,to,promotion?}, nowMs)` → `{result:{done,winner,draw}, san, fen}` (throws on illegal move); `resignChess(state, player)`.
- Game loop sanity: on PLAYING actions reload the game row fresh inside the transaction; engine functions mutate the state object — build `nextState = JSON.parse(JSON.stringify(stateObj))`, run engine, persist `gameState: nextState` (already plain JSON), plus `currentTurn` column updates:
  - LUDO: after a move without extraRoll (or auto-pass), currentTurn = state.turn. Also update after roll when autoPassed.
  - CHESS: currentTurn = `chessTurnSeat(state.fen)` when not over.
  - CHECKERS: currentTurn = state.turn.
- When engine result `done` is true → call finish flow inside the same transaction (winner may be null + draw flag). Move rows that are part of the final move must still be stored before/inside the same txn.

### Auth pages flows (Agent B)
Login/Register forms call the auth APIs; on success `router.replace("/")`; on error show toast + inline message. Logout from user menu: POST logout → clear local state → `router.replace("/login")`.

---

## 2) UI system (Agent B owns files listed under B)

### Theme tokens (globals.css) — build once, reuse everywhere
Dark gaming: page bg `bg-arena-gradient` on `#07030f`; panels = glass (see below); primary gradient `from-violet-500 to-indigo-500`; accent cyan `#22d3ee`; text `slate-100/70`; headings white. Utilities in `@layer utilities`: `.glass { @apply bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl; }` `.glass-strong`, `.text-gradient {background: linear-gradient(90deg,#a78bfa,#22d3ee); -webkit-background-clip:text; color:transparent;}`. Nice scrollbars, `overscroll-none`, `-webkit-tap-highlight-color: transparent`. Buttons focus-visible rings. Mobile: no horizontal overflow (`overflow-x-hidden` on body/main containers); interactive targets ≥ 44px.

### Component APIs (all under `components/`, all `"use client"` where they use hooks)
Files & exported names are contract — other agents import these EXACT names:
- `components/ui/button.tsx` → `Button({variant='primary'|'secondary'|'outline'|'ghost'|'danger'|'success', size='md'|'xs'|'sm'|'lg', loading, full, className, children, ...rest})`; renders `<button>`; `loading` shows spinner & disables.
- `components/ui/card.tsx` → `Card({className, children, glow?})`.
- `components/ui/input.tsx` → `Input`, `Textarea`, `Field({label, error?, hint?, children})`.
- `components/ui/badge.tsx` → `Badge({tone:'purple'|'cyan'|'green'|'rose'|'amber'|'slate', children, className?})`.
- `components/ui/avatar.tsx` → `Avatar({username, src?, size?=36, className?})`.
- `components/ui/modal.tsx` → `Modal({open, onClose, title?, children, footer?})`.
- `components/ui/toast.tsx` → `ToastProvider({children})` + `useToast()` returning `{push({title?, message, tone?:'success'|'error'|'info'})}`.
- `components/ui/spinner.tsx` → `Spinner({size?=18, className?})`.
- `components/ui/empty.tsx` → `EmptyState({icon?, title, message?, action?})`.
- `components/ui/stat.tsx` → `Stat({label, value, accent?})`.
- `components/ui/logo.tsx` → `Logo({size?='md', className?})`.
- `components/ui/tabs.tsx` → `Tabs<T extends string>({tabs: {id:T; label:string}[], value, onChange, className?})`.
- `components/ui/skeleton.tsx` → `Skeleton({className})`.
- `components/ui/copy-button.tsx` → `CopyButton({text, label?='Copy'})` (toast feedback).
- `components/chat/chat-widget.tsx` → `ChatWidget({gameId?: string|null, compact?, className?, maxHeight?})`. gameId null/undefined = GLOBAL chat. Handles: message list w/ avatar+username+time, auto-scroll to bottom on new, "load older" button (pagination), quick-emoji row (😀😂🔥🎉👍🎲♟️), composer with disabled-while-sending, DELETE own messages (hover/长按? show small × for own on desktop; keep simple: own messages show trash icon), errors via toast, empty state "No messages yet". Polls every 3s (only when document.visible). Rate-limit 429 → toast warning.
- `components/providers/auth-provider.tsx` → `AuthProvider` (fetch `/api/auth/me` on mount), context `useAuth()` from `hooks/use-auth.ts` returns `{user: AuthUser|null, loading, refresh, logout}`.
- `hooks/use-auth.ts` → types + `useAuth()` consuming the provider context.
- `hooks/api.ts` → `api<T>(path, init?)` fetch helper: JSON headers, `cache:'no-store'`, parses json, throws `ApiClientError(message, status)` on `!ok`. Also `useApiPoll<T>(path, intervalMs, {enabled})` hook → `{data, error, loading, refresh}` (cleanup on unmount, refetch on window focus optional).
- `hooks/use-countdown.ts` → `useCountdown(targetMs: number|null, tick=1000)` → remaining ms (client clock based).
- `components/layout/app-shell.tsx` → `AppShell({children})`: top navbar (logo → `/`, links Lobby `/lobby`, Chat `/chat`, Leaderboard `/leaderboard`, History `/history`), right side: online pill (poll `/api/online` 15s → "🟢 12 online"), notification bell + popover (poll `/api/notifications` 12s; mark-all-read on open; rows link to game when gameId), avatar menu (Profile `/u/{username}`, Settings `/settings`, Logout). Mobile: fixed bottom nav (Home, Lobby, Chat, Profile) + bell in top bar; content padded bottom. On paths starting `/play/` render NO chrome (game pages are full-bleed; they supply their own header/back).
- `components/layout/auth-gate.tsx`? Not needed—server layout handles redirect (below).
- `components/leaderboard/leaderboard-table.tsx` → table component fed rows.
- `components/lobby/room-list.tsx`, `components/lobby/join-dialog.tsx`, `components/lobby/create-dialog.tsx` → lobby building blocks.
- `components/games/game-card.tsx` → `GameCard({type: GameTypeName, onPlay})` big premium card used on home + lobby.
- `components/home/*` optional small sections home page.

### Pages Agent B creates
- `app/layout.tsx` (root, server): metadata title "DARKNOTE GAMING ARENA"; `<html lang="en" class="dark">`; `<body class="bg-arena-950 text-slate-100 font-sans">`; wraps `<AuthProvider><ToastProvider>{children}</ToastProvider></AuthProvider>`; import globals.
- `app/globals.css`
- `app/page.tsx` = HOME (client component using useAuth): logged out → hero (logo, tagline, game feature cards, CTA buttons to /login & /register, small leaderboard/online teaser optional). Logged in → DASHBOARD: greeting + stats strip (from `/api/auth/me` + quick leaderboard row? Use `/api/users/[username]`? Simpler: fetch `/api/online`, `/api/games/mine`, `/api/leaderboard?game=OVERALL&limit=5`): sections — "Play" 3 GameCards (PLAY NOW → `/lobby?type=X`), "Your matches" (resume buttons to `/play/[id]`), "Live arena" online users, "Global chat" preview (`ChatWidget` maxHeight 320), mini leaderboard top 5.
- `app/login/page.tsx`, `app/register/page.tsx` (centered, glass card, link between; register validates pw ≥ 8; loading/error states).
- `app/(app)/layout.tsx` (server): `getSessionUser()` → if null `redirect("/login")`; returns `<AppShell>{children}</AppShell>` inside `<main class="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:pb-10">`.
- `app/(app)/lobby/page.tsx` — reads `?type` via `useSearchParams`, Tabs LUDO/CHESS/CHECKERS, Join-by-code input (uppercase) & Create button (per active type), room list poll 4s (`/api/rooms?type=`), each room card: emoji, type, status badge, `x / max` players with colored dots + usernames, JOIN button (disabled when full/playing) → `POST /api/rooms/join` → `router.push('/play/'+room.gameId)`; create → same push. Empty state. ALSO "Your matches" section above (from `/api/games/mine`).
- `app/(app)/chat/page.tsx` — full global chat page (`ChatWidget` height ~ calc(100vh-160px)).
- `app/(app)/leaderboard/page.tsx` — Tabs Overall/Ludo/Chess/Checkers → fetch `/api/leaderboard?game=`; table: rank medal (🥇🥈🥉), avatar+username (link to `/u/username`), rating, GP, W, L, D, win rate (client `winRatePercent`). Highlight my row.
- `app/(app)/history/page.tsx` — filter by type optional; list rows: emoji+type, result badge, opponent names, date (`fmtDate`/`timeAgo`), duration (`fmtDurationMs`), "View" → `/play/[id]`.
- `app/(app)/settings/page.tsx` — profile form (username, avatar URL with live preview via `Avatar`, optional new password + current), PATCH `/api/profile`, toasts.
- `app/(app)/u/[username]/page.tsx` — server component fetching `/api/users/[username]` (public) → profile header (Avatar, username, joined date), stat grid (rating, played, W/L/D, winrate), per-game wins chips (Ludo/Chess/Checkers), recent games list. Not found state. Server component can fetch API route? Better: mark `export const dynamic='force-dynamic'` and call the API via fetch to self (works in dev & vercel). Use relative URL `process.env.VERCEL_URL`? Avoid env: use internal prisma query directly in server component? Cleanest: server comp queries prisma directly (lib/db ok in RSC) replicating /api/users logic? Duplication… Instead make page a CLIENT component fetching `/api/users/[username]` (public). Simpler & consistent. Yes client.
- `app/dashboard/page.tsx` → server `redirect('/')`.
- `app/not-found.tsx` (dark themed 404 → back home).
- `public/` favicon optional (skip) — inline `<Logo/>`.

Agent B also creates `app/(app)/play/[gameId]/page.tsx`? NO — Agent C owns it. B's shell just hides chrome on `/play/*`.

---

## 3) Play experience (Agent C owns files below)

- `app/(app)/play/[gameId]/page.tsx` — client page: read param, render `<GameShell gameId={id} />`.
- `hooks/use-game.ts` (client): polls `GET /api/games/[id]` every 1500ms (pause when tab hidden & when action in flight), exposes `{snapshot, error, loading, refresh, act(actionBody)}`. `act`: POST to `/api/games/[id]/action`, on `{newGameId}` → `router.push('/play/'+newGameId)`; on error throws message. Also calls heartbeat every 30s (browser events optional).
- `components/games/game-shell.tsx`: layout per type: WAITING lobby view (room code big + CopyButton, seat list with colors/avatars, "Waiting for players…", leave button, Start button when `snapshot.canStart`, chat on the side) → PLAYING/FINISHED view: header (back to lobby, type, room code, status badge, turn indicator, resign button when playing), board component by type, right column (desktop) players + move history; below board on mobile: players → ChatWidget (`gameId`) → history. FINISHED overlay/banner with result + winner + Rematch button (calls act({action:'rematch'})); DRAW shows draw.
  - Board state per type comes from `snapshot.state` (cast per engine).
  - Client-side local legality hints only — all moves validated server-side; on 400 show toast error & `refresh()`.
- `components/games/ludo-board.tsx`: cross board (SVG or divs) — 4 colored quadrants (RED top-left, YELLOW top-right, GREEN bottom-right? standard: colors at corners), 52 track cells around + 4×6 home columns + center. Use engine helpers `ludoAbsCell`, `ludoColorForSeat`, `legalLudoMoves`, `LUDO_TRACK` etc. Track squares clickable? Interaction: "Roll" button (disabled unless my turn & phase ROLL): act({action:'roll'}) → snapshot.state.die set & legal computed server side. Then highlight legal tokens (compute locally `legalLudoMoves` on snapshot.state) — tap token → act({action:'move', token}). Dice shown big center (1-6 pips). Tokens = circles with seat color & white border; FINISHED tokens in center. Turn arrow text. Responsive: board scales via aspect-square & CSS grid `min(92vw, 560px)`.
- `components/games/chess-board.tsx`: 8×8 grid, FEN from state, unicode glyphs or SVG; click own piece → legal targets via chess.js client `Chess(fen).moves({square,verbose})`; highlight target dots + capture rings; on target click: promotion case (pawn last rank) → small modal picker ♛♜♝♞ → act({action:'move', from, to, promotion}). Show check highlight (engine `chessInCheck` not exported client? use client chess.js `inCheck()`), last-move highlight from state.sans? Simple: highlight last move squares parsed from SAN if possible else skip. Clocks: two clock chips top/bottom using `state.wMs/bMs/lastTickMs` + `useCountdown` local. Board orientation: white seat at bottom (flip if I'm black) — implement `orientation` = my seat 2 ? flip rank order.
- `components/games/checkers-board.tsx`: 8×8 checkerboard (dark squares interactive); pieces = circles (white man plain, king with 👑 or star; black rose/red). Click own piece → highlights via `checkersMovesFor`/`legalCheckersMoves` client engine on snapshot.state (cast board array). Multi-capture chains honored (state.chain). act({action:'move', from, to}).
- `components/games/move-history.tsx`: numbered list of recentMoves (type label: SAN for chess from moveData.san; ludo "🎲 4 • token 2 → 12"; checkers "12 → 27 ✕") — display only, scroll area.
- `components/games/players-panel.tsx` (optional fold into shell).

**Reconnection**: page always fetches fresh snapshot from Neon on mount — recovery is inherent. If `snapshot.game.status==='CANCELLED'` show notice & link to lobby.

---

## File ownership map (avoid touching others' files)
- Agent A: `app/api/**` + `lib/server/**` (own helpers, e.g. `lib/server/finish.ts`, room helpers).
- Agent B: everything under `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `app/not-found.tsx`, `app/login`, `app/register`, `app/dashboard`, `app/(app)/layout.tsx`, `app/(app)/lobby`, `app/(app)/chat`, `app/(app)/leaderboard`, `app/(app)/history`, `app/(app)/settings`, `app/(app)/u/**`, `components/ui/**`, `components/layout/**`, `components/chat/**`, `components/leaderboard/**`, `components/lobby/**`, `components/home/**`, `components/games/game-card.tsx`, `components/providers/**`, `hooks/api.ts`, `hooks/use-auth.ts`, `hooks/use-poll.ts`(name: provide useApiPoll here), `hooks/use-countdown.ts`.
- Agent C: `app/(app)/play/**`, `hooks/use-game.ts`, `components/games/game-shell.tsx`, `ludo-board.tsx`, `chess-board.tsx`, `checkers-board.tsx`, `move-history.tsx`, `players-panel.tsx` (anything else under `components/games/` needed by gameplay, except `game-card.tsx`).

Do NOT create README files or extra config files.
