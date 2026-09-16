import { createInterface } from 'node:readline';

if (process.argv.includes('models')) {
  process.stdin.resume();
  process.stdin.on('end', () => {
    process.stdout.write(JSON.stringify({ status: 'SUCCESS', command: { name: 'models', data: { models: [] } } }));
  });
} else {
  const input = createInterface({ input: process.stdin });
  for await (const line of input) {
    const request = JSON.parse(line);
    process.stdout.write(
      `${JSON.stringify({ id: request.id, error: { code: -32000, message: 'Catalog authentication required' } })}\n`
    );
  }
}
