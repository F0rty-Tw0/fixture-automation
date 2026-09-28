import type { Locator } from '@playwright/test';

const overflowOf = (element: Element): number => element.scrollHeight - element.clientHeight;

const gapBelowOf = (element: Element): number => element.scrollHeight - element.clientHeight - element.scrollTop;

/** How far the content runs past the box's own height; above 0 means it scrolls inside the box instead of growing it. */
export const hiddenOverflow = async (locator: Locator): Promise<number> => locator.evaluate(overflowOf);

/** How far the box is scrolled above its last line; 0 when it shows the end of its content. */
export const gapBelow = async (locator: Locator): Promise<number> => locator.evaluate(gapBelowOf);
