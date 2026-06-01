/** FCM data for inbox / broadcast pushes (all values must be strings). */
export const USER_NOTIFICATION_FCM_TYPE = 'user_notification' as const;

export function buildUserNotificationFcmData(params: {
  category: string;
  broadcastId?: string;
  notificationId?: string;
}): Record<string, string> {
  const data: Record<string, string> = {
    type: USER_NOTIFICATION_FCM_TYPE,
    category: params.category.trim().toUpperCase(),
  };
  if (params.broadcastId?.trim()) {
    data.broadcastId = params.broadcastId.trim();
  }
  if (params.notificationId?.trim()) {
    data.notificationId = params.notificationId.trim();
  }
  return data;
}
