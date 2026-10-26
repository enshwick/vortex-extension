import type { types } from '@nexusmods/vortex-api';

import { GameId } from '../model/game-id';
import { SteamAppId } from '../model/steam-app-id';

/**
 * Enshrouded as Vortex sees it: how to find the game and where its mods go. Reach for it when
 * registering the game or when another part needs the game's id.
 */
export class EnshroudedGame {
  /** The game's id in Vortex and on Nexus Mods. */
  public static readonly ID = new GameId('enshrouded');
  public static readonly STEAM_APP_ID = new SteamAppId(1203620);
  public static readonly NAME = 'Enshrouded';
  public static readonly EXECUTABLE = 'enshrouded.exe';
  /**
   * Mods deploy into the game folder itself: Enshwick archives hold the paths the loader reads
   * there, `powrprof.dll` beside the executable and DLLs under `mods/`.
   */
  public static readonly MOD_PATH = '.';
  /** The environment variable that lets the game start without the Steam client launching it. */
  public static readonly STEAM_APP_ID_VARIABLE = 'SteamAPPId';
  /**
   * The loader is tested with copied and hard-linked files; symbolic links stay off so Vortex
   * offers only those two deployment methods.
   */
  public static readonly COMPATIBILITY = { symlinks: false } as const;

  /** The registration Vortex takes in `registerGame`. */
  public describe(): types.IGame {
    const appId = EnshroudedGame.STEAM_APP_ID.toString();

    return {
      id: EnshroudedGame.ID.toString(),
      name: EnshroudedGame.NAME,
      mergeMods: true,
      executable: (): string => EnshroudedGame.EXECUTABLE,
      requiredFiles: [EnshroudedGame.EXECUTABLE],
      queryModPath: (): string => EnshroudedGame.MOD_PATH,
      queryArgs: { steam: [{ id: appId }] },
      environment: { [EnshroudedGame.STEAM_APP_ID_VARIABLE]: appId },
      details: {
        steamAppId: EnshroudedGame.STEAM_APP_ID.value,
        nexusPageId: EnshroudedGame.ID.toString(),
      },
      compatible: { ...EnshroudedGame.COMPATIBILITY },
    };
  }
}
