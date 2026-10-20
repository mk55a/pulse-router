// World names and the one rule each world teaches. Shared by the generator and the level select.
export const WORLD_INFO = Object.freeze({
  1: Object.freeze({ name: 'Spark', rule: 'Light every node, reach the exit' }),
  2: Object.freeze({ name: 'Sequence', rule: 'Numbered nodes light in order' }),
  3: Object.freeze({ name: 'Charge', rule: 'Spend exactly all your energy' })
});

// New-rule cards, shown the first time a level uses the rule. `demo` names the animated example.
export const RULE_CARDS = Object.freeze({
  basics: Object.freeze({ title: 'Route the pulse', text: 'Drag from the glowing Source through every Node to the Exit, then press Pulse.', demo: 'basics' }),
  ordered: Object.freeze({ title: 'New: Numbered Nodes', text: 'Light them in order. A number stays shut until the one before it is lit.', demo: 'ordered' }),
  exact: Object.freeze({ title: 'New: Exact Energy', text: 'Spend every cell. The pulse must reach the Exit with exactly 0 energy left.', demo: 'exact' })
});

// Rules a level uses, in teaching order.
export function rulesFor(board, definition) {
  const rules = ['basics'];
  if (board.ordered) rules.push('ordered');
  if (definition.exact) rules.push('exact');
  return rules;
}
