/* js/modulos/calendario.js — edite este arquivo para alterar só este módulo */
    window.MAPA_ATALHOS_GESTOR = {
        F1: { aba: 'inicio' },
        F2: { aba: 'equipe-cadastrada' },
        F3: { aba: 'cadastrar' },
        F4: { aba: 'despesas-cadastrar' },
        F6: { aba: 'despesas-relatorio' },
        F7: { aba: 'cartoes-cadastrados' },
        F8: { aba: 'cartoes-relatorio' },
        F9: { aba: 'folha' },
        F10: { aba: 'obras-relatorio-geral' },
        F11: { aba: 'contas-receber' },
        F12: { aba: 'ponto' }
    };

    window.abrirAtalhoGestor = function (tecla) {
        const item = window.MAPA_ATALHOS_GESTOR[tecla];
        if (!item) return;
        if (typeof painelGestorEstaVisivel === 'function' && !painelGestorEstaVisivel()) return;
        if (item.aba === 'inicio') {
            if (typeof window.mudarAba === 'function') window.mudarAba('inicio');
            else if (typeof mostrarTelaInicioGestor === 'function') mostrarTelaInicioGestor();
            return;
        }
        const btn = typeof encontrarBotaoAbaGestor === 'function' ? encontrarBotaoAbaGestor(item.aba) : null;
        if (typeof window.mudarAba === 'function') window.mudarAba(item.aba, btn);
    };

    window.salvarFeriado = async function() {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) return Swal.fire('Atenção', 'Entre como gestor para cadastrar feriados.', 'warning');

        const data = document.getElementById('fer-data').value; // YYYY-MM-DD
        const nome = document.getElementById('fer-nome').value.trim();
        const tipo = document.getElementById('fer-tipo').value;

        if (!data) return Swal.fire('Atenção', 'Selecione a data do feriado.', 'warning');
        if (!nome) return Swal.fire('Atenção', 'Informe o nome/descrição do feriado.', 'warning');

        const btn = document.getElementById('btnSalvarFeriado');
        btn.innerText = '⏳ A SALVAR...';
        btn.disabled = true;

        try {
            const user = await ensureAuth();
            const uid = user?.uid || localStorage.getItem('auth_uid') || null;
            await addDoc(collection(db, "feriados"), {
                empresa_id: empresaLogada,
                data_iso: data,
                nome,
                tipo,
                criado_por_uid: uid,
                criado_em: serverTimestamp()
            });
            Swal.fire('Sucesso!', 'Feriado cadastrado.', 'success');
            document.getElementById('fer-nome').value = '';
            carregarFeriados();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível salvar o feriado.', 'error');
        } finally {
            btn.innerText = 'SALVAR FERIADO';
            btn.disabled = false;
        }
    };

    window.carregarFeriados = async function() {
        const empresaLogada = getEmpresaGestor();
        const div = document.getElementById('lista-feriados');
        if (!div) return;
        if (!empresaLogada) {
            div.innerHTML = `<p style="text-align:center; color:#888; font-size:13px;">Entre como gestor para ver os feriados.</p>`;
            return;
        }

        div.innerHTML = `<p style="text-align:center; color:#888; font-size:13px;">Carregando...</p>`;
        try {
            const q = query(collection(db, "feriados"), where("empresa_id", "==", empresaLogada));
            const snap = await getDocs(q);
            if (snap.empty) {
                div.innerHTML = `<p style="text-align:center; color:#888; font-size:13px;">Nenhum feriado cadastrado.</p>`;
                return;
            }
            let items = [];
            snap.forEach(d => {
                const f = d.data();
                items.push({ id: d.id, ...f });
            });
            items.sort((a, b) => String(a.data_iso || '').localeCompare(String(b.data_iso || '')));

            div.innerHTML = items.map(f => `
                <div class="resultado-item" style="border-left-color:#1a2a43;">
                    <b>${(f.data_iso || '').split('-').reverse().join('/')}</b> - ${f.nome || ''}<br>
                    <span style="font-size:12px; color:#666;">Tipo: ${(f.tipo || '').toUpperCase()}</span>
                    <button onclick="excluirFeriado('${f.id}')" style="background:#d9534f; color:white; border:none; padding:8px; border-radius:8px; cursor:pointer; width:100%; margin-top:8px; font-weight:700;">🗑️ REMOVER</button>
                </div>
            `).join('');
        } catch (e) {
            console.error(e);
            div.innerHTML = `<p style="text-align:center; color:#d9534f; font-size:13px;">Erro ao carregar feriados.</p>`;
        }
    };

    window.excluirFeriado = async function(id) {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) return;
        const ok = await Swal.fire({
            title: 'Remover feriado?',
            text: 'Isso afeta os cálculos da folha/banco de horas.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d9534f',
            cancelButtonColor: '#1a2a43',
            confirmButtonText: 'Sim, remover'
        });
        if (!ok.isConfirmed) return;
        try {
            await deleteDoc(doc(db, "feriados", id));
            Swal.fire('Removido!', 'Feriado removido.', 'success');
            carregarFeriados();
        } catch (e) {
            Swal.fire('Erro', 'Não foi possível remover.', 'error');
        }
    };
