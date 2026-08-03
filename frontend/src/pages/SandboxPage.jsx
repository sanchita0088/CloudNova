import React from 'react';
import { Server, Cpu, Loader2, RefreshCw } from 'lucide-react';

export function SandboxPage({
  sandboxState,
  simulating,
  demoActive,
  handleSandboxSimulate,
  handleRecover,
  recovering
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-stone-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-abstra-dark tracking-tight flex items-center space-x-3 font-display">
            <Server className="h-6 w-6 text-abstra-mauve" />
            <span>Infrastructure Sandbox</span>
          </h1>
          <p className="text-abstra-muted mt-1 text-xs max-w-3xl">
            Simulate cloud outages and observe AlertManager notifications, RAG runbook search, and Ollama AI diagnostics in real time.
          </p>
        </div>

        <div className="shrink-0 flex items-center space-x-3">
          {sandboxState?.active_simulation && (
            <span className="flex items-center space-x-1.5 bg-alarm-red/15 px-3 py-1.5 rounded-full text-xs font-bold text-alarm-red uppercase tracking-wider animate-pulse font-mono">
              <span className="w-2 h-2 rounded-full bg-alarm-red"></span>
              <span>Outage Active</span>
            </span>
          )}
          
          <button
            onClick={() => handleSandboxSimulate('high_cpu', true)}
            disabled={simulating || sandboxState?.active_simulation !== null}
            className="px-5 py-2.5 rounded-full text-xs font-semibold transition flex items-center space-x-2 bg-abstra-dark text-white hover:bg-black disabled:opacity-50"
          >
            {simulating && demoActive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cpu className="h-3.5 w-3.5" />}
            <span>{demoActive ? "Demo Running" : "Start Demo Loop"}</span>
          </button>
        </div>
      </div>

      {/* Sandbox Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
        {/* Outage Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div>
              <h2 className="text-sm font-bold text-abstra-dark font-display">Outage Scenarios</h2>
              <p className="text-xs text-abstra-muted mt-0.5">Trigger simulated failures across cluster nodes.</p>
            </div>
            
            <div className="flex flex-col space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {[
                { key: 'db_exhaustion', label: 'DB Pool Exhaustion', desc: 'Saturates Postgres connection pool' },
                { key: 'k8s_crashloop', label: 'Pod CrashLoopBackOff', desc: 'Missing ConfigMap boot crash' },
                { key: 'high_cpu', label: 'High CPU Usage', desc: 'Runaway encryption jobs (99%)' },
                { key: 'memory_leak', label: 'Memory Leak', desc: 'Linear heap OOM pod eviction' },
                { key: 'redis_failure', label: 'Redis Cache Fail', desc: 'Cache OOM noeviction state' },
                { key: 'api_timeout', label: 'API Gateway Timeout', desc: 'Stripe webhook gateway delays' }
              ].map((scen) => {
                const isCurrent = sandboxState?.active_simulation?.key === scen.key;
                return (
                  <button
                    key={scen.key}
                    onClick={() => handleSandboxSimulate(scen.key)}
                    disabled={simulating || (sandboxState?.active_simulation !== null && !isCurrent)}
                    className={`w-full text-left p-3 rounded-xl border transition flex flex-col space-y-1 ${
                      isCurrent 
                        ? 'bg-alarm-red/10 border-alarm-red/40 text-alarm-red' 
                        : 'bg-stone-50 border-stone-200/80 hover:bg-stone-100 text-abstra-dark'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold font-display">{scen.label}</span>
                      {isCurrent && <span className="w-2 h-2 rounded-full bg-alarm-red animate-ping"></span>}
                    </div>
                    <span className="text-[10px] text-abstra-muted">{scen.desc}</span>
                  </button>
                );
              })}
            </div>

            {sandboxState?.active_simulation && (
              <button
                onClick={handleRecover}
                disabled={recovering}
                className="w-full py-2.5 bg-signal-teal text-white font-medium rounded-full text-xs hover:bg-signal-teal/90 transition flex items-center justify-center space-x-2"
              >
                {recovering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                <span>Recover Infrastructure</span>
              </button>
            )}
          </div>
        </div>

        {/* Topology Map */}
        <div className="lg:col-span-3 bg-white border border-stone-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-6">
          <div>
            <h2 className="text-lg font-bold text-abstra-dark font-display">Kubernetes Cluster Microservices</h2>
            <p className="text-xs text-abstra-muted mt-0.5">Live node health status and inter-service telemetry topology.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {(sandboxState?.services || [
              { name: 'payment-service', status: 'healthy', cpu: 12, memory: 44 },
              { name: 'auth-service', status: 'healthy', cpu: 8, memory: 37 },
              { name: 'user-service', status: 'healthy', cpu: 14, memory: 31 },
              { name: 'postgresql-db', status: 'healthy', cpu: 22, memory: 58 },
              { name: 'redis-cache', status: 'healthy', cpu: 5, memory: 19 },
              { name: 'nginx-ingress', status: 'healthy', cpu: 9, memory: 25 }
            ]).map((srv, idx) => (
              <div 
                key={idx}
                className={`p-4 rounded-2xl border transition ${
                  srv.status === 'degraded' || srv.status === 'critical'
                    ? 'bg-alarm-red/10 border-alarm-red/30'
                    : 'bg-stone-50 border-stone-200/80'
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-abstra-dark font-mono truncate">{srv.name || srv.key}</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${srv.status === 'degraded' || srv.status === 'critical' ? 'bg-alarm-red/20 text-alarm-red' : 'bg-signal-teal/15 text-signal-teal'}`}>
                    {srv.status}
                  </span>
                </div>
                <div className="space-y-1.5 text-[11px] font-mono text-abstra-muted">
                  <div className="flex justify-between">
                    <span>CPU:</span>
                    <span className="font-bold text-abstra-dark">{srv.cpu}%</span>
                  </div>
                  <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full ${srv.cpu > 80 ? 'bg-alarm-red' : 'bg-signal-teal'}`} style={{ width: `${Math.min(srv.cpu, 100)}%` }}></div>
                  </div>

                  <div className="flex justify-between pt-1">
                    <span>MEM:</span>
                    <span className="font-bold text-abstra-dark">{srv.memory}%</span>
                  </div>
                  <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full ${srv.memory > 80 ? 'bg-alarm-red' : 'bg-abstra-terracotta'}`} style={{ width: `${Math.min(srv.memory, 100)}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Log Stream Preview */}
          <div className="bg-canvas-card border border-stone-200 rounded-xl p-4">
            <span className="text-xs font-bold text-abstra-dark font-mono block mb-2">Cluster Event Stream</span>
            <div className="font-mono text-xs text-abstra-muted space-y-1 max-h-32 overflow-y-auto">
              {(sandboxState?.logs || [
                "[INFO] Cluster heartbeats operational. 6/6 pods Healthy.",
                "[INFO] RAG Vector store initialized with 4 runbooks."
              ]).slice(-5).map((log, lIdx) => (
                <div key={lIdx} className="truncate">{log}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
