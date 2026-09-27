// utility functions for creating event streams in the server application.


export type EventStream<T> = {
  /**
   * Notifies all collectors.
   * - `emit(value)` stores and emits `value`,
   * - `emit(() => value)` stores the producer and emits its result (re-evaluated on every read),
   * - `emit()` re-emits the stored value, or the producer's current result.
   */
  emit: (value?: T | (() => T)) => void;
  /** Yields the current value (if any), then again on every `emit()`. Aborting `signal` ends just this generator. */
  collect: (signal?: AbortSignal) => AsyncGenerator<T>;
  /** The stored value, or the stored producer's result; `undefined` before the first `emit(value)`. */
  get: () => T | undefined;
  /** Ends every active `collect()` generator and makes future ones finish immediately. */
  close: () => void;
}


export function createEventStream<T>(): EventStream<T> {
  const collectors = new Set<() => void>();
  let closed = false;
  // `{get}` wrapper distinguishes "nothing emitted yet" from an emitted `undefined`
  let current: { get: () => T } | undefined;

  function get() {
    return current?.get();
  }

  function notify() {
    for (const fn of collectors) fn();
  }

  function emit(value?: T | (() => T)) {
    if (arguments.length > 0) {
      if (typeof value === 'function') {
        const producer = value as () => T;
        current = {get: producer};
      } else {
        const v = value as T;
        current = {get: () => v};
      }
    }
    notify();
  }

  function close() {
    if (closed) return;
    closed = true;
    // wake every waiting collector so it sees `closed` and returns
    notify();
  }

  async function* collect(signal?: AbortSignal): AsyncGenerator<T> {
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
    // wake this collector on abort so it sees `signal.aborted` and returns
    signal?.addEventListener('abort', fn, {once: true});
    try {
      while (!closed && !signal?.aborted) {
        if (current) yield current.get();
        await next;
      }
    } finally {
      collectors.delete(fn);
      signal?.removeEventListener('abort', fn);
    }
  }

  return {emit, collect, get, close};
}
