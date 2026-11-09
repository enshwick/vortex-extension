import { join, sep } from 'node:path';

import { array, assert, constantFrom, oneof, property, uniqueArray } from 'fast-check';
import { describe, expect, it } from 'vitest';

import { PackageKind } from '../package-kind';
import { PackagePlan } from '../package-plan';

const copiesOf = (files: readonly string[]): readonly PackageCopyView[] =>
  PackagePlan.of(files)?.copies ?? [];

const destinations = (plan: PackagePlan | undefined): Record<string, string> =>
  Object.fromEntries((plan?.copies ?? []).map((copy) => [copy.source, copy.destination]));

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
    const plan = PackagePlan.of([
      join('you.greeter', 'pack.toml'),
      join('you.greeter', 'main.luau'),
      join('you.greeter', 'lib', 'greet.luau'),
    ]);

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

  it('leaves out folders of mods that are not named by a mod id or hold no mod file', () => {
    const plan = PackagePlan.of([
      join('mods', 'you.one', 'one.dll'),
      join('mods', 'Other Loader', 'plugin.dll'),
      join('mods', 'you.notes', 'notes.txt'),
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

  it('never copies an entry whose path climbs out of its folder', () => {
    const plan = PackagePlan.of([
      join('mods', 'you.one', 'one.dll'),
      ['mods', 'you.one', '..', '..', 'evil.dll'].join(sep),
    ]);

    expect(Object.values(destinations(plan))).toEqual([join('mods', 'you.one', 'one.dll')]);
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
          .map((copy) => copy.destination)
          .filter((destination) => !destination.startsWith(`mods${sep}`))
          .filter((destination) => destination !== 'powrprof.dll');

        expect(sources.size).toBe(copies.length);
        expect(elsewhere).toEqual([]);
      }),
    );
  });
});
