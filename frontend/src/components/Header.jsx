import React from 'react';
import { 
  Activity, 
  BookOpen, 
  FileText, 
  Server, 
  ShieldAlert, 
  RefreshCw,
  Loader2,
  Layers,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

export function Header({
  activeTab,
  setActiveTab,
  incidents,
  operationMode,
  modeToggling,
  handleModeToggle,
  loading,
  fetchIncidents
}) {
  const getActiveCount = () => Array.isArray(incidents) ? incidents.filter(i => i.status === 'active').length : 0;

  return (
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
  );
}
