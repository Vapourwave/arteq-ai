import React, { useState } from 'react';
import { WorkflowStep, PatientFormState, ServiceRequestState, Doctor, PatientRecord, Patient } from '../types';
import { WorkflowProgress } from './WorkflowProgress';
import { Step1PatientInfo } from './workflow/Step1PatientInfo';
import { Step2ServiceRequest } from './workflow/Step2ServiceRequest';
import { Step3Recommendation } from './workflow/Step3Recommendation';
import { Step4ConfirmOp } from './workflow/Step4ConfirmOp';
import { Step5OpTicketReady } from './workflow/Step5OpTicketReady';
import { INITIAL_HOSPITAL_INFO } from '../data/mockData';
import { 
  createOpVisit, 
  generateNextTokenNumber, 
  generateOpNumber, 
  checkActiveDuplicateVisit, 
  calculateQueuePosition,
  getFormattedDisplayDate
} from '../services/tokenService';

interface NewPatientWorkflowProps {
  queue?: PatientRecord[];
  onWorkflowComplete: (newRecord: PatientRecord) => void;
  onCancelWorkflow: () => void;
  onViewQueue: () => void;
  onViewPatientDetails?: (patient: Patient) => void;
}

export const NewPatientWorkflow: React.FC<NewPatientWorkflowProps> = ({
  queue = [],
  onWorkflowComplete,
  onCancelWorkflow,
  onViewQueue,
  onViewPatientDetails,
}) => {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Workflow Form State
  const [patientInfo, setPatientInfo] = useState<PatientFormState>({
    name: 'Rahul Kumar',
    age: '32',
    gender: 'Male',
    phone: '9876543210',
    priority: 'Normal',
  });

  const [serviceRequest, setServiceRequest] = useState<ServiceRequestState>({
    rawText: '',
    voiceSimulated: false,
  });

  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDept, setSelectedDept] = useState<string>('Dentistry');
  const [aiRoutingAudit, setAiRoutingAudit] = useState<any>(null);

  // Generated Ticket Result State
  const [generatedTicket, setGeneratedTicket] = useState<PatientRecord | null>(null);

  // Handlers
  const handleStep1Submit = (data: PatientFormState, savedPatient?: Patient) => {
    setPatientInfo(data);
    setCompletedSteps((prev) => Array.from(new Set([...prev, 1])));
    setCurrentStep(2);
  };

  const handleStep2Submit = (service: ServiceRequestState) => {
    setServiceRequest(service);
    setCompletedSteps((prev) => Array.from(new Set([...prev, 2])));
    setCurrentStep(3);
  };

  const handleStep3Submit = (doctor: Doctor, department: string, audit?: any) => {
    setSelectedDoctor(doctor);
    setSelectedDept(department);
    if (audit) {
      setAiRoutingAudit(audit);
    }
    setCompletedSteps((prev) => Array.from(new Set([...prev, 3])));
    setCurrentStep(4);
  };

  const handleStep4Generate = () => {
    if (!selectedDoctor) return;

    const dateDisplay = getFormattedDisplayDate();

    const { record } = createOpVisit({
      patientId: patientInfo.patientId || `PAT-${Date.now().toString().slice(-6)}`,
      patientName: patientInfo.name,
      age: Number(patientInfo.age) || 30,
      gender: patientInfo.gender,
      phone: patientInfo.phone,
      department: selectedDept,
      doctorId: selectedDoctor.id,
      doctorName: selectedDoctor.name,
      doctorRoom: selectedDoctor.room,
      serviceRequest: serviceRequest.rawText,
      priority: patientInfo.priority,
      dateStr: dateDisplay,
      existingQueue: queue,
      aiRoutingAudit: aiRoutingAudit,
    });

    setGeneratedTicket(record);
    setCompletedSteps((prev) => Array.from(new Set([...prev, 4, 5])));
    onWorkflowComplete(record);
    setCurrentStep(5);
  };

  const handleRestartNewPatient = () => {
    setPatientInfo({
      name: '',
      age: '',
      gender: 'Male',
      phone: '',
      priority: 'Normal',
    });
    setServiceRequest({ rawText: '', voiceSimulated: false });
    setSelectedDoctor(null);
    setGeneratedTicket(null);
    setCompletedSteps([]);
    setCurrentStep(1);
  };

  const handleChangePatient = () => {
    setCurrentStep(1);
  };

  const handleStepClick = (stepNum: WorkflowStep) => {
    if (stepNum < currentStep || completedSteps.includes(stepNum)) {
      setCurrentStep(stepNum);
    }
  };

  // Step 4 Calculations Preview
  const todayDateStr = getFormattedDisplayDate();
  const tokenPreview = selectedDept && selectedDoctor
    ? generateNextTokenNumber(selectedDept, todayDateStr, queue)
    : { tokenNumber: 'D-001', sequenceNumber: 1, prefix: 'D' };

  const opNumberPreview = generateOpNumber(todayDateStr, queue);

  const activeDuplicateVisit = selectedDept
    ? checkActiveDuplicateVisit(
        {
          patientId: patientInfo.patientId,
          phone: patientInfo.phone,
          patientName: patientInfo.name,
        },
        selectedDept,
        todayDateStr,
        queue
      )
    : undefined;

  const queuePositionInfo = selectedDept
    ? calculateQueuePosition(tokenPreview.tokenNumber, selectedDept, queue)
    : { position: 1, totalWaitingInDept: 0, estimatedWaitMinutes: 0 };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Visual Step Progress Indicator */}
      <WorkflowProgress
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={handleStepClick}
      />

      {/* Screen 1: Patient Info & Registration */}
      {currentStep === 1 && (
        <Step1PatientInfo
          initialData={patientInfo}
          onContinue={handleStep1Submit}
          onCancel={onCancelWorkflow}
          onViewPatientDetails={onViewPatientDetails}
        />
      )}

      {/* Screen 2: Service Request */}
      {currentStep === 2 && (
        <Step2ServiceRequest
          patientInfo={patientInfo}
          initialService={serviceRequest}
          onContinue={handleStep2Submit}
          onBack={() => setCurrentStep(1)}
          onChangePatient={handleChangePatient}
        />
      )}

      {/* Screen 3: Recommendation */}
      {currentStep === 3 && (
        <Step3Recommendation
          patientInfo={patientInfo}
          serviceRequestText={serviceRequest.rawText}
          selectedDoctor={selectedDoctor}
          onContinue={handleStep3Submit}
          onBack={() => setCurrentStep(2)}
          onChangePatient={handleChangePatient}
        />
      )}

      {/* Screen 4: OP Confirmation */}
      {currentStep === 4 && selectedDoctor && (
        <Step4ConfirmOp
          patientInfo={patientInfo}
          doctor={selectedDoctor}
          department={selectedDept}
          tokenNumber={tokenPreview.tokenNumber}
          opNumber={opNumberPreview}
          appointmentDate={todayDateStr}
          appointmentTime={selectedDoctor.nextOpTime}
          serviceRequestText={serviceRequest.rawText}
          queuePositionInfo={queuePositionInfo}
          activeDuplicateVisit={activeDuplicateVisit}
          aiRoutingAudit={aiRoutingAudit}
          onGenerate={handleStep4Generate}
          onBack={() => setCurrentStep(3)}
        />
      )}

      {/* Screen 5: Ticket Ready */}
      {currentStep === 5 && generatedTicket && (
        <Step5OpTicketReady
          patientRecord={generatedTicket}
          hospitalInfo={INITIAL_HOSPITAL_INFO}
          onNewPatient={handleRestartNewPatient}
          onViewQueue={onViewQueue}
        />
      )}
    </div>
  );
};
