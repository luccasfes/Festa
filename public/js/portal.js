// Entrada do Portal / FlowLink

(function() {
    const params = new URLSearchParams(window.location.search);
    const roomIdFromUrl = params.get('room');

    if (!roomIdFromUrl) {
        const loader = document.getElementById('initialLoader');
        if (loader) loader.style.display = 'none';

        document.body.className = 'theme-transition'; 
        document.body.style.display = 'flex';
        document.body.style.alignItems = 'center';
        document.body.style.justifyContent = 'center';
        document.body.style.minHeight = '100vh';
        document.body.style.margin = '0';
        document.body.style.overflowX = 'hidden';

        document.body.innerHTML = `
            <div class="bg-decoration">
                <div class="shape shape-1"></div>
                <div class="shape shape-2"></div>
                <div class="shape shape-3"></div>
            </div>

            <div class="container landing-wrapper">
                <header class="landing-header">
                    <div class="logo-area">
                        <h1>FlowLink</h1>        
                    </div>
                    <p>Sincronize sua vibe, amplifique a festa.</p>
                </header>

                <main class="glass-card main-panel">
                    <div class="panel-side-info">
                        <div class="icon-pulse">
                            <i class="fas fa-rocket"></i>
                        </div>
                        <h2>Pronto para o Play?</h2>
                        <p>Assista vídeos do YouTube em tempo real com seus amigos. Crie sua sala e controle a playlist de qualquer lugar.</p>
                        <div class="features-list">
                            <span><i class="fas fa-check"></i> Sync Global</span>
                            <span><i class="fas fa-check"></i> Chat Integrado</span>
                            <span><i class="fas fa-check"></i> DJ inteligente</span>
                        </div>
                    </div>

                    <div class="panel-actions">
                        <div class="mobile-only-header">
                             <i class="fas fa-rocket"></i>
                             <h2>Pronto para o Play?</h2>
                        </div>

                        <a href="create.html" class="btn action-btn primary-glow">
                            <i class="fas fa-plus-circle"></i> Criar Nova Sala
                        </a>

                        <div class="fancy-divider">
                            <span>ou acesse via código</span>
                        </div>

                        <div class="join-input-group">
                            <input type="text" id="joinRoomInput" placeholder="Código da sala...">
                            <button class="btn enter-btn" onclick="irParaSala()">
                                <i class="fas fa-arrow-right"></i>
                            </button>
                        </div>
                        
                        <p class="terms-disclaimer">
                            Ao entrar, você concorda com os <a href="#" onclick="abrirTermos(event)">Termos de Uso e Segurança</a>.
                        </p>
                    </div>
                </main>

                <footer class="enhanced-footer">
                    <div class="footer-content">
                        <div class="footer-brand">
                            <i class="fas fa-music"></i> <span>FlowLink</span>
                        </div>
                        <div class="footer-links">
                            <a href="#" onclick="abrirTermos(event)"><i class="fas fa-shield-alt"></i> Termos & Privacidade</a>
                        </div>
                    </div>
                </footer>
            </div>

            <div id="termsModal" class="modal" style="display:none; align-items:center; justify-content:center; z-index:9999;">
                <div class="modal-content" style="max-width: 650px; text-align: left; max-height: 85vh; overflow-y: auto; background: #1a1a1a; border: 1px solid var(--glass-border); border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                    
                    <div class="modal-header" style="justify-content: space-between; display: flex; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <h3 style="margin:0; color:var(--accent-color); font-size: 1.4rem;"><i class="fas fa-file-contract"></i> Termos de Uso</h3>
                        <span class="close-button" onclick="fecharTermos()" style="cursor:pointer; font-size:1.8rem; line-height: 1; color: #aaa;">&times;</span>
                    </div>

                    <div class="terms-body" style="line-height: 1.6; color: #e0e0e0; font-size: 0.95rem; padding-right: 10px;">
                        
                        <p style="margin-bottom: 15px;"><strong>1. Natureza do Serviço:</strong><br>
                        O FlowLink é uma plataforma experimental e gratuita que permite sincronizar a reprodução de vídeos do YouTube entre usuários. O serviço é fornecido "como está", sem garantias de disponibilidade contínua.</p>

                        <p style="margin-bottom: 15px;"><strong>2. Conteúdo e Copyright:</strong><br>
                        Todo o conteúdo exibido vem diretamente do YouTube. O FlowLink não hospeda vídeos. O usuário deve respeitar os Termos de Uso do YouTube.</p>

                        <p style="margin-bottom: 15px;"><strong>3. Privacidade e Dados:</strong><br>
                        As salas podem possuir senha, mas não utilizam criptografia de ponta a ponta. Históricos e dados são voláteis e podem ser apagados a qualquer momento.</p>

                        <div style="background: rgba(255, 152, 0, 0.15); border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; border-radius: 4px;">
                            <strong style="color: #ffb74d;">4. Acesso Administrativo (IMPORTANTE):</strong><br>
                            Para garantir a segurança da plataforma, 
                            <u>os Administradores podem acessar qualquer sala (pública ou privada) a qualquer momento</u> 
                            para fins de moderação e suporte técnico.
                        </div>

                        <p style="margin-bottom: 15px;"><strong>5. Conduta do Usuário:</strong><br>
                        É proibido conteúdo ilegal, ofensivo ou discriminatório. O usuário é o único responsável por suas ações e pelo conteúdo que adiciona à fila.</p>

                        <p style="margin-bottom: 15px;"><strong>6. Moderação:</strong><br>
                        A administração pode banir usuários e encerrar salas a qualquer momento em caso de abuso ou violação destes termos.</p>

                        <p style="margin-bottom: 15px;"><strong>7. Limitação de Responsabilidade:</strong><br>
                        Não nos responsabilizamos por interrupções do serviço, conteúdo exibido por terceiros ou danos decorrentes do uso da plataforma.</p>

                        <div style="background: rgba(33, 150, 243, 0.15); border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 4px;">
                            <strong style="color: #64b5f6;">8. Idade Mínima (13 Anos):</strong><br>
                            Em conformidade com as diretrizes do YouTube, <u>este serviço é restrito a usuários com 13 anos ou mais</u>. 
                            Ao utilizar o FlowLink, você declara ter idade suficiente. O uso por menores deve ser estritamente supervisionado pelos pais ou responsáveis legais.
                        </div>

                        <p style="margin-bottom: 0;"><strong>9. Aceite Automático:</strong><br>
                        Ao continuar utilizando o serviço, você concorda automaticamente com todos os termos acima e suas futuras atualizações.</p>

                    </div>

                    <div style="margin-top: 25px; text-align: right; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                        <button class="btn primary" onclick="fecharTermos()" style="padding: 12px 30px; border-radius: 8px;">Li e Concordo</button>
                    </div>
                </div>
            </div>

            <style>
                /* Estilos existentes mantidos... */
                .bg-decoration { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; overflow: hidden; pointer-events: none; }
                .shape { position: absolute; background: var(--accent-color); opacity: 0.1; filter: blur(50px); border-radius: 50%; animation: floatShape 15s infinite alternate ease-in-out; }
                .shape-1 { width: 400px; height: 400px; top: -100px; right: -50px; }
                .shape-2 { width: 300px; height: 300px; bottom: -50px; left: -50px; animation-delay: -5s; opacity: 0.05; }
                .shape-3 { width: 150px; height: 150px; top: 40%; left: 30%; animation-delay: -2s; background: #fff; }
                @keyframes floatShape { 0% { transform: translate(0, 0) rotate(0deg); } 100% { transform: translate(50px, 100px) rotate(30deg); } }

                .landing-wrapper { width: 95%; max-width: 900px; animation: modalFadeIn 1s cubic-bezier(0.16, 1, 0.3, 1); }
                .main-panel { display: flex; flex-direction: row; padding: 0; overflow: hidden; min-height: 420px; background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 30px; }
                .panel-side-info { flex: 1.2; padding: 50px; background: rgba(255, 255, 255, 0.03); text-align: left; display: flex; flex-direction: column; justify-content: center; border-right: 1px solid rgba(255, 255, 255, 0.05); }
                .panel-actions { flex: 1; padding: 50px; display: flex; flex-direction: column; justify-content: center; gap: 20px; }
                .mobile-only-header { display: none; }

                @media (max-width: 768px) {
                    .main-panel { flex-direction: column; max-width: 400px; margin: 0 auto; }
                    .panel-side-info { display: none; }
                    .panel-actions { padding: 40px 25px; }
                    .mobile-only-header { display: block; text-align: center; margin-bottom: 20px; }
                    .mobile-only-header i { font-size: 2.5rem; color: var(--accent-color); margin-bottom: 10px; }
                    .mobile-only-header h2 { font-size: 1.6rem; color: #fff; margin: 0; }
                }

                .landing-header { text-align: center; margin-bottom: 30px; }
                .logo-area { display: inline-flex; align-items: center; gap: 10px; position: relative; }
                .logo-area h1 { font-size: 3.2rem; font-weight: 800; background: linear-gradient(to right, #fff, var(--accent-color)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; }
                .icon-pulse { width: 60px; height: 60px; background: rgba(99, 102, 241, 0.1); border-radius: 15px; display: flex; align-items: center; justify-content: center; margin-bottom: 25px; font-size: 1.8rem; color: var(--accent-color); border: 1px solid rgba(255,255,255,0.1); }
                .panel-side-info h2 { color: #fff; margin-bottom: 15px; font-size: 1.8rem; }
                .panel-side-info p { color: #94a3b8; line-height: 1.6; margin-bottom: 20px; }
                .features-list { display: flex; gap: 15px; color: var(--accent-color); font-size: 0.85rem; font-weight: 600; }
                .action-btn { padding: 18px !important; border-radius: 18px !important; font-size: 1.1rem !important; font-weight: 700 !important; transition: 0.4s !important; display: flex; align-items: center; justify-content: center; text-decoration: none; }
                .primary-glow { background: var(--accent-color) !important; color: #000 !important; box-shadow: 0 10px 30px -10px var(--accent-color) !important; }
                .fancy-divider { display: flex; align-items: center; color: #475569; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; }
                .fancy-divider::before, .fancy-divider::after { content: ""; flex: 1; height: 1px; background: rgba(255,255,255,0.05); }
                .fancy-divider span { padding: 0 15px; }
                .join-input-group { display: flex; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05); }
                .join-input-group input { flex: 1; background: transparent; border: none; color: #fff; padding: 10px 15px; outline: none; }
                .enter-btn { width: 45px !important; height: 45px !important; border-radius: 15px !important; display: flex; align-items: center; justify-content: center; padding: 0 !important; }
                .terms-disclaimer { font-size: 0.75rem; color: #475569; text-align: center; margin: 0; }
                .terms-disclaimer a { color: #64748b; text-decoration: none; transition: 0.3s; }
                .terms-disclaimer a:hover { color: var(--accent-color); text-decoration: underline; }
                
                .enhanced-footer { margin-top: 40px; padding: 20px; border-top: 1px solid rgba(255,255,255,0.05); }
                .footer-content { display: flex; flex-direction: column; align-items: center; gap: 15px; }
                .footer-brand { color: #fff; opacity: 0.8; display: flex; align-items: center; gap: 8px; font-weight: 600; }
                .footer-links { display: flex; gap: 20px; }
                .footer-links a { color: #64748b; text-decoration: none; font-size: 0.85rem; transition: 0.3s; cursor: pointer; }
                .footer-links a:hover { color: var(--accent-color); }

                @keyframes modalFadeIn { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
            </style>
        `;

        // 3. FUNÇÕES GLOBAIS
        
        window.irParaSala = async function() {
    const input = document.getElementById('joinRoomInput');
    const btn = document.querySelector('.enter-btn');
    if (!input || !btn) return;

    const roomId = input.value.trim();
    if (!roomId) {
        // Mantemos este alert apenas porque o campo está vazio
        alert("Por favor, digite o código da sala.");
        return;
    }

    // Feedback visual de carregamento
    input.disabled = true;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        // Verifica a existência da sala no Firebase
        const snapshot = await firebase.database().ref('rooms/' + roomId).once('value');

        if (snapshot.exists()) {
            // Se existir, vai para a sala
            window.location.href = `index.html?room=${roomId}`;
        } else {
            // SE NÃO EXISTIR: Redireciona para a página visual 404
            console.log("Sala não encontrada, redirecionando...");
            window.location.href = '/404.html'; 
        }
    } catch (error) {
        console.error("Erro técnico:", error);
        // Se as Regras JSON bloquearem (sala inexistente), também vai para o 404
        if (error.code === "PERMISSION_DENIED") {
            window.location.href = '/404.html';
        } else {
            // Erros de internet/conexão
            input.disabled = false;
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-arrow-right"></i>';
            alert("Erro de conexão. Verifique sua internet.");
        }
    }
};

        // Funções do Modal de Termos
        window.abrirTermos = function(e) {
            if(e) e.preventDefault();
            document.getElementById('termsModal').style.display = 'flex';
        };

        window.fecharTermos = function() {
            document.getElementById('termsModal').style.display = 'none';
        };

        // Fechar ao clicar fora
        window.onclick = function(event) {
            const modal = document.getElementById('termsModal');
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };

        // 4. SUPORTE PARA TECLA ENTER
        document.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const input = document.getElementById('joinRoomInput');
                if (document.activeElement === input) {
                    window.irParaSala();
                }
            }
        });
    }
})();