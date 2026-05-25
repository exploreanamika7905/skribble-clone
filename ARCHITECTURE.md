# Architecture Overview — Skribbl Clone

This document explains how every part of the system fits together: the data flow, the classes, the socket events, and the key design decisions. Read this before a code walkthrough or demo.

---

## 1. Bird's-eye View

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BROWSER (React)                            │
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐   │
│  │  GameContext  │   │CanvasContext │   │     React Pages      │   │
│  │  (global     │   │(canvas state,│   │  HomePage (join/     │   │
│  │   game state,│   │ drawing fns, │   │  create room)        │   │
│  │   socket ref)│   │ undo history)│   │  LobbyPage (wait)    │   │
│  └──────┬───────┘   └──────────────┘   │  GamePage (play)     │   │
│         │                              └──────────────────────┘   │
│         │  Socket.IO client                                        │
└─────────┼────────────────────────────────────────────────────────-─┘
          │  WebSocket (persistent TCP connection)
          │
┌─────────┼───────────────────────────────────────────────────────────┐
│         │          NODE.JS SERVER (Express + Socket.IO)             │
│         │                                                           │
│  ┌──────▼──────────────────────────────────────────────────────┐   │
│  │                    rooms: Map<roomId, Room>                  │   │
│  │                                                             │   │
│  │   ┌─────────────────────────────────────────────────────┐  │   │
│  │   │  Room (one per active game)                          │  │   │
│  │   │  ├── roomId, hostId, settings                        │  │   │
│  │   │  ├── timer (setInterval / setTimeout handle)         │  │   │
│  │   │  └── game: Game ──────────────────────────────────┐  │  │   │
│  │   │                                                   │  │  │   │
│  │   │           Game                                    │  │  │   │
│  │   │           ├── playersList: Player[]               │  │  │   │
│  │   │           ├── currentWord, currentRound           │  │  │   │
│  │   │           ├── time, totalTime, totalRounds        │  │  │   │
│  │   │           └── drawer, isStarted, isHintSent       │  │  │   │
│  │   └───────────────────────────────────────────────────┘  │  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | **React 18 + Vite** | Component model fits the UI well; Vite is fast for dev |
| Canvas | **HTML5 Canvas API** | Native browser API, no extra library needed |
| Styling | **SCSS** | Nested rules make component styles readable |
| Backend | **Node.js + Express** | Lightweight; same language as frontend |
| Real-time | **Socket.IO 4** | Handles WebSocket + fallback, rooms built-in |
| OOP | **ES6 Classes** | `Game`, `Player`, `Room` encapsulate all server-side logic |

---

## 3. Project Structure

```
skribbl-clone/
│
├── server/                        ← Node.js backend
│   ├── index.js                   ← Express server + all Socket.IO event handlers
│   └── config/
│       ├── game.js                ← Game class  (rounds, scoring, hints, word logic)
│       ├── player.js              ← Player class (id, username, avatar, score, state)
│       ├── room.js                ← Room class  (wraps Game, holds settings + timer)
│       └── words.js               ← Flat array of ~100 drawable words
│
└── client/                        ← React + Vite frontend
    └── src/
        ├── main.jsx               ← Entry point; wraps App in context providers
        ├── App.jsx                ← Top-level router (HomePage / LobbyPage / GamePage)
        │
        ├── contexts/
        │   ├── GameContext.jsx    ← Global state: socket, room, game, players
        │   └── CanvasContext.jsx  ← Canvas ref, drawing helpers, undo history
        │
        ├── pages/
        │   ├── HomePage/          ← Enter name, pick avatar, create or join room
        │   ├── LobbyPage/         ← Room code, player list, host starts game
        │   └── GamePage/          ← Registers all socket listeners; renders the game
        │
        ├── components/
        │   ├── Canvas/            ← HTML5 <canvas>; captures mouse events
        │   ├── Palette/           ← Color grid, brush size, Eraser, Undo, Clear
        │   ├── Chat/              ← Message list + guess input
        │   ├── Word/              ← Blank/hint display + round counter
        │   ├── Clock/             ← Countdown timer
        │   ├── Modal/             ← Overlays: waiting, word choice, turn scores, game over
        │   ├── PlayerList/        ← Ordered list of players with score + avatar
        │   └── Player/            ← Single player row (avatar, name, score, status icons)
        │
        └── data/
            ├── colors.js          ← Array of {id, value} color objects for the palette
            └── avatar.js          ← Arrays of avataaars style names (hair, eyes, etc.)
```

