import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, GamePhase, Player, GameMode, CellState, ShipType, Ship, GameLogEntry } from './types';
import Lobby from './components/Lobby';
import SetupPhase from './components/SetupPhase';
import GamePhaseComponent from './components/GamePhase';
import GameOver from './components/GameOver';
import { createEmptyGrid, canPlaceShip, placeShip, findRandomValidPlacement, createInitialPlayer, placeShipsForAI, processShot, advanceTurn } from './services/gameLogic';
import { getAITacticalMove, getAIMove } from './services/geminiService';
import Spinner from './components/Spinner';
import Toast from './components/Toast';
import { getGameConfig } from './constants';
import TurnTransition from './components/TurnTransition';


const App: React.FC = () => {
  const [game, setGame] = useState<GameState | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [playerIndexToSetup, setPlayerIndexToSetup] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' | 'success' } | null>(null);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  const showToast = useCallback((message: string, type: 'error' | 'info' | 'success' = 'info') => {
    setToast({ message, type });
  }, []);

  const handleCreateGame = (playerName: string, gameMode: GameMode, opponentType: 'AI' | 'Human', player2Name?: string) => {
    setIsLoading(true);

    const { gridDimensions, shipsConfig } = getGameConfig(gameMode);

    const player1 = createInitialPlayer(crypto.randomUUID(), playerName, false, shipsConfig, gridDimensions, gameMode);
    
    const players = [player1];

    if (opponentType === 'AI') {
        const aiPlayer = createInitialPlayer(crypto.randomUUID(), 'Gemini AI', true, shipsConfig, gridDimensions, gameMode);
        player1.shots[aiPlayer.id] = createEmptyGrid(gridDimensions.rows, gridDimensions.cols);
        aiPlayer.shots[player1.id] = createEmptyGrid(gridDimensions.rows, gridDimensions.cols);
        players.push(aiPlayer);
    } else {
        const player2 = createInitialPlayer(crypto.randomUUID(), player2Name!, false, shipsConfig, gridDimensions, gameMode);
        player1.shots[player2.id] = createEmptyGrid(gridDimensions.rows, gridDimensions.cols);
        player2.shots[player1.id] = createEmptyGrid(gridDimensions.rows, gridDimensions.cols);
        players.push(player2);
        setPlayerIndexToSetup(0);
    }

    const newGame: GameState = {
      gameId: crypto.randomUUID(),
      phase: GamePhase.SETUP,
      players,
      currentPlayerId: null,
      winner: null,
      maxPlayers: 2,
      turn: 1,
      gridDimensions,
      shipsConfig: shipsConfig as any,
      gameMode,
      log: [],
      hasActedThisTurn: false,
    };

    setLocalPlayerId(player1.id);
    setGame(newGame);
    setIsLoading(false);
  };

  const handleReady = (playerWithShips: Player) => {
    if (!game) return;

    const playerIndex = game.players.findIndex(p => p.id === playerWithShips.id);
    if (playerIndex === -1) return;

    const newPlayers = [...game.players];
    newPlayers[playerIndex] = { ...playerWithShips, isReady: true };
    const updatedGame = { ...game, players: newPlayers };

    const isHotSeat = updatedGame.players.every(p => !p.isAI);

    if (isHotSeat) {
        if (playerIndexToSetup === 0) {
            setPlayerIndexToSetup(1);
            setGame({ ...updatedGame, phase: GamePhase.TURN_TRANSITION, currentPlayerId: updatedGame.players[1].id });
        } else {
            setPlayerIndexToSetup(null);
            setGame({ ...updatedGame, phase: GamePhase.PLAYING, currentPlayerId: updatedGame.players[0].id });
        }
    } else { // vs AI
        const aiPlayerIndex = newPlayers.findIndex(p => p.isAI);
        if (aiPlayerIndex !== -1) {
            newPlayers[aiPlayerIndex] = placeShipsForAI(newPlayers[aiPlayerIndex], game.shipsConfig, game.gridDimensions);
        }
        setGame({
            ...updatedGame,
            players: newPlayers,
            phase: GamePhase.PLAYING,
            currentPlayerId: newPlayers[0].id,
        });
    }
  };

  const handleFireShot = (targetPlayerId: string | null, x: number, y: number) => {
      if (!game || !targetPlayerId) return;
      const updatedGame = processShot(game, targetPlayerId, x, y);
      setGame(updatedGame);
  }
  
  const handleEndTurn = () => {
    if (!game) return;
    const updatedGame = advanceTurn(JSON.parse(JSON.stringify(game)));
    setGame(updatedGame);
  };
  
  const handleExitGame = () => {
    setGame(null);
    setLocalPlayerId(null);
    setPlayerIndexToSetup(null);
  };

  const handleSurrender = () => {
    if (!game) return;
    const surrenderingPlayerId = game.currentPlayerId;
    if (!surrenderingPlayerId) return;

    const surrenderingPlayer = game.players.find(p => p.id === surrenderingPlayerId);
    const opponent = game.players.find(p => p.id !== surrenderingPlayerId);
    if (!opponent || !surrenderingPlayer) return;

    const newLogEntry: GameLogEntry = {
        turn: game.turn,
        playerId: surrenderingPlayerId,
        playerName: surrenderingPlayer.name,
        result: 'SKILL_USED',
        message: `${surrenderingPlayer.name} has surrendered.`
    };

    setGame({
        ...game,
        phase: GamePhase.GAME_OVER,
        winner: opponent.id,
        log: [newLogEntry, ...game.log]
    });
  };

   const handleContinueFromTransition = () => {
    if (!game) return;
    if (playerIndexToSetup !== null) {
      setGame({ ...game, phase: GamePhase.SETUP });
    } else {
      setGame({ ...game, phase: GamePhase.PLAYING });
    }
  };
  
  // AI Turn Logic
  useEffect(() => {
    if (game?.phase === GamePhase.PLAYING && game.currentPlayerId) {
        const currentPlayer = game.players.find(p => p.id === game.currentPlayerId);

        if (currentPlayer?.isAI && !game.hasActedThisTurn) {
            const handleAITurn = () => {
                setTimeout(() => {
                  setGame(currentGame => {
                    if (!currentGame || currentGame.phase !== GamePhase.PLAYING || currentGame.currentPlayerId !== currentPlayer.id) return currentGame;
                    
                    if (currentGame.gameMode === 'TACTICAL') {
                        const opponent = currentGame.players.find(p => p.id !== currentPlayer.id)!;
                        const move = getAITacticalMove(currentPlayer, opponent, currentGame);
                        
                        const fallbackToAttack = (state: GameState): GameState => {
                            console.warn("AI skill failed or was invalid, falling back to attack:", move);
                            const fallbackMove = getAIMove(currentPlayer.shots[opponent.id] || createEmptyGrid(game.gridDimensions.rows, game.gridDimensions.cols), game.gridDimensions);
                            return processShot(state, opponent.id, fallbackMove.x, fallbackMove.y);
                        };

                        if (move.action === 'ATTACK') {
                             if (move.coords && typeof move.coords.x === 'number' && typeof move.coords.y === 'number') {
                                return processShot(currentGame, opponent.id, move.coords.x, move.coords.y);
                            } else {
                                return fallbackToAttack(currentGame);
                            }
                        } else if (move.action === 'SKILL') {
                           const { success, newState } = handleUseSkill(move.shipType, move.coords || { targetShipType: move.targetShipType }, true, currentGame);
                           if (success) {
                               return newState;
                           }
                           return fallbackToAttack(currentGame);
                        } else {
                           return fallbackToAttack(currentGame);
                        }
                  });
                }, 1500);
            };
            handleAITurn();
        } else if (currentPlayer?.isAI && game.hasActedThisTurn) {
             const endAITurn = () => {
                 setTimeout(() => {
                    setGame(currentGame => {
                       if (currentGame && currentGame.phase === GamePhase.PLAYING && currentGame.currentPlayerId === currentPlayer.id && currentGame.hasActedThisTurn) {
                           return advanceTurn(JSON.parse(JSON.stringify(currentGame)));
                       }
                       return currentGame;
                    });
                 }, 1000);
            };
            endAITurn();
        }
    }
   }, [game]);

  const handleUseSkill = (skillType: ShipType, options: any, isAI: boolean = false, gameStateOverride?: GameState): { success: boolean, newState: GameState } => {
    const sourceGame = gameStateOverride || game;
    if (!sourceGame) return { success: false, newState: sourceGame! };

    const currentGameState: GameState = JSON.parse(JSON.stringify(sourceGame)); // Work on a copy
    const attacker = currentGameState.players.find(p => p.id === currentGameState.currentPlayerId)!;
    const logEntry = { turn: currentGameState.turn, playerId: attacker.id, playerName: attacker.name, result: 'SKILL_USED' as const, message: `${skillType} used` };
    let actionTaken = true;

    // --- Start of Skill Logic ---
     switch(skillType) {
        case 'Mothership': {
            if (isAI) {
                const mothership = attacker.ships.find(s => s.type === 'Mothership')!;
                const placement = findRandomValidPlacement(attacker, mothership, game!.gridDimensions);

                if (placement) {
                    // Clear old positions from attacker grid and opponent shots
                    const gridWithoutOldShip = attacker.grid.map(row => [...row]);
                    mothership.positions.forEach(pos => { gridWithoutOldShip[pos.y][pos.x] = CellState.EMPTY; });
                    currentGameState.players.forEach((player: Player) => {
                        if (player.id !== attacker.id) {
                            mothership.positions.forEach(pos => {
                                if (player.shots[attacker.id]?.[pos.y]?.[pos.x]) {
                                    player.shots[attacker.id][pos.y][pos.x] = CellState.EMPTY;
                                }
                            });
                        }
                    });

                    const { newGrid, newShip } = placeShip(gridWithoutOldShip, mothership, placement.x, placement.y, placement.isHorizontal);
                    
                    const shipIndex = attacker.ships.findIndex(s => s.type === 'Mothership');
                    attacker.ships[shipIndex] = { ...newShip, isDamaged: false }; // Repair it
                    attacker.grid = newGrid;
                    attacker.skillUses!.Mothership = 0;
                    logEntry.message = `${attacker.name} used Escape! The Mothership has been repaired and relocated!`;
                } else {
                    actionTaken = false; 
                }
            } else { // Human logic
                const { x, y, isHorizontal } = options;
                const originalPositions = currentGameState.activeAction!.originalPositions!;
                const mothershipFromAction = currentGameState.activeAction!.shipToMove!;
                
                if (canPlaceShip(attacker.grid, mothershipFromAction, x, y, isHorizontal, game!.gridDimensions)) {
                    const mothership = attacker.ships.find(s => s.type === 'Mothership')!;
                    mothership.isDamaged = false; // The skill repairs it fully
                    
                    currentGameState.players.forEach((player: Player) => {
                        if (player.id !== attacker.id) {
                            originalPositions.forEach(pos => {
                                 if (player.shots[attacker.id]?.[pos.y]?.[pos.x]) {
                                    player.shots[attacker.id][pos.y][pos.x] = CellState.EMPTY;
                                }
                            });
                        }
                    });
                    
                    const { newGrid, newShip } = placeShip(attacker.grid, mothership, x, y, isHorizontal);
                    mothership.positions = newShip.positions;
                    attacker.grid = newGrid;
                    attacker.skillUses!.Mothership = 0;
                    logEntry.message = `${attacker.name} used Escape! The Mothership has been repaired and relocated!`;
                } else {
                    if (!isAI) showToast("Invalid placement for escape maneuver.", "error");
                    const mothership = attacker.ships.find(s => s.type === 'Mothership')!;
                    mothership.positions = originalPositions.map(p => ({ x: p.x, y: p.y }));
                    originalPositions.forEach(pos => { attacker.grid[pos.y][pos.x] = pos.state; });
                    actionTaken = false;
                }
            }
            break;
        }
        case 'Radarship': {
            const opponent = currentGameState.players.find((p: Player) => p.id !== attacker.id)!;
            const scanResults: { x: number, y: number, state: CellState }[] = [];
            for (let i = 0; i <= 1; i++) for (let j = 0; j <= 1; j++) {
                const checkX = options.x + j, checkY = options.y + i;
                if (checkX < game!.gridDimensions.cols && checkY < game!.gridDimensions.rows) {
                    if (attacker.shots[opponent.id][checkY][checkX] === CellState.EMPTY) {
                        const opponentCell = opponent.grid[checkY][checkX];
                        scanResults.push({ x: checkX, y: checkY, state: (opponentCell === CellState.SHIP || opponentCell === CellState.DECOY) ? CellState.RADAR_CONTACT : CellState.MISS });
                    }
                }
            }
            attacker.skillCooldowns.Radarship = 3;
            logEntry.message = `Radar Scan used. Cooldown set to 3 turns.`;
            currentGameState.radarScanResult = { playerId: attacker.id, results: scanResults };
            break;
        }
        case 'Jamship': {
            const opponent = currentGameState.players.find((p: Player) => p.id !== attacker.id)!;
            const jammedCoords = [];
            for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
                const checkX = options.x + j, checkY = options.y + i;
                 if (checkX >= 0 && checkX < game!.gridDimensions.cols && checkY >= 0 && checkY < game!.gridDimensions.rows) {
                    jammedCoords.push({ x: checkX, y: checkY });
                 }
            }
            opponent.jammedPositions = jammedCoords;
            opponent.jamTurnsRemaining = 1;
            currentGameState.jammedArea = { playerId: opponent.id, coords: jammedCoords };
            attacker.skillCooldowns.Jamship = 4;
            logEntry.message = `${attacker.name} used Jam. Cooldown set to 4 turns.`;
            break;
        }
        case 'Repairship': {
            const repairedShip = attacker.ships.find((s: Ship) => s.positions.some(p => p.x === options.x && p.y === options.y));
            if (repairedShip?.isSunk || repairedShip?.hasBeenRepaired || attacker.grid[options.y][options.x] !== CellState.HIT || (currentGameState.hitLog?.[attacker.id]?.[`${options.x},${options.y}`] ?? 999) >= currentGameState.turn) {
                if(!isAI) showToast("Cannot repair this part.", "error");
                actionTaken = false; break;
            }
            attacker.grid[options.y][options.x] = CellState.SHIP;
            currentGameState.players.forEach((p: Player) => { p.shots[attacker.id] && (p.shots[attacker.id][options.y][options.x] = CellState.EMPTY) });
            attacker.skillCooldowns.Repairship = 3;
            repairedShip.hasBeenRepaired = true;
            const isStillDamaged = repairedShip.positions.some(p => attacker.grid[p.y][p.x] === CellState.HIT);
            repairedShip.isDamaged = isStillDamaged;
             logEntry.message = `${attacker.name} repaired their ${repairedShip.name}. Cooldown: 3 turns.`;
             if (!isStillDamaged) logEntry.message += ` It's fully repaired and hidden!`;
            break;
        }
        case 'Decoyship': {
            const { x, y } = options;
            if (attacker.grid[y][x] === CellState.EMPTY) {
                attacker.grid[y][x] = CellState.DECOY;
                attacker.decoyPositions.push({ x, y });
                attacker.skillUses.Decoyship!--;
                logEntry.message = `${attacker.name} deployed a decoy beacon.`;
            } else {
                if (!isAI) showToast("Cannot place decoy there.", "error");
                actionTaken = false;
            }
            break;
        }
        case 'Commandship': {
            if (isAI) {
                const shipToMove = attacker.ships.find((s: Ship) => s.type === options.targetShipType);
                if (!shipToMove || shipToMove.isDamaged || shipToMove.isSunk || shipToMove.hasBeenRelocated) { actionTaken = false; break; }
                const placement = findRandomValidPlacement(attacker, shipToMove, game!.gridDimensions);
                if (placement) {
                    const gridWithoutShip = attacker.grid.map(row => [...row]);
                    shipToMove.positions.forEach(pos => { gridWithoutShip[pos.y][pos.x] = CellState.EMPTY; });
                    const { newGrid, newShip } = placeShip(gridWithoutShip, shipToMove, placement.x, placement.y, placement.isHorizontal);
                    const shipIndex = attacker.ships.findIndex(s => s.name === newShip.name);
                    attacker.ships[shipIndex] = { ...newShip, hasBeenRelocated: true };
                    attacker.grid = newGrid;
                    attacker.skillCooldowns.Commandship = 4;
                    logEntry.message = `${attacker.name} relocated their ${shipToMove.name}.`;
                } else { actionTaken = false; }
            } else { // Human
                const { x, y, isHorizontal } = options;
                const originalPositions = currentGameState.activeAction!.originalPositions!;
                const shipToMoveFromAction = currentGameState.activeAction!.shipToMove!;
                if (canPlaceShip(attacker.grid, shipToMoveFromAction, x, y, isHorizontal, game!.gridDimensions)) {
                    const shipIndex = attacker.ships.findIndex(s => s.name === shipToMoveFromAction.name)!;
                    const { newGrid, newShip } = placeShip(attacker.grid, attacker.ships[shipIndex], x, y, isHorizontal);
                    attacker.ships[shipIndex] = { ...newShip, hasBeenRelocated: true };
                    attacker.grid = newGrid;
                    attacker.skillCooldowns.Commandship = 4;
                    logEntry.message = `${attacker.name} relocated their ${shipToMoveFromAction.name}.`;
                } else {
                    if (!isAI) showToast("Invalid placement for relocation.", "error");
                    const shipToRestore = attacker.ships.find(s => s.name === shipToMoveFromAction.name)!;
                    shipToRestore.positions = originalPositions.map(p => ({ x: p.x, y: p.y }));
                    originalPositions.forEach(pos => { attacker.grid[pos.y][pos.x] = pos.state; });
                    actionTaken = false;
                }
            }
            break;
        }
    }
    // --- End of Skill Logic ---
    if (!actionTaken) {
        currentGameState.activeAction = null;
        if(!gameStateOverride) setGame(currentGameState);
        return { success: false, newState: currentGameState };
    }

    currentGameState.log.unshift(logEntry);
    currentGameState.hasActedThisTurn = true;
    currentGameState.activeAction = null;
    if(!gameStateOverride) setGame(currentGameState);
    return { success: true, newState: currentGameState };
  };
  
  const promiseBasedUseSkill = async (skillType: ShipType, options: any): Promise<boolean> => {
     return handleUseSkill(skillType, options).success;
  }

  const handleSetActiveAction = (action: any) => {
    if (!game) return;
    setGame({ ...game, activeAction: action });
  };
  
   const handleActivateMothershipEscape = () => {
    if (!game) return;
    const newState = JSON.parse(JSON.stringify(game));
    const player = newState.players.find(p => p.id === newState.currentPlayerId);
    if (!player) return;
    const mothership = player.ships.find(s => s.type === 'Mothership');
    if (!mothership || !player.escapeSkillUnlocked || (player.skillUses?.Mothership ?? 0) <= 0) return;
    const isHorizontal = mothership.positions.length > 1 ? mothership.positions[0].y === mothership.positions[1].y : true;
    const originalPositionsWithState = mothership.positions.map(pos => ({ x: pos.x, y: pos.y, state: player.grid[pos.y][pos.x] as CellState }));
    mothership.positions.forEach(pos => { player.grid[pos.y][pos.x] = CellState.EMPTY; });
    mothership.positions = [];
    newState.activeAction = { playerId: player.id, type: 'SKILL', shipType: 'Mothership', stage: 'PLACE_SHIP', shipToMove: mothership, originalPositions: originalPositionsWithState, isHorizontal: isHorizontal };
    setGame(newState);
  };

  const handleSelectShipForRelocation = (shipToRelocate: Ship) => {
    if (!game) return;
    const newState = JSON.parse(JSON.stringify(game));
    const player = newState.players.find(p => p.id === newState.currentPlayerId);
    if (!player) return;
    const ship = player.ships.find(s => s.name === shipToRelocate.name);
    if (!ship || ship.isDamaged || ship.hasBeenRelocated) return;
    const isHorizontal = ship.positions.length > 1 ? ship.positions[0].y === ship.positions[1].y : true;
    const originalPositionsWithState = ship.positions.map(pos => ({ x: pos.x, y: pos.y, state: player.grid[pos.y][pos.x] as CellState }));
    ship.positions.forEach(pos => { player.grid[pos.y][pos.x] = CellState.EMPTY; });
    ship.positions = [];
    newState.activeAction = { playerId: player.id, type: 'SKILL', shipType: 'Commandship', stage: 'PLACE_SHIP', shipToMove: ship, originalPositions: originalPositionsWithState, isHorizontal: isHorizontal };
    setGame(newState);
  };

  const WaitingScreen: React.FC<{ message: string }> = ({ message }) => (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900">
        <Spinner />
        <p className="mt-4 text-slate-300">{message}</p>
      </div>
  );

  let pageContent;
  if (isLoading) {
    pageContent = <WaitingScreen message="Loading Game..." />;
  } else if (!game || !localPlayerId) {
    pageContent = <Lobby onCreateGame={handleCreateGame} />;
  } else if (game.phase === GamePhase.SETUP) {
    const isHotSeat = game.players.every(p => !p.isAI);
    const playerToSetup = game.players[isHotSeat ? playerIndexToSetup! : 0];

    if (playerToSetup && !playerToSetup.isReady) {
       pageContent = <SetupPhase game={game} playerToSetup={playerToSetup} onReady={handleReady} showToast={showToast} />;
    } else {
       pageContent = <WaitingScreen message="Preparing battle..." />;
    }
  } else if (game.phase === GamePhase.TURN_TRANSITION) {
    const nextPlayer = game.players.find(p => p.id === game.currentPlayerId)!;
    const prevPlayerIndex = (game.players.findIndex(p => p.id === nextPlayer.id) + game.players.length - 1) % game.players.length;
    const prevPlayer = game.players[prevPlayerIndex];
    const isSetupTransition = playerIndexToSetup !== null;
    const message = isSetupTransition 
        ? `Setup complete for ${game.players[0].name}.`
        : `Turn complete for ${prevPlayer.name}.`;

    pageContent = <TurnTransition
      nextPlayerName={nextPlayer.name}
      onContinue={handleContinueFromTransition}
      isSetupTransition={isSetupTransition}
      message={message}
    />;
  } else if (game.phase === GamePhase.PLAYING) {
    const isHotSeat = game.players.every(p => !p.isAI);
    pageContent = <GamePhaseComponent 
      game={game} 
      playerId={isHotSeat ? game.currentPlayerId! : localPlayerId}
      onFireShot={handleFireShot}
      onSurrender={handleSurrender}
      onSetActiveAction={handleSetActiveAction}
      onUseSkill={promiseBasedUseSkill}
      onEndTurn={handleEndTurn}
      onActivateMothershipEscape={handleActivateMothershipEscape}
      onSelectShipForRelocation={handleSelectShipForRelocation}
      viewMode={viewMode}
      setViewMode={setViewMode}
    />;
  } else if (game.phase === GamePhase.GAME_OVER) {
    pageContent = <GameOver game={game} onExitGame={handleExitGame}/>;
  } else {
    pageContent = <WaitingScreen message="Loading game state..." />;
  }
  
  return (
    <>
      {pageContent}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
};

export default App;
