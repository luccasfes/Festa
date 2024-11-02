const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

let videoQueue = []; // Fila de vídeos

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve arquivos estáticos

// Endpoint para adicionar vídeo
app.post('/add-video', (req, res) => {
    const { phone, videoUrl } = req.body;
    videoQueue.push({ phone, videoUrl });
    res.send({ message: 'Video added to queue' });
});

// Endpoint para obter vídeos na fila
app.get('/queue', (req, res) => {
    res.send(videoQueue);
});

// Endpoint para obter vídeo atual
app.get('/current-video', (req, res) => {
    const currentVideo = videoQueue[0]; // Simplesmente pega o primeiro vídeo da fila
    res.send(currentVideo);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
