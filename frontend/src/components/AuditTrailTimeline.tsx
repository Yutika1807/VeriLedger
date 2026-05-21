import { CheckCircle2, XCircle, Clock, FileText } from 'lucide-react';
import DeadlineTimer from './DeadlineTimer';

interface AuditTrailTimelineProps {
  sheet: any;
}

export default function AuditTrailTimeline({ sheet }: AuditTrailTimelineProps) {
  // Helper to determine step details
  const getStepDetails = (role: 'MAKER' | 'CHECKER' | 'FC' | 'CFO') => {
    let empId = '';
    let timestamp = '';
    let notes = '';

    if (role === 'MAKER') {
      empId = sheet.maker_id;
      // Get the submission event
      const submitEvent = sheet.audit_trail.find((e: any) => e.to_state === 'SENT_TO_CHECKER' || e.to_state === 'DRAFT');
      if (submitEvent) {
        timestamp = submitEvent.timestamp;
        notes = submitEvent.notes || '';
      } else {
        timestamp = sheet.created_at;
      }
    } else if (role === 'CHECKER') {
      empId = sheet.assigned_checker_id || '';
      const event = [...sheet.audit_trail].reverse().find((e: any) => e.from_state === 'SENT_TO_CHECKER');
      if (event) {
        timestamp = event.timestamp;
        notes = event.notes || '';
        empId = event.action_by;
      }
    } else if (role === 'FC') {
      empId = sheet.assigned_fc_id || '';
      const event = [...sheet.audit_trail].reverse().find((e: any) => e.from_state === 'SENT_TO_FC');
      if (event) {
        timestamp = event.timestamp;
        notes = event.notes || '';
        empId = event.action_by;
      }
    } else if (role === 'CFO') {
      empId = sheet.assigned_cfo_id || '';
      const event = [...sheet.audit_trail].reverse().find((e: any) => e.from_state === 'SENT_TO_CFO');
      if (event) {
        timestamp = event.timestamp;
        notes = event.notes || '';
        empId = event.action_by;
      }
    }

    return { empId, timestamp, notes };
  };

  // 4 Core Roles for Stepper
  const steps = [
    {
      roleName: 'Maker (Preparation)',
      role: 'MAKER',
      title: 'GL Reconciliation & Entry Submission',
      getStatus: () => {
        if (sheet.status === 'DRAFT') {
          return { type: 'pending', label: 'Drafting', color: 'var(--color-warning)' };
        }
        if (['CHECKER_REJECTED', 'FC_REJECTED', 'CFO_REJECTED'].includes(sheet.status)) {
          return { type: 'rejected', label: 'Returned / Rejected', color: 'var(--color-danger)' };
        }
        return { type: 'approved', label: 'Submitted & Verified', color: 'var(--color-success)' };
      }
    },
    {
      roleName: 'Checker (Verification)',
      role: 'CHECKER',
      title: 'First Verification Level',
      getStatus: () => {
        if (sheet.status === 'DRAFT') {
          return { type: 'inactive', label: 'Awaiting Submission', color: 'var(--text-muted)' };
        }
        if (sheet.status === 'SENT_TO_CHECKER') {
          return { type: 'pending', label: 'Pending Review', color: 'var(--color-warning)' };
        }
        if (sheet.status === 'CHECKER_REJECTED') {
          return { type: 'rejected', label: 'Rejected & Returned', color: 'var(--color-danger)' };
        }
        return { type: 'approved', label: 'Approved & Forwarded', color: 'var(--color-success)' };
      }
    },
    {
      roleName: 'Financial Controller (Validation)',
      role: 'FC',
      title: 'Second Verification Level',
      getStatus: () => {
        if (['DRAFT', 'SENT_TO_CHECKER', 'CHECKER_REJECTED'].includes(sheet.status)) {
          return { type: 'inactive', label: 'Awaiting Checker Approval', color: 'var(--text-muted)' };
        }
        if (sheet.status === 'SENT_TO_FC') {
          return { type: 'pending', label: 'Pending Review', color: 'var(--color-warning)' };
        }
        if (sheet.status === 'FC_REJECTED') {
          return { type: 'rejected', label: 'Rejected & Returned', color: 'var(--color-danger)' };
        }
        return { type: 'approved', label: 'Approved & Forwarded', color: 'var(--color-success)' };
      }
    },
    {
      roleName: 'Chief Financial Officer (Approval)',
      role: 'CFO',
      title: 'Final Sign-off & Ledger Lock',
      getStatus: () => {
        if (['DRAFT', 'SENT_TO_CHECKER', 'CHECKER_REJECTED', 'SENT_TO_FC', 'FC_REJECTED'].includes(sheet.status)) {
          return { type: 'inactive', label: 'Awaiting FC Approval', color: 'var(--text-muted)' };
        }
        if (sheet.status === 'SENT_TO_CFO') {
          return { type: 'pending', label: 'Pending Final Review', color: 'var(--color-warning)' };
        }
        if (sheet.status === 'CFO_REJECTED') {
          return { type: 'rejected', label: 'Rejected & Returned', color: 'var(--color-danger)' };
        }
        return { type: 'approved', label: 'Approved & Frozen', color: 'var(--color-success)' };
      }
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Live Countdown & Visual Timeline Panel */}
      <div className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', color: '#fff', margin: 0 }}>Compliance Timeline Stepper</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Four-eyes segregation and review pipeline status.</p>
          </div>
          {sheet.deadline && !sheet.is_locked && (
            <DeadlineTimer deadline={sheet.deadline} />
          )}
        </div>

        {/* Vertical Stepper Container */}
        <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '10px' }}>
          {steps.map((step, idx) => {
            const stepStatus = step.getStatus();
            const { empId, timestamp, notes } = getStepDetails(step.role as any);

            // Select matching icon
            let iconElement = <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--text-muted)' }} />;
            if (stepStatus.type === 'approved') {
              iconElement = <CheckCircle2 size={18} />;
            } else if (stepStatus.type === 'pending') {
              iconElement = <Clock size={18} />;
            } else if (stepStatus.type === 'rejected') {
              iconElement = <XCircle size={18} />;
            }

            return (
              <div key={step.role} style={{ display: 'flex', gap: '20px', position: 'relative', paddingBottom: idx === steps.length - 1 ? '0' : '32px' }}>
                
                {/* Connecting Line */}
                {idx < steps.length - 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '36px',
                      left: '17px',
                      bottom: 0,
                      width: '2px',
                      backgroundColor: stepStatus.type === 'approved' ? 'var(--color-success)' : 'var(--border-light)',
                      zIndex: 1,
                    }}
                  />
                )}

                {/* Node Circle */}
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(10, 12, 20, 0.9)',
                    border: `2px solid ${
                      stepStatus.type === 'approved'
                        ? 'var(--color-success)'
                        : stepStatus.type === 'pending'
                        ? 'var(--color-warning)'
                        : stepStatus.type === 'rejected'
                        ? 'var(--color-danger)'
                        : 'var(--border-light)'
                    }`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: stepStatus.color,
                    zIndex: 2,
                    boxShadow: stepStatus.type === 'pending' ? '0 0 12px rgba(251, 191, 36, 0.25)' : 'none',
                    animation: stepStatus.type === 'pending' ? 'pulse-glow 2s infinite' : 'none',
                  }}
                >
                  {iconElement}
                </div>

                {/* Step Details Content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, marginTop: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', color: stepStatus.type === 'inactive' ? 'var(--text-muted)' : '#fff', fontWeight: '600' }}>
                        {step.roleName}
                      </h4>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{step.title}</span>
                    </div>
                    
                    {/* Status Badge */}
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor:
                          stepStatus.type === 'approved'
                            ? 'rgba(16, 185, 129, 0.1)'
                            : stepStatus.type === 'pending'
                            ? 'rgba(251, 191, 36, 0.1)'
                            : stepStatus.type === 'rejected'
                            ? 'rgba(239, 68, 68, 0.1)'
                            : 'rgba(255, 255, 255, 0.03)',
                        color: stepStatus.color,
                        border: `1px solid ${
                          stepStatus.type === 'approved'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : stepStatus.type === 'pending'
                            ? 'rgba(251, 191, 36, 0.2)'
                            : stepStatus.type === 'rejected'
                            ? 'rgba(239, 68, 68, 0.2)'
                            : 'rgba(255, 255, 255, 0.05)'
                        }`,
                      }}
                    >
                      {stepStatus.label}
                    </span>
                  </div>

                  {/* Metadata Row */}
                  {(empId || timestamp) && (
                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {empId && (
                        <span>
                          Staff ID: <strong style={{ color: stepStatus.type === 'inactive' ? 'var(--text-muted)' : 'var(--color-primary)' }}>{empId}</strong>
                        </span>
                      )}
                      {timestamp && (
                        <span>
                          Timestamp: {new Date(timestamp).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Step Notes */}
                  {notes && (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        borderLeft: `3px solid ${stepStatus.color}`,
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        fontStyle: 'italic',
                      }}
                    >
                      "{notes}"
                    </div>
                  )}

                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Flat Audit logs table for reference */}
      <div className="glass-panel" style={{ padding: '28px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
          <FileText size={18} style={{ color: 'var(--color-primary)' }} />
          Full Transaction Handoff History
        </h3>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '12px 8px' }}>Timestamp</th>
                <th style={{ padding: '12px 8px' }}>From State</th>
                <th style={{ padding: '12px 8px' }}>To State</th>
                <th style={{ padding: '12px 8px' }}>Action By</th>
                <th style={{ padding: '12px 8px' }}>Assigned To</th>
                <th style={{ padding: '12px 8px' }}>Comments / Notes</th>
              </tr>
            </thead>
            <tbody>
              {sheet.audit_trail.map((event: any, index: number) => (
                <tr key={index} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                    {new Date(event.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ fontSize: '0.8rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                      {event.from_state}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: event.to_state.includes('REJECTED') ? 'rgba(239, 68, 68, 0.1)' : event.to_state === 'CFO_APPROVED' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                        color: event.to_state.includes('REJECTED') ? 'var(--color-danger)' : event.to_state === 'CFO_APPROVED' ? 'var(--color-success)' : 'var(--color-primary)',
                      }}
                    >
                      {event.to_state}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{event.action_by}</td>
                  <td style={{ padding: '12px 8px', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                    {event.action_to || '-'}
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {event.notes || <span style={{ opacity: 0.3 }}>N/A</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
