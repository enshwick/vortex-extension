import { AnyString } from '@horizon-republic/nominal-types';

/**
 * One name in an archive entry's path. An empty name, `.`, `..` or a character Windows refuses
 * in a file name would let an archive write outside the folder it installs to; a device name
 * (`NUL`, `CON.txt`, `COM1`) or a name ending in a space or a period would make the copy fail
 * part-way or write to a device.
 */
export class PathSegment extends AnyString.subtype(
  'vortex.PathSegment',
  /^(?!(?:[cC][oO][nN]|[pP][rR][nN]|[aA][uU][xX]|[nN][uU][lL]|(?:[cC][oO][mM]|[lL][pP][tT])[1-9¹²³])(?:\..*)?$)[^\\/:*?"<>|\p{Cc}]*[^\\/:*?"<>|\p{Cc} .]$/u,
) {}
