import { AnyString } from '@horizon-republic/nominal-types';

/**
 * A mod's id as its folder in `mods/` carries it: `<author>.<name>`, each part of `[a-z0-9-]`,
 * at most 64 characters in all. Mirrors `is_valid_id` of the Enshwick API crate.
 */
export class ModId extends AnyString.subtype(
  'vortex.ModId',
  /^(?=.{3,64}$)[a-z0-9-]+\.[a-z0-9-]+$/u,
) {}
