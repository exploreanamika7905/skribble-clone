import "./homepage.scss";
import logo from "../../assets/logo.png";
import greaterThan from "../../assets/greater_than.png";
import lessThan from "../../assets/less_than.png";
import { hairStyles, clothingStyles, eyesStyles, mouthStyles } from "../../data/avatar";
import { useContext, useEffect, useState } from "react";
import { GameContext } from "../../contexts/GameContext";

const DEFAULT_SETTINGS = { maxPlayers: 8, rounds: 3, drawTime: 60 };

const HomePage = () => {
  const {
    setUsername, username, setAvatar,
    setIsLoggedIn, setIsInLobby, setIsHost,
    setPlayersList, setRoomId, setRoomSettings,
    socket,
  } = useContext(GameContext);

  const [topType, setTopType] = useState(10);
  const [clotheType, setClotheType] = useState(0);
  const [eyeType, setEyeType] = useState(2);
  const [mouthType, setMouthType] = useState(0);

  const [mode, setMode] = useState("home");
  const [roomCode, setRoomCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const types = ["top", "eye", "mouth", "clothe"];

  useEffect(() => {
    const onRoomCreated = ({ roomId, players, settings: s }) => {
      setRoomId(roomId);
      setPlayersList(players);
      setRoomSettings(s);
      setIsHost(true);
      setIsLoggedIn(true);
      setIsInLobby(true);
    };

    const onRoomJoined = ({ roomId, players, settings: s, hostId }) => {
      setRoomId(roomId);
      setPlayersList(players);
      setRoomSettings(s);
      setIsHost(socket.id === hostId);
      setIsLoggedIn(true);
      setIsInLobby(true);
    };

    const onRoomError = (msg) => setErrorMsg(msg);

    socket.on("room_created", onRoomCreated);
    socket.on("room_joined", onRoomJoined);
    socket.on("room_error", onRoomError);

    return () => {
      socket.off("room_created", onRoomCreated);
      socket.off("room_joined", onRoomJoined);
      socket.off("room_error", onRoomError);
    };
  }, []);

  const buildAvatar = () => ({
    top: hairStyles[topType],
    eye: eyesStyles[eyeType],
    mouth: mouthStyles[mouthType],
    clothe: clothingStyles[clotheType],
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!username.trim()) { setErrorMsg("Please enter your name."); return; }
    setErrorMsg("");
    const avatar = buildAvatar();
    setAvatar(avatar);
    socket.emit("create_room", { username: username.trim(), avatar, settings });
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!username.trim()) { setErrorMsg("Please enter your name."); return; }
    if (!roomCode.trim()) { setErrorMsg("Please enter a room code."); return; }
    setErrorMsg("");
    const avatar = buildAvatar();
    setAvatar(avatar);
    socket.emit("join_room", { roomId: roomCode.trim().toUpperCase(), username: username.trim(), avatar });
  };

  const cycleStyle = (type, delta) => {
    const wrap = (val, len) => ((val + delta) % len + len) % len;
    if (type === "top")    setTopType(wrap(topType, hairStyles.length));
    if (type === "eye")    setEyeType(wrap(eyeType, eyesStyles.length));
    if (type === "mouth")  setMouthType(wrap(mouthType, mouthStyles.length));
    if (type === "clothe") setClotheType(wrap(clotheType, clothingStyles.length));
  };

  return (
    <div className="home">
      <div className="info">
        <div className="logo">
          <img src={logo} alt="logo" />
        </div>

        <div className="input">
          <input
            autoComplete="off"
            onChange={(e) => setUsername(e.target.value)}
            type="text"
            placeholder="Enter your name"
            maxLength={20}
          />
        </div>

        <div className="pic">
          <div className="less-than">
            {types.map((type) => (
              <button type="button" key={type} onClick={() => cycleStyle(type, -1)}>
                <img src={lessThan} alt="prev" />
              </button>
            ))}
          </div>
          <img
            style={{ height: "100%" }}
            alt="avatar"
            src={`https://avataaars.io/?topType=${hairStyles[topType]}&clotheType=${clothingStyles[clotheType]}&clotheColor=Black&eyeType=${eyesStyles[eyeType]}&mouthType=${mouthStyles[mouthType]}`}
          />
          <div className="greater-than">
            {types.map((type) => (
              <button type="button" key={type} onClick={() => cycleStyle(type, 1)}>
                <img src={greaterThan} alt="next" />
              </button>
            ))}
          </div>
        </div>

        {errorMsg && <div className="error-msg">{errorMsg}</div>}

        {mode === "home" && (
          <div className="mode-buttons">
            <button className="play" onClick={() => setMode("create")}>Create Room</button>
            <button className="play join-btn" onClick={() => setMode("join")}>Join Room</button>
          </div>
        )}

        {mode === "create" && (
          <form onSubmit={handleCreate} className="room-form">
            <div className="settings-row">
              <label>
                Rounds
                <input
                  type="number" min="2" max="10" value={settings.rounds}
                  onChange={(e) => setSettings({ ...settings, rounds: +e.target.value })}
                />
              </label>
              <label>
                Draw time (s)
                <input
                  type="number" min="15" max="240" value={settings.drawTime}
                  onChange={(e) => setSettings({ ...settings, drawTime: +e.target.value })}
                />
              </label>
              <label>
                Max players
                <input
                  type="number" min="2" max="20" value={settings.maxPlayers}
                  onChange={(e) => setSettings({ ...settings, maxPlayers: +e.target.value })}
                />
              </label>
            </div>
            <div className="mode-buttons">
              <button type="submit" className="play">Create</button>
              <button type="button" className="play back-btn" onClick={() => setMode("home")}>Back</button>
            </div>
          </form>
        )}

        {mode === "join" && (
          <form onSubmit={handleJoin} className="room-form">
            <div className="join-row">
              <input
                type="text"
                placeholder="Room code (e.g. AB12CD)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="room-code-input"
              />
            </div>
            <div className="mode-buttons">
              <button type="submit" className="play">Join</button>
              <button type="button" className="play back-btn" onClick={() => setMode("home")}>Back</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default HomePage;
