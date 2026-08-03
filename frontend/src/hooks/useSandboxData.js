import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useSandboxStream } from './useSandboxStream';

export function useSandboxData() {
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

  // Fetch system info from backend
  const fetchSystemInfo = async () => {
    try {
      const res = await api.system.info();
      const raw = res.system_info || res;
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
      setOperationMode(targetMode);
    } catch (err) {
      console.error('Failed to fetch mode:', err);
    }
  };

  const handleModeToggle = async () => {
    const nextMode = operationMode === 'demo' ? 'live' : 'demo';
    setModeToggling(true);
    try {
      await api.system.setMode(nextMode);
      setOperationMode(nextMode);
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

  const updateSandboxStateFromStream = useCallback((state) => {
    setSandboxState(state);
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
  }, []);

  useSandboxStream(updateSandboxStateFromStream);

  const fetchSandboxState = async () => {
    try {
      const state = await api.sandbox.getState();
      updateSandboxStateFromStream(state);
    } catch (err) {
      console.error("Failed to fetch sandbox state:", err);
    }
  };

  useEffect(() => {
    fetchIncidents(true);
    fetchSimulationTypes();
    fetchSystemInfo();
    fetchMode();
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

  return {
    activeTab, setActiveTab,
    searchQuery, setSearchQuery,
    searchResults, setSearchResults,
    searchLoading, setSearchLoading,
    incidents, setIncidents,
    simTypes, setSimTypes,
    loading, setLoading,
    simulating, setSimulating,
    simDropdownOpen, setSimDropdownOpen,
    ingesting, setIngesting,
    ingestStatus, setIngestStatus,
    sandboxState, setSandboxState,
    metricsHistory, setMetricsHistory,
    selectedGraphService, setSelectedGraphService,
    sandboxLogsFilter, setSandboxLogsFilter,
    recovering, setRecovering,
    showRecoveryModal, setShowRecoveryModal,
    demoActive, setDemoActive,
    operationMode, setOperationMode,
    systemInfo, setSystemInfo,
    modeToggling, setModeToggling,
    analyzingId, setAnalyzingId,
    selectedIncident, setSelectedIncident,
    completedSteps, setCompletedSteps,
    fetchIncidents,
    fetchSandboxState,
    handleModeToggle,
    handleSimulate,
  };
}
