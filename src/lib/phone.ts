const NIGERIA_COUNTRY_CODE = "234";

export const phonePlaceholder = "+234 801 234 5678";

const stripPhoneFormatting = (value: string) => value.replace(/[^\d+]/g, "");

export const normalizePhoneNumber = (value: string | null | undefined): string | null => {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return null;
  }

  const compactValue = stripPhoneFormatting(trimmedValue);
  if (!compactValue) {
    return null;
  }

  if (compactValue.startsWith("+")) {
    const digits = compactValue.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : null;
  }

  const digits = compactValue.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  if (digits.startsWith("0")) {
    return `+${NIGERIA_COUNTRY_CODE}${digits.slice(1)}`;
  }

  if (digits.startsWith(NIGERIA_COUNTRY_CODE)) {
    return `+${digits}`;
  }

  return `+${digits}`;
};

export const isValidPhoneNumber = (value: string): boolean => {
  const normalizedPhone = normalizePhoneNumber(value);
  return normalizedPhone ? /^\+[1-9]\d{7,14}$/.test(normalizedPhone) : false;
};
