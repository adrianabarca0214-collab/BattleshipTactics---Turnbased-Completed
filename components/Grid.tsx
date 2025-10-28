import React, { useMemo, useRef, useEffect, useState } from 'react';
import { CellState, Grid as GridType, Ship, GameLogEntry, GameMode } from '../types';
import ExplosionIcon from './icons/ExplosionIcon';
import WaterIcon from './icons/WaterIcon';
import MothershipIcon from './icons/MothershipIcon';
import RadarshipIcon from './icons/RadarshipIcon';
import RepairshipIcon from './icons/RepairshipIcon';
import CommandshipIcon from './icons/CommandshipIcon';
import DecoyshipIcon from './icons/DecoyshipIcon';
import JamshipIcon from './icons/JamshipIcon';
import RadarContactIcon from './icons/RadarContactIcon';
import DecoyBeaconIcon from './icons/DecoyBeaconIcon';

// This defines what information we need about each part of a ship for rendering
interface ShipPart {
  ship: Ship;
  partIndex: number; // 0 for bow, ship.length - 1 for stern
  isHorizontal: boolean;
}

const JamOverlay: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`${className} jam-overlay-animated`}></div>
);

interface GridProps {
  grid: GridType;
  ships?: Ship[]; // Player's own ships for detailed rendering
  onCellClick?: (x: number, y: number, event?: React.MouseEvent<HTMLButtonElement>) => void;
  isOpponentGrid?: boolean;
  isPlayerTurn?: boolean;
  gridDimensions: { rows: number; cols: number };
  animatedShot?: GameLogEntry | null;
  
  // Tactical Mode Props
  radarOverlay?: { x: number; y: number; state: CellState }[];
  jammedOverlay?: { x: number; y: number }[];
  activeAction?: any;
  onShipPartClick?: (ship: Ship) => void;
  isDimmed?: boolean;

  // Props for setup phase or commandship relocate
  isSetup?: boolean;
  onCellMouseEnter?: (x: number, y: number, event: React.MouseEvent<HTMLButtonElement>) => void;
  onCellMouseLeave?: () => void;
  hoverPreview?: { x: number; y: number; length: number; isHorizontal: boolean; isValid: boolean } | null;
  onShipDragStart?: (ship: Ship, partIndex: number) => void;
  onCellDrop?: (x: number, y: number) => void;
  onCellDragOver?: (e: React.DragEvent, x: number, y: number) => void;
  onShipDragEnd?: () => void;
  selectedShipName?: string | null;

  // New props for cannon animation
  mothershipRef?: React.RefObject<HTMLDivElement>;
  cannonTipRef?: React.RefObject<HTMLDivElement>;
  isPlayerGrid?: boolean;
  hoveredCellEl?: HTMLElement | null;
  gameMode?: GameMode;
}

const ShipTypeIcon: React.FC<{type: string, className?: string, style?: React.CSSProperties}> = ({ type, className, style }) => {
    switch(type) {
        case 'Mothership': return <MothershipIcon className={className} style={style} />;
        case 'Radarship': return <RadarshipIcon className={className} style={style} />;
        case 'Repairship': return <RepairshipIcon className={className} style={style} />;
        case 'Commandship': return <CommandshipIcon className={className} style={style} />;
        case 'Decoyship': return <DecoyshipIcon className={className} style={style} />;
        case 'Jamship': return <JamshipIcon className={className} style={style} />;
        default: return null;
    }
}

