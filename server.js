// server.js
require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const axios = require("axios");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

// Habilitar CORS e JSON
app.use(cors());
app.use(express.json());

// Serve ficheiros estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, "public")));

// ==================================================================
// --- CONFIGURAÇÃO DE EMAIL (REPORT) ---
// ==================================================================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Rota de Report
app.post("/api/report", async (req, res) => {
  try {
    const { userReported, reason, room, roomId, reporter } = req.body;
    console.log(`📩 Recebendo report de ${reporter} sobre ${userReported}`);

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({ error: "Configuração de e-mail ausente" });
    }

    const baseUrl = process.env.SITE_URL || "http://localhost:3000";
    const painelLink = `${baseUrl}/admin.html`;

    const mailOptions = {
      from: `"FlowLink Security" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `🛡️ REPORT: ${room} - Ação Necessária`,
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f7; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-top: 20px; margin-bottom: 20px; }
          .header { background-color: #d32f2f; padding: 20px; text-align: center; color: white; }
          .content { padding: 30px; color: #333333; }
          .info-grid { display: table; width: 100%; margin-bottom: 20px; font-size: 14px; }
          .info-item { display: table-cell; width: 50%; padding-bottom: 10px; color: #666; }
          .info-value { font-weight: bold; color: #333; display: block; margin-top: 4px; }
          .alert-box { background-color: #fff5f5; border-left: 5px solid #d32f2f; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .footer { background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; }
          .btn { display: inline-block; padding: 10px 20px; background-color: #333; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin:0; font-size: 24px;">🚨 Novo Report</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">FlowLink Safety System</p>
          </div>

          <div class="content">
            <p style="margin-top: 0;">Olá Admin,</p>
            <p>Uma nova denúncia foi registrada e requer atenção.</p>

            <div class="alert-box">
              <p style="margin: 0; font-size: 12px; text-transform: uppercase; color: #d32f2f; font-weight: bold;">Usuário Denunciado</p>
              <h3 style="margin: 5px 0 10px 0; color: #333;">${userReported}</h3>

              <p style="margin: 0; font-size: 12px; text-transform: uppercase; color: #d32f2f; font-weight: bold;">Motivo</p>
              <p style="margin: 5px 0 0 0; font-style: italic; color: #555;">"${reason}"</p>
            </div>

            <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;">

            <div class="info-grid">
              <div style="display:table-row">
                <div class="info-item">
                  Reportado por:
                  <span class="info-value">${reporter || "Anônimo"}</span>
                </div>
                <div class="info-item">
                  Data/Hora:
                  <span class="info-value">${new Date().toLocaleString("pt-BR")}</span>
                </div>
              </div>
              <div style="display:table-row">
                <div class="info-item" style="padding-top: 15px;">
                  Nome da Sala:
                  <span class="info-value">${room}</span>
                </div>
                <div class="info-item" style="padding-top: 15px;">
                  ID da Sala:
                  <span class="info-value"><code style="background:#eee; padding:2px 5px; border-radius:3px;">${roomId}</code></span>
                </div>
              </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${painelLink}" class="btn">Acessar Painel</a>
            </div>
          </div>

          <div class="footer">
            <p style="margin:0;">Este é um email automático do FlowLink.</p>
          </div>
        </div>
      </body>
      </html>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao enviar report:", error);
    res.status(500).json({ error: "Falha ao enviar e-mail" });
  }
});

// ==================================================================
// --- CONFIGURAÇÃO DE CHAVES YOUTUBE (ROTAÇÃO) ---
// ==================================================================
const YOUTUBE_KEYS = [process.env.YOUTUBE_API_KEY, process.env.YOUTUBE_API_KEY_2].filter(Boolean);

// (Opcional) Cache simples pra poupar quota e deixar mais rápido
const YT_CACHE_TTL_MS = 60_000; // 1 min
const ytCache = new Map(); // key -> { t, data }

function ytCacheGet(key) {
  const v = ytCache.get(key);
  if (!v) return null;
  if (Date.now() - v.t > YT_CACHE_TTL_MS) {
    ytCache.delete(key);
    return null;
  }
  return v.data;
}
function ytCacheSet(key, data) {
  ytCache.set(key, { t: Date.now(), data });
  if (ytCache.size > 250) {
    const firstKey = ytCache.keys().next().value;
    ytCache.delete(firstKey);
  }
}

async function fetchYoutubeWithFallback(url, params, req) {
  let lastError = null;

  for (let i = 0; i < YOUTUBE_KEYS.length; i++) {
    const currentKey = YOUTUBE_KEYS[i];

    try {
      const response = await axios.get(url, {
        params: { ...params, key: currentKey },
        headers: {
          Referer: req?.headers?.referer || process.env.SITE_URL || "http://localhost:3000",
          Origin: req?.headers?.origin || process.env.SITE_URL || "http://localhost:3000"
        },
        timeout: 12000
      });

      return response.data;
    } catch (error) {
      lastError = error;

      // 403 costuma ser quota/keys restringidas
      if (error.response && error.response.status === 403) {
        console.warn(`⚠️ Chave YouTube ${i + 1} esgotada/limitada. Tentando backup...`);
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
    params.append("grant_type", "client_credentials");

    const response = await axios.post("https://accounts.spotify.com/api/token", params, {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    spotifyToken = response.data.access_token;
    tokenExpiration = now + (response.data.expires_in - 60) * 1000;
    return spotifyToken;
  } catch (error) {
    console.error("Erro ao autenticar no Spotify:", error.message);
    return null;
  }
}

app.get("/api/spotify-genre", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Termo de busca é obrigatório" });

    const token = await getSpotifyToken();
    if (!token) return res.status(500).json({ error: "Falha na autenticação Spotify" });

    // 1. Busca a música
    const searchRes = await axios.get("https://api.spotify.com/v1/search", {
      params: { q: query, type: "track", limit: 1 },
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!searchRes.data.tracks || searchRes.data.tracks.items.length === 0) {
      return res.json({ genres: [] });
    }

    const track = searchRes.data.tracks.items[0];
    const artistId = track.artists[0].id;

    // 2. Busca o Artista
    const artistRes = await axios.get(`https://api.spotify.com/v1/artists/${artistId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    res.json({
      track: track.name,
      artist: track.artists[0].name,
      genres: artistRes.data.genres
    });
  } catch (error) {
    console.error("Erro na rota Spotify:", error.message);
    res.status(500).json({ error: "Erro ao buscar no Spotify" });
  }
});

