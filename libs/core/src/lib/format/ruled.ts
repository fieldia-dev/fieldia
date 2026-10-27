import type * as z from 'zod';
import { RULES, type OptionShape, type RuleContext, type RuleName } from './rules';

/**
 * The format's rules (rules.ts) run by its zod definitions: a schema `ruled` with a rule's name refines what it parses
 * by that rule, and is known by it (`RULED`), so the format's schema as the viewer reads it names the rule where it
 * runs (page-shape.spec.ts makes it so). A refinement written any other way would hold in `validatePage` and not in
 * the viewer: page-shape.spec.ts refuses one.
 */

/** Each schema ruled, by the name of its rule. */
export const RULED = new WeakMap<object, RuleName>();

/**
 * `schema` refined by the rule `name`: each problem it says, at its path under the value. `shapes`, the schemas of a
 * widget's options the rule checks parts against (option-schemas.ts), by name.
 */
export function ruled<T extends z.ZodType>(schema: T, name: RuleName, shapes: Partial<Record<OptionShape, z.ZodType>> = {}): T {
  const rule = RULES[name] as (value: unknown, context: RuleContext) => void;
  const out = schema.superRefine((value, issues) => {
    rule(value, {
      say: (message, path = []) => issues.addIssue({ code: 'custom', message, path }),
      check: (shape, part, path) => {
        const own = shapes[shape];
        if (!own) throw new Error(`the rule ${name} checks against ${shape}, which it was not given`);
        for (const issue of own.safeParse(part).error?.issues ?? []) issues.addIssue({ code: 'custom', message: issue.message, path: [...path, ...issue.path] });
      },
    });
  });
  RULED.set(out, name);
  return out as T;
}
