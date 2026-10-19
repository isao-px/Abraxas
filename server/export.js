const button = document.getElementById('download');
const status = document.getElementById('status');

function pad(n) { return String(n).padStart(2, '0'); }

function fileName() {
    const d = new Date();
    return `abraxas_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
        + `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.db`;
}

function show(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('error', isError);
}

button.addEventListener('click', async () => {
    button.disabled = true;
    show('Préparation du fichier…');

    try {
        const response = await fetch('/sys.db', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error((await response.text()) || `Erreur ${response.status}`);
        }

        const blob = await response.blob();
        const name = fileName();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);

        show(`Fichier téléchargé : ${name} (${(blob.size / 1024).toFixed(0)} Ko)`);
    } catch (e) {
        show(`Échec du téléchargement : ${e.message}. Vérifie que tu es bien connecté au Wi-Fi Abraxas.`, true);
    } finally {
        button.disabled = false;
    }
});

// Vidéos
const videoList = document.getElementById('video-list');
const videoButton = document.getElementById('download-videos');
const stopButton = document.getElementById('stop-videos');
const videoStatus = document.getElementById('video-status');
let videos = [];
let queueRunning = false;
let stopRequested = false;

function showVideo(message, isError = false) {
    videoStatus.textContent = message;
    videoStatus.classList.toggle('error', isError);
}

function formatSize(bytes) {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' Go';
    return (bytes / 1024 / 1024).toFixed(0) + ' Mo';
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function selectedVideos() {
    const result = [];
    for (const box of videoList.querySelectorAll('input:checked')) {
        result.push(videos.find((v) => v.id === Number(box.value)));
    }
    return result;
}

function updateVideoButton() {
    const chosen = selectedVideos();
    let total = 0;
    for (const v of chosen) total += v.size;
    videoButton.disabled = queueRunning || chosen.length === 0;
    if (chosen.length === 0) videoButton.textContent = 'Télécharger les vidéos sélectionnées';
    else videoButton.textContent = `Télécharger ${chosen.length} vidéo${chosen.length > 1 ? 's' : ''} (${formatSize(total)})`;
}

function addVideoRow(video) {
    const label = document.createElement('label');
    label.className = 'video';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.value = video.id;
    const text = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = video.name ? video.name : `Session ${video.id}`;
    const detail = document.createElement('small');
    const date = String(video.start).slice(0, 16).replace('T', ' ');
    if (video.state === 'ok') {
        detail.textContent = `${date} – ${formatSize(video.size)}`;
        box.addEventListener('change', updateVideoButton);
    } else {
        label.classList.add('off');
        box.disabled = true;
        detail.textContent = date + (video.state === 'busy' ? ' – session en cours ou vidéo en cours de fusion' : ' – pas de vidéo');
    }
    text.append(title, detail);
    label.append(box, text);
    videoList.append(label);
}

async function loadVideos() {
    try {
        const response = await fetch('/api/videos', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Erreur ${response.status}`);
        videos = await response.json();
        videoList.textContent = '';
        if (videos.length === 0) videoList.textContent = 'Aucune session enregistrée.';
        for (const video of videos) addVideoRow(video);
        updateVideoButton();
    } catch (e) {
        videoList.textContent = `Impossible de lire la liste : ${e.message}. Vérifie que tu es bien connecté au Wi-Fi Abraxas.`;
    }
}

// > Dans les téléchargements de l'app
function startDownload(id) {
    const link = document.createElement('a');
    link.href = `/video/${id}`;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    link.remove();
}

// Gestion de l'attente
async function waitForTransfer(id) {
    let started = false;
    let waited = 0;
    let failures = 0;
    while (true) {
        await sleep(1500);
        try {
            const response = await fetch('/api/transfers', { cache: 'no-store' });
            const active = await response.json();
            failures = 0;
            if (active.includes(id)) started = true;
            else if (started) return;
            else {
                waited += 1.5;
                if (waited > 15) return; // l'envoi n'a jamais démarré (refus ou erreur)
            }
        } catch (e) {
            failures += 1;
            if (failures >= 5) return;
        }
    }
}

videoButton.addEventListener('click', async () => {
    const chosen = selectedVideos();
    queueRunning = true;
    stopRequested = false;
    stopButton.hidden = false;
    updateVideoButton();

    for (let i = 0; i < chosen.length; i++) {
        if (stopRequested) break;
        const v = chosen[i];
        showVideo(`Vidéo ${i + 1} sur ${chosen.length} : session ${v.id} (${formatSize(v.size)}) en cours d'envoi…`);
        startDownload(v.id);
        await waitForTransfer(v.id);
    }

    queueRunning = false;
    stopButton.hidden = true;
    showVideo(stopRequested ? 'File arrêtée.' : 'Terminé. Les vidéos sont dans les téléchargements de cet appareil.');
    updateVideoButton();
});

stopButton.addEventListener('click', () => {
    stopRequested = true;
    showVideo("Arrêt après la vidéo en cours…");
});

loadVideos();
