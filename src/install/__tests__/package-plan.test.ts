import { join, sep } from 'node:path';

import { array, assert, constantFrom, oneof, property, uniqueArray } from 'fast-check';
import { describe, expect, it } from 'vitest';

import { ModId } from '../mod-id';
import { PackageKind } from '../package-kind';
import { PackagePlan } from '../package-plan';
import type { DeclaredPack } from '../package-plan';

const copiesOf = (files: readonly string[]): readonly PackageCopyView[] =>
  PackagePlan.of(files)?.copies ?? [];

const destinations = (plan: PackagePlan | undefined): Record<string, string> =>
  Object.fromEntries((plan?.copies ?? []).map((copy) => [copy.source, copy.destination.value]));

const pack = (manifest: string, id: string): DeclaredPack => ({ manifest, id: new ModId(id) });

type PackageCopyView = PackagePlan['copies'][number];

describe('PackagePlan', () => {
  it('places the loader release archive as an extraction into the game folder would', () => {
    const plan = PackagePlan.of([
      'LICENSE',
      `mods${sep}`,
      `mods${sep}enshwick${sep}`,
      join('mods', 'enshwick', 'enshwick.dll'),
      'powrprof.dll',
    ]);

    expect(plan?.kind).toBe(PackageKind.Loader);
    expect(destinations(plan)).toEqual({
      LICENSE: join('mods', 'enshwick', 'LICENSE'),
      [join('mods', 'enshwick', 'enshwick.dll')]: join('mods', 'enshwick', 'enshwick.dll'),
      'powrprof.dll': 'powrprof.dll',
    });
  });

  it('places a mod release archive in its own folder and keeps its licence there', () => {
    const plan = PackagePlan.of([
      join('mods', 'enshwick.game-rates', 'enshwick-game-rates.dll'),
      'LICENSE',
    ]);

    expect(plan?.kind).toBe(PackageKind.Mod);
    expect(destinations(plan)).toEqual({
      [join('mods', 'enshwick.game-rates', 'enshwick-game-rates.dll')]: join(
        'mods',
        'enshwick.game-rates',
        'enshwick-game-rates.dll',
      ),
      LICENSE: join('mods', 'enshwick.game-rates', 'LICENSE'),
    });
  });

  it('reads an archive wrapped in a folder from inside that folder', () => {
    const plan = PackagePlan.of([
      join('Trading Post 0.2.0', 'README.md'),
      join('Trading Post 0.2.0', 'mods', 'you.trading-post', 'trading_post.dll'),
    ]);

    expect(destinations(plan)).toEqual({
      [join('Trading Post 0.2.0', 'README.md')]: join('mods', 'you.trading-post', 'README.md'),
      [join('Trading Post 0.2.0', 'mods', 'you.trading-post', 'trading_post.dll')]: join(
        'mods',
        'you.trading-post',
        'trading_post.dll',
      ),
    });
  });

  it('puts an archive of only a Luau mod folder into mods with every file below it', () => {
    const plan = PackagePlan.of(
      [
        join('you.greeter', 'pack.toml'),
        join('you.greeter', 'main.luau'),
        join('you.greeter', 'lib', 'greet.luau'),
      ],
      [pack(join('you.greeter', 'pack.toml'), 'you.greeter')],
    );

    expect(plan?.kind).toBe(PackageKind.Mod);
    expect(destinations(plan)).toEqual({
      [join('you.greeter', 'pack.toml')]: join('mods', 'you.greeter', 'pack.toml'),
      [join('you.greeter', 'main.luau')]: join('mods', 'you.greeter', 'main.luau'),
      [join('you.greeter', 'lib', 'greet.luau')]: join('mods', 'you.greeter', 'lib', 'greet.luau'),
    });
  });

  it('drops files at the top of an archive with several mods, since none is their home', () => {
    const plan = PackagePlan.of([
      'LICENSE',
      join('mods', 'you.one', 'one.dll'),
      join('mods', 'you.two', 'two.dll'),
    ]);

    expect(Object.values(destinations(plan))).toEqual([
      join('mods', 'you.one', 'one.dll'),
      join('mods', 'you.two', 'two.dll'),
    ]);
  });

  it('takes every folder of mods with a mod file, as the loader does, whatever its name', () => {
    const plan = PackagePlan.of([
      join('mods', 'you.one', 'one.dll'),
      join('mods', 'TradingPost', 'trading_post.dll'),
      join('mods', 'you.notes', 'notes.txt'),
    ]);

    expect(Object.values(destinations(plan))).toEqual([
      join('mods', 'you.one', 'one.dll'),
      join('mods', 'TradingPost', 'trading_post.dll'),
    ]);
  });

  it('puts every mod folder of an archive without mods into mods, not only the first', () => {
    const plan = PackagePlan.of([join('you.one', 'one.dll'), join('you.two', 'two.dll')]);

    expect(Object.values(destinations(plan))).toEqual([
      join('mods', 'you.one', 'one.dll'),
      join('mods', 'you.two', 'two.dll'),
    ]);
  });

  it('names a pack folder by the id its manifest declares, not by a versioned wrapper folder', () => {
    const files = [join('greeter-1.0', 'pack.toml'), join('greeter-1.0', 'main.luau')];
    const plan = PackagePlan.of(files, [pack(join('greeter-1.0', 'pack.toml'), 'you.greeter')]);

    expect(plan?.kind).toBe(PackageKind.Mod);
    expect(destinations(plan)).toEqual({
      [join('greeter-1.0', 'pack.toml')]: join('mods', 'you.greeter', 'pack.toml'),
      [join('greeter-1.0', 'main.luau')]: join('mods', 'you.greeter', 'main.luau'),
    });
  });

  it('asks for the manifest of each pack folder outside mods and of none inside it', () => {
    expect(
      PackagePlan.manifests([
        join('Greeter', 'greeter-1.0', 'pack.toml'),
        join('Greeter', 'greeter-1.0', 'vendor', 'pack.toml'),
        join('Greeter', 'you.one', 'one.dll'),
      ]),
    ).toEqual([join('Greeter', 'greeter-1.0', 'pack.toml')]);
    expect(PackagePlan.manifests([join('mods', 'you.greeter', 'pack.toml')])).toEqual([]);
    expect(PackagePlan.manifests([join('you.one', 'one.dll')])).toEqual([]);
  });

  it('declines a pack folder whose id nobody read, rather than guess it from the folder', () => {
    expect(PackagePlan.of([join('you.greeter', 'pack.toml')])).toBeUndefined();
  });

  it('declines two pack folders that declare one id, since one would overwrite the other', () => {
    const files = [join('greeter-1.0', 'pack.toml'), join('greeter-1.1', 'pack.toml')];
    const packs = files.map((manifest) => pack(manifest, 'you.greeter'));

    expect(PackagePlan.of(files, packs)).toBeUndefined();
  });

  it('keeps the name of a folder that holds a DLL beside its pack manifest', () => {
    const files = [join('you.one', 'pack.toml'), join('you.one', 'one.dll')];
    const plan = PackagePlan.of(files, [pack(join('you.one', 'pack.toml'), 'you.other')]);

    expect(Object.values(destinations(plan))).toEqual([
      join('mods', 'you.one', 'pack.toml'),
      join('mods', 'you.one', 'one.dll'),
    ]);
  });

  it('reads a Luau mod folder that holds a folder named mods as a mod folder', () => {
    const plan = PackagePlan.of(
      [join('you.greeter', 'pack.toml'), join('you.greeter', 'mods', 'data', 'x.luau')],
      [pack(join('you.greeter', 'pack.toml'), 'you.greeter')],
    );

    expect(Object.values(destinations(plan))).toEqual([
      join('mods', 'you.greeter', 'pack.toml'),
      join('mods', 'you.greeter', 'mods', 'data', 'x.luau'),
    ]);
  });

  it('roots at the shallowest mods folder that holds a mod, not at the first mods folder', () => {
    const plan = PackagePlan.of([
      join('A', 'mods', 'a', 'readme.txt'),
      join('B', 'mods', 'you.one', 'one.dll'),
    ]);

    expect(Object.values(destinations(plan))).toEqual([join('mods', 'you.one', 'one.dll')]);
  });

  it('declines an archive whose stub comes without the loader, which is another program', () => {
    expect(PackagePlan.of(['powrprof.dll', join('mods', 'you.one', 'one.dll')])).toBeUndefined();
  });

  it('declines archives that hold no Enshwick package', () => {
    expect(PackagePlan.of(['dbghelp.dll', join('mods', 'readme.txt')])).toBeUndefined();
    expect(PackagePlan.of([join('SomeMod', 'plugin.dll')])).toBeUndefined();
    expect(PackagePlan.of([join('mods', 'enshwick', 'enshwick.dll')])).toBeUndefined();
    expect(PackagePlan.of([])).toBeUndefined();
  });

  it('declines an archive with an entry whose path climbs out of its folder', () => {
    expect(
      PackagePlan.of([
        join('mods', 'you.one', 'one.dll'),
        ['mods', 'you.one', '..', '..', 'evil.dll'].join(sep),
      ]),
    ).toBeUndefined();
  });

  it('declines an archive with a name Windows refuses, rather than install part of it', () => {
    const mod = join('mods', 'you.one', 'one.dll');

    for (const name of ['a|b.luau', 'NUL', 'con.txt', 'Com1', 'lpt9.log', 'notes.', 'notes ']) {
      expect({ name, plan: PackagePlan.of([mod, join('mods', 'you.one', name)]) }).toEqual({
        name,
        plan: undefined,
      });
    }
  });

  it('keeps names that only start like a device name', () => {
    const plan = PackagePlan.of([
      join('mods', 'you.one', 'one.dll'),
      join('mods', 'you.one', 'console.luau'),
      join('mods', 'you.one', 'com10.txt'),
    ]);

    expect(Object.keys(destinations(plan))).toHaveLength(3);
  });

  it('copies each file at most once and only the stub outside mods', () => {
    const name = constantFrom('LICENSE', 'mods', 'you.one', 'enshwick', 'a.dll', 'pack.toml', 'x');
    const path = array(name, { minLength: 1, maxLength: 4 }).map((names) => join(...names));
    const paths = uniqueArray(path, { maxLength: 12 });
    const withStub = paths.map((files) => [...files, 'powrprof.dll']);

    assert(
      property(oneof(paths, withStub), (files) => {
        const copies = copiesOf(files);
        const sources = new Set(copies.map((copy) => copy.source));
        const elsewhere = copies
          .map((copy) => copy.destination.value)
          .filter((destination) => !destination.startsWith(`mods${sep}`))
          .filter((destination) => destination !== 'powrprof.dll');

        expect(sources.size).toBe(copies.length);
        expect(elsewhere).toEqual([]);
      }),
    );
  });
});
