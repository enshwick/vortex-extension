import { GameFolder } from '../game-folder';
import { GamePath } from './game-path';
import { ModId } from './mod-id';
import { PackageKind } from './package-kind';
import { PathSegment } from './path-segment';

/** One file of an archive and where it goes, relative to the game folder. */
export interface PackageCopy {
  /** The entry as Vortex lists it in the archive. */
  readonly source: string;
  /** The path in the game folder. */
  readonly destination: GamePath;
}

/** A pack folder outside `mods/` by its manifest, and the id read from that manifest. */
export interface DeclaredPack {
  /** The `pack.toml` entry as Vortex lists it in the archive. */
  readonly manifest: string;
  /** The id the manifest declares, which names the pack's folder in `mods/`. */
  readonly id: ModId;
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
   * folders, or only mod folders: a DLL's folder named by a mod id, and a pack's folder under
   * any name, installed under the id in `packs`. Read the manifests {@link PackagePlan.manifests}
   * lists to fill `packs`; a pack folder without its id gets no plan, and neither do two that
   * would share a folder. Files beside the package, such as `LICENSE`, go into its own folder in
   * `mods/`, never into the game folder itself.
   */
  public static of(
    files: readonly string[],
    packs: readonly DeclaredPack[] = [],
  ): PackagePlan | undefined {
    const entries = PackagePlan.entries(files);

    return entries === undefined
      ? undefined
      : (PackagePlan.inMods(entries) ?? PackagePlan.modFolderOnly(entries, packs));
  }

  /**
   * The `pack.toml` entries whose ids {@link PackagePlan.of} needs: those of the pack folders of
   * an archive with no `mods/` that holds a mod. An archive's file names cannot tell a pack's
   * folder from a wrapper named after its release.
   */
  public static manifests(files: readonly string[]): readonly string[] {
    const entries = PackagePlan.entries(files);

    return entries === undefined || PackagePlan.inMods(entries) !== undefined
      ? []
      : PackagePlan.packAnchors(PackagePlan.anchors(entries)).map((entry) => entry.source);
  }

  /** The plan read from the shallowest `mods/` that holds a mod, or `undefined` with none. */
  private static inMods(entries: readonly Entry[]): PackagePlan | undefined {
    for (const root of PackagePlan.modsRoots(entries)) {
      const plan = PackagePlan.plan(PackagePlan.under(entries, root));

      if (plan !== undefined) {
        return plan;
      }
    }

    return undefined;
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
   * The mod files that mark the mod folders of an archive with no `mods/` that holds a mod: the
   * shallowest DLLs in a folder named by a mod id and `pack.toml` files in any folder, under one
   * root. A folder already inside `mods/` was judged with its layout and is not read again here.
   */
  private static anchors(entries: readonly Entry[]): readonly Entry[] {
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

    return shallowest.filter((entry) =>
      root.every((name, at) => GameFolder.same(entry.names[at], name)),
    );
  }

  /**
   * The manifests among `anchors` that mark a pack's folder: one beside a DLL marks a DLL mod,
   * which the loader runs under any folder name.
   */
  private static packAnchors(anchors: readonly Entry[]): readonly Entry[] {
    return anchors.filter(
      (anchor) =>
        GameFolder.isPackManifest(anchor.names.at(-1)) &&
        !anchors.some(
          (other) =>
            GameFolder.isDll(other.names.at(-1)) &&
            GameFolder.same(other.names.at(-2), anchor.names.at(-2)),
        ),
    );
  }

  /**
   * The plan for an archive of mod folders, with no `mods/` that holds a mod. A DLL's folder
   * keeps its name, as the loader takes any; a pack's folder takes the id `packs` gives its
   * manifest, the only name the loader runs it under.
   */
  private static modFolderOnly(
    entries: readonly Entry[],
    packs: readonly DeclaredPack[],
  ): PackagePlan | undefined {
    const anchors = PackagePlan.anchors(entries);
    const root = anchors[0]?.names.slice(0, -2);

    if (root === undefined) {
      return undefined;
    }

    const packAnchors = PackagePlan.packAnchors(anchors);
    const names = new Map(
      anchors.map((anchor) => [
        anchor.names.at(-2)?.toLowerCase(),
        packAnchors.includes(anchor)
          ? packs.find((pack) => pack.manifest === anchor.source)?.id.value
          : anchor.names.at(-2),
      ]),
    );
    const installed = [...names.values()].map((name) => name?.toLowerCase());

    if (installed.includes(undefined) || new Set(installed).size < installed.length) {
      return undefined;
    }

    const inMods = PackagePlan.under(entries, root).map((entry) => {
      const name = names.get(entry.names[0]?.toLowerCase());

      return entry.names.length > 1 && name !== undefined
        ? { source: entry.source, names: [GameFolder.mods, name, ...entry.names.slice(1)] }
        : entry;
    });

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
    const stub = top.find((entry) => GameFolder.same(entry.names[0], GameFolder.stub));
    const loaderDll = inMods.find(
      (entry) =>
        entry.names.length === 3 &&
        GameFolder.same(entry.names[1], GameFolder.loaderFolder) &&
        GameFolder.same(entry.names[2], GameFolder.loaderDll),
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
        .filter((entry) => folders.some((folder) => GameFolder.same(entry.names[1], folder)))
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
      .filter((entry) => entry.names.length === 3 && GameFolder.isModFile(entry.names[2]))
      .map((entry) => entry.names[1] ?? '')
      .filter((folder) => !GameFolder.same(folder, GameFolder.loaderFolder));

    return [...new Set(folders)];
  }

  /** The entries inside `root`, with their names below it. */
  private static under(entries: readonly Entry[], root: readonly string[]): readonly Entry[] {
    return entries
      .filter(
        (entry) =>
          entry.names.length > root.length &&
          root.every((name, at) => GameFolder.same(entry.names[at], name)),
      )
      .map((entry) => ({ source: entry.source, names: entry.names.slice(root.length) }));
  }

  /** Whether `names[at]` is `mods` with a folder and a file below it. */
  private static isModsAt(names: readonly string[], at: number): boolean {
    return GameFolder.same(names[at], GameFolder.mods) && names.length >= at + 3;
  }

  /** A copy of `source` to the game-folder path `names`. */
  private static copy(source: string, names: readonly string[]): PackageCopy {
    return { source, destination: GamePath.of(names) };
  }
}
