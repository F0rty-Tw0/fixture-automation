const chunks = [];

for await (const chunk of process.stdin) chunks.push(chunk);

const result = {
  args: process.argv.slice(2),
  input: Buffer.concat(chunks).toString('utf8')
};

process.stdout.write(JSON.stringify(result));
