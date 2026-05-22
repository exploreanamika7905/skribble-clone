const Game = require('./game');

class Room {
  constructor(roomId, hostId, settings = {}) {
    this.roomId = roomId;
    this.hostId = hostId;
    this.settings = {
      maxPlayers: Math.min(20, Math.max(2, settings.maxPlayers || 8)),
      rounds: Math.min(10, Math.max(2, settings.rounds || 3)),
      drawTime: Math.min(240, Math.max(15, settings.drawTime || 60)),
      wordCount: Math.min(5, Math.max(1, settings.wordCount || 3)),
    };
    this.game = new Game(this.settings.rounds, this.settings.drawTime);
    this.timer = null;
  }
}

module.exports = Room;
