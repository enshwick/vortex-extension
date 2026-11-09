/**
 * The values of `@nexusmods/vortex-api` the extension reads, for tests outside Vortex: the
 * package ships only types, and Vortex hands the real module to an extension at runtime.
 */
export class VortexError extends Error {
  public constructor(
    message: string,
    public readonly data: { readonly kind: string },
  ) {
    super(message);
  }
}

/** Vortex's Bluebird; native promises stand in for it in tests. */
export const Promise = globalThis.Promise;

/** The health check enums the extension names, with Vortex's values. */
export const types = {
  HealthCheckCategory: { Requirements: 'requirements' },
  HealthCheckSeverity: { Warning: 'warning' },
  HealthCheckTrigger: {
    Startup: 'startup',
    GameChanged: 'game-changed',
    ProfileChanged: 'profile-changed',
    ModsChanged: 'mods-changed',
  },
};

/** Vortex's active profile selector, reading the state as Vortex keeps it. */
export const selectors = {
  activeProfile: (state: {
    readonly settings: { readonly profiles: { readonly activeProfileId: string } };
    readonly persistent: { readonly profiles: Readonly<Record<string, unknown>> };
  }): unknown => state.persistent.profiles[state.settings.profiles.activeProfileId],
};

/** Opening a page does nothing in tests. */
export const util = { opn: async (_url: string): Promise<void> => {} };
