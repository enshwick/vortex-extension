import { readFile } from 'node:fs/promises';

import { parse } from 'smol-toml';

import { n } from '@horizon-republic/nominal-types';

import { ModId } from './mod-id';
import { PathSegment } from './path-segment';

/**
 * A pack's `pack.toml` as the installer reads it. The loader runs a pack only from the folder of
 * `mods/` named by the id its manifest declares, so the id, not the archive's folder, names the
 * folder a pack installs to.
 */
export class PackManifest {
  private static readonly schema = n.object({ id: ModId });
  private static readonly encoding = 'utf8';

  /** The id of the manifest at `file`, or `undefined` as {@link PackManifest.idOf} or unread. */
  public static async idAt(file: string): Promise<ModId | undefined> {
    try {
      return PackManifest.idOf(await readFile(file, PackManifest.encoding));
    } catch {
      return undefined;
    }
  }

  /**
   * The id the manifest `text` declares, or `undefined` when the text is no TOML, declares no
   * mod id, or declares one Windows refuses as a folder's name.
   */
  public static idOf(text: string): ModId | undefined {
    try {
      const manifest = PackManifest.schema.parse(parse(text));

      return manifest.ok && PathSegment.accepts(manifest.value.id.value)
        ? manifest.value.id
        : undefined;
    } catch {
      return undefined;
    }
  }
}
