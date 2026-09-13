import React, { useState } from 'react';
import { PatientFormState, Patient } from '../../types';
import { validatePatientRegistration, calculateAgeFromDob, PatientValidationErrors } from '../../utils/validation';
import { findDuplicateByPhone, saveNewPatient } from '../../services/patientStore';
import { User, Phone, Calendar, ArrowRight, Sparkles, AlertCircle, CheckCircle2, MapPin, ShieldAlert, FileText, ArrowLeft } from 'lucide-react';

interface Step1PatientInfoProps {
  initialData: PatientFormState;
  onContinue: (data: PatientFormState, savedPatient?: Patient) => void;
  onCancel: () => void;
  onViewPatientDetails?: (patient: Patient) => void;
}

export const Step1PatientInfo: React.FC<Step1PatientInfoProps> = ({
  initialData,
  onContinue,
  onCancel,
  onViewPatientDetails,
}) => {
  const [formData, setFormData] = useState<PatientFormState>({
    name: initialData.name || '',
    age: initialData.age || '',
    dob: initialData.dob || '',
    useDob: initialData.useDob || false,
    gender: initialData.gender || 'Male',
    phone: initialData.phone || '',
    address: initialData.address || '',
    priority: initialData.priority || 'Normal',
  });

  const [errors, setErrors] = useState<PatientValidationErrors>({});
  const [duplicateMatch, setDuplicateMatch] = useState<Patient | null>(null);
  const [bypassDuplicate, setBypassDuplicate] = useState<boolean>(false);
  
  // Registration Success State
  const [registeredPatient, setRegisteredPatient] = useState<Patient | null>(null);

  // Handle DOB change -> calculate age
  const handleDobChange = (dobValue: string) => {
    const computedAge = calculateAgeFromDob(dobValue);
    setFormData((prev) => ({
      ...prev,
      dob: dobValue,
      age: computedAge > 0 ? String(computedAge) : prev.age,
    }));
    if (errors.dob) setErrors((prev) => ({ ...prev, dob: undefined }));
    if (errors.age) setErrors((prev) => ({ ...prev, age: undefined }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validate Form Fields
    const { isValid, errors: validationErrors } = validatePatientRegistration(formData);
    if (!isValid) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    // 2. Duplicate Check by Phone Number
    if (!bypassDuplicate) {
      const match = findDuplicateByPhone(formData.phone);
      if (match) {
        setDuplicateMatch(match);
        return; // Pause and display Possible Existing Patient warning
      }
    }

    // 3. Save Patient to Local Store
    const newPatient = saveNewPatient({
      patientName: formData.name,
      age: Number(formData.age) || 0,
      dob: formData.dob,
      gender: formData.gender,
      phone: formData.phone,
      address: formData.address,
      priority: formData.priority,
    });

    setRegisteredPatient(newPatient);
  };

  // Handle selecting duplicate existing patient
  const handleUseExistingPatient = () => {
    if (!duplicateMatch) return;
    setFormData({
      patientId: duplicateMatch.id,
      name: duplicateMatch.patientName,
      age: String(duplicateMatch.age),
      dob: duplicateMatch.dob || '',
      gender: duplicateMatch.gender,
      phone: duplicateMatch.phone,
      address: duplicateMatch.address || '',
      priority: duplicateMatch.priority || 'Normal',
    });
    setRegisteredPatient(duplicateMatch);
    setDuplicateMatch(null);
  };

  // Handle bypassing duplicate check and registering as new
  const handleRegisterAsNew = () => {
    setBypassDuplicate(true);
    setDuplicateMatch(null);

    const newPatient = saveNewPatient({
      patientName: formData.name,
      age: Number(formData.age) || 0,
      dob: formData.dob,
      gender: formData.gender,
      phone: formData.phone,
      address: formData.address,
      priority: formData.priority,
    });

    setRegisteredPatient(newPatient);
  };

  // Quick preset fills for testing
  const handleQuickFill = (preset: 'rahul' | 'anjali' | 'arun') => {
    if (preset === 'rahul') {
      setFormData({
        name: 'Rahul Kumar',
        age: '32',
        dob: '1994-02-14',
        useDob: false,
        gender: 'Male',
        phone: '9876543210',
        address: '42 MG Road, Indiranagar, City',
        priority: 'Normal',
      });
    } else if (preset === 'anjali') {
      setFormData({
        name: 'Anjali Sharma',
        age: '28',
        dob: '1998-07-21',
        useDob: false,
        gender: 'Female',
        phone: '9812345678',
        address: '15 Park Street, Koramangala, City',
        priority: 'Normal',
      });
    } else if (preset === 'arun') {
      setFormData({
        name: 'Arun Varma',
        age: '65',
        dob: '1961-11-05',
        useDob: true,
        gender: 'Male',
        phone: '9988776655',
        address: '88 Lake View Colony, City',
        priority: 'Senior Citizen',
      });
    }
    setErrors({});
    setDuplicateMatch(null);
    setRegisteredPatient(null);
  };

  const handleContinueToServiceRequest = () => {
    if (!registeredPatient) return;
    const finalFormState: PatientFormState = {
      patientId: registeredPatient.id,
      name: registeredPatient.patientName,
      age: String(registeredPatient.age),
      dob: registeredPatient.dob,
      gender: registeredPatient.gender,
      phone: registeredPatient.phone,
      address: registeredPatient.address,
      priority: registeredPatient.priority || 'Normal',
    };
    onContinue(finalFormState, registeredPatient);
  };

  // -------------------------------------------------------------
  // STATE 1: REGISTRATION SUCCESS SCREEN
  // -------------------------------------------------------------
  if (registeredPatient) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-md text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Checkmark Icon */}
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-200">
            ✓ Registration Complete
          </span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-2">
            Patient Registered
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Patient ID has been automatically generated and saved to hospital store.
          </p>
        </div>

        {/* Patient Summary Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <div>
              <p className="text-xs text-slate-500 font-medium">Patient Name</p>
              <p className="text-base font-extrabold text-slate-900">{registeredPatient.patientName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 font-medium">Patient ID</p>
              <p className="text-sm font-mono font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                {registeredPatient.id}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs text-slate-700 pt-1">
            <div>
              <span className="text-slate-500 font-medium block">Phone:</span>
              <span className="font-bold text-slate-900">{registeredPatient.phone}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Demographics:</span>
              <span className="font-bold text-slate-900">{registeredPatient.age} Yrs • {registeredPatient.gender}</span>
            </div>
            {registeredPatient.address && (
              <div className="col-span-2">
                <span className="text-slate-500 font-medium block">Address:</span>
                <span className="font-semibold text-slate-800">{registeredPatient.address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            id="register-success-continue-btn"
            onClick={handleContinueToServiceRequest}
            className="w-full sm:w-auto px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all transform active:scale-95"
          >
            <span>Continue to Service Request</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {onViewPatientDetails && (
            <button
              type="button"
              id="register-success-view-patient-btn"
              onClick={() => onViewPatientDetails(registeredPatient)}
              className="w-full sm:w-auto px-5 py-3.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              <span>View Patient</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STATE 2: MAIN REGISTRATION FORM (+ DUPLICATE WARNING)
  // -------------------------------------------------------------
  return (
    <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
      {/* Title & Quick Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Patient Registration</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Fill in the patient's basic details to start a new consultation
          </p>
        </div>

        {/* Preset Fill Bar */}
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs shrink-0 self-start sm:self-auto">
          <span className="text-slate-400 font-medium px-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" /> Preset:
          </span>
          <button
            type="button"
            id="preset-fill-rahul"
            onClick={() => handleQuickFill('rahul')}
            className="px-2 py-0.5 rounded bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 font-semibold border border-slate-200 transition-colors"
          >
            Rahul
          </button>
          <button
            type="button"
            id="preset-fill-anjali"
            onClick={() => handleQuickFill('anjali')}
            className="px-2 py-0.5 rounded bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 font-semibold border border-slate-200 transition-colors"
          >
            Anjali
          </button>
        </div>
      </div>

      {/* Duplicate Check Warning Banner */}
      {duplicateMatch && (
        <div className="mt-6 bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-extrabold text-amber-900 text-base">Possible Existing Patient</h3>
              <p className="text-xs text-amber-800 mt-0.5">
                A patient with phone number <strong className="font-mono">{formData.phone}</strong> already exists in local records:
              </p>
            </div>
          </div>

          <div className="bg-white border border-amber-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-slate-800">
            <div>
              <p className="font-extrabold text-sm text-slate-900">{duplicateMatch.patientName}</p>
              <p className="text-slate-500 mt-0.5">
                {duplicateMatch.age} Yrs • {duplicateMatch.gender} • Registered {duplicateMatch.registrationDate}
              </p>
            </div>
            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
              {duplicateMatch.id}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            <button
              type="button"
              id="use-existing-patient-btn"
              onClick={handleUseExistingPatient}
              className="w-full sm:w-auto px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Use Existing Patient ({duplicateMatch.id})</span>
            </button>

            <button
              type="button"
              id="register-as-new-patient-btn"
              onClick={handleRegisterAsNew}
              className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs rounded-xl transition-colors"
            >
              Register as New Patient
            </button>
          </div>
        </div>
      )}

      {/* Main Registration Form */}
      <form onSubmit={handleFormSubmit} className="mt-6 space-y-5">
        {/* Full Name */}
        <div>
          <label htmlFor="patient-name-input" className="block text-sm font-bold text-slate-800 mb-1.5">
            Full Name <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <User className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="patient-name-input"
              type="text"
              placeholder="Enter patient's full name"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (errors.name) setErrors({ ...errors, name: undefined });
              }}
              className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm font-medium bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                errors.name
                  ? 'border-rose-400 ring-2 ring-rose-100 text-rose-900'
                  : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500 text-slate-900'
              }`}
            />
          </div>
          {errors.name && (
            <p className="text-xs text-rose-500 mt-1 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3.5 h-3.5" /> {errors.name}
            </p>
          )}
        </div>

        {/* Age vs Date of Birth Toggle Header */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-800">
              Age or Date of Birth <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              id="toggle-dob-option-btn"
              onClick={() => {
                const nextUseDob = !formData.useDob;
                setFormData({ ...formData, useDob: nextUseDob });
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{formData.useDob ? 'Enter Age directly' : 'Use Date of Birth instead'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Conditional DOB Input */}
            {formData.useDob ? (
              <div>
                <label htmlFor="patient-dob-input" className="block text-xs font-bold text-slate-700 mb-1">
                  Date of Birth
                </label>
                <input
                  id="patient-dob-input"
                  type="date"
                  value={formData.dob || ''}
                  onChange={(e) => handleDobChange(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium bg-white focus:outline-none focus:ring-2 transition-all ${
                    errors.dob ? 'border-rose-400 ring-2 ring-rose-100 text-rose-900' : 'border-slate-300 focus:ring-blue-500'
                  }`}
                />
                {errors.dob && (
                  <p className="text-xs text-rose-500 mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" /> {errors.dob}
                  </p>
                )}
                {formData.age && (
                  <p className="text-xs text-emerald-700 font-bold mt-1">
                    Calculated Age: {formData.age} years
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label htmlFor="patient-age-input" className="block text-xs font-bold text-slate-700 mb-1">
                  Age (Years)
                </label>
                <input
                  id="patient-age-input"
                  type="number"
                  min="0"
                  max="120"
                  placeholder="e.g. 32"
                  value={formData.age}
                  onChange={(e) => {
                    setFormData({ ...formData, age: e.target.value });
                    if (errors.age) setErrors({ ...errors, age: undefined });
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium bg-white focus:outline-none focus:ring-2 transition-all ${
                    errors.age ? 'border-rose-400 ring-2 ring-rose-100 text-rose-900' : 'border-slate-300 focus:ring-blue-500'
                  }`}
                />
                {errors.age && (
                  <p className="text-xs text-rose-500 mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" /> {errors.age}
                  </p>
                )}
              </div>
            )}

            {/* Gender */}
            <div>
              <label htmlFor="patient-gender-select" className="block text-xs font-bold text-slate-700 mb-1">
                Gender <span className="text-rose-500">*</span>
              </label>
              <select
                id="patient-gender-select"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 cursor-pointer"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>
        </div>

        {/* Phone Number */}
        <div>
          <label htmlFor="patient-phone-input" className="block text-sm font-bold text-slate-800 mb-1.5">
            Phone Number <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Phone className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="patient-phone-input"
              type="tel"
              placeholder="Enter phone number"
              value={formData.phone}
              onChange={(e) => {
                setFormData({ ...formData, phone: e.target.value });
                if (errors.phone) setErrors({ ...errors, phone: undefined });
                if (duplicateMatch) setDuplicateMatch(null);
              }}
              className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm font-medium bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                errors.phone
                  ? 'border-rose-400 ring-2 ring-rose-100 text-rose-900'
                  : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500 text-slate-900'
              }`}
            />
          </div>
          {errors.phone && (
            <p className="text-xs text-rose-500 mt-1 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3.5 h-3.5" /> {errors.phone}
            </p>
          )}
        </div>

        {/* Address (Optional) */}
        <div>
          <label htmlFor="patient-address-textarea" className="block text-sm font-bold text-slate-800 mb-1.5">
            Address <span className="text-xs text-slate-400 font-normal">(Optional)</span>
          </label>
          <div className="relative">
            <textarea
              id="patient-address-textarea"
              rows={2}
              placeholder="Enter address"
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full p-3.5 rounded-xl border border-slate-300 text-sm font-medium bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 transition-all"
            />
          </div>
        </div>

        {/* Category Priority */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Patient Category
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'Normal', label: 'Normal' },
              { id: 'Senior Citizen', label: 'Senior Citizen' },
              { id: 'Emergency', label: 'Emergency' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                id={`priority-btn-${p.id.toLowerCase().replace(' ', '-')}`}
                onClick={() => setFormData({ ...formData, priority: p.id as any })}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  formData.priority === p.id
                    ? p.id === 'Emergency'
                      ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                      : p.id === 'Senior Citizen'
                      ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                      : 'bg-blue-600 border-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Buttons */}
        <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
          <button
            type="button"
            id="step1-cancel-btn"
            onClick={onCancel}
            className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-sm transition-colors"
          >
            Cancel
          </button>

          <button
            type="submit"
            id="register-patient-submit-btn"
            className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-md flex items-center gap-2 transition-all transform active:scale-95"
          >
            <span>Register Patient →</span>
          </button>
        </div>
      </form>
    </div>
  );
};
