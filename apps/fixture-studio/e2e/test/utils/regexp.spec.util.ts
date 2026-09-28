const SPECIAL_CHARACTERS = /[$()*+.?[\\\]^{|}/]/gu;

/** `RegExp.escape` is not in the es2024 lib yet. */
export const escapeRegExp = (text: string): string => text.replace(SPECIAL_CHARACTERS, String.raw`\$&`);
