import type { Locator, Page } from '@playwright/test';

export const focusOn = async (locator: Locator): Promise<void> => locator.focus();

export const pressKey = async (page: Page, key: string): Promise<void> => page.keyboard.press(key);