---

## 4. Application State Machine

The three "screens" are driven entirely by three booleans in `GameContext`:

```
isLoggedIn = false
      │
      │  (emit create_room or join_room)
      │  (server responds room_created / room_joined)
      ▼
isLoggedIn = true, isInLobby = true, isGameStarted = false
      │
      │  (host emits start_game)
      │  (server broadcasts game_started)
      ▼
isLoggedIn = true, isInLobby = true, isGameStarted = true
  → App renders <GamePage />
      │
      │  (socket disconnects / reset() called)
      ▼
Back to initial state
```

`App.jsx` reads these three booleans and renders the correct page — no router library needed.

---

## 5. Room System

### Why rooms?

Without rooms, every player globally shares one game. Rooms allow multiple independent games to run concurrently on the same server.

### How it works

1. **Creating a room**: The host emits `create_room` with their username, avatar, and settings (rounds, draw time, max players). The server generates a unique 6-character alphanumeric code (e.g. `A3K9ZB`), instantiates a `Room` object, stores it in `rooms: Map<roomId, Room>`, and socket.io's built-in `.join(roomId)` is called so that room-scoped broadcasts work.

2. **Joining a room**: A player emits `join_room` with the code. The server looks it up in the `Map`, validates (not full, not started), adds the player, and calls `socket.join(roomId)`.

3. **Scoped broadcasts**: All subsequent `io.to(roomId).emit(...)` calls go **only** to sockets in that room, not the whole server.

4. **Starting the game**: Only the host (validated by `socket.id === room.hostId`) can emit `start_game`. Once started, `game.isStarted = true` prevents new players from joining mid-game.

5. **Cleanup**: When all players leave a room, `rooms.delete(roomId)` frees the memory.

```
rooms (Map)
 ├── "A3K9ZB" → Room { hostId, settings, game, timer }
 ├── "X7P2MN" → Room { hostId, settings, game, timer }
 └── ...
```

### Room class responsibilities

```js
class Room {
  roomId       // 6-char code shown to players
  hostId       // socket.id of the host (only they can start)
  settings     // { maxPlayers, rounds, drawTime, wordCount }
  game         // Game instance (all game logic lives here)
  timer        // holds the setInterval / setTimeout reference
}
```

---

## 6. Server-Side Game Logic (OOP)

### Player class

```
Player
 ├── id          (socket.id — unique per connection)
 ├── username
 ├── avatar      (object with top/eye/mouth/clothe style names)
 ├── score
 ├── isDrawing   (true only for the current drawer)
 ├── isChoosing  (true when waiting for drawer to pick a word)
 ├── hasGuessed  (true once they guessed correctly this turn)
 └── isDone      (true once they've had their drawing turn this round)
```

### Game class — key methods

| Method | What it does |
|---|---|
| `chooseNextPlayer()` | Picks a random player from those who haven't drawn yet (`!isDone`). Marks them `isChoosing = true`. If everyone has drawn, increments the round first. |
| `chooseThreeWords()` | Shuffles the word list and returns the first 3 as word choices. |
| `getWordToGuess()` | Converts the current word to an array of `_` and spaces, e.g. `"hot dog"` → `['_','_','_',' ','_','_','_']` |
| `getHint()` | At half-time, picks `floor(wordLength / 2)` random letter indices to reveal. Returns `[{randomIndex, correspondingLetter}, ...]` |
| `hasEveryoneGuessed()` | Returns true when all `playersList.length` players have `hasGuessed = true`. |
| `resetPlayerState()` | At end of turn: clears `isDrawing`, `isChoosing`, `hasGuessed` for all players. |
| `reset()` | Full game reset (after game over): resets scores, rounds, `isStarted`. |

