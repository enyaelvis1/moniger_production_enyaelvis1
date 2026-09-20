import { describe, expect, it } from "vitest";
import {
  getPasswordStrength,
  normalizeVerificationCode,
  validatePasswordChangeForm,
} from "@/lib/passwords";

describe("password helpers", () => {
  it("scores password strength from weak to strong", () => {
    expect(getPasswordStrength("short").label).toBe("Weak");
    expect(getPasswordStrength("Password1").label).toBe("Strong");
  });

  it("validates password change requirements", () => {
    expect(
      validatePasswordChangeForm({
        confirmPassword: "short",
        currentPassword: "",
        newPassword: "short",
        verificationCode: "",
      }),
    ).toEqual({
      newPassword: "Password must be at least 8 characters.",
    });

    expect(
      validatePasswordChangeForm({
        confirmPassword: "DifferentPass1!",
        currentPassword: "CurrentPass1!",
        newPassword: "NewPass1!",
        verificationCode: " 123456 ",
      }),
    ).toEqual({
      confirmPassword: "Passwords do not match.",
    });

    expect(
      validatePasswordChangeForm({
        confirmPassword: "CurrentPass1!",
        currentPassword: "CurrentPass1!",
        newPassword: "CurrentPass1!",
        verificationCode: "",
      }),
    ).toEqual({
      newPassword: "New password must be different from the current password.",
    });
  });

  it("normalizes the optional verification code", () => {
    expect(normalizeVerificationCode("  123456  ")).toBe("123456");
  });
});
