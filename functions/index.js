const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config(); // Carrega .env se estiver local (para testes)

const app = express();
app.use(cors({ origin: true }));

// Função auxiliar para pegar a chave (Local ou Nuvem)
const getApiKey = () => {
    // Tenta pegar do .env (local)
    if (process.env.YOUTUBE_API_KEY) return process.env.YOUTUBE_API_KEY;
    // Se não achar, tenta pegar do cofre do Firebase (nuvem)
    if (functions.config().youtube && functions.config().youtube.key) return functions.config().youtube.key;
    return null;
};

// --- ROTA DE BUSCA ---
app.get('/api/youtube-search', async (req, res) => {
    try {
        const query = req.query.q;
        const apiKey = getApiKey();

        if (!apiKey) {
            console.error("ERRO: API Key não encontrada (Nem .env, nem config)");
            return res.status(500).json({ error: 'Configuração de API ausente' });
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
                'Referer': 'https://flowlink-7fd57.web.app',
                'Origin': 'https://flowlink-7fd57.web.app'
            } 
        });
        res.json(response.data);
    } catch (error) {
        console.error("Erro busca:", error.message);
        res.status(500).json({ error: 'Erro ao buscar no YouTube' });
    }
});

// --- ROTA DE DETALHES ---
app.get('/api/video-info', async (req, res) => {
    try {
        const videoId = req.query.id;
        const apiKey = getApiKey();

        if (!apiKey) return res.status(500).json({ error: 'Configuração de API ausente' });

        const response = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
            params: { part: 'snippet', id: videoId, key: apiKey },
            headers: { 
                'Referer': 'https://flowlink-7fd57.web.app',
                'Origin': 'https://flowlink-7fd57.web.app'
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error("Erro detalhes:", error.message);
        res.status(500).json({ error: 'Erro ao buscar detalhes' });
    }
});

exports.api = functions.https.onRequest(app);