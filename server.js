const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises; // Importar fs.promises para operações de ficheiro assíncronas
const path = require('path');
const cors = require('cors'); // Importar o middleware cors

const app = express();
const PORT = 3000;

// Habilitar CORS para todas as origens (para fins de desenvolvimento)
// Em ambiente de produção, isto seria restrito a origens específicas.
app.use(cors());

// Middleware para parsear JSON no corpo das requisições
app.use(bodyParser.json());

// CORREÇÃO AQUI: Servir ficheiros estáticos da pasta 'public'
// Certifique-se de que o seu index.html e style.css estão dentro de uma pasta chamada 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- Configuração da Persistência da Fila ---
const QUEUE_FILE = path.join(__dirname, 'queue.json');

// Credenciais de administrador (PARA PROPÓSITOS DE TESTE APENAS, NÃO SEGURO PARA PRODUÇÃO)
const ADMIN_CREDENTIALS = {
    'Joao': 'pebinha',
    'HaazR': 'Tod'
};

// Função para ler a fila do ficheiro JSON
async function readQueue() {
    try {
        const data = await fs.readFile(QUEUE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Se o ficheiro não existe, retorna uma fila vazia e cria o ficheiro
            console.log('queue.json não encontrado, criando um novo ficheiro.');
            await fs.writeFile(QUEUE_FILE, '[]', 'utf8');
            return [];
        }
        console.error('Erro ao ler a fila do ficheiro:', error);
        return []; // Em caso de erro, retorna fila vazia para evitar quebrar a aplicação
    }
}

// Função para escrever a fila no ficheiro JSON
async function writeQueue(queue) {
    try {
        // Escreve a fila formatada para melhor legibilidade
        await fs.writeFile(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf8');
    } catch (error) {
        console.error('Erro ao escrever a fila no ficheiro:', error);
    }
}

// --- Endpoints da API ---

// Endpoint para adicionar vídeo
app.post('/add-video', async (req, res) => {
    const { phone, videoUrl } = req.body;

    if (!phone || !videoUrl) {
        return res.status(400).json({ message: 'Nome e URL do vídeo são obrigatórios.' });
    }

    const queue = await readQueue();
    // Adiciona um ID único baseado no timestamp para facilitar a remoção
    const newVideo = { id: Date.now(), phone, videoUrl }; 
    queue.push(newVideo);
    await writeQueue(queue);

    // Retornar o objeto 'video' na resposta
    res.status(201).json({ message: 'Vídeo adicionado à fila com sucesso!', video: newVideo });
});

// Endpoint para obter vídeos na fila
app.get('/queue', async (req, res) => {
    const queue = await readQueue();
    res.json(queue);
});

// Endpoint para limpar a fila (requer autenticação de admin)
app.post('/clear-queue', async (req, res) => {
    const { adminName, password } = req.body;

    // Verifica as credenciais do administrador
    if (ADMIN_CREDENTIALS[adminName] !== password) {
        return res.status(401).json({ message: 'Credenciais de administrador inválidas.' });
    }

    await writeQueue([]); // Escreve uma fila vazia no ficheiro
    res.json({ message: 'Fila limpa com sucesso!' });
});

// Endpoint para remover um vídeo específico por ID (requer autenticação de admin)
app.delete('/remove-video/:id', async (req, res) => {
    const videoIdToRemove = parseInt(req.params.id); // Converte o ID da URL para número
    const { adminName, password } = req.body; // Pega as credenciais do corpo da requisição

    // Verifica as credenciais do administrador
    if (ADMIN_CREDENTIALS[adminName] !== password) {
        return res.status(401).json({ message: 'Credenciais de administrador inválidas.' });
    }

    let queue = await readQueue();
    const initialLength = queue.length;
    
    // Filtra a fila, removendo o vídeo com o ID correspondente
    queue = queue.filter(video => video.id !== videoIdToRemove);

    if (queue.length === initialLength) {
        // Se o comprimento da fila não mudou, o vídeo não foi encontrado
        return res.status(404).json({ message: 'Vídeo não encontrado ou ID inválido.' });
    }

    await writeQueue(queue); // Salva a fila atualizada
    res.json({ message: 'Vídeo removido com sucesso!' });
});

// Endpoint para obter vídeo atual (ainda pega o primeiro da fila)
app.get('/current-video', async (req, res) => {
    const queue = await readQueue();
    const currentVideo = queue.length > 0 ? queue[0] : null;
    res.json(currentVideo);
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
