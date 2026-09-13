import { PatientFormState } from '../types';

export interface PatientValidationErrors {
  name?: string;
  age?: string;
  dob?: string;
  gender?: string;
  phone?: string;
  address?: string;
}

/**
 * Calculates patient age in years from a Date of Birth string (YYYY-MM-DD).
 */
export function calculateAgeFromDob(dobString: string): number {
  if (!dobString) return 0;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return 0;
  
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return age >= 0 ? age : 0;
}

/**
 * Validates basic patient registration fields.
 */
export function validatePatientRegistration(form: PatientFormState): {
  isValid: boolean;
  errors: PatientValidationErrors;
} {
  const errors: PatientValidationErrors = {};

  // 1. Full Name Validation
  if (!form.name || !form.name.trim()) {
    errors.name = "Please enter the patient's name.";
  } else if (form.name.trim().length < 2) {
    errors.name = "Patient name must be at least 2 characters long.";
  }

  // 2. Age / DOB Validation
  if (form.useDob) {
    if (!form.dob) {
      errors.dob = "Please select a valid date of birth.";
    } else {
      const calculatedAge = calculateAgeFromDob(form.dob);
      if (calculatedAge < 0 || calculatedAge > 120) {
        errors.dob = "Please enter a valid date of birth.";
      }
    }
  } else {
    if (!form.age || form.age.trim() === '') {
      errors.age = "Please enter a valid age.";
    } else {
      const numAge = Number(form.age);
      if (isNaN(numAge) || numAge < 0 || numAge > 120) {
        errors.age = "Please enter a valid age.";
      }
    }
  }

  // 3. Gender Validation
  if (!form.gender) {
    errors.gender = "Please select a gender.";
  }

  // 4. Phone Number Validation
  if (!form.phone || !form.phone.trim()) {
    errors.phone = "Please enter a valid phone number.";
  } else {
    // Basic phone validation: digits, optional leading +, spaces, hyphens
    const cleanDigits = form.phone.replace(/\D/g, '');
    if (cleanDigits.length < 8 || cleanDigits.length > 15) {
      errors.phone = "Please enter a valid phone number.";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
