/* js/api/anexos.js — edite este arquivo para alterar só este módulo */
    function montarDataIsoDiaMesAno(dia, mes, ano) {
        const d = parseInt(String(dia || '').trim(), 10);
        const m = parseInt(String(mes || '').trim(), 10);
        const y = parseInt(String(ano || '').trim(), 10);
        if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) return null;
        if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
        const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (parseDataVencimentoParaTimestamp(iso) == null) return null;
        return iso;
    }

    const ATESTADO_MAX_B64 = 900000;
    const COLECAO_ATESTADOS_FUNC = 'funcionario_atestados';

    function desenharDocumentoTextoNoCanvas(source, maxLado, qualidade) {
        const limite = Math.max(800, Number(maxLado) || 2200);
        const q = qualidade != null ? qualidade : 0.92;
        let width = source.width || 1;
        let height = source.height || 1;
        const maior = Math.max(width, height);
        if (maior > limite) {
            const escala = limite / maior;
            width = Math.round(width * escala);
            height = Math.round(height * escala);
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', q);
    }

    async function carregarBitmapComOrientacao(file) {
        if (typeof createImageBitmap === 'function') {
            try {
                return await createImageBitmap(file, { imageOrientation: 'from-image' });
            } catch (_) {}
        }
        const dataUrl = await new Promise(function (resolve, reject) {
            const r = new FileReader();
            r.onload = function () { resolve(String(r.result || '')); };
            r.onerror = function () { reject(new Error('leitura')); };
            r.readAsDataURL(file);
        });
        return await new Promise(function (resolve, reject) {
            const img = new Image();
            img.onload = function () { resolve(img); };
            img.onerror = function () { reject(new Error('imagem')); };
            img.src = dataUrl;
        });
    }

    /** Foto/PDF de atestado: alta qualidade, proporção original, letras nítidas. */
    async function comprimirArquivoAtestadoParaBase64(file) {
        if (!file) return null;
        const nome = file.name || 'atestado';
        const ehPdf = file.type === 'application/pdf' || /\.pdf$/i.test(nome);
        const maxB64 = Math.min(typeof DOC_FIRESTORE_MAX_B64 === 'number' ? DOC_FIRESTORE_MAX_B64 : ATESTADO_MAX_B64, 850000);
        if (ehPdf) {
            const maxRaw = typeof DOC_PDF_MAX_FIRESTORE_RAW === 'number' ? DOC_PDF_MAX_FIRESTORE_RAW : 750000;
            if (file.size > maxRaw) throw new Error('pdf-grande');
            const b64 = await new Promise(function (resolve, reject) {
                const r = new FileReader();
                r.onload = function () { resolve(String(r.result || '')); };
                r.onerror = function () { reject(new Error('leitura')); };
                r.readAsDataURL(file);
            });
            if (b64.length > maxB64) throw new Error('pdf-grande');
            return { dataUrl: b64, tipo: 'pdf', nome: nome };
        }
        const bmp = await carregarBitmapComOrientacao(file);
        const tentativas = [
            { lado: 2200, q: 0.92 },
            { lado: 2000, q: 0.90 },
            { lado: 1800, q: 0.88 },
            { lado: 1600, q: 0.85 }
        ];
        let dataUrl = '';
        try {
            for (let i = 0; i < tentativas.length; i++) {
                dataUrl = desenharDocumentoTextoNoCanvas(bmp, tentativas[i].lado, tentativas[i].q);
                if (dataUrl.length <= maxB64) break;
            }
        } finally {
            if (bmp && typeof bmp.close === 'function') {
                try { bmp.close(); } catch (_) {}
            }
        }
        if (!dataUrl || dataUrl.length > maxB64) throw new Error('img-grande');
        return { dataUrl: dataUrl, tipo: 'img', nome: nome };
    }
    window.comprimirArquivoAtestadoParaBase64 = comprimirArquivoAtestadoParaBase64;

    async function salvarAnexoAtestadoFuncionario(funcId, packed, empresaId) {
        if (!funcId || !packed || !packed.dataUrl) return;
        await setDoc(doc(db, COLECAO_ATESTADOS_FUNC, funcId), {
            funcionario_id: funcId,
            empresa_id: empresaId || getEmpresaGestor() || '',
            arquivo: packed.dataUrl,
            nome: packed.nome || 'atestado',
            tipo: packed.tipo === 'pdf' ? 'pdf' : 'img',
            atualizado_em: Date.now()
        });
    }
    window.salvarAnexoAtestadoFuncionario = salvarAnexoAtestadoFuncionario;

    async function apagarAnexoAtestadoFuncionario(funcId) {
        if (!funcId) return;
        try { await deleteDoc(doc(db, COLECAO_ATESTADOS_FUNC, funcId)); } catch (_) {}
    }
    window.apagarAnexoAtestadoFuncionario = apagarAnexoAtestadoFuncionario;

    window.visualizarAtestadoFuncionario = async function (funcId) {
        if (!funcId) return;
        try {
            const snap = await getDoc(doc(db, COLECAO_ATESTADOS_FUNC, funcId));
            if (!snap.exists()) {
                return Swal.fire('Atenção', 'Este funcionário ainda não tem atestado anexado.', 'info');
            }
            const d = snap.data() || {};
            const func = (window.listaFuncionarios && window.listaFuncionarios[funcId]) || {};
            const titulo = 'Atestado médico' + (func.nome ? ' — ' + func.nome : '');
            if (typeof window.abrirVisualizadorDocumento === 'function') {
                window.abrirVisualizadorDocumento(d.arquivo, titulo, d.tipo === 'pdf' ? 'pdf' : 'img');
            }
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível abrir o atestado.', 'error');
        }
    };

    /** Comprime anexo (recibo/comprovante) mantendo texto legível — lado maior até 1600px, JPEG ~82%. */
    function comprimirImagemAnexoLegivelFromImg(img, maxLado, qualidade) {
        const limite = maxLado || 1600;
        const q = qualidade != null ? qualidade : 0.82;
        let width = img.width;
        let height = img.height;
        const maior = Math.max(width, height);
        if (maior > limite) {
            const escala = limite / maior;
            width = Math.round(width * escala);
            height = Math.round(height * escala);
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', q);
    }

    document.getElementById('d-anexo').addEventListener('change', function(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                document.getElementById('d-anexo-base64').value = comprimirImagemAnexoLegivelFromImg(img);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('rd-anexo').addEventListener('change', function(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const elB64 = document.getElementById('rd-anexo-base64');
                if (elB64) elB64.value = comprimirImagemAnexoLegivelFromImg(img);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    const CODIGO_BAIXA_SEM_COMPROVANTE = '0308';

    function dataPagamentoHojeBr() {
        const hoje = new Date();
        return `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
    }

    function comprimirArquivoImagemParaBase64(file) {
        return new Promise((resolve, reject) => {
            if (!file) return resolve('');
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        resolve(comprimirImagemAnexoLegivelFromImg(img));
                    } catch (err) {
                        reject(err);
                    }
                };
                img.onerror = () => reject(new Error('imagem'));
                img.src = event.target.result;
            };
            reader.onerror = () => reject(new Error('leitura'));
            reader.readAsDataURL(file);
        });
    }

    function formatarValorInputMoeda(n) {
        return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function htmlModalBaixaComprovante(opts) {
        const titulo = (opts && opts.titulo) || 'Para dar baixa, anexe o <b>comprovante de pagamento</b> (foto, print, recibo do banco ou <b>PDF</b>).';
        const mostrarValor = !(opts && opts.mostrarValorPago === false);
        const valorSug = (opts && opts.valorPagoSugerido != null && Number.isFinite(Number(opts.valorPagoSugerido)))
            ? Number(opts.valorPagoSugerido)
            : null;
        const valorHtml = mostrarValor
            ? ''
                + '<div style="margin:0 0 14px 0;padding:10px;background:#f0f9ff;border:1px solid #bee5eb;border-radius:8px;">'
                + '<label style="font-weight:700;display:block;margin-bottom:6px;color:#1a2a43;">Valor pago (R$)</label>'
                + '<input type="text" id="swal-valor-pago" inputmode="decimal" placeholder="0,00" value="'
                + (valorSug != null ? escapeAttrBasico(formatarValorInputMoeda(valorSug)) : '')
                + '" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;font-size:15px;font-weight:700;background:#fff;">'
                + '<p style="margin:6px 0 0;font-size:11px;color:#0c5460;line-height:1.4;">Pode alterar se pagou <b>com juros</b> ou valor diferente do saldo. O valor lançado é o que realmente saiu da conta.</p>'
                + '</div>'
            : '';
        return `
            <div style="text-align:left;font-size:13px;margin-top:12px;padding-top:12px;border-top:2px solid #17a2b8;">
                <p style="margin:0 0 10px;color:#1a2a43;line-height:1.45;font-weight:700;">📎 Comprovante obrigatório</p>
                <p style="margin:0 0 10px;color:#555;line-height:1.45;">${titulo}</p>
                ${valorHtml}
                <label style="font-weight:700;display:block;margin-bottom:6px;">Comprovante de pagamento</label>
                <input type="file" id="swal-comprovante-pgto" accept="image/*,application/pdf,.pdf" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;background:#fff;">
                <p style="margin:6px 0 0;font-size:11px;color:#888;">Aceita imagem (JPG/PNG) ou PDF. PDF até ~750 KB.</p>
                <div id="swal-prev-comprovante" style="margin-top:8px;display:none;text-align:center;">
                    <img id="swal-prev-comprovante-img" alt="Pré-visualização" style="max-width:100%;max-height:120px;border-radius:8px;border:1px solid #ddd;display:none;">
                    <div id="swal-prev-comprovante-pdf" style="display:none;padding:12px;background:#eef2f5;border:1px solid #d0d7de;border-radius:8px;">
                        <div style="font-size:28px;line-height:1;">📄</div>
                        <div id="swal-prev-comprovante-pdf-nome" style="font-size:12px;font-weight:700;color:#1a2a43;margin-top:4px;word-break:break-word;"></div>
                        <button type="button" id="swal-prev-comprovante-ver" style="margin-top:8px;background:#217346;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;">👁 Ver PDF anexado</button>
                    </div>
                </div>
                <p style="margin:14px 0 6px;font-size:12px;color:#888;border-top:1px solid #eee;padding-top:10px;">Sem comprovante? Informe o código de autorização:</p>
                <input type="password" id="swal-codigo-baixa" placeholder="Código (somente se não tiver comprovante)" maxlength="10" class="swal2-input" style="margin:0;width:100%;height:40px;font-size:14px;">
            </div>
        `;
    }

    function ehAnexoPdfDataUrl(dataUrl) {
        const s = String(dataUrl || '');
        return s.startsWith('data:application/pdf') || /mime=application\/pdf/i.test(s);
    }

    function configurarModalBaixaComprovante() {
        window._swalComprovantePgtoBase64 = '';
        const input = document.getElementById('swal-comprovante-pgto');
        const prev = document.getElementById('swal-prev-comprovante');
        const prevImg = document.getElementById('swal-prev-comprovante-img');
        const prevPdf = document.getElementById('swal-prev-comprovante-pdf');
        const prevPdfNome = document.getElementById('swal-prev-comprovante-pdf-nome');
        const btnVerPdf = document.getElementById('swal-prev-comprovante-ver');
        const codigo = document.getElementById('swal-codigo-baixa');
        const inpValor = document.getElementById('swal-valor-pago');
        if (inpValor && typeof mascaraMoeda === 'function') {
            inpValor.addEventListener('input', function () { mascaraMoeda(inpValor); });
            inpValor.focus();
            try { inpValor.select(); } catch (eSel) { /* ignore */ }
        }
        if (!input) return;

        if (btnVerPdf) {
            btnVerPdf.onclick = function () {
                if (window._swalComprovantePgtoBase64) {
                    abrirFoto(window._swalComprovantePgtoBase64, prevPdfNome ? prevPdfNome.textContent : 'Comprovante PDF');
                }
            };
        }

        input.addEventListener('change', async function () {
            const f = input.files && input.files[0];
            if (!f) {
                window._swalComprovantePgtoBase64 = '';
                if (prev) prev.style.display = 'none';
                return;
            }
            const ehPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
            try {
                if (ehPdf) {
                    if (typeof DOC_PDF_MAX_FIRESTORE_RAW === 'number' && f.size > DOC_PDF_MAX_FIRESTORE_RAW) {
                        input.value = '';
                        window._swalComprovantePgtoBase64 = '';
                        if (prev) prev.style.display = 'none';
                        Swal.showValidationMessage('PDF grande demais (máx. ~750 KB). Comprima o arquivo e tente de novo.');
                        return;
                    }
                    const b64 = await new Promise(function (resolve, reject) {
                        const reader = new FileReader();
                        reader.onload = function () { resolve(String(reader.result || '')); };
                        reader.onerror = function () { reject(new Error('leitura')); };
                        reader.readAsDataURL(f);
                    });
                    if (typeof DOC_FIRESTORE_MAX_B64 === 'number' && b64.length > DOC_FIRESTORE_MAX_B64) {
                        input.value = '';
                        window._swalComprovantePgtoBase64 = '';
                        if (prev) prev.style.display = 'none';
                        Swal.showValidationMessage('PDF grande demais para salvar. Comprima o arquivo (máx. ~750 KB).');
                        return;
                    }
                    window._swalComprovantePgtoBase64 = b64;
                    if (prevImg) prevImg.style.display = 'none';
                    if (prevPdf) prevPdf.style.display = 'block';
                    if (prevPdfNome) prevPdfNome.textContent = f.name || 'comprovante.pdf';
                    if (prev) prev.style.display = 'block';
                } else {
                    window._swalComprovantePgtoBase64 = await comprimirArquivoImagemParaBase64(f);
                    if (prevPdf) prevPdf.style.display = 'none';
                    if (prevImg) {
                        prevImg.src = window._swalComprovantePgtoBase64;
                        prevImg.style.display = 'inline-block';
                        prevImg.onclick = function () {
                            abrirFoto(window._swalComprovantePgtoBase64, 'Comprovante de pagamento');
                        };
                        prevImg.title = 'Clique para ampliar';
                        prevImg.style.cursor = 'pointer';
                    }
                    if (prev) prev.style.display = 'block';
                }
                if (codigo) codigo.value = '';
            } catch (e) {
                window._swalComprovantePgtoBase64 = '';
                if (prev) prev.style.display = 'none';
                Swal.showValidationMessage(ehPdf
                    ? 'Não foi possível ler o PDF do comprovante.'
                    : 'Não foi possível ler a imagem do comprovante.');
            }
        });
    }

    function lerValorPagoModalBaixa(fallback) {
        const el = document.getElementById('swal-valor-pago');
        if (!el) {
            const fb = Number(fallback);
            return Number.isFinite(fb) ? fb : null;
        }
        const raw = String(el.value || '').replace(/R\$\s?/gi, '').trim();
        const n = parseMoedaLocal(raw || '0');
        return n;
    }

    function validarBaixaComprovantePayload(opts) {
        const comprovante = window._swalComprovantePgtoBase64 || '';
        const codigo = (document.getElementById('swal-codigo-baixa') && document.getElementById('swal-codigo-baixa').value || '').trim();
        const elValor = document.getElementById('swal-valor-pago');
        let valorPago = null;
        if (elValor) {
            valorPago = lerValorPagoModalBaixa(opts && opts.valorPagoSugerido);
            if (!(valorPago > 0)) {
                Swal.showValidationMessage('Informe o valor pago (use o saldo ou o valor com juros).');
                return false;
            }
        }

        let base = null;
        if (comprovante) {
            base = { comprovante_pagamento: comprovante, baixa_sem_comprovante: false };
        } else if (codigo === CODIGO_BAIXA_SEM_COMPROVANTE) {
            base = { comprovante_pagamento: null, baixa_sem_comprovante: true };
        } else if (codigo) {
            Swal.showValidationMessage('Código incorreto.');
            return false;
        } else {
            Swal.showValidationMessage('Anexe o comprovante (foto ou PDF) ou informe o código de autorização.');
            return false;
        }

        if (valorPago != null) {
            base.valor_pago = Math.round(valorPago * 100) / 100;
            const sug = opts && opts.valorPagoSugerido != null ? Number(opts.valorPagoSugerido) : null;
            if (sug != null && Number.isFinite(sug) && base.valor_pago > sug + 0.009) {
                base.valor_juros = Math.round((base.valor_pago - sug) * 100) / 100;
            } else {
                base.valor_juros = 0;
            }
        }
        return base;
    }

    function registrarAnexoParaViewer(dataUrl) {
        window._anexoViewerPorId = window._anexoViewerPorId || {};
        window._anexoViewerSeq = (window._anexoViewerSeq || 0) + 1;
        const id = 'anx' + window._anexoViewerSeq;
        window._anexoViewerPorId[id] = dataUrl;
        return id;
    }

    window.abrirAnexoRegistrado = function (id) {
        const url = window._anexoViewerPorId && window._anexoViewerPorId[id];
        if (!url) return Swal.fire('Atenção', 'Anexo não encontrado.', 'info');
        abrirFoto(url);
    };

    function montarHtmlComprovantePagamento(d) {
        const refParcial = (listaPagamentosParciaisDespesa(d).slice().reverse().find(function (p) {
            return p && p.comprovante_ref;
        }) || {}).comprovante_ref;
        const ref = d && (d.comprovante_ref || d.comprovante_pagamento_id || refParcial);
        if (ref) {
            const ehPdf = true;
            return '<span onclick="abrirComprovantePagamentoRef(\'' + encodeURIComponent(ref) + '\')" title="Ver comprovante" style="display:inline-flex;align-items:center;justify-content:center;width:60px;height:60px;border-radius:8px;border:2px solid #28a745;float:right;cursor:pointer;margin-left:6px;background:#e8f5e9;font-size:11px;font-weight:800;color:#155724;text-align:center;line-height:1.2;">📄<br>Ver</span>';
        }
        if (d.comprovante_pagamento) {
            const id = registrarAnexoParaViewer(d.comprovante_pagamento);
            if (ehAnexoPdfDataUrl(d.comprovante_pagamento)) {
                return '<span onclick="abrirAnexoRegistrado(\'' + id + '\')" title="Ver comprovante PDF" style="display:inline-flex;align-items:center;justify-content:center;width:60px;height:60px;border-radius:8px;border:2px solid #28a745;float:right;cursor:pointer;margin-left:6px;background:#e8f5e9;font-size:11px;font-weight:800;color:#155724;text-align:center;line-height:1.2;">📄<br>PDF</span>';
            }
            return '<img src="' + escapeAttrBasico(d.comprovante_pagamento) + '" onclick="abrirAnexoRegistrado(\'' + id + '\')" title="Comprovante de pagamento" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 2px solid #28a745; float: right; cursor: pointer; margin-left: 6px;">';
        }
        if (d.baixa_sem_comprovante) {
            return '<span style="float:right;font-size:10px;background:#fff3cd;color:#856404;padding:4px 6px;border-radius:6px;font-weight:700;margin-left:6px;">Sem comprovante</span>';
        }
        return '';
    }

    (function initRelatorioDespesaDatasPadrao() {
        const el = document.getElementById('rd-lancamento');
        if (!el || el.value) return;
        const ag = new Date();
        el.value = ag.getFullYear() + '-' + String(ag.getMonth() + 1).padStart(2, '0') + '-' + String(ag.getDate()).padStart(2, '0');
    })();
