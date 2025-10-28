import { CellState, Grid, Player, GameState, Ship, ShipType } from '../types';
import { createEmptyGrid } from "./gameLogic";

/**
 * Checks if a ship can be placed on a grid, considering existing shots.
 * A placement is valid if it doesn't overlap with any MISS cells.
 * @param shotsGrid The grid showing hits, misses, etc.
 * @param ship The ship to place.
 * @param x The starting x-coordinate.
 * @param y The starting y-coordinate.
 * @param isHorizontal The orientation of the ship.
 * @param gridDimensions The dimensions of the grid.
 * @returns True if the placement is valid, false otherwise.
 */
const canShipBePlaced = (
    shotsGrid: Grid,
    ship: { length: number },
    x: number,
    y: number,
    isHorizontal: boolean,
    gridDimensions: { rows: number, cols: number }
): boolean => {
    if (isHorizontal) {
        if (x + ship.length > gridDimensions.cols) return false;
        for (let i = 0; i < ship.length; i++) {
            if ((shotsGrid[y]?.[x + i] ?? CellState.EMPTY) === CellState.MISS) return false;
        }
    } else {
        if (y + ship.length > gridDimensions.rows) return false;
        for (let i = 0; i < ship.length; i++) {
            if ((shotsGrid[y + i]?.[x] ?? CellState.EMPTY) === CellState.MISS) return false;
        }
    }
    return true;
};

/**
 * Builds a probability map indicating the likelihood of a ship occupying each cell.
 * @param opponent The opponent player whose ships we are trying to find.
 * @param shotsGrid The AI's grid of shots taken against the opponent.
 * @param gridDimensions The dimensions of the game grid.
 * @returns A 2D array representing the probability heatmap.
 */
const buildProbabilityMap = (
    opponent: Player,
    shotsGrid: Grid,
    gridDimensions: { rows: number, cols: number }
): number[][] => {
    const probabilityMap: number[][] = Array(gridDimensions.rows).fill(0).map(() => Array(gridDimensions.cols).fill(0));
    const unsunkShips = opponent.ships.filter(ship => !ship.isSunk);

    // Get all known HIT locations that are not yet part of a SUNK ship.
    const hitCells: { x: number, y: number }[] = [];
    for (let y = 0; y < gridDimensions.rows; y++) {
        for (let x = 0; x < gridDimensions.cols; x++) {
            if ((shotsGrid[y]?.[x] ?? CellState.EMPTY) === CellState.HIT) {
                hitCells.push({ x, y });
            }
        }
    }

    for (const ship of unsunkShips) {
        for (let y = 0; y < gridDimensions.rows; y++) {
            for (let x = 0; x < gridDimensions.cols; x++) {
                // Try placing horizontally
                if (canShipBePlaced(shotsGrid, ship, x, y, true, gridDimensions)) {
                    const placementHits = [];
                    for (let i = 0; i < ship.length; i++) {
                        if ((shotsGrid[y]?.[x + i] ?? CellState.EMPTY) === CellState.HIT) {
                            placementHits.push({ x: x + i, y });
                        }
                    }
                    const relevantHits = hitCells.filter(h => h.y === y && h.x >= x && h.x < x + ship.length);
                    if (placementHits.length === relevantHits.length) {
                         for (let i = 0; i < ship.length; i++) {
                            probabilityMap[y][x + i]++;
                        }
                    }
                }
                // Try placing vertically
                if (canShipBePlaced(shotsGrid, ship, x, y, false, gridDimensions)) {
                     const placementHits = [];
                    for (let i = 0; i < ship.length; i++) {
                        if ((shotsGrid[y + i]?.[x] ?? CellState.EMPTY) === CellState.HIT) {
                            placementHits.push({ x, y: y+i });
                        }
                    }
                    const relevantHits = hitCells.filter(h => h.x === x && h.y >= y && h.y < y + ship.length);
                    if (placementHits.length === relevantHits.length) {
                        for (let i = 0; i < ship.length; i++) {
                            probabilityMap[y + i][x]++;
                        }
                    }
                }
            }
        }
    }
    
     // If there are hits, significantly boost the probability of adjacent cells
     // to prioritize sinking confirmed targets.
     if (hitCells.length > 0) {
        hitCells.forEach(hit => {
            const adjacent = [
                {x: hit.x, y: hit.y - 1}, {x: hit.x, y: hit.y + 1},
                {x: hit.x - 1, y: hit.y}, {x: hit.x + 1, y: hit.y}
            ];
            adjacent.forEach(cell => {
                if (cell.x >= 0 && cell.x < gridDimensions.cols && cell.y >= 0 && cell.y < gridDimensions.rows && (shotsGrid[cell.y]?.[cell.x] ?? CellState.EMPTY) === CellState.EMPTY) {
                    probabilityMap[cell.y][cell.x] *= 5; // Heavily weight adjacent cells
                }
            });
        });
    }

    return probabilityMap;
};

