import type { ArchiveEntry } from '../model/archive-entry';

/** One file of an archive and where it goes, relative to the game folder. */
export class Placement {
  public constructor(
    public readonly source: ArchiveEntry,
    public readonly destination: ArchiveEntry,
  ) {}
}
