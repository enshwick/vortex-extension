/** What an archive holds, told from its layout. */
export enum PackageKind {
  /** The `powrprof.dll` stub and the loader, with or without mods: `enshwick.zip`. */
  Loader = 'loader',
  /** Mods alone, each `mods/<package>.dll`: `<package>.zip`. */
  Mods = 'mods',
  /** Any other layout, left to Vortex's other installers. */
  Other = 'other',
}
