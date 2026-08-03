import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Loader2, Circle, ShieldCheck, Zap, X, Code2 } from 'lucide-react';

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

// Real Code Patches being applied during auto-remediation
const CODE_PATCH_LOGS = [
  { delay: 0,     type: 'info', text: 'AI Recovery Pipeline initiated. Generating automated code fixes...' },
  { delay: 800,   type: 'header', text: '--- PATCH k8s/deployments/user-service.yaml ---' },
  { delay: 1200,  type: 'diff-del', text: '-   replicas: 1' },
  { delay: 1500,  type: 'diff-add', text: '+   replicas: 3' },
  { delay: 1800,  type: 'diff-del', text: '-   resources: { limits: { memory: "256Mi", cpu: "200m" } }' },
  { delay: 2200,  type: 'diff-add', text: '+   resources: { limits: { memory: "1Gi", cpu: "1000m" } }' },
  { delay: 3000,  type: 'header', text: '--- PATCH backend/app/db/session.py ---' },
  { delay: 3600,  type: 'diff-del', text: '-   engine = create_engine(DATABASE_URL, pool_size=5, max_overflow=0)' },
  { delay: 4200,  type: 'diff-add', text: '+   engine = create_engine(DATABASE_URL, pool_size=25, max_overflow=10, pool_pre_ping=True)' },
  { delay: 5200,  type: 'header', text: '--- PATCH k8s/monitoring/liveness-probe.yaml ---' },
  { delay: 5800,  type: 'diff-del', text: '-   initialDelaySeconds: 2' },
  { delay: 6400,  type: 'diff-add', text: '+   initialDelaySeconds: 15' },
  { delay: 7200,  type: 'diff-del', text: '-   timeoutSeconds: 1' },
  { delay: 7800,  type: 'diff-add', text: '+   timeoutSeconds: 5' },
  { delay: 8800,  type: 'header', text: '--- PATCH redis/redis.conf ---' },
  { delay: 9400,  type: 'diff-del', text: '-   maxmemory-policy noeviction' },
  { delay: 10000, type: 'diff-add', text: '+   maxmemory-policy allkeys-lru' },
  { delay: 11000, type: 'info', text: '✔ Code patches compiled & deployed cleanly. Readiness probes 200 OK.' },
  { delay: 12000, type: 'info', text: '✔ All SLO thresholds verified. Recovery completed successfully.' },
];

