import { AnyString } from '@horizon-republic/nominal-types';

/**
 * One name in an archive entry's path. An empty name, `.`, `..` or a character Windows refuses
 * in a file name would let an archive write outside the folder it installs to.
 */
export class PathSegment extends AnyString.subtype(
  'vortex.PathSegment',
  /^(?!\.{1,2}$)[^\\/:*?"<>|\p{Cc}]+$/u,
) {}
