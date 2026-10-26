import { describe, expect, it } from 'vitest';

import { LoaderPresence } from '../loader-presence';

const from = (origin: string): unknown => ({ attributes: { enshwickPackage: origin } });
const table = {
  'area-loot': from('mods'),
  'build-camera': from('mods'),
  enshwick: from('loader'),
  other: { attributes: { author: 'someone' } },
  odd: from('other'),
};

describe('LoaderPresence', () => {
  it('finds the loader missing when only mods are enabled', () => {
    expect(LoaderPresence.of(table, ['area-loot', 'build-camera']).isMissing).toBe(true);
  });

  it('is content once the loader is enabled beside the mods', () => {
    expect(LoaderPresence.of(table, ['area-loot', 'enshwick']).isMissing).toBe(false);
  });

  it('asks for nothing when no enshwick mod is enabled', () => {
    expect(LoaderPresence.of(table, []).isMissing).toBe(false);
    expect(LoaderPresence.of(table, ['enshwick']).isMissing).toBe(false);
  });

  it('ignores mods that no enshwick installer recorded', () => {
    const presence = LoaderPresence.of(table, ['other', 'odd']);

    expect(presence.hasMods).toBe(false);
    expect(presence.hasLoader).toBe(false);
  });

  it('reads what it can when a record or the table is not as expected', () => {
    expect(LoaderPresence.of(undefined, ['area-loot']).hasMods).toBe(false);
    expect(
      LoaderPresence.of({ ...table, broken: null }, ['broken', 'build-camera']).isMissing,
    ).toBe(true);
  });
});
