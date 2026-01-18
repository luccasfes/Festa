// server.js (Versão Final com Spotify + YouTube)
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

// ==================================================================
// --- INTEGRAÇÃO SPOTIFY (GENRE DETECTION) ---
// ==================================================================
let spotifyToken = null;
let tokenExpiration = 0;

async function getSpotifyToken() {
    const now = Date.now();
    // Se já temos um token válido, usa ele
    if (spotifyToken && now < tokenExpiration) return spotifyToken;

    try {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');

        // Pede um novo token para o Spotify
        const response = await axios.post('https://accounts.spotify.com/api/token', params, {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        spotifyToken = response.data.access_token;
        // Define expiração (diminuímos 60s para segurança)
        tokenExpiration = now + ((response.data.expires_in - 60) * 1000); 
        return spotifyToken;
    } catch (error) {
        console.error("Erro ao pegar token Spotify:", error.response ? error.response.data : error.message);
        return null;
    }
}

// Rota que o seu front-end chama para descobrir o gênero
app.get('/api/spotify-genre', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: 'Termo de busca é obrigatório' });

        const token = await getSpotifyToken();
        if (!token) return res.status(500).json({ error: 'Falha na autenticação Spotify' });

        // 1. Busca a música (Track)
        const searchRes = await axios.get('https://api.spotify.com/v1/search', {
            params: { q: query, type: 'track', limit: 1 },
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!searchRes.data.tracks || searchRes.data.tracks.items.length === 0) {
            return res.json({ genres: [] });
        }

        const track = searchRes.data.tracks.items[0];
        // O gênero fica no Artista, não na música, então pegamos o ID do artista
        const artistId = track.artists[0].id; 

        // 2. Busca o Artista para pegar os gêneros
        const artistRes = await axios.get(`https://api.spotify.com/v1/artists/${artistId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // Retorna tudo para o front-end
        res.json({
            track: track.name,
            artist: track.artists[0].name,
            genres: artistRes.data.genres // Ex: ['sertanejo', 'sertanejo universitario']
        });

    } catch (error) {
        console.error('Erro na rota Spotify:', error.message);
        res.status(500).json({ error: 'Erro ao buscar no Spotify' });
    }
});

// ==================================================================
// --- ROTAS YOUTUBE (ORIGINAIS) ---
// ==================================================================

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