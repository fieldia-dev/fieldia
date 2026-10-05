/**
 * The designer's part for the choice kinds: an option's grip, the word that
 * marks one going alone, a picture's description under its address, and the
 * options kept in place when shuffled. Appended to the designer's stylesheet.
 */
export const DESIGNER_CHOICES_CSS = /* css */ `
/* An option's grip: seen when the row is pointed at or one is being moved, dragged by the pointer. */
.fd-q-option-grip {
  flex: none; display: grid; place-items: center; width: 14px; height: 24px; margin-inline-end: -6px;
  color: var(--fd-muted); cursor: grab; touch-action: none; opacity: 0; transition: opacity 150ms;
}
.fd-q-option-grip[hidden] { display: none; }
.fd-q-option-grip svg { width: 16px; height: 16px; }
.fd-q-option:hover > .fd-q-option-grip, .fd-q-option-lifted > .fd-q-option-grip { opacity: 1; }
.fd-q-option-lifted { position: relative; z-index: 1; background: var(--fd-surface); box-shadow: 0 4px 14px rgba(15, 20, 25, 0.16); border-radius: 6px; cursor: grabbing; }
@media (hover: none) { .fd-q-option-grip { opacity: 1; } }
.fd-q-alone { flex: none; padding: 1px 8px; border-radius: 999px; background: var(--fd-page); color: var(--fd-muted); font-size: 12px; white-space: nowrap; }
.fd-inline-input.fd-kind-picture-alt { grid-column: 3; width: 100%; min-width: 0; }
.fd-kind-keep[hidden] { display: none; }
@container (max-width: 520px) { .fd-inline-input.fd-kind-picture-alt { grid-column: 2 / -1; } }
`;
