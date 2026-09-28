import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/** The six steps on the rail, in order; the last three follow the endpoint chosen in Generate. */
export const STEP_HEADINGS = ['Spec', 'Endpoints', 'Generate', 'Compare', 'Missing & broken values', 'Fill with AI'];

const step = (page: Page, heading: string): Locator => page.getByRole('region', { name: heading, exact: true });

/** A step's heading is its fold toggle. */
const stepToggle = (page: Page, heading: string): Locator => step(page, heading).getByRole('button', { name: heading, exact: true });

export const toggleStep = async (page: Page, heading: string): Promise<void> => {
  await stepToggle(page, heading).click();
};

export const expectSteps = async (page: Page, headings: string[]): Promise<void> => {
  const titles = page.getByRole('main').getByRole('heading', { level: 2 });

  await test.step(`THEN the rail shows ${headings.join(', ')}`, async (): Promise<void> => expect(titles).toHaveText(headings), {
    box: true
  });
};

export const expectStepExpanded = async (page: Page, heading: string, isExpanded: boolean): Promise<void> => {
  const toggle = stepToggle(page, heading);
  const state = isExpanded ? 'open' : 'folded';

  await test.step(
    `THEN the ${heading} step is ${state}`,
    async (): Promise<void> => expect(toggle).toHaveAttribute('aria-expanded', String(isExpanded)),
    { box: true }
  );
};

/** Any text a step's body shows: a folded body keeps its box (`hidden="until-found"`), so only its content can be seen to hide. */
const ANY_TEXT = /\S/u;

const CONTROL_WAIT = { timeout: 1_000 };

const FOLD_WAIT = { timeout: 5_000 };

/**
 * The toggle's `aria-expanded` and the body its `aria-controls` names agree: open shows that body's content, folded hides it.
 * The body is found by the id the toggle points at, so a toggle that controls nothing, or the wrong element, fails. The id
 * is read again on every try: generating swaps the waiting steps 4 to 6 for the endpoint's own, with new ids.
 */
export const expectStepFold = async (page: Page, heading: string, isExpanded: boolean): Promise<void> => {
  const toggle = stepToggle(page, heading);
  const state = isExpanded ? 'open' : 'folded';

  const controlsBody = async (): Promise<void> => {
    const bodyId = await toggle.getAttribute('aria-controls');
    const body = page.locator(`[id="${bodyId ?? ''}"]`);

    await expect(body).toHaveCount(1, CONTROL_WAIT);
    await expect(body.getByText(ANY_TEXT).first()).toBeVisible({ ...CONTROL_WAIT, visible: isExpanded });
  };

  await test.step(`THEN the ${heading} toggle and the body it controls are ${state}`, async (): Promise<void> => {
    await expect(toggle).toHaveAttribute('aria-expanded', String(isExpanded));
    await expect(controlsBody).toPass(FOLD_WAIT);
  }, { box: true });
};

/** The line under a step's heading: the endpoint for Compare, counts and progress for the later steps. */
export const expectStepStatus = async (page: Page, heading: string, status: string): Promise<void> => {
  const header = step(page, heading).locator('header').getByRole('paragraph');

  await test.step(`THEN the ${heading} step reads "${status}"`, async (): Promise<void> => expect(header).toHaveText(status), {
    box: true
  });
};

/** A folded step keeps its heading but hides what it holds; `probe` is text only its body shows. */
export const expectStepBodyShown = async (page: Page, heading: string, probe: string, isShown: boolean): Promise<void> => {
  const body = step(page, heading).getByText(probe);
  const state = isShown ? 'shows' : 'hides';

  await test.step(`THEN the ${heading} step ${state} "${probe}"`, async (): Promise<void> => {
    if (isShown) return expect(body).toBeVisible();

    return expect(body).toBeHidden();
  }, { box: true });
};

/** The page never scrolls sideways, whatever the width of a fixture, a path, or the viewport. */
export const expectNoHorizontalOverflow = async (page: Page): Promise<void> => {
  const overflow = async (): Promise<number> => {
    const measure = (): number => document.documentElement.scrollWidth - document.documentElement.clientWidth;

    return page.evaluate(measure);
  };

  await test.step('THEN the page does not scroll sideways', async (): Promise<void> => expect.poll(overflow).toBeLessThanOrEqual(0), {
    box: true
  });
};

/** Long content scrolls inside its own box, so however long a fixture is, the page stays within `screens` viewport heights. */
export const expectPageHeightWithin = async (page: Page, screens: number): Promise<void> => {
  const heightInScreens = async (): Promise<number> => {
    const measure = (): number => document.documentElement.scrollHeight / window.innerHeight;

    return page.evaluate(measure);
  };

  await test.step(`THEN the page is at most ${screens} screens tall`, async (): Promise<void> =>
    expect.poll(heightInScreens).toBeLessThanOrEqual(screens), { box: true });
};
