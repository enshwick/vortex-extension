import { array, assert, constantFrom, property, stringMatching } from 'fast-check';
import { describe, expect, it } from 'vitest';

import { ArchiveEntry } from '../archive-entry';

const part = stringMatching(/^[a-zA-Z0-9_-][a-zA-Z0-9_. -]{0,10}[a-zA-Z0-9_-]?$/u).filter(
  (text) => !/^\.+$/u.test(text),
);

describe('ArchiveEntry', () => {
  it('reads a listed file in either separator into the same parts', () => {
    assert(
      property(
        array(part, { minLength: 1, maxLength: 5 }),
        constantFrom('/', '\\'),
        (parts, separator) => {
          expect(ArchiveEntry.textOfListed(parts.join(separator))).toBe(parts.join('/'));
          expect(new ArchiveEntry(parts.join('/')).parts).toEqual(parts);
        },
      ),
    );
  });

  it('skips folder entries', () => {
    expect(ArchiveEntry.textOfListed('mods\\')).toBeUndefined();
    expect(ArchiveEntry.textOfListed('mods/enshwick/')).toBeUndefined();
  });

  it('refuses paths that leave the archive or name a drive', () => {
    for (const path of [
      '../powrprof.dll',
      'mods/../../x.dll',
      'C:/x.dll',
      '/x.dll',
      'mods//x.dll',
      './x.dll',
    ]) {
      expect(ArchiveEntry.parse(path).ok).toBe(false);
    }
  });

  it('takes away the first folder', () => {
    const entry = new ArchiveEntry('enshwick/mods/area-loot.dll');

    expect(entry.top).toBe('enshwick');
    expect(entry.withoutTop().equals(new ArchiveEntry('mods/area-loot.dll'))).toBe(true);
    expect(new ArchiveEntry('LICENSE').withoutTop().equals(new ArchiveEntry('LICENSE'))).toBe(true);
  });

  it('compares a path without regard to case', () => {
    expect(
      new ArchiveEntry('Mods/Enshwick/Enshwick.DLL').isPath('mods/enshwick/enshwick.dll'),
    ).toBe(true);
  });
});
