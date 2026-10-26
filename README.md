# Enshwick Vortex extension

The [Vortex](https://www.nexusmods.com/about/vortex/) game extension for
Enshrouded with the [Enshwick](https://github.com/enshwick/enshwick) loader.
Vortex finds the game through Steam and deploys mods into the game folder,
by copies or hard links.

## What it installs

Vortex installs Enshwick's own archives as they are released:

| Archive                               | Files in the game folder                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `enshwick.zip`, `enshwick-loader.zip` | `powrprof.dll` beside `enshrouded.exe`, the loader in `mods/enshwick/`, the bundled mods in `mods/` |
| `<package>.zip` of a mod              | `mods/<package>.dll`                                                                                |

An archive packed inside one folder installs the same. Each archive's
`LICENSE` goes beside what it installs: `mods/enshwick/LICENSE` for the
loader, `mods/<package>.LICENSE` for a mod. Archives of any other layout go
to Vortex's own installers.

## Build

With [Bun](https://bun.sh) installed:

```bash
bun install
bun run check
bun run build
```

`bun run check` checks the format, lints, type-checks and runs the tests.
`bun run build` writes the extension to `dist/`: `index.js` and `info.json`.
To try it, copy that folder into Vortex's `plugins` folder
(`%APPDATA%\Vortex\plugins\enshwick`) and restart Vortex.
