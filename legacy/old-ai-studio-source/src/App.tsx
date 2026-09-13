import React, { useState } from 'react';
import { NavView, PatientRecord, Doctor, Department, HospitalInfo } from './types';
import { 
  INITIAL_HOSPITAL_INFO, 
  MOCK_DOCTORS, 
  MOCK_DEPARTMENTS, 
  INITIAL_PATIENT_QUEUE 
} from './data/mockData';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { hasPermission } from './auth/permissions';
import { getCurrentTimeFormatted, validateStatusTransition } from './services/queueService';
import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { AccessDenied } from './components/AccessDenied';

// Receptionist Views
import { DashboardView } from './components/DashboardView';
import { NewPatientWorkflow } from './components/NewPatientWorkflow';
import { PatientsView } from './components/PatientsView';
import { TokensView } from './components/TokensView';
import { SettingsView } from './components/SettingsView';

// Doctor Views
import { DoctorDashboardView } from './components/doctor/DoctorDashboardView';
import { MyQueueView } from './components/doctor/MyQueueView';
import { DoctorScheduleView } from './components/doctor/DoctorScheduleView';

// Admin Views
import { AdminDashboardView } from './components/admin/AdminDashboardView';
import { UsersView } from './components/admin/UsersView';
import { DoctorsManagementView } from './components/admin/DoctorsManagementView';
import { DepartmentsView } from './components/admin/DepartmentsView';
import { ReportsView } from './components/admin/ReportsView';

// Profile View
import { UserProfileView } from './components/UserProfileView';

// Patient Kiosk View
import { PatientKioskWorkflow } from './components/kiosk/PatientKioskWorkflow';

