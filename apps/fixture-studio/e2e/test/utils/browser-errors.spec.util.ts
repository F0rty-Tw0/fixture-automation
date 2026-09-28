import type { ConsoleMessage, Page } from '@playwright/test';

/** Records every uncaught page error and console error the page emits from now on. */
export const recordBrowserErrors = (page: Page): string[] => {
  const errors: string[] = [];

  page.on('pageerror', (error: Error): void => {
    errors.push(`pageerror: ${error.message}`);
  });

  page.on('console', (message: ConsoleMessage): void => {
    const type = message.type();
    const isError = type === 'error';

    if (isError) errors.push(`console: ${message.text()}`);
  });

  return errors;
};

/** Errors no pattern of `allowed` explains; a scenario that provokes a failure allows its own noise. */
export const unexpectedErrors = (errors: string[], allowed: RegExp[]): string[] => {
  const isAllowed = (error: string): boolean => allowed.some((pattern: RegExp): boolean => pattern.test(error));

  return errors.filter((error: string): boolean => !isAllowed(error));
};
