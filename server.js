// server.js (Versão Simplificada para servir estáticos e desenvolvimento local)
const express = require('express');
const path = require('path');
const cors = require('cors'); 

const app = express();
const PORT = 3000; // Ou qualquer outra porta disponível

// Habilitar CORS (para fins de desenvolvimento local)
app.use(cors());

// Serve ficheiros estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Rota padrão para servir o index.html quando a raiz é acessada
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Abra seu aplicativo em: http://localhost:${PORT}`);
});