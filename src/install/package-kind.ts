/**
 * What an archive installs, named as the Vortex mod type it gets; both deploy to the game folder.
 */
export enum PackageKind {
  /** The stub and the loader's folder. */
  Loader = 'enshwick-loader',
  /** One or more mod folders. */
  Mod = 'enshwick-mod',
}
