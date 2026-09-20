import type { ValidationRule } from "@/lib/error-handling";

export type PasswordStrength = {
  fillClassName: string;
  label: string;
  score: number;
  textClassName: string;
};

export type PasswordChangeFormValues = {
  confirmPassword: string;
  currentPassword: string;
  newPassword: string;
  verificationCode: string;
};

export type PasswordChangeFormErrors = Partial<
  Record<keyof PasswordChangeFormValues, string>
>;

const passwordMinimumLengthRule: ValidationRule<string> = {
  validate: (value) => value.length >= 8,
  message: "Password must be at least 8 characters.",
};

export const getPasswordStrength = (password: string): PasswordStrength => {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) {
    return {
      fillClassName: "bg-[#DC2626]",
      label: "Weak",
      score: 1,
      textClassName: "text-[#DC2626]",
    };
  }

  if (score <= 2) {
    return {
      fillClassName: "bg-[#D97706]",
      label: "Fair",
      score: 2,
      textClassName: "text-[#D97706]",
    };
  }

  return {
    fillClassName: "bg-[#16A34A]",
    label: "Strong",
    score: 3,
    textClassName: "text-[#16A34A]",
  };
};

export const normalizeVerificationCode = (value: string) => value.trim();

export const validatePasswordChangeForm = (
  values: PasswordChangeFormValues,
): PasswordChangeFormErrors => {
  const errors: PasswordChangeFormErrors = {};
  const verificationCode = normalizeVerificationCode(values.verificationCode);

  if (!values.newPassword) {
    errors.newPassword = "Enter a new password.";
  } else if (!passwordMinimumLengthRule.validate(values.newPassword)) {
    errors.newPassword = passwordMinimumLengthRule.message;
  } else if (values.currentPassword && values.newPassword === values.currentPassword) {
    errors.newPassword = "New password must be different from the current password.";
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = "Confirm your new password.";
  } else if (values.confirmPassword !== values.newPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  if (values.verificationCode && !verificationCode) {
    errors.verificationCode = "Enter the verification code without extra spaces.";
  }

  return errors;
};
