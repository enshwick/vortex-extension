import { describe, expect, it } from 'vitest';

import { ArchiveEntry } from '../../model/archive-entry';
import { PackageKind } from '../../model/package-kind';
import { PackageLayout } from '../package-layout';

const layout = (...paths: string[]): PackageLayout =>
  PackageLayout.of(paths.map((path) => new ArchiveEntry(path)));

const placed = (of: PackageLayout): Record<string, string> =>
  Object.fromEntries(of.placements().map((p) => [p.source.toString(), p.destination.toString()]));

describe('PackageLayout', () => {
  it('reads the loader archive and places the license beside the loader', () => {
    const loader = layout('LICENSE', 'mods/enshwick/enshwick.dll', 'powrprof.dll');

    expect(loader.kind).toBe(PackageKind.Loader);
    expect(placed(loader)).toEqual({
      LICENSE: 'mods/enshwick/LICENSE',
      'mods/enshwick/enshwick.dll': 'mods/enshwick/enshwick.dll',
      'powrprof.dll': 'powrprof.dll',
    });
  });

  it('reads the full bundle with its mods as the loader archive', () => {
    const bundle = layout(
      'LICENSE',
      'mods/enshwick/enshwick.dll',
      'mods/area-loot.dll',
      'mods/game-rates.dll',
      'powrprof.dll',
    );

    expect(bundle.kind).toBe(PackageKind.Loader);
    expect(placed(bundle)['mods/area-loot.dll']).toBe('mods/area-loot.dll');
  });

  it('reads a mod archive and names the license after the mod', () => {
    const mod = layout('LICENSE', 'mods/area-loot.dll');

    expect(mod.kind).toBe(PackageKind.Mods);
    expect(placed(mod)).toEqual({
      LICENSE: 'mods/area-loot.LICENSE',
      'mods/area-loot.dll': 'mods/area-loot.dll',
    });
  });

  it('looks through one folder that wraps the whole archive', () => {
    const mod = layout('area-loot-1.0.0/LICENSE', 'area-loot-1.0.0/mods/area-loot.dll');

    expect(mod.kind).toBe(PackageKind.Mods);
    expect(placed(mod)).toEqual({
      'area-loot-1.0.0/LICENSE': 'mods/area-loot.LICENSE',
      'area-loot-1.0.0/mods/area-loot.dll': 'mods/area-loot.dll',
    });
  });

  it('keeps an archive of mods alone as it is', () => {
    expect(placed(layout('mods/a.dll', 'mods/b.dll'))).toEqual({
      'mods/a.dll': 'mods/a.dll',
      'mods/b.dll': 'mods/b.dll',
    });
  });

  it('reads paths without regard to case', () => {
    expect(layout('Mods/Enshwick/Enshwick.dll', 'PowrProf.dll').kind).toBe(PackageKind.Loader);
  });

  it('leaves other layouts to other installers', () => {
    expect(layout('powrprof.dll').kind).toBe(PackageKind.Other);
    expect(layout('mods/enshwick/enshwick.dll').kind).toBe(PackageKind.Other);
    expect(layout('mods/notes/readme.txt').kind).toBe(PackageKind.Other);
    expect(layout('my-mod.dll').kind).toBe(PackageKind.Other);
    expect(layout('powrprof.dll', 'mods/area-loot.dll').kind).toBe(PackageKind.Other);
    expect(layout().kind).toBe(PackageKind.Other);
  });
});
