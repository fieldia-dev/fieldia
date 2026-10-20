import * as z from 'zod';

/**
 * Approvals on a record (`approval` on a record's page): who must approve it at which level, the approval it waits
 * for said on the record ("Waiting for Finance: Mona Adel"), Approve and Reject — Reject asking why — for those who may
 * decide, the record locked while it waits, and what was decided, by whom and when. The app's data source tells it
 * (`approvals`) and takes the decisions (`decide`): the app, or an approval engine behind it, decides who is asked and
 * in what order. Without the source's `approvals`, nothing is asked and nothing shows.
 *
 *   "approval": {}
 *   "approval": { "open": ["notes", "attachment_ids"] }
 *   "approval": { "lock": false }
 *
 * `open`: the fields that stay open while the record waits — a note, an attachment — every other one locked, its lock
 * saying why. `lock: false` locks none of them: the app's `save` refuses what it must.
 */
export const PageApprovalSchema = z
  .strictObject({
    open: z.array(z.string().min(1)).optional(),
    lock: z.boolean().optional(),
  })
  .meta({ id: 'PageApproval' });

export type PageApproval = z.infer<typeof PageApprovalSchema>;
