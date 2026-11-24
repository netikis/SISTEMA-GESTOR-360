/* js/modulos/alertas.js — edite este arquivo para alterar só este módulo */
    // BLOQUEIO ANTI-CÓPIA
    document.addEventListener('contextmenu', event => event.preventDefault());
    
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
            const modal = document.getElementById('modal-visualizador-documento');
            if (modal && modal.style.display !== 'none') {
                e.preventDefault();
                if (typeof window.fecharVisualizadorDocumento === 'function') {
                    window.fecharVisualizadorDocumento();
                } else {
                    modal.style.display = 'none';
                }
                return;
            }
            const painelAsst = document.getElementById('assistente-painel');
            if (painelAsst && painelAsst.classList.contains('aberto')) {
                e.preventDefault();
                if (typeof window.fecharAssistenteVirtual === 'function') window.fecharAssistenteVirtual();
                return;
            }
            if (window.Swal && typeof Swal.isVisible === 'function' && Swal.isVisible()) {
                e.preventDefault();
                Swal.close();
                return;
            }
        }
        if (e.key === 'F5') return;
        const gestorAberto = typeof painelGestorEstaVisivel === 'function' && painelGestorEstaVisivel();
        if (gestorAberto && /^F([1-46-9]|1[0-2])$/.test(e.key)) {
            if (window.Swal && typeof Swal.isVisible === 'function' && Swal.isVisible()) return;
            e.preventDefault();
            if (typeof window.abrirAtalhoGestor === 'function') window.abrirAtalhoGestor(e.key);
            return;
        }
        if (e.keyCode == 123 ||
           (e.ctrlKey && e.shiftKey && (e.keyCode == 'I'.charCodeAt(0) || e.keyCode == 'J'.charCodeAt(0))) ||
           (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0))) {
            e.preventDefault();
        }
    });

// === INÍCIO DO SISTEMA DE ALERTAS ===
function ensureAlertaStack() {
    let stack = document.getElementById('alerta-stack-global');
    if (!stack) {
        stack = document.createElement('div');
        stack.id = 'alerta-stack-global';
        const telaPatrao = document.getElementById('tela-patrao');
        (telaPatrao || document.body).appendChild(stack);
    }
    ['alerta-container-pedidos', 'alerta-container-docs', 'alerta-container-ponto', 'alerta-container-global'].forEach((id) => {
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement('div');
            el.id = id;
            el.style.cssText = 'padding:0; max-width:100%;';
        }
        if (el.parentElement !== stack) {
            stack.appendChild(el);
        }
    });
    const pedidos = document.getElementById('alerta-container-pedidos');
    const docs = document.getElementById('alerta-container-docs');
    const ponto = document.getElementById('alerta-container-ponto');
    const global = document.getElementById('alerta-container-global');
    if (pedidos && docs && pedidos.nextElementSibling !== docs) {
        stack.insertBefore(pedidos, docs);
    }
    if (docs && ponto && docs.nextElementSibling !== ponto) {
        stack.insertBefore(docs, ponto);
    }
    if (ponto && global && ponto.nextElementSibling !== global) {
        stack.insertBefore(ponto, global);
    }
    stack.style.display = 'flex';
    return stack;
}

function tocarSomAlertaVencimento() {
    const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    audio.play().catch(() => {});
}

async function monitorarVencimentosObras() {
    const empresaGestor = getEmpresaGestor();
    const telaPatraoAtiva = painelGestorEstaVisivel();
    
    // Captura a caixa de alertas (se ela já existir)
    let containerAlerta = document.getElementById("alerta-container-global");

    // TRAVA: Se não for gestor ou a tela de gestão não estiver aberta...
    if (!empresaGestor || !telaPatraoAtiva) {
        if (containerAlerta) containerAlerta.style.display = 'none';
        const containerDocs = document.getElementById('alerta-container-docs');
        if (containerDocs) containerDocs.style.display = 'none';
        const containerPonto = document.getElementById('alerta-container-ponto');
        if (containerPonto) containerPonto.style.display = 'none';
        const containerPedidos = document.getElementById('alerta-container-pedidos');
        if (containerPedidos) containerPedidos.style.display = 'none';
        const stack = document.getElementById('alerta-stack-global');
        if (stack) stack.style.display = 'none';
        return;
    }

    ensureAlertaStack();

    // Se passou da trava, garante que a caixa fique visível na área de Gestão
    if (containerAlerta) {
        containerAlerta.style.display = 'block';
    }

     try {
        window._mapAlertasDespesas = {};
        // CORREÇÃO 2: Busca no banco de dados APENAS as despesas referentes à empresa acessada (MANUTENÇÃO, WORKMAN, etc.)
        const q = query(collection(db, "despesas_obras"), where("empresa_id", "==", empresaGestor));
        const querySnapshot = await getDocs(q);
        
        const dataHojeReal = new Date();
        const hojeFormatado = dataHojeReal.toISOString().substring(0, 10);
        const hojeMeioDia = new Date();
        hojeMeioDia.setHours(12, 0, 0, 0); 
        
        const filaAlertas = [];
        let emitirSom = false;

        querySnapshot.forEach((docSnap) => {
            const dados = Object.assign({ id: docSnap.id }, docSnap.data() || {});
            const idDoc = docSnap.id;
            if (typeof despesaEstaPaga === 'function' && despesaEstaPaga(dados)) return;
            if (typeof valorEmAbertoDespesa === 'function' && valorEmAbertoDespesa(dados) <= 0.009) return;
            const tsVenc = dataVencimentoTsDespesa(dados);

            if (tsVenc != null) {
                const diffMs = tsVenc - hojeMeioDia.getTime();
                const diasRestantes = Math.round(diffMs / (1000 * 60 * 60 * 24));
                const silenciadoHoje = localStorage.getItem(chaveAlertaSilenciado(idDoc, hojeFormatado));

                if (!silenciadoHoje) {
                    let tituloAlerta = "";
                    let classeUrgencia = "";

                    if (diasRestantes === 0) {
                        tituloAlerta = "VENCE HOJE";
                        classeUrgencia = "urgente";
                        emitirSom = true;
                    } else if (diasRestantes > 0 && diasRestantes <= 3) {
                        tituloAlerta = `VENCE EM ${diasRestantes} DIA(S)`;
                        classeUrgencia = "aviso";
                        emitirSom = true;
                    } else if (diasRestantes < 0) {
                        tituloAlerta = "VENCIDO";
                        classeUrgencia = "urgente";
                        emitirSom = true;
                    }

                    if (tituloAlerta !== "") {
                        const nomeLoja = dados.loja_nome || dados.loja || "Fornecedor não informado";
                        const nomeObra = dados.obra_nome || dados.obra || "Obra não informada";
                        const nomeDespesa = dados.descricao || "Sem descrição";
                        const valorAlerta = dados.valor_string || formatarMoeda(dados.valor_numero || 0);
                        const vencAlerta = formatarVencimentoDespesaExibir(dados);
                        const temNota = Boolean(dados.foto_recibo);
                        window._mapAlertasDespesas[idDoc] = dados;
                        filaAlertas.push({
                            ts: tsVenc,
                            html: montarPainelAlerta(idDoc, nomeLoja, nomeObra, nomeDespesa, tituloAlerta, classeUrgencia, temNota, valorAlerta, vencAlerta)
                        });
                    }
                }
            }
        });

        filaAlertas.sort((a, b) => a.ts - b.ts);
        const htmlAlertas = filaAlertas.map(a => a.html).join('');

        if (htmlAlertas !== "") {
            renderizarAlertasNoCanto(htmlAlertas, emitirSom);
        } else {
            const c = document.getElementById("alerta-container-global");
            if (c) c.innerHTML = "";
        }
    } catch (err) {
        console.warn("Aguardando carregamento...", err);
    }
}

function obterReferenciaMesAtualContasPagar() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = agora.getMonth();
    const inicio = new Date(ano, mes, 1, 12, 0, 0, 0);
    const fim = new Date(ano, mes + 1, 0, 12, 0, 0, 0);
    const diaIni = '01';
    const mesStr = String(mes + 1).padStart(2, '0');
    const diaFim = String(fim.getDate()).padStart(2, '0');
    return {
        inicioTs: inicio.getTime(),
        fimTs: fim.getTime(),
        labelPeriodo: diaIni + '/' + mesStr + '/' + ano + ' a ' + diaFim + '/' + mesStr + '/' + ano,
        mesAno: mesStr + '/' + ano
    };
}

function calcularDiasVencimentoContaPagar(tsVenc) {
    if (tsVenc == null) return '';
    const hojeMeioDia = new Date();
    hojeMeioDia.setHours(12, 0, 0, 0);
    return Math.round((tsVenc - hojeMeioDia.getTime()) / (1000 * 60 * 60 * 24));
}

async function coletarDespesasRelatorioContasPagarMes() {
    const empresaGestor = getEmpresaGestor();
    if (!empresaGestor) return { itens: [], ref: obterReferenciaMesAtualContasPagar() };

    const ref = obterReferenciaMesAtualContasPagar();
    const hojeMeioDia = new Date();
    hojeMeioDia.setHours(12, 0, 0, 0);

    const q = query(collection(db, 'despesas_obras'), where('empresa_id', '==', empresaGestor));
    const snap = await getDocs(q);
    const itens = [];

    snap.forEach(function (docSnap) {
        const d = docSnap.data() || {};
        const statusAtual = d.status || d.Status || '';
        if (statusAtual === 'Pago' || statusAtual === 'pago') return;

        const tsVenc = dataVencimentoTsDespesa(d);
        if (tsVenc == null) return;

        const noMes = tsVenc >= ref.inicioTs && tsVenc <= ref.fimTs;
        const vencido = tsVenc < hojeMeioDia.getTime();
        if (!noMes && !vencido) return;

        itens.push(Object.assign({ id: docSnap.id, _tsVenc: tsVenc }, d));
    });

    itens.sort(function (a, b) { return (a._tsVenc || 0) - (b._tsVenc || 0); });
    return { itens: itens, ref: ref };
}

