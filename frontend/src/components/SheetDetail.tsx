import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import DeadlineTimer from './DeadlineTimer';
import AuditTrailTimeline from './AuditTrailTimeline';
import { ArrowLeft, Lock, FileDown, CheckCircle, XCircle, AlertTriangle, ShieldCheck, MessageSquare, Edit } from 'lucide-react';

interface SheetDetailProps {
  sheetId: string;
  currentUser: any;
  onBack: () => void;
  onRefresh: () => void;
  onEdit?: (sheet: any) => void;
}

export default function SheetDetail({ sheetId, currentUser, onBack, onRefresh, onEdit }: SheetDetailProps) {
  const [sheet, setSheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transitionNotes, setTransitionNotes] = useState('');
  const [nextReviewers, setNextReviewers] = useState<any[]>([]);
  const [selectedNextReviewer, setSelectedNextReviewer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isLapsed, setIsLapsed] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  useEffect(() => {
    async function loadSheet() {
      try {
        const data = await api.getSheetDetail(sheetId);
        setSheet(data);
        
        // Fetch comments and mark as read
        try {
          const commentsData = await api.getComments(sheetId);
          setComments(commentsData);
          await api.markCommentsAsRead(sheetId);
          onRefresh(); // Trigger update in parent Dashboard header count
        } catch (cErr) {
          console.error("Failed to load comments:", cErr);
        }
        
        // Fetch next role options if this user has review action permissions
        if (data.status === 'SENT_TO_CHECKER' && currentUser.role === 'CHECKER' && data.assigned_checker_id === currentUser.emp_id) {
          const reviewers = await api.getReviewers('FC');
          setNextReviewers(reviewers);
          if (reviewers.length > 0) setSelectedNextReviewer(reviewers[0].emp_id);
        } else if (data.status === 'SENT_TO_FC' && currentUser.role === 'FC' && data.assigned_fc_id === currentUser.emp_id) {
          const reviewers = await api.getReviewers('CFO');
          setNextReviewers(reviewers);
          if (reviewers.length > 0) setSelectedNextReviewer(reviewers[0].emp_id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load details.');
      } finally {
        setLoading(false);
      }
    }
    loadSheet();
  }, [sheetId, currentUser]);

  useEffect(() => {
    if (isCommentsOpen) {
      api.markCommentsAsRead(sheetId)
        .then(() => onRefresh())
        .catch((err) => console.error("Failed to mark comments as read on open:", err));
    }
  }, [isCommentsOpen, sheetId]);

  const handleAction = async (action: 'ACCEPT' | 'REJECT' | 'APPROVE') => {
    setError('');
    setSubmitting(true);

    try {
      await api.transitionSheet(
        sheet.id,
        action,
        action === 'ACCEPT' ? selectedNextReviewer : undefined,
        transitionNotes
      );
      
      // Refresh details
      const data = await api.getSheetDetail(sheetId);
      setSheet(data);
      setTransitionNotes('');
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading balance sheet details...</div>;
  }

  if (!sheet) {
    return (
      <div style={{ color: 'var(--color-danger)', textAlign: 'center', padding: '40px' }}>
        <p>{error || 'Sheet not found.'}</p>
        <button onClick={onBack} className="btn-secondary" style={{ marginTop: '16px' }}>Back to Dashboard</button>
      </div>
    );
  }

  // Determine role permissions
  const isCheckerAssigned = sheet.status === 'SENT_TO_CHECKER' && currentUser.role === 'CHECKER' && sheet.assigned_checker_id === currentUser.emp_id;
  const isFcAssigned = sheet.status === 'SENT_TO_FC' && currentUser.role === 'FC' && sheet.assigned_fc_id === currentUser.emp_id;
  const isCfoAssigned = sheet.status === 'SENT_TO_CFO' && currentUser.role === 'CFO' && sheet.assigned_cfo_id === currentUser.emp_id;
  
  const canPerformAction = (isCheckerAssigned || isFcAssigned || isCfoAssigned) && !sheet.is_locked && !isLapsed;

  const canEdit = !sheet.is_locked && !isLapsed && (
    (currentUser.role === 'MAKER' && sheet.maker_id === currentUser.emp_id && ['DRAFT', 'CHECKER_REJECTED', 'CFO_REJECTED'].includes(sheet.status)) ||
    (currentUser.role === 'CHECKER' && sheet.assigned_checker_id === currentUser.emp_id && sheet.status === 'FC_REJECTED')
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }} className="animate-fade">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn-secondary" style={{ padding: '8px' }} onClick={onBack}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 style={{ fontSize: '1.6rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {sheet.title}
              {sheet.is_locked && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  <Lock size={12} /> SECURED & LOCKED
                </span>
              )}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Created by Maker: <strong>{sheet.maker_id}</strong> on {new Date(sheet.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {canEdit && onEdit && (
              <button 
                className="btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', fontSize: '0.85rem' }} 
                onClick={() => onEdit(sheet)}
              >
                <Edit size={14} />
                <span>Edit Ledger</span>
              </button>
            )}
            <button 
              className="btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', fontSize: '0.85rem' }} 
              onClick={() => setIsCommentsOpen(true)}
            >
              <MessageSquare size={14} />
              <span>Discussion</span>
              {comments.length > 0 && (
                <span style={{ background: 'var(--color-primary)', color: '#000', fontSize: '0.7rem', fontWeight: 'bold', padding: '1px 5px', borderRadius: '10px' }}>
                  {comments.length}
                </span>
              )}
            </button>
            {sheet.is_locked && sheet.export_pdf_url && (
              <a
                href={api.getFileUrl(sheet.export_pdf_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', padding: '8px 14px', fontSize: '0.85rem', borderRadius: '8px' }}
              >
                <FileDown size={14} />
                <span>Audit Certificate</span>
              </a>
            )}
            <span
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                backgroundColor: sheet.is_locked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                border: `1px solid ${sheet.is_locked ? 'var(--color-success)' : 'var(--color-primary)'}`,
                color: sheet.is_locked ? 'var(--color-success)' : 'var(--color-primary)',
              }}
            >
              {sheet.status}
            </span>
          </div>
          {sheet.deadline && (
            <DeadlineTimer deadline={sheet.deadline} onLapse={() => setIsLapsed(true)} />
          )}
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '16px', borderRadius: '12px', color: 'var(--color-danger)' }}>
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '28px' }}>
        
        {/* GL grid & metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          <div className="glass-panel" style={{ padding: '28px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '12px', color: '#fff' }}>General Details</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {sheet.description || 'No description provided.'}
            </p>

            {sheet.file_url && (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Attachment Document</span>
                <a
                  href={api.getFileUrl(sheet.file_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', borderRadius: '8px', textDecoration: 'none', color: '#fff', transition: 'all 0.2s' }}
                  className="btn-secondary"
                >
                  <FileDown size={18} />
                  <span>{sheet.file_name || 'Download Attachment'}</span>
                </a>
              </div>
            )}
          </div>

          <div className="glass-panel" style={{ padding: '28px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', color: '#fff' }}>Spreadsheet Ledger Grid</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 2fr 120px 120px', gap: '12px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', paddingBottom: '8px', borderBottom: '1px solid var(--border-light)', fontWeight: 'bold' }}>
                <div>GL Code</div>
                <div>Account Name</div>
                <div style={{ textAlign: 'right' }}>Debit ($)</div>
                <div style={{ textAlign: 'right' }}>Credit ($)</div>
              </div>

              {sheet.gl_entries.map((entry: any) => (
                <div key={entry.id} style={{ display: 'grid', gridTemplateColumns: '120px 2fr 120px 120px', gap: '12px', padding: '6px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.02)', fontSize: '0.95rem' }}>
                  <div className="font-mono" style={{ color: 'var(--color-primary)' }}>{entry.account_code}</div>
                  <div>{entry.account_name}</div>
                  <div style={{ textAlign: 'right' }} className="font-mono">
                    {parseFloat(entry.debit) > 0 ? parseFloat(entry.debit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                  </div>
                  <div style={{ textAlign: 'right' }} className="font-mono">
                    {parseFloat(entry.credit) > 0 ? parseFloat(entry.credit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Financial balances overview & action panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          <div className="glass-panel" style={{ padding: '28px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '20px', color: '#fff' }}>Balance Checklist</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Assets</span>
                <span className="font-mono text-success" style={{ fontWeight: 'bold' }}>${parseFloat(sheet.total_assets).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Liabilities</span>
                <span className="font-mono text-danger" style={{ fontWeight: 'bold' }}>${parseFloat(sheet.total_liabilities).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Equity</span>
                <span className="font-mono" style={{ color: 'var(--color-info)', fontWeight: 'bold' }}>${parseFloat(sheet.total_equity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              {/* Equation monitor */}
              {parseFloat(sheet.total_assets) === (parseFloat(sheet.total_liabilities) + parseFloat(sheet.total_equity)) ? (
                <div style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', color: 'var(--color-success)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={16} />
                  <span>Balanced (A = L + E)</span>
                </div>
              ) : (
                <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: 'var(--color-danger)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={16} />
                  <span>Unbalanced Sheet!</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Center panel */}
          <div className="glass-panel" style={{ padding: '28px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', color: '#fff' }}>Workflow Actions</h3>
            
            {sheet.is_locked ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--color-primary)' }}>
                <Lock size={32} style={{ margin: '0 auto 12px', display: 'block' }} />
                <p style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>This Sheet is Fully Audited</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>All logs are frozen, changes are disabled.</p>
                {sheet.export_pdf_url && (
                  <a
                    href={api.getFileUrl(sheet.export_pdf_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', padding: '12px 20px', fontSize: '0.9rem', marginTop: '16px', width: '100%', justifyContent: 'center' }}
                  >
                    <FileDown size={18} />
                    <span>Download Audit Certificate</span>
                  </a>
                )}
              </div>
            ) : isLapsed ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', color: 'var(--color-danger)', fontSize: '0.85rem' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>Deadline has lapsed. No actions are permitted.</span>
              </div>
            ) : canPerformAction ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Audit notes</label>
                  <textarea
                    placeholder="Enter audit logs or adjustment reasons..."
                    value={transitionNotes}
                    onChange={(e) => setTransitionNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Dropdown for next reviewer (only if checker or FC accepting) */}
                {(!isCfoAssigned) && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Assign review to ({isCheckerAssigned ? 'FC' : 'CFO'})
                    </label>
                    <select
                      value={selectedNextReviewer}
                      onChange={(e) => setSelectedNextReviewer(e.target.value)}
                      required
                    >
                      {nextReviewers.length === 0 ? (
                        <option value="">No review staff available</option>
                      ) : (
                        nextReviewers.map((r) => (
                          <option key={r.emp_id} value={r.emp_id}>
                            {r.name} ({r.emp_id})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    className="btn-danger"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 0' }}
                    onClick={() => handleAction('REJECT')}
                    disabled={submitting}
                  >
                    <XCircle size={16} /> Reject
                  </button>
                  <button
                    className={isCfoAssigned ? 'btn-primary' : 'btn-success'}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 0' }}
                    onClick={() => handleAction(isCfoAssigned ? 'APPROVE' : 'ACCEPT')}
                    disabled={submitting || (!isCfoAssigned && !selectedNextReviewer)}
                  >
                    <CheckCircle size={16} /> {isCfoAssigned ? 'Approve' : 'Accept'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '12px 0' }}>
                <p>Waiting for current reviewer action.</p>
                <p style={{ fontSize: '0.75rem', marginTop: '6px' }}>
                  Assigned reviewer ID: <strong style={{ color: 'var(--color-primary)' }}>{sheet.status === 'SENT_TO_CHECKER' ? sheet.assigned_checker_id : sheet.status === 'SENT_TO_FC' ? sheet.assigned_fc_id : sheet.status === 'SENT_TO_CFO' ? sheet.assigned_cfo_id : '-'}</strong>
                </p>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Audit timeline history */}
      <AuditTrailTimeline sheet={sheet} />

      {/* Chat Sidebar Overlay */}
      {isCommentsOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 999
          }}
          onClick={() => setIsCommentsOpen(false)}
        />
      )}

      {/* Chat Sidebar Panel */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '400px',
          maxWidth: '100%',
          height: '100vh',
          backgroundColor: '#0f1322',
          borderLeft: '1px solid var(--border-light)',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          transform: isCommentsOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Sidebar Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={20} style={{ color: 'var(--color-primary)' }} />
            Workspace Discussion
          </h3>
          <button 
            onClick={() => setIsCommentsOpen(false)} 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', padding: '0 8px' }}
          >
            &times;
          </button>
        </div>

        {/* Sidebar Messages Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {comments.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>
              <MessageSquare size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p style={{ margin: 0 }}>No workspace comments yet.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '4px', margin: 0 }}>Start the conversation regarding this audit ledger.</p>
            </div>
          ) : (
            comments.map((comment) => {
              const isCurrentUser = comment.author_id === currentUser.emp_id;
              return (
                <div 
                  key={comment.id} 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: isCurrentUser ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    alignSelf: isCurrentUser ? 'flex-end' : 'flex-start'
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', padding: '0 4px' }}>
                    {comment.author_id} {isCurrentUser ? '(You)' : ''}
                  </span>
                  <div 
                    style={{ 
                      padding: '10px 14px', 
                      borderRadius: '12px', 
                      borderTopRightRadius: isCurrentUser ? '2px' : '12px',
                      borderTopLeftRadius: isCurrentUser ? '12px' : '2px',
                      backgroundColor: isCurrentUser ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      border: isCurrentUser ? '1px solid var(--border-active)' : '1px solid var(--border-light)',
                      color: '#fff',
                      fontSize: '0.9rem',
                      wordBreak: 'break-word',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  >
                    {comment.text}
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', padding: '0 4px' }}>
                    {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Input Area */}
        <div style={{ padding: '20px', borderTop: '1px solid var(--border-light)', backgroundColor: 'rgba(10, 12, 20, 0.4)' }}>
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newCommentText.trim()) return;
              try {
                await api.createComment(sheetId, newCommentText);
                setNewCommentText('');
                // Re-fetch comments
                const updated = await api.getComments(sheetId);
                setComments(updated);
              } catch (err: any) {
                console.error("Failed to post comment:", err);
              }
            }}
            style={{ display: 'flex', gap: '8px' }}
          >
            <input 
              type="text" 
              placeholder="Type a compliance comment..." 
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              style={{ flex: 1, padding: '10px 14px', fontSize: '0.85rem' }}
              disabled={sheet.is_locked}
            />
            <button 
              type="submit" 
              className="btn-primary" 
              style={{ padding: '10px 16px', fontSize: '0.85rem' }}
              disabled={sheet.is_locked || !newCommentText.trim()}
            >
              Send
            </button>
          </form>
          {sheet.is_locked && (
            <p style={{ fontSize: '0.72rem', color: 'var(--color-primary)', marginTop: '8px', textAlign: 'center', margin: 0 }}>
              This sheet is locked. Comments are disabled.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
