import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { types } from '@nexusmods/vortex-api';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EnshwickInstaller } from '../enshwick-installer';
import { PackageKind } from '../package-kind';

const loaderFiles = ['LICENSE', join('mods', 'enshwick', 'enshwick.dll'), 'powrprof.dll'];
const modFiles = [join('mods', 'you.one', 'one.dll')];
const packFiles = [join('greeter-1.0', 'pack.toml'), join('greeter-1.0', 'main.luau')];

/** The folder of an archive that needs no file read from it. */
const nowhere = 'nowhere';

const made: string[] = [];

/** A folder that holds the manifests `texts`, by their path, as Vortex extracts an archive. */
const extractedWith = async (texts: Readonly<Record<string, string>>): Promise<string> => {
  const folder = await mkdtemp(join(tmpdir(), 'enshwick-vortex-'));

  made.push(folder);
  await Promise.all(
    Object.entries(texts).map(([file, text]) => Bun.write(join(folder, file), text)),
  );

  return folder;
};

/** A folder that holds `packFiles` as Vortex extracts them, the manifest with the text `manifest`. */
const extracted = (manifest: string): Promise<string> =>
  extractedWith({ [join('greeter-1.0', 'pack.toml')]: manifest });

afterEach(async () => {
  await Promise.all(made.splice(0).map((folder) => rm(folder, { recursive: true, force: true })));
});

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
    const result = await new EnshwickInstaller(api).instructions(modFiles, nowhere, false);

    expect(result.instructions).toEqual([
      { type: 'setmodtype', value: PackageKind.Mod },
      { type: 'copy', source: modFiles[0], destination: join('mods', 'you.one', 'one.dll') },
    ]);
    expect(asked()).toBe(0);
  });

  it('asks before it installs the loader and installs it on yes', async () => {
    const { api, asked } = apiAnswering('Install');
    const result = await new EnshwickInstaller(api).instructions(loaderFiles, nowhere, false);

    expect(result.instructions[0]).toEqual({ type: 'setmodtype', value: PackageKind.Loader });
    expect(asked()).toBe(1);
  });

  it('stops the loader install when the player cancels', async () => {
    const { api } = apiAnswering('Cancel');

    await expect(
      new EnshwickInstaller(api).instructions(loaderFiles, nowhere, false),
    ).rejects.toMatchObject({ data: { kind: 'user-canceled' } });
  });

  it('installs the loader without asking in an unattended install', async () => {
    const { api, asked } = apiAnswering('Cancel');
    const result = await new EnshwickInstaller(api).instructions(loaderFiles, nowhere, true);

    expect(result.instructions).toHaveLength(4);
    expect(asked()).toBe(0);
  });

  it('installs a pack from a versioned wrapper folder under the id its manifest declares', async () => {
    const { api } = apiAnswering('Install');
    const folder = await extracted('id = "you.greeter"\nversion = "1.0.0"\n');
    const result = await new EnshwickInstaller(api).instructions(packFiles, folder, false);

    expect(EnshwickInstaller.supports(packFiles, 'enshrouded').supported).toBe(true);
    expect(result.instructions).toEqual([
      { type: 'setmodtype', value: PackageKind.Mod },
      { type: 'copy', source: packFiles[0], destination: join('mods', 'you.greeter', 'pack.toml') },
      { type: 'copy', source: packFiles[1], destination: join('mods', 'you.greeter', 'main.luau') },
    ]);
  });

  it('declines a pack whose manifest declares no usable id, and names the manifest', async () => {
    const { api } = apiAnswering('Install');
    const manifests = ['version = "1.0.0"\n', 'id = "Greeter"\n', 'id = "con.greeter"\n', 'id = '];
    const folders = await Promise.all(manifests.map((manifest) => extracted(manifest)));

    for (const folder of [...folders, nowhere]) {
      const install = (): Promise<unknown> =>
        new EnshwickInstaller(api).instructions(packFiles, folder, false);

      // Each case is one install, read in order.
      // oxlint-disable-next-line no-await-in-loop
      await expect(install()).rejects.toThrow(join('greeter-1.0', 'pack.toml'));
      // The same install again, for the error's kind.
      // oxlint-disable-next-line no-await-in-loop
      await expect(install()).rejects.toMatchObject({ data: { kind: 'data-invalid' } });
    }
  });

  it('leaves another program’s stub with a pack folder to other installers', () => {
    const files = ['powrprof.dll', join('greeter', 'pack.toml')];

    expect(EnshwickInstaller.supports(files, 'enshrouded').supported).toBe(false);
  });

  it('declines pack folders that declare one id, and names their manifests and the id', async () => {
    const { api } = apiAnswering('Install');
    const files = [join('greeter-1.0', 'pack.toml'), join('greeter-1.1', 'pack.toml')];
    const folder = await extractedWith(
      Object.fromEntries(files.map((file) => [file, 'id = "you.greeter"\n'])),
    );
    const install = new EnshwickInstaller(api).instructions(files, folder, false);

    await expect(install).rejects.toMatchObject({ data: { kind: 'data-invalid' } });
    await expect(install).rejects.toThrow(`${files[0]} (you.greeter), ${files[1]} (you.greeter)`);
    await expect(install).rejects.not.toThrow('holds no Enshwick package');
  });

  it('refuses an archive it does not support', async () => {
    const { api } = apiAnswering('Install');

    await expect(
      new EnshwickInstaller(api).instructions(['readme.txt'], nowhere, false),
    ).rejects.toMatchObject({ data: { kind: 'data-invalid' } });
  });
});
