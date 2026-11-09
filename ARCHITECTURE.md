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
| plan         | `src/install/package-plan.ts`       | reads an archive's file list and decides what goes where; no Vortex import       |
| installer    | `src/install/enshwick-installer.ts` | turns a plan into Vortex instructions and asks to confirm `powrprof.dll`         |
| loader check | `src/health/loader-check.ts`        | warns when Enshwick mods are on without the loader                               |

## Rules

- The plan decides from file names alone and imports nothing from Vortex, so its
  tests run without it. An entry with an unsafe name (`..`, a drive letter, a
  character Windows refuses) is never copied.
- Nothing but `powrprof.dll` goes to the top of the game folder; every other
  file goes into a folder of `mods/`.
- Vortex supplies `@nexusmods/vortex-api` at runtime. The build leaves it out of
  `index.js`, and the code takes only values Vortex exports: `VortexError`, its
  `Promise`, the health check enums and `util.opn`. Tests replace it with
  `src/__tests__/vortex-api.ts`.
- The build writes `info.json` from `package.json`, so the version lives in one
  place.

## Build and release

`bun run package` writes `dist/enshwick-vortex-extension-<version>.zip` with
`index.js`, `info.json` and `LICENSE` at its root, as Vortex and Nexus take it.
Every entry carries the same fixed time, so one source gives the same archive.
CI uploads the zip of each run as an artifact.
