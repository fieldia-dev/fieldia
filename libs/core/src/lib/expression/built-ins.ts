/** The names every expression on a record may read besides its fields: the record's id and the person using the form. */
export const BUILT_IN_NAMES = ['id', 'user', 'editing'] as const;

/** What `user` holds. */
export const USER_PARTS = ['id', 'name', 'roles'] as const;
