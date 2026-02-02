const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const nodemailer = require('nodemailer'); // <--- 1. Coloque os requires no topo
require('dotenv').config(); 

const app = express();

// 2. Configurações essenciais do Express
app.use(cors({ origin: true }));
app.use(express.json()); // <--- 3. NECESSÁRIO para ler os dados enviados pelo front (req.body)

// Função auxiliar para pegar a chave (Local ou Nuvem)
const getApiKey = () => {
    if (process.env.YOUTUBE_API_KEY) return process.env.YOUTUBE_API_KEY;
    if (functions.config().youtube && functions.config().youtube.key) return functions.config().youtube.key;
    return null;
};

// ==================================================================
// --- CONFIGURAÇÃO DE EMAIL (REPORT) ---
// ==================================================================
// Configure aqui o transporte de e-mail (ANTES das rotas)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        // DICA: Para produção no Firebase, o ideal é usar functions.config().email.user 
        // Mas pode deixar hardcoded aqui se for usar Senha de App e não se importar de expor no código
        user: 'lucs.silva11@gmail.com',  // <--- TROQUE AQUI
        pass: 's3751993l'     // <--- TROQUE AQUI
    }
});

// --- ROTA DE REPORT ---
app.post('/api/report', async (req, res) => {
    try {
        const { userReported, reason, room } = req.body;

        const mailOptions = {
            from: '"FlowLink Report" <seu-email-admin@gmail.com>', // <--- TROQUE AQUI (Mesmo do auth.user)
            to: 'lucs.silva11@gmail.com', // Seu e-mail pessoal que recebe o aviso
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

// 4. A exportação DEVE ser a ÚLTIMA linha
exports.api = functions.https.onRequest(app);