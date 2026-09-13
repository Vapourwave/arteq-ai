import type { ConversationState } from "@arteq/shared";

/**
 * Terminal screen once a real, backend-generated OP ticket exists
 * (CLAUDE.md §14: only ever rendered from a confirmed ticket, never
 * fabricated client-side). KioskShell only routes here when
 * conversationState.ticket is present.
 *
 * The summary reflects what the patient actually said/selected — reasonText
 * is shown verbatim, never elaborated into a diagnosis or medical claim
 * (Phase 5 spec's "do NOT turn this into a medical diagnosis").
 */
export function TicketView({
  conversationState,
  onStartOver,
}: {
  conversationState: ConversationState;
  onStartOver: () => void;
}) {
  const { ticket, selectedDepartment, selectedDoctor, reasonText } = conversationState;

  // Defensive only — KioskShell never routes here without a ticket.
  if (!ticket) {
    return (
      <div className="screen screen-ticket">
        <h1>Something went wrong</h1>
        <p className="hint">No ticket was generated.</p>
        <button className="primary-action" onClick={onStartOver}>
          Start over
        </button>
      </div>
    );
  }

  return (
    <div className="screen screen-ticket">
      <p className="eyebrow">Your OP ticket</p>
      <h1 className="ticket-number">{ticket.ticketNumber}</h1>

      <div className="ticket-summary">
        <p className="ticket-summary-line">
          <span className="ticket-summary-label">Department</span>
          {selectedDepartment?.name ?? ticket.departmentName}
        </p>
        <p className="ticket-summary-line">
          <span className="ticket-summary-label">Doctor</span>
          {selectedDoctor?.name ?? ticket.doctorName}
        </p>
        <p className="ticket-summary-line">
          <span className="ticket-summary-label">Estimated wait</span>
          ~{ticket.estimatedWaitMinutes} min
        </p>
        {reasonText && (
          <p className="ticket-summary-line">
            <span className="ticket-summary-label">Reason provided</span>
            {reasonText}
          </p>
        )}
      </div>

      <p className="hint">Please take a seat — you'll be called when it's your turn.</p>

      <button className="primary-action" onClick={onStartOver}>
        Done
      </button>
    </div>
  );
}
