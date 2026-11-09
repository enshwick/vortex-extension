import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { types } from '@nexusmods/vortex-api';
import { describe, expect, it } from 'vitest';

import { PackageKind } from '../../install/package-kind';
import { LoaderCheck } from '../loader-check';

const mods = {
  loader: { type: PackageKind.Loader },
  rates: { type: PackageKind.Mod },
  other: { type: '' },
};

const enabled =
  (...ids: readonly string[]) =>
  (modId: string): boolean =>
    ids.includes(modId);

describe('LoaderCheck.isMissing', () => {
  it('warns when an Enshwick mod is on and no loader is, in Vortex or the game folder', () => {
    expect(LoaderCheck.isMissing(mods, enabled('rates', 'other'), false)).toBe(true);
  });

  it('passes when the loader is enabled in Vortex', () => {
    expect(LoaderCheck.isMissing(mods, enabled('rates', 'loader'), false)).toBe(false);
  });

  it('passes when the loader was installed into the game folder by hand', () => {
    expect(LoaderCheck.isMissing(mods, enabled('rates'), true)).toBe(false);
  });

  it('passes when no Enshwick mod is on, whatever else is', () => {
    expect(LoaderCheck.isMissing(mods, enabled('other'), false)).toBe(false);
    expect(LoaderCheck.isMissing({}, enabled(), false)).toBe(false);
  });

  it('counts a disabled Enshwick mod as off', () => {
    expect(LoaderCheck.isMissing(mods, enabled(), false)).toBe(false);
  });
});

/** A Vortex state with one Enshwick mod enabled and the game found at `gamePath`. */
const stateWith = (gameId: string, gamePath: string): unknown => ({
  settings: {
    profiles: { activeProfileId: 'p' },
    gameMode: { discovered: { enshrouded: { path: gamePath } } },
  },
  persistent: {
    profiles: { p: { gameId, modState: { rates: { enabled: true } } } },
    mods: { enshrouded: { rates: { type: PackageKind.Mod } } },
  },
});

const run = (state: unknown): Promise<types.IHealthCheckResult> =>
  // The stub API holds only the state the check reads.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  LoaderCheck.healthCheck().check({ getState: () => state } as unknown as types.IExtensionApi);

describe('LoaderCheck.healthCheck', () => {
  it('warns with a fix when the profile enables a mod and the game folder has no loader', async () => {
    const game = await mkdtemp(join(tmpdir(), 'enshwick-game-'));
    const result = await run(stateWith('enshrouded', game));

    expect(result.status).toBe('warning');
    expect(result.fixAvailable).toBe(true);
  });

  it('passes when the loader was put into the game folder by hand', async () => {
    const game = await mkdtemp(join(tmpdir(), 'enshwick-game-'));

    await Bun.write(join(game, 'powrprof.dll'), '');
    await Bun.write(join(game, 'mods', 'enshwick', 'enshwick.dll'), '');

    expect((await run(stateWith('enshrouded', game))).status).toBe('passed');
  });

  it('passes while a profile of another game is active', async () => {
    const game = await mkdtemp(join(tmpdir(), 'enshwick-game-'));

    expect((await run(stateWith('skyrim', game))).status).toBe('passed');
  });

  it('runs again at Vortex start, so a loader added or removed meanwhile is seen', () => {
    expect(LoaderCheck.healthCheck().triggers).toContain('startup');
  });
});
