import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GameState, Player, GameLogEntry, Ship, ShipType, CellState } from '../types';
import Grid from './Grid';
import ShipStatus from './ShipStatus';
import ExitIcon from './icons/ExitIcon';
import { createEmptyGrid, canPlaceShip } from '../services/gameLogic';
import GameLog from './GameLog';
import CancelIcon from './icons/CancelIcon';
import HelpTab from './HelpTab';
import InfoIcon from './icons/InfoIcon';
import ActionHub from './ActionHub';
import FullscreenIcon from './icons/FullscreenIcon';
import RepairEffect from './RepairEffect';
import RotateIcon from './icons/RotateIcon';
import MobileIcon from './icons/MobileIcon';
import DesktopIcon from './icons/DesktopIcon';
import HelpIcon from './icons/HelpIcon';
import ConfirmationModal from './ConfirmationModal';

const Cannonball: React.FC<{ startRect: DOMRect, endRect: DOMRect }> = ({ startRect, endRect }) => {
  const [styles, setStyles] = useState<React.CSSProperties & { [key: string]: any }>({});
  useEffect(() => {
    const startX = startRect.left + startRect.width / 2 - 8;
    const startY = startRect.top + startRect.height / 2 - 8;
    const endX = endRect.left + endRect.width / 2;
    const endY = endRect.top + endRect.height / 2;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    setStyles({
      position: 'fixed',
      left: `${startX}px`,
      top: `${startY}px`,
      '--delta-x': `${deltaX}px`,
      '--delta-y': `${deltaY}px`,
    });
  }, [startRect, endRect]);

  if (!styles.left) return null;
  return <div className="cannonball" style={styles}></div>;
};

const Explosion: React.FC<{ rect: DOMRect }> = ({ rect }) => {
    const containerStyle: React.CSSProperties = {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
    };

    const NUM_PARTICLES = 12;
    const particles = useMemo(() => {
        return Array.from({ length: NUM_PARTICLES }).map((_, i) => {
            const angle = (i / NUM_PARTICLES) * 2 * Math.PI + (Math.random() - 0.5) * 0.4;
            const distance = 40 + Math.random() * 30;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            const delay = Math.random() * 0.1;

            const style: React.CSSProperties & { [key: string]: any } = {
                '--particle-x': `${x}px`,
                '--particle-y': `${y}px`,
                animationDelay: `${delay}s`,
            };
            return <div key={i} className="explosion-particle" style={style}></div>;
        });
    }, []);

    return (
        <div style={containerStyle} className="explosion-container">
            <div className="explosion-flash"></div>
            <div className="explosion-shockwave"></div>
            {particles}
        </div>
    );
};