const Grid: React.FC<GridProps> = ({ 
    grid, 
    ships = [], 
    onCellClick, 
    isOpponentGrid = false, 
    isPlayerTurn = false, 
    isSetup = false,
    onCellMouseEnter,
    onCellMouseLeave,
    hoverPreview,
    gridDimensions,
    onShipDragStart,
    onCellDrop,
    onCellDragOver,
    onShipDragEnd,
    selectedShipName,
    animatedShot,
    radarOverlay = [],
    jammedOverlay = [],
    activeAction,
    onShipPartClick,
    isDimmed,
    mothershipRef,
    cannonTipRef,
    isPlayerGrid,
    hoveredCellEl,
    gameMode,
}) => {
  const cannonBarrelRef = useRef<HTMLDivElement>(null);
  const mothershipBowRef = useRef<HTMLDivElement>(null);
  const [glitchingCell, setGlitchingCell] = useState<{ x: number; y: number } | null>(null);
  const [glitchRotation, setGlitchRotation] = useState(0);
  
  const flagship = useMemo(() => {
    if (!ships || ships.length === 0 || !isPlayerGrid) return null;

    const availableShips = ships.filter(s => !s.isSunk);
    if (availableShips.length === 0) return null;

    if (gameMode === 'TACTICAL') {
        const mothership = availableShips.find(s => s.type === 'Mothership');
        return mothership || null;
    }
    
    return availableShips.sort((a, b) => b.length - a.length)[0];
  }, [ships, gameMode, isPlayerGrid]);


  useEffect(() => {
    if (!cannonBarrelRef.current || !mothershipBowRef.current || !hoveredCellEl) {
        if(cannonBarrelRef.current) cannonBarrelRef.current.style.transform = 'rotate(0deg)';
        return;
    }

    if (activeAction?.type === 'ATTACK') {
        const cannonRect = mothershipBowRef.current.getBoundingClientRect();
        const targetRect = hoveredCellEl.getBoundingClientRect();

        const cannonX = cannonRect.left + cannonRect.width / 2;
        const cannonY = cannonRect.top + cannonRect.height / 2;
        const targetX = targetRect.left + targetRect.width / 2;
        const targetY = targetRect.top + targetRect.height / 2;

        const angleDeg = Math.atan2(targetY - cannonY, targetX - cannonX) * 180 / Math.PI;

        cannonBarrelRef.current.style.transform = `rotate(${angleDeg + 90}deg)`;
    } else {
      cannonBarrelRef.current.style.transform = 'rotate(0deg)';
    }
  }, [hoveredCellEl, activeAction]);

  useEffect(() => {
    if (!jammedOverlay || jammedOverlay.length === 0) {
        setGlitchingCell(null);
        return;
    }

    const intervalId = setInterval(() => {
        const randomIndex = Math.floor(Math.random() * jammedOverlay.length);
        const cellToGlitch = jammedOverlay[randomIndex];
        setGlitchingCell(cellToGlitch);
        setGlitchRotation(Math.floor(Math.random() * 360));

        setTimeout(() => {
            setGlitchingCell(null);
        }, 400); // Duration of the glitch animation
    }, 1500 + Math.random() * 1000); // Every 1.5-2.5 seconds

    return () => clearInterval(intervalId);
  }, [jammedOverlay]);


  const shipsToRender = useMemo(() => {
    return ships;
  }, [ships]);

  // Create a lookup map for quick access to ship info for any cell coordinate
  const shipMap = useMemo(() => {
    const map = new Map<string, ShipPart>();
    if (isOpponentGrid) return map;

    shipsToRender.forEach(ship => {
      if (ship.positions.length > 0) {
        const isHorizontal = ship.positions.length > 1 ? ship.positions[0].y === ship.positions[1].y : true;
        ship.positions.forEach((pos, index) => {
          map.set(`${pos.x},${pos.y}`, { ship, partIndex: index, isHorizontal });
        });
      }
    });
    return map;
  }, [shipsToRender, isOpponentGrid]);

  const getCellContent = (cellState: CellState, shipPart?: ShipPart) => {
    switch (cellState) {
      case CellState.HIT:
         return <ExplosionIcon className={`w-4 h-4 ${shipPart ? 'text-orange-300' : 'text-orange-400'}`} />;
      case CellState.SUNK:
        return <ExplosionIcon className="w-5 h-5 text-red-500 animate-pulse" />;
      case CellState.MISS:
        return <WaterIcon className="w-4 h-4 text-cyan-500" />;
      case CellState.RADAR_CONTACT:
        return <RadarContactIcon className="w-5 h-5 text-cyan-400 radar-contact-pulse" />;
      case CellState.DECOY:
        return <DecoyBeaconIcon className="w-5 h-5 text-purple-400 animate-pulse" />;
      default:
        return null;
    }
  };
  
  const headers = Array.from({ length: gridDimensions.cols }, (_, i) => String.fromCharCode(65 + i));
  const gridStyle = {
    gridTemplateColumns: `min-content repeat(${gridDimensions.cols}, minmax(0, 1fr))`
  };
  
  const isPlacingMode = activeAction?.type === 'SKILL' && 
      ((activeAction.shipType === 'Mothership' && activeAction.stage === 'PLACE_SHIP') ||
       (activeAction.shipType === 'Decoyship' && activeAction.stage === 'PLACE_DECOY') ||
       (activeAction.shipType === 'Commandship' && activeAction.stage === 'PLACE_SHIP'));

  return (
    <div className="relative">
      {isDimmed && <div className="absolute inset-0 bg-slate-900/70 z-30 rounded-lg" />}
      <div 
        className="grid gap-1 text-xs"
        style={gridStyle}
        onMouseLeave={(isSetup || isPlacingMode) ? onCellMouseLeave : undefined}
      >
        <div className="flex items-center justify-center"></div> {/* Top-left empty cell */}
        {headers.map(header => <div key={header} className="flex items-center justify-center text-slate-400">{header}</div>)}
        
        {grid.map((row, y) => (
          <React.Fragment key={y}>
            <div className="flex items-center justify-center text-slate-400">{y + 1}</div>
            {row.map((cell, x) => {
              const shipPart = shipMap.get(`${x},${y}`);
              const isFlagshipBow = flagship && shipPart?.ship.name === flagship.name && shipPart.partIndex === 0;
              let baseClass = 'w-full h-full flex items-center justify-center border border-slate-700/50 transition-colors relative';
              let hoverShipPart = null;
              
              const radarOverlayCell = radarOverlay.find(c => c.x === x && c.y === y);
              const isJammed = jammedOverlay.some(c => c.x === x && c.y === y);
              const isGlitching = glitchingCell?.x === x && glitchingCell?.y === y;
              const displayCellState = radarOverlayCell ? radarOverlayCell.state : cell;

              let isDisabled = !onCellClick || (isSetup && cell === CellState.SHIP);

              if (isOpponentGrid) {
                 if (isJammed) {
                    baseClass += ' bg-purple-900/50';
                 } else if (displayCellState === CellState.RADAR_CONTACT) {
                    baseClass += ' bg-cyan-900/50';
                 } else if (radarOverlayCell) {
                    baseClass += ' bg-cyan-500/30 ring-1 ring-cyan-400';
                 } else if (cell === CellState.HIT) {
                    baseClass += ' bg-orange-900/40';
                 } else if (cell === CellState.SUNK) {
                    baseClass += ' bg-red-900/50';
                 } else if (onCellClick && isPlayerTurn && activeAction && cell === CellState.EMPTY) {
                    baseClass += ' cursor-pointer bg-slate-900/70 hover:bg-slate-700/70';
                 } else {
                    baseClass += ' bg-slate-900/70';
                 }

                 isDisabled = isDisabled || !isPlayerTurn || !activeAction || (cell !== CellState.EMPTY);

                 if (activeAction?.type === 'SKILL' && (activeAction.shipType === 'Radarship' || activeAction.shipType === 'Jamship')) {
                     isDisabled = !isPlayerTurn || !activeAction || cell !== CellState.EMPTY;
                 }
              } else if (isSetup) {
                 baseClass += ' cursor-pointer bg-slate-900/70 border-slate-700 hover:bg-slate-700'
              }
              else { // Own grid, in-game
                  baseClass += ' bg-slate-900/70';
                  isDisabled = true;

                  if (isPlayerTurn && activeAction) {
                      if (activeAction.type === 'SKILL' && activeAction.shipType === 'Repairship' && cell === CellState.HIT) {
                          baseClass += ' cursor-pointer hover:bg-green-700/50 ring-2 ring-green-500/70';
                          isDisabled = false;
                      } 
                      else if (isPlacingMode && cell === CellState.EMPTY) {
                          baseClass += ' cursor-pointer hover:bg-slate-700/70';
                          isDisabled = false;
                      }
                  }
              }

              if ((isSetup || isPlacingMode) && hoverPreview) {
                 const { x: hx, y: hy, length, isHorizontal, isValid } = hoverPreview;
                 const inHoverRange = isHorizontal ? 
                    (y === hy && x >= hx && x < hx + length) : 
                    (x === hx && y >= hy && y < hy + length);

                 if (inHoverRange) {
                    hoverShipPart = {
                        color: isValid ? 'bg-slate-500/50' : 'bg-red-500/50',
                        isBow: isHorizontal ? x === hx : y === hy,
                        isStern: isHorizontal ? x === hx + length - 1 : y === hy + length - 1,
                        isHorizontal: isHorizontal
                    }
                 }
              }
              
              const isAnimated = animatedShot && animatedShot.coords?.x === x && animatedShot.coords?.y === y;

              const isShipTargetable = !isDimmed && onShipPartClick && isPlayerTurn && activeAction?.type === 'SKILL' && activeAction.shipType === 'Commandship' && activeAction.stage === 'SELECT_SHIP' && shipPart && !shipPart.ship.isSunk && !shipPart.ship.isDamaged && !shipPart.ship.hasBeenRelocated;

              return (
              <div key={`${x}-${y}`} className="aspect-square" ref={isFlagshipBow ? mothershipBowRef : null}>
                <button
                  className={`${baseClass}`}
                  onClick={(e) => !isDimmed && onCellClick && onCellClick(x, y, e)}
                  onMouseEnter={isOpponentGrid ? (e) => onCellMouseEnter && onCellMouseEnter(x, y, e) : (isSetup || isPlacingMode) ? () => onCellMouseEnter && onCellMouseEnter(x, y, null!) : undefined}
                  onMouseLeave={onCellMouseLeave}
                  onDrop={(e) => { e.preventDefault(); onCellDrop && onCellDrop(x,y); }}
                  onDragOver={(e) => onCellDragOver && onCellDragOver(e, x, y)}
                  disabled={isDisabled || isDimmed}
                  aria-label={`Cell ${headers[x]}${y + 1}, state: ${cell}`}
                >
                  {isJammed && <JamOverlay className="absolute inset-0 w-full h-full opacity-70 z-20 pointer-events-none" />}
                  {isGlitching && <div
                    className="absolute inset-0 electric-cell-effect z-20 pointer-events-none"
                    style={{ '--rot': `${glitchRotation}deg` } as React.CSSProperties}
                  ></div>}

                   {shipPart && shipPart.partIndex === 0 && (
                      <div
                          className="absolute top-0 left-0"
                          style={{
                            width: shipPart.isHorizontal ? `${shipPart.ship.length * 100}%` : '100%',
                            height: shipPart.isHorizontal ? '100%' : `${shipPart.ship.length * 100}%`,
                            zIndex: 5,
                            pointerEvents: 'none',
                          }}
                        >
                          <div
                            className="w-full h-full ship-container"
                            style={{ '--animation-delay': `${(((x * 7) + y) % 10) * 0.3}s` } as React.CSSProperties}
                          >
                           {shipPart.ship.isSunk ? (
                              <div className="absolute inset-0.5 bg-slate-800 border border-slate-700 rounded-full opacity-80" />
                            ) : (
                              <>
                                <div className={`w-full h-full ship-body ${shipPart.isHorizontal ? 'is-horizontal' : 'is-vertical'}
                                  ${isSetup && selectedShipName === shipPart.ship.name ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-800' : ''}
                                  ${isShipTargetable ? 'ship-active-glow' : ''}
                                `} />
                                {shipPart.ship.positions.map((pos, index) => {
                                  if (grid[pos.y][pos.x] === CellState.HIT) {
                                    return (
                                      <div
                                        key={index}
                                        className="damage-overlay"
                                        style={{
                                          left: shipPart.isHorizontal ? `${(index / shipPart.ship.length) * 100}%` : '0',
                                          top: shipPart.isHorizontal ? '0' : `${(index / shipPart.ship.length) * 100}%`,
                                          width: shipPart.isHorizontal ? `${100 / shipPart.ship.length}%` : '100%',
                                          height: shipPart.isHorizontal ? '100%' : `${100 / shipPart.ship.length}%`,
                                        }}
                                      ></div>
                                    );
                                  }
                                  return null;
                                })}
                              </>
                            )}
                          </div>
                          {/* This layer handles both setup phase dragging/clicking and in-game skill targeting */}
                          {(isSetup || isShipTargetable) && !shipPart.ship.isSunk && (
                            <div
                              className="ship-interactive-layer"
                              style={{ cursor: isShipTargetable ? 'pointer' : 'grab' }}
                              title={shipPart.ship.name}
                              draggable={isSetup && selectedShipName === shipPart.ship.name}
                              onDragStart={(e) => {
                                e.stopPropagation();
                                if (!isSetup || !onShipDragStart) return;
                                const rect = e.currentTarget.getBoundingClientRect();
                                let partIndex = 0;
                                if (shipPart.isHorizontal) {
                                  const offsetX = e.clientX - rect.left;
                                  const cellWidth = rect.width / shipPart.ship.length;
                                  partIndex = Math.floor(offsetX / cellWidth);
                                } else {
                                  const offsetY = e.clientY - rect.top;
                                  const cellHeight = rect.height / shipPart.ship.length;
                                  partIndex = Math.floor(offsetY / cellHeight);
                                }
                                onShipDragStart(shipPart.ship, partIndex);
                              }}
                              onDragEnd={(e) => {
                                e.stopPropagation();
                                onShipDragEnd && onShipDragEnd();
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isDimmed) return;
                                if (isShipTargetable && onShipPartClick) {
                                    onShipPartClick(shipPart.ship);
                                }
                              }}
                            />
                          )}
                      </div>
                   )}

                  {shipPart && shipPart.partIndex === 0 && !shipPart.ship.isSunk && (
                      <div
                          className="absolute top-0 left-0 flex items-center justify-center pointer-events-none"
                          style={{
                              width: shipPart.isHorizontal ? `${shipPart.ship.length * 100}%` : '100%',
                              height: shipPart.isHorizontal ? '100%' : `${shipPart.ship.length * 100}%`,
                              zIndex: 25,
                          }}
                      >
                          <ShipTypeIcon type={shipPart.ship.type} className="w-6 h-6 text-slate-200" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))' }}/>
                      </div>
                  )}
                  
                  {isFlagshipBow && (
                     <div ref={mothershipRef} className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                        <div className="w-6 h-6 bg-slate-700 rounded-full shadow-md border-2 border-slate-500">
                           <div ref={cannonBarrelRef} className="absolute bottom-1/2 left-1/2 w-3 h-10 bg-gradient-to-t from-slate-600 to-slate-500 rounded-t-md -translate-x-1/2 origin-bottom transition-transform duration-200 ease-out shadow-lg" style={{transform: 'rotate(0deg)'}}>
                              <div ref={cannonTipRef} className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-slate-800 rounded-sm"></div>
                           </div>
                        </div>
                     </div>
                  )}

                  {hoverShipPart && (
                    <div className={`absolute inset-0.5 z-10 flex items-center justify-center ${hoverShipPart.color} ${
                        (activeAction?.shipType !== 'Decoyship') ? (
                          hoverShipPart.isHorizontal 
                          ? `${hoverShipPart.isBow ? 'rounded-l-full' : ''} ${hoverShipPart.isStern ? 'rounded-r-full' : ''}`
                          : `${hoverShipPart.isBow ? 'rounded-t-full' : ''} ${hoverShipPart.isStern ? 'rounded-b-full' : ''}`
                        ) : 'rounded-md'
                    }`}>
                      {activeAction?.type === 'SKILL' && activeAction.shipType === 'Decoyship' && (
                        <DecoyBeaconIcon className="w-5 h-5 text-purple-200 opacity-70" />
                      )}
                    </div>
                  )}

                  <div className="relative z-20">
                     {getCellContent(displayCellState, shipPart)}
                  </div>
                </button>
              </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default Grid;