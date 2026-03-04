        const roomsRef = database.ref('rooms');

        let selectedAvatar = 'fas fa-user';
        let notificationTimer = null;

        // ================= LÓGICA DE UI =================

        document.addEventListener('DOMContentLoaded', async () => {
            //Carregar e validar histórico (limpa salas deletadas automaticamente)
            await loadHistory();

            // Toggle de senha
            document.getElementById('privateRoomToggle').addEventListener('change', (e) => {
                const field = document.getElementById('passwordField');
                field.style.display = e.target.checked ? 'block' : 'none';
                if (e.target.checked) document.getElementById('roomPassword').focus();
            });

            // Seleção de Avatar
            const avatars = document.querySelectorAll('.avatar-option');
            avatars.forEach(av => {
                av.addEventListener('click', () => {
                    avatars.forEach(a => a.classList.remove('selected'));
                    av.classList.add('selected');
                    selectedAvatar = av.getAttribute('data-avatar');
                });
            });

            // Check se API share existe
            if (!navigator.share) {
                const shareBtn = document.getElementById('shareBtn');
                if (shareBtn) shareBtn.style.display = 'none';
            }
        });

        // ================= CRIAÇÃO (COM CORREÇÃO DO HASH) =================

        async function validateAndCreateRoom() {
            const creatorName = document.getElementById('creatorName').value.trim();
            const roomNameRaw = document.getElementById('roomName').value.trim();
            const isPrivate = document.getElementById('privateRoomToggle').checked;

            // CORREÇÃO: Variável renomeada para passwordRaw para evitar o erro
            const passwordRaw = document.getElementById('roomPassword').value.trim();

            if (!creatorName) return showNotification('Ei, digite seu nome!', 'error');

            // Verifica o tamanho da senha se for privada
            if (isPrivate && passwordRaw.length < 3) return showNotification('A senha precisa ter pelo menos 3 dígitos.', 'error');

            toggleLoading(true);

            const roomId = generateRoomId();
            const roomName = roomNameRaw || "Sala FlowLink";

            try {
                // GERA O HASH DA SENHA (CRIPTOGRAFIA)
                // Se for privada e tiver senha, cria o hash SHA256. Se não, é null.
                const passwordHash = isPrivate && passwordRaw ? CryptoJS.SHA256(passwordRaw).toString() : null;

                // Objeto da sala aprimorado
                const roomData = {
                    roomName: sanitizeHTML(roomName),
                    creatorName: sanitizeHTML(creatorName),
                    creatorAvatar: selectedAvatar,
                    createdAt: firebase.database.ServerValue.TIMESTAMP,
                    userCount: 0,
                    isPrivate: isPrivate,
                    password: passwordHash 
                };

                await roomsRef.child(roomId).set(roomData);
                // Salva o nome na sessão para não perguntar de novo na próxima tela
                sessionStorage.setItem('ytSessionUser', creatorName);
                // Salvar no Histórico Local
                saveToHistory(roomId, roomName, creatorName);

                // UI Sucesso
                const roomUrl = window.location.origin + window.location.pathname.replace('create.html', 'index.html') + `?room=${roomId}`;
                showSuccessUI(roomUrl);

            } catch (error) {
                console.error(error);
                showNotification('Erro ao criar sala. Tente de novo.', 'error');
            } finally {
                toggleLoading(false);
            }
        }

        // ================= HISTÓRICO LOCAL =================
        function saveToHistory(id, name, creator) {
            let history = JSON.parse(localStorage.getItem('flowlink_history') || '[]');
            // Remove duplicata se já existir
            history = history.filter(h => h.id !== id);
            // Adiciona no topo
            history.unshift({ id, name, creator, date: new Date().getTime() });
            // Mantém só os últimos 3
            if (history.length > 3) history.pop();
            localStorage.setItem('flowlink_history', JSON.stringify(history));
        }

        async function loadHistory() {
            const history = JSON.parse(localStorage.getItem('flowlink_history') || '[]');
            const list = document.getElementById('historyList');
            const section = document.getElementById('historySection');

            if (history.length === 0) {
                section.style.display = 'none';
                return;
            }

            section.style.display = 'block';
            list.innerHTML = '';

            for (const item of history) {
                // VERIFICAÇÃO EM TEMPO REAL: A sala ainda existe no Firebase?
                const snapshot = await roomsRef.child(item.id).once('value');

                if (!snapshot.exists()) {
                    
                    removeFromHistory(item.id);
                    continue;
                }

                const div = document.createElement('div');
                div.className = 'history-item';
                div.style.display = 'flex';
                div.style.alignItems = 'center';
                div.innerHTML = `
            <div style="text-align:left; flex: 1;">
                <div style="font-weight:600; color:white;">${escapeHtml(item.name)}</div>
                <div style="font-size:0.8rem; color:var(--text-secondary);">Criado por você</div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn-rejoin" onclick="rejoinRoom('${item.id}')" style="background: var(--accent-color); color: black;">
                    Entrar <i class="fas fa-chevron-right"></i>
                </button>
                <button class="btn-rejoin" onclick="deleteFromHistory(event, '${item.id}')" style="background: rgba(255,23,68,0.2); color: #ff1744; border-color: rgba(255,23,68,0.3);">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
                list.appendChild(div);
            }
        }

        // Remove apenas do LocalStorage 
        function removeFromHistory(id) {
            let history = JSON.parse(localStorage.getItem('flowlink_history') || '[]');
            history = history.filter(h => h.id !== id);
            localStorage.setItem('flowlink_history', JSON.stringify(history));
            // Se ficou vazio, esconde a seção
            if (history.length === 0) document.getElementById('historySection').style.display = 'none';
        }

        // Remove do LocalStorage e atualiza a interface (chamado pelo botão)
        function deleteFromHistory(event, id) {
            event.stopPropagation(); // Impede de disparar o clique da div pai se houver
            if (confirm('Deseja remover esta sala do seu histórico?')) {
                removeFromHistory(id);
                loadHistory(); // Recarrega a lista visualmente
                showNotification('Sala removida do histórico', 'info');
            }
        }

        function rejoinRoom(id) {
            window.location.href = `index.html?room=${id}`;
        }

        // ================= UTILITÁRIOS =================

        function showSuccessUI(url) {
            document.getElementById('createSection').style.display = 'none';
            document.getElementById('roomCreatedSection').style.display = 'block';

            document.getElementById('roomLink').value = url;
            document.getElementById('goToRoomLink').href = url;
        }

        function createAnotherRoom() {
            document.getElementById('createSection').style.display = 'block';
            document.getElementById('roomCreatedSection').style.display = 'none';
            document.getElementById('roomName').value = '';
            document.getElementById('roomPassword').value = '';
            document.getElementById('privateRoomToggle').checked = false;
            document.getElementById('passwordField').style.display = 'none';
        }

        function generateRoomId() {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
            return result;
        }

        function sanitizeHTML(str) {
            if (!str) return "";
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        function escapeHtml(text) {
            if (!text) return text;
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        function toggleLoading(isLoading) {
            const btn = document.getElementById('createRoomBtn');
            const txt = document.getElementById('createRoomBtnText');
            const loader = document.getElementById('createRoomBtnLoader');
            btn.disabled = isLoading;
            txt.style.display = isLoading ? 'none' : 'inline';
            loader.style.display = isLoading ? 'inline-block' : 'none';
        }

        function showNotification(msg, type = 'info') {
            const el = document.getElementById('notification');
            document.getElementById('notificationMessage').textContent = msg;
            el.className = `notification show ${type}`;
            clearTimeout(notificationTimer);
            notificationTimer = setTimeout(() => el.classList.remove('show'), 3000);
        }

        async function copyLink() {
            const input = document.getElementById('roomLink');
            const btn = document.getElementById('copyBtn');
            try {
                await navigator.clipboard.writeText(input.value);
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i>';
                btn.style.background = 'var(--success-color)';
                showNotification('Link copiado!', 'success');
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                    btn.style.background = '';
                }, 2000);
            } catch (e) {
                input.select();
                document.execCommand('copy');
            }
        }

        function shareLink() {
            if (navigator.share) {
                navigator.share({
                    title: 'FlowLink',
                    text: 'Bora ouvir música juntos!',
                    url: document.getElementById('roomLink').value
                }).catch(console.log);
            }
        }