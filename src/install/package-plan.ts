import { GameFolder } from '../game-folder';
import { ArchiveEntries } from './archive-entries';
import type { ArchiveEntry } from './archive-entries';
import { GamePath } from './game-path';
import type { ModId } from './mod-id';
import { PackageKind } from './package-kind';
import { PathSegment } from './path-segment';

/** One file of an archive and where it goes, relative to the game folder. */
export interface PackageCopy {
  /** The entry as Vortex lists it in the archive. */
  readonly source: string;
  /** The path in the game folder. */
  readonly destination: GamePath;
}

/** A pack folder by its manifest, and the id read from that manifest. */
export interface DeclaredPack {
  /** The `pack.toml` entry as Vortex lists it in the archive. */
  readonly manifest: string;
  /** The id the manifest declares, which names the pack's folder in `mods/`. */
  readonly id: ModId;
}

/**
 * Where the files of an Enshwick archive go, so that Vortex deploys them as an extraction into
 * the game folder would: the stub beside the executable and every mod in its own folder of
 * `mods/`. Use {@link PackagePlan.of} on the files Vortex lists; an archive of any other shape
 * gets no plan and goes to another installer.
 */
export class PackagePlan {
  private constructor(
    public readonly kind: PackageKind,
    public readonly copies: readonly PackageCopy[],
  ) {}

  /**
   * The plan for an archive's files, or `undefined` when they do not fit
   * ({@link PackagePlan.fits}), `packs` lacks the id of a pack folder, or two mod folders would
   * install to one. The archive may hold `mods/` at its top or inside wrapping folders, or only
   * mod folders: a DLL's folder named by a mod id, and a pack's folder under any name. A pack's
   * folder installs under the id in `packs`, the only name the loader runs it under; read the
   * manifests {@link PackagePlan.manifests} lists to fill `packs`. Files beside the package,
   * such as `LICENSE`, go into its own folder in `mods/`, never into the game folder itself.
   */
  public static of(
    files: readonly string[],
    packs: readonly DeclaredPack[] = [],
  ): PackagePlan | undefined {
    const layout = PackagePlan.layout(files);
    const named = layout === undefined ? undefined : PackagePlan.named(layout, packs);

    return named === undefined ? undefined : PackagePlan.plan(named);
  }

  /**
   * Whether an archive's files hold an Enshwick package by their names alone, so that the ids of
   * its packs can give it a plan. An archive with an unsafe name does not fit.
   */
  public static fits(files: readonly string[]): boolean {
    return PackagePlan.layout(files) !== undefined;
  }

  /**
   * The `pack.toml` entries whose ids {@link PackagePlan.of} needs: one for each folder the
   * loader reads as a pack, in `mods/` or outside it. An archive's file names cannot tell a
   * pack's id.
   */
  public static manifests(files: readonly string[]): readonly string[] {
    return PackagePlan.packManifests(PackagePlan.layout(files) ?? []).map((entry) => entry.source);
  }

  /**
   * The archive's files laid out like the game folder, each mod folder under the name the
   * archive gives it, or `undefined` when they hold no Enshwick package.
   */
  private static layout(files: readonly string[]): readonly ArchiveEntry[] | undefined {
    const entries = ArchiveEntries.of(files);

    return entries === undefined
      ? undefined
      : (PackagePlan.inMods(entries) ?? PackagePlan.modFolderOnly(entries));
  }

  /** The layout below the shallowest `mods/` that holds a mod, or `undefined` with none. */
  private static inMods(entries: readonly ArchiveEntry[]): readonly ArchiveEntry[] | undefined {
    for (const root of ArchiveEntries.modsRoots(entries)) {
      const layout = ArchiveEntries.under(entries, root);

      if (PackagePlan.plan(layout) !== undefined) {
        return layout;
      }
    }

    return undefined;
  }

