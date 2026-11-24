/* js/modulos/assistente.js — edite este arquivo para alterar só este módulo */
    const COLECAO_ASSISTENTE_DOCS = 'assistente_documentos';
    const COLECAO_ASSISTENTE_CFG = 'assistente_config';

    function assistenteEmpresaSlug(nome) {
        return String(nome || getEmpresaGestor() || 'empresa').replace(/[^\w]+/g, '_').toLowerCase();
    }

    function assistenteUrlAppEnvio() {
        try {
            const u = new URL(window.location.href);
            u.search = '';
            u.hash = '';
            const path = u.pathname.replace(/index\.html$/i, '');
            u.pathname = (path.endsWith('/') ? path : path.replace(/[^/]+$/, '')) + 'envio.html';
            return u.toString();
        } catch (_) {
            return './envio.html';
        }
    }

    window.abrirEnvioComprovantesPainel = function () {
        if (typeof window.fecharMenuMobileGestor === 'function') window.fecharMenuMobileGestor();
        if (typeof window.abrirAssistenteVirtual === 'function') window.abrirAssistenteVirtual();
    };

    window.abrirAppEnvioDocumentos = function () {
        const url = assistenteUrlAppEnvio();
        window.open(url, '_blank');
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'App de envio',
                html: 'Abra este link no celular e use <b>Adicionar à tela inicial</b>:<br><br><code style="word-break:break-all;">' + escapeHtmlBasico(url) + '</code>',
                icon: 'info',
                confirmButtonColor: '#1a2a43'
            });
        }
    };

    window.salvarChaveGeminiAssistente = async function () {
        const el = document.getElementById('assistente-gemini-key');
        const chave = ((el && el.value) || '').trim();
        const empresa = getEmpresaGestor();
        if (!empresa) return Swal.fire('Atenção', 'Entre no painel da empresa primeiro.', 'warning');
        try {
            await setDoc(doc(db, COLECAO_ASSISTENTE_CFG, assistenteEmpresaSlug(empresa)), {
                empresa_id: empresa,
                gemini_api_key: chave,
                atualizado_em: Date.now()
            }, { merge: true });
            window._assistenteGeminiKey = chave;
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: chave ? 'Chave Gemini salva' : 'Chave removida', showConfirmButton: false, timer: 2000 });
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível guardar a chave.', 'error');
        }
    };

    async function carregarChaveGeminiAssistente() {
        const empresa = getEmpresaGestor();
        if (!empresa) return '';
        if (window._assistenteGeminiKey) return window._assistenteGeminiKey;
        try {
            const snap = await getDoc(doc(db, COLECAO_ASSISTENTE_CFG, assistenteEmpresaSlug(empresa)));
            const key = snap.exists() ? String((snap.data() || {}).gemini_api_key || '').trim() : '';
            window._assistenteGeminiKey = key;
            const el = document.getElementById('assistente-gemini-key');
            if (el && key && !el.value) el.value = key;
            return key;
        } catch (_) {
            return '';
        }
    }

    function assistenteMsgsEl() {
        return document.getElementById('assistente-msgs');
    }

    function assistenteAddMsg(texto, quem) {
        const box = assistenteMsgsEl();
        if (!box) return;
        const div = document.createElement('div');
        div.className = 'asst-msg ' + (quem || 'bot');
        div.innerHTML = texto;
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
    }

    function assistenteLimparOpcoes() {
        const box = assistenteMsgsEl();
        if (!box) return;
        box.querySelectorAll('.asst-ops').forEach(function (el) { el.remove(); });
    }

    function assistenteAddOpcoes(lista) {
        const box = assistenteMsgsEl();
        if (!box || !lista || !lista.length) return;
        assistenteLimparOpcoes();
        const wrap = document.createElement('div');
        wrap.className = 'asst-ops';
        lista.forEach(function (op) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = op.label;
            if (op.perigo) btn.className = 'perigo';
            btn.onclick = function () {
                assistenteLimparOpcoes();
                assistenteAddMsg(escapeHtmlBasico(op.label), 'eu');
                if (typeof window.responderAssistente === 'function') window.responderAssistente(op);
            };
            wrap.appendChild(btn);
        });
        box.appendChild(wrap);
        box.scrollTop = box.scrollHeight;
    }

    function assistenteAtualizarBadge(n) {
        const badge = document.getElementById('assistente-fab-badge');
        if (!badge) return;
        if (n > 0) {
            badge.style.display = 'block';
            badge.textContent = n > 9 ? '9+' : String(n);
        } else {
            badge.style.display = 'none';
        }
    }

    window.toggleAssistenteVirtual = function () {
        const painel = document.getElementById('assistente-painel');
        if (!painel) return;
        if (painel.classList.contains('aberto')) window.fecharAssistenteVirtual();
        else window.abrirAssistenteVirtual();
    };

    window.fecharAssistenteVirtual = function () {
        const painel = document.getElementById('assistente-painel');
        if (painel) painel.classList.remove('aberto');
    };

    window.abrirAssistenteVirtual = function () {
        const painel = document.getElementById('assistente-painel');
        if (!painel) return;
        painel.classList.add('aberto');
        const box = assistenteMsgsEl();
        if (box && !box.dataset.boasVindas) {
            box.dataset.boasVindas = '1';
            assistenteAddMsg('Olá! Sou o assistente de comprovantes e saídas.\n\nEnvie uma <b>foto</b> ou <b>PDF</b> que eu tento identificar a obra, o fornecedor e se é <b>despesa nova</b> ou <b>pagamento</b>.\n\nSe eu não souber, pergunto e mostro as opções já cadastradas no sistema.', 'bot');
            assistenteAddOpcoes([
                { id: 'tipo', value: 'despesa', label: 'Nova despesa / saída' },
                { id: 'tipo', value: 'pagamento', label: 'Pagamento de conta' },
                { id: 'app', value: 'app', label: '📱 App só para enviar' }
            ]);
        }
        if (typeof window.listarFilaAssistente === 'function') window.listarFilaAssistente();
    };

    function assistenteScoreNome(a, b) {
        const na = normalizarChaveNomeDespesa(a);
        const nb = normalizarChaveNomeDespesa(b);
        if (!na || !nb) return 0;
        if (na === nb) return 1;
        if (na.includes(nb) || nb.includes(na)) return 0.86;
        const ta = na.split(' ').filter(Boolean);
        const tb = nb.split(' ').filter(Boolean);
        if (!ta.length || !tb.length) return 0;
        let hit = 0;
        ta.forEach(function (t) { if (tb.some(function (x) { return x === t || x.includes(t) || t.includes(x); })) hit += 1; });
        return hit / Math.max(ta.length, tb.length);
    }

    function assistenteMelhorNome(texto, lista) {
        let best = { nome: '', score: 0 };
        (lista || []).forEach(function (nome) {
            const s = assistenteScoreNome(texto, nome);
            if (s > best.score) best = { nome: nome, score: s };
        });
        return best;
    }

    async function assistenteGarantirCache() {
        if (window._cacheNomesDespesas && window._cacheNomesDespesas.obras) return window._cacheNomesDespesas;
        if (typeof window.carregarNomesCadastroDespesas === 'function') {
            try { return await window.carregarNomesCadastroDespesas(); } catch (_) {}
        }
        return window._cacheNomesDespesas || { obras: [], lojas: [] };
    }

    async function assistenteListarPendentes(obra, loja) {
        const empresa = getEmpresaGestor();
        const out = [];
        try {
            const snap = await getDocs(query(collection(db, 'despesas_obras'), where('empresa_id', '==', empresa)));
            snap.forEach(function (d) {
                const item = Object.assign({ id: d.id }, d.data() || {});
                if (despesaEstaPaga(item)) return;
                if (obra && assistenteScoreNome(obra, item.obra_nome) < 0.7) return;
                if (loja && assistenteScoreNome(loja, item.loja_nome) < 0.55) return;
                out.push(item);
            });
        } catch (e) { console.error(e); }
        out.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
        return out.slice(0, 8);
    }

    async function assistenteAnalisarArquivo(dataUrl, nomeArquivo) {
        const cache = await assistenteGarantirCache();
        const obras = (cache && cache.obras) || [];
        const lojas = (cache && cache.lojas) || [];
        const chave = await carregarChaveGeminiAssistente();
        const resultado = {
            tipo: 'desconhecido',
            fornecedor: '',
            obra_sugerida: '',
            valor: '',
            data: '',
            nota_fiscal: '',
            descricao: nomeArquivo || '',
            confianca: 0,
            resumo: ''
        };
        if (!chave) return resultado;
        try {
            const raw = String(dataUrl || '');
            const mime = raw.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg';
            const b64 = raw.split(',')[1] || '';
            if (!b64) return resultado;
            const prompt = 'Você analisa comprovantes de uma construtora no Brasil. Extraia JSON com as chaves: tipo (despesa, pagamento, saida ou desconhecido), fornecedor, obra_sugerida, valor (formato 0,00), data (DD/MM/AAAA), nota_fiscal, descricao, confianca (0 a 1), resumo. tipo=despesa se for nota/compra nova; pagamento se for comprovante PIX/transferência de conta já existente; saida se for retirada em dinheiro. Obras conhecidas: ' + obras.slice(0, 40).join('; ') + '. Fornecedores: ' + lojas.slice(0, 40).join('; ') + '. Responda só JSON.';
            const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + encodeURIComponent(chave), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: b64 } }] }],
                    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
                })
            });
            if (!resp.ok) return resultado;
            const json = await resp.json();
            const txt = (((json.candidates || [])[0] || {}).content || {}).parts;
            const texto = (txt && txt[0] && txt[0].text) || '';
            const parsed = JSON.parse(texto);
            return Object.assign(resultado, parsed || {});
        } catch (e) {
            console.warn('assistenteAnalisarArquivo', e);
            return resultado;
        }
    }

    async function assistenteComprimirArquivo(file) {
        if (!file) return { dataUrl: '', tipo: 'img', nome: '' };
        const nome = file.name || 'arquivo';
        const ehPdf = file.type === 'application/pdf' || /\.pdf$/i.test(nome);
        if (ehPdf) {
            const b64 = await new Promise(function (resolve, reject) {
                const r = new FileReader();
                r.onload = function () { resolve(String(r.result || '')); };
                r.onerror = function () { reject(new Error('pdf')); };
                r.readAsDataURL(file);
            });
            return { dataUrl: b64, tipo: 'pdf', nome: nome };
        }
        const dataUrl = await comprimirArquivoImagemParaBase64(file);
        return { dataUrl: dataUrl, tipo: 'img', nome: nome };
    }

    window._assistenteSessao = window._assistenteSessao || { etapa: 'idle', rascunho: {} };

    function assistenteResetSessao() {
        window._assistenteSessao = { etapa: 'idle', rascunho: {} };
    }

    function assistenteIdDocumentoAtual() {
        const s = window._assistenteSessao || {};
        if (s.rascunho && s.rascunho.docId) return s.rascunho.docId;
        return window._assistenteUltimoDocId || '';
    }

    async function assistentePerguntarTipo() {
        window._assistenteSessao.etapa = 'tipo';
        assistenteAddMsg('Esse arquivo é o quê?', 'bot');
        assistenteAddOpcoes([
            { id: 'tipo', value: 'despesa', label: 'Nova despesa / saída' },
            { id: 'tipo', value: 'pagamento', label: 'Pagamento de conta existente' },
            { id: 'tipo', value: 'saida', label: 'Saída avulsa' },
            { id: 'excluir', value: assistenteIdDocumentoAtual() || '__recente__', label: '🗑️ Excluir', perigo: true }
        ]);
    }

    async function assistentePerguntarObra() {
        const cache = await assistenteGarantirCache();
        const obras = ((cache && cache.obras) || []).slice(0, 16);
        window._assistenteSessao.etapa = 'obra';
        assistenteAddMsg('Não tenho certeza da obra. Escolha o local deste comprovante:', 'bot');
        const ops = obras.map(function (o) { return { id: 'obra', value: o, label: o }; });
        ops.push({ id: 'obra', value: '__outra__', label: 'Outra obra (vou escrever)' });
        assistenteAddOpcoes(ops);
    }

    async function assistentePerguntarLoja() {
        const cache = await assistenteGarantirCache();
        const obra = window._assistenteSessao.rascunho.obra || '';
        let lojas = [];
        if (obra && typeof getFornecedoresDaObra === 'function') {
            lojas = getFornecedoresDaObra(cache, obra, false).map(function (x) { return x.canonico; });
        }
        if (!lojas.length) lojas = ((cache && cache.lojas) || []).slice();
        lojas = lojas.slice(0, 16);
        window._assistenteSessao.etapa = 'loja';
        assistenteAddMsg('Qual loja / fornecedor?', 'bot');
        const ops = lojas.map(function (o) { return { id: 'loja', value: o, label: o }; });
        ops.push({ id: 'loja', value: '__outra__', label: 'Outro fornecedor (vou escrever)' });
        assistenteAddOpcoes(ops);
    }

    async function assistenteAvancarDepoisDeDados() {
        const r = window._assistenteSessao.rascunho || {};
        if (!r.tipo || r.tipo === 'desconhecido') return assistentePerguntarTipo();
        if (!r.obra) return assistentePerguntarObra();
        if (!r.loja) return assistentePerguntarLoja();
        if (r.tipo === 'pagamento') {
            const pend = await assistenteListarPendentes(r.obra, r.loja);
            if (pend.length) {
                window._assistenteSessao.etapa = 'conta';
                window._assistenteSessao.contas = pend;
                assistenteAddMsg('Encontrei contas em aberto. Qual é este pagamento?', 'bot');
                const ops = pend.map(function (d) {
                    const saldo = (typeof valorEmAbertoDespesa === 'function') ? valorEmAbertoDespesa(d) : (d.valor_numero || 0);
                    return {
                        id: 'conta',
                        value: d.id,
                        label: (d.loja_nome || '') + ' · ' + formatarMoeda(saldo) + (d.nota_fiscal ? ' · NF ' + d.nota_fiscal : '')
                    };
                });
                ops.push({ id: 'conta', value: '__nova__', label: 'Não é conta existente — lançar despesa nova' });
                return assistenteAddOpcoes(ops);
            }
        }
        return assistentePerguntarConfirmacao();
    }

    function assistentePerguntarConfirmacao() {
        const r = window._assistenteSessao.rascunho || {};
        window._assistenteSessao.etapa = 'confirmar';
        if (!r.valor) {
            window._assistenteSessao.etapa = 'valor';
            assistenteAddMsg('Qual o valor (R$)? Digite no campo abaixo.', 'bot');
            return;
        }
        assistenteAddMsg(
            '<b>Confere?</b>\nTipo: ' + escapeHtmlBasico(r.tipo) +
            '\nObra: ' + escapeHtmlBasico(r.obra || '—') +
            '\nFornecedor: ' + escapeHtmlBasico(r.loja || '—') +
            '\nValor: ' + escapeHtmlBasico(r.valor || '—') +
            (r.data ? '\nData: ' + escapeHtmlBasico(r.data) : '') +
            (r.nota_fiscal ? '\nNF: ' + escapeHtmlBasico(r.nota_fiscal) : ''),
            'bot'
        );
        assistenteAddOpcoes([
            { id: 'ok', value: 'sim', label: '✅ Lançar no sistema' },
            { id: 'ok', value: 'obra', label: 'Trocar obra' },
            { id: 'ok', value: 'nao', label: 'Cancelar' }
        ]);
    }

    async function assistenteLancarNoSistema() {
        const r = window._assistenteSessao.rascunho || {};
        const empresa = getEmpresaGestor();
        const valorNum = parseMoedaLocal(String(r.valor || '0')) || 0;
        const dataObj = new Date();
        const dataAtual = String(dataObj.getDate()).padStart(2, '0') + '/' + String(dataObj.getMonth() + 1).padStart(2, '0') + '/' + dataObj.getFullYear();
        try {
            if (r.tipo === 'pagamento' && r.despesaId) {
                const snap = await getDoc(doc(db, 'despesas_obras', r.despesaId));
                if (!snap.exists()) throw new Error('despesa');
                const despesa = Object.assign({ id: snap.id }, snap.data() || {});
                const pago = valorNum > 0 ? valorNum : (typeof valorEmAbertoDespesa === 'function' ? valorEmAbertoDespesa(despesa) : despesa.valor_numero);
                const payload = montarPayloadPagamentoParcial(despesa, pago, dataPagamentoHojeBr(), 'Lançado pelo assistente', {
                    comprovante_pagamento: r.arquivo || null,
                    baixa_sem_comprovante: !r.arquivo
                });
                await externalizarComprovantesDoPayload(r.despesaId, payload);
                await updateDoc(doc(db, 'despesas_obras', r.despesaId), payload);
                assistenteAddMsg('Pagamento lançado na conta de <b>' + escapeHtmlBasico(despesa.loja_nome || r.loja || '') + '</b>.', 'bot');
            } else {
                const obra = resolverNomeCanonicoDespesa(r.obra || '', 'obra');
                const loja = resolverNomeCanonicoDespesa(r.loja || '', 'loja');
                await addDoc(collection(db, 'despesas_obras'), {
                    empresa_id: empresa,
                    obra_nome: obra,
                    obra_lower: normalizarChaveNomeDespesa(obra),
                    loja_nome: loja,
                    loja_lower: normalizarChaveNomeDespesa(loja),
                    nota_fiscal: r.nota_fiscal || '',
                    data_vencimento: '',
                    valor_string: r.valor || formatarMoeda(valorNum).replace(/^R\$\s?/, ''),
                    valor_numero: valorNum,
                    descricao: r.descricao || 'Lançado pelo assistente',
                    foto_recibo: r.arquivo || '',
                    data: r.data || dataAtual,
                    timestamp: Date.now(),
                    status: 'pendente',
                    origem: 'assistente'
                });
                assistenteAddMsg('Despesa/saída cadastrada na obra <b>' + escapeHtmlBasico(obra) + '</b>.', 'bot');
            }
            if (r.docId) {
                await updateDoc(doc(db, COLECAO_ASSISTENTE_DOCS, r.docId), { status: 'lancado', lancado_em: Date.now() });
            }
            if (typeof window.carregarFiltrosDespesas === 'function') window.carregarFiltrosDespesas();
            assistenteResetSessao();
            assistenteAddOpcoes([
                { id: 'tipo', value: 'despesa', label: 'Lançar outro' },
                { id: 'app', value: 'app', label: '📱 App de envio' }
            ]);
        } catch (e) {
            console.error(e);
            assistenteAddMsg('Não consegui gravar no sistema. Tente de novo ou lance pelo Relatório de Gastos.', 'bot');
        }
    }

    window.responderAssistente = async function (op) {
        if (!op) return;
        if (op.id === 'app' || op.value === 'app') {
            window.abrirAppEnvioDocumentos();
            return;
        }
        const sess = window._assistenteSessao;
        sess.rascunho = sess.rascunho || {};
        if (op.id === 'tipo') {
            sess.rascunho.tipo = op.value;
            return assistenteAvancarDepoisDeDados();
        }
        if (op.id === 'obra') {
            if (op.value === '__outra__') {
                sess.etapa = 'obra_texto';
                assistenteAddMsg('Digite o nome da obra no campo abaixo.', 'bot');
                return;
            }
            sess.rascunho.obra = op.value;
            return assistenteAvancarDepoisDeDados();
        }
        if (op.id === 'loja') {
            if (op.value === '__outra__') {
                sess.etapa = 'loja_texto';
                assistenteAddMsg('Digite o nome da loja/fornecedor.', 'bot');
                return;
            }
            sess.rascunho.loja = op.value;
            return assistenteAvancarDepoisDeDados();
        }
        if (op.id === 'conta') {
            if (op.value === '__nova__') {
                sess.rascunho.tipo = 'despesa';
                sess.rascunho.despesaId = '';
                return assistentePerguntarConfirmacao();
            }
            sess.rascunho.despesaId = op.value;
            const achou = (sess.contas || []).find(function (d) { return d.id === op.value; });
            if (achou) {
                sess.rascunho.loja = achou.loja_nome || sess.rascunho.loja;
                sess.rascunho.obra = achou.obra_nome || sess.rascunho.obra;
                if (!sess.rascunho.valor) sess.rascunho.valor = achou.valor_string || String(achou.valor_numero || '');
            }
            return assistentePerguntarConfirmacao();
        }
        if (op.id === 'ok') {
            if (op.value === 'sim') return assistenteLancarNoSistema();
            if (op.value === 'obra') return assistentePerguntarObra();
            assistenteAddMsg('Tudo bem, cancelei este lançamento.', 'bot');
            assistenteResetSessao();
            return;
        }
        if (op.id === 'fila') {
            return window.assistenteAbrirDocumentoFila(op.value);
        }
        if (op.id === 'excluir') {
            return window.excluirDocumentoAssistente(op.value);
        }
    };

    window.excluirDocumentoAssistenteAtual = function () {
        return window.excluirDocumentoAssistente(assistenteIdDocumentoAtual() || '__recente__');
    };

    window.excluirDocumentoAssistente = async function (id) {
        if (!id) id = '__recente__';
        if (id === '__recente__') {
            try {
                const empresa = getEmpresaGestor();
                const snap = await getDocs(query(collection(db, COLECAO_ASSISTENTE_DOCS), where('empresa_id', '==', empresa)));
                let maisNovo = null;
                snap.forEach(function (d) {
                    const item = Object.assign({ id: d.id }, d.data() || {});
                    const st = String(item.status || '');
                    if (st !== 'pendente' && st !== 'analisando' && st !== 'aguardando') return;
                    if (!maisNovo || (item.timestamp || 0) > (maisNovo.timestamp || 0)) maisNovo = item;
                });
                if (!maisNovo) {
                    return Swal.fire('Atenção', 'Não há documento na fila para excluir.', 'info');
                }
                id = maisNovo.id;
            } catch (e) {
                console.error(e);
                return Swal.fire('Erro', 'Não foi possível localizar o documento.', 'error');
            }
        }
        const ok = await Swal.fire({
            title: 'Excluir documento?',
            html: 'O arquivo sai da fila do assistente e <b>não será lançado</b> no sistema. Use se mandou o comprovante errado.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d9534f',
            cancelButtonColor: '#1a2a43',
            confirmButtonText: 'Sim, excluir',
            cancelButtonText: 'Cancelar'
        });
        if (!ok.isConfirmed) return;
        try {
            await deleteDoc(doc(db, COLECAO_ASSISTENTE_DOCS, id));
            const sess = window._assistenteSessao;
            if (sess && sess.rascunho && sess.rascunho.docId === id) assistenteResetSessao();
            const box = assistenteMsgsEl();
            if (box) box.dataset.filaMostrada = '';
            assistenteAddMsg('Documento excluído da fila. Pode enviar o arquivo correto.', 'bot');
            if (typeof window.listarFilaAssistente === 'function') await window.listarFilaAssistente();
        } catch (e) {
            console.error(e);
            assistenteAddMsg('Não foi possível excluir o documento. Tente de novo.', 'bot');
        }
    };

    window.enviarTextoAssistente = async function () {
        const el = document.getElementById('assistente-texto');
        const txt = ((el && el.value) || '').trim();
        if (!txt) return;
        if (el) el.value = '';
        assistenteAddMsg(escapeHtmlBasico(txt), 'eu');
        const sess = window._assistenteSessao;
        sess.rascunho = sess.rascunho || {};
        if (sess.etapa === 'obra' || sess.etapa === 'obra_texto') {
            const cache = await assistenteGarantirCache();
            const best = assistenteMelhorNome(txt, (cache && cache.obras) || []);
            sess.rascunho.obra = best.score >= 0.55 ? best.nome : formatarNomeCanonicoDespesa(txt);
            return assistenteAvancarDepoisDeDados();
        }
        if (sess.etapa === 'loja' || sess.etapa === 'loja_texto') {
            const cache = await assistenteGarantirCache();
            const best = assistenteMelhorNome(txt, (cache && cache.lojas) || []);
            sess.rascunho.loja = best.score >= 0.5 ? best.nome : formatarNomeCanonicoDespesa(txt);
            return assistenteAvancarDepoisDeDados();
        }
        if (sess.etapa === 'valor') {
            sess.rascunho.valor = txt;
            return assistentePerguntarConfirmacao();
        }
        const cache = await assistenteGarantirCache();
        const bestObra = assistenteMelhorNome(txt, (cache && cache.obras) || []);
        const bestLoja = assistenteMelhorNome(txt, (cache && cache.lojas) || []);
        if (bestObra.score >= 0.7) sess.rascunho.obra = bestObra.nome;
        if (bestLoja.score >= 0.7) sess.rascunho.loja = bestLoja.nome;
        if (/pag(a|amento)|pix|comprovante/i.test(txt)) sess.rascunho.tipo = sess.rascunho.tipo || 'pagamento';
        if (/despesa|nota|sa[ií]da|compra/i.test(txt)) sess.rascunho.tipo = sess.rascunho.tipo || 'despesa';
        assistenteAddMsg('Anotei. Vamos completar os dados que faltam.', 'bot');
        return assistenteAvancarDepoisDeDados();
    };

    async function assistenteProcessarArquivo(file, origem) {
        if (!file) return;
        assistenteAddMsg('Recebi <b>' + escapeHtmlBasico(file.name || 'arquivo') + '</b>. Analisando...', 'bot');
        let packed;
        try {
            packed = await assistenteComprimirArquivo(file);
        } catch (e) {
            assistenteAddMsg('Não consegui ler este arquivo.', 'bot');
            return;
        }
        if (packed.tipo === 'img' && packed.dataUrl) {
            assistenteAddMsg('<img src="' + packed.dataUrl.replace(/"/g, '') + '" alt="prévia" style="max-width:100%;max-height:140px;border-radius:8px;">', 'bot');
        }
        const empresa = getEmpresaGestor();
        let docId = '';
        try {
            const payloadFila = {
                empresa_id: empresa,
                status: 'analisando',
                origem: origem || 'gestor',
                arquivo_tipo: packed.tipo,
                arquivo_nome: packed.nome,
                timestamp: Date.now()
            };
            if (packed.dataUrl && packed.dataUrl.length < 900000) payloadFila.arquivo = packed.dataUrl;
            const ref = await addDoc(collection(db, COLECAO_ASSISTENTE_DOCS), payloadFila);
            docId = ref.id;
            window._assistenteUltimoDocId = docId;
        } catch (e) {
            console.warn('fila assistente', e);
        }
        const analise = await assistenteAnalisarArquivo(packed.dataUrl, packed.nome);
        const cache = await assistenteGarantirCache();
        const matchObra = assistenteMelhorNome(analise.obra_sugerida || analise.resumo || '', (cache && cache.obras) || []);
        const matchLoja = assistenteMelhorNome(analise.fornecedor || '', (cache && cache.lojas) || []);
        window._assistenteSessao = {
            etapa: 'analise',
            rascunho: {
                docId: docId,
                arquivo: packed.dataUrl,
                tipo: analise.tipo || 'desconhecido',
                obra: matchObra.score >= 0.62 ? matchObra.nome : '',
                loja: matchLoja.score >= 0.55 ? matchLoja.nome : '',
                valor: analise.valor || '',
                data: analise.data || '',
                nota_fiscal: analise.nota_fiscal || '',
                descricao: analise.descricao || packed.nome
            }
        };
        if (docId) {
            try {
                await updateDoc(doc(db, COLECAO_ASSISTENTE_DOCS, docId), {
                    status: 'pendente',
                    analise: analise
                });
            } catch (_) {}
        }
        const r = window._assistenteSessao.rascunho;
        if (analise.resumo) {
            assistenteAddMsg('Li o documento: <b>' + escapeHtmlBasico(analise.resumo) + '</b>', 'bot');
        } else if (!window._assistenteGeminiKey) {
            assistenteAddMsg('Não tenho chave Gemini configurada (Backup → Assistente). Vou te perguntar e usar as obras já cadastradas.', 'bot');
        } else {
            assistenteAddMsg('Não consegui ler tudo com segurança. Vou te perguntar.', 'bot');
        }
        await assistenteAvancarDepoisDeDados();
    }

    window.assistenteAbrirDocumentoFila = async function (id) {
        try {
            const snap = await getDoc(doc(db, COLECAO_ASSISTENTE_DOCS, id));
            if (!snap.exists()) return assistenteAddMsg('Documento não encontrado na fila.', 'bot');
            const d = snap.data() || {};
            window._assistenteUltimoDocId = id;
            window._assistenteSessao = {
                etapa: 'analise',
                rascunho: {
                    docId: id,
                    arquivo: d.arquivo || '',
                    tipo: (d.analise && d.analise.tipo) || 'desconhecido',
                    obra: (d.analise && d.analise.obra_sugerida) || '',
                    loja: (d.analise && d.analise.fornecedor) || '',
                    valor: (d.analise && d.analise.valor) || '',
                    data: (d.analise && d.analise.data) || '',
                    nota_fiscal: (d.analise && d.analise.nota_fiscal) || '',
                    descricao: d.observacao || d.arquivo_nome || ''
                }
            };
            if (d.arquivo && String(d.arquivo).startsWith('data:image')) {
                assistenteAddMsg('<img src="' + String(d.arquivo).replace(/"/g, '') + '" alt="documento" style="max-width:100%;max-height:140px;border-radius:8px;">', 'bot');
            } else {
                assistenteAddMsg('Documento da fila: <b>' + escapeHtmlBasico(d.arquivo_nome || 'arquivo') + '</b>', 'bot');
            }
            if (d.observacao) {
                assistenteAddMsg('Observação do envio: <b>' + escapeHtmlBasico(d.observacao) + '</b>', 'bot');
                const cacheObs = await assistenteGarantirCache();
                const bestObraObs = assistenteMelhorNome(d.observacao, (cacheObs && cacheObs.obras) || []);
                const bestLojaObs = assistenteMelhorNome(d.observacao, (cacheObs && cacheObs.lojas) || []);
                if (bestObraObs.score >= 0.55) window._assistenteSessao.rascunho.obra = bestObraObs.nome;
                if (bestLojaObs.score >= 0.5) window._assistenteSessao.rascunho.loja = bestLojaObs.nome;
            }
            await assistenteAvancarDepoisDeDados();
        } catch (e) {
            console.error(e);
        }
    };

    window.listarFilaAssistente = async function () {
        const empresa = getEmpresaGestor();
        if (!empresa) return;
        try {
            const snap = await getDocs(query(collection(db, COLECAO_ASSISTENTE_DOCS), where('empresa_id', '==', empresa)));
            const pend = [];
            snap.forEach(function (d) {
                const item = Object.assign({ id: d.id }, d.data() || {});
                const st = String(item.status || '');
                if (st === 'pendente' || st === 'analisando' || st === 'aguardando') pend.push(item);
            });
            pend.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
            assistenteAtualizarBadge(pend.length);
            if (!pend.length) return;
            const box = assistenteMsgsEl();
            const chaveFila = 'v3-' + pend.length + '-' + pend[0].id;
            if (box && box.dataset.filaMostrada === chaveFila) return;
            if (box) box.dataset.filaMostrada = chaveFila;
            let html = 'Há <b>' + pend.length + '</b> documento(s) enviados pelo app/celular aguardando classificação.';
            pend.slice(0, 8).forEach(function (p) {
                const nome = escapeHtmlBasico(p.arquivo_nome || 'Documento');
                const obs = p.observacao ? '<div style="font-size:11px;color:#666;margin-top:2px;">' + escapeHtmlBasico(p.observacao) + '</div>' : '';
                const id = String(p.id).replace(/'/g, '');
                html += '<div class="asst-fila-card">'
                    + '<div style="flex:1;min-width:120px;"><b>📥 ' + nome + '</b>' + obs + '</div>'
                    + '<div style="display:flex;gap:6px;">'
                    + '<button type="button" style="background:#1a2a43;color:#fff;" onclick="assistenteAbrirDocumentoFila(\'' + id + '\')">Abrir</button>'
                    + '<button type="button" style="background:#d9534f;color:#fff;" onclick="excluirDocumentoAssistente(\'' + id + '\')">🗑️ Excluir</button>'
                    + '</div></div>';
            });
            assistenteAddMsg(html, 'bot');
            window._assistenteUltimoDocId = pend[0].id;
        } catch (e) {
            console.warn(e);
        }
    };

    window.iniciarAssistenteVirtual = function () {
        carregarChaveGeminiAssistente();
        assistenteGarantirCache();
        const input = document.getElementById('assistente-arquivo');
        if (input && !input._asstBound) {
            input._asstBound = true;
            input.addEventListener('change', function () {
                const f = input.files && input.files[0];
                input.value = '';
                if (f) {
                    window.abrirAssistenteVirtual();
                    assistenteProcessarArquivo(f, 'gestor');
                }
            });
        }
        if (window._assistenteUnsub) {
            try { window._assistenteUnsub(); } catch (_) {}
        }
        const empresa = getEmpresaGestor();
        if (!empresa) return;
        try {
            const qFila = query(collection(db, COLECAO_ASSISTENTE_DOCS), where('empresa_id', '==', empresa));
            window._assistenteUnsub = onSnapshot(qFila, function (snap) {
                let n = 0;
                snap.forEach(function (d) {
                    const st = String((d.data() || {}).status || '');
                    if (st === 'pendente' || st === 'analisando' || st === 'aguardando') n += 1;
                });
                assistenteAtualizarBadge(n);
            });
        } catch (e) {
            console.warn('fila assistente snapshot', e);
        }
        window.listarFilaAssistente();
    };
