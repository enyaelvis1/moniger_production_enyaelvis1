const NIGERIA_COUNTRY_CODE = "234";

export const phonePlaceholder = "+234 801 234 5678";

const supportedPhoneCharacters = /^[+\d\s().-]+$/;

export const filterPhoneInput = (value: string) => value.replace(/[^+\d\s().-]/g, "");

/** Keep interactive input within the Nigerian phone-number shape. */
export const limitPhoneInput = (value: string) => {
  const filteredValue = filterPhoneInput(value);
  const compactValue = stripPhoneFormatting(filteredValue);
  const digitLimit = compactValue.startsWith("+234") || compactValue.startsWith("234") ? 13 : 11;
  let digitCount = 0;

  return filteredValue
    .split("")
    .filter((character) => {
      if (!/\d/.test(character)) {
        return true;
      }
      digitCount += 1;
      return digitCount <= digitLimit;
    })
    .join("");
};

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
    return digits.startsWith(NIGERIA_COUNTRY_CODE) && digits.length === 13 ? `+${digits}` : null;
  }

  const digits = compactValue;
  if (!digits) {
    return null;
  }

  if (digits.startsWith("0")) {
    return digits.length === 11 ? `+${NIGERIA_COUNTRY_CODE}${digits.slice(1)}` : null;
  }

  if (digits.startsWith(NIGERIA_COUNTRY_CODE)) {
    return digits.length === 13 ? `+${digits}` : null;
  }

  return null;
};

export const isValidPhoneNumber = (value: string): boolean => {
  return normalizePhoneNumber(value) !== null;
};
