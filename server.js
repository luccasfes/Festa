// server.js 
require('dotenv').config(); 
const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const nodemailer = require('nodemailer'); // <--- 1. Adicionado Nodemailer

const app = express();
const PORT = process.env.PORT || 3000;

// Habilitar CORS e JSON
app.use(cors());
app.use(express.json()); // <--- 2.  Necessário para ler o corpo do POST (req.body)

// Serve ficheiros estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// ==================================================================
// --- CONFIGURAÇÃO DE EMAIL (REPORT) ---
// ==================================================================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Lê do arquivo .env
        pass: process.env.EMAIL_PASS  // Lê do arquivo .env
    }
});

// Rota de Report 
app.post('/api/report', async (req, res) => {
    try {
        // Recebe os novos campos: roomId e reporter
        const { userReported, reason, room, roomId, reporter } = req.body;
        
        console.log(`📩 Recebendo report de ${reporter} sobre ${userReported}`);

        // Verificação de segurança das chaves (mantida)
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            return res.status(500).json({ error: "Configuração de e-mail ausente" });
        }

        const mailOptions = {
            from: `"FlowLink System" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER, 
            subject: `⚠️ REPORT: ${room}`,
            // HTML atualizado com as novas informações
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <h2 style="color: #d32f2f;">🚨 Novo Report de Usuário</h2>
                    
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                        <p><strong>Quem Reportou:</strong> ${reporter}</p>
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
                    
                    <p style="font-size: 0.8em; color: #888; margin-top: 20px;">Enviado automaticamente pelo sistema FlowLink.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true });
    } catch (error) {
        console.error("Erro ao enviar report:", error);
        res.status(500).json({ error: 'Falha ao enviar e-mail' });
    }
});

// ==================================================================
// --- CONFIGURAÇÃO DE CHAVES YOUTUBE (ROTAÇÃO) ---
// ==================================================================

const YOUTUBE_KEYS = [
    process.env.YOUTUBE_API_KEY,
    process.env.YOUTUBE_API_KEY_2
].filter(key => !!key);

async function fetchYoutubeWithFallback(url, params) {
    let lastError = null;

    for (let i = 0; i < YOUTUBE_KEYS.length; i++) {
        const currentKey = YOUTUBE_KEYS[i];
        
        try {
            const response = await axios.get(url, {
                params: { ...params, key: currentKey },
                headers: {
                    'Referer': 'http://localhost:3000',
                    'Origin': 'http://localhost:3000'
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
// --- INTEGRAÇÃO SPOTIFY ---
// ==================================================================
let spotifyToken = null;
let tokenExpiration = 0;

async function getSpotifyToken() {
    const now = Date.now();
    if (spotifyToken && now < tokenExpiration) return spotifyToken;

    try {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');

        // URL Oficial do Spotify para Token
        const response = await axios.post('https://accounts.spotify.com/api/token', params, {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64'),
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
        if (!query) return res.status(400).json({ error: 'Termo de busca é obrigatório' });

        const token = await getSpotifyToken();
        if (!token) return res.status(500).json({ error: 'Falha na autenticação Spotify' });

        // 1. Busca a música (URL Oficial)
        const searchRes = await axios.get('https://api.spotify.com/v1/search', {
            params: { q: query, type: 'track', limit: 1 },
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!searchRes.data.tracks || searchRes.data.tracks.items.length === 0) {
            return res.json({ genres: [] });
        }

        const track = searchRes.data.tracks.items[0];
        const artistId = track.artists[0].id; 

        // 2. Busca o Artista (URL Oficial)
        const artistRes = await axios.get(`https://api.spotify.com/v1/artists/${artistId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        res.json({
            track: track.name,
            artist: track.artists[0].name,
            genres: artistRes.data.genres 
        });

    } catch (error) {
        console.error('Erro na rota Spotify:', error.message);
        res.status(500).json({ error: 'Erro ao buscar no Spotify' });
    }
});

// ==================================================================
// --- ROTAS YOUTUBE ---
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
        console.error('Erro na rota de busca YouTube:', error.message);
        const status = error.response ? error.response.status : 500;
        res.status(status).json({ error: 'Todas as cotas do YouTube foram excedidas.' });
    }
});

app.get('/api/video-info', async (req, res) => {
    try {
        const videoId = req.query.id;
        if (!videoId) return res.status(400).json({ error: 'ID do vídeo é obrigatório' });

        const data = await fetchYoutubeWithFallback('https://www.googleapis.com/youtube/v3/videos', {
            part: 'snippet',
            id: videoId
        });

        res.json(data);

    } catch (error) {
        console.error('Erro na rota de detalhes YouTube:', error.message);
        res.status(500).json({ error: 'Erro ao buscar detalhes do vídeo' });
    }
});

// ==================================================================
// --- SPOTIFY RECOMMENDATIONS ---
// ==================================================================

app.get('/api/spotify-recommendations', async (req, res) => {
    try {
        const { q, genre } = req.query; 
        const token = await getSpotifyToken();
        if (!token) return res.status(500).json({ error: 'Erro no token Spotify' });

        let recommendations = [];

        // CASO 1: Busca por GÊNERO
        if (genre) {
            const mapGeneros = {
                'sertanejo': 'sertanejo,brazilian',
                'funk': 'funk,baile-funk',
                'pop': 'pop,pop-film',
                'rock': 'rock,hard-rock',
                'eletronica': 'edm,dance,house',
                'rap': 'hip-hop,rap',
                'pagode': 'pagode,samba',
                'reggaeton': 'reggaeton,latin'
            };
            
            const seed = mapGeneros[genre] || genre;

            // URL Oficial Recommendations
            const recRes = await axios.get('https://api.spotify.com/v1/recommendations', {
                params: { 
                    seed_genres: seed, 
                    limit: 5,
                    min_popularity: 60, 
                    target_energy: 0.7
                },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            recommendations = recRes.data.tracks;
        } 
        
        // CASO 2: Busca por SIMILARIDADE (Auto DJ)
        else if (q) {
            const qLower = q.toLowerCase();
            let seedGenres = '';
            
            if (qLower.includes('disney') || qLower.includes('moana') || qLower.includes('frozen')) {
                seedGenres = 'disney,show-tunes,soundtracks';
            } else if (qLower.includes('shrek')) {
                seedGenres = 'work-out,soundtracks'; 
            }

            if (seedGenres) {
                const recRes = await axios.get('https://api.spotify.com/v1/recommendations', {
                    params: { seed_genres: seedGenres, limit: 5, min_popularity: 50 },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                recommendations = recRes.data.tracks;
            } 
            
            // Se não for contexto especial, busca ID da música
            if (recommendations.length === 0) {
                const searchRes = await axios.get('https://api.spotify.com/v1/search', {
                    params: { q: q, type: 'track', limit: 1 },
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (searchRes.data.tracks.items.length > 0) {
                    const trackId = searchRes.data.tracks.items[0].id;
                    const recRes = await axios.get('https://api.spotify.com/v1/recommendations', {
                        params: { seed_tracks: trackId, limit: 5 },
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    recommendations = recRes.data.tracks;
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
        console.error('Erro no Auto DJ Spotify:', error.message);
        res.json([]); 
    }
});


app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`🔑 Chaves YouTube configuradas: ${YOUTUBE_KEYS.length}`);
});