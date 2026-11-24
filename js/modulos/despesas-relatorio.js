/* js/modulos/despesas-relatorio.js — edite este arquivo para alterar só este módulo */
    window.salvarDespesaLinhaRelatorio = async function () {
        const empresaLogada = getEmpresaGestor();
        if (!window._cacheNomesRelDespesas && !window._cacheNomesDespesas) {
            if (typeof window.carregarNomesRelatorioDespesas === 'function') {
                await window.carregarNomesRelatorioDespesas();
            }
        }
        const obra = resolverNomeCanonicoDespesa(document.getElementById('rd-obra').value, 'obra');
        const loja = resolverNomeCanonicoDespesa(document.getElementById('rd-loja').value, 'loja');
        const nf = document.getElementById('rd-nf') ? document.getElementById('rd-nf').value.trim() : '';
        const chequeBoleto = document.getElementById('rd-cheque-boleto') ? document.getElementById('rd-cheque-boleto').value.trim() : '';
        const vencimento = document.getElementById('rd-vencimento') ? document.getElementById('rd-vencimento').value : '';
        const valor = document.getElementById('rd-valor').value;
        const desc = document.getElementById('rd-desc').value;
        const observacao = document.getElementById('rd-observacao') ? document.getElementById('rd-observacao').value.trim() : '';
        const fotoBase64 = document.getElementById('rd-anexo-base64') ? document.getElementById('rd-anexo-base64').value : '';
        const elLan = document.getElementById('rd-lancamento');
        const dataObj = new Date();
        const hojeIso = `${dataObj.getFullYear()}-${String(dataObj.getMonth() + 1).padStart(2, '0')}-${String(dataObj.getDate()).padStart(2, '0')}`;
        const dataLancIso = (elLan && elLan.value) ? elLan.value : hojeIso;
        const dataAtual = inputDateIsoParaDataBr(dataLancIso);

        if (!obra || !loja || !valor) return Swal.fire('Atenção', 'Preencha Obra, Nome (fornecedor) e Valor.', 'warning');

        try {
            await addDoc(collection(db, COLECAO_RELATORIO_DESPESAS), {
                empresa_id: empresaLogada,
                obra_nome: obra,
                obra_lower: normalizarChaveNomeDespesa(obra),
                loja_nome: loja,
                loja_lower: normalizarChaveNomeDespesa(loja),
                nota_fiscal: nf,
                data_vencimento: vencimento,
                data_vencimento_ts: parseDataVencimentoParaTimestamp(vencimento),
                valor_string: valor,
                valor_numero: parseMoedaLocal(valor),
                descricao: desc,
                foto_recibo: fotoBase64,
                data: dataAtual,
                timestamp: timestampMeioDiaDataIso(dataLancIso),
                data_lancamento: dataLancIso,
                cheque_boleto_num: chequeBoleto || null,
                observacao: observacao || null,
                status: 'pendente'
            });
            Swal.fire('Sucesso!', 'Linha guardada no relatório.', 'success');
            document.getElementById('rd-obra').value = '';
            document.getElementById('rd-loja').value = '';
            if (document.getElementById('rd-nf')) document.getElementById('rd-nf').value = '';
            if (document.getElementById('rd-cheque-boleto')) document.getElementById('rd-cheque-boleto').value = '';
            if (document.getElementById('rd-vencimento')) document.getElementById('rd-vencimento').value = '';
            document.getElementById('rd-valor').value = '';
            document.getElementById('rd-desc').value = '';
            if (document.getElementById('rd-observacao')) document.getElementById('rd-observacao').value = '';
            document.getElementById('rd-anexo').value = '';
            if (document.getElementById('rd-anexo-base64')) document.getElementById('rd-anexo-base64').value = '';
            if (elLan) {
                const ag = new Date();
                elLan.value = ag.getFullYear() + '-' + String(ag.getMonth() + 1).padStart(2, '0') + '-' + String(ag.getDate()).padStart(2, '0');
            }
            recarregarRelatorioDespesasTabularSeCarregado();
            if (typeof window.carregarNomesRelatorioDespesas === 'function') {
                window.carregarNomesRelatorioDespesas();
            }
        } catch (e) {
            console.error(e);
            Swal.fire('Falha Técnica', 'Não foi possível salvar.', 'error');
        }
    };

    window.marcarComoPago = async function(id) {
        const despesa = (window.dadosExportacaoDespesas || []).find((d) => d.id === id);
        const saldo = despesa ? valorEmAbertoComTerceirosDespesa(despesa) : null;
        const abatTer = despesa ? (Number(despesa._abatimento_terceiros) || 0) : 0;
        const optsBaixa = {
            valorPagoSugerido: saldo != null ? saldo : undefined,
            titulo: 'Anexe o comprovante. Informe o <b>valor pago</b> (pode ser maior que o saldo se houver juros).'
        };
        Swal.fire({
            title: 'Quitar total — pagamento',
            html: (saldo != null ? '<p style="text-align:left;font-size:13px;margin:0 0 10px 0;">Saldo em aberto: <b>' + formatarMoeda(saldo) + '</b>'
                + (abatTer > 0 ? ' <span style="color:#0c5460;">(já abatido ' + formatarMoeda(abatTer) + ' de terceiros)</span>' : '')
                + '. Informe abaixo o valor que realmente pagou.</p>' : '')
                + htmlBlocoDiscriminacaoParcial()
                + htmlModalBaixaComprovante(optsBaixa),
            icon: 'info',
            width: Math.min(window.innerWidth - 24, 560),
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#1a2a43',
            confirmButtonText: 'Quitar total',
            cancelButtonText: 'Cancelar',
            didOpen: function () {
                configurarModalBaixaComprovante();
                configurarDiscriminacaoParcial();
            },
            preConfirm: function () {
                const comp = validarBaixaComprovantePayload(optsBaixa);
                if (comp === false) return false;
                const linhas = validarLinhasDiscriminacaoParcial(comp.valor_pago);
                if (linhas === false) return false;
                comp.linhas = linhas || [];
                return comp;
            }
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                try {
                    const dataSegura = dataPagamentoHojeBr();
                    const orig = despesa ? valorOriginalDespesa(despesa) : 0;
                    const restante = despesa ? valorEmAbertoComTerceirosDespesa(despesa) : 0;
                    const valorPago = (result.value.valor_pago != null && result.value.valor_pago > 0)
                        ? result.value.valor_pago
                        : restante;
                    const juros = result.value.valor_juros || Math.max(0, Math.round((valorPago - restante) * 100) / 100);
                    let obsQuit = 'Quitação do saldo restante';
                    if (abatTer > 0) obsQuit = 'Quitação do saldo (após abatimento de terceiros)';
                    if (juros > 0.009) obsQuit += ' (pago com juros)';

                    let payload;
                    const linhas = result.value.linhas || [];
                    if (linhas.length && despesa) {
                        const novos = montarItensParciaisDoGrupo(linhas, dataSegura, result.value, valorPago);
                        payload = montarPayloadParciaisAtualizados(
                            despesa,
                            listaPagamentosParciaisDespesa(despesa).concat(novos)
                        );
                        payload.status = 'pago';
                        payload.saldo_devedor = 0;
                        payload.data_pagamento = dataSegura;
                    } else {
                        payload = {
                            status: 'pago',
                            data_pagamento: dataSegura,
                            baixa_sem_comprovante: !!result.value.baixa_sem_comprovante,
                            saldo_devedor: 0,
                            valor_pago_acumulado: Math.max(orig, valorPago)
                        };
                        if (despesa && valorPago > 0.009) {
                            const parcialPayload = montarPayloadPagamentoParcial(
                                despesa,
                                valorPago,
                                dataSegura,
                                obsQuit,
                                result.value
                            );
                            payload = Object.assign({}, parcialPayload, {
                                status: 'pago',
                                data_pagamento: dataSegura,
                                saldo_devedor: 0,
                                valor_pago_acumulado: parcialPayload.valor_pago_acumulado
                            });
                        }
                    }
                    await externalizarComprovantesDoPayload(id, payload);
                    await updateDoc(doc(db, 'despesas_obras', id), payload);
                    let msg = result.value.baixa_sem_comprovante
                        ? 'Baixa total registada sem comprovante (código autorizado).'
                        : 'Pagamento total registado com comprovante anexado.';
                    if (linhas.length) msg += ' ' + linhas.length + ' linhas discriminadas no mesmo comprovante.';
                    if (juros > 0.009) {
                        msg += ' Valor lançado: ' + formatarMoeda(valorPago) + ' (juros/acréscimo ' + formatarMoeda(juros) + ').';
                    }
                    Swal.fire('Sucesso!', msg, 'success');
                    const busca = document.getElementById('busca-obra');
                    if (busca && busca.value.trim()) buscarDespesasObra();
                    if (typeof recarregarTelasAposEditarParcial === 'function') recarregarTelasAposEditarParcial();
                } catch (e) {
                    console.error(e);
                    Swal.fire('Erro', mensagemErroUpdateDespesa(e), 'error');
                }
            }
        });
    };

    window.lancarPagamentoParcialDespesa = async function (id) {
        const despesa = (window.dadosExportacaoDespesas || []).find((d) => d.id === id && d._origem !== 'pagamentos_terceiros');
        if (!despesa) {
            return Swal.fire('Atenção', 'Despesa não encontrada nesta busca. Busque novamente e tente.', 'warning');
        }
        const orig = valorOriginalDespesa(despesa);
        const abatTer = Number(despesa._abatimento_terceiros) || 0;
        const jaPago = valorPagoComTerceirosDespesa(despesa);
        const saldo = valorEmAbertoComTerceirosDespesa(despesa);
        if (saldo <= 0.009) {
            return Swal.fire('Já quitada', 'Esta despesa não tem saldo em aberto'
                + (abatTer > 0 ? ' (já coberto pelos pagamentos a terceiros).' : '.'), 'info');
        }

        const hoje = new Date();
        const hojeIso = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');

        const result = await Swal.fire({
            title: 'Pagamento parcial',
            html: ''
                + '<div style="text-align:left;font-size:13px;">'
                + '<p style="margin:0 0 10px 0;background:#f0f9ff;border:1px solid #bee5eb;border-radius:8px;padding:10px;">'
                + 'Original: <b>' + formatarMoeda(orig) + '</b><br>'
                + 'Já pago: <b style="color:#28a745;">' + formatarMoeda(jaPago) + '</b>'
                + (abatTer > 0 ? ' <span style="color:#0c5460;">(inclui ' + formatarMoeda(abatTer) + ' de terceiros)</span>' : '') + '<br>'
                + 'Saldo em aberto: <b style="color:#c0392b;">' + formatarMoeda(saldo) + '</b>'
                + '</p>'
                + '<label>Valor total do comprovante (R$)</label>'
                + '<input id="pp-valor" class="swal2-input" style="margin:4px 0 10px 0;width:100%;" placeholder="0,00" value="">'
                + '<label>Data do pagamento</label>'
                + '<input type="date" id="pp-data" class="swal2-input" style="margin:4px 0 10px 0;width:100%;" value="' + hojeIso + '">'
                + '<label>Observação (opcional, se não discriminar)</label>'
                + '<input id="pp-obs" class="swal2-input" style="margin:4px 0 10px 0;width:100%;" placeholder="Ex.: pagamento parcial / com juros">'
                + htmlBlocoDiscriminacaoParcial()
                + '<p style="font-size:12px;color:#666;margin:8px 0 0 0;">O valor abate o saldo. Se for <b>maior que o saldo</b> (juros), a despesa fica <b>PAGA</b> e o acréscimo fica registado.</p>'
                + '</div>'
                + htmlModalBaixaComprovante({
                    titulo: 'No pagamento parcial também é <b>obrigatório</b> anexar o comprovante (foto/PDF). Sem comprovante, informe o código de autorização.',
                    mostrarValorPago: false
                }),
            width: Math.min(window.innerWidth - 24, 560),
            showCancelButton: true,
            confirmButtonColor: '#17a2b8',
            cancelButtonColor: '#1a2a43',
            confirmButtonText: 'Lançar parcial',
            cancelButtonText: 'Cancelar',
            didOpen: () => {
                window._swalComprovantePgtoBase64 = '';
                configurarModalBaixaComprovante();
                configurarDiscriminacaoParcial();
                const inp = document.getElementById('pp-valor');
                if (inp) {
                    inp.addEventListener('input', function () { mascaraMoeda(inp); });
                    inp.focus();
                }
            },
            preConfirm: () => {
                // Mesma regra da baixa total: comprovante OU código
                const comp = validarBaixaComprovantePayload();
                if (comp === false) return false;
                if (!comp || (!comp.comprovante_pagamento && !comp.baixa_sem_comprovante)) {
                    Swal.showValidationMessage('Anexe o comprovante (foto ou PDF) ou informe o código de autorização.');
                    return false;
                }
                const valorStr = (document.getElementById('pp-valor') && document.getElementById('pp-valor').value) || '';
                const valorNum = parseMoedaLocal(String(valorStr || '0').replace(/R\$\s?/gi, ''));
                if (!(valorNum > 0)) {
                    Swal.showValidationMessage('Informe o valor total do comprovante.');
                    return false;
                }
                const linhas = validarLinhasDiscriminacaoParcial(valorNum);
                if (linhas === false) return false;
                const dataIso = (document.getElementById('pp-data') && document.getElementById('pp-data').value) || hojeIso;
                const obs = (document.getElementById('pp-obs') && document.getElementById('pp-obs').value) || '';
                let dataBr = dataPagamentoHojeBr();
                if (dataIso && /^\d{4}-\d{2}-\d{2}/.test(dataIso)) {
                    const p = dataIso.split('-');
                    dataBr = p[2] + '/' + p[1] + '/' + p[0];
                }
                return {
                    valor: valorNum,
                    dataBr: dataBr,
                    obs: String(obs).trim(),
                    linhas: linhas,
                    comprovante: {
                        comprovante_pagamento: comp.comprovante_pagamento || null,
                        baixa_sem_comprovante: !!comp.baixa_sem_comprovante
                    }
                };
            }
        });

        if (!result.isConfirmed || !result.value) return;

        try {
            let payload;
            const nLinhas = (result.value.linhas && result.value.linhas.length) || 0;
            if (nLinhas) {
                const novos = montarItensParciaisDoGrupo(
                    result.value.linhas,
                    result.value.dataBr,
                    result.value.comprovante,
                    result.value.valor
                );
                payload = montarPayloadParciaisAtualizados(
                    despesa,
                    listaPagamentosParciaisDespesa(despesa).concat(novos)
                );
            } else {
                payload = montarPayloadPagamentoParcial(
                    despesa,
                    result.value.valor,
                    result.value.dataBr,
                    result.value.obs,
                    result.value.comprovante
                );
            }
            // Se o restante no banco ainda existe mas já foi coberto por Terceiros, quita
            const saldoEfetivoApos = Math.max(0, Math.round(((payload.saldo_devedor || 0) - abatTer) * 100) / 100);
            if (saldoEfetivoApos <= 0.009) {
                payload.status = 'pago';
                payload.saldo_devedor = 0;
                payload.valor_pago_acumulado = payload.valor_pago_acumulado || Math.max(orig, result.value.valor);
                payload.data_pagamento = result.value.dataBr || dataPagamentoHojeBr();
            }
            await externalizarComprovantesDoPayload(id, payload);
            await updateDoc(doc(db, 'despesas_obras', id), payload);
            const quitou = payload.status === 'pago';
            const semComp = !!(result.value.comprovante && result.value.comprovante.baixa_sem_comprovante);
            const novoSaldoExibir = quitou ? 0 : saldoEfetivoApos;
            const juros = Math.max(0, Math.round((result.value.valor - saldo) * 100) / 100);
            const nLinhasDisc = (result.value.linhas && result.value.linhas.length) || 0;
            Swal.fire(
                quitou ? 'Quitada!' : 'Parcial lançado!',
                (quitou
                    ? 'O saldo foi coberto. Despesa marcada como PAGA. '
                    : 'Abatido ' + formatarMoeda(Math.min(result.value.valor, saldo)) + '. Novo saldo: ' + formatarMoeda(novoSaldoExibir) + '. ')
                + (nLinhasDisc ? nLinhasDisc + ' linhas discriminadas no mesmo comprovante. ' : '')
                + (juros > 0.009 ? 'Juros/acréscimo: ' + formatarMoeda(juros) + '. ' : '')
                + (semComp ? 'Baixa sem comprovante (código autorizado).' : 'Comprovante anexado.'),
                'success'
            );
            const busca = document.getElementById('busca-obra');
            if (busca && busca.value.trim()) buscarDespesasObra();
            if (typeof carregarFiltrosDespesas === 'function') carregarFiltrosDespesas();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', mensagemErroUpdateDespesa(e), 'error');
        }
    };

    function montarPayloadParciaisAtualizados(despesa, pars) {
        const orig = valorOriginalDespesa(despesa);
        if (!pars.length) {
            return {
                pagamentos_parciais: [],
                valor_pago_acumulado: 0,
                saldo_devedor: orig,
                status: 'pendente',
                data_pagamento: null
            };
        }
        const totalPago = Math.round(pars.reduce(function (s, p) {
            return s + (Number(p.valor) || parseMoedaLocal(p.valor_string) || 0);
        }, 0) * 100) / 100;
        const quitado = totalPago >= orig - 0.009;
        const saldo = quitado ? 0 : Math.max(0, Math.round((orig - Math.min(totalPago, orig)) * 100) / 100);
        const ultimaData = pars.length ? (pars[pars.length - 1].data || '') : '';
        return {
            pagamentos_parciais: pars,
            valor_pago_acumulado: totalPago,
            saldo_devedor: saldo,
            status: quitado ? 'pago' : 'parcial',
            data_pagamento: quitado ? (ultimaData || despesa.data_pagamento || dataPagamentoHojeBr()) : null
        };
    }

    async function obterDespesaObraPorId(despesaId) {
        try {
            const snap = await getDoc(doc(db, 'despesas_obras', despesaId));
            if (snap.exists()) return Object.assign({ id: snap.id }, snap.data() || {});
        } catch (e) {
            console.error(e);
        }
        return (window.dadosExportacaoDespesas || []).find(function (d) {
            return d && String(d.id) === String(despesaId) && d._origem !== 'pagamentos_terceiros';
        }) || null;
    }

    function coletarParciaisSelecionadosTela() {
        const itens = [];
        document.querySelectorAll('.chk-parcial-sel:checked').forEach(function (el) {
            const despesaId = el.getAttribute('data-despesa-id');
            const parcialId = el.getAttribute('data-parcial-id');
            if (despesaId && parcialId) {
                itens.push({
                    despesaId: despesaId,
                    parcialId: parcialId,
                    rotulo: el.getAttribute('data-rotulo') || ''
                });
            }
        });
        return itens;
    }

    async function removerParciaisDasDespesas(itens) {
        const porDespesa = {};
        (itens || []).forEach(function (it) {
            if (!porDespesa[it.despesaId]) porDespesa[it.despesaId] = [];
            porDespesa[it.despesaId].push(decodeURIComponent(String(it.parcialId || '')));
        });
        const ids = Object.keys(porDespesa);
        for (let i = 0; i < ids.length; i++) {
            const despesaId = ids[i];
            const chaves = porDespesa[despesaId];
            const despesa = await obterDespesaObraPorId(despesaId);
            if (!despesa) throw new Error('Despesa não encontrada.');
            const pars = listaPagamentosParciaisDespesa(despesa).filter(function (p, idx) {
                return chaves.indexOf(idEstavelPagamentoParcial(p, idx)) === -1;
            });
            preservarComprovanteNosGrupos(listaPagamentosParciaisDespesa(despesa), pars);
            const payload = montarPayloadParciaisAtualizados(despesa, pars);
            await updateDoc(doc(db, 'despesas_obras', despesaId), payload);
        }
    }

    function recarregarTelasAposEditarParcial() {
        const busca = document.getElementById('busca-obra');
        if (busca && busca.value.trim() && typeof buscarDespesasObra === 'function') buscarDespesasObra();
        if (typeof carregarFiltrosDespesas === 'function') carregarFiltrosDespesas();
        if (typeof carregarRelatorioGeralObras === 'function' && (window._relGeralObrasExport || document.getElementById('rel-geral-obras-quadro'))) {
            carregarRelatorioGeralObras();
        }
    }

    window.editarPagamentoParcialDespesa = async function (despesaId, parcialIdEnc) {
        if (!despesaId) return;
        const chaveParc = decodeURIComponent(String(parcialIdEnc || ''));
        let despesa = null;
        try {
            const snap = await getDoc(doc(db, 'despesas_obras', despesaId));
            if (snap.exists()) despesa = Object.assign({ id: snap.id }, snap.data() || {});
        } catch (e) {
            console.error(e);
        }
        if (!despesa) {
            despesa = (window.dadosExportacaoDespesas || []).find(function (d) {
                return d && String(d.id) === String(despesaId) && d._origem !== 'pagamentos_terceiros';
            });
        }
        if (!despesa) return Swal.fire('Atenção', 'Despesa não encontrada. Atualize o relatório e tente de novo.', 'warning');

        const pars = listaPagamentosParciaisDespesa(despesa).slice();
        let idx = -1;
        for (let i = 0; i < pars.length; i++) {
            if (idEstavelPagamentoParcial(pars[i], i) === chaveParc) { idx = i; break; }
        }
        if (idx < 0) return Swal.fire('Atenção', 'Pagamento parcial não encontrado.', 'warning');

        const atual = pars[idx];
        const valorAtual = Number(atual.valor) || parseMoedaLocal(atual.valor_string) || 0;
        const orig = valorOriginalDespesa(despesa);
        const jaPago = valorPagoDespesa(despesa);
        const dataIso = dataVencimentoParaInputDateIso(atual.data || '') || '';

        const conf = await Swal.fire({
            title: 'Editar valor recebido',
            html: '<div style="text-align:left;font-size:13px;">'
                + '<p style="margin:0 0 10px 0;background:#f0f9ff;border:1px solid #bee5eb;border-radius:8px;padding:10px;">'
                + 'Fornecedor: <b>' + escapeHtmlBasico(despesa.loja_nome || '—') + '</b><br>'
                + 'Contrato: <b>' + formatarMoeda(orig) + '</b><br>'
                + 'Já pago (todos os parciais): <b style="color:#28a745;">' + formatarMoeda(jaPago) + '</b><br>'
                + 'Valor deste lançamento: <b>' + formatarMoeda(valorAtual) + '</b>'
                + '</p>'
                + '<label style="display:block;font-size:12px;margin-bottom:4px;">Novo valor recebido (R$)</label>'
                + '<input id="ep-valor" class="swal2-input" style="width:100%;margin:0 0 10px 0;" value="' + String(valorAtual.toFixed(2)).replace('.', ',') + '">'
                + '<label style="display:block;font-size:12px;margin-bottom:4px;">Data do pagamento</label>'
                + '<input type="date" id="ep-data" class="swal2-input" style="width:100%;margin:0 0 10px 0;" value="' + escapeAttrBasico(dataIso) + '">'
                + '<label style="display:block;font-size:12px;margin-bottom:4px;">Observação (opcional)</label>'
                + '<input id="ep-obs" class="swal2-input" style="width:100%;margin:0;" value="' + escapeAttrBasico(atual.observacao || '') + '">'
                + '<p style="font-size:12px;color:#666;margin:8px 0 0 0;">O <b>Já pago</b> e o <b>saldo</b> da despesa são recalculados com o novo valor.</p>'
                + '</div>',
            showCancelButton: true,
            confirmButtonText: 'Salvar correção',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#4285F4',
            didOpen: function () {
                const inp = document.getElementById('ep-valor');
                if (inp && typeof mascaraMoeda === 'function') {
                    inp.addEventListener('input', function () { mascaraMoeda(inp); });
                    inp.focus();
                    inp.select();
                }
            },
            preConfirm: function () {
                const valorNum = parseMoedaLocal((document.getElementById('ep-valor') && document.getElementById('ep-valor').value) || '0');
                if (!(valorNum > 0)) {
                    Swal.showValidationMessage('Informe um valor maior que zero.');
                    return false;
                }
                const dataIsoNovo = (document.getElementById('ep-data') && document.getElementById('ep-data').value) || dataIso;
                let dataBr = atual.data || dataPagamentoHojeBr();
                if (dataIsoNovo && /^\d{4}-\d{2}-\d{2}/.test(dataIsoNovo)) {
                    const p = dataIsoNovo.split('-');
                    dataBr = p[2] + '/' + p[1] + '/' + p[0];
                }
                return {
                    valor: valorNum,
                    dataBr: dataBr,
                    obs: String((document.getElementById('ep-obs') && document.getElementById('ep-obs').value) || '').trim()
                };
            }
        });
        if (!conf.isConfirmed || !conf.value) return;

        try {
            const editado = Object.assign({}, atual, {
                id: atual.id || idEstavelPagamentoParcial(atual, idx),
                valor: conf.value.valor,
                valor_string: formatarMoeda(conf.value.valor).replace(/^R\$\s?/, ''),
                data: conf.value.dataBr,
                observacao: conf.value.obs,
                timestamp: atual.timestamp || Date.now()
            });
            pars[idx] = editado;
            const payload = montarPayloadParciaisAtualizados(despesa, pars);
            await updateDoc(doc(db, 'despesas_obras', despesaId), payload);
            Swal.fire(
                'Valor corrigido!',
                'Este lançamento ficou em ' + formatarMoeda(conf.value.valor) + '. Já pago agora: ' + formatarMoeda(payload.valor_pago_acumulado)
                    + (payload.status === 'pago' ? '. A despesa foi quitada.' : '. Saldo: ' + formatarMoeda(payload.saldo_devedor) + '.'),
                'success'
            );
            recarregarTelasAposEditarParcial();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível salvar a correção.', 'error');
        }
    };

    window.excluirPagamentoParcialDespesa = async function (despesaId, parcialIdEnc) {
        if (!despesaId) return;
        const chaveParc = decodeURIComponent(String(parcialIdEnc || ''));
        const despesa = await obterDespesaObraPorId(despesaId);
        if (!despesa) return Swal.fire('Atenção', 'Despesa não encontrada. Atualize o relatório e tente de novo.', 'warning');

        const pars = listaPagamentosParciaisDespesa(despesa);
        let idx = -1;
        for (let i = 0; i < pars.length; i++) {
            if (idEstavelPagamentoParcial(pars[i], i) === chaveParc) { idx = i; break; }
        }
        if (idx < 0) return Swal.fire('Atenção', 'Pagamento parcial não encontrado.', 'warning');

        const atual = pars[idx];
        const valorAtual = Number(atual.valor) || parseMoedaLocal(atual.valor_string) || 0;
        const conf = await Swal.fire({
            title: 'Excluir este parcial?',
            html: '<p style="text-align:left;font-size:13px;margin:0;">Será apagado <b>somente</b> este lançamento:</p>'
                + '<p style="text-align:left;font-size:13px;background:#fdecea;border:1px solid #f5c6cb;border-radius:8px;padding:10px;margin:10px 0 0 0;">'
                + escapeHtmlBasico(atual.data || '—') + ' — <b>' + formatarMoeda(valorAtual) + '</b>'
                + (atual.observacao ? '<br>' + escapeHtmlBasico(atual.observacao) : '')
                + '</p>'
                + '<p style="text-align:left;font-size:12px;color:#666;margin:10px 0 0 0;">A despesa e os outros parciais <b>permanecem</b>. O saldo volta a incluir este valor.</p>',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, excluir este',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#c0392b'
        });
        if (!conf.isConfirmed) return;

        try {
            await removerParciaisDasDespesas([{ despesaId: despesaId, parcialId: encodeURIComponent(chaveParc) }]);
            Swal.fire('Excluído', 'O pagamento parcial de ' + formatarMoeda(valorAtual) + ' foi removido.', 'success');
            recarregarTelasAposEditarParcial();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível excluir este parcial.', 'error');
        }
    };

    window.excluirPagamentosParciaisSelecionados = async function () {
        const itens = coletarParciaisSelecionadosTela();
        if (!itens.length) {
            return Swal.fire('Atenção', 'Selecione pelo menos um pagamento parcial para excluir.', 'info');
        }
        const listaHtml = itens.map(function (it) {
            return '<li>' + escapeHtmlBasico(it.rotulo || 'Parcial selecionado') + '</li>';
        }).join('');
        const conf = await Swal.fire({
            title: 'Excluir parciais selecionados?',
            html: '<p style="text-align:left;font-size:13px;margin:0 0 8px 0;">Serão apagados <b>somente</b> estes lançamentos (' + itens.length + '). A despesa permanece.</p>'
                + '<ul style="text-align:left;font-size:13px;margin:0;padding-left:18px;">' + listaHtml + '</ul>',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Excluir selecionados',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#c0392b'
        });
        if (!conf.isConfirmed) return;
        try {
            await removerParciaisDasDespesas(itens);
            Swal.fire('Excluído', itens.length === 1 ? 'O pagamento parcial selecionado foi removido.' : itens.length + ' pagamentos parciais foram removidos.', 'success');
            recarregarTelasAposEditarParcial();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível excluir os parciais selecionados.', 'error');
        }
    };

    window.discriminarPagamentoParcialDespesa = async function (despesaId, parcialIdEnc) {
        if (!despesaId) return;
        const chaveParc = decodeURIComponent(String(parcialIdEnc || ''));
        const despesa = await obterDespesaObraPorId(despesaId);
        if (!despesa) return Swal.fire('Atenção', 'Despesa não encontrada. Atualize o relatório e tente de novo.', 'warning');

        const pars = listaPagamentosParciaisDespesa(despesa).slice();
        let idx = -1;
        for (let i = 0; i < pars.length; i++) {
            if (idEstavelPagamentoParcial(pars[i], i) === chaveParc) { idx = i; break; }
        }
        if (idx < 0) return Swal.fire('Atenção', 'Pagamento parcial não encontrado.', 'warning');

        const atual = pars[idx];
        const valorAtual = Number(atual.valor) || parseMoedaLocal(atual.valor_string) || 0;
        if (!(valorAtual > 0.009)) {
            return Swal.fire('Atenção', 'Este lançamento não tem valor para discriminar.', 'warning');
        }
        const dataIso = dataVencimentoParaInputDateIso(atual.data || '') || '';
        const valorFmt = (typeof formatarValorInputMoeda === 'function')
            ? formatarValorInputMoeda(valorAtual)
            : String(valorAtual.toFixed(2)).replace('.', ',');

        const conf = await Swal.fire({
            title: 'Discriminar comprovante',
            html: '<div style="text-align:left;font-size:13px;">'
                + '<p style="margin:0 0 10px 0;background:#fff8e6;border:1px solid #ffe08a;border-radius:8px;padding:10px;">'
                + 'O comprovante continua o <b>mesmo</b>. Você só detalha o que esse valor pagou, em linhas, até fechar <b>' + formatarMoeda(valorAtual) + '</b>.'
                + '</p>'
                + '<label>Valor total do comprovante (R$)</label>'
                + '<input id="pp-valor" class="swal2-input" style="margin:4px 0 10px 0;width:100%;" value="' + escapeAttrBasico(valorFmt) + '">'
                + '<label>Data do pagamento</label>'
                + '<input type="date" id="pp-data" class="swal2-input" style="margin:4px 0 10px 0;width:100%;" value="' + escapeAttrBasico(dataIso) + '">'
                + htmlBlocoDiscriminacaoParcial({ ligado: true })
                + '</div>',
            width: Math.min(window.innerWidth - 24, 560),
            showCancelButton: true,
            confirmButtonText: 'Salvar discriminação',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#856404',
            didOpen: function () {
                const inp = document.getElementById('pp-valor');
                if (inp && typeof mascaraMoeda === 'function') {
                    inp.addEventListener('input', function () { mascaraMoeda(inp); });
                }
                configurarDiscriminacaoParcial([
                    { valorFmt: '', desc: atual.observacao || '' },
                    { valorFmt: '', desc: '' }
                ]);
            },
            preConfirm: function () {
                const valorNum = parseMoedaLocal((document.getElementById('pp-valor') && document.getElementById('pp-valor').value) || '0');
                if (!(valorNum > 0)) {
                    Swal.showValidationMessage('Informe o valor total do comprovante.');
                    return false;
                }
                const chk = document.getElementById('pp-disc-on');
                if (chk && !chk.checked) chk.checked = true;
                const linhas = validarLinhasDiscriminacaoParcial(valorNum);
                if (linhas === false) return false;
                if (!linhas.length) {
                    Swal.showValidationMessage('Crie as linhas até fechar o valor do comprovante.');
                    return false;
                }
                const dataIsoNovo = (document.getElementById('pp-data') && document.getElementById('pp-data').value) || dataIso;
                let dataBr = atual.data || dataPagamentoHojeBr();
                if (dataIsoNovo && /^\d{4}-\d{2}-\d{2}/.test(dataIsoNovo)) {
                    const p = dataIsoNovo.split('-');
                    dataBr = p[2] + '/' + p[1] + '/' + p[0];
                }
                return { valor: valorNum, dataBr: dataBr, linhas: linhas };
            }
        });
        if (!conf.isConfirmed || !conf.value) return;

        try {
            const comprovantePayload = {
                comprovante_pagamento: atual.comprovante_pagamento || comprovanteDoGrupoParcial(despesa, atual) || null,
                baixa_sem_comprovante: !!atual.baixa_sem_comprovante
            };
            const grupoId = atual.grupo_comprovante || null;
            const novos = montarItensParciaisDoGrupo(
                conf.value.linhas,
                conf.value.dataBr,
                comprovantePayload,
                atual.valor_comprovante || conf.value.valor,
                grupoId
            );
            pars.splice(idx, 1);
            const juntos = pars.slice(0, idx).concat(novos).concat(pars.slice(idx));
            preservarComprovanteNosGrupos(listaPagamentosParciaisDespesa(despesa).concat(novos), juntos);
            const payload = montarPayloadParciaisAtualizados(despesa, juntos);
            await externalizarComprovantesDoPayload(despesaId, payload);
            await updateDoc(doc(db, 'despesas_obras', despesaId), payload);
            Swal.fire(
                'Discriminado!',
                conf.value.linhas.length + ' linhas no mesmo comprovante de ' + formatarMoeda(conf.value.valor) + '. O Já pago permanece; só o detalhe mudou.',
                'success'
            );
            recarregarTelasAposEditarParcial();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível salvar a discriminação.', 'error');
        }
    };

    window.marcarComoPendente = async function (id) {
        Swal.fire({
            title: 'Voltar a pendente?',
            text: 'A despesa deixa de constar como paga e os pagamentos parciais são limpos. Use se marcou pago por engano.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ffc107',
            cancelButtonColor: '#1a2a43',
            confirmButtonText: 'Sim, voltar a pendente',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const despesa = (window.dadosExportacaoDespesas || []).find((d) => d.id === id);
                    const orig = despesa ? valorOriginalDespesa(despesa) : null;
                    await updateDoc(doc(db, 'despesas_obras', id), {
                        status: 'pendente',
                        data_pagamento: null,
                        comprovante_pagamento: null,
                        baixa_sem_comprovante: false,
                        pagamentos_parciais: [],
                        valor_pago_acumulado: 0,
                        saldo_devedor: orig != null ? orig : null
                    });
                    Swal.fire('Atualizado', 'A despesa voltou ao estado pendente.', 'success');
                    const busca = document.getElementById('busca-obra');
                    if (busca && busca.value.trim()) buscarDespesasObra();
                } catch (e) {
                    Swal.fire('Erro', 'Não foi possível atualizar.', 'error');
                }
            }
        });
    };

    function notaVeioDoRelatorioDespesas(d) {
        return !!(d && (d._origem === 'relatorio_despesas' || d.origem_colecao === 'relatorio_despesas'));
    }

    function localizarNotaCadastradaPorId(id) {
        if (id == null || id === '') return null;
        const sid = String(id);
        const listas = [];
        if (Array.isArray(window._notasResumoVisualizarAtual)) listas.push(window._notasResumoVisualizarAtual);
        if (Array.isArray(window.dadosExportacaoDespesas)) listas.push(window.dadosExportacaoDespesas);
        if (window._mapDespesasResumoFornecedor) {
            Object.keys(window._mapDespesasResumoFornecedor).forEach(function (k) {
                listas.push(window._mapDespesasResumoFornecedor[k] || []);
            });
        }
        for (let i = 0; i < listas.length; i += 1) {
            const achou = (listas[i] || []).find(function (d) { return d && String(d.id) === sid; });
            if (achou) return achou;
        }
        if (window._mapRelatorioDespesasParaEdicao && window._mapRelatorioDespesasParaEdicao[id]) {
            return window._mapRelatorioDespesasParaEdicao[id];
        }
        return null;
    }

    function reabrirNotasResumoSePreciso() {
        if (!window._reabrirNotasResumoAposEditar) return;
        window._reabrirNotasResumoAposEditar = false;
        const chaveObra = window._notasResumoChaveObra;
        const chaveLoja = window._notasResumoChaveLoja;
        if (!chaveObra || !chaveLoja) return;
        setTimeout(async function () {
            try {
                if (typeof window.gerarResumoFornecedores === 'function' && document.getElementById('tabela-resumo-fornecedores')) {
                    await window.gerarResumoFornecedores();
                }
            } catch (eResumo) { /* reabre a lista mesmo se a tabela não atualizar */ }
            if (typeof window.visualizarNotasDespesaResumo === 'function') {
                window.visualizarNotasDespesaResumo(chaveObra, chaveLoja);
            }
        }, 250);
    }

    window.editarDespesa = async function (id) {
        let despesa = localizarNotaCadastradaPorId(id);
        if (notaVeioDoRelatorioDespesas(despesa)) {
            return window.editarDespesaRelatorio(id);
        }
        if (!despesa) {
            try {
                const snap = await getDoc(doc(db, 'despesas_obras', id));
                if (snap.exists()) despesa = { id: snap.id, ...snap.data(), _origem: 'despesas_obras' };
            } catch (eBusca) { /* segue aviso abaixo */ }
        }
        if (!despesa) {
            return Swal.fire('Aviso', 'Despesa não encontrada para edição.', 'warning');
        }

        const vObra = escapeHtmlBasico(despesa.obra_nome || '');
        const vLoja = escapeHtmlBasico(despesa.loja_nome || '');
        const vNf = escapeHtmlBasico(despesa.nota_fiscal || '');
        const vVen = escapeHtmlBasico(dataVencimentoParaInputDateIso(obterDataVencimentoDespesa(despesa)) || '');
        const vVal = escapeHtmlBasico(despesa.valor_string || '');
        const vDesc = escapeHtmlBasico(despesa.descricao || '');

        Swal.fire({
            title: '✏️ Editar Despesa',
            html: `
                <div style="text-align: left; font-size: 13px;">
                    <label style="margin-top: 10px;">Obra / Local:</label>
                    <input id="edit-obra" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${vObra}">
                    
                    <label style="margin-top: 10px;">Loja / Fornecedor:</label>
                    <input id="edit-loja" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${vLoja}">
                    
                    <label style="margin-top: 10px;">Nota Fiscal:</label>
                    <input id="edit-nf" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${vNf}">
                    
                    <label style="margin-top: 10px;">Data de Vencimento:</label>
                    <input type="date" id="edit-vencimento" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${vVen}">
                    
                    <label style="margin-top: 10px;">Valor (R$):</label>
                    <input id="edit-valor" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${vVal}" oninput="mascaraMoeda(this)">
                    
                    <label style="margin-top: 10px;">Descrição / Materiais:</label>
                    <textarea id="edit-desc" class="swal2-textarea" style="margin: 0; width: 100%; font-size: 14px; height: 80px;">${vDesc}</textarea>
                </div>
            `,
            showCancelButton: true,
            confirmButtonColor: '#1a2a43',
            cancelButtonColor: '#d9534f',
            confirmButtonText: 'SALVAR',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const obraRaw = document.getElementById('edit-obra').value;
                const lojaRaw = document.getElementById('edit-loja').value;
                const obra = resolverNomeCanonicoDespesa(obraRaw, 'obra');
                const loja = resolverNomeCanonicoDespesa(lojaRaw, 'loja');
                return {
                    obra_nome: obra,
                    obra_lower: normalizarChaveNomeDespesa(obra),
                    loja_nome: loja,
                    loja_lower: normalizarChaveNomeDespesa(loja),
                    nota_fiscal: document.getElementById('edit-nf').value.trim(),
                    data_vencimento: document.getElementById('edit-vencimento').value,
                    data_vencimento_ts: parseDataVencimentoParaTimestamp(document.getElementById('edit-vencimento').value),
                    valor_string: document.getElementById('edit-valor').value,
                    valor_numero: parseMoedaLocal(document.getElementById('edit-valor').value),
                    descricao: document.getElementById('edit-desc').value.trim()
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await updateDoc(doc(db, "despesas_obras", id), result.value);
                    Object.assign(despesa, result.value);
                    await Swal.fire('Atualizado!', 'As informações foram corrigidas.', 'success');
                    const busca = document.getElementById('busca-obra');
                    if (busca && busca.value.trim()) buscarDespesasObra();
                    reabrirNotasResumoSePreciso();
                } catch (e) { Swal.fire('Erro', 'Não foi possível editar.', 'error'); }
            } else {
                reabrirNotasResumoSePreciso();
            }
        });
    };

    window.editarDespesaRelatorio = async function (id) {
        let despesa = window._mapRelatorioDespesasParaEdicao && window._mapRelatorioDespesasParaEdicao[id];
        if (!despesa) {
            try {
                const snap = await getDoc(doc(db, COLECAO_RELATORIO_DESPESAS, id));
                if (!snap.exists()) return Swal.fire('Erro', 'Registo não encontrado.', 'error');
                despesa = { id: snap.id, ...snap.data() };
            } catch (e) {
                console.error(e);
                return Swal.fire('Erro', 'Não foi possível ler o registro.', 'error');
            }
        }

        const dataLancIso = despesa.data_lancamento || dataBrParaInputDateIso(despesa.data) || '';
        const vObra = escapeHtmlBasico(despesa.obra_nome || '');
        const vLoja = escapeHtmlBasico(despesa.loja_nome || '');
        const vNf = escapeHtmlBasico(despesa.nota_fiscal || '');
        const vVen = escapeHtmlBasico(dataVencimentoParaInputDateIso(obterDataVencimentoDespesa(despesa)) || '');
        const vVal = escapeHtmlBasico(despesa.valor_string || '');
        const vDesc = escapeHtmlBasico(despesa.descricao || '');
        const vChq = escapeHtmlBasico(String(despesa.cheque_boleto_num || '').trim());
        const vObs = escapeHtmlBasico(String(despesa.observacao || '').trim());
        const vLan = escapeHtmlBasico(dataLancIso);

        Swal.fire({
            title: '✏️ Editar linha (Relatório de despesas)',
            html: `
                <div style="text-align: left; font-size: 13px;">
                    <label style="margin-top: 10px;">Obra / Local:</label>
                    <input id="edit-rel-obra" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${vObra}">
                    
                    <label style="margin-top: 10px;">Loja / Fornecedor (nome):</label>
                    <input id="edit-rel-loja" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${vLoja}">
                    
                    <label style="margin-top: 10px;">Nota Fiscal / recibo:</label>
                    <input id="edit-rel-nf" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${vNf}">

                    <label style="margin-top: 10px;">Número cheque ou boleto:</label>
                    <input id="edit-rel-cheque-boleto" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${vChq}">
                    
                    <label style="margin-top: 10px;">Data de lançamento:</label>
                    <input type="date" id="edit-rel-lancamento" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${vLan}">
                    
                    <label style="margin-top: 10px;">Data de Vencimento:</label>
                    <input type="date" id="edit-rel-vencimento" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${vVen}">
                    
                    <label style="margin-top: 10px;">Valor (R$):</label>
                    <input id="edit-rel-valor" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${vVal}" oninput="mascaraMoeda(this)">
                    
                    <label style="margin-top: 10px;">Descrição / Materiais:</label>
                    <textarea id="edit-rel-desc" class="swal2-textarea" style="margin: 0; width: 100%; font-size: 14px; height: 80px;">${vDesc}</textarea>

                    <label style="margin-top: 10px;">Observação por item:</label>
                    <textarea id="edit-rel-observacao" class="swal2-textarea" style="margin: 0; width: 100%; font-size: 14px; height: 60px;">${vObs}</textarea>
                </div>
            `,
            showCancelButton: true,
            confirmButtonColor: '#1a2a43',
            cancelButtonColor: '#d9534f',
            confirmButtonText: 'SALVAR',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const dl = document.getElementById('edit-rel-lancamento').value;
                if (!dl) {
                    Swal.showValidationMessage('Indique a data de lançamento.');
                    return false;
                }
                return {
                    obra_nome: document.getElementById('edit-rel-obra').value.trim().toUpperCase(),
                    obra_lower: document.getElementById('edit-rel-obra').value.trim().toLowerCase(),
                    loja_nome: document.getElementById('edit-rel-loja').value.trim().toUpperCase(),
                    loja_lower: document.getElementById('edit-rel-loja').value.trim().toLowerCase(),
                    nota_fiscal: document.getElementById('edit-rel-nf').value.trim(),
                    cheque_boleto_num: document.getElementById('edit-rel-cheque-boleto').value.trim() || null,
                    data_lancamento: dl,
                    data: inputDateIsoParaDataBr(dl),
                    timestamp: timestampMeioDiaDataIso(dl),
                    data_vencimento: document.getElementById('edit-rel-vencimento').value,
                    data_vencimento_ts: parseDataVencimentoParaTimestamp(document.getElementById('edit-rel-vencimento').value),
                    valor_string: document.getElementById('edit-rel-valor').value,
                    valor_numero: parseMoedaLocal(document.getElementById('edit-rel-valor').value),
                    descricao: document.getElementById('edit-rel-desc').value.trim(),
                    observacao: document.getElementById('edit-rel-observacao').value.trim() || null
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await updateDoc(doc(db, COLECAO_RELATORIO_DESPESAS, id), result.value);
                    if (despesa) Object.assign(despesa, result.value);
                    await Swal.fire('Atualizado!', 'As informações foram corrigidas.', 'success');
                    recarregarRelatorioDespesasTabularSeCarregado();
                    reabrirNotasResumoSePreciso();
                } catch (e) { Swal.fire('Erro', 'Não foi possível editar.', 'error'); }
            } else {
                reabrirNotasResumoSePreciso();
            }
        });
    };

    window.marcarComoPagoRelatorio = async function (id) {
        const lista = window._relDespDadosFiltrados || window._relDespDadosCompletos || [];
        const linha = (lista || []).find((d) => d && d.id === id)
            || ((window.dadosExportacaoDespesas || []).find((d) => d && d.id === id));
        const valorNota = linha ? (Number(linha.valor_numero) || parseMoedaLocal(linha.valor_string) || 0) : 0;
        const optsBaixa = {
            valorPagoSugerido: valorNota > 0 ? valorNota : undefined,
            titulo: 'Anexe o comprovante e informe o <b>valor pago</b> (pode incluir juros).'
        };
        Swal.fire({
            title: 'Dar baixa — pagamento',
            html: (valorNota > 0
                ? '<p style="text-align:left;font-size:13px;margin:0 0 10px 0;">Valor da nota: <b>' + formatarMoeda(valorNota) + '</b>. Se pagou com juros, altere o valor abaixo.</p>'
                : '')
                + htmlModalBaixaComprovante(optsBaixa),
            icon: 'info',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#1a2a43',
            confirmButtonText: 'Confirmar pagamento',
            cancelButtonText: 'Cancelar',
            didOpen: configurarModalBaixaComprovante,
            preConfirm: () => validarBaixaComprovantePayload(optsBaixa)
        }).then(async (result) => {
            if (result.isConfirmed && result.value) {
                try {
                    const dataSegura = dataPagamentoHojeBr();
                    const valorPago = (result.value.valor_pago != null && result.value.valor_pago > 0)
                        ? result.value.valor_pago
                        : valorNota;
                    const juros = result.value.valor_juros || Math.max(0, Math.round((valorPago - valorNota) * 100) / 100);
                    const payload = {
                        status: 'pago',
                        data_pagamento: dataSegura,
                        comprovante_pagamento: result.value.comprovante_pagamento,
                        baixa_sem_comprovante: !!result.value.baixa_sem_comprovante,
                        valor_pago: valorPago,
                        valor_pago_string: formatarMoeda(valorPago).replace(/^R\$\s?/, '')
                    };
                    if (juros > 0.009) {
                        payload.valor_juros = juros;
                        const obsAntiga = linha && linha.observacao ? String(linha.observacao) : '';
                        const extra = 'Pago com juros/acréscimo de ' + formatarMoeda(juros) + ' (total ' + formatarMoeda(valorPago) + ')';
                        payload.observacao = obsAntiga
                            ? (obsAntiga + ' | ' + extra)
                            : extra;
                    }
                    await updateDoc(doc(db, COLECAO_RELATORIO_DESPESAS, id), payload);
                    let msg = result.value.baixa_sem_comprovante
                        ? 'Baixa registada sem comprovante (código autorizado).'
                        : 'Pagamento registado com comprovante anexado.';
                    if (juros > 0.009) {
                        msg += ' Valor pago: ' + formatarMoeda(valorPago) + '.';
                    }
                    Swal.fire('Sucesso!', msg, 'success');
                    recarregarRelatorioDespesasTabularSeCarregado();
                } catch (e) {
                    Swal.fire('Erro', 'Não foi possível atualizar.', 'error');
                }
            }
        });
    };

    window.marcarComoPendenteRelatorio = async function (id) {
        Swal.fire({
            title: 'Voltar a pendente?',
            text: 'A linha deixa de constar como paga.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ffc107',
            cancelButtonColor: '#1a2a43',
            confirmButtonText: 'Sim, voltar a pendente',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await updateDoc(doc(db, COLECAO_RELATORIO_DESPESAS, id), {
                        status: 'pendente',
                        data_pagamento: null,
                        comprovante_pagamento: null,
                        baixa_sem_comprovante: false
                    });
                    Swal.fire('Atualizado', 'Linha voltou ao estado pendente.', 'success');
                    recarregarRelatorioDespesasTabularSeCarregado();
                } catch (e) {
                    Swal.fire('Erro', 'Não foi possível atualizar.', 'error');
                }
            }
        });
    };

    window.excluirLinhaRelatorioDespesas = async function (id) {
        Swal.fire({ title: 'Apagar linha do relatório?', text: 'Remove apenas este registro do relatório de despesas.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d9534f', confirmButtonText: 'Sim, apagar!' }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(db, COLECAO_RELATORIO_DESPESAS, id));
                    await Swal.fire('Apagado!', 'Linha removida do relatório.', 'success');
                    recarregarRelatorioDespesasTabularSeCarregado();
                    if (typeof window.carregarNomesRelatorioDespesas === 'function') {
                        window.carregarNomesRelatorioDespesas();
                    }
                    reabrirNotasResumoSePreciso();
                } catch (e) {
                    Swal.fire('Erro', 'Não foi possível apagar.', 'error');
                }
            } else {
                reabrirNotasResumoSePreciso();
            }
        });
    };

    function montarCacheNomesRelDespesasFromSnaps(snapRel, snapObra) {
        const mapaObras = new Map();
        const mapaLojas = new Map();
        const processarSnap = (snap) => {
            snap.forEach((docSnap) => {
                const d = docSnap.data();
                if (d.obra_nome) registrarNomeUnicoNoMapa(mapaObras, d.obra_nome);
                if (d.loja_nome) registrarNomeUnicoNoMapa(mapaLojas, d.loja_nome);
            });
        };
        processarSnap(snapRel);
        processarSnap(snapObra);
        const mapaTodos = new Map();
        mapaObras.forEach((v, chave) => {
            mapaTodos.set(chave, { canonico: v.canonico, tipo: 'obra', count: v.count });
        });
        mapaLojas.forEach((v, chave) => {
            const existente = mapaTodos.get(chave);
            if (!existente || v.count > existente.count) {
                mapaTodos.set(chave, { canonico: v.canonico, tipo: 'loja', count: v.count });
            }
        });
        const obras = Array.from(mapaObras.values()).map((x) => x.canonico).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        const lojas = Array.from(mapaLojas.values()).map((x) => x.canonico).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        const sugestoes = Array.from(mapaTodos.entries()).map(([chave, info]) => ({
            chave,
            nome: info.canonico,
            tipo: info.tipo,
            count: info.count
        })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        window._cacheNomesRelDespesas = { mapaObras, mapaLojas, mapaTodos, obras, lojas, sugestoes };
        return window._cacheNomesRelDespesas;
    }

    window.carregarNomesRelatorioDespesas = async function () {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) return;
        try {
            const qRel = query(collection(db, COLECAO_RELATORIO_DESPESAS), where('empresa_id', '==', empresaLogada));
            const qObra = query(collection(db, 'despesas_obras'), where('empresa_id', '==', empresaLogada));
            const [snapRel, snapObra] = await Promise.all([getDocs(qRel), getDocs(qObra)]);
            const cache = montarCacheNomesRelDespesasFromSnaps(snapRel, snapObra);
            const dlObras = document.getElementById('datalist-obras-rel');
            const dlLojas = document.getElementById('datalist-lojas-rel');
            if (dlObras) {
                dlObras.innerHTML = cache.obras.map((n) => `<option value="${escapeHtmlBasico(n)}"></option>`).join('');
            }
            if (dlLojas) {
                dlLojas.innerHTML = cache.lojas.map((n) => `<option value="${escapeHtmlBasico(n)}"></option>`).join('');
            }
        } catch (e) {
            console.error(e);
        }
    };

    window.fecharSugestoesRelDespesas = function () {
        const box = document.getElementById('rel-desp-filtro-sugestoes');
        if (box) box.style.display = 'none';
    };

    window.selecionarFiltroRelDespesas = function (nome) {
        const inp = document.getElementById('rel-desp-filtro');
        if (inp) inp.value = nome;
        fecharSugestoesRelDespesas();
        carregarRelatorioDespesasTabular();
    };

    window.filtrarAutocompleteRelDespesas = function () {
        const input = document.getElementById('rel-desp-filtro');
        const box = document.getElementById('rel-desp-filtro-sugestoes');
        const cache = window._cacheNomesRelDespesas;
        if (!input || !box) return;
        if (!cache) {
            carregarNomesRelatorioDespesas().then(() => filtrarAutocompleteRelDespesas());
            return;
        }
        const termo = normalizarChaveNomeDespesa(input.value);
        if (!termo) {
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }
        const matches = cache.sugestoes.filter((s) => s.chave.includes(termo)).slice(0, 15);
        if (!matches.length) {
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }
        box.innerHTML = matches.map((s) => {
            const tipoLabel = s.tipo === 'obra' ? '🏢 Obra' : '🏪 Loja';
            return `<button type="button" class="busca-desp-sugestao" data-nome="${escapeHtmlBasico(s.nome)}"><span class="busca-desp-sug-tipo">${tipoLabel}</span>${escapeHtmlBasico(s.nome)}</button>`;
        }).join('');
        box.style.display = 'block';
    };

    window.teclaAutocompleteRelDespesas = function (ev) {
        if (ev.key === 'Enter') {
            fecharSugestoesRelDespesas();
            carregarRelatorioDespesasTabular();
        } else if (ev.key === 'Escape') {
            fecharSugestoesRelDespesas();
        }
    };

    (function initAutocompleteRelDespesasGlobal() {
        document.addEventListener('click', (ev) => {
            const wrap = document.querySelector('#rel-desp-filtro') && document.getElementById('rel-desp-filtro').closest('.busca-despesas-wrap');
            if (wrap && !wrap.contains(ev.target)) fecharSugestoesRelDespesas();
        });
        const box = document.getElementById('rel-desp-filtro-sugestoes');
        if (box) {
            box.addEventListener('mousedown', (ev) => {
                const alvo = ev.target.closest('.busca-desp-sugestao');
                if (!alvo) return;
                ev.preventDefault();
                selecionarFiltroRelDespesas(alvo.getAttribute('data-nome') || '');
            });
        }
    })();

    window.carregarRelatorioDespesasTabular = async function () {
        const wrap = document.getElementById('tabela-relatorio-despesas-wrap');
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) return Swal.fire('Atenção', 'Empresa não definida.', 'warning');
        if (!wrap) return;
        wrap.removeAttribute('data-rel-desp-carregado');
        ocultarPainelResumoRelDespesas();
        window._despesasRelatorioExport = [];
        window._mapRelatorioDespesasParaEdicao = {};
        wrap.innerHTML = '<p style="text-align:center;color:#888;">Carregando...</p>';

        fecharSugestoesRelDespesas();
        const termo = normalizarChaveNomeDespesa(document.getElementById('rel-desp-filtro') && document.getElementById('rel-desp-filtro').value);
        const stFiltro = (document.getElementById('rel-desp-status') && document.getElementById('rel-desp-status').value) || 'todos';

        try {
            const q = query(collection(db, COLECAO_RELATORIO_DESPESAS), where('empresa_id', '==', empresaLogada));
            const querySnapshot = await getDocs(q);
            let arr = [];
            querySnapshot.forEach(docu => arr.push({ id: docu.id, ...docu.data() }));
            arr = arr.filter(d => {
                const o = normalizarChaveNomeDespesa(d.obra_nome || d.obra_lower || '');
                const l = normalizarChaveNomeDespesa(d.loja_nome || d.loja_lower || '');
                if (termo && !o.includes(termo) && !l.includes(termo)) return false;
                const st = d.status === 'pago' ? 'pago' : 'pendente';
                if (stFiltro === 'pendente' && st !== 'pendente') return false;
                if (stFiltro === 'pago' && st !== 'pago') return false;
                if (stFiltro === 'vencido' && (st !== 'pendente' || !despesaEstaVencida(d))) return false;
                return true;
            });
            window._relDespDadosFiltrados = arr.slice();
            if (stFiltro === 'vencido') {
                window._relDespOrdemVenc = 'vencidos_topo';
            }
            renderizarTabelaRelatorioDespesas(arr);
        } catch (e) {
            console.error(e);
            ocultarPainelResumoRelDespesas();
            wrap.innerHTML = '<p style="text-align:center;color:#d9534f;">Erro ao carregar despesas.</p>';
        }
    };

    function filtrarRelDespesasPorPrazoExportacao(arr, prazo) {
        const lista = (arr || []).slice();
        if (!prazo || prazo === 'total') return lista;

        const dias = prazo === '10' ? 10 : 30;
        const hoje = new Date();
        hoje.setHours(12, 0, 0, 0);
        const limite = new Date(hoje.getTime());
        limite.setDate(limite.getDate() + dias);
        const tsLimite = limite.getTime();

        return lista.filter((d) => {
            if (despesaEstaPaga(d)) return false;
            const ts = dataVencimentoTsDespesa(d);
            if (ts == null) return false;
            return ts <= tsLimite;
        });
    }

    async function perguntarPrazoExportRelatorioDespesas() {
        const result = await Swal.fire({
            title: '📅 Período para exportar',
            html: ''
                + '<p style="font-size:13px;margin:0 0 14px 0;color:#555;text-align:left;">Escolha quais vencimentos incluir no PDF/Excel (com base na data de vencimento):</p>'
                + '<label style="display:block;text-align:left;margin:8px 0;padding:10px;border:1px solid #e0e6ed;border-radius:8px;cursor:pointer;">'
                + '<input type="radio" name="prazo-export-rel" value="10" checked style="margin-right:8px;">'
                + '<b>Próximos 10 dias</b> <span style="font-size:12px;color:#666;">— pendentes/vencidas com vencimento até 10 dias</span></label>'
                + '<label style="display:block;text-align:left;margin:8px 0;padding:10px;border:1px solid #e0e6ed;border-radius:8px;cursor:pointer;">'
                + '<input type="radio" name="prazo-export-rel" value="30" style="margin-right:8px;">'
                + '<b>Próximos 30 dias</b> <span style="font-size:12px;color:#666;">— pendentes/vencidas com vencimento até 30 dias</span></label>'
                + '<label style="display:block;text-align:left;margin:8px 0;padding:10px;border:1px solid #e0e6ed;border-radius:8px;cursor:pointer;">'
                + '<input type="radio" name="prazo-export-rel" value="total" style="margin-right:8px;">'
                + '<b>Total</b> <span style="font-size:12px;color:#666;">— tudo que está na tabela carregada</span></label>',
            showCancelButton: true,
            confirmButtonText: 'Exportar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1a2a43',
            focusConfirm: false,
            preConfirm: () => {
                const sel = document.querySelector('input[name="prazo-export-rel"]:checked');
                if (!sel) {
                    Swal.showValidationMessage('Selecione um período.');
                    return false;
                }
                return sel.value;
            }
        });
        if (!result.isConfirmed || !result.value) return null;
        return result.value;
    }

    function rotuloSufixoPrazoExportRelDespesas(prazo) {
        if (prazo === '10') return '_prox_10_dias';
        if (prazo === '30') return '_prox_30_dias';
        return '_total';
    }

    function rotuloPrazoExportRelDespesas(prazo) {
        if (prazo === '10') return 'Próximos 10 dias';
        if (prazo === '30') return 'Próximos 30 dias';
        return 'Total';
    }

    window.exportarPDFRelatorioDespesasTabelaAtual = async function () {
        const arr = window._despesasRelatorioExport;
        if (!arr || !arr.length) return Swal.fire('Atenção', 'Carregue a tabela primeiro (botão "Carregar tabela").', 'warning');

        const prazo = await perguntarPrazoExportRelatorioDespesas();
        if (!prazo) return;

        const filtrado = filtrarRelDespesasPorPrazoExportacao(arr, prazo);
        if (!filtrado.length) {
            return Swal.fire('Sem registros', 'Nenhuma despesa encontrada para o período "' + rotuloPrazoExportRelDespesas(prazo) + '".', 'info');
        }

        window.dadosExportacaoDespesas = filtrado.slice();
        window._sufixoExportDespesas = rotuloSufixoPrazoExportRelDespesas(prazo);
        window._tituloExtraExportDespesas = rotuloPrazoExportRelDespesas(prazo);
        exportarPDF('despesas');
        window._sufixoExportDespesas = '';
        window._tituloExtraExportDespesas = '';
    };

    function nomeArquivoExcelSeguro(nome) {
        return String(nome || 'despesas')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[<>:"/\\|?*]+/g, '_')
            .replace(/\s+/g, '_')
            .slice(0, 80);
    }

    function montarDadosExcelDespesas(arr, opts) {
        const copia = (arr || []).slice();
        if (!opts || !opts.manterOrdem) {
            ordenarRelatorioDespesasPorVencimento(copia);
        }
        return copia.map((row) => {
            const pago = despesaEstaPaga(row);
            const vencida = !pago && despesaEstaVencida(row);
            const estado = pago ? 'Pago' : (vencida ? 'Vencida' : 'Pendente');
            const valorNum = Number(parseMoedaLocal(row.valor_string) || row.valor_numero || 0);
            let situacao = estado;
            if (!pago) {
                situacao = despesaEstaVencida(row) ? 'Vencida' : 'A vencer';
            }
            return {
                'Obra': row.obra_nome || '',
                'Fornecedor / Loja': row.loja_nome || '',
                'Cheque / Boleto / NF': refChequeBoletoDesp(row),
                'Vencimento': formatarVencimentoDespesaExibir(row),
                'Lançamento': diaLancamentoDespExibir(row),
                'Valor (R$)': valorNum,
                'Estado': estado,
                'Data pagamento': pago ? (obterDataPagamentoDespesa(row) || '') : '',
                'Situação': situacao,
                'Descrição / Materiais': row.descricao || '',
                'Observação': row.observacao || '',
                'Data inserção': row.data || ''
            };
        });
    }

    function exportarArquivoExcelDespesas(linhas, nomeArquivo) {
        if (!window.XLSX) {
            return Swal.fire('Erro', 'Biblioteca Excel não carregou. Recarregue a página (Ctrl+F5).', 'error');
        }
        if (!linhas || !linhas.length) {
            return Swal.fire('Atenção', 'Não há despesas para exportar. Faça a busca ou carregue a tabela primeiro.', 'warning');
        }

        const ws = XLSX.utils.json_to_sheet(linhas);
        const colunas = Object.keys(linhas[0]);
        ws['!cols'] = [
            { wch: 30 },
            { wch: 28 },
            { wch: 24 },
            { wch: 14 },
            { wch: 14 },
            { wch: 14 },
            { wch: 12 },
            { wch: 14 },
            { wch: 12 },
            { wch: 40 },
            { wch: 30 },
            { wch: 14 }
        ];

        const range = XLSX.utils.decode_range(ws['!ref']);
        const idxValor = colunas.indexOf('Valor (R$)');
        if (idxValor >= 0) {
            for (let r = range.s.r + 1; r <= range.e.r; r += 1) {
                const addr = XLSX.utils.encode_cell({ r, c: idxValor });
                if (ws[addr] && typeof ws[addr].v === 'number') {
                    ws[addr].t = 'n';
                    ws[addr].z = '#,##0.00';
                }
            }
        }

        const total = linhas.reduce((s, linha) => s + (Number(linha['Valor (R$)']) || 0), 0);
        const linhaTotal = range.e.r + 2;
        const addrLabel = XLSX.utils.encode_cell({ r: linhaTotal, c: Math.max(0, idxValor - 1) });
        const addrTotal = XLSX.utils.encode_cell({ r: linhaTotal, c: idxValor });
        ws[addrLabel] = { t: 's', v: 'TOTAL (R$)' };
        ws[addrTotal] = { t: 'n', v: total, z: '#,##0.00' };
        const novoFim = XLSX.utils.encode_cell({ r: linhaTotal, c: range.e.c });
        ws['!ref'] = `${ws['!ref'].split(':')[0]}:${novoFim}`;
        ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: range.e.r, c: range.e.c } }) };

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Despesas');
        XLSX.writeFile(wb, `${nomeArquivoExcelSeguro(nomeArquivo)}.xlsx`);

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Excel exportado com sucesso!',
            showConfirmButton: false,
            timer: 2500
        });
    }

    window.exportarExcelDespesasBusca = function () {
        const dados = window.dadosExportacaoDespesas;
        const empresa = getEmpresaGestor() || 'Empresa';
        const termo = (document.getElementById('busca-obra') && document.getElementById('busca-obra').value || 'despesas').trim();
        exportarArquivoExcelDespesas(
            montarDadosExcelDespesas(dados),
            `despesas_${empresa}_${termo || 'busca'}`
        );
    };

    window.exportarExcelRelatorioDespesasTabelaAtual = async function () {
        const arr = window._despesasRelatorioExport;
        if (!arr || !arr.length) {
            return Swal.fire('Atenção', 'Carregue a tabela primeiro (botão "Carregar tabela").', 'warning');
        }

        const prazo = await perguntarPrazoExportRelatorioDespesas();
        if (!prazo) return;

        const filtrado = filtrarRelDespesasPorPrazoExportacao(arr, prazo);
        if (!filtrado.length) {
            return Swal.fire('Sem registros', 'Nenhuma despesa encontrada para o período "' + rotuloPrazoExportRelDespesas(prazo) + '".', 'info');
        }

        const empresa = getEmpresaGestor() || 'Empresa';
        exportarArquivoExcelDespesas(
            montarDadosExcelDespesas(filtrado, { manterOrdem: true }),
            `relatorio_despesas_${empresa}${rotuloSufixoPrazoExportRelDespesas(prazo)}`
        );
    };

    function ocultarQuadroControlesDespesas() {
        const quadro = document.getElementById('quadro-controles-despesas');
        const divSecoes = document.getElementById('quadro-controles-secoes');
        const divAviso = document.getElementById('quadro-controles-aviso');
        if (quadro) quadro.style.display = 'none';
        if (divSecoes) divSecoes.innerHTML = '';
        if (divAviso) divAviso.innerHTML = '';
    }

    function renderizarQuadroControlesDespesas(htmlVencidas, htmlAVencer, htmlPagas, avisoAnosHtml) {
        const quadro = document.getElementById('quadro-controles-despesas');
        const divSecoes = document.getElementById('quadro-controles-secoes');
        const divAviso = document.getElementById('quadro-controles-aviso');
        if (!quadro || !divSecoes) return;

        let html = '';
        if (htmlVencidas) {
            html += `<details class="secao-despesas-busca secao-vencidas" open><summary>🔴 Contas Vencidas — por vencimento <span class="secao-seta">▲</span></summary><div class="secao-despesas-conteudo">${htmlVencidas}</div></details>`;
        }
        if (htmlAVencer) {
            html += `<details class="secao-despesas-busca secao-avencer"${htmlVencidas ? '' : ' open'}><summary>🟡 Contas a Vencer (No Prazo) — por vencimento <span class="secao-seta">▲</span></summary><div class="secao-despesas-conteudo">${htmlAVencer}</div></details>`;
        }
        if (htmlPagas) {
            html += `<details class="secao-despesas-busca secao-pagas"${htmlVencidas ? '' : ' open'}><summary>🟢 Histórico de Contas Pagas <span class="secao-seta">▲</span></summary><div class="secao-despesas-conteudo">${htmlPagas}</div></details>`;
        }

        if (!html) {
            ocultarQuadroControlesDespesas();
            return;
        }

        quadro.style.display = 'block';
        if (divAviso) divAviso.innerHTML = avisoAnosHtml || '';
        divSecoes.innerHTML = html;
    }

    function htmlCardDespesaRelGeralObra(d, isVencida) {
        const orig = d._valor_original != null ? Number(d._valor_original) : valorOriginalDespesa(d);
        const pagoParc = d._valor_pago != null ? Number(d._valor_pago) : valorPagoComTerceirosDespesa(d);
        const saldo = d.valor_numero != null ? Number(d.valor_numero) : valorEmAbertoComTerceirosDespesa(d);
        const ehParcial = pagoParc > 0.009 && saldo > 0.009;
        const corBorda = ehParcial ? '#17a2b8' : (isVencida ? '#dc3545' : '#ffc107');
        const corTexto = ehParcial ? '#0c5460' : (isVencida ? '#dc3545' : '#856404');
        const badgeFundo = ehParcial ? '#d1ecf1' : (isVencida ? '#f8d7da' : '#fff3cd');
        const textoBadge = ehParcial ? '💙 PARCIAL' : (isVencida ? '⚠️ VENCIDA' : '⏳ A VENCER');
        const vencTexto = formatarVencimentoDespesaExibirHtml(d);
        const fotoHtml = d.foto_recibo
            ? '<img src="' + escapeAttrBasico(d.foto_recibo) + '" onclick="abrirFoto(\'' + String(d.foto_recibo).replace(/'/g, "\\'") + '\')" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:2px solid #e0e6ed;float:right;cursor:pointer;">'
            : '';
        const resumoParc = pagoParc > 0.009
            ? '<span style="font-size:12px;color:#555;">Contrato: <b>' + formatarMoeda(orig) + '</b> · Já pago: <b style="color:#28a745;">' + formatarMoeda(pagoParc) + '</b> · Saldo: <b style="color:#c0392b;">' + formatarMoeda(saldo) + '</b></span><br>'
            : '';
        return ''
            + '<div class="resultado-item" style="border-left-color:' + corBorda + ';">'
            + fotoHtml
            + '<span style="font-size:10px;background:#e8edf2;color:#1a2a43;padding:2px 6px;border-radius:4px;font-weight:bold;">🏪 FORNECEDOR</span> '
            + '<b style="color:' + corBorda + ';font-size:16px;">' + formatarMoeda(saldo) + '</b> '
            + '<span style="font-size:10px;background:' + badgeFundo + ';color:' + corTexto + ';padding:2px 6px;border-radius:4px;margin-left:5px;font-weight:bold;">' + textoBadge + '</span><br>'
            + resumoParc
            + '<span style="font-size:13px;color:#555;"><b>Obra:</b> ' + escapeHtmlBasico(d.obra_nome || '—') + '</span><br>'
            + '<span style="font-size:13px;color:#555;"><b>Fornecedor:</b> ' + escapeHtmlBasico(d.loja_nome || '—') + '</span><br>'
            + '<span style="font-size:13px;color:#555;"><b>Nota Fiscal:</b> ' + escapeHtmlBasico(d.nota_fiscal || 'Sem NF') + '</span><br>'
            + '<span style="font-size:13px;color:' + corTexto + ';"><b>Vencimento:</b> ' + vencTexto + '</span><br>'
            + '<span style="font-size:12px;color:#888;">Inserido em: ' + escapeHtmlBasico(d.data || '—') + '</span>'
            + (d.descricao ? '<div style="font-size:12px;margin-top:5px;padding-top:5px;border-top:1px solid #eee;">' + escapeHtmlBasico(String(d.descricao)) + '</div>' : '')
            + '</div>';
    }

    function idEstavelPagamentoParcial(p, idx) {
        if (p && p.id) return String(p.id);
        if (p && p.timestamp) return 'ts_' + String(p.timestamp);
        return 'i_' + String(idx) + '_' + String((p && p.valor) || 0) + '_' + String((p && p.data) || '');
    }

    function itemDePagamentoParcialRelGeral(despesa, parcial, idx) {
        const valor = Number(parcial && parcial.valor) || parseMoedaLocal((parcial && parcial.valor_string) || '0') || 0;
        const dataBr = (parcial && parcial.data) || '';
        const parcialId = idEstavelPagamentoParcial(parcial, idx);
        const compGrupo = (parcial && parcial.comprovante_pagamento) || comprovanteDoGrupoParcial(despesa, parcial);
        const extraGrupo = (parcial && parcial.grupo_comprovante)
            ? ' · mesmo comprovante' + (parcial.valor_comprovante ? ' ' + formatarMoeda(parcial.valor_comprovante) : '')
            : '';
        return {
            id: String(despesa.id) + '_pp_' + parcialId,
            _origem: 'pagamento_parcial',
            _despesa_id: despesa.id,
            _parcial_id: parcialId,
            _grupo_comprovante: (parcial && parcial.grupo_comprovante) || '',
            status: 'pago',
            obra_nome: despesa.obra_nome || '',
            loja_nome: despesa.loja_nome || '',
            nota_fiscal: despesa.nota_fiscal || '',
            data_pagamento: dataBr,
            data: dataBr || despesa.data || '',
            valor_numero: valor,
            valor_string: formatarMoeda(valor).replace(/^R\$\s?/, ''),
            descricao: ((parcial && parcial.observacao) ? String(parcial.observacao) : 'Pagamento parcial')
                + extraGrupo
                + ' — contrato ' + formatarMoeda(valorOriginalDespesa(despesa)),
            comprovante_pagamento: compGrupo || null,
            comprovante_ref: (parcial && parcial.comprovante_ref) || (function () {
                const gid = parcial && parcial.grupo_comprovante;
                if (!gid) return '';
                const irmao = listaPagamentosParciaisDespesa(despesa).find(function (x) {
                    return x && x.grupo_comprovante === gid && x.comprovante_ref;
                });
                return (irmao && irmao.comprovante_ref) || '';
            })(),
            baixa_sem_comprovante: !!(parcial && parcial.baixa_sem_comprovante),
            foto_recibo: null,
            timestamp: (parcial && parcial.timestamp) || 0
        };
    }

    function htmlCardDespesaPagaRelGeralObra(d) {
        const ehParcial = d && d._origem === 'pagamento_parcial';
        const compPgtoHtml = typeof montarHtmlComprovantePagamento === 'function' ? montarHtmlComprovantePagamento(d) : '';
        const fotoHtml = d.foto_recibo
            ? '<img src="' + escapeAttrBasico(d.foto_recibo) + '" onclick="abrirFoto(\'' + String(d.foto_recibo).replace(/'/g, "\\'") + '\')" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:2px solid #e0e6ed;float:right;cursor:pointer;">'
            : '';
        const badge = ehParcial
            ? '<span style="font-size:10px;background:#17a2b8;color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold;">💙 PAGAMENTO PARCIAL</span> '
            : '<span style="font-size:10px;background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;font-weight:bold;">🏪 FORNECEDOR</span> ';
        return ''
            + '<div class="resultado-item" style="border-left-color:' + (ehParcial ? '#17a2b8' : '#28a745') + ';opacity:0.9;background:' + (ehParcial ? '#f0f9ff' : '#f4fdf6') + ';">'
            + fotoHtml + compPgtoHtml
            + badge
            + '<b style="color:#28a745;font-size:16px;">R$ ' + escapeHtmlBasico(String(d.valor_string || '0')) + '</b> '
            + '<span style="font-size:10px;background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;margin-left:5px;font-weight:bold;">PAGO EM: ' + escapeHtmlBasico(d.data_pagamento || 'N/A') + '</span><br>'
            + '<span style="font-size:13px;color:#555;"><b>Obra:</b> ' + escapeHtmlBasico(d.obra_nome || '—') + '</span><br>'
            + '<span style="font-size:13px;color:#555;"><b>Fornecedor:</b> ' + escapeHtmlBasico(d.loja_nome || '—') + '</span><br>'
            + '<span style="font-size:13px;color:#555;"><b>Nota Fiscal:</b> ' + escapeHtmlBasico(d.nota_fiscal || 'Sem NF') + '</span><br>'
            + '<span style="font-size:12px;color:#888;">Data: ' + escapeHtmlBasico(d.data || '—') + '</span>'
            + (d.descricao ? '<div style="font-size:12px;margin-top:5px;padding-top:5px;border-top:1px solid #eee;color:#666;">' + escapeHtmlBasico(String(d.descricao)) + '</div>' : '')
            + (ehParcial && d._despesa_id && d._parcial_id
                ? '<div style="margin-top:10px;padding-top:8px;border-top:1px solid #d6eaf8;">'
                    + '<label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#0c5460;cursor:pointer;margin:0 0 8px 0;">'
                    + '<input type="checkbox" class="chk-parcial-sel" data-despesa-id="' + escapeAttrBasico(d._despesa_id) + '" data-parcial-id="' + encodeURIComponent(d._parcial_id) + '" data-rotulo="' + escapeAttrBasico((d.data_pagamento || d.data || '') + ' — R$ ' + String(d.valor_string || '0') + ' · ' + (d.loja_nome || '')) + '" style="width:16px;height:16px;margin:0;flex-shrink:0;"> Selecionar este parcial'
                    + '</label>'
                    + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
                    + '<button type="button" onclick="editarPagamentoParcialDespesa(\'' + escapeAttrBasico(d._despesa_id) + '\',\'' + encodeURIComponent(d._parcial_id) + '\')" style="background:#4285F4;color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;font-weight:800;font-size:12px;flex:1;min-width:120px;">✏️ Editar valor</button>'
                    + '<button type="button" onclick="discriminarPagamentoParcialDespesa(\'' + escapeAttrBasico(d._despesa_id) + '\',\'' + encodeURIComponent(d._parcial_id) + '\')" style="background:#856404;color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;font-weight:800;font-size:12px;flex:1;min-width:140px;">📋 Discriminar</button>'
                    + '<button type="button" onclick="excluirPagamentoParcialDespesa(\'' + escapeAttrBasico(d._despesa_id) + '\',\'' + encodeURIComponent(d._parcial_id) + '\')" style="background:#c0392b;color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;font-weight:800;font-size:12px;flex:1;min-width:120px;">🗑️ Excluir este</button>'
                    + '</div></div>'
                : '')
            + '</div>';
    }

    function htmlCardTerceiroRelGeralObra(d) {
        return ''
            + '<div class="resultado-item" style="border-left-color:#1a2a43;background:#f8f9fb;">'
            + '<span style="font-size:10px;background:#1a2a43;color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold;">👷 TERCEIRO — PAGO</span> '
            + '<b style="color:#28a745;font-size:16px;">R$ ' + escapeHtmlBasico(String(d.valor_string || '0')) + '</b><br>'
            + '<span style="font-size:13px;color:#555;"><b>Profissional:</b> ' + escapeHtmlBasico(d.nome || '—') + '</span><br>'
            + '<span style="font-size:13px;color:#555;"><b>Obra:</b> ' + escapeHtmlBasico(d.obra || '—') + '</span><br>'
            + '<span style="font-size:13px;color:#555;"><b>CPF:</b> ' + escapeHtmlBasico(d.cpf || 'N/A') + ' · <b>Tel:</b> ' + escapeHtmlBasico(d.tel || 'N/A') + '</span><br>'
            + '<span style="font-size:12px;color:#888;">Pago em: ' + escapeHtmlBasico(d.data || '—') + '</span>'
            + (d.descricao ? '<div style="font-size:12px;margin-top:5px;padding-top:5px;border-top:1px solid #eee;">' + escapeHtmlBasico(String(d.descricao)) + '</div>' : '')
            + '</div>';
    }

    window.toggleSecoesRelGeralObras = function (abrir) {
        const quadro = document.getElementById('rel-geral-obras-quadro');
        if (!quadro) return;
        quadro.querySelectorAll('details').forEach((det) => {
            if (abrir) det.setAttribute('open', '');
            else det.removeAttribute('open');
        });
    };

    function chaveMesAnoDeDataStrRelGeral(dataStr) {
        const s = separarDataSegura(dataStr);
        if (!s || !s.ano || s.ano === 'Outros' || !s.mes || s.mes === 'Outros') return '';
        return String(s.mes).padStart(2, '0') + '/' + String(s.ano);
    }

    /** Mês/ano de referência do item no Relatório Geral de Obras. */
    function chaveMesAnoItemRelGeralObras(d, tipo) {
        if (!d) return '';
        if (tipo === 'terceiro') {
            return chaveMesAnoDeDataStrRelGeral(d.data || '');
        }
        if (tipo === 'pago') {
            return chaveMesAnoDeDataStrRelGeral(d.data_pagamento || obterDataVencimentoDespesa(d) || d.data || '');
        }
        // vencido / a vencer: data de vencimento
        const venc = formatarVencimentoDespesaExibir(d);
        if (venc && venc !== '—') return chaveMesAnoDeDataStrRelGeral(venc);
        return chaveMesAnoDeDataStrRelGeral(obterDataVencimentoDespesa(d) || d.data || '');
    }

    function listarPeriodosDisponiveisRelGeralObras(pack) {
        const set = new Set();
        (pack.vencidas || []).forEach((d) => {
            const k = chaveMesAnoItemRelGeralObras(d, 'vencido');
            if (k) set.add(k);
        });
        (pack.aVencer || []).forEach((d) => {
            const k = chaveMesAnoItemRelGeralObras(d, 'avencer');
            if (k) set.add(k);
        });
        (pack.pagasForn || []).forEach((d) => {
            const k = chaveMesAnoItemRelGeralObras(d, 'pago');
            if (k) set.add(k);
        });
        (pack.terceiros || []).forEach((d) => {
            const k = chaveMesAnoItemRelGeralObras(d, 'terceiro');
            if (k) set.add(k);
        });
        return Array.from(set).sort((a, b) => {
            const [ma, aa] = a.split('/');
            const [mb, ab] = b.split('/');
            if (aa !== ab) return Number(ab) - Number(aa);
            return Number(mb) - Number(ma);
        });
    }

    function rotuloPeriodoMesAnoRelGeral(chaveMMYYYY) {
        if (!chaveMMYYYY || chaveMMYYYY === 'todos') return 'Todos os períodos';
        const partes = String(chaveMMYYYY).split('/');
        const mes = partes[0];
        const ano = partes[1];
        const nome = (nomeMeses && (nomeMeses[mes] || nomeMeses[String(Number(mes))])) || mes;
        return String(nome) + ' de ' + String(ano);
    }

    function mesAnoParaIndiceRelGeral(chaveMMYYYY) {
        const partes = String(chaveMMYYYY || '').split('/');
        const mes = Number(partes[0]);
        const ano = Number(partes[1]);
        if (!Number.isFinite(mes) || !Number.isFinite(ano) || mes < 1 || mes > 12) return null;
        return ano * 12 + mes;
    }

    function chaveMesAnoDentroIntervaloRelGeral(chave, inicioMMYYYY, fimMMYYYY) {
        if (!chave) return false;
        const n = mesAnoParaIndiceRelGeral(chave);
        const a = mesAnoParaIndiceRelGeral(inicioMMYYYY);
        const b = mesAnoParaIndiceRelGeral(fimMMYYYY);
        if (n == null || a == null || b == null) return false;
        const min = Math.min(a, b);
        const max = Math.max(a, b);
        return n >= min && n <= max;
    }

    function rotuloPeriodoIntervaloRelGeral(inicioMMYYYY, fimMMYYYY) {
        if (!inicioMMYYYY && !fimMMYYYY) return 'Todos os períodos';
        if (inicioMMYYYY && fimMMYYYY && inicioMMYYYY === fimMMYYYY) {
            return rotuloPeriodoMesAnoRelGeral(inicioMMYYYY);
        }
        return 'De ' + rotuloPeriodoMesAnoRelGeral(inicioMMYYYY) + ' até ' + rotuloPeriodoMesAnoRelGeral(fimMMYYYY);
    }

    function tsDataBrRelGeral(dataStr) {
        const s = separarDataSegura(dataStr);
        if (!s || s.ano === 'Outros' || s.mes === 'Outros') return Number.MAX_SAFE_INTEGER;
        const dia = parseInt(String(s.dia).replace(/\D/g, ''), 10) || 1;
        const mes = parseInt(s.mes, 10) || 1;
        const ano = parseInt(s.ano, 10) || 0;
        if (!ano) return Number.MAX_SAFE_INTEGER;
        return Date.UTC(ano, mes - 1, Math.min(Math.max(dia, 1), 31));
    }

    function ordenarListaRelGeralPorData(arr, tipo) {
        return (arr || []).slice().sort((a, b) => {
            let da;
            let db;
            if (tipo === 'terceiro') {
                da = tsDataBrRelGeral(a.data);
                db = tsDataBrRelGeral(b.data);
            } else if (tipo === 'pago') {
                da = tsDataBrRelGeral(a.data_pagamento || a.data);
                db = tsDataBrRelGeral(b.data_pagamento || b.data);
            } else {
                da = dataVencimentoTsDespesa(a);
                db = dataVencimentoTsDespesa(b);
                if (da == null) da = tsDataBrRelGeral(a.data);
                if (db == null) db = tsDataBrRelGeral(b.data);
            }
            if (da !== db) return da - db;
            return String(a.obra_nome || a.obra || a.loja_nome || a.nome || '')
                .localeCompare(String(b.obra_nome || b.obra || b.loja_nome || b.nome || ''), 'pt-BR');
        });
    }

    /**
     * periodoOuOpcoes:
     * - 'todos' | 'MM/YYYY' (compatível)
     * - { periodo:'todos'|'MM/YYYY', periodoInicio:'MM/YYYY', periodoFim:'MM/YYYY' }
     */
    function filtrarPackRelGeralObrasPorPeriodo(pack, periodoOuOpcoes) {
        let periodoInicio = null;
        let periodoFim = null;
        let periodoChave = 'todos';

        if (periodoOuOpcoes && typeof periodoOuOpcoes === 'object') {
            if (periodoOuOpcoes.periodoInicio && periodoOuOpcoes.periodoFim) {
                periodoInicio = periodoOuOpcoes.periodoInicio;
                periodoFim = periodoOuOpcoes.periodoFim;
                periodoChave = periodoInicio === periodoFim
                    ? periodoInicio
                    : (periodoInicio + '_a_' + periodoFim);
            } else if (periodoOuOpcoes.periodo && periodoOuOpcoes.periodo !== 'todos') {
                periodoInicio = periodoFim = periodoOuOpcoes.periodo;
                periodoChave = periodoOuOpcoes.periodo;
            }
        } else if (typeof periodoOuOpcoes === 'string' && periodoOuOpcoes && periodoOuOpcoes !== 'todos') {
            periodoInicio = periodoFim = periodoOuOpcoes;
            periodoChave = periodoOuOpcoes;
        }

        if (!periodoInicio || !periodoFim) {
            return Object.assign({}, pack, {
                periodoLabel: 'Todos os períodos',
                periodoChave: 'todos',
                vencidas: ordenarListaRelGeralPorData(pack.vencidas, 'vencido'),
                aVencer: ordenarListaRelGeralPorData(pack.aVencer, 'avencer'),
                pagasForn: ordenarListaRelGeralPorData(pack.pagasForn, 'pago'),
                terceiros: ordenarListaRelGeralPorData(pack.terceiros, 'terceiro')
            });
        }

        // Garante ordem cronológica do intervalo (ex.: jan→ago)
        if (mesAnoParaIndiceRelGeral(periodoInicio) > mesAnoParaIndiceRelGeral(periodoFim)) {
            const tmp = periodoInicio;
            periodoInicio = periodoFim;
            periodoFim = tmp;
        }

        const passa = (d, tipo) => chaveMesAnoDentroIntervaloRelGeral(
            chaveMesAnoItemRelGeralObras(d, tipo),
            periodoInicio,
            periodoFim
        );

        const vencidas = ordenarListaRelGeralPorData(
            (pack.vencidas || []).filter((d) => passa(d, 'vencido')),
            'vencido'
        );
        const aVencer = ordenarListaRelGeralPorData(
            (pack.aVencer || []).filter((d) => passa(d, 'avencer')),
            'avencer'
        );
        const pagasForn = ordenarListaRelGeralPorData(
            (pack.pagasForn || []).filter((d) => passa(d, 'pago')),
            'pago'
        );
        const terceiros = ordenarListaRelGeralPorData(
            (pack.terceiros || []).filter((d) => passa(d, 'terceiro')),
            'terceiro'
        );

        const somaVencidas = vencidas.reduce((s, d) => s + (Number(d.valor_numero) || parseMoedaLocal(d.valor_string) || 0), 0);
        const somaAVencer = aVencer.reduce((s, d) => s + (Number(d.valor_numero) || parseMoedaLocal(d.valor_string) || 0), 0);
        const somaPagasForn = pagasForn.reduce((s, d) => s + (Number(d.valor_numero) || parseMoedaLocal(d.valor_string) || 0), 0);
        const somaPagasTerc = terceiros.reduce((s, d) => s + (Number(d.valor_numero) || parseMoedaLocal(d.valor_string) || 0), 0);
        const somaPagas = somaPagasForn + somaPagasTerc;

        return {
            empresa: pack.empresa,
            somaVencidas,
            somaAVencer,
            somaPagas,
            somaPagasForn,
            somaPagasTerc,
            emAberto: somaVencidas + somaAVencer,
            totalGeral: somaVencidas + somaAVencer + somaPagas,
            vencidas,
            aVencer,
            pagasForn,
            terceiros,
            periodoLabel: rotuloPeriodoIntervaloRelGeral(periodoInicio, periodoFim),
            periodoChave: periodoChave,
            periodoInicio: periodoInicio,
            periodoFim: periodoFim
        };
    }

    function montarOptsMesAnoRelGeral(anos, mesSelecionado, anoSelecionado) {
        let optsMes = '';
        for (let m = 1; m <= 12; m += 1) {
            const mm = String(m).padStart(2, '0');
            const nome = (nomeMeses && (nomeMeses[mm] || nomeMeses[String(m)])) || mm;
            const sel = mm === String(mesSelecionado).padStart(2, '0') ? ' selected' : '';
            optsMes += '<option value="' + mm + '"' + sel + '>' + escapeHtmlBasico(String(nome)) + '</option>';
        }
        let optsAno = '';
        (anos || []).forEach((a) => {
            const sel = String(a) === String(anoSelecionado) ? ' selected' : '';
            optsAno += '<option value="' + escapeAttrBasico(a) + '"' + sel + '>' + escapeHtmlBasico(String(a)) + '</option>';
        });
        return { optsMes: optsMes, optsAno: optsAno };
    }

    async function perguntarOpcoesExportRelGeralObras(pack, config) {
        const cfg = config || {};
        const prefix = cfg.prefix || 'rel-geral-export';
        const mostrarPeriodo = cfg.mostrarPeriodo !== false;
        const cntVenc = (pack.vencidas || []).length;
        const cntAvencer = (pack.aVencer || []).length;
        const cntPagos = (pack.pagasForn || []).length + (pack.terceiros || []).length;

        const periodos = mostrarPeriodo ? listarPeriodosDisponiveisRelGeralObras(pack) : [];
        const agora = new Date();
        const mesAtual = String(agora.getMonth() + 1).padStart(2, '0');
        const anoAtual = String(agora.getFullYear());
        const mesAnoAtual = mesAtual + '/' + anoAtual;
        const periodoPadrao = periodos.includes(mesAnoAtual) ? mesAnoAtual : (periodos[0] || mesAnoAtual);

        let htmlPeriodo = '';
        if (mostrarPeriodo) {
            let optsPeriodo = '<option value="todos">Todos os períodos</option>';
            periodos.forEach((p) => {
                const sel = p === periodoPadrao ? ' selected' : '';
                optsPeriodo += '<option value="' + escapeAttrBasico(p) + '"' + sel + '>' + escapeHtmlBasico(rotuloPeriodoMesAnoRelGeral(p)) + '</option>';
            });

            const anosSet = new Set(periodos.map((p) => p.split('/')[1]).filter(Boolean));
            anosSet.add(anoAtual);
            anosSet.add(String(agora.getFullYear() - 1));
            anosSet.add(String(agora.getFullYear() + 1));
            const anos = Array.from(anosSet).sort((a, b) => Number(b) - Number(a));

            const dePadrao = periodos.length ? periodos[periodos.length - 1] : ('01/' + anoAtual);
            const atePadrao = periodoPadrao;
            const deMes = (dePadrao.split('/')[0] || '01');
            const deAno = (dePadrao.split('/')[1] || anoAtual);
            const ateMes = (atePadrao.split('/')[0] || mesAtual);
            const ateAno = (atePadrao.split('/')[1] || anoAtual);
            const optsDe = montarOptsMesAnoRelGeral(anos, deMes, deAno);
            const optsAte = montarOptsMesAnoRelGeral(anos, ateMes, ateAno);

            const selCss = 'width:100%;box-sizing:border-box;margin:0;height:38px;font-size:13px;padding:6px 8px;border:1px solid #ced4da;border-radius:8px;background:#fff;';
            htmlPeriodo = ''
                + '<div id="' + prefix + '-box-periodo" class="export-rel-box" style="text-align:left;margin:0 0 12px 0;padding:12px;border:1px solid #cfe2ff;border-radius:10px;background:#f0f7ff;">'
                + '<div style="font-size:13px;font-weight:700;color:#1a2a43;margin:0 0 10px 0;">📅 Período do relatório</div>'
                + '<table style="width:100%;border-collapse:collapse;margin:0 0 12px 0;">'
                + '<tr><td style="width:28px;vertical-align:middle;padding:6px 0;"><input type="radio" name="' + prefix + '-modo-periodo" id="' + prefix + '-modo-todos" value="todos" style="width:18px;height:18px;margin:0;"></td>'
                + '<td style="vertical-align:middle;padding:6px 0 6px 8px;"><label for="' + prefix + '-modo-todos" style="font-size:13px;cursor:pointer;display:block;">Todos os períodos</label></td></tr>'
                + '<tr><td style="width:28px;vertical-align:middle;padding:6px 0;"><input type="radio" name="' + prefix + '-modo-periodo" id="' + prefix + '-modo-um" value="um" style="width:18px;height:18px;margin:0;"></td>'
                + '<td style="vertical-align:middle;padding:6px 0 6px 8px;"><label for="' + prefix + '-modo-um" style="font-size:13px;cursor:pointer;display:block;">Um mês só</label></td></tr>'
                + '<tr><td style="width:28px;vertical-align:middle;padding:6px 0;"><input type="radio" name="' + prefix + '-modo-periodo" id="' + prefix + '-modo-intervalo" value="intervalo" checked style="width:18px;height:18px;margin:0;"></td>'
                + '<td style="vertical-align:middle;padding:6px 0 6px 8px;"><label for="' + prefix + '-modo-intervalo" style="font-size:13px;cursor:pointer;display:block;"><b>De um mês até outro</b> <span style="color:#666;font-weight:400;">(ex.: janeiro → agosto)</span></label></td></tr>'
                + '</table>'
                + '<div id="' + prefix + '-bloco-um" style="display:none;margin-top:4px;">'
                + '<div style="font-size:11px;color:#555;margin:0 0 4px 0;">Mês único</div>'
                + '<select id="' + prefix + '-periodo" style="' + selCss + '">' + optsPeriodo + '</select>'
                + '</div>'
                + '<div id="' + prefix + '-bloco-intervalo" style="margin-top:4px;">'
                + '<table style="width:100%;border-collapse:separate;border-spacing:0 0;"><tr>'
                + '<td style="width:50%;padding:0 6px 0 0;vertical-align:top;">'
                + '<div style="font-size:11px;font-weight:700;color:#1a2a43;margin:0 0 4px 0;">DE</div>'
                + '<select id="' + prefix + '-mes-de" style="' + selCss + ' margin-bottom:6px;">' + optsDe.optsMes + '</select>'
                + '<select id="' + prefix + '-ano-de" style="' + selCss + '">' + optsDe.optsAno + '</select>'
                + '</td>'
                + '<td style="width:50%;padding:0 0 0 6px;vertical-align:top;">'
                + '<div style="font-size:11px;font-weight:700;color:#1a2a43;margin:0 0 4px 0;">ATÉ</div>'
                + '<select id="' + prefix + '-mes-ate" style="' + selCss + ' margin-bottom:6px;">' + optsAte.optsMes + '</select>'
                + '<select id="' + prefix + '-ano-ate" style="' + selCss + '">' + optsAte.optsAno + '</select>'
                + '</td></tr></table>'
                + '<p style="font-size:11px;color:#0c5460;margin:10px 0 0 0;line-height:1.4;">Ex.: <b>Janeiro/2026</b> até <b>Agosto/2026</b> — todos os meses do intervalo, em ordem de data.</p>'
                + '</div>'
                + '<p style="font-size:11px;color:#888;margin:10px 0 0 0;line-height:1.4;">Pendentes pelo <b>vencimento</b> · Pagos pela <b>data de pagamento</b>.</p>'
                + '</div>';
        }

        const result = await Swal.fire({
            title: cfg.titulo || 'Exportar espelho',
            html: ''
                + '<style>'
                + '.swal2-html-container input[type=radio]{'
                + 'appearance:radio!important;-webkit-appearance:radio!important;width:18px!important;height:18px!important;'
                + 'min-width:18px!important;max-width:18px!important;margin:0!important;padding:0!important;'
                + 'display:inline-block!important;vertical-align:middle!important;box-shadow:none!important;'
                + 'background:transparent!important;}'
                + '.swal2-html-container input[type=checkbox]{'
                + 'appearance:checkbox!important;-webkit-appearance:checkbox!important;width:18px!important;height:18px!important;'
                + 'min-width:18px!important;max-width:18px!important;margin:0!important;padding:0!important;'
                + 'display:inline-block!important;vertical-align:middle!important;box-shadow:none!important;'
                + 'background:transparent!important;flex-shrink:0!important;}'
                + '.swal2-html-container select{display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;}'
                + '.export-opt-card{display:flex!important;align-items:flex-start!important;gap:10px!important;margin:8px 0!important;'
                + 'padding:10px!important;border-radius:8px!important;cursor:pointer!important;text-align:left!important;}'
                + '</style>'
                + '<p style="font-size:13px;margin:0 0 10px 0;color:#555;text-align:left;">' + (cfg.textoIntro || 'Marque o que deseja incluir no espelho:') + '</p>'
                + htmlPeriodo
                + '<label class="export-opt-card" for="' + prefix + '-vencido" style="border:1px solid #f5c6cb;background:#fff5f5;">'
                + '<input type="checkbox" id="' + prefix + '-vencido" checked style="width:18px;height:18px;margin-top:2px;flex-shrink:0;">'
                + '<span><b style="color:#dc3545;">🔴 VENCIDO</b><br><span style="font-size:12px;color:#666;">' + cntVenc + ' item(ns) · ' + formatarMoeda(pack.somaVencidas) + '</span></span>'
                + '</label>'
                + '<label class="export-opt-card" for="' + prefix + '-avencer" style="border:1px solid #ffeeba;background:#fffdf5;">'
                + '<input type="checkbox" id="' + prefix + '-avencer" checked style="width:18px;height:18px;margin-top:2px;flex-shrink:0;">'
                + '<span><b style="color:#856404;">🟡 A VENCER</b><br><span style="font-size:12px;color:#666;">' + cntAvencer + ' item(ns) · ' + formatarMoeda(pack.somaAVencer) + '</span></span>'
                + '</label>'
                + '<label class="export-opt-card" for="' + prefix + '-pagos" style="border:1px solid #c3e6cb;background:#f4fdf6;">'
                + '<input type="checkbox" id="' + prefix + '-pagos" checked style="width:18px;height:18px;margin-top:2px;flex-shrink:0;">'
                + '<span><b style="color:#28a745;">🟢 PAGOS</b> <span style="font-size:11px;color:#888;">(fornecedores + terceiros + parciais)</span><br>'
                + '<span style="font-size:12px;color:#666;">' + cntPagos + ' item(ns) · ' + formatarMoeda(pack.somaPagas) + '</span></span>'
                + '</label>',
            showCancelButton: true,
            confirmButtonText: cfg.botaoConfirmar || 'Exportar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: cfg.corConfirmar || '#1a2a43',
            cancelButtonColor: '#6c757d',
            focusConfirm: false,
            width: 540,
            customClass: { popup: 'swal-export-rel-popup', htmlContainer: 'swal-export-rel-html' },
            didOpen: () => {
                // Corrige CSS do SweetAlert2 que estica radio/checkbox como "slider"
                const root = document.querySelector('.swal2-popup');
                if (root) {
                    root.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach((el) => {
                        el.style.setProperty('width', '18px', 'important');
                        el.style.setProperty('height', '18px', 'important');
                        el.style.setProperty('min-width', '18px', 'important');
                        el.style.setProperty('max-width', '18px', 'important');
                        el.style.setProperty('margin', '0', 'important');
                        el.style.setProperty('padding', '0', 'important');
                        el.style.setProperty('box-shadow', 'none', 'important');
                        el.style.setProperty('background', 'transparent', 'important');
                        el.style.setProperty('display', 'inline-block', 'important');
                    });
                    root.querySelectorAll('select').forEach((el) => {
                        el.classList.remove('swal2-input');
                        el.style.setProperty('width', '100%', 'important');
                        el.style.setProperty('margin', '0', 'important');
                        el.style.setProperty('display', 'block', 'important');
                    });
                }
                if (!mostrarPeriodo) return;
                const blocoUm = document.getElementById(prefix + '-bloco-um');
                const blocoInt = document.getElementById(prefix + '-bloco-intervalo');
                const radios = document.querySelectorAll('input[name="' + prefix + '-modo-periodo"]');
                function syncModo() {
                    const modo = (document.querySelector('input[name="' + prefix + '-modo-periodo"]:checked') || {}).value || 'intervalo';
                    if (blocoUm) blocoUm.style.display = modo === 'um' ? 'block' : 'none';
                    if (blocoInt) blocoInt.style.display = modo === 'intervalo' ? 'block' : 'none';
                }
                radios.forEach((r) => r.addEventListener('change', syncModo));
                syncModo();
            },
            preConfirm: () => {
                const opcoes = {
                    vencido: !!document.getElementById(prefix + '-vencido')?.checked,
                    aVencer: !!document.getElementById(prefix + '-avencer')?.checked,
                    pagos: !!document.getElementById(prefix + '-pagos')?.checked,
                    periodo: 'todos',
                    periodoInicio: null,
                    periodoFim: null
                };
                if (!opcoes.vencido && !opcoes.aVencer && !opcoes.pagos) {
                    Swal.showValidationMessage('Selecione pelo menos uma opção (Vencido, A vencer ou Pagos).');
                    return false;
                }
                if (mostrarPeriodo) {
                    const modo = (document.querySelector('input[name="' + prefix + '-modo-periodo"]:checked') || {}).value || 'todos';
                    if (modo === 'um') {
                        const p = document.getElementById(prefix + '-periodo')?.value || 'todos';
                        opcoes.periodo = p;
                        if (p && p !== 'todos') {
                            opcoes.periodoInicio = p;
                            opcoes.periodoFim = p;
                        }
                    } else if (modo === 'intervalo') {
                        const mesDe = document.getElementById(prefix + '-mes-de')?.value || '';
                        const anoDe = document.getElementById(prefix + '-ano-de')?.value || '';
                        const mesAte = document.getElementById(prefix + '-mes-ate')?.value || '';
                        const anoAte = document.getElementById(prefix + '-ano-ate')?.value || '';
                        if (!mesDe || !anoDe || !mesAte || !anoAte) {
                            Swal.showValidationMessage('Selecione mês/ano DE e ATÉ.');
                            return false;
                        }
                        let ini = mesDe + '/' + anoDe;
                        let fim = mesAte + '/' + anoAte;
                        if (mesAnoParaIndiceRelGeral(ini) > mesAnoParaIndiceRelGeral(fim)) {
                            const t = ini; ini = fim; fim = t;
                        }
                        opcoes.periodo = ini === fim ? ini : 'intervalo';
                        opcoes.periodoInicio = ini;
                        opcoes.periodoFim = fim;
                    } else {
                        opcoes.periodo = 'todos';
                    }
                }
                return opcoes;
            }
        });

        if (!result.isConfirmed || !result.value) return null;
        return result.value;
    }

    function sufixoArquivoExportRelGeralObras(opcoes) {
        const sufixos = [];
        const slugMes = (chave) => {
            const [mes, ano] = String(chave || '').split('/');
            const nome = (nomeMeses && (nomeMeses[mes] || nomeMeses[String(Number(mes))])) || mes;
            return String(nome).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') + '_' + ano;
        };
        if (opcoes.periodoInicio && opcoes.periodoFim) {
            if (opcoes.periodoInicio === opcoes.periodoFim) {
                sufixos.push(slugMes(opcoes.periodoInicio));
            } else {
                sufixos.push(slugMes(opcoes.periodoInicio) + '_a_' + slugMes(opcoes.periodoFim));
            }
        } else if (opcoes.periodo && opcoes.periodo !== 'todos' && opcoes.periodo !== 'intervalo') {
            sufixos.push(slugMes(opcoes.periodo));
        }
        if (opcoes.vencido) sufixos.push('vencido');
        if (opcoes.aVencer) sufixos.push('a_vencer');
        if (opcoes.pagos) sufixos.push('pagos');
        return sufixos.length ? '_' + sufixos.join('_') : '';
    }

    function linhaExcelDespesaRelGeralObra(d, situacao) {
        const valorNum = Number(d.valor_numero != null ? d.valor_numero : (parseMoedaLocal(d.valor_string) || 0));
        const ehParcial = d && d._origem === 'pagamento_parcial';
        const sit = ehParcial ? 'PAGO PARCIAL' : situacao;
        return {
            'Situação': sit,
            'Tipo': ehParcial ? 'Pagamento parcial' : 'Fornecedor',
            'Obra': d.obra_nome || '',
            'Fornecedor / Profissional': d.loja_nome || '',
            'NF / Referência': d.nota_fiscal || refChequeBoletoDesp(d) || '',
            'Vencimento': ehParcial ? '' : formatarVencimentoDespesaExibir(d),
            'Data pagamento': obterDataPagamentoDespesa(d) || d.data_pagamento || (ehParcial ? (d.data || '') : ''),
            'Data lançamento': d.data || '',
            'Valor (R$)': valorNum,
            'Descrição': d.descricao || '',
            'CPF': '',
            'Telefone': ''
        };
    }

    function linhaExcelTerceiroRelGeralObra(d) {
        const valorNum = Number(d.valor_numero != null ? d.valor_numero : (parseMoedaLocal(d.valor_string) || 0));
        return {
            'Situação': 'PAGO',
            'Tipo': 'Terceiro',
            'Obra': d.obra || '',
            'Fornecedor / Profissional': d.nome || '',
            'NF / Referência': '',
            'Vencimento': '',
            'Data pagamento': d.data || '',
            'Data lançamento': '',
            'Valor (R$)': valorNum,
            'Descrição': d.descricao || '',
            'CPF': d.cpf || '',
            'Telefone': d.tel || ''
        };
    }

    function montarLinhasExcelRelGeralObras(pack, opcoes) {
        const linhas = [];
        if (opcoes.vencido) {
            ordenarListaRelGeralPorData(pack.vencidas, 'vencido').forEach((d) => {
                linhas.push(linhaExcelDespesaRelGeralObra(d, 'VENCIDO'));
            });
        }
        if (opcoes.aVencer) {
            ordenarListaRelGeralPorData(pack.aVencer, 'avencer').forEach((d) => {
                linhas.push(linhaExcelDespesaRelGeralObra(d, 'A VENCER'));
            });
        }
        if (opcoes.pagos) {
            // Mistura fornecedores/parciais + terceiros e ordena pela data de pagamento
            const pagosMix = [];
            (pack.pagasForn || []).forEach((d) => pagosMix.push({ tipo: 'forn', d: d, ts: tsDataBrRelGeral(d.data_pagamento || d.data) }));
            (pack.terceiros || []).forEach((d) => pagosMix.push({ tipo: 'terc', d: d, ts: tsDataBrRelGeral(d.data) }));
            pagosMix.sort((a, b) => {
                if (a.ts !== b.ts) return a.ts - b.ts;
                const na = String((a.d && (a.d.obra_nome || a.d.obra)) || '');
                const nb = String((b.d && (b.d.obra_nome || b.d.obra)) || '');
                return na.localeCompare(nb, 'pt-BR');
            });
            pagosMix.forEach((x) => {
                if (x.tipo === 'terc') linhas.push(linhaExcelTerceiroRelGeralObra(x.d));
                else linhas.push(linhaExcelDespesaRelGeralObra(x.d, 'PAGO'));
            });
        }
        return linhas;
    }

    function gerarExcelRelGeralObrasEspelho(pack, opcoes) {
        if (!window.XLSX) {
            return Swal.fire('Erro', 'Biblioteca Excel não carregou. Recarregue a página (Ctrl+F5).', 'error');
        }

        const linhas = montarLinhasExcelRelGeralObras(pack, opcoes);
        if (!linhas.length) {
            return Swal.fire('Aviso', 'Não há registros nas opções selecionadas para exportar.', 'info');
        }

        const emp = String(pack.empresa || getEmpresaGestor() || 'Empresa').trim();
        const totalSelecionado = (opcoes.vencido ? pack.somaVencidas : 0)
            + (opcoes.aVencer ? pack.somaAVencer : 0)
            + (opcoes.pagos ? pack.somaPagas : 0);

        const ws = XLSX.utils.json_to_sheet(linhas);
        const colunas = Object.keys(linhas[0]);
        ws['!cols'] = [
            { wch: 12 },
            { wch: 12 },
            { wch: 28 },
            { wch: 28 },
            { wch: 20 },
            { wch: 14 },
            { wch: 14 },
            { wch: 14 },
            { wch: 14 },
            { wch: 40 },
            { wch: 16 },
            { wch: 16 }
        ];

        const range = XLSX.utils.decode_range(ws['!ref']);
        const idxValor = colunas.indexOf('Valor (R$)');
        if (idxValor >= 0) {
            for (let r = range.s.r + 1; r <= range.e.r; r += 1) {
                const addr = XLSX.utils.encode_cell({ r, c: idxValor });
                if (ws[addr] && typeof ws[addr].v === 'number') {
                    ws[addr].t = 'n';
                    ws[addr].z = '#,##0.00';
                }
            }
        }

        const linhaTotal = range.e.r + 2;
        const addrLabel = XLSX.utils.encode_cell({ r: linhaTotal, c: Math.max(0, idxValor - 1) });
        const addrTotal = XLSX.utils.encode_cell({ r: linhaTotal, c: idxValor });
        ws[addrLabel] = { t: 's', v: 'TOTAL EXPORTADO (R$)' };
        ws[addrTotal] = { t: 'n', v: totalSelecionado, z: '#,##0.00' };
        const novoFim = XLSX.utils.encode_cell({ r: linhaTotal, c: range.e.c });
        ws['!ref'] = ws['!ref'].split(':')[0] + ':' + novoFim;
        ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: range.e.r, c: range.e.c } }) };

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Espelho Obras');

        const resumo = [{
            'Empresa': emp,
            'Período': pack.periodoLabel || 'Todos os períodos',
            'Gerado em': new Date().toLocaleString('pt-BR'),
            'Vencido (R$)': opcoes.vencido ? Number(pack.somaVencidas || 0) : 0,
            'A vencer (R$)': opcoes.aVencer ? Number(pack.somaAVencer || 0) : 0,
            'Pagos (R$)': opcoes.pagos ? Number(pack.somaPagas || 0) : 0,
            'Total exportado (R$)': totalSelecionado
        }];
        const wsResumo = XLSX.utils.json_to_sheet(resumo);
        wsResumo['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

        const sufixoArquivo = sufixoArquivoExportRelGeralObras(opcoes);
        XLSX.writeFile(wb, nomeArquivoExcelSeguro('espelho_relatorio_geral_obras' + sufixoArquivo + '_' + emp) + '.xlsx');

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Excel exportado com sucesso!',
            showConfirmButton: false,
            timer: 2500
        });
    }

    window.exportarPDFRelatorioGeralObras = async function () {
        const pack = window._relGeralObrasExport;
        if (!pack) {
            return Swal.fire('Atenção', 'Carregue o relatório geral primeiro (Atualizar Relatório Geral).', 'warning');
        }

        const opcoes = await perguntarOpcoesExportRelGeralObras(pack, {
            prefix: 'pdf-rel',
            titulo: '🖨️ Exportar espelho PDF',
            textoIntro: 'Escolha o período e marque o que deseja incluir no PDF:',
            botaoConfirmar: 'Gerar PDF'
        });
        if (!opcoes) return;

        const packFiltrado = filtrarPackRelGeralObrasPorPeriodo(pack, opcoes);
        const temItens = (opcoes.vencido && packFiltrado.vencidas.length)
            || (opcoes.aVencer && packFiltrado.aVencer.length)
            || (opcoes.pagos && (packFiltrado.pagasForn.length || packFiltrado.terceiros.length));
        if (!temItens) {
            return Swal.fire(
                'Sem registros',
                'Nenhum lançamento encontrado para <b>' + escapeHtmlBasico(packFiltrado.periodoLabel || 'o período escolhido') + '</b> com as opções marcadas.',
                'info'
            );
        }
        gerarPdfRelGeralObrasEspelho(packFiltrado, opcoes);
    };

    window.exportarExcelRelatorioGeralObras = async function () {
        const pack = window._relGeralObrasExport;
        if (!pack) {
            return Swal.fire('Atenção', 'Carregue o relatório geral primeiro (Atualizar Relatório Geral).', 'warning');
        }

        const opcoes = await perguntarOpcoesExportRelGeralObras(pack, {
            prefix: 'xls-rel',
            titulo: '📊 Exportar espelho Excel',
            textoIntro: 'Escolha o período e marque o que deseja incluir na planilha:',
            botaoConfirmar: 'Gerar Excel',
            corConfirmar: '#217346'
        });
        if (!opcoes) return;

        const packFiltrado = filtrarPackRelGeralObrasPorPeriodo(pack, opcoes);
        const temItens = (opcoes.vencido && packFiltrado.vencidas.length)
            || (opcoes.aVencer && packFiltrado.aVencer.length)
            || (opcoes.pagos && (packFiltrado.pagasForn.length || packFiltrado.terceiros.length));
        if (!temItens) {
            return Swal.fire(
                'Sem registros',
                'Nenhum lançamento encontrado para <b>' + escapeHtmlBasico(packFiltrado.periodoLabel || 'o período escolhido') + '</b> com as opções marcadas.',
                'info'
            );
        }
        gerarExcelRelGeralObrasEspelho(packFiltrado, opcoes);
    };

    function gerarPdfRelGeralObrasEspelho(pack, opcoes) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4');
        const emp = String(pack.empresa || getEmpresaGestor() || 'Empresa').trim();

        const totalSelecionado = (opcoes.vencido ? pack.somaVencidas : 0)
            + (opcoes.aVencer ? pack.somaAVencer : 0)
            + (opcoes.pagos ? pack.somaPagas : 0);

        doc.setFillColor(26, 42, 67);
        doc.rect(0, 0, 297, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('ESPELHO — RELATÓRIO GERAL DE OBRAS', 14, 12);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(220, 220, 220);
        const periodoTxt = pack.periodoLabel ? ('  |  Periodo: ' + String(pack.periodoLabel).normalize('NFD').replace(/[\u0300-\u036f]/g, '')) : '';
        doc.text(emp + '  |  Gerado em: ' + new Date().toLocaleString('pt-BR') + periodoTxt + '  |  Gestor 360', 14, 20);

        let xResumo = 14;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        if (opcoes.vencido) {
            doc.setTextColor(220, 53, 69);
            doc.text('Vencido: ' + formatarMoeda(pack.somaVencidas), xResumo, 28);
            xResumo += 64;
        }
        if (opcoes.aVencer) {
            doc.setTextColor(133, 100, 4);
            doc.text('A vencer: ' + formatarMoeda(pack.somaAVencer), xResumo, 28);
            xResumo += 64;
        }
        if (opcoes.pagos) {
            doc.setTextColor(40, 167, 69);
            doc.text('Pagos: ' + formatarMoeda(pack.somaPagas), xResumo, 28);
            xResumo += 64;
        }
        doc.setTextColor(26, 42, 67);
        doc.text('Total exportado: ' + formatarMoeda(totalSelecionado), Math.min(xResumo, 206), 28);

        const headDesp = [['Estado', 'Vencimento', 'Obra', 'Fornecedor', 'NF', 'Valor (R$)', 'Descrição']];
        const headTerc = [['Tipo', 'Obra', 'Profissional', 'Valor (R$)', 'Data pagamento', 'Descrição']];
        const estiloTabela = {
            theme: 'striped',
            styles: { fontSize: 7, cellPadding: 2.5, valign: 'middle', textColor: '#333333' },
            headStyles: { fillColor: '#1a2a43', textColor: '#ffffff', fontStyle: 'bold' },
            alternateRowStyles: { fillColor: '#f5f8fa' },
            margin: { left: 14, right: 14 },
            didDrawPage: function (data) {
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text('Página ' + doc.internal.getNumberOfPages(), data.settings.margin.left, doc.internal.pageSize.height - 8);
            }
        };

        function linhaDespesaPdf(d, estado) {
            return [
                estado,
                formatarVencimentoDespesaExibir(d),
                String(d.obra_nome || '').slice(0, 40),
                String(d.loja_nome || '').slice(0, 35),
                String(d.nota_fiscal || '—').slice(0, 20),
                'R$ ' + String(d.valor_string || '0,00'),
                String(d.descricao || '').slice(0, 60)
            ];
        }

        function corEstado(data) {
            if (data.column.index !== 0 || data.cell.section !== 'body') return;
            const raw = String(data.cell.raw || '');
            if (raw.indexOf('VENCID') >= 0) data.cell.styles.textColor = '#dc3545';
            else if (raw.indexOf('A VENCER') >= 0) data.cell.styles.textColor = '#856404';
            else if (raw.indexOf('PARCIAL') >= 0) data.cell.styles.textColor = '#17a2b8';
            else if (raw.indexOf('PAGO') >= 0) data.cell.styles.textColor = '#28a745';
            data.cell.styles.fontStyle = 'bold';
        }

        let startY = 36;
        let incluiuAlgumaSecao = false;

        function blocoSecao(titulo, corRgb, linhas, head, corCell) {
            if (!linhas || !linhas.length) return startY;
            incluiuAlgumaSecao = true;
            if (startY > 175) {
                doc.addPage();
                startY = 18;
            }
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(corRgb[0], corRgb[1], corRgb[2]);
            doc.text(titulo + ' (' + linhas.length + ')', 14, startY);
            doc.autoTable(Object.assign({}, estiloTabela, {
                startY: startY + 3,
                head: head,
                body: linhas,
                didParseCell: corCell || undefined
            }));
            startY = doc.lastAutoTable.finalY + 10;
            return startY;
        }

        if (opcoes.vencido) {
            const bodyVenc = (pack.vencidas || []).map((d) => linhaDespesaPdf(d, 'VENCIDO'));
            startY = blocoSecao('EM ABERTO — VENCIDO', [220, 53, 69], bodyVenc, headDesp, corEstado);
        }

        if (opcoes.aVencer) {
            const bodyAvencer = (pack.aVencer || []).map((d) => linhaDespesaPdf(d, 'A VENCER'));
            startY = blocoSecao('A VENCER — NO PRAZO', [133, 100, 4], bodyAvencer, headDesp, corEstado);
        }

        if (opcoes.pagos) {
            const bodyPagasForn = (pack.pagasForn || []).map((d) => {
                const rotulo = d && d._origem === 'pagamento_parcial'
                    ? ('PARCIAL ' + (d.data_pagamento || d.data || ''))
                    : ('PAGO ' + (d.data_pagamento || ''));
                return linhaDespesaPdf(d, rotulo);
            });
            startY = blocoSecao('JÁ PAGO — FORNECEDORES E PARCIAIS', [40, 167, 69], bodyPagasForn, headDesp, corEstado);

            const bodyTerc = (pack.terceiros || []).map((d) => [
                'TERCEIRO',
                String(d.obra || '').slice(0, 40),
                String(d.nome || '').slice(0, 35),
                'R$ ' + String(d.valor_string || '0,00'),
                String(d.data || '—'),
                String(d.descricao || '').slice(0, 60)
            ]);
            blocoSecao('JÁ PAGO — PAGAMENTOS A TERCEIROS', [26, 42, 67], bodyTerc, headTerc, function (data) {
                if (data.column.index === 0 && data.cell.section === 'body') {
                    data.cell.styles.textColor = '#1a2a43';
                    data.cell.styles.fontStyle = 'bold';
                }
            });
        }

        if (!incluiuAlgumaSecao) {
            return Swal.fire('Aviso', 'Não há registros nas opções selecionadas para exportar.', 'info');
        }

        const sufixoArquivo = sufixoArquivoExportRelGeralObras(opcoes);

        doc.save('espelho_relatorio_geral_obras' + sufixoArquivo + '_' + emp.replace(/\s+/g, '_') + '.pdf');
    };

    window.carregarRelatorioGeralObras = async function () {
        const empresaLogada = getEmpresaGestor();
        const divSecoes = document.getElementById('rel-geral-obras-secoes');
        const divResumo = document.getElementById('rel-geral-obras-resumo');
        const divTotais = document.getElementById('rel-geral-obras-resumo-totais');
        const divDetalhe = document.getElementById('rel-geral-obras-resumo-detalhe');
        const divAcoes = document.getElementById('rel-geral-obras-acoes');

        if (!empresaLogada) return Swal.fire('Atenção', 'Empresa não definida.', 'warning');
        if (!divSecoes) return;

        divSecoes.innerHTML = '<p style="text-align:center;color:#888;">Carregando relatório geral...</p>';
        if (divResumo) divResumo.style.display = 'none';
        if (divAcoes) divAcoes.style.display = 'none';
        window._relGeralObrasExport = null;

        try {
            const qDesp = query(collection(db, 'despesas_obras'), where('empresa_id', '==', empresaLogada));
            const qTer = query(collection(db, 'pagamentos_terceiros'), where('empresa_id', '==', empresaLogada));
            const [snapDesp, snapTer] = await Promise.all([getDocs(qDesp), getDocs(qTer)]);

            const despesas = [];
            snapDesp.forEach((docSnap) => despesas.push({ id: docSnap.id, ...docSnap.data() }));

            const terceiros = [];
            snapTer.forEach((docSnap) => terceiros.push({ id: docSnap.id, ...docSnap.data() }));
            terceiros.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            const terceirosNorm = terceiros.map((t) => normalizarTerceiroComoDespesaPaga(t));
            aplicarAbatimentoTerceirosNasDespesas(despesas, terceirosNorm);

            let htmlVencidas = '';
            let htmlAVencer = '';
            let htmlPagasForn = '';
            let htmlPagasTerc = '';
            let somaVencidas = 0;
            let somaAVencer = 0;
            let somaPagasForn = 0;
            let somaPagasTerc = 0;
            let somaPagasParciais = 0;

            try {
                await sincronizarStatusPagoInconsistente(despesas.filter((d) => despesaEstaPaga(d)), 'despesas_obras');
            } catch (eSync) { /* segue */ }

            // Em aberto = saldo. Vencida com status pendente continua na lista (como no alerta).
            const pendentesViews = [];
            despesas.forEach((d) => {
                const saldo = valorSaldoAbertoRelatorio(d);
                if (saldo <= 0.009) return;
                pendentesViews.push(Object.assign({}, d, {
                    valor_numero: saldo,
                    valor_string: formatarMoeda(saldo).replace(/^R\$\s?/, ''),
                    _valor_original: valorOriginalDespesa(d),
                    _valor_pago: valorPagoComTerceirosDespesa(d)
                }));
            });
            const listaVencidas = pendentesViews.filter((d) => despesaEstaVencida(d));
            const listaAVencer = pendentesViews.filter((d) => !despesaEstaVencida(d));
            ordenarRelatorioDespesasPorVencimento(listaVencidas);
            ordenarRelatorioDespesasPorVencimento(listaAVencer);

            listaVencidas.forEach((d) => {
                somaVencidas += Number(d.valor_numero) || 0;
                htmlVencidas += htmlCardDespesaRelGeralObra(d, true);
            });
            listaAVencer.forEach((d) => {
                somaAVencer += Number(d.valor_numero) || 0;
                htmlAVencer += htmlCardDespesaRelGeralObra(d, false);
            });

            // Já Pago fornecedor:
            // - Conta QUITADA (pago total) → 1 linha "PAGO / FORNECEDOR" (não como parcial)
            // - Conta ainda em aberto com parciais → lista cada pagamento parcial
            const itensPagoForn = [];
            despesas.forEach((d) => {
                const pars = listaPagamentosParciaisDespesa(d);
                if (despesaEstaPaga(d)) {
                    const v = valorPagoDespesa(d) || valorOriginalDespesa(d) || Number(d.valor_numero) || 0;
                    if (!(v > 0.009)) return;
                    const dataPg = obterDataPagamentoDespesa(d)
                        || (pars.length ? (pars[pars.length - 1].data || '') : '')
                        || d.data
                        || '';
                    let desc = String(d.descricao || '').trim();
                    // Remove texto interno de quitação parcial que confundia o Excel
                    if (/quita[cç][aã]o do saldo/i.test(desc) || /^pagamento parcial/i.test(desc)) {
                        desc = '';
                    }
                    itensPagoForn.push(Object.assign({}, d, {
                        _origem: 'despesas_obras',
                        status: 'pago',
                        valor_numero: v,
                        valor_string: d.valor_string || formatarMoeda(v).replace(/^R\$\s?/, ''),
                        data_pagamento: dataPg,
                        data: dataPg || d.data || '',
                        descricao: desc
                    }));
                    return;
                }
                if (pars.length) {
                    pars.forEach((p, idxParc) => {
                        const item = itemDePagamentoParcialRelGeral(d, p, idxParc);
                        if ((item.valor_numero || 0) > 0.009) {
                            itensPagoForn.push(item);
                            somaPagasParciais += item.valor_numero;
                        }
                    });
                }
            });
            somaPagasForn = itensPagoForn.reduce((s, d) => s + (Number(d.valor_numero) || 0), 0);

            const agrupadoPagas = {};
            itensPagoForn.forEach((d) => {
                const ref = separarDataSegura(obterDataPagamentoDespesa(d) || d.data_pagamento || d.data);
                if (!agrupadoPagas[ref.ano]) agrupadoPagas[ref.ano] = {};
                if (!agrupadoPagas[ref.ano][ref.mes]) agrupadoPagas[ref.ano][ref.mes] = [];
                d.diaFormatado = ref.dia;
                agrupadoPagas[ref.ano][ref.mes].push(d);
            });

            const chavesAno = Object.keys(agrupadoPagas).sort((a, b) => {
                if (a === 'Outros') return 1;
                if (b === 'Outros') return -1;
                return Number(b) - Number(a);
            });
            chavesAno.forEach((ano) => {
                htmlPagasForn += '<details class="pasta-ano"><summary>Ano ' + escapeHtmlBasico(ano) + '</summary><div class="folder-content">';
                const chavesMes = Object.keys(agrupadoPagas[ano]).sort((a, b) => {
                    if (a === 'Outros') return 1;
                    if (b === 'Outros') return -1;
                    return Number(b) - Number(a);
                });
                chavesMes.forEach((mes) => {
                    const nomeDoMes = nomeMeses[mes] || mes;
                    htmlPagasForn += '<details class="pasta-mes"><summary>' + escapeHtmlBasico(String(nomeDoMes)) + '</summary><div class="folder-content">';
                    (agrupadoPagas[ano][mes] || []).sort((a, b) => {
                        const ta = Number(String(a.diaFormatado || '0').replace(/\D/g, '')) || 0;
                        const tb = Number(String(b.diaFormatado || '0').replace(/\D/g, '')) || 0;
                        return tb - ta;
                    }).forEach((d) => {
                        htmlPagasForn += htmlCardDespesaPagaRelGeralObra(d);
                    });
                    htmlPagasForn += '</div></details>';
                });
                htmlPagasForn += '</div></details>';
            });

            terceiros.forEach((d) => {
                somaPagasTerc += (Number(d.valor_numero) || parseMoedaLocal(d.valor_string) || 0);
                htmlPagasTerc += htmlCardTerceiroRelGeralObra(d);
            });

            const somaPagas = somaPagasForn + somaPagasTerc;
            const emAberto = somaVencidas + somaAVencer;
            const totalGeral = emAberto + somaPagas;

            if (divTotais) {
                divTotais.innerHTML = montarHtmlPainelResumoDespesas(somaVencidas, somaAVencer, somaPagas, 'Total Geral (Obras):');
            }
            if (divDetalhe) {
                divDetalhe.innerHTML = 'Em aberto (vencido + a vencer): <b>' + formatarMoeda(emAberto) + '</b>'
                    + ' · Fornecedores / parciais: <b>' + formatarMoeda(somaPagasForn) + '</b>'
                    + (somaPagasParciais > 0 ? ' <span style="color:#0c5460;">(parciais: ' + formatarMoeda(somaPagasParciais) + ')</span>' : '')
                    + ' · Terceiros pagos: <b>' + formatarMoeda(somaPagasTerc) + '</b>'
                    + ' · <b>' + despesas.length + '</b> despesa(s) · <b>' + terceiros.length + '</b> terceiro(s) · Total geral: <b>' + formatarMoeda(totalGeral) + '</b>';
            }
            if (divResumo) divResumo.style.display = 'block';
            if (divAcoes) divAcoes.style.display = 'flex';

            window._relGeralObrasExport = {
                empresa: empresaLogada,
                somaVencidas,
                somaAVencer,
                somaPagas,
                somaPagasForn,
                somaPagasTerc,
                somaPagasParciais,
                emAberto,
                totalGeral,
                vencidas: listaVencidas.slice(),
                aVencer: listaAVencer.slice(),
                pagasForn: itensPagoForn.slice(),
                terceiros: terceiros.slice()
            };

            let htmlSecoes = '';
            const cntVenc = listaVencidas.length;
            const cntAvencer = listaAVencer.length;
            const cntPagosForn = itensPagoForn.length;

            htmlSecoes += '<div id="rel-geral-obras-quadro">';

            htmlSecoes += '<details class="secao-despesas-busca secao-vencidas" open>'
                + '<summary>🔴 Em aberto — Vencido (' + cntVenc + ') — ' + formatarMoeda(somaVencidas) + ' <span class="secao-seta">▲</span></summary>'
                + '<div class="secao-despesas-conteudo">'
                + (htmlVencidas || '<p style="text-align:center;color:#888;padding:12px;">Nenhuma despesa vencida.</p>')
                + '</div></details>';

            htmlSecoes += '<details class="secao-despesas-busca secao-avencer">'
                + '<summary>🟡 A vencer — No prazo (' + cntAvencer + ') — ' + formatarMoeda(somaAVencer) + ' <span class="secao-seta">▲</span></summary>'
                + '<div class="secao-despesas-conteudo">'
                + (htmlAVencer || '<p style="text-align:center;color:#888;padding:12px;">Nenhuma despesa a vencer.</p>')
                + '</div></details>';

            htmlSecoes += '<details class="secao-despesas-busca secao-pagas">'
                + '<summary>🟢 Já pago (' + (cntPagosForn + terceiros.length) + ') — ' + formatarMoeda(somaPagas) + ' <span class="secao-seta">▲</span></summary>'
                + '<div class="secao-despesas-conteudo">';

            htmlSecoes += '<details class="pasta-ano" open><summary>🏪 Fornecedores e pagamentos parciais (' + cntPagosForn + ') — ' + formatarMoeda(somaPagasForn) + '</summary><div class="folder-content">'
                + '<p style="font-size:12px;color:#555;margin:0 0 10px 0;">Marque o <b>pagamento parcial</b> errado e clique em <b>Excluir parciais selecionados</b> (no topo) ou use <b>Excluir este</b> no card. Só aquele lançamento sai; a despesa e os outros parciais ficam.</p>'
                + (htmlPagasForn || '<p style="text-align:center;color:#888;padding:12px;">Nenhum pagamento de fornecedor / parcial.</p>')
                + '</div></details>';

            htmlSecoes += '<details class="pasta-ano"><summary>👷 Pagamentos a terceiros (' + terceiros.length + ') — ' + formatarMoeda(somaPagasTerc) + '</summary><div class="folder-content">'
                + (htmlPagasTerc || '<p style="text-align:center;color:#888;padding:12px;">Nenhum pagamento a terceiro registado.</p>')
                + '</div></details>';

            htmlSecoes += '</div></details></div>';
            if (!despesas.length && !terceiros.length) {
                divSecoes.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">Nenhum registro encontrado para esta empresa.</p>';
            } else {
                divSecoes.innerHTML = htmlSecoes;
            }
        } catch (e) {
            console.error(e);
            divSecoes.innerHTML = '<p style="text-align:center;color:#d9534f;">Erro ao carregar o relatório geral. Tente novamente.</p>';
        }
    };

    function despesaEstaPagaNorm(d) {
        return despesaEstaPaga(d);
    }

    function notaFiscalPreenchida(d) {
        const nf = d && d.nota_fiscal != null ? String(d.nota_fiscal).trim() : '';
        return nf.length > 0;
    }

    function normalizarItemRelGeralNF(d, origem) {
        const valorNum = d.valor_numero != null ? Number(d.valor_numero) : (parseMoedaLocal(d.valor_string) || 0);
        return {
            ...d,
            _origem: origem,
            obra_nome: d.obra_nome || d.obra || '',
            loja_nome: d.loja_nome || d.loja || '',
            nota_fiscal: d.nota_fiscal != null ? String(d.nota_fiscal).trim() : '',
            cheque_boleto_num: d.cheque_boleto_num != null ? String(d.cheque_boleto_num).trim() : '',
            valor_numero: valorNum,
            valor_string: d.valor_string || formatarMoeda(valorNum)
        };
    }

    function obterFiltrosRelGeralNF() {
        const elTexto = document.getElementById('rel-nf-filtro-texto');
        const elStatus = document.getElementById('rel-nf-filtro-status');
        const elSoNf = document.getElementById('rel-nf-so-com-nf');
        return {
            texto: normalizarChaveNomeDespesa(elTexto ? elTexto.value : ''),
            status: (elStatus && elStatus.value) || 'todos',
            soComNf: !(elSoNf && elSoNf.checked === false)
        };
    }

    function montarCacheSugestoesRelGeralNF(itens) {
        const mapa = new Map();
        function add(nome, tipo) {
            const n = formatarNomeCanonicoDespesa(nome);
            const chave = normalizarChaveNomeDespesa(n);
            if (!chave) return;
            if (!mapa.has(chave + '|' + tipo)) {
                mapa.set(chave + '|' + tipo, { chave: chave, nome: n, tipo: tipo });
            }
        }
        (itens || []).forEach((d) => {
            add(d.obra_nome || d.obra, 'obra');
            add(d.loja_nome || d.loja, 'loja');
            const nf = d.nota_fiscal != null ? String(d.nota_fiscal).trim() : '';
            if (nf) {
                const chaveNf = normalizarChaveNomeDespesa(nf);
                if (chaveNf && !mapa.has(chaveNf + '|nf')) {
                    mapa.set(chaveNf + '|nf', { chave: chaveNf, nome: nf, tipo: 'nf' });
                }
            }
        });
        const sugestoes = Array.from(mapa.values()).sort((a, b) => {
            const ordem = { obra: 0, loja: 1, nf: 2 };
            const oa = ordem[a.tipo] != null ? ordem[a.tipo] : 9;
            const ob = ordem[b.tipo] != null ? ordem[b.tipo] : 9;
            if (oa !== ob) return oa - ob;
            return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
        });
        window._cacheSugestoesRelGeralNF = { sugestoes: sugestoes };
        return window._cacheSugestoesRelGeralNF;
    }

    window.carregarSugestoesRelGeralNF = async function () {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) return null;
        try {
            const qDesp = query(collection(db, 'despesas_obras'), where('empresa_id', '==', empresaLogada));
            const qRel = query(collection(db, COLECAO_RELATORIO_DESPESAS), where('empresa_id', '==', empresaLogada));
            const [snapDesp, snapRel] = await Promise.all([getDocs(qDesp), getDocs(qRel)]);
            const itens = [];
            snapDesp.forEach((docSnap) => itens.push(docSnap.data()));
            snapRel.forEach((docSnap) => itens.push(docSnap.data()));
            return montarCacheSugestoesRelGeralNF(itens);
        } catch (e) {
            console.error('carregarSugestoesRelGeralNF', e);
            return null;
        }
    };

    window.fecharSugestoesRelGeralNF = function () {
        const box = document.getElementById('rel-nf-filtro-sugestoes');
        if (box) {
            box.style.display = 'none';
            box.innerHTML = '';
        }
    };

    window.selecionarFiltroRelGeralNF = function (nome) {
        const inp = document.getElementById('rel-nf-filtro-texto');
        if (inp) inp.value = nome;
        fecharSugestoesRelGeralNF();
        if (typeof window.carregarRelatorioGeralNotasFiscais === 'function') {
            window.carregarRelatorioGeralNotasFiscais();
        }
    };

    window.filtrarAutocompleteRelGeralNF = async function () {
        const input = document.getElementById('rel-nf-filtro-texto');
        const box = document.getElementById('rel-nf-filtro-sugestoes');
        if (!input || !box) return;

        let cache = window._cacheSugestoesRelGeralNF;
        if (!cache || !cache.sugestoes) {
            box.innerHTML = '<div style="padding:10px 12px;font-size:12px;color:#666;">Carregando nomes...</div>';
            box.style.display = 'block';
            cache = await carregarSugestoesRelGeralNF();
        }
        if (!cache || !cache.sugestoes) {
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }

        const termo = normalizarChaveNomeDespesa(input.value);
        let matches;
        if (!termo) {
            matches = cache.sugestoes.filter((s) => s.tipo !== 'nf').slice(0, 20);
        } else {
            matches = cache.sugestoes.filter((s) => s.chave.includes(termo)).slice(0, 20);
        }

        if (!matches.length) {
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }

        box.innerHTML = matches.map((s) => {
            const tipoLabel = s.tipo === 'obra' ? '🏢 Obra' : (s.tipo === 'loja' ? '🏪 Fornecedor' : '🧾 NF');
            return '<button type="button" class="busca-desp-sugestao" data-nome="' + escapeHtmlBasico(s.nome) + '">'
                + '<span class="busca-desp-sug-tipo">' + tipoLabel + '</span>'
                + escapeHtmlBasico(s.nome)
                + '</button>';
        }).join('');
        box.style.display = 'block';
    };

    window.teclaAutocompleteRelGeralNF = function (ev) {
        if (ev.key === 'Escape') {
            fecharSugestoesRelGeralNF();
        } else if (ev.key === 'Enter') {
            ev.preventDefault();
            const box = document.getElementById('rel-nf-filtro-sugestoes');
            const primeiro = box && box.style.display !== 'none' && box.querySelector('.busca-desp-sugestao');
            if (primeiro) {
                selecionarFiltroRelGeralNF(primeiro.getAttribute('data-nome') || '');
            } else if (typeof window.carregarRelatorioGeralNotasFiscais === 'function') {
                fecharSugestoesRelGeralNF();
                window.carregarRelatorioGeralNotasFiscais();
            }
        }
    };

    (function initAutocompleteRelGeralNF() {
        document.addEventListener('click', (ev) => {
            const wrap = document.getElementById('rel-nf-filtro-texto')
                && document.getElementById('rel-nf-filtro-texto').closest('.busca-despesas-wrap');
            if (wrap && !wrap.contains(ev.target)) fecharSugestoesRelGeralNF();
        });
        const box = document.getElementById('rel-nf-filtro-sugestoes');
        if (box && !box._delegacaoOk) {
            box._delegacaoOk = true;
            box.addEventListener('mousedown', (ev) => {
                const alvo = ev.target.closest('.busca-desp-sugestao');
                if (!alvo) return;
                ev.preventDefault();
                selecionarFiltroRelGeralNF(alvo.getAttribute('data-nome') || '');
            });
        }
    })();

    function itemPassaFiltroRelGeralNF(d, filtros) {
        if (filtros.soComNf && !notaFiscalPreenchida(d)) return false;

        if (filtros.texto) {
            const obra = normalizarChaveNomeDespesa(d.obra_nome || '');
            const loja = normalizarChaveNomeDespesa(d.loja_nome || '');
            const nf = normalizarChaveNomeDespesa(d.nota_fiscal || '');
            if (!obra.includes(filtros.texto) && !loja.includes(filtros.texto) && !nf.includes(filtros.texto)) {
                return false;
            }
        }

        const pago = despesaEstaPagaNorm(d);
        const vencida = !pago && despesaEstaVencida(d);
        if (filtros.status === 'pago' && !pago) return false;
        if (filtros.status === 'vencido' && (pago || !vencida)) return false;
        if (filtros.status === 'a_vencer' && (pago || vencida)) return false;
        if (filtros.status === 'pendente' && pago) return false;
        return true;
    }

    function rotuloOrigemRelGeralNF(d) {
        return d._origem === 'relatorio_despesas' ? 'Relatório despesas' : 'Despesa obra';
    }

    function htmlCardNFRelGeral(d, isVencida) {
        const corBorda = isVencida ? '#dc3545' : '#ffc107';
        const corTexto = isVencida ? '#dc3545' : '#856404';
        const badgeFundo = isVencida ? '#f8d7da' : '#fff3cd';
        const textoBadge = isVencida ? '⚠️ VENCIDA' : '⏳ A VENCER';
        const vencTexto = formatarVencimentoDespesaExibirHtml(d);
        const chq = d.cheque_boleto_num ? escapeHtmlBasico(d.cheque_boleto_num) : '';
        const fotoHtml = d.foto_recibo
            ? '<img src="' + escapeAttrBasico(d.foto_recibo) + '" onclick="abrirFoto(\'' + String(d.foto_recibo).replace(/'/g, "\\'") + '\')" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:2px solid #e0e6ed;float:right;cursor:pointer;">'
            : '';
        return ''
            + '<div class="resultado-item" style="border-left-color:' + corBorda + ';">'
            + fotoHtml
            + '<span style="font-size:10px;background:#e8edf2;color:#1a2a43;padding:2px 6px;border-radius:4px;font-weight:bold;">' + escapeHtmlBasico(rotuloOrigemRelGeralNF(d)) + '</span> '
            + '<b style="color:' + corBorda + ';font-size:16px;">R$ ' + escapeHtmlBasico(String(d.valor_string || '0')) + '</b> '
            + '<span style="font-size:10px;background:' + badgeFundo + ';color:' + corTexto + ';padding:2px 6px;border-radius:4px;margin-left:5px;font-weight:bold;">' + textoBadge + '</span><br>'
            + '<span style="font-size:13px;color:#555;"><b>Obra:</b> ' + escapeHtmlBasico(d.obra_nome || '—') + '</span><br>'
            + '<span style="font-size:13px;color:#555;"><b>Fornecedor:</b> ' + escapeHtmlBasico(d.loja_nome || '—') + '</span><br>'
            + '<span style="font-size:13px;color:#1a2a43;"><b>Nota Fiscal:</b> ' + escapeHtmlBasico(d.nota_fiscal || 'Sem NF') + '</span><br>'
            + (chq ? '<span style="font-size:12px;color:#555;"><b>Chq./Boleto:</b> ' + chq + '</span><br>' : '')
            + '<span style="font-size:13px;color:' + corTexto + ';"><b>Vencimento:</b> ' + vencTexto + '</span><br>'
            + '<span style="font-size:12px;color:#888;">Lançamento: ' + escapeHtmlBasico(diaLancamentoDespExibir(d)) + '</span>'
            + (d.descricao ? '<div style="font-size:12px;margin-top:5px;padding-top:5px;border-top:1px solid #eee;">' + escapeHtmlBasico(String(d.descricao)) + '</div>' : '')
            + (d.observacao ? '<div style="font-size:11px;margin-top:4px;color:#666;"><b>Obs.:</b> ' + escapeHtmlBasico(String(d.observacao)) + '</div>' : '')
            + '</div>';
    }

    function htmlCardNFPagaRelGeral(d) {
        const compPgtoHtml = typeof montarHtmlComprovantePagamento === 'function' ? montarHtmlComprovantePagamento(d) : '';
        const chq = d.cheque_boleto_num ? escapeHtmlBasico(d.cheque_boleto_num) : '';
        const fotoHtml = d.foto_recibo
            ? '<img src="' + escapeAttrBasico(d.foto_recibo) + '" onclick="abrirFoto(\'' + String(d.foto_recibo).replace(/'/g, "\\'") + '\')" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:2px solid #e0e6ed;float:right;cursor:pointer;">'
            : '';
        return ''
            + '<div class="resultado-item" style="border-left-color:#28a745;opacity:0.9;background:#f4fdf6;">'
            + fotoHtml + compPgtoHtml
            + '<span style="font-size:10px;background:#e8edf2;color:#1a2a43;padding:2px 6px;border-radius:4px;font-weight:bold;">' + escapeHtmlBasico(rotuloOrigemRelGeralNF(d)) + '</span> '
            + '<b style="color:#28a745;font-size:16px;">R$ ' + escapeHtmlBasico(String(d.valor_string || '0')) + '</b> '
            + '<span style="font-size:10px;background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;margin-left:5px;font-weight:bold;">PAGO EM: ' + escapeHtmlBasico(d.data_pagamento || 'N/A') + '</span><br>'
            + '<span style="font-size:13px;color:#555;"><b>Obra:</b> ' + escapeHtmlBasico(d.obra_nome || '—') + '</span><br>'
            + '<span style="font-size:13px;color:#555;"><b>Fornecedor:</b> ' + escapeHtmlBasico(d.loja_nome || '—') + '</span><br>'
            + '<span style="font-size:13px;color:#1a2a43;"><b>Nota Fiscal:</b> ' + escapeHtmlBasico(d.nota_fiscal || 'Sem NF') + '</span><br>'
            + (chq ? '<span style="font-size:12px;color:#555;"><b>Chq./Boleto:</b> ' + chq + '</span><br>' : '')
            + '<span style="font-size:12px;color:#888;">Lançamento: ' + escapeHtmlBasico(diaLancamentoDespExibir(d)) + '</span>'
            + (d.descricao ? '<div style="font-size:12px;margin-top:5px;padding-top:5px;border-top:1px solid #eee;color:#666;">' + escapeHtmlBasico(String(d.descricao)) + '</div>' : '')
            + (d.observacao ? '<div style="font-size:11px;margin-top:4px;color:#666;"><b>Obs.:</b> ' + escapeHtmlBasico(String(d.observacao)) + '</div>' : '')
            + '</div>';
    }

    window.toggleSecoesRelGeralNF = function (abrir) {
        const quadro = document.getElementById('rel-geral-nf-quadro');
        if (!quadro) return;
        quadro.querySelectorAll('details').forEach((det) => {
            if (abrir) det.setAttribute('open', '');
            else det.removeAttribute('open');
        });
    };

    function linhaExcelNFRelGeral(d, situacao) {
        const valorNum = Number(d.valor_numero != null ? d.valor_numero : (parseMoedaLocal(d.valor_string) || 0));
        return {
            'Situação': situacao,
            'Origem': rotuloOrigemRelGeralNF(d),
            'Obra': d.obra_nome || '',
            'Fornecedor': d.loja_nome || '',
            'Nota Fiscal': d.nota_fiscal || '',
            'Chq. / Boleto': d.cheque_boleto_num || '',
            'Vencimento': formatarVencimentoDespesaExibir(d),
            'Lançamento': diaLancamentoDespExibir(d),
            'Data pagamento': d.data_pagamento || '',
            'Valor (R$)': valorNum,
            'Descrição': d.descricao || '',
            'Observação': d.observacao || '',
            'Tem foto': d.foto_recibo ? 'Sim' : 'Não'
        };
    }

    function montarLinhasExcelRelGeralNF(pack, opcoes) {
        const linhas = [];
        if (opcoes.vencido) {
            (pack.vencidas || []).forEach((d) => linhas.push(linhaExcelNFRelGeral(d, 'VENCIDO')));
        }
        if (opcoes.aVencer) {
            (pack.aVencer || []).forEach((d) => linhas.push(linhaExcelNFRelGeral(d, 'A VENCER')));
        }
        if (opcoes.pagos) {
            (pack.pagasForn || []).forEach((d) => linhas.push(linhaExcelNFRelGeral(d, 'PAGO')));
        }
        return linhas;
    }

    function gerarExcelRelGeralNFEspelho(pack, opcoes) {
        if (!window.XLSX) {
            return Swal.fire('Erro', 'Biblioteca Excel não carregou. Recarregue a página (Ctrl+F5).', 'error');
        }

        const linhas = montarLinhasExcelRelGeralNF(pack, opcoes);
        if (!linhas.length) {
            return Swal.fire('Aviso', 'Não há registros nas opções selecionadas para exportar.', 'info');
        }

        const emp = String(pack.empresa || getEmpresaGestor() || 'Empresa').trim();
        const totalSelecionado = (opcoes.vencido ? pack.somaVencidas : 0)
            + (opcoes.aVencer ? pack.somaAVencer : 0)
            + (opcoes.pagos ? pack.somaPagas : 0);

        const ws = XLSX.utils.json_to_sheet(linhas);
        const colunas = Object.keys(linhas[0]);
        ws['!cols'] = colunas.map((c) => ({ wch: c === 'Descrição' || c === 'Observação' ? 36 : (c === 'Obra' || c === 'Fornecedor' ? 28 : 16) }));

        const range = XLSX.utils.decode_range(ws['!ref']);
        const idxValor = colunas.indexOf('Valor (R$)');
        if (idxValor >= 0) {
            for (let r = range.s.r + 1; r <= range.e.r; r += 1) {
                const addr = XLSX.utils.encode_cell({ r, c: idxValor });
                if (ws[addr] && typeof ws[addr].v === 'number') {
                    ws[addr].t = 'n';
                    ws[addr].z = '#,##0.00';
                }
            }
        }

        const linhaTotal = range.e.r + 2;
        const addrLabel = XLSX.utils.encode_cell({ r: linhaTotal, c: Math.max(0, idxValor - 1) });
        const addrTotal = XLSX.utils.encode_cell({ r: linhaTotal, c: idxValor });
        ws[addrLabel] = { t: 's', v: 'TOTAL EXPORTADO (R$)' };
        ws[addrTotal] = { t: 'n', v: totalSelecionado, z: '#,##0.00' };
        const novoFim = XLSX.utils.encode_cell({ r: linhaTotal, c: range.e.c });
        ws['!ref'] = `${ws['!ref'].split(':')[0]}:${novoFim}`;
        ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: range.e.r, c: range.e.c } }) };

        const resumo = [
            { Item: 'Empresa', Valor: emp },
            { Item: 'Gerado em', Valor: new Date().toLocaleString('pt-BR') },
            { Item: 'Vencido', Valor: opcoes.vencido ? pack.somaVencidas : 0 },
            { Item: 'A vencer', Valor: opcoes.aVencer ? pack.somaAVencer : 0 },
            { Item: 'Pagos', Valor: opcoes.pagos ? pack.somaPagas : 0 },
            { Item: 'Total exportado', Valor: totalSelecionado },
            { Item: 'Registros exportados', Valor: linhas.length }
        ];
        const wsResumo = XLSX.utils.json_to_sheet(resumo);
        wsResumo['!cols'] = [{ wch: 28 }, { wch: 24 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Notas Fiscais');
        XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
        const sufixoArquivo = sufixoArquivoExportRelGeralObras(opcoes);
        XLSX.writeFile(wb, 'espelho_relatorio_geral_nf' + sufixoArquivo + '_' + emp.replace(/\s+/g, '_') + '.xlsx');

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Excel exportado com sucesso!',
            showConfirmButton: false,
            timer: 2500
        });
    }

    function gerarPdfRelGeralNFEspelho(pack, opcoes) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4');
        const emp = String(pack.empresa || getEmpresaGestor() || 'Empresa').trim();

        const totalSelecionado = (opcoes.vencido ? pack.somaVencidas : 0)
            + (opcoes.aVencer ? pack.somaAVencer : 0)
            + (opcoes.pagos ? pack.somaPagas : 0);

        doc.setFillColor(26, 42, 67);
        doc.rect(0, 0, 297, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('ESPELHO — RELATÓRIO GERAL DE NOTAS FISCAIS', 14, 12);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(220, 220, 220);
        doc.text(emp + '  |  Gerado em: ' + new Date().toLocaleString('pt-BR') + '  |  Gestor 360', 14, 20);

        let xResumo = 14;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        if (opcoes.vencido) {
            doc.setTextColor(220, 53, 69);
            doc.text('Vencido: ' + formatarMoeda(pack.somaVencidas), xResumo, 28);
            xResumo += 64;
        }
        if (opcoes.aVencer) {
            doc.setTextColor(133, 100, 4);
            doc.text('A vencer: ' + formatarMoeda(pack.somaAVencer), xResumo, 28);
            xResumo += 64;
        }
        if (opcoes.pagos) {
            doc.setTextColor(40, 167, 69);
            doc.text('Pagos: ' + formatarMoeda(pack.somaPagas), xResumo, 28);
            xResumo += 64;
        }
        doc.setTextColor(26, 42, 67);
        doc.text('Total exportado: ' + formatarMoeda(totalSelecionado), Math.min(xResumo, 206), 28);

        const headNf = [['Estado', 'Origem', 'Obra', 'Fornecedor', 'NF', 'Vencimento', 'Valor (R$)', 'Descrição']];
        const estiloTabela = {
            theme: 'striped',
            styles: { fontSize: 7, cellPadding: 2.5, valign: 'middle', textColor: '#333333' },
            headStyles: { fillColor: '#1a2a43', textColor: '#ffffff', fontStyle: 'bold' },
            alternateRowStyles: { fillColor: '#f5f8fa' },
            margin: { left: 14, right: 14 },
            didDrawPage: function (data) {
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text('Página ' + doc.internal.getNumberOfPages(), data.settings.margin.left, doc.internal.pageSize.height - 8);
            }
        };

        function linhaNfPdf(d, estado) {
            return [
                estado,
                rotuloOrigemRelGeralNF(d),
                String(d.obra_nome || '—').slice(0, 28),
                String(d.loja_nome || '—').slice(0, 24),
                String(d.nota_fiscal || '—').slice(0, 16),
                formatarVencimentoDespesaExibir(d),
                'R$ ' + String(d.valor_string || '0'),
                String(d.descricao || '').slice(0, 42)
            ];
        }

        let yAtual = 36;
        let incluiuAlgumaSecao = false;

        function blocoSecao(titulo, corRgb, body, head, didParseCell) {
            if (!body.length) return;
            incluiuAlgumaSecao = true;
            if (yAtual > 170) {
                doc.addPage();
                yAtual = 14;
            }
            doc.setFillColor.apply(doc, corRgb);
            doc.rect(14, yAtual, 269, 7, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(titulo, 16, yAtual + 5);
            yAtual += 10;
            doc.autoTable({
                ...estiloTabela,
                startY: yAtual,
                head: head,
                body: body,
                didParseCell: didParseCell || undefined
            });
            yAtual = doc.lastAutoTable.finalY + 8;
        }

        if (opcoes.vencido) {
            const body = (pack.vencidas || []).map((d) => linhaNfPdf(d, 'VENCIDO'));
            blocoSecao('EM ABERTO — VENCIDO', [220, 53, 69], body, headNf, function (data) {
                if (data.column.index === 0 && data.cell.section === 'body') {
                    data.cell.styles.textColor = '#dc3545';
                    data.cell.styles.fontStyle = 'bold';
                }
            });
        }
        if (opcoes.aVencer) {
            const body = (pack.aVencer || []).map((d) => linhaNfPdf(d, 'A VENCER'));
            blocoSecao('A VENCER — NO PRAZO', [255, 193, 7], body, headNf, function (data) {
                if (data.column.index === 0 && data.cell.section === 'body') {
                    data.cell.styles.textColor = '#856404';
                    data.cell.styles.fontStyle = 'bold';
                }
            });
        }
        if (opcoes.pagos) {
            const body = (pack.pagasForn || []).map((d) => linhaNfPdf(d, 'PAGO'));
            blocoSecao('JÁ PAGO', [40, 167, 69], body, headNf, function (data) {
                if (data.column.index === 0 && data.cell.section === 'body') {
                    data.cell.styles.textColor = '#28a745';
                    data.cell.styles.fontStyle = 'bold';
                }
            });
        }

        if (!incluiuAlgumaSecao) {
            return Swal.fire('Aviso', 'Não há registros nas opções selecionadas para exportar.', 'info');
        }

        const sufixoArquivo = sufixoArquivoExportRelGeralObras(opcoes);
        doc.save('espelho_relatorio_geral_nf' + sufixoArquivo + '_' + emp.replace(/\s+/g, '_') + '.pdf');
    }

    window.exportarPDFRelatorioGeralNotasFiscais = async function () {
        const pack = window._relGeralNFExport;
        if (!pack) {
            return Swal.fire('Atenção', 'Carregue o relatório de NF primeiro (Atualizar Relatório de NF).', 'warning');
        }

        const opcoes = await perguntarOpcoesExportRelGeralObras({
            vencidas: pack.vencidas,
            aVencer: pack.aVencer,
            pagasForn: pack.pagasForn,
            terceiros: [],
            somaVencidas: pack.somaVencidas,
            somaAVencer: pack.somaAVencer,
            somaPagas: pack.somaPagas
        }, {
            prefix: 'pdf-rel-nf',
            titulo: '🖨️ Exportar espelho PDF — Notas Fiscais',
            textoIntro: 'Escolha o período e marque o que deseja incluir no PDF:',
            botaoConfirmar: 'Gerar PDF'
        });
        if (!opcoes) return;
        const packFiltrado = filtrarPackRelGeralObrasPorPeriodo(pack, opcoes);
        const temItens = (opcoes.vencido && packFiltrado.vencidas.length)
            || (opcoes.aVencer && packFiltrado.aVencer.length)
            || (opcoes.pagos && packFiltrado.pagasForn.length);
        if (!temItens) {
            return Swal.fire('Sem registros', 'Nenhuma NF encontrada para <b>' + escapeHtmlBasico(packFiltrado.periodoLabel) + '</b>.', 'info');
        }
        gerarPdfRelGeralNFEspelho(packFiltrado, opcoes);
    };

    window.exportarExcelRelatorioGeralNotasFiscais = async function () {
        const pack = window._relGeralNFExport;
        if (!pack) {
            return Swal.fire('Atenção', 'Carregue o relatório de NF primeiro (Atualizar Relatório de NF).', 'warning');
        }

        const opcoes = await perguntarOpcoesExportRelGeralObras({
            vencidas: pack.vencidas,
            aVencer: pack.aVencer,
            pagasForn: pack.pagasForn,
            terceiros: [],
            somaVencidas: pack.somaVencidas,
            somaAVencer: pack.somaAVencer,
            somaPagas: pack.somaPagas
        }, {
            prefix: 'xls-rel-nf',
            titulo: '📊 Exportar espelho Excel — Notas Fiscais',
            textoIntro: 'Escolha o período e marque o que deseja incluir na planilha:',
            botaoConfirmar: 'Gerar Excel',
            corConfirmar: '#217346'
        });
        if (!opcoes) return;
        const packFiltrado = filtrarPackRelGeralObrasPorPeriodo(pack, opcoes);
        const temItens = (opcoes.vencido && packFiltrado.vencidas.length)
            || (opcoes.aVencer && packFiltrado.aVencer.length)
            || (opcoes.pagos && packFiltrado.pagasForn.length);
        if (!temItens) {
            return Swal.fire('Sem registros', 'Nenhuma NF encontrada para <b>' + escapeHtmlBasico(packFiltrado.periodoLabel) + '</b>.', 'info');
        }
        gerarExcelRelGeralNFEspelho(packFiltrado, opcoes);
    };

    window.carregarRelatorioGeralNotasFiscais = async function () {
        const empresaLogada = getEmpresaGestor();
        const divSecoes = document.getElementById('rel-geral-nf-secoes');
        const divResumo = document.getElementById('rel-geral-nf-resumo');
        const divTotais = document.getElementById('rel-geral-nf-resumo-totais');
        const divDetalhe = document.getElementById('rel-geral-nf-resumo-detalhe');
        const divAcoes = document.getElementById('rel-geral-nf-acoes');

        if (!empresaLogada) return Swal.fire('Atenção', 'Empresa não definida.', 'warning');
        if (!divSecoes) return;

        divSecoes.innerHTML = '<p style="text-align:center;color:#888;">Carregando relatório de notas fiscais...</p>';
        if (divResumo) divResumo.style.display = 'none';
        if (divAcoes) divAcoes.style.display = 'none';
        window._relGeralNFExport = null;

        const filtros = obterFiltrosRelGeralNF();

        try {
            const qDesp = query(collection(db, 'despesas_obras'), where('empresa_id', '==', empresaLogada));
            const qRel = query(collection(db, COLECAO_RELATORIO_DESPESAS), where('empresa_id', '==', empresaLogada));
            const [snapDesp, snapRel] = await Promise.all([getDocs(qDesp), getDocs(qRel)]);

            let itens = [];
            snapDesp.forEach((docSnap) => {
                itens.push(normalizarItemRelGeralNF({ id: docSnap.id, ...docSnap.data() }, 'despesas_obras'));
            });
            snapRel.forEach((docSnap) => {
                itens.push(normalizarItemRelGeralNF({ id: docSnap.id, ...docSnap.data() }, 'relatorio_despesas'));
            });

            montarCacheSugestoesRelGeralNF(itens);

            const totalBruto = itens.length;
            const comNf = itens.filter(notaFiscalPreenchida).length;
            itens = itens.filter((d) => itemPassaFiltroRelGeralNF(d, filtros));

            let htmlVencidas = '';
            let htmlAVencer = '';
            let htmlPagas = '';
            let somaVencidas = 0;
            let somaAVencer = 0;
            let somaPagas = 0;

            const pendentes = itens.filter((d) => !despesaEstaPagaNorm(d));
            const pagas = itens.filter((d) => despesaEstaPagaNorm(d));
            const listaVencidas = pendentes.filter((d) => despesaEstaVencida(d));
            const listaAVencer = pendentes.filter((d) => !despesaEstaVencida(d));
            ordenarRelatorioDespesasPorVencimento(listaVencidas);
            ordenarRelatorioDespesasPorVencimento(listaAVencer);
            ordenarRelatorioDespesasPorVencimento(pagas);

            listaVencidas.forEach((d) => {
                somaVencidas += (d.valor_numero || 0);
                htmlVencidas += htmlCardNFRelGeral(d, true);
            });

            listaAVencer.forEach((d) => {
                somaAVencer += (d.valor_numero || 0);
                htmlAVencer += htmlCardNFRelGeral(d, false);
            });

            const agrupadoPagas = {};
            pagas.forEach((d) => {
                somaPagas += (d.valor_numero || 0);
                const ref = separarDataSegura(d.data_pagamento || d.data);
                if (!agrupadoPagas[ref.ano]) agrupadoPagas[ref.ano] = {};
                if (!agrupadoPagas[ref.ano][ref.mes]) agrupadoPagas[ref.ano][ref.mes] = [];
                agrupadoPagas[ref.ano][ref.mes].push(d);
            });

            const chavesAno = Object.keys(agrupadoPagas).sort((a, b) => {
                if (a === 'Outros') return 1;
                if (b === 'Outros') return -1;
                return Number(b) - Number(a);
            });
            chavesAno.forEach((ano) => {
                htmlPagas += '<details class="pasta-ano"><summary>Ano ' + escapeHtmlBasico(ano) + '</summary><div class="folder-content">';
                const chavesMes = Object.keys(agrupadoPagas[ano]).sort((a, b) => {
                    if (a === 'Outros') return 1;
                    if (b === 'Outros') return -1;
                    return Number(b) - Number(a);
                });
                chavesMes.forEach((mes) => {
                    const nomeDoMes = nomeMeses[mes] || mes;
                    htmlPagas += '<details class="pasta-mes"><summary>' + escapeHtmlBasico(String(nomeDoMes)) + '</summary><div class="folder-content">';
                    ordenarRelatorioDespesasPorVencimento(agrupadoPagas[ano][mes]);
                    agrupadoPagas[ano][mes].forEach((d) => {
                        htmlPagas += htmlCardNFPagaRelGeral(d);
                    });
                    htmlPagas += '</div></details>';
                });
                htmlPagas += '</div></details>';
            });

            const emAberto = somaVencidas + somaAVencer;
            const totalGeral = emAberto + somaPagas;

            if (divTotais) {
                divTotais.innerHTML = montarHtmlPainelResumoDespesas(somaVencidas, somaAVencer, somaPagas, 'Total Geral (NF):');
            }
            if (divDetalhe) {
                const filtrosTxt = [];
                if (filtros.soComNf) filtrosTxt.push('somente com nº de NF');
                if (filtros.texto) filtrosTxt.push('busca: "' + (document.getElementById('rel-nf-filtro-texto')?.value || '').trim() + '"');
                if (filtros.status !== 'todos') filtrosTxt.push('situação: ' + filtros.status.replace('_', ' '));
                divDetalhe.innerHTML = '<b>' + itens.length + '</b> registro(s) exibido(s)'
                    + ' · Em aberto: <b>' + formatarMoeda(emAberto) + '</b>'
                    + ' · Pagos: <b>' + formatarMoeda(somaPagas) + '</b>'
                    + ' · Total: <b>' + formatarMoeda(totalGeral) + '</b>'
                    + '<br>Base: <b>' + totalBruto + '</b> lançamento(s) · <b>' + comNf + '</b> com NF preenchida'
                    + (filtrosTxt.length ? ' · Filtros: ' + filtrosTxt.join(' · ') : '');
            }
            if (divResumo) divResumo.style.display = 'block';
            if (divAcoes) divAcoes.style.display = 'flex';

            window._relGeralNFExport = {
                empresa: empresaLogada,
                somaVencidas,
                somaAVencer,
                somaPagas,
                emAberto,
                totalGeral,
                vencidas: listaVencidas.slice(),
                aVencer: listaAVencer.slice(),
                pagasForn: pagas.slice()
            };

            let htmlSecoes = '';
            const cntVenc = listaVencidas.length;
            const cntAvencer = listaAVencer.length;

            htmlSecoes += '<div id="rel-geral-nf-quadro">';

            htmlSecoes += '<details class="secao-despesas-busca secao-vencidas">'
                + '<summary>🔴 Em aberto — Vencido (' + cntVenc + ') — ' + formatarMoeda(somaVencidas) + ' <span class="secao-seta">▲</span></summary>'
                + '<div class="secao-despesas-conteudo">'
                + (htmlVencidas || '<p style="text-align:center;color:#888;padding:12px;">Nenhuma nota vencida com os filtros atuais.</p>')
                + '</div></details>';

            htmlSecoes += '<details class="secao-despesas-busca secao-avencer">'
                + '<summary>🟡 A vencer — No prazo (' + cntAvencer + ') — ' + formatarMoeda(somaAVencer) + ' <span class="secao-seta">▲</span></summary>'
                + '<div class="secao-despesas-conteudo">'
                + (htmlAVencer || '<p style="text-align:center;color:#888;padding:12px;">Nenhuma nota a vencer com os filtros atuais.</p>')
                + '</div></details>';

            htmlSecoes += '<details class="secao-despesas-busca secao-pagas">'
                + '<summary>🟢 Já pago (' + pagas.length + ') — ' + formatarMoeda(somaPagas) + ' <span class="secao-seta">▲</span></summary>'
                + '<div class="secao-despesas-conteudo">'
                + (htmlPagas || '<p style="text-align:center;color:#888;padding:12px;">Nenhuma nota paga com os filtros atuais.</p>')
                + '</div></details>';

            htmlSecoes += '</div>';

            if (!itens.length) {
                divSecoes.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">Nenhum registro encontrado com os filtros atuais.'
                    + (filtros.soComNf ? '<br><span style="font-size:12px;">Desmarque "Só com nº de NF preenchido" para ver lançamentos sem número de NF.</span>' : '')
                    + '</p>';
            } else {
                divSecoes.innerHTML = htmlSecoes;
            }
        } catch (e) {
            console.error(e);
            divSecoes.innerHTML = '<p style="text-align:center;color:#d9534f;">Erro ao carregar o relatório de notas fiscais. Tente novamente.</p>';
        }
    };

 window.buscarDespesasObra = async function() {
        const inputEl = document.getElementById('busca-obra');
        const termoBusca = normalizarChaveNomeDespesa(inputEl ? inputEl.value : '');
        const empresaLogada = getEmpresaGestor();

        let filtroAtual = window._filtroCadastroDespesa;
        if (filtroAtual) {
            if (filtroAtual.fornecedor && termoBusca !== normalizarChaveNomeDespesa(filtroAtual.fornecedor)) {
                if (!filtroAtual.obra || termoBusca !== normalizarChaveNomeDespesa(filtroAtual.obra)) {
                    window._filtroCadastroDespesa = null;
                    filtroAtual = null;
                }
            } else if (filtroAtual.obra && !filtroAtual.fornecedor && termoBusca !== normalizarChaveNomeDespesa(filtroAtual.obra)) {
                window._filtroCadastroDespesa = null;
                filtroAtual = null;
            }
        }
        filtroAtual = window._filtroCadastroDespesa;

        if (!termoBusca && !(filtroAtual && filtroAtual.obra)) {
            return Swal.fire('Atenção', 'Digite o nome da obra ou selecione uma obra acima.', 'warning');
        }

        fecharSugestoesBuscaDespesas();

        const divLista = document.getElementById('lista-despesas-resultados');
        const divTotal = document.getElementById('resumo-total-despesas');
        const btnExportar = document.getElementById('btnExportarDespesas');
        const btnExportarExcel = document.getElementById('btnExportarDespesasExcel');
        
        divLista.innerHTML = "Buscando relatórios...";
        ocultarQuadroControlesDespesas();
        divTotal.style.display = 'none';
        if (btnExportar) btnExportar.style.display = 'none';
        if (btnExportarExcel) btnExportarExcel.style.display = 'none';

        window.dadosExportacaoDespesas = [];

        try {
            const q = query(collection(db, "despesas_obras"), where("empresa_id", "==", empresaLogada));
            const qTer = query(collection(db, "pagamentos_terceiros"), where("empresa_id", "==", empresaLogada));
            const [querySnapshot, snapTer] = await Promise.all([getDocs(q), getDocs(qTer)]);

            // Criamos variáveis separadas para Vencidas e A Vencer
            let htmlVencidas = ""; let htmlAVencer = ""; let htmlPagas = "";
            let somaVencidas = 0; let somaAVencer = 0; let somaPagas = 0; let encontrou = false;
            
            let matching = [];
            querySnapshot.forEach(doc => {
                const d = { id: doc.id, ...doc.data() };
                if (despesaOuTerceiroCasaComBusca(d, filtroAtual, termoBusca, false)) matching.push(d);
            });

            // Todos os terceiros da empresa (normalizados)
            const todosTerceirosNorm = [];
            snapTer.forEach((docSnap) => {
                todosTerceirosNorm.push(normalizarTerceiroComoDespesaPaga({ id: docSnap.id, ...docSnap.data() }));
            });

            // 1) Terceiros que batem com a busca
            const terceirosMatching = [];
            const idsTer = new Set();
            todosTerceirosNorm.forEach((t) => {
                if (despesaOuTerceiroCasaComBusca(t, filtroAtual, termoBusca, true)) {
                    terceirosMatching.push(t);
                    idsTer.add(t.id);
                }
            });
            // 2) Também puxa terceiros ligados às despesas encontradas (mesma obra + fornecedor),
            //    mesmo que o nome no cadastro de terceiros seja um pouco diferente da busca
            matching.forEach((desp) => {
                todosTerceirosNorm.forEach((t) => {
                    if (idsTer.has(t.id)) return;
                    if (terceiroCasaComDespesaFornecedor(t, desp)) {
                        terceirosMatching.push(t);
                        idsTer.add(t.id);
                    }
                });
            });

            if (!matching.length && !terceirosMatching.length) {
                ocultarQuadroControlesDespesas();
                divLista.innerHTML = `<p style="color:#d9534f; text-align:center;">Nenhuma despesa encontrada.</p>`;
                return;
            }

            encontrou = true;
            ordenarRelatorioDespesasPorVencimento(matching);
            try {
                await sincronizarStatusPagoInconsistente(matching, 'despesas_obras');
            } catch (eSync) { /* segue mesmo se a correção falhar */ }

            // Terceiros da mesma obra+fornecedor abatem o saldo em aberto do contrato
            aplicarAbatimentoTerceirosNasDespesas(matching, terceirosMatching);

            window.dadosExportacaoDespesas = matching.slice().concat(terceirosMatching);

            let pendentesArray = matching.filter((d) => valorSaldoAbertoRelatorio(d) > 0.009);
            let agrupadoPagas = {};

            function valorPagoTerceiroNorm(t) {
                const n = Number(t && t.valor_numero);
                if (Number.isFinite(n) && n > 0) return n;
                return parseMoedaLocal((t && t.valor_string) || '0') || valorOriginalDespesa(t) || 0;
            }

            function adicionarPagoNoAgrupamento(d, valorPagoOverride) {
                const vAdd = valorPagoOverride != null
                    ? valorPagoOverride
                    : (d && d._origem === 'pagamentos_terceiros' ? valorPagoTerceiroNorm(d) : valorPagoDespesa(d));
                if (!(vAdd > 0)) return;
                somaPagas += vAdd;
                // Só lista no histórico "Pagas" as quitadas (ou terceiros). Parciais ficam em aberto com badge PARCIAL.
                if (despesaTemPagamentoParcial(d)) return;
                const { ano, mes, dia } = separarDataSegura(obterDataPagamentoDespesa(d) || d.data_pagamento || d.data);
                if (!agrupadoPagas[ano]) agrupadoPagas[ano] = {};
                if (!agrupadoPagas[ano][mes]) agrupadoPagas[ano][mes] = [];
                d.diaFormatado = dia;
                if (!agrupadoPagas[ano][mes].some((x) => x.id === d.id)) {
                    agrupadoPagas[ano][mes].push(d);
                }
            }

            // Já Pago = quitadas + parciais na despesa + abatimentos de terceiros
            const tercValorAbatido = new Map();
            matching.filter((d) => despesaEstaPaga(d)).forEach((d) => adicionarPagoNoAgrupamento(d));
            matching.forEach((d) => {
                if (despesaEstaPaga(d)) return;
                const pagoDoc = valorPagoDespesa(d);
                const abat = Number(d._abatimento_terceiros) || 0;
                if (pagoDoc > 0.009) somaPagas += pagoDoc;
                if (abat > 0.009) {
                    somaPagas += abat;
                    (d._terceiros_abatendo || []).forEach((t) => {
                        if (!t || !t.id) return;
                        tercValorAbatido.set(t.id, (tercValorAbatido.get(t.id) || 0) + (Number(t.valor) || 0));
                    });
                }
            });
            // Histórico de todos os terceiros; soma no Já Pago só o que ainda não abateu dívida
            terceirosMatching.forEach((t) => {
                const totalT = valorPagoTerceiroNorm(t);
                const jaAbat = tercValorAbatido.get(t.id) || 0;
                const resto = Math.max(0, Math.round((totalT - jaAbat) * 100) / 100);
                const { ano, mes, dia } = separarDataSegura(obterDataPagamentoDespesa(t) || t.data_pagamento || t.data);
                if (!agrupadoPagas[ano]) agrupadoPagas[ano] = {};
                if (!agrupadoPagas[ano][mes]) agrupadoPagas[ano][mes] = [];
                t.diaFormatado = dia;
                if (!agrupadoPagas[ano][mes].some((x) => x.id === t.id)) {
                    agrupadoPagas[ano][mes].push(t);
                }
                if (resto > 0.009) somaPagas += resto;
            });

            let avisoAnosHtml = '';
            if (relatorioDespesasTemVariosAnosVencimento(pendentesArray)) {
                avisoAnosHtml = '<p style="font-size:12px;background:#fff8e6;border:1px solid #ffc107;border-radius:8px;padding:10px;margin:0 0 12px 0;color:#856404;">'
                    + '<b>Vencimentos em anos diferentes.</b> A ordem usa o <b>ano</b> (ex.: 05/06/<b>2025</b> antes de 14/05/<b>2026</b>).</p>';
            }

            pendentesArray.forEach(d => {
                const fotoHtml = d.foto_recibo ? `<img src="${d.foto_recibo}" onclick="abrirFoto('${d.foto_recibo}')" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 2px solid #e0e6ed; float: right; cursor: pointer;">` : '';
                const isVencida = despesaEstaVencida(d);
                const vencTexto = formatarVencimentoDespesaExibirHtml(d);
                const orig = valorOriginalDespesa(d);
                const abatTer = Number(d._abatimento_terceiros) || 0;
                const pagoParc = valorPagoComTerceirosDespesa(d);
                const saldo = valorSaldoAbertoRelatorio(d);
                const ehParcial = despesaTemPagamentoParcial(d) || abatTer > 0.009;

                const corBorda = ehParcial ? '#17a2b8' : (isVencida ? '#dc3545' : '#ffc107');
                const corTexto = ehParcial ? '#0c5460' : (isVencida ? '#dc3545' : '#856404');
                const badgeFundo = ehParcial ? '#d1ecf1' : (isVencida ? '#f8d7da' : '#fff3cd');
                const textoBadge = ehParcial ? '💙 PARCIAL' : (isVencida ? '⚠️ VENCIDA' : '⏳ A VENCER');

                let histParcHtml = '';
                const pars = listaPagamentosParciaisDespesa(d);
                const ters = Array.isArray(d._terceiros_abatendo) ? d._terceiros_abatendo : [];
                if (pars.length || ters.length) {
                    histParcHtml = '<div style="margin-top:8px;padding:8px;background:#f0f9ff;border-radius:8px;font-size:11px;color:#0c5460;">';
                    if (pars.length) {
                        histParcHtml += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">'
                            + '<b>Pagamentos parciais (' + pars.length + '):</b>'
                            + '<button type="button" onclick="excluirPagamentosParciaisSelecionados()" style="background:#c0392b;color:#fff;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;font-weight:800;font-size:10px;">🗑️ Excluir selecionados</button>'
                            + '</div>'
                            + '<ul style="margin:6px 0 0 0;padding:0;list-style:none;">'
                            + pars.map(function (p, idxParc) {
                                const idParc = idEstavelPagamentoParcial(p, idxParc);
                                const rotulo = (p.data || '—') + ' — ' + formatarMoeda(p.valor || 0);
                                let extra = '';
                                const compMostrar = p.comprovante_pagamento || comprovanteDoGrupoParcial(d, p);
                                const refComp = p.comprovante_ref || (p.grupo_comprovante && (listaPagamentosParciaisDespesa(d).find(function (x) {
                                    return x && x.grupo_comprovante === p.grupo_comprovante && x.comprovante_ref;
                                }) || {}).comprovante_ref);
                                if (compMostrar) {
                                    const idComp = registrarAnexoParaViewer(compMostrar);
                                    const rotuloComp = ehAnexoPdfDataUrl(compMostrar) ? '📄 Ver PDF' : '📎 Ver comprovante';
                                    extra = ' <span style="color:#28a745;font-weight:700;cursor:pointer;" onclick="abrirAnexoRegistrado(\'' + idComp + '\')">' + rotuloComp + '</span>';
                                } else if (refComp) {
                                    extra = ' <span style="color:#28a745;font-weight:700;cursor:pointer;" onclick="abrirComprovantePagamentoRef(\'' + encodeURIComponent(refComp) + '\')">📄 Ver comprovante</span>';
                                } else if (p.baixa_sem_comprovante) {
                                    extra = ' <span style="color:#856404;">(sem comprovante — código)</span>';
                                }
                                extra += ' <span style="color:#4285F4;font-weight:800;cursor:pointer;" onclick="editarPagamentoParcialDespesa(\'' + escapeAttrBasico(d.id) + '\',\'' + encodeURIComponent(idParc) + '\')">✏️ Editar</span>';
                                extra += ' <span style="color:#856404;font-weight:800;cursor:pointer;" onclick="discriminarPagamentoParcialDespesa(\'' + escapeAttrBasico(d.id) + '\',\'' + encodeURIComponent(idParc) + '\')">📋 Discriminar</span>';
                                extra += ' <span style="color:#c0392b;font-weight:800;cursor:pointer;" onclick="excluirPagamentoParcialDespesa(\'' + escapeAttrBasico(d.id) + '\',\'' + encodeURIComponent(idParc) + '\')">🗑️ Excluir</span>';
                                const badgeGrupo = p.grupo_comprovante
                                    ? ' <span style="font-size:10px;background:#fff3cd;color:#856404;padding:1px 5px;border-radius:4px;font-weight:800;">mesmo comprovante</span>'
                                    : '';
                                return '<li style="display:flex;align-items:flex-start;gap:6px;margin:4px 0;">'
                                    + '<input type="checkbox" class="chk-parcial-sel" data-despesa-id="' + escapeAttrBasico(d.id) + '" data-parcial-id="' + encodeURIComponent(idParc) + '" data-rotulo="' + escapeAttrBasico(rotulo + ' · ' + (d.loja_nome || '')) + '" style="width:16px;height:16px;margin:2px 0 0 0;flex-shrink:0;">'
                                    + '<span>' + escapeHtmlBasico(p.data || '—') + ' — <b>' + formatarMoeda(p.valor || 0) + '</b>'
                                    + badgeGrupo
                                    + (p.observacao ? ' <span style="color:#666;">(' + escapeHtmlBasico(p.observacao) + ')</span>' : '')
                                    + extra
                                    + '</span></li>';
                            }).join('')
                            + '</ul>';
                    }
                    if (ters.length) {
                        histParcHtml += (pars.length ? '<div style="margin-top:8px;">' : '')
                            + '<b>Abatido de Terceiros (' + ters.length + '):</b><ul style="margin:6px 0 0 18px;padding:0;">'
                            + ters.map(function (t) {
                                return '<li>' + escapeHtmlBasico(t.data || '—') + ' — <b style="color:#28a745;">' + formatarMoeda(t.valor || 0) + '</b>'
                                    + ' <span style="color:#666;">(pagamento a terceiro)</span></li>';
                            }).join('')
                            + '</ul>'
                            + (pars.length ? '</div>' : '');
                    }
                    histParcHtml += '</div>';
                }

                const cardHtml = `
                    <div class="resultado-item" data-despesa-id="${escapeAttrBasico(d.id)}" style="border-left-color: ${corBorda};">
                        ${fotoHtml}
                        <b style="color: ${corBorda}; font-size: 16px;">${formatarMoeda(saldo)}</b> <span style="font-size: 10px; background: ${badgeFundo}; color: ${corTexto}; padding: 2px 6px; border-radius: 4px; margin-left: 5px; font-weight: bold;">${textoBadge}</span><br>
                        <span style="font-size:12px;color:#555;">Contrato/original: <b>${formatarMoeda(orig)}</b>${pagoParc > 0 ? ' · Já pago: <b style="color:#28a745;">' + formatarMoeda(pagoParc) + '</b>' + (abatTer > 0 ? ' <span style="color:#0c5460;">(inclui ' + formatarMoeda(abatTer) + ' de terceiros)</span>' : '') + ' · Saldo: <b style="color:#c0392b;">' + formatarMoeda(saldo) + '</b>' : ''}</span><br>
                        <span style="font-size: 13px; color: #555;"><b>Obra:</b> ${escapeHtmlBasico(d.obra_nome || '')}</span><br>
                        <span style="font-size: 13px; color: #555;"><b>Fornecedor:</b> ${escapeHtmlBasico(d.loja_nome || '')}</span><br>
                        <span style="font-size: 13px; color: #555;"><b>Nota Fiscal:</b> ${escapeHtmlBasico(d.nota_fiscal || 'Sem NF')}</span><br>
                        <span style="font-size: 13px; color: ${corTexto};"><b>Vencimento:</b> ${vencTexto}</span><br>
                        <span style="font-size: 12px; color: #888;">Inserido em: ${escapeHtmlBasico(d.data || '')}</span>
                        <div style="font-size: 12px; margin-top: 5px; padding-top: 5px; border-top: 1px solid #eee;">${escapeHtmlBasico(d.descricao || '')}</div>
                        ${histParcHtml}
                        <div style="display: flex; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #eee; flex-wrap:wrap;">
                            <button onclick="lancarPagamentoParcialDespesa('${d.id}')" style="background: #17a2b8; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; flex:1; min-width:140px; font-weight: bold; font-size: 12px;">💰 PAGAMENTO PARCIAL</button>
                            <button onclick="marcarComoPago('${d.id}')" style="background: #28a745; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; flex:1; min-width:120px; font-weight: bold; font-size: 12px;">✅ QUITAR TOTAL</button>
                            <button onclick="editarDespesa('${d.id}')" style="background: #4285F4; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; flex:1; min-width:90px; font-weight: bold; font-size: 12px;">✏️ EDITAR</button>
                            <button onclick="excluirDespesa('${d.id}')" style="background: #d9534f; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; flex:1; min-width:90px; font-weight: bold; font-size: 12px;">🗑️ EXCLUIR</button>
                        </div>
                    </div>`;

                if (isVencida) {
                    somaVencidas += saldo;
                    htmlVencidas += cardHtml;
                } else {
                    somaAVencer += saldo;
                    htmlAVencer += cardHtml;
                }
            });

            let chavesAno = Object.keys(agrupadoPagas).sort((a, b) => { if (a === 'Outros') return 1; if (b === 'Outros') return -1; return Number(b) - Number(a); });
            chavesAno.forEach(ano => {
                htmlPagas += `<details class="pasta-ano" open><summary>Ano ${ano}</summary><div class="folder-content">`;
                let chavesMes = Object.keys(agrupadoPagas[ano]).sort((a, b) => { if (a === 'Outros') return 1; if (b === 'Outros') return -1; return Number(b) - Number(a); });
                chavesMes.forEach(mes => {
                    const nomeDoMes = nomeMeses[mes] || mes; htmlPagas += `<details class="pasta-mes"><summary>${nomeDoMes}</summary><div class="folder-content">`;
                    ordenarRelatorioDespesasPorVencimento(agrupadoPagas[ano][mes]);
                    agrupadoPagas[ano][mes].forEach(d => {
                        const fotoHtml = d.foto_recibo ? `<img src="${d.foto_recibo}" onclick="abrirFoto('${d.foto_recibo}')" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 2px solid #e0e6ed; float: right; cursor: pointer;">` : '';
                        const compPgtoHtml = typeof montarHtmlComprovantePagamento === 'function' ? montarHtmlComprovantePagamento(d) : '';
                        const badgeOrigem = d._origem === 'pagamentos_terceiros'
                            ? '<span style="font-size:10px;background:#1a2a43;color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold;margin-right:4px;">👷 TERCEIRO</span>'
                            : '<span style="font-size:10px;background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;font-weight:bold;margin-right:4px;">🏪 FORNECEDOR</span>';
                        const btnEditar = d._origem === 'pagamentos_terceiros'
                            ? ''
                            : `<button onclick="editarDespesa('${d.id}')" style="background: #4285F4; color: white; border: none; padding: 8px; border-radius: 8px; cursor: pointer; width: 100%; font-weight: bold; font-size: 11px; transition: 0.3s;">✏️ EDITAR</button>`;
                        const btnArquivar = d._origem === 'pagamentos_terceiros'
                            ? ''
                            : `<button onclick="arquivarDespesaPaga('${d.id}')" style="background: #856404; color: white; border: none; padding: 8px; border-radius: 8px; cursor: pointer; width: 100%; font-weight: bold; font-size: 11px; transition: 0.3s;">🗄️ ARQUIVAR</button>`;
                        const btnExcluir = d._origem === 'pagamentos_terceiros'
                            ? ''
                            : `<button onclick="excluirDespesa('${d.id}')" style="background: #6c757d; color: white; border: none; padding: 8px; border-radius: 8px; cursor: pointer; width: 100%; font-weight: bold; font-size: 11px; transition: 0.3s;">🗑️ EXCLUIR</button>`;
                        htmlPagas += `
                            <div class="resultado-item" data-despesa-id="${escapeAttrBasico(d.id)}" style="border-left-color: #28a745; opacity: 0.85; background: #f4fdf6;">
                                ${fotoHtml}${compPgtoHtml}
                                ${badgeOrigem}
                                <b style="color: #28a745; font-size: 16px;">R$ ${d.valor_string}</b> <span style="font-size: 10px; background: #d4edda; color: #155724; padding: 2px 6px; border-radius: 4px; margin-left: 5px; font-weight: bold;">PAGO EM: ${obterDataPagamentoDespesa(d) || d.data_pagamento || 'N/A'}</span><br>
                                <span style="font-size: 13px; color: #555;"><b>Obra:</b> ${d.obra_nome || '—'}</span><br>
                                <span style="font-size: 13px; color: #555;"><b>Fornecedor:</b> ${d.loja_nome || '—'}</span><br>
                                <span style="font-size: 13px; color: #555;"><b>Nota Fiscal:</b> ${d.nota_fiscal || 'Sem NF'}</span><br>
                                <span style="font-size: 12px; color: #888;">Data: ${d.data || '—'}</span>
                                <div style="font-size: 12px; margin-top: 5px; padding-top: 5px; border-top: 1px solid #eee; color: #666;">${d.descricao || ''}</div>
                                ${btnEditar || btnArquivar || btnExcluir ? `<div style="display: flex; gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #eee;">${btnEditar}${btnArquivar}${btnExcluir}</div>` : ''}
                            </div>`;
                    }); htmlPagas += `</div></details>`;
                }); htmlPagas += `</div></details>`;
            });

            if (!htmlPagas && somaPagas <= 0) {
                htmlPagas = '<p style="font-size:13px;color:#666;padding:8px 4px;">Nenhum pagamento registado nesta busca. Se o valor foi pago em <b>Terceiros</b> ou só está na descrição, use <b>MARCAR PAGO</b> na despesa pendente.</p>';
            }

            // Atualiza o painel amarelo de resumo dividindo Vencido, a Vencer e Pago
            document.getElementById('total-gasto-display').innerHTML = montarHtmlPainelResumoDespesas(somaVencidas, somaAVencer, somaPagas, 'Total Global da Obra/Loja:');
            
            divTotal.style.display = 'block';
            if (btnExportar) btnExportar.style.display = 'inline-block';
            if (btnExportarExcel) btnExportarExcel.style.display = 'inline-block';
            divLista.innerHTML = '';
            renderizarQuadroControlesDespesas(htmlVencidas, htmlAVencer, htmlPagas, avisoAnosHtml);
            try {
                const secaoVenc = document.querySelector('#quadro-controles-secoes .secao-vencidas');
                const secaoPagas = document.querySelector('#quadro-controles-secoes .secao-pagas');
                if (secaoVenc && (somaVencidas > 0 || window._abrirSecaoVencidas)) {
                    secaoVenc.open = true;
                    if (secaoPagas) secaoPagas.open = false;
                } else if (secaoPagas && somaPagas > 0 && somaVencidas <= 0) {
                    secaoPagas.open = true;
                }
            } catch (eOpen) { /* ignore */ }
            window._abrirSecaoVencidas = false;
            if (window._destacarDespesaId) {
                const idDest = window._destacarDespesaId;
                window._destacarDespesaId = null;
                setTimeout(function () { destacarCardOrigemNota(idDest); }, 280);
            }

        } catch (e) {
            ocultarQuadroControlesDespesas();
            divLista.innerHTML = `<p style="color:red; text-align:center;">Erro ao buscar despesas.</p>`;
        }
    };

        window.excluirDespesa = async function(id) {
        let despesa = localizarNotaCadastradaPorId(id);
        if (despesa && despesa._origem === 'pagamentos_terceiros') despesa = null;
        if (!despesa) {
            despesa = (window.dadosExportacaoDespesas || []).find((d) => d && d.id === id && d._origem !== 'pagamentos_terceiros');
        }
        const paga = despesa ? despesaEstaPaga(despesa) : false;

        if (paga) {
            const conf = await Swal.fire({
                title: 'Conta paga',
                html: '<p style="text-align:left;font-size:13px;margin:0;">Esta conta está <b>quitada</b>. O ideal é <b>arquivar</b>: ela sai dos relatórios ativos e fica em <b>Arquivamento de Contas</b> (Ano → Mês → Dia), com nota e comprovante.</p>'
                    + '<p style="text-align:left;font-size:12px;color:#666;margin:10px 0 0 0;">Apagar permanente remove do sistema sem histórico.</p>',
                icon: 'question',
                showDenyButton: true,
                showCancelButton: true,
                confirmButtonText: '🗄️ Arquivar',
                denyButtonText: '🗑️ Apagar permanente',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#856404',
                denyButtonColor: '#c0392b'
            });
            if (conf.isConfirmed) {
                return arquivarDespesaPaga(id);
            }
            if (!conf.isDenied) {
                reabrirNotasResumoSePreciso();
                return;
            }
        } else {
            const conf = await Swal.fire({
                title: 'Apagar nota?',
                text: 'Remover permanentemente este cadastro?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d9534f',
                confirmButtonText: 'Sim, apagar!'
            });
            if (!conf.isConfirmed) {
                reabrirNotasResumoSePreciso();
                return;
            }
        }

        try {
            await deleteDoc(doc(db, 'despesas_obras', id));
            await Swal.fire('Apagado!', 'Removido do sistema.', 'success');
            const busca = document.getElementById('busca-obra');
            if (busca && busca.value.trim()) buscarDespesasObra();
            if (typeof carregarFiltrosDespesas === 'function') carregarFiltrosDespesas();
            if (typeof carregarRelatorioGeralObras === 'function' && document.getElementById('rel-geral-obras-quadro')) {
                carregarRelatorioGeralObras();
            }
            reabrirNotasResumoSePreciso();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível apagar.', 'error');
        }
    };

    const COLECAO_CONTAS_ARQUIVADAS = 'contas_arquivadas';

    function pastaArquivoDeDataPagamento(dataBr) {
        const sep = separarDataSegura(dataBr || '');
        const ano = (sep && sep.ano && sep.ano !== 'Outros') ? String(sep.ano) : String(new Date().getFullYear());
        const mes = (sep && sep.mes && sep.mes !== 'Outros') ? String(sep.mes).padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');
        const dia = (sep && sep.dia && sep.dia !== 'Outros') ? String(sep.dia).padStart(2, '0') : String(new Date().getDate()).padStart(2, '0');
        return { ano: ano, mes: mes, dia: dia, label: dia + '/' + mes + '/' + ano };
    }

    function limparParciaisParaArquivo(pars) {
        return (Array.isArray(pars) ? pars : []).map(function (p) {
            const copia = Object.assign({}, p || {});
            if (copia.comprovante_pagamento && (copia.comprovante_ref || String(copia.comprovante_pagamento).length > 80000)) {
                delete copia.comprovante_pagamento;
            }
            return copia;
        });
    }

    async function montarPayloadArquivoDespesa(despesa) {
        const dataPg = obterDataPagamentoDespesa(despesa)
            || despesa.data_pagamento
            || obterDataVencimentoDespesa(despesa)
            || despesa.data
            || dataPagamentoHojeBr();
        const pasta = pastaArquivoDeDataPagamento(dataPg);
        const pars = limparParciaisParaArquivo(listaPagamentosParciaisDespesa(despesa));
        const paga = typeof despesaEstaPaga === 'function' ? despesaEstaPaga(despesa) : false;
        const payload = {
            empresa_id: despesa.empresa_id || getEmpresaGestor() || '',
            origem_colecao: 'despesas_obras',
            origem_id: despesa.id || null,
            tipo_arquivo: 'despesa',
            obra_nome: despesa.obra_nome || '',
            loja_nome: despesa.loja_nome || '',
            nota_fiscal: despesa.nota_fiscal || '',
            descricao: despesa.descricao || '',
            observacao: despesa.observacao || '',
            valor_string: despesa.valor_string || '',
            valor_numero: Number(despesa.valor_numero) || valorOriginalDespesa(despesa) || 0,
            valor_pago_acumulado: paga
                ? (valorPagoDespesa(despesa) || valorOriginalDespesa(despesa) || 0)
                : (valorPagoDespesa(despesa) || 0),
            data_vencimento: obterDataVencimentoDespesa(despesa) || '',
            data_pagamento: dataPg,
            data: despesa.data || '',
            status: 'arquivado',
            status_origem: paga ? 'pago' : (despesa.status || 'pendente'),
            foto_recibo: despesa.foto_recibo || null,
            comprovante_pagamento: null,
            comprovante_ref: despesa.comprovante_ref || null,
            baixa_sem_comprovante: !!despesa.baixa_sem_comprovante,
            pagamentos_parciais: pars,
            pasta_ano: pasta.ano,
            pasta_mes: pasta.mes,
            pasta_dia: pasta.dia,
            pasta_label: pasta.label,
            arquivado_em: Date.now(),
            arquivado_em_str: new Date().toLocaleString('pt-BR'),
            timestamp: despesa.timestamp || Date.now()
        };

        // Se ainda houver comprovante embutido na despesa, guarda no sidecar
        if (despesa.comprovante_pagamento) {
            if (comprovanteDeveIrParaSidecar(despesa.comprovante_pagamento)) {
                const chave = 'arq_' + (despesa.id || Date.now());
                await gravarComprovanteSidecar(despesa.id || ('tmp_' + Date.now()), chave, despesa.comprovante_pagamento);
                payload.comprovante_ref = idSidecarComprovante(despesa.id || ('tmp_' + Date.now()), chave);
            } else {
                payload.comprovante_pagamento = despesa.comprovante_pagamento;
            }
        } else if (!payload.comprovante_ref) {
            const comParc = pars.slice().reverse().find(function (p) { return p && p.comprovante_ref; });
            if (comParc) payload.comprovante_ref = comParc.comprovante_ref;
        }

        // Evita estourar 1 MB: se foto for enorme, não copia (raro)
        if (payload.foto_recibo && String(payload.foto_recibo).length > 700000) {
            payload.foto_recibo = null;
            payload.foto_recibo_omitida = true;
        }
        return payload;
    }

    function montarPayloadArquivoTerceiro(t, motivo) {
        const dataPg = t.data || dataPagamentoHojeBr();
        const pasta = pastaArquivoDeDataPagamento(dataPg);
        const valor = Number(t.valor_numero) || parseMoedaLocal(t.valor_string || '0') || 0;
        return {
            empresa_id: t.empresa_id || getEmpresaGestor() || '',
            origem_colecao: 'pagamentos_terceiros',
            origem_id: t.id || null,
            tipo_arquivo: 'terceiro',
            obra_nome: t.obra || '',
            loja_nome: t.nome || '',
            nota_fiscal: '',
            descricao: t.descricao || 'Pagamento a terceiro',
            observacao: t.observacao || '',
            valor_string: t.valor_string || formatarMoeda(valor).replace(/^R\$\s?/, ''),
            valor_numero: valor,
            valor_pago_acumulado: valor,
            data_vencimento: '',
            data_pagamento: dataPg,
            data: t.data || '',
            status: 'arquivado',
            status_origem: 'terceiro',
            foto_recibo: null,
            comprovante_pagamento: null,
            comprovante_ref: null,
            baixa_sem_comprovante: false,
            pagamentos_parciais: [],
            cpf: t.cpf || '',
            tel: t.tel || '',
            pasta_ano: pasta.ano,
            pasta_mes: pasta.mes,
            pasta_dia: pasta.dia,
            pasta_label: pasta.label,
            motivo_arquivo: motivo || 'Arquivamento de obra',
            arquivado_em: Date.now(),
            arquivado_em_str: new Date().toLocaleString('pt-BR'),
            timestamp: t.timestamp || Date.now()
        };
    }

    window.arquivarDespesaPaga = async function (id) {
        if (!id) return;
        let despesa = localizarNotaCadastradaPorId(id);
        if (despesa && despesa._origem === 'pagamentos_terceiros') despesa = null;
        if (!despesa) {
            despesa = (window.dadosExportacaoDespesas || []).find(function (d) {
                return d && String(d.id) === String(id) && d._origem !== 'pagamentos_terceiros';
            });
        }
        if (!despesa) {
            try {
                const snap = await getDoc(doc(db, 'despesas_obras', id));
                if (snap.exists()) despesa = Object.assign({ id: snap.id }, snap.data() || {});
            } catch (e) { console.error(e); }
        }
        if (!despesa) {
            await Swal.fire('Atenção', 'Despesa não encontrada.', 'warning');
            reabrirNotasResumoSePreciso();
            return;
        }
        if (!despesaEstaPaga(despesa)) {
            await Swal.fire('Atenção', 'Só é possível arquivar conta totalmente paga. Conta em aberto use Excluir com cuidado.', 'info');
            reabrirNotasResumoSePreciso();
            return;
        }

        Swal.fire({ title: 'Arquivando...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
        try {
            const payload = await montarPayloadArquivoDespesa(despesa);
            await addDoc(collection(db, COLECAO_CONTAS_ARQUIVADAS), payload);
            await deleteDoc(doc(db, 'despesas_obras', id));
            Swal.fire(
                'Arquivada!',
                'Conta guardada em Arquivamento → ' + payload.pasta_ano + ' → ' + (nomeMeses[payload.pasta_mes] || payload.pasta_mes) + ' → dia ' + payload.pasta_dia + '.',
                'success'
            ).then(function () { reabrirNotasResumoSePreciso(); });
            const busca = document.getElementById('busca-obra');
            if (busca && busca.value.trim()) buscarDespesasObra();
            if (typeof carregarFiltrosDespesas === 'function') carregarFiltrosDespesas();
            if (typeof carregarRelatorioGeralObras === 'function' && document.getElementById('rel-geral-obras-quadro')) {
                carregarRelatorioGeralObras();
            }
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', mensagemErroUpdateDespesa(e), 'error');
        }
    };

    function htmlCardContaArquivada(a) {
        const valor = formatarMoeda(a.valor_pago_acumulado || a.valor_numero || 0);
        const fotoHtml = a.foto_recibo
            ? '<img src="' + escapeAttrBasico(a.foto_recibo) + '" onclick="abrirFoto(\'' + String(a.foto_recibo).replace(/'/g, "\\'") + '\')" style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:2px solid #e0e6ed;float:right;cursor:pointer;" title="Ver nota/recibo">'
            : '';
        const compHtml = typeof montarHtmlComprovantePagamento === 'function' ? montarHtmlComprovantePagamento(a) : '';
        const pars = Array.isArray(a.pagamentos_parciais) ? a.pagamentos_parciais : [];
        let hist = '';
        if (pars.length) {
            hist = '<div style="margin-top:8px;font-size:11px;color:#0c5460;background:#f0f9ff;padding:6px 8px;border-radius:8px;">'
                + '<b>Parciais / discriminação:</b><ul style="margin:4px 0 0 16px;padding:0;">'
                + pars.map(function (p) {
                    return '<li>' + escapeHtmlBasico(p.data || '—') + ' — <b>' + formatarMoeda(p.valor || 0) + '</b>'
                        + (p.observacao ? ' <span style="color:#666;">(' + escapeHtmlBasico(p.observacao) + ')</span>' : '')
                        + '</li>';
                }).join('')
                + '</ul></div>';
        }
        return ''
            + '<div class="resultado-item" style="border-left-color:#856404;background:#fffdf5;">'
            + fotoHtml + compHtml
            + '<span style="font-size:10px;background:#856404;color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold;">🗄️ ARQUIVADA</span> '
            + (a.tipo_arquivo === 'terceiro'
                ? '<span style="font-size:10px;background:#1a2a43;color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold;margin-left:4px;">👷 TERCEIRO</span> '
                : '')
            + (a.tipo_arquivo === 'relatorio_despesa'
                ? '<span style="font-size:10px;background:#334155;color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold;margin-left:4px;">📋 RELATÓRIO</span> '
                : '')
            + (a.status_origem && a.status_origem !== 'pago' && a.tipo_arquivo !== 'terceiro'
                ? '<span style="font-size:10px;background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;font-weight:bold;margin-left:4px;">' + escapeHtmlBasico(String(a.status_origem).toUpperCase()) + '</span> '
                : '')
            + '<b style="color:#856404;font-size:16px;">' + escapeHtmlBasico(valor) + '</b> '
            + '<span style="font-size:10px;background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;margin-left:4px;font-weight:bold;">PAGO EM: ' + escapeHtmlBasico(a.data_pagamento || a.pasta_label || '—') + '</span><br>'
            + '<span style="font-size:13px;color:#555;"><b>Obra:</b> ' + escapeHtmlBasico(a.obra_nome || '—') + '</span><br>'
            + '<span style="font-size:13px;color:#555;"><b>Fornecedor:</b> ' + escapeHtmlBasico(a.loja_nome || '—') + '</span><br>'
            + '<span style="font-size:13px;color:#555;"><b>Nota Fiscal:</b> ' + escapeHtmlBasico(a.nota_fiscal || 'Sem NF') + '</span><br>'
            + '<span style="font-size:12px;color:#888;">Arquivada em: ' + escapeHtmlBasico(a.arquivado_em_str || '—') + '</span>'
            + (a.motivo_arquivo ? '<br><span style="font-size:11px;color:#856404;"><b>Motivo:</b> ' + escapeHtmlBasico(a.motivo_arquivo) + '</span>' : '')
            + (a.descricao ? '<div style="font-size:12px;margin-top:5px;padding-top:5px;border-top:1px solid #eee;color:#666;">' + escapeHtmlBasico(String(a.descricao)) + '</div>' : '')
            + hist
            + '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">'
            + '<button type="button" onclick="excluirContaArquivada(\'' + escapeAttrBasico(a.id) + '\')" style="background:#c0392b;color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;font-weight:800;font-size:12px;">🗑️ Apagar do arquivo</button>'
            + '</div></div>';
    }

    function nomePastaArquivoConta(a) {
        const n = String((a && a.obra_nome) || '').trim();
        if (n) return formatarNomeCanonicoDespesa ? formatarNomeCanonicoDespesa(n) : n.toUpperCase();
        const m = String((a && a.motivo_arquivo) || '');
        const match = m.match(/obra\s+(.+)$/i);
        if (match && match[1]) {
            const nome = match[1].trim();
            return formatarNomeCanonicoDespesa ? formatarNomeCanonicoDespesa(nome) : nome.toUpperCase();
        }
        return 'SEM OBRA';
    }

    function montarArvoreAnoMesDiaArquivo(itens) {
        const arvore = {};
        itens.forEach(function (a) {
            const ano = a.pasta_ano || 'Outros';
            const mes = a.pasta_mes || 'Outros';
            const dia = a.pasta_dia || 'Outros';
            if (!arvore[ano]) arvore[ano] = {};
            if (!arvore[ano][mes]) arvore[ano][mes] = {};
            if (!arvore[ano][mes][dia]) arvore[ano][mes][dia] = [];
            arvore[ano][mes][dia].push(a);
        });
        return arvore;
    }

    function htmlPastasAnoMesDiaArquivo(itens) {
        const arvore = montarArvoreAnoMesDiaArquivo(itens);
        let html = '';
        Object.keys(arvore).sort(function (a, b) {
            if (a === 'Outros') return 1;
            if (b === 'Outros') return -1;
            return Number(b) - Number(a);
        }).forEach(function (ano) {
            const qtdAno = Object.keys(arvore[ano]).reduce(function (s, m) {
                return s + Object.keys(arvore[ano][m]).reduce(function (s2, d) { return s2 + arvore[ano][m][d].length; }, 0);
            }, 0);
            html += '<details class="pasta-ano" open><summary>📁 Ano ' + escapeHtmlBasico(ano) + ' (' + qtdAno + ')</summary><div class="folder-content">';
            Object.keys(arvore[ano]).sort(function (a, b) {
                if (a === 'Outros') return 1;
                if (b === 'Outros') return -1;
                return Number(b) - Number(a);
            }).forEach(function (mes) {
                const nomeMes = nomeMeses[mes] || mes;
                const qtdMes = Object.keys(arvore[ano][mes]).reduce(function (s, d) { return s + arvore[ano][mes][d].length; }, 0);
                html += '<details class="pasta-mes" open><summary>📂 ' + escapeHtmlBasico(String(nomeMes)) + ' (' + qtdMes + ')</summary><div class="folder-content">';
                Object.keys(arvore[ano][mes]).sort(function (a, b) {
                    if (a === 'Outros') return 1;
                    if (b === 'Outros') return -1;
                    return Number(b) - Number(a);
                }).forEach(function (dia) {
                    const listaDia = arvore[ano][mes][dia];
                    html += '<details class="pasta-mes" open><summary>🗓️ Dia ' + escapeHtmlBasico(dia) + '/' + escapeHtmlBasico(mes) + '/' + escapeHtmlBasico(ano) + ' (' + listaDia.length + ')</summary><div class="folder-content">';
                    listaDia.forEach(function (item) { html += htmlCardContaArquivada(item); });
                    html += '</div></details>';
                });
                html += '</div></details>';
            });
            html += '</div></details>';
        });
        return html;
    }

    function renderBaloesArquivamentoContas(itens) {
        const baloesEl = document.getElementById('arq-contas-baloes');
        if (!baloesEl) return;
        const porPasta = {};
        itens.forEach(function (a) {
            const nome = nomePastaArquivoConta(a);
            if (!porPasta[nome]) porPasta[nome] = { nome: nome, qtd: 0, total: 0 };
            porPasta[nome].qtd += 1;
            porPasta[nome].total += Number(a.valor_pago_acumulado || a.valor_numero) || 0;
        });
        const pastas = Object.keys(porPasta).map(function (k) { return porPasta[k]; })
            .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });

        window._pastasArquivoContas = pastas;
        window._itensArquivoPorPasta = porPasta;

        if (!pastas.length) {
            baloesEl.innerHTML = '';
            return;
        }

        const sel = window._pastaArquivoSelecionada || '';
        let html = '<div class="desp-baloes-secao" style="margin:0;">'
            + '<p class="desp-baloes-titulo" style="margin:0 0 8px 0;">Pastas arquivadas: <span class="desp-cadastro-contagem">' + pastas.length + '</span></p>'
            + '<div class="desp-baloes-lista">';
        pastas.forEach(function (p) {
            const n = escapeHtmlBasico(p.nome);
            const selClass = (sel && normalizarChaveNomeDespesa(sel) === normalizarChaveNomeDespesa(p.nome))
                ? ' badge-tag-selecionado'
                : '';
            html += '<span class="badge-tag-wrap' + selClass + '" style="margin:0 6px 6px 0;">'
                + '<span role="button" tabindex="0" class="badge-tag badge-tag-desp" '
                + 'onclick="selecionarPastaArquivamento(\'' + String(p.nome).replace(/'/g, "\\'") + '\')" '
                + 'title="Abrir pasta: ' + n + '">'
                + n + ' <small style="opacity:0.85;font-weight:600;">(' + p.qtd + ')</small>'
                + '</span></span>';
        });
        html += '</div>'
            + '<p class="texto-explicacao" style="margin:8px 0 0 0;padding:0;font-size:11px;color:#64748b;">Clique no balão da obra excluída para ver o histórico Ano → Mês → Dia.</p>'
            + '</div>';
        baloesEl.innerHTML = html;
    }

    window.selecionarPastaArquivamento = function (nomePasta) {
        const nome = String(nomePasta || '').trim();
        if (!nome) return;
        window._pastaArquivoSelecionada = nome;
        const todos = window._contasArquivadasCache || [];
        const chave = normalizarChaveNomeDespesa(nome);
        const filtrados = todos.filter(function (a) {
            return normalizarChaveNomeDespesa(nomePastaArquivoConta(a)) === chave;
        });
        renderBaloesArquivamentoContas(todos);
        const tituloEl = document.getElementById('arq-contas-pasta-titulo');
        const listaEl = document.getElementById('arq-contas-lista');
        if (tituloEl) {
            tituloEl.style.display = 'block';
            tituloEl.innerHTML = '📁 Pasta: <span style="color:#856404;">' + escapeHtmlBasico(nome) + '</span>'
                + ' <span style="font-weight:600;color:#64748b;font-size:12px;">(' + filtrados.length + ' lançamento(s))</span>';
        }
        if (listaEl) {
            if (!filtrados.length) {
                listaEl.innerHTML = '<p style="text-align:center;color:#888;padding:16px;">Nenhum lançamento nesta pasta.</p>';
            } else {
                listaEl.innerHTML = htmlPastasAnoMesDiaArquivo(filtrados);
            }
        }
    };

    window.carregarArquivamentoContas = async function () {
        const listaEl = document.getElementById('arq-contas-lista');
        const resumoEl = document.getElementById('arq-contas-resumo');
        const baloesEl = document.getElementById('arq-contas-baloes');
        const tituloEl = document.getElementById('arq-contas-pasta-titulo');
        const empresa = getEmpresaGestor();
        if (!listaEl) return;
        if (!empresa) return Swal.fire('Atenção', 'Empresa não definida.', 'warning');
        listaEl.innerHTML = '<p style="text-align:center;color:#888;">Carregando arquivo...</p>';
        if (baloesEl) baloesEl.innerHTML = '';
        if (tituloEl) { tituloEl.style.display = 'none'; tituloEl.innerHTML = ''; }
        if (resumoEl) resumoEl.style.display = 'none';
        try {
            const busca = ((document.getElementById('arq-contas-busca') && document.getElementById('arq-contas-busca').value) || '').trim().toLowerCase();
            const q = query(collection(db, COLECAO_CONTAS_ARQUIVADAS), where('empresa_id', '==', empresa));
            const snap = await getDocs(q);
            let itens = [];
            snap.forEach(function (d) { itens.push(Object.assign({ id: d.id }, d.data() || {})); });
            if (busca) {
                itens = itens.filter(function (a) {
                    const txt = [a.obra_nome, a.loja_nome, a.nota_fiscal, a.descricao, a.data_pagamento, a.motivo_arquivo].join(' ').toLowerCase();
                    return txt.indexOf(busca) !== -1;
                });
            }
            itens.sort(function (a, b) {
                const ka = String(a.pasta_ano || '') + String(a.pasta_mes || '') + String(a.pasta_dia || '');
                const kb = String(b.pasta_ano || '') + String(b.pasta_mes || '') + String(b.pasta_dia || '');
                if (ka !== kb) return kb.localeCompare(ka);
                return (Number(b.arquivado_em) || 0) - (Number(a.arquivado_em) || 0);
            });

            window._contasArquivadasCache = itens;
            const total = itens.reduce(function (s, a) { return s + (Number(a.valor_pago_acumulado || a.valor_numero) || 0); }, 0);
            if (resumoEl) {
                resumoEl.style.display = 'block';
                resumoEl.innerHTML = itens.length + ' conta(s) arquivada(s) · Total histórico: <b>' + formatarMoeda(total) + '</b>';
            }
            if (!itens.length) {
                if (baloesEl) baloesEl.innerHTML = '';
                listaEl.innerHTML = '<p style="text-align:center;color:#888;padding:16px;">Nenhuma conta arquivada ainda. Exclua uma obra (×) ou use <b>Arquivar</b> em conta paga.</p>';
                return;
            }

            renderBaloesArquivamentoContas(itens);

            // Mantém pasta aberta se ainda existir; se só houver 1 pasta, abre automaticamente
            const sel = window._pastaArquivoSelecionada || '';
            const aindaExiste = sel && itens.some(function (a) {
                return normalizarChaveNomeDespesa(nomePastaArquivoConta(a)) === normalizarChaveNomeDespesa(sel);
            });
            const pastasUnicas = {};
            itens.forEach(function (a) { pastasUnicas[nomePastaArquivoConta(a)] = true; });
            const nomesPastas = Object.keys(pastasUnicas);
            if (aindaExiste) {
                selecionarPastaArquivamento(sel);
            } else if (nomesPastas.length === 1) {
                selecionarPastaArquivamento(nomesPastas[0]);
            } else {
                window._pastaArquivoSelecionada = '';
                if (tituloEl) { tituloEl.style.display = 'none'; tituloEl.innerHTML = ''; }
                listaEl.innerHTML = '<p style="text-align:center;color:#888;padding:16px;">Clique no <b>balão</b> da obra para abrir a pasta Ano → Mês → Dia.</p>';
            }
        } catch (e) {
            console.error(e);
            listaEl.innerHTML = '<p style="text-align:center;color:#d9534f;">Erro ao carregar o arquivamento.</p>';
        }
    };

    window.excluirContaArquivada = async function (id) {
        if (!id) return;
        const conf = await Swal.fire({
            title: 'Apagar do arquivo?',
            text: 'Remove definitivamente do Arquivamento. Não volta para os relatórios ativos.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, apagar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#c0392b'
        });
        if (!conf.isConfirmed) return;
        try {
            await deleteDoc(doc(db, COLECAO_CONTAS_ARQUIVADAS, id));
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Removida do arquivo', showConfirmButton: false, timer: 2000 });
            carregarArquivamentoContas();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível apagar do arquivo.', 'error');
        }
    };

    function obterItensArquivamentoParaExport(escopo) {
        const todos = window._contasArquivadasCache || [];
        if (!todos.length) return { itens: [], label: '' };
        if (escopo === 'pasta') {
            const sel = window._pastaArquivoSelecionada || '';
            if (!sel) return { itens: [], label: '', erro: 'Selecione um balão de obra antes de exportar só a pasta.' };
            const chave = normalizarChaveNomeDespesa(sel);
            const itens = todos.filter(function (a) {
                return normalizarChaveNomeDespesa(nomePastaArquivoConta(a)) === chave;
            });
            return { itens: itens, label: 'Pasta: ' + sel };
        }
        return { itens: todos.slice(), label: 'Todas as pastas' };
    }

    async function perguntarEscopoExportArquivamento() {
        const todos = window._contasArquivadasCache || [];
        if (!todos.length) {
            await Swal.fire('Atenção', 'Nenhuma conta arquivada carregada. Clique em Atualizar arquivo.', 'info');
            return null;
        }
        const temPasta = !!(window._pastaArquivoSelecionada);
        const conf = await Swal.fire({
            title: 'Exportar arquivamento',
            html: '<p style="text-align:left;font-size:13px;margin:0 0 10px 0;">Escolha o que exportar:</p>'
                + '<label style="display:flex;align-items:center;gap:8px;text-align:left;margin:6px 0;cursor:pointer;">'
                + '<input type="radio" name="arq-exp-escopo" value="pasta" ' + (temPasta ? 'checked' : '') + (temPasta ? '' : ' disabled') + '>'
                + ' Só a pasta aberta' + (temPasta ? ' (<b>' + escapeHtmlBasico(window._pastaArquivoSelecionada) + '</b>)' : ' <span style="color:#888;">(clique num balão primeiro)</span>')
                + '</label>'
                + '<label style="display:flex;align-items:center;gap:8px;text-align:left;margin:6px 0;cursor:pointer;">'
                + '<input type="radio" name="arq-exp-escopo" value="tudo" ' + (temPasta ? '' : 'checked') + '>'
                + ' Todas as pastas arquivadas (<b>' + todos.length + '</b> lançamento(s))'
                + '</label>',
            showCancelButton: true,
            confirmButtonText: 'Continuar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#856404',
            preConfirm: function () {
                const el = document.querySelector('input[name="arq-exp-escopo"]:checked');
                return el ? el.value : 'tudo';
            }
        });
        if (!conf.isConfirmed) return null;
        return conf.value || 'tudo';
    }

    function montarLinhasExcelArquivamento(itens) {
        return (itens || []).map(function (a) {
            const valor = Number(a.valor_pago_acumulado != null ? a.valor_pago_acumulado : a.valor_numero) || 0;
            const tipo = a.tipo_arquivo === 'terceiro'
                ? 'Terceiro'
                : (a.tipo_arquivo === 'relatorio_despesa' ? 'Relatório despesa' : 'Despesa');
            return {
                'Pasta (obra)': nomePastaArquivoConta(a),
                'Tipo': tipo,
                'Fornecedor / Terceiro': a.loja_nome || a.nome || '',
                'Nota Fiscal': a.nota_fiscal || '',
                'Descrição': a.descricao || '',
                'Valor (R$)': valor,
                'Status origem': a.status_origem || '',
                'Data pagamento / pasta': a.data_pagamento || a.pasta_label || '',
                'Ano': a.pasta_ano || '',
                'Mês': a.pasta_mes || '',
                'Dia': a.pasta_dia || '',
                'Arquivada em': a.arquivado_em_str || '',
                'Motivo': a.motivo_arquivo || '',
                'Observação': a.observacao || ''
            };
        });
    }

    window.exportarExcelArquivamentoContas = async function () {
        if (!window.XLSX) {
            return Swal.fire('Erro', 'Biblioteca Excel não carregou. Recarregue a página (Ctrl+F5).', 'error');
        }
        const escopo = await perguntarEscopoExportArquivamento();
        if (!escopo) return;
        const pack = obterItensArquivamentoParaExport(escopo);
        if (pack.erro) return Swal.fire('Atenção', pack.erro, 'warning');
        if (!pack.itens.length) {
            return Swal.fire('Atenção', 'Nenhum lançamento para exportar neste escopo.', 'info');
        }

        const linhas = montarLinhasExcelArquivamento(pack.itens);
        const ws = XLSX.utils.json_to_sheet(linhas);
        const colunas = Object.keys(linhas[0]);
        ws['!cols'] = [
            { wch: 22 }, { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 36 },
            { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 8 }, { wch: 6 },
            { wch: 6 }, { wch: 18 }, { wch: 28 }, { wch: 24 }
        ];
        const range = XLSX.utils.decode_range(ws['!ref']);
        const idxValor = colunas.indexOf('Valor (R$)');
        if (idxValor >= 0) {
            for (let r = range.s.r + 1; r <= range.e.r; r += 1) {
                const addr = XLSX.utils.encode_cell({ r: r, c: idxValor });
                if (ws[addr] && typeof ws[addr].v === 'number') {
                    ws[addr].t = 'n';
                    ws[addr].z = '#,##0.00';
                }
            }
        }
        const total = linhas.reduce(function (s, ln) { return s + (Number(ln['Valor (R$)']) || 0); }, 0);
        const linhaTotal = range.e.r + 2;
        const addrLabel = XLSX.utils.encode_cell({ r: linhaTotal, c: Math.max(0, idxValor - 1) });
        const addrTotal = XLSX.utils.encode_cell({ r: linhaTotal, c: idxValor });
        ws[addrLabel] = { t: 's', v: 'TOTAL (R$)' };
        ws[addrTotal] = { t: 'n', v: total, z: '#,##0.00' };
        const novoFim = XLSX.utils.encode_cell({ r: linhaTotal, c: range.e.c });
        ws['!ref'] = ws['!ref'].split(':')[0] + ':' + novoFim;
        ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: range.e.r, c: range.e.c } }) };

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Arquivamento');
        const empresa = getEmpresaGestor() || 'Empresa';
        const sufixo = escopo === 'pasta'
            ? (window._pastaArquivoSelecionada || 'pasta')
            : 'todas';
        XLSX.writeFile(wb, nomeArquivoExcelSeguro('arquivamento_contas_' + empresa + '_' + sufixo) + '.xlsx');

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Excel do arquivamento exportado!',
            showConfirmButton: false,
            timer: 2500
        });
    };

    window.exportarPDFArquivamentoContas = async function () {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            return Swal.fire('Erro', 'Biblioteca PDF não carregou. Recarregue a página (Ctrl+F5).', 'error');
        }
        const escopo = await perguntarEscopoExportArquivamento();
        if (!escopo) return;
        const pack = obterItensArquivamentoParaExport(escopo);
        if (pack.erro) return Swal.fire('Atenção', pack.erro, 'warning');
        if (!pack.itens.length) {
            return Swal.fire('Atenção', 'Nenhum lançamento para exportar neste escopo.', 'info');
        }

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
        doc.text('Arquivamento de Contas', 14, 18);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(limparPdf(pack.label) + '  |  Gerado: ' + new Date().toLocaleString('pt-BR') + '  |  ' + pack.itens.length + ' lancamento(s)', 14, 23);

        let total = 0;
        const body = pack.itens.map(function (a) {
            const valor = Number(a.valor_pago_acumulado != null ? a.valor_pago_acumulado : a.valor_numero) || 0;
            total += valor;
            const tipo = a.tipo_arquivo === 'terceiro'
                ? 'Terceiro'
                : (a.tipo_arquivo === 'relatorio_despesa' ? 'Relatorio' : 'Despesa');
            return [
                limparPdf(nomePastaArquivoConta(a)).slice(0, 18),
                limparPdf(tipo),
                limparPdf(a.loja_nome || '').slice(0, 22),
                limparPdf(a.nota_fiscal || '—').slice(0, 12),
                limparPdf(a.data_pagamento || a.pasta_label || '—'),
                limparPdf(a.motivo_arquivo || '').slice(0, 24),
                limparPdf(typeof formatarMoeda === 'function' ? formatarMoeda(valor) : String(valor))
            ];
        });

        doc.autoTable({
            startY: 28,
            head: [['Pasta (obra)', 'Tipo', 'Fornecedor', 'NF', 'Pagamento', 'Motivo', 'Valor R$']],
            body: body,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1.6, valign: 'middle' },
            headStyles: { fillColor: [133, 100, 4], textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: { 6: { halign: 'right', cellWidth: 26 } },
            margin: { left: 10, right: 10 }
        });

        const yFinal = (doc.lastAutoTable && doc.lastAutoTable.finalY ? doc.lastAutoTable.finalY : 28) + 6;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('Total historico: ' + (typeof formatarMoeda === 'function' ? formatarMoeda(total) : String(total)), 14, yFinal);

        const sufixo = escopo === 'pasta'
            ? (window._pastaArquivoSelecionada || 'pasta')
            : 'todas';
        doc.save(nomeArquivoExcelSeguro('arquivamento_contas_' + empresa + '_' + sufixo) + '.pdf');

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'PDF do arquivamento exportado!',
            showConfirmButton: false,
            timer: 2500
        });
    };

    function rotuloOrigemNotaCadastrada(d) {
        if (notaVeioDoRelatorioDespesas(d)) return 'Exportar Relatórios';
        return 'Adicionar Despesas';
    }

    function htmlOrigemNotaBadge(d) {
        const rel = notaVeioDoRelatorioDespesas(d);
        const fundo = rel ? '#1a2a43' : '#1565c0';
        return '<span style="display:inline-block;font-size:10px;font-weight:800;letter-spacing:.02em;background:' + fundo + ';color:#fff;padding:3px 8px;border-radius:999px;">📍 ' + escapeHtmlBasico(rotuloOrigemNotaCadastrada(d)) + '</span>';
    }

    function destacarCardOrigemNota(id) {
        if (!id) return;
        const sid = String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        let el = null;
        try {
            el = document.querySelector('.resultado-item[data-despesa-id="' + sid + '"]')
                || document.querySelector('tr[data-despesa-id="' + sid + '"]')
                || document.querySelector('[data-despesa-id="' + sid + '"]');
        } catch (eSel) { el = null; }
        if (!el) return;
        let p = el.parentElement;
        while (p) {
            if (p.tagName === 'DETAILS') p.open = true;
            p = p.parentElement;
        }
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.outline = '3px solid #4285F4';
        el.style.boxShadow = '0 0 0 6px rgba(66,133,244,0.28)';
        setTimeout(function () {
            el.style.outline = '';
            el.style.boxShadow = '';
        }, 6500);
    }

    function htmlDetalheNotaCadastrada(d, indice) {
        const st = despesaEstaPaga(d) ? 'Pago' : (despesaEstaVencida(d) ? 'Vencida' : 'Pendente');
        const corSt = despesaEstaPaga(d) ? '#28a745' : (despesaEstaVencida(d) ? '#dc3545' : '#856404');
        const venc = formatarVencimentoDespesaExibir(d);
        const lanc = (typeof diaLancamentoDespExibir === 'function') ? diaLancamentoDespExibir(d) : (d.data || '');
        const chq = d.cheque_boleto_num ? String(d.cheque_boleto_num).trim() : '';
        const obs = d.observacao ? String(d.observacao).trim() : '';
        const valorTxt = String(d.valor_string || '0');
        const valorFmt = valorTxt.trim().startsWith('R$') ? valorTxt : ('R$ ' + valorTxt);
        const fotoHtml = d.foto_recibo
            ? '<p style="font-size:11px;color:#666;margin:12px 0 6px 0;text-align:center;">Clique na miniatura para ampliar</p>'
                + '<img src="' + d.foto_recibo + '" alt="Nota" onclick="abrirNotaResumoPorIndice(' + Number(indice) + ')" style="max-width:100%;max-height:240px;object-fit:contain;border-radius:8px;border:2px solid #4285F4;cursor:pointer;display:block;margin:0 auto;">'
            : '<p style="font-size:12px;color:#888;margin-top:12px;text-align:center;background:#f5f5f5;padding:12px;border-radius:8px;">Sem foto da nota / recibo.</p>';
        const compHtml = (typeof montarHtmlComprovantePagamento === 'function') ? montarHtmlComprovantePagamento(d) : '';
        return '<div style="text-align:left;font-size:13px;line-height:1.45;">'
            + '<div style="margin-bottom:10px;">' + htmlOrigemNotaBadge(d) + '</div>'
            + '<div style="margin-bottom:8px;"><span style="color:#666;font-size:11px;font-weight:700;">🏗️ OBRA</span><br><b style="color:#1a2a43;">' + escapeHtmlBasico(d.obra_nome || '—') + '</b></div>'
            + '<div style="margin-bottom:8px;"><span style="color:#666;font-size:11px;font-weight:700;">🏪 FORNECEDOR</span><br><b style="color:#1a2a43;">' + escapeHtmlBasico(d.loja_nome || '—') + '</b></div>'
            + '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px;">'
            + '<span><span style="color:#666;font-size:11px;">Valor</span><br><b>' + escapeHtmlBasico(valorFmt) + '</b></span>'
            + '<span><span style="color:#666;font-size:11px;">Status</span><br><b style="color:' + corSt + ';">' + st + '</b></span>'
            + '<span><span style="color:#666;font-size:11px;">Vencimento</span><br><b>' + escapeHtmlBasico(venc) + '</b></span>'
            + '</div>'
            + '<div style="font-size:12px;color:#555;margin-bottom:4px;"><b>NF / Recibo:</b> ' + escapeHtmlBasico(d.nota_fiscal || 'Sem NF') + '</div>'
            + (chq ? '<div style="font-size:12px;color:#555;margin-bottom:4px;"><b>Cheque / boleto:</b> ' + escapeHtmlBasico(chq) + '</div>' : '')
            + '<div style="font-size:12px;color:#888;margin-bottom:4px;"><b>Cadastrado em:</b> ' + escapeHtmlBasico(lanc || d.data || '—') + '</div>'
            + (despesaEstaPaga(d) ? '<div style="font-size:12px;color:#155724;margin-bottom:4px;"><b>Pago em:</b> ' + escapeHtmlBasico(obterDataPagamentoDespesa(d) || d.data_pagamento || '—') + '</div>' : '')
            + (d.descricao ? '<div style="font-size:12px;color:#444;margin-top:8px;padding-top:8px;border-top:1px solid #eee;">' + escapeHtmlBasico(String(d.descricao)) + '</div>' : '')
            + (obs ? '<div style="font-size:11px;color:#666;margin-top:6px;"><b>Obs.:</b> ' + escapeHtmlBasico(obs) + '</div>' : '')
            + (compHtml || '')
            + fotoHtml
            + '</div>';
    }

    window.abrirNotaResumoPorIndice = function (indice) {
        const lista = window._notasResumoVisualizarAtual || [];
        const item = lista[indice];
        if (item && item.foto_recibo) abrirFoto(item.foto_recibo);
    };

    window.visualizarNotaCadastradaResumo = function (indice) {
        const lista = window._notasResumoVisualizarAtual || [];
        const d = lista[indice];
        if (!d) return Swal.fire('Aviso', 'Nota não encontrada.', 'warning');
        const chaveObra = window._notasResumoChaveObra;
        const chaveLoja = window._notasResumoChaveLoja;
        Swal.fire({
            title: '📄 Nota cadastrada',
            html: htmlDetalheNotaCadastrada(d, indice),
            width: 640,
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: 'Voltar às notas',
            confirmButtonColor: '#1a2a43',
            denyButtonText: '✏️ Editar',
            denyButtonColor: '#4285F4',
            cancelButtonText: '📍 Ver origem',
            cancelButtonColor: '#856404'
        }).then(function (r) {
            if (r.isDenied) return window.editarNotaCadastradaResumo(indice);
            if (r.dismiss === Swal.DismissReason.cancel) return window.abrirOrigemNotaCadastrada(indice);
            if (chaveObra && chaveLoja) window.visualizarNotasDespesaResumo(chaveObra, chaveLoja);
        });
    };

    window.editarNotaCadastradaResumo = function (indice) {
        const lista = window._notasResumoVisualizarAtual || [];
        const d = lista[indice];
        if (!d || !d.id) return Swal.fire('Aviso', 'Nota não encontrada.', 'warning');
        window._reabrirNotasResumoAposEditar = true;
        if (notaVeioDoRelatorioDespesas(d)) return window.editarDespesaRelatorio(d.id);
        return window.editarDespesa(d.id);
    };

    window.excluirNotaCadastradaResumo = function (indice) {
        const lista = window._notasResumoVisualizarAtual || [];
        const d = lista[indice];
        if (!d || !d.id) return Swal.fire('Aviso', 'Nota não encontrada.', 'warning');
        window._reabrirNotasResumoAposEditar = true;
        if (notaVeioDoRelatorioDespesas(d)) return window.excluirLinhaRelatorioDespesas(d.id);
        return window.excluirDespesa(d.id);
    };

    window.abrirOrigemNotaCadastrada = async function (indice) {
        const lista = window._notasResumoVisualizarAtual || [];
        const d = lista[indice];
        if (!d) return Swal.fire('Aviso', 'Nota não encontrada.', 'warning');
        window._reabrirNotasResumoAposEditar = false;
        try { Swal.close(); } catch (eClose) { /* ignore */ }
        window._destacarDespesaId = d.id;
        if (notaVeioDoRelatorioDespesas(d)) {
            const btnExp = document.getElementById('btn-menu-relatorio-despesas');
            mudarAba('relatorio-despesas', btnExp);
            const filtro = document.getElementById('rel-desp-filtro');
            if (filtro) filtro.value = d.loja_nome || d.obra_nome || '';
            if (typeof window.carregarRelatorioDespesasTabular === 'function') {
                await window.carregarRelatorioDespesasTabular();
            }
            return;
        }
        const btnRel = document.getElementById('btn-menu-despesas-relatorio');
        mudarAba('despesas-relatorio', btnRel);
        const busca = document.getElementById('busca-obra');
        if (busca) busca.value = d.obra_nome || '';
        window._filtroCadastroDespesa = {
            obra: formatarNomeCanonicoDespesa(d.obra_nome || ''),
            fornecedor: formatarNomeCanonicoDespesa(d.loja_nome || '')
        };
        if (typeof window.buscarDespesasObra === 'function') {
            await window.buscarDespesasObra();
        }
    };

    window.visualizarNotasDespesaResumo = function (chaveObra, chaveLoja) {
        const mapKey = chaveObra + '||' + chaveLoja;
        const lista = (window._mapDespesasResumoFornecedor && window._mapDespesasResumoFornecedor[mapKey]) || [];
        if (!lista.length) {
            return Swal.fire('Sem registros', 'Nenhuma despesa encontrada para este fornecedor nesta obra.', 'info');
        }
        const ordenada = lista.slice().sort((a, b) => {
            const ta = dataVencimentoTsDespesa(a) || tsLancamentoDespesa(a) || 0;
            const tb = dataVencimentoTsDespesa(b) || tsLancamentoDespesa(b) || 0;
            return tb - ta;
        });
        window._notasResumoVisualizarAtual = ordenada;
        window._notasResumoChaveObra = chaveObra;
        window._notasResumoChaveLoja = chaveLoja;
        const nomeObra = formatarNomeCanonicoDespesa(ordenada[0].obra_nome) || 'Obra';
        const nomeLoja = formatarNomeCanonicoDespesa(ordenada[0].loja_nome) || 'Fornecedor';
        let html = '<p style="font-size:12px;color:#666;margin:0 0 12px 0;text-align:left;"><b>' + escapeHtmlBasico(nomeObra) + '</b> — <b>' + escapeHtmlBasico(nomeLoja) + '</b><br>'
            + 'A <b>origem</b> mostra onde a nota foi cadastrada. Use <b>Visualizar</b>, <b>Editar</b>, <b>Ver origem</b> ou <b>Excluir</b>.</p>';
        ordenada.forEach((d, idx) => {
            const st = despesaEstaPaga(d) ? 'Pago' : (despesaEstaVencida(d) ? 'Vencida' : 'Pendente');
            const corSt = despesaEstaPaga(d) ? '#28a745' : (despesaEstaVencida(d) ? '#dc3545' : '#856404');
            const venc = formatarVencimentoDespesaExibir(d);
            const fotoHtml = d.foto_recibo
                ? '<img src="' + d.foto_recibo + '" onclick="abrirNotaResumoPorIndice(' + idx + ')" alt="Nota" style="max-width:140px;max-height:100px;object-fit:cover;border-radius:8px;border:2px solid #4285F4;cursor:pointer;margin-top:8px;" title="Clique para ampliar">'
                : '<span style="display:inline-block;margin-top:8px;font-size:11px;color:#888;background:#f5f5f5;padding:6px 10px;border-radius:6px;">Sem foto da nota</span>';
            html += '<div style="text-align:left;border:1px solid #e0e6ed;border-radius:10px;padding:12px;margin-bottom:10px;background:#fafcff;">'
                + '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;">'
                + '<div>' + htmlOrigemNotaBadge(d) + '</div>'
                + '<span style="font-size:11px;color:#666;">Venc.: ' + escapeHtmlBasico(venc) + '</span></div>'
                + '<div style="margin-top:8px;"><b style="color:#1a2a43;">R$ ' + escapeHtmlBasico(String(d.valor_string || '0')) + '</b>'
                + ' <span style="font-size:11px;font-weight:700;color:' + corSt + ';">' + st + '</span></div>'
                + (d.nota_fiscal ? '<div style="font-size:11px;color:#555;margin-top:4px;">NF: ' + escapeHtmlBasico(String(d.nota_fiscal)) + '</div>' : '')
                + (d.descricao ? '<div style="font-size:11px;color:#444;margin-top:4px;">' + escapeHtmlBasico(String(d.descricao).slice(0, 120)) + '</div>' : '')
                + fotoHtml
                + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">'
                + '<button type="button" onclick="visualizarNotaCadastradaResumo(' + idx + ')" style="flex:1;min-width:90px;background:#1a2a43;color:#fff;border:none;padding:8px 10px;border-radius:8px;cursor:pointer;font-weight:800;font-size:11px;">👁️ Visualizar</button>'
                + '<button type="button" onclick="editarNotaCadastradaResumo(' + idx + ')" style="flex:1;min-width:90px;background:#4285F4;color:#fff;border:none;padding:8px 10px;border-radius:8px;cursor:pointer;font-weight:800;font-size:11px;">✏️ Editar</button>'
                + '<button type="button" onclick="abrirOrigemNotaCadastrada(' + idx + ')" style="flex:1;min-width:90px;background:#856404;color:#fff;border:none;padding:8px 10px;border-radius:8px;cursor:pointer;font-weight:800;font-size:11px;">📍 Ver origem</button>'
                + '<button type="button" onclick="excluirNotaCadastradaResumo(' + idx + ')" style="flex:1;min-width:90px;background:#d9534f;color:#fff;border:none;padding:8px 10px;border-radius:8px;cursor:pointer;font-weight:800;font-size:11px;">🗑️ Excluir</button>'
                + '</div></div>';
        });
        Swal.fire({
            title: '📄 Notas / Recibos',
            html: html,
            width: 720,
            confirmButtonText: 'Fechar',
            confirmButtonColor: '#1a2a43'
        });
    };

        window.gerarResumoFornecedores = async function() {
        const empresaLogada = getEmpresaGestor();
        const divTabela = document.getElementById('tabela-resumo-fornecedores');

        const obraSelecionada = (window._filtroCadastroDespesa && window._filtroCadastroDespesa.obra)
            ? formatarNomeCanonicoDespesa(window._filtroCadastroDespesa.obra)
            : (window._obraSelecionadaCadastros ? formatarNomeCanonicoDespesa(window._obraSelecionadaCadastros) : null);

        if (!obraSelecionada) {
            return Swal.fire(
                'Selecione uma obra',
                'Clique na etiqueta da obra acima (ex.: SANTO BROWNIE) antes de gerar o resumo. A tabela mostra só o local selecionado.',
                'info'
            );
        }

        const chaveObraFiltro = normalizarChaveNomeDespesa(obraSelecionada);
        const nomeObraTitulo = escapeHtmlBasico(obraSelecionada);
        
        divTabela.innerHTML = '<p style="text-align: center; color: #888; font-size: 13px;">⏳ A calcular saldos de <b>' + nomeObraTitulo + '</b>...</p>';
        
        try {
            const q = query(collection(db, "despesas_obras"), where("empresa_id", "==", empresaLogada));
            const querySnapshot = await getDocs(q);
            
            let resumo = {}; 
            let grafFornecedores = {};
            window._mapDespesasResumoFornecedor = {};
            let encontrouNaObra = false;

            function incorporarDespesaNoResumo(d) {
                const chObraDoc = normalizarChaveNomeDespesa(d.obra_nome || d.obra_lower || '');
                if (chObraDoc !== chaveObraFiltro) return;
                encontrouNaObra = true;
                const obra = formatarNomeCanonicoDespesa(d.obra_nome) || obraSelecionada;
                const loja = formatarNomeCanonicoDespesa(d.loja_nome) || 'NÃO INFORMADO';
                const chaveObra = chObraDoc || chaveObraFiltro;
                const chaveLoja = normalizarChaveNomeDespesa(d.loja_nome) || '__loja_vazia__';
                const mapKey = chaveObra + '||' + chaveLoja;
                if (!window._mapDespesasResumoFornecedor[mapKey]) window._mapDespesasResumoFornecedor[mapKey] = [];
                window._mapDespesasResumoFornecedor[mapKey].push(d);
                if (notaVeioDoRelatorioDespesas(d)) {
                    if (!window._mapRelatorioDespesasParaEdicao) window._mapRelatorioDespesasParaEdicao = {};
                    window._mapRelatorioDespesasParaEdicao[d.id] = d;
                }
                const valor = d.valor_numero || 0;
                const status = d.status || 'pendente';
                if (!resumo[chaveObra]) resumo[chaveObra] = { label: obra, lojas: {} };
                if (!resumo[chaveObra].lojas[chaveLoja]) resumo[chaveObra].lojas[chaveLoja] = { label: loja, pendente: 0, pago: 0 };
                if (!grafFornecedores[chaveLoja]) grafFornecedores[chaveLoja] = { label: loja, pendente: 0, pago: 0 };
                if (status === 'pago') {
                    resumo[chaveObra].lojas[chaveLoja].pago += valor;
                    grafFornecedores[chaveLoja].pago += valor;
                } else {
                    resumo[chaveObra].lojas[chaveLoja].pendente += valor;
                    grafFornecedores[chaveLoja].pendente += valor;
                }
            }
            
            querySnapshot.forEach(docSnap => {
                incorporarDespesaNoResumo({ id: docSnap.id, ...docSnap.data(), _origem: 'despesas_obras' });
            });
            try {
                const qRel = query(collection(db, COLECAO_RELATORIO_DESPESAS), where('empresa_id', '==', empresaLogada));
                const snapRel = await getDocs(qRel);
                snapRel.forEach(function (docSnap) {
                    incorporarDespesaNoResumo({ id: docSnap.id, ...docSnap.data(), _origem: 'relatorio_despesas' });
                });
            } catch (eRelResumo) { /* relatório de despesas é opcional neste cruzamento */ }

            if (!encontrouNaObra) {
                divTabela.innerHTML = '<p style="text-align: center; color: #d9534f; font-weight: bold;">Nenhuma despesa registada para a obra <b>' + nomeObraTitulo + '</b>.</p>';
                return;
            }
            
            let html = `
            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e0e6ed; margin-bottom: 20px;">
                <h4 style="text-align: center; color: var(--dark-navy); margin-top: 0; margin-bottom: 15px;">📊 Dívida por Fornecedor — ${nomeObraTitulo}</h4>
                <div style="position: relative; height: 250px; width: 100%;">
                    <canvas id="graficoFornecedores"></canvas>
                </div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                <thead>
                    <tr style="background: var(--dark-navy); color: white; text-align: left;">
                        <th style="padding: 12px; border: 1px solid #121e30;">🏢 Obra</th>
                        <th style="padding: 12px; border: 1px solid #121e30;">🏪 Fornecedor <span style="font-size:10px;font-weight:400;opacity:0.85;">(clique p/ ver nota)</span></th>
                        <th style="padding: 12px; border: 1px solid #121e30; text-align: right;">⚠️ A Pagar</th>
                        <th style="padding: 12px; border: 1px solid #121e30; text-align: right;">✅ Já Pago</th>
                    </tr>
                </thead>
                <tbody>
            `;
            
            let totalGeralPendente = 0;
            let totalGeralPago = 0;
            
            // Preencher Tabela
            Object.keys(resumo).sort((a, b) => resumo[a].label.localeCompare(resumo[b].label, 'pt-BR')).forEach(chaveObra => {
                const blocoObra = resumo[chaveObra];
                Object.keys(blocoObra.lojas).sort((a, b) => blocoObra.lojas[a].label.localeCompare(blocoObra.lojas[b].label, 'pt-BR')).forEach(chaveLoja => {
                    let valPendente = blocoObra.lojas[chaveLoja].pendente;
                    let valPago = blocoObra.lojas[chaveLoja].pago;
                    const nomeObra = blocoObra.label;
                    const nomeLoja = blocoObra.lojas[chaveLoja].label;
                    
                    totalGeralPendente += valPendente;
                    totalGeralPago += valPago;
                    
                    let corPendente = valPendente > 0 ? 'color: #d9534f; font-weight: bold;' : 'color: #aaa;';
                    let corPago = valPago > 0 ? 'color: #28a745; font-weight: bold;' : 'color: #aaa;';
                    
                    html += `
                    <tr style="border-bottom: 1px solid #e0e6ed;">
                        <td style="padding: 12px; border: 1px solid #e0e6ed; color: var(--dark-navy); font-weight: 600;">${escapeHtmlBasico(nomeObra)}</td>
                        <td style="padding: 12px; border: 1px solid #e0e6ed;">
                            <button type="button" class="btn-link-nota-resumo" data-chave-obra="${escapeAttrBasico(chaveObra)}" data-chave-loja="${escapeAttrBasico(chaveLoja)}" style="background:none;border:none;padding:0;margin:0;color:#1565c0 !important;text-decoration:underline;cursor:pointer;font-weight:700;font-size:12px;font-family:inherit;">📄 ${escapeHtmlBasico(nomeLoja)}</button>
                        </td>
                        <td style="padding: 12px; border: 1px solid #e0e6ed; text-align: right; ${corPendente}">${formatarMoeda(valPendente)}</td>
                        <td style="padding: 12px; border: 1px solid #e0e6ed; text-align: right; ${corPago}">${formatarMoeda(valPago)}</td>
                    </tr>
                    `;
                });
            });
            
            html += `
                </tbody>
                <tfoot style="background: #eef2f5; font-weight: bold;">
                    <tr>
                        <td colspan="2" style="padding: 12px; border: 1px solid #ccc; text-align: right;">TOTAL DA OBRA ${nomeObraTitulo}:</td>
                        <td style="padding: 12px; border: 1px solid #ccc; text-align: right; color: #d9534f;">${formatarMoeda(totalGeralPendente)}</td>
                        <td style="padding: 12px; border: 1px solid #ccc; text-align: right; color: #28a745;">${formatarMoeda(totalGeralPago)}</td>
                    </tr>
                </tfoot>
            </table>`;
            
            divTabela.innerHTML = html;
            divTabela.querySelectorAll('.btn-link-nota-resumo').forEach((btn) => {
                btn.addEventListener('click', () => {
                    visualizarNotasDespesaResumo(btn.getAttribute('data-chave-obra') || '', btn.getAttribute('data-chave-loja') || '');
                });
            });
            
            // Renderizar o Gráfico após o HTML ser inserido
            setTimeout(() => {
                const ctx = document.getElementById('graficoFornecedores').getContext('2d');
                if (window.graficoResumo) window.graficoResumo.destroy();
                const listaGraf = Object.values(grafFornecedores).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
                window.graficoResumo = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: listaGraf.map((v) => v.label),
                        datasets: [
                            { 
                                label: '⚠️ A Pagar (R$)', 
                                data: listaGraf.map(v => v.pendente), 
                                backgroundColor: '#d9534f' 
                            },
                            { 
                                label: '✅ Já Pago (R$)', 
                                data: listaGraf.map(v => v.pago), 
                                backgroundColor: '#28a745' 
                            }
                        ]
                    },
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom' } }
                    }
                });
            }, 100);
            
        } catch (error) {
            console.error(error);
            divTabela.innerHTML = '<p style="text-align: center; color: #d9534f;">Erro ao gerar o resumo. Tente novamente.</p>';
        }
    };
        
        window.salvarTerceiro = async function() {
        const nome = document.getElementById('t-nome').value.trim();
        const cpf = document.getElementById('t-cpf').value.trim();
        const tel = document.getElementById('t-tel').value.trim();
        const obra = document.getElementById('t-obra').value.trim();
        const valor = document.getElementById('t-valor').value;
        const desc = document.getElementById('t-desc').value.trim();
        const empresaLogada = getEmpresaGestor(); 
        
        if (!nome || !obra || !valor) return Swal.fire('Atenção', 'Preencha Nome, Obra e Valor!', 'warning');
        
        const btn = document.getElementById('btnSalvarTerceiro'); 
        btn.innerText = "⏳ A GUARDAR..."; btn.disabled = true;
        
        const dataObj = new Date(); 
        const dataAtual = `${String(dataObj.getDate()).padStart(2, '0')}/${String(dataObj.getMonth() + 1).padStart(2, '0')}/${dataObj.getFullYear()}`;
        
        try {
            await addDoc(collection(db, "pagamentos_terceiros"), { 
                empresa_id: empresaLogada, 
                nome: nome, nome_lower: nome.toLowerCase(), 
                cpf: cpf, tel: tel,
                obra: obra, obra_lower: obra.toLowerCase(), 
                valor_string: valor, valor_numero: parseMoedaLocal(valor), 
                descricao: desc, 
                data: dataAtual, timestamp: dataObj.getTime() 
            });
            Swal.fire('Sucesso!', 'Pagamento a terceiro registado.', 'success'); 
            document.getElementById('t-nome').value = ''; document.getElementById('t-cpf').value = ''; 
            document.getElementById('t-tel').value = ''; document.getElementById('t-obra').value = ''; 
            document.getElementById('t-valor').value = ''; document.getElementById('t-desc').value = ''; 
        } catch (e) { Swal.fire('Falha Técnica', 'Não foi possível salvar.', 'error'); } finally { 
            btn.innerText = "SALVAR PAGAMENTO"; btn.disabled = false; 
        }
    };

    window.buscarTerceiros = async function() {
        const termoBusca = document.getElementById('busca-terceiro').value.trim().toLowerCase(); 
        const empresaLogada = getEmpresaGestor();
        
        if (!termoBusca) return Swal.fire('Atenção', 'Digite o nome da obra ou do terceiro.', 'warning');

        const divLista = document.getElementById('lista-terceiros-resultados'); divLista.innerHTML = "Buscando..."; 

        try {
            const q = query(collection(db, "pagamentos_terceiros"), where("empresa_id", "==", empresaLogada)); 
            const querySnapshot = await getDocs(q);
            
            let htmlResultados = ""; let encontrou = false; let total = 0;
            let arrayResultados = []; 
            querySnapshot.forEach(doc => arrayResultados.push({id: doc.id, ...doc.data()})); 
            arrayResultados.sort((a, b) => b.timestamp - a.timestamp);

            arrayResultados.forEach((d) => {
                const nomeBusca = (d.nome_lower || d.nome || "").toLowerCase();
                const obraBusca = (d.obra_lower || d.obra || "").toLowerCase();

                if (obraBusca.includes(termoBusca) || nomeBusca.includes(termoBusca)) {
                    encontrou = true; total += (d.valor_numero || 0);
                    
                    htmlResultados += `
                        <div class="resultado-item" style="border-left-color: #1a2a43;">
                            <b style="color: #1a2a43; font-size: 16px;">R$ ${d.valor_string}</b> <br>
                            <span style="font-size: 13px; color: #555;"><b>Profissional:</b> ${d.nome} (CPF: ${d.cpf || 'N/A'})</span><br>
                            <span style="font-size: 13px; color: #555;"><b>Contato:</b> ${d.tel || 'N/A'}</span><br>
                            <span style="font-size: 13px; color: #555;"><b>Obra:</b> ${d.obra}</span><br>
                            <span style="font-size: 12px; color: #888;">Data: ${d.data}</span>
                            <div style="font-size: 12px; margin-top: 5px; padding-top: 5px; border-top: 1px solid #eee;">${d.descricao}</div>
                            
                            <div style="display: flex; gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #eee;">
                                <button onclick="excluirTerceiro('${d.id}')" style="background: #d9534f; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; width: 100%; font-weight: bold; font-size: 12px;">🗑️ APAGAR</button>
                            </div>
                        </div>`;
                }
            });

            if (!encontrou) { divLista.innerHTML = `<p style="color:#d9534f; text-align:center;">Nenhum registro encontrado.</p>`; return; }
            divLista.innerHTML = `<div style="text-align:center; margin-bottom: 15px; padding: 10px; background: #eef2f5; border-radius: 10px;">Total Gasto nesta busca: <b style="color:#1a2a43; font-size:16px;">${formatarMoeda(total)}</b></div>` + htmlResultados;

        } catch (e) { divLista.innerHTML = `<p style="color:red; text-align:center;">Erro ao buscar dados.</p>`; }
    };

    window.excluirTerceiro = async function(id) {
        Swal.fire({ title: 'Apagar?', text: "Remover permanentemente este registro?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d9534f', confirmButtonText: 'Sim, apagar!' }).then(async (result) => {
            if (result.isConfirmed) { 
                try { await deleteDoc(doc(db, "pagamentos_terceiros", id)); Swal.fire('Apagado!', 'Removido.', 'success'); buscarTerceiros(); 
                } catch (e) { Swal.fire('Erro', 'Não foi possível apagar.', 'error'); } 
            }
        });
    };

