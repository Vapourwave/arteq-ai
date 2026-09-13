import React from 'react';
import { WorkflowStep } from '../types';
import { User, Stethoscope, UserCheck, ShieldCheck, TicketCheck, Check } from 'lucide-react';

interface WorkflowProgressProps {
  currentStep: WorkflowStep;
  onStepClick?: (step: WorkflowStep) => void;
  completedSteps: number[];
}

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({
  currentStep,
  onStepClick,
  completedSteps,
}) => {
  const steps = [
    { number: 1 as WorkflowStep, label: 'Patient Info', icon: User },
    { number: 2 as WorkflowStep, label: 'Service Request', icon: Stethoscope },
    { number: 3 as WorkflowStep, label: 'Recommendation', icon: UserCheck },
    { number: 4 as WorkflowStep, label: 'Confirm OP', icon: ShieldCheck },
    { number: 5 as WorkflowStep, label: 'Ticket Ready', icon: TicketCheck },
  ];

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs mb-6">
      <div className="flex items-center justify-between max-w-4xl mx-auto relative">
        {/* Background Connecting Line */}
        <div className="absolute top-5 left-6 right-6 h-0.5 bg-slate-200 -z-0" />

        {steps.map((step) => {
          const Icon = step.icon;
          const isCurrent = currentStep === step.number;
          const isCompleted = completedSteps.includes(step.number) || currentStep > step.number;
          const isClickable = isCompleted && onStepClick;

          return (
            <div
              key={step.number}
              className="flex flex-col items-center relative z-10 group"
            >
              <button
                id={`workflow-step-btn-${step.number}`}
                type="button"
                disabled={!isClickable && !isCurrent}
                onClick={() => isClickable && onStepClick && onStepClick(step.number)}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-200 border-2 ${
                  isCompleted
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : isCurrent
                    ? 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100 shadow-md scale-105'
                    : 'bg-white border-slate-300 text-slate-400'
                } ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-default'}`}
              >
                {isCompleted && !isCurrent ? (
                  <Check className="w-5 h-5 stroke-[2.5]" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </button>

              <div className="mt-2 text-center">
                <span
                  className={`block text-[11px] sm:text-xs font-semibold ${
                    isCurrent
                      ? 'text-blue-600 font-bold'
                      : isCompleted
                      ? 'text-slate-800'
                      : 'text-slate-400'
                  }`}
                >
                  <span className="hidden sm:inline">{step.number}. </span>
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
