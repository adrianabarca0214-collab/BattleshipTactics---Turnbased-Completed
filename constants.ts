
import { Ship } from './types';

// FIX: Corrected the Omit type to include 'hasBeenRelocated' and removed the property from the objects to match the GameState type definition.
export const SHIPS_CONFIG_DEFAULT: Omit<Ship, 'positions' | 'isSunk' | 'isDamaged' | 'type' | 'hasBeenRepaired' | 'hasBeenRelocated'>[] = [
  { name: 'Carrier', length: 5 },
  { name: 'Battleship', length: 4 },
  { name: 'Cruiser', length: 3 },
  { name: 'Submarine', length: 3 },
  { name: 'Destroyer', length: 2 },
];

// FIX: Corrected the Omit type to include 'hasBeenRelocated' and removed the property from the objects to match the GameState type definition.
export const SHIPS_CONFIG_TACTICAL: Omit<Ship, 'positions' | 'isSunk' | 'isDamaged' | 'hasBeenRepaired' | 'hasBeenRelocated'>[] = [
    { name: 'Commandship', type: 'Commandship', length: 5 },
    { name: 'Decoyship', type: 'Decoyship', length: 4 },
    { name: 'Radarship', type: 'Radarship', length: 3 },
    { name: 'Repairship', type: 'Repairship', length: 3 },
    { name: 'Jamship', type: 'Jamship', length: 3 },
    { name: 'Mothership', type: 'Mothership', length: 2 },
];

export const getGameConfig = (mode: 'CLASSIC' | 'TACTICAL') => {
    if (mode === 'TACTICAL') {
        return {
            gridDimensions: { rows: 12, cols: 12 },
            shipsConfig: SHIPS_CONFIG_TACTICAL,
        };
    }

    return {
        gridDimensions: { rows: 12, cols: 12 },
        shipsConfig: SHIPS_CONFIG_DEFAULT.map(s => ({...s, type: s.name as any})), // Inelegant but works for classic
    };
};
