/**
 * The order to work fields out in: each after the fields it reads. `reads`
 * maps each worked-out field to the fields its expression reads; names not in
 * the map are plain values and need no order. A circle — a field read, at
 * some remove, by itself — has no order: it is listed among the cycles, as
 * the fields around it (`a → b → a`), and its fields still come out once each.
 */
export function dependencyOrder(reads: ReadonlyMap<string, readonly string[]>): { order: string[]; cycles: string[][] } {
  const order: string[] = [];
  const cycles: string[][] = [];
  const done = new Set<string>();
  const path: string[] = [];
  const visit = (name: string): void => {
    if (done.has(name)) return;
    const at = path.indexOf(name);
    if (at !== -1) {
      cycles.push([...path.slice(at), name]);
      return;
    }
    path.push(name);
    for (const read of reads.get(name) ?? []) if (reads.has(read)) visit(read);
    path.pop();
    done.add(name);
    order.push(name);
  };
  for (const name of reads.keys()) visit(name);
  return { order, cycles };
}