/**
 * Finds the coordinates of the cell(s) with the highest probability.
 * @param probabilityMap The probability heatmap.
 * @param shotsGrid The AI's record of shots to avoid targeting known cells.
 * @returns An array of coordinates for the best cells to target.
 */
const findBestTargets = (probabilityMap: number[][], shotsGrid: Grid): { x: number, y: number }[] => {
    let maxProbability = -1;
    let bestTargets: { x: number, y: number }[] = [];

    for (let y = 0; y < probabilityMap.length; y++) {
        for (let x = 0; x < probabilityMap[y].length; x++) {
            if ((shotsGrid[y]?.[x] ?? CellState.EMPTY) === CellState.EMPTY || (shotsGrid[y]?.[x] ?? CellState.EMPTY) === CellState.RADAR_CONTACT) {
                if (probabilityMap[y][x] > maxProbability) {
                    maxProbability = probabilityMap[y][x];
                    bestTargets = [{ x, y }];
                } else if (probabilityMap[y][x] === maxProbability) {
                    bestTargets.push({ x, y });
                }
            }
        }
    }
    return bestTargets;
};

/**
 * Finds the best 2x2 area to scan with Radar based on the probability map.
 * @param probabilityMap The probability heatmap.
 * @param gridDimensions The dimensions of the grid.
 * @returns The top-left coordinate of the best 2x2 area.
 */
const findBestRadarSpot = (probabilityMap: number[][], gridDimensions: { rows: number; cols: number }): { x: number; y: number } => {
    let maxDensity = -1;
    let bestSpot = { x: 0, y: 0 };
    for (let y = 0; y < gridDimensions.rows - 1; y++) {
        for (let x = 0; x < gridDimensions.cols - 1; x++) {
            const density = probabilityMap[y][x] + probabilityMap[y+1][x] + probabilityMap[y][x+1] + probabilityMap[y+1][x+1];
            if (density > maxDensity) {
                maxDensity = density;
                bestSpot = { x, y };
            }
        }
    }
    return bestSpot;
};

/**
 * Finds the best place to deploy a decoy, which is a large area of low probability.
 * @param probabilityMap The probability heatmap.
 * @param shotsGrid The AI's record of shots.
 * @param gridDimensions The dimensions of the grid.
 * @returns A valid coordinate for decoy placement.
 */
const findBestDecoySpot = (probabilityMap: number[][], shotsGrid: Grid, gridDimensions: { rows: number; cols: number }): { x: number; y: number } | null => {
    let minDensity = Infinity;
    const potentialSpots: { x: number; y: number }[] = [];

    for (let y = 0; y < gridDimensions.rows - 1; y++) {
        for (let x = 0; x < gridDimensions.cols - 1; x++) {
             if ((shotsGrid[y]?.[x] ?? CellState.EMPTY) === CellState.EMPTY) {
                const density = probabilityMap[y][x] + probabilityMap[y+1][x] + probabilityMap[y][x+1] + probabilityMap[y+1][x+1];
                if (density < minDensity) {
                    minDensity = density;
                    potentialSpots.length = 0;
                    potentialSpots.push({ x, y });
                } else if (density === minDensity) {
                    potentialSpots.push({ x, y });
                }
             }
        }
    }

    if (potentialSpots.length > 0) {
        return potentialSpots[Math.floor(Math.random() * potentialSpots.length)];
    }
    return null;
}

/**
 * Finds a valuable, healthy ship that is in a threatened position.
 * @param aiPlayer The AI player object.
 * @param probabilityMap The opponent's probability map against the AI.
 * @returns A ship object if a suitable candidate for relocation is found.
 */
const findShipToRelocate = (aiPlayer: Player, opponent: Player, gridDimensions: { rows: number, cols: number }): Ship | null => {
    const opponentShotsGrid = opponent.shots[aiPlayer.id] || createEmptyGrid(gridDimensions.rows, gridDimensions.cols);
    const opponentProbabilityMap = buildProbabilityMap(aiPlayer, opponentShotsGrid, gridDimensions);

    const valuableShipsPriority: ShipType[] = ['Mothership', 'Repairship', 'Jamship', 'Radarship', 'Decoyship', 'Commandship'];
    
    for (const shipType of valuableShipsPriority) {
        const ship = aiPlayer.ships.find(s => s.type === shipType && !s.isDamaged && !s.isSunk && !s.hasBeenRelocated);
        if (ship) {
            const shipThreat = ship.positions.reduce((sum, pos) => sum + (opponentProbabilityMap[pos.y]?.[pos.x] ?? 0), 0);
            if (shipThreat > ship.length * 2) { // Heuristic: if average threat per cell is > 2
                return ship;
            }
        }
    }
    return null;
}


