/**
 * (Cloud Functions + Express)
 * ARQUITETURA E MELHORIAS IMPLEMENTADAS:
 * ✅ Cache inteligente (60s) - economiza quota do YouTube
 * ✅ Headers dinâmicos - funciona em localhost E produção
 * ✅ Timeout global (12s)
 * ✅ Retry com Exponential Backoff (Spotify)
 * ✅ Sanitização de inputs (proteção XSS)
 * ✅ Health Check Endpoint
 * ✅ Validação robusta de credenciais
 */

const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

// ==================================================================
// --- CONFIGURAÇÃO GLOBAL DO AXIOS ---
// ==================================================================
axios.defaults.timeout = 12000;
axios.defaults.headers.common['User-Agent'] = 'FlowLink/1.0';

// ==================================================================
// --- HELPERS DE CONFIGURAÇÃO ---
// ==================================================================
function getConfig(pathStr, fallbackEnvKey) {
  // Prioridade 1: Variável de ambiente direta (.env local)
  if (fallbackEnvKey && process.env[fallbackEnvKey]) {
    return process.env[fallbackEnvKey];
  }

  // Prioridade 2: Transformar "email.user" em "EMAIL_USER"
  if (pathStr) {
    const envKey = pathStr.toUpperCase().replace(/\./g, "_");
    if (process.env[envKey]) return process.env[envKey];

    // Prioridade 3: functions.config() (Produção Firebase)
    try {
      const [a, b] = pathStr.split(".");
      const v = functions.config()?.[a]?.[b];
      if (v) return v;
    } catch (e) {
      // ignora erro
    }
  }

  return null;
}

function getBaseUrl(req) {
  return (
    getConfig("site.url", "SITE_URL") ||
    req?.headers?.origin ||
    req?.headers?.referer ||
    "http://localhost:3000"
  );
}

function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, ''); // Proteção básica contra XSS
}

// ==================================================================
// --- CONFIGURAÇÃO DE EMAIL (NODEMAILER) ---
// ==================================================================
const EMAIL_USER = getConfig("email.user", "EMAIL_USER");
const EMAIL_PASS = getConfig("email.pass", "EMAIL_PASS");

let transporter = null;
if (EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });
  functions.logger.info("✅ Email configurado com sucesso");
} else {
  functions.logger.warn("⚠️ Credenciais de email não configuradas - reports desabilitados");
}

