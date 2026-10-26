import { AnyString } from '@horizon-republic/nominal-types';

/** The id Vortex and Nexus Mods know a game by, such as `enshrouded`. */
export class GameId extends AnyString.subtype('vortex.GameId', /^[a-z0-9]+$/u) {}
