import { AnyString, n } from '@horizon-republic/nominal-types';

/**
 * A file's path inside a mod archive, relative to the archive's root, in `/` form: no empty
 * part, no `.` or `..`, no drive. Reach for it to read the layout of an archive Vortex extracted.
 */
export class ArchiveEntry extends AnyString.subtype(
  'enshwick.ArchiveEntry',
  n.matching(
    /^(?!.*(?:^|\/)\.{1,2}(?:\/|$))[^/\\:]+(?:\/[^/\\:]+)*$/u,
    'a relative path of non-empty parts without . or ..',
  ),
) {
  public static readonly SEPARATOR = '/';
  public static readonly ANY_SEPARATOR = /[/\\]/u;
  public static readonly TRAILING_SEPARATOR = /[/\\]$/u;

  /** The parts of the path, the folders first and the file name last. */
  public get parts(): readonly string[] {
    return this.value.split(ArchiveEntry.SEPARATOR);
  }

  /** The file name, the last part. */
  public get name(): string {
    return this.parts.at(-1) ?? this.value;
  }

  /** The first folder, or `undefined` for a file at the root. */
  public get top(): string | undefined {
    return this.parts.length > 1 ? this.parts[0] : undefined;
  }

  /**
   * The text of one entry of the file list Vortex hands an installer, which uses either
   * separator, in `/` form, ready for `parse()`.
   *
   * @returns `undefined` for a folder entry, which ends in a separator.
   */
  public static textOfListed(listed: string): string | undefined {
    if (ArchiveEntry.TRAILING_SEPARATOR.test(listed)) {
      return undefined;
    }

    return listed.split(ArchiveEntry.ANY_SEPARATOR).join(ArchiveEntry.SEPARATOR);
  }

  /** The entry built from parts, joined with `/`. */
  public static ofParts(parts: readonly string[]): ArchiveEntry {
    return new ArchiveEntry(parts.join(ArchiveEntry.SEPARATOR));
  }

  /** The same file with its first folder taken away; the entry itself when at the root. */
  public withoutTop(): ArchiveEntry {
    return this.top === undefined ? this : ArchiveEntry.ofParts(this.parts.slice(1));
  }

  /** Whether the entry is this path, compared without regard to case as Windows does. */
  public isPath(path: string): boolean {
    return this.value.toLowerCase() === path.toLowerCase();
  }
}
