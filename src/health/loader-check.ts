import { access } from 'node:fs/promises';
import { join } from 'node:path';

import { selectors, types, util } from '@nexusmods/vortex-api';

import { GameFolder } from '../game-folder';
import { PackageKind } from '../install/package-kind';

/**
 * The Vortex health check that warns when the active Enshrouded profile enables Enshwick mods
 * but no Enshwick loader runs them: none enabled in Vortex and none in the game folder. Its fix
 * opens the install guide; it never downloads the loader itself.
 */
export class LoaderCheck {
  /** The check's id in Vortex. */
  public static readonly id = 'enshwick-loader-missing';

  /** The page that tells the player how to install Enshwick. */
  public static readonly installGuide = 'https://enshwick.com/guides/install/';

  private static readonly warningStatus = 'warning';
  private static readonly passedStatus = 'passed';
  private static readonly title = 'Enshwick loader';
  private static readonly description =
    'Enshwick mods run only when the Enshwick loader is in the game folder.';
  private static readonly passed = 'The Enshwick loader is installed, or no Enshwick mod is on.';
  private static readonly missing = 'Enshwick mods are enabled, but the Enshwick loader is not.';
  private static readonly details = `Install Enshwick through Vortex or by hand, then deploy again. See ${LoaderCheck.installGuide}`;

  /**
   * Whether the profile lacks a loader its mods need: it enables an Enshwick mod, enables no
   * loader, and the game folder holds no loader installed by hand.
   */
  public static isMissing(
    mods: Readonly<Record<string, { readonly type: string }>>,
    isEnabled: (modId: string) => boolean,
    loaderInGameFolder: boolean,
  ): boolean {
    const enabledOf = (kind: PackageKind): boolean =>
      Object.entries(mods).some(([modId, mod]) => mod.type === kind.valueOf() && isEnabled(modId));

    return enabledOf(PackageKind.Mod) && !enabledOf(PackageKind.Loader) && !loaderInGameFolder;
  }

  /**
   * The check as Vortex registers it, run at start and when the game, the profile or its mods
   * change. Vortex has no trigger for a deploy or a purge.
   */
  public static healthCheck(): types.IHealthCheck {
    return {
      id: LoaderCheck.id,
      name: LoaderCheck.title,
      description: LoaderCheck.description,
      category: types.HealthCheckCategory.Requirements,
      severity: types.HealthCheckSeverity.Warning,
      triggers: [
        types.HealthCheckTrigger.Startup,
        types.HealthCheckTrigger.GameChanged,
        types.HealthCheckTrigger.ProfileChanged,
        types.HealthCheckTrigger.ModsChanged,
      ],
      gameId: GameFolder.gameId,
      check: LoaderCheck.check,
      fix: LoaderCheck.fix,
    };
  }

  private static readonly check = async (
    api: types.IExtensionApi,
  ): Promise<types.IHealthCheckResult> => {
    const started = Date.now();
    const state = api.getState();
    const profile = selectors.activeProfile(state);
    const mods = state.persistent.mods[GameFolder.gameId] ?? {};
    const gamePath = GameFolder.pathIn(state, GameFolder.gameId);
    const missing =
      profile !== undefined &&
      GameFolder.isGame(profile.gameId) &&
      LoaderCheck.isMissing(
        mods,
        (modId) => profile.modState[modId]?.enabled === true,
        gamePath !== undefined && (await LoaderCheck.inGameFolder(gamePath)),
      );

    return {
      checkId: LoaderCheck.id,
      status: missing ? LoaderCheck.warningStatus : LoaderCheck.passedStatus,
      severity: types.HealthCheckSeverity.Warning,
      message: missing ? LoaderCheck.missing : LoaderCheck.passed,
      ...(missing ? { details: LoaderCheck.details, fixAvailable: true } : {}),
      executionTime: Date.now() - started,
      timestamp: new Date(),
    };
  };

  private static readonly fix = async (): Promise<void> => {
    // Vortex 2.10's typings offer only this deprecated helper; its replacement, the preload
    // `window.api.shell.openUrl`, has no declaration to type a call against.
    // oxlint-disable-next-line typescript/no-deprecated
    await util.opn(LoaderCheck.installGuide);
  };

  /** Whether the stub and the loader's DLL are both in the game folder at `gamePath`. */
  private static async inGameFolder(gamePath: string): Promise<boolean> {
    const files = [
      join(gamePath, GameFolder.stub),
      join(gamePath, GameFolder.mods, GameFolder.loaderFolder, GameFolder.loaderDll),
    ];
    const found = await Promise.all(
      files.map(async (file) => {
        try {
          await access(file);

          return true;
        } catch {
          return false;
        }
      }),
    );

    return !found.includes(false);
  }
}
