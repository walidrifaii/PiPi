/** Days after delete request before the account is permanently removed. */
export const USER_ACCOUNT_DELETION_GRACE_DAYS = 30;

export function deletionGraceCutoffDate(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - USER_ACCOUNT_DELETION_GRACE_DAYS);
  return cutoff;
}

export function permanentDeletionAt(requestedAt: Date): Date {
  const at = new Date(requestedAt);
  at.setUTCDate(at.getUTCDate() + USER_ACCOUNT_DELETION_GRACE_DAYS);
  return at;
}

/** User may sign in (active account or within deletion grace period). */
export function loginEligibleUserFilter(now = new Date()) {
  const graceCutoff = deletionGraceCutoffDate(now);
  return {
    OR: [
      { isActive: true },
      {
        isActive: false,
        deletionRequestedAt: { not: null, gt: graceCutoff },
      },
    ],
  };
}
