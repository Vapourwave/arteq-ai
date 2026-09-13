import { KioskShell } from "./app/KioskShell";
import { KioskErrorBoundary } from "./app/KioskErrorBoundary";

export function App() {
  return (
    <KioskErrorBoundary>
      <KioskShell />
    </KioskErrorBoundary>
  );
}
