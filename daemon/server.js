
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import chokidar from 'chokidar';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import 'dotenv/config'; // Load .env variables

// --- CONFIGURATION ---
const PORT = 4000;
// Allow passing directory as argument, fallback to CWD
const WATCH_DIR = process.argv[2] || process.cwd(); 

const IGNORED_PATHS = [
    /(^|[\/\\])\../,       // Dotfiles
    /node_modules/,        // Dependencies (Crucial for large projects)
    /dist/, /build/, /out/ // Build artifacts
];

// --- SETUP SERVER ---
const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
        methods: ["GET", "POST"]
    }
});

// --- STATE ---
let connectedClients = 0;

console.log('\x1b[36m%s\x1b[0m', '🚀 FixPilot Daemon Starting...');
console.log(`\x1b[33mWatching:\x1b[0m ${WATCH_DIR}`);
console.log(`\x1b[32m✔ Ready to pair with Dashboard on port ${PORT}\x1b[0m`);

// --- REAL-TIME COMMUNICATION ---
io.on('connection', (socket) => {
    connectedClients++;
    console.log(`Client connected. Total: ${connectedClients}`);
    
    // Send initial handshake
    socket.emit('status', { status: 'CONNECTED', message: 'Daemon active and watching' });

    socket.on('disconnect', () => {
        connectedClients--;
        console.log('Client disconnected');
    });

    socket.on('apply_patch', (data) => {
        applyPatch(data.file, data.patch);
    });
});

// --- FILE WATCHER (The "Eyes") ---
const watcher = chokidar.watch(WATCH_DIR, {
    ignored: IGNORED_PATHS,
    persistent: true,
    ignoreInitial: true // Don't scan everything on startup, only new changes
});

watcher.on('change', (filePath) => {
    const fileName = path.basename(filePath);
    console.log(`File changed: ${fileName}`);
    
    io.emit('log', { 
        level: 'info', 
        message: `File detected: ${fileName}`, 
        source: 'WATCHER' 
    });

    // Run diagnostics
    checkFile(filePath);
});

// --- DIAGNOSTICS ENGINE (The "Brain") ---
function checkFile(filePath) {
    const ext = path.extname(filePath);
    
    // 1. Basic Syntax Check for JS
    if (ext === '.js' || ext === '.jsx' || ext === '.mjs') {
        exec(`node --check "${filePath}"`, (error, stdout, stderr) => {
            if (error) {
                // Parse the error output to get a readable message
                const rawError = stderr.toString();
                const errorMessage = rawError.split('\n').find(l => l.includes('SyntaxError')) || "Syntax Error Detected";
                
                console.log(`\x1b[31m[ERROR]\x1b[0m ${errorMessage}`);
                
                const errorLog = {
                    id: `err-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    message: errorMessage.trim(),
                    severity: 'HIGH',
                    status: 'DETECTED',
                    environment: 'LOCAL',
                    file: path.relative(WATCH_DIR, filePath),
                    language: 'javascript',
                    stackTrace: [], 
                    rawCode: fs.readFileSync(filePath, 'utf-8')
                };

                io.emit('error_detected', errorLog);
            } else {
                console.log(`\x1b[32m[OK]\x1b[0m ${path.basename(filePath)} passed syntax check.`);
                io.emit('log', { level: 'info', message: `Syntax OK: ${path.basename(filePath)}`, source: 'DAEMON' });
            }
        });
    } else if (ext === '.ts' || ext === '.tsx') {
        // For MVP, we don't run tsc because it requires a tsconfig context and is slow.
        // We just log that we saw it.
        io.emit('log', { level: 'info', message: `TypeScript file changed (Syntax check skipped in MVP)`, source: 'WATCHER' });
    }
}

// --- PATCH APPLIER (The "Hands") ---
function applyPatch(relativePath, patchContent) {
    // Resolve full path securely
    const fullPath = path.join(WATCH_DIR, relativePath);
    
    console.log(`Applying patch to ${fullPath}`);
    io.emit('log', { level: 'info', message: `Writing fix to: ${relativePath}`, source: 'DAEMON' });
    
    try {
        if (fs.existsSync(fullPath)) {
            // Write the new content to the file
            fs.writeFileSync(fullPath, patchContent, 'utf-8');
            console.log(`\x1b[32m✔ File updated successfully\x1b[0m`);
        } else {
            console.log(`\x1b[31m[ERROR]\x1b[0m File not found: ${fullPath}`);
            io.emit('log', { level: 'error', message: `File not found: ${relativePath}`, source: 'DAEMON' });
        }
    } catch (e) {
        console.error("Write failed:", e);
        io.emit('log', { level: 'error', message: `Write failed: ${e.message}`, source: 'DAEMON' });
    }
}

// --- START ---
server.listen(PORT, () => {
    console.log(`\x1b[32m✔ Server listening on port ${PORT}\x1b[0m`);
});
