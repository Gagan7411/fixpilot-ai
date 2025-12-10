
import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Terminal, 
  Cpu, 
  Shield, 
  Zap, 
  Play, 
  RotateCcw,
  Bug,
  Code,
  Search,
  Menu,
  X,
  Plus,
  Loader2,
  Power,
  Flag,
  Copy,
  Check,
  Globe,
  Laptop,
  Bell,
  Wifi,
  WifiOff,
  Link,
  FileCode
} from 'lucide-react';
import { 
  ErrorLog, 
  ErrorSeverity, 
  ErrorStatus, 
  ProjectStats, 
  LogEntry, 
  HeatmapDataPoint,
  Environment,
  ConnectionStatus
} from './types';
import ActivityChart from './components/ActivityChart';
import SeverityHeatmap from './components/SeverityHeatmap';
import { analyzeErrorWithGemini, generatePatchWithGemini, generateSimulatedError } from './services/geminiService';

const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'errors' | 'logs'>('dashboard');
  const [currentEnv, setCurrentEnv] = useState<Environment>('LOCAL');
  
  // Connection State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Initialize state from LocalStorage if available, otherwise default
  const [errors, setErrors] = useState<ErrorLog[]>(() => {
    const saved = localStorage.getItem('fixpilot_errors');
    return saved ? JSON.parse(saved) : [];
  });

  const [logs, setLogs] = useState<LogEntry[]>(() => {
    const saved = localStorage.getItem('fixpilot_logs');
    return saved ? JSON.parse(saved) : [
        { id: '1', timestamp: new Date().toISOString(), level: 'info', message: 'FixPilot Dashboard initialized', source: 'DAEMON' },
    ];
  });
  
  const [stats, setStats] = useState<ProjectStats>(() => {
    const saved = localStorage.getItem('fixpilot_stats');
    return saved ? JSON.parse(saved) : {
        healthScore: 100,
        totalErrors: 0,
        fixedErrors: 0,
        activePatches: 0,
        uptime: '0h 01m'
    };
  });

  const [heatmapData, setHeatmapData] = useState<HeatmapDataPoint[]>(() => {
      const saved = localStorage.getItem('fixpilot_heatmap');
      return saved ? JSON.parse(saved) : [];
  });

  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [patching, setPatching] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  
  // Alert Notification State
  const [activeAlert, setActiveAlert] = useState<string | null>(null);

  // Simulation Form State
  const [manualInput, setManualInput] = useState({
    message: '',
    code: '',
    language: 'javascript'
  });

  // Persist state changes
  useEffect(() => { localStorage.setItem('fixpilot_errors', JSON.stringify(errors)); }, [errors]);
  useEffect(() => { localStorage.setItem('fixpilot_logs', JSON.stringify(logs)); }, [logs]);
  useEffect(() => { localStorage.setItem('fixpilot_stats', JSON.stringify(stats)); }, [stats]);
  useEffect(() => { localStorage.setItem('fixpilot_heatmap', JSON.stringify(heatmapData)); }, [heatmapData]);

  // SOCKET IO CONNECTION
  useEffect(() => {
    connectToSocket();
    return () => {
        socketRef.current?.disconnect();
    };
  }, []);

  const connectToSocket = () => {
      if (socketRef.current?.connected) return;

      const socket = io('http://localhost:4000', {
          reconnection: true,
          reconnectionAttempts: 5
      });
      
      socketRef.current = socket;

      socket.on('connect', () => {
          setConnectionStatus('CONNECTED');
          addLog('Connected to Local Daemon', 'info', 'DAEMON');
          setIsMonitoring(true);
      });

      socket.on('disconnect', () => {
          setConnectionStatus('DISCONNECTED');
          addLog('Lost connection to Daemon', 'error', 'DAEMON');
          setIsMonitoring(false);
      });

      socket.on('log', (data: any) => {
          addLog(data.message, data.level, data.source);
      });

      socket.on('error_detected', (newError: ErrorLog) => {
           setErrors(prev => [newError, ...prev]);
           setStats(prev => ({ 
              ...prev, 
              totalErrors: prev.totalErrors + 1, 
              healthScore: Math.max(0, prev.healthScore - 10) 
          }));
          addLog(`Real-time error detected in ${newError.file}`, 'error', 'WATCHER');
          showTeamAlert(`Runtime Error: ${newError.message}`);
      });
  };


  // Live Monitoring Loop
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isMonitoring && connectionStatus === 'DISCONNECTED') { 
        interval = setInterval(async () => {
            const random = Math.random();
            const errorChance = currentEnv === 'PRODUCTION' ? 0.02 : 0.08;
            
            if (random < errorChance) {
                await handleSimulateError(true); 
            } 
            else if (random < 0.25) {
                const localMsgs = ["Scanning src/components...", "Checking dependencies...", "File watcher active.", "Validating types..."];
                const prodMsgs = ["Monitoring latency (45ms)", "Checking API health...", "Database pool: 45/100", "Traffic: 250 req/s"];
                
                const msgs = currentEnv === 'PRODUCTION' ? prodMsgs : localMsgs;
                const msg = msgs[Math.floor(Math.random() * msgs.length)];
                addLog(msg, 'info', 'WATCHER');
            }
        }, 3000); 
    } 
    return () => clearInterval(interval);
  }, [isMonitoring, currentEnv, connectionStatus]);

  const addLog = (message: string, level: 'info' | 'warn' | 'error' = 'info', source: 'DAEMON' | 'LLM' | 'RULE_ENGINE' | 'WATCHER' = 'DAEMON') => {
    const newLog: LogEntry = {
        id: `log-${Date.now()}-${Math.random()}`,
        timestamp: new Date().toISOString(),
        level,
        message,
        source
    };
    setLogs(prev => [newLog, ...prev].slice(0, 100)); // Keep last 100 logs
  };

  const showTeamAlert = (message: string) => {
    setActiveAlert(message);
    setTimeout(() => setActiveAlert(null), 5000);
    addLog(`Alert sent to #engineering-alerts: ${message}`, 'warn', 'DAEMON');
  }

  const handleSimulateError = async (silent = false) => {
    if(!silent) setSimulating(true);
    if(!silent) addLog(`Simulating ${currentEnv} crash event...`, 'warn');
    
    const simData: any = await generateSimulatedError(currentEnv);
    
    const newError: ErrorLog = {
        id: `err-${Date.now()}`,
        timestamp: new Date().toISOString(),
        message: simData.message || "Unknown Error",
        severity: currentEnv === 'PRODUCTION' ? ErrorSeverity.CRITICAL : ErrorSeverity.HIGH,
        status: ErrorStatus.DETECTED,
        environment: currentEnv,
        file: simData.file || "unknown.js",
        language: (simData.language as any) || "javascript",
        stackTrace: simData.stackTrace || [],
        aiExplanation: '', 
        proposedPatch: '' 
    };
    (newError as any).rawCode = simData.codeSnippet;

    setErrors(prev => [newError, ...prev]);
    setStats(prev => ({ 
        ...prev, 
        totalErrors: prev.totalErrors + 1, 
        healthScore: Math.max(0, prev.healthScore - (currentEnv === 'PRODUCTION' ? 20 : 10)) 
    }));
    
    setHeatmapData(prev => [
        ...prev, 
        { hour: new Date().getHours(), severity: currentEnv === 'PRODUCTION' ? 10 : 6, fileId: newError.file }
    ]);

    addLog(`Error detected in ${newError.file}`, 'error', 'WATCHER');
    
    if (currentEnv === 'PRODUCTION') {
        showTeamAlert(`CRITICAL: ${newError.message.substring(0, 40)}... in ${newError.file}`);
    }

    if(!silent) setSimulating(false);
    if(!silent) {
        setSelectedError(newError);
        setActiveTab('errors');
    }
  };

  const handleManualSubmit = () => {
    if(!manualInput.message || !manualInput.code) return;

    const newError: ErrorLog = {
        id: `err-${Date.now()}`,
        timestamp: new Date().toISOString(),
        message: manualInput.message,
        severity: ErrorSeverity.MEDIUM,
        status: ErrorStatus.DETECTED,
        environment: currentEnv,
        file: 'manual-input.ts',
        language: manualInput.language as any,
        stackTrace: [],
    };
    (newError as any).rawCode = manualInput.code;

    setErrors(prev => [newError, ...prev]);
    addLog(`Manual error reported: ${manualInput.message}`, 'warn', 'DAEMON');
    setStats(prev => ({...prev, totalErrors: prev.totalErrors + 1, healthScore: prev.healthScore - 5}));
    
    setIsModalOpen(false);
    setSelectedError(newError);
    setActiveTab('errors');
    setManualInput({ message: '', code: '', language: 'javascript' });
  };

  const handleAnalyze = async (error: ErrorLog) => {
    setAiAnalyzing(true);
    addLog(`Sending error context to Gemini Flash...`, 'info', 'LLM');
    setErrors(prev => prev.map(e => e.id === error.id ? { ...e, status: ErrorStatus.ANALYZING } : e));
    
    const explanation = await analyzeErrorWithGemini(error);
    
    setErrors(prev => prev.map(e => e.id === error.id ? { ...e, aiExplanation: explanation } : e));
    if (selectedError?.id === error.id) {
        setSelectedError(prev => prev ? { ...prev, aiExplanation: explanation, status: ErrorStatus.ANALYZING } : null);
    }
    
    addLog(`Analysis received for ${error.id}`, 'info', 'LLM');
    setAiAnalyzing(false);
  };

  const handleGeneratePatch = async (error: ErrorLog) => {
    setPatching(true);
    addLog(`Requesting patch generation...`, 'info', 'LLM');

    const codeSnippet = (error as any).rawCode || "// Code not available in simulation";
    const patch = await generatePatchWithGemini(error, codeSnippet);

    setErrors(prev => prev.map(e => e.id === error.id ? { ...e, proposedPatch: patch, status: ErrorStatus.PATCH_PROPOSED } : e));
    if (selectedError?.id === error.id) {
        setSelectedError(prev => prev ? { ...prev, proposedPatch: patch, status: ErrorStatus.PATCH_PROPOSED } : null);
    }

    addLog(`Patch generated for ${error.file}`, 'info', 'LLM');
    setPatching(false);
  };

  const handleApplyFix = (id: string) => {
    setErrors(prev => prev.map(e => e.id === id ? { ...e, status: ErrorStatus.FIXED } : e));
    if (selectedError?.id === id) {
        setSelectedError(prev => prev ? { ...prev, status: ErrorStatus.FIXED } : null);
    }
    setStats(prev => ({
        ...prev, 
        fixedErrors: prev.fixedErrors + 1, 
        healthScore: Math.min(100, prev.healthScore + 10),
        activePatches: prev.activePatches + 1
    }));
    addLog(`Patch applied successfully to ${selectedError?.file}`, 'info', 'DAEMON');
    
    // In real mode, send to backend
    if (connectionStatus === 'CONNECTED' && socketRef.current) {
        socketRef.current.emit('apply_patch', { file: selectedError?.file, patch: selectedError?.proposedPatch });
    }
  };

  const handleRollbackConfirm = () => {
    if (!selectedError) return;
    const newStatus = selectedError.proposedPatch ? ErrorStatus.PATCH_PROPOSED : ErrorStatus.ANALYZING;

    setErrors(prev => prev.map(e => e.id === selectedError.id ? { ...e, status: newStatus } : e));
    setSelectedError(prev => prev ? { ...prev, status: newStatus } : null);

    if (selectedError.status === ErrorStatus.FIXED) {
         setStats(prev => ({
            ...prev,
            fixedErrors: Math.max(0, prev.fixedErrors - 1),
            healthScore: Math.max(0, prev.healthScore - 10), 
            activePatches: Math.max(0, prev.activePatches - 1)
        }));
        addLog(`Rollback for ${selectedError.file}. Status reverted to ${newStatus}.`, 'warn', 'DAEMON');
    }

    setIsRollbackModalOpen(false);
  };

  const handleReportSubmit = () => {
    if (selectedError) {
        addLog(`Issue #${selectedError.id} reported to engineering team with full diagnostic context.`, 'info', 'DAEMON');
        showTeamAlert(`Report filed for ${selectedError.file}`);
    }
    setIsReportModalOpen(false);
  };
  
  const handleCopyPatch = () => {
    if (selectedError?.proposedPatch) {
        navigator.clipboard.writeText(selectedError.proposedPatch);
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000);
    }
  };

  const handleClearData = () => {
      localStorage.clear();
      window.location.reload();
  }

  const getStatusColor = (status: ErrorStatus) => {
    switch (status) {
      case ErrorStatus.DETECTED: return 'bg-error/20 text-error border-error/50';
      case ErrorStatus.ANALYZING: return 'bg-warning/20 text-warning border-warning/50';
      case ErrorStatus.PATCH_PROPOSED: return 'bg-primary/20 text-primary border-primary/50';
      case ErrorStatus.FIXED: return 'bg-success/20 text-success border-success/50';
      default: return 'bg-muted/20 text-muted';
    }
  };

  return (
    <div className="flex h-screen bg-background text-text overflow-hidden">
      
      {/* Alert Notification Toast */}
      {activeAlert && (
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right fade-in duration-300">
              <div className="bg-surface border border-l-4 border-l-error border-border shadow-2xl rounded-lg p-4 flex items-center gap-4 max-w-md">
                  <div className="p-2 bg-error/10 rounded-full text-error">
                      <Bell size={20} />
                  </div>
                  <div>
                      <h4 className="font-bold text-sm text-text">Team Alert Sent</h4>
                      <p className="text-xs text-muted mt-1">{activeAlert}</p>
                  </div>
              </div>
          </div>
      )}

      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-16'} transition-all duration-300 border-r border-border flex flex-col bg-surface z-20`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          {isSidebarOpen ? (
            <div className="flex items-center gap-2 font-bold text-lg text-primary">
              <Cpu className="w-6 h-6" />
              <span>FixPilot</span>
            </div>
          ) : (
            <Cpu className="w-8 h-8 mx-auto text-primary" />
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-border rounded text-muted">
            {isSidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-2">
          
          {/* Connection Status Box */}
          {isSidebarOpen ? (
              <div className={`mb-4 p-3 rounded border flex items-center justify-between ${connectionStatus === 'CONNECTED' ? 'bg-success/10 border-success/30' : 'bg-background border-border'}`}>
                   <div className="flex items-center gap-2">
                       {connectionStatus === 'CONNECTED' ? <Wifi size={14} className="text-success"/> : <WifiOff size={14} className="text-muted"/>}
                       <div>
                           <p className="text-xs font-semibold">{connectionStatus === 'CONNECTED' ? 'Agent Active' : 'Disconnected'}</p>
                           <p className="text-[10px] text-muted">{connectionStatus === 'CONNECTED' ? 'Watching Files' : 'No Daemon Found'}</p>
                       </div>
                   </div>
                   {connectionStatus !== 'CONNECTED' && (
                       <button onClick={connectToSocket} className="text-[10px] bg-primary/20 text-primary px-2 py-1 rounded hover:bg-primary/30">
                           Retry
                       </button>
                   )}
              </div>
          ) : (
             <div className="mb-4 flex justify-center">
                 <button onClick={connectToSocket}>
                     {connectionStatus === 'CONNECTED' ? <Wifi size={18} className="text-success"/> : <WifiOff size={18} className="text-muted"/>}
                 </button>
             </div>
          )}

          {/* Environment Switcher */}
          {isSidebarOpen && (
              <div className="mb-6 p-2 bg-background/50 rounded border border-border">
                  <p className="text-xs text-muted mb-2 font-semibold uppercase tracking-wider px-1">Environment</p>
                  <div className="flex bg-surface rounded p-1 border border-border">
                      <button 
                        onClick={() => setCurrentEnv('LOCAL')}
                        className={`flex-1 flex items-center justify-center gap-2 text-xs py-1.5 rounded transition-colors ${currentEnv === 'LOCAL' ? 'bg-primary/20 text-primary font-medium' : 'text-muted hover:text-text'}`}
                      >
                          <Laptop size={12}/> Local
                      </button>
                      <button 
                        onClick={() => setCurrentEnv('PRODUCTION')}
                        className={`flex-1 flex items-center justify-center gap-2 text-xs py-1.5 rounded transition-colors ${currentEnv === 'PRODUCTION' ? 'bg-error/20 text-error font-medium' : 'text-muted hover:text-text'}`}
                      >
                          <Globe size={12}/> Prod
                      </button>
                  </div>
              </div>
          )}
        
          <NavItem icon={<Activity />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} isOpen={isSidebarOpen} />
          <NavItem icon={<Bug />} label="Errors" active={activeTab === 'errors'} onClick={() => setActiveTab('errors')} badge={errors.filter(e => e.status !== ErrorStatus.FIXED).length} isOpen={isSidebarOpen} />
          <NavItem icon={<Terminal />} label="Live Logs" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} isOpen={isSidebarOpen} />
        </nav>

        <div className="p-4 border-t border-border">
            <div className={`flex flex-col gap-3 ${!isSidebarOpen && 'items-center'}`}>
                {connectionStatus === 'CONNECTED' && (
                    <button 
                        onClick={() => setIsMonitoring(!isMonitoring)}
                        className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded transition-colors ${isMonitoring ? 'bg-success/20 text-success border border-success/30' : 'bg-border text-muted'}`}
                    >
                        <Power size={14} />
                        {isSidebarOpen && (isMonitoring ? "Monitoring Active" : "Monitoring Paused")}
                    </button>
                )}
                {isSidebarOpen && (
                    <button onClick={handleClearData} className="text-xs text-muted hover:text-error underline">
                        Reset Demo Data
                    </button>
                )}
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-16 border-b border-border bg-background/50 backdrop-blur flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold capitalize flex items-center gap-2">
                {activeTab}
                {currentEnv === 'PRODUCTION' && <span className="text-xs bg-error text-white px-2 py-0.5 rounded font-bold tracking-wide">PROD</span>}
            </h1>
            {isMonitoring && <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span></span>}
          </div>
          
          <div className="flex items-center gap-3">
            {connectionStatus === 'DISCONNECTED' ? (
                <button 
                    onClick={connectToSocket}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/30 rounded text-sm hover:bg-primary/20"
                >
                    <Link size={16}/> Connect to Editor
                </button>
            ) : (
                <button 
                onClick={() => handleSimulateError(false)}
                disabled={simulating}
                className="flex items-center gap-2 px-4 py-2 bg-warning/10 hover:bg-warning/20 text-warning border border-warning/30 rounded text-sm transition-colors"
                >
                {simulating ? <Loader2 className="animate-spin" size={16}/> : <Zap size={16} />}
                <span>Simulate {currentEnv === 'PRODUCTION' ? 'Traffic Crash' : 'Crash'}</span>
                </button>
            )}
            
            <div className="w-px h-6 bg-border mx-2"></div>
            <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90"
            >
                <Plus size={16}/> New Issue
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard icon={<Activity />} label="Health Score" value={`${stats.healthScore}%`} color={stats.healthScore > 80 ? "text-success" : "text-warning"} />
                <StatCard icon={<Bug />} label="Active Errors" value={stats.totalErrors - stats.fixedErrors} color="text-error" />
                <StatCard icon={<CheckCircle />} label="Fixed Issues" value={stats.fixedErrors} color="text-primary" />
                <StatCard icon={<Zap />} label="Active Patches" value={stats.activePatches} color="text-warning" />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ActivityChart data={[
                  { time: '00:00', errors: 0, fixed: 0 },
                  { time: '04:00', errors: 0, fixed: 0 },
                  { time: '08:00', errors: 1, fixed: 0 },
                  { time: '12:00', errors: 2, fixed: 1 },
                  { time: '16:00', errors: stats.totalErrors, fixed: stats.fixedErrors },
                ]} />
                <SeverityHeatmap data={heatmapData} />
              </div>

              {/* Empty State or List */}
              {errors.length === 0 ? (
                <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted">
                    <Shield className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <h3 className="text-lg font-semibold text-text mb-2">System Healthy</h3>
                    <p className="mb-6">No runtime errors detected in {currentEnv} environment.</p>
                    {connectionStatus === 'DISCONNECTED' ? (
                        <button onClick={connectToSocket} className="text-primary hover:underline">
                            Connect Agent to Start
                        </button>
                    ) : (
                        <button onClick={() => setIsMonitoring(true)} className="text-primary hover:underline">
                            Turn on Live Monitoring
                        </button>
                    )}
                </div>
              ) : (
                <div className="bg-surface border border-border rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-border flex justify-between items-center">
                    <h3 className="font-semibold">Recent Detections</h3>
                    </div>
                    <div className="divide-y divide-border">
                    {errors.slice(0, 5).map(err => (
                        <div key={err.id} className="p-4 flex items-center justify-between hover:bg-background/50 transition-colors cursor-pointer" onClick={() => {setSelectedError(err); setActiveTab('errors');}}>
                        <div className="flex items-start gap-3">
                            <div className={`mt-1 p-1 rounded ${err.severity === 'CRITICAL' || err.severity === 'HIGH' ? 'text-error bg-error/10' : 'text-warning bg-warning/10'}`}>
                            <AlertTriangle size={16} />
                            </div>
                            <div>
                            <p className="text-sm font-medium text-text">{err.message}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${err.environment === 'PRODUCTION' ? 'bg-error text-white' : 'bg-border text-muted'}`}>
                                    {err.environment}
                                </span>
                                <p className="text-xs text-muted font-mono">{err.file}</p>
                            </div>
                            </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(err.status)}`}>
                            {err.status}
                        </span>
                        </div>
                    ))}
                    </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'errors' && (
            <div className="flex h-full gap-6">
              {/* Error List */}
              <div className={`${selectedError ? 'w-1/3 hidden md:flex' : 'w-full flex'} transition-all bg-surface border border-border rounded-lg flex-col`}>
                <div className="p-4 border-b border-border">
                   <input type="text" placeholder="Filter errors..." className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                </div>
                {errors.length === 0 && (
                    <div className="p-8 text-center text-muted text-sm">No errors found.</div>
                )}
                <div className="flex-1 overflow-y-auto divide-y divide-border">
                  {errors.map(err => (
                    <div 
                      key={err.id} 
                      onClick={() => setSelectedError(err)}
                      className={`p-4 cursor-pointer hover:bg-background/50 transition-colors ${selectedError?.id === err.id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                         <div className="flex gap-2">
                             <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${err.environment === 'PRODUCTION' ? 'bg-error text-white' : 'bg-border text-muted'}`}>{err.environment.substring(0,4)}</span>
                             <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${err.severity === 'CRITICAL' ? 'bg-error text-white' : 'bg-warning/20 text-warning'}`}>{err.severity}</span>
                         </div>
                        <span className="text-xs text-muted">{new Date(err.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-sm font-medium line-clamp-2 mb-1">{err.message}</p>
                      <p className="text-xs font-mono text-muted truncate">{err.file}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Error Detail */}
              {selectedError && (
                <div className="flex-1 bg-surface border border-border rounded-lg flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="p-4 border-b border-border flex justify-between items-center bg-background/50">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSelectedError(null)} className="md:hidden p-1 hover:bg-border rounded"><X size={16}/></button>
                        <h2 className="font-semibold text-lg flex items-center gap-2">
                           <Code size={18} className="text-primary"/> 
                           Error Details
                        </h2>
                    </div>
                    <div className="flex gap-2">
                        {selectedError.status === ErrorStatus.PATCH_PROPOSED && (
                            <button 
                              onClick={() => handleApplyFix(selectedError.id)}
                              className="flex items-center gap-2 px-3 py-1.5 bg-success/20 hover:bg-success/30 text-success border border-success/30 rounded text-sm transition-colors"
                            >
                                <CheckCircle size={14} /> Confirm Fix
                            </button>
                        )}
                        {selectedError.status === ErrorStatus.FIXED && (
                            <button disabled className="flex items-center gap-2 px-3 py-1.5 bg-muted/20 text-muted rounded text-sm cursor-not-allowed">
                                <CheckCircle size={14} /> Fixed
                            </button>
                        )}
                         <button 
                            onClick={() => setIsRollbackModalOpen(true)}
                            className={`flex items-center gap-2 px-3 py-1.5 bg-border hover:bg-border/80 text-text rounded text-sm transition-colors ${selectedError.status !== ErrorStatus.FIXED && 'opacity-75'}`}
                            title={selectedError.status === ErrorStatus.FIXED ? "Revert this fix" : "Reset error status"}
                         >
                            <RotateCcw size={14} /> Rollback
                        </button>
                        <button 
                            onClick={() => setIsReportModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-border hover:bg-border/80 text-text rounded text-sm transition-colors"
                            title="Report complex issue"
                        >
                            <Flag size={14} /> Report
                        </button>
                    </div>
                  </div>
                  
                  <div className="p-6 overflow-y-auto space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-2">
                        <div className="flex gap-2 mb-2">
                             <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(selectedError.status)}`}>{selectedError.status}</span>
                             <span className="text-xs px-2 py-1 rounded border border-border bg-background text-muted uppercase">{selectedError.language}</span>
                             <span className={`text-xs px-2 py-1 rounded border font-bold ${selectedError.environment === 'PRODUCTION' ? 'bg-error/20 text-error border-error' : 'bg-primary/20 text-primary border-primary'}`}>
                                 {selectedError.environment}
                             </span>
                        </div>
                        <h3 className="text-xl font-mono text-error">{selectedError.message}</h3>
                        <p className="text-muted font-mono text-sm">{selectedError.file}</p>
                    </div>

                    {/* AI Analysis Section */}
                    <div className="bg-background/50 border border-primary/20 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="flex items-center gap-2 font-semibold text-primary">
                                <Zap size={16} /> FixPilot AI Analysis
                            </h4>
                            {!selectedError.aiExplanation && selectedError.status !== ErrorStatus.FIXED && (
                                <button 
                                    onClick={() => handleAnalyze(selectedError)}
                                    disabled={aiAnalyzing}
                                    className="text-xs px-3 py-1.5 bg-primary text-white rounded hover:bg-primary/80 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {aiAnalyzing && <Loader2 className="animate-spin" size={12}/>}
                                    {aiAnalyzing ? 'Analyzing...' : 'Analyze Error'}
                                </button>
                            )}
                        </div>
                        <div className="text-sm leading-relaxed text-text/90">
                            {selectedError.aiExplanation ? (
                                <p>{selectedError.aiExplanation}</p>
                            ) : (
                                <p className="text-muted italic">Run analysis to identify the root cause.</p>
                            )}
                        </div>
                    </div>

                    {/* Code Snippet (Simulated File Read) */}
                    {(selectedError as any).rawCode && (
                        <div>
                            <h4 className="font-semibold mb-2 text-sm text-muted uppercase tracking-wider">Source Code</h4>
                            <div className="bg-black/30 rounded p-3 font-mono text-xs text-text border border-border whitespace-pre-wrap">
                                {(selectedError as any).rawCode}
                            </div>
                        </div>
                    )}

                    {/* Patch Generator */}
                    {selectedError.aiExplanation && !selectedError.proposedPatch && selectedError.status !== ErrorStatus.FIXED && (
                        <div className="flex justify-center py-4">
                             <button 
                                onClick={() => handleGeneratePatch(selectedError)}
                                disabled={patching}
                                className="flex items-center gap-2 px-6 py-3 bg-primary/20 border border-primary text-primary rounded-lg hover:bg-primary/30 transition-all"
                             >
                                {patching ? <Loader2 className="animate-spin" size={18}/> : <Code size={18}/>}
                                {patching ? 'Generating Solution...' : 'Generate Auto-Fix Patch'}
                             </button>
                        </div>
                    )}

                    {/* Proposed Patch / Full Code */}
                    {selectedError.proposedPatch && (
                         <div className="mt-4">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-sm text-muted uppercase tracking-wider flex items-center gap-2">
                                    <FileCode size={14}/>
                                    Proposed Fix (Full File)
                                </h4>
                                <button 
                                    onClick={handleCopyPatch}
                                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted hover:text-text bg-border/30 hover:bg-border/60 rounded transition-colors"
                                >
                                    {hasCopied ? <Check size={12} className="text-success"/> : <Copy size={12}/>}
                                    {hasCopied ? "Copied" : "Copy Code"}
                                </button>
                            </div>
                            
                            <div className="bg-surface rounded-lg font-mono text-xs overflow-hidden border border-border shadow-lg">
                                {/* Editor Header */}
                                <div className="bg-background/80 p-2 border-b border-border flex gap-2">
                                    <div className="w-3 h-3 rounded-full bg-error/50"></div>
                                    <div className="w-3 h-3 rounded-full bg-warning/50"></div>
                                    <div className="w-3 h-3 rounded-full bg-success/50"></div>
                                </div>
                                {/* Editor Body */}
                                <div className="overflow-x-auto p-4 max-h-[400px]">
                                    {selectedError.proposedPatch.split('\n').map((line, i) => (
                                        <div key={i} className="flex">
                                            <span className="select-none text-muted opacity-30 w-8 text-right pr-4 shrink-0">{i + 1}</span>
                                            <span className="text-green-300 whitespace-pre flex-1">{line}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {selectedError.status !== ErrorStatus.FIXED && (
                                <div className="mt-3 p-3 bg-warning/10 border border-warning/20 rounded text-xs text-warning flex items-start gap-2">
                                    <AlertTriangle size={14} className="shrink-0 mt-0.5"/>
                                    <p>Caution: Applying this fix will overwrite <strong>{selectedError.file}</strong> with the code above.</p>
                                </div>
                            )}
                         </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="h-full bg-surface border border-border rounded-lg flex flex-col font-mono text-sm">
                <div className="p-3 border-b border-border bg-background/50 flex justify-between">
                    <span>Daemon Logs ({currentEnv})</span>
                    {isMonitoring ? (
                         <span className="text-success text-xs flex items-center gap-1">● Live</span>
                    ) : (
                        <span className="text-muted text-xs flex items-center gap-1">○ Paused</span>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    {logs.map((log) => (
                        <div key={log.id} className="flex gap-3">
                            <span className="text-muted w-20 shrink-0 text-xs">{new Date(log.timestamp).toLocaleTimeString()}</span>
                            <span className={`w-16 shrink-0 font-bold text-xs ${log.level === 'error' ? 'text-error' : log.level === 'warn' ? 'text-warning' : 'text-primary'}`}>{log.level.toUpperCase()}</span>
                            <span className="text-muted w-20 shrink-0 text-xs">[{log.source}]</span>
                            <span className="text-text">{log.message}</span>
                        </div>
                    ))}
                </div>
            </div>
          )}

        </div>
      </main>

      {/* Manual Input Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-lg w-full max-w-lg shadow-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Inject Runtime Error ({currentEnv})</h3>
                    <button onClick={() => setIsModalOpen(false)}><X size={20}/></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-muted mb-1">Language</label>
                        <select 
                            className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                            value={manualInput.language}
                            onChange={(e) => setManualInput({...manualInput, language: e.target.value})}
                        >
                            <option value="javascript">JavaScript</option>
                            <option value="typescript">TypeScript</option>
                            <option value="python">Python</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-muted mb-1">Error Message</label>
                        <input 
                            type="text" 
                            className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-mono"
                            placeholder="e.g. TypeError: Cannot read property 'map' of undefined"
                            value={manualInput.message}
                            onChange={(e) => setManualInput({...manualInput, message: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-muted mb-1">Code Snippet (Context)</label>
                        <textarea 
                            className="w-full h-32 bg-background border border-border rounded px-3 py-2 text-sm font-mono"
                            placeholder="Paste the code causing the error..."
                            value={manualInput.code}
                            onChange={(e) => setManualInput({...manualInput, code: e.target.value})}
                        />
                    </div>
                    <div className="pt-2 flex justify-end gap-3">
                        <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded hover:bg-border transition-colors">Cancel</button>
                        <button onClick={handleManualSubmit} className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors">Inject Error</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Connect Agent Modal */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-lg w-full max-w-md shadow-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                     <div className="p-2 bg-primary/10 rounded-full text-primary">
                         <Terminal size={24}/>
                     </div>
                     <div>
                        <h3 className="text-lg font-semibold">Connect to Local Editor</h3>
                        <p className="text-xs text-muted">Pair this dashboard with your code editor</p>
                     </div>
                </div>
                
                <div className="space-y-4">
                    <div className="bg-background border border-border rounded p-4 text-xs font-mono space-y-2">
                        <p className="text-muted"># 1. Open your terminal in VS Code/IntelliJ</p>
                        <p className="text-text select-all">$ npm run start:server</p>
                        <p className="text-muted mt-2"># 2. Click "Connect"</p>
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <button onClick={() => setIsConnectModalOpen(false)} className="px-4 py-2 rounded hover:bg-border transition-colors text-sm">Cancel</button>
                        <button onClick={connectToSocket} className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors text-sm font-medium">Connect Agent</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Report Bug Modal */}
      {isReportModalOpen && selectedError && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-lg w-full max-w-lg shadow-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Report Complex Issue</h3>
                    <button onClick={() => setIsReportModalOpen(false)}><X size={20}/></button>
                </div>
                <div className="space-y-4">
                    <div className="p-3 bg-warning/10 border border-warning/20 rounded text-sm text-warning">
                        <p className="font-semibold flex items-center gap-2"><AlertTriangle size={14}/> Reporting to Engineering Team</p>
                        <p className="mt-1 opacity-90">Use this for tricky bugs that the AI cannot fix automatically.</p>
                    </div>
                    <div>
                        <label className="block text-sm text-muted mb-1">Issue Title</label>
                        <input 
                            type="text" 
                            className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-mono text-muted"
                            value={selectedError.message}
                            readOnly
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-muted mb-1">User Context</label>
                        <textarea 
                            className="w-full h-24 bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
                            placeholder="Describe what you were doing when this happened..."
                        />
                    </div>
                     <div>
                        <label className="block text-sm text-muted mb-1">Technical Snapshot</label>
                        <div className="w-full h-24 bg-black/30 border border-border rounded px-3 py-2 text-xs font-mono overflow-y-auto text-muted whitespace-pre-wrap">
                            {JSON.stringify({
                                file: selectedError.file,
                                line: selectedError.stackTrace[0]?.line,
                                trace: selectedError.stackTrace
                            }, null, 2)}
                        </div>
                    </div>
                    <div className="pt-2 flex justify-end gap-3">
                        <button onClick={() => setIsReportModalOpen(false)} className="px-4 py-2 rounded hover:bg-border transition-colors">Cancel</button>
                        <button onClick={handleReportSubmit} className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors">Submit Report</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Rollback Confirmation Modal */}
      {isRollbackModalOpen && selectedError && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-lg w-full max-w-sm shadow-2xl p-6">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-warning">
                    <RotateCcw size={20}/>
                    Confirm Rollback
                </h3>
                <p className="text-sm text-muted mb-6">
                    Are you sure you want to rollback the fix for <strong className="text-text">{selectedError.file}</strong>?
                    <br/><br/>
                    This will revert the code changes and re-open the issue in the dashboard.
                </p>
                <div className="flex justify-end gap-3">
                    <button onClick={() => setIsRollbackModalOpen(false)} className="px-4 py-2 rounded hover:bg-border transition-colors text-sm">Cancel</button>
                    <button onClick={handleRollbackConfirm} className="px-4 py-2 bg-error text-white rounded hover:bg-error/90 transition-colors text-sm font-medium">Yes, Rollback</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

// Helper Components
const NavItem = ({ icon, label, active, onClick, badge, isOpen }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-3 rounded-md transition-all ${active ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted hover:text-text hover:bg-background'}`}
  >
    {icon}
    {isOpen && (
      <>
        <span className="font-medium text-sm flex-1 text-left">{label}</span>
        {badge > 0 && <span className="text-xs bg-error text-white px-1.5 rounded-full">{badge}</span>}
      </>
    )}
  </button>
);

const StatCard = ({ icon, label, value, color }: any) => (
  <div className="bg-surface border border-border rounded-lg p-4 shadow-sm flex items-center gap-4">
    <div className={`p-3 rounded-lg bg-background border border-border ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  </div>
);

export default MainLayout;
