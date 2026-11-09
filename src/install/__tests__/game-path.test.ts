import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GamePath } from '../game-path';

describe('GamePath', () => {
  it('holds a path of names below the game folder', () => {
    expect(GamePath.of(['mods', 'you.one', 'one.dll']).value).toBe(
      join('mods', 'you.one', 'one.dll'),
    );
    expect(GamePath.accepts(join('mods', '.config', 'a..b'))).toBe(true);
  });

  it('accepts no path that climbs, names a drive or starts at a root', () => {
    for (const path of ['..\\..\\evil.dll', 'mods/../x', 'mods\\.\\x', '..', 'C:\\x', '\\x']) {
      expect({ path, accepted: GamePath.accepts(path) }).toEqual({ path, accepted: false });
    }
  });

  it('builds no path from names that climb out of the game folder', () => {
    expect(() => GamePath.of(['mods', '..', '..', 'x'])).toThrow(RangeError);
  });
});