function montarLinhaEspelhoContasPagar(d, seqNoDia) {
    const tsVenc = d._tsVenc != null ? d._tsVenc : dataVencimentoTsDespesa(d);
    const dias = calcularDiasVencimentoContaPagar(tsVenc);
    const valorNum = parseMoedaLocal(d.valor_string) || Number(d.valor_numero) || 0;
    const nf = String(d.nota_fiscal || '').trim();
    const seq = nf ? nf : String(seqNoDia || 1).padStart(2, '0');
    const codigo = String(d.id || '').replace(/\W/g, '').slice(-7).toUpperCase() || '—';

    return {
        codigo: codigo,
        fornecedor: d.loja_nome || d.loja || 'Fornecedor',
        numeroSeq: nf || (codigo + '/' + String(seqNoDia || 1).padStart(2, '0')),
        qt: String(seqNoDia || 1).padStart(2, '0'),
        emissao: d.data || '—',
        bol: 'S',
        vencimento: formatarVencimentoDespesaExibir(d),
        dias: dias,
        port: '1',
        cCusto: (d.obra_nome || d.obra || '—').slice(0, 24),
        valor: valorNum,
        valorFmt: formatarMoeda(valorNum),
        obra: d.obra_nome || d.obra || '',
        descricao: d.descricao || ''
    };
}

function agruparContasPagarPorDiaVencimento(itens) {
    const grupos = [];
    let grupoAtual = null;
    let seqDia = 0;

    (itens || []).forEach(function (d) {
        const venc = formatarVencimentoDespesaExibir(d);
        if (!grupoAtual || grupoAtual.vencimento !== venc) {
            grupoAtual = { vencimento: venc, ts: d._tsVenc, linhas: [], total: 0 };
            grupos.push(grupoAtual);
            seqDia = 0;
        }
        seqDia += 1;
        const linha = montarLinhaEspelhoContasPagar(d, seqDia);
        grupoAtual.linhas.push(linha);
        grupoAtual.total += linha.valor;
    });

    return grupos;
}

function montarHtmlPreviewRelatorioContasPagarPorDia(pack) {
    const empresa = escapeHtmlBasico(getEmpresaGestor() || 'Empresa');
    const ref = pack.ref || obterReferenciaMesAtualContasPagar();
    const grupos = pack.grupos || [];
    let totalGeral = 0;

    let body = '';
    grupos.forEach(function (g) {
        totalGeral += g.total || 0;
        g.linhas.forEach(function (ln) {
            body += '<tr>'
                + '<td>' + escapeHtmlBasico(ln.codigo) + '</td>'
                + '<td>' + escapeHtmlBasico(ln.fornecedor) + '</td>'
                + '<td>' + escapeHtmlBasico(ln.numeroSeq) + '</td>'
                + '<td>' + escapeHtmlBasico(ln.qt) + '</td>'
                + '<td>' + escapeHtmlBasico(ln.emissao) + '</td>'
                + '<td style="text-align:center;">' + escapeHtmlBasico(ln.bol) + '</td>'
                + '<td>' + escapeHtmlBasico(ln.vencimento) + '</td>'
                + '<td style="text-align:center;">' + escapeHtmlBasico(String(ln.dias)) + '</td>'
                + '<td style="text-align:center;">' + escapeHtmlBasico(ln.port) + '</td>'
                + '<td>' + escapeHtmlBasico(ln.cCusto) + '</td>'
                + '<td style="text-align:right;">' + escapeHtmlBasico(ln.valorFmt) + '</td>'
                + '</tr>';
        });
        body += '<tr class="linha-total-dia"><td colspan="10">Total Diário — ' + escapeHtmlBasico(g.vencimento) + '</td>'
            + '<td style="text-align:right;">' + escapeHtmlBasico(formatarMoeda(g.total)) + '</td></tr>';
    });

    return ''
        + '<div style="text-align:left;font-size:12px;color:#333;margin-bottom:8px;">'
        + '<b>' + empresa + '</b><br>'
        + '<span style="font-size:11px;color:#555;">Relatório de Contas a Pagar por Dia — Período: ' + escapeHtmlBasico(ref.labelPeriodo) + '</span><br>'
        + '<span style="font-size:11px;color:#555;">Vencidos + contas com vencimento no mês · Lista pela data de: <b>Vencimento</b></span>'
        + '</div>'
        + '<div class="preview-contas-pagar-wrap">'
        + '<table><thead><tr>'
        + '<th>Código</th><th>Nome do Fornecedor</th><th>Número/Seq</th><th>Qt</th><th>Emissão</th><th>Bol</th>'
        + '<th>Vencimento</th><th>Dias</th><th>Port</th><th>C. Custo</th><th>Valor R$</th>'
        + '</tr></thead><tbody>' + body + '</tbody></table></div>'
        + '<p style="margin:10px 0 0;text-align:right;font-weight:800;color:#1a2a43;">TOTAL GERAL: ' + escapeHtmlBasico(formatarMoeda(totalGeral)) + '</p>'
        + '<div style="display:flex;gap:10px;justify-content:center;margin-top:14px;flex-wrap:wrap;">'
        + '<button type="button" class="btn-pdf-relatorio" style="margin:0;padding:12px 20px;" onclick="exportarPdfRelatorioContasPagarPorDia()">📥 PDF</button>'
        + '<button type="button" class="btn-pdf-relatorio" style="margin:0;padding:12px 20px;background:#217346;" onclick="exportarExcelRelatorioContasPagarPorDia()">📊 EXCEL</button>'
        + '</div>';
}

window.abrirExportarAlertasVencimento = async function () {
    Swal.fire({
        title: 'Montando relatório...',
        allowOutsideClick: false,
        didOpen: function () { Swal.showLoading(); }
    });

    try {
        const coleta = await coletarDespesasRelatorioContasPagarMes();
        if (!coleta.itens.length) {
            return Swal.fire('Atenção', 'Não há contas vencidas ou a vencer no mês atual para exportar.', 'info');
        }
        const grupos = agruparContasPagarPorDiaVencimento(coleta.itens);
        window._packExportContasPagarMes = { itens: coleta.itens, ref: coleta.ref, grupos: grupos };

        Swal.fire({
            title: 'Exportar — Contas a Pagar por Dia',
            html: montarHtmlPreviewRelatorioContasPagarPorDia(window._packExportContasPagarMes),
            width: Math.min(window.innerWidth - 24, 520),
            showConfirmButton: true,
            confirmButtonText: 'Fechar',
            confirmButtonColor: '#1a2a43',
            showCloseButton: true
        });
    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Não foi possível montar o relatório. Tente novamente.', 'error');
    }
};

