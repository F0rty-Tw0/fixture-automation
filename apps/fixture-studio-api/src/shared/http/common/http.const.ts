/** Largest JSON body a route that carries specs or fixtures accepts; a merge sends a 4 MB+ fixture up to three times. */
export const BODY_LIMIT_BYTES = 64 * 1024 * 1024;
