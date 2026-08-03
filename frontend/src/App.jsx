import React from 'react';
import { 
  Loader2, 
  X, 
  Cpu, 
  CheckSquare, 
  Square 
} from 'lucide-react';
import { api } from './services/api';
import { useSandboxData } from './hooks/useSandboxData';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { RAGPage } from './pages/RAGPage';
import { ReportsPage } from './pages/ReportsPage';
import { SandboxPage } from './pages/SandboxPage';
import RecoveryModal from './components/RecoveryModal';

function App() {
  const data = useSandboxData();

  const handleResolve = async (id) => {
    try {
      await api.incidents.resolve(id);
      data.fetchIncidents(false);
      data.fetchSandboxState();
    } catch (err) {
      console.error("Resolve failed:", err);
    }
  };

  const handleTriggerAnalysis = async (id) => {
    data.setAnalyzingId(id);
    try {
      const updated = await api.incidents.analyze(id);
      data.setSelectedIncident(updated);
      data.fetchIncidents(false);
    } catch (err) {
      console.error("AI Analysis failed:", err);
    } finally {
      data.setAnalyzingId(null);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!data.searchQuery.trim()) return;
    data.setSearchLoading(true);
    try {
      const res = await api.rag.search(data.searchQuery);
      data.setSearchResults(Array.isArray(res) ? res : res.results || []);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      data.setSearchLoading(false);
    }
  };

  const handleIngest = async () => {
    data.setIngesting(true);
    data.setIngestStatus(null);
    try {
      const res = await api.rag.ingest();
      data.setIngestStatus({ status: 'success', message: res.message });
    } catch (err) {
      data.setIngestStatus({ status: 'error', message: 'Failed to reload runbooks.' });
    } finally {
      data.setIngesting(false);
    }
  };

  const handleSandboxSimulate = async (scenarioKey, isDemo = false) => {
    data.setSimulating(true);
    try {
      await api.sandbox.simulate(scenarioKey, isDemo);
      await data.fetchSandboxState();
    } catch (err) {
      console.error("Sandbox simulation error:", err);
    } finally {
      data.setSimulating(false);
    }
  };

  const handleRecover = async () => {
    data.setRecovering(true);
    try {
      await api.sandbox.recover();
      data.setShowRecoveryModal(true);
      await data.fetchSandboxState();
    } catch (err) {
      console.error("Recovery failed:", err);
    } finally {
      data.setRecovering(false);
    }
  };

  const handleRecoveryComplete = async () => {
    data.setShowRecoveryModal(false);
    await data.fetchSandboxState();
    await data.fetchIncidents(false);
  };

  const toggleStep = (stepIdx) => {
    if (!data.selectedIncident) return;
    const incId = data.selectedIncident.id;
    data.setCompletedSteps(prev => ({
      ...prev,
      [incId]: {
        ...(prev[incId] || {}),
        [stepIdx]: !prev[incId]?.[stepIdx]
      }
    }));
  };

  return (
    <div className="min-h-screen text-abstra-dark font-sans selection:bg-abstra-terracotta/20 selection:text-abstra-mauve">
      
      {/* Top Floating Glass Header */}
      <Header
        activeTab={data.activeTab}
        setActiveTab={data.setActiveTab}
        incidents={data.incidents}
        operationMode={data.operationMode}
        modeToggling={data.modeToggling}
        handleModeToggle={data.handleModeToggle}
        loading={data.loading}
        fetchIncidents={data.fetchIncidents}
      />

      {/* Main Workspace Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mb-12">
        <div className="abstra-card p-6 md:p-8 min-h-[750px]">
          
          {data.loading ? (
            <div className="flex flex-col items-center justify-center py-40 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-abstra-terracotta" />
              <span className="text-xs font-mono text-abstra-muted">Loading CloudOps AI dashboard...</span>
            </div>
          ) : (
            <>
              {data.activeTab === 'dashboard' && (
                <DashboardPage
                  setActiveTab={data.setActiveTab}
                  incidents={data.incidents}
                  simTypes={data.simTypes}
                  simulating={data.simulating}
                  simDropdownOpen={data.simDropdownOpen}
                  setSimDropdownOpen={data.setSimDropdownOpen}
                  handleSimulate={data.handleSimulate}
                  handleResolve={handleResolve}
                  setSelectedIncident={data.setSelectedIncident}
                  selectedGraphService={data.selectedGraphService}
                  setSelectedGraphService={data.setSelectedGraphService}
                  metricsHistory={data.metricsHistory}
                  systemInfo={data.systemInfo}
                  operationMode={data.operationMode}
                />
              )}

              {data.activeTab === 'incidents' && (
                <IncidentsPage
                  incidents={data.incidents}
                  setSelectedIncident={data.setSelectedIncident}
                  handleResolve={handleResolve}
                />
              )}

              {data.activeTab === 'rag' && (
                <RAGPage
                  handleIngest={handleIngest}
                  ingesting={data.ingesting}
                  ingestStatus={data.ingestStatus}
                  handleSearch={handleSearch}
                  searchQuery={data.searchQuery}
                  setSearchQuery={data.setSearchQuery}
                  searchLoading={data.searchLoading}
                  searchResults={data.searchResults}
                />
              )}

              {data.activeTab === 'reports' && (
                <ReportsPage
                  incidents={data.incidents}
                  selectedIncident={data.selectedIncident}
                  setSelectedIncident={data.setSelectedIncident}
                />
              )}

              {data.activeTab === 'sandbox' && (
                <SandboxPage
                  sandboxState={data.sandboxState}
                  simulating={data.simulating}
                  demoActive={data.demoActive}
                  handleSandboxSimulate={handleSandboxSimulate}
                  handleRecover={handleRecover}
                  recovering={data.recovering}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* AI ANALYSIS OVERLAY MODAL */}
      {data.selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-md">
          <div className="bg-[#F7F6F3] border border-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-stone-200 flex justify-between items-start bg-white/70">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-abstra-dark">{data.selectedIncident.id}</span>
                  <span className="text-xs font-medium px-2.5 py-0.5 bg-stone-100 text-abstra-muted rounded-full">{data.selectedIncident.service}</span>
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${data.selectedIncident.severity === 'critical' ? 'bg-alarm-red/15 text-alarm-red' : 'bg-ember-orange/15 text-ember-orange'}`}>
                    {data.selectedIncident.severity}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-abstra-dark mt-2 font-display">AI Root Cause & Incident Recovery</h2>
              </div>
              <button 
                onClick={() => data.setSelectedIncident(null)}
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
                  {data.selectedIncident.message}
                </pre>
              </div>

              {!data.selectedIncident.ai_analysis ? (
                <div className="py-12 border border-dashed border-stone-300 rounded-2xl flex flex-col items-center justify-center text-center space-y-4 bg-white/50">
                  <Cpu className="h-8 w-8 text-abstra-mauve animate-pulse" />
                  <div>
                    <h3 className="text-sm font-bold text-abstra-dark font-display">RAG Context & LLM Diagnostics Pending</h3>
                    <p className="text-xs text-abstra-muted mt-1 max-w-sm font-mono">
                      Retrieves relevant runbooks from ChromaDB and uses the local Ollama model to generate SRE recommendations.
                    </p>
                  </div>
                  <button
                    onClick={() => handleTriggerAnalysis(data.selectedIncident.id)}
                    disabled={data.analyzingId !== null}
                    className="px-6 py-3 bg-abstra-dark text-white hover:bg-black rounded-full text-xs font-medium transition flex items-center space-x-2 disabled:opacity-50 shadow-sm"
                  >
                    {data.analyzingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}
                    <span>{data.analyzingId ? "Analyzing..." : "Analyze Alert with AI"}</span>
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
                          {Math.round(data.selectedIncident.ai_analysis.confidence_score * 100)}% Match
                        </span>
                      </div>
                      <p className="text-xs text-abstra-dark mt-2 font-mono leading-relaxed">
                        {data.selectedIncident.ai_analysis.root_cause}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <span className="text-xs font-bold text-abstra-dark uppercase tracking-wider font-display">SRE Recovery Actions Checklist</span>
                      <div className="space-y-2 font-mono">
                        {data.selectedIncident.ai_analysis.recovery_steps.map((step, idx) => (
                          <div 
                            key={idx}
                            onClick={() => toggleStep(idx)}
                            className={`flex items-start space-x-3 p-3.5 rounded-xl border cursor-pointer transition ${data.completedSteps[data.selectedIncident.id]?.[idx] ? 'bg-signal-teal/10 border-signal-teal/20 text-abstra-muted' : 'bg-white border-stone-200 hover:border-abstra-mauve text-abstra-dark'}`}
                          >
                            {data.completedSteps[data.selectedIncident.id]?.[idx] ? (
                              <CheckSquare className="h-4 w-4 text-signal-teal shrink-0 mt-0.5" />
                            ) : (
                              <Square className="h-4 w-4 text-stone-400 shrink-0 mt-0.5" />
                            )}
                            <span className={`text-xs ${data.completedSteps[data.selectedIncident.id]?.[idx] ? 'line-through text-abstra-muted' : ''}`}>
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
                      {data.selectedIncident.ai_analysis.incident_report}
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
                  onClick={() => data.setSelectedIncident(null)}
                  className="px-5 py-2 border border-stone-300 hover:bg-stone-100 text-abstra-dark rounded-full text-xs font-medium transition"
                >
                  Close
                </button>
                {data.selectedIncident.status === 'active' && (
                  <button 
                    onClick={() => { handleResolve(data.selectedIncident.id); data.setSelectedIncident(null); }}
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

      {/* Recovery Pipeline Modal */}
      {data.showRecoveryModal && (
        <RecoveryModal
          sandboxServices={data.sandboxState?.services || []}
          onComplete={handleRecoveryComplete}
        />
      )}
    </div>
  );
}

export default App;
