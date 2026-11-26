/* js/modulos/ponto.js — edite este arquivo para alterar só este módulo */
    function obterDataHojeBrPonto() {
        const d = new Date();
        return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    }

    function atualizarDataRelogioPonto() {
        const el = document.getElementById('relogio-data-hoje');
        if (!el) return;
        el.textContent = obterDataHojeBrPonto();
    }

    function estadoPontoVazio() {
        return { lastTipo: null, emIntervalo: false, encerrado: false };
    }

    function tiposPontoFeitosHoje(estado) {
        const feitos = {
            'Entrada': false,
            'Início Intervalo': false,
            'Fim Intervalo': false,
            'Saída': false
        };
        const last = estado && estado.lastTipo ? normalizarTipoBatidaPonto(estado.lastTipo) : null;
        const encerrado = Boolean(estado && (estado.encerrado || last === 'Saída'));
        if (encerrado) {
            feitos['Entrada'] = true;
            feitos['Início Intervalo'] = true;
            feitos['Fim Intervalo'] = true;
            feitos['Saída'] = true;
            return feitos;
        }
        if (last === 'Fim Intervalo') {
            feitos['Entrada'] = true;
            feitos['Início Intervalo'] = true;
            feitos['Fim Intervalo'] = true;
        } else if (last === 'Início Intervalo') {
            feitos['Entrada'] = true;
            feitos['Início Intervalo'] = true;
        } else if (last === 'Entrada') {
            feitos['Entrada'] = true;
        }
        return feitos;
    }

    const ROTULOS_BOTOES_PONTO = {
        'Entrada': '🟢 REGISTAR ENTRADA',
        'Início Intervalo': '⏸️ SAIR P/ ALMOÇO (INÍCIO INTERVALO)',
        'Fim Intervalo': '▶️ VOLTAR DO ALMOÇO (FIM INTERVALO)',
        'Saída': '🔴 REGISTAR SAÍDA'
    };

    const IDS_BOTOES_PONTO = {
        'Entrada': 'btn-ponto-entrada',
        'Início Intervalo': 'btn-ponto-inicio-intervalo',
        'Fim Intervalo': 'btn-ponto-fim-intervalo',
        'Saída': 'btn-ponto-saida'
    };

    function aplicarUiBotoesPontoDia(estado) {
        const feitos = tiposPontoFeitosHoje(estado || estadoPontoVazio());
        Object.keys(IDS_BOTOES_PONTO).forEach(function (tipo) {
            const btn = document.getElementById(IDS_BOTOES_PONTO[tipo]);
            if (!btn) return;
            const ok = Boolean(feitos[tipo]);
            const base = ROTULOS_BOTOES_PONTO[tipo] || tipo;
            if (ok) {
                btn.innerHTML = base + ' <span class="btn-ponto-ok-badge">OK</span>';
                btn.classList.add('btn-ponto-ok');
                btn.disabled = true;
                btn.setAttribute('aria-disabled', 'true');
                btn.title = 'Já registrado hoje. Liberado novamente amanhã.';
            } else {
                btn.innerHTML = base;
                btn.classList.remove('btn-ponto-ok');
                btn.disabled = false;
                btn.removeAttribute('aria-disabled');
                btn.title = '';
            }
        });
    }

    window.atualizarUiBotoesPontoDia = async function (forcarNuvem) {
        const tela = document.getElementById('tela-relogio');
        if (!tela || tela.style.display === 'none') return;
        atualizarDataRelogioPonto();
        const funcId = getSessaoFunc('funcLogadoId');
        if (!funcId) return;

        const dataHoje = obterDataHojeBrPonto();
        const chave = 'estado_ponto_' + funcId + '_' + dataHoje;
        let estado = null;
        try {
            estado = JSON.parse(localStorage.getItem(chave) || 'null');
        } catch (_) {
            estado = null;
        }

        // Aplica já o estado local (instantâneo) e depois confirma com a nuvem
        aplicarUiBotoesPontoDia(estado || estadoPontoVazio());
        if (typeof atualizarAvisoPontoPendente === 'function') atualizarAvisoPontoPendente();

        if (forcarNuvem !== false && navigator.onLine) {
            try {
                const nuvem = await promiseComTimeout(
                    obterEstadoPontoDiaFromFirestore(funcId, dataHoje),
                    7000,
                    'timeout_ui_botoes_ponto'
                );
                if (nuvem) {
                    estado = nuvem;
                    try { localStorage.setItem(chave, JSON.stringify(nuvem)); } catch (_) {}
                    aplicarUiBotoesPontoDia(estado);
                }
            } catch (e) {
                console.warn('ui botoes ponto nuvem', e);
            }
        }
        if (typeof aplicarTravaPontoDiaAnterior === 'function') aplicarTravaPontoDiaAnterior();
        atualizarAvisoAtestadoRelogio();
    };

    /** Mensagem única exibida ao funcionário quando clica fora da ordem ou repete batida. */
    const MSG_PONTO_ORDEM_ERRADA_FUNC =
        'OPS, você já registrou esta jornada ou bateu a ordem errada.<br><br>'
        + '<b>Ordem correta:</b><br>🟢 ENTRADA → ⏸️ INÍCIO DE INTERVALO → ▶️ FIM DE INTERVALO → 🔴 SAÍDA';

    /**
     * Sequência rígida do dia (1 de cada):
     * Entrada → Início Intervalo → Fim Intervalo → Saída
     * Não permite 2 entradas, 2 intervalos nem pular etapas.
     */
    function validarSequenciaPontoTipo(tipoMarcacao, estado) {
        const last = estado && estado.lastTipo ? estado.lastTipo : null;
        const encerrado = Boolean(estado && estado.encerrado);
        const tipo = normalizarTipoBatidaPonto(tipoMarcacao);

        function falha(motivoInterno) {
            return { ok: false, msg: MSG_PONTO_ORDEM_ERRADA_FUNC, motivo: motivoInterno || 'ordem_errada' };
        }

        if (encerrado || last === 'Saída') {
            return falha('Jornada já encerrada com SAÍDA.');
        }

        // 1ª batida: só ENTRADA
        if (!last) {
            if (tipo !== 'Entrada') {
                return falha('A primeira marcação do dia deve ser ENTRADA.');
            }
            return { ok: true };
        }

        // Depois de ENTRADA: só INÍCIO INTERVALO
        if (last === 'Entrada') {
            if (tipo === 'Entrada') return falha('ENTRADA já registrada.');
            if (tipo !== 'Início Intervalo') {
                return falha('Após ENTRADA, o próximo passo é INÍCIO DE INTERVALO.');
            }
            return { ok: true };
        }

        // Depois de INÍCIO INTERVALO: só FIM INTERVALO
        if (last === 'Início Intervalo') {
            if (tipo === 'Início Intervalo') return falha('INÍCIO DE INTERVALO já registrado.');
            if (tipo !== 'Fim Intervalo') {
                return falha('Após INÍCIO DE INTERVALO, o próximo passo é FIM DE INTERVALO.');
            }
            return { ok: true };
        }

        // Depois de FIM INTERVALO: só SAÍDA (sem segundo intervalo)
        if (last === 'Fim Intervalo') {
            if (tipo === 'Fim Intervalo') return falha('FIM DE INTERVALO já registrado.');
            if (tipo === 'Início Intervalo') {
                return falha('Só é permitido 1 intervalo por dia. O próximo passo é SAÍDA.');
            }
            if (tipo !== 'Saída') {
                return falha('Após FIM DE INTERVALO, o próximo passo é SAÍDA.');
            }
            return { ok: true };
        }

        return falha('Ordem de batida inválida.');
    }

    function aplicarBatidaEstadoPonto(estado, tipoMarcacao) {
        const novo = {
            lastTipo: tipoMarcacao,
            lastTs: estado && estado.lastTs != null ? estado.lastTs : null,
            emIntervalo: Boolean(estado && estado.emIntervalo),
            encerrado: Boolean(estado && estado.encerrado)
        };
        if (tipoMarcacao === 'Início Intervalo') novo.emIntervalo = true;
        if (tipoMarcacao === 'Fim Intervalo') novo.emIntervalo = false;
        if (tipoMarcacao === 'Entrada') novo.emIntervalo = false;
        if (tipoMarcacao === 'Saída') {
            novo.emIntervalo = false;
            novo.encerrado = true;
        }
        return novo;
    }

    function derivarEstadoPontoDeBatidas(batidasAsc, canceladosSet) {
        const ordenadas = (batidasAsc || []).slice().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        let estado = estadoPontoVazio();
        ordenadas.forEach((b) => {
            if (canceladosSet && canceladosSet.has(b.id)) return;
            const valid = validarSequenciaPontoTipo(b.tipo, estado);
            if (!valid.ok) return;
            estado = aplicarBatidaEstadoPonto(estado, b.tipo);
            if (b.timestamp != null) estado.lastTs = b.timestamp;
        });
        return estado;
    }

    function detectarErrosSequenciaPontoDia(batidas, canceladosSet) {
        const ordenadas = (batidas || []).slice().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        let estado = estadoPontoVazio();
        const erros = [];
        ordenadas.forEach((b) => {
            if (canceladosSet && canceladosSet.has(b.id)) return;
            const valid = validarSequenciaPontoTipo(b.tipo, estado);
            if (!valid.ok) {
                erros.push({
                    pontoId: b.id,
                    funcionario_id: b.funcionario_id,
                    nome: b.nome,
                    tipo: b.tipo,
                    data: b.data,
                    hora: b.hora,
                    obra: b.obra,
                    msg: valid.msg,
                    origem: 'registro'
                });
                return;
            }
            estado = aplicarBatidaEstadoPonto(estado, b.tipo);
            if (b.timestamp != null) estado.lastTs = b.timestamp;
        });
        return erros;
    }

    function chaveDedupBatidaPonto(b) {
        const data = formatarDataBrPadrao(b && b.data) || String(b && b.data || '').trim();
        const tipo = normalizarTipoBatidaPonto(b && b.tipo);
        const hora = normalizarHoraHHmm(b && b.hora || '00:00');
        return data + '|' + tipo + '|' + hora;
    }

    function pontuacaoBatidaPontoParaManter(b) {
        let score = 0;
        if (b && b.foto) score += 4;
        if (b && b.latitude != null && b.longitude != null) score += 2;
        if (b && b.registo_manual_rh) score += 1;
        if (b && b.id) score += 0.001;
        return score;
    }

    function deduplicarBatidasPonto(batidas, canceladosSet) {
        const mapa = new Map();
        const duplicadosIds = new Set();

        (batidas || []).forEach((b) => {
            if (!b) return;
            if (canceladosSet && b.id && canceladosSet.has(b.id)) return;
            const chave = chaveDedupBatidaPonto(b);
            const item = Object.assign({}, b, {
                tipo: normalizarTipoBatidaPonto(b.tipo),
                hora: normalizarHoraHHmm(b.hora)
            });
            const slot = mapa.get(chave);
            if (!slot) {
                mapa.set(chave, item);
                return;
            }
            const manterNovo = pontuacaoBatidaPontoParaManter(item) > pontuacaoBatidaPontoParaManter(slot);
            if (manterNovo) {
                if (slot.id) duplicadosIds.add(slot.id);
                mapa.set(chave, item);
            } else if (item.id) {
                duplicadosIds.add(item.id);
            }
        });

        const validas = Array.from(mapa.values());
        validas.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
        return { validas, duplicadosIds };
    }

    function existeBatidaDuplicadaPonto(batidas, canceladosSet, tipo, dataBR, horaHM) {
        const chaveNova = formatarDataBrPadrao(dataBR) + '|' + normalizarTipoBatidaPonto(tipo) + '|' + normalizarHoraHHmm(horaHM);
        return (batidas || []).some((b) => {
            if (!b) return false;
            if (canceladosSet && b.id && canceladosSet.has(b.id)) return false;
            return chaveDedupBatidaPonto(b) === chaveNova;
        });
    }

    window.deduplicarBatidasPonto = deduplicarBatidasPonto;
    window.chaveDedupBatidaPonto = chaveDedupBatidaPonto;

    async function buscarIdsPontoCanceladosFuncionario(funcId) {
        const ids = new Set();
        try {
            const qEvt = query(collection(db, 'ponto_eventos'), where('funcionario_id', '==', funcId));
            const snapEvt = await getDocs(qEvt);
            snapEvt.forEach((d) => {
                const ev = d.data();
                if (ev && ev.tipo === 'CANCELAMENTO' && ev.ponto_id) ids.add(ev.ponto_id);
            });
        } catch (e) {
            console.warn('cancelamentos ponto', e);
        }
        return ids;
    }

    async function buscarBatidasPontoDiaFuncionario(funcId, dataBR) {
        const arr = [];
        try {
            const q = query(collection(db, 'ponto_registros'), where('funcionario_id', '==', funcId));
            const snap = await getDocs(q);
            snap.forEach((docSnap) => {
                const d = docSnap.data();
                const dataDoc = formatarDataBrPadrao(d.data || '') || String(d.data || '');
                const dataAlvo = formatarDataBrPadrao(dataBR) || String(dataBR || '');
                if (dataDoc && dataAlvo && dataDoc === dataAlvo) {
                    arr.push(Object.assign({ id: docSnap.id }, d));
                }
            });
        } catch (e) {
            console.warn('batidas ponto dia', e);
        }
        return arr;
    }

    async function obterEstadoPontoDiaFromFirestore(funcId, dataBR) {
        const cancelados = await buscarIdsPontoCanceladosFuncionario(funcId);
        const batidas = await buscarBatidasPontoDiaFuncionario(funcId, dataBR);
        const dedup = deduplicarBatidasPonto(batidas, cancelados);
        return derivarEstadoPontoDeBatidas(dedup.validas, cancelados);
    }

    async function registrarEventoSequenciaPontoInvalida(dados) {
        try {
            await ensureAuth();
            await addDoc(collection(db, 'ponto_eventos'), Object.assign({
                tipo: 'SEQUENCIA_INVALIDA',
                bloqueado: true,
                criado_em: serverTimestamp()
            }, dados));
        } catch (e) {
            console.warn('evento sequencia ponto', e);
        }
    }

    window.validarSequenciaPontoTipo = validarSequenciaPontoTipo;
    window.detectarErrosSequenciaPontoDia = detectarErrosSequenciaPontoDia;
    window.obterEstadoPontoDiaFromFirestore = obterEstadoPontoDiaFromFirestore;

    function sanitizarPayloadPontoParaLocal(payload) {
        const limpo = Object.assign({}, payload || {});
        // FieldValue (serverTimestamp) não sobrevive ao JSON.stringify do localStorage
        delete limpo.created_at;
        delete limpo.synced_at;
        return limpo;
    }

    function dataBrDoRegistroPonto(p) {
        const br = formatarDataBrPadrao(p && p.data);
        if (br && br.indexOf('Outros') === -1 && /^\d{2}\/\d{2}\/\d{4}$/.test(br)) return br;
        const ts = Number(p && p.timestamp);
        if (ts && !isNaN(ts)) {
            const d = new Date(ts);
            if (!isNaN(d.getTime())) {
                return String(d.getDate()).padStart(2, '0') + '/'
                    + String(d.getMonth() + 1).padStart(2, '0') + '/'
                    + d.getFullYear();
            }
        }
        return obterDataHojeBrPonto();
    }

    function aliviarFotoPonto(payload) {
        const out = Object.assign({}, payload || {});
        if (out.foto && String(out.foto).length > 700000) {
            out.foto = null;
            out.foto_omitida = true;
        }
        return out;
    }

    function lerFilaPontoOffline() {
        try {
            const arr = JSON.parse(localStorage.getItem('pontos_offline') || '[]');
            return Array.isArray(arr) ? arr.filter(Boolean) : [];
        } catch (_) {
            return [];
        }
    }

    function gravarFilaPontoOffline(lista) {
        const fila = Array.isArray(lista) ? lista.slice() : [];
        try {
            localStorage.setItem('pontos_offline', JSON.stringify(fila));
            return true;
        } catch (e) {
            try {
                const semFoto = fila.map(function (p) {
                    const x = Object.assign({}, p);
                    if (x.foto) {
                        x.foto = null;
                        x.foto_omitida = true;
                    }
                    return x;
                });
                localStorage.setItem('pontos_offline', JSON.stringify(semFoto));
                return true;
            } catch (e2) {
                console.error('fila ponto offline cheia', e2);
                return false;
            }
        }
    }

    function pontosOfflineDoFuncionario(funcId) {
        return lerFilaPontoOffline().filter(function (p) {
            return !funcId || String(p.funcionario_id || '') === String(funcId);
        });
    }

    function datasPontoOfflineDiaAnterior(funcId) {
        const hoje = obterDataHojeBrPonto();
        const datas = [];
        pontosOfflineDoFuncionario(funcId).forEach(function (p) {
            const d = dataBrDoRegistroPonto(p);
            if (d && d !== hoje && datas.indexOf(d) === -1) datas.push(d);
        });
        return datas;
    }

    function temPontoOfflineDiaAnterior(funcId) {
        return datasPontoOfflineDiaAnterior(funcId).length > 0;
    }

    function aplicarTravaPontoDiaAnterior() {
        const funcId = typeof getSessaoFunc === 'function' ? getSessaoFunc('funcLogadoId') : null;
        const trava = temPontoOfflineDiaAnterior(funcId);
        const box = document.getElementById('trava-ponto-dia-anterior');
        const aviso = document.getElementById('aviso-trava-ponto-dia-anterior');
        const btnEnviar = document.getElementById('btn-enviar-ponto-dia-anterior');
        if (box) {
            box.style.display = 'block';
            box.style.background = trava ? '#922b21' : '#1a2a43';
            box.style.borderColor = '#f1c40f';
        }
        if (aviso) {
            const datas = datasPontoOfflineDiaAnterior(funcId);
            aviso.innerHTML = trava
                ? '<b>AGUARDE</b><br>Enviando ponto batido do dia anterior (' + datas.join(', ') + ') que estava offline e não foi enviado na data correta ao sistema.<br>Toque no botão abaixo para enviar. Só depois libera o ponto de hoje.'
                : 'Se ontem o ponto ficou offline e não foi enviado na data correta, toque no botão abaixo antes de bater o ponto de hoje.';
        }
        if (btnEnviar) {
            btnEnviar.disabled = false;
            btnEnviar.style.opacity = '1';
        }
        if (!trava) return false;
        Object.keys(IDS_BOTOES_PONTO).forEach(function (tipo) {
            const btn = document.getElementById(IDS_BOTOES_PONTO[tipo]);
            if (!btn) return;
            btn.disabled = true;
            btn.setAttribute('aria-disabled', 'true');
            btn.title = 'Aguarde o envio do ponto do dia anterior.';
        });
        return true;
    }

    async function atualizarAvisoAtestadoRelogio() {
        const el = document.getElementById('aviso-atestado-relogio');
        if (!el) return;
        const tela = document.getElementById('tela-relogio');
        if (!tela || tela.style.display === 'none') {
            el.style.display = 'none';
            return;
        }
        const funcId = typeof getSessaoFunc === 'function' ? getSessaoFunc('funcLogadoId') : null;
        if (!funcId) {
            el.style.display = 'none';
            return;
        }
        try {
            const snap = await getDoc(doc(db, 'funcionarios', funcId));
            const inf = infoAtestadoFuncionario(snap.exists() ? snap.data() : {});
            if (!inf.ativo) {
                el.style.display = 'none';
                return;
            }
            el.style.display = 'block';
            el.innerHTML = '<b>🏥 Funcionário em atestado médico</b><br>Período de '
                + escapeHtmlBasico(formatarDataBrDeIso(inf.inicioIso)) + ' até '
                + escapeHtmlBasico(formatarDataBrDeIso(inf.fimIso))
                + ' (' + escapeHtmlBasico(String(inf.dias)) + ' dia(s)). Nestes dias o ponto não é obrigatório e o salário não desconta falta. Depois dessa data, volta a contar só o horário batido.';
        } catch (_) {
            el.style.display = 'none';
        }
    }
    window.atualizarAvisoAtestadoRelogio = atualizarAvisoAtestadoRelogio;

    function atualizarAvisoPontoPendente() {
        const el = document.getElementById('alerta-ponto-pendente');
        const funcId = typeof getSessaoFunc === 'function' ? getSessaoFunc('funcLogadoId') : null;
        const fila = pontosOfflineDoFuncionario(funcId);
        const datasAnt = datasPontoOfflineDiaAnterior(funcId);
        if (el) {
            if (!fila.length) {
                el.style.display = 'none';
                el.innerHTML = '';
            } else if (datasAnt.length) {
                el.style.display = 'block';
                el.innerHTML = '⛔ Há ponto do dia <b>' + datasAnt.join(', ') + '</b> ainda não enviado.<br>O ponto de <b>hoje fica bloqueado</b> até esse envio.';
            } else {
                el.style.display = 'block';
                el.innerHTML = '⏳ <b>' + fila.length + ' ponto(s) de hoje</b> ainda estão na fila offline e serão enviados com a data de hoje.';
            }
        }
        aplicarTravaPontoDiaAnterior();
    }

    const MSG_ENVIO_DIA_ANTERIOR_PONTO =
        'AGUARDE.<br><br>Enviando ponto batido do <b>dia anterior</b> que estava offline e <b>não foi enviado na data correta</b> ao sistema.<br><br>Depois disso você poderá bater o ponto de <b>hoje</b>.';

    async function gravarPontoFilaNaNuvem(payloadOrigem) {
        const tentar = async function (payload) {
            await promiseComTimeout(
                addDoc(collection(db, 'ponto_registros'), payload),
                12000,
                'timeout_add_ponto'
            );
        };
        const cheio = prepararPayloadPontoParaFirestore(payloadOrigem);
        try {
            await tentar(cheio);
            return true;
        } catch (e1) {
            const leve = Object.assign({}, cheio, { foto: null, foto_omitida: true });
            await tentar(leve);
            return true;
        }
    }

    window.enviarPontoOfflinePendente = async function () {
        if (window.__envioPontoAnteriorTrava) return;
        window.__envioPontoAnteriorTrava = true;
        const btnEnviar = document.getElementById('btn-enviar-ponto-dia-anterior');
        const textoBtn = btnEnviar ? btnEnviar.innerHTML : '';
        if (btnEnviar) {
            btnEnviar.disabled = true;
            btnEnviar.innerHTML = 'ENVIANDO...';
        }
        const fecharAguarde = function () {
            try {
                if (typeof Swal.hideLoading === 'function') Swal.hideLoading();
                if (Swal.isVisible()) Swal.close();
            } catch (_) {}
        };
        try {
            const funcId = typeof getSessaoFunc === 'function' ? getSessaoFunc('funcLogadoId') : null;
            const filaLocal = typeof pontosOfflineDoFuncionario === 'function' ? pontosOfflineDoFuncionario(funcId) : [];
            const eraDiaAnterior = temPontoOfflineDiaAnterior(funcId);
            if (!eraDiaAnterior && !(filaLocal && filaLocal.length)) {
                if (typeof atualizarUiBotoesPontoDia === 'function') atualizarUiBotoesPontoDia(true);
                return Swal.fire({
                    icon: 'info',
                    title: 'Nada pendente',
                    html: 'Não há ponto do dia anterior neste celular esperando envio.<br><br>Você já pode bater o ponto de <b>hoje</b>.',
                    confirmButtonColor: '#1a2a43'
                });
            }
            if (!navigator.onLine) {
                return Swal.fire({
                    icon: 'warning',
                    title: 'Sem internet',
                    html: eraDiaAnterior
                        ? 'Há ponto do dia anterior offline que ainda não foi enviado na data correta ao sistema.<br><br>Conecte a internet para enviar. Só depois será liberado o ponto de hoje.'
                        : 'Há ponto offline neste celular. Conecte a internet e toque de novo em <b>ENVIAR PONTO DO DIA ANTERIOR</b>.',
                    confirmButtonColor: '#1a2a43'
                });
            }
            let estourouTempo = false;
            const timerAguarde = setTimeout(function () { estourouTempo = true; fecharAguarde(); }, 40000);
            Swal.fire({
                title: 'AGUARDE',
                html: eraDiaAnterior ? MSG_ENVIO_DIA_ANTERIOR_PONTO : 'Enviando os pontos que estavam offline neste celular.',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                didOpen: function () { Swal.showLoading(); }
            });
            try {
                await promiseComTimeout(sincronizarPontoOffline({ forcar: true }), 38000, 'timeout_envio_dia_anterior');
            } catch (_) {}
            clearTimeout(timerAguarde);
            fecharAguarde();
            await new Promise(function (r) { setTimeout(r, 280); });
            if (temPontoOfflineDiaAnterior(funcId) || estourouTempo) {
                return Swal.fire({
                    icon: 'error',
                    title: estourouTempo ? 'Demorou demais' : 'Ainda não enviado',
                    html: 'Não foi possível enviar o ponto do dia anterior agora. Mantenha a internet e toque de novo em <b>ENVIAR PONTO DO DIA ANTERIOR</b>.',
                    confirmButtonColor: '#1a2a43'
                });
            }
            if (typeof atualizarUiBotoesPontoDia === 'function') await atualizarUiBotoesPontoDia(true);
            return Swal.fire({
                icon: 'success',
                title: eraDiaAnterior ? 'Enviado na data correta' : 'Fila enviada',
                html: eraDiaAnterior
                    ? 'O ponto do dia anterior foi enviado ao sistema.<br><br>Agora você pode bater o ponto de <b>hoje</b>.'
                    : 'Os pontos pendentes deste celular foram enviados.<br><br>Agora você pode bater o ponto de <b>hoje</b>.',
                confirmButtonColor: '#1a2a43'
            });
        } finally {
            window.__envioPontoAnteriorTrava = false;
            if (btnEnviar) {
                btnEnviar.disabled = false;
                btnEnviar.innerHTML = textoBtn || 'ENVIAR PONTO DO DIA ANTERIOR';
            }
            if (typeof aplicarTravaPontoDiaAnterior === 'function') aplicarTravaPontoDiaAnterior();
        }
    };

    function prepararPayloadPontoParaFirestore(payloadOrigem) {
        const payload = aliviarFotoPonto(sanitizarPayloadPontoParaLocal(payloadOrigem));
        payload.data = dataBrDoRegistroPonto(payload);
        payload.created_at = serverTimestamp();
        payload.synced_at = serverTimestamp();
        payload.origem_registro = payload.origem_registro || 'offline_sync';
        return payload;
    }

    async function sincronizarPontoOffline(opts) {
        const forcar = !!(opts && opts.forcar);
        if (window.__syncPontoOfflineRodando && !forcar) {
            try {
                return await promiseComTimeout(window.__syncPontoOfflineRodando, 20000, 'timeout_wait_sync');
            } catch (_) {
                window.__syncPontoOfflineRodando = null;
            }
        }
        const geracao = (window.__syncPontoGeracao = (window.__syncPontoGeracao || 0) + 1);
        const job = (async function () {
        let pontosOffline = lerFilaPontoOffline();
        
        if (pontosOffline.length > 0 && navigator.onLine) {
            try {
                const vistosFila = new Map();
                const filaLimpa = [];
                pontosOffline.forEach((p) => {
                    if (!p) return;
                    const item = Object.assign({}, p, { data: dataBrDoRegistroPonto(p) });
                    const chave = chaveDedupBatidaPonto(item);
                    const atual = vistosFila.get(chave);
                    if (!atual) {
                        vistosFila.set(chave, item);
                        filaLimpa.push(item);
                        return;
                    }
                    if (pontuacaoBatidaPontoParaManter(item) > pontuacaoBatidaPontoParaManter(atual)) {
                        const idx = filaLimpa.indexOf(atual);
                        if (idx >= 0) filaLimpa[idx] = item;
                        vistosFila.set(chave, item);
                    }
                });
                pontosOffline = filaLimpa;
            } catch (_) {}

            let salvos = 0;
            const pendentes = [];
            try { await promiseComTimeout(ensureAuth(), 8000, 'timeout_auth_sync'); } catch (_) {}

            for (let i = 0; i < pontosOffline.length; i++) {
                try {
                    const bruto = pontosOffline[i];
                    const payload = prepararPayloadPontoParaFirestore(bruto);
                    const funcId = payload.funcionario_id;
                    const dataBR = dataBrDoRegistroPonto(payload);

                    let jaExisteNaNuvem = false;
                    if (!forcar) {
                        try {
                            const cancelados = funcId ? await promiseComTimeout(
                                buscarIdsPontoCanceladosFuncionario(funcId),
                                4000,
                                'timeout_cancel_sync'
                            ) : new Set();
                            const batidasDia = funcId ? await promiseComTimeout(
                                buscarBatidasPontoDiaFuncionario(funcId, dataBR),
                                4000,
                                'timeout_batidas_sync'
                            ) : [];
                            jaExisteNaNuvem = existeBatidaDuplicadaPonto(batidasDia, cancelados, payload.tipo, dataBR, payload.hora);
                        } catch (eDup) {
                            jaExisteNaNuvem = false;
                        }
                    }

                    if (jaExisteNaNuvem) {
                        salvos++;
                        continue;
                    }

                    await gravarPontoFilaNaNuvem(bruto);
                    salvos++;
                } catch (e) {
                    console.error('Erro de sincronização', e);
                    pendentes.push(aliviarFotoPonto(pontosOffline[i]));
                }
            }
            if (geracao !== window.__syncPontoGeracao) return;
            if (pendentes.length) {
                gravarFilaPontoOffline(pendentes);
            } else {
                localStorage.removeItem('pontos_offline');
            }
            if (salvos > 0) {
                try {
                    if (!(typeof Swal !== 'undefined' && Swal.isVisible() && document.querySelector('.swal2-loader'))) {
                        Swal.fire({ 
                            toast: true, 
                            position: 'top-end', 
                            icon: 'success', 
                            title: 'Pontos offline sincronizados!', 
                            showConfirmButton: false, 
                            timer: 3000 
                        });
                    }
                } catch (_) {}
            }
        }
        if (typeof atualizarAvisoPontoPendente === 'function') atualizarAvisoPontoPendente();
        })();
        const limitado = promiseComTimeout(job, 36000, 'timeout_sync_total');
        window.__syncPontoOfflineRodando = limitado;
        try {
            return await limitado;
        } finally {
            if (window.__syncPontoOfflineRodando === limitado) window.__syncPontoOfflineRodando = null;
        }
    }

    document.getElementById('btnLinkPonto').onclick = function() {
        const linkPonto = `${window.location.origin}${window.location.pathname}`;
        navigator.clipboard.writeText(linkPonto);
        Swal.fire('Link Copiado!', 'O funcionário só precisa entrar no link e escolher a opção "SOU FUNCIONÁRIO".', 'success');
    };

    window.baterPonto = async function(tipo) {
        if (window.__pontoProcessando) {
            return Swal.fire({ icon: 'info', title: 'Aguarde', text: 'O registro anterior ainda está sendo processado.', timer: 2200, showConfirmButton: false });
        }
        const funcIdTrava = typeof getSessaoFunc === 'function' ? getSessaoFunc('funcLogadoId') : null;
        if (typeof temPontoOfflineDiaAnterior === 'function' && temPontoOfflineDiaAnterior(funcIdTrava)) {
            if (typeof window.enviarPontoOfflinePendente === 'function') {
                await window.enviarPontoOfflinePendente();
            }
            if (temPontoOfflineDiaAnterior(funcIdTrava)) return;
        }
        if (navigator.onLine && typeof sincronizarPontoOffline === 'function') {
            try { await sincronizarPontoOffline(); } catch (_) {}
        }
        if (typeof temPontoOfflineDiaAnterior === 'function' && temPontoOfflineDiaAnterior(funcIdTrava)) {
            return Swal.fire({
                icon: 'warning',
                title: 'Aguarde',
                html: MSG_ENVIO_DIA_ANTERIOR_PONTO,
                confirmButtonColor: '#1a2a43'
            });
        }
        const obra = (document.getElementById('obra-atual').value || '').trim();
        const fotoBase64 = document.getElementById('foto-base64').value;
        const empresaDoFuncionario = getSessaoFunc('funcLogadoEmpresa');

        function obterDataAtualStr() {
            const d = new Date();
            const diaStr = String(d.getDate()).padStart(2, '0');
            const mesStr = String(d.getMonth() + 1).padStart(2, '0');
            const anoStr = d.getFullYear();
            return `${diaStr}/${mesStr}/${anoStr}`;
        }

        function getChaveEstadoPonto(funcId) {
            const dataHoje = obterDataAtualStr();
            return `estado_ponto_${funcId}_${dataHoje}`;
        }

        function lerEstadoPonto(funcId) {
            try {
                return JSON.parse(localStorage.getItem(getChaveEstadoPonto(funcId)) || 'null');
            } catch {
                return null;
            }
        }

        function salvarEstadoPonto(funcId, estado) {
            localStorage.setItem(getChaveEstadoPonto(funcId), JSON.stringify(estado));
        }

        function atualizarEstadoAposMarcacao(funcId, tipoMarcacao, ts) {
            const base = lerEstadoPonto(funcId) || estadoPontoVazio();
            const novo = aplicarBatidaEstadoPonto(base, tipoMarcacao);
            novo.lastTs = ts;
            salvarEstadoPonto(funcId, novo);
            if (typeof aplicarUiBotoesPontoDia === 'function') {
                aplicarUiBotoesPontoDia(novo);
            }
        }

        const funcIdPre = getSessaoFunc('funcLogadoId');
        const dataHojePonto = obterDataAtualStr();
        const estaOffline = !navigator.onLine;

        if (funcIdPre) {
            let estadoAtual = estadoPontoVazio();
            if (estaOffline) {
                // Offline: usa só o estado do celular (não espera a nuvem)
                estadoAtual = lerEstadoPonto(funcIdPre) || estadoPontoVazio();
            } else {
                try {
                    Swal.fire({
                        title: 'Verificando sequência...',
                        allowOutsideClick: false,
                        showConfirmButton: false,
                        didOpen: function () { Swal.showLoading(); }
                    });
                    estadoAtual = await promiseComTimeout(
                        obterEstadoPontoDiaFromFirestore(funcIdPre, dataHojePonto),
                        8000,
                        'timeout_estado_ponto'
                    );
                    salvarEstadoPonto(funcIdPre, estadoAtual);
                } catch (e) {
                    console.warn('estado ponto nuvem', e);
                    estadoAtual = lerEstadoPonto(funcIdPre) || estadoPontoVazio();
                } finally {
                    try { if (Swal.isVisible()) Swal.close(); } catch (_) {}
                }
            }

            const valid = validarSequenciaPontoTipo(tipo, estadoAtual);
                if (!valid.ok) {
                const horaTent = String(new Date().getHours()).padStart(2, '0') + ':' + String(new Date().getMinutes()).padStart(2, '0');
                if (!estaOffline) {
                    await registrarEventoSequenciaPontoInvalida({
                        empresa_id: empresaDoFuncionario || null,
                        funcionario_id: funcIdPre,
                        funcionario_nome: getSessaoFunc('funcLogadoNome') || '',
                        tipo_tentado: tipo,
                        motivo: valid.motivo || valid.msg,
                        data_br: dataHojePonto,
                        hora_tentativa: horaTent,
                        origem: 'batida_funcionario'
                    });
                    if (typeof monitorarSequenciaPontoGestor === 'function') {
                        try { monitorarSequenciaPontoGestor(); } catch (_) {}
                    }
                }
                return Swal.fire({
                    icon: 'warning',
                    title: 'OPS!',
                    html: valid.msg
                        + (estaOffline
                            ? '<br><br><small>Sem internet: fale com a gestão se precisar corrigir.</small>'
                            : '<br><br><small>A gestão foi avisada automaticamente.</small>'),
                    confirmButtonText: 'Entendi',
                    confirmButtonColor: '#1a2a43'
                });
            }

            const horaPrev = String(new Date().getHours()).padStart(2, '0') + ':' + String(new Date().getMinutes()).padStart(2, '0');

            // Duplicado na fila offline (mesmo tipo + horário)
            try {
                const filaOff = JSON.parse(localStorage.getItem('pontos_offline') || '[]');
                if (existeBatidaDuplicadaPonto(filaOff, null, tipo, dataHojePonto, horaPrev)) {
                    return Swal.fire(
                        'Ponto já registado',
                        'Já existe <b>' + escapeHtmlBasico(tipo) + '</b> hoje às <b>' + escapeHtmlBasico(horaPrev) + '</b> na fila offline.<br><br>NÃO BATA NOVAMENTE.',
                        'info'
                    );
                }
            } catch (_) {}

            if (!estaOffline) {
                try {
                    const canceladosDup = await promiseComTimeout(
                        buscarIdsPontoCanceladosFuncionario(funcIdPre),
                        6000,
                        'timeout_cancel_ponto'
                    );
                    const batidasHojeDup = await promiseComTimeout(
                        buscarBatidasPontoDiaFuncionario(funcIdPre, dataHojePonto),
                        6000,
                        'timeout_batidas_ponto'
                    );
                    if (existeBatidaDuplicadaPonto(batidasHojeDup, canceladosDup, tipo, dataHojePonto, horaPrev)) {
                        return Swal.fire(
                            'Ponto já registado',
                            'Já existe <b>' + escapeHtmlBasico(tipo) + '</b> hoje às <b>' + escapeHtmlBasico(horaPrev) + '</b>.<br><br>Apenas <b>uma</b> batida com o mesmo horário conta.',
                            'info'
                        );
                    }
                } catch (eDup) {
                    console.warn('checagem duplicado nuvem', eDup);
                }
            }

            const chaveAntiDuplo = 'ultimo_ponto_envio_' + funcIdPre;
            try {
                const ult = JSON.parse(localStorage.getItem(chaveAntiDuplo) || 'null');
                const agoraMs = Date.now();
                if (ult && ult.tipo === tipo && ult.data === dataHojePonto && ult.hora === horaPrev && (agoraMs - (ult.ts || 0)) < 20000) {
                    return Swal.fire({ icon: 'info', title: 'Aguarde', text: 'Este ponto já foi enviado há instantes. Não é necessário clicar novamente.', timer: 2800, showConfirmButton: false });
                }
            } catch (_) {}
        }

        if (!obra) {
            return Swal.fire('Atenção', 'Deve informar em qual obra está!', 'warning');
        }

        if (!fotoBase64) {
            return Swal.fire('Atenção', 'Tire a foto de confirmação (frontal ou traseira) antes de bater o ponto!', 'warning');
        }

        let authUid = null;
        if (!estaOffline) {
            try {
                const user = await promiseComTimeout(ensureAuth(), 8000, 'timeout_auth_ponto');
                authUid = user?.uid || localStorage.getItem('auth_uid') || null;
            } catch (e) {
                console.error('ensureAuth no ponto', e);
                authUid = localStorage.getItem('auth_uid') || null;
            }
        } else {
            authUid = localStorage.getItem('auth_uid') || null;
        }

        function liberaProcessamento() {
            window.__pontoProcessando = false;
        }

        window.__pontoProcessando = true;
        // Se o botão já está OK/cinza, não processa
        const mapaBtn = {
            'Entrada': 'btn-ponto-entrada',
            'Início Intervalo': 'btn-ponto-inicio-intervalo',
            'Fim Intervalo': 'btn-ponto-fim-intervalo',
            'Saída': 'btn-ponto-saida'
        };
        const btnTipo = document.getElementById(mapaBtn[tipo] || '');
        if (btnTipo && (btnTipo.disabled || btnTipo.classList.contains('btn-ponto-ok'))) {
            window.__pontoProcessando = false;
            return Swal.fire({
                icon: 'info',
                title: 'Já registrado',
                text: 'Este ponto já foi batido hoje. Só poderá bater de novo amanhã.',
                confirmButtonColor: '#1a2a43'
            });
        }

        Swal.fire({
            title: estaOffline ? 'A gravar ponto offline...' : 'A gravar ponto...',
            text: estaOffline
                ? 'Sem internet — o ponto será salvo neste celular e enviado depois.'
                : 'A obter localização (GPS). Permita o acesso à localização se o navegador pedir.',
            allowOutsideClick: true,
            didOpen: function () { Swal.showLoading(); }
        });

        async function processarPontoFinal(lat, lng) {
            try {
                if (typeof Swal !== 'undefined' && Swal.close) Swal.close();
            } catch (_) {}

            const geo = normalizarCoordenadasGPS(lat, lng);
            const funcId = getSessaoFunc('funcLogadoId');
            const funcNome = getSessaoFunc('funcLogadoNome');

            const dataObj = new Date();
            const diaStr = String(dataObj.getDate()).padStart(2, '0');
            const mesStr = String(dataObj.getMonth() + 1).padStart(2, '0');
            const anoStr = dataObj.getFullYear();
            const dataAtual = `${diaStr}/${mesStr}/${anoStr}`;
            const horaAtual = String(dataObj.getHours()).padStart(2, '0') + ':' + String(dataObj.getMinutes()).padStart(2, '0');

            const payloadPonto = {
                empresa_id: empresaDoFuncionario,
                funcionario_id: funcId,
                auth_uid: authUid,
                nome: funcNome,
                tipo: tipo,
                obra: obra,
                data: dataAtual,
                hora: horaAtual,
                latitude: geo.ok ? geo.lat : null,
                longitude: geo.ok ? geo.lng : null,
                foto: fotoBase64,
                timestamp: dataObj.getTime(),
                client_device_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
                origem_registro: (!navigator.onLine) ? 'offline_local' : 'online'
            };

            if (navigator.onLine) {
                try {
                    const canceladosGrav = await promiseComTimeout(
                        buscarIdsPontoCanceladosFuncionario(funcId),
                        5000,
                        'timeout_cancel_grav'
                    );
                    const batidasGrav = await promiseComTimeout(
                        buscarBatidasPontoDiaFuncionario(funcId, dataAtual),
                        5000,
                        'timeout_batidas_grav'
                    );
                    if (existeBatidaDuplicadaPonto(batidasGrav, canceladosGrav, tipo, dataAtual, horaAtual)) {
                        return Swal.fire(
                            'Ponto já registado',
                            'Já existe este registro às ' + horaAtual + '. Apenas uma batida conta.',
                            'info'
                        );
                    }
                    const payloadOnline = Object.assign({}, payloadPonto, { created_at: serverTimestamp() });
                    // Evita documento > ~900 KB (limite prático do Firestore = 1 MB)
                    if (payloadOnline.foto && String(payloadOnline.foto).length > 900000) {
                        payloadOnline.foto = null;
                        payloadOnline.foto_omitida = true;
                    }
                    const docRef = await addDoc(collection(db, "ponto_registros"), payloadOnline);
                    atualizarEstadoAposMarcacao(funcId, tipo, payloadPonto.timestamp);
                    try {
                        localStorage.setItem('ultimo_ponto_envio_' + funcId, JSON.stringify({
                            tipo: tipo,
                            data: dataAtual,
                            hora: horaAtual,
                            ts: Date.now()
                        }));
                    } catch (_) {}
                    if (typeof monitorarSequenciaPontoGestor === 'function') {
                        try { monitorarSequenciaPontoGestor(); } catch (_) {}
                    }
                    const avisoGps = geo.ok ? '' : '<br><small style="color:#666;">GPS não obtido nesta batida; o registro foi gravado sem coordenadas.</small>';
                    Swal.fire({
                        icon: 'success',
                        title: 'PONTO REGISTRADO',
                        html: ''
                            + '<p style="font-size:22px;font-weight:900;color:#b02a37;letter-spacing:0.5px;margin:8px 0 14px 0;line-height:1.25;">NÃO BATA NOVAMENTE</p>'
                            + '<p style="font-size:15px;margin:0 0 10px 0;"><b>' + escapeHtmlBasico(tipo) + '</b> às <b>' + escapeHtmlBasico(horaAtual) + '</b></p>'
                            + '<p style="font-size:12px;color:#555;margin:0;">Protocolo: ' + escapeHtmlBasico(docRef.id) + '</p>'
                            + avisoGps,
                        confirmButtonText: 'Entendi',
                        confirmButtonColor: '#1a2a43',
                        allowOutsideClick: false
                    });
                } catch (e) {
                    console.error(e);
                    const cod = String((e && (e.code || e.message)) || '').toLowerCase();
                    const cotaEstourada = /resource-exhausted|quota|exceeded|storage|unavailable|deadline|permission-denied|invalid-argument/.test(cod);
                    // Guarda fila offline sem popup duplicado
                    try {
                        const payloadLimpo = aliviarFotoPonto(sanitizarPayloadPontoParaLocal(payloadPonto));
                        payloadLimpo.data = dataBrDoRegistroPonto(payloadLimpo);
                        const offlineData = lerFilaPontoOffline();
                        if (!offlineData.some((p) => chaveDedupBatidaPonto(p) === chaveDedupBatidaPonto(payloadLimpo))) {
                            offlineData.push(payloadLimpo);
                            if (!gravarFilaPontoOffline(offlineData)) {
                                throw new Error('fila_local_cheia');
                            }
                        }
                        atualizarEstadoAposMarcacao(payloadLimpo.funcionario_id, payloadLimpo.tipo, payloadLimpo.timestamp);
                        if (typeof atualizarAvisoPontoPendente === 'function') atualizarAvisoPontoPendente();
                    } catch (_) {}
                    Swal.fire({
                        icon: 'warning',
                        title: cotaEstourada ? 'Nuvem sem espaço / limite' : 'Falha ao gravar na nuvem',
                        html: 'O ponto ficou <b>guardado neste celular</b> e ainda pode não aparecer no painel do RH.<br><br>'
                            + (cotaEstourada
                                ? 'Peça à gestão: menu <b>Backup</b> → mês <b>Agosto</b> / 2026 → baixar backup e depois <b>Limpeza da Nuvem</b> (atenção: selecione <b>agosto</b>, não setembro).'
                                : 'Verifique a internet e tente sincronizar depois. Se continuar, a gestão deve limpar as fotos de <b>agosto</b> na nuvem.')
                            + '<br><br><small style="color:#666;">Detalhe: ' + escapeHtmlBasico(String((e && (e.code || e.message)) || 'falha ao gravar')) + '</small>',
                        confirmButtonText: 'Entendi',
                        confirmButtonColor: '#1a2a43',
                        allowOutsideClick: false
                    });
                }
            } else {
                salvarNoCelular(payloadPonto);
            }

            document.getElementById('obra-atual').value = '';
            document.getElementById('foto-base64').value = '';
            document.getElementById('foto-tirada').style.display = 'none';
            document.getElementById('video-selfie').style.display = 'none';
            if (typeof window.reporUiCameraAposPonto === 'function') {
                window.reporUiCameraAposPonto();
            }
        }

        function salvarNoCelular(payloadPonto) {
            const payloadLimpo = aliviarFotoPonto(sanitizarPayloadPontoParaLocal(payloadPonto));
            payloadLimpo.data = dataBrDoRegistroPonto(payloadLimpo);
            const offlineData = lerFilaPontoOffline();
            if (offlineData.some((p) => chaveDedupBatidaPonto(p) === chaveDedupBatidaPonto(payloadLimpo))) {
                Swal.fire('Já guardado', 'Este ponto (mesmo tipo e horário) já está na fila offline. Apenas um registro conta.<br><br><b style="color:#b02a37;">NÃO BATA NOVAMENTE</b>', 'info');
                return;
            }
            offlineData.push(payloadLimpo);
            if (!gravarFilaPontoOffline(offlineData)) {
                Swal.fire('Erro', 'O celular não conseguiu guardar este ponto (memória cheia). Não apague os dados do site. Tente de novo com uma foto menor ou peça para enviar os pontos pendentes com internet.', 'error');
                return;
            }
            atualizarEstadoAposMarcacao(payloadLimpo.funcionario_id, payloadLimpo.tipo, payloadLimpo.timestamp);
            if (typeof atualizarAvisoPontoPendente === 'function') atualizarAvisoPontoPendente();
            try {
                localStorage.setItem('ultimo_ponto_envio_' + payloadLimpo.funcionario_id, JSON.stringify({
                    tipo: payloadLimpo.tipo,
                    data: payloadLimpo.data,
                    hora: payloadLimpo.hora,
                    ts: Date.now()
                }));
            } catch (_) {}
            Swal.fire({
                icon: 'info',
                title: 'PONTO REGISTRADO',
                html: ''
                    + '<p style="font-size:22px;font-weight:900;color:#b02a37;letter-spacing:0.5px;margin:8px 0 14px 0;line-height:1.25;">NÃO BATA NOVAMENTE</p>'
                    + '<p style="font-size:14px;margin:0 0 10px 0;">Sem internet — o ponto foi guardado no celular.</p>'
                    + '<p style="font-size:16px;margin:0;"><b>' + escapeHtmlBasico(payloadLimpo.tipo) + '</b><br>'
                    + '<b style="color:#d9534f;">' + escapeHtmlBasico(payloadLimpo.data) + ' às ' + escapeHtmlBasico(payloadLimpo.hora) + '</b></p>'
                    + '<p style="font-size:12px;color:#555;margin:12px 0 0 0;">Será enviado automaticamente quando a internet voltar, <b>com a data de hoje</b> — não vira o dia seguinte.</p>',
                confirmButtonText: 'Entendi',
                confirmButtonColor: '#1a2a43',
                allowOutsideClick: false
            });
        }

        try {
            let coords = { lat: null, lng: null };
            if (estaOffline) {
                // Offline: não trava no GPS — tenta rápido ou segue sem coordenadas
                try {
                    coords = await promiseComTimeout(
                        obterCoordenadasGeolocalizacaoRapida(),
                        4000,
                        'timeout_gps_offline'
                    );
                } catch (_) {
                    coords = { lat: null, lng: null };
                }
            } else {
                coords = await obterCoordenadasGeolocalizacaoRapida();
            }
            try { Swal.close(); } catch (_) {}
            await processarPontoFinal(coords.lat, coords.lng);
        } catch (e) {
            console.error('baterPonto', e);
            try { Swal.close(); } catch (_) {}
            Swal.fire('Erro', 'Não foi possível concluir o registro.', 'error');
        } finally {
            liberaProcessamento();
        }
    };

    window.abrirFoto = function(imgBase64, titulo) {
        if (!imgBase64) {
            return Swal.fire('Atenção', 'Nenhuma imagem para exibir.', 'info');
        }
        const srcRaw = String(imgBase64);
        const ehPdf = (typeof ehAnexoPdfDataUrl === 'function' && ehAnexoPdfDataUrl(srcRaw))
            || /\.pdf(\?|$)/i.test(srcRaw)
            || srcRaw.startsWith('data:application/pdf');

        if (typeof window.abrirVisualizadorDocumento === 'function') {
            window.abrirVisualizadorDocumento(srcRaw, titulo || (ehPdf ? 'Comprovante PDF' : 'Comprovante / Anexo'), ehPdf ? 'pdf' : 'img');
            return;
        }
    };

    const NOMES_DIA_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    function formatarHorasEspelhoHM(hDec) {
        if (hDec == null || !Number.isFinite(Number(hDec)) || Math.abs(Number(hDec)) < 0.0005) return '';
        const neg = Number(hDec) < 0;
        let abs = Math.abs(Number(hDec));
        let h = Math.floor(abs + 1e-9);
        let m = Math.round((abs - h) * 60);
        if (m === 60) { h += 1; m = 0; }
        return (neg ? '-' : '') + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }

    function feriadosNacionaisFixosEspelho(ano) {
        const y = Number(ano);
        return new Set([
            y + '-01-01', y + '-04-21', y + '-05-01', y + '-09-07',
            y + '-10-12', y + '-11-02', y + '-11-15', y + '-12-25'
        ]);
    }

    function dataBrParaIsoEspelho(dataBr) {
        const s = separarDataSegura(dataBr);
        if (!s || s.ano === 'Outros') return '';
        return String(s.ano) + '-' + String(s.mes).padStart(2, '0') + '-' + String(s.dia).padStart(2, '0');
    }

    function calcularHorasDoDiaEspelho(batidasRaw, canceladosSet) {
        const dedupDia = deduplicarBatidasPonto(batidasRaw, canceladosSet || null);
        const batidas = (dedupDia.validas || [])
            .map((b) => (b ? { ...b, tipo: normalizarTipoBatidaPonto(b.tipo) } : b))
            .filter((b) => b && ['Entrada', 'Saída', 'Início Intervalo', 'Fim Intervalo'].includes(b.tipo) && Number.isFinite(b.timestamp))
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        let trabalhandoDesde = null;
        let emIntervalo = false;
        let segundosTrabalhados = 0;
        let tevePar = false;
        let segundosIntervaloMedido = 0;
        let inicioIntervaloTs = null;
        const porTipo = {};

        for (const b of batidas) {
            if (!porTipo[b.tipo]) porTipo[b.tipo] = b;
            if (b.tipo === 'Entrada') {
                if (!emIntervalo && trabalhandoDesde == null) trabalhandoDesde = b.timestamp;
            } else if (b.tipo === 'Saída') {
                if (trabalhandoDesde != null && b.timestamp > trabalhandoDesde) {
                    segundosTrabalhados += (b.timestamp - trabalhandoDesde) / 1000;
                    trabalhandoDesde = null;
                    tevePar = true;
                }
                emIntervalo = false;
                inicioIntervaloTs = null;
            } else if (b.tipo === 'Início Intervalo') {
                if (trabalhandoDesde != null && b.timestamp > trabalhandoDesde) {
                    segundosTrabalhados += (b.timestamp - trabalhandoDesde) / 1000;
                    trabalhandoDesde = null;
                    tevePar = true;
                }
                inicioIntervaloTs = b.timestamp;
                emIntervalo = true;
            } else if (b.tipo === 'Fim Intervalo') {
                if (inicioIntervaloTs != null && b.timestamp > inicioIntervaloTs) {
                    segundosIntervaloMedido += (b.timestamp - inicioIntervaloTs) / 1000;
                }
                if (emIntervalo) {
                    trabalhandoDesde = b.timestamp;
                    emIntervalo = false;
                }
                inicioIntervaloTs = null;
            }
        }

        return {
            horasFechadas: segundosTrabalhados / 3600,
            intervaloHoras: segundosIntervaloMedido / 3600,
            tevePar,
            nBatidas: batidas.length,
            porTipo,
            validas: batidas,
            duplicadosIds: dedupDia.duplicadosIds || []
        };
    }

    function jornadaEsperadaEspelho(funcionario, isoDia, holidaySet) {
        const [y, m, d] = isoDia.split('-').map(Number);
        const dow = new Date(y, m - 1, d).getDay();
        if (holidaySet.has(isoDia) || dow === 0) return { esperado: 0, tipo: holidaySet.has(isoDia) ? 'feriado' : 'domingo' };

        const sabadoH = Number(funcionario && funcionario.sabado_horas != null ? funcionario.sabado_horas : 0);
        if (dow === 6) {
            return { esperado: Number.isFinite(sabadoH) && sabadoH > 0 ? sabadoH : 0, tipo: 'sabado' };
        }

        const he = String((funcionario && funcionario.hora_entrada) || '07:00').split(':').map(Number);
        const hs = String((funcionario && funcionario.hora_saida) || '17:00').split(':').map(Number);
        const intMin = Math.max(0, Number(funcionario && funcionario.intervalo_minutos != null ? funcionario.intervalo_minutos : 60));
        let jornada = (hs[0] + (hs[1] || 0) / 60) - (he[0] + (he[1] || 0) / 60);
        if (jornada < 0) jornada += 24;
        jornada = Math.max(0, jornada - intMin / 60);
        return { esperado: jornada, tipo: 'util' };
    }

    function montarLinhasEspelhoMes(opts) {
        const ano = String(opts.ano);
        const mes = String(opts.mes).padStart(2, '0');
        const mesNum = Number(mes);
        const anoNum = Number(ano);
        const funcionario = opts.funcionario || {};
        const pontosPorDia = opts.pontosPorDia || {};
        const cancelados = opts.canceladosSet || new Set();
        const errosSeq = opts.idsErroSequencia || new Set();
        const duplicados = opts.idsDuplicadosPonto || new Set();
        const faltasMes = opts.faltasMes || [];
        const holidaySet = opts.holidaySet || feriadosNacionaisFixosEspelho(anoNum);
        const totalDias = diasNoCalendarioMes(anoNum, mesNum);

        const faltaPorIso = {};
        faltasMes.forEach((f) => {
            if (f && f.iso) faltaPorIso[f.iso] = f;
        });

        const linhas = [];
        let saldo = 0;
        let totCredito = 0;
        let totDebito = 0;
        let totIntervalo = 0;
        let totNormais = 0;
        let totHe50 = 0;
        let totHe100 = 0;
        let totHt = 0;

        for (let dia = 1; dia <= totalDias; dia++) {
            const diaStr = String(dia).padStart(2, '0');
            const iso = ano + '-' + mes + '-' + diaStr;
            const dataBr = diaStr + '/' + mes + '/' + ano;
            const dow = new Date(anoNum, mesNum - 1, dia).getDay();
            const labelData = NOMES_DIA_SEMANA_CURTO[dow] + ', ' + dataBr;

            const batidasDia = pontosPorDia[dataBr] || pontosPorDia[dia + '/' + mesNum + '/' + ano] || [];
            // também tenta chaves sem zero à esquerda
            let batidas = batidasDia;
            if (!batidas.length) {
                const alt = Object.keys(pontosPorDia).find((k) => dataBrParaIsoEspelho(k) === iso);
                if (alt) batidas = pontosPorDia[alt];
            }

            const calc = calcularHorasDoDiaEspelho(batidas, cancelados);
            const meta = jornadaEsperadaEspelho(funcionario, iso, holidaySet);
            const faltaRh = faltaPorIso[iso];

            const hEnt = calc.porTipo['Entrada'];
            const hIni = calc.porTipo['Início Intervalo'];
            const hFim = calc.porTipo['Fim Intervalo'];
            const hSai = calc.porTipo['Saída'];

            function cellHora(b) {
                if (!b) return { txt: '', alerta: false, id: null, batida: null };
                const alerta = errosSeq.has(b.id) || duplicados.has(b.id) || Boolean(b.cancelado_em_evento);
                return { txt: normalizarHoraHHmm(b.hora || ''), alerta: alerta, id: b.id, batida: b };
            }

            const c1 = cellHora(hEnt);
            const c2 = cellHora(hIni);
            const c3 = cellHora(hFim);
            const c4 = cellHora(hSai);

            let credito = 0;
            let debito = 0;
            let he50 = 0;
            let he100 = 0;
            let horasNormais = 0;
            let intervaloH = calc.intervaloHoras || 0;
            const trabalhado = calc.horasFechadas || 0;
            const motivos = [];

            const emAtestadoDia = isDiaEmAtestado(
                iso,
                funcionario.data_inicio_atestado,
                funcionario.atestado_dias
            );
            if (emAtestadoDia) {
                motivos.push('Funcionário em atestado médico');
                if (trabalhado < 0.01) debito = 0;
            } else if (faltaRh) {
                if (faltaRh.tipo === 'FALTA_INJUSTIFICADA') {
                    motivos.push('Falta injustificada');
                    if (meta.esperado > 0 && trabalhado < 0.01) debito = meta.esperado;
                } else {
                    motivos.push('Atestado / justificada');
                }
            }

            if (meta.tipo === 'feriado') motivos.push('FERIADO');
            else if (meta.tipo === 'domingo' && trabalhado < 0.01) motivos.push('FOLGA');
            else if (meta.tipo === 'sabado' && meta.esperado <= 0 && trabalhado < 0.01) motivos.push('FOLGA');

            if (trabalhado > 0.01) {
                if (meta.tipo === 'feriado' || meta.tipo === 'domingo') {
                    he100 = trabalhado;
                    credito = trabalhado;
                } else {
                    const esp = meta.esperado || 0;
                    horasNormais = Math.min(trabalhado, esp);
                    if (trabalhado > esp) {
                        he50 = trabalhado - esp;
                        credito = he50;
                    } else if (trabalhado < esp - 0.01) {
                        debito = esp - trabalhado;
                    }
                }
                if (calc.validas.some((b) => b.registo_manual_rh)) motivos.push('Ajuste');
                if (calc.validas.some((b) => errosSeq.has(b.id))) motivos.push('Fora de ordem');
            } else if (!motivos.length && meta.tipo === 'util') {
                // dia útil sem ponto — deixa em branco (falta automática só na folha)
            }
            if (emAtestadoDia) debito = 0;

            if (!intervaloH && hIni && hFim && hIni.timestamp && hFim.timestamp && hFim.timestamp > hIni.timestamp) {
                intervaloH = (hFim.timestamp - hIni.timestamp) / 3600000;
            }

            const ht = trabalhado;
            const saldoDia = credito - debito;
            saldo += saldoDia;

            totCredito += credito;
            totDebito += debito;
            totIntervalo += intervaloH;
            totNormais += horasNormais;
            totHe50 += he50;
            totHe100 += he100;
            totHt += ht;

            linhas.push({
                iso,
                dataBr,
                labelData,
                c1, c2, c3, c4,
                credito,
                debito,
                intervaloH,
                horasNormais,
                he50,
                he100,
                ht,
                saldo,
                motivo: motivos.filter((v, i, a) => a.indexOf(v) === i).join(' / '),
                emAtestado: emAtestadoDia,
                batidas: batidas.slice(),
                temBatida: batidas.length > 0
            });
        }

        return {
            linhas,
            totais: {
                credito: totCredito,
                debito: totDebito,
                intervaloH: totIntervalo,
                horasNormais: totNormais,
                he50: totHe50,
                he100: totHe100,
                ht: totHt,
                saldo
            }
        };
    }

    function htmlCelulaHoraEspelho(cell, chaveMes, idxLinha, colKey) {
        if (!cell || !cell.txt) return '<td></td>';
        const classes = [];
        if (cell.alerta) classes.push('hora-alerta');
        if (cell.id) classes.push('hora-clicavel');
        const cls = classes.length ? ' class="' + classes.join(' ') + '"' : '';
        if (!cell.id) {
            return '<td' + cls + '>' + escapeHtmlBasico(cell.txt) + '</td>';
        }
        return '<td' + cls + ' title="Clique para ver selfie e local"'
            + ' onclick="event.stopPropagation();abrirSelfieLocalEspelhoPonto(\''
            + escapeAttrBasico(chaveMes) + '\',' + idxLinha + ',\'' + escapeAttrBasico(colKey) + '\')">'
            + escapeHtmlBasico(cell.txt) + '</td>';
    }

    function htmlTabelaEspelhoPontoMes(pack) {
        const func = pack.funcionario || {};
        const ano = pack.ano;
        const mes = String(pack.mes).padStart(2, '0');
        const mesNome = (nomeMeses[mes] || mes).toUpperCase();
        const chaveMes = String(pack.funcId || 'x') + '__' + ano + '-' + mes;
        const he = func.hora_entrada || '07:00';
        const hs = func.hora_saida || '17:00';
        const intMin = func.intervalo_minutos != null ? func.intervalo_minutos : 60;
        const sab = func.sabado_horas != null ? func.sabado_horas : 0;
        const adm = parseDataIsoFuncionario(func.data_admissao);
        const admBr = adm ? isoParaDataBr(adm) : '—';

        const montado = montarLinhasEspelhoMes(pack);
        window._espelhoPontoPorMes = window._espelhoPontoPorMes || {};
        window._espelhoPontoPorMes[chaveMes] = {
            ...pack,
            linhas: montado.linhas,
            totais: montado.totais
        };

        let html = '<div class="espelho-ponto-wrap" data-espelho-mes="' + escapeAttrBasico(chaveMes) + '">';
        html += '<div class="espelho-ponto-cabecalho">';
        html += '<div class="espelho-ponto-titulo">ESPELHO DE PONTO ELETRÔNICO — ' + escapeHtmlBasico(mesNome) + '/' + escapeHtmlBasico(String(ano)) + '</div>';
        html += '<div><b>Nome:</b> ' + escapeHtmlBasico(func.nome || '—') + '<br>';
        html += '<b>CPF:</b> ' + escapeHtmlBasico(String(func.cpf || '—')) + '<br>';
        html += '<b>Admissão:</b> ' + escapeHtmlBasico(admBr) + '</div>';
        html += '<div><b>Turno:</b> ' + escapeHtmlBasico(he) + ' às ' + escapeHtmlBasico(hs) + '<br>';
        html += '<b>Intervalo:</b> ' + escapeHtmlBasico(String(intMin)) + ' min<br>';
        html += '<b>Sábado:</b> ' + escapeHtmlBasico(String(sab)) + ' h</div>';
        html += '</div>';
        const infAtPonto = infoAtestadoFuncionario(func);
        if (infAtPonto.ativo) {
            html += '<div style="margin:0 0 10px 0;padding:10px 12px;background:#fff3cd;border:1px solid #ffeeba;border-radius:10px;color:#856404;font-size:13px;font-weight:700;text-align:center;">🏥 Funcionário em atestado médico — '
                + escapeHtmlBasico(String(infAtPonto.dias)) + ' dia(s), de '
                + escapeHtmlBasico(formatarDataBrDeIso(infAtPonto.inicioIso)) + ' até '
                + escapeHtmlBasico(formatarDataBrDeIso(infAtPonto.fimIso))
                + '. Sem ponto nestes dias não gera falta. Depois dessa data, o salário volta a contar só com o ponto batido.';
            if (func.atestado_tem_anexo) {
                html += '<br><button type="button" onclick="event.stopPropagation();visualizarAtestadoFuncionario(\''
                    + escapeAttrBasico(String(pack.funcId || ''))
                    + '\')" style="margin-top:8px;background:#1a2a43;color:#fff;border:none;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer;">📄 Ver atestado anexado</button>';
            }
            html += '</div>';
        } else if (montado.linhas.some(function (ln) { return ln.emAtestado; })) {
            html += '<div style="margin:0 0 10px 0;padding:10px 12px;background:#fff8e6;border:1px solid #ffeeba;border-radius:10px;color:#856404;font-size:12px;text-align:center;">Neste mês há dia(s) de <b>atestado médico</b> no cadastro do funcionário (coluna Motivo).';
            if (func.atestado_tem_anexo) {
                html += '<br><button type="button" onclick="event.stopPropagation();visualizarAtestadoFuncionario(\''
                    + escapeAttrBasico(String(pack.funcId || ''))
                    + '\')" style="margin-top:8px;background:#1a2a43;color:#fff;border:none;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer;">📄 Ver atestado anexado</button>';
            }
            html += '</div>';
        }

        html += '<div class="espelho-ponto-scroll"><table class="espelho-ponto-tabela">';
        html += '<thead>';
        html += '<tr class="grupo">';
        html += '<th rowspan="2">Data</th>';
        html += '<th colspan="4">Pontos</th>';
        html += '<th colspan="4">Totais da jornada</th>';
        html += '<th colspan="2">H. Extras</th>';
        html += '<th rowspan="2">H.T.</th>';
        html += '<th rowspan="2">Saldo</th>';
        html += '<th rowspan="2">Motivo</th>';
        html += '</tr>';
        html += '<tr>';
        html += '<th>1ª Entrada</th><th>1ª Saída</th><th>2ª Entrada</th><th>2ª Saída</th>';
        html += '<th>Crédito</th><th>Débito</th><th>H. Intervalo</th><th>Horas normais</th>';
        html += '<th>H.E. 50%</th><th>H.E. 100%</th>';
        html += '</tr></thead><tbody>';

        montado.linhas.forEach((ln, idx) => {
            const cls = (ln.temBatida || ln.motivo ? 'espelho-dia-clicavel' : '') + (ln.emAtestado ? ' espelho-dia-atestado' : '');
            html += '<tr class="' + cls.trim() + '" data-espelho-mes="' + escapeAttrBasico(chaveMes) + '" data-espelho-idx="' + idx + '" onclick="selecionarDiaEspelhoPonto(\'' + escapeAttrBasico(chaveMes) + '\',' + idx + ')"' + (ln.emAtestado ? ' style="background:#fff8e6;"' : '') + '>';
            html += '<td class="col-data">' + escapeHtmlBasico(ln.labelData) + '</td>';
            html += htmlCelulaHoraEspelho(ln.c1, chaveMes, idx, 'c1');
            html += htmlCelulaHoraEspelho(ln.c2, chaveMes, idx, 'c2');
            html += htmlCelulaHoraEspelho(ln.c3, chaveMes, idx, 'c3');
            html += htmlCelulaHoraEspelho(ln.c4, chaveMes, idx, 'c4');
            html += '<td>' + escapeHtmlBasico(formatarHorasEspelhoHM(ln.credito)) + '</td>';
            html += '<td>' + escapeHtmlBasico(formatarHorasEspelhoHM(ln.debito)) + '</td>';
            html += '<td>' + escapeHtmlBasico(formatarHorasEspelhoHM(ln.intervaloH)) + '</td>';
            html += '<td>' + escapeHtmlBasico(formatarHorasEspelhoHM(ln.horasNormais)) + '</td>';
            html += '<td>' + escapeHtmlBasico(formatarHorasEspelhoHM(ln.he50)) + '</td>';
            html += '<td>' + escapeHtmlBasico(formatarHorasEspelhoHM(ln.he100)) + '</td>';
            html += '<td>' + escapeHtmlBasico(formatarHorasEspelhoHM(ln.ht)) + '</td>';
            html += '<td>' + escapeHtmlBasico(formatarHorasEspelhoHM(ln.saldo)) + '</td>';
            html += '<td class="col-motivo"' + (ln.emAtestado ? ' style="color:#856404;font-weight:700;"' : '') + '>' + escapeHtmlBasico(ln.motivo || '') + '</td>';
            html += '</tr>';
        });

        const t = montado.totais;
        html += '</tbody><tfoot><tr>';
        html += '<td class="col-data">TOTAL</td><td></td><td></td><td></td><td></td>';
        html += '<td>' + escapeHtmlBasico(formatarHorasEspelhoHM(t.credito)) + '</td>';
        html += '<td>' + escapeHtmlBasico(formatarHorasEspelhoHM(t.debito)) + '</td>';
        html += '<td>' + escapeHtmlBasico(formatarHorasEspelhoHM(t.intervaloH)) + '</td>';
        html += '<td>' + escapeHtmlBasico(formatarHorasEspelhoHM(t.horasNormais)) + '</td>';
        html += '<td>' + escapeHtmlBasico(formatarHorasEspelhoHM(t.he50)) + '</td>';
        html += '<td>' + escapeHtmlBasico(formatarHorasEspelhoHM(t.he100)) + '</td>';
        html += '<td>' + escapeHtmlBasico(formatarHorasEspelhoHM(t.ht)) + '</td>';
        html += '<td>' + escapeHtmlBasico(formatarHorasEspelhoHM(t.saldo)) + '</td>';
        html += '<td></td></tr></tfoot></table></div>';
        html += '<div class="espelho-ponto-detalhe" id="espelho-detalhe-' + escapeAttrBasico(chaveMes) + '">';
        html += '<p style="margin:0;font-size:12px;color:#666;text-align:center;">Clique em um <b>horário</b> para ver a selfie e o local. Clique na <b>data</b> do dia para ver todas as batidas e ações do RH.</p>';
        html += '</div></div>';
        return html;
    }

    const ROTULO_COLUNA_ESPELHO = {
        c1: '1ª Entrada',
        c2: '1ª Saída (Início intervalo)',
        c3: '2ª Entrada (Fim intervalo)',
        c4: '2ª Saída'
    };

    window.abrirSelfieLocalEspelhoPonto = function (chaveMes, idxLinha, colKey) {
        const pack = window._espelhoPontoPorMes && window._espelhoPontoPorMes[chaveMes];
        if (!pack || !pack.linhas) return;
        const ln = pack.linhas[idxLinha];
        if (!ln) return;
        const cell = ln[colKey];
        const batida = cell && (cell.batida || (cell.id && (ln.batidas || []).find((b) => b.id === cell.id)));
        if (!batida) {
            return Swal.fire('Atenção', 'Não há batida neste horário.', 'info');
        }

        const rotulo = ROTULO_COLUNA_ESPELHO[colKey] || batida.tipo || 'Batida';
        const coordsTxt = textoCoordenadasParaExibicao(batida);
        const linkMaps = montarLinkGoogleMapsOuNull(batida.latitude, batida.longitude);
        const foto = batida.foto || '';
        const obra = batida.obra || '—';
        const hora = batida.hora || cell.txt || '—';
        const dataTxt = batida.data || ln.dataBr || '—';

        let htmlFoto = '';
        if (foto) {
            const fotoEsc = String(foto).replace(/'/g, "\\'");
            htmlFoto = '<img class="espelho-selfie-preview" src="' + foto + '" alt="Selfie da batida" onclick="abrirFoto(\'' + fotoEsc + '\')" title="Clique para ampliar">';
        } else {
            htmlFoto = '<p style="margin:12px 0;padding:20px;background:#f5f5f5;border-radius:8px;color:#888;font-size:13px;">Sem selfie nesta batida.</p>';
        }

        const btnMaps = linkMaps
            ? '<button type="button" class="btn-maps" style="width:100%;margin-top:8px;" onclick="window.open(\'' + linkMaps + '\', \'_blank\')">📍 VER NO MAPA (GPS)</button>'
            : '<p style="margin:8px 0 0 0;font-size:12px;color:#888;">GPS indisponível nesta batida.</p>';

        Swal.fire({
            title: escapeHtmlBasico(rotulo),
            html: ''
                + '<div style="text-align:left;font-size:13px;color:#333;">'
                + '<p style="margin:0 0 6px 0;"><b>Data:</b> ' + escapeHtmlBasico(dataTxt) + ' &nbsp; <b>Hora:</b> ' + escapeHtmlBasico(String(hora)) + '</p>'
                + '<p style="margin:0 0 6px 0;"><b>Tipo:</b> ' + escapeHtmlBasico(batida.tipo || '—') + '</p>'
                + '<p style="margin:0 0 10px 0;"><b>Local / obra:</b> ' + escapeHtmlBasico(String(obra)) + '</p>'
                + htmlFoto
                + '<p style="margin:10px 0 0 0;font-size:12px;color:#555;"><b>GPS:</b> ' + coordsTxt + '</p>'
                + btnMaps
                + '</div>',
            width: 420,
            confirmButtonText: 'Fechar',
            confirmButtonColor: '#1a2a43',
            showCancelButton: true,
            cancelButtonText: 'Ver dia completo',
            cancelButtonColor: '#6c757d'
        }).then((result) => {
            if (result.isDismissed && result.dismiss === Swal.DismissReason.cancel) {
                selecionarDiaEspelhoPonto(chaveMes, idxLinha);
            }
        });
    };

    function htmlCardBatidaEspelhoDetalhe(dados, idsErroSequencia, idsDuplicadosPonto, funcId) {
        const cor = dados.tipo === 'Entrada' ? '#28a745'
            : (dados.tipo === 'Saída' ? '#d9534f' : '#6c757d');
        const fotoThumb = dados.foto
            ? `<img src="${dados.foto}" onclick="abrirFoto('${String(dados.foto).replace(/'/g, "\\'")}')" style="width: 50px; border-radius: 5px; float: right; cursor: pointer; border: 1px solid #ccc;" title="Clique para ampliar">`
            : '';
        const motivoEsc = escapeHtmlBasico(dados.cancelamento_motivo || '');
        const badgeSeqErrada = idsErroSequencia.has(dados.id)
            ? `<div style="margin-top:6px;padding:8px 10px;background:#fff5f5;border:1px solid #f5c6cb;color:#b02a37;border-radius:8px;font-size:12px;font-weight:700;">⚠️ BATIDA FORA DE ORDEM</div>`
            : '';
        const badgeDuplicado = idsDuplicadosPonto.has(dados.id)
            ? `<div style="margin-top:6px;padding:8px 10px;background:#f0f0f0;border:1px solid #ccc;color:#555;border-radius:8px;font-size:12px;font-weight:700;">📋 DUPLICADO — não conta na folha</div>`
            : '';
        const canceladoBadge = dados.cancelado_em_evento
            ? `<div style="margin-top:6px;padding:8px 10px;background:#fff3cd;border:1px solid #ffeeba;color:#5c4a00;border-radius:8px;font-size:12px;"><b>⚠️ REGISTRO CANCELADO</b><br>${motivoEsc}</div>`
            : '';
        const coordsTxt = textoCoordenadasParaExibicao(dados);
        const linkMaps = montarLinkGoogleMapsOuNull(dados.latitude, dados.longitude);
        const btnMaps = linkMaps
            ? `<button type="button" class="btn-maps" onclick="window.open('${linkMaps}', '_blank')">📍 VER NO MAPA</button>`
            : `<span style="font-size:12px;color:#888;">📍 Mapa indisponível</span>`;
        const fid = String(dados.funcionario_id || funcId || '').replace(/'/g, "\\'");
        const btnAcao = dados.cancelado_em_evento ? '' : `<button type="button" onclick="solicitarCancelamentoPonto('${dados.id}','${fid}')" style="background:#6c757d;color:white;border:none;padding:8px;border-radius:5px;cursor:pointer;width:100%;margin-top:5px;font-weight:bold;font-size:12px;">⚠️ SOLICITAR CANCELAMENTO</button>`;
        const btnApagarRH = `<button type="button" onclick="excluirPontoGestorRH('${dados.id}')" style="background:#b02a37;color:white;border:none;padding:8px;border-radius:5px;cursor:pointer;width:100%;margin-top:5px;font-weight:bold;font-size:12px;">🗑️ APAGAR BATIDA (RH)</button>`;
        const btnEditarHoraRH = dados.cancelado_em_evento ? '' : `<button type="button" onclick="editarPontoDataHoraRH('${dados.id}')" style="background:#17a2b8;color:white;border:none;padding:8px;border-radius:5px;cursor:pointer;width:100%;margin-top:5px;font-weight:bold;font-size:12px;">🕐 Ajustar data / hora (RH)</button>`;
        const badgeManualRH = dados.registo_manual_rh
            ? `<span style="display:inline-block;margin-top:4px;font-size:11px;background:#e7f3ff;color:#0c5460;padding:3px 8px;border-radius:6px;font-weight:600;">📋 Registo manual pelo RH</span><br>`
            : '';
        const borda = idsErroSequencia.has(dados.id) ? '#b02a37' : (idsDuplicadosPonto.has(dados.id) ? '#999' : cor);
        return `
            <div class="resultado-item" style="border-left-color:${borda};${idsDuplicadosPonto.has(dados.id) ? 'opacity:0.75;background:#f8f8f8;' : ''}">
                ${fotoThumb}
                <b style="color:${borda}">${escapeHtmlBasico(dados.tipo || '')}</b> — ${escapeHtmlBasico(dados.data || '')} às ${escapeHtmlBasico(dados.hora || '??')}<br>
                ${badgeDuplicado}${badgeSeqErrada}${badgeManualRH}
                <span style="font-size:13px;color:#555;"><b>Local:</b> ${escapeHtmlBasico(dados.obra || '—')}</span><br>
                <span style="font-size:12px;color:#555;"><b>GPS:</b> ${coordsTxt}</span><br>
                ${btnMaps}${btnAcao}${btnEditarHoraRH}${btnApagarRH}${canceladoBadge}
            </div>`;
    }

    window.selecionarDiaEspelhoPonto = function (chaveMes, idx) {
        const pack = window._espelhoPontoPorMes && window._espelhoPontoPorMes[chaveMes];
        const detalhe = document.getElementById('espelho-detalhe-' + chaveMes);
        if (!pack || !detalhe) return;
        const ln = pack.linhas[idx];
        if (!ln) return;

        window._espelhoDiaSelecionado = {
            chaveMes: chaveMes,
            idx: idx,
            iso: ln.iso || '',
            dataBr: ln.dataBr || '',
            funcId: pack.funcId || ''
        };

        document.querySelectorAll('.espelho-ponto-tabela tr.espelho-dia-selecionado').forEach((tr) => {
            tr.classList.remove('espelho-dia-selecionado');
        });
        const tr = document.querySelector('tr[data-espelho-mes="' + chaveMes + '"][data-espelho-idx="' + idx + '"]');
        if (tr) tr.classList.add('espelho-dia-selecionado');

        const idsErro = pack.idsErroSequencia || new Set();
        const idsDup = pack.idsDuplicadosPonto || new Set();
        const funcId = pack.funcId || '';

        let html = '<h4>Detalhe do dia — ' + escapeHtmlBasico(ln.labelData) + '</h4>';
        if (ln.motivo) {
            html += '<p style="margin:0 0 8px 0;font-size:12px;"><b>Motivo:</b> ' + escapeHtmlBasico(ln.motivo) + '</p>';
        }
        // Ignora batidas duplicadas na tela — mostra só a correta (já usada na folha/espelho)
        const batidasOrd = (ln.batidas || [])
            .filter((b) => b && !(b.id && idsDup.has(b.id)))
            .slice()
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        const qtdOcultos = (ln.batidas || []).length - batidasOrd.length;
        if (qtdOcultos > 0) {
            html += '<p style="margin:0 0 10px 0;padding:8px 10px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;font-size:12px;color:#555;">'
                + '🔁 ' + qtdOcultos + ' batida(s) duplicada(s) oculta(s) automaticamente (mesmo tipo e horário). Só a correta aparece abaixo e conta na folha.'
                + '</p>';
        }
        if (!batidasOrd.length) {
            if (ln.emAtestado) {
                html += '<p style="text-align:center;color:#856404;font-size:13px;font-weight:700;margin:0 0 8px 0;padding:10px;background:#fff3cd;border-radius:8px;">🏥 Funcionário em atestado médico</p>';
                html += '<p style="text-align:center;color:#666;font-size:12px;margin:0;">Sem batidas neste dia — não desconta falta e o dia entra no salário.</p>';
                if (pack.funcionario && pack.funcionario.atestado_tem_anexo) {
                    html += '<button type="button" onclick="visualizarAtestadoFuncionario(\'' + escapeAttrBasico(String(funcId || '')) + '\')" style="margin-top:8px;width:100%;background:#1a2a43;color:#fff;border:none;padding:10px;border-radius:8px;font-weight:700;cursor:pointer;">📄 Ver atestado anexado</button>';
                }
            } else {
                html += '<p style="text-align:center;color:#888;font-size:12px;margin:0;">Sem batidas neste dia.</p>';
                const dataBrJs = String(ln.dataBr || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                html += `<button type="button" onclick="rhGerirFaltaDia('${dataBrJs}')" style="margin-top:8px;width:100%;background:#b02a37;color:#fff;border:none;padding:10px;border-radius:8px;font-weight:700;cursor:pointer;">🚫 Falta / atestado neste dia (RH)</button>`;
            }
        } else {
            batidasOrd.forEach((b) => {
                html += htmlCardBatidaEspelhoDetalhe(b, idsErro, idsDup, funcId);
            });
        }
        detalhe.innerHTML = html;
        try {
            detalhe.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (_) {}
    };

    function garantirAbaPontoAtiva() {
        const abaPonto = document.getElementById('aba-ponto');
        if (abaPonto && !abaPonto.classList.contains('active')) {
            const btn = document.querySelector('.gestor-menu-btn[data-titulo="Ponto"]');
            if (typeof mudarAba === 'function') mudarAba('ponto', btn || null);
        }
    }

    async function recarregarPontoMantendoContexto() {
        const ctx = window._espelhoDiaSelecionado ? Object.assign({}, window._espelhoDiaSelecionado) : null;
        const mainGestor = document.querySelector('.gestor-main-content');
        const scrollAntes = mainGestor ? mainGestor.scrollTop : 0;
        garantirAbaPontoAtiva();
        if (typeof buscarPonto === 'function') {
            await buscarPonto();
        }
        garantirAbaPontoAtiva();
        if (!ctx) {
            if (mainGestor) mainGestor.scrollTop = scrollAntes;
            return;
        }
        setTimeout(function () {
            garantirAbaPontoAtiva();
            let chave = ctx.chaveMes;
            let idx = ctx.idx;
            const pack = window._espelhoPontoPorMes && window._espelhoPontoPorMes[chave];
            if (pack && pack.linhas && Array.isArray(pack.linhas)) {
                const found = pack.linhas.findIndex(function (ln) {
                    return (ctx.iso && ln.iso === ctx.iso)
                        || (ctx.dataBr && String(ln.dataBr || '') === String(ctx.dataBr));
                });
                if (found >= 0) idx = found;
            } else if (ctx.funcId) {
                // procura chave do mesmo funcionário/mês após rebuild
                const keys = Object.keys(window._espelhoPontoPorMes || {});
                for (let i = 0; i < keys.length; i += 1) {
                    const k = keys[i];
                    if (String(k).indexOf(String(ctx.funcId) + '__') !== 0) continue;
                    const p = window._espelhoPontoPorMes[k];
                    if (!p || !p.linhas) continue;
                    const found = p.linhas.findIndex(function (ln) {
                        return (ctx.iso && ln.iso === ctx.iso)
                            || (ctx.dataBr && String(ln.dataBr || '') === String(ctx.dataBr));
                    });
                    if (found >= 0) {
                        chave = k;
                        idx = found;
                        break;
                    }
                }
            }
            if (typeof selecionarDiaEspelhoPonto === 'function' && chave != null && idx != null) {
                selecionarDiaEspelhoPonto(chave, idx);
            }
            if (mainGestor) {
                mainGestor.scrollTop = scrollAntes;
            }
        }, 80);
    }

    async function perguntarMesAnoEspelhoPonto(titulo) {
        const agora = new Date();
        const mesAtual = String(agora.getMonth() + 1).padStart(2, '0');
        const anoAtual = String(agora.getFullYear());
        let optsMes = '';
        for (let m = 1; m <= 12; m += 1) {
            const mm = String(m).padStart(2, '0');
            const nome = (nomeMeses[mm] || nomeMeses[String(m)] || mm);
            optsMes += '<option value="' + mm + '"' + (mm === mesAtual ? ' selected' : '') + '>' + escapeHtmlBasico(String(nome)) + '</option>';
        }
        let optsAno = '';
        for (let a = agora.getFullYear() + 1; a >= agora.getFullYear() - 4; a -= 1) {
            optsAno += '<option value="' + a + '"' + (String(a) === anoAtual ? ' selected' : '') + '>' + a + '</option>';
        }
        const r = await Swal.fire({
            title: titulo || 'Selecione o mês',
            html: '<p style="font-size:13px;color:#555;text-align:left;margin:0 0 10px 0;">Escolha o período do espelho de ponto:</p>'
                + '<div style="display:flex;gap:8px;">'
                + '<select id="espelho-todos-mes" class="swal2-input" style="flex:1.4;margin:0;height:42px;">' + optsMes + '</select>'
                + '<select id="espelho-todos-ano" class="swal2-input" style="flex:1;margin:0;height:42px;">' + optsAno + '</select>'
                + '</div>',
            showCancelButton: true,
            confirmButtonText: 'Continuar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1a2a43',
            preConfirm: () => {
                const mes = document.getElementById('espelho-todos-mes')?.value;
                const ano = document.getElementById('espelho-todos-ano')?.value;
                if (!mes || !ano) {
                    Swal.showValidationMessage('Selecione mês e ano.');
                    return false;
                }
                return { mes: mes, ano: String(ano) };
            }
        });
        if (!r.isConfirmed || !r.value) return null;
        return r.value;
    }

    async function carregarPackEspelhoPontoFuncionario(funcId) {
        const funcionario = (window.listaFuncionarios && window.listaFuncionarios[funcId]) || {};
        const q = query(collection(db, 'ponto_registros'), where('funcionario_id', '==', funcId));
        const querySnapshot = await getDocs(q);
        const qEvt = query(collection(db, 'ponto_eventos'), where('funcionario_id', '==', funcId));
        const snapEvt = await getDocs(qEvt);

        const infoCancelamentoPorPonto = new Map();
        const faltasRhPorMes = {};
        let totalFaltasRh = 0;
        snapEvt.forEach((d) => {
            const ev = d.data();
            if (!ev) return;
            if (ev.tipo === 'CANCELAMENTO' && ev.ponto_id) {
                let tsMs = 0;
                const t = ev.criado_em;
                if (t && typeof t.toMillis === 'function') tsMs = t.toMillis();
                else if (t && typeof t.seconds === 'number') tsMs = t.seconds * 1000;
                const prev = infoCancelamentoPorPonto.get(ev.ponto_id);
                if (!prev || tsMs >= prev.tsMs) {
                    infoCancelamentoPorPonto.set(ev.ponto_id, {
                        tsMs: tsMs,
                        motivo: String(ev.motivo || '—').trim()
                    });
                }
                return;
            }
            if (ev.tipo !== 'FALTA_INJUSTIFICADA' && ev.tipo !== 'FALTA_JUSTIFICADA') return;
            let iso = ev.data_iso || '';
            if (!iso && ev.data_br) {
                const br = formatarDataBrPadrao(ev.data_br);
                const s = separarDataSegura(br);
                if (s.ano !== 'Outros') iso = s.ano + '-' + s.mes + '-' + s.dia;
            }
            if (!iso) return;
            const dataBrF = isoParaDataBr(iso);
            const partes = separarDataSegura(dataBrF);
            const anoF = partes.ano;
            const mesF = partes.mes;
            if (!faltasRhPorMes[anoF]) faltasRhPorMes[anoF] = {};
            if (!faltasRhPorMes[anoF][mesF]) faltasRhPorMes[anoF][mesF] = [];
            faltasRhPorMes[anoF][mesF].push({
                tipo: ev.tipo,
                iso: iso,
                dataBr: dataBrF,
                motivo: String(ev.motivo || '').trim(),
                descontarDsr: ev.descontar_dsr !== false
            });
            totalFaltasRh += 1;
        });

        const infAtestadoPack = infoAtestadoFuncionario(funcionario);
        const mesesAtestadoPack = mesesCobertosPorPeriodo(infAtestadoPack.inicioIso, infAtestadoPack.dias);
        if (querySnapshot.empty && totalFaltasRh === 0 && !mesesAtestadoPack.length) {
            return null;
        }

        const pontosPorDia = {};
        querySnapshot.forEach((docSnap) => {
            const dados = docSnap.data();
            const chaveDia = formatarDataBrPadrao(dados.data) || String(dados.data || '');
            if (!pontosPorDia[chaveDia]) pontosPorDia[chaveDia] = [];
            const infoCanc = infoCancelamentoPorPonto.get(docSnap.id);
            pontosPorDia[chaveDia].push(Object.assign({
                id: docSnap.id,
                cancelado_em_evento: Boolean(infoCanc),
                cancelamento_motivo: infoCanc ? infoCanc.motivo : ''
            }, dados));
        });

        const idsErroSequencia = new Set();
        const idsDuplicadosPonto = new Set();
        const idsCanceladosPonto = new Set(infoCancelamentoPorPonto.keys());
        Object.keys(pontosPorDia).forEach((diaChave) => {
            const dedup = deduplicarBatidasPonto(pontosPorDia[diaChave], idsCanceladosPonto);
            dedup.duplicadosIds.forEach((id) => idsDuplicadosPonto.add(id));
            detectarErrosSequenciaPontoDia(dedup.validas, idsCanceladosPonto).forEach((er) => {
                if (er.pontoId) idsErroSequencia.add(er.pontoId);
            });
        });

        const agrupado = {};
        querySnapshot.forEach((docSnap) => {
            const dados = Object.assign({}, docSnap.data(), { id: docSnap.id });
            const { ano, mes } = separarDataSegura(dados.data);
            if (!agrupado[ano]) agrupado[ano] = {};
            if (!agrupado[ano][mes]) agrupado[ano][mes] = true;
        });
        Object.keys(faltasRhPorMes).forEach(function (anoF) {
            if (!agrupado[anoF]) agrupado[anoF] = {};
            Object.keys(faltasRhPorMes[anoF]).forEach(function (mesF) {
                if (!agrupado[anoF][mesF]) agrupado[anoF][mesF] = true;
            });
        });
        mesesAtestadoPack.forEach(function (per) {
            if (!agrupado[per.ano]) agrupado[per.ano] = {};
            if (!agrupado[per.ano][per.mes]) agrupado[per.ano][per.mes] = true;
        });

        const holidayByYear = {};
        Object.keys(agrupado).filter((a) => a !== 'Outros').forEach((a) => {
            holidayByYear[a] = feriadosNacionaisFixosEspelho(a);
        });
        try {
            const empresaLogada = getEmpresaGestor();
            if (empresaLogada) {
                const qFer = query(collection(db, 'feriados'), where('empresa_id', '==', empresaLogada));
                const snapFer = await getDocs(qFer);
                snapFer.forEach((docF) => {
                    const f = docF.data() || {};
                    const iso = f.data_iso || (f.data ? dataBrParaIsoEspelho(f.data) : '');
                    if (!iso) return;
                    const y = iso.slice(0, 4);
                    if (!holidayByYear[y]) holidayByYear[y] = feriadosNacionaisFixosEspelho(y);
                    holidayByYear[y].add(iso);
                });
            }
        } catch (_) {}

        return {
            funcId: funcId,
            funcionario: funcionario,
            pontosPorDia: pontosPorDia,
            idsErroSequencia: idsErroSequencia,
            idsDuplicadosPonto: idsDuplicadosPonto,
            idsCanceladosPonto: idsCanceladosPonto,
            faltasRhPorMes: faltasRhPorMes,
            holidayByYear: holidayByYear,
            agrupado: agrupado
        };
    }

    function desenharTabelaEspelhoPontoPdf(doc, montado, startY) {
        const head = [[
            'Data', '1ª Ent.', '1ª Saí.', '2ª Ent.', '2ª Saí.',
            'Crédito', 'Débito', 'Intervalo', 'Normais',
            'HE 50%', 'HE 100%', 'H.T.', 'Saldo', 'Motivo'
        ]];
        const body = montado.linhas.map((ln) => [
            ln.labelData,
            ln.c1.txt || '',
            ln.c2.txt || '',
            ln.c3.txt || '',
            ln.c4.txt || '',
            formatarHorasEspelhoHM(ln.credito),
            formatarHorasEspelhoHM(ln.debito),
            formatarHorasEspelhoHM(ln.intervaloH),
            formatarHorasEspelhoHM(ln.horasNormais),
            formatarHorasEspelhoHM(ln.he50),
            formatarHorasEspelhoHM(ln.he100),
            formatarHorasEspelhoHM(ln.ht),
            formatarHorasEspelhoHM(ln.saldo),
            ln.motivo || ''
        ]);
        const t = montado.totais;
        body.push([
            'TOTAL', '', '', '', '',
            formatarHorasEspelhoHM(t.credito),
            formatarHorasEspelhoHM(t.debito),
            formatarHorasEspelhoHM(t.intervaloH),
            formatarHorasEspelhoHM(t.horasNormais),
            formatarHorasEspelhoHM(t.he50),
            formatarHorasEspelhoHM(t.he100),
            formatarHorasEspelhoHM(t.ht),
            formatarHorasEspelhoHM(t.saldo),
            ''
        ]);

        doc.autoTable({
            startY: startY,
            head: head,
            body: body,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1.5, valign: 'middle', halign: 'center' },
            headStyles: { fillColor: '#1a2a43', textColor: '#ffffff', fontStyle: 'bold', fontSize: 7 },
            columnStyles: {
                0: { cellWidth: 28, halign: 'left' },
                13: { cellWidth: 28, halign: 'left', fontSize: 6 }
            },
            didParseCell: function (data) {
                if (data.section === 'body' && data.row.index === body.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = '#eef2f5';
                }
            },
            margin: { left: 10, right: 10 }
        });
        return doc.lastAutoTable ? doc.lastAutoTable.finalY : startY;
    }

    function cabecalhoEspelhoPontoPdf(doc, emp, mesNome, ano, func) {
        doc.setFillColor(26, 42, 67);
        doc.rect(0, 0, 297, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('ESPELHO DE PONTO ELETRONICO', 14, 11);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(220, 220, 220);
        doc.text(String(emp) + '  |  ' + String(mesNome) + '/' + String(ano) + '  |  ' + new Date().toLocaleString('pt-BR'), 14, 19);
        doc.text(String(func.nome || '') + '  |  CPF: ' + String(func.cpf || '—') + '  |  Turno: ' + String(func.hora_entrada || '07:00') + '-' + String(func.hora_saida || '17:00'), 14, 25);
    }

    window.exportarEspelhoPontoPDF = async function () {
        // Após busca coletiva, o mesmo botão baixa todos do mês já escolhido
        if (window._espelhoPontoTodosPeriodo && window._espelhoPontoTodosPeriodo.mes && window._espelhoPontoTodosPeriodo.ano) {
            return exportarEspelhoPontoTodosPDF();
        }
        const packExp = window._espelhoPontoExport;
        if (!packExp || !packExp.agrupado) {
            return Swal.fire('Atenção', 'Busque o ponto do funcionário (ou TODOS) primeiro.', 'warning');
        }

        const opcoesMes = [];
        Object.keys(packExp.agrupado).sort((a, b) => Number(b) - Number(a)).forEach((ano) => {
            Object.keys(packExp.agrupado[ano] || {}).sort((a, b) => Number(b) - Number(a)).forEach((mes) => {
                const mesPad = String(mes).padStart(2, '0');
                const nome = (nomeMeses[mesPad] || nomeMeses[mes] || mes) + '/' + ano;
                opcoesMes.push({ value: ano + '-' + mesPad, label: String(nome).toUpperCase() });
            });
        });
        if (!opcoesMes.length) {
            return Swal.fire('Atenção', 'Não há meses para exportar.', 'info');
        }

        let chaveEscolhida = opcoesMes[0].value;
        if (opcoesMes.length > 1) {
            const htmlOpts = opcoesMes.map((o, i) =>
                '<option value="' + escapeAttrBasico(o.value) + '"' + (i === 0 ? ' selected' : '') + '>' + escapeHtmlBasico(o.label) + '</option>'
            ).join('');
            const r = await Swal.fire({
                title: 'Exportar espelho PDF',
                html: '<label style="display:block;text-align:left;font-size:13px;margin-bottom:6px;">Selecione o mês:</label>'
                    + '<select id="espelho-pdf-mes" class="swal2-input" style="width:100%;margin:0;">' + htmlOpts + '</select>',
                showCancelButton: true,
                confirmButtonText: 'Gerar PDF',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#1a2a43',
                preConfirm: () => {
                    const sel = document.getElementById('espelho-pdf-mes');
                    return sel ? sel.value : null;
                }
            });
            if (!r.isConfirmed || !r.value) return;
            chaveEscolhida = r.value;
        }

        const [ano, mes] = String(chaveEscolhida).split('-');
        const mesPad = String(mes).padStart(2, '0');
        const holidaySet = (packExp.holidayByYear && packExp.holidayByYear[ano]) || feriadosNacionaisFixosEspelho(ano);
        const faltasMes = (packExp.faltasRhPorMes[ano] && (packExp.faltasRhPorMes[ano][mes] || packExp.faltasRhPorMes[ano][mesPad])) || [];
        const montado = montarLinhasEspelhoMes({
            ano: ano,
            mes: mesPad,
            funcionario: packExp.funcionario,
            pontosPorDia: packExp.pontosPorDia,
            canceladosSet: packExp.idsCanceladosPonto,
            idsErroSequencia: packExp.idsErroSequencia,
            idsDuplicadosPonto: packExp.idsDuplicadosPonto,
            faltasMes: faltasMes,
            holidaySet: holidaySet
        });

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4');
        const emp = getEmpresaGestor() || 'Empresa';
        const func = packExp.funcionario || {};
        const mesNome = (nomeMeses[mesPad] || mesPad).toUpperCase();
        cabecalhoEspelhoPontoPdf(doc, emp, mesNome, ano, func);
        desenharTabelaEspelhoPontoPdf(doc, montado, 32);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Pagina ' + doc.internal.getNumberOfPages() + '  |  Gestor 360', 10, doc.internal.pageSize.height - 8);

        const nomeArq = 'espelho_ponto_' + String(func.nome || 'func').replace(/\s+/g, '_') + '_' + mesPad + '_' + ano + '.pdf';
        doc.save(nomeArq);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Espelho PDF gerado!', showConfirmButton: false, timer: 2200 });
    };

    window.exportarEspelhoPontoTodosPDF = async function () {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) return Swal.fire('Atenção', 'Empresa não definida.', 'warning');

        const lista = Object.keys(window.listaFuncionarios || {}).map((id) => ({ id: id, ...(window.listaFuncionarios[id] || {}) }));
        if (!lista.length) {
            return Swal.fire('Atenção', 'Nenhum funcionário cadastrado. Atualize a lista da equipe.', 'warning');
        }
        lista.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));

        // Usa o mês da busca coletiva (sem perguntar de novo)
        let periodo = window._espelhoPontoTodosPeriodo;
        if (!periodo || !periodo.mes || !periodo.ano) {
            periodo = await perguntarMesAnoEspelhoPonto('Espelho de TODOS — PDF para RH');
            if (!periodo) return;
            window._espelhoPontoTodosPeriodo = { mes: periodo.mes, ano: periodo.ano };
        }

        Swal.fire({
            title: 'Gerando espelhos...',
            html: 'Montando o PDF de <b>' + lista.length + '</b> funcionário(s).<br>Isso pode levar alguns segundos.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'mm', 'a4');
            const mesPad = String(periodo.mes).padStart(2, '0');
            const ano = String(periodo.ano);
            const mesNome = (nomeMeses[mesPad] || mesPad).toUpperCase();
            let gerados = 0;
            let paginaNova = false;

            for (let i = 0; i < lista.length; i += 1) {
                const func = lista[i];
                const pack = await carregarPackEspelhoPontoFuncionario(func.id);
                if (!pack) continue;

                const holidaySet = (pack.holidayByYear && pack.holidayByYear[ano]) || feriadosNacionaisFixosEspelho(ano);
                const faltasMes = (pack.faltasRhPorMes[ano] && (pack.faltasRhPorMes[ano][mesPad] || pack.faltasRhPorMes[ano][String(Number(mesPad))])) || [];
                const montado = montarLinhasEspelhoMes({
                    ano: ano,
                    mes: mesPad,
                    funcionario: pack.funcionario,
                    pontosPorDia: pack.pontosPorDia,
                    canceladosSet: pack.idsCanceladosPonto,
                    idsErroSequencia: pack.idsErroSequencia,
                    idsDuplicadosPonto: pack.idsDuplicadosPonto,
                    faltasMes: faltasMes,
                    holidaySet: holidaySet
                });

                if (paginaNova) doc.addPage();
                cabecalhoEspelhoPontoPdf(doc, empresaLogada, mesNome, ano, pack.funcionario || func);
                desenharTabelaEspelhoPontoPdf(doc, montado, 32);
                gerados += 1;
                paginaNova = true;
            }

            if (!gerados) {
                return Swal.fire('Sem registros', 'Nenhum funcionário com ponto/falta no período ' + mesNome + '/' + ano + '.', 'info');
            }

            const nomeArq = 'espelho_ponto_TODOS_' + mesPad + '_' + ano + '_' + String(empresaLogada).replace(/\s+/g, '_') + '.pdf';
            doc.save(nomeArq);
            Swal.fire('PDF gerado!', gerados + ' espelho(s) no arquivo para enviar ao RH.', 'success');
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Falha ao gerar o PDF de todos os funcionários.', 'error');
        }
    };

    window.buscarPontoTodos = async function () {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) return Swal.fire('Atenção', 'Empresa não definida.', 'warning');

        const lista = Object.keys(window.listaFuncionarios || {}).map((id) => ({ id: id, ...(window.listaFuncionarios[id] || {}) }));
        if (!lista.length) {
            return Swal.fire('Atenção', 'Nenhum funcionário cadastrado.', 'warning');
        }
        lista.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));

        const periodo = await perguntarMesAnoEspelhoPonto('Espelho de TODOS os funcionários');
        if (!periodo) return;

        const divLista = document.getElementById('lista-ponto-resultados');
        const toolbar = document.getElementById('ponto-export-toolbar');
        const btnExportar = document.getElementById('btnExportarPonto');

        divLista.innerHTML = 'Carregando espelhos de ' + lista.length + ' funcionário(s)...';
        if (toolbar) toolbar.style.display = 'flex';
        if (btnExportar) {
            btnExportar.style.display = 'inline-flex';
            btnExportar.style.backgroundColor = '#217346';
            btnExportar.textContent = '📥 Exportar PDF (todos — ' + String((nomeMeses[String(periodo.mes).padStart(2, '0')] || periodo.mes)).toUpperCase() + '/' + periodo.ano + ')';
        }

        window._espelhoPontoPorMes = {};
        window._espelhoPontoExport = null;
        window._espelhoPontoTodosPeriodo = { mes: periodo.mes, ano: periodo.ano };

        const mesPad = String(periodo.mes).padStart(2, '0');
        const ano = String(periodo.ano);
        const mesNome = (nomeMeses[mesPad] || mesPad).toUpperCase();
        let htmlFinal = '<div style="background:#eef2f5;border:1px solid #d0d7de;border-radius:10px;padding:12px;margin-bottom:12px;text-align:center;">'
            + '<b>Espelho coletivo — ' + escapeHtmlBasico(mesNome) + '/' + escapeHtmlBasico(ano) + '</b><br>'
            + '<span style="font-size:12px;color:#555;">' + lista.length + ' funcionário(s). Clique em <b>Exportar PDF</b> para baixar o arquivo de todos e enviar ao RH.</span>'
            + '</div>';

        let comDados = 0;
        for (let i = 0; i < lista.length; i += 1) {
            const func = lista[i];
            try {
                const pack = await carregarPackEspelhoPontoFuncionario(func.id);
                if (!pack) {
                    htmlFinal += '<details class="pasta-mes"><summary>' + escapeHtmlBasico(func.nome || 'Funcionário') + ' — sem registros</summary>'
                        + '<div class="folder-content"><p style="text-align:center;color:#888;padding:10px;">Nenhum ponto neste período.</p></div></details>';
                    continue;
                }
                const holidaySet = (pack.holidayByYear && pack.holidayByYear[ano]) || feriadosNacionaisFixosEspelho(ano);
                const faltasMes = (pack.faltasRhPorMes[ano] && (pack.faltasRhPorMes[ano][mesPad] || pack.faltasRhPorMes[ano][String(Number(mesPad))])) || [];
                htmlFinal += '<details class="pasta-mes" ' + (comDados === 0 ? 'open' : '') + '><summary>' + escapeHtmlBasico(func.nome || 'Funcionário') + ' — Espelho ' + escapeHtmlBasico(mesNome) + '/' + escapeHtmlBasico(ano) + '</summary><div class="folder-content">';
                htmlFinal += htmlTabelaEspelhoPontoMes({
                    ano: ano,
                    mes: mesPad,
                    funcId: func.id,
                    funcionario: pack.funcionario,
                    pontosPorDia: pack.pontosPorDia,
                    canceladosSet: pack.idsCanceladosPonto,
                    idsErroSequencia: pack.idsErroSequencia,
                    idsDuplicadosPonto: pack.idsDuplicadosPonto,
                    faltasMes: faltasMes,
                    holidaySet: holidaySet
                });
                htmlFinal += '</div></details>';
                comDados += 1;
            } catch (err) {
                console.warn('espelho todos', func.id, err);
                htmlFinal += '<details class="pasta-mes"><summary>' + escapeHtmlBasico(func.nome || 'Funcionário') + ' — erro</summary>'
                    + '<div class="folder-content"><p style="text-align:center;color:#d9534f;">Falha ao carregar este funcionário.</p></div></details>';
            }
        }

        divLista.innerHTML = htmlFinal;
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: comDados + ' espelho(s) carregado(s)',
            showConfirmButton: false,
            timer: 2500
        });
    };

    window.buscarPonto = async function() {
        const funcId = document.getElementById('pt-func-select').value;
        if (!funcId) {
            return Swal.fire('Atenção', 'Selecione um funcionário (ou TODOS OS FUNCIONÁRIOS).', 'warning');
        }
        if (funcId === '__TODOS__') {
            return buscarPontoTodos();
        }
        
        const divLista = document.getElementById('lista-ponto-resultados'); 
        const toolbar = document.getElementById('ponto-export-toolbar');
        const btnExportar = document.getElementById('btnExportarPonto');
        
        divLista.innerHTML = "Buscando..."; 
        if (toolbar) toolbar.style.display = 'none';
        if (btnExportar) btnExportar.style.display = 'none';
        window.dadosExportacaoPonto = [];
        window._espelhoPontoPorMes = {};
        window._espelhoPontoExport = null;
        window._espelhoPontoTodosPeriodo = null;

        try {
            registrarFuncionarioContextoRH(funcId);
            const pack = await carregarPackEspelhoPontoFuncionario(funcId);
            if (!pack) {
                divLista.innerHTML = `<p style="color:#d9534f; text-align:center;">Nenhum registro.</p>`;
                return;
            }

            window.dadosExportacaoPonto = [];
            Object.keys(pack.pontosPorDia || {}).forEach((dia) => {
                (pack.pontosPorDia[dia] || []).forEach((b) => window.dadosExportacaoPonto.push(b));
            });

            if (toolbar) toolbar.style.display = 'flex';
            if (btnExportar) {
                btnExportar.style.display = 'inline-flex';
                btnExportar.style.backgroundColor = '';
                btnExportar.textContent = '📥 Exportar PDF';
            }
            window._espelhoPontoExport = pack;

            let htmlFinal = '';
            let chavesAno = Object.keys(pack.agrupado).sort((a, b) => {
                if (a === 'Outros') return 1;
                if (b === 'Outros') return -1;
                return Number(b) - Number(a);
            });

            chavesAno.forEach((ano) => {
                htmlFinal += `<details class="pasta-ano" open><summary>Ano ${escapeHtmlBasico(ano)}</summary><div class="folder-content">`;
                let chavesMes = Object.keys(pack.agrupado[ano]).sort((a, b) => {
                    if (a === 'Outros') return 1;
                    if (b === 'Outros') return -1;
                    return Number(b) - Number(a);
                });

                chavesMes.forEach((mes) => {
                    const nomeDoMes = nomeMeses[mes] || mes;
                    const mesPad = String(mes).padStart(2, '0');
                    htmlFinal += `<details class="pasta-mes"><summary>${escapeHtmlBasico(String(nomeDoMes).toUpperCase())} — Espelho de ponto</summary><div class="folder-content">`;
                    htmlFinal += htmlTabelaEspelhoPontoMes({
                        ano: ano,
                        mes: mesPad,
                        funcId: funcId,
                        funcionario: pack.funcionario,
                        pontosPorDia: pack.pontosPorDia,
                        canceladosSet: pack.idsCanceladosPonto,
                        idsErroSequencia: pack.idsErroSequencia,
                        idsDuplicadosPonto: pack.idsDuplicadosPonto,
                        faltasMes: (pack.faltasRhPorMes[ano] && pack.faltasRhPorMes[ano][mes]) ? pack.faltasRhPorMes[ano][mes] : (pack.faltasRhPorMes[ano] && pack.faltasRhPorMes[ano][mesPad] ? pack.faltasRhPorMes[ano][mesPad] : []),
                        holidaySet: pack.holidayByYear[ano] || feriadosNacionaisFixosEspelho(ano)
                    });
                    htmlFinal += `</div></details>`;
                });

                htmlFinal += `</div></details>`;
            });

            divLista.innerHTML = htmlFinal || '<p style="text-align:center;color:#888;">Sem dados para montar o espelho.</p>';
            
        } catch(e) { 
            console.error('buscarPonto', e);
            divLista.innerHTML = `<p style="color:red; text-align:center;">Erro ao organizar o espelho de ponto.</p>`; 
        }
    };

    window.solicitarCancelamentoPonto = async function(pontoId, funcionarioId) {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) {
            return Swal.fire('Atenção', 'Apenas a gestão pode solicitar cancelamento/ajuste de ponto.', 'warning');
        }
        const user = await ensureAuth();
        const authUid = user?.uid || localStorage.getItem('auth_uid') || null;

        const { value: motivo } = await Swal.fire({
            title: '⚠️ Solicitar cancelamento',
            input: 'textarea',
            inputLabel: 'Informe o motivo/justificativa (obrigatório)',
            inputPlaceholder: 'Ex.: Batida duplicada, erro de funcionário, entrada registrada no botão errado...',
            inputAttributes: { maxlength: 400 },
            showCancelButton: true,
            confirmButtonText: 'Registrar solicitação',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1a2a43',
            preConfirm: (val) => {
                const t = val ? String(val).trim() : '';
                if (t.length < 10) {
                    Swal.showValidationMessage('Informe uma justificativa com pelo menos 10 caracteres.');
                    return false;
                }
                return t;
            }
        });
        if (!motivo) return;

        const funcIdEvt = funcionarioId || document.getElementById('pt-func-select')?.value || null;

        try {
            await addDoc(collection(db, "ponto_eventos"), {
                tipo: "CANCELAMENTO",
                ponto_id: pontoId,
                empresa_id: empresaLogada,
                gestor_auth_uid: authUid,
                funcionario_id: funcIdEvt,
                motivo: String(motivo).trim(),
                criado_em: serverTimestamp()
            });
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Cancelamento registrado',
                showConfirmButton: false,
                timer: 2200
            });
            await recarregarPontoMantendoContexto();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível registrar a solicitação. Verifique permissões do Firestore ou a internet.', 'error');
        }
    };

    window.excluirPontoGestorRH = async function(pontoId) {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) {
            return Swal.fire('Atenção', 'Apenas o painel da gestão pode apagar registros de ponto.', 'warning');
        }
        const r = await Swal.fire({
            title: 'Apagar batida na base de dados?',
            html: 'Remove <b>definitivamente</b> este registro de ponto (use em batida errada).<br><br>Digite <b>APAGAR</b> para confirmar.',
            input: 'text',
            inputPlaceholder: 'APAGAR',
            showCancelButton: true,
            confirmButtonText: 'Apagar',
            cancelButtonText: 'Voltar',
            confirmButtonColor: '#d9534f',
            preConfirm: (val) => {
                if (String(val || '').trim() !== 'APAGAR') {
                    Swal.showValidationMessage('Digite APAGAR em maiúsculas para confirmar.');
                    return false;
                }
                return true;
            }
        });
        if (!r.isConfirmed) return;
        try {
            const qEvApagar = query(collection(db, 'ponto_eventos'), where('ponto_id', '==', pontoId));
            const snapEvApagar = await getDocs(qEvApagar);
            for (const dEv of snapEvApagar.docs) {
                try {
                    await deleteDoc(doc(db, 'ponto_eventos', dEv.id));
                } catch (e1) {
                    console.warn('Não foi possível apagar evento', dEv.id, e1);
                }
            }
            await deleteDoc(doc(db, 'ponto_registros', pontoId));
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Batida apagada',
                showConfirmButton: false,
                timer: 2200
            });
            await recarregarPontoMantendoContexto();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível apagar. Confirme as regras de segurança do Firestore (delete) para ponto_registros e ponto_eventos.', 'error');
        }
    };

    window.abrirRegistoPontoManualRH = async function () {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) {
            return Swal.fire('Atenção', 'Entre como gestor para usar esta função.', 'warning');
        }

        const result = await Swal.fire({
            title: 'Registar batida manual (RH)',
            html:
                '<p style="font-size:12px;text-align:left;margin:0 0 10px;line-height:1.45;">Usa o <b>funcionário já selecionado</b> no campo "Consultar ponto" acima. Indique o tipo, data, hora e local (ex.: valores do caderno de obra).</p>' +
                '<label style="display:block;text-align:left;font-size:12px;margin-top:8px;">Tipo de batida</label>' +
                '<select id="pt-manual-tipo" class="swal2-input" style="margin-top:4px;">' +
                '<option value="Entrada">Entrada</option>' +
                '<option value="Início Intervalo">Início intervalo (saiu para almoço)</option>' +
                '<option value="Fim Intervalo">Fim intervalo (voltou do almoço)</option>' +
                '<option value="Saída">Saída</option>' +
                '</select>' +
                '<label style="display:block;text-align:left;font-size:12px;margin-top:10px;">Data</label>' +
                '<input id="pt-manual-data" type="date" class="swal2-input" style="margin-top:4px;">' +
                '<label style="display:block;text-align:left;font-size:12px;margin-top:10px;">Hora</label>' +
                '<input id="pt-manual-hora" type="time" class="swal2-input" style="margin-top:4px;">' +
                '<label style="display:block;text-align:left;font-size:12px;margin-top:10px;">Obra / local</label>' +
                '<input id="pt-manual-obra" type="text" class="swal2-input" style="margin-top:4px;" placeholder="Ex.: Obra X / escritório">' +
                '<label style="display:block;text-align:left;font-size:12px;margin-top:10px;">Nota interna (opcional)</label>' +
                '<input id="pt-manual-nota" type="text" class="swal2-input" style="margin-top:4px;" placeholder="Ex.: lançado a partir do caderno de ponto">',
            width: 520,
            showCancelButton: true,
            confirmButtonText: 'Guardar batida',
            cancelButtonText: 'Fechar',
            confirmButtonColor: '#1a2a43',
            focusConfirm: false,
            didOpen: function () {
                const ag = new Date();
                const iso = ag.getFullYear() + '-' + String(ag.getMonth() + 1).padStart(2, '0') + '-' + String(ag.getDate()).padStart(2, '0');
                const elD = document.getElementById('pt-manual-data');
                if (elD && !elD.value) elD.value = iso;
                const elH = document.getElementById('pt-manual-hora');
                if (elH && !elH.value) {
                    elH.value = String(ag.getHours()).padStart(2, '0') + ':' + String(ag.getMinutes()).padStart(2, '0');
                }
            },
            preConfirm: function () {
                const funcId = document.getElementById('pt-func-select').value;
                if (!funcId) {
                    Swal.showValidationMessage('Selecione um funcionário no dropdown "Consultar ponto" antes de abrir este formulário.');
                    return false;
                }
                const tipo = document.getElementById('pt-manual-tipo').value;
                const dataIso = document.getElementById('pt-manual-data').value;
                const horaRaw = document.getElementById('pt-manual-hora').value;
                const obra = (document.getElementById('pt-manual-obra').value || '').trim();
                const nota = (document.getElementById('pt-manual-nota').value || '').trim();
                if (!dataIso) {
                    Swal.showValidationMessage('Indique a data.');
                    return false;
                }
                if (!horaRaw) {
                    Swal.showValidationMessage('Indique a hora.');
                    return false;
                }
                if (!obra) {
                    Swal.showValidationMessage('Indique obra / local.');
                    return false;
                }
                const dataBR = inputDateIsoParaDataBr(dataIso);
                const horaN = normalizarHoraHHmm(horaRaw);
                const ts = parseDataHoraBrLocalParaTimestamp(dataBR, horaN);
                if (!Number.isFinite(ts)) {
                    Swal.showValidationMessage('Data ou hora inválida.');
                    return false;
                }
                return { funcId: funcId, tipo: tipo, dataBR: dataBR, hora: horaN, obra: obra, nota: nota, ts: ts };
            }
        });

        if (!result.isConfirmed || !result.value) return;

        const v = result.value;
        const func = window.listaFuncionarios && window.listaFuncionarios[v.funcId];
        const nomeFunc = func && func.nome ? func.nome : 'Funcionário';

        Swal.fire({ title: 'A gravar...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
        try {
            const user = await ensureAuth();
            const authUid = user && user.uid ? user.uid : localStorage.getItem('auth_uid') || null;
            await addDoc(collection(db, 'ponto_registros'), {
                empresa_id: empresaLogada,
                funcionario_id: v.funcId,
                auth_uid: authUid,
                nome: nomeFunc,
                tipo: v.tipo,
                obra: v.obra,
                data: v.dataBR,
                hora: v.hora,
                latitude: null,
                longitude: null,
                foto: '',
                timestamp: v.ts,
                client_device_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
                created_at: serverTimestamp(),
                registo_manual_rh: true,
                gestor_rh_uid: authUid,
                nota_rh: v.nota || null
            });
            Swal.close();
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Batida manual registada',
                showConfirmButton: false,
                timer: 2200
            });
            await recarregarPontoMantendoContexto();
        } catch (e) {
            console.error(e);
            Swal.close();
            Swal.fire('Erro', 'Não foi possível gravar. Verifique permissões do Firestore (create em ponto_registros).', 'error');
        }
    };

    window.editarPontoDataHoraRH = async function (pontoId) {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) {
            return Swal.fire('Atenção', 'Entre como gestor.', 'warning');
        }
        Swal.fire({ title: 'Carregando...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
        let atual = null;
        try {
            const snap = await getDoc(doc(db, 'ponto_registros', pontoId));
            if (!snap.exists()) {
                Swal.close();
                return Swal.fire('Erro', 'Registo não encontrado.', 'error');
            }
            atual = snap.data();
            if (atual.empresa_id && atual.empresa_id !== empresaLogada) {
                Swal.close();
                return Swal.fire('Atenção', 'Este ponto pertence a outra empresa.', 'warning');
            }
        } catch (e) {
            console.error(e);
            Swal.close();
            return Swal.fire('Erro', 'Não foi possível ler o registro.', 'error');
        }
        Swal.close();

        const dataIsoIni = dataBrParaInputDateIso(atual.data) || '';
        const horaIni = normalizarHoraHHmm(atual.hora || '00:00');

        const result = await Swal.fire({
            title: 'Ajustar data e hora do batimento',
            html:
                '<p style="font-size:12px;text-align:left;margin:0 0 10px;">Altere a <b>data</b> e a <b>hora</b> deste registro (ex.: erro de digitação ou hora do caderno). O <b>tipo</b> (Entrada, etc.) permanece; use cancelar + novo registro se precisar mudar o tipo.</p>' +
                '<label style="display:block;text-align:left;font-size:12px;margin-top:8px;">Nova data</label>' +
                '<input id="pt-edit-data" type="date" class="swal2-input" style="margin-top:4px;" value="' + dataIsoIni + '">' +
                '<label style="display:block;text-align:left;font-size:12px;margin-top:10px;">Nova hora</label>' +
                '<input id="pt-edit-hora" type="time" class="swal2-input" style="margin-top:4px;" value="' + horaIni + '">' +
                '<label style="display:block;text-align:left;font-size:12px;margin-top:10px;">Nota do ajuste (opcional)</label>' +
                '<input id="pt-edit-nota" type="text" class="swal2-input" style="margin-top:4px;" placeholder="Ex.: corrigido conforme caderno">',
            width: 500,
            showCancelButton: true,
            confirmButtonText: 'Guardar alteração',
            cancelButtonText: 'Fechar',
            confirmButtonColor: '#1a2a43',
            focusConfirm: false,
            preConfirm: function () {
                const dataIso = document.getElementById('pt-edit-data').value;
                const horaRaw = document.getElementById('pt-edit-hora').value;
                const notaA = (document.getElementById('pt-edit-nota').value || '').trim();
                if (!dataIso) {
                    Swal.showValidationMessage('Indique a data.');
                    return false;
                }
                if (!horaRaw) {
                    Swal.showValidationMessage('Indique a hora.');
                    return false;
                }
                const dataBR = inputDateIsoParaDataBr(dataIso);
                const horaN = normalizarHoraHHmm(horaRaw);
                const ts = parseDataHoraBrLocalParaTimestamp(dataBR, horaN);
                if (!Number.isFinite(ts)) {
                    Swal.showValidationMessage('Data ou hora inválida.');
                    return false;
                }
                return { dataBR: dataBR, hora: horaN, ts: ts, notaAjuste: notaA };
            }
        });

        if (!result.isConfirmed || !result.value) return;

        const val = result.value;
        Swal.fire({ title: 'A gravar...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
        try {
            const user = await ensureAuth();
            const authUid = user && user.uid ? user.uid : localStorage.getItem('auth_uid') || null;
            const patch = {
                data: val.dataBR,
                hora: val.hora,
                timestamp: val.ts,
                ajuste_datahora_rh_em: serverTimestamp(),
                ajuste_datahora_rh_uid: authUid
            };
            if (val.notaAjuste) patch.ajuste_datahora_rh_nota = val.notaAjuste;
            await updateDoc(doc(db, 'ponto_registros', pontoId), patch);
            Swal.close();
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Data/hora atualizadas',
                showConfirmButton: false,
                timer: 2500
            });
            await recarregarPontoMantendoContexto();
        } catch (e) {
            console.error(e);
            Swal.close();
            Swal.fire('Erro', 'Não foi possível atualizar. Verifique permissões do Firestore (update em ponto_registros).', 'error');
        }
    };

    window.rhAjustarJornadaCompletaDia = async function (dataBrSugerida) {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) {
            return Swal.fire('Atenção', 'Entre como gestor.', 'warning');
        }
        const funcId = obterFuncionarioIdContextoRH();
        if (!funcId || !window.listaFuncionarios || !window.listaFuncionarios[funcId]) {
            return Swal.fire('Atenção', 'Selecione o funcionário no campo da folha de pagamento (ou em Consultar ponto) e tente de novo.', 'warning');
        }
        registrarFuncionarioContextoRH(funcId);
        const func = window.listaFuncionarios[funcId];
        const dataIsoSug = dataBrSugerida ? dataBrParaInputDateIso(dataBrSugerida) : '';
        const padrao = horariosJornadaPadraoFuncionario(func, dataBrSugerida || '01/01/2026');

        const result = await Swal.fire({
            title: 'Corrigir jornada completa (RH)',
            html:
                '<p style="font-size:12px;text-align:left;margin:0 0 10px;line-height:1.45;">Define ou atualiza as <b>4 batidas</b> do dia (entrada, almoço e saída) conforme o horário do cadastro. Batidas canceladas são ignoradas; as existentes do mesmo tipo são atualizadas.</p>' +
                '<label style="display:block;text-align:left;font-size:12px;margin-top:8px;">Data</label>' +
                '<input id="pt-jorn-data" type="date" class="swal2-input" style="margin-top:4px;" value="' + (dataIsoSug || '') + '">' +
                '<label style="display:block;text-align:left;font-size:12px;margin-top:10px;">Entrada</label>' +
                '<input id="pt-jorn-entrada" type="time" class="swal2-input" style="margin-top:4px;" value="' + padrao.entrada + '">' +
                '<label style="display:block;text-align:left;font-size:12px;margin-top:10px;">Início intervalo</label>' +
                '<input id="pt-jorn-ini-int" type="time" class="swal2-input" style="margin-top:4px;" value="' + padrao.inicioIntervalo + '">' +
                '<label style="display:block;text-align:left;font-size:12px;margin-top:10px;">Fim intervalo</label>' +
                '<input id="pt-jorn-fim-int" type="time" class="swal2-input" style="margin-top:4px;" value="' + padrao.fimIntervalo + '">' +
                '<label style="display:block;text-align:left;font-size:12px;margin-top:10px;">Saída</label>' +
                '<input id="pt-jorn-saida" type="time" class="swal2-input" style="margin-top:4px;" value="' + padrao.saida + '">' +
                '<label style="display:block;text-align:left;font-size:12px;margin-top:10px;">Obra / local</label>' +
                '<input id="pt-jorn-obra" type="text" class="swal2-input" style="margin-top:4px;" placeholder="Ex.: Obra / escritório">',
            width: 520,
            showCancelButton: true,
            confirmButtonText: 'Guardar jornada',
            cancelButtonText: 'Fechar',
            confirmButtonColor: '#17a2b8',
            focusConfirm: false,
            didOpen: function () {
                const elD = document.getElementById('pt-jorn-data');
                if (elD && !elD.value) {
                    const ag = new Date();
                    elD.value = ag.getFullYear() + '-' + String(ag.getMonth() + 1).padStart(2, '0') + '-' + String(ag.getDate()).padStart(2, '0');
                }
            },
            preConfirm: function () {
                const dataIso = document.getElementById('pt-jorn-data').value;
                const obra = (document.getElementById('pt-jorn-obra').value || '').trim();
                if (!dataIso) {
                    Swal.showValidationMessage('Indique a data.');
                    return false;
                }
                if (!obra) {
                    Swal.showValidationMessage('Indique obra / local.');
                    return false;
                }
                const dataBR = inputDateIsoParaDataBr(dataIso);
                const horas = {
                    'Entrada': normalizarHoraHHmm(document.getElementById('pt-jorn-entrada').value),
                    'Início Intervalo': normalizarHoraHHmm(document.getElementById('pt-jorn-ini-int').value),
                    'Fim Intervalo': normalizarHoraHHmm(document.getElementById('pt-jorn-fim-int').value),
                    'Saída': normalizarHoraHHmm(document.getElementById('pt-jorn-saida').value)
                };
                for (const k of Object.keys(horas)) {
                    const ts = parseDataHoraBrLocalParaTimestamp(dataBR, horas[k]);
                    if (!Number.isFinite(ts)) {
                        Swal.showValidationMessage('Hora inválida em ' + k + '.');
                        return false;
                    }
                }
                return { dataBR: dataBR, obra: obra, horas: horas };
            }
        });

        if (!result.isConfirmed || !result.value) return;

        const val = result.value;
        Swal.fire({ title: 'A gravar jornada...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });

        try {
            const user = await ensureAuth();
            const authUid = user && user.uid ? user.uid : localStorage.getItem('auth_uid') || null;
            const cancelados = new Set();
            try {
                const qEvt = query(collection(db, 'ponto_eventos'), where('funcionario_id', '==', funcId));
                const snapEvt = await getDocs(qEvt);
                snapEvt.forEach((ed) => {
                    const ev = ed.data();
                    if (ev && ev.tipo === 'CANCELAMENTO' && ev.ponto_id) cancelados.add(ev.ponto_id);
                });
            } catch (_) { /* sem eventos */ }

            const qP = query(collection(db, 'ponto_registros'), where('funcionario_id', '==', funcId));
            const snapP = await getDocs(qP);
            const keyDia = formatarDataBrPadrao(val.dataBR);
            const porTipo = {};
            snapP.forEach((docSnap) => {
                if (cancelados.has(docSnap.id)) return;
                const d = docSnap.data();
                if (formatarDataBrPadrao(d.data) !== keyDia) return;
                const tipoN = normalizarTipoBatidaPonto(d.tipo);
                if (!['Entrada', 'Saída', 'Início Intervalo', 'Fim Intervalo'].includes(tipoN)) return;
                let ts = d.timestamp;
                if (!Number.isFinite(ts)) ts = parseDataHoraBrLocalParaTimestamp(d.data, d.hora);
                const item = { id: docSnap.id, ts: Number(ts) || 0 };
                if (!porTipo[tipoN] || item.ts < porTipo[tipoN].ts) porTipo[tipoN] = item;
            });

            const tiposOrdem = ['Entrada', 'Início Intervalo', 'Fim Intervalo', 'Saída'];
            let atualizados = 0;
            let criados = 0;
            for (const tipo of tiposOrdem) {
                const hora = val.horas[tipo];
                const ts = parseDataHoraBrLocalParaTimestamp(val.dataBR, hora);
                const existente = porTipo[tipo];
                if (existente) {
                    await updateDoc(doc(db, 'ponto_registros', existente.id), {
                        data: val.dataBR,
                        hora: hora,
                        timestamp: ts,
                        ajuste_jornada_rh_em: serverTimestamp(),
                        ajuste_jornada_rh_uid: authUid
                    });
                    atualizados += 1;
                } else {
                    await addDoc(collection(db, 'ponto_registros'), {
                        empresa_id: empresaLogada,
                        funcionario_id: funcId,
                        auth_uid: authUid,
                        nome: func.nome || 'Funcionário',
                        tipo: tipo,
                        obra: val.obra,
                        data: val.dataBR,
                        hora: hora,
                        latitude: null,
                        longitude: null,
                        foto: '',
                        timestamp: ts,
                        client_device_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
                        created_at: serverTimestamp(),
                        registo_manual_rh: true,
                        jornada_completa_rh: true,
                        gestor_rh_uid: authUid
                    });
                    criados += 1;
                }
            }

            Swal.close();
            const recalcFolha = document.getElementById('folha-func-select') && document.getElementById('folha-func-select').value === funcId;
            await Swal.fire(
                'Jornada guardada',
                `Dia ${val.dataBR}: ${atualizados} batida(s) atualizada(s), ${criados} criada(s).` +
                    (recalcFolha ? '<br><br>A folha será recalculada automaticamente.' : '<br><br>Clique em <b>Calcular fechamento</b> na folha para atualizar as horas.'),
                'success'
            );
            if (recalcFolha && typeof gerarFolhaPagamento === 'function') {
                await gerarFolhaPagamento();
            }
        } catch (e) {
            console.error(e);
            Swal.close();
            Swal.fire('Erro', 'Não foi possível salvar a jornada. Verifique permissões do Firestore.', 'error');
        }
    };

    async function removerEventosFaltaRhNaData(funcId, dataIso) {
        const qEvt = query(collection(db, 'ponto_eventos'), where('funcionario_id', '==', funcId));
        const snap = await getDocs(qEvt);
        const idsApagar = [];
        snap.forEach(function (ed) {
            const ev = ed.data();
            if (!ev || (ev.tipo !== 'FALTA_INJUSTIFICADA' && ev.tipo !== 'FALTA_JUSTIFICADA')) return;
            let iso = ev.data_iso || '';
            if (!iso && ev.data_br) {
                const br = formatarDataBrPadrao(ev.data_br);
                const s = separarDataSegura(br);
                if (s.ano !== 'Outros') iso = `${s.ano}-${s.mes}-${s.dia}`;
            }
            if (iso === dataIso) idsApagar.push(ed.id);
        });
        for (let i = 0; i < idsApagar.length; i++) {
            await deleteDoc(doc(db, 'ponto_eventos', idsApagar[i]));
        }
        return idsApagar.length;
    }

    window.rhGerirFaltaDia = async function (dataBrSugerida) {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) {
            return Swal.fire('Atenção', 'Entre como gestor (RH).', 'warning');
        }
        const funcId = obterFuncionarioIdContextoRH();
        if (!funcId || !window.listaFuncionarios || !window.listaFuncionarios[funcId]) {
            return Swal.fire('Atenção', 'Selecione o funcionário em <b>Consultar ponto</b> ou na <b>Folha de pagamento</b>.', 'warning');
        }
        registrarFuncionarioContextoRH(funcId);
        const nomeFunc = window.listaFuncionarios[funcId].nome || 'Funcionário';

        let eventosExistentes = [];
        try {
            const qEvt = query(collection(db, 'ponto_eventos'), where('funcionario_id', '==', funcId));
            const snap = await getDocs(qEvt);
            snap.forEach(function (ed) {
                const ev = ed.data();
                if (!ev || (ev.tipo !== 'FALTA_INJUSTIFICADA' && ev.tipo !== 'FALTA_JUSTIFICADA')) return;
                let iso = ev.data_iso || '';
                if (!iso && ev.data_br) {
                    const br = formatarDataBrPadrao(ev.data_br);
                    const s = separarDataSegura(br);
                    if (s.ano !== 'Outros') iso = `${s.ano}-${s.mes}-${s.dia}`;
                }
                if (!iso) return;
                eventosExistentes.push({
                    id: ed.id,
                    tipo: ev.tipo,
                    iso: iso,
                    dataBr: isoParaDataBr(iso),
                    motivo: String(ev.motivo || '').trim(),
                    descontarDsr: ev.descontar_dsr !== false
                });
            });
        } catch (e) {
            console.warn('Eventos falta RH:', e);
        }
        eventosExistentes.sort(function (a, b) { return String(b.iso).localeCompare(String(a.iso)); });

        const listaHtml = eventosExistentes.length
            ? '<div style="max-height:150px;overflow:auto;text-align:left;font-size:11px;margin-bottom:10px;border:1px solid #ddd;border-radius:6px;padding:8px;background:#fafafa;">' +
                eventosExistentes.slice(0, 40).map(function (e) {
                    const injust = e.tipo === 'FALTA_INJUSTIFICADA';
                    const cor = injust ? '#b02a37' : '#28a745';
                    const lbl = injust ? 'Injustificada' : 'Justificada';
                    const dsrLbl = injust && e.descontarDsr === false
                        ? '<br><span style="color:#856404;font-size:10px;">Sem desconto de DSR</span>'
                        : (injust ? '<br><span style="color:#666;font-size:10px;">Com desconto de DSR</span>' : '');
                    return `<div style="margin-bottom:5px;padding:5px 6px;border-bottom:1px solid #eee;">
                        <b style="color:${cor}">${lbl}</b> — ${escapeHtmlBasico(e.dataBr)}
                        ${e.motivo ? '<br><span style="color:#666;">' + escapeHtmlBasico(e.motivo) + '</span>' : ''}
                        ${dsrLbl}
                    </div>`;
                }).join('') + '</div>'
            : '<p style="font-size:11px;color:#888;text-align:left;margin:0 0 10px;">Nenhuma falta ou atestado registado ainda.</p>';

        const dataIsoSug = dataBrSugerida ? dataBrParaInputDateIso(dataBrSugerida) : '';

        const result = await Swal.fire({
            title: 'Falta injustificada / atestado (RH)',
            html:
                `<p style="font-size:12px;text-align:left;margin:0 0 8px;line-height:1.45;"><b>${escapeHtmlBasico(nomeFunc)}</b><br>
                <b>Falta injustificada:</b> desconta 1 dia na folha (DSR opcional abaixo).<br>
                <b>Atestado / justificada:</b> remove a falta automática (dia sem ponto).</p>` +
                listaHtml +
                '<p style="font-size:12px;text-align:left;margin:12px 0 6px;font-weight:700;">Registar ou alterar:</p>' +
                '<label style="display:block;text-align:left;font-size:12px;margin-top:6px;">Data</label>' +
                '<input id="rh-falta-data" type="date" class="swal2-input" style="margin-top:4px;" value="' + (dataIsoSug || '') + '">' +
                '<label style="display:block;text-align:left;font-size:12px;margin-top:10px;">Ação</label>' +
                '<select id="rh-falta-acao" class="swal2-input" style="margin-top:4px;height:auto;padding:8px;">' +
                '<option value="INJUSTIFICADA">Falta injustificada</option>' +
                '<option value="JUSTIFICADA">Atestado / justificada (não desconta)</option>' +
                '<option value="REMOVER">Remover registro desta data</option>' +
                '</select>' +
                '<label id="rh-falta-dsr-wrap" style="display:flex;align-items:flex-start;gap:8px;text-align:left;font-size:12px;margin-top:12px;cursor:pointer;">' +
                '<input type="checkbox" id="rh-falta-dsr" checked style="margin-top:3px;width:auto;">' +
                '<span><b>Descontar DSR</b> (descanso semanal remunerado) na folha e holerite<br><span style="color:#666;font-size:11px;">Desmarque para descontar <b>somente o dia</b> de falta, sem perder o domingo.</span></span>' +
                '</label>' +
                '<label style="display:block;text-align:left;font-size:12px;margin-top:10px;">Motivo / observação</label>' +
                '<textarea id="rh-falta-motivo" class="swal2-textarea" style="margin-top:4px;min-height:70px;" placeholder="Ex.: Falta sem aviso, atestado médico, etc."></textarea>',
            width: 520,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Fechar',
            confirmButtonColor: '#b02a37',
            focusConfirm: false,
            didOpen: function () {
                const elD = document.getElementById('rh-falta-data');
                const elA = document.getElementById('rh-falta-acao');
                const elDsrWrap = document.getElementById('rh-falta-dsr-wrap');
                const elDsr = document.getElementById('rh-falta-dsr');
                function atualizarCampoDsrRh() {
                    if (!elDsrWrap || !elA) return;
                    elDsrWrap.style.display = elA.value === 'INJUSTIFICADA' ? 'flex' : 'none';
                }
                if (elA) elA.addEventListener('change', atualizarCampoDsrRh);
                if (elD && !elD.value) {
                    const ag = new Date();
                    elD.value = ag.getFullYear() + '-' + String(ag.getMonth() + 1).padStart(2, '0') + '-' + String(ag.getDate()).padStart(2, '0');
                }
                function preencherPorData(isoRef) {
                    if (!isoRef) return;
                    const exist = eventosExistentes.find(function (e) { return e.iso === isoRef; });
                    if (!exist) return;
                    const elM = document.getElementById('rh-falta-motivo');
                    if (elA) elA.value = exist.tipo === 'FALTA_INJUSTIFICADA' ? 'INJUSTIFICADA' : 'JUSTIFICADA';
                    if (elM) elM.value = exist.motivo || '';
                    if (elDsr) elDsr.checked = exist.descontarDsr !== false;
                    atualizarCampoDsrRh();
                }
                if (dataIsoSug) preencherPorData(dataIsoSug);
                if (elD) elD.addEventListener('change', function () {
                    preencherPorData(elD.value);
                });
                atualizarCampoDsrRh();
            },
            preConfirm: function () {
                const dataIso = document.getElementById('rh-falta-data').value;
                const acao = document.getElementById('rh-falta-acao').value;
                const motivo = (document.getElementById('rh-falta-motivo').value || '').trim();
                const elDsr = document.getElementById('rh-falta-dsr');
                const descontarDsr = elDsr ? elDsr.checked : true;
                if (!dataIso) {
                    Swal.showValidationMessage('Indique a data.');
                    return false;
                }
                if (acao !== 'REMOVER' && motivo.length < 3) {
                    Swal.showValidationMessage('Informe um motivo com pelo menos 3 caracteres.');
                    return false;
                }
                return { dataIso: dataIso, dataBR: inputDateIsoParaDataBr(dataIso), acao: acao, motivo: motivo, descontarDsr: descontarDsr };
            }
        });

        if (!result.isConfirmed || !result.value) return;

        const val = result.value;
        Swal.fire({ title: 'Salvando...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });

        try {
            const user = await ensureAuth();
            const authUid = user && user.uid ? user.uid : localStorage.getItem('auth_uid') || null;
            const removidos = await removerEventosFaltaRhNaData(funcId, val.dataIso);

            if (val.acao === 'REMOVER') {
                Swal.close();
                await Swal.fire(
                    'Removido',
                    removidos > 0
                        ? `Registro de falta/atestado em <b>${val.dataBR}</b> removido. Recalcule a folha para atualizar descontos.`
                        : `Não havia registro de falta/atestado em <b>${val.dataBR}</b>.`,
                    'success'
                );
            } else {
                const tipoEvt = val.acao === 'INJUSTIFICADA' ? 'FALTA_INJUSTIFICADA' : 'FALTA_JUSTIFICADA';
                const payloadEvt = {
                    tipo: tipoEvt,
                    funcionario_id: funcId,
                    empresa_id: empresaLogada,
                    gestor_auth_uid: authUid,
                    data_iso: val.dataIso,
                    data_br: val.dataBR,
                    motivo: val.motivo,
                    criado_em: serverTimestamp()
                };
                if (val.acao === 'INJUSTIFICADA') {
                    payloadEvt.descontar_dsr = val.descontarDsr !== false;
                }
                await addDoc(collection(db, 'ponto_eventos'), payloadEvt);
                Swal.close();
                const msgTipo = val.acao === 'INJUSTIFICADA'
                    ? (val.descontarDsr !== false
                        ? 'Falta injustificada registada. Na folha: desconto de <b>1 dia</b> + <b>DSR</b> da semana (se houver domingo no mês).'
                        : 'Falta injustificada registada. Na folha: desconto de <b>1 dia</b> apenas (<b>sem DSR</b>).')
                    : 'Atestado/justificativa registada. O dia <b>não</b> contará como falta nem descontará DSR.';
                await Swal.fire('Guardado', `${msgTipo}<br><br>Data: <b>${val.dataBR}</b>`, 'success');
            }

            const recalcFolha = document.getElementById('folha-func-select') && document.getElementById('folha-func-select').value === funcId;
            if (typeof buscarPonto === 'function' && document.getElementById('pt-func-select') && document.getElementById('pt-func-select').value === funcId) {
                await buscarPonto();
            }
            if (recalcFolha && typeof gerarFolhaPagamento === 'function') {
                await gerarFolhaPagamento();
            }
        } catch (e) {
            console.error(e);
            Swal.close();
            Swal.fire('Erro', 'Não foi possível salvar. Verifique permissões do Firestore (ponto_eventos).', 'error');
        }
    };
