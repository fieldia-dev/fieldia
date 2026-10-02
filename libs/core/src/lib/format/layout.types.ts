import type * as z from 'zod';
import type { Page } from './page';
import type { PageSchema } from './page';
import type {
  FieldNode, FieldNodeSchema, ButtonNode, ButtonNodeSchema, SheetNode, SheetNodeSchema,
  StepNode, StepNodeSchema, TabNode, TabNodeSchema, LayoutNode, LayoutNodeSchema,
  RootLayout, RootLayoutSchema,
} from './layout';

/**
 * Compile-time proof that the hand-written interfaces (the public types, with
 * their docs) and the schemas (what validation actually checks) describe the
 * same thing. If either side changes alone, `typecheck` fails here.
 */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

export type Checks = [
  Assert<Same<z.infer<typeof FieldNodeSchema>, FieldNode>>,
  Assert<Same<z.infer<typeof ButtonNodeSchema>, ButtonNode>>,
  Assert<Same<z.infer<typeof TabNodeSchema>, TabNode>>,
  Assert<Same<z.infer<typeof StepNodeSchema>, StepNode>>,
  Assert<Same<z.infer<typeof SheetNodeSchema>, SheetNode>>,
  Assert<Same<z.infer<typeof LayoutNodeSchema>, LayoutNode>>,
  Assert<Same<z.infer<typeof RootLayoutSchema>, RootLayout>>,
  Assert<Same<z.infer<typeof PageSchema>, Page>>,
];
