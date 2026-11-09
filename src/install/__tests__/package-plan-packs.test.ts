import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ModId } from '../mod-id';
import { PackageKind } from '../package-kind';
import { PackagePlan } from '../package-plan';
import type { DeclaredPack } from '../package-plan';

const destinations = (plan: PackagePlan | undefined): readonly string[] =>
  (plan?.copies ?? []).map((copy) => copy.destination.value);

const pack = (manifest: string, id: string): DeclaredPack => ({ manifest, id: new ModId(id) });

describe('PackagePlan with pack folders', () => {
  it('names a pack folder by the id its manifest declares, not by a versioned wrapper folder', () => {
    const files = [join('greeter-1.0', 'pack.toml'), join('greeter-1.0', 'main.luau')];
    const plan = PackagePlan.of(files, [pack(join('greeter-1.0', 'pack.toml'), 'you.greeter')]);

    expect(plan?.kind).toBe(PackageKind.Mod);
    expect(destinations(plan)).toEqual([
      join('mods', 'you.greeter', 'pack.toml'),
      join('mods', 'you.greeter', 'main.luau'),
    ]);
  });

  it('asks for the manifest of each pack folder, in mods or outside it', () => {
    expect(
      PackagePlan.manifests([
        join('Greeter', 'greeter-1.0', 'pack.toml'),
        join('Greeter', 'greeter-1.0', 'vendor', 'pack.toml'),
        join('Greeter', 'you.one', 'one.dll'),
      ]),
    ).toEqual([join('Greeter', 'greeter-1.0', 'pack.toml')]);
    expect(PackagePlan.manifests([join('mods', 'greeter-1.0', 'pack.toml')])).toEqual([
      join('mods', 'greeter-1.0', 'pack.toml'),
    ]);
    expect(PackagePlan.manifests([join('you.one', 'one.dll')])).toEqual([]);
    expect(PackagePlan.manifests([join('mods', 'enshwick', 'pack.toml')])).toEqual([]);
  });

  it('names a pack folder inside mods by the id its manifest declares too', () => {
    const manifest = join('Greeter 1.0', 'mods', 'greeter-1.0', 'pack.toml');
    const plan = PackagePlan.of(
      [
        manifest,
        join('Greeter 1.0', 'mods', 'greeter-1.0', 'main.luau'),
        join('Greeter 1.0', 'README.md'),
      ],
      [pack(manifest, 'you.greeter')],
    );

    expect(destinations(plan)).toEqual([
      join('mods', 'you.greeter', 'pack.toml'),
      join('mods', 'you.greeter', 'main.luau'),
      join('mods', 'you.greeter', 'README.md'),
    ]);
  });

  it('names a pack folder by its id with a DLL beside the manifest, as the loader reads it', () => {
    const files = [join('greeter-1.0', 'pack.toml'), join('greeter-1.0', 'helper.dll')];
    const plan = PackagePlan.of(files, [pack(join('greeter-1.0', 'pack.toml'), 'you.greeter')]);

    expect(destinations(plan)).toEqual([
      join('mods', 'you.greeter', 'pack.toml'),
      join('mods', 'you.greeter', 'helper.dll'),
    ]);
  });

  it('fits by shape alone, and not when no ids could give the archive a plan', () => {
    expect(PackagePlan.fits([join('greeter-1.0', 'pack.toml')])).toBe(true);
    expect(PackagePlan.fits([join('mods', 'you.one', 'one.dll')])).toBe(true);
    expect(PackagePlan.fits(['powrprof.dll', join('greeter', 'pack.toml')])).toBe(false);
    expect(PackagePlan.fits(['readme.txt'])).toBe(false);
  });

  it('declines mod folders under different roots, rather than drop all but the first', () => {
    const manifest = join('A', 'greeter', 'pack.toml');
    const files = [manifest, join('B', 'you.one', 'one.dll')];

    expect(PackagePlan.fits(files)).toBe(false);
    expect(PackagePlan.of(files, [pack(manifest, 'you.greeter')])).toBeUndefined();
  });

  it('declines a pack whose id Windows refuses as a folder name', () => {
    const manifest = join('g', 'pack.toml');

    expect(PackagePlan.of([manifest], [pack(manifest, 'nul.greeter')])).toBeUndefined();
  });

  it('declines a pack whose id is the folder of another mod of the archive', () => {
    const manifest = join('x', 'pack.toml');
    const files = [join('you.one', 'one.dll'), manifest];

    expect(PackagePlan.of(files, [pack(manifest, 'you.one')])).toBeUndefined();
    expect(destinations(PackagePlan.of(files, [pack(manifest, 'you.x')]))).toEqual([
      join('mods', 'you.one', 'one.dll'),
      join('mods', 'you.x', 'pack.toml'),
    ]);
  });

  it('declines a pack folder whose id nobody read, rather than guess it from the folder', () => {
    expect(PackagePlan.of([join('you.greeter', 'pack.toml')])).toBeUndefined();
  });

  it('declines two pack folders that declare one id, since one would overwrite the other', () => {
    const files = [join('greeter-1.0', 'pack.toml'), join('greeter-1.1', 'pack.toml')];
    const packs = files.map((manifest) => pack(manifest, 'you.greeter'));

    expect(PackagePlan.of(files, packs)).toBeUndefined();
  });
});
