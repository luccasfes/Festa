const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const nodemailer = require('nodemailer');
require('dotenv').config(); // <--- Carrega as variáveis do arquivo .env

const app = express();

// Configurações essenciais do Express
app.use(cors({ origin: true }));
app.use(express.json());

// Função auxiliar para pegar a chave do YouTube
const getApiKey = () => {
    // 1. Tenta pegar do arquivo .env (process.env)
    // 2. Se não achar, tenta pegar do Firebase Config (functions.config)
    return process.env.YOUTUBE_API_KEY || (functions.config().youtube && functions.config().youtube.key) || null;
};

// ==================================================================
// --- CONFIGURAÇÃO DE EMAIL (REPORT) ---
// ==================================================================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Pega do .env
        pass: process.env.EMAIL_PASS  // Pega do .env
    }
});

// --- ROTA DE REPORT ---
app.post('/api/report', async (req, res) => {
    try {
        const { userReported, reason, room } = req.body;
        
        // Define quem recebe o e-mail:
        // Se ADMIN_EMAIL estiver vazio no .env, ele envia para o próprio EMAIL_USER
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

        const mailOptions = {
            from: `"FlowLink Report" <${process.env.EMAIL_USER}>`,
            to: adminEmail, 
            subject: `⚠️ Report de Usuário - Sala: ${room}`,
            html: `
                <h2>Novo Report Recebido</h2>
                <p><strong>Usuário Denunciado:</strong> ${userReported}</p>
                <p><strong>Motivo:</strong> ${reason}</p>
                <p><strong>Sala:</strong> ${room}</p>
                <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            `
        };

        await transporter.sendMail(mailOptions);
        res.status(200).send({ success: true, message: "E-mail enviado!" });
    } catch (error) {
        console.error("Erro ao enviar e-mail:", error);
        res.status(500).send({ error: "Falha ao enviar report" });
    }
});

// --- ROTA DE BUSCA YOUTUBE ---
app.get('/api/youtube-search', async (req, res) => {
    try {
        const query = req.query.q;
        const apiKey = getApiKey();

        if (!apiKey) {
            console.error("ERRO: API Key não encontrada");
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