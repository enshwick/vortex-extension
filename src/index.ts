import { Promise as VortexPromise } from '@nexusmods/vortex-api';
import type { types } from '@nexusmods/vortex-api';

import { n } from '@horizon-republic/nominal-types';

import { GameFolder } from './game-folder';
import { LoaderCheck } from './health/loader-check';
import { EnshwickInstaller } from './install/enshwick-installer';
import { PackageKind } from './install/package-kind';

// Vortex's window may forbid `new Function`, which the type checks would otherwise compile to.
n.configure({ codegen: 'off' });

/** Lower is tried first when Vortex picks a type for a mod by its files. */
const modTypePriority = 25;

/** The player-facing name of each mod type. */
const modTypeNames: Readonly<Record<PackageKind, string>> = {
  [PackageKind.Loader]: 'Enshwick Loader',
  [PackageKind.Mod]: 'Enshwick Mod',
};

/** Whether a game is the one Enshwick runs in. */
const isEnshrouded = (gameId: string): boolean => gameId === GameFolder.gameId;

/** The installer sets each mod's type, so neither type claims other mods by their files. */
const claimsNothing = (): VortexPromise<boolean> => VortexPromise.resolve(false);

/**
 * Registers Enshwick's mod types, its installer and the loader check with Vortex. The extension
 * registers no game: it works beside the Enshrouded game extension, under that extension's id.
 */
const main = (context: types.IExtensionContext): boolean => {
  const gameFolder = (game: types.IGame): string =>
    // Vortex reads an undefined path as "no folder for this game yet", as its own dinput mod
    // type returns it; the typings declare only a string.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    GameFolder.pathIn(context.api.getState(), game.id) as string;

  for (const kind of Object.values(PackageKind)) {
    context.registerModType(kind, modTypePriority, isEnshrouded, gameFolder, claimsNothing, {
      mergeMods: true,
      name: modTypeNames[kind],
    });
  }

  const installer = new EnshwickInstaller(context.api);

  context.registerInstaller(
    EnshwickInstaller.id,
    EnshwickInstaller.priority,
    (files, gameId) => Promise.resolve(EnshwickInstaller.supports(files, gameId)),
    (files, _destination, _gameId, _progress, _choices, unattended) =>
      installer.instructions(files, unattended),
  );
  context.registerHealthCheck(LoaderCheck.healthCheck());

  return true;
};

export default main;
