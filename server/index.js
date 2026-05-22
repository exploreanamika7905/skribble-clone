const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const Game = require("./config/game");
const Player = require("./config/player");
const Room = require("./config/room");

app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const rooms = new Map();

const generateRoomId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
};

const uniqueRoomId = () => {
  let id = generateRoomId();
  while (rooms.has(id)) id = generateRoomId();
  return id;
};

const updatePlayersState = (roomId) => {
  const room = rooms.get(roomId);
  if (!room) return;
  io.to(roomId).emit("update_players_state", room.game.getPlayers());
};

const endTurn = (roomId) => {
  const room = rooms.get(roomId);
  if (!room) return;
  const { game } = room;

  const guessedUsers = game.getGuessedUsers();
  game.isHintSent = false;
  const drawer = game.getDrawer();
  if (drawer) drawer.score += guessedUsers.length * 10;
  updatePlayersState(roomId);

  clearInterval(room.timer);
  clearTimeout(room.timer);
  game.resetPlayerState();
  game.resetTimer();

  if (game.getRemainingPlayers().length === 0 && game.checkLastRound()) {
    io.to(roomId).emit("game_over", game.getPlayers());
    game.reset();
    room.timer = setTimeout(() => {
      game.isStarted = true;
      startNextTurn(roomId);
    }, 10000);
  } else {
    io.to(roomId).emit("turn_over", game.currentWord);
    room.timer = setTimeout(() => startNextTurn(roomId), 3000);
  }
};

const startNextTurn = (roomId) => {
  const room = rooms.get(roomId);
  if (!room) return;
  io.to(roomId).emit("clear_canvas");
  io.to(roomId).emit("results_done");
  room.game.chooseNextPlayer();
  updatePlayersState(roomId);
};

const startTimer = (roomId) => {
  const room = rooms.get(roomId);
  if (!room) return;
  const { game } = room;

  room.timer = setInterval(() => {
    if (game.getPlayers().length < 2) {
      clearInterval(room.timer);
      return;
    }
    io.to(roomId).emit("time", game.getTime());

    if (game.getTime() <= game.totalTime / 2 && !game.isHintSent) {
      const hint = game.getHint();
      let wordToGuess = game.getWordToGuess();
      hint.forEach((h) => (wordToGuess[h.randomIndex] = h.correspondingLetter));
      io.to(roomId).emit("hint", wordToGuess);
      game.isHintSent = true;
    }

    if (game.getTime() === 0) {
      endTurn(roomId);
      return;
    }
    game.oneSecondPassed();
  }, 1000);
};

