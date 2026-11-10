# Enshwick Vortex extension

A [Vortex](https://www.nexusmods.com/about/vortex/) extension that installs
[Enshwick](https://enshwick.com), the modding framework and API for Enshrouded,
and Enshwick mods into the game folder.

## What does the extension install?

- It installs the Enshwick archive as an extraction by hand would:
  `powrprof.dll` beside the game, and the loader in `mods/enshwick/`.
- It installs each mod archive into `mods/<mod id>/`. Rust mods and Luau mods
  work the same way.
- It keeps files such as `LICENSE` in the package's own folder in `mods/`. The
  game folder itself gets only `powrprof.dll`.
- It asks you to confirm before it installs `powrprof.dll`, since that file runs
  with the game.
- It warns when Enshwick mods are on and Enshwick is not. The fix opens the
  [install guide](https://enshwick.com/guides/install/).

The extension downloads nothing. It works on the archives you download yourself.

## What you need

- Vortex 2.10.1 or newer.
- The Enshrouded game extension,
  [mod 2453 in Nexus Modding Tools](https://www.nexusmods.com/site/mods/2453).
  It adds the game to Vortex. This extension adds no game of its own and works
  beside it.

## Install the extension

1. Build `enshwick-vortex-extension-<version>.zip` from this repository, as
   [Build from source](#build-from-source) shows.
2. In Vortex, open **Extensions**.
3. Drag the zip onto **Drop File(s)**.
4. Restart Vortex.

## Install Enshwick and its mods

1. In Vortex, open **Games** and manage Enshrouded.
2. Download `enshwick.zip` as the
   [install guide](https://enshwick.com/guides/install/) shows. Install it with
   **Install From File** on the **Mods** page.
3. Vortex asks you to confirm `powrprof.dll`. Select **Install**.
4. Install each mod's archive the same way.
5. Turn on Enshwick and the mods, then select **Deploy Mods**.

Vortex shows Enshwick as type **Enshwick Loader** and each mod as type
**Enshwick Mod**. Both types deploy to the game folder.

## Remove Enshwick or a mod

Turn it off or remove it in Vortex, then select **Deploy Mods**. **Purge Mods**
removes every file Vortex deployed.

## Build from source

The extension is TypeScript, built with [Bun](https://bun.sh).

```bash
bun install
bun run check     # types, format, lint, Markdown and tests
bun run package   # dist/enshwick-vortex-extension-<version>.zip
```

[ARCHITECTURE.md](ARCHITECTURE.md) describes the code's parts.

## Licence

[MIT](LICENSE).
