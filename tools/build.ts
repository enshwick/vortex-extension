import { strToU8, zipSync } from 'fflate';

import { AnyString, n, SemVer } from '@horizon-republic/nominal-types';

/** The fields of `package.json` that describe the extension to Vortex and Nexus. */
const Manifest = n.object({ version: SemVer, description: AnyString });

/**
 * Builds `index.js` and `info.json` for Vortex, and with `--package` the zip Nexus and Vortex
 * take. Paths are relative to the repository root.
 */
class ExtensionBuild {
  private static readonly out = 'dist';
  private static readonly entry = 'src/index.ts';
  private static readonly script = 'index.js';
  private static readonly info = 'info.json';
  private static readonly licence = 'LICENSE';
  private static readonly manifest = 'package.json';
  private static readonly packageFlag = '--package';
  private static readonly archivePrefix = 'enshwick-vortex-extension-';
  private static readonly archiveExtension = '.zip';

  /** The extension's name in Vortex's extension list, and its author. */
  private static readonly displayName = 'Enshwick';
  private static readonly author = 'Enshwick';

  /** Vortex hands these to the extension at runtime; bundling them would copy Vortex's code. */
  private static readonly provided = ['@nexusmods/vortex-api', 'vortex-api'];

  /**
   * A fixed time for every zip entry, so one source gives the same archive. Zip stores local
   * time, so the date is built in local time too, the same on every machine.
   */
  private static readonly fixedTime = new Date(1980, 0, 1);

  public static async run(): Promise<void> {
    const manifest = Manifest.parse(await Bun.file(ExtensionBuild.manifest).json());

    if (!manifest.ok) {
      throw new Error(
        `${ExtensionBuild.manifest}: ${manifest.issues.map((issue) => issue.message).join('; ')}`,
      );
    }

    const { version, description } = manifest.value;
    const { out, entry, script, info } = ExtensionBuild;
    const built = await Bun.build({
      entrypoints: [entry],
      outdir: out,
      naming: script,
      target: 'node',
      format: 'cjs',
      external: ExtensionBuild.provided,
    });

    if (!built.success) {
      throw new AggregateError(built.logs, `${entry} did not build`);
    }

    const infoJson = `${JSON.stringify(
      { name: ExtensionBuild.displayName, author: ExtensionBuild.author, version, description },
      null,
      2,
    )}\n`;

    await Bun.write(`${out}/${info}`, infoJson);
    console.log(`built ${out}/${script} and ${out}/${info}, version ${version}`);

    if (Bun.argv.includes(ExtensionBuild.packageFlag)) {
      const archive = `${out}/${ExtensionBuild.archivePrefix}${version}${ExtensionBuild.archiveExtension}`;
      const entries = {
        [script]: new Uint8Array(await Bun.file(`${out}/${script}`).arrayBuffer()),
        [info]: strToU8(infoJson),
        [ExtensionBuild.licence]: new Uint8Array(
          await Bun.file(ExtensionBuild.licence).arrayBuffer(),
        ),
      };

      await Bun.write(archive, zipSync(entries, { mtime: ExtensionBuild.fixedTime }));
      console.log(`packaged ${archive}`);
    }
  }
}

await ExtensionBuild.run();
