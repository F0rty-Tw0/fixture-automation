process.stdin.once('data', () => {
  process.stdin.destroy();
});
