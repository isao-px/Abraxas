const mqtt = require('mqtt');
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const net = require('net');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');

const client = new net.Socket();
const app = express();
const server = http.createServer(app);
const io = new Server(server);

client.connect('/tmp/gpio_daemon.sock', () => {
    client.write('2:ON');
});

// Servir les différents fichiers
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'client.html'));
});
app.get('/client.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'client.css'));
});
app.get('/client.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'client.js'));
});
app.get('/horizon.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'horizon.png'));
});

// Gestion des connexions WebSocket
io.on('connection', (socket) => {
    console.log('Un client est connecté :', socket.id);

    // Écouter les déconnexions
    socket.on('disconnect', () => {
        console.log('Un client s\'est déconnecté');
    });
});

// Mise à jour des données à chaque réception
const clientMqtt = mqtt.connect('mqtt://localhost');

clientMqtt.on('connect', () => {
    console.log('Serveur connecté au broker MQTT');
    clientMqtt.subscribe('capteur/#');
});

clientMqtt.on('message', (topic, buffer) => {
    const parts = topic.split('/');
    if (parts.length === 3) {
        const id = parts[2];
        const rawValue = buffer.toString();
        try {
            const numeric = Number(rawValue);
            const value = Number.isNaN(numeric) ? rawValue : numeric;
            const data = { [id]: value };
            io.emit('update-data', data);
        } catch (error) {
            console.error('Erreur lors du transfert :', error);
        }
    }
});

// Démarrage du serveur sur le port 3000
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur prêt. Accessible sur http://<IP-RASPBERRY>:${PORT}`);
});

// Démarrage sur le port 3001
const EXPORT_PORT = 3001;
const DB_PATH = path.join(__dirname, '..', 'sys.db'); // sys.db est à côté du dossier server/
const SESSIONS_DIR = path.join(__dirname, '..', 'sessions'); // sessions/<id>/final.mp4
const MERGE_FILE = path.join(__dirname, '..', 'list.txt'); // présent pendant la fusion de grp.py
const activeTransfers = {}; // id de session -> nombre de téléchargements vidéo en cours
const exportApp = express();

exportApp.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'export.html'));
});

exportApp.get('/sys.db', (req, res) => {
    if (!fs.existsSync(DB_PATH)) {
        return res.status(404).send('Base de données introuvable');
    }

    // Vacuum into en tmp
    const tmp = path.join(os.tmpdir(), `abraxas_export_${Date.now()}_${process.pid}.db`);
    const sql = `VACUUM INTO '${tmp.replace(/'/g, "''")}'`;

    execFile('sqlite3', ['-cmd', '.timeout 5000', DB_PATH, sql], (err, stdout, stderr) => {
        if (err) {
            console.error('Erreur lors de l\'export :', stderr || err.message);
            return res.status(500).send('Impossible de copier la base de données');
        }
        // Syncro des vidéos
        execFile('sqlite3', [tmp, videoStartsSql()], (videoErr, videoOut, videoStderr) => {
            if (videoErr) console.error('Impossible d\'ajouter les débuts de vidéo :', videoStderr || videoErr.message);
            res.set('Cache-Control', 'no-store');
            res.download(tmp, 'sys.db', () => fs.unlink(tmp, () => {}));
        });
    });
});

// start.txt dans les métadonnées
function videoStartsSql() {
    let dirs = [];
    try {
        dirs = fs.readdirSync(SESSIONS_DIR);
    } catch (e) {}
    const rows = [];
    for (const dir of dirs) {
        if (!/^[0-9]+$/.test(dir)) continue;
        let start;
        try {
            start = fs.readFileSync(path.join(SESSIONS_DIR, dir, 'start.txt'), 'utf-8').trim();
        } catch (e) {
            continue;
        }
        if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(start)) continue;
        rows.push(`(${parseInt(dir, 10)}, '${start.replace(' ', 'T')}')`);
    }
    let sql = 'CREATE TABLE IF NOT EXISTS videos (session_id INTEGER PRIMARY KEY, start DATETIME NOT NULL);';
    if (rows.length) sql += `INSERT OR REPLACE INTO videos (session_id, start) VALUES ${rows.join(', ')};`;
    return sql;
}

// Liste sessions
function readSessions(callback) {
    const sql = 'SELECT id, start, stop, name FROM sessions ORDER BY id DESC;';
    execFile('sqlite3', ['-json', '-cmd', '.timeout 5000', DB_PATH, sql], (err, stdout, stderr) => {
        if (err) {
            console.error('Erreur lors de la lecture des sessions :', stderr || err.message);
            return callback(err);
        }
        let rows = [];
        try {
            rows = JSON.parse(stdout.trim() || '[]');
        } catch (e) {
            return callback(e);
        }
        const merging = fs.existsSync(MERGE_FILE);
        const sessions = rows.map((row, index) => {
            let size = null;
            try {
                size = fs.statSync(path.join(SESSIONS_DIR, String(row.id), 'final.mp4')).size;
            } catch (e) {}
            let state = 'ok';
            if (size === null) state = 'absent';
            else if (!row.stop || (merging && index === 0)) state = 'busy'; // session en cours ou fusion en cours
            return { id: row.id, start: row.start, stop: row.stop, name: row.name, size: size, state: state };
        });
        callback(null, sessions);
    });
}

exportApp.get('/api/videos', (req, res) => {
    res.set('Cache-Control', 'no-store');
    readSessions((err, sessions) => {
        if (err) return res.status(500).json({ error: 'Impossible de lire les sessions' });
        res.json(sessions);
    });
});

// Réglage attente envoi
exportApp.get('/api/transfers', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(Object.keys(activeTransfers).map(Number));
});

exportApp.get('/video/:id', (req, res) => {
    if (!/^[0-9]+$/.test(req.params.id)) {
        return res.status(400).send('Identifiant de session invalide');
    }
    const id = parseInt(req.params.id, 10);

    readSessions((err, sessions) => {
        if (err) return res.status(500).send('Impossible de lire les sessions');
        const session = sessions.find((s) => s.id === id);
        if (!session || session.state === 'absent') return res.status(404).send('Aucune vidéo pour cette session');
        if (session.state === 'busy') return res.status(409).send('Vidéo en cours de fusion, réessaie dans quelques instants');

        const start = String(session.start).slice(0, 19).replace('T', '_').replace(/:/g, '-').replace(/[^0-9A-Za-z_-]/g, '');
        const name = `session_${id}_${start}.mp4`;

        activeTransfers[id] = (activeTransfers[id] || 0) + 1;
        res.on('close', () => {
            activeTransfers[id] -= 1;
            if (activeTransfers[id] <= 0) delete activeTransfers[id];
        });

        // res.download > tolèrant
        res.set('Cache-Control', 'no-store');
        res.download(path.join(SESSIONS_DIR, String(id), 'final.mp4'), name, (downloadErr) => {
            if (downloadErr && !res.headersSent) res.status(500).send('Impossible d\'envoyer la vidéo');
        });
    });
});

exportApp.listen(EXPORT_PORT, '0.0.0.0', () => {
    console.log(`Export de la base et des vidéos prêt sur http://<IP-RASPBERRY>:${EXPORT_PORT}`);
});
