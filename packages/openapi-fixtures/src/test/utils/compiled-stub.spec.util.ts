import { execFile } from 'node:child_process';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import ts from 'typescript';
import type { CompilerOptions, Diagnostic } from 'typescript';

import { fixtureUrl } from './fixture-url.spec.util.ts';
import type { CompiledStub } from '../common/compiled-stub.type.ts';

const runFile = promisify(execFile);

export const compiledStub = async (source: string, consumerFile: string): Promise<CompiledStub> => {
  const directory = await mkdtemp(join(tmpdir(), 'typed-fixture-'));
  const dispose = async (): Promise<void> => {
    await rm(directory, { recursive: true, force: true });
  };

  try {
    const input = fileURLToPath(fixtureUrl('typed-stub'));
    const stubFile = join(directory, 'generated.stub.ts');
    const outDir = join(directory, 'dist');
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

    await cp(input, directory, { recursive: true });
    await writeFile(join(directory, 'package.json'), '{"type":"module"}');
    await writeFile(stubFile, source);

    const program = ts.createProgram([stubFile, join(directory, consumerFile)], options);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    const diagnosticMessage = (diagnostic: Diagnostic): string => {
      return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    };
    const messages = diagnostics.map(diagnosticMessage);

    if (messages.length) throw new Error(messages.join('\n'));

    program.emit();

    const moduleUrl = pathToFileURL(join(outDir, 'generated.stub.js')).href;
    // Each test generates its module at a unique temporary URL, so it cannot be imported statically.
    const command = `const stub = await import(${JSON.stringify(moduleUrl)}); console.log(JSON.stringify(stub));`;
    const result = await runFile(process.execPath, ['--input-type=module', '--eval', command]);
    const value: unknown = JSON.parse(result.stdout);
    const compiled: CompiledStub = { value, dispose };

    return compiled;
  } catch (error: unknown) {
    await dispose();

    throw error;
  }
};