// ==================================================================
// --- ROTA DE REPORT ---
// ==================================================================
app.post("/api/report", async (req, res) => {
  try {
    if (!transporter) {
      return res.status(503).json({ error: "Serviço de email não configurado" });
    }

    const { userReported, reason, room, roomId, reporter } = req.body || {};
    
    // Sanitiza inputs
    const cleanUserReported = sanitizeString(userReported, 100);
    const cleanReason = sanitizeString(reason, 500);
    const cleanRoom = sanitizeString(room, 100);
    const cleanReporter = sanitizeString(reporter, 100);

    functions.logger.info("📩 Report recebido", {
      reporter: cleanReporter || "Anônimo",
      userReported: cleanUserReported,
      room: cleanRoom,
      roomId
    });

    const baseUrl = getConfig("site.url", "SITE_URL") || "http://localhost:3000";
    // Variável em Inglês (TCC), Valor em Português (Link)
    const adminPanelLink = `${baseUrl}/admin.html`;

    const mailOptions = {
      from: `"FlowLink Security" <${EMAIL_USER}>`,
      to: EMAIL_USER,
      subject: `🛡️ REPORT: ${cleanRoom} - Ação Necessária`,
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
              <h3 style="margin: 5px 0 10px 0; color: #333;">${cleanUserReported || "-"}</h3>

              <p style="margin: 0; font-size: 12px; text-transform: uppercase; color: #d32f2f; font-weight: bold;">Motivo</p>
              <p style="margin: 5px 0 0 0; font-style: italic; color: #555;">"${cleanReason || "-"}"</p>
            </div>

            <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;">

            <div class="info-grid">
              <div style="display:table-row">
                <div class="info-item">
                  Reportado por:
                  <span class="info-value">${cleanReporter || "Anônimo"}</span>
                </div>
                <div class="info-item">
                  Data/Hora:
                  <span class="info-value">${new Date().toLocaleString("pt-BR")}</span>
                </div>
              </div>
              <div style="display:table-row">
                <div class="info-item" style="padding-top: 15px;">
                  Nome da Sala:
                  <span class="info-value">${cleanRoom || "-"}</span>
                </div>
                <div class="info-item" style="padding-top: 15px;">
                  ID da Sala:
                  <span class="info-value"><code style="background:#eee; padding:2px 5px; border-radius:3px;">${roomId || "-"}</code></span>
                </div>
              </div>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${adminPanelLink}" class="btn">Acessar Painel</a>
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
    res.status(200).json({ success: true, message: "Report enviado com sucesso!" });
    
  } catch (error) {
    functions.logger.error("❌ Erro ao enviar report", { error: error.message });
    res.status(500).json({ error: "Falha ao enviar report" });
  }
});

// ==================================================================
// --- YOUTUBE API - CHAVES E CACHE ---
// ==================================================================
const YOUTUBE_KEYS = [
  getConfig("youtube.key1", "YOUTUBE_API_KEY"),
  getConfig("youtube.key2", "YOUTUBE_API_KEY_2")
].filter(Boolean);

if (YOUTUBE_KEYS.length === 0) {
  functions.logger.error("❌ NENHUMA chave do YouTube configurada!");
} else {
  functions.logger.info(`✅ ${YOUTUBE_KEYS.length} chave(s) do YouTube configuradas`);
}

// Cache em Memória (60 segundos) - Aqui estava o erro antes!
const YT_CACHE_TTL_MS = 60_000;
const ytCache = new Map();

function cacheGet(key) {
  const v = ytCache.get(key);
  if (!v) return null;
  
  if (Date.now() - v.t > YT_CACHE_TTL_MS) {
    ytCache.delete(key);
    return null;
  }
  
  return v.data;
}

function cacheSet(key, data) {
  // Remove a chave antiga se existir
  if (ytCache.has(key)) ytCache.delete(key);
  
  ytCache.set(key, { t: Date.now(), data });
  
  // Limita tamanho do cache
  if (ytCache.size > 250) {
    const firstKey = ytCache.keys().next().value;
    ytCache.delete(firstKey);
  }
}

async function fetchYoutubeWithFallback(url, params, req) {
  let lastError = null;

  if (YOUTUBE_KEYS.length === 0) {
    throw new Error("Chaves de API do YouTube não configuradas");
  }

  for (let i = 0; i < YOUTUBE_KEYS.length; i++) {
    const currentKey = YOUTUBE_KEYS[i];

    try {
      const response = await axios.get(url, {
        params: { ...params, key: currentKey },
        headers: {
          Referer: req?.headers?.referer || getBaseUrl(req),
          Origin: req?.headers?.origin || getBaseUrl(req)
        }
      });

      return response.data;
      
    } catch (error) {
      lastError = error;

      if (error.response && error.response.status === 403) {
        functions.logger.warn(`⚠️ Chave YouTube ${i + 1} bloqueada. Tentando backup...`);
        continue;
      }
      
      throw error;
    }
  }

  throw lastError;
}

// ==================================================================
// --- SPOTIFY TOKEN ---
// ==================================================================
let spotifyToken = null;
let tokenExpiration = 0;

async function getSpotifyToken() {
  const now = Date.now();
  if (spotifyToken && now < tokenExpiration) {
    return spotifyToken;
  }

  const clientId = getConfig("spotify.id", "SPOTIFY_CLIENT_ID");
  const clientSecret = getConfig("spotify.secret", "SPOTIFY_CLIENT_SECRET");
  
  if (!clientId || !clientSecret) {
    functions.logger.warn("⚠️ Credenciais Spotify não configuradas");
    return null;
  }

  try {
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");

    // URL ESPECÍFICA DO SEU PROJETO/PROXY (MANTIDA ORIGINAL)
    const response = await axios.post("https://accounts.spotify.com/api/token", params, {
      headers: {
        Authorization: "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    spotifyToken = response.data.access_token;
    tokenExpiration = now + (response.data.expires_in - 60) * 1000;
    
    functions.logger.info("✅ Token Spotify renovado");
    return spotifyToken;
    
  } catch (error) {
    functions.logger.error("❌ Erro ao autenticar no Spotify", { error: error.message });
    return null;
  }
}

// ==================================================================
// --- HELPER: RETRY COM EXPONENTIAL BACKOFF ---
// ==================================================================
async function axiosRetry(config, maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await axios(config);
    } catch (error) {
      if (i === maxRetries) throw error;
      
      // Tenta novamente apenas em erros 5xx (servidor)
      if (error.response && error.response.status >= 500) {
        const delay = Math.min(1000 * Math.pow(2, i), 5000); // 1s, 2s, max 5s
        functions.logger.warn(`Tentativa ${i + 1}/${maxRetries} após ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
}

// ==================================================================
// --- ROTA: SPOTIFY GENRE ---
// ==================================================================
app.get("/api/spotify-genre", async (req, res) => {
  try {
    const query = sanitizeString(req.query.q || "", 200);
    if (!query) {
      return res.status(400).json({ error: "Termo obrigatório" });
    }

    const token = await getSpotifyToken();
    if (!token) {
      return res.status(500).json({ error: "Erro Auth Spotify" });
    }

    // Endpoint oficial da API Spotify

    const searchRes = await axiosRetry({
      method: "get",
      url: "https://api.spotify.com/v1/search",
      params: { q: query, type: "track", limit: 1, market: "BR" },
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!searchRes.data.tracks || searchRes.data.tracks.items.length === 0) {
      return res.json({ genres: [] });
    }

    const track = searchRes.data.tracks.items[0];
    const artistId = track.artists[0].id;

    // URL ESPECÍFICA DO SEU PROJETO (MANTIDA ORIGINAL)
    const artistRes = await axiosRetry({
      method: "get",
      url: `https://api.spotify.com/v1/artists/${artistId}`,
      headers: { Authorization: `Bearer ${token}` }
    });

    res.json({
      track: track.name,
      artist: track.artists[0].name,
      genres: artistRes.data.genres
    });
    
  } catch (error) {
    functions.logger.error("❌ Erro Spotify Genre", { error: error.message });
    res.status(500).json({ error: "Erro interno" });
  }
});

// ==================================================================
// --- ROTA: YOUTUBE SEARCH ---
// ==================================================================
app.get("/api/youtube-search", async (req, res) => {
  try {
    const query = sanitizeString(req.query.q || "", 200);
    
    if (!query || query.length < 2) {
      return res.status(400).json({ error: "Termo de busca muito curto" });
    }

    const maxResults = Math.max(1, Math.min(25, parseInt(req.query.maxResults || "15", 10) || 15));

    const cacheKey = `yt:q:${query.toLowerCase()}|m:${maxResults}`;
    const cached = cacheGet(cacheKey);
    
    if (cached) {
      functions.logger.debug("🎯 YouTube cache HIT", { query, maxResults });
      return res.json({ ...cached, _cached: true });
    }

    functions.logger.info("🔍 Chamada API YouTube", { query, maxResults });
    
    const data = await fetchYoutubeWithFallback(
      "https://www.googleapis.com/youtube/v3/search",
      {
        part: "snippet",
        q: query,
        type: "video",
        maxResults,
        regionCode: "BR",
        relevanceLanguage: "pt",
        videoCategoryId: "10",
        safeSearch: "none"
      },
      req
    );

    if (data?.items?.length) {
      const seen = new Set();
      data.items = data.items.filter((it) => {
        const id = it?.id?.videoId;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      
      functions.logger.info("✅ YouTube search OK", { 
        query, 
        results: data.items.length 
      });
    }

    cacheSet(cacheKey, data);
    res.json(data);
    
  } catch (error) {
    functions.logger.error("❌ YouTube search falhou", { 
      error: error.message,
      query: req.query.q 
    });
    
    const status = error.response?.status || 500;
    const ytMsg = error?.response?.data?.error?.message;
    res.status(status).json({ error: ytMsg || "Erro ao buscar vídeo" });
  }
});

// ==================================================================
// --- ROTA: YOUTUBE VIDEO INFO ---
// ==================================================================
app.get("/api/video-info", async (req, res) => {
  try {
    const videoId = sanitizeString(req.query.id || "", 50);
    
    if (!videoId) {
      return res.status(400).json({ error: "ID obrigatório" });
    }

    const cacheKey = `yt:vid:${videoId}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      return res.json({ ...cached, _cached: true });
    }

    const data = await fetchYoutubeWithFallback(
      "https://www.googleapis.com/youtube/v3/videos",
      {
        part: "snippet",
        id: videoId
      },
      req
    );

    cacheSet(cacheKey, data);
    res.json(data);
    
  } catch (error) {
    functions.logger.error("❌ YouTube info falhou", { error: error.message });
    
    const status = error.response?.status || 500;
    const ytMsg = error?.response?.data?.error?.message;
    res.status(status).json({ error: ytMsg || "Erro ao buscar detalhes" });
  }
});

// ==================================================================
// --- ROTA: SPOTIFY RECOMMENDATIONS ---
// ==================================================================
app.get("/api/spotify-recommendations", async (req, res) => {
  try {
    const q = sanitizeString(req.query.q || "", 200);
    const genre = sanitizeString(req.query.genre || "", 50);
    
    const token = await getSpotifyToken();
    if (!token) {
      return res.json([]); 
    }

    // URL ESPECÍFICA DO SEU PROJETO (MANTIDA ORIGINAL)
    const SEARCH_URL = "https://api.spotify.com/v1/search";
    let recommendations = [];

    // MODO 1: Busca por GÊNERO
    if (genre) {
      const g = genre.toLowerCase().trim();
      
      const brazilianGenreMap = {
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

      const searchTerm = brazilianGenreMap[g] || `${g} hits brasil`;
      functions.logger.info("🇧🇷 Spotify busca por gênero", { genre: g, searchTerm });

      const searchRes = await axiosRetry({
        method: "get",
        url: SEARCH_URL,
        params: { q: searchTerm, type: "track", limit: 20, market: "BR" },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (searchRes.data.tracks?.items?.length) {
        recommendations = searchRes.data.tracks.items
          .sort(() => 0.5 - Math.random())
          .slice(0, 5);
      }
    }
    
    // MODO 2: Busca por CONTEXTO
    else if (q) {
      const qLower = q.toLowerCase();

      if (qLower.includes("disney") || qLower.includes("moana") || 
          qLower.includes("frozen") || qLower.includes("encanto")) {
        
        const searchRes = await axiosRetry({
          method: "get",
          url: SEARCH_URL,
          params: { q: "disney hits portugues brasil", type: "track", limit: 10, market: "BR" },
          headers: { Authorization: `Bearer ${token}` }
        });
        
        recommendations = searchRes.data.tracks?.items || [];
      } 
      
      else {
        const searchRes = await axiosRetry({
          method: "get",
          url: SEARCH_URL,
          params: { q: `artist:${q}`, type: "track", limit: 10, market: "BR" },
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!searchRes.data.tracks?.items?.length) {
          const searchResBackup = await axiosRetry({
            method: "get",
            url: SEARCH_URL,
            params: { q: `${q} sucesso brasil`, type: "track", limit: 10, market: "BR" },
            headers: { Authorization: `Bearer ${token}` }
          });
          
          recommendations = searchResBackup.data.tracks?.items || [];
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
    functions.logger.error("❌ Spotify recommendations falhou", { error: error.message });
    res.json([]); 
  }
});

// ==================================================================
// --- ROTA: HEALTH CHECK ---
// ==================================================================
app.get("/api/health", (req, res) => {
  const status = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    youtube: {
      keysConfigured: YOUTUBE_KEYS.length,
      cacheSize: ytCache.size,
      cacheTTL: `${YT_CACHE_TTL_MS / 1000}s`
    },
    spotify: {
      tokenValid: !!(spotifyToken && Date.now() < tokenExpiration),
      expiresIn: spotifyToken ? Math.max(0, Math.floor((tokenExpiration - Date.now()) / 1000)) : 0
    },
    email: {
      configured: !!(EMAIL_USER && EMAIL_PASS)
    }
  };
  
  res.json(status);
});

// ==================================================================
// --- EXPORTAR CLOUD FUNCTION ---
// ==================================================================
exports.api = functions.https.onRequest(app);