import React from 'react';
import { 
  Activity, 
  AlertTriangle, 
  BookOpen, 
  CheckCircle, 
  Database, 
  Cpu, 
  FileText, 
  Settings, 
  Server, 
  ShieldAlert, 
  ChevronRight, 
  Loader2,
  Sparkles,
  ArrowUpRight,
  Zap,
  MonitorSpeaker,
  HardDrive,
  Wifi
} from 'lucide-react';

const generateSvgPath = (data, key, serviceKey) => {
  if (!data || data.length < 2) return '';
  const width = 600;
  const height = 160;
  const padding = 10;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  
  const points = data.map((d, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const val = d.services[serviceKey]?.[key] || 0;
    const y = padding + chartHeight - (val / 100) * chartHeight;
    return `${x},${y}`;
  });
  
  return `M ${points.join(' L ')}`;
};

const generateSvgAreaPath = (data, key, serviceKey) => {
  if (!data || data.length < 2) return '';
  const width = 600;
  const height = 160;
  const padding = 10;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  
  const points = data.map((d, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const val = d.services[serviceKey]?.[key] || 0;
    const y = padding + chartHeight - (val / 100) * chartHeight;
    return `${x},${y}`;
  });
  
  const firstX = padding;
  const lastX = padding + chartWidth;
  const baseY = padding + chartHeight;
  
  return `M ${firstX},${baseY} L ${points.join(' L ')} L ${lastX},${baseY} Z`;
};

