const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const nodemailer = require('nodemailer');
require('dotenv').config(); 

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

// ==================================================================
// --- CONFIGURAÇÃO DE VARIÁVEIS DE AMBIENTE (FIREBASE) ---
// ==================================================================
// Pega do arquivo .env local ou das configurações do Firebase
const getConfig = (key, nestedKey) => {
    return process.env[key] || (functions.config()[nestedKey ? nestedKey.split('.')[0] : 'env']?.[nestedKey ? nestedKey.split('.')[1] : key]) || null;
};

// ==================================================================
// --- CONFIGURAÇÃO DE EMAIL (REPORT) ---
// ==================================================================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: getConfig('EMAIL_USER', 'email.user'),
        pass: getConfig('EMAIL_PASS', 'email.pass')
    }
});

// Rota de Report (Igual ao server.js)
app.post('/api/report', async (req, res) => {
    try {
        const { userReported, reason, room, roomId, reporter } = req.body;
        const emailUser = getConfig('EMAIL_USER', 'email.user');

        if (!emailUser) {
            return res.status(500).json({ error: "Configuração de e-mail ausente" });
        }

        const mailOptions = {
            from: `"FlowLink System" <${emailUser}>`,
            to: emailUser,
            subject: `⚠️ REPORT: ${room}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <h2 style="color: #d32f2f;">🚨 Novo Report de Usuário</h2>
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                        <p><strong>Quem Reportou:</strong> ${reporter || 'Anônimo'}</p>
                        <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                        <p><strong>Sala:</strong> ${room}</p>
                        <p><strong>ID da Sala:</strong> <code>${roomId}</code></p>
                    </div>
                    <div style="background: #fff0f0; padding: 15px; border-radius: 5px; border: 1px solid #ffcdd2;">
                        <p style="font-size: 1.1em;"><strong>Usuário Denunciado:</strong> ${userReported}</p>
                        <p><strong>Motivo:</strong></p>
                        <blockquote style="border-left: 4px solid #d32f2f; padding-left: 10px; color: #555;">
                            ${reason}
                        </blockquote>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.status(200).send({ success: true, message: "Report enviado com sucesso!" });
    } catch (error) {
        console.error("Erro ao enviar report:", error);
        res.status(500).send({ error: "Falha ao enviar report" });
    }
});

// ==================================================================
// --- CONFIGURAÇÃO DE CHAVES YOUTUBE (ROTAÇÃO) ---
// ==================================================================

const YOUTUBE_KEYS = [
    getConfig('YOUTUBE_API_KEY', 'youtube.key1'),
    getConfig('YOUTUBE_API_KEY_2', 'youtube.key2')
].filter(key => !!key);

async function fetchYoutubeWithFallback(url, params) {
    let lastError = null;

    if (YOUTUBE_KEYS.length === 0) {
        console.error("Nenhuma chave do YouTube configurada!");
        throw new Error("Chaves de API ausentes");
    }

    for (let i = 0; i < YOUTUBE_KEYS.length; i++) {
        const currentKey = YOUTUBE_KEYS[i];

        try {
            const response = await axios.get(url, {
                params: { ...params, key: currentKey },
                headers: {
                    'Referer': 'https://flowlink-7fd57.web.app',
                    'Origin': 'https://flowlink-7fd57.web.app'
                }
            });
            return response.data;

        } catch (error) {
            lastError = error;
            if (error.response && error.response.status === 403) {
                console.warn(`⚠️ Chave YouTube ${i + 1} esgotada. Tentando backup...`);
                continue;
            } else {
                throw error;
            }
        }
    }
    throw lastError;
}

// ==================================================================
// --- INTEGRAÇÃO SPOTIFY (USANDO SUAS URLS ESPECÍFICAS) ---
// ==================================================================
let spotifyToken = null;
let tokenExpiration = 0;

async function getSpotifyToken() {
    const now = Date.now();
    if (spotifyToken && now < tokenExpiration) return spotifyToken;

    const clientId = getConfig('SPOTIFY_CLIENT_ID', 'spotify.id');
    const clientSecret = getConfig('SPOTIFY_CLIENT_SECRET', 'spotify.secret');

    if (!clientId || !clientSecret) return null;

    try {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');

        // URL ESPECÍFICA DO SEU SERVER.JS
        const response = await axios.post('https://accounts.spotify.com/api/token', params, {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        spotifyToken = response.data.access_token;
        tokenExpiration = now + ((response.data.expires_in - 60) * 1000);
        return spotifyToken;
    } catch (error) {
        console.error("Erro ao autenticar no Spotify:", error.message);
        return null;
    }
}

app.get('/api/spotify-genre', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: 'Termo obrigatório' });

        const token = await getSpotifyToken();
        if (!token) return res.status(500).json({ error: 'Erro Auth Spotify' });

        // URL ESPECÍFICA DO SEU SERVER.JS (Busca Track)
        const searchRes = await axios.get('https://api.spotify.com/v1/search', {
            params: { q: query, type: 'track', limit: 1 },
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!searchRes.data.tracks || searchRes.data.tracks.items.length === 0) {
            return res.json({ genres: [] });
        }

        const track = searchRes.data.tracks.items[0];
        const artistId = track.artists[0].id;

        // URL ESPECÍFICA DO SEU SERVER.JS (Busca Artista)
        // Nota: Ajustei a sintaxe da string template que estava quebrada no original ({artistId} vs ${artistId})
        const artistRes = await axios.get(`https://api.spotify.com/v1/artists/$${artistId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        res.json({
            track: track.name,
            artist: track.artists[0].name,
            genres: artistRes.data.genres
        });

    } catch (error) {
        console.error('Erro Spotify Genre:', error.message);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// ==================================================================
// --- ROTAS YOUTUBE (COM FALLBACK) ---
// ==================================================================

app.get('/api/youtube-search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: 'Termo de busca é obrigatório' });

        const data = await fetchYoutubeWithFallback('https://www.googleapis.com/youtube/v3/search', {
            part: 'snippet',
            maxResults: 5, 
            q: query,
            type: 'video'
        });
        res.json(data);
    } catch (error) {
        console.error('Erro YouTube Search:', error.message);
        const status = error.response ? error.response.status : 500;
        res.status(status).json({ error: 'Erro ao buscar vídeo' });
    }
});

