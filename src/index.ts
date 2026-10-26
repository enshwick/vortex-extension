import type { types } from '@nexusmods/vortex-api';

import { EnshroudedGame } from './game/enshrouded.game';
import { LoaderCheck } from './health/loader.check';
import { PackageInstaller } from './installer/package.installer';
import { PackageKind } from './model/package-kind';

/**
 * Registers Enshrouded with Vortex, the installers of Enshwick archives and the check that the
 * loader is enabled with its mods.
 *
 * @returns `true`, which tells Vortex the extension loaded.
 */
// Vortex takes an extension's entry point from the module's default export.
// oxlint-disable-next-line import/no-default-export
export default function init(context: types.IExtensionContext): boolean {
  context.registerGame(new EnshroudedGame().describe());

  for (const kind of [PackageKind.Loader, PackageKind.Mods] as const) {
    new PackageInstaller(kind).register(context);
  }

  context.registerHealthCheck(new LoaderCheck().describe());

  return true;
}
