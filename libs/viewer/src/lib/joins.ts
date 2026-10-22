import type { DataSource, Form, FormState, Page } from '@fieldia/core';
import type { IconSet } from '@fieldia/widgets';
import type { El } from './dom';
import type { ViewerLabels } from './labels';

/**
 * What the parts that join a form draw with its page (@fieldia/core's `formJoins`): Send a code under a field, the
 * payment step, the outbox's bar. The viewer knows only that its page asks for one — each part of the same name
 * (`joinDrawings`), made as the page is drawn, hands it what to place where (`PageJoin`).
 */

/** What a part that joins the form is given of the viewer drawing its page. */
export interface JoinContext {
  form: Form;
  /** The page as shown: its words in the page's language. */
  page: Page;
  doc: Document;
  el: El;
  labels: ViewerLabels;
  fill(template: string, values: Record<string, string | number>): string;
  dataSource: DataSource | undefined;
  /** The page's language, by tag: how its amounts and its messages are written. */
  tag: string;
  icons?: IconSet;
  /** Words said at once to a screen reader. */
  announce(text: string): void;
  /** Whether the form may be changed now: a locked one asks for no code. */
  editable(): boolean;
  /** The page's questions and their buttons, once drawn: what a payment step stands in place of. */
  content(): HTMLElement | null;
  /** A question answered Yes or No. */
  ask(message: string): Promise<boolean>;
}

/** What the viewer places of a part that joins the form: each piece where it goes, or none. */
export interface PageJoin {
  /** Over the questions: an outbox's bar. */
  before?: HTMLElement[];
  /** Under them: a payment step. */
  after?: HTMLElement[];
  /** A response sent: its ending's title and words its own, where it says so (a response kept on the device). */
  ending?(title: HTMLElement, words: HTMLElement | null): boolean;
  update?(state: FormState): void;
  destroy?(): void;
}

/**
 * A viewer's part of the same name as a part that joins the form: what it draws, made for the page — none where it draws
 * nothing (`draw`; the form's side is the part's `join`, in the one-tag script in the same script).
 */
export interface JoinDrawing {
  draw(ctx: JoinContext): PageJoin | null;
}