io.on("connection", (socket) => {
  console.log(`connected: ${socket.id}`);
  let currentRoomId = null;

  const getRoom = () => rooms.get(currentRoomId);

  socket.on("create_room", ({ username, avatar, settings }) => {
    const roomId = uniqueRoomId();
    currentRoomId = roomId;

    const room = new Room(roomId, socket.id, settings);
    rooms.set(roomId, room);

    const newPlayer = new Player(socket.id, username, avatar);
    room.game.addPlayer(newPlayer);
    socket.join(roomId);

    socket.emit("room_created", {
      roomId,
      players: room.game.getPlayers(),
      settings: room.settings,
      hostId: room.hostId,
    });

    io.to(roomId).emit("receive_message", {
      username: "server",
      message: `${username} created the room`,
      color: "#2bab2b",
    });
  });

  socket.on("join_room", ({ roomId, username, avatar }) => {
    const upperRoomId = (roomId || "").toUpperCase().trim();
    const room = rooms.get(upperRoomId);

    if (!room) {
      socket.emit("room_error", "Room not found. Check the room code and try again.");
      return;
    }
    if (room.game.getPlayers().length >= room.settings.maxPlayers) {
      socket.emit("room_error", "Room is full.");
      return;
    }
    if (room.game.isStarted) {
      socket.emit("room_error", "Game already in progress.");
      return;
    }

    currentRoomId = upperRoomId;
    const newPlayer = new Player(socket.id, username, avatar);
    room.game.addPlayer(newPlayer);
    socket.join(upperRoomId);

    socket.emit("room_joined", {
      roomId: upperRoomId,
      players: room.game.getPlayers(),
      settings: room.settings,
      hostId: room.hostId,
    });

    socket.broadcast.to(upperRoomId).emit("new_player", room.game.getPlayers());

    io.to(upperRoomId).emit("receive_message", {
      username: "server",
      message: `${username} has joined the room`,
      color: "#2bab2b",
    });
  });

  socket.on("start_game", () => {
    const room = getRoom();
    if (!room || socket.id !== room.hostId) return;
    if (room.game.getPlayers().length < 2) {
      socket.emit("room_error", "Need at least 2 players to start.");
      return;
    }
    room.game.startGame();
    io.to(currentRoomId).emit("game_started");
    startNextTurn(currentRoomId);
  });

  socket.on("send_message", (data) => {
    const room = getRoom();
    if (!room) return;
    const { game } = room;

    if (data.message.toLowerCase().trim() === game.currentWord.toLowerCase().trim()) {
      const guessedUser = game.getPlayers().find((p) => p.id === socket.id);
      const noGuessPlayers = game.getPlayers().filter((p) => !p.hasGuessed);

      if (guessedUser && !guessedUser.hasGuessed) {
        guessedUser.score += noGuessPlayers.length * 10 + 10;
        io.to(currentRoomId).emit("receive_message", {
          username: "server",
          message: `${guessedUser.username} guessed the word!`,
          color: "green",
        });
      }
      if (guessedUser) guessedUser.hasGuessed = true;
      updatePlayersState(currentRoomId);
      if (game.hasEveryoneGuessed()) endTurn(currentRoomId);
    } else {
      socket.broadcast.to(currentRoomId).emit("receive_message", data);
    }
  });

  socket.on("start_drawing", (data) => {
    socket.broadcast.to(currentRoomId).emit("client_start_drawing", data);
  });

  socket.on("draw", (data) => {
    socket.broadcast.to(currentRoomId).emit("client_draw", data);
  });

  socket.on("finish_drawing", () => {
    socket.broadcast.to(currentRoomId).emit("client_finish_drawing");
  });

  socket.on("clear_canvas", () => {
    socket.broadcast.to(currentRoomId).emit("clear_canvas");
  });

  socket.on("undo_stroke", () => {
    socket.broadcast.to(currentRoomId).emit("undo_stroke");
  });

  socket.on("give_words", () => {
    const room = getRoom();
    if (!room) return;
    const words = room.game.chooseThreeWords();
    socket.emit("receive_words", words);
  });

  socket.on("send_choice", ({ choice, screenWidth, screenHeight }) => {
    const room = getRoom();
    if (!room) return;
    const { game } = room;

    const drawer = game.getPlayers().find((p) => p.id === socket.id);
    if (!drawer) return;
    drawer.isDrawing = true;
    drawer.isChoosing = false;
    game.drawer = drawer.username;
    game.currentWord = choice;
    game.drawerWidth = screenWidth;
    game.drawerHeight = screenHeight;
    updatePlayersState(currentRoomId);

    const wordToGuess = game.getWordToGuess();
    io.to(currentRoomId).emit("start_turn", {
      time: game.time,
      wordToGuess,
      round: game.currentRound,
      totalRounds: game.totalRounds,
      drawerWidth: game.drawerWidth,
      drawerHeight: game.drawerHeight,
    });
    startTimer(currentRoomId);
  });

  socket.on("disconnect", () => {
    console.log(`disconnected: ${socket.id}`);
    if (!currentRoomId) return;

    const room = rooms.get(currentRoomId);
    if (!room) return;

    const disconnectedPlayer = room.game.getPlayers().find((p) => p.id === socket.id);
    if (disconnectedPlayer) {
      socket.broadcast.to(currentRoomId).emit("receive_message", {
        username: "server",
        message: `${disconnectedPlayer.username} has left`,
        color: "red",
      });
    }

    room.game.removePlayer(socket.id);
    io.to(currentRoomId).emit("remove_player", room.game.playersList);

    if (room.game.playersList.length < 2 && room.game.isStarted) {
      clearInterval(room.timer);
      clearTimeout(room.timer);
      room.game.reset();
    }

    if (room.game.playersList.length === 0) {
      rooms.delete(currentRoomId);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
