export interface PasswordRequirement {
  key: string;
  label: string;
  met: boolean;
}

export interface PasswordStrength {
  metCount: number;
  label: string;
  percent: number;
  barColorClass: string;
  requirements: PasswordRequirement[];
}

const STRENGTH_LEVELS: { label: string; percent: number; barColorClass: string }[] = [
  { label: "خیلی کوتاه", percent: 0, barColorClass: "bg-cocoa-900/15" },
  { label: "خیلی کوتاه", percent: 20, barColorClass: "bg-danger-500" },
  { label: "ضعیف", percent: 40, barColorClass: "bg-danger-500" },
  { label: "متوسط", percent: 60, barColorClass: "bg-sand-400" },
  { label: "قوی", percent: 80, barColorClass: "bg-sand-400" },
  { label: "خیلی قوی", percent: 100, barColorClass: "bg-sand-500" },
];

export function getPasswordStrength(password: string): PasswordStrength {
  const requirements: PasswordRequirement[] = [
    { key: "length", label: "حداقل ۸ کاراکتر", met: password.length >= 8 },
    { key: "upper", label: "شامل حروف بزرگ", met: /[A-Z]/.test(password) },
    { key: "lower", label: "شامل حروف کوچک", met: /[a-z]/.test(password) },
    { key: "digit", label: "شامل اعداد", met: /[0-9]/.test(password) },
    { key: "symbol", label: "شامل نمادهای خاص (مثل @$!%*?&^#)", met: /[^A-Za-z0-9]/.test(password) },
  ];

  const metCount = password.length === 0 ? 0 : requirements.filter((r) => r.met).length;
  const { label, percent, barColorClass } = STRENGTH_LEVELS[metCount];

  return { metCount, label, percent, barColorClass, requirements };
}