export function DashboardPage({
  setActiveTab,
  incidents,
  simTypes,
  simulating,
  simDropdownOpen,
  setSimDropdownOpen,
  handleSimulate,
  handleResolve,
  setSelectedIncident,
  selectedGraphService,
  setSelectedGraphService,
  metricsHistory,
  systemInfo,
  operationMode
}) {
  const getActiveCount = () => Array.isArray(incidents) ? incidents.filter(i => i.status === 'active').length : 0;

  return (
    <div className="space-y-8">
      {/* Hero Banner Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* Left Hero Statement */}
        <div className="lg:col-span-8 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-abstra-sand/40 border border-abstra-sand/60 text-xs text-abstra-muted font-medium">
              <Sparkles className="h-3.5 w-3.5 text-abstra-terracotta" />
              <span>Real-time autonomous incident response</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-light text-abstra-dark tracking-tight leading-[1.1] font-display">
              Smarter ops with <br />
              <span className="font-semibold text-abstra-mauve">CloudOps AI</span>.
            </h1>
            <p className="text-abstra-muted text-base max-w-xl leading-relaxed">
              Intelligent cloud infrastructure telemetry powered by vector RAG indexing and local LLM diagnostics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button 
              onClick={() => setActiveTab('sandbox')}
              className="px-6 py-3 rounded-full bg-abstra-dark text-white text-xs font-semibold hover:bg-black transition flex items-center space-x-2 shadow-sm"
            >
              <span>Explore Sandbox</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>

            {/* Simulation Dropdown */}
            <div className="relative group">
              <button 
                onClick={() => setSimDropdownOpen(prev => !prev)}
                className="px-5 py-3 rounded-full bg-white/90 hover:bg-white text-abstra-dark text-xs font-medium border border-stone-200 transition flex items-center space-x-2 shadow-sm"
              >
                {simulating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-abstra-terracotta" />}
                <span>Simulate Incident</span>
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${simDropdownOpen ? '-rotate-90' : 'rotate-90'}`} />
              </button>
              <div className={`absolute left-0 mt-2 w-72 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden z-50 p-1 ${simDropdownOpen ? 'block' : 'hidden group-hover:block hover:block'}`}>
                {simTypes.map((sim) => (
                  <button
                    key={sim.key}
                    onClick={() => handleSimulate(sim.key)}
                    className="w-full text-left px-4 py-3 hover:bg-stone-50 rounded-xl transition flex flex-col space-y-0.5"
                  >
                    <span className="text-xs font-semibold text-abstra-dark">{sim.label}</span>
                    <span className="text-[10px] text-abstra-muted font-mono">{sim.service} • {sim.severity}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Status Panel */}
        <div className="lg:col-span-4 abstra-art-panel rounded-3xl p-7 text-white flex flex-col justify-between min-h-[260px] shadow-lg">
          <div className="flex justify-between items-start">
            <span className="text-xs uppercase font-semibold tracking-widest text-white/80">System Health</span>
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
          </div>

          <div className="my-6">
            <div className="text-xs text-white/70 uppercase tracking-wider">Operational Mode</div>
            <div className="text-2xl font-bold font-display mt-1 text-white">
              {getActiveCount() > 0 ? "DEGRADED STATE" : "ALL SYSTEMS OPTIMAL"}
            </div>
            <p className="text-xs text-white/80 mt-2 leading-normal">
              {getActiveCount() > 0 ? `${getActiveCount()} active incidents being analyzed by Ollama AI.` : "Zero active incidents detected across microservices."}
            </p>
          </div>

          <div className="flex justify-between items-end text-[11px] text-white/70 border-t border-white/20 pt-4 font-mono">
            <span>Ollama (llama3.2)</span>
            <span>/ 2026</span>
          </div>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white/80 rounded-2xl p-5 border border-stone-200/70 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex justify-between items-center text-abstra-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Status</span>
            <Server className="h-4 w-4 text-abstra-terracotta" />
          </div>
          <div>
            <span className={`text-2xl font-bold font-display ${getActiveCount() > 0 ? "text-ember-orange" : "text-signal-teal"}`}>
              {getActiveCount() > 0 ? "Degraded" : "Healthy"}
            </span>
          </div>
        </div>

        <div className="bg-white/80 rounded-2xl p-5 border border-stone-200/70 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex justify-between items-center text-abstra-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Active Alerts</span>
            <ShieldAlert className="h-4 w-4 text-alarm-red" />
          </div>
          <div>
            <span className="text-2xl font-bold font-display text-abstra-dark">{getActiveCount()} Pending</span>
          </div>
        </div>

        <div className="bg-white/80 rounded-2xl p-5 border border-stone-200/70 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex justify-between items-center text-abstra-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Log Entries</span>
            <Database className="h-4 w-4 text-abstra-mauve" />
          </div>
          <div>
            <span className="text-2xl font-bold font-display text-abstra-dark">{incidents.length} Logged</span>
          </div>
        </div>

        <div className="bg-white/80 rounded-2xl p-5 border border-stone-200/70 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex justify-between items-center text-abstra-muted">
            <span className="text-xs font-medium uppercase tracking-wider">AI Model</span>
            <Cpu className="h-4 w-4 text-signal-teal" />
          </div>
          <div>
            <span className="text-lg font-bold font-display text-abstra-dark">Ollama (llama3.2)</span>
          </div>
        </div>
      </div>

      {/* Active Alerts & Telemetry Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Alerts Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/90 border border-stone-200/80 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-semibold text-abstra-dark font-display">Active Incidents & AI Recommendations</h2>
                <p className="text-xs text-abstra-muted mt-0.5">Real-time infrastructure alerts queued for analysis.</p>
              </div>
              <button 
                onClick={() => setActiveTab('incidents')}
                className="text-xs font-medium text-abstra-mauve hover:text-abstra-dark flex items-center space-x-1"
              >
                <span>View all</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-4">
              {incidents.filter(i => i.status === 'active').length === 0 ? (
                <div className="bg-stone-50 border border-dashed border-stone-200 rounded-xl p-8 text-center text-abstra-muted text-xs font-mono">
                  No active incidents. Use the "Simulate Incident" button above to trigger one.
                </div>
              ) : (
                incidents.filter(i => i.status === 'active').map((incident) => (
                  <div 
                    key={incident.id} 
                    onClick={() => setSelectedIncident(incident)}
                    className="bg-canvas-card border border-stone-200/80 hover:border-abstra-terracotta/50 rounded-2xl p-5 transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:shadow-md"
                  >
                    <div className="flex items-start space-x-4">
                      <div className={`p-2.5 rounded-xl shrink-0 ${incident.severity === 'critical' ? 'bg-alarm-red/10 text-alarm-red' : 'bg-ember-orange/10 text-ember-orange'}`}>
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-bold text-abstra-dark">{incident.id}</span>
                          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-white text-abstra-muted border border-stone-200">{incident.service}</span>
                          <span className={`text-[9px] uppercase font-bold px-2.5 py-0.5 rounded-full ${incident.severity === 'critical' ? 'bg-alarm-red/15 text-alarm-red' : 'bg-ember-orange/15 text-ember-orange'}`}>
                            {incident.severity}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-abstra-dark mt-2 line-clamp-1">{incident.message}</p>
                        <span className="text-[10px] text-abstra-subtle mt-1 block font-mono">Triggered {incident.timestamp}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 w-full md:w-auto shrink-0" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => handleResolve(incident.id)}
                        className="px-3.5 py-1.5 border border-stone-300 hover:bg-stone-100 text-abstra-dark rounded-full text-xs font-medium transition"
                      >
                        Resolve
                      </button>
                      <button 
                        onClick={() => setSelectedIncident(incident)}
                        className="px-4 py-1.5 bg-abstra-dark text-white hover:bg-black rounded-full text-xs font-medium transition shadow-sm"
                      >
                        AI Report
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Telemetry Chart */}
          <div className="bg-white/90 border border-stone-200/80 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-abstra-dark font-display">Microservice Telemetry</h2>
                <p className="text-xs text-abstra-muted mt-0.5">Live CPU and memory resource utilization stream.</p>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-abstra-muted">Service:</span>
                <select
                  value={selectedGraphService}
                  onChange={(e) => setSelectedGraphService(e.target.value)}
                  className="bg-stone-100 border border-stone-200 text-abstra-dark font-mono text-xs rounded-lg p-2 focus:outline-none focus:border-abstra-mauve"
                >
                  <option value="payment-service">payment-service</option>
                  <option value="postgresql-db">PostgreSQL database</option>
                  <option value="auth-service">auth-service</option>
                  <option value="user-service">user-service</option>
                </select>
              </div>
            </div>
            
            {metricsHistory.length < 2 ? (
              <div className="h-44 border border-dashed border-stone-200 rounded-xl flex items-center justify-center text-xs text-abstra-muted font-mono">
                Collecting telemetry data points...
              </div>
            ) : (
              <div className="bg-canvas-card p-4 rounded-xl border border-stone-200/70">
                <svg viewBox="0 0 600 160" className="w-full h-40 overflow-visible">
                  <defs>
                    <linearGradient id="cpuGradLight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#C87A7A" stopOpacity="0.3"/>
                      <stop offset="100%" stopColor="#C87A7A" stopOpacity="0.0"/>
                    </linearGradient>
                    <linearGradient id="memGradLight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2E7D6F" stopOpacity="0.3"/>
                      <stop offset="100%" stopColor="#2E7D6F" stopOpacity="0.0"/>
                    </linearGradient>
                  </defs>
                  
                  <line x1="10" y1="10" x2="590" y2="10" stroke="#E2D5C3" strokeDasharray="3 3" />
                  <line x1="10" y1="50" x2="590" y2="50" stroke="#E2D5C3" strokeDasharray="3 3" />
                  <line x1="10" y1="90" x2="590" y2="90" stroke="#E2D5C3" strokeDasharray="3 3" />
                  <line x1="10" y1="130" x2="590" y2="130" stroke="#E2D5C3" strokeDasharray="3 3" />
                  
                  <path d={generateSvgAreaPath(metricsHistory, 'cpu', selectedGraphService)} fill="url(#cpuGradLight)" />
                  <path d={generateSvgAreaPath(metricsHistory, 'memory', selectedGraphService)} fill="url(#memGradLight)" />
                  
                  <path d={generateSvgPath(metricsHistory, 'cpu', selectedGraphService)} fill="none" stroke="#C87A7A" strokeWidth="2.5" strokeLinecap="round" />
                  <path d={generateSvgPath(metricsHistory, 'memory', selectedGraphService)} fill="none" stroke="#2E7D6F" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <div className="bg-white/90 border border-stone-200/80 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-abstra-dark flex items-center space-x-2 font-display">
                <BookOpen className="h-4 w-4 text-abstra-mauve" />
                <span>Indexed Runbooks</span>
              </h3>
              <button 
                onClick={() => setActiveTab('rag')}
                className="text-xs font-medium text-abstra-mauve hover:text-abstra-dark"
              >
                Query Vector
              </button>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/60 flex justify-between items-center">
                <span className="text-abstra-muted text-[11px]">database_pool_exhaustion</span>
                <span className="text-signal-teal font-semibold flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> Ready</span>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/60 flex justify-between items-center">
                <span className="text-abstra-muted text-[11px]">auth_latency_remediation</span>
                <span className="text-signal-teal font-semibold flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> Ready</span>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/60 flex justify-between items-center">
                <span className="text-abstra-muted text-[11px]">k8s_crashloopbackoff</span>
                <span className="text-signal-teal font-semibold flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> Ready</span>
              </div>
            </div>
          </div>

          {/* Host Hardware Specs Card */}
          {systemInfo && (
            <div className="bg-white/90 border border-stone-200/80 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-abstra-dark flex items-center space-x-2 font-display">
                  <MonitorSpeaker className="h-4 w-4 text-signal-teal" />
                  <span>Host Device</span>
                </h3>
                <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  operationMode === 'live'
                    ? 'bg-signal-teal/10 text-signal-teal border-signal-teal/30'
                    : 'bg-stone-100 text-abstra-muted border-stone-200'
                }`}>
                  {operationMode === 'live' ? 'LIVE' : 'DEMO'}
                </span>
              </div>
              <div className="space-y-2 text-[11px] font-mono">
                <div className="flex justify-between items-center py-1 border-b border-stone-100">
                  <span className="text-abstra-muted flex items-center gap-1.5"><Server className="h-3 w-3" />Host</span>
                  <span className="text-abstra-dark font-medium truncate max-w-[120px]" title={systemInfo.hostname}>{systemInfo.hostname}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-100">
                  <span className="text-abstra-muted">OS</span>
                  <span className="text-abstra-dark font-medium">{systemInfo.os}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-100">
                  <span className="text-abstra-muted flex items-center gap-1.5"><Cpu className="h-3 w-3" />CPU</span>
                  <span className="text-abstra-dark font-medium">{systemInfo.cpu_count} cores</span>
                </div>
                <div className="py-1 border-b border-stone-100 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-abstra-muted">RAM</span>
                    <span className="text-abstra-dark font-medium">{systemInfo.ram_gb} GB {systemInfo.ram_used_pct != null && <span className="text-abstra-muted">({systemInfo.ram_used_pct}%)</span>}</span>
                  </div>
                  {systemInfo.ram_used_pct != null && (
                    <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${systemInfo.ram_used_pct > 85 ? 'bg-alarm-red' : systemInfo.ram_used_pct > 65 ? 'bg-ember-orange' : 'bg-signal-teal'}`}
                        style={{ width: `${systemInfo.ram_used_pct}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="py-1 border-b border-stone-100 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-abstra-muted flex items-center gap-1.5"><HardDrive className="h-3 w-3" />Disk</span>
                    <span className="text-abstra-dark font-medium">{systemInfo.disk_total_gb} GB {systemInfo.disk_used_pct != null && <span className="text-abstra-muted">({systemInfo.disk_used_pct}%)</span>}</span>
                  </div>
                  {systemInfo.disk_used_pct != null && (
                    <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${systemInfo.disk_used_pct > 85 ? 'bg-alarm-red' : systemInfo.disk_used_pct > 65 ? 'bg-ember-orange' : 'bg-signal-teal'}`}
                        style={{ width: `${systemInfo.disk_used_pct}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-abstra-muted flex items-center gap-1.5"><Wifi className="h-3 w-3" />IP</span>
                  <span className="text-abstra-dark font-medium">{systemInfo.local_ip}</span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white/90 border border-stone-200/80 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-abstra-dark flex items-center space-x-2 font-display">
                <FileText className="h-4 w-4 text-abstra-terracotta" />
                <span>Generated Post-Mortems</span>
              </h3>
              <button 
                onClick={() => setActiveTab('reports')}
                className="text-xs font-medium text-abstra-mauve hover:text-abstra-dark"
              >
                View all
              </button>
            </div>
            <div className="space-y-2">
              {incidents.filter(i => i.ai_analysis).length === 0 ? (
                <div className="text-center py-6 text-xs text-abstra-muted font-mono">
                  No reports generated yet.
                </div>
              ) : (
                incidents.filter(i => i.ai_analysis).slice(0, 3).map((incident) => (
                  <div 
                    key={incident.id} 
                    onClick={() => { setSelectedIncident(incident); setActiveTab('reports'); }}
                    className="flex justify-between items-center text-xs p-2.5 bg-stone-50 hover:bg-stone-100 rounded-xl border border-stone-200/60 cursor-pointer transition font-mono"
                  >
                    <div>
                      <span className="font-bold text-abstra-dark mr-2">{incident.id}</span>
                      <span className="text-abstra-muted">{incident.service}</span>
                    </div>
                    <span className="text-abstra-subtle text-[10px]">{incident.timestamp.split('T')[0]}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
