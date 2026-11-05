export interface CurrencyInfo {
  code: string; // ISO 4217 code (e.g. "INR", "USD")
  name: string; // Currency name (e.g. "Indian Rupee")
  symbol: string; // Currency symbol (e.g. "₹", "$")
  flag: string; // Flag emoji (e.g. "🇮🇳", "🇺🇸")
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: "INR", name: "Indian Rupee", symbol: "₹", flag: "🇮🇳" },
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸" },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺" },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧" },
  { code: "AED", name: "UAE Dirham", symbol: "AED", flag: "🇦🇪" },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR", flag: "🇸🇦" },
  { code: "QAR", name: "Qatari Riyal", symbol: "QAR", flag: "🇶🇦" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KWD", flag: "🇰🇼" },
  { code: "OMR", name: "Omani Rial", symbol: "OMR", flag: "🇴🇲" },
  { code: "BHD", name: "Bahraini Dinar", symbol: "BHD", flag: "🇧🇭" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", flag: "🇸🇬" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", flag: "🇨🇦" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", flag: "🇦🇺" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "🇯🇵" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", flag: "🇨🇭" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", flag: "🇲🇾" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", flag: "🇳🇿" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", flag: "🇨🇳" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", flag: "🇭🇰" },
  { code: "THB", name: "Thai Baht", symbol: "฿", flag: "🇹🇭" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", flag: "🇮🇩" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", flag: "🇵🇭" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", flag: "🇻🇳" },
  { code: "ZAR", name: "South African Rand", symbol: "R", flag: "🇿🇦" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", flag: "🇧🇷" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", flag: "🇹🇷" },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£", flag: "🇪🇬" },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", flag: "🇧🇩" },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨", flag: "🇵🇰" },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs", flag: "🇱🇰" },
  { code: "NPR", name: "Nepalese Rupee", symbol: "Rs", flag: "🇳🇵" },
  { code: "KRW", name: "South Korean Won", symbol: "₩", flag: "🇰🇷" },
];

export const DEFAULT_CURRENCY = "INR";

export function isSupportedCurrency(code: string): boolean {
  if (!code) return false;
  return SUPPORTED_CURRENCIES.some((c) => c.code === code.trim().toUpperCase());
}

export function getCurrencyInfo(code?: string | null): CurrencyInfo {
  const clean = (code || DEFAULT_CURRENCY).trim().toUpperCase();
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code === clean) || {
      code: clean,
      name: clean,
      symbol: clean,
      flag: "🌐",
    }
  );
}

export function getCurrencySymbol(code?: string | null): string {
  return getCurrencyInfo(code).symbol;
}
