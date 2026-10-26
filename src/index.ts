import type { types } from '@nexusmods/vortex-api';

import { EnshroudedGame } from './game/enshrouded.game';

/**
 * Registers Enshrouded with Vortex.
 *
 * @returns `true`, which tells Vortex the extension loaded.
 */
// Vortex takes an extension's entry point from the module's default export.
// oxlint-disable-next-line import/no-default-export
export default function init(context: types.IExtensionContext): boolean {
  context.registerGame(new EnshroudedGame().describe());

  return true;
}
