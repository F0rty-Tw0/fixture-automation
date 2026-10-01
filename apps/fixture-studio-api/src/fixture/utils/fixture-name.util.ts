import { endpointArtifactFileName, endpointIdentity } from '@fixture-automation/openapi-fixture-merge';

import type { FixtureNameQuery, FixtureNameResult } from '../../contract/common/studio-api.type.ts';

/** The file name `mergeFixture` writes when the CLI wizard joins the prompts as `METHOD,url` under `subdirectory`. */
export const fixtureFileName = (query: FixtureNameQuery): FixtureNameResult => {
  const endpointUrl = `${query.method},${query.url}`;
  const identity = endpointIdentity(endpointUrl, query.subdirectory);
  const fileName = endpointArtifactFileName(identity);
  const result: FixtureNameResult = { fileName };

  return result;
};
