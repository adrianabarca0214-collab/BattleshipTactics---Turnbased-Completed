import React, { useState, useCallback, useEffect } from 'react';
import { GameMode } from '../types';
import FullscreenIcon from './icons/FullscreenIcon';
import Spinner from './Spinner';

interface LobbyProps {
  onCreateGame: (playerName: string, gameMode: GameMode, opponentType: 'AI' | 'Human', player2Name?: string) => void;
}

const Lobby: React.FC<LobbyProps> = ({ onCreateGame }) => {
  const [gameMode, setGameMode] = useState<GameMode>('TACTICAL');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [playerName, setPlayerName] = useState('Player 1');
  const [player2Name, setPlayer2Name] = useState('Player 2');
  const [opponentType, setOpponentType] = useState<'AI' | 'Human'>('AI');
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenEnabled) return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handleCreateGame = () => {
    if (!playerName.trim()) {
      setError('Player 1 name cannot be empty.');
      return;
    }
    if (opponentType === 'Human' && !player2Name.trim()) {
      setError('Player 2 name cannot be empty.');
      return;
    }
     if (opponentType === 'Human' && playerName.trim() === player2Name.trim()) {
      setError('Player names must be unique.');
      return;
    }
    setError('');
    setIsLoading(true);
    setTimeout(() => {
        onCreateGame(playerName, gameMode, opponentType, opponentType === 'Human' ? player2Name : undefined);
    }, 200);
  };
  
  const getGameModeDescription = () => {
      if (gameMode === 'TACTICAL') return "1v1 strategic combat. Sink the enemy Mothership to win using unique ship skills.";
      return "The original naval combat game. Place your ships and be the last fleet standing.";
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 fade-in command-background relative">
       <div className="command-background-dots"></div>
       <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-full text-slate-200 transition-colors z-20"
        aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      >
        <FullscreenIcon className="w-6 h-6" isFullscreen={isFullscreen} />
      </button>

      <div className="w-full max-w-lg space-y-6 relative z-10">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold command-title tracking-widest">
            GEMINI BATTLESHIP
          </h1>
          <p className="text-center text-cyan-300 mt-2 text-xl tracking-[0.2em]">FLEET COMMAND</p>
        </div>
        
        <div className="command-panel p-6 md:p-8 space-y-6">
            <div className="bg-slate-900/50 p-3 text-center command-panel-header">
                <h2 className="text-3xl font-semibold text-white">New Engagement</h2>
            </div>

            {error && <p className="text-red-400 text-center bg-red-900/50 p-3 rounded-md">{error}</p>}
            
             <div>
              <label className="block text-slate-300 mb-2 text-lg text-center font-semibold tracking-wider">Opponent:</label>
              <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setOpponentType('AI')} className={`btn-angular py-3 text-lg font-bold transition-colors ${opponentType === 'AI' ? 'selected' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'}`}>vs. AI</button>
                  <button onClick={() => setOpponentType('Human')} className={`btn-angular py-3 text-lg font-bold transition-colors ${opponentType === 'Human' ? 'selected' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'}`}>vs. Player</button>
              </div>
            </div>

            <div>
              <label htmlFor="player_name" className="block text-slate-300 mb-1 text-sm tracking-wider">{opponentType === 'Human' ? 'Player 1 Callsign:' : 'Your Callsign:'}</label>
              <input
                id="player_name"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="> Enter Callsign_"
                className="w-full px-4 py-2 command-input rounded-sm text-cyan-300 text-2xl placeholder-slate-500 focus:outline-none transition"
              />
            </div>

            {opponentType === 'Human' && (
              <div className="fade-in">
                <label htmlFor="player2_name" className="block text-slate-300 mb-1 text-sm tracking-wider">Player 2 Callsign:</label>
                <input
                  id="player2_name"
                  type="text"
                  value={player2Name}
                  onChange={(e) => setPlayer2Name(e.target.value)}
                  placeholder="> Enter Callsign_"
                  className="w-full px-4 py-2 command-input rounded-sm text-cyan-300 text-2xl placeholder-slate-500 focus:outline-none transition"
                />
              </div>
            )}

            <div>
              <label className="block text-slate-300 mb-2 text-lg text-center font-semibold tracking-wider">Game Mode:</label>
              <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setGameMode('CLASSIC')} className={`btn-angular py-3 text-lg font-bold transition-colors ${gameMode === 'CLASSIC' ? 'selected' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'}`}>Classic</button>
                  <button onClick={() => setGameMode('TACTICAL')} className={`btn-angular py-3 text-lg font-bold transition-colors ${gameMode === 'TACTICAL' ? 'selected' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'}`}>Tactical</button>
              </div>
            </div>
             <p className="text-center text-xs text-slate-400 mt-1 px-2 min-h-[40px] flex items-center justify-center">{getGameModeDescription()}</p>
            
            <button
              onClick={handleCreateGame}
              disabled={isLoading}
              className="w-full btn-angular btn-start font-bold py-4 text-2xl transition-transform transform disabled:opacity-50 disabled:cursor-wait"
            >
              {isLoading ? <div className="flex items-center justify-center gap-3"><Spinner /> INITIATING...</div> : 'DEPLOY FLEET'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;