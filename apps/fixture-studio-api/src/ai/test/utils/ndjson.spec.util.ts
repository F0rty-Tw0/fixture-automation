/** Every chunk of a text stream, joined. */
export const streamText = async (stream: ReadableStream<string>): Promise<string> => {
  let text = '';

  for await (const chunk of stream) text += chunk;

  return text;
};

/** The parsed lines of an NDJSON body; the body must end with a newline. */
export const ndjsonLines = (text: string): unknown[] => {
  const lines = text.split('\n');
  const complete = lines.slice(0, -1);

  return complete.map((line: string): unknown => JSON.parse(line));
};