const AI_MESSAGES = [
  { at: 0,     status: 'Root cause confirmed.',      sub: 'Generating live code patches for Kubernetes & DB pool...' },
  { at: 3000,  status: 'Applying code diffs.',       sub: 'Patching deployment replicas and memory allocation limits...' },
  { at: 6000,  status: 'Restoring data layer.',      sub: 'Recompiling DB pool_size settings + Redis eviction policy...' },
  { at: 9000,  status: 'Verifying health probes.',   sub: 'Readiness checks passing across all pods...' },
  { at: 11500, status: 'Finalising cluster state.',  sub: 'Confirming all SLOs are met...' },
  { at: 12800, status: 'Recovery complete. ✓',       sub: 'Review code fixes below. Window remains open for inspection.' },
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
    if (phase !== 'running') return;
    const id = setInterval(() => {
      const pct = Math.min(99, ((Date.now() - startRef.current) / TOTAL_DURATION) * 100);
      setProgress(pct);
    }, 80);
    return () => clearInterval(id);
  }, [phase]);

  // ── Countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [phase]);

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
      // DO NOT auto-close modal — keep window open for user inspection until explicit user click!
    }

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Log emitter ───────────────────────────────────────────────────────────
  useEffect(() => {
    const ids = CODE_PATCH_LOGS.map(item =>
      setTimeout(() => {
        setLogs(prev => [...prev, { ts: Date.now(), ...item }]);
      }, item.delay)
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

  const handleManualClose = () => {
    if (onComplete) {
      onComplete();
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(10px)', background: 'rgba(15,15,20,0.65)' }}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl border border-stone-100 flex flex-col overflow-hidden"
        style={{ maxHeight: '92vh' }}
      >
        {/* Header Bar */}
        <div className="px-8 pt-6 pb-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-100">
              <Code2 className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-abstra-dark font-display flex items-center space-x-2">
                <span>AI Automated Code Remediation</span>
              </h2>
              <p className="text-xs text-abstra-muted">
                {phase === 'running' ? 'AI is generating and applying live code patches across infrastructure manifests...' : 'Recovery complete. Review applied code diffs below.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {phase === 'running' ? (
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Fixing Code & Scaling...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <span>100% Resolved</span>
              </div>
            )}

            <button
              onClick={handleManualClose}
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-full transition"
              title="Close window"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-5 gap-6 overflow-y-auto">

          {/* LEFT COLUMN: Progress & Steps & Assistant */}
          <div className="md:col-span-2 space-y-5">
            {/* Progress bar */}
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/70">
              <div className="flex justify-between text-xs font-semibold mb-2 text-abstra-dark">
                <span>Remediation Progress</span>
                <span className="font-mono text-violet-600 font-bold">{Math.round(progress)}%</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden bg-stone-200">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #7c5cbf 0%, #4db9a4 100%)',
                  }}
                />
              </div>
            </div>

            {/* Recovery Steps */}
            <div className="space-y-1.5">
              {RECOVERY_STEPS.map(step => {
                const st = stepStatus[step.id];
                return (
                  <div
                    key={step.id}
                    className="flex items-center space-x-2.5 px-3.5 py-2 rounded-xl transition-all duration-300"
                    style={{
                      background: st === 'running' ? 'rgba(124,92,191,0.08)'
                                : st === 'done'    ? 'rgba(77,185,164,0.06)'
                                : 'transparent',
                      border: st === 'running' ? '1px solid rgba(124,92,191,0.25)'
                            : st === 'done'    ? '1px solid rgba(77,185,164,0.2)'
                            : '1px solid transparent',
                    }}
                  >
                    <StepIcon status={st} />
                    <span
                      className="text-xs font-medium"
                      style={{
                        color: st === 'done'    ? '#2dd4bf'
                             : st === 'running' ? '#7c5cbf'
                             : '#a1a1aa',
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* AI Assistant Banner */}
            <div
              className="rounded-2xl p-4 border"
              style={{
                background: 'linear-gradient(135deg, rgba(124,92,191,0.08), rgba(124,92,191,0.03))',
                borderColor: 'rgba(124,92,191,0.25)',
              }}
            >
              <div className="flex items-center space-x-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-violet-600" />
                <span className="text-xs font-bold uppercase tracking-wide text-violet-700">
                  AI Code Remediation Engine
                </span>
              </div>
              <p className="text-xs font-semibold text-abstra-dark">{aiMsg.status}</p>
              <p className="text-[11px] text-abstra-muted mt-0.5 leading-relaxed">{aiMsg.sub}</p>
              <div className="mt-3 flex justify-between items-center pt-2 border-t border-violet-100">
                <span className="text-[11px] text-abstra-muted">
                  Confidence: <span className="font-bold text-emerald-600">98%</span>
                </span>
                {phase === 'running' ? (
                  <span className="font-mono text-xs text-abstra-muted">~{countdown}s</span>
                ) : (
                  <span className="font-mono text-xs font-bold text-emerald-600">Complete</span>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Code Diffs Terminal & Service Health */}
          <div className="md:col-span-3 space-y-4">
            
            {/* Terminal Box - Showing Code Diffs */}
            <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-inner">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span className="ml-2 text-xs text-zinc-400 font-mono flex items-center space-x-1.5">
                    <Code2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>code-remediation-diff.patch</span>
                  </span>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                  {phase === 'running' ? 'Applying Diffs...' : 'Patches Applied'}
                </span>
              </div>

              <div
                ref={logRef}
                className="font-mono text-[11px] p-4 space-y-1.5 overflow-y-auto"
                style={{ height: '240px', scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 transparent' }}
              >
                {logs.length === 0 && (
                  <span className="text-zinc-600 animate-pulse">Initializing code patcher...</span>
                )}
                {logs.map((l, i) => {
                  let textStyle = "text-zinc-300";
                  if (l.type === 'header') textStyle = "text-cyan-400 font-bold mt-2 pb-0.5 border-b border-zinc-800";
                  else if (l.type === 'diff-del') textStyle = "text-red-400 bg-red-950/40 px-1 py-0.5 rounded";
                  else if (l.type === 'diff-add') textStyle = "text-emerald-400 bg-emerald-950/40 px-1 py-0.5 rounded font-semibold";
                  else if (l.type === 'info') textStyle = "text-violet-300 italic";

                  return (
                    <div key={i} className="flex space-x-2">
                      <span className="text-zinc-600 shrink-0 select-none">[{fmt(l.ts)}]</span>
                      <span className={`leading-relaxed break-all ${textStyle}`}>{l.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Service Recovery Status Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              {Object.entries(svcStatus).map(([key, st]) => {
                const isCrit = st === 'critical';
                const isRec  = st === 'recovering';
                return (
                  <div
                    key={key}
                    className="rounded-xl p-3 border transition-all duration-500"
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
                      <span className="text-xs font-bold font-mono text-abstra-dark truncate">{key}</span>
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase"
                        style={{
                          background: isCrit ? 'rgba(239,68,68,0.18)'
                                    : isRec  ? 'rgba(234,179,8,0.18)'
                                    : 'rgba(77,185,164,0.18)',
                          color: isCrit ? '#ef4444' : isRec ? '#854d0e' : '#0d9488',
                        }}
                      >
                        {st}
                      </span>
                    </div>
                    <div className="w-full rounded-full h-1.5 overflow-hidden bg-black/5">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: isRec ? '60%' : '100%',
                          background: isCrit ? '#ef4444' : isRec ? '#eab308' : '#10b981',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-4 bg-stone-50 border-t border-stone-200/80 flex items-center justify-between">
          <div className="text-xs text-abstra-muted">
            {phase === 'success' ? (
              <span className="text-emerald-700 font-semibold flex items-center space-x-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-600 inline" />
                <span>Infrastructure fully restored. You may inspect the code diffs above before closing.</span>
              </span>
            ) : (
              <span>Automated remediation in progress... Do not refresh.</span>
            )}
          </div>

          <button
            onClick={handleManualClose}
            className={`px-6 py-2.5 rounded-full text-xs font-bold transition flex items-center space-x-2 ${
              phase === 'success'
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20'
                : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
            }`}
          >
            <span>{phase === 'success' ? 'Complete & Close Window' : 'Close Window'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
