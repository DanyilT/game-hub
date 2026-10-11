import { useEffect, useState } from 'react';

/**
 * Runs something that loads, keeping { loaded, data, error } for it. `reload` runs it again.
 * @param {function|null} load - returns a Promise of the data (null: nothing to load)
 * @param {Array} deps - when to load again
 */
export const useLoad = (load, deps) => {
  const [state, setState] = useState({ key: null, data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const key = `${deps.join(':')}:${attempt}`;
  useEffect(() => {
    if (!load) return undefined;
    let active = true;
    load().then(
      (data) => active && setState({ key, data, error: null }),
      (error) => active && setState({ key, data: null, error }),
    );
    return () => {
      active = false;
    };
  }, [key]); // not on `load`, a new function each render: the key says when to load again
  const loaded = state.key !== null && state.key.startsWith(`${deps.join(':')}:`);
  return { loaded, data: loaded ? state.data : null, error: loaded ? state.error : null, reload: () => setAttempt((n) => n + 1) };
};
