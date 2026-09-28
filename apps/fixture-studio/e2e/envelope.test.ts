import { test } from './mocked-api.fixture.ts';
import { DIFF_ROUTE, ENVELOPE_ROUTE } from './test/common/playwright.const.ts';
import { diffMock, envelopeMock } from './test/mocks/workbench.mock.ts';
import { chooseEnvelope, expectEnvelope, pasteFixture } from './test/pages/compare-panel.page.ts';
import { openInvoiceCompare } from './test/pages/workbench.page.ts';
import { INVOICE_ENDPOINT_STUB } from './test/stubs/studio-api.stub.ts';
import { META_CANDIDATE_ENVELOPE_STUB, PARTIAL_INVOICE_STUB } from './test/stubs/workbench.stub.ts';
import { expectSentBodies } from './test/utils/recording-route.spec.util.ts';
import { apiRoute } from './test/utils/route.spec.util.ts';

const NONE = 'None — the fixture is the payload';

/** An invoice carrying a `meta` object: a candidate envelope, but the payload is the invoice itself. */
const META = { requestId: 'req_1' };

const WITH_META = { ...PARTIAL_INVOICE_STUB, meta: META };

const AS_PAYLOAD = { endpointId: INVOICE_ENDPOINT_STUB.id, fixture: WITH_META, requiredOnly: false, replacePlaceholders: true };

const INSIDE_META = { ...AS_PAYLOAD, objectShape: 'meta' };

test.describe('FEATURE: envelope property', () => {
  test('GIVEN no detected envelope, None is chosen and a candidate picked later compares inside it', async ({
    page
  }): Promise<void> => {
    const diff = diffMock();
    const envelope = envelopeMock(META_CANDIDATE_ENVELOPE_STUB);
    const routes = [apiRoute(ENVELOPE_ROUTE, envelope), apiRoute(DIFF_ROUTE, diff)];

    await test.step('WHEN the invoice is generated', async (): Promise<void> => openInvoiceCompare(page, { routes }));

    await test.step('AND an invoice with a meta object is pasted', async (): Promise<void> =>
      pasteFixture(page, JSON.stringify(WITH_META)));

    await test.step('THEN no envelope is chosen', async (): Promise<void> => expectEnvelope(page, NONE));

    await test.step('AND the fixture was diffed as the payload, with no envelope property', async (): Promise<void> =>
      expectSentBodies(diff, [AS_PAYLOAD]));

    await test.step('WHEN the meta candidate is chosen', async (): Promise<void> => chooseEnvelope(page, 'meta'));

    await test.step('THEN it is diffed again inside meta', async (): Promise<void> =>
      expectSentBodies(diff, [AS_PAYLOAD, INSIDE_META]));
  });
});
