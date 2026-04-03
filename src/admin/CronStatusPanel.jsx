import React, { useState, useEffect } from 'react';
import { apiCall } from '../components/axiosInstance';

const CronStatusPanel = () => {
  const [cronData, setCronData] = useState(null);
  const [expandedJob, setExpandedJob] = useState(null);
  const [jobHistory, setJobHistory] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCronStatus();
  }, []);

  const fetchCronStatus = async () => {
    try {
      const res = await apiCall({ url: '/v1/admin/cron/status', method: 'get' });
      setCronData(res.data);
    } catch (err) {
      console.error('Failed to load cron status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (jobName) => {
    if (expandedJob === jobName) {
      setExpandedJob(null);
      return;
    }
    try {
      const res = await apiCall({ url: `/v1/admin/cron/history/${jobName}`, method: 'get' });
      setJobHistory(prev => ({ ...prev, [jobName]: res.data }));
      setExpandedJob(jobName);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '—';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));

    let ago;
    if (diffMins < 60) ago = `${diffMins}m ago`;
    else if (diffHrs < 24) ago = `${diffHrs}h ago`;
    else ago = `${Math.floor(diffHrs / 24)}d ago`;

    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} (${ago})`;
  };

  const formatDuration = (ms) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'SUCCESS': return { symbol: '✓', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' };
      case 'FAILED': return { symbol: '✕', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
      case 'RUNNING': return { symbol: '◌', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
      default: return { symbol: '?', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' };
    }
  };

  const getJobLabel = (jobName) => {
    const labels = {
      'DAILY_AWARDS': 'Daily Awards',
      'WEEKLY_AWARDS': 'Weekly Awards',
      'MONTHLY_AWARDS': 'Monthly Awards',
      'QUARTERLY_AWARDS': 'Quarterly Awards',
      'MIDTERM_AWARDS': 'Midterm Awards',
      'ANNUAL_AWARDS': 'Annual Awards',
    };
    return labels[jobName] || jobName;
  };

  const getExpectedSchedule = (jobName) => {
    const schedules = {
      'DAILY_AWARDS': 'Every night at 12:01 AM',
      'WEEKLY_AWARDS': 'Mondays at 12:01 AM',
      'MONTHLY_AWARDS': '1st of month at 12:01 AM',
      'QUARTERLY_AWARDS': 'Jan/Apr/Jul/Oct 1st',
      'MIDTERM_AWARDS': 'Jan 1st & Jul 1st',
      'ANNUAL_AWARDS': 'January 1st',
    };
    return schedules[jobName] || 'Unknown';
  };

  if (loading) {
    return (
      <div style={{ color: '#A9A9A9', padding: '20px', textAlign: 'center' }}>
        Loading cron status...
      </div>
    );
  }

  if (!cronData) {
    return (
      <div style={{ color: '#ef4444', padding: '20px' }}>
        Failed to load cron data
      </div>
    );
  }

  const { latestExecutions, recentFailures, allHealthy } = cronData;

  return (
    <div style={{
      background: 'rgba(26, 26, 26, 0.85)',
      borderRadius: '12px',
      padding: '24px',
      border: `1px solid ${allHealthy ? 'rgba(255,255,255,0.1)' : 'rgba(239,68,68,0.3)'}`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: allHealthy ? '#22c55e' : '#ef4444',
            boxShadow: allHealthy ? '0 0 8px rgba(34,197,94,0.5)' : '0 0 8px rgba(239,68,68,0.5)',
          }} />
          <h3 style={{ color: '#fff', fontSize: '17px', fontWeight: '700', margin: 0 }}>
            Scheduled Jobs
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {recentFailures > 0 && (
            <span style={{
              color: '#ef4444', fontSize: '12px', fontWeight: '600',
              background: 'rgba(239,68,68,0.12)', padding: '4px 10px', borderRadius: '6px',
            }}>
              {recentFailures} failure{recentFailures > 1 ? 's' : ''} this week
            </span>
          )}
          <button
            onClick={fetchCronStatus}
            style={{
              background: 'rgba(255,255,255,0.06)', color: '#A9A9A9',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
              padding: '4px 10px', fontSize: '12px', cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Job list */}
      {latestExecutions && latestExecutions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {latestExecutions.map((exec) => {
            const status = getStatusIcon(exec.status);
            const isExpanded = expandedJob === exec.jobName;

            return (
              <div key={exec.executionId || exec.jobName}>
                {/* Job row */}
                <div
                  onClick={() => fetchHistory(exec.jobName)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', borderRadius: '8px', cursor: 'pointer',
                    background: isExpanded ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Status badge */}
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '8px',
                      background: status.bg, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '14px', fontWeight: '700',
                      color: status.color,
                    }}>
                      {status.symbol}
                    </div>

                    <div>
                      <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600' }}>
                        {getJobLabel(exec.jobName)}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>
                        {getExpectedSchedule(exec.jobName)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {/* Awards created */}
                    {exec.status === 'SUCCESS' && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600' }}>
                          {exec.awardsCreated}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '10px' }}>awards</div>
                      </div>
                    )}

                    {/* Duration */}
                    <div style={{ textAlign: 'right', minWidth: '50px' }}>
                      <div style={{ color: '#A9A9A9', fontSize: '13px' }}>
                        {formatDuration(exec.durationMs)}
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div style={{ textAlign: 'right', minWidth: '180px' }}>
                      <div style={{ color: '#C0C0C0', fontSize: '12px' }}>
                        {formatTime(exec.startedAt)}
                      </div>
                    </div>

                    {/* Expand arrow */}
                    <div style={{
                      color: '#6b7280', fontSize: '12px',
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
                      transition: 'transform 0.2s',
                    }}>
                      ▶
                    </div>
                  </div>
                </div>

                {/* Error message if failed */}
                {exec.status === 'FAILED' && exec.errorMessage && (
                  <div style={{
                    margin: '4px 0 0 40px', padding: '8px 12px',
                    background: 'rgba(239,68,68,0.08)', borderRadius: '6px',
                    color: '#fca5a5', fontSize: '12px', fontFamily: 'monospace',
                    maxHeight: '60px', overflow: 'auto',
                  }}>
                    {exec.errorMessage}
                  </div>
                )}

                {/* Expanded history */}
                {isExpanded && jobHistory[exec.jobName] && (
                  <div style={{
                    marginTop: '4px', marginLeft: '40px', padding: '12px',
                    background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <div style={{ color: '#A9A9A9', fontSize: '11px', marginBottom: '8px', fontWeight: '600' }}>
                      RECENT EXECUTIONS
                    </div>
                    {jobHistory[exec.jobName].map((h, i) => {
                      const hStatus = getStatusIcon(h.status);
                      return (
                        <div key={h.executionId || i} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '6px 0',
                          borderBottom: i < jobHistory[exec.jobName].length - 1
                            ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: hStatus.color, fontSize: '12px', fontWeight: '700' }}>
                              {hStatus.symbol}
                            </span>
                            <span style={{ color: '#C0C0C0', fontSize: '12px' }}>
                              {formatTime(h.startedAt)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '16px' }}>
                            <span style={{ color: '#A9A9A9', fontSize: '12px' }}>
                              {h.awardsCreated} awards
                            </span>
                            <span style={{ color: '#6b7280', fontSize: '12px' }}>
                              {formatDuration(h.durationMs)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', padding: '30px 0' }}>
          No cron executions recorded yet. Jobs will appear after the first nightly run.
        </div>
      )}
    </div>
  );
};

export default CronStatusPanel;