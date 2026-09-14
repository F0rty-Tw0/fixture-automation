export const fixtureUrl = (name = 'invoice/spec.json'): URL => {
  return new URL(`../fixtures/${name}`, import.meta.url);
};
