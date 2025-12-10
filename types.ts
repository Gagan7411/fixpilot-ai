

// FixPilot Message Protocol & Data Structures

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum ErrorStatus {
  DETECTED = 'DETECTED',
  ANALYZING = 'ANALYZING',
  PATCH_PROPOSED = 'PATCH_PROPOSED',
  FIXED = 'FIXED',
  FAILED = 'FAILED'
}

export type Environment = 'LOCAL' | 'PRODUCTION';

export interface StackFrame {
  file: string;
  line: number;
  column: number;
  functionName: string;
}

export interface ErrorLog {
  id: string;
  timestamp: string;
  message: string;
  severity: ErrorSeverity;
  status: ErrorStatus;
  environment: Environment;
  stackTrace: StackFrame[];
  file: string;
  language: 'typescript' | 'javascript' | 'python' | 'go' | 'rust';
  aiExplanation?: string;
  proposedPatch?: string;
}

export interface ProjectStats {
  healthScore: number;
  totalErrors: number;
  fixedErrors: number;
  activePatches: number;
  uptime: string;
}

// Message Protocol Schemas
export interface DaemonMessage {
  type: 'ERROR_DETECTED' | 'STATUS_UPDATE' | 'PATCH_READY' | 'LOG_ENTRY';
  payload: any;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: 'DAEMON' | 'WATCHER' | 'LLM' | 'RULE_ENGINE';
}

export interface HeatmapDataPoint {
  hour: number;
  severity: number; // 1-10 intensity
  fileId: string; // Simplified for visualization
}

export type ConnectionStatus = 'DISCONNECTED' | 'PAIRING' | 'CONNECTED';