### Turn lifecycle (server)

```
startNextTurn(roomId)
    │
    ├─ emit "clear_canvas"     → all clients wipe their canvas
    ├─ emit "results_done"     → clients hide the score overlay
    ├─ game.chooseNextPlayer() → one player gets isChoosing = true
    └─ emit "update_players_state"
           │
           (client sees isChoosing = true for their player)
           │
           └─ client emits "give_words"
                  │
                  └─ server emits "receive_words" (3 choices)
                         │
                         (drawer picks one)
                         │
                         └─ client emits "send_choice"
                                │
                                ├─ game.currentWord = choice
                                ├─ drawer.isDrawing = true
                                ├─ emit "start_turn" to all
                                └─ startTimer(roomId)
                                       │
                                       ├─ emit "time" every second
                                       ├─ emit "hint" at half-time
                                       └─ endTurn() when time = 0
                                              │
                                              ├─ score the drawer
                                              └─ emit "turn_over" or "game_over"
```

---

## 7. Real-Time Drawing — How Strokes Are Synced

This is the most technically interesting part and a common interview question.

### The problem

The drawer moves their mouse. Every other player must see the same stroke in real time. A stroke = a series of (x, y) points drawn as a continuous path.

### The solution: three-phase stroke protocol

```
DRAWER's browser                 SERVER              OTHER PLAYERS' browsers
──────────────────               ──────              ──────────────────────────
mousedown
  → emit "start_drawing"         relay               ← "client_start_drawing"
    {x, y, color, size}          to room               beginPath(), moveTo(x,y)

mousemove (while held)
  → emit "draw"                  relay               ← "client_draw"
    {x, y}                       to room               lineTo(x,y), stroke()

mouseup
  → emit "finish_drawing"        relay               ← "client_finish_drawing"
                                 to room               closePath(), saveSnapshot()
```

**Why throttle mousemove?** Raw `mousemove` fires ~60 times/sec. We only emit when the cursor has moved more than `brushSize + 5` pixels since the last emitted point. This reduces network traffic by ~10x without visible quality loss.

**Color and size**: Sent only once at stroke start (`start_drawing`). All subsequent `draw` events in the same stroke inherit those values from the canvas context.

### Undo

Every time `finishDrawing()` is called (both by the drawer and by viewers on `client_finish_drawing`), the entire canvas pixel data is snapshot with `ctx.getImageData()` and pushed onto a `strokeHistory` array in `CanvasContext`.

```
strokeHistory = [ImageData1, ImageData2, ImageData3]
                                                  ↑ latest

On undo:
  pop last → restore previous: ctx.putImageData(strokeHistory[-1])
```

When the drawer clicks Undo:
1. `undoCanvas()` — restores their own canvas from the snapshot stack
2. `socket.emit("undo_stroke")` — server broadcasts to all others in the room
3. Viewers also call `undoCanvas()` — restoring their own snapshot stacks

### Eraser

The eraser is not a separate Canvas compositing mode — it draws with white (`#FFFFFF`). Since the canvas background is white, this visually erases. The brush size is multiplied by 2.5× for a comfortable eraser feel.

---

## 8. Scoring System

Points are awarded when a player guesses correctly:

```
points = (number of players who have NOT yet guessed) × 10 + 10
```

This rewards **speed**: if you're the first to guess (all others haven't guessed yet), you get the maximum points. The last person to guess still gets 10 points.

The **drawer** earns bonus points at the end of a turn:

```
drawer bonus = (number of players who guessed correctly) × 10
```

If nobody guessed, the drawer gets 0 bonus.

