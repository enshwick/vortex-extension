# Enshwick Vortex extension

The [Vortex](https://www.nexusmods.com/about/vortex/) game extension for
Enshrouded with the [Enshwick](https://github.com/enshwick/enshwick) loader.
Vortex finds the game through Steam and deploys mods into the game folder,
by copies or hard links.

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
