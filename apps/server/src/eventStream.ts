// utility functions for creating event streams in the server application.

export function createEventStream<T>(get: () => T) {
  const collectors = new Set<() => void>();

  function emit() {
    for (const fn of collectors) fn();
  }

  async function* collect(): AsyncGenerator<T> {
    let resolve!: () => void;
    const nextChange = () => new Promise<void>(r => {
      resolve = r;
    });
    let next = nextChange();
    const fn = () => {
      resolve();
      next = nextChange();
    };
    collectors.add(fn);
    try {
      while (true) {
        yield get();
        await next;
      }
    } finally {
      collectors.delete(fn);
    }
  }

  return {emit, collect, get};
}
