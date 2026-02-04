const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const nodemailer = require('nodemailer');
require('dotenv').config(); // Carrega seu arquivo .env

const app = express();

// Permite conexões de qualquer origem (necessário para o Front-end acessar a Function)
app.use(cors({ origin: true }));
app.use(express.json());

// Função auxiliar para pegar a chave do YouTube
const getApiKey = () => {
    // Tenta pegar do .env, senão tenta da config do Firebase, senão retorna null
    return process.env.YOUTUBE_API_KEY || (functions.config().youtube && functions.config().youtube.key) || null;
};

// ==================================================================
// --- CONFIGURAÇÃO DE EMAIL (REPORT) ---
// ==================================================================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ==================================================================
// --- INTEGRAÇÃO SPOTIFY (COM CACHE DE TOKEN) ---
// ==================================================================
let spotifyToken = null;
let tokenExpiration = 0;

async function getSpotifyToken() {
    const now = Date.now();
    // Se tiver token salvo e ainda for válido, usa ele (evita chamar API a toa)
    if (spotifyToken && now < tokenExpiration) return spotifyToken;

    try {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');

        // URL do Proxy ou Oficial (mantendo a que funcionou no seu local)
        const response = await axios.post('https://accounts.spotify.com/api/token', params, {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        spotifyToken = response.data.access_token;
        // Expira em 50 minutos (token dura 60, margem de segurança)
        tokenExpiration = now + ((response.data.expires_in - 600) * 1000);
        return spotifyToken;
    } catch (error) {
        console.error("Erro ao autenticar no Spotify:", error.message);
        return null;
    }
}

// ==================================================================
// --- ROTA: SPOTIFY RECOMMENDATIONS (VERSÃO BRASIL & DISNEY) ---
// ==================================================================
app.get('/api/spotify-recommendations', async (req, res) => {
    try {
        const { q, genre } = req.query;
        const token = await getSpotifyToken();
        if (!token) return res.status(500).json({ error: 'Erro no token Spotify' });

        const SEARCH_URL = 'https://api.spotify.com/v1/search'; 
        let recommendations = [];

        // CASO 1: Busca por GÊNERO (Dicionário Brasileiro)
        if (genre) {
            const g = genre.toLowerCase().trim();
            
            // Esse mapa garante que Funk = Funk BR, não James Brown
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

            console.log(`🇧🇷 [Firebase] Buscando Gênero: "${termoBusca}"`);

            const searchRes = await axios.get(SEARCH_URL, {
                params: { q: termoBusca, type: 'track', limit: 20, market: 'BR' }, 
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (searchRes.data.tracks && searchRes.data.tracks.items.length > 0) {
                // Embaralha e pega 5
                recommendations = searchRes.data.tracks.items
                    .sort(() => 0.5 - Math.random())
                    .slice(0, 5);
            }
        }

        // CASO 2: Busca por Contexto (Música tocando)
        else if (q) {
            const qLower = q.toLowerCase();
            
            // Lógica Disney / Filmes
            if (qLower.includes('disney') || qLower.includes('moana') || qLower.includes('frozen') || qLower.includes('encanto')) {
                const searchRes = await axios.get(SEARCH_URL, {
                    params: { q: 'disney hits portugues brasil', type: 'track', limit: 10, market: 'BR' },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                recommendations = searchRes.data.tracks.items;
            } 
            else {
                // Busca tracks DO ARTISTA (artist:nome)
                // Isso evita que "Rubel" traga "DJ Slick"
                const searchRes = await axios.get(SEARCH_URL, {
                    params: { q: `artist:${q}`, type: 'track', limit: 10, market: 'BR' },
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!searchRes.data.tracks || searchRes.data.tracks.items.length === 0) {
                    // Fallback: Busca genérica com "Brasil"
                     const searchResBackup = await axios.get(SEARCH_URL, {
                        params: { q: `${q} sucesso brasil`, type: 'track', limit: 10, market: 'BR' },
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    recommendations = searchResBackup.data.tracks.items;
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
        console.error('Erro no Auto DJ Spotify:', error.message);
        // Retorna array vazio pro Front usar o Fallback do YouTube
        res.json([]);
    }
});

// ==================================================================
// --- ROTA: REPORT (COM HTML ESTILIZADO) ---
// ==================================================================
app.post('/api/report', async (req, res) => {
    try {
        const { userReported, reason, room, reporter, roomId } = req.body;
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

        const htmlTemplate = `
            <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 10px;">
                <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                    <div style="text-align: center; border-bottom: 3px solid #ff4444; padding-bottom: 15px; margin-bottom: 20px;">
                        <h1 style="color: #333; margin: 0; font-size: 24px;">🚨 Novo Report Recebido</h1>
                        <p style="color: #666; margin-top: 5px;">Sistema de Moderação FlowLink</p>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                        <tr style="background-color: #fff0f0;">
                            <td style="padding: 12px; border: 1px solid #ffcccc; color: #d32f2f;"><strong>Usuário:</strong></td>
                            <td style="padding: 12px; border: 1px solid #ffcccc; color: #d32f2f; font-weight: bold;">${userReported}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #eee; color: #555;"><strong>Reportado por:</strong></td>
                            <td style="padding: 12px; border: 1px solid #eee; color: #333;">${reporter || "Anônimo"}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #eee; color: #555;"><strong>Motivo:</strong></td>
                            <td style="padding: 12px; border: 1px solid #eee; color: #333;">${reason}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #eee; color: #555;"><strong>Sala:</strong></td>
                            <td style="padding: 12px; border: 1px solid #eee; color: #333;">${room} <br><small style="color:#999">(${roomId || "ID N/A"})</small></td>
                        </tr>
                    </table>
                    <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #aaa; border-top: 1px solid #eee; padding-top: 15px;">
                        <p>📅 Data: ${new Date().toLocaleString('pt-BR')}</p>
                    </div>
                </div>
            </div>
        `;

        const mailOptions = {
            from: `"FlowLink Security" <${process.env.EMAIL_USER}>`,
            to: adminEmail, 
            subject: `🚨 Report: ${userReported} (Sala: ${roomId || '?'})`,
            html: htmlTemplate
        };

        await transporter.sendMail(mailOptions);
        res.status(200).send({ success: true, message: "Report enviado com sucesso!" });
    } catch (error) {
        console.error("Erro ao enviar e-mail:", error);
        res.status(500).send({ error: "Falha ao enviar report" });
    }
});

// ==================================================================
// --- ROTAS YOUTUBE ---
// ==================================================================
app.get('/api/youtube-search', async (req, res) => {
    try {
        const query = req.query.q;
        const apiKey = getApiKey();
        if (!apiKey) return res.status(500).json({ error: 'API Key Ausente no Firebase' });

        // Tenta buscar usando a chave
        const response = await axios.get(`https://www.googleapis.com/youtube/v3/search`, {
            params: { part: 'snippet', maxResults: 15, q: query, key: apiKey, type: 'video' },
            headers: { 'Referer': 'https://flowlink-7fd57.web.app' } // Troque pelo domínio final se mudar
        });
        res.json(response.data);
    } catch (error) {
        console.error("Erro YouTube:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Erro ao buscar no YouTube' }); 
    }
});

app.get('/api/video-info', async (req, res) => {
    try {
        const videoId = req.query.id;
        const apiKey = getApiKey();
        if (!apiKey) return res.status(500).json({ error: 'API Key Ausente' });

        const response = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
            params: { part: 'snippet', id: videoId, key: apiKey },
            headers: { 'Referer': 'https://flowlink-7fd57.web.app' }
        });
        res.json(response.data);
    } catch (error) { res.status(500).json({ error: 'Erro ao buscar detalhes' }); }
});

// Exporta a API
exports.api = functions.https.onRequest(app);