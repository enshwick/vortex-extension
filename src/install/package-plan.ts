import { join } from 'node:path';

import { GameFolder } from '../game-folder';
import { ModId } from './mod-id';
import { PackageKind } from './package-kind';
import { PathSegment } from './path-segment';

/** One file of an archive and where it goes, relative to the game folder. */
export interface PackageCopy {
  /** The entry as Vortex lists it in the archive. */
  readonly source: string;
  /** The path in the game folder, with the platform's separator. */
  readonly destination: string;
}

/** An archive entry and its names below the package's root, without a folder's trailing separator. */
interface Entry {
  readonly source: string;
  readonly names: readonly string[];
}

/**
 * Where the files of an Enshwick archive go, so that Vortex deploys them as an extraction into
 * the game folder would: the stub beside the executable and every mod in its own folder of
 * `mods/`. Use {@link PackagePlan.of} on the files Vortex lists; an archive of any other shape
 * gets no plan and goes to another installer.
 */
export class PackagePlan {
  private static readonly separators = /[\\/]/u;

  private constructor(
    public readonly kind: PackageKind,
    public readonly copies: readonly PackageCopy[],
  ) {}

  /**
   * The plan for an archive's files, or `undefined` when they hold no Enshwick package. The
   * archive may hold `mods/` at its top or inside wrapping folders, or only a mod's folder named
   * by its id. Files beside the package, such as `LICENSE`, go into its own folder in `mods/`,
   * never into the game folder itself.
   */
  public static of(files: readonly string[]): PackagePlan | undefined {
    const entries = PackagePlan.entries(files);
    const laidOut = entries.some((entry) =>
      entry.names.some((_name, at) => PackagePlan.isModsAt(entry.names, at)),
    );

    return laidOut ? PackagePlan.withMods(entries) : PackagePlan.modFolderOnly(entries);
  }

  /** The archive's files split into names, leaving out folders and entries with an unsafe name. */
  private static entries(files: readonly string[]): readonly Entry[] {
    return files
      .filter((source) => !PackagePlan.separators.test(source.at(-1) ?? ''))
      .map((source) => ({ source, names: source.split(PackagePlan.separators) }))
      .filter((entry) => entry.names.every((name) => PathSegment.accepts(name)));
  }

  /** The plan for an archive laid out like the game folder, at its top or in wrapping folders. */
  private static withMods(entries: readonly Entry[]): PackagePlan | undefined {
    const rooted = entries
      .map((entry) => ({
        entry,
        depth: entry.names.findIndex((_name, at) => PackagePlan.isModsAt(entry.names, at)),
      }))
      .filter(({ depth }) => depth >= 0)
      .toSorted((a, b) => a.depth - b.depth)[0];

    if (rooted === undefined) {
      return undefined;
    }

    return PackagePlan.plan(PackagePlan.under(entries, rooted.entry.names.slice(0, rooted.depth)));
  }

  /** The plan for an archive that holds one mod's folder, named by its id, and no `mods/`. */
  private static modFolderOnly(entries: readonly Entry[]): PackagePlan | undefined {
    const anchor = entries
      .filter(
        (entry) =>
          entry.names.length >= 2 &&
          PackagePlan.isModFile(entry.names.at(-1)) &&
          ModId.accepts(entry.names.at(-2)),
      )
      .toSorted((a, b) => a.names.length - b.names.length)[0];

    if (anchor === undefined) {
      return undefined;
    }

    const folder = anchor.names.at(-2);
    const inMods = PackagePlan.under(entries, anchor.names.slice(0, -2)).map((entry) =>
      entry.names.length > 1 && PackagePlan.same(entry.names[0], folder)
        ? { source: entry.source, names: [GameFolder.mods, ...entry.names] }
        : entry,
    );

    return PackagePlan.plan(inMods);
  }

