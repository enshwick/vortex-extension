import { link, mkdir, mkdtemp, readdir, rm, stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';

import type { types } from '@nexusmods/vortex-api';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PackageKind } from '../../model/package-kind';
import { PackageInstaller } from '../package.installer';

// Vortex extracts an archive, runs the installer that claims it, copies the files the
// instructions name into the mod's staging folder and, with hard link deployment, links every
// staged file into the game folder. This test does the same on the disk and checks the game
// folder the loader then reads.

const archives: Record<string, Record<string, string>> = {
  enshwick: {
    LICENSE: 'MIT',
    'powrprof.dll': 'stub',
    'mods/enshwick/enshwick.dll': 'loader',
    'mods/game-rates.dll': 'game rates',
  },
  'area-loot': { 'area-loot-dev/LICENSE': 'MIT', 'area-loot-dev/mods/area-loot.dll': 'area loot' },
  'build-camera': { LICENSE: 'MIT', 'mods/build-camera.dll': 'build camera' },
};
const loader = new PackageInstaller(PackageKind.Loader);
const mods = new PackageInstaller(PackageKind.Mods);
let root = '';
const game = (): string => join(root, 'game');
const staging = (name: string): string => join(root, 'staging', name);

/** Every file and folder under `dir` as Vortex lists an archive: relative, folders with a separator. */
const listing = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });

  return entries.map((entry) => {
    const path = relative(dir, join(entry.parentPath, entry.name));

    return entry.isDirectory() ? `${path}${sep}` : path;
  });
};

/** Extracts the archive, lets the installer that claims it run and stages what it names. */
const install = async (name: string): Promise<void> => {
  const extracted = join(root, 'extracted', name);

  await Promise.all(
    Object.entries(archives[name] ?? {}).map(([path, text]) =>
      Bun.write(join(extracted, path), text),
    ),
  );

  const files = await listing(extracted);
  const [claimsLoader, claimsMods] = await Promise.all([
    loader.test(files, 'enshrouded'),
    mods.test(files, 'enshrouded'),
  ]);
  const installer = claimsLoader.supported ? loader : mods;

  expect(claimsLoader.supported !== claimsMods.supported).toBe(true);

  const { instructions } = await installer.install(files);
  const copies = instructions.filter(
    (instruction): instruction is types.IInstruction & { source: string; destination: string } =>
      instruction.type === 'copy' &&
      instruction.source !== undefined &&
      instruction.destination !== undefined,
  );

  await Promise.all(
    copies.map(({ source, destination }) =>
      Bun.write(join(staging(name), destination), Bun.file(join(extracted, source))),
    ),
  );
};

/** Links every staged file of the mod into the game folder, as hard link deployment does. */
const deploy = async (name: string): Promise<string[]> => {
  const files = (await listing(staging(name))).filter((path) => !path.endsWith(sep));

  await Promise.all(
    files.map(async (path) => {
      await mkdir(dirname(join(game(), path)), { recursive: true });
      await link(join(staging(name), path), join(game(), path));
    }),
  );

  return files;
};

describe('hard link deployment', () => {
  const deployed: string[] = [];

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'enshwick-vortex-'));
    await mkdir(game());

    const names = Object.keys(archives);

    await Promise.all(names.map((name) => install(name)));
    const files = await Promise.all(names.map((name) => deploy(name)));

    deployed.push(...files.flat());
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('puts the stub beside the game and the loader where the stub loads it', async () => {
    expect(await Bun.file(join(game(), 'powrprof.dll')).text()).toBe('stub');
    expect(await Bun.file(join(game(), 'mods', 'enshwick', 'enshwick.dll')).text()).toBe('loader');
  });

  it('leaves exactly the mods in the folder the loader reads them from', async () => {
    const found = await readdir(join(game(), 'mods'));

    expect(found.filter((name) => name.endsWith('.dll')).toSorted()).toEqual([
      'area-loot.dll',
      'build-camera.dll',
      'game-rates.dll',
    ]);
  });

  it('gives every archive its own license file', async () => {
    expect(await Bun.file(join(game(), 'LICENSE')).exists()).toBe(false);
    expect(deployed).toEqual(
      expect.arrayContaining([
        join('mods', 'enshwick', 'LICENSE'),
        join('mods', 'area-loot.LICENSE'),
        join('mods', 'build-camera.LICENSE'),
      ]),
    );
  });

  it('links each deployed file to its staged copy', async () => {
    const stub = await stat(join(game(), 'powrprof.dll'));
    const staged = await stat(join(staging('enshwick'), 'powrprof.dll'));
    const links = await Promise.all(deployed.map((path) => stat(join(game(), path))));

    expect(stub.ino).toBe(staged.ino);
    expect(links.map((linked) => linked.nlink)).toEqual(deployed.map(() => 2));
  });

  it('keeps the staged files when the links are purged', async () => {
    await Promise.all(deployed.map((path) => unlink(join(game(), path))));

    expect(await Bun.file(join(staging('area-loot'), 'mods', 'area-loot.dll')).text()).toBe(
      'area loot',
    );
  });
});
