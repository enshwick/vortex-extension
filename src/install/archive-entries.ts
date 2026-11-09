import { GameFolder } from '../game-folder';
import { ModId } from './mod-id';
import { PathSegment } from './path-segment';

/** An archive entry and its names below some root, without a folder's trailing separator. */
export interface ArchiveEntry {
  /** The entry as Vortex lists it in the archive. */
  readonly source: string;
  /** Its names from the root down, the file's own last. */
  readonly names: readonly string[];
}

/**
 * What an archive's file names alone tell about where its mods sit: its entries split into
 * checked names, the `mods/` folders in it and the mod folders outside one. Use it to find the
 * root a package is read from; it decides nothing about what installs.
 */
export class ArchiveEntries {
  private static readonly separators = /[\\/]/u;
  private static readonly rootKeySeparator = '/';

  /**
   * The archive's files split into names, leaving out folders, or `undefined` when an entry has
   * an unsafe name: installing the rest would leave a mod broken with no warning.
   */
  public static of(files: readonly string[]): readonly ArchiveEntry[] | undefined {
    const entries = files
      .filter((source) => !ArchiveEntries.separators.test(source.at(-1) ?? ''))
      .map((source) => ({ source, names: source.split(ArchiveEntries.separators) }));

    return entries.every((entry) => entry.names.every((name) => PathSegment.accepts(name)))
      ? entries
      : undefined;
  }

  /** The folders that hold a `mods/` with a file below it, shallowest first, each once. */
  public static modsRoots(entries: readonly ArchiveEntry[]): ReadonlyArray<readonly string[]> {
    const roots = new Map<string, readonly string[]>();

    for (const entry of entries) {
      const depth = entry.names.findIndex((_name, at) => ArchiveEntries.isModsAt(entry.names, at));

      if (depth >= 0) {
        const root = entry.names.slice(0, depth);

        roots.set(root.join(ArchiveEntries.rootKeySeparator).toLowerCase(), root);
      }
    }

    return [...roots.values()].toSorted((a, b) => a.length - b.length);
  }

  /**
   * The mod files that mark the mod folders of an archive with no `mods/` that holds a mod: the
   * shallowest DLLs in a folder named by a mod id and `pack.toml` files in any folder. None when
   * they sit under different roots: installing one root's folders would drop the other's with
   * no warning. A folder already inside `mods/` was judged with its layout and is not read
   * again here.
   */
  public static anchors(entries: readonly ArchiveEntry[]): readonly ArchiveEntry[] {
    const anchors = entries.filter(
      (entry) =>
        entry.names.length >= 2 &&
        !GameFolder.same(entry.names.at(-3), GameFolder.mods) &&
        (GameFolder.isPackManifest(entry.names.at(-1)) ||
          (GameFolder.isDll(entry.names.at(-1)) && ModId.accepts(entry.names.at(-2)))),
    );
    const depth = Math.min(...anchors.map((entry) => entry.names.length));
    const shallowest = anchors.filter((entry) => entry.names.length === depth);
    const root = shallowest[0]?.names.slice(0, -2) ?? [];

    return shallowest.every((entry) =>
      root.every((name, at) => GameFolder.same(entry.names[at], name)),
    )
      ? shallowest
      : [];
  }

  /** The entries inside `root`, with their names below it. */
  public static under(
    entries: readonly ArchiveEntry[],
    root: readonly string[],
  ): readonly ArchiveEntry[] {
    return entries
      .filter(
        (entry) =>
          entry.names.length > root.length &&
          root.every((name, at) => GameFolder.same(entry.names[at], name)),
      )
      .map((entry) => ({ source: entry.source, names: entry.names.slice(root.length) }));
  }

  /** Whether `names[at]` is `mods` with a folder and a file below it. */
  public static isModsAt(names: readonly string[], at: number): boolean {
    return GameFolder.same(names[at], GameFolder.mods) && names.length >= at + 3;
  }
}
