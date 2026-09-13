import type { ConversationState } from "@arteq/shared";
import { IdentityVerificationFlow } from "../identity/IdentityVerificationFlow";

export type TouchStage =
  | { kind: "idle" }
  | { kind: "departments" }
  | { kind: "dept-confirm"; departmentId: string; departmentName: string }
  | { kind: "doctors" }
  | { kind: "doctor-confirm"; doctorId: string; doctorName: string }
  | { kind: "ready" };

function ProgressIndicator({ stage }: { stage: TouchStage }) {
  if (stage.kind === "idle") return null;
  const currentStep = 
    (stage.kind === "departments" || stage.kind === "dept-confirm") ? 1 :
    (stage.kind === "doctors" || stage.kind === "doctor-confirm") ? 2 :
    stage.kind === "ready" ? 3 : 0;
  
  return (
    <div className="progress-indicator">
      <span data-active={currentStep === 1}>Department</span>
      <span className="separator">→</span>
      <span data-active={currentStep === 2}>Doctor</span>
      <span className="separator">→</span>
      <span data-active={currentStep === 3}>OP Ticket</span>
    </div>
  );
}

export function DepartmentDoctorPanel({
  stage,
  conversationState,
  onSelectDepartment,
  onSelectDoctor,
  onConfirmDepartment,
  onConfirmDoctor,
  onBack,
  slideDirection,
  requestOTP,
  verifyOTP,
  registerPatient,
  onIdentityStepChange,
}: {
  stage: TouchStage;
  conversationState: ConversationState;
  onSelectDepartment: (departmentId: string) => void;
  onSelectDoctor: (doctorId: string) => void;
  onConfirmDepartment: () => void;
  onConfirmDoctor: () => void;
  onBack: () => void;
  slideDirection: "forward" | "back";
  requestOTP: (phone: string) => Promise<{ success: boolean; message?: string }>;
  verifyOTP: (phone: string, code: string) => Promise<{ success: boolean; patient?: any; message?: string }>;
  registerPatient: (name: string, phone: string, address?: string, idPhotoRef?: string) => void;
  onIdentityStepChange?: (step: string) => void;
}) {
  const { departmentsShown, doctorsShown, patientFlowState, selectedDepartment } = conversationState;

  if (stage.kind === "idle") {
    return null;
  }

  return (
    <div className="nav-panel option-stage">
      <ProgressIndicator stage={stage} />
      
      <div 
        key={`${stage.kind}-${stage.kind === 'dept-confirm' ? stage.departmentId : stage.kind === 'doctor-confirm' ? stage.doctorId : ''}`} 
        className="option-stage-panel" 
        data-direction={slideDirection}
      >
        {/* Navigation header */}
        <div className="stage-header">
          {(stage.kind === "dept-confirm" || stage.kind === "doctors" || stage.kind === "doctor-confirm") && (
            <button className="link-action stage-back-btn" onClick={onBack}>
              {stage.kind === "doctors" ? "Departments" : stage.kind === "dept-confirm" ? "Change" : "← Previous"}
            </button>
          )}
        </div>

        {stage.kind === "departments" && (
          <div className="option-group">
            <p className="option-group-label">Department</p>
            {departmentsShown.length > 0 ? (
              <div className="option-cards">
                {departmentsShown.map((department) => (
                  <button
                    key={department.id}
                    type="button"
                    className="option-card"
                    data-selected={false}
                    onClick={() => onSelectDepartment(department.id)}
                  >
                    <span className="option-card-title">{department.name}</span>
                    <span className="option-card-detail">{department.description}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="loading-state">
                <p>Finding available departments...</p>
                <div className="loading-dots">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                </div>
              </div>
            )}
          </div>
        )}

        {stage.kind === "dept-confirm" && (
          <div className="option-group">
            <p className="option-group-label">Selected Department</p>
            <div className="option-cards">
              <div className="option-card glass-gel-confirmation" data-selected={true}>
                <span className="option-card-title">{stage.departmentName}</span>
              </div>
            </div>
            <div className="stage-confirm-area">
              <button className="primary-action" onClick={onConfirmDepartment}>
                Confirm Department
              </button>
            </div>
          </div>
        )}

        {stage.kind === "doctors" && (
          <div className="option-group">
            <p className="option-group-label">
              {selectedDepartment ? `${selectedDepartment.name} Doctors` : "Doctor"}
            </p>
            {doctorsShown.length > 0 ? (
              <div className="option-cards">
                {doctorsShown.map((doctor) => (
                  <button
                    key={doctor.id}
                    type="button"
                    className="option-card"
                    data-selected={false}
                    disabled={!doctor.isAvailableToday}
                    onClick={() => onSelectDoctor(doctor.id)}
                  >
                    <span className="option-card-title">{doctor.name}</span>
                    <span className="option-card-detail">
                      {selectedDepartment ? `${selectedDepartment.name} · ` : ""}
                      {doctor.specialization} · {doctor.availableTimings}
                    </span>
                    <span className="option-card-detail">
                      {doctor.isAvailableToday
                        ? `${doctor.currentQueueLength} waiting · ~${doctor.estimatedWaitMinutes} min`
                        : "Not available today"}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="loading-state">
                <p>Finding available doctors...</p>
                <div className="loading-dots">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                </div>
              </div>
            )}
          </div>
        )}

        {stage.kind === "doctor-confirm" && (
          <div className="option-group">
            <p className="option-group-label">Selected Doctor</p>
            <div className="option-cards">
              <div className="option-card glass-gel-confirmation" data-selected={true}>
                <span className="option-card-title">{stage.doctorName}</span>
                {selectedDepartment && (
                  <span className="option-card-detail">{selectedDepartment.name}</span>
                )}
              </div>
            </div>
            <div className="stage-confirm-area">
              <button className="primary-action" onClick={onConfirmDoctor}>
                Confirm Doctor
              </button>
            </div>
          </div>
        )}

        {(stage.kind === "ready" || (patientFlowState !== "none" && patientFlowState !== "verified")) && (
          <>
            {patientFlowState === "verified" ? (
              <div className="option-group">
                <p className="option-group-label">Ready</p>
                <div className="option-cards">
                  <div className="option-card glass-gel-confirmation" data-selected={true}>
                    <span className="option-card-title">All details confirmed.</span>
                    <span className="option-card-detail">Identity verified. Please get your OP Ticket to proceed.</span>
                  </div>
                </div>
              </div>
            ) : (
              <IdentityVerificationFlow 
                requestOTP={requestOTP}
                verifyOTP={verifyOTP}
                registerPatient={registerPatient}
                onStepChange={onIdentityStepChange}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
