import type { types } from '@nexusmods/vortex-api';

/**
 * The names Enshwick gives its files in the game folder, as its release archives lay them out,
 * and where Vortex found that folder. Every rule of the installer and the loader check reads
 * them from here.
 */
export class GameFolder {
  private static readonly pathKey = 'path';
  /** The game's id in Vortex, the Nexus domain of Enshrouded. */
  public static readonly gameId = 'enshrouded';

  /** The stub DLL beside the game's executable that starts the loader. */
  public static readonly stub = 'powrprof.dll';

  /** The folder beside the executable that holds the loader and one folder per mod. */
  public static readonly mods = 'mods';

  /** The loader's own folder in {@link GameFolder.mods}. */
  public static readonly loaderFolder = 'enshwick';

  /** The loader's DLL in {@link GameFolder.loaderFolder}. */
  public static readonly loaderDll = 'enshwick.dll';

  /** The manifest of a Luau mod, at the top of its folder. */
  public static readonly packManifest = 'pack.toml';

  /** The extension of a mod's or the loader's DLL. */
  public static readonly dllExtension = '.dll';

  /**
   * Where Vortex found the folder of the game `gameId`, or `undefined` before it found one. The
   * typings of Vortex 2.10.1 import the discovery's type from a path only Vortex's own build
   * resolves, so the entry is read as `unknown` and checked here.
   */
  public static pathIn(state: types.IState, gameId: string): string | undefined {
    const discovery: unknown = state.settings.gameMode.discovered[gameId];

    if (typeof discovery !== 'object' || discovery === null || !(GameFolder.pathKey in discovery)) {
      return undefined;
    }

    const path: unknown = discovery[GameFolder.pathKey];

    return typeof path === 'string' ? path : undefined;
  }
}
