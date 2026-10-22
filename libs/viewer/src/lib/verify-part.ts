/**
 * The verify part (parts.ts in @fieldia/widgets): proof that the person owns an email or a phone, by a code the app's
 * source sends and checks (verify.ts) — its Send a code, its code's box, Confirm and Send again under the field — with
 * its stylesheet (verify-styles.ts). Asked for with the page's other parts where a field's node says `options.verify`
 * (@fieldia/core's `formJoins`), in one script with the form's side of it.
 */
export { draw, verifyWays, watchVerify } from './verify';
export { installVerifyStyles } from './verify-styles';