After each turn, all players see a score overlay (the `Modal` component's `isTurnOver` state). After 3 seconds the game auto-continues.

---

## 9. Hint System

At the halfway point of the timer, the server reveals some letters:

1. `getHint()` picks `floor(wordLength / 2)` random unique letter indices.
2. Those letters are inserted into the `wordToGuess` array (which otherwise contains `_`).
3. The updated array is sent to all clients via the `hint` event.
4. `isHintSent = true` prevents the hint from firing again in the same turn.

Example: word = `"umbrella"` (8 letters) → reveals 4 random letters → `['_', 'm', '_', '_', 'e', 'l', '_', 'a']`.

The drawer sees the actual word (`correctWord` is set on their client when they choose it). Non-drawers see the blanks/hints via `wordToGuess`.

---

## 10. WebSocket Event Reference

### Room & Lobby

| Event | Who emits | Payload | What happens |
|---|---|---|---|
| `create_room` | Client → Server | `{username, avatar, settings}` | Server creates Room, responds with `room_created` |
| `join_room` | Client → Server | `{roomId, username, avatar}` | Server adds player, responds with `room_joined` |
| `room_created` | Server → Client | `{roomId, players, settings, hostId}` | Client enters lobby as host |
| `room_joined` | Server → Client | `{roomId, players, settings, hostId}` | Client enters lobby as guest |
| `room_error` | Server → Client | `"error message"` | Client shows error on home/lobby page |
| `new_player` | Server → Room | `players[]` | All lobby clients update their player list |
| `start_game` | Client → Server | — | Host triggers game start (validated server-side) |
| `game_started` | Server → Room | — | All clients transition from lobby to game |

### Game Flow

| Event | Who emits | Payload | What happens |
|---|---|---|---|
| `update_players_state` | Server → Room | `players[]` | Clients update player list; if `me.isChoosing`, emit `give_words` |
| `give_words` | Client → Server | — | Server sends 3 random word choices to the chooser only |
| `receive_words` | Server → Client | `[word1, word2, word3]` | Drawer sees the word-choice modal |
| `send_choice` | Client → Server | `{choice, screenWidth, screenHeight}` | Server sets current word, starts turn + timer |
| `start_turn` | Server → Room | `{time, wordToGuess, round, totalRounds, drawerWidth, drawerHeight}` | All clients update UI for new turn |
| `time` | Server → Room | `number` | Clock ticks down every second |
| `hint` | Server → Room | `wordToGuess[]` | Letter hints revealed at half-time |
| `turn_over` | Server → Room | `"the word"` | Turn-over modal shown with correct word + scores |
| `game_over` | Server → Room | `players[]` | Game-over modal shown with final leaderboard |
| `results_done` | Server → Room | — | Score overlay dismissed; next turn begins |

### Drawing

| Event | Who emits | Payload | What happens |
|---|---|---|---|
| `start_drawing` | Drawer → Server | `{offsetX, offsetY, color, size}` | Relayed as `client_start_drawing` to all others |
| `draw` | Drawer → Server | `{offsetX, offsetY}` | Relayed as `client_draw` |
| `finish_drawing` | Drawer → Server | — | Relayed as `client_finish_drawing` |
| `clear_canvas` | Drawer → Server | — | Relayed to all; also sent by server at turn start |
| `undo_stroke` | Drawer → Server | — | Relayed as `undo_stroke` to all others |

### Chat & Guessing

| Event | Who emits | Payload | What happens |
|---|---|---|---|
| `send_message` | Client → Server | `{username, message, color}` | Server checks if message == current word |
| `receive_message` | Server → Room | `{username, message, color}` | Appended to chat list |

The `send_message` handler on the server is the **word-matching logic**:
- Compare `message.toLowerCase().trim()` to `game.currentWord.toLowerCase().trim()`
- If match: award points, set `hasGuessed = true`, broadcast "X guessed the word!"
- If no match: `socket.broadcast.to(roomId)` — the guesser sees their own message locally, others receive it via the broadcast

### Disconnect

| Event | Who emits | Payload | What happens |
|---|---|---|---|
| `remove_player` | Server → Room | `players[]` | Other clients remove the player from their lists |
| `disconnect` | (auto, Socket.IO) | — | Server cleans up the player; stops game if < 2 players remain |

---

## 11. Frontend Context Architecture

React Context is used instead of a state management library. Two contexts wrap the entire app (see `main.jsx`):

```
<GameContextProvider>          ← must be outer (CanvasContext is inside Game's children)
  <CanvasContextProvider>
    <App />
  </CanvasContextProvider>
</GameContextProvider>
```

### GameContext

The single source of truth for everything game-related. Key groups:

| State group | Variables |
|---|---|
| Navigation | `isLoggedIn`, `isInLobby`, `isGameStarted` |
| Room | `roomId`, `isHost`, `roomSettings` |
| Players | `playersList` |
| Turn | `round`, `totalRounds`, `time`, `wordToGuess`, `correctWord` |
| Flags | `isChoosing`, `isAllowedToDraw`, `isTurnOver`, `isGameOver` |
| Socket | `socket` (module-level singleton, exposed via context) |

`socket` is created **once** at module load time (outside the component). This means a single persistent WebSocket connection lives for the whole session regardless of React re-renders.

### CanvasContext

Owns all drawing state. Key design: `ctxRef` is a `useRef` pointing to the `CanvasRenderingContext2D`. Using a ref (not state) means drawing operations never cause re-renders.

```
canvasRef  → <canvas> DOM element
ctxRef     → CanvasRenderingContext2D (the drawing API)

strokeHistory[]  → stack of ImageData snapshots (for undo)
isErasing        → toggles white-color drawing mode
```

---

## 12. Component Responsibilities

| Component | Responsibility |
|---|---|
| `HomePage` | Collects username + avatar; emits `create_room` or `join_room`; listens for `room_created`/`room_joined`/`room_error` |
| `LobbyPage` | Shows room code, player list, settings; host's "Start Game" button; listens for `new_player` and `game_started` |
| `GamePage` | **Registers all in-game socket listeners** in a single `useEffect([], [])` with full cleanup. Renders the game layout. |
| `Canvas` | Captures `mousedown/move/up/enter/leave`; emits drawing events; renders the `<canvas>` |
| `Palette` | Color grid + tool buttons; calls `CanvasContext` functions + emits `clear_canvas`/`undo_stroke` |
| `Chat` | Renders message history with auto-scroll; `sendMessage()` from `GameContext` handles guesses |
| `Word` | Shows `_` blanks (or revealed hints) and round counter |
| `Clock` | Reads `time` from `GameContext`; purely presentational |
| `Modal` | Multi-purpose overlay controlled by 4 flags: `playersList.length < 2`, `isChoosing`, `isTurnOver`, `isGameOver` |
| `PlayerList` → `Player` | Maps `playersList` array to `Player` rows; shows avatar, score, status emoji |

---

## 13. Key Design Decisions

**1. Why Socket.IO instead of raw WebSockets?**
Socket.IO adds automatic reconnection, fallback to HTTP long-polling when WebSockets are blocked, and built-in "rooms" (namespaces for scoped broadcasts). The room feature is used extensively for per-game isolation.

**2. Why no database?**
Game state lives entirely in server memory (`rooms: Map`). This is intentional for an MVP — no persistence means no setup friction. The trade-off is that restarting the server drops all rooms. A database (PostgreSQL/MongoDB) would be the next step for production.

**3. Why OOP on the server?**
`Game`, `Player`, and `Room` classes keep the socket event handlers thin. Each class owns its logic (e.g. `game.getHint()`, `game.hasEveryoneGuessed()`), making the code easy to unit-test and explain.

**4. Why image snapshots for undo instead of re-drawing from stroke history?**
Re-drawing requires replaying every stroke from scratch (expensive for complex drawings). `getImageData()` / `putImageData()` is O(canvasWidth × canvasHeight) pixels — fast and simple. The trade-off is memory (each snapshot is ~1MB for a 1000×600 canvas), but it's capped naturally by the number of strokes per turn.

**5. Why is the socket a module-level singleton?**
Creating the socket inside the React component or `useEffect` would reconnect on every render. A module-level `const socket = io(URL)` runs once and the connection persists for the entire session. It is exposed via context so any component can use it without prop drilling.