// ==================================================================
// --- ROTAS YOUTUBE (MELHORADAS) ---
// ==================================================================
app.get("/api/youtube-search", async (req, res) => {
  try {
    const query = (req.query.q || "").toString().trim();
    if (!query) return res.status(400).json({ error: "Termo de busca é obrigatório" });

    // suporta maxResults vindo do front, com limite seguro
    const maxResults = Math.max(1, Math.min(25, parseInt(req.query.maxResults || "15", 10) || 15));

    // cache por 60s (poupa quota, ajuda com debounce)
    const cacheKey = `q:${query.toLowerCase()}|m:${maxResults}`;
    const cached = ytCacheGet(cacheKey);
    if (cached) return res.json({ ...cached, _cached: true });

    const data = await fetchYoutubeWithFallback(
      "https://www.googleapis.com/youtube/v3/search",
      {
        part: "snippet",
        maxResults,
        q: query,
        type: "video",

        // qualidade BR/PT + música
        regionCode: "BR",
        relevanceLanguage: "pt",
        videoCategoryId: "10",
        safeSearch: "none"
      },
      req
    );

    // dedupe por videoId
    if (data?.items?.length) {
      const seen = new Set();
      data.items = data.items.filter((it) => {
        const id = it?.id?.videoId;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    }

    ytCacheSet(cacheKey, data);
    res.json(data);
  } catch (error) {
    console.error("Erro na rota de busca YouTube:", error.message);
    const status = error.response ? error.response.status : 500;
    const ytMsg = error?.response?.data?.error?.message;
    res.status(status).json({ error: ytMsg || "Erro ao buscar no YouTube" });
  }
});

app.get("/api/video-info", async (req, res) => {
  try {
    const videoId = req.query.id;
    if (!videoId) return res.status(400).json({ error: "ID do vídeo é obrigatório" });

    // cache leve também (opcional)
    const cacheKey = `vid:${videoId}`;
    const cached = ytCacheGet(cacheKey);
    if (cached) return res.json({ ...cached, _cached: true });

    const data = await fetchYoutubeWithFallback(
      "https://www.googleapis.com/youtube/v3/videos",
      {
        part: "snippet",
        id: videoId
      },
      req
    );

    ytCacheSet(cacheKey, data);
    res.json(data);
  } catch (error) {
    console.error("Erro na rota de detalhes YouTube:", error.message);
    res.status(500).json({ error: "Erro ao buscar detalhes do vídeo" });
  }
});

// ==================================================================
// --- SPOTIFY RECOMMENDATIONS ---
// ==================================================================
app.get("/api/spotify-recommendations", async (req, res) => {
  try {
    const { q, genre } = req.query;
    const token = await getSpotifyToken();
    if (!token) return res.status(500).json({ error: "Erro no token Spotify" });

    const SEARCH_URL = "https://api.spotify.com/v1/search";
    let recommendations = [];

    // CASO 1: Busca por GÊNERO
    if (genre) {
      const g = genre.toLowerCase().trim();
      let termoBusca = "";

      const mapaBrasileiro = {
        funk: "playlist:funk_hits_brasil funk mandelão",
        sertanejo: "sertanejo universitario top brasil",
        pagode: "pagode churrasco ao vivo",
        samba: "samba raiz brasil",
        eletronica: "alok vintage culture dubdogz brasil",
        rap: "rap nacional trap brasil",
        rock: "rock nacional brasil anos 2000",
        pop: "pop brasil luisa sonza anitta",
        reggaeton: "reggaeton brasil hits"
      };

      termoBusca = mapaBrasileiro[g] || `${g} hits brasil`;
      console.log(`🇧🇷 [Server] Buscando Gênero BR: "${termoBusca}"`);

      const searchRes = await axios.get(SEARCH_URL, {
        params: { q: termoBusca, type: "track", limit: 20, market: "BR" },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (searchRes.data.tracks && searchRes.data.tracks.items.length > 0) {
        recommendations = searchRes.data.tracks.items
          .sort(() => 0.5 - Math.random())
          .slice(0, 5);
      }
    }

    // CASO 2: Busca por Contexto
    else if (q) {
      const qLower = q.toLowerCase();

      if (qLower.includes("disney") || qLower.includes("moana") || qLower.includes("frozen") || qLower.includes("encanto")) {
        const searchRes = await axios.get(SEARCH_URL, {
          params: { q: "disney hits portugues brasil", type: "track", limit: 10, market: "BR" },
          headers: { Authorization: `Bearer ${token}` }
        });
        recommendations = searchRes.data.tracks.items;
      } else {
        const searchRes = await axios.get(SEARCH_URL, {
          params: { q: `artist:${q}`, type: "track", limit: 10, market: "BR" },
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!searchRes.data.tracks || searchRes.data.tracks.items.length === 0) {
          const searchResBackup = await axios.get(SEARCH_URL, {
            params: { q: `${q} sucesso brasil`, type: "track", limit: 10, market: "BR" },
            headers: { Authorization: `Bearer ${token}` }
          });
          recommendations = searchResBackup.data.tracks.items;
        } else {
          recommendations = searchRes.data.tracks.items;
        }
      }
    }

    const tracks = recommendations.map((t) => ({
      title: t.name,
      artist: t.artists[0].name,
      full: `${t.name} - ${t.artists[0].name}`,
      uri: t.uri
    }));

    res.json(tracks);
  } catch (error) {
    console.error("Erro no Auto DJ Spotify:", error.message);
    res.json([]); // vazio pro frontend usar fallback
  }
});

// ==================================================================
// --- SPA fallback ---
// ==================================================================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`🔑 Chaves YouTube configuradas: ${YOUTUBE_KEYS.length}`);
});