/* js/api/despesas.js — edite este arquivo para alterar só este módulo */
    function timestampMeioDiaDataIso(ymd) {
        const p = String(ymd || '').split('-');
        if (p.length !== 3) return Date.now();
        const y = parseInt(p[0], 10);
        const m = parseInt(p[1], 10) - 1;
        const dd = parseInt(p[2], 10);
        if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(dd)) return Date.now();
        return new Date(y, m, dd, 12, 0, 0).getTime();
    }

    function obterDataVencimentoDespesa(d) {
        if (!d) return '';
        const v = d.data_vencimento ?? d.vencimento ?? d.dataVencimento ?? '';
        return v == null ? '' : v;
    }

    /** Converte vencimento em timestamp (ms). ISO tem prioridade; aceita BR, traços e Timestamp Firestore. */
    function parseDataVencimentoParaTimestamp(dataVenc) {
        if (dataVenc == null || dataVenc === '') return null;

        if (typeof dataVenc === 'number' && Number.isFinite(dataVenc)) {
            if (dataVenc > 1e11) return dataVenc;
            const s = String(Math.floor(dataVenc));
            if (s.length === 8) {
                const y = parseInt(s.slice(0, 4), 10);
                const m = parseInt(s.slice(4, 6), 10) - 1;
                const d = parseInt(s.slice(6, 8), 10);
                return new Date(y, m, d, 12, 0, 0).getTime();
            }
        }

        if (typeof dataVenc === 'object') {
            if (typeof dataVenc.toDate === 'function') {
                const dt = dataVenc.toDate();
                return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12, 0, 0).getTime();
            }
            if (dataVenc.seconds != null) {
                const dt = new Date(dataVenc.seconds * 1000);
                return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 12, 0, 0).getTime();
            }
        }

        const s = String(dataVenc).trim();
        if (!s) return null;

        let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) {
            const y = parseInt(m[1], 10);
            const mo = parseInt(m[2], 10) - 1;
            const d = parseInt(m[3], 10);
            if (y >= 1900 && y <= 2100 && mo >= 0 && mo <= 11 && d >= 1 && d <= 31) {
                return new Date(y, mo, d, 12, 0, 0).getTime();
            }
        }

        m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (m) {
            const d = parseInt(m[1], 10);
            const mo = parseInt(m[2], 10) - 1;
            const y = parseInt(m[3], 10);
            if (y >= 1900 && y <= 2100 && mo >= 0 && mo <= 11 && d >= 1 && d <= 31) {
                return new Date(y, mo, d, 12, 0, 0).getTime();
            }
        }

        m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (m) {
            const d = parseInt(m[1], 10);
            const mo = parseInt(m[2], 10) - 1;
            const y = parseInt(m[3], 10);
            if (y >= 1900 && y <= 2100 && mo >= 0 && mo <= 11 && d >= 1 && d <= 31) {
                return new Date(y, mo, d, 12, 0, 0).getTime();
            }
        }

        const { ano, mes, dia } = separarDataSegura(s);
        if (!ano || ano === 'Outros') return null;
        const y = parseInt(ano, 10);
        const mo = parseInt(mes, 10) - 1;
        const d = parseInt(dia, 10);
        if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
        if (y < 1900 || y > 2100 || mo < 0 || mo > 11 || d < 1 || d > 31) return null;
        return new Date(y, mo, d, 12, 0, 0).getTime();
    }

    function dataVencimentoTsDespesa(d) {
        if (!d) return null;
        const doCampo = parseDataVencimentoParaTimestamp(obterDataVencimentoDespesa(d));
        if (doCampo != null) return doCampo;
        const gravado = d.data_vencimento_ts;
        if (gravado != null && gravado !== '' && Number.isFinite(Number(gravado))) {
            return Number(gravado);
        }
        return null;
    }

    function tsLancamentoDespesa(d) {
        if (!d) return 0;
        if (d.data_lancamento) {
            const t = parseDataVencimentoParaTimestamp(d.data_lancamento);
            if (t != null) return t;
        }
        if (d.timestamp != null && Number.isFinite(Number(d.timestamp))) return Number(d.timestamp);
        return parseDataVencimentoParaTimestamp(d.data) || 0;
    }

    function dataVencimentoParaInputDateIso(dataVenc) {
        const ts = parseDataVencimentoParaTimestamp(dataVenc);
        if (ts != null) {
            const dt = new Date(ts);
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        }
        if (!dataVenc) return '';
        const s = String(dataVenc).trim();
        if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
            const p = s.split('-');
            return `${p[0]}-${String(p[1]).padStart(2, '0')}-${String(p[2]).padStart(2, '0')}`;
        }
        return dataBrParaInputDateIso(s);
    }

    function formatarVencimentoIsoParaBR(dataVenc) {
        if (!dataVenc) return '—';
        const ts = parseDataVencimentoParaTimestamp(dataVenc);
        if (ts != null) {
            const dt = new Date(ts);
            const dia = String(dt.getDate()).padStart(2, '0');
            const mes = String(dt.getMonth() + 1).padStart(2, '0');
            const ano = dt.getFullYear();
            return `${dia}/${mes}/${ano}`;
        }
        const { ano, mes, dia } = separarDataSegura(dataVenc);
        if (!ano || ano === 'Outros') return String(dataVenc);
        return `${dia}/${mes}/${ano}`;
    }

    function formatarVencimentoDespesaExibir(d) {
        return formatarVencimentoIsoParaBR(obterDataVencimentoDespesa(d));
    }

    /** Vencimento na tabela: vermelho se pendente e já passou. */
    function formatarVencimentoDespesaExibirHtml(d) {
        const ts = dataVencimentoTsDespesa(d);
        if (ts == null) return escapeHtmlBasico('—');
        const dt = new Date(ts);
        const dia = String(dt.getDate()).padStart(2, '0');
        const mes = String(dt.getMonth() + 1).padStart(2, '0');
        const ano = dt.getFullYear();
        const texto = dia + '/' + mes + '/' + ano;
        const hoje = new Date();
        hoje.setHours(12, 0, 0, 0);
        const vencida = dt.getTime() < hoje.getTime() && !despesaEstaPaga(d);
        if (vencida) {
            return '<span style="font-weight:800;color:#dc3545;">' + escapeHtmlBasico(texto) + '</span>';
        }
        return escapeHtmlBasico(dia + '/' + mes + '/') + '<span style="font-weight:800;color:#1a2a43;">' + ano + '</span>';
    }

    function badgeEstadoRelDespesaHtml(d) {
        const st = despesaEstaPaga(d) ? 'pago' : 'pendente';
        if (st === 'pago') {
            let badgeExtra = '';
            if (d.comprovante_pagamento) {
                const idComp = registrarAnexoParaViewer(d.comprovante_pagamento);
                const rotulo = ehAnexoPdfDataUrl(d.comprovante_pagamento) ? '📄 Ver PDF' : '📎 Ver comprovante';
                badgeExtra = '<br><span style="font-size:10px;color:#28a745;font-weight:700;cursor:pointer;" onclick="abrirAnexoRegistrado(\'' + idComp + '\')">' + rotulo + '</span>';
            } else if (d.baixa_sem_comprovante) {
                badgeExtra = '<br><span style="font-size:10px;color:#856404;">Sem comprovante</span>';
            }
            return '<span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;font-weight:bold;">Pago</span><br><span style="font-size:10px;color:#666;">' + escapeHtmlBasico(obterDataPagamentoDespesa(d) || d.data_pagamento || '') + '</span>' + badgeExtra;
        }
        if (despesaEstaVencida(d)) {
            return '<span style="background:#f8d7da;color:#721c24;padding:2px 8px;border-radius:4px;font-weight:bold;">⚠️ VENCIDA</span><br><span style="font-size:10px;color:#dc3545;font-weight:700;">Atrasada — pendente pagamento</span>';
        }
        return '<span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;font-weight:bold;">Pendente</span><br><span style="font-size:10px;color:#856404;">No prazo</span>';
    }

    window._relDespOrdemVenc = window._relDespOrdemVenc || 'cronologico';

    function rotuloOrdemVencRelDesp() {
        const m = window._relDespOrdemVenc || 'cronologico';
        if (m === 'vencidos_topo') return 'Vencimento ⚠▲';
        if (m === 'desc') return 'Vencimento ▼';
        return 'Vencimento ▲';
    }

    function aplicarOrdemRelDespVencimento(arr, modo) {
        const m = modo || window._relDespOrdemVenc || 'cronologico';
        if (m === 'vencidos_topo') {
            arr.sort((a, b) => {
                const pa = despesaEstaPaga(a) ? 2 : (despesaEstaVencida(a) ? 0 : 1);
                const pb = despesaEstaPaga(b) ? 2 : (despesaEstaVencida(b) ? 0 : 1);
                if (pa !== pb) return pa - pb;
                const ta = dataVencimentoTsDespesa(a);
                const tb = dataVencimentoTsDespesa(b);
                const va = ta != null ? ta : Number.MAX_SAFE_INTEGER;
                const vb = tb != null ? tb : Number.MAX_SAFE_INTEGER;
                if (va !== vb) return va - vb;
                return String(a.obra_nome || '').localeCompare(String(b.obra_nome || ''), 'pt-BR');
            });
            return;
        }
        if (m === 'desc') {
            arr.sort((a, b) => {
                const ta = dataVencimentoTsDespesa(a);
                const tb = dataVencimentoTsDespesa(b);
                const va = ta != null ? ta : Number.MIN_SAFE_INTEGER;
                const vb = tb != null ? tb : Number.MIN_SAFE_INTEGER;
                if (va !== vb) return vb - va;
                return String(a.obra_nome || '').localeCompare(String(b.obra_nome || ''), 'pt-BR');
            });
            return;
        }
        ordenarRelatorioDespesasPorVencimento(arr);
    }

    window.alternarOrdemVencRelDespesas = function () {
        const modos = ['cronologico', 'vencidos_topo', 'desc'];
        const atual = window._relDespOrdemVenc || 'cronologico';
        const idx = modos.indexOf(atual);
        window._relDespOrdemVenc = modos[(idx + 1) % modos.length];
        if (window._relDespDadosFiltrados && window._relDespDadosFiltrados.length) {
            renderizarTabelaRelatorioDespesas(window._relDespDadosFiltrados.slice());
        } else if (typeof window.carregarRelatorioDespesasTabular === 'function') {
            window.carregarRelatorioDespesasTabular();
        }
    };

    function calcularTotaisResumoDespesas(arr) {
        let somaVencidas = 0;
        let somaAVencer = 0;
        let somaPagas = 0;
        (arr || []).forEach((d) => {
            const pagoAcum = valorPagoDespesa(d);
            const aberto = valorEmAbertoDespesa(d);
            somaPagas += pagoAcum;
            if (aberto > 0.009) {
                if (despesaEstaVencida(d)) somaVencidas += aberto;
                else somaAVencer += aberto;
            }
        });
        return { somaVencidas, somaAVencer, somaPagas };
    }

    function montarHtmlPainelResumoDespesas(somaVencidas, somaAVencer, somaPagas, rotuloTotal) {
        const label = rotuloTotal || 'Total Global da Obra/Loja:';
        return ''
            + '<div style="display:flex; justify-content:space-around; text-align:center; flex-wrap:wrap; gap:10px;">'
            + '<div><span style="font-size:12px; color:#d9534f; font-weight:bold;"><span class="bolinha-resumo" style="background:#dc3545;"></span>Vencido</span><br><b style="color:#d9534f; font-size: 16px;">' + formatarMoeda(somaVencidas) + '</b></div>'
            + '<div><span style="font-size:12px; color:#856404; font-weight:bold;"><span class="bolinha-resumo" style="background:#ffc107;"></span>A Vencer</span><br><b style="color:#856404; font-size: 16px;">' + formatarMoeda(somaAVencer) + '</b></div>'
            + '<div><span style="font-size:12px; color:#155724; font-weight:bold;"><span class="bolinha-resumo" style="background:#28a745;"></span>Já Pago</span><br><b style="color:#28a745; font-size: 16px;">' + formatarMoeda(somaPagas) + '</b></div>'
            + '</div>'
            + '<div style="margin-top:15px; border-top:1px dashed #ccc; padding-top:10px; text-align:center;">'
            + '<span style="font-size:13px; color:#555;">' + escapeHtmlBasico(label) + '</span> <b style="font-size: 16px; color: var(--dark-navy);">' + formatarMoeda(somaVencidas + somaAVencer + somaPagas) + '</b>'
            + '</div>';
    }

    function rotuloResumoRelDespesas(arr, termo) {
        if (!termo) {
            return { rotuloTotal: 'Total Global (resultado da tabela):', subtitulo: '' };
        }
        const termoNorm = normalizarChaveNomeDespesa(termo);
        const fornecedores = [...new Set(arr.map((d) => formatarNomeCanonicoDespesa(d.loja_nome)).filter(Boolean))];
        const obras = [...new Set(arr.map((d) => formatarNomeCanonicoDespesa(d.obra_nome)).filter(Boolean))];
        const fornMatch = fornecedores.filter((f) => normalizarChaveNomeDespesa(f).includes(termoNorm));
        const obraMatch = obras.filter((o) => normalizarChaveNomeDespesa(o).includes(termoNorm));
        if (fornMatch.length === 1 && obraMatch.length <= 1) {
            let sub = '🏪 ' + fornMatch[0];
            if (obraMatch.length === 1) sub += ' — 🏢 ' + obraMatch[0];
            return { rotuloTotal: 'Total Global do Fornecedor:', subtitulo: sub };
        }
        if (obraMatch.length === 1 && fornMatch.length <= 1) {
            return { rotuloTotal: 'Total Global da Obra:', subtitulo: '🏢 ' + obraMatch[0] };
        }
        return { rotuloTotal: 'Total Global (filtro atual):', subtitulo: 'Filtro: ' + formatarNomeCanonicoDespesa(termo) };
    }

    function atualizarPainelResumoRelDespesas(arr) {
        const panel = document.getElementById('resumo-total-rel-despesas');
        const display = document.getElementById('total-gasto-display-rel-desp');
        const subEl = document.getElementById('resumo-rel-desp-subtitulo');
        if (!panel || !display) return;
        if (!arr || !arr.length) {
            panel.style.display = 'none';
            return;
        }
        const termo = document.getElementById('rel-desp-filtro') ? document.getElementById('rel-desp-filtro').value.trim() : '';
        const { rotuloTotal, subtitulo } = rotuloResumoRelDespesas(arr, termo);
        const totais = calcularTotaisResumoDespesas(arr);
        display.innerHTML = montarHtmlPainelResumoDespesas(totais.somaVencidas, totais.somaAVencer, totais.somaPagas, rotuloTotal);
        panel.style.display = 'block';
        if (subEl) {
            if (subtitulo) {
                subEl.textContent = subtitulo;
                subEl.style.display = 'block';
            } else {
                subEl.textContent = '';
                subEl.style.display = 'none';
            }
        }
    }

    function ocultarPainelResumoRelDespesas() {
        const panel = document.getElementById('resumo-total-rel-despesas');
        if (panel) panel.style.display = 'none';
    }

    function renderizarTabelaRelatorioDespesas(arrOrigem) {
        const wrap = document.getElementById('tabela-relatorio-despesas-wrap');
        if (!wrap) return;
        const arr = (arrOrigem || []).slice();
        aplicarOrdemRelDespVencimento(arr, window._relDespOrdemVenc);
        window._despesasRelatorioExport = arr;
        arr.forEach((d) => { window._mapRelatorioDespesasParaEdicao[d.id] = d; });

        if (!arr.length) {
            wrap.innerHTML = '<p style="text-align:center;color:#888;">Nenhum registro com os filtros atuais.</p>';
            wrap.setAttribute('data-rel-desp-carregado', '1');
            ocultarPainelResumoRelDespesas();
            return;
        }

        let html = '';
        if (relatorioDespesasTemVariosAnosVencimento(arr)) {
            html += '<p style="font-size:12px;background:#fff8e6;border:1px solid #ffc107;border-radius:8px;padding:10px;margin:0 0 10px 0;color:#856404;">'
                + '<b>Há vencimentos de anos diferentes.</b> A ordem usa o <b>ano inteiro</b>: '
                + 'junho de <b>2025</b> aparece antes de maio de <b>2026</b>. '
                + 'Itens <b style="color:#dc3545;">VENCIDA</b> estão em vermelho.</p>';
        }
        const tituloOrdem = rotuloOrdemVencRelDesp();
        html += '<table style="width:100%;border-collapse:collapse;font-size:12px;background:#fff;border:1px solid #e0e6ed;">';
        html += '<thead><tr style="background:var(--dark-navy);color:#fff;text-align:left;">';
        html += '<th style="padding:8px;border:1px solid #152a45;">Obra</th>';
        html += '<th style="padding:8px;border:1px solid #152a45;">Nome (fornec.)</th>';
        html += '<th style="padding:8px;border:1px solid #152a45;">Chq. / boleto / NF</th>';
        html += '<th style="padding:8px;border:1px solid #152a45;cursor:pointer;white-space:nowrap;" onclick="alternarOrdemVencRelDespesas()" title="Clique para alternar: cronológico → vencidos primeiro → mais recente">'
            + tituloOrdem + ' <span style="font-size:10px;opacity:0.85;">↕</span></th>';
        html += '<th style="padding:8px;border:1px solid #152a45;">Lançamento</th>';
        html += '<th style="padding:8px;border:1px solid #152a45;">Valor</th>';
        html += '<th style="padding:8px;border:1px solid #152a45;">Estado</th>';
        html += '<th style="padding:8px;border:1px solid #152a45;">Observação</th>';
        html += '<th style="padding:8px;border:1px solid #152a45;">Acções</th></tr></thead><tbody>';

        arr.forEach((d) => {
            const st = despesaEstaPaga(d) ? 'pago' : 'pendente';
            const vencida = st === 'pendente' && despesaEstaVencida(d);
            const trFundo = vencida ? 'background:#fff5f5;border-left:4px solid #dc3545;' : '';
            const badge = badgeEstadoRelDespesaHtml(d);
            const refDoc = escapeHtmlBasico(refChequeBoletoDesp(d));
            const rawObs = String(d.observacao || '').trim();
            const obs = escapeHtmlBasico(rawObs);
            const obsShort = rawObs.length > 100 ? escapeHtmlBasico(rawObs.slice(0, 97)) + '…' : obs;
            const titleObs = escapeAttrBasico(rawObs);
            html += '<tr data-despesa-id="' + escapeAttrBasico(d.id) + '" style="vertical-align:top;border-bottom:1px solid #eee;' + trFundo + '">';
            html += '<td style="padding:6px;border:1px solid #eee;">' + escapeHtmlBasico(d.obra_nome || '') + '</td>';
            html += '<td style="padding:6px;border:1px solid #eee;">' + escapeHtmlBasico(d.loja_nome || '') + '</td>';
            html += '<td style="padding:6px;border:1px solid #eee;">' + refDoc + '</td>';
            html += '<td style="padding:6px;border:1px solid #eee;font-weight:600;white-space:nowrap;">' + formatarVencimentoDespesaExibirHtml(d) + '</td>';
            html += '<td style="padding:6px;border:1px solid #eee;">' + escapeHtmlBasico(diaLancamentoDespExibir(d)) + '</td>';
            const valorPagoLinha = d.valor_pago != null ? Number(d.valor_pago) : null;
            const valorNotaLinha = Number(d.valor_numero) || parseMoedaLocal(d.valor_string) || 0;
            let celValor = '<b>R$ ' + escapeHtmlBasico(String(d.valor_string || '0')) + '</b>';
            if (st === 'pago' && valorPagoLinha != null && Number.isFinite(valorPagoLinha) && Math.abs(valorPagoLinha - valorNotaLinha) > 0.009) {
                celValor += '<br><span style="font-size:10px;color:#28a745;font-weight:700;">Pago: ' + formatarMoeda(valorPagoLinha) + '</span>';
                if (d.valor_juros > 0.009) {
                    celValor += '<br><span style="font-size:10px;color:#856404;">Juros: ' + formatarMoeda(d.valor_juros) + '</span>';
                }
            }
            html += '<td style="padding:6px;border:1px solid #eee;white-space:nowrap;">' + celValor + '</td>';
            html += '<td style="padding:6px;border:1px solid #eee;">' + badge + '</td>';
            html += '<td style="padding:6px;border:1px solid #eee;max-width:220px;font-size:11px;color:#444;" title="' + titleObs + '">' + (obsShort || '—') + '</td>';
            html += '<td style="padding:6px;border:1px solid #eee;min-width:128px;">';
            html += '<button type="button" onclick="editarDespesaRelatorio(\'' + d.id + '\')" style="display:block;width:100%;margin-bottom:4px;background:#4285F4;color:#fff;border:none;padding:6px;border-radius:6px;font-size:11px;cursor:pointer;">✏️ Editar</button>';
            if (st === 'pendente') {
                html += '<button type="button" onclick="marcarComoPagoRelatorio(\'' + d.id + '\')" style="display:block;width:100%;margin-bottom:4px;background:#28a745;color:#fff;border:none;padding:6px;border-radius:6px;font-size:11px;cursor:pointer;">✅ Pago</button>';
            } else {
                html += '<button type="button" onclick="marcarComoPendenteRelatorio(\'' + d.id + '\')" style="display:block;width:100%;margin-bottom:4px;background:#ffc107;color:#333;border:none;padding:6px;border-radius:6px;font-size:11px;cursor:pointer;">↩️ Pendente</button>';
            }
            html += '<button type="button" onclick="excluirLinhaRelatorioDespesas(\'' + d.id + '\')" style="display:block;width:100%;background:#d9534f;color:#fff;border:none;padding:6px;border-radius:6px;font-size:11px;cursor:pointer;">🗑️ Excluir</button>';
            html += '</td></tr>';
        });
        html += '</tbody></table>';
        wrap.innerHTML = html;
        wrap.setAttribute('data-rel-desp-carregado', '1');
        atualizarPainelResumoRelDespesas(arr);
        if (window._destacarDespesaId) {
            const idDest = window._destacarDespesaId;
            window._destacarDespesaId = null;
            setTimeout(function () { destacarCardOrigemNota(idDest); }, 280);
        }
    }

    function relatorioDespesasTemVariosAnosVencimento(arr) {
        const anos = new Set();
        arr.forEach(d => {
            const ts = dataVencimentoTsDespesa(d);
            if (ts != null) anos.add(new Date(ts).getFullYear());
        });
        return anos.size > 1;
    }

    function despesaStatusExplicitamentePago(d) {
        const st = String(d && d.status || '').trim().toLowerCase();
        return st === 'pago' || st === 'paga' || st === 'quitado' || st === 'quitada' || st === 'baixado' || st === 'baixada';
    }

    function despesaEstaVencida(d) {
        if (!d) return false;
        if (despesaStatusExplicitamentePago(d)) return false;
        const ts = dataVencimentoTsDespesa(d);
        if (ts == null) return false;
        const hoje = new Date();
        hoje.setHours(12, 0, 0, 0);
        return ts < hoje.getTime();
    }

    /** Saldo para o relatório: conta vencida pendente não some por abatimento de terceiro nem por valor acumulado. */
    function valorSaldoAbertoRelatorio(d) {
        if (!d || despesaStatusExplicitamentePago(d)) return 0;
        const abat = Number(d._abatimento_terceiros) || 0;
        const aposTerc = Math.max(0, Math.round((saldoDevedorDespesa(d) - abat) * 100) / 100);
        if (aposTerc > 0.009) return aposTerc;
        if (despesaEstaVencida(d)) return valorOriginalDespesa(d);
        return 0;
    }

    /** Data de pagamento preenchida (ignora vazio / N/A). */
    function obterDataPagamentoDespesa(d) {
        if (!d) return '';
        const v = d.data_pagamento != null ? d.data_pagamento : d.dataPagamento;
        if (v == null) return '';
        const s = String(v).trim();
        if (!s) return '';
        const low = s.toLowerCase();
        if (low === 'n/a' || low === 'na' || low === 'null' || low === 'undefined' || s === '—') return '';
        return s;
    }

    function valorOriginalDespesa(d) {
        if (!d) return 0;
        const n = Number(d.valor_numero);
        if (Number.isFinite(n) && n > 0) return n;
        return parseMoedaLocal(d.valor_string || '0') || 0;
    }

    function listaPagamentosParciaisDespesa(d) {
        if (!d) return [];
        const arr = d.pagamentos_parciais || d.pagamentosParciais;
        return Array.isArray(arr) ? arr : [];
    }

    function valorPagoDespesa(d) {
        if (!d) return 0;
        const pars = listaPagamentosParciaisDespesa(d);
        if (pars.length) {
            return pars.reduce((s, p) => s + (Number(p.valor) || parseMoedaLocal(p.valor_string) || 0), 0);
        }
        if (d.valor_pago_acumulado != null && Number.isFinite(Number(d.valor_pago_acumulado))) {
            return Math.max(0, Number(d.valor_pago_acumulado));
        }
        const st = String(d.status || '').trim().toLowerCase();
        if (st === 'pago' || st === 'paga' || st === 'quitado' || st === 'quitada' || st === 'baixado' || st === 'baixada') {
            return valorOriginalDespesa(d);
        }
        return 0;
    }

    function saldoDevedorDespesa(d) {
        if (!d) return 0;
        const orig = valorOriginalDespesa(d);
        const pago = valorPagoDespesa(d);
        if (d.saldo_devedor != null && Number.isFinite(Number(d.saldo_devedor)) && listaPagamentosParciaisDespesa(d).length) {
            return Math.max(0, Number(d.saldo_devedor));
        }
        return Math.max(0, Math.round((orig - pago) * 100) / 100);
    }

    function despesaTemPagamentoParcial(d) {
        if (!d) return false;
        if (String(d.status || '').toLowerCase() === 'parcial') return true;
        return listaPagamentosParciaisDespesa(d).length > 0 && saldoDevedorDespesa(d) > 0.009;
    }

    /**
     * Quitada por completo (saldo zero). Pagamento parcial NÃO conta como paga.
     * Status pendente continua em aberto mesmo se existir data_pagamento (isso não quita sozinho).
     */
    function despesaEstaPaga(d) {
        if (!d) return false;
        const st = String(d.status || '').trim().toLowerCase();
        if (st === 'parcial') return false;
        if (st === 'pago' || st === 'paga' || st === 'quitado' || st === 'quitada' || st === 'baixado' || st === 'baixada') {
            return true;
        }
        if (listaPagamentosParciaisDespesa(d).length) {
            return saldoDevedorDespesa(d) <= 0.009;
        }
        if (d.valor_pago_acumulado != null && Number.isFinite(Number(d.valor_pago_acumulado)) && Number(d.valor_pago_acumulado) > 0) {
            return saldoDevedorDespesa(d) <= 0.009;
        }
        return false;
    }

    /** Valor que entra em "em aberto" (vencido / a vencer): o saldo restante. */
    function valorEmAbertoDespesa(d) {
        if (despesaEstaPaga(d)) return 0;
        return saldoDevedorDespesa(d);
    }

    /** Se tem data_pagamento e status ainda não é pago, alinha o status (memória + Firestore). */
    async function sincronizarStatusPagoInconsistente(lista, colecaoNome) {
        const col = colecaoNome || 'despesas_obras';
        const pendentes = (lista || []).filter((d) => {
            if (!d || !d.id) return false;
            const st = String(d.status || '').trim().toLowerCase();
            if (st === 'pago' || st === 'paga' || st === 'quitado' || st === 'quitada' || st === 'baixado' || st === 'baixada') return false;
            if (st === 'parcial') return false;
            if (!listaPagamentosParciaisDespesa(d).length) return false;
            return saldoDevedorDespesa(d) <= 0.009;
        });
        if (!pendentes.length) return 0;
        let ok = 0;
        for (const d of pendentes) {
            d.status = 'pago';
            if (!d.data_pagamento) d.data_pagamento = obterDataPagamentoDespesa(d);
            try {
                await updateDoc(doc(db, col, d.id), { status: 'pago' });
                ok += 1;
            } catch (e) {
                console.warn('sincronizarStatusPagoInconsistente', d.id, e);
            }
        }
        return ok;
    }

    function montarPayloadPagamentoParcial(despesa, valorPago, dataBr, obs, comprovantePayload) {
        const orig = valorOriginalDespesa(despesa);
        const pagoAntes = valorPagoDespesa(despesa);
        const saldoAntes = Math.max(0, Math.round((orig - pagoAntes) * 100) / 100);
        const valorLancado = Math.round((Number(valorPago) || 0) * 100) / 100;
        const juros = Math.max(0, Math.round((valorLancado - saldoAntes) * 100) / 100);
        const pars = listaPagamentosParciaisDespesa(despesa).slice();
        const idParc = 'pp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        let obsFinal = obs || '';
        if (juros > 0.009) {
            const extra = 'inclui juros/acréscimo de ' + formatarMoeda(juros);
            obsFinal = obsFinal ? (obsFinal + ' — ' + extra) : extra;
        }
        const novo = {
            id: idParc,
            valor: valorLancado,
            valor_string: formatarMoeda(valorLancado).replace(/^R\$\s?/, ''),
            data: dataBr || dataPagamentoHojeBr(),
            observacao: obsFinal,
            timestamp: Date.now()
        };
        if (juros > 0.009) novo.valor_juros = juros;
        if (comprovantePayload && comprovantePayload.comprovante_pagamento) {
            novo.comprovante_pagamento = comprovantePayload.comprovante_pagamento;
        }
        if (comprovantePayload && comprovantePayload.baixa_sem_comprovante) {
            novo.baixa_sem_comprovante = true;
        }
        pars.push(novo);
        const totalPago = pars.reduce((s, p) => s + (Number(p.valor) || 0), 0);
        // Juros não deixam saldo negativo: quita se cobriu o saldo em aberto (mesmo pagando a mais)
        const quitado = valorLancado >= saldoAntes - 0.009 || totalPago >= orig - 0.009;
        const saldo = quitado ? 0 : Math.max(0, Math.round((orig - Math.min(totalPago, orig)) * 100) / 100);
        return {
            pagamentos_parciais: pars,
            valor_pago_acumulado: Math.round(totalPago * 100) / 100,
            saldo_devedor: saldo,
            status: quitado ? 'pago' : 'parcial',
            data_pagamento: quitado ? (dataBr || dataPagamentoHojeBr()) : (despesa.data_pagamento || null),
            // NÃO duplicar o PDF/foto no documento da despesa (estoura o limite de 1 MB do Firestore).
            comprovante_pagamento: despesa.comprovante_pagamento || null,
            baixa_sem_comprovante: quitado
                ? !!(comprovantePayload && comprovantePayload.baixa_sem_comprovante)
                : !!despesa.baixa_sem_comprovante,
            valor_pago_com_juros: juros > 0.009 ? Math.round(totalPago * 100) / 100 : null
        };
    }

    const COLECAO_COMPROVANTES_PAG = 'comprovantes_pagamento';

    function comprovanteDeveIrParaSidecar(b64) {
        const s = String(b64 || '');
        if (!s) return false;
        return s.length > 120000 || ehAnexoPdfDataUrl(s);
    }

    function idSidecarComprovante(despesaId, chave) {
        return String(despesaId || '') + '__' + String(chave || 'comp');
    }

    async function gravarComprovanteSidecar(despesaId, chave, b64) {
        if (!b64) return null;
        const id = idSidecarComprovante(despesaId, chave);
        await setDoc(doc(db, COLECAO_COMPROVANTES_PAG, id), {
            empresa_id: getEmpresaGestor() || '',
            despesa_id: despesaId,
            chave: chave,
            comprovante_pagamento: b64,
            timestamp: Date.now()
        });
        return id;
    }

    async function externalizarComprovantesDoPayload(despesaId, payload) {
        if (!payload || !despesaId) return payload;
        const pars = Array.isArray(payload.pagamentos_parciais) ? payload.pagamentos_parciais : [];
        for (let i = 0; i < pars.length; i++) {
            const p = pars[i];
            const b64 = p && p.comprovante_pagamento;
            if (!b64 || !comprovanteDeveIrParaSidecar(b64)) continue;
            const chave = p.grupo_comprovante || p.id || ('i' + i);
            await gravarComprovanteSidecar(despesaId, chave, b64);
            p.comprovante_ref = idSidecarComprovante(despesaId, chave);
            delete p.comprovante_pagamento;
        }
        if (payload.comprovante_pagamento && comprovanteDeveIrParaSidecar(payload.comprovante_pagamento)) {
            await gravarComprovanteSidecar(despesaId, 'despesa', payload.comprovante_pagamento);
            payload.comprovante_ref = idSidecarComprovante(despesaId, 'despesa');
            payload.comprovante_pagamento = null;
        }
        return payload;
    }

    function mensagemErroUpdateDespesa(e) {
        const msg = String((e && (e.message || e.code)) || '');
        if (/exceed|too (large|big)|bigger than|1048576|invalid-argument/i.test(msg)) {
            return 'O comprovante (PDF) ficou grande demais para gravar junto da nota. Tente de novo: o sistema agora guarda o PDF à parte. Se persistir, anexe uma foto ou use o código 0308.';
        }
        return 'Não foi possível atualizar' + (msg ? ': ' + msg : '.');
    }

    window.abrirComprovantePagamentoRef = async function (refId) {
        const id = decodeURIComponent(String(refId || ''));
        if (!id) return Swal.fire('Atenção', 'Comprovante não encontrado.', 'info');
        try {
            Swal.fire({ title: 'Abrindo comprovante...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
            const snap = await getDoc(doc(db, COLECAO_COMPROVANTES_PAG, id));
            Swal.close();
            const b64 = snap.exists() ? (snap.data() || {}).comprovante_pagamento : '';
            if (!b64) return Swal.fire('Atenção', 'Comprovante não encontrado.', 'info');
            abrirFoto(b64);
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível abrir o comprovante.', 'error');
        }
    };

    function idNovoPagamentoParcial(sufixo) {
        return 'pp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + (sufixo != null ? '_' + sufixo : '');
    }

    function comprovanteDoGrupoParcial(despesa, parcial) {
        if (parcial && parcial.comprovante_pagamento) return parcial.comprovante_pagamento;
        const gid = parcial && parcial.grupo_comprovante;
        if (!gid || !despesa) return null;
        const irmao = listaPagamentosParciaisDespesa(despesa).find(function (p) {
            return p && p.grupo_comprovante === gid && p.comprovante_pagamento;
        });
        return irmao ? irmao.comprovante_pagamento : null;
    }

    function preservarComprovanteNosGrupos(parsOriginais, parsNovos) {
        const porGrupo = {};
        (parsOriginais || []).forEach(function (p) {
            if (p && p.grupo_comprovante && p.comprovante_pagamento) {
                porGrupo[p.grupo_comprovante] = p.comprovante_pagamento;
            }
        });
        const jaTem = {};
        (parsNovos || []).forEach(function (p) {
            if (p && p.grupo_comprovante && p.comprovante_pagamento) jaTem[p.grupo_comprovante] = true;
        });
        (parsNovos || []).forEach(function (p) {
            if (!p || !p.grupo_comprovante || jaTem[p.grupo_comprovante]) return;
            if (porGrupo[p.grupo_comprovante]) {
                p.comprovante_pagamento = porGrupo[p.grupo_comprovante];
                jaTem[p.grupo_comprovante] = true;
            }
        });
        return parsNovos;
    }

    function montarItensParciaisDoGrupo(linhas, dataBr, comprovantePayload, valorComprovante, grupoIdExistente) {
        const grupoId = grupoIdExistente || ('gc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
        const totalComp = Math.round((Number(valorComprovante) || 0) * 100) / 100;
        return (linhas || []).map(function (ln, i) {
            const valor = Math.round((Number(ln.valor) || 0) * 100) / 100;
            const item = {
                id: idNovoPagamentoParcial(i),
                valor: valor,
                valor_string: formatarMoeda(valor).replace(/^R\$\s?/, ''),
                data: dataBr || dataPagamentoHojeBr(),
                observacao: ln.descricao || ('Item ' + (i + 1) + ' do comprovante'),
                timestamp: Date.now() + i,
                grupo_comprovante: grupoId,
                valor_comprovante: totalComp
            };
            if (i === 0 && comprovantePayload && comprovantePayload.comprovante_pagamento) {
                item.comprovante_pagamento = comprovantePayload.comprovante_pagamento;
            }
            if (comprovantePayload && comprovantePayload.baixa_sem_comprovante) {
                item.baixa_sem_comprovante = true;
            }
            return item;
        });
    }

    function htmlLinhaDiscriminacaoParcial(valorFmt, desc) {
        return '<div class="pp-disc-linha" style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">'
            + '<input type="text" class="pp-disc-valor" placeholder="0,00" value="' + escapeAttrBasico(valorFmt || '') + '" style="width:110px;max-width:110px;padding:8px;border:1px solid #ccc;border-radius:8px;font-weight:700;box-sizing:border-box;">'
            + '<input type="text" class="pp-disc-desc" placeholder="O que estou pagando" value="' + escapeAttrBasico(desc || '') + '" style="flex:1;min-width:140px;padding:8px;border:1px solid #ccc;border-radius:8px;box-sizing:border-box;">'
            + '<button type="button" class="pp-disc-resto" title="Preencher o que falta nesta linha" style="padding:7px 8px;border:none;border-radius:8px;background:#17a2b8;color:#fff;font-weight:800;cursor:pointer;font-size:10px;white-space:nowrap;">Restante</button>'
            + '<button type="button" class="pp-disc-del" style="padding:7px 10px;border:none;border-radius:8px;background:#c0392b;color:#fff;cursor:pointer;font-weight:800;">✕</button>'
            + '</div>';
    }

    function htmlBlocoDiscriminacaoParcial(opts) {
        const jaOn = !!(opts && opts.ligado);
        return ''
            + '<div id="pp-disc-wrap" style="margin-top:12px;padding:10px;background:#fff8e6;border:1px solid #ffe08a;border-radius:8px;text-align:left;">'
            + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:800;color:#856404;margin:0;">'
            + '<input type="checkbox" id="pp-disc-on"' + (jaOn ? ' checked' : '') + ' style="width:16px;height:16px;margin:0;flex-shrink:0;"> Discriminar este comprovante em várias linhas'
            + '</label>'
            + '<p style="margin:6px 0 0;font-size:11px;color:#856404;line-height:1.4;">O valor de cima é o <b>total do comprovante</b>. Crie linhas dizendo o que está pagando até fechar esse total. Cada linha abate o saldo.</p>'
            + '<div id="pp-disc-box" style="display:' + (jaOn ? 'block' : 'none') + ';margin-top:10px;">'
            + '<div id="pp-disc-linhas"></div>'
            + '<button type="button" id="pp-disc-add" style="margin-top:8px;width:100%;padding:8px;border:1px dashed #856404;border-radius:8px;background:#fff;color:#856404;font-weight:800;cursor:pointer;">+ Adicionar linha</button>'
            + '<p id="pp-disc-resumo" style="margin:8px 0 0;font-size:12px;font-weight:800;text-align:right;"></p>'
            + '</div></div>';
    }

    function valorTotalComprovanteParcialInput() {
        const a = document.getElementById('pp-valor');
        if (a && String(a.value || '').trim()) return parseMoedaLocal(a.value || '0');
        const b = document.getElementById('swal-valor-pago');
        if (b) return parseMoedaLocal(b.value || '0');
        return 0;
    }

    function somaLinhasDiscriminacaoParcial() {
        let s = 0;
        document.querySelectorAll('#pp-disc-linhas .pp-disc-valor').forEach(function (el) {
            s += parseMoedaLocal(el.value || '0');
        });
        return Math.round(s * 100) / 100;
    }

    function atualizarResumoDiscriminacaoParcial() {
        const el = document.getElementById('pp-disc-resumo');
        if (!el) return;
        const total = valorTotalComprovanteParcialInput();
        const soma = somaLinhasDiscriminacaoParcial();
        const falta = Math.round((total - soma) * 100) / 100;
        if (!(total > 0)) {
            el.style.color = '#856404';
            el.textContent = 'Informe primeiro o valor total do comprovante.';
            return;
        }
        if (Math.abs(falta) <= 0.009) {
            el.style.color = '#155724';
            el.textContent = 'Fechado: ' + formatarMoeda(soma) + ' = comprovante ' + formatarMoeda(total);
        } else if (falta > 0) {
            el.style.color = '#c0392b';
            el.textContent = 'Discriminado ' + formatarMoeda(soma) + ' de ' + formatarMoeda(total) + ' — falta ' + formatarMoeda(falta);
        } else {
            el.style.color = '#c0392b';
            el.textContent = 'Discriminado ' + formatarMoeda(soma) + ' — passou ' + formatarMoeda(Math.abs(falta)) + ' do comprovante';
        }
    }

    function lerLinhasDiscriminacaoParcial() {
        const linhas = [];
        document.querySelectorAll('#pp-disc-linhas .pp-disc-linha').forEach(function (row) {
            const valor = parseMoedaLocal((row.querySelector('.pp-disc-valor') && row.querySelector('.pp-disc-valor').value) || '0');
            const desc = String((row.querySelector('.pp-disc-desc') && row.querySelector('.pp-disc-desc').value) || '').trim();
            if (valor > 0 || desc) linhas.push({ valor: valor, descricao: desc });
        });
        return linhas;
    }

    function validarLinhasDiscriminacaoParcial(valorTotal) {
        const chk = document.getElementById('pp-disc-on');
        if (!chk || !chk.checked) return [];
        const linhas = lerLinhasDiscriminacaoParcial();
        if (!linhas.length) {
            Swal.showValidationMessage('Adicione as linhas da discriminação ou desmarque a opção.');
            return false;
        }
        for (let i = 0; i < linhas.length; i++) {
            if (!(linhas[i].valor > 0)) {
                Swal.showValidationMessage('Informe o valor da linha ' + (i + 1) + '.');
                return false;
            }
            if (!linhas[i].descricao) {
                Swal.showValidationMessage('Descreva o que está pagando na linha ' + (i + 1) + '.');
                return false;
            }
        }
        const soma = Math.round(linhas.reduce(function (s, ln) { return s + ln.valor; }, 0) * 100) / 100;
        const total = Math.round((Number(valorTotal) || 0) * 100) / 100;
        const falta = Math.round((total - soma) * 100) / 100;
        if (Math.abs(falta) > 0.009) {
            Swal.showValidationMessage(falta > 0
                ? 'Ainda falta discriminar ' + formatarMoeda(falta) + ' para fechar o comprovante.'
                : 'A discriminação passou ' + formatarMoeda(Math.abs(falta)) + ' do valor do comprovante.');
            return false;
        }
        return linhas;
    }

    function adicionarLinhaDiscriminacaoParcial(valorFmt, desc) {
        const lista = document.getElementById('pp-disc-linhas');
        if (!lista) return;
        lista.insertAdjacentHTML('beforeend', htmlLinhaDiscriminacaoParcial(valorFmt, desc));
        const row = lista.lastElementChild;
        const inpV = row && row.querySelector('.pp-disc-valor');
        if (inpV && typeof mascaraMoeda === 'function') {
            inpV.addEventListener('input', function () {
                mascaraMoeda(inpV);
                atualizarResumoDiscriminacaoParcial();
            });
        }
        const inpD = row && row.querySelector('.pp-disc-desc');
        if (inpD) inpD.addEventListener('input', atualizarResumoDiscriminacaoParcial);
        const btnDel = row && row.querySelector('.pp-disc-del');
        if (btnDel) {
            btnDel.onclick = function () {
                row.remove();
                atualizarResumoDiscriminacaoParcial();
            };
        }
        const btnResto = row && row.querySelector('.pp-disc-resto');
        if (btnResto) {
            btnResto.onclick = function () {
                const total = valorTotalComprovanteParcialInput();
                let outros = 0;
                document.querySelectorAll('#pp-disc-linhas .pp-disc-valor').forEach(function (el) {
                    if (el !== inpV) outros += parseMoedaLocal(el.value || '0');
                });
                const resto = Math.max(0, Math.round((total - outros) * 100) / 100);
                if (inpV) {
                    inpV.value = (typeof formatarValorInputMoeda === 'function')
                        ? formatarValorInputMoeda(resto)
                        : String(resto.toFixed(2)).replace('.', ',');
                    atualizarResumoDiscriminacaoParcial();
                }
            };
        }
        atualizarResumoDiscriminacaoParcial();
    }

    function configurarDiscriminacaoParcial(linhasIniciais) {
        const chk = document.getElementById('pp-disc-on');
        const box = document.getElementById('pp-disc-box');
        const btnAdd = document.getElementById('pp-disc-add');
        const inpTotal = document.getElementById('pp-valor');
        const inpTotalSwal = document.getElementById('swal-valor-pago');
        function garantirLinhas() {
            const lista = document.getElementById('pp-disc-linhas');
            if (lista && !lista.children.length) {
                const ini = Array.isArray(linhasIniciais) && linhasIniciais.length ? linhasIniciais : [{ valorFmt: '', desc: '' }, { valorFmt: '', desc: '' }];
                ini.forEach(function (ln) {
                    adicionarLinhaDiscriminacaoParcial(ln.valorFmt || '', ln.desc || '');
                });
            }
        }
        if (chk && box) {
            if (chk.checked) {
                box.style.display = 'block';
                garantirLinhas();
            }
            chk.addEventListener('change', function () {
                box.style.display = chk.checked ? 'block' : 'none';
                if (chk.checked) garantirLinhas();
                atualizarResumoDiscriminacaoParcial();
            });
        }
        if (btnAdd) {
            btnAdd.onclick = function (ev) {
                ev.preventDefault();
                adicionarLinhaDiscriminacaoParcial('', '');
            };
        }
        if (inpTotal) inpTotal.addEventListener('input', atualizarResumoDiscriminacaoParcial);
        if (inpTotalSwal) inpTotalSwal.addEventListener('input', atualizarResumoDiscriminacaoParcial);
        atualizarResumoDiscriminacaoParcial();
    }

    /** Ordem cronológica de vencimento (mais antigo primeiro); sem data válida vai para o fim. */
    function ordenarRelatorioDespesasPorVencimento(arr) {
        arr.sort((a, b) => {
            const ta = dataVencimentoTsDespesa(a);
            const tb = dataVencimentoTsDespesa(b);
            const va = ta != null ? ta : Number.MAX_SAFE_INTEGER;
            const vb = tb != null ? tb : Number.MAX_SAFE_INTEGER;
            if (va !== vb) return va - vb;
            const la = tsLancamentoDespesa(a);
            const lb = tsLancamentoDespesa(b);
            if (la !== lb) return la - lb;
            return String(a.obra_nome || '').localeCompare(String(b.obra_nome || ''), 'pt-BR')
                || String(a.loja_nome || '').localeCompare(String(b.loja_nome || ''), 'pt-BR');
        });
    }

    function diaLancamentoDespExibir(d) {
        if (d.data_lancamento) {
            const partes = String(d.data_lancamento).split('-');
            if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
        return d.data || '—';
    }

    function refChequeBoletoDesp(d) {
        const c = d.cheque_boleto_num != null ? String(d.cheque_boleto_num).trim() : '';
        if (c) return c;
        const n = d.nota_fiscal != null ? String(d.nota_fiscal).trim() : '';
        return n || '—';
    }

    function recarregarRelatorioDespesasTabularSeCarregado() {
        const wrap = document.getElementById('tabela-relatorio-despesas-wrap');
        if (wrap && wrap.getAttribute('data-rel-desp-carregado') === '1' && typeof window.carregarRelatorioDespesasTabular === 'function') {
            window.carregarRelatorioDespesasTabular();
        }
    }

    function escapeAttrBasico(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    /** Linhas do tópico «Relatório de despesas» (separado de `despesas_obras`). */
    const COLECAO_RELATORIO_DESPESAS = 'relatorio_despesas';
    const COLECAO_AJUDA_CUSTO = 'ajuda_custo';
    const COLECAO_DESCONTOS_FOLHA = 'descontos_folha';
    const COLECAO_DOCUMENTOS_PESSOAIS = 'documentos_pessoais';
    const COLECAO_CARTOES = 'cartoes_cadastro';
    const COLECAO_CARTOES_DESPESAS = 'cartoes_despesas';
    const COLECAO_CARTOES_FATURAS = 'cartoes_faturas';
    const PASTAS_DOCUMENTOS = ['fh', 'hallana', 'felipe', 'wellington', 'licitacoes', 'contratos_ativos', 'contratos_finalizados', 'empenhos'];
    const DOC_PDF_MAX_FIRESTORE_RAW = 750000;
    const DOC_FIRESTORE_MAX_B64 = 980000;
    const MSG_DOC_TAMANHO_MAX = 'O anexo deve ter no máximo ~750 KB. O Firestore (plano gratuito e pago) limita cada registro a 1 MB; como o arquivo é salvo em base64 (ocupa ~33% a mais), ~750 KB é o máximo seguro.';
    const PASTA_LABEL_DOCUMENTOS = {
        fh: 'FH',
        hallana: 'HALLANA',
        felipe: 'FELIPE',
        wellington: 'WELLINGTON',
        licitacoes: 'LICITAÇÕES',
        contratos: 'CONTRATOS',
        contratos_ativos: 'CONTRATOS ATIVOS',
        contratos_finalizados: 'CONTRATOS FINALIZADOS',
        empenhos: 'EMPENHOS'
    };
