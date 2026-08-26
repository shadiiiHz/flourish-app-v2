// Excludes visually ambiguous characters (0/O, 1/I/L).
const CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

export function generateDiscountCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARSET[Math.floor(Math.random() * CODE_CHARSET.length)];
  }
  return code;
}

const BIRTHDAY_SUFFIX_LENGTH = 4;

/** A themed, personal code for a customer's yearly birthday discount, e.g. "FLOURISH-BDAY-A1B2". */
export function generateBirthdayDiscountCode(): string {
  let suffix = "";
  for (let i = 0; i < BIRTHDAY_SUFFIX_LENGTH; i++) {
    suffix += CODE_CHARSET[Math.floor(Math.random() * CODE_CHARSET.length)];
  }
  return `FLOURISH-BDAY-${suffix}`;
}
