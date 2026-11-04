import { parsePhoneNumber, isValidPhoneNumber, type CountryCode, getCountryCallingCode } from 'libphonenumber-js';
import { getExampleNumber } from 'libphonenumber-js/mobile';
import examples from 'libphonenumber-js/mobile/examples';

export function validateEmailFormat(email: string): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  if (trimmed.includes('..') || trimmed.includes(' ')) return false;

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) return false;

  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;

  const domainParts = parts[1].split('.');
  if (domainParts.length < 2) return false;

  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) return false;

  return true;
}

export interface PhoneValidationResult {
  isValid: boolean;
  isIncomplete: boolean;
  status: 'idle' | 'incomplete' | 'invalid' | 'valid';
  message: string;
  countryIsoCode: CountryCode;
  dialingCode: string;
  nationalNumber: string;
  e164Number: string;
}

/**
 * Universal phone validation for Cafe4x
 * Strictly separates the country code from the national mobile number.
 * Can receive either:
 * - A clean national number + country code
 * - An E.164 number (+919791336641) from which it automatically extracts the national digits and country code
 */
export function validatePhone(
  rawInput: string,
  countryCode: string = 'IN'
): PhoneValidationResult {
  const isoCode = (countryCode || 'IN').toUpperCase() as CountryCode;
  let dialCode = '+91';
  try {
    dialCode = `+${getCountryCallingCode(isoCode)}`;
  } catch {}

  const trimmed = (rawInput || '').trim();

  // Strip everything except digits and leading plus
  let national = trimmed;
  // If user passed a full international number with + or starts with country dialing code
  const dialDigits = dialCode.replace(/\D/g, '');
  if (national.startsWith('+')) {
    // If starts with +, strip the matching dial code
    const plusDial = `+${dialDigits}`;
    if (national.startsWith(plusDial)) {
      national = national.substring(plusDial.length);
    } else {
      national = national.replace(/^\+/, '');
    }
  } else if (national.startsWith(dialDigits) && national.length > dialDigits.length) {
    // If it starts with country dial code (e.g. 919791336641 when country is IN)
    national = national.substring(dialDigits.length);
  }

  // Keep strictly digits for the national number
  const cleanedNational = national.replace(/\D/g, '');

  if (!cleanedNational) {
    return {
      isValid: false,
      isIncomplete: false,
      status: 'idle',
      message: '',
      countryIsoCode: isoCode,
      dialingCode: dialCode,
      nationalNumber: '',
      e164Number: '',
    };
  }

  // 1. Specific rules for India (IN)
  if (isoCode === 'IN') {
    if (cleanedNational.length < 10) {
      return {
        isValid: false,
        isIncomplete: true,
        status: 'incomplete',
        message: 'Mobile number is incomplete.',
        countryIsoCode: isoCode,
        dialingCode: dialCode,
        nationalNumber: cleanedNational,
        e164Number: '',
      };
    }
    if (cleanedNational.length > 10 || !/^[6-9]\d{9}$/.test(cleanedNational)) {
      return {
        isValid: false,
        isIncomplete: false,
        status: 'invalid',
        message: 'Please enter a valid mobile number for the selected country.',
        countryIsoCode: isoCode,
        dialingCode: dialCode,
        nationalNumber: cleanedNational,
        e164Number: '',
      };
    }
    return {
      isValid: true,
      isIncomplete: false,
      status: 'valid',
      message: 'Mobile number verified successfully.',
      countryIsoCode: isoCode,
      dialingCode: dialCode,
      nationalNumber: cleanedNational,
      e164Number: `+91${cleanedNational}`,
    };
  }

  // 2. Generic International Rules using libphonenumber-js metadata
  try {
    let expectedLength = 10;
    try {
      const ex = getExampleNumber(isoCode, examples);
      if (ex && ex.nationalNumber) {
        expectedLength = ex.nationalNumber.length;
      }
    } catch {}

    const isValid = isValidPhoneNumber(cleanedNational, isoCode);

    if (isValid) {
      const parsed = parsePhoneNumber(cleanedNational, isoCode);
      return {
        isValid: true,
        isIncomplete: false,
        status: 'valid',
        message: 'Mobile number verified successfully.',
        countryIsoCode: isoCode,
        dialingCode: dialCode,
        nationalNumber: cleanedNational,
        e164Number: parsed.format('E.164'),
      };
    }

    if (cleanedNational.length < expectedLength) {
      return {
        isValid: false,
        isIncomplete: true,
        status: 'incomplete',
        message: 'Mobile number is incomplete.',
        countryIsoCode: isoCode,
        dialingCode: dialCode,
        nationalNumber: cleanedNational,
        e164Number: '',
      };
    }

    return {
      isValid: false,
      isIncomplete: false,
      status: 'invalid',
      message: 'Please enter a valid mobile number for the selected country.',
      countryIsoCode: isoCode,
      dialingCode: dialCode,
      nationalNumber: cleanedNational,
      e164Number: '',
    };
  } catch {
    return {
      isValid: false,
      isIncomplete: false,
      status: 'invalid',
      message: 'Please enter a valid mobile number for the selected country.',
      countryIsoCode: isoCode,
      dialingCode: dialCode,
      nationalNumber: cleanedNational,
      e164Number: '',
    };
  }
}

