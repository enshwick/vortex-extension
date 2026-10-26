import { selectors, types } from '@nexusmods/vortex-api';

import { EnshroudedGame } from '../game/enshrouded.game';
import { LoaderPresence } from './loader-presence';

/**
 * The health check that warns when Enshwick mods are enabled without the loader, which leaves
 * them unloaded in game. Reach for it once, when registering.
 */
export class LoaderCheck {
  public static readonly ID = 'enshwick-loader-present';
  public static readonly NAME = 'Enshwick loader';
  public static readonly DESCRIPTION =
    'Checks that enabled Enshwick mods have the loader with them.';
  public static readonly PASSED = 'Every enabled Enshwick mod has the loader with it.';
  public static readonly MISSING = 'Enshwick mods are enabled, but the Enshwick loader is not.';
  public static readonly DETAILS =
    'The game loads mods from the mods folder only through the loader. Install enshwick.zip or ' +
    'enshwick-loader.zip from the Enshwick releases, enable it and deploy.';

  /** The registration Vortex takes in `registerHealthCheck`. */
  public describe(): types.IHealthCheck {
    return {
      id: LoaderCheck.ID,
      name: LoaderCheck.NAME,
      description: LoaderCheck.DESCRIPTION,
      gameId: EnshroudedGame.ID.toString(),
      category: types.HealthCheckCategory.Mods,
      severity: types.HealthCheckSeverity.Warning,
      triggers: [
        types.HealthCheckTrigger.ModsChanged,
        types.HealthCheckTrigger.ProfileChanged,
        types.HealthCheckTrigger.GameChanged,
        types.HealthCheckTrigger.Manual,
      ],
      check: (api) => this.check(api),
    };
  }

  /** Reads the active profile's enabled mods and reports whether the loader is among them. */
  public check(api: types.IExtensionApi): Promise<types.IHealthCheckResult> {
    const startedAt = Date.now();
    const state = api.getState();
    // The published typings leave a stored mod untyped: the table is read as unknown and parsed.
    const table: unknown = state.persistent.mods[EnshroudedGame.ID.toString()];
    const enabled = Object.entries(selectors.activeProfile(state)?.modState ?? {})
      .filter(([, mod]) => mod.enabled)
      .map(([id]) => id);
    const presence = LoaderPresence.of(table, enabled);
    const outcome = presence.isMissing
      ? {
          status: 'warning' as const,
          severity: types.HealthCheckSeverity.Warning,
          message: LoaderCheck.MISSING,
          details: LoaderCheck.DETAILS,
        }
      : {
          status: 'passed' as const,
          severity: types.HealthCheckSeverity.Info,
          message: LoaderCheck.PASSED,
        };

    return Promise.resolve({
      checkId: LoaderCheck.ID,
      ...outcome,
      executionTime: Date.now() - startedAt,
      timestamp: new Date(),
    });
  }
}
