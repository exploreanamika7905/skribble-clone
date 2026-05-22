import { useContext, useEffect, useRef } from "react";
import { GameContext } from "../../contexts/GameContext";
import "./lobby.scss";
import logo from "../../assets/logo.png";

export default function LobbyPage() {
  const {
    roomId, isHost, playersList, setPlayersList,
    roomSettings, socket,
    setIsInLobby, setIsGameStarted, setMessagesArray,
    username,
  } = useContext(GameContext);

  // Copy to clipboard feedback
  const codeCopied = useRef(false);

  useEffect(() => {
    const onNewPlayer = (players) => setPlayersList(players);
    const onRemovePlayer = (players) => setPlayersList(players);
    const onGameStarted = () => {
      setIsInLobby(false);
      setIsGameStarted(true);
      setMessagesArray([]);
    };

    socket.on("new_player", onNewPlayer);
    socket.on("remove_player", onRemovePlayer);
    socket.on("game_started", onGameStarted);

    return () => {
      socket.off("new_player", onNewPlayer);
      socket.off("remove_player", onRemovePlayer);
      socket.off("game_started", onGameStarted);
    };
  }, []);

  const handleStartGame = () => {
    socket.emit("start_game");
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomId).catch(() => {});
    codeCopied.current = true;
  };

  return (
    <div className="lobby-wrapper">
      <div className="lobby-card">
        <img className="lobby-logo" src={logo} alt="logo" />

        <div className="lobby-room-code">
          <span className="code-label">Room Code</span>
          <span className="code-value">{roomId}</span>
          <button className="copy-btn" onClick={copyCode} title="Copy room code">
            📋 Copy
          </button>
        </div>

        <div className="lobby-settings">
          <span>Rounds: <strong>{roomSettings.rounds}</strong></span>
          <span>Draw time: <strong>{roomSettings.drawTime}s</strong></span>
          <span>Max players: <strong>{roomSettings.maxPlayers}</strong></span>
        </div>

        <div className="lobby-players">
          <h3>Players ({playersList.length}/{roomSettings.maxPlayers})</h3>
          <ul>
            {playersList.map((p) => (
              <li key={p.id} className={p.username === username ? "me" : ""}>
                <img
                  className="lobby-avatar"
                  src={`https://avataaars.io/?topType=${p.avatar.top}&clotheType=${p.avatar.clothe}&clotheColor=Black&eyeType=${p.avatar.eye}&mouthType=${p.avatar.mouth}`}
                  alt={p.username}
                />
                <span>{p.username}</span>
                {p.username === username && <span className="you-tag">(you)</span>}
              </li>
            ))}
          </ul>
        </div>

        {isHost ? (
          <div className="lobby-start">
            <button
              className="start-btn"
              onClick={handleStartGame}
              disabled={playersList.length < 2}
            >
              {playersList.length < 2 ? "Waiting for players…" : "Start Game"}
            </button>
          </div>
        ) : (
          <div className="lobby-waiting">Waiting for the host to start…</div>
        )}
      </div>
    </div>
  );
}
