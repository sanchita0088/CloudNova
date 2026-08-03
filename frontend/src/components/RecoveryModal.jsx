import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Loader2, Circle, ShieldCheck, Zap } from 'lucide-react';

// ─── Static data ─────────────────────────────────────────────────────────────

const RECOVERY_STEPS = [
  { id: 'pods',      label: 'Scaling replacement pods',          duration: 1400 },
  { id: 'services',  label: 'Restarting affected services',      duration: 1500 },
  { id: 'endpoints', label: 'Reattaching Kubernetes endpoints',  duration: 1300 },
  { id: 'db',        label: 'Restoring database connections',    duration: 1800 },
  { id: 'redis',     label: 'Rebuilding Redis cache',            duration: 1500 },
  { id: 'probes',    label: 'Running readiness probes',          duration: 1200 },
  { id: 'health',    label: 'Running health checks',             duration: 1300 },
  { id: 'cluster',   label: 'Verifying cluster stability',       duration: 1500 },
  { id: 'done',      label: 'Infrastructure fully restored',     duration: 800  },
];

const TOTAL_DURATION = RECOVERY_STEPS.reduce((a, s) => a + s.duration, 0); // ≈12300ms

const LOG_EVENTS = [
  { delay: 0,     text: 'AI Recovery Pipeline initiated. Analysing failure signature...' },
  { delay: 1000,  text: 'Scaling auth-service deployment from 1 → 3 replicas...' },
  { delay: 2400,  text: 'New Kubernetes pod scheduled on node-02. Status: Pending...' },
  { delay: 3600,  text: 'Pod cloudops/auth-service-b7d4f → Running.' },
  { delay: 4800,  text: 'Kubernetes Service endpoints reattached. Traffic routing restored.' },
  { delay: 6000,  text: 'PostgreSQL connection pool recreated (25/25 slots available).' },
  { delay: 7400,  text: 'Redis cache synchronised. Hit-rate recovered to 94%.' },
  { delay: 8600,  text: 'Readiness probe passed: /healthz → 200 OK (42ms).' },
  { delay: 9700,  text: 'Liveness probe passed: /livez → 200 OK (38ms).' },
  { delay: 10900, text: 'Health verification completed across 6/6 microservices.' },
  { delay: 11800, text: 'Cluster stability score: 99.8/100. All SLO targets met.' },
  { delay: 12600, text: 'Infrastructure restored successfully. Incident auto-resolved.' },
];

