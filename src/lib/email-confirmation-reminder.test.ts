import { beforeEach, describe, expect, it } from "vitest";
import {
  clearEmailConfirmationReminder,
  getEmailConfirmationReminderKey,
  hasEmailConfirmationReminderPending,
  markEmailConfirmationReminderPending,
} from "@/lib/email-confirmation-reminder";

describe("email confirmation reminder", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("scopes the reminder to the signed-in user", () => {
    markEmailConfirmationReminderPending("user-a");

    expect(hasEmailConfirmationReminderPending("user-a")).toBe(true);
    expect(hasEmailConfirmationReminderPending("user-b")).toBe(false);
    expect(window.sessionStorage.getItem(getEmailConfirmationReminderKey("user-a"))).toBe("1");
  });

  it("clears the reminder after confirmation or dismissal", () => {
    markEmailConfirmationReminderPending("user-a");
    clearEmailConfirmationReminder("user-a");

    expect(hasEmailConfirmationReminderPending("user-a")).toBe(false);
  });
});
