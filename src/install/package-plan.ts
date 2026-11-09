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
  private static readonly rootKeySeparator = '/';

  private constructor(
    public readonly kind: PackageKind,
    public readonly copies: readonly PackageCopy[],
  ) {}

  /**
   * The plan for an archive's files, or `undefined` when they hold no Enshwick package or any
   * entry has an unsafe name. The archive may hold `mods/` at its top or inside wrapping
   * folders, or only mod folders named by their ids. Files beside the package, such as
   * `LICENSE`, go into its own folder in `mods/`, never into the game folder itself.
   */
  public static of(files: readonly string[]): PackagePlan | undefined {
    const entries = PackagePlan.entries(files);

    if (entries === undefined) {
      return undefined;
    }

    for (const root of PackagePlan.modsRoots(entries)) {
      const plan = PackagePlan.plan(PackagePlan.under(entries, root));

      if (plan !== undefined) {
        return plan;
      }
    }

    return PackagePlan.modFolderOnly(entries);
  }

  /**
   * The archive's files split into names, leaving out folders, or `undefined` when an entry has
   * an unsafe name: installing the rest would leave a mod broken with no warning.
   */
  private static entries(files: readonly string[]): readonly Entry[] | undefined {
    const entries = files
      .filter((source) => !PackagePlan.separators.test(source.at(-1) ?? ''))
      .map((source) => ({ source, names: source.split(PackagePlan.separators) }));

    return entries.every((entry) => entry.names.every((name) => PathSegment.accepts(name)))
      ? entries
      : undefined;
  }

  /** The folders that hold a `mods/` with a file below it, shallowest first, each once. */
  private static modsRoots(entries: readonly Entry[]): ReadonlyArray<readonly string[]> {
    const roots = new Map<string, readonly string[]>();

    for (const entry of entries) {
      const depth = entry.names.findIndex((_name, at) => PackagePlan.isModsAt(entry.names, at));

      if (depth >= 0) {
        const root = entry.names.slice(0, depth);

        roots.set(root.join(PackagePlan.rootKeySeparator).toLowerCase(), root);
      }
    }

    return [...roots.values()].toSorted((a, b) => a.length - b.length);
  }

  /**
   * The plan for an archive of mod folders named by their ids, with no `mods/` that holds a mod.
   * A folder already inside `mods/` was judged with its layout and is not read again here.
   */
  private static modFolderOnly(entries: readonly Entry[]): PackagePlan | undefined {
    const anchors = entries.filter(
      (entry) =>
        entry.names.length >= 2 &&
        PackagePlan.isModFile(entry.names.at(-1)) &&
        ModId.accepts(entry.names.at(-2)) &&
        !PackagePlan.same(entry.names.at(-3), GameFolder.mods),
    );
    const depth = Math.min(...anchors.map((entry) => entry.names.length));
    const shallowest = anchors.filter((entry) => entry.names.length === depth);
    const root = shallowest[0]?.names.slice(0, -2);

    if (root === undefined) {
      return undefined;
    }

    const folders = shallowest
      .filter((entry) => root.every((name, at) => PackagePlan.same(entry.names[at], name)))
      .map((entry) => entry.names.at(-2));
    const inMods = PackagePlan.under(entries, root).map((entry) =>
      entry.names.length > 1 && folders.some((folder) => PackagePlan.same(entry.names[0], folder))
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

  /**
   * The folders of `mods/` that are mods: a DLL or a `pack.toml` at their top, whatever their
   * name, as the loader reads them. The loader's own folder counts only beside the stub.
   */
  private static modFolders(inMods: readonly Entry[]): readonly string[] {
    const folders = inMods
      .filter((entry) => entry.names.length === 3 && PackagePlan.isModFile(entry.names[2]))
      .map((entry) => entry.names[1] ?? '')
      .filter((folder) => !PackagePlan.same(folder, GameFolder.loaderFolder));

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
