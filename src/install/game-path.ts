import { join } from 'node:path';

import { AnyString } from '@horizon-republic/nominal-types';

/**
 * Where a file goes in the game folder: a path relative to it, with the platform's separator
 * and no drive, so a copy can never leave the folder. Build one with {@link GamePath.of}.
 */
export class GamePath extends AnyString.subtype(
  'vortex.GamePath',
  /^[^\\/:]+(?:[\\/][^\\/:]+)*$/u,
) {
  /** The path of `names`, each a checked name of a folder or file, from the game folder down. */
  public static of(names: readonly string[]): GamePath {
    return new GamePath(join(...names));
  }
}
