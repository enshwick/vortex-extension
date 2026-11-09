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

/** The namespaces the extension reads values from; empty unless a test fills them. */
export const selectors = {};
export const types = {};
export const util = {};
