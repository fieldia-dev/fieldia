/**
 * The themes part (parts.ts): the eight themes in the style of design systems
 * people know — their tokens, light and dark, and their own shapes (themes.ts)
 * — as one sheet. Loaded the first time a form wears a theme, through
 * `themesPart`: the viewer waits for it before it draws a page whose look names
 * one, and a theme the app gives or switches to is worn once it has come, with
 * no theme meanwhile (`wearTheme`, look-parts.ts).
 */
export { installThemeStyles } from './themes';