/**
 * Gets a move for the AI in Tactical mode using a probability-based, multi-layered decision-making process.
 */
export const getAITacticalMove = (aiPlayer: Player, opponent: Player, gameState: GameState): any => {
    const { gridDimensions } = gameState;
    const shotsGrid = aiPlayer.shots[opponent.id] || createEmptyGrid(gridDimensions.rows, gridDimensions.cols);
    const probabilityMap = buildProbabilityMap(opponent, shotsGrid, gridDimensions);

    // --- AI DECISION TREE (MASTER TACTICIAN) ---

    // PRIORITY 1: URGENT ACTIONS (WIN/SURVIVE)
    const mothership = aiPlayer.ships.find(s => s.type === 'Mothership');
    if (mothership) {
        if (mothership.isDamaged && aiPlayer.escapeSkillUnlocked && (aiPlayer.skillUses?.Mothership ?? 0) > 0) {
            return { action: "SKILL", shipType: "Mothership" };
        }
        if (mothership.isDamaged && (aiPlayer.skillCooldowns?.Repairship ?? 0) === 0 && !mothership.hasBeenRepaired) {
            const repairableDamage = mothership.positions.find(pos => aiPlayer.grid[pos.y][pos.x] === CellState.HIT && (gameState.hitLog?.[aiPlayer.id]?.[`${pos.x},${pos.y}`] ?? 999) < gameState.turn);
            if (repairableDamage) {
                return { action: "SKILL", shipType: "Repairship", coords: repairableDamage };
            }
        }
    }
    const opponentMothership = opponent.ships.find(s => s.type === 'Mothership');
    if (opponentMothership && opponentMothership.isDamaged) {
        const hitsOnMothership = opponentMothership.positions.filter(pos => (shotsGrid[pos.y]?.[pos.x] ?? CellState.EMPTY) === CellState.HIT);
        if (hitsOnMothership.length === opponentMothership.length - 1) {
            const winningShot = opponentMothership.positions.find(pos => (shotsGrid[pos.y]?.[pos.x] ?? CellState.EMPTY) === CellState.EMPTY);
            if (winningShot) return { action: "ATTACK", coords: winningShot };
        }
    }

    // PRIORITY 2: OFFENSIVE EXECUTION & STRATEGIC POSTURING
    const bestTargets = findBestTargets(probabilityMap, shotsGrid);
    const bestTarget = bestTargets[Math.floor(Math.random() * bestTargets.length)];

    // If confidence is high, it's better to attack than use a skill
    if (bestTarget && probabilityMap[bestTarget.y][bestTarget.x] > 10) {
        return { action: "ATTACK", coords: bestTarget };
    }

    // Jammer to prevent repairs on a damaged ship
    const opponentRepairShip = opponent.ships.find(s => s.type === 'Repairship');
    const hasDamagedOpponent = opponent.ships.some(s => s.isDamaged);
    if ((aiPlayer.skillCooldowns?.Jamship ?? 0) === 0 && hasDamagedOpponent && opponentRepairShip && !opponentRepairShip.isSunk && (opponent.skillCooldowns?.Repairship ?? 0) === 0) {
        const hitCells = [];
        for (let y = 0; y < gridDimensions.rows; y++) for (let x = 0; x < gridDimensions.cols; x++) if ((shotsGrid[y]?.[x] ?? CellState.EMPTY) === CellState.HIT) hitCells.push({x,y});
        if (hitCells.length > 0) {
            const center = hitCells.reduce((acc, c) => ({x: acc.x + c.x, y: acc.y + c.y}), {x:0, y:0});
            center.x = Math.round(center.x / hitCells.length);
            center.y = Math.round(center.y / hitCells.length);
            return { action: "SKILL", shipType: "Jamship", coords: center };
        }
    }

    // Strategic relocation
    if ((aiPlayer.skillCooldowns?.Commandship ?? 0) === 0) {
        const shipToSave = findShipToRelocate(aiPlayer, opponent, gridDimensions);
        if (shipToSave) return { action: "SKILL", shipType: "Commandship", targetShipType: shipToSave.type };
    }

    // Proactive repair of valuable ships
    if ((aiPlayer.skillCooldowns?.Repairship ?? 0) === 0) {
         const damagedShips = aiPlayer.ships.filter(s => s.isDamaged && !s.isSunk && !s.hasBeenRepaired && s.type !== 'Mothership');
         if (damagedShips.length > 0) {
            const shipToRepair = damagedShips.sort((a, b) => b.length - a.length)[0];
            const repairableDamage = shipToRepair.positions.find(pos => aiPlayer.grid[pos.y][pos.x] === CellState.HIT && (gameState.hitLog?.[aiPlayer.id]?.[`${pos.x},${pos.y}`] ?? 999) < gameState.turn);
            if (repairableDamage) return { action: "SKILL", shipType: "Repairship", coords: repairableDamage };
         }
    }

    // PRIORITY 3: INTELLIGENCE GATHERING & HUNTING
    // Use Radar on the most probable area
    if ((aiPlayer.skillCooldowns?.Radarship ?? 0) === 0) {
        const radarSpot = findBestRadarSpot(probabilityMap, gridDimensions);
        if(radarSpot) return { action: "SKILL", shipType: "Radarship", coords: radarSpot };
    }
    
    // Deploy decoys in low-probability areas
    if ((aiPlayer.skillUses?.Decoyship ?? 0) > 0) {
        const decoySpot = findBestDecoySpot(probabilityMap, shotsGrid, gridDimensions);
        if (decoySpot) return { action: "SKILL", shipType: "Decoyship", coords: decoySpot };
    }

    // PRIORITY 4: DEFAULT ATTACK
    // If no strategic move is made, attack the highest probability cell
    if (bestTarget) {
        return { action: "ATTACK", coords: bestTarget };
    }

    // Absolute fallback if no valid moves are found (should be rare)
    const emptyCells = [];
    for(let y=0; y<gridDimensions.rows; y++) for(let x=0; x<gridDimensions.cols; x++) if((shotsGrid[y]?.[x] ?? CellState.EMPTY) === CellState.EMPTY) emptyCells.push({x,y});
    const randomTarget = emptyCells[Math.floor(Math.random() * emptyCells.length)] || {x:0, y:0};
    return { action: "ATTACK", coords: randomTarget };
};


