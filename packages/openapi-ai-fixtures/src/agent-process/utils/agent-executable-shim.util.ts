/** Extracts the Node entry point from accepted npm or pnpm Windows wrappers. */
export const nodeEntryPathFromWindowsWrapper = (source: string): string | undefined => {
  const directInvocation =
    /^\s*@?\s*(?:"?(?:%NODE_EXE%|%(?:~)?dp0%?\\node(?:\.exe)?)"?|node(?:\.exe)?)\s+"([^"\r\n]+\.(?:cjs|js|mjs))"\s+%\*\s*$/im.exec(
      source
    );
  const directEntryPath = directInvocation?.[1];

  if (directEntryPath !== undefined) return directEntryPath;

  const nodeProgram = /^\s*set\s+"?_prog=(?:(?:%~?dp0\\)?node(?:\.exe)?|%NODE_EXE%)"?\s*$/im.exec(source);
  const hasNodeProgram = nodeProgram !== null;

  if (!hasNodeProgram) return undefined;

  const npmInvocation =
    /^\s*endlocal\s*&\s*goto\s+#_undefined_#\s+2>nul\s+\|\|\s+title\s+%comspec%\s*&\s*set\s+pathext=[^&\r\n]+&\s*"?%_prog%"?\s+"([^"\r\n]+\.(?:cjs|js|mjs))"\s+%\*\s*$/im.exec(
      source
    );

  return npmInvocation?.[1];
};
