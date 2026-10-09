import { copyFileSync, cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { findPackageJSON, isBuiltin } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { build } from 'esbuild';
import type { Metafile } from 'esbuild';

type PackageManifest = {
  readonly name: string;
  readonly version: string;
  readonly license?: string;
  readonly dependencies?: Record<string, string>;
};

type ThirdPartyPackage = {
  readonly manifest: PackageManifest;
  readonly manifestPath: string;
};

type OutputImport = Metafile['outputs'][string]['imports'][number];

/** Packages bundled into dist/ instead of installed: openapi-sampler carries a pnpm patch that npm would not apply. */
const INLINED = ['openapi-sampler'];
/** Declared but never imported by the bundle: pino loads the transport by name at runtime. */
const LOADED_BY_NAME = ['pino-http-print'];
const ROOT = import.meta.dirname;
const DIST = join(ROOT, 'dist');
const UI_BUILD = join(ROOT, '../../dist/apps/fixture-studio');
const API_SRC = '../fixture-studio-api/src';
const NODE_MODULES = 'node_modules/';
const NO_LICENSE_FILE = '(no license file in package)';
const LICENSE_SEPARATOR = `\n\n${'-'.repeat(80)}\n\n`;

const isManifest = (value: unknown): value is PackageManifest => {
  if (typeof value !== 'object' || value === null) return false;

  const hasName = 'name' in value && typeof value.name === 'string';
  const hasVersion = 'version' in value && typeof value.version === 'string';

  return hasName && hasVersion;
};

const readManifest = (manifestPath: string): PackageManifest => {
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));

  if (!isManifest(manifest)) throw new Error(`${manifestPath} has no string name and version`);

  return manifest;
};

const packageNameOf = (specifier: string): string => {
  const segments = specifier.split('/');
  const nameLength = specifier.startsWith('@') ? 2 : 1;

  return segments.slice(0, nameLength).join('/');
};

const packageRootOf = (inputPath: string): string | undefined => {
  const start = inputPath.lastIndexOf(NODE_MODULES);

  if (start === -1) return undefined;

  const nameStart = start + NODE_MODULES.length;
  const name = packageNameOf(inputPath.slice(nameStart));

  return inputPath.slice(0, nameStart + name.length);
};

const thirdPartyRootsOf = (metafile: Metafile): string[] => {
  const roots = Object.keys(metafile.inputs).map(packageRootOf);
  const found = roots.filter((root) => root !== undefined);

  return Array.from(new Set(found));
};

const rootNameOf = (root: string): string => root.slice(root.lastIndexOf(NODE_MODULES) + NODE_MODULES.length);

const isPackageImport = (entry: OutputImport): boolean => {
  const isBuiltinModule = isBuiltin(entry.path);

  return entry.external === true && !isBuiltinModule;
};

const importedPackagesOf = (metafile: Metafile): Set<string> => {
  const imports = Object.values(metafile.outputs).flatMap((output) => output.imports);
  const packageImports = imports.filter(isPackageImport);

  return new Set(packageImports.map((entry) => packageNameOf(entry.path)));
};

const checkDependencies = (metafile: Metafile, declared: string[]): void => {
  const inlinedNames = thirdPartyRootsOf(metafile).map(rootNameOf);
  const undeclared = inlinedNames.filter((name) => !INLINED.includes(name));

  if (undeclared.length > 0) throw new Error(`undeclared dependencies bundled into dist: ${undeclared.join(', ')}`);

  const imported = importedPackagesOf(metafile);
  const isUnused = (name: string): boolean => !imported.has(name) && !LOADED_BY_NAME.includes(name);
  const unused = declared.filter(isUnused);

  if (unused.length > 0) throw new Error(`unused dependencies in package.json: ${unused.join(', ')}`);
};

const collectPackages = (manifestPath: string, found: Map<string, ThirdPartyPackage>): void => {
  const manifest = readManifest(manifestPath);
  const key = `${manifest.name}@${manifest.version}`;

  const isCollected = found.has(key);

  if (isCollected) return;

  found.set(key, { manifest, manifestPath });

  const base = pathToFileURL(manifestPath);
  const childNames = Object.keys(manifest.dependencies ?? {});

  for (const childName of childNames) {
    const childPath = findPackageJSON(childName, base);

    if (childPath === undefined) throw new Error(`cannot resolve ${childName} from ${key}`);

    collectPackages(childPath, found);
  }
};

const isLicenseFile = (file: string): boolean => /^licen[cs]e/i.test(file);

const licenseTextOf = (manifestPath: string): string => {
  const packageDir = dirname(manifestPath);
  const licenseFile = readdirSync(packageDir).find(isLicenseFile);

  if (licenseFile === undefined) return NO_LICENSE_FILE;

  return readFileSync(join(packageDir, licenseFile), 'utf8').trim();
};

const licenseEntryOf = (key: string, thirdParty: ThirdPartyPackage): string => {
  const license = thirdParty.manifest.license ?? 'UNKNOWN';
  const text = licenseTextOf(thirdParty.manifestPath);

  return `${key}\nLicense: ${license}\n\n${text}`;
};

const writeThirdPartyLicenses = (metafile: Metafile): void => {
  const found = new Map<string, ThirdPartyPackage>();

  for (const root of thirdPartyRootsOf(metafile)) collectPackages(join(ROOT, root, 'package.json'), found);

  const entries = Array.from(found).toSorted(([left], [right]) => left.localeCompare(right));
  const licenses = entries.map(([key, thirdParty]) => licenseEntryOf(key, thirdParty));

  writeFileSync(join(DIST, 'THIRD-PARTY-LICENSES.txt'), `${licenses.join(LICENSE_SEPARATOR)}\n`);
};

const bundle = async (external: string[]): Promise<Metafile> => {
  const entryPoints = { main: `${API_SRC}/main.ts`, 'spec-compute.worker': `${API_SRC}/spec-compute/feature/spec-compute.worker.ts` };
  const result = await build({
    absWorkingDir: ROOT,
    entryPoints,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    conditions: ['@fixture-automation/source'],
    external,
    metafile: true,
    outdir: 'dist'
  });

  return result.metafile;
};

const prependShebang = (): void => {
  const mainPath = join(DIST, 'main.js');

  writeFileSync(mainPath, `#!/usr/bin/env node\n${readFileSync(mainPath, 'utf8')}`);
};

const copyUi = (): void => {
  const uiDist = join(DIST, 'ui');

  cpSync(join(UI_BUILD, 'browser'), uiDist, { recursive: true });
  copyFileSync(join(UI_BUILD, '3rdpartylicenses.txt'), join(uiDist, '3rdpartylicenses.txt'));
};

const buildPackage = async (): Promise<void> => {
  const hasUi = existsSync(join(UI_BUILD, 'browser', 'index.html'));

  if (!hasUi) throw new Error('UI build missing; run nx build @fixture-automation/fixture-studio');

  rmSync(DIST, { recursive: true, force: true });

  const declared = Object.keys(readManifest(join(ROOT, 'package.json')).dependencies ?? {});
  const metafile = await bundle(declared);

  prependShebang();
  checkDependencies(metafile, declared);
  writeThirdPartyLicenses(metafile);
  copyUi();
};

try {
  await buildPackage();
} catch (error) {
  if (!(error instanceof Error)) throw error;

  console.error(`fixture-studio: ${error.message}`);
  process.exitCode = 1;
}
