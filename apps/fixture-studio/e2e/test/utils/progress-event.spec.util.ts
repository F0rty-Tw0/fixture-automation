import type { AiFillProgressEvent } from '@fixture-automation/fixture-studio-api/contract';

export const stdoutEvent = (text: string): AiFillProgressEvent => {
  const event: AiFillProgressEvent = { type: 'progress', stream: 'stdout', text };

  return event;
};

export const statusEvent = (text: string): AiFillProgressEvent => {
  const event: AiFillProgressEvent = { type: 'progress', stream: 'status', text };

  return event;
};

/** `text` cut into fragments of `size` characters, as a CLI streams a model's answer. */
export const fragmentsOf = (text: string, size: number): string[] => {
  const count = Math.ceil(text.length / size);
  const fragmentAt = (_value: unknown, index: number): string => text.slice(index * size, (index + 1) * size);

  return Array.from({ length: count }, fragmentAt);
};
