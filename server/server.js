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

// 1. Servir les différents fichiers
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

// 2. Gestion des connexions WebSocket
io.on('connection', (socket) => {
    console.log('Un client est connecté :', socket.id);

    // Écouter les déconnexions
    socket.on('disconnect', () => {
        console.log('Un client s\'est déconnecté');
    });
});

// 3. Mise à jour des données à chaque réception
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

// 4. Serveur d'export de la base de données (port distinct du dashboard)
const EXPORT_PORT = 3001;
const DB_PATH = path.join(__dirname, '..', 'sys.db'); // sys.db est à côté du dossier server/
const exportApp = express();

exportApp.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'export.html'));
});

exportApp.get('/sys.db', (req, res) => {
    if (!fs.existsSync(DB_PATH)) {
        return res.status(404).send('Base de données introuvable');
    }

    // On ne sert pas sys.db directement : db_recording.py y écrit en continu.
    // VACUUM INTO crée une copie cohérente, qu'on supprime une fois envoyée.
    const tmp = path.join(os.tmpdir(), `abraxas_export_${Date.now()}_${process.pid}.db`);
    const sql = `VACUUM INTO '${tmp.replace(/'/g, "''")}'`;

    execFile('sqlite3', ['-cmd', '.timeout 5000', DB_PATH, sql], (err, stdout, stderr) => {
        if (err) {
            console.error('Erreur lors de l\'export :', stderr || err.message);
            return res.status(500).send('Impossible de copier la base de données');
        }
        res.set('Cache-Control', 'no-store');
        res.download(tmp, 'sys.db', () => fs.unlink(tmp, () => {}));
    });
});

exportApp.listen(EXPORT_PORT, '0.0.0.0', () => {
    console.log(`Export de la base prêt sur http://<IP-RASPBERRY>:${EXPORT_PORT}`);
});