/**
 * Gets a move for the AI in Classic mode using local logic.
 * It follows a Hunt/Target strategy.
 */
export const getAIMove = (shotsGrid: Grid, gridDimensions: { rows: number, cols: number }): { x: number, y: number } => {
    const hitCells: { x: number, y: number }[] = [];
    const emptyCells: { x: number, y: number }[] = [];
    const huntCells: { x: number, y: number }[] = [];

    for (let y = 0; y < gridDimensions.rows; y++) {
        for (let x = 0; x < gridDimensions.cols; x++) {
            const cellState = shotsGrid?.[y]?.[x] || CellState.EMPTY;
            if (cellState === CellState.HIT) {
                hitCells.push({ x, y });
            } else if (cellState === CellState.EMPTY) {
                emptyCells.push({ x, y });
                if ((x + y) % 2 === 0) { // Checkerboard pattern for efficient hunting
                    huntCells.push({ x, y });
                }
            }
        }
    }

    // TARGET MODE: If there are hits, attack adjacent cells to sink the ship.
    if (hitCells.length > 0) {
        const potentialTargets: { x: number, y: number }[] = [];
        for (const hit of hitCells) {
            const adjacent = [
                {x: hit.x, y: hit.y - 1}, {x: hit.x, y: hit.y + 1},
                {x: hit.x - 1, y: hit.y}, {x: hit.x + 1, y: hit.y}
            ];
            for (const cell of adjacent) {
                if (cell.x >= 0 && cell.x < gridDimensions.cols && cell.y >= 0 && cell.y < gridDimensions.rows && (shotsGrid?.[cell.y]?.[cell.x] || CellState.EMPTY) === CellState.EMPTY) {
                    if (!potentialTargets.some(t => t.x === cell.x && t.y === cell.y)) {
                        potentialTargets.push(cell);
                    }
                }
            }
        }
        if (potentialTargets.length > 0) return potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
    }

    // HUNT MODE: Use checkerboard pattern if no active targets.
    if (huntCells.length > 0) return huntCells[Math.floor(Math.random() * huntCells.length)];
    
    // FALLBACK: If checkerboard is full, pick any remaining empty cell.
    if (emptyCells.length > 0) return emptyCells[Math.floor(Math.random() * emptyCells.length)];

    return { x: 0, y: 0 };
};
