import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import manifest from '../package.json' with { type: 'json' };

/**
 * Builds the extension Vortex installs: `dist/` with the bundled `index.js` and `info.json`.
 * Vortex supplies its API module at run time, so the bundle leaves it out.
 */
class ExtensionBuild {
  public static readonly OUT = 'dist';
  public static readonly ENTRY = 'src/index.ts';
  public static readonly INFO = 'info.json';
  public static readonly VORTEX_API = '@nexusmods/vortex-api';
  public static readonly NAME = 'Game: Enshrouded (Enshwick)';
  public static readonly AUTHOR = 'Enshwick';

  public async run(): Promise<void> {
    await rm(ExtensionBuild.OUT, { recursive: true, force: true });

    const result = await Bun.build({
      entrypoints: [ExtensionBuild.ENTRY],
      outdir: ExtensionBuild.OUT,
      target: 'node',
      format: 'cjs',
      external: [ExtensionBuild.VORTEX_API],
    });

    if (!result.success) {
      throw new AggregateError(result.logs, 'the bundle did not build');
    }

    const info = {
      name: ExtensionBuild.NAME,
      author: ExtensionBuild.AUTHOR,
      version: manifest.version,
      description: manifest.description,
    };

    await Bun.write(
      join(ExtensionBuild.OUT, ExtensionBuild.INFO),
      `${JSON.stringify(info, null, 2)}\n`,
    );
  }
}

await new ExtensionBuild().run();
