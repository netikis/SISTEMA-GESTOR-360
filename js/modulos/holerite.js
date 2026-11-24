/* js/modulos/holerite.js — edite este arquivo para alterar só este módulo */
    window.exportarPDFDiscriminacaoFolha = function () {
        const pack = window.folhaDiscriminacaoPDF;
        if (!pack || !Array.isArray(pack.linhas) || pack.linhas.length === 0) {
            return Swal.fire('Atenção', 'Calcule a folha primeiro (botão Calcular fechamento) para gerar o PDF da discriminação.', 'warning');
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4');
        const emp = String(pack.empresaNome || 'Empresa').trim() || 'Empresa';

        doc.setFillColor(26, 42, 67);
        doc.rect(0, 0, 297, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('DISCRIMINACAO DIA A DIA — FOLHA / JORNADA', 14, 11);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(220, 220, 220);
        doc.text(emp + '  |  Funcionario: ' + (pack.funcionarioNome || ''), 14, 18);
        doc.text('Referencia: ' + (pack.mesRef || '') + '  |  Emitido em: ' + (pack.emitidoEm || ''), 14, 24);
        doc.setFontSize(8);
        doc.text(
            'Resumo do calculo: ' + (pack.diasPagos != null ? pack.diasPagos : '-') + ' dias pagos  |  Proporcional: ' + (pack.salarioProporcionalFmt || '-') + '  |  Liquido: ' + (pack.liquidoFmt || '-'),
            14,
            29
        );

        const head = [[
            'Data',
            'Dia',
            'Tipo',
            'Jornada esperada',
            'Horas ponto',
            'Dif. (esp. - trab.)',
            'Dia pago?',
            'Observacao'
        ]];
        const body = pack.linhas.map(function (r) {
            return [
                r.keyDia || '',
                r.nomeSemana || '',
                r.tipoDia || '',
                r.esperadoTxt || '',
                r.trabalhadoTxt || '',
                r.diferencaTxt || '',
                r.diaPagoTxt || '',
                r.situacao || ''
            ];
        });

        doc.autoTable({
            startY: 34,
            head: head,
            body: body,
            theme: 'striped',
            styles: { fontSize: 7, cellPadding: 1.8, valign: 'top', textColor: [51, 51, 51], overflow: 'linebreak' },
            headStyles: { fillColor: [26, 42, 67], textColor: 255, fontStyle: 'bold', fontSize: 7 },
            alternateRowStyles: { fillColor: [245, 248, 250] },
            margin: { left: 10, right: 10 },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 22 },
                2: { cellWidth: 28 },
                3: { cellWidth: 40 },
                4: { cellWidth: 20 },
                5: { cellWidth: 22 },
                6: { cellWidth: 16 },
                7: { cellWidth: 92 }
            },
            didDrawPage: function (data) {
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text('Pagina ' + doc.internal.getNumberOfPages(), data.settings.margin.left, doc.internal.pageSize.height - 8);
            }
        });

        const safeNome = String(pack.funcionarioNome || 'funcionario').replace(/[^\w\u00C0-\u024F\s-]/g, '').replace(/\s+/g, '_');
        const safeRef = String(pack.mesRef || '').replace(/\//g, '-');
        doc.save('discriminacao_folha_' + safeNome + '_' + safeRef + '.pdf');
    };

    function pdfHoleriteQuebraTexto(doc, texto, larguraMm) {
        return doc.splitTextToSize(String(texto || ''), larguraMm);
    }

    function pdfHoleriteSecaoBarra(doc, y, titulo, rgb, largura, margem) {
        const h = 8;
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.rect(margem, y, largura, h, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(titulo, margem + 4, y + 5.5);
        return y + h + 4;
    }

    function pdfHoleriteLabelResumido(label, maxChars) {
        const s = String(label || '');
        const lim = maxChars || 48;
        return s.length > lim ? s.slice(0, lim - 1) + '…' : s;
    }

    /** Linha compacta para caber o holerite numa única página A4. */
    function pdfHoleriteLinhaItem(doc, y, x, largura, label, valor, corValor, indice, cfg) {
        const c = cfg || {};
        const padTop = c.padTop != null ? c.padTop : 3;
        const valorW = 32;
        const labelW = largura - valorW - 3;
        const fs = c.fontSize || 9;
        const alturaMin = c.alturaMin || 8.5;
        doc.setFontSize(fs);
        const linhas = pdfHoleriteQuebraTexto(doc, pdfHoleriteLabelResumido(label, 52), labelW);
        const maxLinhas = c.maxLinhasLabel || 2;
        const linhasUsar = linhas.slice(0, maxLinhas);
        const alturaLinha = 4.2;
        const altura = Math.max(alturaMin, padTop + linhasUsar.length * alturaLinha + 3);

        if (indice % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(x, y, largura, altura, 'F');
        }
        doc.setDrawColor(235, 238, 242);
        doc.line(x, y + altura, x + largura, y + altura);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fs);
        doc.setTextColor(55, 55, 55);
        doc.text(linhasUsar, x + 2, y + padTop + 3.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fs + 0.5);
        if (corValor) doc.setTextColor(corValor[0], corValor[1], corValor[2]);
        else doc.setTextColor(26, 42, 67);
        doc.text(String(valor), x + largura - 2, y + padTop + 3.5, { align: 'right' });

        return y + altura;
    }

    function pdfHoleriteRodapeFixo(doc, margem, largura, footerY) {
        doc.setDrawColor(200, 210, 220);
        doc.line(margem, footerY, margem + largura, footerY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(130, 130, 130);
        doc.text('Documento gerado pelo Gestor 360 — despesas, holerite, ponto e lançamentos do período.', margem, footerY + 5);
        const assW = (largura - 10) / 2;
        const assY = footerY + 14;
        doc.setDrawColor(170, 170, 170);
        doc.line(margem, assY, margem + assW, assY);
        doc.line(margem + assW + 10, assY, margem + largura, assY);
        doc.setFontSize(8);
        doc.setTextColor(90, 90, 90);
        doc.text('Assinatura do empregador', margem + assW / 2, assY + 4, { align: 'center' });
        doc.text('Assinatura do colaborador', margem + assW + 10 + assW / 2, assY + 4, { align: 'center' });
    }

    window.exportarPDFHoleriteFolha = function () {
        const pack = window.folhaHoleritePDF;
        if (!pack) {
            return Swal.fire('Atenção', 'Calcule a folha primeiro (botão "Calcular fechamento").', 'warning');
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageH = doc.internal.pageSize.getHeight();
        const margem = 12;
        const largura = 186;
        const meio = margem + largura / 2;
        const colW = largura / 2 - 2;
        const gapCol = 3;
        const FOOTER_Y = pageH - 24;
        const linCfg = { fontSize: 9, alturaMin: 8.5, padTop: 3, maxLinhasLabel: 2 };

        let y = 6;

        doc.setFillColor(26, 42, 67);
        doc.rect(0, 0, 210, 34, 'F');
        doc.setFillColor(212, 160, 23);
        doc.rect(0, 34, 210, 1.2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(String(pack.empresaNome || 'Empresa').toUpperCase(), margem, 12);
        doc.setFontSize(13);
        doc.text('ESPELHO DE HOLERITE', margem, 19);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(225, 225, 225);
        doc.text('Demonstrativo de pagamento', margem, 26);
        doc.text('Ref.: ' + (pack.mesRef || '') + '  |  ' + (pack.emitidoEm || ''), margem, 31);

        y = 38;
        const boxH = 26;
        doc.setDrawColor(200, 210, 220);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margem, y, largura, boxH, 2, 2, 'FD');
        doc.setTextColor(26, 42, 67);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('COLABORADOR', margem + 4, y + 6);
        doc.setFontSize(10.5);
        doc.text(String(pack.funcionarioNome || ''), margem + 4, y + 12);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(70, 70, 70);
        doc.text('CPF: ' + (pack.cpf || '—') + '   PIX: ' + (pack.pix || '—'), margem + 4, y + 18);
        const colDirX = margem + largura / 2 + 2;
        doc.text('Dias pagos: ' + String(pack.diasPagos != null ? pack.diasPagos : '0'), colDirX, y + 12);
        doc.text('Contrato: ' + formatarMoeda(pack.salarioContrato), colDirX, y + 18);
        doc.text('Jorn.: ' + pdfHoleriteLabelResumido(pack.horario, 42), colDirX, y + 23);

        y += boxH + 5;

        const yColsTop = y;
        const hdrH = 7;
        doc.setFillColor(40, 167, 69);
        doc.rect(margem, yColsTop, colW, hdrH, 'F');
        doc.setFillColor(217, 83, 79);
        doc.rect(meio + gapCol / 2, yColsTop, colW, hdrH, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('PROVENTOS', margem + 3, yColsTop + 5);
        doc.text('DESCONTOS', meio + gapCol / 2 + 3, yColsTop + 5);

        let yP = yColsTop + hdrH + 1;
        let yD = yColsTop + hdrH + 1;
        (pack.proventos || []).forEach(function (item, i) {
            yP = pdfHoleriteLinhaItem(doc, yP, margem, colW, item.label, formatarMoeda(item.valor), [35, 120, 75], i, linCfg);
        });
        (pack.descontos || []).forEach(function (item, i) {
            yD = pdfHoleriteLinhaItem(doc, yD, meio + gapCol / 2, colW, item.label, formatarMoeda(item.valor), [190, 65, 65], i, linCfg);
        });

        y = Math.max(yP, yD) + 2;
        doc.setDrawColor(210, 215, 220);
        doc.line(meio, yColsTop, meio, y);
        doc.setFillColor(238, 242, 246);
        doc.rect(margem, y, largura, 9, 'F');
        y += 6;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(26, 42, 67);
        doc.text('Total proventos', margem + 3, y);
        doc.setTextColor(35, 110, 70);
        doc.text(formatarMoeda(pack.totalProventos), margem + colW - 2, y, { align: 'right' });
        doc.setTextColor(26, 42, 67);
        doc.text('Total descontos', meio + 5, y);
        doc.setTextColor(190, 65, 65);
        doc.text(formatarMoeda(pack.totalDescontos), margem + largura - 3, y, { align: 'right' });

        y += 11;
        const corLiq = pack.liquidoNegativo ? [192, 43, 43] : [26, 42, 67];
        const liqH = 15;
        doc.setFillColor(corLiq[0], corLiq[1], corLiq[2]);
        doc.roundedRect(margem, y, largura, liqH, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        const lblLiq = pack.liquidoNegativo ? 'SALDO NEGATIVO' : 'LÍQUIDO A RECEBER';
        doc.text(lblLiq, margem + 6, y + 9.5);
        doc.setFontSize(14);
        doc.text(formatarMoeda(pack.liquido), margem + largura - 6, y + 10, { align: 'right' });
        y += liqH + 5;

        const temPlus = pack.ajudaCustoTotal > 0 || (pack.ajudaCustoItens && pack.ajudaCustoItens.length);
        if (temPlus && y < FOOTER_Y - 20) {
            y = pdfHoleriteSecaoBarra(doc, y, 'RECEBIMENTOS PLUS (fora do líquido)', [13, 110, 253], largura, margem);
            doc.setFontSize(7.5);
            doc.setTextColor(75, 75, 75);
            doc.text('Pagamento adicional — não compõe o líquido.', margem + 2, y);
            y += 5;
            y = pdfHoleriteLinhaItem(doc, y, margem, largura, 'Ajuda de custo — total PLUS', formatarMoeda(pack.ajudaCustoTotal || 0), [13, 90, 200], 0, linCfg);

            const itensPlus = pack.ajudaCustoItens || [];
            if (itensPlus.length && y < FOOTER_Y - 12) {
                const rowH = 6;
                const maxRows = Math.max(1, Math.min(itensPlus.length, Math.floor((FOOTER_Y - y - 10) / rowH)));
                const bodyAj = itensPlus.slice(0, maxRows).map(function (it) {
                    const disc = pdfHoleriteLabelResumido(it.discriminacao, 55);
                    const val = it.valor_fmt ? ('R$ ' + it.valor_fmt) : formatarMoeda(it.valor);
                    return [it.data || '', val, disc];
                });
                if (itensPlus.length > maxRows) {
                    bodyAj.push(['…', '…', '+' + (itensPlus.length - maxRows) + ' lanç. (ver sistema)']);
                }
                doc.autoTable({
                    startY: y,
                    head: [['Data', 'Valor', 'Discriminação']],
                    body: bodyAj,
                    theme: 'striped',
                    pageBreak: 'avoid',
                    rowPageBreak: 'avoid',
                    showFoot: 'never',
                    styles: {
                        fontSize: 7.5,
                        cellPadding: 2,
                        textColor: [45, 45, 45],
                        overflow: 'linebreak'
                    },
                    headStyles: { fillColor: [26, 42, 67], fontSize: 7.5, cellPadding: 2.5 },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                    margin: { left: margem, right: margem, bottom: pageH - FOOTER_Y + 4 },
                    tableWidth: largura,
                    columnStyles: {
                        0: { cellWidth: 22 },
                        1: { cellWidth: 28, halign: 'right' },
                        2: { cellWidth: 'auto' }
                    }
                });
                y = Math.min(doc.lastAutoTable.finalY + 3, FOOTER_Y - 2);
            }
        }

        while (doc.internal.getNumberOfPages() > 1) {
            doc.deletePage(doc.internal.getNumberOfPages());
        }

        pdfHoleriteRodapeFixo(doc, margem, largura, FOOTER_Y);

        const safeNome = String(pack.funcionarioNome || 'funcionario').replace(/[^\w\u00C0-\u024F\s-]/gi, '').replace(/\s+/g, '_');
        const safeRef = String(pack.mesAnoRef || '').replace(/\//g, '-');
        doc.save('holerite_' + safeNome + '_' + safeRef + '.pdf');
    };
