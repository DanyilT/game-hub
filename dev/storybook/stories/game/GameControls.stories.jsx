import { useState } from 'react';
import GameControls from '../../../../src/components/layout/game/GameControls/GameControls';
import { games } from '../../../../src/data/games';

const withControls = games.filter((game) => game.controls);
const controlsOf = Object.fromEntries(withControls.map((game) => [game.id, game.controls]));

/**
 * A game's controls (games.json `controls`): its keys on a keyboard, mouse buttons on a mouse, gestures on a phone.
 * Small in the info column (one device, an arrow to switch), or every device under the game. Point at a key to see
 * what it does.
 */
export default {
  title: 'Game/Controls',
  component: GameControls,
  parameters: { layout: 'padded' },
  render: function Render({ gameId, expanded: startExpanded }) {
    const [expanded, setExpanded] = useState(startExpanded);
    return (
      <div style={{ maxWidth: expanded ? 900 : 380 }}>
        <GameControls controls={controlsOf[gameId]} expanded={expanded} onToggleExpanded={() => setExpanded((open) => !open)} takeFocus={() => false} />
      </div>
    );
  },
  argTypes: { gameId: { control: 'select', options: Object.keys(controlsOf) } },
  args: { gameId: 'snake', expanded: false },
};

export const Small = {};
export const Expanded = { args: { expanded: true } };
export const Minesweeper = { args: { gameId: 'minesweeper', expanded: true } };
export const Tetris = { args: { gameId: 'tetris', expanded: true } };
export const Sudoku = { args: { gameId: 'sudoku', expanded: true } };
