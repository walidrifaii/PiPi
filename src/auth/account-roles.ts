/** Account role returned on merchant auth (store operator). */
export const MERCHANT_ACCOUNT_ROLE = 'admin' as const;
/** Account role returned on super-admin auth (API body; JWT still uses role SUPER_ADMIN). */
export const SUPER_ADMIN_ACCOUNT_ROLE = 'super_admin' as const;
/** Account role returned on customer (app user) auth. */
export const USER_ACCOUNT_ROLE = 'user' as const;
/** Account role returned on delivery driver auth. */
export const DRIVER_ACCOUNT_ROLE = 'driver' as const;
