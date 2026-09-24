const reminderKeyPrefix = "moniger.email-confirmation-reminder";

export const getEmailConfirmationReminderKey = (userId: string) => `${reminderKeyPrefix}:${userId}`;

export const markEmailConfirmationReminderPending = (userId: string | null | undefined) => {
  if (!userId || typeof window === "undefined") return;

  window.sessionStorage.setItem(getEmailConfirmationReminderKey(userId), "1");
};

export const hasEmailConfirmationReminderPending = (userId: string | null | undefined) => {
  if (!userId || typeof window === "undefined") return false;

  return window.sessionStorage.getItem(getEmailConfirmationReminderKey(userId)) === "1";
};

export const clearEmailConfirmationReminder = (userId: string | null | undefined) => {
  if (!userId || typeof window === "undefined") return;

  window.sessionStorage.removeItem(getEmailConfirmationReminderKey(userId));
};