// Backward compatibility aliases
export const validateMobileNumber = validatePhone;
export const validateAndNormalizeMobile = (raw: string, country?: string) => {
  const res = validatePhone(raw, country);
  return {
    isValid: res.isValid,
    message: res.message,
    e164: res.e164Number,
  };
};

export interface UserValidationInput {
  name?: string;
  userName?: string;
  password?: string;
  confirmPassword?: string;
  userType?: string;
  email?: string;
  mobileNumber?: string;
  countryCode?: string;
}

export interface UserValidationResult {
  isValid: boolean;
  errors: {
    name?: string;
    userName?: string;
    password?: string;
    confirmPassword?: string;
    userType?: string;
    email?: string;
    mobileNumber?: string;
  };
}

/**
 * Reusable user validation for Admin, Provider, and general users across Cafe4x.
 * Follows the standard user creation validation rules consistently.
 */
export function validateUserCreation(
  data: UserValidationInput,
  options?: { requireConfirmPassword?: boolean }
): UserValidationResult {
  const errors: UserValidationResult['errors'] = {};

  // 1. Name
  const name = (data.name || '').trim();
  if (!name) {
    errors.name = 'Name is required';
  }

  // 2. User Name
  const userName = (data.userName || '').trim();
  if (!userName) {
    errors.userName = 'User Name is required';
  } else if (userName.length < 3) {
    errors.userName = 'Username must be at least 3 characters long';
  }

  // 3. Password
  const password = data.password || '';
  if (!password) {
    errors.password = 'Password is required';
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters long';
  }

  // 4. Confirm Password (checked if explicitly required or if confirmPassword is provided)
  if (options?.requireConfirmPassword || data.confirmPassword !== undefined) {
    if (!data.confirmPassword) {
      errors.confirmPassword = 'Confirm Password is required';
    } else if (data.confirmPassword !== password) {
      errors.confirmPassword = 'Passwords do not match';
    }
  }

  // 5. User Type
  const userType = (data.userType || '').trim();
  if (!userType) {
    errors.userType = 'User Type is required';
  } else if (!['Admin', 'Provider', 'Staff'].includes(userType)) {
    errors.userType = 'User Type must be Admin or Provider';
  }

  // 6. Email
  const email = (data.email || '').trim();
  if (!email) {
    errors.email = 'Email is required';
  } else if (!validateEmailFormat(email)) {
    errors.email = 'Please enter a valid email address';
  }

  // 7. Mobile Number
  const mobile = (data.mobileNumber || '').trim();
  if (!mobile) {
    errors.mobileNumber = 'Mobile Number is required';
  } else {
    const phoneRes = validatePhone(mobile, data.countryCode || 'IN');
    if (!phoneRes.isValid) {
      errors.mobileNumber = phoneRes.message || 'Please enter a valid mobile number';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
