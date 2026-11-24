/* js/modulos/documentos.js — edite este arquivo para alterar só este módulo */
    function formatarVencimentoDocExibir(item) {
        const iso = item && item.data_vencimento;
        if (iso && /^\d{4}-\d{2}-\d{2}$/.test(String(iso))) {
            const p = String(iso).split('-');
            return p[2] + '/' + p[1] + '/' + p[0];
        }
        const ts = item && item.data_vencimento_ts;
        if (ts != null && Number.isFinite(Number(ts))) {
            const dt = new Date(Number(ts));
            return String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0') + '/' + dt.getFullYear();
        }
        return '—';
    }

    function tsVencimentoDocumentoPessoal(item) {
        if (!item) return null;
        if (item.data_vencimento_ts != null && Number.isFinite(Number(item.data_vencimento_ts))) {
            return Number(item.data_vencimento_ts);
        }
        return parseDataVencimentoParaTimestamp(item.data_vencimento);
    }

    window._documentosPessoaisCache = window._documentosPessoaisCache || {};
    window._documentosPessoaisArquivoCache = window._documentosPessoaisArquivoCache || {};
    window._documentosEmpresaFetchPromise = null;
    window._documentosEmpresaFetchEmpresa = null;
    window._documentosEmpresaFetchTs = 0;

    function invalidarCacheDocumentosPessoaisEmpresa() {
        window._documentosEmpresaFetchPromise = null;
        window._documentosEmpresaFetchEmpresa = null;
        window._documentosEmpresaFetchTs = 0;
        window._documentosPessoaisArquivoCache = {};
        PASTAS_DOCUMENTOS.forEach((p) => { window._documentosPessoaisCache[p] = []; });
    }

    window.invalidarCacheDocumentosPessoaisEmpresa = invalidarCacheDocumentosPessoaisEmpresa;

    function metaDocumentoPessoalFromSnap(docSnap) {
        const d = docSnap.data();
        const id = docSnap.id;
        const pasta = String(d.pasta || '');
        const arquivo = d.arquivo || '';
        if (arquivo) window._documentosPessoaisArquivoCache[id] = arquivo;
        return {
            id,
            nome: d.nome || '',
            mime: d.mime || '',
            thumb: d.thumb || '',
            storage_path: d.storage_path || '',
            data_vencimento: d.data_vencimento || '',
            data_vencimento_ts: d.data_vencimento_ts != null ? d.data_vencimento_ts : null,
            data_cadastro: d.data_cadastro || '',
            pasta,
            tem_arquivo: Boolean(arquivo),
            grupo_pdf: d.grupo_pdf || '',
            nome_contrato: d.nome_contrato || '',
            nome_original: d.nome_original || '',
            parte_indice: d.parte_indice != null ? d.parte_indice : null,
            parte_total: d.parte_total != null ? d.parte_total : null,
            pagina_inicio: d.pagina_inicio != null ? d.pagina_inicio : null,
            pagina_fim: d.pagina_fim != null ? d.pagina_fim : null
        };
    }

    async function fetchDocumentosPessoaisEmpresa(empresaId, opts) {
        const force = opts && opts.force;
        const agora = Date.now();
        const cacheValido = !force
            && window._documentosEmpresaFetchEmpresa === empresaId
            && window._documentosEmpresaFetchPromise
            && window._documentosEmpresaFetchTs
            && (agora - window._documentosEmpresaFetchTs < 300000);

        if (cacheValido) {
            return window._documentosEmpresaFetchPromise;
        }

        if (!force
            && window._documentosEmpresaFetchPromise
            && window._documentosEmpresaFetchEmpresa === empresaId
            && !window._documentosEmpresaFetchTs) {
            return window._documentosEmpresaFetchPromise;
        }

        window._documentosEmpresaFetchEmpresa = empresaId;
        window._documentosEmpresaFetchTs = 0;
        window._documentosPessoaisArquivoCache = {};
        const byPasta = {};
        PASTAS_DOCUMENTOS.forEach((p) => { byPasta[p] = []; });

        window._documentosEmpresaFetchPromise = (async () => {
            await ensureAuth();
            const q = query(collection(db, COLECAO_DOCUMENTOS_PESSOAIS), where('empresa_id', '==', empresaId));
            const snap = await getDocs(q);
            const todosMeta = [];
            snap.forEach((docSnap) => {
                const meta = metaDocumentoPessoalFromSnap(docSnap);
                todosMeta.push(meta);
                let pastaKey = meta.pasta;
                // Legado: pasta "contratos" → Contratos Ativos
                if (pastaKey === 'contratos') pastaKey = 'contratos_ativos';
                if (byPasta[pastaKey]) byPasta[pastaKey].push(meta);
            });
            PASTAS_DOCUMENTOS.forEach((p) => {
                byPasta[p].sort((a, b) => String(b.data_cadastro || '').localeCompare(String(a.data_cadastro || '')));
                window._documentosPessoaisCache[p] = byPasta[p];
            });
            window._documentosEmpresaFetchTs = Date.now();
            return { byPasta, todosMeta };
        })();

        return window._documentosEmpresaFetchPromise;
    }

    async function obterDocumentoPessoalCompleto(id, pasta) {
        const meta = buscarDocumentoPessoalCache(id, pasta);
        let arquivo = window._documentosPessoaisArquivoCache[id];
        if (meta && arquivo) return Object.assign({}, meta, { arquivo });

        try {
            await ensureAuth();
            const snap = await getDoc(doc(db, COLECAO_DOCUMENTOS_PESSOAIS, id));
            if (!snap.exists()) return null;
            const d = snap.data();
            arquivo = d.arquivo || '';
            if (arquivo) window._documentosPessoaisArquivoCache[id] = arquivo;
            return {
                id: snap.id,
                nome: d.nome || '',
                arquivo,
                mime: d.mime || '',
                thumb: d.thumb || '',
                pasta: d.pasta || pasta || '',
                data_vencimento: d.data_vencimento || '',
                data_vencimento_ts: d.data_vencimento_ts != null ? d.data_vencimento_ts : null,
                data_cadastro: d.data_cadastro || '',
                tem_arquivo: Boolean(arquivo)
            };
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    window.obterDocumentoPessoalCompleto = obterDocumentoPessoalCompleto;

    function formatarTamanhoArquivo(bytes) {
        const n = Number(bytes) || 0;
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
        return (n / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function urlArquivoDocumentoPessoal(item) {
        return String(item && item.arquivo || '').trim();
    }

    function nomeArquivoDocumentoSeguro(nome, ext) {
        const base = String(nome || 'documento')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[<>:"/\\|?*]+/g, '_')
            .replace(/\s+/g, '_')
            .slice(0, 80);
        return base + ext;
    }

    function buscarDocumentoPessoalCache(id, pasta) {
        const lista = window._documentosPessoaisCache[pasta] || [];
        return lista.find((d) => d.id === id) || null;
    }

    function documentoPessoalEhPdf(item) {
        const mime = String(item && item.mime || '').toLowerCase();
        const arq = urlArquivoDocumentoPessoal(item);
        return mime === 'application/pdf' || arq.startsWith('data:application/pdf') || /\.pdf(\?|$)/i.test(arq);
    }

    function limparFormDocumentoPessoal(pasta) {
        limparPartesPdfPendentes(pasta);
        const nomeEl = document.getElementById('doc-add-nome-' + pasta);
        const arqEl = document.getElementById('doc-add-arquivo-' + pasta);
        const b64El = document.getElementById('doc-add-base64-' + pasta);
        const mimeEl = document.getElementById('doc-add-mime-' + pasta);
        const vencEl = document.getElementById('doc-add-vencimento-' + pasta);
        const prevEl = document.getElementById('doc-add-preview-' + pasta);
        if (nomeEl) nomeEl.value = '';
        if (arqEl) arqEl.value = '';
        if (b64El) b64El.value = '';
        if (mimeEl) mimeEl.value = '';
        if (vencEl) vencEl.value = '';
        if (prevEl) {
            prevEl.style.display = 'none';
            prevEl.innerHTML = '';
        }
    }

    function promiseComTimeout(promise, ms, codigoErro) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(codigoErro || 'timeout'));
            }, ms);
            Promise.resolve(promise).then(
                (val) => { clearTimeout(timer); resolve(val); },
                (err) => { clearTimeout(timer); reject(err); }
            );
        });
    }

    function fecharLoadingDocumentoPessoal() {
        try {
            if (typeof Swal === 'undefined') return;
            if (typeof Swal.hideLoading === 'function') Swal.hideLoading();
            if (Swal.isVisible()) Swal.close();
        } catch (_) {}
    }

    // O SweetAlert mantém o estado de "carregando" quando um popup abre logo após
    // outro ser fechado, deixando o botão de confirmar travado.
    function esperarSwalLiberado() {
        return new Promise(function (resolve) {
            try {
                if (typeof Swal !== 'undefined') {
                    if (typeof Swal.hideLoading === 'function') Swal.hideLoading();
                    if (Swal.isVisible()) Swal.close();
                }
            } catch (_) {}
            setTimeout(resolve, 260);
        });
    }

    async function baixarArquivoDocumentoPessoal(item, nomeDownload) {
        const url = urlArquivoDocumentoPessoal(item);
        if (!url) throw new Error('sem_arquivo');
        const ehPdf = documentoPessoalEhPdf(item);
        const ext = ehPdf ? '.pdf' : '.jpg';
        const link = document.createElement('a');
        if (url.startsWith('data:')) {
            link.href = url;
        } else {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('download');
            const blob = await resp.blob();
            link.href = URL.createObjectURL(blob);
            link.dataset.revokeUrl = '1';
        }
        link.download = nomeArquivoDocumentoSeguro(nomeDownload, ext);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (link.dataset.revokeUrl === '1') {
            setTimeout(() => URL.revokeObjectURL(link.href), 5000);
        }
    }

    function comprimirImagemDocumentoPessoal(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height = Math.round(height * (MAX_WIDTH / width));
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.72));
            };
            img.onerror = () => reject(new Error('imagem'));
            img.src = dataUrl;
        });
    }

    function gerarThumbDocumentoPessoal(dataUrl) {
        return new Promise((resolve) => {
            if (!dataUrl || String(dataUrl).startsWith('data:application/pdf')) {
                resolve('');
                return;
            }
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 120;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height = Math.round(height * (MAX_WIDTH / width));
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.55));
            };
            img.onerror = () => resolve('');
            img.src = dataUrl;
        });
    }

    function uint8ParaDataUrlPdf(bytes) {
        const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
        let bin = '';
        const passo = 0x8000;
        for (let i = 0; i < u8.length; i += passo) {
            bin += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + passo, u8.length)));
        }
        return 'data:application/pdf;base64,' + btoa(bin);
    }

    function partePdfCabeNoFirestore(bytes, dataUrl) {
        return bytes && dataUrl
            && bytes.length <= DOC_PDF_MAX_FIRESTORE_RAW
            && dataUrl.length <= DOC_FIRESTORE_MAX_B64;
    }

    async function criarPdfParcialDePaginas(srcDoc, paginaInicio0, paginaFim0) {
        const { PDFDocument } = window.PDFLib;
        const novo = await PDFDocument.create();
        const idxs = [];
        for (let i = paginaInicio0; i <= paginaFim0; i++) idxs.push(i);
        const pages = await novo.copyPages(srcDoc, idxs);
        pages.forEach(function (pg) { novo.addPage(pg); });
        return await novo.save();
    }

    function respirarUI() {
        return new Promise(function (r) { setTimeout(r, 0); });
    }

    async function repartirPdfArrayBufferParaFirestore(arrayBuffer, onProgresso) {
        const avisar = typeof onProgresso === 'function' ? onProgresso : function () {};
        if (!window.PDFLib || !window.PDFLib.PDFDocument) {
            throw new Error('pdf_lib_ausente');
        }
        avisar('Lendo o PDF...');
        await respirarUI();
        const src = await window.PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const total = src.getPageCount();
        if (!total) throw new Error('pdf_vazio');

        const partes = [];
        let inicio = 0;
        while (inicio < total) {
            let lo = inicio;
            let hi = total - 1;
            let melhor = -1;
            let melhorBytes = null;
            let melhorUrl = null;

            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                avisar('Parte ' + (partes.length + 1) + ' — testando páginas ' + (inicio + 1) + ' a ' + (mid + 1) + ' de ' + total + '...');
                await respirarUI();
                const bytes = await criarPdfParcialDePaginas(src, inicio, mid);
                const dataUrl = uint8ParaDataUrlPdf(bytes);
                if (partePdfCabeNoFirestore(bytes, dataUrl)) {
                    melhor = mid;
                    melhorBytes = bytes;
                    melhorUrl = dataUrl;
                    lo = mid + 1;
                } else {
                    hi = mid - 1;
                }
            }

            if (melhor < inicio || !melhorUrl) {
                throw new Error('pagina_grande');
            }

            avisar('Parte ' + (partes.length + 1) + ' pronta (páginas ' + (inicio + 1) + ' a ' + (melhor + 1) + ').');
            await respirarUI();

            partes.push({
                data: melhorUrl,
                mime: 'application/pdf',
                tamanho: melhorBytes.length,
                paginaInicio: inicio + 1,
                paginaFim: melhor + 1
            });
            inicio = melhor + 1;
        }
        return { totalPaginas: total, partes: partes };
    }

    function limparPartesPdfPendentes(pasta) {
        if (!window._docPdfPartesPendentes) window._docPdfPartesPendentes = {};
        if (pasta) delete window._docPdfPartesPendentes[pasta];
        else window._docPdfPartesPendentes = {};
    }

    function obterPartesPdfPendentes(pasta) {
        return (window._docPdfPartesPendentes && window._docPdfPartesPendentes[pasta]) || null;
    }

    function mostrarPreviewPartesPdfDocumento(pasta, info) {
        const prevEl = document.getElementById('doc-add-preview-' + pasta);
        if (!prevEl) return;
        if (!info || !info.partes || !info.partes.length) {
            prevEl.style.display = 'none';
            prevEl.innerHTML = '';
            return;
        }
        const lista = info.partes.map(function (p, i) {
            return '<li style="margin:2px 0;"><b>Parte ' + (i + 1) + '/' + info.partes.length + '</b>'
                + ' — pág. ' + p.paginaInicio + ' a ' + p.paginaFim
                + ' (' + formatarTamanhoArquivo(p.tamanho) + ')</li>';
        }).join('');
        prevEl.innerHTML = '<div class="doc-preview-add-pdf">📄 PDF será repartido em <b>' + info.partes.length + '</b> parte(s)'
            + (info.nomeArquivo ? '<br><span style="font-size:12px;font-weight:600;">' + escapeHtmlBasico(info.nomeArquivo) + '</span>' : '')
            + '<br><span style="font-size:11px;color:#666;">Total: ' + info.totalPaginas + ' página(s)</span>'
            + '<ul style="text-align:left;margin:8px 0 0 18px;padding:0;font-size:11px;color:#334155;">' + lista + '</ul>'
            + '<span style="font-size:11px;color:#856404;">Clique em Adicionar para gravar todas as partes no Firebase.</span>'
            + '</div>';
        prevEl.style.display = 'block';
    }

    async function processarPdfGrandeDocumentoPessoal(pasta, file) {
        await esperarSwalLiberado();

        const conf = await Swal.fire({
            title: 'PDF grande',
            html: 'Este PDF tem <b>' + formatarTamanhoArquivo(file.size) + '</b> e passa do limite do Firebase (~750 KB).<br><br>'
                + 'Posso <b>repartir</b> em partes menores (ex.: 10 + 10 páginas) e salvar cada parte no sistema.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sim, repartir PDF',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1a2a43',
            allowOutsideClick: true,
            didOpen: function () {
                try { Swal.hideLoading(); } catch (_) {}
            }
        });

        if (!conf.isConfirmed) {
            const input = document.getElementById('doc-add-arquivo-' + pasta);
            if (input) input.value = '';
            return;
        }

        try {
            Swal.fire({
                title: 'Repartindo PDF...',
                html: '<span id="doc-pdf-progresso">Preparando...</span>',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                didOpen: function () { Swal.showLoading(); }
            });
            const buffer = await file.arrayBuffer();
            const resultado = await repartirPdfArrayBufferParaFirestore(buffer, function (texto) {
                const el = document.getElementById('doc-pdf-progresso');
                if (el) el.textContent = texto;
            });
            const info = {
                nomeArquivo: file.name || 'documento.pdf',
                totalPaginas: resultado.totalPaginas,
                partes: resultado.partes
            };
            if (!window._docPdfPartesPendentes) window._docPdfPartesPendentes = {};
            window._docPdfPartesPendentes[pasta] = info;

            const b64El = document.getElementById('doc-add-base64-' + pasta);
            const mimeEl = document.getElementById('doc-add-mime-' + pasta);
            if (b64El) b64El.value = '';
            if (mimeEl) mimeEl.value = 'application/pdf';
            mostrarPreviewPartesPdfDocumento(pasta, info);

            await esperarSwalLiberado();
            Swal.fire({
                icon: 'success',
                title: 'PDF repartido',
                html: 'Foram criadas <b>' + info.partes.length + '</b> parte(s) a partir de <b>' + info.totalPaginas + '</b> página(s).<br>'
                    + 'Informe o nome e clique em <b>Adicionar</b> para gravar tudo.',
                confirmButtonColor: '#1a2a43',
                didOpen: function () { try { Swal.hideLoading(); } catch (_) {} }
            });
        } catch (e) {
            console.error(e);
            limparPartesPdfPendentes(pasta);
            const input = document.getElementById('doc-add-arquivo-' + pasta);
            if (input) input.value = '';
            let msg = 'Não foi possível repartir este PDF.';
            if (e && e.message === 'pdf_lib_ausente') {
                msg = 'Biblioteca de PDF não carregou. Recarregue a página (Ctrl+F5).';
            } else if (e && e.message === 'pagina_grande') {
                msg = 'Há página(s) individuais grandes demais (~750 KB). Comprima o PDF ou tire foto da página.';
            } else if (e && e.message === 'pdf_vazio') {
                msg = 'O PDF não tem páginas.';
            }
            await esperarSwalLiberado();
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: msg,
                confirmButtonColor: '#1a2a43',
                didOpen: function () { try { Swal.hideLoading(); } catch (_) {} }
            });
        }
    }

    function lerArquivoDocumentoPessoal(file, pasta) {
        return new Promise((resolve, reject) => {
            if (!file) return reject(new Error('vazio'));

            if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) {
                if (file.size > DOC_PDF_MAX_FIRESTORE_RAW) {
                    const err = new Error('arquivo_grande');
                    err.file = file;
                    err.ehPdf = true;
                    return reject(err);
                }
                const reader = new FileReader();
                reader.onload = function () {
                    const b64 = String(reader.result || '');
                    if (b64.length > DOC_FIRESTORE_MAX_B64) {
                        const err = new Error('arquivo_grande');
                        err.file = file;
                        err.ehPdf = true;
                        return reject(err);
                    }
                    resolve({
                        data: b64,
                        mime: 'application/pdf',
                        nomeArquivo: file.name || 'documento.pdf',
                        tamanho: file.size
                    });
                };
                reader.onerror = () => reject(new Error('leitura'));
                reader.readAsDataURL(file);
                return;
            }

            const reader = new FileReader();
            reader.onload = async function (event) {
                try {
                    if (file.size > DOC_PDF_MAX_FIRESTORE_RAW) {
                        return reject(new Error('arquivo_grande'));
                    }
                    const comprimido = await comprimirImagemDocumentoPessoal(event.target.result);
                    if (comprimido.length > DOC_FIRESTORE_MAX_B64) {
                        return reject(new Error('arquivo_grande'));
                    }
                    resolve({ data: comprimido, mime: 'image/jpeg', tamanho: file.size });
                } catch (e) {
                    reject(e);
                }
            };
            reader.onerror = () => reject(new Error('leitura'));
            reader.readAsDataURL(file);
        });
    }

    function mostrarPreviewDocumentoPessoal(pasta, payload) {
        limparPartesPdfPendentes(pasta);
        const prevEl = document.getElementById('doc-add-preview-' + pasta);
        if (!prevEl) return;
        if (!payload || !payload.data) {
            prevEl.style.display = 'none';
            prevEl.innerHTML = '';
            return;
        }
        if (payload.mime === 'application/pdf') {
            prevEl.innerHTML = '<div class="doc-preview-add-pdf">📄 PDF selecionado'
                + (payload.nomeArquivo ? '<br><span style="font-size:12px;font-weight:600;">' + escapeHtmlBasico(payload.nomeArquivo) + '</span>' : '')
                + (payload.tamanho ? '<br><span style="font-size:11px;color:#666;">' + formatarTamanhoArquivo(payload.tamanho) + '</span>' : '')
                + '</div>';
        } else {
            prevEl.innerHTML = '<img src="' + escapeAttrBasico(payload.data) + '" alt="Pré-visualização">';
        }
        prevEl.style.display = 'block';
    }

    function initInputsDocumentosPessoais() {
        PASTAS_DOCUMENTOS.forEach((pasta) => {
            const input = document.getElementById('doc-add-arquivo-' + pasta);
            if (!input || input.dataset.docInit === '1') return;
            input.dataset.docInit = '1';
            input.addEventListener('change', async function (e) {
                const file = e.target.files && e.target.files[0];
                const b64El = document.getElementById('doc-add-base64-' + pasta);
                const mimeEl = document.getElementById('doc-add-mime-' + pasta);
                limparPartesPdfPendentes(pasta);
                if (!file) {
                    if (b64El) b64El.value = '';
                    if (mimeEl) mimeEl.value = '';
                    mostrarPreviewDocumentoPessoal(pasta, null);
                    return;
                }
                try {
                    Swal.fire({ title: 'Processando arquivo...', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
                    const payload = await lerArquivoDocumentoPessoal(file, pasta);
                    if (b64El) b64El.value = payload.data;
                    if (mimeEl) mimeEl.value = payload.mime;
                    mostrarPreviewDocumentoPessoal(pasta, payload);
                    fecharLoadingDocumentoPessoal();
                } catch (err) {
                    if (b64El) b64El.value = '';
                    if (mimeEl) mimeEl.value = '';
                    const prevEl = document.getElementById('doc-add-preview-' + pasta);
                    if (prevEl) { prevEl.style.display = 'none'; prevEl.innerHTML = ''; }
                    fecharLoadingDocumentoPessoal();
                    const ehPdf = !!(err && (err.ehPdf || (file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')))));
                    if (err && err.message === 'arquivo_grande' && ehPdf) {
                        processarPdfGrandeDocumentoPessoal(pasta, err.file || file);
                    } else if (err && (err.message === 'arquivo_grande' || err.message === 'img_grande')) {
                        input.value = '';
                        Swal.fire('Documento grande demais', MSG_DOC_TAMANHO_MAX, 'warning');
                    } else {
                        input.value = '';
                        Swal.fire('Erro', 'Não foi possível ler o arquivo selecionado.', 'error');
                    }
                }
            });
        });
    }

    function nomePastaContratoDocumento(item) {
        const salvo = String(item && item.nome_contrato || '').trim();
        if (salvo) return salvo;
        const nome = String(item && item.nome || 'Contrato').trim();
        return nome
            .replace(/\s+—\s+parte\s+\d+\/\d+.*$/i, '')
            .replace(/\s+-\s+parte\s+\d+\/\d+.*$/i, '')
            .trim() || 'Contrato';
    }

    function htmlCardsDocumentosPessoais(pasta, itens) {
        let html = '<div class="doc-lista-grid">';
        itens.forEach((doc) => {
            const ehPdf = documentoPessoalEhPdf(doc);
            let thumb;
            if (ehPdf) {
                thumb = '<div class="doc-card-thumb-pdf">📄</div>';
            } else if (doc.thumb) {
                thumb = '<img src="' + escapeAttrBasico(doc.thumb) + '" alt="' + escapeAttrBasico(doc.nome) + '" loading="lazy" decoding="async">';
            } else {
                thumb = '<div class="doc-card-thumb-pdf" style="background:#eef2f7;color:#5a6a7a;font-size:28px;">🖼️</div>';
            }
            html += ''
                + '<div class="doc-card">'
                + '<div class="doc-card-thumb" onclick="visualizarDocumentoPessoal(\'' + doc.id + '\', \'' + pasta + '\')" title="Clique para ampliar">' + thumb + '</div>'
                + '<div class="doc-card-body">'
                + '<p class="doc-card-nome">' + escapeHtmlBasico(doc.nome || 'Documento') + '</p>'
                + (doc.parte_total
                    ? '<p class="doc-card-data" style="color:#856404;font-weight:700;">📦 PDF repartido — parte ' + escapeHtmlBasico(String(doc.parte_indice || '?')) + '/' + escapeHtmlBasico(String(doc.parte_total)) + '</p>'
                    : '')
                + '<p class="doc-card-data">Vencimento: ' + escapeHtmlBasico(formatarVencimentoDocExibir(doc)) + '</p>'
                + '<p class="doc-card-data">Cadastrado em: ' + escapeHtmlBasico(doc.data_cadastro || '—') + '</p>'
                + '</div>'
                + '<div class="doc-card-acoes">'
                + '<button type="button" class="doc-btn-ver" onclick="visualizarDocumentoPessoal(\'' + doc.id + '\', \'' + pasta + '\')">👁️ Ver</button>'
                + '<button type="button" class="doc-btn-export" onclick="exportarDocumentoPessoal(\'' + doc.id + '\', \'' + pasta + '\')">⬇️ Exportar</button>'
                + '<button type="button" class="doc-btn-print" onclick="imprimirDocumentoPessoal(\'' + doc.id + '\', \'' + pasta + '\')">🖨️ Imprimir</button>'
                + (pasta === 'contratos_ativos' && !doc.grupo_pdf
                    ? '<button type="button" class="doc-btn-mover" onclick="moverContratoDocumento(\'' + doc.id + '\',\'contratos_ativos\',\'contratos_finalizados\')">📦 Finalizar</button>'
                    : '')
                + (pasta === 'contratos_finalizados' && !doc.grupo_pdf
                    ? '<button type="button" class="doc-btn-mover" onclick="moverContratoDocumento(\'' + doc.id + '\',\'contratos_finalizados\',\'contratos_ativos\')">♻️ Reativar</button>'
                    : '')
                + '<button type="button" class="doc-btn-del" onclick="excluirDocumentoPessoal(\'' + doc.id + '\', \'' + pasta + '\')">🗑️ Excluir</button>'
                + '</div>'
                + '</div>';
        });
        html += '</div>';
        return html;
    }

    function renderizarListaDocumentosPessoais(pasta, itens) {
        const wrap = document.getElementById('doc-lista-' + pasta);
        if (!wrap) return;
        if (!itens || !itens.length) {
            wrap.innerHTML = '<p style="text-align:center;color:#888;margin:0;">Nenhum documento cadastrado ainda. Use o formulário acima para adicionar.</p>';
            return;
        }

        if (pasta === 'contratos_ativos' || pasta === 'contratos_finalizados') {
            const grupos = {};
            itens.forEach(function (item) {
                const nomePasta = nomePastaContratoDocumento(item);
                const chaveNome = normalizarChaveNomeDespesa(nomePasta) || String(item.id);
                const chave = 'contrato_' + chaveNome;
                if (!grupos[chave]) {
                    grupos[chave] = {
                        nome: nomePasta,
                        itens: []
                    };
                }
                grupos[chave].itens.push(item);
            });

            const listaGrupos = Object.keys(grupos).map(function (chave) {
                const grupo = grupos[chave];
                grupo.chave = chave;
                grupo.itens.sort(function (a, b) {
                    return (Number(a.parte_indice) || 0) - (Number(b.parte_indice) || 0);
                });
                return grupo;
            }).sort(function (a, b) {
                return a.nome.localeCompare(b.nome, 'pt-BR');
            });

            let htmlPastas = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 14px;">';
            listaGrupos.forEach(function (grupo, indice) {
                htmlPastas += '<button type="button" class="badge-tag" style="border-radius:15px;cursor:pointer;" '
                    + 'onclick="document.getElementById(\'pasta-contrato-' + pasta + '-' + indice + '\').open=true;'
                    + 'document.getElementById(\'pasta-contrato-' + pasta + '-' + indice + '\').scrollIntoView({behavior:\'smooth\',block:\'start\'})">'
                    + '📁 ' + escapeHtmlBasico(grupo.nome)
                    + ' <small style="opacity:.8;">(' + grupo.itens.length + ')</small></button>';
            });
            htmlPastas += '</div>';

            listaGrupos.forEach(function (grupo, indice) {
                const idsGrupo = encodeURIComponent(JSON.stringify(grupo.itens.map(function (item) { return item.id; })));
                const acaoGrupo = grupo.itens.length > 1
                    ? (pasta === 'contratos_ativos'
                        ? '<button type="button" class="doc-btn-mover" style="border:none;border-radius:7px;padding:8px 12px;font-weight:700;cursor:pointer;margin:0 0 10px;" onclick="moverPastaContratoDocumentos(\'' + idsGrupo + '\',\'contratos_ativos\',\'contratos_finalizados\')">📦 Finalizar contrato completo</button>'
                        : '<button type="button" class="doc-btn-mover" style="border:none;border-radius:7px;padding:8px 12px;font-weight:700;cursor:pointer;margin:0 0 10px;" onclick="moverPastaContratoDocumentos(\'' + idsGrupo + '\',\'contratos_finalizados\',\'contratos_ativos\')">♻️ Reativar contrato completo</button>')
                    : '';
                htmlPastas += '<details id="pasta-contrato-' + pasta + '-' + indice + '" class="pasta-ano" style="margin-bottom:10px;">'
                    + '<summary>📁 ' + escapeHtmlBasico(grupo.nome)
                    + ' <span style="font-size:11px;color:#64748b;">(' + grupo.itens.length + ' documento(s))</span></summary>'
                    + '<div class="folder-content">'
                    + acaoGrupo
                    + htmlCardsDocumentosPessoais(pasta, grupo.itens)
                    + '</div></details>';
            });
            wrap.innerHTML = htmlPastas;
            return;
        }

        const html = htmlCardsDocumentosPessoais(pasta, itens);
        wrap.innerHTML = html;
    }

    window.carregarDocumentosPessoais = async function (pasta) {
        const empresaLogada = getEmpresaGestor();
        const wrap = document.getElementById('doc-lista-' + pasta);
        if (!empresaLogada) {
            if (wrap) wrap.innerHTML = '<p style="text-align:center;color:#d9534f;">Entre como gestor para ver os documentos.</p>';
            return;
        }
        const cacheLocal = window._documentosPessoaisCache[pasta];
        const cacheEmpresaOk = window._documentosEmpresaFetchEmpresa === empresaLogada
            && window._documentosEmpresaFetchTs
            && (Date.now() - window._documentosEmpresaFetchTs < 300000);
        if (cacheEmpresaOk && Array.isArray(cacheLocal)) {
            renderizarListaDocumentosPessoais(pasta, cacheLocal);
            return;
        }
        if (wrap) wrap.innerHTML = '<p style="text-align:center;color:#888;">Carregando documentos...</p>';
        try {
            const resultado = await fetchDocumentosPessoaisEmpresa(empresaLogada);
            const itens = (resultado.byPasta && resultado.byPasta[pasta]) || [];
            renderizarListaDocumentosPessoais(pasta, itens);
        } catch (e) {
            console.error(e);
            if (wrap) wrap.innerHTML = '<p style="text-align:center;color:#d9534f;">Erro ao carregar documentos.</p>';
        }
    };

    window.salvarDocumentoPessoal = async function (pasta) {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) return Swal.fire('Atenção', 'Entre como gestor para salvar documentos.', 'warning');

        const nome = (document.getElementById('doc-add-nome-' + pasta) && document.getElementById('doc-add-nome-' + pasta).value || '').trim();
        const arquivo = document.getElementById('doc-add-base64-' + pasta) ? document.getElementById('doc-add-base64-' + pasta).value : '';
        const mime = document.getElementById('doc-add-mime-' + pasta) ? document.getElementById('doc-add-mime-' + pasta).value : '';
        const vencimento = document.getElementById('doc-add-vencimento-' + pasta) ? document.getElementById('doc-add-vencimento-' + pasta).value : '';
        const partesInfo = obterPartesPdfPendentes(pasta);
        const temPartes = !!(partesInfo && partesInfo.partes && partesInfo.partes.length);

        if (!nome) return Swal.fire('Atenção', 'Informe o nome do documento (ex.: Documento identidade).', 'warning');
        if (!temPartes && !arquivo) return Swal.fire('Atenção', 'Selecione uma foto ou PDF para anexar.', 'warning');
        if (!temPartes && arquivo.length > DOC_FIRESTORE_MAX_B64) {
            return Swal.fire('Documento grande demais', MSG_DOC_TAMANHO_MAX, 'warning');
        }

        let sucesso = false;
        let qtdSalvos = 0;
        try {
            Swal.fire({
                title: temPartes ? ('Salvando ' + partesInfo.partes.length + ' parte(s)...') : 'Adicionando documento...',
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => Swal.showLoading()
            });

            await promiseComTimeout(ensureAuth(), 12000, 'timeout_auth');

            const agora = new Date();
            const dataBr = `${String(agora.getDate()).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')}/${agora.getFullYear()} ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
            const grupoPdf = temPartes ? ('pdfgrp_' + Date.now()) : '';

            async function gravarUmDocumento(payloadBase) {
                const docPayload = Object.assign({
                    empresa_id: empresaLogada,
                    pasta,
                    data_cadastro: dataBr,
                    criado_em: serverTimestamp()
                }, payloadBase);
                if (pasta === 'contratos_ativos') docPayload.status_contrato = 'ativo';
                if (pasta === 'contratos_finalizados') docPayload.status_contrato = 'finalizado';
                if (vencimento) {
                    docPayload.data_vencimento = vencimento;
                    docPayload.data_vencimento_ts = parseDataVencimentoParaTimestamp(vencimento);
                }
                if (docPayload.mime !== 'application/pdf' && docPayload.arquivo && !String(docPayload.arquivo).startsWith('data:application/pdf')) {
                    const thumb = await gerarThumbDocumentoPessoal(docPayload.arquivo);
                    if (thumb) docPayload.thumb = thumb;
                }
                await promiseComTimeout(
                    addDoc(collection(db, COLECAO_DOCUMENTOS_PESSOAIS), docPayload),
                    30000,
                    'timeout_firestore'
                );
            }

            if (temPartes) {
                const totalPartes = partesInfo.partes.length;
                for (let i = 0; i < totalPartes; i++) {
                    const p = partesInfo.partes[i];
                    if (!partePdfCabeNoFirestore({ length: p.tamanho }, p.data) && p.data.length > DOC_FIRESTORE_MAX_B64) {
                        throw new Error('arquivo_grande');
                    }
                    const nomeParte = nome + ' — parte ' + (i + 1) + '/' + totalPartes
                        + ' (pág. ' + p.paginaInicio + '–' + p.paginaFim + ')';
                    await gravarUmDocumento({
                        nome: nomeParte,
                        nome_contrato: nome,
                        arquivo: p.data,
                        mime: 'application/pdf',
                        grupo_pdf: grupoPdf,
                        parte_indice: i + 1,
                        parte_total: totalPartes,
                        pagina_inicio: p.paginaInicio,
                        pagina_fim: p.paginaFim,
                        nome_original: partesInfo.nomeArquivo || nome
                    });
                    qtdSalvos += 1;
                }
            } else {
                await gravarUmDocumento({
                    nome: nome,
                    nome_contrato: (pasta === 'contratos_ativos' || pasta === 'contratos_finalizados') ? nome : '',
                    arquivo: arquivo,
                    mime: mime || 'image/jpeg'
                });
                qtdSalvos = 1;
            }

            invalidarCacheDocumentosPessoaisEmpresa();
            sucesso = true;
        } catch (e) {
            console.error(e);
            let msg = 'Não foi possível salvar o documento. Verifique a conexão e tente novamente.';
            if (e && e.message === 'timeout_auth') {
                msg = 'Não foi possível autenticar. Recarregue a página e tente novamente.';
            } else if (e && e.message === 'timeout_firestore') {
                msg = 'A gravação na nuvem demorou demais. Verifique a conexão e tente novamente.';
            } else if (e && (e.message === 'arquivo_grande' || e.code === 'invalid-argument' || String(e.message || '').includes('longer than'))) {
                msg = MSG_DOC_TAMANHO_MAX;
            }
            if (qtdSalvos > 0) {
                msg += ' (' + qtdSalvos + ' parte(s) já tinham sido gravadas — confira a lista.)';
                invalidarCacheDocumentosPessoaisEmpresa();
            }
            Swal.fire('Erro', msg, 'error');
        } finally {
            fecharLoadingDocumentoPessoal();
        }

        if (!sucesso) {
            if (qtdSalvos > 0) {
                try {
                    if (pasta === 'contratos_ativos' || pasta === 'contratos_finalizados') {
                        await carregarAbaContratosDocumentos();
                    } else {
                        await carregarDocumentosPessoais(pasta);
                    }
                } catch (_) {}
            }
            return;
        }

        limparFormDocumentoPessoal(pasta);
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: qtdSalvos > 1 ? (qtdSalvos + ' partes adicionadas!') : 'Documento adicionado!',
            showConfirmButton: false,
            timer: 2500
        });

        try {
            if (pasta === 'contratos_ativos' || pasta === 'contratos_finalizados') {
                await carregarAbaContratosDocumentos();
            } else {
                await carregarDocumentosPessoais(pasta);
            }
        } catch (e) {
            console.error(e);
        }
        try {
            if (typeof monitorarVencimentosDocumentos === 'function') {
                monitorarVencimentosDocumentos();
            }
        } catch (e) {
            console.error(e);
        }
    };

    window._visualizadorDocBlobUrl = null;
    window._visualizadorDocUrlAtual = null;
    window._visualizadorDocTipoAtual = null;
    window._visualizadorDocZoom = 1;

    window.zoomVisualizadorDoc = function(delta) {
        if (delta === 0) {
            window._visualizadorDocZoom = 1;
        } else {
            let z = (window._visualizadorDocZoom || 1) + delta;
            z = Math.max(0.5, Math.min(4, Math.round(z * 100) / 100));
            window._visualizadorDocZoom = z;
        }
        const img = document.getElementById('visualizador-doc-img');
        const txt = document.getElementById('visualizador-doc-zoom-txt');
        if (img) {
            img.style.transform = `scale(${window._visualizadorDocZoom})`;
            img.style.transformOrigin = 'center center';
        }
        if (txt) {
            txt.textContent = Math.round(window._visualizadorDocZoom * 100) + '%';
        }
    };

    window.fecharVisualizadorDocumento = function () {
        const modal = document.getElementById('modal-visualizador-documento');
        if (modal) {
            modal.style.display = 'none';
            const frame = document.getElementById('visualizador-doc-frame');
            if (frame) frame.src = 'about:blank';
            const img = document.getElementById('visualizador-doc-img');
            if (img) {
                img.src = '';
                img.style.display = 'none';
                img.style.transform = 'none';
            }
            const wrap = document.getElementById('visualizador-doc-img-wrap');
            if (wrap) wrap.style.display = 'none';
            const zoomCtrls = document.getElementById('visualizador-doc-zoom-controles');
            if (zoomCtrls) zoomCtrls.style.display = 'none';
        }
        if (window._visualizadorDocBlobUrl) {
            try { URL.revokeObjectURL(window._visualizadorDocBlobUrl); } catch (_) {}
            window._visualizadorDocBlobUrl = null;
        }
        window._visualizadorDocUrlAtual = null;
        window._visualizadorDocTipoAtual = null;
        window._visualizadorDocZoom = 1;
    };

    window.abrirVisualizadorDocumento = function (url, nome, tipo) {
        if (!url) return;
        const modal = document.getElementById('modal-visualizador-documento');
        if (!modal) return;

        if (window._visualizadorDocBlobUrl) {
            try { URL.revokeObjectURL(window._visualizadorDocBlobUrl); } catch (_) {}
            window._visualizadorDocBlobUrl = null;
        }

        const titulo = document.getElementById('visualizador-doc-titulo');
        const frame = document.getElementById('visualizador-doc-frame');
        const img = document.getElementById('visualizador-doc-img');
        const wrap = document.getElementById('visualizador-doc-img-wrap');
        const zoomCtrls = document.getElementById('visualizador-doc-zoom-controles');
        const txtZoom = document.getElementById('visualizador-doc-zoom-txt');

        if (titulo) titulo.textContent = nome || 'Visualização do Documento';

        const srcRaw = String(url);
        const ehPdf = tipo === 'pdf'
            || (typeof ehAnexoPdfDataUrl === 'function' && ehAnexoPdfDataUrl(srcRaw))
            || (/\.pdf(\?|$)/i.test(srcRaw))
            || srcRaw.startsWith('data:application/pdf')
            || /mime=application\/pdf/i.test(srcRaw);

        window._visualizadorDocUrlAtual = srcRaw;
        window._visualizadorDocTipoAtual = ehPdf ? 'pdf' : 'img';
        window._visualizadorDocZoom = 1;
        if (txtZoom) txtZoom.textContent = '100%';

        if (ehPdf) {
            if (img) {
                img.style.display = 'none';
                img.src = '';
                img.style.transform = 'none';
            }
            if (wrap) wrap.style.display = 'none';
            if (zoomCtrls) zoomCtrls.style.display = 'none';

            let blobUrl = srcRaw;
            try {
                if (srcRaw.startsWith('data:')) {
                    const partes = srcRaw.split(',');
                    const b64 = partes.slice(1).join(',');
                    const bin = atob(b64);
                    const bytes = new Uint8Array(bin.length);
                    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
                    blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
                    window._visualizadorDocBlobUrl = blobUrl;
                }
            } catch (e) {
                blobUrl = srcRaw;
            }

            if (frame) {
                frame.src = blobUrl;
                frame.style.display = 'block';
                frame.onload = function () {
                    try {
                        frame.contentWindow.addEventListener('keydown', function (ev) {
                            if (ev.key === 'Escape' || ev.key === 'Esc') {
                                ev.preventDefault();
                                window.fecharVisualizadorDocumento();
                            }
                        });
                    } catch (_) {}
                };
            }
        } else {
            if (frame) {
                frame.style.display = 'none';
                frame.src = 'about:blank';
            }
            if (wrap) wrap.style.display = 'flex';
            if (img) {
                img.src = srcRaw;
                img.style.display = 'block';
                img.style.transform = 'scale(1)';
            }
            if (zoomCtrls) zoomCtrls.style.display = 'inline-flex';
        }
        modal.style.display = 'flex';
    };

    window.abrirVisualizadorEmNovaAba = function () {
        const url = window._visualizadorDocBlobUrl || window._visualizadorDocUrlAtual;
        const ehPdf = window._visualizadorDocTipoAtual === 'pdf';
        if (!url) return;
        try {
            const w = window.open('', '_blank');
            if (!w) {
                if (typeof Swal !== 'undefined') Swal.fire('Atenção', 'O navegador bloqueou a nova aba. Permita pop-ups para este site.', 'warning');
                return;
            }
            if (ehPdf) {
                const srcEsc = String(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
                w.document.write('<!DOCTYPE html><html><head><title>Visualização PDF</title><meta name="viewport" content="width=device-width,initial-scale=1">'
                    + '<style>html,body{margin:0;height:100%;background:#111;}iframe{width:100%;height:100%;border:none;}</style></head><body>'
                    + '<iframe src="' + srcEsc + '" style="width:100%;height:100%;border:none;"></iframe></body></html>');
            } else {
                const srcEsc = String(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
                w.document.write('<!DOCTYPE html><html><head><title>Visualização de Imagem</title><meta name="viewport" content="width=device-width,initial-scale=1">'
                    + '<style>body{margin:0;background:#111;display:flex;justify-content:center;align-items:center;min-height:100vh;}img{max-width:100%;height:auto;}</style></head><body>'
                    + '<img src="' + srcEsc + '" alt="Documento"></body></html>');
            }
            w.document.close();
        } catch (e) {
            console.error(e);
            window.open(url, '_blank');
        }
    };

    window.abrirFoto = function (imgBase64, titulo) {
        if (!imgBase64) {
            if (typeof Swal !== 'undefined') Swal.fire('Atenção', 'Nenhuma imagem ou documento para exibir.', 'info');
            return;
        }
        const srcRaw = String(imgBase64);
        const ehPdf = (typeof ehAnexoPdfDataUrl === 'function' && ehAnexoPdfDataUrl(srcRaw))
            || /\.pdf(\?|$)/i.test(srcRaw)
            || srcRaw.startsWith('data:application/pdf')
            || /mime=application\/pdf/i.test(srcRaw);

        if (typeof window.abrirVisualizadorDocumento === 'function') {
            window.abrirVisualizadorDocumento(srcRaw, titulo || (ehPdf ? 'Comprovante PDF' : 'Comprovante / Anexo'), ehPdf ? 'pdf' : 'img');
            return;
        }
    };

    window.visualizarDocumentoPessoal = async function (id, pasta) {
        Swal.fire({ title: 'Abrindo documento...', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
        const item = await obterDocumentoPessoalCompleto(id, pasta);
        fecharLoadingDocumentoPessoal();
        const url = urlArquivoDocumentoPessoal(item);
        if (!item || !url) return Swal.fire('Atenção', 'Documento não encontrado.', 'warning');
        abrirVisualizadorDocumento(url, item.nome, documentoPessoalEhPdf(item) ? 'pdf' : 'img');
    };

    window.exportarDocumentoPessoal = async function (id, pasta) {
        const item = await obterDocumentoPessoalCompleto(id, pasta);
        if (!item || !urlArquivoDocumentoPessoal(item)) return Swal.fire('Atenção', 'Documento não encontrado.', 'warning');
        try {
            await baixarArquivoDocumentoPessoal(item, item.nome);
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Download iniciado', showConfirmButton: false, timer: 2000 });
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível exportar o documento.', 'error');
        }
    };

    window.imprimirDocumentoPessoal = async function (id, pasta) {
        Swal.fire({ title: 'Preparando impressão...', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
        const item = await obterDocumentoPessoalCompleto(id, pasta);
        fecharLoadingDocumentoPessoal();
        const url = urlArquivoDocumentoPessoal(item);
        if (!item || !url) return Swal.fire('Atenção', 'Documento não encontrado.', 'warning');
        const ehPdf = documentoPessoalEhPdf(item);
        const w = window.open('', '_blank');
        if (!w) return Swal.fire('Atenção', 'Permita pop-ups para imprimir.', 'warning');
        if (ehPdf) {
            w.document.write('<!DOCTYPE html><html><head><title>' + escapeHtmlBasico(item.nome) + '</title><style>html,body{margin:0;height:100%;}iframe{width:100%;height:100%;border:none;}</style></head><body><iframe id="pdfFrame" src="' + escapeAttrBasico(url) + '"></iframe><script>window.onload=function(){setTimeout(function(){try{document.getElementById("pdfFrame").contentWindow.focus();document.getElementById("pdfFrame").contentWindow.print();}catch(e){window.print();}},600);};<\/script></body></html>');
        } else {
            w.document.write('<!DOCTYPE html><html><head><title>' + escapeHtmlBasico(item.nome) + '</title><style>body{margin:0;text-align:center;}img{max-width:100%;height:auto;}</style></head><body><img src="' + escapeAttrBasico(url) + '" onload="setTimeout(function(){window.focus();window.print();},300)"></body></html>');
        }
        w.document.close();
    };

    window.excluirDocumentoPessoal = async function (id, pasta) {
        const item = buscarDocumentoPessoalCache(id, pasta);
        if (!item) return Swal.fire('Atenção', 'Documento não encontrado.', 'warning');
        const conf = await Swal.fire({
            title: 'Excluir documento?',
            html: 'Remover <b>' + escapeHtmlBasico(item.nome) + '</b> permanentemente?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, excluir',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#c0392b'
        });
        if (!conf.isConfirmed) return;
        try {
            Swal.fire({ title: 'Excluindo...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            await deleteDoc(doc(db, COLECAO_DOCUMENTOS_PESSOAIS, id));
            invalidarCacheDocumentosPessoaisEmpresa();
            Swal.close();
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Documento excluído', showConfirmButton: false, timer: 2000 });
            if (pasta === 'contratos_ativos' || pasta === 'contratos_finalizados') {
                await carregarAbaContratosDocumentos();
            } else {
                await carregarDocumentosPessoais(pasta);
            }
        } catch (e) {
            console.error(e);
            Swal.close();
            Swal.fire('Erro', 'Não foi possível excluir o documento.', 'error');
        }
    };

    window.mostrarSecaoContratos = function (tipo) {
        const ativos = tipo === 'ativos';
        const secaoAtivos = document.getElementById('secao-contratos-ativos');
        const secaoFin = document.getElementById('secao-contratos-finalizados');
        const tabAtivos = document.getElementById('tab-contratos-ativos');
        const tabFin = document.getElementById('tab-contratos-finalizados');
        if (secaoAtivos) secaoAtivos.classList.toggle('active', ativos);
        if (secaoFin) secaoFin.classList.toggle('active', !ativos);
        if (tabAtivos) tabAtivos.classList.toggle('active', ativos);
        if (tabFin) tabFin.classList.toggle('active', !ativos);
        window._secaoContratosAtual = ativos ? 'ativos' : 'finalizados';
    };

    window.carregarAbaContratosDocumentos = async function () {
        if (typeof initInputsDocumentosPessoais === 'function') initInputsDocumentosPessoais();
        const secao = window._secaoContratosAtual || 'ativos';
        mostrarSecaoContratos(secao);
        await Promise.all([
            carregarDocumentosPessoais('contratos_ativos'),
            carregarDocumentosPessoais('contratos_finalizados')
        ]);
    };

    window.moverContratoDocumento = async function (id, pastaOrigem, pastaDestino) {
        if (!id || !pastaDestino) return;
        const item = buscarDocumentoPessoalCache(id, pastaOrigem);
        if (!item) return Swal.fire('Atenção', 'Contrato não encontrado.', 'warning');
        const paraFinalizar = pastaDestino === 'contratos_finalizados';
        const conf = await Swal.fire({
            title: paraFinalizar ? 'Finalizar contrato?' : 'Reativar contrato?',
            html: paraFinalizar
                ? 'Mover <b>' + escapeHtmlBasico(item.nome) + '</b> para <b>Contratos Finalizados</b>?'
                : 'Mover <b>' + escapeHtmlBasico(item.nome) + '</b> de volta para <b>Contratos Ativos</b>?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: paraFinalizar ? 'Sim, finalizar' : 'Sim, reativar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#856404'
        });
        if (!conf.isConfirmed) return;
        try {
            Swal.fire({ title: 'Atualizando...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
            await updateDoc(doc(db, COLECAO_DOCUMENTOS_PESSOAIS, id), {
                pasta: pastaDestino,
                status_contrato: paraFinalizar ? 'finalizado' : 'ativo',
                movido_em: Date.now(),
                movido_em_str: new Date().toLocaleString('pt-BR')
            });
            invalidarCacheDocumentosPessoaisEmpresa();
            Swal.close();
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: paraFinalizar ? 'Contrato finalizado' : 'Contrato reativado',
                showConfirmButton: false,
                timer: 2200
            });
            await carregarAbaContratosDocumentos();
            mostrarSecaoContratos(paraFinalizar ? 'finalizados' : 'ativos');
        } catch (e) {
            console.error(e);
            Swal.close();
            Swal.fire('Erro', 'Não foi possível mover o contrato.', 'error');
        }
    };

    window.moverPastaContratoDocumentos = async function (idsCodificados, pastaOrigem, pastaDestino) {
        let ids = [];
        try {
            ids = JSON.parse(decodeURIComponent(String(idsCodificados || '')));
        } catch (_) {}
        if (!Array.isArray(ids) || !ids.length) {
            return Swal.fire('Atenção', 'Pasta do contrato não encontrada.', 'warning');
        }
        const paraFinalizar = pastaDestino === 'contratos_finalizados';
        const conf = await Swal.fire({
            title: paraFinalizar ? 'Finalizar contrato completo?' : 'Reativar contrato completo?',
            html: 'Todos os <b>' + ids.length + ' documento(s)</b> desta pasta serão movidos juntos.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: paraFinalizar ? 'Sim, finalizar pasta' : 'Sim, reativar pasta',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#856404'
        });
        if (!conf.isConfirmed) return;
        try {
            Swal.fire({ title: 'Movendo pasta...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
            for (const id of ids) {
                await updateDoc(doc(db, COLECAO_DOCUMENTOS_PESSOAIS, id), {
                    pasta: pastaDestino,
                    status_contrato: paraFinalizar ? 'finalizado' : 'ativo',
                    movido_em: Date.now(),
                    movido_em_str: new Date().toLocaleString('pt-BR')
                });
            }
            invalidarCacheDocumentosPessoaisEmpresa();
            Swal.close();
            await carregarAbaContratosDocumentos();
            mostrarSecaoContratos(paraFinalizar ? 'finalizados' : 'ativos');
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: paraFinalizar ? 'Pasta finalizada' : 'Pasta reativada',
                showConfirmButton: false,
                timer: 2200
            });
        } catch (e) {
            console.error(e);
            Swal.close();
            Swal.fire('Erro', 'Não foi possível mover toda a pasta.', 'error');
        }
    };

    initInputsDocumentosPessoais();

    const TIPOS_DESCONTO_FOLHA_OPTS = [
        'INSS', 'IRRF', 'Vale Transporte', 'Vale Refeição',
        'Pensão alimentícia', 'Empréstimo consignado', 'Plano de saúde', 'Outros'
    ];