function MainAppContent() {
  const { user, isAuthenticated } = useAuth();

  const [currentView, setCurrentView] = useState<NavView>('dashboard');
  const [queue, setQueue] = useState<PatientRecord[]>(INITIAL_PATIENT_QUEUE);
  const [doctors, setDoctors] = useState<Doctor[]>(MOCK_DOCTORS);
  const [departments, setDepartments] = useState<Department[]>(MOCK_DEPARTMENTS);
  const [hospitalInfo, setHospitalInfo] = useState<HospitalInfo>(INITIAL_HOSPITAL_INFO);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  // Unauthenticated Kiosk Mode Toggle
  const [isUnauthKioskMode, setIsUnauthKioskMode] = useState<boolean>(false);

  const handleWorkflowComplete = (newRecord: PatientRecord) => {
    setQueue((prev) => [newRecord, ...prev]);
  };

  // If unauthenticated kiosk mode is active
  if (isUnauthKioskMode) {
    return (
      <PatientKioskWorkflow
        queue={queue}
        doctors={doctors}
        departments={departments}
        onVisitCreated={handleWorkflowComplete}
        onExitKiosk={() => setIsUnauthKioskMode(false)}
      />
    );
  }

  // If user is not authenticated, display the Login Screen
  if (!isAuthenticated || !user) {
    return <LoginView onLaunchKiosk={() => setIsUnauthKioskMode(true)} />;
  }

  // If logged in staff switches view to Kiosk Terminal Mode
  if (currentView === 'kiosk') {
    return (
      <PatientKioskWorkflow
        queue={queue}
        doctors={doctors}
        departments={departments}
        onVisitCreated={handleWorkflowComplete}
        onExitKiosk={() => setCurrentView('dashboard')}
      />
    );
  }

  // Check role permission for current requested view
  const isAllowed = hasPermission(user.role, currentView);

  // Handlers
  const handleStartNewPatient = () => {
    if (hasPermission(user.role, 'new-patient')) {
      setCurrentView('new-patient');
    } else {
      setCurrentView('new-patient'); // Will trigger Access Denied if unauthorized
    }
  };

  const handleUpdatePatientStatus = (patientId: string, newStatus: PatientRecord['status']) => {
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id === patientId) {
          const validation = validateStatusTransition(item.status, newStatus);
          if (!validation.allowed) {
            alert(validation.reason || 'Invalid status transition.');
            return item;
          }

          const timeNow = getCurrentTimeFormatted();
          const updated: PatientRecord = { ...item, status: newStatus };
          if (newStatus === 'Called' && !item.calledAt) {
            updated.calledAt = timeNow;
          } else if (newStatus === 'Consulting' && !item.consultationStartedAt) {
            updated.consultationStartedAt = timeNow;
          } else if (newStatus === 'Completed' && !item.completedAt) {
            updated.completedAt = timeNow;
          } else if (newStatus === 'No Show' && !item.noShowAt) {
            updated.noShowAt = timeNow;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const waitingCount = queue.filter((p) => p.status === 'Waiting').length;

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col lg:flex-row antialiased selection:bg-blue-600 selection:text-white">
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        onStartNewPatient={handleStartNewPatient}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        hospitalName={hospitalInfo.name}
        waitingCount={waitingCount}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Header */}
        <Header
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onStartNewPatient={handleStartNewPatient}
          onNavigate={(view) => setCurrentView(view)}
        />

        {/* Workspace Router Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {/* Route Access Protection Guard */}
          {!isAllowed ? (
            <AccessDenied
              userRole={user.role}
              attemptedView={currentView}
              onReturnToDashboard={() => setCurrentView('dashboard')}
            />
          ) : (
            <>
              {/* Dashboard View (Role Adaptive) */}
              {currentView === 'dashboard' && (
                <>
                  {user.role === 'doctor' && (
                    <DoctorDashboardView
                      queue={queue}
                      doctorName={user.name}
                      department={user.department}
                      onUpdatePatientStatus={handleUpdatePatientStatus}
                      onViewFullQueue={() => setCurrentView('my-queue')}
                      onViewPatients={() => setCurrentView('patients')}
                    />
                  )}

                  {user.role === 'admin' && (
                    <AdminDashboardView
                      doctors={doctors}
                      departments={departments}
                      queue={queue}
                      onNavigateView={(v) => setCurrentView(v)}
                    />
                  )}

                  {user.role === 'receptionist' && (
                    <DashboardView
                      queue={queue}
                      doctors={doctors}
                      onStartNewPatient={handleStartNewPatient}
                      onViewAllQueue={() => setCurrentView('tokens')}
                      onSelectPatient={() => setCurrentView('patients')}
                      onUpdatePatientStatus={handleUpdatePatientStatus}
                    />
                  )}
                </>
              )}

              {/* Receptionist Step 1 Workflow */}
              {currentView === 'new-patient' && (
                <NewPatientWorkflow
                  queue={queue}
                  onWorkflowComplete={handleWorkflowComplete}
                  onCancelWorkflow={() => setCurrentView('dashboard')}
                  onViewQueue={() => setCurrentView('tokens')}
                />
              )}

              {/* Patients Directory */}
              {currentView === 'patients' && (
                <PatientsView
                  patients={queue}
                  onStartNewPatient={handleStartNewPatient}
                />
              )}

              {/* OP Tokens Queue */}
              {currentView === 'tokens' && (
                <TokensView
                  queue={queue}
                  onUpdateStatus={handleUpdatePatientStatus}
                  onStartNewPatient={handleStartNewPatient}
                />
              )}

              {/* Hospital Settings */}
              {currentView === 'settings' && (
                <SettingsView
                  hospitalInfo={hospitalInfo}
                  doctors={doctors}
                  departments={departments}
                  onUpdateHospitalInfo={(info) => setHospitalInfo(info)}
                />
              )}

              {/* User Account Profile */}
              {currentView === 'profile' && <UserProfileView />}

              {/* Doctor Sub-Views */}
              {currentView === 'my-queue' && (
                <MyQueueView
                  queue={queue}
                  doctorName={user.name}
                  department={user.department}
                  onUpdatePatientStatus={handleUpdatePatientStatus}
                />
              )}

              {currentView === 'schedule' && (
                <DoctorScheduleView
                  doctorName={user.name}
                  department={user.department}
                />
              )}

              {/* Admin Sub-Views */}
              {currentView === 'users' && <UsersView />}

              {currentView === 'doctors' && <DoctorsManagementView doctors={doctors} />}

              {currentView === 'departments' && <DepartmentsView departments={departments} />}

              {currentView === 'reports' && <ReportsView queue={queue} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
