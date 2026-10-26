import { join } from 'node:path';

import type { types } from '@nexusmods/vortex-api';

import { EnshroudedGame } from '../game/enshrouded.game';
import { PackageLayout } from '../layout/package-layout';
import { ArchiveEntry } from '../model/archive-entry';
import type { PackageKind } from '../model/package-kind';

/**
 * Installs one kind of Enshwick archive for Enshrouded: it claims the archives of its kind and
 * places their files where the loader reads them. Reach for it once per kind when registering.
 */
export class PackageInstaller {
  /** Ahead of Vortex's fallback installer, which copies an archive as it is. */
  public static readonly PRIORITY = 25;
  /** The mod attribute that records which kind of Enshwick archive a mod came from. */
  public static readonly ATTRIBUTE = 'enshwickPackage';
  public static readonly ID_PREFIX = 'enshwick-';
  public static readonly COPY = 'copy';
  public static readonly SET_ATTRIBUTE = 'attribute';

  public constructor(private readonly kind: Exclude<PackageKind, PackageKind.Other>) {}

  /** The installer's id in Vortex. */
  public get id(): string {
    return `${PackageInstaller.ID_PREFIX}${this.kind}`;
  }

  /** Reads an archive's file list; `undefined` when an entry is not a path inside it. */
  public static layoutOf(files: readonly string[]): PackageLayout | undefined {
    const entries: ArchiveEntry[] = [];

    for (const listed of files) {
      const text = ArchiveEntry.textOfListed(listed);

      if (text === undefined) {
        continue;
      }

      const parsed = ArchiveEntry.parse(text);

      if (!parsed.ok) {
        return undefined;
      }

      entries.push(parsed.value);
    }

    return PackageLayout.of(entries);
  }

  /** Whether the archive is of this installer's kind and for Enshrouded. */
  public test(files: readonly string[], gameId: string): Promise<types.ISupportedResult> {
    const supported =
      EnshroudedGame.ID.toString() === gameId &&
      PackageInstaller.layoutOf(files)?.kind === this.kind;

    return Promise.resolve({ supported, requiredFiles: [] });
  }

  /** Copies each file to its place in the game folder and records the archive's kind. */
  public install(files: readonly string[]): Promise<types.IInstallResult> {
    const placements = PackageInstaller.layoutOf(files)?.placements() ?? [];
    const copies = placements.map((placement): types.IInstruction => ({
      type: PackageInstaller.COPY,
      source: join(...placement.source.parts),
      destination: join(...placement.destination.parts),
    }));
    const attribute: types.IInstruction = {
      type: PackageInstaller.SET_ATTRIBUTE,
      key: PackageInstaller.ATTRIBUTE,
      value: this.kind,
    };

    return Promise.resolve({ instructions: [...copies, attribute] });
  }

  /** Registers the installer with Vortex. */
  public register(context: types.IExtensionContext): void {
    context.registerInstaller(
      this.id,
      PackageInstaller.PRIORITY,
      (files, gameId) => this.test(files, gameId),
      (files) => this.install(files),
    );
  }
}
