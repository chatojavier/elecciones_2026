export function createConcurrencyLimiter(concurrency: number) {
  const maxConcurrency = Math.max(1, Math.floor(concurrency));
  let activeCount = 0;
  const queue: Array<() => void> = [];

  function runNext() {
    while (activeCount < maxConcurrency && queue.length > 0) {
      const next = queue.shift();
      next?.();
    }
  }

  return function runLimited<T>(task: () => Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      const execute = () => {
        activeCount += 1;
        task()
          .then(resolve, reject)
          .finally(() => {
            activeCount -= 1;
            runNext();
          });
      };

      queue.push(execute);
      runNext();
    });
  };
}
