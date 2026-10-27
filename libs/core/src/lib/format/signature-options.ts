import * as z from 'zod';
import { makeSchemasJitless } from './jitless';

// zod compiles no code for these schemas: a strict Content-Security-Policy refuses it (jitless.ts).
makeSchemasJitless();

/**
 * A signature that signs answers (`"widget": "signature"` on a binary field): its settings in the node's `options`,
 * beside its pen's. `signs` names the answers it signs — `"form"`, every answer shown on the page; or the fields, by
 * name — and the signature then keeps who signed, when, and a fingerprint (SHA-256) of those answers beside its
 * picture (`FileValue.signed`), and locks them while it is kept: a person changes one by taking the signature away,
 * and signs again. `signerField` names the field holding the signer's name ("patient_name"); left out, the name typed
 * on the pad, else the person using the form. Left out, a signature is a picture, as before.
 *
 *   { "field": "signature", "widget": "signature", "options": { "signs": "form", "signerField": "patient_name" } }
 */
export const SignatureOptionsSchema = z
  .object({
    signs: z
      .union([z.literal('form'), z.array(z.string().min(1)).min(1)], { error: 'signs is "form" (every answer shown) or the fields it signs, by name: ["treatment", "consent"]' })
      .optional(),
    signerField: z.string().min(1).optional(),
  })
  .meta({ id: 'SignatureOptions' });

export type SignatureOptions = z.infer<typeof SignatureOptionsSchema>;
