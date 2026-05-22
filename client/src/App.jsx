import './App.scss';
import { useContext } from 'react';
import { GameContext } from './contexts/GameContext';
import background from './assets/background.jpeg';
import HomePage from './pages/HomePage/HomePage';
import LobbyPage from './pages/LobbyPage/LobbyPage';
import GamePage from './pages/GamePage/GamePage';

function App() {
  const { isLoggedIn, isInLobby, isGameStarted } = useContext(GameContext);

  const renderPage = () => {
    if (!isLoggedIn) return <HomePage />;
    if (isInLobby && !isGameStarted) return <LobbyPage />;
    return <GamePage />;
  };

  return (
    <div style={{ backgroundImage: `url(${background})` }} className='container'>
      {renderPage()}
    </div>
  );
}

export default App;
