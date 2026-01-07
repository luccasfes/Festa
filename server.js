// server.js (Versão Final e Segura)
require('dotenv').config(); // Carrega as variáveis do .env
const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios'); // Importa o axios para fazer requisições

const app = express();
const PORT = process.env.PORT || 3000;

// Habilitar CORS
app.use(cors());

// Serve ficheiros estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- ROTA 1: BUSCA NO YOUTUBE ---
app.get('/api/youtube-search', async (req, res) => {
    try {
        const query = req.query.q;
        
        if (!query) {
            return res.status(400).json({ error: 'Termo de busca é obrigatório' });
        }

        const apiKey = process.env.YOUTUBE_API_KEY; 
        
        if (!apiKey) {
            console.error('ERRO: API Key não encontrada no .env');
            return res.status(500).json({ error: 'Erro de configuração no servidor' });
        }

        const response = await axios.get(`https://www.googleapis.com/youtube/v3/search`, {
            params: {
                part: 'snippet',
                maxResults: 5,
                q: query,
                key: apiKey,
                type: 'video'
            },
            headers: {
                'Referer': 'http://localhost:3000', 
                'Origin': 'http://localhost:3000'
            }
        });

        res.json(response.data);

    } catch (error) {
        console.error('Erro na rota de busca:', error.message);
        res.status(500).json({ error: 'Erro ao buscar vídeos' });
    }
});

// --- ROTA 2: DETALHES DO VÍDEO (TÍTULO, ETC) ---
app.get('/api/video-info', async (req, res) => {
    try {
        const videoId = req.query.id;
        
        if (!videoId) {
            return res.status(400).json({ error: 'ID do vídeo é obrigatório' });
        }

        const apiKey = process.env.YOUTUBE_API_KEY;

        if (!apiKey) {
            console.error('ERRO: API Key não encontrada no .env');
            return res.status(500).json({ error: 'Erro de configuração no servidor' });
        }

        const response = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
            params: {
                part: 'snippet',
                id: videoId,
                key: apiKey
            },
            headers: {
                'Referer': 'http://localhost:3000',
                'Origin': 'http://localhost:3000'
            }
        });

        res.json(response.data);

    } catch (error) {
        console.error('Erro na rota de detalhes:', error.message);
        res.status(500).json({ error: 'Erro ao buscar detalhes do vídeo' });
    }
});

// Rota padrão para servir o index.html em qualquer outra URL
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});