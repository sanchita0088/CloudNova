import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  BookOpen, 
  CheckCircle, 
  Database, 
  Cpu, 
  FileText, 
  Search, 
  Settings, 
  Server, 
  ShieldAlert, 
  ChevronRight, 
  RefreshCw,
  Loader2,
  X,
  CheckSquare,
  Square,
  Sparkles,
  ArrowUpRight,
  Layers,
  Zap,
  MonitorSpeaker,
  HardDrive,
  Wifi,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { api } from './services/api';
import RecoveryModal from './components/RecoveryModal';

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

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [simTypes, setSimTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simDropdownOpen, setSimDropdownOpen] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestStatus, setIngestStatus] = useState(null);
  
  // Sandbox infrastructure and telemetry state
  const [sandboxState, setSandboxState] = useState(null);
  const [metricsHistory, setMetricsHistory] = useState([]);
  const [selectedGraphService, setSelectedGraphService] = useState('payment-service');
  const [sandboxLogsFilter, setSandboxLogsFilter] = useState('all');
  const [recovering, setRecovering] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [demoActive, setDemoActive] = useState(false);

  // Live/Demo mode + system hardware info
  const [operationMode, setOperationMode] = useState('demo'); // 'live' | 'demo'
  const [systemInfo, setSystemInfo] = useState(null);
  const [modeToggling, setModeToggling] = useState(false);

  // AI analysis overlay / modal state
  const [analyzingId, setAnalyzingId] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [completedSteps, setCompletedSteps] = useState({});

  // Fetch incidents
  const fetchIncidents = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const list = await api.incidents.list();
      setIncidents(Array.isArray(list) ? list : (list?.incidents || []));
    } catch (err) {
      console.error("Failed to fetch incidents:", err);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const fetchSimulationTypes = async () => {
    try {
      const data = await api.incidents.types();
      const typesList = Array.isArray(data) ? data : (data?.types || []);
      setSimTypes(typesList);
    } catch (err) {
      console.error("Failed to fetch simulation types:", err);
    }
  };

  // Fetch system info from backend (hardware specs only)
  const fetchSystemInfo = async () => {
    try {
      const res = await api.system.info();
      const raw = res.system_info || res;
      // Normalize nested structure to flat UI-friendly shape
      setSystemInfo({
        hostname: raw.hostname,
        os: raw.os || raw.platform,
        cpu_count: raw.cpu_cores_logical || raw.cpu_count || '—',
        ram_gb: raw.memory?.total_gb ?? raw.ram_gb ?? '—',
        disk_total_gb: raw.disk?.total_gb ?? raw.disk_total_gb ?? '—',
        local_ip: raw.ip || raw.local_ip || '—',
        ram_used_pct: raw.memory?.used_pct,
        disk_used_pct: raw.disk?.used_pct,
      });
    } catch (err) {
      console.error('Failed to fetch system info:', err);
    }
  };

  const fetchMode = async () => {
    try {
      const data = await api.system.getMode();
      const targetMode = data.mode || 'demo';
      console.log(`[MODE_TRACE_FRONTEND] timestamp=${new Date().toISOString()} | function=fetchMode | setting operationMode to: ${targetMode}`);
      setOperationMode(targetMode);
    } catch (err) {
      console.error('Failed to fetch mode:', err);
    }
  };

  const handleModeToggle = async () => {
    const nextMode = operationMode === 'demo' ? 'live' : 'demo';
    console.log(`[MODE_TRACE_FRONTEND] timestamp=${new Date().toISOString()} | function=handleModeToggle | prevMode=${operationMode} | nextMode=${nextMode}`);
    setModeToggling(true);
    try {
      await api.system.setMode(nextMode);
      setOperationMode(nextMode);
      // Immediately clear demo UI state when switching to live so the
      // button label resets and the demo loop doesn't appear still running.
      if (nextMode === 'live') {
        setDemoActive(false);
      }
      await fetchSandboxState();
    } catch (err) {
      console.error('Failed to switch mode:', err);
    } finally {
      setModeToggling(false);
    }
  };

  // Fetch sandbox cluster status
  const fetchSandboxState = async () => {
    try {
      const state = await api.sandbox.getState();
      setSandboxState(state);

      // Sync the mode displayed in the UI with what the backend database reports.
      // Since the backend now persists this state in PostgreSQL, this is fully
      // synchronized and prevents any discrepancy between replicas.
      if (state && state.mode) {
        setOperationMode(state.mode);
      }

      if (state && state.active_simulation) {
        setDemoActive(state.active_simulation.demo_mode);
      } else {
        setDemoActive(false);
      }
      
      if (state && state.services) {
        setMetricsHistory(prev => {
          const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const newEntry = {
            time: timeLabel,
            services: state.services.reduce((acc, s) => {
              acc[s.key] = { cpu: s.cpu, memory: s.memory, disk: s.disk, network: s.network };
              return acc;
            }, {})
          };
          const updated = [...prev, newEntry];
          if (updated.length > 20) {
            updated.shift();
          }
          return updated;
        });
      }
    } catch (err) {
      console.error("Failed to fetch sandbox state:", err);
    }
  };


  useEffect(() => {
    fetchIncidents(true);
    fetchSimulationTypes();
    fetchSandboxState();
    fetchSystemInfo();
    fetchMode();

    const interval = setInterval(() => {
      fetchIncidents(false);
      fetchSandboxState();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleSimulate = async (typeKey) => {
    setSimDropdownOpen(false);
    setSimulating(true);
    try {
      await api.incidents.simulate(typeKey);
      await fetchIncidents(false);
      await fetchSandboxState();
    } catch (err) {
      console.error("Simulation failed:", err);
    } finally {
      setSimulating(false);
    }
  };

  const handleSandboxSimulate = async (scenarioKey, demoMode = false) => {
    setSimulating(true);
    try {
      await api.sandbox.simulate(scenarioKey, demoMode);
      await fetchSandboxState();
      await fetchIncidents(false);
    } catch (err) {
      console.error("Sandbox simulation failed:", err);
    } finally {
      setSimulating(false);
    }
  };

  const handleRecover = async () => {
    // Fire the backend recovery call immediately (it starts the 6-second
    // backend animation), then show the frontend recovery pipeline modal.
    setRecovering(true);
    try {
      await api.sandbox.recover();
    } catch (err) {
      console.error('Recovery failed:', err);
      setRecovering(false);
      return;
    }
    // Open the visual pipeline — it will call onComplete when done
    setShowRecoveryModal(true);
  };

  const handleRecoveryComplete = async () => {
    setShowRecoveryModal(false);
    setRecovering(false);
    setDemoActive(false);
    await fetchSandboxState();
    await fetchIncidents(false);
  };

  const handleResolve = async (id) => {
    try {
      await api.incidents.resolve(id);
      await fetchIncidents(false);
      await fetchSandboxState();
    } catch (err) {
      console.error("Failed to resolve incident:", err);
    }
  };

  const handleTriggerAnalysis = async (id) => {
    setAnalyzingId(id);
    try {
      const updatedIncident = await api.analysis.trigger(id);
      setSelectedIncident(updatedIncident);
      await fetchIncidents(false);
    } catch (err) {
      console.error("Failed to run AI analysis:", err);
    } finally {
      setAnalyzingId(null);
    }
  };

  const toggleStep = (stepIdx) => {
    if (!selectedIncident) return;
    setCompletedSteps(prev => {
      const current = prev[selectedIncident.id] || {};
      return {
        ...prev,
        [selectedIncident.id]: {
          ...current,
          [stepIdx]: !current[stepIdx]
        }
      };
    });
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await api.rag.search(searchQuery);
      setSearchResults(Array.isArray(res) ? res : res.results || []);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleIngest = async () => {
    setIngesting(true);
    setIngestStatus(null);
    try {
      const res = await api.rag.ingest();
      setIngestStatus({ status: 'success', message: res.message });
    } catch (err) {
      setIngestStatus({ status: 'error', message: 'Failed to reload runbooks.' });
    } finally {
      setIngesting(false);
    }
  };

  const getActiveCount = () => Array.isArray(incidents) ? incidents.filter(i => i.status === 'active').length : 0;

  return (
    <div className="min-h-screen text-abstra-dark font-sans selection:bg-abstra-terracotta/20 selection:text-abstra-mauve">
      
      {/* Top Floating Glass Header Navigation */}
      <header className="sticky top-4 z-40 max-w-7xl mx-auto px-4 sm:px-6 mb-6">
        <div className="bg-white/80 backdrop-blur-xl border border-white/90 rounded-full px-6 py-3.5 shadow-abstra-glass flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-abstra-dark text-white flex items-center justify-center font-bold text-sm shadow-md">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold text-lg text-abstra-dark tracking-tight font-display">
                Cloud<span className="text-abstra-terracotta">Ops AI</span>
              </span>
              <span className="ml-2 text-[10px] uppercase font-medium px-2.5 py-0.5 rounded-full bg-abstra-sand/50 text-abstra-muted">
                CloudOps AI
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden lg:flex items-center space-x-1 bg-stone-100/70 p-1 rounded-full border border-stone-200/60">
            {[
              { id: 'dashboard', label: 'Overview', icon: Activity },
              { id: 'sandbox', label: 'Sandbox', icon: Server },
              { id: 'incidents', label: 'Alerts', icon: ShieldAlert, badge: getActiveCount() },
              { id: 'rag', label: 'Knowledge', icon: BookOpen },
              { id: 'reports', label: 'Post-Mortems', icon: FileText }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-medium transition ${
                    isActive 
                      ? 'bg-abstra-dark text-white shadow-sm' 
                      : 'text-abstra-muted hover:text-abstra-dark hover:bg-white/60'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-abstra-terracotta text-white' : 'bg-alarm-red/15 text-alarm-red font-semibold'}`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Action Header Items */}
          <div className="flex items-center space-x-3">
            {/* Live / Demo Mode Toggle */}
            <button
              id="mode-toggle-btn"
              onClick={handleModeToggle}
              disabled={modeToggling}
              title={operationMode === 'live' ? 'Switch to Demo Mode' : 'Switch to Live Mode'}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-full text-xs font-semibold border transition shadow-sm ${
                operationMode === 'live'
                  ? 'bg-signal-teal/10 border-signal-teal/40 text-signal-teal hover:bg-signal-teal/20'
                  : 'bg-stone-100 border-stone-200 text-abstra-muted hover:bg-stone-200'
              }`}
            >
              {modeToggling
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : operationMode === 'live'
                  ? <ToggleRight className="h-4 w-4" />
                  : <ToggleLeft className="h-4 w-4" />
              }
              <span className="hidden sm:inline">{operationMode === 'live' ? 'Live' : 'Demo'}</span>
            </button>

            <button 
              onClick={() => fetchIncidents(true)}
              className="p-2.5 rounded-full bg-stone-100 hover:bg-stone-200/80 text-abstra-dark transition border border-stone-200/70"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="hidden sm:flex items-center space-x-2 pl-2 border-l border-stone-200">
              <div className="w-8 h-8 rounded-full bg-abstra-mauve/15 text-abstra-mauve flex items-center justify-center font-bold text-xs">
                CA
              </div>
              <span className="text-xs font-medium text-abstra-dark hidden md:block">Cloud Admin</span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex lg:hidden overflow-x-auto gap-2 mt-3 pb-1 no-scrollbar">
          {[
            { id: 'dashboard', label: 'Overview' },
            { id: 'sandbox', label: 'Sandbox' },
            { id: 'incidents', label: 'Alerts' },
            { id: 'rag', label: 'Knowledge' },
            { id: 'reports', label: 'Reports' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-xs font-medium shrink-0 ${activeTab === tab.id ? 'bg-abstra-dark text-white' : 'bg-white/80 text-abstra-muted'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Workspace Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mb-12">
        <div className="abstra-card p-6 md:p-8 min-h-[750px]">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-40 space-y-4">
              <Loader2 className="h-8 w-8 text-abstra-mauve animate-spin" />
              <span className="text-xs text-abstra-muted font-medium tracking-wide">Loading cloud telemetry...</span>
            </div>
          ) : (
            <>
              {/* DASHBOARD TAB VIEW */}
              {activeTab === 'dashboard' && (
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

                    {/* Right Abstract Art / Quick Status Banner */}
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

                    {/* Right Column: Knowledge Base & Reports Overview */}
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
              )}

              {/* ALERT MANAGER TAB VIEW */}
              {activeTab === 'incidents' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-stone-200 pb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-abstra-dark font-display">Alert Manager</h2>
                      <p className="text-abstra-muted text-xs mt-1">Full history of infrastructure incidents and automated alert triggers.</p>
                    </div>
                  </div>

                  <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-stone-200 bg-stone-50 text-abstra-muted font-semibold text-xs uppercase tracking-wider">
                          <th className="px-6 py-4">ID</th>
                          <th className="px-6 py-4">Service</th>
                          <th className="px-6 py-4">Severity</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Message</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 font-mono text-xs">
                        {incidents.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="text-center py-16 text-abstra-muted">
                              No log history found. Use simulation to generate alerts.
                            </td>
                          </tr>
                        ) : (
                          incidents.map((incident) => (
                            <tr 
                              key={incident.id} 
                              onClick={() => setSelectedIncident(incident)}
                              className="hover:bg-stone-50 transition cursor-pointer"
                            >
                              <td className="px-6 py-4 font-bold text-abstra-dark">{incident.id}</td>
                              <td className="px-6 py-4 text-abstra-dark font-sans font-medium">{incident.service}</td>
                              <td className="px-6 py-4">
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${incident.severity === 'critical' ? 'bg-alarm-red/15 text-alarm-red' : 'bg-ember-orange/15 text-ember-orange'}`}>
                                  {incident.severity}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${incident.status === 'active' ? 'bg-signal-teal/15 text-signal-teal' : 'bg-stone-200 text-abstra-muted'}`}>
                                  {incident.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 max-w-xs truncate text-abstra-muted">{incident.message}</td>
                              <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                                <div className="flex justify-end space-x-2">
                                  {incident.status === 'active' && (
                                    <button 
                                      onClick={() => handleResolve(incident.id)}
                                      className="px-3 py-1 border border-stone-300 hover:bg-stone-100 text-abstra-dark rounded-full text-xs transition font-sans font-medium"
                                    >
                                      Resolve
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => setSelectedIncident(incident)}
                                    className="px-3.5 py-1 bg-abstra-dark text-white rounded-full text-xs font-sans font-medium hover:bg-black transition"
                                  >
                                    Analyze
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* RAG KNOWLEDGE BASE TAB VIEW */}
              {activeTab === 'rag' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-abstra-dark font-display">RAG Knowledge Base</h2>
                      <p className="text-abstra-muted text-xs mt-1">Query runbooks and SOP documents indexed inside ChromaDB vector store.</p>
                    </div>
                    <button 
                      onClick={handleIngest}
                      disabled={ingesting}
                      className="px-4 py-2 border border-stone-300 hover:bg-white text-abstra-dark rounded-full text-xs font-medium transition disabled:opacity-50 flex items-center space-x-2 bg-stone-100"
                    >
                      {ingesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      <span>Reload Runbook Index</span>
                    </button>
                  </div>

                  {ingestStatus && (
                    <div className={`p-4 rounded-2xl border text-xs font-mono ${ingestStatus.status === 'success' ? 'bg-signal-teal/10 text-signal-teal border-signal-teal/20' : 'bg-ember-orange/10 text-ember-orange border-ember-orange/20'}`}>
                      {ingestStatus.message}
                    </div>
                  )}

                  <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-6 shadow-sm">
                    <form onSubmit={handleSearch} className="flex gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-4 top-3.5 h-4 w-4 text-abstra-muted" />
                        <input 
                          type="text" 
                          placeholder="Search runbooks (e.g. 'database exhausted', 'bcrypt rounds', 'CrashLoopBackOff')..." 
                          className="w-full pl-11 pr-4 py-3 bg-canvas-card border border-stone-200 rounded-full text-abstra-dark focus:outline-none focus:border-abstra-mauve text-xs transition"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <button 
                        type="submit"
                        disabled={searchLoading}
                        className="px-6 py-3 bg-abstra-dark text-white rounded-full text-xs font-medium hover:bg-black transition flex items-center space-x-2 disabled:opacity-50"
                      >
                        {searchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        <span>Search</span>
                      </button>
                    </form>

                    <div className="space-y-4">
                      {searchResults.length === 0 ? (
                        <div className="border border-dashed border-stone-200 rounded-2xl p-12 text-center text-abstra-muted text-xs font-mono">
                          Query runbooks using search terms above to fetch semantic vector matches from local index.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {searchResults.map((result, idx) => (
                            <div key={idx} className="bg-stone-50 border border-stone-200/80 rounded-2xl p-5 space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-abstra-dark font-mono">{result.metadata.source}</span>
                                <span className="text-[10px] font-medium px-2.5 py-0.5 bg-abstra-mauve/15 text-abstra-mauve rounded-full font-mono">
                                  Vector Match
                                </span>
                              </div>
                              <pre className="text-xs text-abstra-dark leading-relaxed font-mono whitespace-pre-wrap max-h-48 overflow-y-auto bg-white p-3 rounded-xl border border-stone-200/60">
                                {result.content}
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* INCIDENT REPORTS TAB VIEW */}
              {activeTab === 'reports' && (
                <div className="space-y-6">
                  <div className="border-b border-stone-200 pb-4">
                    <h2 className="text-2xl font-bold text-abstra-dark font-display">Incident Reports</h2>
                    <p className="text-abstra-muted text-xs mt-1">Review post-mortem documents, root causes, and remediation actions generated by Ollama LLM.</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: List */}
                    <div className="bg-white border border-stone-200 rounded-2xl p-4 h-[500px] overflow-y-auto space-y-2">
                      <span className="text-xs font-bold text-abstra-dark px-2 block mb-3 uppercase tracking-wider font-display">Analyzed Incidents</span>
                      {incidents.filter(i => i.ai_analysis).length === 0 ? (
                        <div className="text-center py-12 text-xs text-abstra-muted font-mono">
                          No post-mortems generated yet. Trigger AI analysis on active incidents.
                        </div>
                      ) : (
                        incidents.filter(i => i.ai_analysis).map((incident) => (
                          <button
                            key={incident.id}
                            onClick={() => setSelectedIncident(incident)}
                            className={`w-full text-left p-3.5 rounded-xl border transition flex flex-col space-y-1 ${
                              selectedIncident?.id === incident.id 
                                ? 'bg-abstra-sand/40 border-abstra-terracotta/50 font-bold' 
                                : 'bg-stone-50 border-stone-200/60 hover:bg-stone-100 text-abstra-dark'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-mono text-xs font-bold">{incident.id}</span>
                              <span className="text-[10px] text-abstra-muted font-mono">{incident.timestamp.split('T')[0]}</span>
                            </div>
                            <span className="text-xs font-medium text-abstra-dark truncate">{incident.service}</span>
                          </button>
                        ))
                      )}
                    </div>

                    {/* Right: Selected details */}
                    <div className="lg:col-span-2 bg-white border border-stone-200 rounded-2xl p-6 h-[500px] overflow-y-auto flex flex-col">
                      {selectedIncident && selectedIncident.ai_analysis ? (
                        <div className="space-y-6">
                          <div className="border-b border-stone-200 pb-4 flex justify-between items-start">
                            <div>
                              <h3 className="text-lg font-bold text-abstra-dark font-display">{selectedIncident.service} Post-Mortem</h3>
                              <span className="text-xs text-abstra-muted font-mono">ID: {selectedIncident.id} | Timestamp: {selectedIncident.timestamp}</span>
                            </div>
                            <span className="text-xs font-semibold px-3 py-1 bg-signal-teal/15 text-signal-teal rounded-full font-mono">
                              Confidence: {Math.round(selectedIncident.ai_analysis.confidence_score * 100)}%
                            </span>
                          </div>

                          <div className="space-y-2">
                            <span className="text-xs font-bold text-abstra-dark uppercase tracking-wider font-display">Probable Root Cause</span>
                            <div className="bg-canvas-card border border-stone-200 rounded-xl p-4 text-xs font-mono text-abstra-dark">
                              {selectedIncident.ai_analysis.root_cause}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <span className="text-xs font-bold text-abstra-dark uppercase tracking-wider font-display font-semibold">Full Incident Report</span>
                            <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 text-abstra-dark text-xs font-mono whitespace-pre-wrap leading-relaxed">
                              {selectedIncident.ai_analysis.incident_report}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center text-abstra-muted font-mono">
                          <FileText className="h-8 w-8 text-abstra-mauve mb-3" />
                          <span className="text-xs">Select an incident report from the list to view post-mortem details.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* INFRASTRUCTURE SANDBOX TAB VIEW */}
              {activeTab === 'sandbox' && (
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
              )}
            </>
          )}
        </div>
      </main>

      {/* AI ANALYSIS OVERLAY MODAL */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-md">
          <div className="bg-[#F7F6F3] border border-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-stone-200 flex justify-between items-start bg-white/70">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-abstra-dark">{selectedIncident.id}</span>
                  <span className="text-xs font-medium px-2.5 py-0.5 bg-stone-100 text-abstra-muted rounded-full">{selectedIncident.service}</span>
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${selectedIncident.severity === 'critical' ? 'bg-alarm-red/15 text-alarm-red' : 'bg-ember-orange/15 text-ember-orange'}`}>
                    {selectedIncident.severity}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-abstra-dark mt-2 font-display">AI Root Cause & Incident Recovery</h2>
              </div>
              <button 
                onClick={() => setSelectedIncident(null)}
                className="p-2 rounded-full hover:bg-stone-200/80 text-abstra-muted transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="space-y-1">
                <span className="text-xs font-bold text-abstra-muted font-display uppercase tracking-wider">Alert Exception Log</span>
                <pre className="p-4 bg-alarm-red/10 border border-alarm-red/20 rounded-2xl text-xs text-alarm-red font-mono whitespace-pre-wrap leading-relaxed">
                  {selectedIncident.message}
                </pre>
              </div>

              {!selectedIncident.ai_analysis ? (
                <div className="py-12 border border-dashed border-stone-300 rounded-2xl flex flex-col items-center justify-center text-center space-y-4 bg-white/50">
                  <Cpu className="h-8 w-8 text-abstra-mauve animate-pulse" />
                  <div>
                    <h3 className="text-sm font-bold text-abstra-dark font-display">RAG Context & LLM Diagnostics Pending</h3>
                    <p className="text-xs text-abstra-muted mt-1 max-w-sm font-mono">
                      Retrieves relevant runbooks from ChromaDB and uses the local Ollama model to generate SRE recommendations.
                    </p>
                  </div>
                  <button
                    onClick={() => handleTriggerAnalysis(selectedIncident.id)}
                    disabled={analyzingId !== null}
                    className="px-6 py-3 bg-abstra-dark text-white hover:bg-black rounded-full text-xs font-medium transition flex items-center space-x-2 disabled:opacity-50 shadow-sm"
                  >
                    {analyzingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}
                    <span>{analyzingId ? "Analyzing..." : "Analyze Alert with AI"}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Left Column: Root cause & checklist */}
                  <div className="space-y-6">
                    <div className="space-y-2 bg-white border border-stone-200 p-5 rounded-2xl shadow-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-abstra-dark font-display uppercase tracking-wider">Probable Root Cause</span>
                        <span className="text-xs font-semibold px-2.5 py-0.5 bg-signal-teal/15 text-signal-teal rounded-full font-mono">
                          {Math.round(selectedIncident.ai_analysis.confidence_score * 100)}% Match
                        </span>
                      </div>
                      <p className="text-xs text-abstra-dark mt-2 font-mono leading-relaxed">
                        {selectedIncident.ai_analysis.root_cause}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <span className="text-xs font-bold text-abstra-dark uppercase tracking-wider font-display">SRE Recovery Actions Checklist</span>
                      <div className="space-y-2 font-mono">
                        {selectedIncident.ai_analysis.recovery_steps.map((step, idx) => (
                          <div 
                            key={idx}
                            onClick={() => toggleStep(idx)}
                            className={`flex items-start space-x-3 p-3.5 rounded-xl border cursor-pointer transition ${completedSteps[selectedIncident.id]?.[idx] ? 'bg-signal-teal/10 border-signal-teal/20 text-abstra-muted' : 'bg-white border-stone-200 hover:border-abstra-mauve text-abstra-dark'}`}
                          >
                            {completedSteps[selectedIncident.id]?.[idx] ? (
                              <CheckSquare className="h-4 w-4 text-signal-teal shrink-0 mt-0.5" />
                            ) : (
                              <Square className="h-4 w-4 text-stone-400 shrink-0 mt-0.5" />
                            )}
                            <span className={`text-xs ${completedSteps[selectedIncident.id]?.[idx] ? 'line-through text-abstra-muted' : ''}`}>
                              {typeof step === 'string' ? step : step.title || step.command}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Markdown Report */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-abstra-dark font-display">AI Incident Post-Mortem</span>
                    <div className="bg-white p-5 rounded-2xl border border-stone-200 text-abstra-dark text-xs whitespace-pre-wrap leading-relaxed max-h-[360px] overflow-y-auto font-mono">
                      {selectedIncident.ai_analysis.incident_report}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-stone-200 flex justify-between items-center bg-white/70">
              <span className="text-[11px] text-abstra-muted font-mono">Click outside or close to return.</span>
              <div className="flex space-x-3">
                <button 
                  onClick={() => setSelectedIncident(null)}
                  className="px-5 py-2 border border-stone-300 hover:bg-stone-100 text-abstra-dark rounded-full text-xs font-medium transition"
                >
                  Close
                </button>
                {selectedIncident.status === 'active' && (
                  <button 
                    onClick={() => { handleResolve(selectedIncident.id); setSelectedIncident(null); }}
                    className="px-6 py-2 bg-signal-teal text-white hover:bg-signal-teal/90 rounded-full text-xs font-medium transition shadow-sm"
                  >
                    Resolve Incident
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recovery Pipeline Modal — rendered as a portal over everything */}
      {showRecoveryModal && (
        <RecoveryModal
          sandboxServices={sandboxState?.services || []}
          onComplete={handleRecoveryComplete}
        />
      )}
    </div>
  );
}

export default App;
