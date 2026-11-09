import { VortexError } from '@nexusmods/vortex-api';
import type { types } from '@nexusmods/vortex-api';

import { GameFolder } from '../game-folder';
import { PackageKind } from './package-kind';
import { PackagePlan } from './package-plan';

/**
 * The Vortex installer for Enshwick archives: it takes the archives {@link PackagePlan} reads,
 * gives each its mod type and copies its files where an extraction into the game folder would
 * put them. Register it ahead of the game extension's own installers, which put files into
 * `mods/` and would nest an archive that already holds `mods/`.
 */
export class EnshwickInstaller {
  /** The installer's id in Vortex. */
  public static readonly id = 'enshwick';

  /** Lower runs first; the game extension's installers and Vortex's fallback come after. */
  public static readonly priority = 25;

  private static readonly confirmTitle = 'Install Enshwick';
  private static readonly confirmText =
    'Enshwick puts powrprof.dll beside the game. The game loads it at start, and it runs the ' +
    'Enshwick mods you install, with the same access to your computer as the game. Install it ' +
    'only from the Enshwick page on Nexus Mods or from github.com/enshwick.';
  private static readonly cancel = 'Cancel';
  private static readonly install = 'Install';
  private static readonly canceled = 'The Enshwick install was canceled.';
  private static readonly noPackage = 'The archive holds no Enshwick package.';
  private static readonly question = 'question';
  private static readonly setModType = 'setmodtype';
  private static readonly copy = 'copy';
  private static readonly userCanceled = 'user-canceled';
  private static readonly dataInvalid = 'data-invalid';

  public constructor(private readonly api: types.IExtensionApi) {}

  /** Whether an archive for `gameId` holds an Enshwick package. */
  public static supports(files: readonly string[], gameId: string): types.ISupportedResult {
    return {
      supported: gameId === GameFolder.gameId && PackagePlan.of(files) !== undefined,
      requiredFiles: [],
    };
  }

  /**
   * The instructions that install an archive's package. The loader's DLL runs with the game, so
   * an install the player started asks first; an unattended one, such as a collection's, does
   * not.
   *
   * @throws VortexError of kind `user-canceled` when the player cancels the loader's install,
   *   and of kind `data-invalid` when the archive holds no Enshwick package.
   */
  public async instructions(
    files: readonly string[],
    unattended: boolean | undefined,
  ): Promise<types.IInstallResult> {
    const plan = PackagePlan.of(files);

    if (plan === undefined) {
      throw new VortexError(EnshwickInstaller.noPackage, { kind: EnshwickInstaller.dataInvalid });
    }

    if (plan.kind === PackageKind.Loader && unattended !== true) {
      await this.confirm();
    }

    return {
      instructions: [
        { type: EnshwickInstaller.setModType, value: plan.kind },
        ...plan.copies.map((copy): types.IInstruction => ({
          type: EnshwickInstaller.copy,
          source: copy.source,
          destination: copy.destination,
        })),
      ],
    };
  }

  /** Asks the player to confirm the loader's DLL; throws a `user-canceled` error unless they do. */
  private async confirm(): Promise<void> {
    const result = await this.api.showDialog?.(
      EnshwickInstaller.question,
      EnshwickInstaller.confirmTitle,
      { text: EnshwickInstaller.confirmText },
      [{ label: EnshwickInstaller.cancel }, { label: EnshwickInstaller.install }],
    );

    if (result?.action !== EnshwickInstaller.install) {
      throw new VortexError(EnshwickInstaller.canceled, {
        kind: EnshwickInstaller.userCanceled,
        skipped: false,
      });
    }
  }
}
