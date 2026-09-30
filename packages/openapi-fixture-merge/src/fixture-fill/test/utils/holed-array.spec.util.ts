/** A sparse array of `length` holding only `values` at their indices; every other slot is a hole. */
export const holedArray = (length: number, values: Map<number, unknown>): unknown[] => {
  const array = new Array<unknown>(length);

  for (const [index, value] of values) array[index] = value;

  return array;
};
