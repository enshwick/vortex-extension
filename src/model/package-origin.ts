import { AnyString, n } from '@horizon-republic/nominal-types';

import { PackageKind } from './package-kind';

/**
 * The kind of Enshwick archive a mod in Vortex came from, as its installer recorded it. Reach
 * for it to read that record back from Vortex's state.
 */
export class PackageOrigin extends AnyString.subtype(
  'enshwick.PackageOrigin',
  n.oneOf(PackageKind.Loader, PackageKind.Mods),
) {
  /** Whether the archive held the loader. */
  public get isLoader(): boolean {
    return this.value === PackageKind.Loader;
  }
}