const AI_MESSAGES = [
  { at: 0,     status: 'Root cause confirmed.',      sub: 'Deploying recommended recovery strategy...' },
  { at: 3000,  status: 'Scaling replacement pods.',  sub: 'Monitoring pod scheduling on node-02...' },
  { at: 6000,  status: 'Restoring data layer.',      sub: 'DB connections + Redis recovery in progress...' },
  { at: 9000,  status: 'Verifying health probes.',   sub: 'Readiness checks passing across all pods...' },
  { at: 11500, status: 'Finalising cluster state.',  sub: 'Confirming all SLOs are met...' },
  { at: 12800, status: 'Recovery complete. ✓',       sub: 'All services verified healthy.' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fmt(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function StepIcon({ status }) {
  if (status === 'done')
    return <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />;
  if (status === 'running')
    return <Loader2 className="h-4 w-4 text-violet-500 flex-shrink-0 animate-spin" />;
  return <Circle className="h-4 w-4 text-stone-300 flex-shrink-0" />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RecoveryModal({ sandboxServices = [], onComplete }) {
  const startRef = useRef(Date.now());

  // Step statuses
  const [stepStatus, setStepStatus] = useState(() =>
    RECOVERY_STEPS.reduce((a, s) => ({ ...a, [s.id]: 'pending' }), {})
  );

  // Smooth progress 0 → 100
  const [progress, setProgress] = useState(0);

  // Terminal log lines
  const [logs, setLogs] = useState([]);
  const logRef = useRef(null);

  // AI assistant message
  const [aiMsg, setAiMsg] = useState(AI_MESSAGES[0]);

  // Countdown timer
  const [countdown, setCountdown] = useState(Math.ceil(TOTAL_DURATION / 1000) + 1);

  // Per-service display status
  const [svcStatus, setSvcStatus] = useState(() => {
    const m = {};
    sandboxServices.forEach(s => {
      m[s.key || s.name] = s.status === 'healthy' ? 'healthy' : 'critical';
    });
    return m;
  });

  // 'running' | 'success'
  const [phase, setPhase] = useState('running');

  // ── Progress ticker ───────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const pct = Math.min(99, ((Date.now() - startRef.current) / TOTAL_DURATION) * 100);
      setProgress(pct);
    }, 80);
    return () => clearInterval(id);
  }, []);

  // ── Countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Step sequencer ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const svcKeys = sandboxServices.map(s => s.key || s.name).filter(Boolean);

    async function run() {
      for (let i = 0; i < RECOVERY_STEPS.length; i++) {
        if (cancelled) return;
        const step = RECOVERY_STEPS[i];

        setStepStatus(prev => ({ ...prev, [step.id]: 'running' }));
        await wait(step.duration);
        if (cancelled) return;
        setStepStatus(prev => ({ ...prev, [step.id]: 'done' }));

        // Stagger service recovery: mark some "recovering" during mid-steps
        if (i === 1 && svcKeys.length > 0) setSvcStatus(prev => ({ ...prev, [svcKeys[0]]: 'recovering' }));
        if (i === 2 && svcKeys.length > 1) setSvcStatus(prev => ({ ...prev, [svcKeys[1]]: 'recovering' }));
        if (i === 3 && svcKeys.length > 2) setSvcStatus(prev => ({ ...prev, [svcKeys[2]]: 'recovering' }));
        if (i === 4 && svcKeys.length > 0) setSvcStatus(prev => ({ ...prev, [svcKeys[0]]: 'healthy' }));
        if (i === 5 && svcKeys.length > 1) setSvcStatus(prev => ({ ...prev, [svcKeys[1]]: 'healthy' }));
        if (i === 6 && svcKeys.length > 2) setSvcStatus(prev => ({ ...prev, [svcKeys[2]]: 'healthy' }));
        if (i === 6) {
          // Mark remaining services recovering → healthy
          svcKeys.slice(3).forEach(k => {
            setSvcStatus(prev => ({ ...prev, [k]: 'recovering' }));
            setTimeout(() => setSvcStatus(prev => ({ ...prev, [k]: 'healthy' })), 800);
          });
        }
      }
      if (cancelled) return;

      // All healthy
      setSvcStatus(prev => {
        const next = {};
        Object.keys(prev).forEach(k => { next[k] = 'healthy'; });
        return next;
      });
      setProgress(100);
      setPhase('success');
      setTimeout(() => { if (!cancelled) onComplete(); }, 3000);
    }

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Log emitter ───────────────────────────────────────────────────────────
  useEffect(() => {
    const ids = LOG_EVENTS.map(({ delay, text }) =>
      setTimeout(() => {
        setLogs(prev => [...prev, { ts: Date.now(), text }]);
      }, delay)
    );
    return () => ids.forEach(clearTimeout);
  }, []);

  // ── AI message cycling ────────────────────────────────────────────────────
  useEffect(() => {
    const ids = AI_MESSAGES.map(msg => setTimeout(() => setAiMsg(msg), msg.at));
    return () => ids.forEach(clearTimeout);
  }, []);

  // ── Auto-scroll log ───────────────────────────────────────────────────────
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(10px)', background: 'rgba(15,15,20,0.55)' }}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl border border-stone-100"
        style={{ maxHeight: '92vh', overflowY: 'auto' }}
      >

        {/* ── SUCCESS STATE ── */}
        {phase === 'success' && (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center space-y-5">
            <div className="w-24 h-24 rounded-full flex items-center justify-center animate-bounce"
                 style={{ background: 'rgba(77,185,164,0.15)' }}>
              <CheckCircle className="h-12 w-12 text-emerald-500" />
            </div>
            <h2 className="text-3xl font-bold text-abstra-dark" style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}>
              Recovery Successful
            </h2>
            <p className="text-abstra-muted text-sm max-w-xs leading-relaxed">
              Infrastructure has been fully restored. All services are healthy and the incident has been resolved.
            </p>
            <div className="flex items-center space-x-8 pt-2">
              {[['6/6', 'Services Healthy'], ['100%', 'Recovery Complete'], ['0', 'Active Incidents']].map(([val, lbl]) => (
                <div key={lbl} className="text-center">
                  <div className="text-2xl font-bold text-emerald-500">{val}</div>
                  <div className="text-xs text-abstra-muted">{lbl}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-abstra-muted animate-pulse pt-2">Closing automatically…</p>
          </div>
        )}

        {/* ── RUNNING STATE ── */}
        {phase === 'running' && (
          <>
            {/* Header */}
            <div className="px-8 pt-7 pb-5 border-b border-stone-100">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                     style={{ background: 'rgba(124,92,191,0.12)' }}>
                  <Zap className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-abstra-dark"
                      style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}>
                    AI Recovery Pipeline
                  </h2>
                  <p className="text-xs text-abstra-muted">AI is executing the recommended recovery strategy…</p>
                </div>
                <div className="ml-auto flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                     style={{ background: 'rgba(124,92,191,0.1)', color: '#7c5cbf' }}>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Running</span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-5 gap-5">

              {/* LEFT: progress + steps + AI panel */}
              <div className="md:col-span-2 space-y-5">

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1.5 text-abstra-dark">
                    <span>Recovery Progress</span>
                    <span style={{ color: '#7c5cbf' }}>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden border border-stone-200"
                       style={{ background: '#f5f4f2' }}>
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{
                        width: `${progress}%`,
                        background: 'linear-gradient(90deg, #7c5cbf 0%, #4db9a4 100%)',
                      }}
                    />
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-1.5">
                  {RECOVERY_STEPS.map(step => {
                    const st = stepStatus[step.id];
                    return (
                      <div
                        key={step.id}
                        className="flex items-center space-x-2.5 px-3 py-2 rounded-xl transition-all duration-300"
                        style={{
                          background: st === 'running' ? 'rgba(124,92,191,0.07)'
                                    : st === 'done'    ? 'rgba(77,185,164,0.05)'
                                    : 'transparent',
                          border: st === 'running' ? '1px solid rgba(124,92,191,0.2)'
                                : st === 'done'    ? '1px solid rgba(77,185,164,0.18)'
                                : '1px solid transparent',
                        }}
                      >
                        <StepIcon status={st} />
                        <span
                          className="text-xs font-medium"
                          style={{
                            color: st === 'done'    ? '#4db9a4'
                                 : st === 'running' ? '#7c5cbf'
                                 : '#c0b8b0',
                          }}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* AI Recovery Assistant */}
                <div
                  className="rounded-2xl p-4 border"
                  style={{
                    background: 'linear-gradient(135deg, rgba(124,92,191,0.08), rgba(124,92,191,0.03))',
                    borderColor: 'rgba(124,92,191,0.2)',
                  }}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <ShieldCheck className="h-4 w-4 text-violet-500" />
                    <span className="text-xs font-bold uppercase tracking-wide text-violet-600">
                      AI Recovery Assistant
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-abstra-dark">{aiMsg.status}</p>
                  <p className="text-[11px] text-abstra-muted mt-0.5 leading-relaxed">{aiMsg.sub}</p>
                  <div className="mt-3 flex justify-between items-center">
                    <span className="text-[11px] text-abstra-muted">
                      Confidence: <span className="font-bold text-emerald-500">98%</span>
                    </span>
                    <span className="font-mono text-xs text-abstra-muted">~{countdown}s</span>
                  </div>
                </div>
              </div>

              {/* RIGHT: terminal log + service cards */}
              <div className="md:col-span-3 space-y-4">

                {/* Terminal */}
                <div className="rounded-2xl overflow-hidden border border-zinc-800"
                     style={{ background: '#0f0f0f' }}>
                  <div className="flex items-center space-x-1.5 px-4 py-2.5 border-b border-zinc-800">
                    <div className="w-3 h-3 rounded-full bg-red-500/70" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                    <div className="w-3 h-3 rounded-full bg-green-500/70" />
                    <span className="ml-2 text-[10px] text-zinc-500 font-mono">recovery-pipeline.log</span>
                  </div>
                  <div
                    ref={logRef}
                    className="font-mono text-[11px] p-4 space-y-1 overflow-y-auto"
                    style={{ maxHeight: '180px', scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 transparent' }}
                  >
                    {logs.length === 0 && (
                      <span className="text-zinc-600">Initialising pipeline…</span>
                    )}
                    {logs.map((l, i) => (
                      <div key={i} className="flex space-x-2">
                        <span className="text-zinc-500 shrink-0">[{fmt(l.ts)}]</span>
                        <span className="text-emerald-400 leading-relaxed">{l.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Service status grid */}
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(svcStatus).map(([key, st]) => {
                    const isCrit = st === 'critical';
                    const isRec  = st === 'recovering';
                    return (
                      <div
                        key={key}
                        className="rounded-xl p-3 border transition-all duration-700"
                        style={{
                          background: isCrit ? 'rgba(239,68,68,0.07)'
                                    : isRec  ? 'rgba(234,179,8,0.07)'
                                    : 'rgba(77,185,164,0.07)',
                          borderColor: isCrit ? 'rgba(239,68,68,0.25)'
                                     : isRec  ? 'rgba(234,179,8,0.3)'
                                     : 'rgba(77,185,164,0.25)',
                        }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold font-mono text-abstra-dark truncate">{key}</span>
                          <span
                            className="text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase"
                            style={{
                              background: isCrit ? 'rgba(239,68,68,0.18)'
                                        : isRec  ? 'rgba(234,179,8,0.18)'
                                        : 'rgba(77,185,164,0.18)',
                              color: isCrit ? '#ef4444' : isRec ? '#854d0e' : '#4db9a4',
                            }}
                          >
                            {st}
                          </span>
                        </div>
                        <div className="w-full rounded-full h-1 overflow-hidden"
                             style={{ background: 'rgba(0,0,0,0.08)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-1000"
                            style={{
                              width: isRec ? '55%' : '100%',
                              background: isCrit ? '#ef4444' : isRec ? '#eab308' : '#4db9a4',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
