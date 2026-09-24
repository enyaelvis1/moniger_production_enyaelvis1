const NIGERIA_COUNTRY_CODE = "234";

export const phonePlaceholder = "+234 801 234 5678";

const supportedPhoneCharacters = /^[+\d\s().-]+$/;

export const filterPhoneInput = (value: string) => value.replace(/[^+\d\s().-]/g, "");

const stripPhoneFormatting = (value: string) => value.replace(/[\s().-]/g, "");

export const normalizePhoneNumber = (value: string | null | undefined): string | null => {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return null;
  }

  if (!supportedPhoneCharacters.test(trimmedValue)) {
    return null;
  }

  const plusCount = (trimmedValue.match(/\+/g) ?? []).length;
  if (plusCount > 1 || (plusCount === 1 && !trimmedValue.startsWith("+"))) {
    return null;
  }

  const compactValue = stripPhoneFormatting(trimmedValue);
  if (!compactValue) {
    return null;
  }

  if (compactValue.startsWith("+")) {
    const digits = compactValue.slice(1);
    return digits ? `+${digits}` : null;
  }

  const digits = compactValue;
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