  /**
   * The layout of an archive of mod folders, with no `mods/` that holds a mod: every folder a
   * mod file marks goes into `mods/`.
   */
  private static modFolderOnly(
    entries: readonly ArchiveEntry[],
  ): readonly ArchiveEntry[] | undefined {
    const anchors = ArchiveEntries.anchors(entries);
    const root = anchors[0]?.names.slice(0, -2);

    if (root === undefined) {
      return undefined;
    }

    const folders = new Set(anchors.map((anchor) => GameFolder.key(anchor.names.at(-2))));
    const layout = ArchiveEntries.under(entries, root).map((entry) =>
      entry.names.length > 1 && folders.has(GameFolder.key(entry.names[0]))
        ? { source: entry.source, names: [GameFolder.mods, ...entry.names] }
        : entry,
    );

    return PackagePlan.plan(layout) === undefined ? undefined : layout;
  }

  /**
   * The manifests of a layout's pack folders: `pack.toml` at the top of a folder of `mods/`,
   * with a DLL beside it or not, as the loader reads packs. The loader's own folder is no pack.
   */
  private static packManifests(layout: readonly ArchiveEntry[]): readonly ArchiveEntry[] {
    return layout.filter(
      (entry) =>
        entry.names.length === 3 &&
        ArchiveEntries.isModsAt(entry.names, 0) &&
        GameFolder.isPackManifest(entry.names[2]) &&
        !GameFolder.same(entry.names[1], GameFolder.loaderFolder),
    );
  }

  /**
   * A layout with each pack folder under the id `packs` gives its manifest, or `undefined` when
   * a pack has no id there, its id is a name Windows refuses, or two folders of `mods/` would
   * become one.
   */
  private static named(
    layout: readonly ArchiveEntry[],
    packs: readonly DeclaredPack[],
  ): readonly ArchiveEntry[] | undefined {
    const declared = new Map(packs.map((pack) => [pack.manifest, pack.id]));
    const ids = new Map<string | undefined, ModId>();

    for (const manifest of PackagePlan.packManifests(layout)) {
      const id = declared.get(manifest.source);

      if (id === undefined || !PathSegment.accepts(id.value)) {
        return undefined;
      }

      ids.set(GameFolder.key(manifest.names[1]), id);
    }

    const named = layout.map((entry) => {
      const id = ArchiveEntries.isModsAt(entry.names, 0)
        ? ids.get(GameFolder.key(entry.names[1]))
        : undefined;

      return id === undefined
        ? entry
        : { source: entry.source, names: [GameFolder.mods, id.value, ...entry.names.slice(2)] };
    });

    return PackagePlan.folders(named).size === PackagePlan.folders(layout).size ? named : undefined;
  }

  /** The folders of `mods/` in a layout, each once by its folded name. */
  private static folders(layout: readonly ArchiveEntry[]): ReadonlySet<string | undefined> {
    return new Set(
      layout
        .filter((entry) => ArchiveEntries.isModsAt(entry.names, 0))
        .map((entry) => GameFolder.key(entry.names[1])),
    );
  }

  /**
   * The plan for entries laid out like the game folder. It is the loader's when the stub and the
   * loader's DLL are both there; else it holds the folders of `mods/` named by a mod id with a DLL
   * or a `pack.toml` at their top. A stub without the loader is another program's file, so such
   * an archive gets no plan.
   */
  private static plan(entries: readonly ArchiveEntry[]): PackagePlan | undefined {
    const top = entries.filter((entry) => entry.names.length === 1);
    const inMods = entries.filter((entry) => ArchiveEntries.isModsAt(entry.names, 0));
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
    entry: ArchiveEntry,
    stub: ArchiveEntry | undefined,
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
  private static modFolders(inMods: readonly ArchiveEntry[]): readonly string[] {
    const folders = inMods
      .filter((entry) => entry.names.length === 3 && GameFolder.isModFile(entry.names[2]))
      .map((entry) => entry.names[1] ?? '')
      .filter((folder) => !GameFolder.same(folder, GameFolder.loaderFolder));

    return [...new Set(folders)];
  }

  /** A copy of `source` to the game-folder path `names`. */
  private static copy(source: string, names: readonly string[]): PackageCopy {
    return { source, destination: GamePath.of(names) };
  }
}
