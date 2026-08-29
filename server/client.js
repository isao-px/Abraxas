// Fonction de mise à jour
function updateData() {
    const awa_rad = sensorData.awa * (Math.PI / 180);
    const cog_rad = sensorData.cog * (Math.PI / 180);

    // Méchants calculs > cf. le carnet pour le détail
    const tw_x = sensorData.aws * Math.sin(cog_rad + awa_rad) + sensorData.sog * Math.sin(cog_rad);
    const tw_y = sensorData.aws * Math.cos(cog_rad + awa_rad) + sensorData.sog * Math.cos(cog_rad);
    const tws = Math.sqrt(tw_x * tw_x + tw_y * tw_y);
    const twd = Math.atan2(tw_x, tw_y);
    const twa = cog_rad - twd;
    const vmg = sensorData.sog * Math.cos(twa);

    // Entretien du tableau d'affichage. Peut-être créer un historique avec en sql
    displayData.tws = tws;
    displayData.twa = twa * (180 / Math.PI);
    displayData.vmg = vmg;
    displayData.sog = sensorData.sog;
    displayData.pitch = (sensorData.pitch * 90 + 90).toFixed(1);
    displayData.roll = (sensorData.roll * 90).toFixed(1);

    // MàJ du DOM
    document.getElementById('tws').innerText = isNaN(parseFloat(displayData.tws)) ? "--.-" : (displayData.tws).toFixed(1);
    document.getElementById('twa').innerText = isNaN(parseFloat(displayData.twa)) ? "--.-" : (displayData.twa).toFixed(0);
    document.getElementById('vmg').innerText = isNaN(parseFloat(displayData.vmg)) ? "--.-" : (displayData.vmg).toFixed(1);
    document.getElementById('sog').innerText = isNaN(parseFloat(displayData.sog)) ? "--.-" : displayData.sog;
    document.getElementById('pitch').innerText = isNaN(parseFloat(displayData.pitch)) ? "--.-" : displayData.pitch;
    document.getElementById('roll').innerText = isNaN(parseFloat(displayData.roll)) ? "--.-" : displayData.roll;

    // Horizons artificiels
    const pitchLine = document.querySelector('.pitch_line');
    const rollLine = document.querySelector('.roll_line');
    pitchLine.style.transform = `translate(-50%, ${-50 - displayData.pitch}%) rotate(0deg)`;
    rollLine.style.transform = `translate(-50%, -50%) rotate(${-displayData.roll}deg)`;
}
setInterval(updateData, 500); // Fréquence de mise à jour : 2Hz

// Structure des données
const sensorData = {
    'aws': 0, 'awa': 0,
    'sog': 0, 'cog': 0,
    'pitch': 0, 'roll': 0
};
const displayData = {
    'tws': 0, 'twa': 0,
    'sog': 0, 'vmg': 0,
    'pitch': 0, 'roll': 0
}

// Connexion au serveur WebSocket
const socket = io();

// Écouter l'événement de connexion réussie
socket.on('connect', () => {
    document.getElementById('status').innerText = 'Connecté';
    document.getElementById('status').style.color = 'rgb(255 255 255 / 0)';
});

// Écouter les mises à jour de données envoyées par le serveur et les enregistrer dans sensorData
socket.on('update-data', (data) => {
    try {
        const id = Object.keys(data)[0];
        const valeur = data[id];
        if (sensorData.hasOwnProperty(id)) {
            sensorData[id] = valeur;
        }

    } catch (e) {
        console.error("Erreur de parsing JSON :", e);
    }
});

// Gérer la déconnexion
socket.on('disconnect', () => {
    document.getElementById('status').innerText = 'Déconnecté';
    document.getElementById('status').style.color = 'red';

    document.getElementById('tws').innerText = '--.-';
    document.getElementById('twa').innerText = '---';
    document.getElementById('sog').innerText = '--.-';
    document.getElementById('vmg').innerText = '--.-';
    document.getElementById('pitch').innerText = '--.-';
    document.getElementById('roll').innerText = '--.-';

    const rollLine = document.querySelector('.roll_line');
    rollLine.style.transform = `translate(-50%, 0) rotate(0deg)`;

    const pitchLine = document.querySelector('.pitch_line');
    pitchLine.style.transform = `translate(-50%, 0) rotate(0deg)`;
});