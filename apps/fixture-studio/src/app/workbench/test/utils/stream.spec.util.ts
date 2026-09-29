/** A readable stream that yields the given chunks, like `promptStreaming` does. */
export const streamOf = (chunks: string[]): ReadableStream<string> => {
  const source: UnderlyingDefaultSource<string> = {
    start: (controller): void => {
      for (const chunk of chunks) controller.enqueue(chunk);

      controller.close();
    }
  };

  return new ReadableStream<string>(source);
};
