/* js/modulos/vales.js — edite este arquivo para alterar só este módulo */
    async function obterDadosValePorId(id) {
        if (window.valesEncontrados && window.valesEncontrados[id]) {
            return window.valesEncontrados[id];
        }
        const snap = await getDoc(doc(db, 'vales_sistema', id));
        if (!snap.exists()) return null;
        const dados = { id: snap.id, ...snap.data() };
        window.valesEncontrados = window.valesEncontrados || {};
        window.valesEncontrados[id] = dados;
        return dados;
    }

    function preencherAreaPdfReciboVale(dados) {
        const horaPDF = dados.hora_criacao ? ` às ${dados.hora_criacao}` : '';
        document.getElementById('pdf-empresa-nome').innerText = dados.empresa_id || 'Empresa';
        document.getElementById('pdf-data').innerText = 'Data: ' + (dados.data_criacao || dados.data || '') + horaPDF;
        document.getElementById('pdf-texto').innerHTML = dados.texto || '';
        const imgAss = document.getElementById('pdf-assinatura');
        if (dados.assinatura) {
            imgAss.src = dados.assinatura;
            imgAss.style.display = 'block';
        } else {
            imgAss.removeAttribute('src');
            imgAss.style.display = 'none';
        }
        document.getElementById('pdf-nome-ass').innerText = dados.nome || '';
    }

    function nomeArquivoReciboVale(dados, prefixo) {
        const dataLimpa = String(dados.data_criacao || dados.data || 'sem-data').replace(/\//g, '-');
        const nomeLimpo = String(dados.nome || 'funcionario').replace(/\s+/g, '_');
        return `${prefixo || 'Recibo'}_${nomeLimpo}_${dataLimpa}.pdf`;
    }

    async function criarPdfReciboValeBlob(dados) {
        preencherAreaPdfReciboVale(dados);
        await new Promise((r) => setTimeout(r, 500));
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const element = document.getElementById('area-pdf-escondida');
        const canvasImg = await html2canvas(element, { scale: 2, useCORS: true });
        const imgData = canvasImg.toDataURL('image/jpeg');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvasImg.height * pdfWidth) / canvasImg.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        const blob = pdf.output('blob');
        return {
            blob,
            url: URL.createObjectURL(blob),
            nomeArquivo: nomeArquivoReciboVale(dados, 'Recibo')
        };
    }

    function htmlPreviewReciboVale(dados) {
        const assinado = typeof valeContaComoDescontoFolha === 'function' ? valeContaComoDescontoFolha(dados) : String(dados.status || '').toLowerCase() === 'assinado';
        const manual = typeof valeEhAssinaturaManual === 'function' ? valeEhAssinaturaManual(dados) : false;
        const hora = dados.hora_criacao ? ` às ${dados.hora_criacao}` : '';
        const rotuloStatus = !assinado ? 'Pendente' : (manual ? 'Lançado no holerite (papel)' : 'Assinado');
        const assHtml = assinado && dados.assinatura
            ? `<div style="margin-top:18px;text-align:center;"><img src="${dados.assinatura}" alt="Assinatura" style="max-height:120px;border:1px solid #ddd;border-radius:8px;background:#fff;padding:6px;"><div style="margin-top:8px;font-weight:700;color:#1a2a43;">${escapeHtmlBasico(dados.nome || '')}</div><div style="font-size:12px;color:#666;">Assinatura digital do funcionário</div></div>`
            : (assinado && manual
                ? `<p style="margin-top:16px;padding:10px;background:#eef9f0;border:1px solid #28a745;border-radius:8px;color:#155724;font-weight:700;">📝 Vale lançado no holerite. Assinatura em papel.</p>`
                : `<p style="margin-top:16px;padding:10px;background:#fff3cd;border:1px solid #ffc107;border-radius:8px;color:#856404;font-weight:700;">⏳ Recibo ainda sem assinatura do funcionário.</p>`);
        return `
            <div style="text-align:left;font-size:13px;line-height:1.5;">
                <div style="text-align:center;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid #1a2a43;">
                    <b style="color:#1a2a43;font-size:15px;">${escapeHtmlBasico(dados.empresa_id || 'Empresa')}</b><br>
                    <span style="font-size:12px;color:#666;">Recibo oficial — ${rotuloStatus}</span>
                </div>
                <div style="font-size:12px;color:#666;margin-bottom:10px;"><b>Data:</b> ${escapeHtmlBasico((dados.data_criacao || dados.data || '') + hora)}</div>
                <div style="font-size:12px;margin-bottom:8px;"><b>Tipo:</b> ${escapeHtmlBasico(dados.tipo || '')} &nbsp;|&nbsp; <b>Valor:</b> R$ ${escapeHtmlBasico(String(dados.valor || '0'))}</div>
                <div style="font-size:13px;color:#333;text-align:justify;margin:12px 0;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e0e6ed;">${dados.texto || ''}</div>
                ${assinado ? `<div style="font-size:12px;color:#666;"><b>Descrição:</b> ${escapeHtmlBasico(dados.descricao || '')}</div>` : ''}
                ${assHtml}
            </div>
        `;
    }

    window.abrirReciboValeTela = async function (id) {
        try {
            const dados = await obterDadosValePorId(id);
            if (!dados) return Swal.fire('Erro', 'Recibo não encontrado.', 'error');
            await Swal.fire({
                title: 'Recibo do vale',
                html: htmlPreviewReciboVale(dados),
                width: 680,
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: '📥 Baixar PDF',
                denyButtonText: '📄 Abrir PDF',
                cancelButtonText: 'Fechar',
                confirmButtonColor: '#1a2a43',
                denyButtonColor: '#217346',
                cancelButtonColor: '#6c757d'
            }).then(async (result) => {
                if (result.isConfirmed) await window.baixarReciboValePdf(id);
                else if (result.isDenied) await window.visualizarReciboValePdf(id);
            });
        } catch (e) {
            Swal.fire('Erro', 'Não foi possível abrir o recibo.', 'error');
        }
    };

    window.visualizarReciboValePdf = async function (id) {
        Swal.fire({ title: 'Gerando PDF...', allowOutsideClick: false });
        Swal.showLoading();
        try {
            const dados = await obterDadosValePorId(id);
            if (!dados) return Swal.fire('Erro', 'Recibo não encontrado.', 'error');
            const pdf = await criarPdfReciboValeBlob(dados);
            Swal.close();
            const novaAba = window.open(pdf.url, '_blank');
            if (!novaAba) {
                return Swal.fire('Atenção', 'O navegador bloqueou a nova aba. Use "Baixar PDF".', 'warning');
            }
            setTimeout(() => URL.revokeObjectURL(pdf.url), 120000);
        } catch (e) {
            Swal.fire('Erro', 'Falha ao gerar o PDF para visualização.', 'error');
        }
    };

    window.baixarReciboValePdf = async function (id) {
        Swal.fire({ title: 'Gerando PDF...', allowOutsideClick: false });
        Swal.showLoading();
        try {
            const dados = await obterDadosValePorId(id);
            if (!dados) return Swal.fire('Erro', 'Recibo não encontrado.', 'error');
            const pdf = await criarPdfReciboValeBlob(dados);
            const link = document.createElement('a');
            link.href = pdf.url;
            link.download = pdf.nomeArquivo;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(pdf.url), 5000);
            Swal.fire('Baixado!', 'O recibo foi salvo no seu dispositivo.', 'success');
        } catch (e) {
            Swal.fire('Erro', 'Falha ao gerar o PDF.', 'error');
        }
    };

    window.compartilharReciboValeWhats = async function (id) {
        const dados = await obterDadosValePorId(id);
        if (!dados) return Swal.fire('Erro', 'Recibo não encontrado.', 'error');
        Swal.fire({ title: 'Gerando PDF...', allowOutsideClick: false });
        Swal.showLoading();
        try {
            const pdf = await criarPdfReciboValeBlob(dados);
            const empresaLogada = dados.empresa_id || 'Empresa';
            const file = new File([pdf.blob], pdf.nomeArquivo, { type: 'application/pdf' });
            const msg = `*${empresaLogada}*\n\nOlá ${dados.nome}, anexo a sua via do recibo.`;
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Recibo', text: msg });
                Swal.close();
                return;
            }
            const link = document.createElement('a');
            link.href = pdf.url;
            link.download = pdf.nomeArquivo;
            document.body.appendChild(link);
            link.click();
            link.remove();
            Swal.fire('PDF baixado', 'Abrindo WhatsApp para enviar o arquivo.', 'info').then(() => {
                const tel = dados.tel || (window.listaFuncionarios && window.listaFuncionarios[dados.funcionario_id] && window.listaFuncionarios[dados.funcionario_id].tel);
                if (tel) {
                    window.open(`https://api.whatsapp.com/send?phone=55${tel}&text=${encodeURIComponent(msg)}`, '_blank');
                }
            });
        } catch (e) {
            Swal.fire('Erro', 'Falha ao preparar o envio.', 'error');
        }
    };

    window.gerarEnviarPDF = async function(id) {
        await window.abrirReciboValeTela(id);
    };

    let signaturePad;
    
    function resizeCanvas() {
        const canvas = document.getElementById('signature-pad');
        
        if (canvas) {
            let data = null; 
            
            if (signaturePad && !signaturePad.isEmpty()) { 
                data = signaturePad.toData(); 
            }
            
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio; 
            canvas.height = canvas.offsetHeight * ratio; 
            canvas.getContext("2d").scale(ratio, ratio);
            
            if (signaturePad) { 
                signaturePad.clear(); 
                if (data) { 
                    signaturePad.fromData(data); 
                } 
            }
        }
    }
    
    window.addEventListener("resize", resizeCanvas); 
    window.addEventListener("orientationchange", () => setTimeout(resizeCanvas, 200));

    async function carregarValeParaAssinatura(id) {
        try {
            const docRef = doc(db, "vales_sistema", id); 
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const dados = docSnap.data();
                
                if (typeof valeContaComoDescontoFolha === 'function' ? valeContaComoDescontoFolha(dados) : dados.status === 'assinado') { 
                    const txtManual = (typeof valeEhAssinaturaManual === 'function' && valeEhAssinaturaManual(dados)) ? 'Vale lançado no holerite (assinatura em papel).' : 'Documento assinado!';
                    document.getElementById('tela-funcionario').innerHTML = `<div style="text-align:center; padding: 40px;"><img src="https://i.postimg.cc/zDRJMSTn/69420f5a-5b80-457e-8146-00485162d7f2.jpg" style="max-width:150px; margin-bottom:20px;"><h3 style="color:#28a745;">✅ ${txtManual}</h3></div>`; 
                    return; 
                }
                
                document.getElementById('f-data').innerText = "Gerado em: " + (dados.data_criacao || ""); 
                document.getElementById('f-texto').innerHTML = dados.texto; 
                
                setTimeout(() => { 
                    const canvas = document.getElementById('signature-pad'); 
                    if (canvas) { 
                        signaturePad = new SignaturePad(canvas, { penColor: "#1a2a43", minWidth: 0.5, maxWidth: 1.5 }); 
                        resizeCanvas(); 
                    } 
                }, 400); 
                
            } else { 
                document.getElementById('tela-funcionario').innerHTML = `<h3 style="text-align:center; color:#d9534f; padding: 40px;">Link inválido.</h3>`; 
            }
        } catch(e) {
            console.error("Erro ao carregar recibo", e);
        }
    }

    window.limpar = function() { 
        if (signaturePad) {
            signaturePad.clear(); 
        }
    }

    document.getElementById('btnAssinar').onclick = async function() {
        if (!signaturePad || signaturePad.isEmpty()) {
            return Swal.fire('Atenção', 'Por favor, assine no quadro em branco antes de confirmar.', 'warning');
        }
        
        const btn = document.getElementById('btnAssinar'); 
        btn.innerText = "⏳ A GUARDAR..."; 
        btn.disabled = true;
        
        try {
            const assinaturaImg = signaturePad.toDataURL('image/png');
            const agoraAss = new Date();
            const dataAssinatura = `${String(agoraAss.getDate()).padStart(2, '0')}/${String(agoraAss.getMonth() + 1).padStart(2, '0')}/${agoraAss.getFullYear()}`;
            const horaAssinatura = String(agoraAss.getHours()).padStart(2, '0') + ':' + String(agoraAss.getMinutes()).padStart(2, '0');
            await updateDoc(doc(db, "vales_sistema", valeId), { 
                assinatura: assinaturaImg, 
                status: "assinado",
                data_assinatura: dataAssinatura,
                hora_assinatura: horaAssinatura,
                timestamp_assinatura: agoraAss.getTime()
            });
            
            Swal.fire({ 
                title: 'Assinado!', 
                text: 'Registado com sucesso.', 
                icon: 'success', 
                allowOutsideClick: false, 
                confirmButtonColor: '#1a2a43' 
            }).then(() => { 
                document.getElementById('tela-funcionario').innerHTML = `<div style="text-align:center; padding: 40px;"><img src="https://i.postimg.cc/zDRJMSTn/69420f5a-5b80-457e-8146-00485162d7f2.jpg" style="max-width:150px; margin-bottom:20px;"><h3 style="color:#1a2a43;">✅ Assinatura Concluída!</h3></div>`; 
            });
            
        } catch(e) { 
            Swal.fire('Erro', 'Tente assinar novamente.', 'error'); 
            btn.innerText = "CONFIRMAR E ASSINAR"; 
            btn.disabled = false; 
        }
    };

// ==========================================
    // MÓDULO: HOLERITE PARA ASSINATURA (+ SELFIE)
    // ==========================================

    let signaturePadHolerite = null;
    let streamCameraHolerite = null;
