// Themed one-liners for results and failures. Player-facing strings, kept out of the rules.
const WIN = Object.freeze({
  3: ['Electrifying!', 'Shockingly good.', 'Pure current.', 'Ohm my, perfect.', 'Full voltage.', 'Live wire!'],
  2: ['Positively charged.', 'Bright spark!', 'Nicely conducted.', 'Good connection.', 'Amped up.'],
  1: ['Watt a finish.', 'It still lights up.', 'A little resistance.', 'Low voltage, still a win.', 'Flickering, but lit.']
});
const FAIL = Object.freeze({
  drained: ['Power cut.', 'Out of juice.', 'Battery low.', 'Running on empty.'],
  locked: ['Current affairs.', 'Open circuit.', 'Missing a connection.', 'No spark without the nodes.'],
  stalled: ['Short circuit.', 'Grounded.', 'Dead end, dead wire.', 'The current stopped short.'],
  overcharged: ['Overloaded.', 'Too much current.', 'Blew a fuse.', 'Surplus spark.']
});

const pick = (list, random) => list[Math.floor(random() * list.length) % list.length];
export const winLine = (stars, random = Math.random) => pick(WIN[stars] ?? WIN[1], random);
export const failLine = (result, random = Math.random) => pick(FAIL[result] ?? FAIL.stalled, random);
