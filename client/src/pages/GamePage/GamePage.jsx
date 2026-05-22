import logo from "../../assets/logo.png";
import Word from "../../components/Word/Word";
import PlayerList from "../../components/PlayerList/PlayerList";
import Canvas from "../../components/Canvas/Canvas";
import Palette from "../../components/Palette/Palette";
import Modal from "../../components/Modal/Modal";
import Chat from "../../components/Chat/Chat";
import { GameContext } from "../../contexts/GameContext";
import { CanvasContext } from "../../contexts/CanvasContext";
import { useEffect, useContext } from "react";
import "./game-page.styles.scss";

export default function GamePage() {
  const {
    setMessagesArray, socket, setPlayersList, playersList, username,
    chooseWords, isChoosing, setRound, setTotalRounds, setTime,
    setWordToGuess, setIsTurnOver, isTurnOver, isGameOver, setIsGameOver,
    reset, setIsAllowedToDraw, setCorrectWord,
  } = useContext(GameContext);

  const { startDrawing, draw, finishDrawing, setIsDrawing, clearCanvas, resizeCanvas, undoCanvas } =
    useContext(CanvasContext);

  useEffect(() => {
    const onMessage = (data) => setMessagesArray((prev) => [...prev, data]);
    const onNewPlayer = (data) => setPlayersList(data);
    const onRemovePlayer = (data) => setPlayersList(data);

    const onUpdatePlayers = (data) => {
      setPlayersList(data);
      const me = data.find((p) => p.username === username);
      if (me && me.isChoosing) socket.emit("give_words");
    };

    const onClientStartDrawing = ({ offsetX, offsetY, color, size }) => {
      setIsDrawing(true);
      startDrawing(offsetX, offsetY, color, size);
    };
    const onClientFinishDrawing = () => { setIsDrawing(false); finishDrawing(); };
    const onClientDraw = ({ offsetX, offsetY }) => draw(offsetX, offsetY);
    const onReceiveWords = (words) => chooseWords(words);

    const onStartTurn = ({ time, wordToGuess, round, totalRounds, drawerWidth, drawerHeight }) => {
      setTime(time);
      setWordToGuess(wordToGuess);
      setRound(round);
      setTotalRounds(totalRounds);
      resizeCanvas(drawerWidth, drawerHeight);
    };

    const onHint = (wordToGuess) => setWordToGuess(wordToGuess);
    const onClearCanvas = () => clearCanvas();
    const onUndoStroke = () => undoCanvas();
    const onResultsDone = () => { setIsTurnOver(false); setCorrectWord(""); setIsGameOver(false); setIsAllowedToDraw(false); };
    const onTime = (time) => setTime(time);
    const onTurnOver = (word) => { setIsTurnOver(true); setIsAllowedToDraw(false); setCorrectWord(word); };
    const onGameOver = () => setIsGameOver(true);
    const onDisconnect = () => reset();

    socket.on("receive_message", onMessage);
    socket.on("new_player", onNewPlayer);
    socket.on("remove_player", onRemovePlayer);
    socket.on("update_players_state", onUpdatePlayers);
    socket.on("client_start_drawing", onClientStartDrawing);
    socket.on("client_finish_drawing", onClientFinishDrawing);
    socket.on("client_draw", onClientDraw);
    socket.on("receive_words", onReceiveWords);
    socket.on("start_turn", onStartTurn);
    socket.on("hint", onHint);
    socket.on("clear_canvas", onClearCanvas);
    socket.on("undo_stroke", onUndoStroke);
    socket.on("results_done", onResultsDone);
    socket.on("time", onTime);
    socket.on("turn_over", onTurnOver);
    socket.on("game_over", onGameOver);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("receive_message", onMessage);
      socket.off("new_player", onNewPlayer);
      socket.off("remove_player", onRemovePlayer);
      socket.off("update_players_state", onUpdatePlayers);
      socket.off("client_start_drawing", onClientStartDrawing);
      socket.off("client_finish_drawing", onClientFinishDrawing);
      socket.off("client_draw", onClientDraw);
      socket.off("receive_words", onReceiveWords);
      socket.off("start_turn", onStartTurn);
      socket.off("hint", onHint);
      socket.off("clear_canvas", onClearCanvas);
      socket.off("undo_stroke", onUndoStroke);
      socket.off("results_done", onResultsDone);
      socket.off("time", onTime);
      socket.off("turn_over", onTurnOver);
      socket.off("game_over", onGameOver);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  return (
    <div className="game-container">
      {playersList.length < 2 || isChoosing || isTurnOver || isGameOver ? <Modal /> : ""}
      <div className="logo-container">
        <img style={{ maxWidth: "100%", minHeight: "100%" }} src={logo} alt="LOGO" />
      </div>
      <Word />
      <div className="main-game-components">
        <PlayerList />
        <Canvas />
        <Chat />
      </div>
      <Palette />
    </div>
  );
}
