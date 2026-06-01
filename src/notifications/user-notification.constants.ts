export const USER_NOTIFICATION_CATEGORIES = [
  'ORDER_STATUS',
  'SPECIAL_OFFER',
  'SYSTEM_UPDATE',
  'SECURITY_ALERT',
] as const;

export type UserNotificationCategory =
  (typeof USER_NOTIFICATION_CATEGORIES)[number];

export const USER_NOTIFICATION_CHANNELS = ['INBOX', 'DEVELOPER_LAB'] as const;

export type UserNotificationChannel =
  (typeof USER_NOTIFICATION_CHANNELS)[number];

export function isUserNotificationCategory(
  value: string,
): value is UserNotificationCategory {
  return (USER_NOTIFICATION_CATEGORIES as readonly string[]).includes(value);
}

export function isUserNotificationChannel(
  value: string,
): value is UserNotificationChannel {
  return (USER_NOTIFICATION_CHANNELS as readonly string[]).includes(value);
}
