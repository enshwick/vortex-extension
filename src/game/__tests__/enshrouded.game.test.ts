import { describe, expect, it } from 'vitest';

import { EnshroudedGame } from '../enshrouded.game';

describe('EnshroudedGame', () => {
  const game = new EnshroudedGame().describe();

  it('is found through its steam app id', () => {
    expect(game.queryArgs).toEqual({ steam: [{ id: '1203620' }] });
    expect(game.details).toMatchObject({ steamAppId: 1203620 });
  });

  it('is recognised by its executable', () => {
    expect(game.executable()).toBe('enshrouded.exe');
    expect(game.requiredFiles).toEqual(['enshrouded.exe']);
  });

  it('uses the nexus mods id for vortex and the mod pages', () => {
    expect(game.id).toBe('enshrouded');
    expect(game.details).toMatchObject({ nexusPageId: 'enshrouded' });
  });

  it('deploys mods into the game folder', () => {
    expect(game.queryModPath('C:/Games/Enshrouded')).toBe('.');
    expect(game.mergeMods).toBe(true);
  });

  it('starts without the steam client launching it', () => {
    expect(game.environment).toEqual({ SteamAPPId: '1203620' });
  });

  it('offers only copies and hard links', () => {
    expect(game.compatible).toEqual({ symlinks: false });
  });
});
