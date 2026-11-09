import { PackageKind } from './package-kind';

/**
 * How Vortex shows and ranks the mod type of each {@link PackageKind}. The installer sets each
 * mod's type, so neither type claims other mods by their files.
 */
export class ModType {
  /** Lower is tried first when Vortex picks a type for a mod by its files. */
  public static readonly priority = 25;

  private static readonly names: Readonly<Record<PackageKind, string>> = {
    [PackageKind.Loader]: 'Enshwick Loader',
    [PackageKind.Mod]: 'Enshwick Mod',
  };

  /** The player-facing name of the mod type of `kind`. */
  public static nameOf(kind: PackageKind): string {
    return ModType.names[kind];
  }
}
