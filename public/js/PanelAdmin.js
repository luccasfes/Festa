
        const auth = firebase.auth();
        const roomsRef = database.ref('rooms');

        // ADMIN IDS
        const ADMIN_UIDS = [
            'PTkwuSLcpaRvtVWOzJH79NrwReA2',
            'liOoyPGRKHgYX1Q81irll97kBSD3',
            'QwUYZ2Ls20fDtlUFDXs5lKjouN12'
        ];

        let selectedRoomId = null;
        let allRoomsRaw = {}; 

        // --- AUTH ---
        auth.onAuthStateChanged(user => {
            if (user && ADMIN_UIDS.includes(user.uid)) {
                document.getElementById('loginView').style.display = 'none';
                document.getElementById('dashboardView').style.display = 'block';
                startRealTimeListener();
            } else {
                document.getElementById('loginView').style.display = 'flex';
                document.getElementById('dashboardView').style.display = 'none';
                if(user) auth.signOut(); 
            }
        });

        function adminLogin() {
            const email = document.getElementById('adminEmail').value;
            const pass = document.getElementById('adminPassword').value;
            auth.signInWithEmailAndPassword(email, pass).catch(e => alert(e.message));
        }

        // --- REALTIME LISTENER ---
        function startRealTimeListener() {
            roomsRef.on('value', snapshot => {
                allRoomsRaw = {}; 
                if(snapshot.exists()) {
                    snapshot.forEach(child => {
                        allRoomsRaw[child.key] = child.val();
                    });
                }
                updateGlobalStats();
                updateRoomsList();
                
                // Atualiza o modal aberto em tempo real
                if(currentRoomId && allRoomsRaw[currentRoomId]) {
                    const room = allRoomsRaw[currentRoomId];
                    renderUserList(room.presence, room.banned, currentRoomId);
                    renderQueueList(room.videoQueue);
                }
            });
        }

        function updateGlobalStats() {
            let stats = { rooms: 0, users: 0, videos: 0 };
            Object.values(allRoomsRaw).forEach(room => {
                stats.rooms++;
                stats.users += room.presence ? Object.keys(room.presence).length : 0;
                stats.videos += room.videoQueue ? Object.keys(room.videoQueue).length : 0;
            });
            document.getElementById("totalRooms").innerText = stats.rooms;
            document.getElementById("totalUsers").innerText = stats.users;
            document.getElementById("totalVideos").innerText = stats.videos;
        }

        // --- RENDERIZAÇÃO E FILTRAGEM ---
        function updateRoomsList() {
            const grid = document.getElementById('roomsGrid');
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const sortType = document.getElementById('sortFilter').value;

            grid.innerHTML = '';

            let roomsArray = Object.entries(allRoomsRaw).map(([key, val]) => ({
                id: key, ...val,
                userCount: val.presence ? Object.keys(val.presence).length : 0,
                queueCount: val.videoQueue ? Object.keys(val.videoQueue).length : 0,
                createdAt: val.createdAt || 0
            }));

            // Filtros
            roomsArray = roomsArray.filter(r => 
                (r.roomName && r.roomName.toLowerCase().includes(searchTerm)) ||
                (r.id.toLowerCase().includes(searchTerm)) ||
                (r.creatorName && r.creatorName.toLowerCase().includes(searchTerm))
            );

            // Ordenação
            roomsArray.sort((a, b) => {
                if (sortType === 'newest') return b.createdAt - a.createdAt;
                if (sortType === 'oldest') return a.createdAt - b.createdAt;
                if (sortType === 'mostUsers') return b.userCount - a.userCount;
                if (sortType === 'mostSongs') return b.queueCount - a.queueCount;
                return 0;
            });

            if (roomsArray.length === 0) {
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:50px; color:var(--text-muted);">Nenhuma sala encontrada.</div>';
                return;
            }

            roomsArray.forEach(room => {
                const timeAgo = timeSince(room.createdAt || Date.now());
                
                // Lógica da Música Tocando
                let nowPlayingHTML = '';
                if (room.videoQueue) {
                    const firstVideo = Object.values(room.videoQueue)[0];
                    nowPlayingHTML = `
                        <div class="now-playing">
                            <div class="music-wave">
                                <div class="bar"></div><div class="bar"></div><div class="bar"></div>
                            </div>
                            <div class="song-info">${escapeHtml(firstVideo.title)}</div>
                        </div>`;
                } else {
                    nowPlayingHTML = `<div class="now-playing" style="opacity:0.5;"><i class="fas fa-pause" style="font-size:0.8rem;"></i> <span style="font-size:0.9rem; margin-left:10px;">Nada tocando</span></div>`;
                }

                // Avatares
                let avatarsHTML = '';
                if (room.presence) {
                    const users = Object.values(room.presence);
                    const displayUsers = users.slice(0, 4);
                    displayUsers.forEach((u, i) => {
                        const initial = (u.name || '?').charAt(0).toUpperCase();
                        const color = ['#6366f1', '#ec4899', '#10b981', '#f59e0b'][i % 4];
                        avatarsHTML += `<div class="user-avatar-sm" style="background:${color}; z-index:${10-i}">${initial}</div>`;
                    });
                    if (users.length > 4) {
                        avatarsHTML += `<div class="user-avatar-sm" style="background:#334155; z-index:0">+${users.length - 4}</div>`;
                    }
                }

                const statusDot = room.userCount > 0 ? '<div class="pulse-dot"></div>' : '<div class="pulse-dot" style="background:#475569; animation:none;"></div>';

                const card = document.createElement('div');
                card.className = 'glass room-card';
                card.onclick = (e) => {
                    if(!e.target.closest('.btn')) openDetails(room.id);
                };

                card.innerHTML = `
                    <div class="room-header-card">
                        <div style="flex:1; min-width:0;">
                            <div class="room-title truncate">${escapeHtml(room.roomName || 'Sem Nome')}</div>
                            <span class="room-id">${room.id}</span>
                        </div>
                        ${statusDot}
                    </div>
                    ${nowPlayingHTML}
                    <div class="room-meta">
                        <div class="creator-info">
                            <span class="creator-name">${escapeHtml(room.creatorName || 'Desconhecido')}</span>
                            <span class="time-ago">Há ${timeAgo}</span>
                        </div>
                        <div class="user-stack">${avatarsHTML}</div>
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        document.getElementById('searchInput').addEventListener('input', updateRoomsList);
        document.getElementById('sortFilter').addEventListener('change', updateRoomsList);

        // --- FUNÇÕES DE AÇÃO ---

        function cleanEmptyRooms() {
            const emptyRoomIds = [];
            Object.entries(allRoomsRaw).forEach(([id, room]) => {
                const userCount = room.presence ? Object.keys(room.presence).length : 0;
                if (userCount === 0) {
                    emptyRoomIds.push(id);
                }
            });

            if (emptyRoomIds.length === 0) {
                alert("Tudo limpo! Nenhuma sala vazia encontrada.");
                return;
            }

            if (!confirm(`Encontradas ${emptyRoomIds.length} salas vazias (sem usuários).\n\nDeseja excluir todas permanentemente?`)) {
                return;
            }

            const updates = {};
            emptyRoomIds.forEach(id => {
                updates[`rooms/${id}`] = null;
            });

            database.ref().update(updates)
                .then(() => alert(`${emptyRoomIds.length} salas foram removidas.`))
                .catch(e => alert('Erro ao limpar: ' + e.message));
        }

        function openCreateModal() {
            document.getElementById('newRoomId').value = '';
            document.getElementById('newRoomName').value = '';
            document.getElementById('newRoomPassword').value = '';
            document.getElementById('createRoomModal').classList.add('active');
            setTimeout(() => document.getElementById('newRoomId').focus(), 100);
        }

        function confirmCreateRoom() {
            let id = document.getElementById('newRoomId').value.trim();
            let name = document.getElementById('newRoomName').value.trim();
            const passwordRaw = document.getElementById('newRoomPassword').value.trim(); 

            if(!id) {
                alert("O ID da sala é obrigatório.");
                return;
            }
            if(!name) name = id;
            if(allRoomsRaw[id]) {
                alert("Já existe uma sala com este ID. Escolha outro.");
                return;
            }

            let finalPassword = null;
            let isPrivate = false;

            if (passwordRaw) {
                isPrivate = true;
                finalPassword = CryptoJS.SHA256(passwordRaw).toString();
            }

            database.ref('rooms/' + id).set({
                roomName: name,
                creatorName: "Lucas Silva",
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                password: finalPassword, 
                isPrivate: isPrivate,
                videoQueue: {},
                presence: {}
            }).then(() => {
                closeModal('createRoomModal');
                alert(`Sala "${name}" criada com sucesso! (ID: ${id})`);
                document.getElementById('newRoomId').value = '';
                document.getElementById('newRoomName').value = '';
                document.getElementById('newRoomPassword').value = '';
            }).catch(e => alert("Erro ao criar: " + e.message));
        }

        // --- MODAL DETALHES ---
        function openDetails(id) {
            selectedRoomId = id;
            const room = allRoomsRaw[id];
            if(!room) return;

            document.getElementById('modalTitle').textContent = room.roomName || 'Detalhes da Sala';
            document.getElementById('detId').textContent = id;
            document.getElementById('detCreator').textContent = room.creatorName || '-';
            document.getElementById('detCreated').textContent = new Date(room.createdAt).toLocaleString('pt-BR');
            document.getElementById('detPassword').innerHTML = room.password ? 
                '<span style="color:var(--accent)"><i class="fas fa-lock"></i> Protegida</span>' : 
                '<span style="color:var(--success)"><i class="fas fa-lock-open"></i> Pública</span>';

            // ATUALIZAÇÃO: Passando o ID e a lista de banidos também
            renderUserList(room.presence, room.banned, id);
            renderQueueList(room.videoQueue);

            document.getElementById('btnOpenRoom').onclick = () => {
                sessionStorage.setItem(`bypass_pw_${id}`, 'true');
                window.open(`index.html?room=${id}`, '_blank');
            };
            
            document.getElementById('btnDeleteRoom').onclick = () => {
                if(confirm('Tem certeza? Isso vai derrubar a sala para todos.')) {
                    database.ref('rooms/' + id).remove();
                    closeModal('detailsModal');
                }
            };

            document.getElementById('detailsModal').classList.add('active');
            switchTab('tabInfo');
        }

        function copyId() {
            if(!selectedRoomId) return;
            navigator.clipboard.writeText(currentRoomId).then(() => {
                const btn = document.querySelector('.btn-icon-sm');
                const original = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check" style="color:var(--success)"></i>';
                setTimeout(() => btn.innerHTML = original, 1500);
            }).catch(err => alert("Erro ao copiar: " + err));
        }

        // --- SISTEMA DE BANIMENTO IMPLEMENTADO AQUI ---
        function renderUserList(presence, banned, roomId) {
            const container = document.getElementById('usersListContainer');
            container.innerHTML = '';
            const users = presence ? Object.values(presence) : [];
            document.getElementById('countUsersModal').textContent = users.length;

            // 1. ONLINE USERS
            if(users.length > 0) {
                const h = document.createElement('h4'); h.innerText = "Online"; h.style.color="#10b981"; h.style.marginTop="10px";
                container.appendChild(h);

                users.forEach((u, i) => {
                    const div = document.createElement('div');
                    div.className = 'list-item';
                    const initial = (u.name || '?').charAt(0).toUpperCase();
                    const color = ['#6366f1', '#ec4899', '#10b981', '#f59e0b'][i % 4];
                    const devId = u.deviceId || 'unknown';

                    div.innerHTML = `
                        <div class="list-avatar" style="background:${color}">${initial}</div>
                        <div style="min-width:0; flex:1;">
                            <div style="font-weight:600" class="truncate">${escapeHtml(u.name)}</div>
                            <div style="font-size:0.8rem; color:var(--text-muted)">ID: ${escapeHtml(devId.substr(0,10))}...</div>
                        </div>
                        <button class="btn-icon-sm" style="color: #ef4444; background: rgba(239, 68, 68, 0.1);" 
                            onclick="executeBan('${escapeHtml(u.name)}', '${roomId}', '${devId}')" title="Banir">
                            <i class="fas fa-ban"></i>
                        </button>
                    `;
                    container.appendChild(div);
                });
            } else {
                container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">Sala vazia.</p>';
            }

            // 2. BANNED USERS
            if(banned) {
                const keys = Object.keys(banned);
                if(keys.length > 0) {
                    const h = document.createElement('h4'); h.innerText = `Banidos (${keys.length})`; h.style.color="#ef4444"; h.style.marginTop="20px";
                    container.appendChild(h);
                    
                    keys.forEach(k => {
                        const div = document.createElement('div');
                        div.style.cssText = "display:flex; justify-content:space-between; background:rgba(239,68,68,0.1); padding:10px; margin-bottom:5px; border-radius:8px;";
                        div.innerHTML = `
                            <span style="color:#fca5a5; font-weight:600;">🚫 ${escapeHtml(k)}</span>
                            <button onclick="executeUnban('${k}', '${roomId}')" style="background:white; border:none; border-radius:4px; padding:4px 10px; cursor:pointer; color:#333; font-weight:bold;">
                                Desbanir
                            </button>
                        `;
                        container.appendChild(div);
                    });
                }
            }
        }

        function executeBan(targetName, roomId, targetDeviceId) {
            if (!confirm(`Banir "${targetName}"?\nIsso bloqueará o dispositivo e o nome.`)) return;

            const updates = {};
            updates[`rooms/${roomId}/banned/${targetName}`] = true; // Bloqueio visual/nome
            
            if (targetDeviceId && targetDeviceId !== 'unknown') {
                updates[`rooms/${roomId}/banned/${targetDeviceId}`] = true; // Bloqueio Real de Device
            }

            database.ref().update(updates).then(() => alert("Usuário Banido!"));
        }

        function executeUnban(target, roomId) {
            if(!confirm(`Remover banimento de "${target}"?`)) return;
            database.ref(`rooms/${roomId}/banned/${target}`).remove();
        }

        function renderQueueList(queue) {
            const container = document.getElementById('queueListContainer');
            container.innerHTML = '';
            const videos = queue ? Object.values(queue) : [];
            document.getElementById('countQueueModal').textContent = videos.length;

            if(videos.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">Fila vazia.</p>';
                return;
            }

            videos.forEach((v, idx) => {
                const div = document.createElement('div');
                div.className = 'list-item';
                div.innerHTML = `
                    <div style="color:var(--text-muted); font-family:monospace; width:20px;">${idx + 1}</div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:500; font-size:0.95rem;" class="truncate">${escapeHtml(v.title || 'Vídeo')}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted)" class="truncate">Add por: ${escapeHtml(v.phone || '?')}</div>
                    </div>
                `;
                container.appendChild(div);
            });
        }

        function switchTab(tabId) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            if(event && event.target.classList.contains('tab')) {
                event.target.classList.add('active');
            } else {
                const tabs = document.querySelectorAll('.tab');
                if(tabId === 'tabInfo') tabs[0].classList.add('active');
                if(tabId === 'tabUsers') tabs[1].classList.add('active');
                if(tabId === 'tabQueue') tabs[2].classList.add('active');
            }
            
            document.getElementById(tabId).classList.add('active');
        }

        function closeModal(id) {
            document.getElementById(id).classList.remove('active');
        }

        // --- CORREÇÃO DO CLIQUE FORA (MODAL FORTE) ---
        // Removi o window.onclick anterior que fechava ao clicar fora.
        // O modal agora só fecha via botão 'X' ou 'Cancelar' (função closeModal).

        function timeSince(date) {
            const seconds = Math.floor((new Date() - date) / 1000);
            let interval = seconds / 3600;
            if (interval > 1) return Math.floor(interval) + "h";
            interval = seconds / 60;
            if (interval > 1) return Math.floor(interval) + "m";
            return Math.floor(seconds) + "s";
        }

        function escapeHtml(text) {
            if (!text) return '';
            return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        }