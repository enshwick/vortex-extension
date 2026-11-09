import { sep } from 'node:path';

import { AnyString } from '@horizon-republic/nominal-types';

/**
 * Where a file goes in the game folder: a path relative to it, with no drive and no `.` or `..`
 * name, so a copy can never leave the folder. Build one with {@link GamePath.of}.
 */
export class GamePath extends AnyString.subtype(
  'vortex.GamePath',
  /^(?!\.{1,2}(?:[\\/]|$))[^\\/:]+(?:[\\/](?!\.{1,2}(?:[\\/]|$))[^\\/:]+)*$/u,
) {
  private static readonly climbs = 'names that leave the game folder: ';

  /**
   * The path of `names`, each a name of a folder or file, from the game folder down.
   *
   * @throws RangeError when the names make no path inside the game folder.
   */
  public static of(names: readonly string[]): GamePath {
    const path = names.join(sep);

    if (!GamePath.accepts(path)) {
      throw new RangeError(`${GamePath.climbs}${path}`);
    }

    return new GamePath(path);
  }
}
