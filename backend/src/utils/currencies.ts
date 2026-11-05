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

/**
 * ISO 3166-1 alpha-2 country code to default ISO 4217 currency mapping.
 * Connects the phone country selector to the organization currency.
 */
export const COUNTRY_DEFAULT_CURRENCIES: Record<string, string> = {
  // Required priority countries
  IN: "INR", // India
  US: "USD", // USA
  GB: "GBP", // United Kingdom
  SA: "SAR", // Saudi Arabia
  AE: "AED", // United Arab Emirates
  SG: "SGD", // Singapore
  AU: "AUD", // Australia
  CA: "CAD", // Canada
  DE: "EUR", // Germany
  QA: "QAR", // Qatar
  KW: "KWD", // Kuwait
  OM: "OMR", // Oman

  // Middle East
  BH: "BHD", // Bahrain
  EG: "EGP", // Egypt
  TR: "TRY", // Turkey

  // Asia Pacific
  JP: "JPY", // Japan
  CN: "CNY", // China
  HK: "HKD", // Hong Kong
  NZ: "NZD", // New Zealand
  MY: "MYR", // Malaysia
  TH: "THB", // Thailand
  ID: "IDR", // Indonesia
  PH: "PHP", // Philippines
  VN: "VND", // Vietnam
  KR: "KRW", // South Korea
  LK: "LKR", // Sri Lanka
  BD: "BDT", // Bangladesh
  PK: "PKR", // Pakistan
  NP: "NPR", // Nepal

  // Europe (Eurozone)
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  IE: "EUR",
  PT: "EUR",
  FI: "EUR",
  GR: "EUR",
  LU: "EUR",
  CY: "EUR",
  MT: "EUR",
  SK: "EUR",
  SI: "EUR",
  EE: "EUR",
  LV: "EUR",
  LT: "EUR",
  CH: "CHF", // Switzerland

  // Americas & Africa
  BR: "BRL", // Brazil
  ZA: "ZAR", // South Africa
};

export function getDefaultCurrencyForCountry(countryCode?: string | null): string {
  if (!countryCode) return DEFAULT_CURRENCY;
  const iso = countryCode.trim().toUpperCase();
  return COUNTRY_DEFAULT_CURRENCIES[iso] || "USD";
}

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
