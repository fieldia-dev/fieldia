/** The viewer's way to make an element: a tag, its attributes (left out when undefined), and what goes in it. */
export type El = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Record<string, string | undefined>, ...children: (Node | string)[]) => HTMLElementTagNameMap[K];
