# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Each entry names the pull request that made the change.

## [Unreleased]

### Added

- The extension installs the Enshwick archive through Vortex: `powrprof.dll`
  beside the game and the loader in `mods/enshwick/`, after the player
  confirms the DLL (#1).
- It installs Enshwick mod archives into their folders in `mods/`, laid out
  at the archive's top, inside wrapping folders or as mod folders alone, Luau
  mods included; an archive with a name Windows refuses is not installed (#1).
- The mod types Enshwick Loader and Enshwick Mod deploy to the game folder,
  beside the Enshrouded game extension (#1).
- A Vortex health check warns when Enshwick mods are on without the loader;
  its fix opens the install guide (#1).

### Fixed

- A pack in a folder outside `mods/` installs under the id its `pack.toml`
  declares, so an archive that wraps it in a versioned folder such as
  `greeter-1.0/` no longer leaves it where the loader skips it. A manifest
  without a valid id stops the install with an error that names the file
  (#3).