window.exportarPDF = function(tipo) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4'); 
        
        let title = '';
        let dados = [];
        let empresaAtualNome = getEmpresaGestor() || "Empresa";

        if (tipo === 'vales') {
            title = `${empresaAtualNome} - Relatório de Vales`;
            dados = window.dadosExportacaoVales;
        } else if (tipo === 'ponto') {
            title = `${empresaAtualNome} - Relatório de Ponto GPS`;
            dados = window.dadosExportacaoPonto;
        } else if (tipo === 'despesas') {
            title = `${empresaAtualNome} - Relatório de Despesas`;
            if (window._tituloExtraExportDespesas) {
                title += ` (${window._tituloExtraExportDespesas})`;
            }
            dados = window.dadosExportacaoDespesas;
        }
        
        if (dados.length === 0) {
            return Swal.fire('Erro', 'Faça uma busca primeiro antes de exportar o PDF.', 'error');
        }

        doc.setFillColor(26, 42, 67); 
        doc.rect(0, 0, 297, 25, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(title.toUpperCase(), 14, 12);
        
        doc.setTextColor(200, 200, 200);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Relatório gerado em: ${new Date().toLocaleString('pt-BR')}  |  Gestor 360`, 14, 19);

        let startY = 35;

        if (tipo === 'despesas') {
            let totalPago = 0, totalPendente = 0;
            dados.forEach(d => {
                let v = parseFloat(d.valor_numero) || 0;
                if (despesaEstaPaga(d)) totalPago += v;
                else totalPendente += v;
            });
            let totalGeral = totalPago + totalPendente;

            doc.setTextColor(51, 51, 51);
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text("RESUMO DA BUSCA:", 14, 33);

            doc.setFillColor(40, 167, 69);
            doc.rect(14, 36, 60, 12, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text(`PAGO: R$ ${totalPago.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 18, 44);

            doc.setFillColor(217, 83, 79);
            doc.rect(78, 36, 60, 12, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text(`PENDENTE: R$ ${totalPendente.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 82, 44);

            doc.setFillColor(238, 242, 245);
            doc.rect(142, 36, 60, 12, 'F');
            doc.setTextColor(26, 42, 67);
            doc.text(`TOTAL: R$ ${totalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, 146, 44);

            startY = 55; 
        }

        let head = []; 
        let body = [];

        if (tipo === 'vales') {
            head = [['Ano', 'Mês', 'Data e Hora', 'Nome', 'Valor (R$)', 'Tipo', 'Descrição', 'Assinatura']];
            dados.forEach(row => {
                const { ano, mes, dia } = separarDataSegura(row.data_criacao || row.data);
                const mesNome = nomeMeses[mes] || mes;
                body.push([ ano, mesNome, `${dia}/${mes}/${ano}\n${row.hora_criacao || ''}`, row.nome, `R$ ${row.valor}`, row.tipo, row.descricao, row.assinatura || '' ]);
            });
            gerarTabela(doc, head, body, startY, 7);

        } else if (tipo === 'ponto') {
            head = [['Ano', 'Mês', 'Data e Hora', 'Nome', 'Tipo', 'Obra/Local', 'Coordenadas GPS', 'Cancelamento (RH)', 'Selfie']];
            dados.forEach(row => {
                const { ano, mes, dia } = separarDataSegura(row.data);
                const mesNome = nomeMeses[mes] || mes;
                let celCancel = '—';
                if (row.cancelado_em_evento) {
                    const mot = String(row.cancelamento_motivo || '(sem texto de motivo)').trim();
                    celCancel = 'CANCELADO\nMotivo: ' + mot;
                }
                body.push([
                    ano,
                    mesNome,
                    `${dia}/${mes}/${ano}\n${row.hora || ''}`,
                    row.nome,
                    row.tipo,
                    row.obra,
                    textoCoordenadasParaExibicao(row),
                    celCancel,
                    row.foto || ''
                ]);
            });
            gerarTabela(doc, head, body, startY, 8);

        } else if (tipo === 'despesas') {
            head = [['Estado', 'Vencimento', 'Lançamento', 'Obra', 'Nome (fornec.)', 'Cheque / boleto / NF', 'Valor (R$)', 'Observação', 'Descrição', 'Recibo']];
            const dadosOrdenados = dados.slice();
            ordenarRelatorioDespesasPorVencimento(dadosOrdenados);
            dadosOrdenados.forEach(row => {
                let statusTexto = despesaEstaPaga(row) ? `PAGO\n${obterDataPagamentoDespesa(row) || row.data_pagamento || ''}` : 'PENDENTE';
                body.push([
                    statusTexto,
                    formatarVencimentoDespesaExibir(row),
                    diaLancamentoDespExibir(row),
                    row.obra_nome || '',
                    row.loja_nome || '',
                    refChequeBoletoDesp(row),
                    `R$ ${row.valor_string || '0,00'}`,
                    row.observacao || '—',
                    row.descricao || '',
                    row.foto_recibo || ''
                ]);
            });
            gerarTabela(doc, head, body, startY, 9);
        }

        function gerarTabela(documento, cabecalho, corpo, eixoY, imgIndex) {
            documento.autoTable({
                startY: eixoY, 
                head: cabecalho, 
                body: corpo, 
                theme: 'striped',
                styles: { fontSize: 8, cellPadding: 3, valign: 'middle', textColor: '#333333' }, 
                headStyles: { fillColor: '#1a2a43', textColor: '#ffffff', fontStyle: 'bold' }, 
                alternateRowStyles: { fillColor: '#f5f8fa' }, 
                columnStyles: Object.assign(
                    tipo === 'ponto' ? { 7: { cellWidth: 52 } } : {},
                    { [imgIndex]: { cellWidth: 35, minCellHeight: 25, halign: 'center' } }
                ),
                
                didParseCell: function(data) { 
                    if (data.column.index === imgIndex && data.cell.section === 'body') { 
                        data.cell.customImg = data.cell.raw; data.cell.text = ''; 
                    } 
                    if(tipo === 'despesas' && data.column.index === 0 && data.cell.section === 'body') {
                        if(data.cell.raw.includes('PAGO')) data.cell.styles.textColor = '#28a745';
                        else data.cell.styles.textColor = '#d9534f';
                        data.cell.styles.fontStyle = 'bold';
                    }
                    if (tipo === 'ponto' && data.column.index === 7 && data.cell.section === 'body') {
                        if (String(data.cell.raw || '').indexOf('CANCELADO') === 0) {
                            data.cell.styles.textColor = '#8a6d3b';
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                },
                didDrawCell: function(data) { 
                    if (data.column.index === imgIndex && data.cell.section === 'body') { 
                        let img = data.cell.customImg; 
                        if (img && img.startsWith('data:image')) { 
                            let isAssinatura = tipo === 'vales';
                            documento.addImage(img, isAssinatura ? 'PNG' : 'JPEG', data.cell.x + 2, data.cell.y + 2, 31, data.cell.height - 4); 
                        } 
                    } 
                },
                didDrawPage: function (data) {
                    let str = 'Página ' + documento.internal.getNumberOfPages();
                    documento.setFontSize(8);
                    documento.setTextColor(150);
                    documento.text(str, data.settings.margin.left, documento.internal.pageSize.height - 10);
                }
            });
        }

        const sufixoArq = (tipo === 'despesas' && window._sufixoExportDespesas) ? window._sufixoExportDespesas : '';
        doc.save(`relatorio_${tipo}_${empresaAtualNome}${sufixoArq}.pdf`.replace(/\s+/g, '_'));
    };
