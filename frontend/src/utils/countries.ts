import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';
import { getExampleNumber } from 'libphonenumber-js/mobile';
import examples from 'libphonenumber-js/mobile/examples';

export interface CountryInfo {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
  expectedLength: number;
}

const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });

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
      try {
        const ex = getExampleNumber(c, examples);
        if (ex && ex.nationalNumber) {
          expectedLength = ex.nationalNumber.length;
        }
      } catch {}

      list.push({
        code: c,
        name,
        dialCode,
        flag,
        expectedLength,
      });
    } catch {}
  }

  // Sort with common priority countries at the top: IN, US, GB, AE, SA, LK, CA, AU
  const priorityOrder: Record<string, number> = {
    IN: 1,
    US: 2,
    GB: 3,
    AE: 4,
    SA: 5,
    LK: 6,
    CA: 7,
    AU: 8,
  };

  return list.sort((a, b) => {
    const pA = priorityOrder[a.code] || 999;
    const pB = priorityOrder[b.code] || 999;
    if (pA !== pB) return pA - pB;
    return a.name.localeCompare(b.name);
  });
}
