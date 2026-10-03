// What every game's replay needs: the run's random numbers, and its inputs in order.

/**
 * The games' random numbers: mulberry32 from a 32-bit seed, exactly as a game's js/gamehub.js makes
 * them (DanyilT/dt-games), so a run plays out here as it did in the browser
 * @param {number} seed - 0 to 2³² − 1
 * @return {function(): number} - the next number, from 0 up to 1
 */
export const seededRandom = (seed) => {
  let state = seed | 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * A run's inputs as they came: [wait, code, wait, code, …] (each wait in steps or ms since the input
 * before) as [{ at, code }], at counted from the run's start
 * @param {Array} inputs
 * @return {{at: number, code: (number|string)}[]}
 */
export const timeline = (inputs) => {
  const events = [];
  let at = 0;
  for (let i = 0; i < inputs.length; i += 2) {
    at += inputs[i];
    events.push({ at, code: inputs[i + 1] });
  }
  return events;
};

/** A run that doesn't play out (an input the game can't take, or one after it ended): why */
export const refuse = (reason) => ({ ok: false, reason });
