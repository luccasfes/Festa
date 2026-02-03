const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const nodemailer = require('nodemailer');
require('dotenv').config(); 

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

const getApiKey = () => {
    return process.env.YOUTUBE_API_KEY || (functions.config().youtube && functions.config().youtube.key) || null;
};

// Configuração do Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// --- ROTA DE REPORT (AGORA COM ID DA SALA) ---
app.post('/api/report', async (req, res) => {
    try {
        // 1. ADICIONADO "roomId" AQUI
        const { userReported, reason, room, reporter, roomId } = req.body;
        
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

        // HTML Estilizado
        const htmlTemplate = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 10px;">
                <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                    
                    <div style="text-align: center; border-bottom: 3px solid #ff4444; padding-bottom: 15px; margin-bottom: 20px;">
                        <h1 style="color: #333; margin: 0; font-size: 24px;">🚨 Novo Report Recebido</h1>
                        <p style="color: #666; margin-top: 5px;">Sistema de Moderação FlowLink</p>
                    </div>
                    
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px; background-color: #fff;">
                        <tr style="background-color: #fff0f0;">
                            <td style="padding: 12px; border: 1px solid #ffcccc; font-weight: bold; color: #d32f2f;">Usuário Denunciado:</td>
                            <td style="padding: 12px; border: 1px solid #ffcccc; color: #d32f2f; font-weight: bold;">${userReported}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #eee; font-weight: bold; color: #555;">Reportado por:</td>
                            <td style="padding: 12px; border: 1px solid #eee; color: #333;">${reporter || "Anônimo"}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #eee; font-weight: bold; color: #555;">Motivo:</td>
                            <td style="padding: 12px; border: 1px solid #eee; color: #333;">${reason}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #eee; font-weight: bold; color: #555;">Sala:</td>
                            <td style="padding: 12px; border: 1px solid #eee; color: #333;">${room}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #eee; font-weight: bold; color: #555;">ID da Sala:</td>
                            <td style="padding: 12px; border: 1px solid #eee; color: #666; font-family: monospace;">${roomId || "Não identificado"}</td>
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

// --- ROTA DE BUSCA YOUTUBE (Mantida igual) ---
app.get('/api/youtube-search', async (req, res) => {
    try {
        const query = req.query.q;
        const apiKey = getApiKey();
        if (!apiKey) return res.status(500).json({ error: 'Configuração de API ausente' });

        const response = await axios.get(`https://www.googleapis.com/youtube/v3/search`, {
            params: { part: 'snippet', maxResults: 5, q: query, key: apiKey, type: 'video' },
            headers: { 'Referer': 'https://flowlink-7fd57.web.app', 'Origin': 'https://flowlink-7fd57.web.app' } 
        });
        res.json(response.data);
    } catch (error) { res.status(500).json({ error: 'Erro ao buscar no YouTube' }); }
});

// --- ROTA DE DETALHES (Mantida igual) ---
app.get('/api/video-info', async (req, res) => {
    try {
        const videoId = req.query.id;
        const apiKey = getApiKey();
        if (!apiKey) return res.status(500).json({ error: 'Configuração de API ausente' });

        const response = await axios.get(`https://www.googleapis.com/youtube/v3/videos`, {
            params: { part: 'snippet', id: videoId, key: apiKey },
            headers: { 'Referer': 'https://flowlink-7fd57.web.app', 'Origin': 'https://flowlink-7fd57.web.app' }
        });
        res.json(response.data);
    } catch (error) { res.status(500).json({ error: 'Erro ao buscar detalhes' }); }
});

exports.api = functions.https.onRequest(app);