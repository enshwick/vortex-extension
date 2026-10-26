import { join, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PackageKind } from '../../model/package-kind';
import { PackageInstaller } from '../package.installer';

const listed = (...paths: string[]): string[] => paths.map((path) => path.split('/').join(sep));
const bundle = listed(
  'LICENSE',
  'mods/',
  'mods/enshwick/',
  'mods/enshwick/enshwick.dll',
  'mods/area-loot.dll',
  'powrprof.dll',
);
const mod = listed(
  'area-loot/',
  'area-loot/LICENSE',
  'area-loot/mods/',
  'area-loot/mods/area-loot.dll',
);
const loader = new PackageInstaller(PackageKind.Loader);
const mods = new PackageInstaller(PackageKind.Mods);

describe('PackageInstaller', () => {
  it('claims the archives of its own kind for enshrouded', async () => {
    expect((await loader.test(bundle, 'enshrouded')).supported).toBe(true);
    expect((await mods.test(bundle, 'enshrouded')).supported).toBe(false);
    expect((await mods.test(mod, 'enshrouded')).supported).toBe(true);
    expect((await loader.test(mod, 'enshrouded')).supported).toBe(false);
  });

  it('leaves the archives of other games alone', async () => {
    expect((await loader.test(bundle, 'skyrimse')).supported).toBe(false);
    expect((await mods.test(mod, 'skyrimse')).supported).toBe(false);
  });

  it('refuses a listing that leaves the archive', async () => {
    expect((await mods.test(listed('../mods/x.dll'), 'enshrouded')).supported).toBe(false);
  });

  it('copies each file to its place and records the kind', async () => {
    const { instructions } = await mods.install(mod);

    expect(instructions).toEqual([
      {
        type: 'copy',
        source: join('area-loot', 'LICENSE'),
        destination: join('mods', 'area-loot.LICENSE'),
      },
      {
        type: 'copy',
        source: join('area-loot', 'mods', 'area-loot.dll'),
        destination: join('mods', 'area-loot.dll'),
      },
      { type: 'attribute', key: 'enshwickPackage', value: 'mods' },
    ]);
  });

  it('places the stub beside the game and the loader in its folder', async () => {
    const { instructions } = await loader.install(bundle);
    const destinations = instructions.map((instruction) => instruction.destination);

    expect(destinations).toEqual([
      join('mods', 'enshwick', 'LICENSE'),
      join('mods', 'enshwick', 'enshwick.dll'),
      join('mods', 'area-loot.dll'),
      'powrprof.dll',
      undefined,
    ]);
    expect(instructions.at(-1)).toEqual({
      type: 'attribute',
      key: 'enshwickPackage',
      value: 'loader',
    });
  });

  it('has one id per kind', () => {
    expect(loader.id).toBe('enshwick-loader');
    expect(mods.id).toBe('enshwick-mods');
  });
});
