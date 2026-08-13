const persianToEnglishDigits: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

export function normalizeDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => persianToEnglishDigits[digit] ?? digit);
}

const englishToPersianDigits: Record<string, string> = {
  "0": "۰", "1": "۱", "2": "۲", "3": "۳", "4": "۴",
  "5": "۵", "6": "۶", "7": "۷", "8": "۸", "9": "۹",
};

export function toPersianDigits(value: string) {
  return value.replace(/[0-9]/g, (digit) => englishToPersianDigits[digit] ?? digit);
}

export const PHONE_REGEX = /^09\d{9}$/;
