# Architecture

TypeScript on [`@nexusmods/vortex-api`](https://www.npmjs.com/package/@nexusmods/vortex-api),
bundled with Bun into the extension Vortex loads. The extension only places
files: it knows where the game, the loader and the `mods/` folder live and
leaves everything else to the loader.

Vortex calls the default export of `src/index.ts` once at start, and that
function registers everything. Each part below takes plain values and
returns what Vortex expects, so the tests run without Vortex. Every value
with a meaning of its own is a nominal type from `src/model/`.

| Path             | What                                                       |
| ---------------- | ---------------------------------------------------------- |
| `src/index.ts`   | the entry point Vortex calls                               |
| `src/game/`      | the game: how Vortex finds it and where mods go            |
| `src/model/`     | the nominal types                                          |
| `tools/build.ts` | bundles `src/index.ts` and writes `info.json` into `dist/` |

Tests sit in a `__tests__` folder beside the code they test and run with
`bun run test`.
