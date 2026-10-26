import { ArchiveEntry } from '../model/archive-entry';
import { PackageKind } from '../model/package-kind';
import { Placement } from './placement';

/**
 * The layout of an Enshwick archive and where each of its files goes in the game folder. The
 * archives mirror the game folder: `powrprof.dll` beside the executable, the loader at
 * `mods/enshwick/enshwick.dll` and each mod at `mods/<package>.dll`, with a `LICENSE` at the
 * root. Reach for it to tell an archive's kind and to place its files.
 */
export class PackageLayout {
  public static readonly STUB = 'powrprof.dll';
  public static readonly LOADER = 'mods/enshwick/enshwick.dll';
  public static readonly MODS = 'mods';
  public static readonly LOADER_FOLDER = 'mods/enshwick';
  public static readonly LICENSE = 'LICENSE';
  public static readonly DLL = /\.dll$/iu;

  private constructor(
    public readonly kind: PackageKind,
    private readonly entries: readonly Placement[],
  ) {}

  /**
   * Reads the layout of an archive from its files. A single folder that wraps everything, as
   * when an archive was packed from a folder, is looked through.
   */
  public static of(files: readonly ArchiveEntry[]): PackageLayout {
    const unwrap = PackageLayout.isWrapped(files);
    const entries = files.map((file) => new Placement(file, unwrap ? file.withoutTop() : file));
    const placed = entries.map((entry) => entry.destination);
    const has = (path: string): boolean => placed.some((entry) => entry.isPath(path));
    const mods = placed.filter((entry) => PackageLayout.isModDll(entry));
    let kind = PackageKind.Other;

    if (has(PackageLayout.STUB) && has(PackageLayout.LOADER)) {
      kind = PackageKind.Loader;
    } else if (!has(PackageLayout.STUB) && !has(PackageLayout.LOADER) && mods.length > 0) {
      kind = PackageKind.Mods;
    }

    return new PackageLayout(kind, entries);
  }

  /** Whether one folder holds every file, and that folder is not the game's own `mods/`. */
  private static isWrapped(files: readonly ArchiveEntry[]): boolean {
    const [first] = files;
    const top = first?.top;

    return (
      top !== undefined &&
      top.toLowerCase() !== PackageLayout.MODS &&
      files.every((file) => file.top === top)
    );
  }

  /** Whether the entry is a DLL directly in `mods/`, where the loader looks for mods. */
  private static isModDll(entry: ArchiveEntry): boolean {
    return (
      entry.parts.length === 2 &&
      entry.top?.toLowerCase() === PackageLayout.MODS &&
      PackageLayout.DLL.test(entry.name)
    );
  }

  /**
   * Where each file goes. Files keep their place in the game folder, except the root `LICENSE`,
   * which every archive has: it goes beside the loader for the loader's archive and beside the
   * mod's DLL as `mods/<package>.LICENSE` for a mod's, so two archives never claim one file.
   */
  public placements(): Placement[] {
    const license = this.licensePath();

    return this.entries.map((entry) =>
      license !== undefined && entry.destination.isPath(PackageLayout.LICENSE)
        ? new Placement(entry.source, new ArchiveEntry(license))
        : entry,
    );
  }

  private licensePath(): string | undefined {
    if (this.kind === PackageKind.Loader) {
      return `${PackageLayout.LOADER_FOLDER}/${PackageLayout.LICENSE}`;
    }

    if (this.kind === PackageKind.Mods) {
      const [first] = this.entries
        .map((entry) => entry.destination)
        .filter((entry) => PackageLayout.isModDll(entry))
        .map((entry) => entry.name.replace(PackageLayout.DLL, ''))
        .toSorted();

      return first === undefined
        ? undefined
        : `${PackageLayout.MODS}/${first}.${PackageLayout.LICENSE}`;
    }

    return undefined;
  }
}
