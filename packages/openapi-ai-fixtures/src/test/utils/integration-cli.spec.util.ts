import { join } from 'node:path';

import type { IntegrationProject } from '../common/integration.type.ts';

/** Arguments for `--missing` mode: a corrupt baseline plus the diff-produced projection; no spec or schema name. */
export const missingArgs = (project: IntegrationProject, scenario: string, typed: boolean): string[] => {
  const args = [
    project.outputFile,
    '--fixture',
    join(project.directory, 'corrupt.json'),
    '--missing',
    join(project.directory, 'missing.json'),
    '--scenario',
    scenario,
    '--tool',
    'claude',
    '--executable',
    project.executable,
    '--timeout',
    '10000'
  ];

  if (typed) args.push('--ts', join(project.directory, 'missing.d.ts'));

  return args;
};

export const integrationArgs = (project: IntegrationProject, scenario: string, typed: boolean): string[] => {
  const args = [
    project.specUrl,
    'invoice',
    project.outputFile,
    '--fixture',
    project.fixtureFile,
    '--scenario',
    scenario,
    '--tool',
    'claude',
    '--executable',
    project.executable,
    '--timeout',
    '10000'
  ];

  if (typed) args.push('--ts', project.typesFile);

  return args;
};
