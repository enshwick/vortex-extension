# Architecture

A Vortex extension of one CommonJS file, `index.js`, whose default export Vortex
calls once at start. It registers two mod types, one installer and one health
check. It registers no game: the Enshrouded game extension does, and this
extension adds to it under the game id `enshrouded`.

## Parts

| Part         | File                                | Does                                                                             |
| ------------ | ----------------------------------- | -------------------------------------------------------------------------------- |
| entry        | `src/index.ts`                      | registers everything with Vortex; the only file that calls a `register` function |
| names        | `src/game-folder.ts`                | the file and folder names of the game folder, and where Vortex found it          |
| entries      | `src/install/archive-entries.ts`    | splits an archive's file list into checked names and finds its mod folders       |
| plan         | `src/install/package-plan.ts`       | decides what goes where from the file list and the packs' ids; no Vortex import  |
| manifest     | `src/install/pack-manifest.ts`      | reads a pack's id from its `pack.toml`; the only installer part that reads files |
| game path    | `src/install/game-path.ts`          | a destination that cannot leave the game folder                                  |
| installer    | `src/install/enshwick-installer.ts` | turns a plan into Vortex instructions and asks to confirm `powrprof.dll`         |
| mod types    | `src/install/mod-type.ts`           | the name and priority of each Enshwick mod type                                  |
| loader check | `src/health/loader-check.ts`        | warns when Enshwick mods are on without the loader                               |

## Rules

- The plan decides from file names and the ids of the archive's packs, and
  imports nothing from Vortex, so its tests run without it. The loader runs a
  pack only from the folder of `mods/` named by the id in its `pack.toml`, so
  the installer reads that id from the extracted archive and the plan names the
  folder by it, wherever the archive holds the pack. A manifest with no valid
  id, or two mod folders that would install to one, stops the install with an
  error that names the manifests.
- An archive with an unsafe name (`..`, a drive letter, a
  character Windows refuses, a device name such as `NUL`, a name ending in a
  space or a period) gets no plan, so no part of it is installed.
- Nothing but `powrprof.dll` goes to the top of the game folder; every other
  file goes into a folder of `mods/`.
- Vortex supplies `@nexusmods/vortex-api` at runtime. The build leaves it out of
  `index.js`, and the code takes only values Vortex exports: `VortexError`, its
  `Promise`, the health check enums, `selectors.activeProfile` and `util.opn`. Tests replace it with
  `src/__tests__/vortex-api.ts`.
- The build writes `info.json` from `package.json`, so the version lives in one
  place.

## Build and release

`bun run package` writes `dist/enshwick-vortex-extension-<version>.zip` with
`index.js`, `info.json` and `LICENSE` at its root, as Vortex and Nexus take it.
Every entry carries the same fixed time, so one source gives the same archive.
CI uploads the zip of each run as an artifact.
