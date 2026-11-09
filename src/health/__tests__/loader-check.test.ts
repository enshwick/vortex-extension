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
