import { strToU8, zipSync } from 'fflate';

import { AnyString, n, SemVer } from '@horizon-republic/nominal-types';

/** The fields of `package.json` that describe the extension to Vortex and Nexus. */
const Manifest = n.object({ version: SemVer, description: AnyString });

/** Where the build writes, relative to the repository root. */
const out = 'dist';
const entry = 'src/index.ts';
const script = 'index.js';
const info = 'info.json';
const licence = 'LICENSE';
const packageFlag = '--package';

/** The extension's name in Vortex's extension list. */
const displayName = 'Enshwick';
const author = 'Enshwick';

/** Vortex hands these to the extension at runtime; bundling them would copy Vortex's code. */
const provided = ['@nexusmods/vortex-api', 'vortex-api'];

/**
 * A fixed time for every zip entry, so one source gives the same archive. Zip stores local
 * time, so the date is built in local time too, the same on every machine.
 */
const fixedTime = new Date(1980, 0, 1);

const manifest = Manifest.parse(await Bun.file('package.json').json());

if (!manifest.ok) {
  throw new Error(`package.json: ${manifest.issues.map((issue) => issue.message).join('; ')}`);
}

const { version, description } = manifest.value;
const built = await Bun.build({
  entrypoints: [entry],
  outdir: out,
  naming: script,
  target: 'node',
  format: 'cjs',
  external: provided,
});

if (!built.success) {
  throw new AggregateError(built.logs, `${entry} did not build`);
}

const infoJson = `${JSON.stringify({ name: displayName, author, version, description }, null, 2)}\n`;

await Bun.write(`${out}/${info}`, infoJson);
console.log(`built ${out}/${script} and ${out}/${info}, version ${version}`);

if (Bun.argv.includes(packageFlag)) {
  const archive = `${out}/enshwick-vortex-extension-${version}.zip`;
  const entries = {
    [script]: new Uint8Array(await Bun.file(`${out}/${script}`).arrayBuffer()),
    [info]: strToU8(infoJson),
    [licence]: new Uint8Array(await Bun.file(licence).arrayBuffer()),
  };

  await Bun.write(archive, zipSync(entries, { mtime: fixedTime }));
  console.log(`packaged ${archive}`);
}
