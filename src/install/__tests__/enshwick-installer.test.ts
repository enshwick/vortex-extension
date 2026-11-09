import { join } from 'node:path';

import type { types } from '@nexusmods/vortex-api';
import { describe, expect, it, vi } from 'vitest';

import { EnshwickInstaller } from '../enshwick-installer';
import { PackageKind } from '../package-kind';

const loaderFiles = ['LICENSE', join('mods', 'enshwick', 'enshwick.dll'), 'powrprof.dll'];
const modFiles = [join('mods', 'you.one', 'one.dll')];

const apiAnswering = (action: string): { api: types.IExtensionApi; asked: () => number } => {
  const showDialog = vi.fn<() => Promise<types.IDialogResult>>(() =>
    Promise.resolve({ action, input: {} }),
  );
  // The installer calls only showDialog; the rest of the API stays unset in these tests.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const api = { showDialog } as unknown as types.IExtensionApi;

  return { api, asked: () => showDialog.mock.calls.length };
};

describe('EnshwickInstaller', () => {
  it('supports Enshwick archives only for Enshrouded', () => {
    expect(EnshwickInstaller.supports(modFiles, 'enshrouded').supported).toBe(true);
    expect(EnshwickInstaller.supports(modFiles, 'skyrimse').supported).toBe(false);
    expect(EnshwickInstaller.supports(['readme.txt'], 'enshrouded').supported).toBe(false);
  });

  it('sets the mod type first, then copies each file', async () => {
    const { api, asked } = apiAnswering('Install');
    const result = await new EnshwickInstaller(api).instructions(modFiles, false);

    expect(result.instructions).toEqual([
      { type: 'setmodtype', value: PackageKind.Mod },
      { type: 'copy', source: modFiles[0], destination: join('mods', 'you.one', 'one.dll') },
    ]);
    expect(asked()).toBe(0);
  });

  it('asks before it installs the loader and installs it on yes', async () => {
    const { api, asked } = apiAnswering('Install');
    const result = await new EnshwickInstaller(api).instructions(loaderFiles, false);

    expect(result.instructions[0]).toEqual({ type: 'setmodtype', value: PackageKind.Loader });
    expect(asked()).toBe(1);
  });

  it('stops the loader install when the player cancels', async () => {
    const { api } = apiAnswering('Cancel');

    await expect(new EnshwickInstaller(api).instructions(loaderFiles, false)).rejects.toMatchObject(
      { data: { kind: 'user-canceled' } },
    );
  });

  it('installs the loader without asking in an unattended install', async () => {
    const { api, asked } = apiAnswering('Cancel');
    const result = await new EnshwickInstaller(api).instructions(loaderFiles, true);

    expect(result.instructions).toHaveLength(4);
    expect(asked()).toBe(0);
  });

  it('refuses an archive it does not support', async () => {
    const { api } = apiAnswering('Install');

    await expect(
      new EnshwickInstaller(api).instructions(['readme.txt'], false),
    ).rejects.toMatchObject({ data: { kind: 'data-invalid' } });
  });
});
