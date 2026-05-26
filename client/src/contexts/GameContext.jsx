import { createContext, useState } from "react";
import { io } from "socket.io-client";
import PropTypes from 'prop-types';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
const socket = io(SOCKET_URL);

export const GameContext = createContext({});

export const GameContextProvider = ({ children }) => {
  const [username, setUsername] = useState("");
  const [messagesArray, setMessagesArray] = useState([]);
  const [avatar, setAvatar] = useState({});

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInLobby, setIsInLobby] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);

  const [roomId, setRoomId] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [roomSettings, setRoomSettings] = useState({});

  const [playersList, setPlayersList] = useState([]);

  const [isChoosing, setIsChoosing] = useState(false);
  const [wordsToChooseFrom, setWordsToChooseFrom] = useState([]);
  const [time, setTime] = useState(60);
  const [round, setRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [wordToGuess, setWordToGuess] = useState([]);
  const [isAllowedToDraw, setIsAllowedToDraw] = useState(false);
  const [correctWord, setCorrectWord] = useState("");
  const [isTurnOver, setIsTurnOver] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  const reset = () => {
    setPlayersList([]);
    setCorrectWord("");
    setWordToGuess([]);
    setIsAllowedToDraw(false);
    setIsChoosing(false);
    setMessagesArray([]);
    setRound(1);
    setIsLoggedIn(false);
    setIsInLobby(false);
    setIsGameStarted(false);
    setRoomId("");
    setIsHost(false);
  };

  const chooseWords = (chosenWords) => {
    setIsChoosing(true);
    setWordsToChooseFrom(chosenWords);
  };

  const sendMessage = (message) => {
    setMessagesArray((prev) => [...prev, { username, message, color: "black" }]);
    socket.emit("send_message", { username, message, color: "black" });
  };

  const value = {
    username, setUsername,
    sendMessage,
    messagesArray, setMessagesArray,
    socket,
    avatar, setAvatar,
    isLoggedIn, setIsLoggedIn,
    isInLobby, setIsInLobby,
    isGameStarted, setIsGameStarted,
    roomId, setRoomId,
    isHost, setIsHost,
    roomSettings, setRoomSettings,
    playersList, setPlayersList,
    isChoosing, setIsChoosing,
    wordsToChooseFrom,
    chooseWords,
    wordToGuess, setWordToGuess,
    time, setTime,
    round, setRound,
    totalRounds, setTotalRounds,
    isAllowedToDraw, setIsAllowedToDraw,
    correctWord, setCorrectWord,
    isTurnOver, setIsTurnOver,
    isGameOver, setIsGameOver,
    reset,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

GameContextProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