app.get('/api/video-info', async (req, res) => {
    try {
        const videoId = req.query.id;
        if (!videoId) return res.status(400).json({ error: 'ID obrigatório' });

        const data = await fetchYoutubeWithFallback('https://www.googleapis.com/youtube/v3/videos', {
            part: 'snippet',
            id: videoId
        });
        res.json(data);
    } catch (error) {
        console.error('Erro YouTube Info:', error.message);
        res.status(500).json({ error: 'Erro ao buscar detalhes' });
    }
});

// ==================================================================
// --- SPOTIFY RECOMMENDATIONS (COM URLS DO SERVER.JS) ---
// ==================================================================

app.get('/api/spotify-recommendations', async (req, res) => {
    try {
        const { q, genre } = req.query;
        const token = await getSpotifyToken();
        if (!token) return res.json([]); 

        // URL ESPECÍFICA DO SEU SERVER.JS
        const SEARCH_URL = 'https://api.spotify.com/v1/search'; 
        let recommendations = [];

        if (genre) {
            const g = genre.toLowerCase().trim();
            const mapaBrasileiro = {
                'funk': 'playlist:funk_hits_brasil funk mandelão',
                'sertanejo': 'sertanejo universitario top brasil',
                'pagode': 'pagode churrasco ao vivo',
                'samba': 'samba raiz brasil',
                'eletronica': 'alok vintage culture dubdogz brasil',
                'rap': 'rap nacional trap brasil',
                'rock': 'rock nacional brasil anos 2000',
                'pop': 'pop brasil luisa sonza anitta',
                'reggaeton': 'reggaeton brasil hits'
            };
            const termoBusca = mapaBrasileiro[g] || `${g} hits brasil`;

            const searchRes = await axios.get(SEARCH_URL, {
                params: { q: termoBusca, type: 'track', limit: 20, market: 'BR' }, 
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (searchRes.data.tracks && searchRes.data.tracks.items.length > 0) {
                recommendations = searchRes.data.tracks.items
                    .sort(() => 0.5 - Math.random())
                    .slice(0, 5); 
            }
        }
        else if (q) {
            const qLower = q.toLowerCase();
            if (qLower.includes('disney') || qLower.includes('moana') || qLower.includes('frozen')) {
                const searchRes = await axios.get(SEARCH_URL, {
                    params: { q: 'disney hits portugues brasil', type: 'track', limit: 10, market: 'BR' },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                recommendations = searchRes.data.tracks?.items || [];
            } else {
                 // Tenta por Artista
                const searchRes = await axios.get(SEARCH_URL, {
                    params: { q: `artist:${q}`, type: 'track', limit: 10, market: 'BR' },
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!searchRes.data.tracks || searchRes.data.tracks.items.length === 0) {
                     // Fallback genérico
                      const searchResBackup = await axios.get(SEARCH_URL, {
                        params: { q: `${q} sucesso brasil`, type: 'track', limit: 10, market: 'BR' },
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    recommendations = searchResBackup.data.tracks?.items || [];
                } else {
                    recommendations = searchRes.data.tracks.items;
                }
            }
        }

        const tracks = recommendations.map(t => ({
            title: t.name,
            artist: t.artists[0].name,
            full: `${t.name} - ${t.artists[0].name}`,
            uri: t.uri
        }));

        res.json(tracks);

    } catch (error) {
        console.error('Erro Auto DJ Spotify:', error.message);
        res.json([]); 
    }
});

exports.api = functions.https.onRequest(app);