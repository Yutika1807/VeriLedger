import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Plus, Trash2, Upload, AlertCircle, Check } from 'lucide-react';

interface SheetFormProps {
  sheetToEdit?: any;
  currentUser: any;
  onSuccess: () => void;
  onCancel: () => void;
}

interface GLEntry {
  account_code: string;
  account_name: string;
  debit: string;
  credit: string;
}

export default function SheetForm({ sheetToEdit, currentUser, onSuccess, onCancel }: SheetFormProps) {
  const isEditMode = !!sheetToEdit;

  const [title, setTitle] = useState(sheetToEdit ? sheetToEdit.title : '');
  const [description, setDescription] = useState(sheetToEdit ? (sheetToEdit.description || '') : '');

  const formatDeadline = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const tzoffset = date.getTimezoneOffset() * 60000;
    return (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
  };

  const [deadline, setDeadline] = useState(sheetToEdit ? formatDeadline(sheetToEdit.deadline) : '');
  const [file, setFile] = useState<File | null>(null);
  
  // Interactive GL Grid
  const [entries, setEntries] = useState<GLEntry[]>(
    sheetToEdit
      ? sheetToEdit.gl_entries.map((e: any) => ({
          account_code: e.account_code,
          account_name: e.account_name,
          debit: String(e.debit),
          credit: String(e.credit),
        }))
      : [
          { account_code: '1001', account_name: 'Cash & Bank', debit: '10000', credit: '0' },
          { account_code: '2001', account_name: 'Accounts Payable', debit: '0', credit: '8000' },
          { account_code: '3001', account_name: 'Retained Earnings', debit: '0', credit: '2000' },
        ]
  );

  // Reviewers dropdown
  const [reviewers, setReviewers] = useState<any[]>([]);
  const [selectedReviewer, setSelectedReviewer] = useState('');
  const [activeDeadlines, setActiveDeadlines] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Compliance Variance comments tracking
  const [makerComment, setMakerComment] = useState('');
  const [showCommentRequired, setShowCommentRequired] = useState(false);
  const [createdSheetId, setCreatedSheetId] = useState<string | null>(null);

  // Load reviewers list and corporate deadlines
  useEffect(() => {
    async function loadReviewersAndDeadlines() {
      try {
        const targetRole = currentUser.role === 'CHECKER' ? 'FC' : 'CHECKER';
        const res = await api.getReviewers(targetRole);
        setReviewers(res);

        // Determine default reviewer
        let defaultRev = '';
        if (sheetToEdit) {
          defaultRev = currentUser.role === 'CHECKER'
            ? sheetToEdit.assigned_fc_id
            : sheetToEdit.assigned_checker_id;
        }
        if (!defaultRev && res.length > 0) {
          defaultRev = res[0].emp_id;
        }
        setSelectedReviewer(defaultRev || '');
      } catch (err: any) {
        console.error('Failed to load reviewers list', err);
      }
      try {
        const dlRes = await api.getDeadlines();
        setActiveDeadlines(dlRes);
      } catch (err: any) {
        console.error('Failed to load deadlines', err);
      }
    }
    loadReviewersAndDeadlines();
  }, [currentUser, sheetToEdit]);

  // Dynamic calculations
  let calculatedAssets = 0;
  let calculatedLiabilities = 0;
  let calculatedEquity = 0;
  let totalDebits = 0;
  let totalCredits = 0;

  entries.forEach((e) => {
    const code = e.account_code.trim();
    const deb = parseFloat(e.debit) || 0;
    const cred = parseFloat(e.credit) || 0;

    totalDebits += deb;
    totalCredits += cred;

    if (code.startsWith('1')) {
      calculatedAssets += (deb - cred);
    } else if (code.startsWith('2')) {
      calculatedLiabilities += (cred - deb);
    } else if (code.startsWith('3')) {
      calculatedEquity += (cred - deb);
    } else {
      calculatedAssets += deb;
      calculatedLiabilities += cred;
    }
  });

  const equationsBalance = calculatedAssets === (calculatedLiabilities + calculatedEquity);
  const debitsCreditsBalance = totalDebits === totalCredits;

  const handleAddEntry = () => {
    setEntries([...entries, { account_code: '', account_name: '', debit: '0', credit: '0' }]);
  };

  const handleRemoveEntry = (index: number) => {
    const updated = entries.filter((_, i) => i !== index);
    setEntries(updated);
  };

  const handleEntryChange = (index: number, field: keyof GLEntry, value: string) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    setEntries(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (entries.length === 0) {
      setError('Please add at least one GL entry.');
      return;
    }

    if (!selectedReviewer) {
      setError(`Please select an active ${currentUser.role === 'CHECKER' ? 'FC' : 'CHECKER'} to assign the sheet to.`);
      return;
    }

    setLoading(true);

    try {
      if (showCommentRequired && createdSheetId) {
        if (!makerComment.trim()) {
          setError('Please provide an explanatory comment for the high variance.');
          setLoading(false);
          return;
        }
        const action = currentUser.role === 'CHECKER' ? 'ACCEPT' : 'SUBMIT';
        await api.transitionSheet(createdSheetId, action, selectedReviewer, makerComment);
        onSuccess();
      } else {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        if (deadline) {
          formData.append('deadline', new Date(deadline).toISOString());
        }
        if (file) {
          formData.append('file', file);
        }
        
        // format GL entries for parsing
        const formattedEntries = entries.map(ent => ({
          account_code: ent.account_code,
          account_name: ent.account_name,
          debit: parseFloat(ent.debit) || 0.0,
          credit: parseFloat(ent.credit) || 0.0,
        }));
        formData.append('gl_entries', JSON.stringify(formattedEntries));

        if (isEditMode) {
          // Edit Mode
          const sheet = await api.updateSheet(sheetToEdit.id, formData);
          
          // Check for high variance (only Makers are forced to explain in backend)
          if (currentUser.role === 'MAKER' && sheet.system_flags && sheet.system_flags.includes('HIGH_VARIANCE')) {
            setCreatedSheetId(sheet.id);
            setShowCommentRequired(true);
            setError('Compliance Alert: High variance (>15%) detected compared to the previous submission. You must provide an explanatory comment to submit.');
            setLoading(false);
            return;
          }

          const action = currentUser.role === 'CHECKER' ? 'ACCEPT' : 'SUBMIT';
          const note = currentUser.role === 'CHECKER'
            ? 'Ledger details updated and routed to FC by Checker.'
            : 'Ledger details updated and resubmitted by Maker.';
          await api.transitionSheet(sheet.id, action, selectedReviewer, note);
          onSuccess();
        } else {
          // Create Mode
          const sheet = await api.createSheet(formData);
          
          // If sheet contains HIGH_VARIANCE, prompt for explanation before submission
          if (sheet.system_flags && sheet.system_flags.includes('HIGH_VARIANCE')) {
            setCreatedSheetId(sheet.id);
            setShowCommentRequired(true);
            setError('Compliance Alert: High variance (>15%) detected compared to the previous submission. You must provide an explanatory comment to submit.');
            setLoading(false);
            return;
          }

          // Immediately direct-send to the checker
          await api.transitionSheet(sheet.id, 'SUBMIT', selectedReviewer, 'Initial creation and submission.');
          onSuccess();
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit balance sheet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', color: '#fff' }}>{isEditMode ? 'Edit Balance Sheet' : 'Prepare Balance Sheet'}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {isEditMode
              ? 'Modify sheet details, build entries, and route to the next reviewer.'
              : 'Fill in details, build entries, and submit to Checker.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Submitting...' : (showCommentRequired ? 'Submit with Explanation' : (isEditMode ? 'Update & Route' : 'Create & Direct Send'))}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '16px', borderRadius: '12px', color: 'var(--color-danger)' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {showCommentRequired && (
        <div className="glass-panel" style={{ padding: '24px', border: '1px solid rgba(245, 158, 11, 0.3)', backgroundColor: 'rgba(245, 158, 11, 0.03)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <AlertCircle size={20} /> High Variance Explanation Required
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
            A variance (flux) of greater than 15% in assets or liabilities was detected compared to the previous submission.
            You must enter an explanatory comment detailing the variance before final submission.
          </p>
          <div>
            <textarea
              placeholder="Explain the significant variance (e.g. major asset acquisition, loan payoff)..."
              value={makerComment}
              onChange={(e) => setMakerComment(e.target.value)}
              rows={3}
              required
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid var(--border-light)',
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: '0.9rem'
              }}
            />
          </div>
        </div>
      )}

      {/* Main Info */}
      <div className="glass-panel" style={{ padding: '28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Sheet Title</label>
            <input type="text" placeholder="e.g. Q1 Fiscal Balance Sheet" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Description</label>
            <textarea placeholder="Provide details about GL reconciliation..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Corporate Cutoff Link</label>
            {activeDeadlines.length > 0 && (
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    const date = new Date(val);
                    // Format as YYYY-MM-DDThh:mm (local timezone representation for datetime-local value)
                    const tzoffset = date.getTimezoneOffset() * 60000; //offset in milliseconds
                    const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
                    setDeadline(localISOTime);
                  }
                }}
                style={{ marginBottom: '8px', padding: '8px', fontSize: '0.85rem' }}
              >
                <option value="">-- Bind to Corporate Deadline --</option>
                {activeDeadlines.map((dl) => (
                  <option key={dl.id} value={dl.cutoff_date}>
                    {dl.title} ({new Date(dl.cutoff_date).toLocaleDateString()})
                  </option>
                ))}
              </select>
            )}
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>File Attachment (PDF / Excel)</label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px', background: 'rgba(255,255,255,0.05)', border: '1px dashed var(--border-light)', borderRadius: '8px', cursor: 'pointer', flex: 1, justifyContent: 'center' }}>
                <Upload size={18} />
                <span>{file ? file.name : 'Select File'}</span>
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ display: 'none' }} accept=".pdf,.xls,.xlsx" />
              </label>
              {file && (
                <button type="button" className="btn-danger" style={{ padding: '12px' }} onClick={() => setFile(null)}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
              {currentUser.role === 'CHECKER' ? 'Route/Forward to Financial Controller (FC)' : 'Route/Direct Send to Checker'}
            </label>
            <select value={selectedReviewer} onChange={(e) => setSelectedReviewer(e.target.value)} required>
              {reviewers.length === 0 ? (
                <option value="">No active staff registered</option>
              ) : (
                reviewers.map((r) => (
                  <option key={r.emp_id} value={r.emp_id}>
                    {r.name} ({r.emp_id})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {/* GL Entries Grid */}
      <div className="glass-panel" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.2rem', color: '#fff' }}>General Ledger Entries Builder</h3>
          <button type="button" className="btn-secondary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleAddEntry}>
            <Plus size={16} /> Add Entry
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 2fr 120px 120px 50px', gap: '12px', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', paddingBottom: '8px', borderBottom: '1px solid var(--border-light)' }}>
            <div>Code (1/2/3)*</div>
            <div>Account Name</div>
            <div>Debit ($)</div>
            <div>Credit ($)</div>
            <div></div>
          </div>

          {entries.map((entry, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '120px 2fr 120px 120px 50px', gap: '12px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="e.g. 1001"
                value={entry.account_code}
                onChange={(e) => handleEntryChange(idx, 'account_code', e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="e.g. Operating Cash"
                value={entry.account_name}
                onChange={(e) => handleEntryChange(idx, 'account_name', e.target.value)}
                required
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={entry.debit}
                onChange={(e) => handleEntryChange(idx, 'debit', e.target.value)}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={entry.credit}
                onChange={(e) => handleEntryChange(idx, 'credit', e.target.value)}
              />
              <button type="button" className="btn-danger" style={{ padding: '10px' }} onClick={() => handleRemoveEntry(idx)}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px' }}>
          * Account Code conventions: <strong>1xxx</strong> for Assets, <strong>2xxx</strong> for Liabilities, <strong>3xxx</strong> for Equity.
        </p>

        {/* Dynamic Balancing Monitor */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Balancing Equations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
              <span>Total Assets:</span>
              <span className="font-mono text-success" style={{ fontWeight: 'bold' }}>${calculatedAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
              <span>Total Liabilities:</span>
              <span className="font-mono text-danger" style={{ fontWeight: 'bold' }}>${calculatedLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
              <span>Total Equity:</span>
              <span className="font-mono" style={{ fontWeight: 'bold', color: 'var(--color-info)' }}>${calculatedEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            
            {/* Status alerts */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                backgroundColor: equationsBalance ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${equationsBalance ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                color: equationsBalance ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            >
              {equationsBalance ? (
                <>
                  <Check size={16} />
                  <span>Balance sheet equation holds: Assets = Liabilities + Equity</span>
                </>
              ) : (
                <>
                  <AlertCircle size={16} />
                  <span>Unbalanced: Assets (${calculatedAssets}) ≠ Liabilities + Equity (${calculatedLiabilities + calculatedEquity})</span>
                </>
              )}
            </div>
          </div>

          {/* Debits / Credits Balancing */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
              <span>Total Debits:</span>
              <span className="font-mono" style={{ fontWeight: 'bold' }}>${totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
              <span>Total Credits:</span>
              <span className="font-mono" style={{ fontWeight: 'bold' }}>${totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                backgroundColor: debitsCreditsBalance ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${debitsCreditsBalance ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                color: debitsCreditsBalance ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            >
              {debitsCreditsBalance ? (
                <>
                  <Check size={16} />
                  <span>Ledger Debits match Credits ($ {totalDebits})</span>
                </>
              ) : (
                <>
                  <AlertCircle size={16} />
                  <span>Discrepancy: Debits ≠ Credits (Diff: ${Math.abs(totalDebits - totalCredits)})</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