// --- Skill Animation Components ---
const RadarSweepEffect: React.FC<{ rect: DOMRect }> = ({ rect }) => {
    const style: React.CSSProperties = {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width * 2}px`, // 2x2 area
        height: `${rect.height * 2}px`,
    };
    return (
        <div className="scan-area" style={style}>
            <div className="scan-line"></div>
        </div>
    );
};
const JamWaveEffect: React.FC<{ rect: DOMRect }> = ({ rect }) => {
    const style: React.CSSProperties = {
        left: `${rect.left + rect.width / 2}px`,
        top: `${rect.top + rect.height / 2}px`,
    };
    return <div className="jam-wave" style={style}></div>;
};

const StaticBurstEffect: React.FC<{ rect: DOMRect }> = ({ rect }) => {
    const style: React.CSSProperties = {
        position: 'fixed',
        left: `${rect.left - rect.width}px`,
        top: `${rect.top - rect.height}px`,
        width: `${rect.width * 3}px`,
        height: `${rect.height * 3}px`,
        zIndex: 102,
        pointerEvents: 'none',
    };
    return <div className="static-burst-effect" style={style}></div>;
};

const ActiveActionInfo: React.FC<{ 
    activeAction: any, 
    onSetActiveAction: (action: any) => void,
    onRotatePlacement?: () => void,
    isPlacementHorizontal?: boolean,
}> = ({ activeAction, onSetActiveAction, onRotatePlacement, isPlacementHorizontal }) => {
    let title = '';
    let description = '';

    if (activeAction.type === 'ATTACK') {
        title = 'Attack Mode';
        description = "Select a coordinate to fire.";
    } else { // It's a skill
        switch (activeAction.shipType) {
            case 'Mothership':
                title = 'Escape Maneuver';
                description = `Relocate your Mothership. Press 'R' to rotate.`;
                break;
            case 'Radarship':
                title = 'Radar Scan';
                description = "Select top-left of a 2x2 area.";
                break;
            case 'Repairship':
                title = 'Repair Mode';
                description = "Select a damaged ship part.";
                break;
            case 'Commandship':
                if (activeAction.stage === 'PLACE_SHIP') {
                    title = 'Relocate Ship';
                    description = `Place the ${activeAction.shipToMove.name}. Press 'R' to rotate.`;
                } else {
                    title = 'Relocate Skill';
                    description = "Select a friendly, non-damaged ship (on grid or status bar) to move.";
                }
                break;
            case 'Decoyship':
                title = 'Deploy Decoy';
                description = "Select a cell for a decoy.";
                break;
            case 'Jamship':
                title = 'Signal Jam';
                description = "Select center of a 3x3 area.";
                break;
        }
    }
    
    const isPlacingShip = activeAction.stage === 'PLACE_SHIP' && (activeAction.shipType === 'Mothership' || activeAction.shipType === 'Commandship');

    return (
        <div className="flex items-center justify-center gap-4 p-2 bg-slate-900/50 border border-cyan-500 command-panel action-panel-throb fade-in-down">
            <InfoIcon className="w-6 h-6 text-cyan-400 flex-shrink-0" />
            <div className="text-left">
                <h3 className="text-base font-bold text-white">{title}</h3>
                <p className="text-xs text-slate-300">{description}</p>
            </div>
            {isPlacingShip && onRotatePlacement && (
                <button 
                    onClick={onRotatePlacement}
                    className="btn-angular flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-3"
                >
                    <RotateIcon className="w-5 h-5" />
                    <span className="hidden sm:inline">Rotate ({isPlacementHorizontal ? 'H' : 'V'})</span>
                </button>
            )}
            <button onClick={() => onSetActiveAction(null)} className="btn-angular flex items-center gap-2 btn-red text-white font-semibold py-2 px-3">
                <CancelIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Cancel</span>
            </button>
        </div>
    );
};


interface GamePhaseProps {
  game: GameState;
  playerId: string;
  onFireShot: (targetPlayerId: string | null, x: number, y: number) => void;
  onSurrender: () => void;
  onSetActiveAction: (action: any) => void;
  onUseSkill: (skillType: ShipType, options: any) => Promise<boolean>;
  onEndTurn: () => void;
  onActivateMothershipEscape: () => void;
  onSelectShipForRelocation: (ship: Ship) => void;
  viewMode: 'desktop' | 'mobile';
  setViewMode: (mode: 'desktop' | 'mobile') => void;
}

const GamePhase: React.FC<GamePhaseProps> = ({ 
    game, playerId, onFireShot, onSurrender, 
    onSetActiveAction, onUseSkill, onEndTurn, 
    onActivateMothershipEscape, onSelectShipForRelocation,
    viewMode, setViewMode 
}) => {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  
  const [shotAnimation, setShotAnimation] = useState<{ startRect: DOMRect, endRect: DOMRect } | null>(null);
  const [explosion, setExplosion] = useState<DOMRect | null>(null);
  const [repairAnimation, setRepairAnimation] = useState<{ rect: DOMRect; key: number } | null>(null);
  const [skillAnimation, setSkillAnimation] = useState<{ type: string; rect: DOMRect; key: number } | null>(null);
  const [staticBurst, setStaticBurst] = useState<{ rect: DOMRect; key: number } | null>(null);
  const [hoveredCellEl, setHoveredCellEl] = useState<HTMLElement | null>(null);
  const isAnimating = useRef(false);
  const mothershipRef = useRef<HTMLDivElement>(null);
  const cannonTipRef = useRef<HTMLDivElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [isPlacementHorizontal, setIsPlacementHorizontal] = useState(true);
  const endTurnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSurrenderModalOpen, setIsSurrenderModalOpen] = useState(false);

  // --- Player and Turn Logic ---
  const localPlayer = useMemo(() => game.players.find(p => p.id === playerId)!, [game.players, playerId]);
  const opponent = useMemo(() => game.players.find(p => p.id !== playerId)!, [game.players, playerId]);
  const turnPlayer = game.players.find(p => p.id === game.currentPlayerId);

  if (!turnPlayer || !localPlayer || !opponent) return null;

  const isMyTurn = game.currentPlayerId === playerId;
  const isAITurn = !!turnPlayer.isAI;
  const canTakeAction = isMyTurn && !game.hasActedThisTurn;
  const showEndTurnButton = isMyTurn && game.hasActedThisTurn;
  const turnIndicatorColor = isMyTurn ? 'text-green-400' : 'text-orange-400';
  
  const [animatedShot, setAnimatedShot] = useState<GameLogEntry | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);

  // Auto End Turn Logic
  useEffect(() => {
    if (endTurnTimerRef.current) {
        clearTimeout(endTurnTimerRef.current);
    }

    if (showEndTurnButton) {
        endTurnTimerRef.current = setTimeout(() => {
            onEndTurn();
        }, 4000);
    }

    return () => {
        if (endTurnTimerRef.current) {
            clearTimeout(endTurnTimerRef.current);
        }
    };
  }, [showEndTurnButton, onEndTurn]);

  useEffect(() => {
    setShotAnimation(null);
    setExplosion(null);
    setRepairAnimation(null);
    setSkillAnimation(null);
    setStaticBurst(null);
    setAnimatedShot(null);
    isAnimating.current = false;
  }, [game.turn, game.currentPlayerId]);

  const activeAction = game.activeAction;

  useEffect(() => {
    if (activeAction?.stage === 'PLACE_SHIP') setIsPlacementHorizontal(activeAction.isHorizontal ?? true);
  }, [activeAction]);

  useEffect(() => {
    const isPlacingShip = activeAction?.stage === 'PLACE_SHIP' && (activeAction.shipType === 'Mothership' || activeAction.shipType === 'Commandship');
    const handleKeyDown = (e: KeyboardEvent) => {
        if (isPlacingShip && e.key.toLowerCase() === 'r') {
            e.preventDefault();
            setIsPlacementHorizontal(p => !p);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAction]);

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

  useEffect(() => {
    if (game.log.length > 0) {
        const latestLog = game.log[0];
        if (animatedShot?.turn !== latestLog.turn || (animatedShot.coords?.x !== latestLog.coords?.x || animatedShot.coords?.y !== latestLog.coords?.y)) {
            setAnimatedShot(latestLog);
        }
    }
  }, [game.log]);

  let statusMessage = '';
  if (isAnimating.current) statusMessage = "Firing cannon...";
  else if (isAITurn) statusMessage = "AI is calculating its next move...";
  else if (canTakeAction) statusMessage = "It's your turn to act.";
  else if (showEndTurnButton) statusMessage = "Action complete. Ending turn automatically...";
  else statusMessage = `Waiting for ${turnPlayer?.name || 'player'}...`;
  
  const handleSurrender = () => {
    setIsSurrenderModalOpen(true);
  };

  const handleActionSelect = (actionType: ShipType | 'ATTACK') => {
     if (!canTakeAction) return;
    if (activeAction && (activeAction.shipType === actionType || (actionType === 'ATTACK' && activeAction.type === 'ATTACK'))) {
        onSetActiveAction(null); return;
    }
    if (actionType === 'ATTACK') {
        onSetActiveAction({ playerId, type: 'ATTACK' }); return;
    }
    const ship = localPlayer.ships.find(s => s.type === actionType);
    if (!ship || ship.isSunk) return;
    const cooldown = localPlayer.skillCooldowns[actionType] ?? 0;
    const uses = localPlayer.skillUses[actionType] ?? 1;
    if (cooldown > 0 || uses <= 0) return;
    if (actionType === 'Mothership') { onActivateMothershipEscape(); return; }
    const newAction = { playerId, type: 'SKILL' as const, shipType: actionType };
    if (actionType === 'Commandship') onSetActiveAction({ ...newAction, stage: 'SELECT_SHIP' });
    else if (actionType === 'Decoyship') onSetActiveAction({ ...newAction, stage: 'PLACE_DECOY' });
    else onSetActiveAction(newAction);
  }

  const handleAttack = (targetPlayerId: string | null, x: number, y: number, targetEl: HTMLElement) => {
    if (!canTakeAction || !activeAction || activeAction.type !== 'ATTACK' || isAnimating.current) return;
    const cannonEl = cannonTipRef.current;
    if (!cannonEl) {
        onFireShot(targetPlayerId, x, y); return;
    }
    isAnimating.current = true;
    const startRect = cannonEl.getBoundingClientRect();
    const endRect = targetEl.getBoundingClientRect();
    setShotAnimation({ startRect, endRect });
    setTimeout(() => {
        setExplosion(endRect);
        onFireShot(targetPlayerId, x, y);
        gameContainerRef.current?.focus({ preventScroll: true });
        setTimeout(() => {
            setShotAnimation(null);
            setExplosion(null);
            isAnimating.current = false;
        }, 500);
    }, 700);
  };

  const handleOpponentGridClick = async (targetPlayerId: string | null, x: number, y: number, event?: React.MouseEvent<HTMLButtonElement>) => {
    if (!canTakeAction || !activeAction || !event || !event.currentTarget) return;
    const targetEl = event.currentTarget;
    if (activeAction.type === 'ATTACK') {
      handleAttack(targetPlayerId, x, y, targetEl);
    } else if (activeAction.type === 'SKILL') {
      let success = false;
      if(activeAction.shipType === 'Radarship' || activeAction.shipType === 'Jamship') {
        success = await onUseSkill(activeAction.shipType, { x, y });
      }
      if (success) {
        const rect = targetEl.getBoundingClientRect();
        const now = Date.now();
        if (activeAction.shipType === 'Radarship') {
          setSkillAnimation({ type: 'radar', rect, key: now });
          setTimeout(() => setSkillAnimation(null), 1000);
        } else if (activeAction.shipType === 'Jamship') {
          setSkillAnimation({ type: 'jam', rect, key: now });
          setTimeout(() => setStaticBurst({ rect, key: now + 1 }), 300);
          setTimeout(() => { setSkillAnimation(null); setStaticBurst(null); }, 900);
        }
      }
    }
  }
  
  const handleOwnGridClick = async (x: number, y: number, event?: React.MouseEvent<HTMLButtonElement>) => {
    if (!canTakeAction || !activeAction || !event?.currentTarget) return;
    const targetEl = event.currentTarget;
    if (activeAction.type === 'SKILL') {
        let success = false;
        if (['Repairship', 'Decoyship'].includes(activeAction.shipType)) {
             success = await onUseSkill(activeAction.shipType, { x, y });
        } else if (['Mothership', 'Commandship'].includes(activeAction.shipType) && activeAction.stage === 'PLACE_SHIP') {
             success = await onUseSkill(activeAction.shipType, { x, y, isHorizontal: isPlacementHorizontal });
        }
        if (success && activeAction.shipType === 'Repairship') {
            const rect = targetEl.getBoundingClientRect();
            setRepairAnimation({ rect, key: Date.now() });
        }
    }
  };

  const handleShipClick = async (ship: Ship) => {
    if (canTakeAction && activeAction?.type === 'SKILL' && activeAction.shipType === 'Commandship' && activeAction.stage === 'SELECT_SHIP') {
      onSelectShipForRelocation(ship);
    }
  };

  const gridForPlacementCheck = useMemo(() => {
    if (activeAction?.stage === 'PLACE_SHIP' && activeAction.shipToMove) {
        const gridCopy = createEmptyGrid(game.gridDimensions.rows, game.gridDimensions.cols);
        localPlayer.ships.forEach(ship => {
            if (ship.name !== activeAction.shipToMove.name && ship.positions.length > 0) {
                ship.positions.forEach(pos => { gridCopy[pos.y][pos.x] = CellState.SHIP; });
            }
        });
        return gridCopy;
    }
    return localPlayer.grid;
  }, [localPlayer, activeAction, game.gridDimensions]);
  
  const hoverPreview = useMemo(() => {
    if (!hoveredCell || !activeAction || !canTakeAction) return null;
    let shipLength: number | undefined;
    const isRelocating = activeAction.type === 'SKILL' && ['Mothership', 'Commandship'].includes(activeAction.shipType) && activeAction.stage === 'PLACE_SHIP';
    const isPlacingDecoy = activeAction.type === 'SKILL' && activeAction.shipType === 'Decoyship' && activeAction.stage === 'PLACE_DECOY';
    if (isRelocating && activeAction.shipToMove) shipLength = activeAction.shipToMove.length;
    else if (isPlacingDecoy) shipLength = 1;
    if (shipLength === undefined) return null;
    return { x: hoveredCell.x, y: hoveredCell.y, length: shipLength, isHorizontal: isPlacementHorizontal, isValid: canPlaceShip(gridForPlacementCheck, { length: shipLength }, hoveredCell.x, hoveredCell.y, isPlacementHorizontal, game.gridDimensions)};
  }, [hoveredCell, activeAction, gridForPlacementCheck, game.gridDimensions, canTakeAction, isPlacementHorizontal]);

  const playerGrid = useMemo(() => {
    const newGrid = localPlayer.grid.map(row => [...row]);
    localPlayer.decoyPositions.forEach(pos => {
        if (newGrid[pos.y][pos.x] === CellState.EMPTY) newGrid[pos.y][pos.x] = CellState.DECOY;
    });
    return newGrid;
  }, [localPlayer.grid, localPlayer.decoyPositions]);

  const isOpponentGridDimmed = isMyTurn && activeAction && activeAction.type === 'SKILL' && ['Repairship', 'Decoyship', 'Commandship', 'Mothership'].includes(activeAction.shipType);
  const isOwnGridDimmed = isMyTurn && activeAction && (activeAction.type === 'ATTACK' || (activeAction.type === 'SKILL' && ['Radarship', 'Jamship'].includes(activeAction.shipType)));

  const opponentGridContent = (
      <div className={`grid-container command-panel p-2 sm:p-4 transition-all duration-300 ${opponent.isEliminated ? 'opacity-70' : ''} ${canTakeAction && activeAction && !isOwnGridDimmed ? 'grid-active-turn' : ''}`}>
        <div className="bg-slate-900/50 p-2 text-center command-panel-header mb-4">
            <h2 className="text-2xl font-semibold text-white">{`${opponent.name}${opponent.isAI ? ' (AI)' : ''} ${opponent.isEliminated ? '- ELIMINATED' : ''}`}</h2>
        </div>
        <Grid
          grid={localPlayer.shots[opponent.id] || createEmptyGrid(game.gridDimensions.rows, game.gridDimensions.cols)}
          onCellClick={(x, y, e) => handleOpponentGridClick(opponent.id, x, y, e)}
          isOpponentGrid={true}
          isPlayerTurn={canTakeAction}
          gridDimensions={game.gridDimensions}
          animatedShot={animatedShot?.targetId === opponent.id ? animatedShot : null}
          radarOverlay={game.radarScanResult?.playerId === localPlayer.id ? game.radarScanResult.results : []}
          jammedOverlay={game.jammedArea?.playerId === opponent.id ? game.jammedArea.coords : []}
          activeAction={activeAction}
          isDimmed={isOpponentGridDimmed}
          onCellMouseEnter={(_, __, e) => setHoveredCellEl(e.currentTarget)}
          onCellMouseLeave={() => setHoveredCellEl(null)}
        />
        <ShipStatus ships={opponent.ships} isOpponent={true} gameMode={game.gameMode} player={opponent} />
      </div>
  );

  const playerGridContent = (
      <div className={`grid-container command-panel p-2 sm:p-4 transition-all duration-300 ${!canTakeAction && !isOwnGridDimmed && isMyTurn ? 'grid-active-turn' : ''}`}>
         <div className="bg-slate-900/50 p-2 text-center command-panel-header mb-4">
            <h2 className="text-2xl font-semibold text-white">{`${localPlayer.name} (Your Fleet)`}</h2>
        </div>
        <Grid 
            grid={playerGrid} 
            ships={localPlayer.ships}
            gridDimensions={game.gridDimensions}
            activeAction={activeAction}
            isPlayerTurn={canTakeAction}
            onCellClick={handleOwnGridClick}
            onShipPartClick={handleShipClick}
            hoverPreview={hoverPreview}
            onCellMouseEnter={(x, y) => setHoveredCell({x, y})}
            onCellMouseLeave={() => setHoveredCell(null)}
            isDimmed={isOwnGridDimmed}
            mothershipRef={mothershipRef}
            cannonTipRef={cannonTipRef}
            isPlayerGrid={true}
            hoveredCellEl={hoveredCellEl}
            gameMode={game.gameMode}
        />
        <ShipStatus 
          ships={localPlayer.ships} player={localPlayer} grid={localPlayer.grid} gameMode={game.gameMode} 
          onPodClick={handleShipClick} activeAction={activeAction}
        />
      </div>
  );
  
  const centerHubContent = (
      <div className="flex-1 flex justify-center items-center px-2 min-h-[80px]">
           {isMyTurn && !isAnimating.current && !game.hasActedThisTurn && game.gameMode === 'TACTICAL' && (
            activeAction ? (
               <ActiveActionInfo 
                  activeAction={activeAction} onSetActiveAction={onSetActiveAction}
                  onRotatePlacement={() => setIsPlacementHorizontal(p => !p)} isPlacementHorizontal={isPlacementHorizontal}
               />
            ) : ( <div className="action-hub-container"><ActionHub player={localPlayer} activeAction={game.activeAction} onActionSelect={handleActionSelect} /></div> )
          )}
          {isMyTurn && !isAnimating.current && !game.hasActedThisTurn && game.gameMode !== 'TACTICAL' && (
               <div className="flex justify-center">
                  <button 
                    onClick={() => onSetActiveAction({ playerId, type: 'ATTACK' })}
                    className={`btn-angular px-6 py-2 text-base font-bold transition-colors ${activeAction?.type === 'ATTACK' ? 'selected' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}>
                    Select Target
                  </button>
               </div>
          )}
          {showEndTurnButton && (
              <div className="flex justify-center">
                  <button onClick={onEndTurn} className="relative overflow-hidden btn-angular btn-start text-white font-bold py-2 px-6 text-base transition-transform transform hover:scale-105 end-turn-countdown">
                      End Turn
                  </button>
              </div>
          )}
      </div>
  );

  return (
    <>
      <div ref={gameContainerRef} tabIndex={-1} className={`min-h-screen w-full command-background text-white p-2 sm:p-4 md:p-6 fade-in outline-none in-game-view ${viewMode === 'mobile' ? 'mobile-view' : ''}`}>
        <div className="command-background-dots"></div>
        {shotAnimation && <Cannonball startRect={shotAnimation.startRect} endRect={shotAnimation.endRect} />}
        {explosion && <Explosion rect={explosion} />}
        {repairAnimation && <RepairEffect key={repairAnimation.key} rect={repairAnimation.rect} />}
        {skillAnimation?.type === 'radar' && <RadarSweepEffect key={skillAnimation.key} rect={skillAnimation.rect} />}
        {skillAnimation?.type === 'jam' && <JamWaveEffect key={skillAnimation.key} rect={skillAnimation.rect} />}
        {staticBurst && <StaticBurstEffect key={staticBurst.key} rect={staticBurst.rect} />}
        {game.gameMode === 'TACTICAL' && <HelpTab isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />}
        <div className="max-w-screen-2xl mx-auto">
          <header className="flex items-center justify-between mb-4 command-panel p-2 gap-2">
              <div className="flex items-center gap-3 flex-shrink-0">
                  <div>
                      <h1 className="text-xl font-bold text-cyan-400 tracking-wider whitespace-nowrap command-title">
                          {game.gameMode === 'CLASSIC' ? 'CLASSIC BATTLE' : 'TACTICAL COMMAND'}
                      </h1>
                      <p className="text-xs text-slate-400 mt-0.5 min-h-[18px]">{statusMessage}</p>
                  </div>
                  <div className="text-center p-1.5 rounded-md bg-slate-900/50 border border-slate-700">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Turn {game.turn}</p>
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                          {isAITurn && !game.hasActedThisTurn && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-slate-50"></div>}
                          <h2 className={`text-base font-bold truncate max-w-[100px] ${turnIndicatorColor}`}>
                              {turnPlayer?.name || 'Unknown'}
                          </h2>
                      </div>
                  </div>
              </div>
              
              {viewMode === 'desktop' && centerHubContent}

              <div className="flex items-center gap-2 flex-shrink-0">
                  <GameLog log={game.log} players={game.players} currentUserId={playerId} gameMode={game.gameMode} />
                  {game.gameMode === 'TACTICAL' && (
                      <button
                          onClick={() => setIsHelpOpen(true)}
                          className="btn-angular bg-slate-700/50 hover:bg-slate-600/50 text-slate-200 p-3"
                          aria-label="Open Tactical Guide"
                      >
                          <HelpIcon className="w-6 h-6" />
                      </button>
                  )}
                  <button
                      onClick={() => setViewMode(viewMode === 'desktop' ? 'mobile' : 'desktop')}
                      className="btn-angular bg-slate-700/50 hover:bg-slate-600/50 text-slate-200 p-3"
                      aria-label={`Switch to ${viewMode === 'desktop' ? 'mobile' : 'desktop'} view`}
                  >
                      {viewMode === 'desktop' ? <MobileIcon className="w-6 h-6" /> : <DesktopIcon className="w-6 h-6" />}
                  </button>
                  <button
                      onClick={toggleFullscreen}
                      className="btn-angular bg-slate-700/50 hover:bg-slate-600/50 text-slate-200 p-3"
                      aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                  >
                      <FullscreenIcon className="w-6 h-6" isFullscreen={isFullscreen} />
                  </button>
                  <button 
                      onClick={handleSurrender} 
                      className="btn-angular btn-red flex items-center gap-2 p-3"
                      aria-label="Surrender Game"
                  >
                      <ExitIcon className="w-6 h-6" />
                      <span className="hidden sm:inline font-bold">Surrender</span>
                  </button>
              </div>
          </header>
          
          <div className="main-game-layout flex flex-col lg:flex-row gap-6 mt-2">
              {viewMode === 'desktop' ? (
                  <>
                      <div className="lg:w-1/2">{playerGridContent}</div>
                      <div className="lg:w-1/2">{opponentGridContent}</div>
                  </>
              ) : (
                  <>
                      {opponentGridContent}
                      {centerHubContent}
                      {playerGridContent}
                  </>
              )}
          </div>
        </div>
      </div>
      <ConfirmationModal
        isOpen={isSurrenderModalOpen}
        onConfirm={() => {
          onSurrender();
          setIsSurrenderModalOpen(false);
        }}
        onCancel={() => setIsSurrenderModalOpen(false)}
        title="Confirm Surrender"
        message="Are you sure you wish to forfeit the match? This action cannot be undone."
        confirmText="Surrender"
        confirmButtonClass="btn-red"
      />
    </>
  );
};

export default GamePhase;