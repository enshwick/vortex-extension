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

  /** Whether `gameId` is the game Enshwick runs in. */
  public static isGame(this: void, gameId: string): boolean {
    return gameId === GameFolder.gameId;
  }

  /** A name folded so that two names Windows takes for one file share a key. */
  public static key(this: void, name: string | undefined): string | undefined {
    return name?.toLowerCase();
  }

  /** Whether two names are the same, as Windows compares file names. */
  public static same(name: string | undefined, other: string | undefined): boolean {
    return name !== undefined && GameFolder.key(name) === GameFolder.key(other);
  }

  /** Whether a file is a DLL by its name. */
  public static isDll(name: string | undefined): boolean {
    return name?.toLowerCase().endsWith(GameFolder.dllExtension) === true;
  }

  /** Whether a file is a pack's manifest by its name. */
  public static isPackManifest(name: string | undefined): boolean {
    return GameFolder.same(name, GameFolder.packManifest);
  }

  /** Whether a file at the top of a mod's folder makes it a mod: a DLL or a pack manifest. */
  public static isModFile(name: string | undefined): boolean {
    return GameFolder.isDll(name) || GameFolder.isPackManifest(name);
  }

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
