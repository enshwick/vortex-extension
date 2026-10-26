import { n } from '@horizon-republic/nominal-types';

import { PackageInstaller } from '../installer/package.installer';
import { PackageOrigin } from '../model/package-origin';

/**
 * Whether the enabled mods of a profile include the loader they need. Reach for it with the
 * game's mods as Vortex stores them and the ids the profile enables.
 */
export class LoaderPresence {
  /** A mod as Vortex stores it, read only as far as the record its installer left. */
  public static readonly MOD = n.object({
    attributes: n
      .object({ [PackageInstaller.ATTRIBUTE]: n.of(PackageOrigin).optional() })
      .optional(),
  });

  private constructor(
    /** Mods from Enshwick's mod archives are enabled. */
    public readonly hasMods: boolean,
    /** An archive with the loader is enabled. */
    public readonly hasLoader: boolean,
  ) {}

  /**
   * Reads the enabled mods from the game's mod table; a mod that no Enshwick installer recorded
   * or whose record cannot be read counts for neither.
   */
  public static of(table: unknown, enabled: readonly string[]): LoaderPresence {
    const mods = typeof table === 'object' && table !== null ? Object.entries(table) : [];
    const origins = mods.flatMap(([id, mod]) => {
      const parsed = enabled.includes(id) ? LoaderPresence.MOD.parse(mod) : undefined;
      const origin =
        parsed?.ok === true ? parsed.value.attributes?.[PackageInstaller.ATTRIBUTE] : undefined;

      return origin === undefined ? [] : [origin];
    });

    return new LoaderPresence(
      origins.some((origin) => !origin.isLoader),
      origins.some((origin) => origin.isLoader),
    );
  }

  /** Mods are enabled that the game cannot load, since no loader is. */
  public get isMissing(): boolean {
    return this.hasMods && !this.hasLoader;
  }
}
