/** The names every expression on a record may read besides its fields: the record's id, the person using the form, whether it is edited, and the values the app passes in. */
export const BUILT_IN_NAMES = ['id', 'user', 'editing', 'context'] as const;

/** What `user` holds. */
export const USER_PARTS = ['id', 'name', 'roles'] as const;
