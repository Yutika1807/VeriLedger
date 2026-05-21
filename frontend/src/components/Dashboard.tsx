import { useState, useEffect } from 'react';
import { api, removeToken } from '../utils/api';
import SheetForm from './SheetForm';
import SheetDetail from './SheetDetail';
import { LogOut, FileText, CheckSquare, Layers, AlertCircle, FilePlus, Search, Calendar, MessageSquare, Clock, Plus } from 'lucide-react';

interface DashboardProps {
  currentUser: any;
  onLogout: () => void;
}

// Countdown timer item for list of deadlines
function DeadlineCountdownItem({ deadline }: { deadline: any }) {
  const [timeLeft, setTimeLeft] = useState('');
  
  useEffect(() => {
    const calculateTime = () => {
      const difference = new Date(deadline.cutoff_date).getTime() - new Date().getTime();
      if (difference <= 0) {
        setTimeLeft('Lapsed');
        return;
      }
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      
      let str = '';
      if (days > 0) str += `${days}d `;
      str += `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
      setTimeLeft(str);
    };
    
    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [deadline.cutoff_date]);

  const isLapsed = timeLeft === 'Lapsed';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '0.85rem', color: '#fff' }}>{deadline.title}</strong>
        <span style={{
          fontSize: '0.7rem',
          padding: '2px 6px',
          borderRadius: '4px',
          backgroundColor: isLapsed ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          color: isLapsed ? 'var(--color-danger)' : 'var(--color-success)',
          fontWeight: 'bold'
        }}>{isLapsed ? 'Lapsed' : 'Active'}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>Cutoff: {new Date(deadline.cutoff_date).toLocaleDateString()}</span>
        <span className="font-mono" style={{ color: isLapsed ? 'var(--color-danger)' : 'var(--color-primary)', fontWeight: 'bold' }}>{timeLeft}</span>
      </div>
    </div>
  );
}

// Mini interactive calendar showing cutoff events
function MiniCalendar({ deadlines }: { deadlines: any[] }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Get first day of current month and total days
  const firstDay = new Date(year, month, 1).getDay();
  const numDays = new Date(year, month + 1, 0).getDate();

  // Build grid days array
  const daysGrid: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    daysGrid.push(null);
  }
  for (let d = 1; d <= numDays; d++) {
    daysGrid.push(new Date(year, month, d));
  }

  const getDeadlinesForDay = (date: Date) => {
    return deadlines.filter(dl => {
      const dlDate = new Date(dl.cutoff_date);
      return dlDate.getDate() === date.getDate() &&
             dlDate.getMonth() === date.getMonth() &&
             dlDate.getFullYear() === date.getFullYear();
    });
  };

  return (
    <div style={{ background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-light)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, color: '#fff', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={16} style={{ color: 'var(--color-primary)' }} />
          <span>{monthNames[month]} {year}</span>
        </h4>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cutoff Calendar</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold' }}>
        <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', justifyItems: 'center' }}>
        {daysGrid.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} style={{ width: '26px', height: '26px' }} />;
          
          const dayDeadlines = getDeadlinesForDay(day);
          const isToday = day.getDate() === today.getDate() && day.getMonth() === today.getMonth();
          const hasDeadline = dayDeadlines.length > 0;
          
          let dayStyle: React.CSSProperties = {
            width: '26px',
            height: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            fontSize: '0.78rem',
            color: '#fff',
            cursor: 'default',
            position: 'relative'
          };

          if (isToday) {
            dayStyle.border = '1.5px solid var(--color-primary)';
          }
          if (hasDeadline) {
            dayStyle.backgroundColor = 'rgba(59, 130, 246, 0.2)';
            dayStyle.border = '1.5px solid var(--color-primary)';
            dayStyle.color = 'var(--color-primary)';
            dayStyle.fontWeight = 'bold';
            dayStyle.cursor = 'pointer';
          }

          return (
            <div 
              key={`day-${day.getDate()}`} 
              style={dayStyle}
              title={hasDeadline ? dayDeadlines.map(d => d.title).join(', ') : undefined}
            >
              {day.getDate()}
              {hasDeadline && (
                <span style={{
                  position: 'absolute',
                  bottom: '2px',
                  width: '3px',
                  height: '3px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary)'
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard({ currentUser, onLogout }: DashboardProps) {
  const [sheets, setSheets] = useState<any[]>([]);
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Deadline form state
  const [deadlineTitle, setDeadlineTitle] = useState('');
  const [cutoffDate, setCutoffDate] = useState('');
  const [deadlineError, setDeadlineError] = useState('');
  const [submittingDeadline, setSubmittingDeadline] = useState(false);

  // Views navigation
  const [viewState, setViewState] = useState<'LIST' | 'CREATE' | 'DETAIL' | 'EDIT'>('LIST');
  const [selectedSheetId, setSelectedSheetId] = useState<string>('');
  const [selectedSheetToEdit, setSelectedSheetToEdit] = useState<any>(null);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const sheetsRes = await api.getSheets();
      setSheets(sheetsRes);
      
      const deadlinesRes = await api.getDeadlines();
      setDeadlines(deadlinesRes);

      const unreadRes = await api.getUnreadCommentsCount();
      setUnreadCount(unreadRes.unread_count);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleLogoutClick = () => {
    removeToken();
    onLogout();
  };

  const handleCreateDeadlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeadlineError('');
    if (!deadlineTitle.trim() || !cutoffDate) {
      setDeadlineError('Please provide a title and cutoff date.');
      return;
    }
    setSubmittingDeadline(true);
    try {
      await api.createDeadline({
        title: deadlineTitle,
        cutoff_date: new Date(cutoffDate).toISOString(),
        is_active: true
      });
      setDeadlineTitle('');
      setCutoffDate('');
      // Reload deadlines
      const deadlinesRes = await api.getDeadlines();
      setDeadlines(deadlinesRes);
    } catch (err: any) {
      setDeadlineError(err.message || 'Failed to post deadline.');
    } finally {
      setSubmittingDeadline(false);
    }
  };

  // Filter sheets
  const filteredSheets = sheets.filter((sheet) => {
    const matchesSearch = sheet.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          sheet.maker_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || sheet.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate metrics
  const totalSheetsCount = sheets.length;
  const pendingActionCount = sheets.filter((s) => {
    if (currentUser.role === 'MAKER') {
      return s.status.includes('REJECTED'); 
    }
    if (currentUser.role === 'CHECKER') {
      return s.status === 'SENT_TO_CHECKER' && s.assigned_checker_id === currentUser.emp_id;
    }
    if (currentUser.role === 'FC') {
      return s.status === 'SENT_TO_FC' && s.assigned_fc_id === currentUser.emp_id;
    }
    if (currentUser.role === 'CFO') {
      return s.status === 'SENT_TO_CFO' && s.assigned_cfo_id === currentUser.emp_id;
    }
    return false;
  }).length;

  const approvedCount = sheets.filter(s => s.status === 'CFO_APPROVED').length;

  if (viewState === 'CREATE') {
    return (
      <div className="animate-fade" style={{ padding: '40px 0' }}>
        <SheetForm
          currentUser={currentUser}
          onSuccess={() => {
            setViewState('LIST');
            loadDashboardData();
          }}
          onCancel={() => setViewState('LIST')}
        />
      </div>
    );
  }

  if (viewState === 'EDIT' && selectedSheetToEdit) {
    return (
      <div className="animate-fade" style={{ padding: '40px 0' }}>
        <SheetForm
          sheetToEdit={selectedSheetToEdit}
          currentUser={currentUser}
          onSuccess={() => {
            setViewState('LIST');
            setSelectedSheetToEdit(null);
            loadDashboardData();
          }}
          onCancel={() => {
            setViewState('DETAIL');
          }}
        />
      </div>
    );
  }

  if (viewState === 'DETAIL' && selectedSheetId) {
    return (
      <div className="animate-fade" style={{ padding: '40px 0' }}>
        <SheetDetail
          sheetId={selectedSheetId}
          currentUser={currentUser}
          onBack={() => {
            setViewState('LIST');
            loadDashboardData();
          }}
          onRefresh={loadDashboardData}
          onEdit={(sheet) => {
            setSelectedSheetToEdit(sheet);
            setViewState('EDIT');
          }}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade" style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Header Stat Board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
        
        {/* Welcome Identity Panel */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '4px solid var(--color-primary)' }}>
          <div>
            <h4 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Access Identity</h4>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
              <h3 style={{ fontSize: '1.4rem', color: '#fff', margin: 0 }}>{currentUser.name}</h3>
              {unreadCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: 'var(--color-danger)', fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px' }}>
                  <MessageSquare size={12} />
                  <span>{unreadCount} UNREAD</span>
                </div>
              )}
            </div>
            <span style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>{currentUser.role}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: <strong className="font-mono">{currentUser.emp_id}</strong></span>
            <button onClick={handleLogoutClick} style={{ padding: '4px 8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }} className="btn-secondary">
              <LogOut size={12} /> Exit
            </button>
          </div>
        </div>

        {/* Total Sheets */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'inline-flex', padding: '16px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', color: 'var(--color-info)' }}>
            <Layers size={28} />
          </div>
          <div>
            <h4 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Scope Volume</h4>
            <h3 style={{ fontSize: '1.8rem', color: '#fff', margin: 0 }}>{totalSheetsCount}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>Total sheets in workspace</p>
          </div>
        </div>

        {/* Action Required */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px', borderLeft: pendingActionCount > 0 ? '4px solid var(--color-primary)' : '1px solid var(--border-light)' }}>
          <div style={{ display: 'inline-flex', padding: '16px', background: pendingActionCount > 0 ? 'rgba(251, 191, 36, 0.1)' : 'rgba(255,255,255,0.03)', borderRadius: '12px', color: pendingActionCount > 0 ? 'var(--color-primary)' : 'var(--text-muted)' }}>
            <AlertCircle size={28} />
          </div>
          <div>
            <h4 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Action Required</h4>
            <h3 style={{ fontSize: '1.8rem', color: '#fff', margin: 0 }}>{pendingActionCount}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>Awaiting your review/action</p>
          </div>
        </div>

        {/* Approved and Secured */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'inline-flex', padding: '16px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', color: 'var(--color-success)' }}>
            <CheckSquare size={28} />
          </div>
          <div>
            <h4 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Secured (Locked)</h4>
            <h3 style={{ fontSize: '1.8rem', color: '#fff', margin: 0 }}>{approvedCount}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>Immutable approved ledgers</p>
          </div>
        </div>

      </div>

      {error && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '16px', borderRadius: '12px', color: 'var(--color-danger)' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Two-Column Workspace Layout */}
      <div style={{ display: 'grid', gap: '32px' }} className="grid-responsive">
        
        {/* Left Column: Balance Sheets Table */}
        <div className="glass-panel" style={{ padding: '28px', gridColumn: 'span 1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
            <div>
              <h3 style={{ fontSize: '1.3rem', color: '#fff', margin: 0 }}>Balance Sheets Ledger</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>View, reconciliation, and workflow audits.</p>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              
              {/* Search Bar */}
              <div style={{ position: 'relative', width: '200px' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search sheets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '36px', paddingTop: '6px', paddingBottom: '6px', fontSize: '0.825rem' }}
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: '150px', paddingTop: '6px', paddingBottom: '6px', fontSize: '0.825rem' }}
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">DRAFT</option>
                <option value="SENT_TO_CHECKER">SENT_TO_CHECKER</option>
                <option value="CHECKER_REJECTED">CHECKER_REJECTED</option>
                <option value="SENT_TO_FC">SENT_TO_FC</option>
                <option value="FC_REJECTED">FC_REJECTED</option>
                <option value="SENT_TO_CFO">SENT_TO_CFO</option>
                <option value="CFO_APPROVED">CFO_APPROVED</option>
                <option value="CFO_REJECTED">CFO_REJECTED</option>
              </select>

              {/* Maker create sheet button */}
              {currentUser.role === 'MAKER' && (
                <button
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '6px', paddingBottom: '6px', fontSize: '0.825rem' }}
                  onClick={() => setViewState('CREATE')}
                >
                  <FilePlus size={14} /> Prepare
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Retrieving documents...</div>
          ) : filteredSheets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 0', border: '1px dashed var(--border-light)', borderRadius: '12px', color: 'var(--text-muted)' }}>
              <FileText size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p>No sheets found matching the search filters.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                    <th style={{ padding: '12px 8px' }}>Sheet Details</th>
                    <th style={{ padding: '12px 8px' }}>Status</th>
                    <th style={{ padding: '12px 8px' }}>Assets ($)</th>
                    <th style={{ padding: '12px 8px' }}>Liabilities ($)</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSheets.map((sheet) => {
                    const deadlinePassed = sheet.deadline && new Date() > new Date(sheet.deadline);
                    
                    return (
                      <tr key={sheet.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)', fontSize: '0.9rem' }} className="table-row-hover">
                        <td style={{ padding: '14px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontWeight: 'bold', color: '#fff' }}>{sheet.title}</div>
                            {deadlinePassed && !sheet.is_locked && (
                              <span style={{ fontSize: '0.68rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>
                                Lapsed
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: <span className="font-mono">{sheet.id.slice(0,8)}</span> | Maker: <strong>{sheet.maker_id}</strong></div>
                        </td>
                        <td style={{ padding: '14px 8px' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 'bold',
                              backgroundColor: sheet.is_locked ? 'rgba(16, 185, 129, 0.1)' : sheet.status.includes('REJECTED') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                              color: sheet.is_locked ? 'var(--color-success)' : sheet.status.includes('REJECTED') ? 'var(--color-danger)' : 'var(--color-primary)',
                              border: `1px solid ${sheet.is_locked ? 'rgba(16, 185, 129, 0.2)' : sheet.status.includes('REJECTED') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(251, 191, 36, 0.2)'}`
                            }}
                          >
                            {sheet.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 8px' }} className="font-mono text-success">${parseFloat(sheet.total_assets).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '14px 8px' }} className="font-mono text-danger">${parseFloat(sheet.total_liabilities).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '14px 8px', textAlign: 'right' }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                            onClick={() => {
                              setSelectedSheetId(sheet.id);
                              setViewState('DETAIL');
                            }}
                          >
                            Audit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Compliance Calendar & Admin Cutoffs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', gridColumn: 'span 1' }}>
          
          {/* Mini Calendar Widget */}
          <MiniCalendar deadlines={deadlines} />

          {/* Deadlines List */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} style={{ color: 'var(--color-primary)' }} />
              <span>Compliance Timeline Cutoffs</span>
            </h4>

            {deadlines.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', margin: '20px 0' }}>
                No organizational deadlines set.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                {deadlines.map((dl) => (
                  <DeadlineCountdownItem key={dl.id} deadline={dl} />
                ))}
              </div>
            )}
          </div>

          {/* CFO/FC Form to Post Deadline */}
          {(currentUser.role === 'CFO' || currentUser.role === 'FC') && (
            <div className="glass-panel" style={{ padding: '20px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={16} style={{ color: 'var(--color-primary)' }} />
                <span>Post Cutoff Target Date</span>
              </h4>

              {deadlineError && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', color: 'var(--color-danger)', fontSize: '0.78rem' }}>
                  {deadlineError}
                </div>
              )}

              <form onSubmit={handleCreateDeadlineSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Deadline Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Q1 Fiscal Closure"
                    value={deadlineTitle}
                    onChange={(e) => setDeadlineTitle(e.target.value)}
                    style={{ padding: '8px', fontSize: '0.825rem' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Target Cutoff Time
                  </label>
                  <input
                    type="datetime-local"
                    value={cutoffDate}
                    onChange={(e) => setCutoffDate(e.target.value)}
                    style={{ padding: '8px', fontSize: '0.825rem' }}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  style={{ fontSize: '0.8rem', padding: '8px', marginTop: '4px' }}
                  disabled={submittingDeadline}
                >
                  {submittingDeadline ? 'Posting Cutoff...' : 'Post Cutoff Target'}
                </button>
              </form>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
