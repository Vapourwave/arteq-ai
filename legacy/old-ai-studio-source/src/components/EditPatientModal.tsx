import React, { useState } from 'react';
import { Patient, PatientGender } from '../types';
import { updatePatient } from '../services/patientStore';
import { validatePatientRegistration, calculateAgeFromDob, PatientValidationErrors } from '../utils/validation';
import { X, User, Phone, Calendar, AlertCircle, Save, CheckCircle2 } from 'lucide-react';

interface EditPatientModalProps {
  patient: Patient;
  onClose: () => void;
  onPatientUpdated: (updatedPatient: Patient) => void;
}

export const EditPatientModal: React.FC<EditPatientModalProps> = ({
  patient,
  onClose,
  onPatientUpdated,
}) => {
  const [formData, setFormData] = useState({
    name: patient.patientName,
    age: String(patient.age),
    dob: patient.dob || '',
    useDob: Boolean(patient.dob),
    gender: patient.gender,
    phone: patient.phone,
    address: patient.address || '',
    priority: patient.priority || 'Normal',
  });

  const [errors, setErrors] = useState<PatientValidationErrors>({});
  const [successToast, setSuccessToast] = useState<boolean>(false);

  const handleDobChange = (dobValue: string) => {
    const computedAge = calculateAgeFromDob(dobValue);
    setFormData((prev) => ({
      ...prev,
      dob: dobValue,
      age: computedAge > 0 ? String(computedAge) : prev.age,
    }));
    if (errors.dob) setErrors((prev) => ({ ...prev, dob: undefined }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const { isValid, errors: validationErrors } = validatePatientRegistration(formData);
    if (!isValid) {
      setErrors(validationErrors);
      return;
    }

    const updated = updatePatient(patient.id, {
      patientName: formData.name.trim(),
      age: Number(formData.age) || 0,
      dob: formData.dob || undefined,
      gender: formData.gender as PatientGender,
      phone: formData.phone.trim(),
      address: formData.address ? formData.address.trim() : undefined,
      priority: formData.priority as any,
    });

    if (updated) {
      setSuccessToast(true);
      setTimeout(() => {
        onPatientUpdated(updated);
        onClose();
      }, 1000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {patient.id}
            </span>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">
              Edit Patient Information
            </h3>
          </div>
          <button
            type="button"
            id="close-edit-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Toast Banner */}
        {successToast && (
          <div className="m-4 bg-emerald-50 border border-emerald-300 rounded-2xl p-3.5 flex items-center gap-3 text-emerald-800 text-sm font-bold animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Patient information updated successfully.</span>
          </div>
        )}

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Patient Name */}
          <div>
            <label htmlFor="edit-patient-name" className="block text-xs font-bold text-slate-800 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="edit-patient-name"
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (errors.name) setErrors({ ...errors, name: undefined });
                }}
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 ${
                  errors.name ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-300 focus:ring-blue-500'
                }`}
              />
            </div>
            {errors.name && <p className="text-xs text-rose-500 mt-1 font-medium">{errors.name}</p>}
          </div>

          {/* Age & Gender */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-patient-age" className="block text-xs font-bold text-slate-800 mb-1">
                Age (Years) <span className="text-rose-500">*</span>
              </label>
              <input
                id="edit-patient-age"
                type="number"
                min="0"
                max="120"
                value={formData.age}
                onChange={(e) => {
                  setFormData({ ...formData, age: e.target.value });
                  if (errors.age) setErrors({ ...errors, age: undefined });
                }}
                className={`w-full px-3 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 ${
                  errors.age ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-300 focus:ring-blue-500'
                }`}
              />
              {errors.age && <p className="text-xs text-rose-500 mt-1 font-medium">{errors.age}</p>}
            </div>

            <div>
              <label htmlFor="edit-patient-gender" className="block text-xs font-bold text-slate-800 mb-1">
                Gender <span className="text-rose-500">*</span>
              </label>
              <select
                id="edit-patient-gender"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="edit-patient-phone" className="block text-xs font-bold text-slate-800 mb-1">
              Phone Number <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="edit-patient-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  setFormData({ ...formData, phone: e.target.value });
                  if (errors.phone) setErrors({ ...errors, phone: undefined });
                }}
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 ${
                  errors.phone ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-300 focus:ring-blue-500'
                }`}
              />
            </div>
            {errors.phone && <p className="text-xs text-rose-500 mt-1 font-medium">{errors.phone}</p>}
          </div>

          {/* Address */}
          <div>
            <label htmlFor="edit-patient-address" className="block text-xs font-bold text-slate-800 mb-1">
              Address (Optional)
            </label>
            <textarea
              id="edit-patient-address"
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full p-3 rounded-xl border border-slate-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              id="cancel-edit-patient-btn"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100"
            >
              Cancel
            </button>

            <button
              type="submit"
              id="save-patient-changes-btn"
              disabled={successToast}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
