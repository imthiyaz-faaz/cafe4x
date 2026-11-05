import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';
import { getExampleNumber } from 'libphonenumber-js/mobile';
import examples from 'libphonenumber-js/mobile/examples';
import { getDefaultCurrencyForCountry } from './currencies';

export interface CountryInfo {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
  expectedLength: number;
  defaultCurrency: string;
  exampleNumber: string;
  placeholder: string;
}

const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });

export const PROMPT_COUNTRY_EXAMPLES: Record<string, string> = {
  IN: '9876543210',
  US: '2025550123',
  GB: '7911123456',
  SA: '512345678',
  AE: '501234567',
  SG: '81234567',
  AU: '412345678',
  CA: '4165550123',
  DE: '15123456789',
  QA: '33123456',
  KW: '50012345',
  OM: '92123456',
  BH: '36001234',
  EG: '1001234567',
  LK: '771234567',
  BD: '1712345678',
  PK: '3012345678',
  NP: '9841234567',
  MY: '123456789',
  NZ: '211234567',
  JP: '9012345678',
  CH: '781234567',
  FR: '612345678',
};

export function getCountryFlag(countryCode: string): string {
  try {
    return countryCode
      .toUpperCase()
      .replace(/./g, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397));
  } catch {
    return '🌐';
  }
}

export function getAllCountries(): CountryInfo[] {
  const codes = getCountries();
  const list: CountryInfo[] = [];

  for (const c of codes) {
    try {
      const dialCode = `+${getCountryCallingCode(c)}`;
      let name = c as string;
      try {
        name = displayNames.of(c) || c;
      } catch {
        name = c;
      }
      const flag = getCountryFlag(c);
      let expectedLength = 10;
      let exNum = '';
      try {
        const ex = getExampleNumber(c, examples);
        if (ex && ex.nationalNumber) {
          expectedLength = ex.nationalNumber.length;
          exNum = ex.nationalNumber;
        }
      } catch {}

      const placeholder = PROMPT_COUNTRY_EXAMPLES[c] || exNum || '9876543210';
      const defaultCurrency = getDefaultCurrencyForCountry(c);

      list.push({
        code: c,
        name,
        dialCode,
        flag,
        expectedLength,
        defaultCurrency,
        exampleNumber: placeholder,
        placeholder,
      });
    } catch {}
  }

  // Sort with common priority countries at the top
  const priorityOrder: Record<string, number> = {
    IN: 1,
    US: 2,
    GB: 3,
    AE: 4,
    SA: 5,
    SG: 6,
    AU: 7,
    CA: 8,
    DE: 9,
    QA: 10,
    KW: 11,
    OM: 12,
    LK: 13,
  };

  return list.sort((a, b) => {
    const pA = priorityOrder[a.code] || 999;
    const pB = priorityOrder[b.code] || 999;
    if (pA !== pB) return pA - pB;
    return a.name.localeCompare(b.name);
  });
}
