import { PositiveInteger } from '@horizon-republic/nominal-types';

/** A Steam application id, the number Steam and Vortex find a game by. */
export class SteamAppId extends PositiveInteger.subtype('steam.AppId') {}
