import { useEffect, useState } from 'react';

interface DeadlineTimerProps {
  deadline: string;
  onLapse?: () => void;
}

export default function DeadlineTimer({ deadline, onLapse }: DeadlineTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [urgency, setUrgency] = useState<'normal' | 'warning' | 'critical' | 'lapsed'>('normal');

  useEffect(() => {
    const target = new Date(deadline).getTime();
    if (isNaN(target)) {
      setTimeLeft('No Deadline');
      setUrgency('normal');
      return;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = target - now;

      if (difference <= 0) {
        setTimeLeft('Lapsed (Overdue)');
        setUrgency('lapsed');
        clearInterval(interval);
        if (onLapse) onLapse();
        return;
      }

      // Calculations
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      let timeString = '';
      if (days > 0) timeString += `${days}d `;
      timeString += `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;

      setTimeLeft(timeString);

      // Urgency states
      const totalHours = difference / (1000 * 60 * 60);
      if (totalHours <= 2) {
        setUrgency('critical');
      } else if (totalHours <= 24) {
        setUrgency('warning');
      } else {
        setUrgency('normal');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline, onLapse]);

  // Color styles
  let colorClass = '';
  let glowStyle = {};

  if (urgency === 'lapsed') {
    colorClass = 'text-danger';
  } else if (urgency === 'critical') {
    colorClass = 'text-danger';
    glowStyle = { animation: 'pulse-glow-red 1.5s infinite', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '4px 8px', borderRadius: '6px' };
  } else if (urgency === 'warning') {
    colorClass = 'text-warning';
    glowStyle = { animation: 'pulse-glow 2s infinite', border: '1px solid rgba(251, 191, 36, 0.4)', padding: '4px 8px', borderRadius: '6px' };
  } else {
    colorClass = 'text-success';
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', ...glowStyle }}>
      <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
        Deadline:
      </span>
      <span className={`font-mono ${colorClass}`} style={{ fontWeight: 'bold' }}>
        {timeLeft}
      </span>
    </div>
  );
}
