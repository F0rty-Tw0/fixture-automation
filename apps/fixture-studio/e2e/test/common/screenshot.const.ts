import type { ScreenshotVariant } from './playwright.type.ts';

const DESKTOP = { width: 1440, height: 900 };

const NARROW = { width: 390, height: 844 };

const LIGHT_DESKTOP: ScreenshotVariant = { name: 'light-desktop', colorScheme: 'light', viewport: DESKTOP };

const DARK_DESKTOP: ScreenshotVariant = { name: 'dark-desktop', colorScheme: 'dark', viewport: DESKTOP };

const LIGHT_NARROW: ScreenshotVariant = { name: 'light-narrow', colorScheme: 'light', viewport: NARROW };

const DARK_NARROW: ScreenshotVariant = { name: 'dark-narrow', colorScheme: 'dark', viewport: NARROW };

export const SCREENSHOT_VARIANTS: ScreenshotVariant[] = [LIGHT_DESKTOP, DARK_DESKTOP, LIGHT_NARROW, DARK_NARROW];
