import type { ComponentFixture } from '@angular/core/testing';

/** The fixture's host element, typed; `nativeElement` itself is `any`. */
export const hostOf = <TComponent>(fixture: ComponentFixture<TComponent>): HTMLElement => {
  const host: unknown = fixture.nativeElement;

  if (host instanceof HTMLElement) return host;

  throw new Error('The fixture has no HTML host element.');
};

export const requiredElement = <TComponent>(fixture: ComponentFixture<TComponent>, selector: string): HTMLElement => {
  const element = hostOf(fixture).querySelector<HTMLElement>(selector);

  if (element === null) throw new Error(`No element matches ${selector}.`);

  return element;
};

/** Trimmed text of the first match, or `''` when nothing matches. */
export const textAt = <TComponent>(fixture: ComponentFixture<TComponent>, selector: string): string => {
  const element = hostOf(fixture).querySelector(selector);
  const text = element?.textContent ?? '';

  return text.trim();
};

/** Whitespace-collapsed text of every match, in document order. */
export const textsAt = <TComponent>(fixture: ComponentFixture<TComponent>, selector: string): string[] => {
  const matches = hostOf(fixture).querySelectorAll(selector);
  const elements = [...matches];

  return elements.map((element) => element.textContent.replaceAll(/\s+/gu, ' ').trim());
};
