const mqtt = require('mqtt');
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 1. Servir les différents fichiers
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'client.html'));
});
app.get('/roll.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'roll.png'));
});
app.get('/pitch.png', (req, res) => {
    res.sendFile(path.join(__dirname, 'pitch.png'));
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
        const value = buffer.toString();
        try {
            const data = {
                id: id,
                value: value
            }
            io.emit('update-data', JSON.stringify(data));
        } catch (error) {
            console.error('Erreur lors du transfert :', error);
        }
}});

// Démarrage du serveur sur le port 3000
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur prêt. Accessible sur http://<IP-RASPBERRY>:${PORT}`);
});