window.exportarPdfRelatorioContasPagarPorDia = async function () {
    let pack = window._packExportContasPagarMes;
    if (!pack || !pack.grupos || !pack.grupos.length) {
        Swal.fire({ title: 'Carregando...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
        try {
            const coleta = await coletarDespesasRelatorioContasPagarMes();
            if (!coleta.itens.length) return Swal.fire('Atenção', 'Sem dados para exportar.', 'info');
            pack = { itens: coleta.itens, ref: coleta.ref, grupos: agruparContasPagarPorDiaVencimento(coleta.itens) };
            window._packExportContasPagarMes = pack;
        } catch (e) {
            return Swal.fire('Erro', 'Falha ao carregar dados.', 'error');
        }
        Swal.close();
    }

    function limparPdf(s) {
        return String(s == null ? '' : s).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    const empresa = limparPdf(getEmpresaGestor() || 'Empresa');
    const ref = pack.ref;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(empresa, 14, 12);
    doc.setFontSize(10);
    doc.text('Relatorio de Contas a Pagar por Dia', 14, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Periodo: ' + ref.labelPeriodo + '  |  Gerado: ' + new Date().toLocaleString('pt-BR'), 14, 23);
    doc.text('Vencidos + vencimentos do mes  |  Lista pela data de: Vencimento', 14, 28);

    const head = [['Codigo', 'Fornecedor', 'Numero/Seq', 'Qt', 'Emissao', 'Bol', 'Vencimento', 'Dias', 'Port', 'C. Custo', 'Valor R$']];
    const body = [];
    let totalGeral = 0;

    pack.grupos.forEach(function (g) {
        totalGeral += g.total || 0;
        g.linhas.forEach(function (ln) {
            body.push([
                limparPdf(ln.codigo),
                limparPdf(ln.fornecedor).slice(0, 28),
                limparPdf(ln.numeroSeq).slice(0, 16),
                limparPdf(ln.qt),
                limparPdf(ln.emissao),
                limparPdf(ln.bol),
                limparPdf(ln.vencimento),
                String(ln.dias),
                limparPdf(ln.port),
                limparPdf(ln.cCusto).slice(0, 18),
                limparPdf(ln.valorFmt)
            ]);
        });
        body.push([
            '', '', '', '', '', '', '', '', '',
            'Total Diario ' + limparPdf(g.vencimento),
            limparPdf(formatarMoeda(g.total))
        ]);
    });

    doc.autoTable({
        startY: 32,
        head: head,
        body: body,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.8, valign: 'middle' },
        headStyles: { fillColor: [232, 232, 232], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
            10: { halign: 'right', cellWidth: 22 }
        },
        margin: { left: 10, right: 10 }
    });

    const yFinal = doc.lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL GERAL: ' + formatarMoeda(totalGeral), 280, yFinal, { align: 'right' });

    const nomeArq = 'contas_a_pagar_por_dia_' + String(empresa).replace(/\s+/g, '_') + '_' + ref.mesAno.replace('/', '-') + '.pdf';
    doc.save(nomeArq);
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'PDF gerado!', showConfirmButton: false, timer: 2200 });
};

window.exportarExcelRelatorioContasPagarPorDia = async function () {
    if (!window.XLSX) {
        return Swal.fire('Erro', 'Biblioteca Excel não carregada. Recarregue a página.', 'error');
    }

    let pack = window._packExportContasPagarMes;
    if (!pack || !pack.grupos || !pack.grupos.length) {
        Swal.fire({ title: 'Carregando...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
        try {
            const coleta = await coletarDespesasRelatorioContasPagarMes();
            if (!coleta.itens.length) return Swal.fire('Atenção', 'Sem dados para exportar.', 'info');
            pack = { itens: coleta.itens, ref: coleta.ref, grupos: agruparContasPagarPorDiaVencimento(coleta.itens) };
            window._packExportContasPagarMes = pack;
        } catch (e) {
            return Swal.fire('Erro', 'Falha ao carregar dados.', 'error');
        }
        Swal.close();
    }

    const linhas = [];
    let totalGeral = 0;
    pack.grupos.forEach(function (g) {
        totalGeral += g.total || 0;
        g.linhas.forEach(function (ln) {
            linhas.push({
                'Código': ln.codigo,
                'Nome do Fornecedor': ln.fornecedor,
                'Número/Seq': ln.numeroSeq,
                'Qt': ln.qt,
                'Emissão': ln.emissao,
                'Bol': ln.bol,
                'Vencimento': ln.vencimento,
                'Dias': ln.dias,
                'Port': ln.port,
                'C. Custo': ln.cCusto,
                'Valor R$': ln.valor
            });
        });
        linhas.push({
            'Código': '',
            'Nome do Fornecedor': 'Total Diário — ' + g.vencimento,
            'Número/Seq': '',
            'Qt': '',
            'Emissão': '',
            'Bol': '',
            'Vencimento': '',
            'Dias': '',
            'Port': '',
            'C. Custo': '',
            'Valor R$': g.total
        });
    });
    linhas.push({
        'Código': '',
        'Nome do Fornecedor': 'TOTAL GERAL',
        'Número/Seq': '',
        'Qt': '',
        'Emissão': '',
        'Bol': '',
        'Vencimento': '',
        'Dias': '',
        'Port': '',
        'C. Custo': '',
        'Valor R$': totalGeral
    });

    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contas a Pagar');
    const emp = String(getEmpresaGestor() || 'empresa').replace(/\s+/g, '_');
    XLSX.writeFile(wb, 'contas_a_pagar_por_dia_' + emp + '_' + pack.ref.mesAno.replace('/', '-') + '.xlsx');
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Excel gerado!', showConfirmButton: false, timer: 2200 });
};

window.imprimirRelatorioAlertasVencimento = function () {
    function limparTextoParaPdf(s) {
        if (s == null) return '';
        return String(s)
            .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
            .replace(/[\u2014\u2013]/g, '-')
            .trim();
    }

    function statusAlertaDespesaParaPdf(d) {
        const tsVenc = dataVencimentoTsDespesa(d);
        if (tsVenc == null) return 'PENDENTE';
        const hojeMeioDia = new Date();
        hojeMeioDia.setHours(12, 0, 0, 0);
        const dias = Math.round((tsVenc - hojeMeioDia.getTime()) / (1000 * 60 * 60 * 24));
        if (dias < 0) return 'VENCIDO';
        if (dias === 0) return 'VENCE HOJE';
        if (dias <= 3) return 'VENCE EM ' + dias + ' DIA(S)';
        return 'PENDENTE';
    }

    const cards = document.querySelectorAll('#alerta-container-global [id^="card-alerta-"]');
    if (!cards.length) {
        return Swal.fire('Atenção', 'Não há boletos na lista de vencimentos para imprimir.', 'info');
    }

    const empresa = limparTextoParaPdf(getEmpresaGestor() || 'Empresa');
    const linhas = [];
    let totalPagar = 0;

    cards.forEach((el) => {
        const id = el.id.replace('card-alerta-', '');
        const d = window._mapAlertasDespesas && window._mapAlertasDespesas[id];
        if (!d) return;
        const status = statusAlertaDespesaParaPdf(d);
        const valorNum = parseMoedaLocal(d.valor_string) || Number(d.valor_numero) || 0;
        totalPagar += valorNum;
        const valorTxt = limparTextoParaPdf(d.valor_string || formatarMoeda(valorNum));
        linhas.push([
            status,
            limparTextoParaPdf(formatarVencimentoDespesaExibir(d)),
            limparTextoParaPdf(d.obra_nome || d.obra || ''),
            limparTextoParaPdf(d.loja_nome || d.loja || ''),
            valorTxt.startsWith('R$') ? valorTxt : 'R$ ' + valorTxt,
            limparTextoParaPdf(d.nota_fiscal || '-'),
            limparTextoParaPdf(String(d.descricao || '').slice(0, 100))
        ]);
    });

    if (!linhas.length) {
        return Swal.fire('Aviso', 'Não foi possível montar o relatório.', 'warning');
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');

    doc.setFillColor(26, 42, 67);
    doc.rect(0, 0, 297, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATORIO DE CONTAS A PAGAR - VENCIMENTOS', 14, 11);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${empresa}  |  Gerado em: ${new Date().toLocaleString('pt-BR')}  |  ${linhas.length} conta(s) na lista`, 14, 18);

    doc.setTextColor(217, 83, 79);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL A PAGAR (itens desta lista): ${formatarMoeda(totalPagar)}`, 14, 25);

    doc.autoTable({
        startY: 34,
        head: [['Situação', 'Vencimento', 'Obra', 'Fornecedor', 'Valor', 'NF', 'Descrição']],
        body: linhas,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2.5, valign: 'middle', textColor: '#333333' },
        headStyles: { fillColor: [26, 42, 67], textColor: '#ffffff', fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 248, 250] },
        columnStyles: {
            0: { cellWidth: 32 },
            1: { cellWidth: 22 },
            2: { cellWidth: 36 },
            3: { cellWidth: 36 },
            4: { cellWidth: 22 },
            5: { cellWidth: 16 },
            6: { cellWidth: 50 }
        },
        didParseCell: function (data) {
            if (data.column.index === 0 && data.section === 'body') {
                const t = String(data.cell.raw || '');
                if (t.includes('VENCIDO') || t.includes('HOJE')) {
                    data.cell.styles.textColor = [217, 83, 79];
                    data.cell.styles.fontStyle = 'bold';
                } else if (t.includes('VENCE EM')) {
                    data.cell.styles.textColor = [240, 173, 78];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        },
        didDrawPage: function (data) {
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text('Página ' + doc.internal.getNumberOfPages() + ' — Gestor 360', data.settings.margin.left, doc.internal.pageSize.height - 8);
        }
    });

    const nomeArq = `relatorio_vencimentos_${String(empresa).replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;

    try {
        doc.autoPrint();
        const url = doc.output('bloburl');
        const janela = window.open(url, '_blank');
        if (!janela) {
            doc.save(nomeArq);
            Swal.fire('PDF salvo', 'O navegador bloqueou a janela de impressão. O relatório foi baixado — abra o PDF para imprimir.', 'info');
        }
    } catch (e) {
        console.error(e);
        doc.save(nomeArq);
        Swal.fire('PDF salvo', 'Abra o arquivo baixado para imprimir o relatório.', 'success');
    }
};

window.visualizarNotaAlertaVencimento = function (idDoc) {
    const d = window._mapAlertasDespesas && window._mapAlertasDespesas[idDoc];
    if (!d) return Swal.fire('Aviso', 'Despesa não encontrada.', 'warning');

    const nomeObra = escapeHtmlBasico(d.obra_nome || d.obra || 'Obra');
    const nomeLoja = escapeHtmlBasico(d.loja_nome || d.loja || 'Fornecedor');
    const valor = escapeHtmlBasico(d.valor_string || formatarMoeda(d.valor_numero || 0));
    const venc = escapeHtmlBasico(formatarVencimentoDespesaExibir(d));
    const nf = d.nota_fiscal ? escapeHtmlBasico(String(d.nota_fiscal)) : '';
    const desc = d.descricao ? escapeHtmlBasico(String(d.descricao).slice(0, 220)) : '';

    let html = '<div style="text-align:left;font-size:13px;line-height:1.45;">'
        + '<div style="margin-bottom:8px;"><span style="color:#666;font-size:11px;font-weight:700;">🏗️ OBRA</span><br><b style="color:#1a2a43;">' + nomeObra + '</b></div>'
        + '<div style="margin-bottom:8px;"><span style="color:#666;font-size:11px;font-weight:700;">🏢 FORNECEDOR</span><br><b style="color:#1a2a43;">' + nomeLoja + '</b></div>'
        + '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px;">'
        + '<span><span style="color:#666;font-size:11px;">Valor</span><br><b style="color:#d9534f;">' + (String(valor).trim().startsWith('R$') ? valor : 'R$ ' + valor) + '</b></span>'
        + '<span><span style="color:#666;font-size:11px;">Vencimento</span><br><b style="color:#1a2a43;">' + venc + '</b></span>'
        + '</div>'
        + (nf ? '<div style="font-size:12px;color:#555;margin-bottom:6px;"><b>NF:</b> ' + nf + '</div>' : '')
        + (desc ? '<div style="font-size:12px;color:#444;margin-bottom:6px;">' + desc + '</div>' : '');

    if (d.foto_recibo) {
        html += '<p style="font-size:11px;color:#666;margin:10px 0 6px 0;text-align:center;">Clique na miniatura para ampliar a nota / boleto</p>'
            + '<img src="' + d.foto_recibo + '" id="alerta-nota-img-' + escapeAttrBasico(idDoc) + '" style="max-width:100%;max-height:240px;object-fit:contain;border-radius:8px;border:2px solid #4285F4;cursor:pointer;display:block;margin:0 auto;" title="Clique para ampliar" alt="Nota">';
    } else {
        html += '<p style="font-size:12px;color:#888;margin-top:12px;text-align:center;background:#f5f5f5;padding:12px;border-radius:8px;">Esta despesa não tem foto da nota/boleto anexada.</p>';
    }
    html += '</div>';

    Swal.fire({
        title: '📄 Nota / Boleto',
        html: html,
        width: 580,
        confirmButtonText: 'Fechar',
        confirmButtonColor: '#1a2a43',
        showDenyButton: !!d.foto_recibo,
        denyButtonText: '🔍 Ampliar nota',
        denyButtonColor: '#4285F4'
    }).then((r) => {
        if (r.isDenied && d.foto_recibo) abrirFoto(d.foto_recibo);
    });

    if (d.foto_recibo) {
        setTimeout(() => {
            const img = document.getElementById('alerta-nota-img-' + idDoc);
            if (img) img.onclick = () => abrirFoto(d.foto_recibo);
        }, 150);
    }
};

window.confirmarLeituraAlerta = function(id) {
    const hj = new Date().toISOString().substring(0, 10);
    localStorage.setItem(chaveAlertaSilenciado(id, hj), "true");

    const el = document.getElementById(`card-alerta-${id}`);
    if (el) {
        el.style.opacity = "0";
        el.style.transform = "translateX(50px)";
        setTimeout(() => {
            el.remove();
            atualizarContagemPainelAlertas();
        }, 400);
    }
};

window.confirmarLeituraTodosAlertas = function() {
    const cards = document.querySelectorAll('#alerta-container-global [id^="card-alerta-"]');
    if (!cards.length) return;
    const hj = new Date().toISOString().substring(0, 10);
    cards.forEach((el) => {
        const id = el.id.replace('card-alerta-', '');
        localStorage.setItem(chaveAlertaSilenciado(id, hj), "true");
        el.style.opacity = "0";
        el.style.transform = "translateX(50px)";
    });
    setTimeout(() => {
        const container = document.getElementById("alerta-container-global");
        if (container) {
            container.innerHTML = "";
            container.style.display = "none";
        }
        sessionStorage.removeItem('alertas_painel_minimizado');
    }, 400);
};

window.togglePainelAlertasMinimizado = function() {
    const minimizado = sessionStorage.getItem('alertas_painel_minimizado') === '1';
    sessionStorage.setItem('alertas_painel_minimizado', minimizado ? '0' : '1');
    const container = document.getElementById("alerta-container-global");
    if (!container) return;
    const barra = container.querySelector('.alerta-barra-minimizada');
    const painel = container.querySelector('.alerta-painel-wrapper');
    if (barra) barra.style.display = minimizado ? 'none' : 'flex';
    if (painel) painel.style.display = minimizado ? 'block' : 'none';
};

function atualizarContagemPainelAlertas() {
    const cards = document.querySelectorAll('#alerta-container-global [id^="card-alerta-"]');
    if (!cards.length) {
        const container = document.getElementById("alerta-container-global");
        if (container) {
            container.innerHTML = "";
            container.style.display = "none";
        }
        sessionStorage.removeItem('alertas_painel_minimizado');
        return;
    }
    const qtd = cards.length;
    document.querySelectorAll('.alerta-contagem-qtd').forEach((el) => {
        el.textContent = String(qtd);
    });
}

// Layout atualizado para exibir OBRA e LOJA
window.abrirDespesaDoAlertaNaObra = async function (id) {
    const d = (window._mapAlertasDespesas && window._mapAlertasDespesas[id]) || null;
    if (!d) {
        return Swal.fire('Aviso', 'Não foi possível localizar este vencimento.', 'warning');
    }
    const btnRel = document.getElementById('btn-menu-despesas-relatorio');
    if (typeof mudarAba === 'function') mudarAba('despesas-relatorio', btnRel);
    window._destacarDespesaId = id;
    window._abrirSecaoVencidas = true;
    const obra = d.obra_nome || d.obra || '';
    const loja = d.loja_nome || d.loja || '';
    if (obra && loja && typeof window.selecionarFornecedorDespesa === 'function') {
        window.selecionarFornecedorDespesa(loja, obra);
        return;
    }
    if (obra && typeof window.selecionarObraDespesa === 'function') {
        window.selecionarObraDespesa(obra);
        return;
    }
    const busca = document.getElementById('busca-obra');
    if (busca) busca.value = obra || loja || '';
    if (typeof window.buscarDespesasObra === 'function') {
        await window.buscarDespesasObra();
    }
};

function montarPainelAlerta(id, loja, obra, desc, titulo, tipo, temNota, valor, vencimento) {
    const corTema = tipo === "urgente" ? "#d9534f" : "#f0ad4e";
    const lojaEsc = escapeHtmlBasico(loja);
    const obraEsc = escapeHtmlBasico(obra);
    const descEsc = escapeHtmlBasico(desc);
    const valorEsc = escapeHtmlBasico(valor || '');
    const vencEsc = escapeHtmlBasico(vencimento || '');
    const btnNota = temNota
        ? `<button type="button" onclick="visualizarNotaAlertaVencimento('${id}')" style="background:#4285F4;color:#fff;border:none;border-radius:6px;padding:7px 10px;font-size:11px;font-weight:700;cursor:pointer;width:100%;">📄 VER NOTA</button>`
        : `<span style="display:block;font-size:10px;color:#999;text-align:center;padding:4px 0;">Sem nota anexada</span>`;

    return `
        <div id="card-alerta-${id}" class="card-alerta-venc" style="border-left:8px solid ${corTema};">
            <div style="flex:1; min-width:0;">
                <b style="color:${corTema}; font-size:14px; display:block; margin-bottom:6px;">${titulo}</b>
                <span style="color:#666; font-size:11px; text-transform:uppercase; font-weight:800; display:block; margin-bottom:2px;">🏗️ OBRA: ${obraEsc}</span>
                <span style="color:#666; font-size:11px; text-transform:uppercase; font-weight:800; display:block; margin-bottom:4px;">🏢 LOJA: ${lojaEsc}</span>
                <span style="color:#d9534f; font-weight:700; font-size:13px; display:block; margin-bottom:2px;">${valorEsc.startsWith('R$') ? valorEsc : 'R$ ' + valorEsc}</span>
                <span style="color:#666; font-size:11px; display:block; margin-bottom:4px;">📅 Venc.: ${vencEsc}</span>
                <span style="color:#1a2a43; font-weight:600; font-size:13px; line-height:1.2; display:block;">${descEsc}</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; flex-shrink:0; min-width:88px;">
                ${btnNota}
                <button type="button" onclick="window.abrirDespesaDoAlertaNaObra('${id}')" style="background:#1a2a43;color:#fff;border:none;border-radius:6px;padding:7px 10px;font-size:11px;font-weight:700;cursor:pointer;width:100%;">📍 Ver na obra</button>
                <button type="button" onclick="window.confirmarLeituraAlerta('${id}')" style="background:#f8f9fa; border:1px solid #ddd; border-radius:6px; padding:6px 12px; font-weight:700; cursor:pointer; color:#333;">OK</button>
            </div>
        </div>
    `;
}

function renderizarAlertasNoCanto(conteudo, som) {
    ensureAlertaStack();
    let container = document.getElementById("alerta-container-global");

    if (!container) {
        container = document.createElement("div");
        container.id = "alerta-container-global";
        ensureAlertaStack();
    }

    const qtd = (conteudo.match(/card-alerta-/g) || []).length;
    const minimizado = sessionStorage.getItem('alertas_painel_minimizado') === '1';

    container.style.display = 'block';
    container.innerHTML = `
        <div class="alerta-barra-minimizada" style="display:${minimizado ? 'flex' : 'none'}; background:#1a2a43; color:#fff; border-radius:10px; box-shadow:0 6px 20px rgba(0,0,0,0.2);">
            <span style="font-weight:700; cursor:pointer;" onclick="window.togglePainelAlertasMinimizado()" title="Clique para expandir">🔔 <span class="alerta-contagem-qtd">${qtd}</span> vencimento(s)</span>
            <button type="button" class="alerta-btn-imprimir" onclick="event.stopPropagation(); window.imprimirRelatorioAlertasVencimento()" title="Imprimir PDF">🖨️</button>
            <button type="button" class="alerta-btn-exportar" onclick="event.stopPropagation(); window.abrirExportarAlertasVencimento()" title="Exportar Excel/PDF">📊</button>
            <button type="button" class="alerta-btn-fechar" onclick="event.stopPropagation(); window.confirmarLeituraTodosAlertas()" title="Silenciar todos">Fechar</button>
            <button type="button" class="alerta-btn-expandir" onclick="event.stopPropagation(); window.togglePainelAlertasMinimizado()" title="Expandir painel">Abrir</button>
        </div>
        <div class="alerta-painel-wrapper" style="display:${minimizado ? 'none' : 'block'};">
            <div class="alerta-painel-header">
                <span class="alerta-painel-header-titulo">⚠️ Vencimentos (<span class="alerta-contagem-qtd">${qtd}</span>)</span>
                <div class="alerta-painel-header-acoes">
                    <button type="button" class="alerta-btn-fechar" onclick="window.confirmarLeituraTodosAlertas()" title="Silenciar todos">Fechar</button>
                    <button type="button" class="alerta-btn-imprimir" onclick="window.imprimirRelatorioAlertasVencimento()" title="Imprimir PDF">🖨️</button>
                    <button type="button" class="alerta-btn-exportar" onclick="window.abrirExportarAlertasVencimento()" title="Exportar Excel/PDF">📊</button>
                    <button type="button" class="alerta-btn-minimizar" onclick="window.togglePainelAlertasMinimizado()" title="Minimizar">−</button>
                </div>
            </div>
            <div class="alerta-painel-corpo">
                ${conteudo}
            </div>
        </div>
    `;

    if (som && !minimizado) tocarSomAlertaVencimento();
}

async function monitorarVencimentosDocumentos() {
    const empresaGestor = getEmpresaGestor();
    const telaPatraoAtiva = painelGestorEstaVisivel();
    let containerDocs = document.getElementById("alerta-container-docs");

    if (!empresaGestor || !telaPatraoAtiva) {
        if (containerDocs) containerDocs.style.display = 'none';
        return;
    }

    ensureAlertaStack();

    try {
        window._mapAlertasDocumentos = {};
        const resultado = await fetchDocumentosPessoaisEmpresa(empresaGestor);
        const todosMeta = (resultado && resultado.todosMeta) || [];

        const dataHojeReal = new Date();
        const hojeFormatado = dataHojeReal.toISOString().substring(0, 10);
        const hojeMeioDia = new Date();
        hojeMeioDia.setHours(12, 0, 0, 0);

        const filaAlertas = [];
        let emitirSom = false;

        todosMeta.forEach((dados) => {
            const idDoc = dados.id;
            const tsVenc = tsVencimentoDocumentoPessoal(dados);
            if (tsVenc == null) return;

            const diffMs = tsVenc - hojeMeioDia.getTime();
            const diasRestantes = Math.round(diffMs / (1000 * 60 * 60 * 24));
            const silenciadoHoje = localStorage.getItem(chaveAlertaSilenciadoDoc(idDoc, hojeFormatado));

            if (!silenciadoHoje) {
                let tituloAlerta = "";
                let classeUrgencia = "";

                if (diasRestantes < 0) {
                    tituloAlerta = "VENCIDO";
                    classeUrgencia = "urgente";
                    emitirSom = true;
                } else if (diasRestantes === 0) {
                    tituloAlerta = "VENCE HOJE";
                    classeUrgencia = "urgente";
                    emitirSom = true;
                } else if (diasRestantes > 0 && diasRestantes <= 5) {
                    tituloAlerta = "VENCE EM " + diasRestantes + " DIA(S)";
                    classeUrgencia = diasRestantes <= 2 ? "urgente" : "aviso";
                    emitirSom = true;
                }

                if (tituloAlerta !== "") {
                    const pasta = String(dados.pasta || "");
                    const pastaLabel = PASTA_LABEL_DOCUMENTOS[pasta] || pasta.toUpperCase() || "—";
                    const nomeDoc = dados.nome || "Documento";
                    const vencAlerta = formatarVencimentoDocExibir(dados);
                    const temArquivo = Boolean(dados.tem_arquivo);
                    window._mapAlertasDocumentos[idDoc] = Object.assign({ id: idDoc }, dados);
                    filaAlertas.push({
                        ts: tsVenc,
                        html: montarPainelAlertaDoc(idDoc, pastaLabel, nomeDoc, tituloAlerta, classeUrgencia, vencAlerta, temArquivo)
                    });
                }
            }
        });

        filaAlertas.sort((a, b) => a.ts - b.ts);
        const htmlAlertas = filaAlertas.map((a) => a.html).join('');

        if (htmlAlertas !== "") {
            renderizarAlertasDocsNoCanto(htmlAlertas, emitirSom);
        } else if (containerDocs) {
            containerDocs.innerHTML = "";
            containerDocs.style.display = "none";
        }
    } catch (err) {
        console.warn("Aguardando alertas de documentos...", err);
    }
}

window.imprimirRelatorioAlertasDocumentos = function () {
    function limparTextoParaPdf(s) {
        if (s == null) return '';
        return String(s)
            .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
            .replace(/[\u2014\u2013]/g, '-')
            .trim();
    }

    function statusAlertaDocParaPdf(d) {
        const tsVenc = tsVencimentoDocumentoPessoal(d);
        if (tsVenc == null) return 'PENDENTE';
        const hojeMeioDia = new Date();
        hojeMeioDia.setHours(12, 0, 0, 0);
        const dias = Math.round((tsVenc - hojeMeioDia.getTime()) / (1000 * 60 * 60 * 24));
        if (dias < 0) return 'VENCIDO';
        if (dias === 0) return 'VENCE HOJE';
        if (dias <= 5) return 'VENCE EM ' + dias + ' DIA(S)';
        return 'PENDENTE';
    }

    const cards = document.querySelectorAll('#alerta-container-docs [id^="card-alerta-doc-"]');
    if (!cards.length) {
        return Swal.fire('Atenção', 'Não há documentos/certidões na lista para imprimir.', 'info');
    }

    const empresa = limparTextoParaPdf(getEmpresaGestor() || 'Empresa');
    const linhas = [];

    cards.forEach((el) => {
        const id = el.id.replace('card-alerta-doc-', '');
        const d = window._mapAlertasDocumentos && window._mapAlertasDocumentos[id];
        if (!d) return;
        const pasta = PASTA_LABEL_DOCUMENTOS[d.pasta] || String(d.pasta || '').toUpperCase();
        linhas.push([
            statusAlertaDocParaPdf(d),
            limparTextoParaPdf(formatarVencimentoDocExibir(d)),
            limparTextoParaPdf(pasta),
            limparTextoParaPdf(d.nome || 'Documento')
        ]);
    });

    if (!linhas.length) {
        return Swal.fire('Aviso', 'Não foi possível montar o relatório.', 'warning');
    }

    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF('l', 'mm', 'a4');

    docPdf.setFillColor(26, 42, 67);
    docPdf.rect(0, 0, 297, 28, 'F');
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFontSize(14);
    docPdf.setFont('helvetica', 'bold');
    docPdf.text('DOC / CERTIDOES - VENCIMENTOS', 14, 11);
    docPdf.setFontSize(9);
    docPdf.setFont('helvetica', 'normal');
    docPdf.text(empresa + '  |  Gerado em: ' + new Date().toLocaleString('pt-BR') + '  |  ' + linhas.length + ' documento(s)', 14, 18);

    docPdf.autoTable({
        startY: 32,
        head: [['Situação', 'Vencimento', 'Pasta', 'Documento']],
        body: linhas,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 3, valign: 'middle', textColor: '#333333' },
        headStyles: { fillColor: [41, 128, 185], textColor: '#ffffff', fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 248, 250] },
        columnStyles: {
            0: { cellWidth: 38 },
            1: { cellWidth: 28 },
            2: { cellWidth: 32 },
            3: { cellWidth: 80 }
        },
        didParseCell: function (data) {
            if (data.column.index === 0 && data.section === 'body') {
                const t = String(data.cell.raw || '');
                if (t.includes('VENCIDO') || t.includes('HOJE')) {
                    data.cell.styles.textColor = [217, 83, 79];
                    data.cell.styles.fontStyle = 'bold';
                } else if (t.includes('VENCE EM')) {
                    data.cell.styles.textColor = [240, 173, 78];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    const nomeArq = 'relatorio_doc_certidoes_' + String(empresa).replace(/\s+/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
    try {
        docPdf.autoPrint();
        const url = docPdf.output('bloburl');
        const janela = window.open(url, '_blank');
        if (!janela) {
            docPdf.save(nomeArq);
            Swal.fire('PDF salvo', 'O navegador bloqueou a janela de impressão. Abra o PDF baixado para imprimir.', 'info');
        }
    } catch (e) {
        console.error(e);
        docPdf.save(nomeArq);
    }
};

window.visualizarDocumentoAlertaCertidao = async function (idDoc) {
    const meta = window._mapAlertasDocumentos && window._mapAlertasDocumentos[idDoc];
    if (!meta) return Swal.fire('Aviso', 'Documento não encontrado.', 'warning');
    Swal.fire({ title: 'Abrindo documento...', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
    const obter = typeof window.obterDocumentoPessoalCompleto === 'function'
        ? window.obterDocumentoPessoalCompleto
        : null;
    const d = obter ? await obter(idDoc, meta.pasta) : null;
    try {
        if (typeof Swal !== 'undefined' && Swal.isVisible()) Swal.close();
    } catch (_) {}
    if (!d || !d.arquivo) return Swal.fire('Aviso', 'Documento não encontrado.', 'warning');
    if (typeof window.abrirVisualizadorDocumento === 'function') {
        window.abrirVisualizadorDocumento(d.arquivo, d.nome, documentoPessoalEhPdf(d) ? 'pdf' : 'img');
        return;
    }
    abrirFoto(d.arquivo);
};

window.confirmarLeituraAlertaDoc = function (id) {
    const hj = new Date().toISOString().substring(0, 10);
    localStorage.setItem(chaveAlertaSilenciadoDoc(id, hj), "true");
    const el = document.getElementById('card-alerta-doc-' + id);
    if (el) {
        el.style.opacity = "0";
        el.style.transform = "translateX(50px)";
        setTimeout(() => {
            el.remove();
            atualizarContagemPainelAlertasDocs();
        }, 400);
    }
};

window.confirmarLeituraTodosAlertasDocs = function () {
    const cards = document.querySelectorAll('#alerta-container-docs [id^="card-alerta-doc-"]');
    if (!cards.length) return;
    const hj = new Date().toISOString().substring(0, 10);
    cards.forEach((el) => {
        const id = el.id.replace('card-alerta-doc-', '');
        localStorage.setItem(chaveAlertaSilenciadoDoc(id, hj), "true");
        el.style.opacity = "0";
        el.style.transform = "translateX(50px)";
    });
    setTimeout(() => {
        const container = document.getElementById("alerta-container-docs");
        if (container) {
            container.innerHTML = "";
            container.style.display = "none";
        }
        sessionStorage.removeItem('alertas_docs_painel_minimizado');
    }, 400);
};

window.togglePainelAlertasDocsMinimizado = function () {
    const minimizado = sessionStorage.getItem('alertas_docs_painel_minimizado') === '1';
    sessionStorage.setItem('alertas_docs_painel_minimizado', minimizado ? '0' : '1');
    const container = document.getElementById("alerta-container-docs");
    if (!container) return;
    const barra = container.querySelector('.alerta-barra-minimizada');
    const painel = container.querySelector('.alerta-painel-wrapper');
    if (barra) barra.style.display = minimizado ? 'none' : 'flex';
    if (painel) painel.style.display = minimizado ? 'block' : 'none';
};

function atualizarContagemPainelAlertasDocs() {
    const cards = document.querySelectorAll('#alerta-container-docs [id^="card-alerta-doc-"]');
    if (!cards.length) {
        const container = document.getElementById("alerta-container-docs");
        if (container) {
            container.innerHTML = "";
            container.style.display = "none";
        }
        sessionStorage.removeItem('alertas_docs_painel_minimizado');
        return;
    }
    const qtd = cards.length;
    document.querySelectorAll('.alerta-docs-contagem-qtd').forEach((el) => {
        el.textContent = String(qtd);
    });
}

function montarPainelAlertaDoc(id, pastaLabel, nomeDoc, titulo, tipo, vencimento, temArquivo) {
    const corTema = tipo === "urgente" ? "#d9534f" : "#f0ad4e";
    const pastaEsc = escapeHtmlBasico(pastaLabel);
    const nomeEsc = escapeHtmlBasico(nomeDoc);
    const vencEsc = escapeHtmlBasico(vencimento || '');
    const btnDoc = temArquivo
        ? '<button type="button" onclick="visualizarDocumentoAlertaCertidao(\'' + id + '\')" style="background:#2980b9;color:#fff;border:none;border-radius:6px;padding:7px 10px;font-size:11px;font-weight:700;cursor:pointer;width:100%;">📄 VER DOC</button>'
        : '<span style="display:block;font-size:10px;color:#999;text-align:center;padding:4px 0;">Sem arquivo</span>';

    return ''
        + '<div id="card-alerta-doc-' + id + '" class="card-alerta-venc" style="border-left:8px solid ' + corTema + ';">'
        + '<div style="flex:1; min-width:0;">'
        + '<b style="color:' + corTema + '; font-size:14px; display:block; margin-bottom:6px;">' + escapeHtmlBasico(titulo) + '</b>'
        + '<span style="color:#666; font-size:11px; text-transform:uppercase; font-weight:800; display:block; margin-bottom:2px;">📁 PASTA: ' + pastaEsc + '</span>'
        + '<span style="color:#666; font-size:11px; display:block; margin-bottom:4px;">📅 Venc.: ' + vencEsc + '</span>'
        + '<span style="color:#1a2a43; font-weight:600; font-size:13px; line-height:1.2; display:block;">' + nomeEsc + '</span>'
        + '</div>'
        + '<div style="display:flex; flex-direction:column; gap:8px; flex-shrink:0; min-width:88px;">'
        + btnDoc
        + '<button type="button" onclick="window.confirmarLeituraAlertaDoc(\'' + id + '\')" style="background:#f8f9fa; border:1px solid #ddd; border-radius:6px; padding:6px 12px; font-weight:700; cursor:pointer; color:#333;">OK</button>'
        + '</div>'
        + '</div>';
}

function renderizarAlertasDocsNoCanto(conteudo, som) {
    ensureAlertaStack();
    let container = document.getElementById("alerta-container-docs");

    if (!container) {
        container = document.createElement("div");
        container.id = "alerta-container-docs";
        ensureAlertaStack();
    }

    const qtd = (conteudo.match(/card-alerta-doc-/g) || []).length;
    const minimizado = sessionStorage.getItem('alertas_docs_painel_minimizado') === '1';

    container.style.display = 'block';
    container.innerHTML = ''
        + '<div style="text-align:right; margin-bottom:4px; width:100%;">'
        + '<span style="display:inline-block; background:#2980b9; color:#fff; font-size:10px; font-weight:800; letter-spacing:0.6px; padding:4px 10px; border-radius:6px 6px 0 0;">DOC / CERTIDOES</span>'
        + '</div>'
        + '<div class="alerta-barra-minimizada" style="display:' + (minimizado ? 'flex' : 'none') + '; align-items:center; gap:8px; background:#2980b9; color:#fff; padding:10px 14px; border-radius:10px; box-shadow:0 6px 20px rgba(0,0,0,0.2);">'
        + '<span style="font-weight:700; font-size:13px; flex:1; cursor:pointer;" onclick="window.togglePainelAlertasDocsMinimizado()" title="Clique para expandir">📋 <span class="alerta-docs-contagem-qtd">' + qtd + '</span> doc(s)</span>'
        + '<button type="button" class="alerta-btn-imprimir" onclick="event.stopPropagation(); window.imprimirRelatorioAlertasDocumentos()" title="Imprimir relatório">🖨️</button>'
        + '<button type="button" class="alerta-btn-fechar" onclick="window.confirmarLeituraTodosAlertasDocs()" title="Silenciar todos">Fechar</button>'
        + '<button type="button" onclick="window.togglePainelAlertasDocsMinimizado()" style="background:#fff; color:#2980b9; border:none; border-radius:6px; padding:4px 10px; font-weight:700; font-size:12px; cursor:pointer;">Expandir</button>'
        + '</div>'
        + '<div class="alerta-painel-wrapper" style="display:' + (minimizado ? 'none' : 'block') + ';">'
        + '<div class="alerta-painel-header" style="border-color:#2980b9;">'
        + '<span class="alerta-painel-header-titulo">📋 DOC/CERTIDOES (<span class="alerta-docs-contagem-qtd">' + qtd + '</span>)</span>'
        + '<div class="alerta-painel-header-acoes">'
        + '<button type="button" class="alerta-btn-fechar" onclick="window.confirmarLeituraTodosAlertasDocs()" title="Silenciar todos os alertas de hoje">Fechar tudo</button>'
        + '<button type="button" class="alerta-btn-imprimir" onclick="window.imprimirRelatorioAlertasDocumentos()" title="Imprimir relatório">🖨️ Imprimir</button>'
        + '<button type="button" class="alerta-btn-minimizar" onclick="window.togglePainelAlertasDocsMinimizado()" title="Minimizar painel">−</button>'
        + '</div>'
        + '</div>'
        + '<div class="alerta-painel-corpo">' + conteudo + '</div>'
        + '</div>';

    if (som && !minimizado) tocarSomAlertaVencimento();
}

function montarPainelAlertaPonto(chave, nomeFunc, titulo, detalhe, funcId) {
    const corTema = '#e67e22';
    const funcIdEsc = String(funcId || '').replace(/'/g, "\\'");
    return ''
        + '<div id="card-alerta-ponto-' + chave + '" class="card-alerta-venc" style="border-left:8px solid ' + corTema + ';">'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-weight:800;font-size:12px;color:' + corTema + ';">' + escapeHtmlBasico(titulo) + '</div>'
        + '<div style="font-size:13px;font-weight:700;color:#1a2a43;margin-top:4px;">' + escapeHtmlBasico(nomeFunc || 'Funcionário') + '</div>'
        + '<div style="font-size:12px;color:#555;margin-top:4px;">' + escapeHtmlBasico(detalhe || '') + '</div>'
        + '<button type="button" class="alerta-btn-ver-ponto" onclick="window.irParaPontoFuncionarioAlerta(\'' + funcIdEsc + '\')" style="margin-top:8px;width:100%;background:#e67e22;color:#fff;border:none;border-radius:6px;padding:7px 10px;font-size:11px;font-weight:700;cursor:pointer;">📍 VER PONTO</button>'
        + '</div>'
        + '<button type="button" class="alerta-btn-fechar" onclick="window.confirmarLeituraAlertaPonto(\'' + chave + '\')" title="Silenciar hoje">Fechar</button>'
        + '</div>';
}

function renderizarAlertasPontoNoCanto(conteudo, som) {
    ensureAlertaStack();
    let container = document.getElementById('alerta-container-ponto');
    if (!container) {
        container = document.createElement('div');
        container.id = 'alerta-container-ponto';
        ensureAlertaStack();
    }
    const qtd = (conteudo.match(/card-alerta-ponto-/g) || []).length;
    const minimizado = sessionStorage.getItem('alertas_ponto_painel_minimizado') === '1';
    container.style.display = 'block';
    container.innerHTML = ''
        + '<div class="alerta-barra-minimizada" style="display:' + (minimizado ? 'flex' : 'none') + ';align-items:center;gap:8px;background:#fff;border:1px solid #e0e0e0;border-radius:10px;padding:10px 14px;box-shadow:0 4px 12px rgba(0,0,0,0.08);cursor:pointer;" onclick="window.togglePainelAlertasPontoMinimizado()">'
        + '<span style="font-weight:700;font-size:13px;flex:1;">📍 <span class="alerta-ponto-contagem-qtd">' + qtd + '</span> ponto(s) fora de ordem</span>'
        + '<span style="font-size:11px;color:#888;">Expandir</span>'
        + '</div>'
        + '<div class="alerta-painel-wrapper" style="display:' + (minimizado ? 'none' : 'block') + ';">'
        + '<div class="alerta-painel-header" style="border-color:#e67e22;">'
        + '<span class="alerta-painel-header-titulo">📍 PONTO FORA DE ORDEM (<span class="alerta-ponto-contagem-qtd">' + qtd + '</span>)</span>'
        + '<div class="alerta-painel-header-acoes">'
        + '<button type="button" class="alerta-btn-fechar" onclick="window.confirmarLeituraTodosAlertasPonto()" title="Silenciar todos hoje">Fechar tudo</button>'
        + '<button type="button" class="alerta-btn-minimizar" onclick="window.togglePainelAlertasPontoMinimizado()" title="Minimizar">−</button>'
        + '</div>'
        + '</div>'
        + '<div class="alerta-painel-corpo">' + conteudo + '</div>'
        + '</div>';
    if (som && !minimizado) tocarSomAlertaVencimento();
}

window.irParaPontoFuncionarioAlerta = function (funcId) {
    if (!funcId) return;
    const btnPonto = document.querySelector('.gestor-menu-btn[data-titulo="Ponto"]');
    if (typeof mudarAba === 'function') {
        mudarAba('ponto', btnPonto || null);
    }
    setTimeout(function () {
        const sel = document.getElementById('pt-func-select');
        if (sel) {
            sel.value = funcId;
            if (typeof buscarPonto === 'function') buscarPonto();
        }
    }, 350);
};

window.confirmarLeituraAlertaPonto = function (chave) {
    const hj = new Date().toISOString().substring(0, 10);
    localStorage.setItem(chaveAlertaSilenciadoPonto(chave, hj), 'true');
    const el = document.getElementById('card-alerta-ponto-' + chave);
    if (el) {
        el.style.opacity = '0';
        el.style.transform = 'translateX(50px)';
        setTimeout(function () {
            el.remove();
            const restantes = document.querySelectorAll('#alerta-container-ponto [id^="card-alerta-ponto-"]');
            document.querySelectorAll('.alerta-ponto-contagem-qtd').forEach(function (n) {
                n.textContent = String(restantes.length);
            });
            if (!restantes.length) {
                const container = document.getElementById('alerta-container-ponto');
                if (container) {
                    container.innerHTML = '';
                    container.style.display = 'none';
                }
            }
        }, 400);
    }
};

window.confirmarLeituraTodosAlertasPonto = function () {
    const cards = document.querySelectorAll('#alerta-container-ponto [id^="card-alerta-ponto-"]');
    if (!cards.length) return;
    const hj = new Date().toISOString().substring(0, 10);
    cards.forEach(function (el) {
        const chave = el.id.replace('card-alerta-ponto-', '');
        localStorage.setItem(chaveAlertaSilenciadoPonto(chave, hj), 'true');
        el.style.opacity = '0';
        el.style.transform = 'translateX(50px)';
    });
    setTimeout(function () {
        const container = document.getElementById('alerta-container-ponto');
        if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
        }
        sessionStorage.removeItem('alertas_ponto_painel_minimizado');
    }, 400);
};

window.togglePainelAlertasPontoMinimizado = function () {
    const minimizado = sessionStorage.getItem('alertas_ponto_painel_minimizado') === '1';
    sessionStorage.setItem('alertas_ponto_painel_minimizado', minimizado ? '0' : '1');
    const container = document.getElementById('alerta-container-ponto');
    if (!container) return;
    const wrap = container.querySelector('.alerta-painel-wrapper');
    const barra = container.querySelector('.alerta-barra-minimizada');
    if (wrap) wrap.style.display = minimizado ? 'block' : 'none';
    if (barra) barra.style.display = minimizado ? 'none' : 'flex';
};

async function monitorarSequenciaPontoGestor() {
    const empresaGestor = getEmpresaGestor();
    const telaPatraoAtiva = painelGestorEstaVisivel();
    let containerPonto = document.getElementById('alerta-container-ponto');

    if (!empresaGestor || !telaPatraoAtiva) {
        if (containerPonto) containerPonto.style.display = 'none';
        return;
    }

    ensureAlertaStack();

    try {
        const dataHojeBr = (function () {
            const d = new Date();
            return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
        })();
        const hojeFormatado = new Date().toISOString().substring(0, 10);

        // Só o dia de hoje — evita baixar o mês inteiro (com selfies) a cada 2 min e estourar a cota do Firebase.
        const qPonto = query(collection(db, 'ponto_registros'), where('data', '==', dataHojeBr));
        const qEvt = query(collection(db, 'ponto_eventos'), where('empresa_id', '==', empresaGestor));
        const [snapPontoBruto, snapEvt] = await Promise.all([getDocs(qPonto), getDocs(qEvt)]);
        const snapPonto = {
            forEach: function (fn) {
                snapPontoBruto.forEach((docSnap) => {
                    const d = docSnap.data();
                    if (d && String(d.empresa_id || '') === String(empresaGestor)) fn(docSnap);
                });
            }
        };

        const cancelados = new Set();
        const tentativas = [];
        snapEvt.forEach((docSnap) => {
            const ev = docSnap.data();
            if (!ev) return;
            if (ev.tipo === 'CANCELAMENTO' && ev.ponto_id) {
                cancelados.add(ev.ponto_id);
                return;
            }
            if (ev.tipo !== 'SEQUENCIA_INVALIDA') return;
            let evHoje = false;
            if (String(ev.data_br || '') === dataHojeBr) evHoje = true;
            const t = ev.criado_em;
            if (!evHoje && t) {
                let ms = 0;
                if (typeof t.toMillis === 'function') ms = t.toMillis();
                else if (typeof t.seconds === 'number') ms = t.seconds * 1000;
                if (ms) {
                    const dt = new Date(ms);
                    const br = String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0') + '/' + dt.getFullYear();
                    if (br === dataHojeBr) evHoje = true;
                }
            }
            if (!evHoje) return;
            tentativas.push({
                chave: 'evt_' + docSnap.id,
                funcionario_id: ev.funcionario_id,
                nome: ev.funcionario_nome || 'Funcionário',
                tipo: ev.tipo_tentado || '—',
                data: ev.data_br || dataHojeBr,
                hora: ev.hora_tentativa || '—',
                msg: ev.motivo || 'Tentativa bloqueada fora da sequência.',
                origem: 'tentativa'
            });
        });

        const porFuncDia = {};
        snapPonto.forEach((docSnap) => {
            const d = docSnap.data();
            if (String(d.data || '') !== dataHojeBr) return;
            const fid = d.funcionario_id || '';
            if (!fid) return;
            const chaveDia = fid + '::' + dataHojeBr;
            if (!porFuncDia[chaveDia]) porFuncDia[chaveDia] = [];
            porFuncDia[chaveDia].push(Object.assign({ id: docSnap.id }, d));
        });

        const filaAlertas = [];
        let emitirSom = false;

        Object.keys(porFuncDia).forEach((chaveDia) => {
            const dedup = typeof deduplicarBatidasPonto === 'function'
                ? deduplicarBatidasPonto(porFuncDia[chaveDia], cancelados)
                : { validas: porFuncDia[chaveDia] };
            const erros = typeof detectarErrosSequenciaPontoDia === 'function'
                ? detectarErrosSequenciaPontoDia(dedup.validas, cancelados)
                : [];
            erros.forEach((er) => {
                const chave = 'reg_' + er.pontoId;
                if (localStorage.getItem(chaveAlertaSilenciadoPonto(chave, hojeFormatado))) return;
                emitirSom = true;
                const detalhe = (er.tipo || 'Batida') + ' às ' + (er.hora || '—') + ' — ' + (er.msg || '');
                filaAlertas.push({
                    ts: er.pontoId,
                    html: montarPainelAlertaPonto(chave, er.nome, 'REGISTRO FORA DE ORDEM', detalhe, er.funcionario_id)
                });
            });
        });

        tentativas.forEach((t) => {
            if (localStorage.getItem(chaveAlertaSilenciadoPonto(t.chave, hojeFormatado))) return;
            emitirSom = true;
            const detalhe = 'Tentou ' + t.tipo + ' às ' + t.hora + ' (bloqueado) — ' + t.msg;
            filaAlertas.push({
                ts: t.chave,
                html: montarPainelAlertaPonto(t.chave, t.nome, 'TENTATIVA ERRADA (BLOQUEADA)', detalhe, t.funcionario_id)
            });
        });

        const htmlAlertas = filaAlertas.map(function (a) { return a.html; }).join('');
        if (htmlAlertas) {
            renderizarAlertasPontoNoCanto(htmlAlertas, emitirSom);
        } else if (containerPonto) {
            containerPonto.innerHTML = '';
            containerPonto.style.display = 'none';
        }
    } catch (err) {
        console.warn('Aguardando alertas de ponto...', err);
    }
}

window.monitorarSequenciaPontoGestor = monitorarSequenciaPontoGestor;

function chaveIdsPedidosConhecidos() {
    const emp = (typeof getEmpresaGestor === 'function' ? getEmpresaGestor() : '') || 'global';
    return 'pedidos_material_ids_conhecidos_' + emp;
}

function lerIdsPedidosConhecidos() {
    try {
        const raw = sessionStorage.getItem(chaveIdsPedidosConhecidos());
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch (_) {
        return [];
    }
}

function salvarIdsPedidosConhecidos(ids) {
    try {
        sessionStorage.setItem(chaveIdsPedidosConhecidos(), JSON.stringify(ids || []));
    } catch (_) {}
}

function tocarSomAlertaPedidosMaterial() {
    tocarSomAlertaVencimento();
    setTimeout(function () { tocarSomAlertaVencimento(); }, 650);
    setTimeout(function () { tocarSomAlertaVencimento(); }, 1300);
}

function atualizarBadgeMenuPedidos(qtdNovos) {
    if (!document.getElementById('style-piscar')) {
        const style = document.createElement('style');
        style.id = 'style-piscar';
        style.innerHTML = `
            @keyframes piscarVermelho {
                0% { background-color: #d9534f; color: white; box-shadow: 0 0 8px #d9534f; }
                50% { background-color: #f8d7da; color: #721c24; box-shadow: none; }
                100% { background-color: #d9534f; color: white; box-shadow: 0 0 8px #d9534f; }
            }
            .badge-piscar {
                animation: piscarVermelho 1.2s infinite;
                padding: 4px 8px;
                border-radius: 5px;
                font-weight: bold;
                font-size: 10px;
                display: inline-block;
            }
        `;
        document.head.appendChild(style);
    }
    const btn = document.getElementById('btn-menu-pedidos');
    if (!btn) return;
    const base = '📦 Pedidos Materiais';
    if (qtdNovos > 0) {
        btn.innerHTML = base + ' <span class="badge-piscar" style="margin-left:6px;">' + qtdNovos + ' NOVO</span>';
    } else {
        btn.textContent = base;
    }
}

function montarPainelAlertaPedido(id, nome, equipe, descricao, dataHora) {
    const idEsc = String(id || '').replace(/'/g, "\\'");
    const descCurta = String(descricao || '').length > 120
        ? String(descricao || '').substring(0, 120) + '...'
        : String(descricao || '');
    return ''
        + '<div id="card-alerta-pedido-' + id + '" class="card-alerta-venc" style="border-left:8px solid #d9534f;">'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-weight:800;font-size:12px;color:#d9534f;">🚨 PEDIDO DE MATERIAL</div>'
        + '<div style="font-size:13px;font-weight:700;color:#1a2a43;margin-top:4px;">' + escapeHtmlBasico(nome || 'Funcionário') + '</div>'
        + '<div style="font-size:12px;color:#555;margin-top:4px;"><b>Obra/Equipe:</b> ' + escapeHtmlBasico(equipe || '-') + '</div>'
        + '<div style="font-size:11px;color:#888;margin-top:2px;">' + escapeHtmlBasico(dataHora || '') + '</div>'
        + '<div style="font-size:12px;color:#333;margin-top:6px;white-space:pre-wrap;">' + escapeHtmlBasico(descCurta) + '</div>'
        + '<button type="button" class="alerta-btn-ver-pedidos" onclick="window.irParaPedidosMaterialAlerta()" style="margin-top:8px;width:100%;background:#d9534f;color:#fff;border:none;border-radius:6px;padding:7px 10px;font-size:11px;font-weight:700;cursor:pointer;">📦 VER PEDIDOS</button>'
        + '</div>'
        + '<button type="button" class="alerta-btn-fechar" onclick="window.confirmarLeituraAlertaPedido(\'' + idEsc + '\')" title="Silenciar hoje">Fechar</button>'
        + '</div>';
}

function renderizarAlertasPedidosNoCanto(conteudo, som) {
    ensureAlertaStack();
    let container = document.getElementById('alerta-container-pedidos');
    if (!container) {
        container = document.createElement('div');
        container.id = 'alerta-container-pedidos';
        ensureAlertaStack();
        container = document.getElementById('alerta-container-pedidos');
    }
    const qtd = (conteudo.match(/card-alerta-pedido-/g) || []).length;
    const minimizado = sessionStorage.getItem('alertas_pedidos_painel_minimizado') === '1';
    container.style.display = 'block';
    container.innerHTML = ''
        + '<div class="alerta-barra-minimizada" style="display:' + (minimizado ? 'flex' : 'none') + ';align-items:center;gap:8px;background:#d9534f;color:#fff;padding:10px 14px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,0.2);cursor:pointer;" onclick="window.togglePainelAlertasPedidosMinimizado()">'
        + '<span style="font-weight:700;font-size:13px;flex:1;">📦 <span class="alerta-pedidos-contagem-qtd">' + qtd + '</span> pedido(s) novo(s)</span>'
        + '<span style="font-size:11px;opacity:0.9;">Expandir</span>'
        + '</div>'
        + '<div class="alerta-painel-wrapper" style="display:' + (minimizado ? 'none' : 'block') + ';">'
        + '<div class="alerta-painel-header" style="border-color:#d9534f;">'
        + '<span class="alerta-painel-header-titulo">📦 PEDIDOS MATERIAIS (<span class="alerta-pedidos-contagem-qtd">' + qtd + '</span>)</span>'
        + '<div class="alerta-painel-header-acoes">'
        + '<button type="button" class="alerta-btn-fechar" onclick="window.confirmarLeituraTodosAlertasPedidos()" title="Silenciar todos hoje">Fechar tudo</button>'
        + '<button type="button" class="alerta-btn-minimizar" onclick="window.togglePainelAlertasPedidosMinimizado()" title="Minimizar">−</button>'
        + '</div>'
        + '</div>'
        + '<div class="alerta-painel-corpo">' + conteudo + '</div>'
        + '</div>';
    if (som && !minimizado) tocarSomAlertaPedidosMaterial();
}

window.irParaPedidosMaterialAlerta = function () {
    const btn = document.getElementById('btn-menu-pedidos');
    if (typeof mudarAba === 'function') {
        mudarAba('pedidos', btn || null);
    }
    setTimeout(function () {
        if (typeof buscarPedidosMaterial === 'function') buscarPedidosMaterial();
    }, 300);
};

window.confirmarLeituraAlertaPedido = function (id) {
    const hj = new Date().toISOString().substring(0, 10);
    localStorage.setItem(chaveAlertaSilenciadoPedido(id, hj), 'true');
    const el = document.getElementById('card-alerta-pedido-' + id);
    if (el) {
        el.style.opacity = '0';
        el.style.transform = 'translateX(50px)';
        setTimeout(function () {
            el.remove();
            const restantes = document.querySelectorAll('#alerta-container-pedidos [id^="card-alerta-pedido-"]');
            document.querySelectorAll('.alerta-pedidos-contagem-qtd').forEach(function (n) {
                n.textContent = String(restantes.length);
            });
            if (!restantes.length) {
                const container = document.getElementById('alerta-container-pedidos');
                if (container) {
                    container.innerHTML = '';
                    container.style.display = 'none';
                }
            }
        }, 350);
    }
};

window.confirmarLeituraTodosAlertasPedidos = function () {
    const hj = new Date().toISOString().substring(0, 10);
    document.querySelectorAll('#alerta-container-pedidos [id^="card-alerta-pedido-"]').forEach(function (el) {
        const id = el.id.replace('card-alerta-pedido-', '');
        localStorage.setItem(chaveAlertaSilenciadoPedido(id, hj), 'true');
    });
    const container = document.getElementById('alerta-container-pedidos');
    if (container) {
        container.innerHTML = '';
        container.style.display = 'none';
    }
};

window.togglePainelAlertasPedidosMinimizado = function () {
    const minimizado = sessionStorage.getItem('alertas_pedidos_painel_minimizado') === '1';
    sessionStorage.setItem('alertas_pedidos_painel_minimizado', minimizado ? '0' : '1');
    const container = document.getElementById('alerta-container-pedidos');
    if (!container) return;
    const wrap = container.querySelector('.alerta-painel-wrapper');
    const barra = container.querySelector('.alerta-barra-minimizada');
    if (wrap) wrap.style.display = minimizado ? 'block' : 'none';
    if (barra) barra.style.display = minimizado ? 'none' : 'flex';
};

async function monitorarPedidosMaterialGestor() {
    const empresaGestor = typeof getEmpresaGestor === 'function' ? getEmpresaGestor() : '';
    const telaPatraoAtiva = typeof painelGestorEstaVisivel === 'function' ? painelGestorEstaVisivel() : false;
    let containerPedidos = document.getElementById('alerta-container-pedidos');

    if (!empresaGestor || !telaPatraoAtiva) {
        if (containerPedidos) containerPedidos.style.display = 'none';
        return;
    }

    ensureAlertaStack();

    try {
        const hojeFormatado = new Date().toISOString().substring(0, 10);
        const q = query(collection(db, 'pedidos_material'), where('empresa_id', '==', empresaGestor));
        const snap = await getDocs(q);

        const pedidosNovos = [];
        snap.forEach(function (docSnap) {
            const p = docSnap.data() || {};
            if (String(p.status || '').toLowerCase() !== 'novo') return;
            pedidosNovos.push({ id: docSnap.id, ...p });
        });
        pedidosNovos.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

        atualizarBadgeMenuPedidos(pedidosNovos.length);

        const conhecidos = lerIdsPedidosConhecidos();
        const conhecidosSet = new Set(conhecidos);
        const idsAtuais = pedidosNovos.map(function (p) { return p.id; });
        const idsNovosDetectados = idsAtuais.filter(function (id) { return !conhecidosSet.has(id); });
        const primeiraVarredura = !sessionStorage.getItem(chaveIdsPedidosConhecidos() + '_init');

        // Mantém IDs conhecidos (inclui os que saíram de "novo" para não bipar de novo se voltarem)
        const uniao = Array.from(new Set(conhecidos.concat(idsAtuais)));
        salvarIdsPedidosConhecidos(uniao);
        if (primeiraVarredura) {
            sessionStorage.setItem(chaveIdsPedidosConhecidos() + '_init', '1');
        }

        const filaHtml = [];
        pedidosNovos.forEach(function (p) {
            if (localStorage.getItem(chaveAlertaSilenciadoPedido(p.id, hojeFormatado))) return;
            const dataHora = ((p.data || '') + (p.hora ? ' às ' + p.hora : '')).trim();
            filaHtml.push(montarPainelAlertaPedido(p.id, p.nome, p.equipe, p.descricao, dataHora));
        });

        const htmlAlertas = filaHtml.join('');
        const emitirSom = !primeiraVarredura && idsNovosDetectados.length > 0;

        if (htmlAlertas) {
            renderizarAlertasPedidosNoCanto(htmlAlertas, emitirSom);
            // Na primeira abertura do painel, se já houver pedidos novos, avisa 1 vez
            if (primeiraVarredura && pedidosNovos.some(function (p) {
                return !localStorage.getItem(chaveAlertaSilenciadoPedido(p.id, hojeFormatado));
            })) {
                tocarSomAlertaPedidosMaterial();
            }
        } else if (containerPedidos || document.getElementById('alerta-container-pedidos')) {
            const c = document.getElementById('alerta-container-pedidos');
            if (c) {
                c.innerHTML = '';
                c.style.display = 'none';
            }
        }

        // Se chegou pedido novo com painel minimizado, ainda assim apita
        if (emitirSom && sessionStorage.getItem('alertas_pedidos_painel_minimizado') === '1') {
            tocarSomAlertaPedidosMaterial();
        }
    } catch (err) {
        console.warn('Aguardando alertas de pedidos de material...', err);
    }
}

window.monitorarPedidosMaterialGestor = monitorarPedidosMaterialGestor;

// Inicia a monitorização 3 segundos após carregar a página
setTimeout(function () {
    monitorarVencimentosDocumentos();
    monitorarVencimentosObras();
    monitorarSequenciaPontoGestor();
    monitorarPedidosMaterialGestor();
}, 3000);
setInterval(function () {
    monitorarVencimentosDocumentos();
    monitorarVencimentosObras();
    monitorarSequenciaPontoGestor();
}, 3600000);
setInterval(function () {
    monitorarSequenciaPontoGestor();
}, 300000);
setInterval(function () {
    monitorarPedidosMaterialGestor();
}, 45000);
// === FIM DO SISTEMA DE ALERTAS ===
