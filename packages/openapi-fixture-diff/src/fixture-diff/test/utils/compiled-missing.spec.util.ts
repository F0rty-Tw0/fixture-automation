import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import ts from 'typescript';
import type { CompilerOptions, Diagnostic } from 'typescript';

const runFile = promisify(execFile);

const diagnosticMessage = (diagnostic: Diagnostic): string => {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
};

const compilerOptions = (outDir: string): CompilerOptions => {
  const options: CompilerOptions = {
    module: ts.ModuleKind.NodeNext,
    target: ts.ScriptTarget.ES2024,
    strict: true,
    types: [],
    skipLibCheck: true,
    noEmitOnError: true,
    rewriteRelativeImportExtensions: true,
    outDir
  };

  return options;
};

/** Typecheck generated sources together, then import the emitted entry module and return its exports. */
export const compiledMissing = async (directory: string, files: string[], entry: string): Promise<unknown> => {
  const outDir = join(directory, 'dist');

  await writeFile(join(directory, 'package.json'), '{"type":"module"}');

  const program = ts.createProgram(files, compilerOptions(outDir));
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const messages = diagnostics.map(diagnosticMessage);

  if (messages.length) throw new Error(messages.join('\n'));

  program.emit();

  const moduleUrl = pathToFileURL(join(outDir, entry)).href;
  // Each test emits its module at a unique temporary URL, so it cannot be imported statically.
  const command = `const stub = await import(${JSON.stringify(moduleUrl)}); console.log(JSON.stringify(stub));`;
  const result = await runFile(process.execPath, ['--input-type=module', '--eval', command]);
  const value: unknown = JSON.parse(result.stdout);

  return value;
};
