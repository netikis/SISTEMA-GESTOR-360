/* js/modulos/folha-extras.js — edite este arquivo para alterar só este módulo */
    function labelDescontoFolhaExibir(item) {
        const tipo = String(item.tipo_desconto || 'Outros').trim();
        const obs = String(item.observacao || '').trim();
        if (obs && tipo === 'Outros') return 'Outros — ' + obs;
        if (obs) return tipo + ' (' + obs + ')';
        return tipo;
    }

    function initDescontosFolhaDatasPadrao() {
        const ag = new Date();
        const mes = String(ag.getMonth() + 1).padStart(2, '0');
        const ano = String(ag.getFullYear());
        const elM = document.getElementById('df-mes-ref');
        const elA = document.getElementById('df-ano-ref');
        const elLa = document.getElementById('df-lista-ano');
        const elLm = document.getElementById('df-lista-mes');
        if (elM && !elM.value) elM.value = mes;
        if (elA && !elA.value) elA.value = ano;
        if (elLa && !elLa.value) elLa.value = ano;
        if (elLm && !elLm.value) elLm.value = mes;
    }

    function dataBrDeIsoAjuda(iso) {
        return inputDateIsoParaDataBr(iso) || '';
    }

    function camposDiaMesAnoDeRegistoAjuda(reg) {
        if (reg && reg.data_iso) {
            const p = String(reg.data_iso).split('-');
            if (p.length === 3) return { dia: p[2], mes: p[1], ano: p[0] };
        }
        const s = separarDataSegura(reg && (reg.data || reg.data_iso));
        if (s.ano && s.ano !== 'Outros') return { dia: s.dia, mes: s.mes, ano: s.ano };
        return { dia: '', mes: '', ano: '' };
    }

    function initAjudaCustoDatasPadrao() {
        const ag = new Date();
        const elD = document.getElementById('ac-dia');
        const elM = document.getElementById('ac-mes');
        const elA = document.getElementById('ac-ano');
        const elLa = document.getElementById('ac-lista-ano');
        if (elD && !elD.value) elD.value = String(ag.getDate());
        if (elM && !elM.value) elM.value = String(ag.getMonth() + 1).padStart(2, '0');
        if (elA && !elA.value) elA.value = String(ag.getFullYear());
        if (elLa && !elLa.value) elLa.value = String(ag.getFullYear());
    }

    window.salvarAjudaCusto = async function () {
        const funcId = document.getElementById('ac-func-select') && document.getElementById('ac-func-select').value;
        const dia = document.getElementById('ac-dia') && document.getElementById('ac-dia').value;
        const mes = document.getElementById('ac-mes') && document.getElementById('ac-mes').value;
        const ano = document.getElementById('ac-ano') && document.getElementById('ac-ano').value;
        const valor = document.getElementById('ac-valor') && document.getElementById('ac-valor').value;
        const discriminacao = document.getElementById('ac-discriminacao') ? document.getElementById('ac-discriminacao').value.trim() : '';
        const empresaLogada = getEmpresaGestor();

        if (!funcId) return Swal.fire('Atenção', 'Selecione o funcionário.', 'warning');
        if (!valor) return Swal.fire('Atenção', 'Informe o valor.', 'warning');
        if (!discriminacao) return Swal.fire('Atenção', 'Descreva a discriminação / motivo da ajuda de custo.', 'warning');

        const dataIso = montarDataIsoDiaMesAno(dia, mes, ano);
        if (!dataIso) return Swal.fire('Atenção', 'Data inválida. Verifique dia, mês e ano.', 'warning');

        const funcionario = window.listaFuncionarios && window.listaFuncionarios[funcId];
        const nomeFunc = funcionario ? funcionario.nome : 'Funcionário';
        const partes = dataIso.split('-');

        try {
            await addDoc(collection(db, COLECAO_AJUDA_CUSTO), {
                empresa_id: empresaLogada,
                funcionario_id: funcId,
                funcionario_nome: nomeFunc,
                valor_string: valor,
                valor_numero: parseMoedaLocal(valor),
                data: dataBrDeIsoAjuda(dataIso),
                data_iso: dataIso,
                dia: partes[2],
                mes: partes[1],
                ano: partes[0],
                discriminacao: discriminacao,
                timestamp: timestampMeioDiaDataIso(dataIso)
            });
            Swal.fire('Sucesso!', 'Ajuda de custo lançada. Aparece na folha (PLUS) do mês ' + partes[1] + '/' + partes[0] + ', sem alterar o líquido.', 'success');
            if (document.getElementById('ac-valor')) document.getElementById('ac-valor').value = '';
            if (document.getElementById('ac-discriminacao')) document.getElementById('ac-discriminacao').value = '';
            const elLf = document.getElementById('ac-lista-func');
            if (elLf) elLf.value = funcId;
            const elLm = document.getElementById('ac-lista-mes');
            if (elLm) elLm.value = partes[1];
            const elLa = document.getElementById('ac-lista-ano');
            if (elLa) elLa.value = partes[0];
            carregarAjudaCustoLista();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível salvar a ajuda de custo.', 'error');
        }
    };

    window.carregarAjudaCustoLista = async function () {
        const wrap = document.getElementById('lista-ajuda-custo');
        const empresaLogada = getEmpresaGestor();
        if (!wrap) return;
        if (!empresaLogada) return Swal.fire('Atenção', 'Empresa não definida.', 'warning');

        const funcFiltro = document.getElementById('ac-lista-func') && document.getElementById('ac-lista-func').value;
        const mesFiltro = document.getElementById('ac-lista-mes') && document.getElementById('ac-lista-mes').value;
        const anoFiltro = document.getElementById('ac-lista-ano') && document.getElementById('ac-lista-ano').value;

        wrap.innerHTML = '<p style="text-align:center;color:#888;">Carregando...</p>';
        window._mapAjudaCustoEdicao = {};

        try {
            const q = query(collection(db, COLECAO_AJUDA_CUSTO), where('empresa_id', '==', empresaLogada));
            const snap = await getDocs(q);
            let arr = [];
            snap.forEach(docu => arr.push({ id: docu.id, ...docu.data() }));

            arr = arr.filter(a => {
                if (funcFiltro && a.funcionario_id !== funcFiltro) return false;
                if (mesFiltro && String(a.mes || '') !== String(mesFiltro)) {
                    const ref = separarDataSegura(a.data || a.data_iso);
                    if (String(ref.mes).padStart(2, '0') !== String(mesFiltro).padStart(2, '0')) return false;
                }
                if (anoFiltro && String(a.ano || '') !== String(anoFiltro)) {
                    const ref = separarDataSegura(a.data || a.data_iso);
                    if (String(ref.ano) !== String(anoFiltro)) return false;
                }
                return true;
            });

            arr.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            arr.forEach(a => { window._mapAjudaCustoEdicao[a.id] = a; });

            if (!arr.length) {
                wrap.innerHTML = '<p style="text-align:center;color:#888;">Nenhum lançamento com os filtros atuais.</p>';
                return;
            }

            let soma = 0;
            let html = '<table style="width:100%;border-collapse:collapse;font-size:12px;background:#fff;border:1px solid #e0e6ed;">';
            html += '<thead><tr style="background:var(--dark-navy);color:#fff;text-align:left;">';
            html += '<th style="padding:8px;">Funcionário</th><th style="padding:8px;">Data</th><th style="padding:8px;">Valor</th>';
            html += '<th style="padding:8px;">Discriminação</th><th style="padding:8px;">Acções</th></tr></thead><tbody>';

            arr.forEach(a => {
                soma += (a.valor_numero || parseMoedaLocal(a.valor_string) || 0);
                const dataEx = escapeHtmlBasico(a.data || dataBrDeIsoAjuda(a.data_iso) || '—');
                const disc = escapeHtmlBasico(String(a.discriminacao || '').trim());
                const discShort = disc.length > 80 ? disc.slice(0, 77) + '…' : disc;
                html += '<tr style="border-bottom:1px solid #eee;vertical-align:top;">';
                html += '<td style="padding:6px;">' + escapeHtmlBasico(a.funcionario_nome || '') + '</td>';
                html += '<td style="padding:6px;white-space:nowrap;font-weight:600;">' + dataEx + '</td>';
                html += '<td style="padding:6px;white-space:nowrap;"><b>R$ ' + escapeHtmlBasico(String(a.valor_string || '0')) + '</b></td>';
                html += '<td style="padding:6px;max-width:220px;font-size:11px;" title="' + escapeAttrBasico(a.discriminacao) + '">' + (discShort || '—') + '</td>';
                html += '<td style="padding:6px;min-width:120px;">';
                html += '<button type="button" onclick="editarAjudaCusto(\'' + a.id + '\')" style="display:block;width:100%;margin-bottom:4px;background:#4285F4;color:#fff;border:none;padding:6px;border-radius:6px;font-size:11px;cursor:pointer;">✏️ Editar</button>';
                html += '<button type="button" onclick="excluirAjudaCusto(\'' + a.id + '\')" style="display:block;width:100%;background:#d9534f;color:#fff;border:none;padding:6px;border-radius:6px;font-size:11px;cursor:pointer;">🗑️ Excluir</button>';
                html += '</td></tr>';
            });
            html += '</tbody></table>';
            html += '<p style="text-align:right;margin-top:10px;font-size:13px;color:var(--dark-navy);"><b>Total listado:</b> ' + formatarMoeda(soma) + '</p>';
            wrap.innerHTML = html;
        } catch (e) {
            console.error(e);
            wrap.innerHTML = '<p style="text-align:center;color:#d9534f;">Erro ao carregar ajudas de custo.</p>';
        }
    };

    window.editarAjudaCusto = function (id) {
        const reg = window._mapAjudaCustoEdicao && window._mapAjudaCustoEdicao[id];
        if (!reg) return Swal.fire('Erro', 'Registo não encontrado. Atualize a lista.', 'error');

        const campos = camposDiaMesAnoDeRegistoAjuda(reg);
        const vDisc = escapeHtmlBasico(reg.discriminacao || '');
        const vVal = escapeHtmlBasico(reg.valor_string || '');
        const vNome = escapeHtmlBasico(reg.funcionario_nome || '');

        Swal.fire({
            title: '✏️ Editar ajuda de custo',
            html: `
                <div style="text-align:left;font-size:13px;">
                    <p style="margin:0 0 10px 0;color:#666;"><b>${vNome}</b></p>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <div style="flex:1;min-width:60px;"><label>Dia</label>
                        <input type="number" id="edit-ac-dia" class="swal2-input" min="1" max="31" style="margin:0;width:100%;height:40px;" value="${escapeHtmlBasico(campos.dia)}"></div>
                        <div style="flex:1.2;min-width:90px;"><label>Mês</label>
                        <select id="edit-ac-mes" class="swal2-input" style="margin:0;width:100%;height:40px;">
                            ${['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => `<option value="${m}" ${campos.mes === m ? 'selected' : ''}>${m}</option>`).join('')}
                        </select></div>
                        <div style="flex:1;min-width:70px;"><label>Ano</label>
                        <input type="number" id="edit-ac-ano" class="swal2-input" style="margin:0;width:100%;height:40px;" value="${escapeHtmlBasico(campos.ano)}"></div>
                    </div>
                    <label style="margin-top:10px;">Valor (R$)</label>
                    <input id="edit-ac-valor" class="swal2-input" style="margin:0;width:100%;height:40px;" value="${vVal}" oninput="mascaraMoeda(this)">
                    <label style="margin-top:10px;">Discriminação</label>
                    <textarea id="edit-ac-disc" class="swal2-textarea" style="margin:0;width:100%;height:70px;">${vDisc}</textarea>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'SALVAR',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const disc = document.getElementById('edit-ac-disc').value.trim();
                if (!disc) {
                    Swal.showValidationMessage('Informe a discriminação.');
                    return false;
                }
                const iso = montarDataIsoDiaMesAno(
                    document.getElementById('edit-ac-dia').value,
                    document.getElementById('edit-ac-mes').value,
                    document.getElementById('edit-ac-ano').value
                );
                if (!iso) {
                    Swal.showValidationMessage('Data inválida.');
                    return false;
                }
                const p = iso.split('-');
                return {
                    valor_string: document.getElementById('edit-ac-valor').value,
                    valor_numero: parseMoedaLocal(document.getElementById('edit-ac-valor').value),
                    data_iso: iso,
                    data: dataBrDeIsoAjuda(iso),
                    dia: p[2],
                    mes: p[1],
                    ano: p[0],
                    discriminacao: disc,
                    timestamp: timestampMeioDiaDataIso(iso)
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await updateDoc(doc(db, COLECAO_AJUDA_CUSTO, id), result.value);
                    Swal.fire('Atualizado!', 'Ajuda de custo corrigida.', 'success');
                    carregarAjudaCustoLista();
                } catch (e) {
                    Swal.fire('Erro', 'Não foi possível atualizar.', 'error');
                }
            }
        });
    };

    window.excluirAjudaCusto = async function (id) {
        Swal.fire({
            title: 'Apagar ajuda de custo?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d9534f',
            confirmButtonText: 'Sim, apagar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(db, COLECAO_AJUDA_CUSTO, id));
                    Swal.fire('Apagado!', '', 'success');
                    carregarAjudaCustoLista();
                } catch (e) {
                    Swal.fire('Erro', 'Não foi possível apagar.', 'error');
                }
            }
        });
    };

    window.salvarDescontoFolha = async function () {
        const funcId = document.getElementById('df-func-select') && document.getElementById('df-func-select').value;
        const mesRef = document.getElementById('df-mes-ref') && document.getElementById('df-mes-ref').value;
        const anoRef = document.getElementById('df-ano-ref') && document.getElementById('df-ano-ref').value;
        const tipo = document.getElementById('df-tipo') && document.getElementById('df-tipo').value;
        const valor = document.getElementById('df-valor') && document.getElementById('df-valor').value;
        const observacao = document.getElementById('df-observacao') ? document.getElementById('df-observacao').value.trim() : '';
        const empresaLogada = getEmpresaGestor();

        if (!funcId) return Swal.fire('Atenção', 'Selecione o funcionário.', 'warning');
        if (!mesRef || !anoRef) return Swal.fire('Atenção', 'Informe mês e ano de referência da folha.', 'warning');
        if (!valor) return Swal.fire('Atenção', 'Informe o valor do desconto.', 'warning');
        const vNum = parseMoedaLocal(valor);
        if (!vNum || vNum <= 0) return Swal.fire('Atenção', 'Valor do desconto inválido.', 'warning');

        const funcionario = window.listaFuncionarios && window.listaFuncionarios[funcId];
        const nomeFunc = funcionario ? funcionario.nome : 'Funcionário';

        try {
            await addDoc(collection(db, COLECAO_DESCONTOS_FOLHA), {
                empresa_id: empresaLogada,
                funcionario_id: funcId,
                funcionario_nome: nomeFunc,
                tipo_desconto: tipo || 'Outros',
                valor_string: valor,
                valor_numero: vNum,
                mes_ref: String(mesRef).padStart(2, '0'),
                ano_ref: String(anoRef),
                observacao: observacao || null,
                timestamp: Date.now()
            });
            Swal.fire('Sucesso!', 'Desconto lançado. Aparece no holerite de ' + mesRef + '/' + anoRef + ' e reduz o líquido.', 'success');
            if (document.getElementById('df-valor')) document.getElementById('df-valor').value = '';
            if (document.getElementById('df-observacao')) document.getElementById('df-observacao').value = '';
            const elLf = document.getElementById('df-lista-func');
            if (elLf) elLf.value = funcId;
            const elLm = document.getElementById('df-lista-mes');
            if (elLm) elLm.value = String(mesRef).padStart(2, '0');
            const elLa = document.getElementById('df-lista-ano');
            if (elLa) elLa.value = String(anoRef);
            carregarDescontosFolhaLista();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível salvar o desconto.', 'error');
        }
    };

    window.carregarDescontosFolhaLista = async function () {
        const wrap = document.getElementById('lista-descontos-folha');
        const empresaLogada = getEmpresaGestor();
        if (!wrap) return;
        if (!empresaLogada) return Swal.fire('Atenção', 'Empresa não definida.', 'warning');

        const funcFiltro = document.getElementById('df-lista-func') && document.getElementById('df-lista-func').value;
        const mesFiltro = document.getElementById('df-lista-mes') && document.getElementById('df-lista-mes').value;
        const anoFiltro = document.getElementById('df-lista-ano') && document.getElementById('df-lista-ano').value;

        wrap.innerHTML = '<p style="text-align:center;color:#888;">Carregando...</p>';
        window._mapDescontoFolhaEdicao = {};

        try {
            const q = query(collection(db, COLECAO_DESCONTOS_FOLHA), where('empresa_id', '==', empresaLogada));
            const snap = await getDocs(q);
            let arr = [];
            snap.forEach(docu => arr.push({ id: docu.id, ...docu.data() }));

            arr = arr.filter(d => {
                if (funcFiltro && d.funcionario_id !== funcFiltro) return false;
                if (mesFiltro && String(d.mes_ref || '').padStart(2, '0') !== String(mesFiltro).padStart(2, '0')) return false;
                if (anoFiltro && String(d.ano_ref || '') !== String(anoFiltro)) return false;
                return true;
            });

            arr.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            arr.forEach(d => { window._mapDescontoFolhaEdicao[d.id] = d; });

            if (!arr.length) {
                wrap.innerHTML = '<p style="text-align:center;color:#888;">Nenhum desconto com os filtros atuais.</p>';
                return;
            }

            let soma = 0;
            let html = '<table style="width:100%;border-collapse:collapse;font-size:12px;background:#fff;border:1px solid #e0e6ed;">';
            html += '<thead><tr style="background:#922b21;color:#fff;text-align:left;">';
            html += '<th style="padding:8px;">Funcionário</th><th style="padding:8px;">Ref.</th><th style="padding:8px;">Tipo</th>';
            html += '<th style="padding:8px;">Valor</th><th style="padding:8px;">Obs.</th><th style="padding:8px;">Acções</th></tr></thead><tbody>';

            arr.forEach(d => {
                soma += (d.valor_numero || parseMoedaLocal(d.valor_string) || 0);
                const ref = (d.mes_ref || '??') + '/' + (d.ano_ref || '????');
                const obs = escapeHtmlBasico(String(d.observacao || '').trim());
                const obsShort = obs.length > 60 ? obs.slice(0, 57) + '…' : obs;
                html += '<tr style="border-bottom:1px solid #eee;vertical-align:top;">';
                html += '<td style="padding:6px;">' + escapeHtmlBasico(d.funcionario_nome || '') + '</td>';
                html += '<td style="padding:6px;white-space:nowrap;font-weight:600;">' + escapeHtmlBasico(ref) + '</td>';
                html += '<td style="padding:6px;">' + escapeHtmlBasico(d.tipo_desconto || 'Outros') + '</td>';
                html += '<td style="padding:6px;white-space:nowrap;color:#dc3545;"><b>R$ ' + escapeHtmlBasico(String(d.valor_string || '0')) + '</b></td>';
                html += '<td style="padding:6px;max-width:160px;font-size:11px;" title="' + escapeAttrBasico(d.observacao) + '">' + (obsShort || '—') + '</td>';
                html += '<td style="padding:6px;min-width:120px;">';
                html += '<button type="button" onclick="editarDescontoFolha(\'' + d.id + '\')" style="display:block;width:100%;margin-bottom:4px;background:#4285F4;color:#fff;border:none;padding:6px;border-radius:6px;font-size:11px;cursor:pointer;">✏️ Editar</button>';
                html += '<button type="button" onclick="excluirDescontoFolha(\'' + d.id + '\')" style="display:block;width:100%;background:#d9534f;color:#fff;border:none;padding:6px;border-radius:6px;font-size:11px;cursor:pointer;">🗑️ Excluir</button>';
                html += '</td></tr>';
            });
            html += '</tbody></table>';
            html += '<p style="text-align:right;margin-top:10px;font-size:13px;color:#922b21;"><b>Total descontos listados:</b> ' + formatarMoeda(soma) + '</p>';
            wrap.innerHTML = html;
        } catch (e) {
            console.error(e);
            wrap.innerHTML = '<p style="text-align:center;color:#d9534f;">Erro ao carregar descontos.</p>';
        }
    };

    window.editarDescontoFolha = function (id) {
        const reg = window._mapDescontoFolhaEdicao && window._mapDescontoFolhaEdicao[id];
        if (!reg) return Swal.fire('Erro', 'Registo não encontrado. Atualize a lista.', 'error');

        const optsTipo = TIPOS_DESCONTO_FOLHA_OPTS.map(t =>
            `<option value="${t}" ${reg.tipo_desconto === t ? 'selected' : ''}>${t}</option>`
        ).join('');
        const optsMes = ['01','02','03','04','05','06','07','08','09','10','11','12'].map(m =>
            `<option value="${m}" ${String(reg.mes_ref).padStart(2, '0') === m ? 'selected' : ''}>${m}</option>`
        ).join('');

        Swal.fire({
            title: '✏️ Editar desconto na folha',
            html: `
                <div style="text-align:left;font-size:13px;">
                    <p style="margin:0 0 10px 0;color:#666;"><b>${escapeHtmlBasico(reg.funcionario_nome || '')}</b></p>
                    <label>Mês ref.</label>
                    <select id="edit-df-mes" class="swal2-input" style="margin:0;width:100%;height:40px;">${optsMes}</select>
                    <label style="margin-top:8px;">Ano ref.</label>
                    <input type="number" id="edit-df-ano" class="swal2-input" style="margin:0;width:100%;height:40px;" value="${escapeHtmlBasico(reg.ano_ref || '')}">
                    <label style="margin-top:8px;">Tipo</label>
                    <select id="edit-df-tipo" class="swal2-input" style="margin:0;width:100%;height:40px;">${optsTipo}</select>
                    <label style="margin-top:8px;">Valor (R$)</label>
                    <input id="edit-df-valor" class="swal2-input" style="margin:0;width:100%;height:40px;" value="${escapeHtmlBasico(reg.valor_string || '')}" oninput="mascaraMoeda(this)">
                    <label style="margin-top:8px;">Observação</label>
                    <textarea id="edit-df-obs" class="swal2-textarea" style="margin:0;width:100%;height:60px;">${escapeHtmlBasico(reg.observacao || '')}</textarea>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'SALVAR',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const v = parseMoedaLocal(document.getElementById('edit-df-valor').value);
                if (!v || v <= 0) {
                    Swal.showValidationMessage('Informe um valor válido.');
                    return false;
                }
                return {
                    mes_ref: document.getElementById('edit-df-mes').value,
                    ano_ref: String(document.getElementById('edit-df-ano').value),
                    tipo_desconto: document.getElementById('edit-df-tipo').value,
                    valor_string: document.getElementById('edit-df-valor').value,
                    valor_numero: v,
                    observacao: document.getElementById('edit-df-obs').value.trim() || null
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await updateDoc(doc(db, COLECAO_DESCONTOS_FOLHA, id), result.value);
                    Swal.fire('Atualizado!', 'Desconto corrigido.', 'success');
                    carregarDescontosFolhaLista();
                } catch (e) {
                    Swal.fire('Erro', 'Não foi possível atualizar.', 'error');
                }
            }
        });
    };

    window.excluirDescontoFolha = async function (id) {
        Swal.fire({
            title: 'Apagar desconto da folha?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d9534f',
            confirmButtonText: 'Sim, apagar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(db, COLECAO_DESCONTOS_FOLHA, id));
                    Swal.fire('Apagado!', '', 'success');
                    carregarDescontosFolhaLista();
                } catch (e) {
                    Swal.fire('Erro', 'Não foi possível apagar.', 'error');
                }
            }
        });
    };