  /**
   * The plan for entries laid out like the game folder. It is the loader's when the stub and the
   * loader's DLL are both there; else it holds the folders of `mods/` named by a mod id with a DLL
   * or a `pack.toml` at their top. A stub without the loader is another program's file, so such
   * an archive gets no plan.
   */
  private static plan(entries: readonly Entry[]): PackagePlan | undefined {
    const top = entries.filter((entry) => entry.names.length === 1);
    const inMods = entries.filter((entry) => PackagePlan.isModsAt(entry.names, 0));
    const stub = top.find((entry) => PackagePlan.same(entry.names[0], GameFolder.stub));
    const loaderDll = inMods.find(
      (entry) =>
        entry.names.length === 3 &&
        PackagePlan.same(entry.names[1], GameFolder.loaderFolder) &&
        PackagePlan.same(entry.names[2], GameFolder.loaderDll),
    );
    const mods = PackagePlan.modFolders(inMods);

    if (stub !== undefined && loaderDll === undefined) {
      return undefined;
    }

    const loader = stub === undefined ? undefined : loaderDll?.names[1];
    const folders = loader === undefined ? mods : [loader, ...mods];
    const home = loader ?? (mods.length === 1 ? mods[0] : undefined);

    if (folders.length === 0) {
      return undefined;
    }

    const copies = [
      ...inMods
        .filter((entry) => folders.some((folder) => PackagePlan.same(entry.names[1], folder)))
        .map((entry) => PackagePlan.copy(entry.source, [GameFolder.mods, ...entry.names.slice(1)])),
      ...top.flatMap((entry) => PackagePlan.topCopy(entry, stub, home)),
    ];

    return new PackagePlan(loader === undefined ? PackageKind.Mod : PackageKind.Loader, copies);
  }

  /** Where a file at the package's top goes: the stub beside the executable, the rest home. */
  private static topCopy(
    entry: Entry,
    stub: Entry | undefined,
    home: string | undefined,
  ): readonly PackageCopy[] {
    if (entry === stub) {
      return [PackagePlan.copy(entry.source, [GameFolder.stub])];
    }

    return home === undefined
      ? []
      : [PackagePlan.copy(entry.source, [GameFolder.mods, home, ...entry.names])];
  }

  /** The folders of `mods/` that are mods: named by a mod id, with a mod file at their top. */
  private static modFolders(inMods: readonly Entry[]): readonly string[] {
    const folders = inMods
      .filter((entry) => entry.names.length === 3 && PackagePlan.isModFile(entry.names[2]))
      .map((entry) => entry.names[1] ?? '')
      .filter((folder) => ModId.accepts(folder));

    return [...new Set(folders)];
  }

  /** The entries inside `root`, with their names below it. */
  private static under(entries: readonly Entry[], root: readonly string[]): readonly Entry[] {
    return entries
      .filter(
        (entry) =>
          entry.names.length > root.length &&
          root.every((name, at) => PackagePlan.same(entry.names[at], name)),
      )
      .map((entry) => ({ source: entry.source, names: entry.names.slice(root.length) }));
  }

  /** Whether `names[at]` is `mods` with a folder and a file below it. */
  private static isModsAt(names: readonly string[], at: number): boolean {
    return PackagePlan.same(names[at], GameFolder.mods) && names.length >= at + 3;
  }

  /** Whether a file at the top of a mod's folder makes it a mod: a DLL or a Luau pack manifest. */
  private static isModFile(name: string | undefined): boolean {
    const lower = name?.toLowerCase() ?? '';

    return lower.endsWith(GameFolder.dllExtension) || lower === GameFolder.packManifest;
  }

  /** Whether two names are the same, as Windows compares file names. */
  private static same(name: string | undefined, other: string | undefined): boolean {
    return name !== undefined && name.toLowerCase() === other?.toLowerCase();
  }

  /** A copy of `source` to the game-folder path `names`. */
  private static copy(source: string, names: readonly string[]): PackageCopy {
    return { source, destination: join(...names) };
  }
}
