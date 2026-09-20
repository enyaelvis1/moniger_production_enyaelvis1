import { describe, expect, it } from "vitest";
import { ValidationRules, createFormValidator, validateFormField } from "@/lib/error-handling";

describe("shared form validation", () => {
  it("returns the first matching error for a field", () => {
    const validator = createFormValidator({
      email: [ValidationRules.trimmedRequired(), ValidationRules.email()],
      name: [ValidationRules.trimmedRequired()],
    });

    expect(
      validator({
        email: "not-an-email",
        name: "   ",
      }),
    ).toEqual({
      email: "Please enter a valid email address",
      name: "This field is required",
    });
  });

  it("allows optional fields to stay empty while still validating bad values", () => {
    const validator = createFormValidator({
      phone: [ValidationRules.optional(ValidationRules.phone())],
      accountNumber: [ValidationRules.optional(ValidationRules.accountNumber())],
    });

    expect(
      validator({
        phone: "",
        accountNumber: "",
      }),
    ).toEqual({});

    expect(
      validator({
        phone: "abc",
        accountNumber: "12345",
      }),
    ).toEqual({
      accountNumber: "Account number must be 10-12 digits",
      phone: "Please enter a valid phone number",
    });

    expect(
      validator({
        phone: "0801 234 5678",
        accountNumber: "",
      }),
    ).toEqual({});

    expect(
      validator({
        phone: "+234 801 234 5678",
        accountNumber: "",
      }),
    ).toEqual({});
  });

  it("validates numeric minimums for money-style inputs", () => {
    const validator = createFormValidator({
      amount: [ValidationRules.minNumber(0.01, "Enter an amount greater than zero.")],
    });

    expect(validator({ amount: 0 })).toEqual({
      amount: "Enter an amount greater than zero.",
    });

    expect(validator({ amount: 1500 })).toEqual({});
  });

  it("supports direct field validation helpers for trimmed required values", () => {
    expect(validateFormField("   ", [ValidationRules.trimmedRequired()])).toBe("This field is required");
    expect(validateFormField("Moniger Ltd", [ValidationRules.trimmedRequired()])).toBeNull();
  });
});
