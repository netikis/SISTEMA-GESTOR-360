/* js/modulos/entradas.js — edite este arquivo para alterar só este módulo */
    window.limparFormContaReceberEntrada = function () {
        const form = document.getElementById('formContaReceber');
        if (form) form.reset();
        ['crCliente', 'crDocumento', 'crVencimento', 'crValor', 'crDescricao'].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    };

    // 1. SALVAR NOVA CONTA A RECEBER (PENDENTE) — Firestore Gestor 360
    window.salvarContaReceber = async function () {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) return Swal.fire('Atenção', 'Empresa não definida.', 'warning');

        const cliente = (document.getElementById('crCliente') && document.getElementById('crCliente').value || '').trim();
        const docNum = (document.getElementById('crDocumento') && document.getElementById('crDocumento').value || '').trim();
        const vencimento = (document.getElementById('crVencimento') && document.getElementById('crVencimento').value || '').trim();
        const valorStr = (document.getElementById('crValor') && document.getElementById('crValor').value || '').trim();
        const desc = (document.getElementById('crDescricao') && document.getElementById('crDescricao').value || '').trim();
        const valor = parseMoedaLocal(valorStr || '0');

        if (!cliente || !vencimento || !(valor > 0)) {
            return Swal.fire('Atenção', 'Informe cliente, vencimento e valor.', 'warning');
        }

        const agora = Date.now();
        const payload = {
            empresa_id: empresaLogada,
            tipo: 'CONTA_RECEBER',
            statusPagamento: 'PENDENTE',
            status: 'PENDENTE',
            clienteNome: cliente,
            cliente: cliente,
            cliente_lower: cliente.toLowerCase(),
            os: docNum,
            documento: docNum,
            vencimento: vencimento,
            data_vencimento: vencimento,
            data_vencimento_ts: parseDataVencimentoParaTimestamp(vencimento),
            total: valor,
            valor_numero: valor,
            valor_string: valorStr,
            saldoDevedor: valor,
            saldo_devedor: valor,
            observacao: desc,
            descricao: desc,
            valorRecebidoParcial: 0,
            valor_recebido_parcial: 0,
            recebimentosParciais: [],
            dataStr: new Date(agora).toLocaleString('pt-BR'),
            data_cadastro: new Date(agora).toLocaleDateString('pt-BR'),
            timestamp: agora,
            criado_em: serverTimestamp()
        };

        try {
            await addDoc(collection(db, COLECAO_CONTAS_RECEBER), payload);
            limparFormContaReceberEntrada();
            Swal.fire('Sucesso!', 'Conta registrada em Contas a Receber.', 'success');
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível registrar: ' + (e.message || 'falha'), 'error');
        }
    };
    window.salvarContaReceberEntrada = window.salvarContaReceber;

    async function carregarContasReceberEmpresa() {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) return [];
        const q = query(collection(db, COLECAO_CONTAS_RECEBER), where('empresa_id', '==', empresaLogada));
        const snap = await getDocs(q);
        const lista = [];
        snap.forEach(function (d) {
            lista.push(Object.assign({ id: d.id }, d.data() || {}));
        });
        lista.sort(function (a, b) {
            const ta = a.data_vencimento_ts != null ? Number(a.data_vencimento_ts) : (a.timestamp || 0);
            const tb = b.data_vencimento_ts != null ? Number(b.data_vencimento_ts) : (b.timestamp || 0);
            return ta - tb;
        });
        return lista;
    }

    // 2. RENDERIZAR CONTAS A RECEBER (PENDENTE / PARCIAL)
    window.renderContasReceber = async function () {
        const tbody = document.getElementById('tabelaContasReceber');
        const elTotal = document.getElementById('ent-total-pendente');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;">Carregando...</td></tr>';
        try {
            const busca = ((document.getElementById('ent-busca-pendentes') && document.getElementById('ent-busca-pendentes').value) || '').trim().toLowerCase();
            const pendentes = (await carregarContasReceberEmpresa()).filter(function (v) {
                return contaReceberEmAberto(v);
            }).filter(function (c) {
                if (!busca) return true;
                const txt = [nomeClienteConta(c), docContaReceber(c), descContaReceber(c)].join(' ').toLowerCase();
                return txt.indexOf(busca) !== -1;
            });

            let soma = 0;
            if (!pendentes.length) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;">Nenhuma conta a receber.</td></tr>';
            } else {
                let html = '';
                pendentes.forEach(function (c) {
                    const total = totalContaReceber(c);
                    const jaRec = valorRecebidoConta(c);
                    const saldo = saldoDevedorConta(c);
                    soma += saldo;
                    const vencForm = formatarDataBrEntrada(c.vencimento || c.data_vencimento);
                    const ehParcial = jaRec > 0.009;
                    const badge = ehParcial
                        ? '<span style="display:inline-block;margin-top:4px;font-size:10px;background:#17a2b8;color:#fff;padding:2px 6px;border-radius:4px;font-weight:800;">PARCIAL</span>'
                        : '';
                    html += '<tr>'
                        + '<td style="font-weight:bold;color:#e74c3c;white-space:nowrap;">' + escapeHtmlBasico(vencForm) + '</td>'
                        + '<td><b>' + escapeHtmlBasico(nomeClienteConta(c)) + '</b></td>'
                        + '<td>' + escapeHtmlBasico(docContaReceber(c) || '—') + '</td>'
                        + '<td>' + escapeHtmlBasico(descContaReceber(c) || '—') + htmlHistRecebimentosParciaisConta(c) + '</td>'
                        + '<td style="white-space:nowrap;font-size:12px;">'
                        + '<div>Total: <b>' + formatarMoedaEntrada(total) + '</b></div>'
                        + (ehParcial ? '<div style="color:#1e8449;">Já recebido: <b>' + formatarMoedaEntrada(jaRec) + '</b></div>' : '')
                        + '<div style="color:#c0392b;">Saldo: <b>' + formatarMoedaEntrada(saldo) + '</b></div>'
                        + badge
                        + '</td>'
                        + '<td class="celula-acoes" style="white-space:nowrap;">'
                        + '<div style="display:flex;flex-direction:column;gap:6px;min-width:140px;">'
                        + '<button type="button" style="background:#17a2b8;color:#fff;border:none;padding:7px 10px;border-radius:6px;font-weight:800;cursor:pointer;font-size:11px;" onclick="lancarRecebimentoParcialConta(\'' + escapeAttrBasico(c.id) + '\')">💰 PARCIAL</button>'
                        + '<button type="button" class="btn-acao receber" style="background:#27ae60;color:#fff;border:none;padding:7px 10px;border-radius:6px;font-weight:800;cursor:pointer;font-size:11px;" onclick="receberContaCaixa(\'' + escapeAttrBasico(c.id) + '\')">✅ RECEBER TOTAL</button>'
                        + '<button type="button" class="btn-excluir" style="padding:6px 8px;" onclick="excluirContaEntrada(\'' + escapeAttrBasico(c.id) + '\')">🗑️</button>'
                        + '</div>'
                        + '</td></tr>';
                });
                tbody.innerHTML = html;
            }
            if (elTotal) elTotal.textContent = formatarMoedaEntrada(soma);
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#d9534f;">Erro ao carregar contas.</td></tr>';
        }
    };

    async function buscarContaReceberPorId(id) {
        const lista = await carregarContasReceberEmpresa();
        return lista.find(function (x) { return String(x.id) === String(id); }) || null;
    }

    function dataIsoHojeContaReceber() {
        const hoje = new Date();
        return hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');
    }

    function dataBrDeIsoContaReceber(dataIso, fallback) {
        if (dataIso && /^\d{4}-\d{2}-\d{2}/.test(dataIso)) {
            const p = dataIso.split('-');
            return p[2] + '/' + p[1] + '/' + p[0];
        }
        return fallback || new Date().toLocaleDateString('pt-BR');
    }

    async function gravarRecebimentoConta(id, conta, opts) {
        const valorRecebido = Number(opts.valorRecebido) || 0;
        const formaPgto = opts.formaPgto || 'PIX';
        const dataBr = opts.dataBr || new Date().toLocaleDateString('pt-BR');
        const obs = String(opts.obs || '').trim();
        const saldoAtual = saldoDevedorConta(conta);
        const juros = Math.max(0, Math.round((valorRecebido - saldoAtual) * 100) / 100);
        const abate = Math.min(valorRecebido, saldoAtual);
        const saldoRestante = Math.max(0, Math.round((saldoAtual - abate) * 100) / 100);
        const quitou = saldoRestante <= 0.009;
        const novoStatus = quitou ? 'PAGO' : 'PARCIAL';
        const agora = Date.now();
        const dataStr = dataBr + ' ' + new Date(agora).toLocaleTimeString('pt-BR');
        const historico = listaRecebimentosParciaisConta(conta).slice();
        historico.push({
            id: 'rec_' + agora,
            valor: valorRecebido,
            valor_abatido: abate,
            valor_juros: juros,
            formaPagamento: formaPgto,
            forma_pagamento: formaPgto,
            dataStr: dataStr,
            data: dataBr,
            observacao: obs || (quitou && juros > 0.009 ? 'Quitação com juros' : (quitou ? 'Quitação do saldo restante' : 'Recebimento parcial')),
            timestamp: agora
        });
        const valorRecebidoParcial = Math.round((valorRecebidoConta(conta) + valorRecebido) * 100) / 100;

        await updateDoc(doc(db, COLECAO_CONTAS_RECEBER, id), {
            statusPagamento: novoStatus,
            status: novoStatus,
            saldoDevedor: quitou ? 0 : saldoRestante,
            saldo_devedor: quitou ? 0 : saldoRestante,
            formaPagamento: formaPgto,
            forma_pagamento: formaPgto,
            recebimentosParciais: historico,
            recebimentos_parciais: historico,
            valorRecebidoParcial: valorRecebidoParcial,
            valor_recebido_parcial: valorRecebidoParcial,
            dataRecebimentoStr: dataStr,
            data_pagamento: dataStr,
            timestampRecebimento: agora,
            timestamp_pagamento: agora
        });

        return { quitou: quitou, saldoRestante: quitou ? 0 : saldoRestante, juros: juros, abate: abate };
    }

    // 3. RECEBIMENTO PARCIAL
    window.lancarRecebimentoParcialConta = async function (id) {
        if (!id) return;
        let conta = null;
        try { conta = await buscarContaReceberPorId(id); } catch (e) { console.error(e); }
        if (!conta) return Swal.fire('Atenção', 'Conta não encontrada.', 'warning');

        const total = totalContaReceber(conta);
        const jaRec = valorRecebidoConta(conta);
        const saldoAtual = saldoDevedorConta(conta);
        if (saldoAtual <= 0.009) {
            return Swal.fire('Já quitada', 'Esta conta não tem saldo em aberto.', 'info');
        }

        const hojeIso = dataIsoHojeContaReceber();
        const conf = await Swal.fire({
            title: 'Recebimento parcial',
            html: '<div style="text-align:left;font-size:13px;">'
                + '<p style="margin:0 0 10px 0;background:#f0f9ff;border:1px solid #bee5eb;border-radius:8px;padding:10px;">'
                + 'Cliente: <b>' + escapeHtmlBasico(nomeClienteConta(conta)) + '</b><br>'
                + 'Original: <b>' + formatarMoedaEntrada(total) + '</b><br>'
                + 'Já recebido: <b style="color:#28a745;">' + formatarMoedaEntrada(jaRec) + '</b><br>'
                + 'Saldo em aberto: <b style="color:#c0392b;">' + formatarMoedaEntrada(saldoAtual) + '</b>'
                + '</p>'
                + '<label style="display:block;font-size:12px;margin-bottom:4px;">Valor deste recebimento (R$)</label>'
                + '<input id="cr-valor-receber" class="swal2-input" style="width:100%;margin:0 0 10px 0;" placeholder="0,00" value="">'
                + '<label style="display:block;font-size:12px;margin-bottom:4px;">Data do recebimento</label>'
                + '<input type="date" id="cr-data-receber" class="swal2-input" style="width:100%;margin:0 0 10px 0;" value="' + hojeIso + '">'
                + '<label style="display:block;font-size:12px;margin-bottom:4px;">Forma de pagamento</label>'
                + htmlSelectFormaPagtoConta('cr-forma-pagto')
                + '<label style="display:block;font-size:12px;margin:10px 0 4px 0;">Observação (opcional)</label>'
                + '<input id="cr-obs-receber" class="swal2-input" style="width:100%;margin:0;" placeholder="Ex.: entrada / parcial">'
                + '<p style="font-size:12px;color:#666;margin:8px 0 0 0;">Informe um valor <b>menor que o saldo</b> para receber só uma parte. Se cobrir o saldo (ou mais, com juros), a conta fica <b>quitada</b>.</p>'
                + '</div>',
            showCancelButton: true,
            confirmButtonText: 'Lançar parcial',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#17a2b8',
            didOpen: function () {
                const inp = document.getElementById('cr-valor-receber');
                if (inp && typeof mascaraMoeda === 'function') {
                    inp.addEventListener('input', function () { mascaraMoeda(inp); });
                    inp.focus();
                }
            },
            preConfirm: function () {
                const valorRecebido = parseMoedaLocal((document.getElementById('cr-valor-receber') && document.getElementById('cr-valor-receber').value) || '0');
                if (!(valorRecebido > 0)) {
                    Swal.showValidationMessage('Informe o valor do recebimento parcial.');
                    return false;
                }
                const sel = document.getElementById('cr-forma-pagto');
                const dataIso = (document.getElementById('cr-data-receber') && document.getElementById('cr-data-receber').value) || hojeIso;
                const obs = (document.getElementById('cr-obs-receber') && document.getElementById('cr-obs-receber').value) || '';
                return {
                    valorRecebido: valorRecebido,
                    formaPgto: (sel && sel.value) || 'PIX',
                    dataBr: dataBrDeIsoContaReceber(dataIso),
                    obs: String(obs).trim()
                };
            }
        });
        if (!conf.isConfirmed || !conf.value) return;

        try {
            const res = await gravarRecebimentoConta(id, conta, conf.value);
            Swal.fire(
                res.quitou ? 'Quitada!' : 'Parcial lançado!',
                (res.quitou
                    ? 'O saldo foi coberto. Conta movida para Recebimentos.'
                    : 'Recebido ' + formatarMoedaEntrada(res.abate) + '. Novo saldo: ' + formatarMoedaEntrada(res.saldoRestante) + '.')
                + (res.juros > 0.009 ? ' Juros/acréscimo: ' + formatarMoedaEntrada(res.juros) + '.' : ''),
                'success'
            );
            renderContasReceber();
            if (typeof renderRecebimentos === 'function') renderRecebimentos();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Falha ao lançar recebimento parcial: ' + (e.message || ''), 'error');
        }
    };

    // 3b. RECEBER TOTAL (quita o saldo restante)
    window.receberContaCaixa = async function (id) {
        if (!id) return;
        let conta = null;
        try { conta = await buscarContaReceberPorId(id); } catch (e) { console.error(e); }
        if (!conta) return Swal.fire('Atenção', 'Conta não encontrada.', 'warning');

        const total = totalContaReceber(conta);
        const jaRec = valorRecebidoConta(conta);
        const saldoAtual = saldoDevedorConta(conta);
        if (saldoAtual <= 0.009) {
            return Swal.fire('Já quitada', 'Esta conta não tem saldo em aberto.', 'info');
        }

        const hojeIso = dataIsoHojeContaReceber();
        const conf = await Swal.fire({
            title: 'Receber total',
            html: '<div style="text-align:left;font-size:13px;">'
                + '<p style="margin:0 0 10px 0;background:#f4fdf6;border:1px solid #c3e6cb;border-radius:8px;padding:10px;">'
                + 'Cliente: <b>' + escapeHtmlBasico(nomeClienteConta(conta)) + '</b><br>'
                + 'Original: <b>' + formatarMoedaEntrada(total) + '</b><br>'
                + (jaRec > 0.009 ? 'Já recebido: <b style="color:#28a745;">' + formatarMoedaEntrada(jaRec) + '</b><br>' : '')
                + 'Saldo a quitar: <b style="color:#c0392b;">' + formatarMoedaEntrada(saldoAtual) + '</b>'
                + '</p>'
                + '<label style="display:block;font-size:12px;margin-bottom:4px;">Valor recebido (R$)</label>'
                + '<input id="cr-valor-receber" class="swal2-input" style="width:100%;margin:0 0 10px 0;" value="' + String(saldoAtual.toFixed(2)).replace('.', ',') + '">'
                + '<label style="display:block;font-size:12px;margin-bottom:4px;">Data do recebimento</label>'
                + '<input type="date" id="cr-data-receber" class="swal2-input" style="width:100%;margin:0 0 10px 0;" value="' + hojeIso + '">'
                + '<label style="display:block;font-size:12px;margin-bottom:4px;">Forma de pagamento</label>'
                + htmlSelectFormaPagtoConta('cr-forma-pagto')
                + '<p style="font-size:12px;color:#666;margin:8px 0 0 0;">O valor padrão é o saldo. Se receber <b>a mais</b> (juros), a conta também fica quitada.</p>'
                + '</div>',
            showCancelButton: true,
            confirmButtonText: 'Quitar saldo',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#27ae60',
            didOpen: function () {
                const inp = document.getElementById('cr-valor-receber');
                if (inp && typeof mascaraMoeda === 'function') {
                    inp.addEventListener('input', function () { mascaraMoeda(inp); });
                }
            },
            preConfirm: function () {
                const valorRecebido = parseMoedaLocal((document.getElementById('cr-valor-receber') && document.getElementById('cr-valor-receber').value) || '0');
                if (!(valorRecebido > 0)) {
                    Swal.showValidationMessage('Informe um valor maior que zero.');
                    return false;
                }
                const sel = document.getElementById('cr-forma-pagto');
                const dataIso = (document.getElementById('cr-data-receber') && document.getElementById('cr-data-receber').value) || hojeIso;
                return {
                    valorRecebido: valorRecebido,
                    formaPgto: (sel && sel.value) || 'PIX',
                    dataBr: dataBrDeIsoContaReceber(dataIso),
                    obs: valorRecebido + 0.009 < saldoAtual ? 'Recebimento parcial' : 'Quitação do saldo restante'
                };
            }
        });
        if (!conf.isConfirmed || !conf.value) return;

        try {
            const res = await gravarRecebimentoConta(id, conta, conf.value);
            Swal.fire(
                res.quitou ? 'Sucesso!' : 'Parcial lançado!',
                (res.quitou
                    ? 'Conta quitada e movida para Recebimentos.'
                    : 'Recebimento parcial registrado. Saldo restante: ' + formatarMoedaEntrada(res.saldoRestante) + '.')
                + (res.juros > 0.009 ? ' Juros/acréscimo: ' + formatarMoedaEntrada(res.juros) + '.' : ''),
                'success'
            );
            renderContasReceber();
            if (typeof renderRecebimentos === 'function') renderRecebimentos();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Falha ao processar recebimento: ' + (e.message || ''), 'error');
        }
    };
    window.receberContaEntrada = window.receberContaCaixa;

    // 4. RENDERIZAR RECEBIMENTOS (PAGO ou com parcial)
    window.renderRecebimentos = async function () {
        const tbody = document.getElementById('tabelaRecebimentos');
        const elTotal = document.getElementById('ent-total-recebido');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">Carregando...</td></tr>';
        try {
            const busca = ((document.getElementById('ent-busca-recebidos') && document.getElementById('ent-busca-recebidos').value) || '').trim().toLowerCase();
            const recebidos = (await carregarContasReceberEmpresa()).filter(function (v) {
                const rec = valorRecebidoConta(v);
                return rec > 0.009;
            }).filter(function (c) {
                if (!busca) return true;
                const txt = [nomeClienteConta(c), docContaReceber(c), descContaReceber(c), c.formaPagamento || c.forma_pagamento].join(' ').toLowerCase();
                return txt.indexOf(busca) !== -1;
            }).sort(function (a, b) {
                return (Number(b.timestampRecebimento || b.timestamp_pagamento) || 0) - (Number(a.timestampRecebimento || a.timestamp_pagamento) || 0);
            });

            let soma = 0;
            if (!recebidos.length) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">Nenhum recebimento efetuado.</td></tr>';
            } else {
                let html = '';
                recebidos.forEach(function (c) {
                    const valorRec = valorRecebidoConta(c);
                    const saldo = saldoDevedorConta(c);
                    const emAberto = contaReceberEmAberto(c);
                    soma += valorRec;
                    const formaStr = c.formaPagamento || c.forma_pagamento || '—';
                    const dataRecRaw = c.dataRecebimentoStr || c.data_pagamento || '';
                    const dataRec = dataRecRaw ? String(dataRecRaw).split(/\s+/)[0].replace(',', '') : '—';
                    const badge = emAberto
                        ? '<div style="margin-top:4px;"><span style="font-size:10px;background:#17a2b8;color:#fff;padding:2px 6px;border-radius:4px;font-weight:800;">PARCIAL</span> <span style="font-size:11px;color:#c0392b;">Saldo: ' + formatarMoedaEntrada(saldo) + '</span></div>'
                        : '<div style="margin-top:4px;"><span style="font-size:10px;background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;font-weight:800;">QUITADO</span></div>';
                    html += '<tr>'
                        + '<td style="font-weight:bold;color:#2980b9;">' + escapeHtmlBasico(dataRec) + htmlHistRecebimentosParciaisConta(c) + '</td>'
                        + '<td><b>' + escapeHtmlBasico(nomeClienteConta(c)) + '</b>' + badge + '</td>'
                        + '<td>' + escapeHtmlBasico(formaStr) + '</td>'
                        + '<td style="font-weight:bold;color:#27ae60;white-space:nowrap;">' + formatarMoedaEntrada(valorRec) + '</td>'
                        + '<td class="celula-acoes"><button type="button" class="btn-acao" style="background:#e74c3c;color:#fff;border:none;padding:6px 10px;border-radius:6px;font-weight:700;cursor:pointer;" onclick="estornarPagamento(\'' + escapeAttrBasico(c.id) + '\')" title="Desfazer">🔄 Estornar</button></td>'
                        + '</tr>';
                });
                tbody.innerHTML = html;
            }
            if (elTotal) elTotal.textContent = formatarMoedaEntrada(soma);
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#d9534f;">Erro ao carregar recebimentos.</td></tr>';
        }
    };

    function chaveMesAnoContaReceberDeIsoOuBr(dataStr) {
        const s = String(dataStr || '').trim();
        if (!s) return '';
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
            const [y, m] = s.slice(0, 10).split('-');
            return m + '/' + y;
        }
        const sep = separarDataSegura(s);
        if (!sep || !sep.ano || sep.ano === 'Outros' || !sep.mes || sep.mes === 'Outros') return '';
        return String(sep.mes).padStart(2, '0') + '/' + String(sep.ano);
    }

    function tsDataBrContasReceber(dataStr) {
        const s = String(dataStr || '').trim();
        if (!s) return 0;
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
            const [y, m, d] = s.slice(0, 10).split('-').map(Number);
            return new Date(y, m - 1, d).getTime();
        }
        const sep = separarDataSegura(s);
        if (!sep || !sep.ano || sep.ano === 'Outros') return 0;
        const mes = parseInt(sep.mes, 10);
        const dia = parseInt(sep.dia, 10) || 1;
        const ano = parseInt(sep.ano, 10);
        if (!mes || !ano) return 0;
        return new Date(ano, mes - 1, dia).getTime();
    }

    function montarPackExportContasReceber(lista) {
        const pendentes = [];
        const recebidos = [];
        (lista || []).forEach(function (c) {
            const st = statusContaReceberNorm(c);
            const saldo = saldoDevedorConta(c);
            const rec = valorRecebidoConta(c);
            if ((st === 'PENDENTE' || st === 'PARCIAL' || contaReceberEmAberto(c)) && saldo > 0.009) {
                pendentes.push(c);
            }
            if (st === 'PAGO' || st === 'PAGA' || rec > 0.009) {
                recebidos.push(c);
            }
        });
        return { pendentes: pendentes, recebidos: recebidos, todos: lista || [] };
    }

    function expandirLinhasRecebidosContasReceber(lista) {
        const linhas = [];
        (lista || []).forEach(function (c) {
            const hist = listaRecebimentosParciaisConta(c);
            if (hist.length) {
                hist.forEach(function (h, idx) {
                    const dataStr = h.dataStr || h.data || c.dataRecebimentoStr || c.data_pagamento || '';
                    linhas.push({
                        conta: c,
                        dataRecebimento: dataStr ? String(dataStr).split(/\s+/)[0].replace(',', '') : '—',
                        formaPagamento: h.formaPagamento || h.forma_pagamento || c.formaPagamento || c.forma_pagamento || '—',
                        valor: Number(h.valor) || 0,
                        chaveMes: chaveMesAnoContaReceberDeIsoOuBr(dataStr),
                        ts: Number(h.timestamp) || tsDataBrContasReceber(dataStr),
                        idx: idx
                    });
                });
            } else {
                const dataStr = c.dataRecebimentoStr || c.data_pagamento || c.data_cadastro || '';
                const valorRec = valorRecebidoConta(c);
                linhas.push({
                    conta: c,
                    dataRecebimento: dataStr ? String(dataStr).split(/\s+/)[0].replace(',', '') : '—',
                    formaPagamento: c.formaPagamento || c.forma_pagamento || '—',
                    valor: valorRec,
                    chaveMes: chaveMesAnoContaReceberDeIsoOuBr(dataStr),
                    ts: Number(c.timestampRecebimento || c.timestamp_pagamento) || tsDataBrContasReceber(dataStr),
                    idx: 0
                });
            }
        });
        linhas.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
        return linhas;
    }

    function mesAnoParaIndiceContasReceber(mesAno) {
        const p = String(mesAno || '').trim().split('/');
        if (p.length !== 2) return -1;
        const mes = parseInt(p[0], 10);
        const ano = parseInt(p[1], 10);
        if (!mes || !ano) return -1;
        return ano * 12 + mes;
    }

    function filtrarPackContasReceberPorPeriodo(pack, opcoes) {
        if (!pack) return { pendentes: [], recebidos: [], linhasRecebidos: [] };
        const modo = (opcoes && opcoes.modoPeriodo) || 'todos';
        const mesUnico = (opcoes && opcoes.mesAno) || '';
        const ini = (opcoes && opcoes.periodoInicio) || '';
        const fim = (opcoes && opcoes.periodoFim) || '';

        function passaMesAno(chave) {
            if (!chave) return modo === 'todos';
            if (modo === 'todos') return true;
            if (modo === 'mes') return chave === mesUnico;
            if (modo === 'intervalo') {
                const idx = mesAnoParaIndiceContasReceber(chave);
                const i0 = mesAnoParaIndiceContasReceber(ini);
                const i1 = mesAnoParaIndiceContasReceber(fim);
                if (idx < 0 || i0 < 0 || i1 < 0) return false;
                const a = Math.min(i0, i1);
                const b = Math.max(i0, i1);
                return idx >= a && idx <= b;
            }
            return true;
        }

        const pendentes = (pack.pendentes || []).filter(function (c) {
            const chave = chaveMesAnoContaReceberDeIsoOuBr(c.vencimento || c.data_vencimento);
            return passaMesAno(chave);
        }).sort(function (a, b) {
            return tsDataBrContasReceber(a.vencimento || a.data_vencimento) - tsDataBrContasReceber(b.vencimento || b.data_vencimento);
        });

        const linhasRecebidos = expandirLinhasRecebidosContasReceber(pack.recebidos).filter(function (ln) {
            return passaMesAno(ln.chaveMes);
        });

        const idsRecebidos = {};
        linhasRecebidos.forEach(function (ln) { idsRecebidos[ln.conta.id] = true; });
        const recebidos = (pack.recebidos || []).filter(function (c) { return !!idsRecebidos[c.id]; });

        return { pendentes: pendentes, recebidos: recebidos, linhasRecebidos: linhasRecebidos };
    }

    async function carregarPackContasReceberExport() {
        const lista = await carregarContasReceberEmpresa();
        const pack = montarPackExportContasReceber(lista);
        window._contasReceberExport = pack;
        return pack;
    }

    async function perguntarOpcoesExportContasReceber(pack) {
        const meses = [];
        const setMes = {};
        (pack.pendentes || []).forEach(function (c) {
            const k = chaveMesAnoContaReceberDeIsoOuBr(c.vencimento || c.data_vencimento);
            if (k && !setMes[k]) { setMes[k] = true; meses.push(k); }
        });
        expandirLinhasRecebidosContasReceber(pack.recebidos).forEach(function (ln) {
            if (ln.chaveMes && !setMes[ln.chaveMes]) { setMes[ln.chaveMes] = true; meses.push(ln.chaveMes); }
        });
        meses.sort(function (a, b) {
            return mesAnoParaIndiceContasReceber(a) - mesAnoParaIndiceContasReceber(b);
        });
        const mesAtual = (function () {
            const d = new Date();
            return String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
        })();
        const optsMes = meses.length
            ? meses.map(function (m) { return '<option value="' + escapeAttrBasico(m) + '">' + escapeHtmlBasico(m) + '</option>'; }).join('')
            : '<option value="' + escapeAttrBasico(mesAtual) + '">' + escapeHtmlBasico(mesAtual) + '</option>';

        const html = ''
            + '<p style="text-align:left;font-size:13px;margin:0 0 10px 0;">Escolha o que incluir e o <b>período</b> (vencimento para pendentes; data de recebimento para recebidos).</p>'
            + '<div style="text-align:left;margin-bottom:12px;">'
            + '<label style="display:flex;align-items:center;gap:8px;margin:6px 0;cursor:pointer;"><input type="checkbox" id="exp-cr-pendente" checked> 🟡 A receber (pendentes)</label>'
            + '<label style="display:flex;align-items:center;gap:8px;margin:6px 0;cursor:pointer;"><input type="checkbox" id="exp-cr-recebido" checked> 🟢 Recebidos</label>'
            + '</div>'
            + '<p style="text-align:left;font-size:12px;font-weight:bold;margin:0 0 6px 0;">Período:</p>'
            + '<table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;margin-bottom:8px;" class="exp-cr-periodo-tbl">'
            + '<tr><td style="padding:4px 8px 4px 0;vertical-align:middle;width:1%;white-space:nowrap;"><label style="display:inline-flex;align-items:center;gap:6px;margin:0;cursor:pointer;font-weight:normal;"><input type="radio" name="exp-cr-periodo" value="todos" checked style="margin:0;flex-shrink:0;"> Todos os meses</label></td></tr>'
            + '<tr><td style="padding:4px 8px 4px 0;vertical-align:middle;"><label style="display:inline-flex;align-items:center;gap:6px;margin:0;cursor:pointer;font-weight:normal;"><input type="radio" name="exp-cr-periodo" value="mes" style="margin:0;flex-shrink:0;"> Apenas um mês:</label> <select id="exp-cr-mes-unico" style="margin-left:4px;padding:4px 8px;border-radius:6px;border:1px solid #ccc;max-width:120px;">' + optsMes + '</select></td></tr>'
            + '<tr><td style="padding:4px 8px 4px 0;vertical-align:middle;"><label style="display:inline-flex;align-items:center;gap:6px;margin:0;cursor:pointer;font-weight:normal;"><input type="radio" name="exp-cr-periodo" value="intervalo" style="margin:0;flex-shrink:0;"> De</label> <select id="exp-cr-mes-ini" style="margin:0 4px;padding:4px 8px;border-radius:6px;border:1px solid #ccc;max-width:120px;">' + optsMes + '</select> <span>até</span> <select id="exp-cr-mes-fim" style="margin-left:4px;padding:4px 8px;border-radius:6px;border:1px solid #ccc;max-width:120px;">' + optsMes + '</select></td></tr>'
            + '</table>';

        const result = await Swal.fire({
            title: 'Exportar Contas a Receber',
            html: html,
            width: Math.min(window.innerWidth - 24, 460),
            showCancelButton: true,
            confirmButtonText: 'Exportar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1a2a43',
            focusConfirm: false,
            didOpen: function () {
                const popup = Swal.getPopup();
                if (!popup) return;
                popup.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(function (el) {
                    el.style.width = 'auto';
                    el.style.height = 'auto';
                    el.style.margin = '0';
                    el.style.flexShrink = '0';
                });
            },
            preConfirm: function () {
                const incPend = !!document.getElementById('exp-cr-pendente') && document.getElementById('exp-cr-pendente').checked;
                const incRec = !!document.getElementById('exp-cr-recebido') && document.getElementById('exp-cr-recebido').checked;
                if (!incPend && !incRec) {
                    Swal.showValidationMessage('Marque ao menos uma seção.');
                    return false;
                }
                const radio = document.querySelector('input[name="exp-cr-periodo"]:checked');
                const modo = (radio && radio.value) || 'todos';
                const mesAno = (document.getElementById('exp-cr-mes-unico') && document.getElementById('exp-cr-mes-unico').value) || mesAtual;
                const periodoInicio = (document.getElementById('exp-cr-mes-ini') && document.getElementById('exp-cr-mes-ini').value) || mesAtual;
                const periodoFim = (document.getElementById('exp-cr-mes-fim') && document.getElementById('exp-cr-mes-fim').value) || mesAtual;
                return {
                    incluirPendentes: incPend,
                    incluirRecebidos: incRec,
                    modoPeriodo: modo,
                    mesAno: mesAno,
                    periodoInicio: periodoInicio,
                    periodoFim: periodoFim
                };
            }
        });
        return result.isConfirmed ? result.value : null;
    }

    function labelPeriodoExportContasReceber(op) {
        if (!op || op.modoPeriodo === 'todos') return 'Todos os meses';
        if (op.modoPeriodo === 'mes') return 'Mês ' + (op.mesAno || '');
        const a = op.periodoInicio || '';
        const b = op.periodoFim || '';
        const i0 = mesAnoParaIndiceContasReceber(a);
        const i1 = mesAnoParaIndiceContasReceber(b);
        if (i0 >= 0 && i1 >= 0 && i0 > i1) return 'De ' + b + ' até ' + a;
        return 'De ' + a + ' até ' + b;
    }

    function gerarExcelContasReceberEspelho(packFiltrado, opcoes) {
        const linhas = [];
        let totalPend = 0;
        let totalRec = 0;

        if (opcoes.incluirPendentes && packFiltrado.pendentes.length) {
            linhas.push({ 'Seção': '—— A RECEBER (PENDENTES) ——', 'Vencimento / Data': '', 'Cliente': '', 'Documento': '', 'Descrição': '', 'Forma Pagto': '', 'Valor (R$)': '' });
            packFiltrado.pendentes.forEach(function (c) {
                const saldo = saldoDevedorConta(c);
                totalPend += saldo;
                linhas.push({
                    'Seção': 'A RECEBER',
                    'Vencimento / Data': formatarDataBrEntrada(c.vencimento || c.data_vencimento),
                    'Cliente': nomeClienteConta(c),
                    'Documento': docContaReceber(c) || '—',
                    'Descrição': descContaReceber(c) || '—',
                    'Forma Pagto': '',
                    'Valor (R$)': saldo
                });
            });
            linhas.push({ 'Seção': '', 'Vencimento / Data': '', 'Cliente': 'Subtotal pendentes', 'Documento': '', 'Descrição': '', 'Forma Pagto': '', 'Valor (R$)': totalPend });
            linhas.push({});
        }

        if (opcoes.incluirRecebidos && packFiltrado.linhasRecebidos.length) {
            linhas.push({ 'Seção': '—— RECEBIDOS ——', 'Vencimento / Data': '', 'Cliente': '', 'Documento': '', 'Descrição': '', 'Forma Pagto': '', 'Valor (R$)': '' });
            packFiltrado.linhasRecebidos.forEach(function (ln) {
                const c = ln.conta;
                totalRec += ln.valor || 0;
                linhas.push({
                    'Seção': 'RECEBIDO',
                    'Vencimento / Data': ln.dataRecebimento,
                    'Cliente': nomeClienteConta(c),
                    'Documento': docContaReceber(c) || '—',
                    'Descrição': descContaReceber(c) || '—',
                    'Forma Pagto': ln.formaPagamento,
                    'Valor (R$)': ln.valor
                });
            });
            linhas.push({ 'Seção': '', 'Vencimento / Data': '', 'Cliente': 'Subtotal recebidos', 'Documento': '', 'Descrição': '', 'Forma Pagto': '', 'Valor (R$)': totalRec });
        }

        return { linhas: linhas, totalPend: totalPend, totalRec: totalRec };
    }

    function gerarPdfContasReceberEspelho(packFiltrado, opcoes, labelPeriodo) {
        function limparPdf(s) {
            return String(s == null ? '' : s).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4');
        const empresa = limparPdf(getEmpresaGestor() || 'Empresa');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(empresa, 14, 12);
        doc.setFontSize(10);
        doc.text('Contas a Receber', 14, 18);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('Periodo: ' + limparPdf(labelPeriodo) + '  |  Gerado: ' + new Date().toLocaleString('pt-BR'), 14, 23);

        const head = [['Secao', 'Venc./Receb.', 'Cliente', 'Documento', 'Descricao', 'Forma', 'Valor R$']];
        const body = [];
        let totalPend = 0;
        let totalRec = 0;
        let startY = 28;

        if (opcoes.incluirPendentes && packFiltrado.pendentes.length) {
            body.push(['A RECEBER (PENDENTES)', '', '', '', '', '', '']);
            packFiltrado.pendentes.forEach(function (c) {
                const saldo = saldoDevedorConta(c);
                totalPend += saldo;
                body.push([
                    'Pendente',
                    limparPdf(formatarDataBrEntrada(c.vencimento || c.data_vencimento)),
                    limparPdf(nomeClienteConta(c)).slice(0, 28),
                    limparPdf(docContaReceber(c) || '—').slice(0, 14),
                    limparPdf(descContaReceber(c) || '—').slice(0, 22),
                    '',
                    limparPdf(formatarMoedaEntrada(saldo))
                ]);
            });
            body.push(['', '', 'Subtotal pendentes', '', '', '', limparPdf(formatarMoedaEntrada(totalPend))]);
        }

        if (opcoes.incluirRecebidos && packFiltrado.linhasRecebidos.length) {
            body.push(['RECEBIDOS', '', '', '', '', '', '']);
            packFiltrado.linhasRecebidos.forEach(function (ln) {
                const c = ln.conta;
                totalRec += ln.valor || 0;
                body.push([
                    'Recebido',
                    limparPdf(ln.dataRecebimento),
                    limparPdf(nomeClienteConta(c)).slice(0, 28),
                    limparPdf(docContaReceber(c) || '—').slice(0, 14),
                    limparPdf(descContaReceber(c) || '—').slice(0, 22),
                    limparPdf(ln.formaPagamento).slice(0, 12),
                    limparPdf(formatarMoedaEntrada(ln.valor))
                ]);
            });
            body.push(['', '', 'Subtotal recebidos', '', '', '', limparPdf(formatarMoedaEntrada(totalRec))]);
        }

        if (!body.length) return null;

        doc.autoTable({
            startY: startY,
            head: head,
            body: body,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1.8, valign: 'middle' },
            headStyles: { fillColor: [230, 126, 34], textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: { 6: { halign: 'right', cellWidth: 24 } },
            margin: { left: 10, right: 10 }
        });

        const yFinal = doc.lastAutoTable.finalY + 6;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        if (opcoes.incluirPendentes) doc.text('Total a receber: ' + formatarMoedaEntrada(totalPend), 14, yFinal);
        if (opcoes.incluirRecebidos) doc.text('Total recebido: ' + formatarMoedaEntrada(totalRec), 14, yFinal + (opcoes.incluirPendentes ? 5 : 0));

        return doc;
    }

    window.exportarExcelContasReceber = async function () {
        if (!window.XLSX) return Swal.fire('Erro', 'Biblioteca Excel não carregada. Recarregue a página.', 'error');
        Swal.fire({ title: 'Carregando...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
        try {
            const pack = await carregarPackContasReceberExport();
            Swal.close();
            const opcoes = await perguntarOpcoesExportContasReceber(pack);
            if (!opcoes) return;
            const filtrado = filtrarPackContasReceberPorPeriodo(pack, opcoes);
            const temPend = opcoes.incluirPendentes && filtrado.pendentes.length;
            const temRec = opcoes.incluirRecebidos && filtrado.linhasRecebidos.length;
            if (!temPend && !temRec) {
                return Swal.fire('Atenção', 'Nenhum registro no período selecionado.', 'info');
            }
            const espelho = gerarExcelContasReceberEspelho(filtrado, opcoes);
            const ws = XLSX.utils.json_to_sheet(espelho.linhas);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Contas a Receber');
            const empresa = String(getEmpresaGestor() || 'Empresa').replace(/\s+/g, '_');
            const sufixo = labelPeriodoExportContasReceber(opcoes).replace(/\s+/g, '_').replace(/\//g, '-');
            XLSX.writeFile(wb, 'contas_a_receber_' + empresa + '_' + sufixo + '.xlsx');
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Excel gerado!', showConfirmButton: false, timer: 2200 });
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Falha ao exportar Excel.', 'error');
        }
    };

    window.exportarPDFContasReceber = async function () {
        Swal.fire({ title: 'Carregando...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
        try {
            const pack = await carregarPackContasReceberExport();
            Swal.close();
            const opcoes = await perguntarOpcoesExportContasReceber(pack);
            if (!opcoes) return;
            const filtrado = filtrarPackContasReceberPorPeriodo(pack, opcoes);
            const temPend = opcoes.incluirPendentes && filtrado.pendentes.length;
            const temRec = opcoes.incluirRecebidos && filtrado.linhasRecebidos.length;
            if (!temPend && !temRec) {
                return Swal.fire('Atenção', 'Nenhum registro no período selecionado.', 'info');
            }
            const labelPeriodo = labelPeriodoExportContasReceber(opcoes);
            const doc = gerarPdfContasReceberEspelho(filtrado, opcoes, labelPeriodo);
            if (!doc) return Swal.fire('Atenção', 'Nenhum dado para exportar.', 'info');
            const empresa = String(getEmpresaGestor() || 'Empresa').replace(/\s+/g, '_');
            const sufixo = labelPeriodo.replace(/\s+/g, '_').replace(/\//g, '-');
            doc.save('contas_a_receber_' + empresa + '_' + sufixo + '.pdf');
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'PDF gerado!', showConfirmButton: false, timer: 2200 });
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Falha ao exportar PDF.', 'error');
        }
    };

    window.estornarPagamento = async function (id) {
        if (!id) return;
        let conta = null;
        try {
            const lista = await carregarContasReceberEmpresa();
            conta = lista.find(function (x) { return String(x.id) === String(id); });
        } catch (e) {
            console.error(e);
        }
        if (!conta) return Swal.fire('Atenção', 'Conta não encontrada.', 'warning');

        const conf = await Swal.fire({
            title: 'Estornar recebimento?',
            html: 'Os recebimentos de <b>' + escapeHtmlBasico(nomeClienteConta(conta)) + '</b> serão desfeitos. A conta volta para Contas a Receber com o valor integral.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, estornar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#c0392b'
        });
        if (!conf.isConfirmed) return;

        const total = totalContaReceber(conta);
        try {
            await updateDoc(doc(db, COLECAO_CONTAS_RECEBER, id), {
                statusPagamento: 'PENDENTE',
                status: 'PENDENTE',
                saldoDevedor: total,
                saldo_devedor: total,
                formaPagamento: null,
                forma_pagamento: null,
                recebimentosParciais: [],
                recebimentos_parciais: [],
                valorRecebidoParcial: 0,
                valor_recebido_parcial: 0,
                dataRecebimentoStr: null,
                data_pagamento: null,
                timestampRecebimento: null,
                timestamp_pagamento: null
            });
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Recebimento estornado', showConfirmButton: false, timer: 2000 });
            renderRecebimentos();
            if (typeof renderContasReceber === 'function') renderContasReceber();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível estornar.', 'error');
        }
    };
    window.estornarContaEntrada = window.estornarPagamento;

    window.excluirContaEntrada = async function (id) {
        if (!id) return;
        const conf = await Swal.fire({
            title: 'Excluir conta?',
            text: 'Esta ação não pode ser desfeita.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Excluir',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#c0392b'
        });
        if (!conf.isConfirmed) return;
        try {
            await deleteDoc(doc(db, COLECAO_CONTAS_RECEBER, id));
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Conta excluída', showConfirmButton: false, timer: 2000 });
            renderContasReceber();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível excluir.', 'error');
        }
    };
