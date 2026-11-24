/* js/modulos/holerite-assinatura.js — edite este arquivo para alterar só este módulo */
    let cameraFacingHolerite = 'user';
    let holeriteAssinaturaIdAtual = null;
    window.holeritesEncontrados = window.holeritesEncontrados || {};

    function montarHtmlTextoHoleriteAssinatura(pack) {
        const linhasProv = (pack.proventos || []).map(function (it) {
            return '<tr><td style="padding:4px 6px;border-bottom:1px solid #eee;">' + escapeHtmlBasico(it.label || '') + '</td><td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;color:#218838;font-weight:600;">' + escapeHtmlBasico(formatarMoeda(it.valor)) + '</td></tr>';
        }).join('');
        const linhasDesc = (pack.descontos || []).map(function (it) {
            return '<tr><td style="padding:4px 6px;border-bottom:1px solid #eee;">' + escapeHtmlBasico(it.label || '') + '</td><td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;color:#c0392b;font-weight:600;">' + escapeHtmlBasico(formatarMoeda(it.valor)) + '</td></tr>';
        }).join('');
        const corLiq = pack.liquidoNegativo ? '#c0392b' : '#1a2a43';
        return ''
            + '<div style="text-align:center;margin-bottom:12px;">'
            + '<div style="font-weight:800;color:#1a2a43;font-size:15px;">' + escapeHtmlBasico(pack.empresaNome || '') + '</div>'
            + '<div style="font-size:13px;font-weight:700;margin-top:4px;">ESPELHO DE HOLERITE</div>'
            + '<div style="font-size:12px;color:#666;margin-top:4px;">Ref.: ' + escapeHtmlBasico(pack.mesRef || '') + '</div>'
            + '</div>'
            + '<div style="background:#f8fafc;border:1px solid #e0e6ed;border-radius:10px;padding:10px;margin-bottom:12px;font-size:12px;">'
            + '<div><b>Colaborador:</b> ' + escapeHtmlBasico(pack.funcionarioNome || '') + '</div>'
            + '<div><b>CPF:</b> ' + escapeHtmlBasico(pack.cpf || '—') + '</div>'
            + '<div><b>PIX:</b> ' + escapeHtmlBasico(pack.pix || '—') + '</div>'
            + '<div><b>Jornada:</b> ' + escapeHtmlBasico(pack.horario || '—') + '</div>'
            + '<div><b>Dias pagos:</b> ' + escapeHtmlBasico(String(pack.diasPagos != null ? pack.diasPagos : '0')) + '</div>'
            + '</div>'
            + '<div style="font-weight:700;color:#218838;margin:8px 0 4px;">PROVENTOS</div>'
            + '<table style="width:100%;border-collapse:collapse;font-size:12px;">' + (linhasProv || '<tr><td colspan="2" style="padding:6px;color:#888;">—</td></tr>') + '</table>'
            + '<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin:6px 0 12px;padding:6px;background:#eef9f0;border-radius:6px;"><span>Total proventos</span><span>' + escapeHtmlBasico(formatarMoeda(pack.totalProventos)) + '</span></div>'
            + '<div style="font-weight:700;color:#c0392b;margin:8px 0 4px;">DESCONTOS</div>'
            + '<table style="width:100%;border-collapse:collapse;font-size:12px;">' + (linhasDesc || '<tr><td colspan="2" style="padding:6px;color:#888;">—</td></tr>') + '</table>'
            + '<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin:6px 0 12px;padding:6px;background:#fdf0ef;border-radius:6px;"><span>Total descontos</span><span>' + escapeHtmlBasico(formatarMoeda(pack.totalDescontos)) + '</span></div>'
            + '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-radius:10px;background:#1a2a43;color:#fff;margin-top:8px;">'
            + '<span style="font-weight:700;">LÍQUIDO A RECEBER</span>'
            + '<span style="font-size:18px;font-weight:800;color:' + (pack.liquidoNegativo ? '#ffb4b4' : '#ffd76a') + ';">' + escapeHtmlBasico(formatarMoeda(pack.liquido)) + '</span>'
            + '</div>'
            + '<p style="font-size:11px;color:#666;margin-top:14px;text-align:justify;">Declaro que conferi os valores deste holerite referente a <b>' + escapeHtmlBasico(pack.mesRef || '') + '</b> e confirmo a ciência mediante assinatura digital e selfie de comprovação.</p>';
    }

    function resizeCanvasHolerite() {
        const canvas = document.getElementById('signature-pad-holerite');
        if (!canvas) return;
        let data = null;
        if (signaturePadHolerite && !signaturePadHolerite.isEmpty()) {
            data = signaturePadHolerite.toData();
        }
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d').scale(ratio, ratio);
        if (signaturePadHolerite) {
            signaturePadHolerite.clear();
            if (data) signaturePadHolerite.fromData(data);
        }
    }

    window.addEventListener('resize', resizeCanvasHolerite);
    window.addEventListener('orientationchange', function () { setTimeout(resizeCanvasHolerite, 200); });

    function pararCameraHolerite() {
        if (streamCameraHolerite) {
            streamCameraHolerite.getTracks().forEach(function (t) { t.stop(); });
            streamCameraHolerite = null;
        }
        const video = document.getElementById('hol-video-selfie');
        if (video) video.srcObject = null;
    }

    window.iniciarCameraHolerite = async function (facing) {
        const modo = facing === 'environment' ? 'environment' : 'user';
        const video = document.getElementById('hol-video-selfie');
        const btnTirar = document.getElementById('hol-btn-tirar-foto');
        const btnTrocar = document.getElementById('hol-btn-trocar-camera');
        const blocoAbrir = document.getElementById('hol-botoes-abrir-camera');
        const imgFoto = document.getElementById('hol-foto-tirada');
        const btnIniciar = document.getElementById('hol-btn-iniciar-camera');

        pararCameraHolerite();
        cameraFacingHolerite = modo;

        try {
            streamCameraHolerite = await obterStreamCamera(modo);
            video.srcObject = streamCameraHolerite;
            await video.play().catch(function () {});
            video.style.display = 'block';
            video.classList.toggle('camera-espelhada', modo === 'user');
            if (blocoAbrir) blocoAbrir.style.display = 'none';
            if (btnTrocar) btnTrocar.style.display = 'block';
            if (btnTirar) btnTirar.style.display = 'block';
            if (btnIniciar) btnIniciar.style.display = 'none';
            if (imgFoto) imgFoto.style.display = 'none';
        } catch (err) {
            console.warn('Câmera holerite', err);
            Swal.fire('Erro', 'Não foi possível abrir a câmera. Permita o acesso à câmera no celular.', 'error');
            if (blocoAbrir) blocoAbrir.style.display = 'flex';
        }
    };

    window.alternarCameraHolerite = function () {
        iniciarCameraHolerite(cameraFacingHolerite === 'user' ? 'environment' : 'user');
    };

    window.tirarFotoHolerite = function () {
        const video = document.getElementById('hol-video-selfie');
        const canvas = document.getElementById('hol-canvas-selfie');
        const imgFoto = document.getElementById('hol-foto-tirada');
        const inputBase64 = document.getElementById('hol-foto-base64');
        const btnTirar = document.getElementById('hol-btn-tirar-foto');
        const btnTrocar = document.getElementById('hol-btn-trocar-camera');
        const btnIniciar = document.getElementById('hol-btn-iniciar-camera');
        const blocoAbrir = document.getElementById('hol-botoes-abrir-camera');

        if (!video || !video.videoWidth) {
            return Swal.fire('Atenção', 'Aguarde a câmera carregar e tente novamente.', 'warning');
        }

        const maxW = 640;
        let w = video.videoWidth;
        let h = video.videoHeight;
        if (w > maxW) {
            h = Math.round(h * (maxW / w));
            w = maxW;
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(video, 0, 0, w, h);

        const fotoDataUrl = canvas.toDataURL('image/jpeg', 0.55);
        imgFoto.src = fotoDataUrl;
        inputBase64.value = fotoDataUrl;
        imgFoto.classList.toggle('camera-espelhada', cameraFacingHolerite === 'user');
        imgFoto.style.display = 'block';
        video.style.display = 'none';
        if (btnTirar) btnTirar.style.display = 'none';
        if (btnTrocar) btnTrocar.style.display = 'none';
        if (btnIniciar) {
            btnIniciar.style.display = 'block';
            btnIniciar.innerText = '🔄 Tirar outra selfie';
        }
        if (blocoAbrir) blocoAbrir.style.display = 'flex';
        pararCameraHolerite();
    };

    window.limparAssinaturaHolerite = function () {
        if (signaturePadHolerite) signaturePadHolerite.clear();
    };

    async function carregarHoleriteParaAssinatura(id) {
        holeriteAssinaturaIdAtual = id;
        try {
            const docSnap = await getDoc(doc(db, 'holerites_sistema', id));
            if (!docSnap.exists()) {
                document.getElementById('tela-assinatura-holerite').innerHTML = '<h3 style="text-align:center;color:#d9534f;padding:40px;">Link inválido.</h3>';
                return;
            }
            const dados = docSnap.data();
            if (String(dados.status || '').toLowerCase() === 'assinado') {
                document.getElementById('tela-assinatura-holerite').innerHTML = '<div style="text-align:center;padding:40px;"><img src="https://i.postimg.cc/zDRJMSTn/69420f5a-5b80-457e-8146-00485162d7f2.jpg" style="max-width:150px;margin-bottom:20px;"><h3 style="color:#28a745;">✅ Holerite já assinado!</h3></div>';
                return;
            }
            document.getElementById('hol-f-data').innerText = 'Gerado em: ' + (dados.data_criacao || '') + (dados.hora_criacao ? ' às ' + dados.hora_criacao : '');
            document.getElementById('hol-f-texto').innerHTML = dados.texto || montarHtmlTextoHoleriteAssinatura(dados.pack || {});
            document.getElementById('hol-foto-base64').value = '';
            setTimeout(function () {
                const canvas = document.getElementById('signature-pad-holerite');
                if (canvas) {
                    signaturePadHolerite = new SignaturePad(canvas, { penColor: '#1a2a43', minWidth: 0.5, maxWidth: 1.5 });
                    resizeCanvasHolerite();
                }
            }, 400);
        } catch (e) {
            console.error('Erro ao carregar holerite', e);
            Swal.fire('Erro', 'Não foi possível carregar o holerite.', 'error');
        }
    }
    window.carregarHoleriteParaAssinatura = carregarHoleriteParaAssinatura;

    window.confirmarAssinaturaHolerite = async function () {
        const id = holeriteAssinaturaIdAtual || new URLSearchParams(window.location.search).get('holerite');
        if (!id) return Swal.fire('Erro', 'Link inválido.', 'error');

        const selfie = (document.getElementById('hol-foto-base64') || {}).value || '';
        if (!selfie) {
            return Swal.fire('Atenção', 'Tire a selfie de comprovação antes de assinar.', 'warning');
        }
        if (!signaturePadHolerite || signaturePadHolerite.isEmpty()) {
            return Swal.fire('Atenção', 'Assine no quadro em branco antes de confirmar.', 'warning');
        }

        const btn = document.getElementById('btnAssinarHolerite');
        btn.innerText = '⏳ A GUARDAR...';
        btn.disabled = true;
        pararCameraHolerite();

        try {
            const assinaturaImg = signaturePadHolerite.toDataURL('image/png');
            const agoraAss = new Date();
            const dataAssinatura = String(agoraAss.getDate()).padStart(2, '0') + '/' + String(agoraAss.getMonth() + 1).padStart(2, '0') + '/' + agoraAss.getFullYear();
            const horaAssinatura = String(agoraAss.getHours()).padStart(2, '0') + ':' + String(agoraAss.getMinutes()).padStart(2, '0');

            await updateDoc(doc(db, 'holerites_sistema', id), {
                assinatura: assinaturaImg,
                foto_assinatura: selfie,
                status: 'assinado',
                data_assinatura: dataAssinatura,
                hora_assinatura: horaAssinatura,
                timestamp_assinatura: agoraAss.getTime()
            });

            Swal.fire({
                title: 'Assinado!',
                text: 'Holerite registrado com assinatura e selfie de comprovação.',
                icon: 'success',
                allowOutsideClick: false,
                confirmButtonColor: '#1a2a43'
            }).then(function () {
                document.getElementById('tela-assinatura-holerite').innerHTML = '<div style="text-align:center;padding:40px;"><img src="https://i.postimg.cc/zDRJMSTn/69420f5a-5b80-457e-8146-00485162d7f2.jpg" style="max-width:150px;margin-bottom:20px;"><h3 style="color:#1a2a43;">✅ Assinatura do holerite concluída!</h3><p style="color:#666;font-size:13px;">Sua selfie e assinatura foram salvas no sistema.</p></div>';
            });
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível salvar. Tente novamente (a selfie + assinatura podem ser grandes — use Wi-Fi).', 'error');
            btn.innerText = 'CONFIRMAR SELFIE + ASSINATURA';
            btn.disabled = false;
        }
    };

    window.enviarHoleriteParaAssinar = async function () {
        const pack = window.folhaHoleritePDF;
        if (!pack) {
            return Swal.fire('Atenção', 'Calcule a folha primeiro (botão "Calcular fechamento").', 'warning');
        }
        const funcId = document.getElementById('folha-func-select').value;
        if (!funcId) {
            return Swal.fire('Atenção', 'Selecione o funcionário.', 'warning');
        }
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) {
            return Swal.fire('Atenção', 'Sessão do gestor inválida.', 'warning');
        }

        const btn = document.getElementById('btnEnviarHoleriteAssinar');
        const txtOriginal = btn ? btn.innerText : '';
        if (btn) {
            btn.innerText = '⏳ GERANDO LINK...';
            btn.disabled = true;
        }

        const dataObj = new Date();
        const dataAtual = String(dataObj.getDate()).padStart(2, '0') + '/' + String(dataObj.getMonth() + 1).padStart(2, '0') + '/' + dataObj.getFullYear();
        const horaAtual = String(dataObj.getHours()).padStart(2, '0') + ':' + String(dataObj.getMinutes()).padStart(2, '0');

        try {
            const packLimpo = JSON.parse(JSON.stringify(pack));
            const textoHtml = montarHtmlTextoHoleriteAssinatura(packLimpo);
            const docRef = await addDoc(collection(db, 'holerites_sistema'), {
                empresa_id: empresaLogada,
                funcionario_id: funcId,
                nome: pack.funcionarioNome || '',
                mes_ref: pack.mesAnoRef || '',
                mes_nome: pack.mesRef || '',
                liquido: pack.liquido != null ? pack.liquido : 0,
                status: 'pendente',
                pack: packLimpo,
                texto: textoHtml,
                data_criacao: dataAtual,
                hora_criacao: horaAtual,
                timestamp: dataObj.getTime()
            });

            const linkAssinatura = window.location.origin + window.location.pathname + '?holerite=' + docRef.id;
            const msgWhats = 'Olá ' + (pack.funcionarioNome || '') + ', acesse o link abaixo para conferir e assinar o seu holerite (' + (pack.mesRef || '') + '). Será necessário tirar uma selfie e assinar digitalmente:\n\n' + linkAssinatura;

            Swal.fire({
                title: 'Holerite pronto!',
                text: 'Link de assinatura gerado. O funcionário precisará tirar selfie e assinar.',
                icon: 'success',
                showCancelButton: true,
                confirmButtonColor: '#25D366',
                cancelButtonColor: '#1a2a43',
                confirmButtonText: '🟢 Enviar no WhatsApp',
                cancelButtonText: 'Copiar Link'
            }).then(function (result) {
                if (result.isConfirmed) {
                    const funcionario = window.listaFuncionarios && window.listaFuncionarios[funcId];
                    if (funcionario && funcionario.tel) {
                        window.open('https://api.whatsapp.com/send?phone=55' + funcionario.tel + '&text=' + encodeURIComponent(msgWhats), '_blank');
                    } else {
                        Swal.fire('Aviso', 'Este funcionário não tem telefone cadastrado. Copie o link manualmente.', 'info');
                        navigator.clipboard.writeText(linkAssinatura);
                    }
                } else {
                    navigator.clipboard.writeText(linkAssinatura);
                    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Link Copiado!', showConfirmButton: false, timer: 2000 });
                }
            });
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Falha ao gerar o holerite para assinatura.', 'error');
        } finally {
            if (btn) {
                btn.innerText = txtOriginal || '✍️ ENVIAR HOLERITE PARA O FUNCIONÁRIO ASSINAR';
                btn.disabled = false;
            }
        }
    };

    window.buscarHoleritesAssinatura = async function () {
        const funcId = document.getElementById('hol-func-select').value;
        const divLista = document.getElementById('lista-holerites-resultados');
        if (!funcId) {
            return Swal.fire('Atenção', 'Selecione o funcionário.', 'warning');
        }
        divLista.innerHTML = 'Carregando...';
        const empresaLogada = getEmpresaGestor();
        try {
            const q = query(collection(db, 'holerites_sistema'), where('empresa_id', '==', empresaLogada));
            const snap = await getDocs(q);
            if (snap.empty) {
                divLista.innerHTML = '<p style="text-align:center;color:#888;">Nenhum holerite enviado para este funcionário.</p>';
                return;
            }
            const arr = [];
            snap.forEach(function (d) {
                const item = { id: d.id, ...d.data() };
                if (String(item.funcionario_id || '') !== String(funcId)) return;
                arr.push(item);
                window.holeritesEncontrados[d.id] = item;
            });
            if (!arr.length) {
                divLista.innerHTML = '<p style="text-align:center;color:#888;">Nenhum holerite enviado para este funcionário.</p>';
                return;
            }
            arr.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });

            let html = '';
            arr.forEach(function (h) {
                const isAssinado = String(h.status || '').toLowerCase() === 'assinado';
                const corBorda = isAssinado ? '#28a745' : '#f0ad4e';
                const badge = isAssinado ? '✅ ASSINADO' : '⏳ PENDENTE';
                const dataRef = isAssinado
                    ? ('Assinado em: ' + (h.data_assinatura || '') + (h.hora_assinatura ? ' às ' + h.hora_assinatura : ''))
                    : ('Enviado em: ' + (h.data_criacao || '') + (h.hora_criacao ? ' às ' + h.hora_criacao : ''));
                html += ''
                    + '<div class="resultado-item" style="border-left-color:' + corBorda + ';background:' + (isAssinado ? '#f8fff9' : '#fff') + ';">'
                    + '<div style="display:flex;justify-content:space-between;align-items:center;">'
                    + '<b style="color:var(--dark-navy);font-size:15px;">' + escapeHtmlBasico(h.mes_nome || h.mes_ref || 'Holerite') + '</b>'
                    + '<span style="font-size:10px;font-weight:bold;background:#eef2f5;padding:4px 8px;border-radius:5px;color:' + corBorda + ';">' + badge + '</span>'
                    + '</div>'
                    + '<span style="font-size:12px;color:#555;"><b>Líquido:</b> ' + escapeHtmlBasico(formatarMoeda(h.liquido)) + '</span><br>'
                    + '<span style="font-size:12px;color:#888;">' + escapeHtmlBasico(dataRef) + '</span>'
                    + '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">'
                    + (isAssinado
                        ? '<button type="button" onclick="verComprovanteHoleriteAssinado(\'' + h.id + '\')" style="flex:1;min-width:140px;background:#4285F4;color:#fff;border:none;padding:10px;border-radius:8px;font-size:11px;font-weight:bold;cursor:pointer;">👁️ VER ASSINATURA + SELFIE</button>'
                        : '<button type="button" onclick="reenviarLinkHolerite(\'' + h.id + '\')" style="flex:1;min-width:140px;background:#25D366;color:#fff;border:none;padding:10px;border-radius:8px;font-size:11px;font-weight:bold;cursor:pointer;">🟢 REENVIAR LINK</button>')
                    + '<button type="button" onclick="excluirHoleriteAssinatura(\'' + h.id + '\')" style="flex:1;min-width:120px;background:#d9534f;color:#fff;border:none;padding:10px;border-radius:8px;font-size:11px;font-weight:bold;cursor:pointer;">🗑️ APAGAR</button>'
                    + '</div></div>';
            });
            divLista.innerHTML = html;
        } catch (e) {
            console.error(e);
            divLista.innerHTML = '<p style="text-align:center;color:#d9534f;">Erro ao buscar holerites.</p>';
        }
    };

    window.verComprovanteHoleriteAssinado = function (id) {
        const h = window.holeritesEncontrados[id];
        if (!h) return Swal.fire('Erro', 'Registro não encontrado.', 'error');
        const selfie = h.foto_assinatura || '';
        const assinatura = h.assinatura || '';
        Swal.fire({
            title: 'Comprovante de assinatura',
            width: 480,
            html: ''
                + '<div style="text-align:left;font-size:13px;margin-bottom:10px;">'
                + '<b>' + escapeHtmlBasico(h.nome || '') + '</b><br>'
                + 'Ref.: ' + escapeHtmlBasico(h.mes_nome || h.mes_ref || '') + '<br>'
                + 'Assinado em: ' + escapeHtmlBasico((h.data_assinatura || '') + (h.hora_assinatura ? ' às ' + h.hora_assinatura : '')) + '<br>'
                + 'Líquido: ' + escapeHtmlBasico(formatarMoeda(h.liquido))
                + '</div>'
                + '<div style="font-weight:700;margin:10px 0 6px;color:#1a2a43;">Selfie de comprovação</div>'
                + (selfie ? '<img src="' + selfie + '" style="width:100%;max-height:280px;object-fit:cover;border-radius:10px;border:2px solid #28a745;">' : '<p style="color:#d9534f;">Selfie não encontrada.</p>')
                + '<div style="font-weight:700;margin:14px 0 6px;color:#1a2a43;">Assinatura digital</div>'
                + (assinatura ? '<img src="' + assinatura + '" style="width:100%;max-height:140px;object-fit:contain;background:#fff;border:1px solid #ddd;border-radius:10px;">' : '<p style="color:#d9534f;">Assinatura não encontrada.</p>')
                + '<div style="margin-top:14px;max-height:220px;overflow:auto;border:1px solid #eee;border-radius:8px;padding:8px;background:#fafcff;">' + (h.texto || '') + '</div>',
            confirmButtonColor: '#1a2a43',
            confirmButtonText: 'Fechar'
        });
    };

    window.reenviarLinkHolerite = async function (id) {
        const h = window.holeritesEncontrados[id] || (await getDoc(doc(db, 'holerites_sistema', id))).data();
        if (!h) return Swal.fire('Erro', 'Holerite não encontrado.', 'error');
        const linkAssinatura = window.location.origin + window.location.pathname + '?holerite=' + id;
        const msgWhats = 'Olá ' + (h.nome || '') + ', acesse o link para assinar o holerite (' + (h.mes_nome || h.mes_ref || '') + '). Será necessário selfie + assinatura:\n\n' + linkAssinatura;
        const funcionario = window.listaFuncionarios && window.listaFuncionarios[h.funcionario_id];
        if (funcionario && funcionario.tel) {
            window.open('https://api.whatsapp.com/send?phone=55' + funcionario.tel + '&text=' + encodeURIComponent(msgWhats), '_blank');
        } else {
            navigator.clipboard.writeText(linkAssinatura);
            Swal.fire('Link copiado', 'Telefone não cadastrado — o link foi copiado.', 'info');
        }
    };

    window.excluirHoleriteAssinatura = function (id) {
        Swal.fire({
            title: 'Excluir holerite?',
            text: 'Isso apaga o registro, a assinatura e a selfie salvos.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d9534f',
            confirmButtonText: 'Sim, apagar'
        }).then(async function (result) {
            if (!result.isConfirmed) return;
            try {
                await deleteDoc(doc(db, 'holerites_sistema', id));
                buscarHoleritesAssinatura();
                Swal.fire('Excluído!', 'Registro removido.', 'success');
            } catch (e) {
                Swal.fire('Erro', 'Não foi possível apagar.', 'error');
            }
        });
    };

// ==========================================
    // MÓDULO: VALES E ADIANTAMENTOS
    // ==========================================

    function valeContaComoDescontoFolha(vale) {
        const s = String((vale && vale.status) || '').toLowerCase();
        return s === 'assinado' || s === 'assinado_manual' || !!(vale && vale.desconta_folha);
    }

    function valeEhAssinaturaManual(vale) {
        const s = String((vale && vale.status) || '').toLowerCase();
        const tipo = String((vale && (vale.assinatura_tipo || vale.origem)) || '').toLowerCase();
        return s === 'assinado_manual' || tipo === 'manual';
    }

    function dataIsoParaBrVale(iso) {
        if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
            const p = iso.split('-');
            return p[2] + '/' + p[1] + '/' + p[0];
        }
        const d = new Date();
        return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    }

    function preencherDataValePadrao() {
        const el = document.getElementById('p-data-vale');
        if (!el || el.value) return;
        const d = new Date();
        el.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    async function criarValeNoSistema(opcoes) {
        const opts = opcoes || {};
        const funcSelect = document.getElementById('p-func-select');
        const folhaSelect = document.getElementById('folha-func-select');
        const funcId = String(opts.funcId || (funcSelect && funcSelect.value) || '').trim();
        let funcNome = String(opts.funcNome || '').trim();
        if (!funcNome && funcSelect && funcSelect.value === funcId && funcSelect.selectedIndex >= 0) {
            funcNome = funcSelect.options[funcSelect.selectedIndex].text;
        }
        if (!funcNome && folhaSelect && folhaSelect.value === funcId && folhaSelect.selectedIndex >= 0) {
            funcNome = folhaSelect.options[folhaSelect.selectedIndex].text;
        }
        const valor = String(opts.valor != null ? opts.valor : ((document.getElementById('p-valor') && document.getElementById('p-valor').value) || '')).trim();
        const tipo = String(opts.tipo || ((document.getElementById('p-tipo') && document.getElementById('p-tipo').value) || 'Dinheiro')).trim();
        const desc = String(opts.desc != null ? opts.desc : ((document.getElementById('p-desc') && document.getElementById('p-desc').value) || '')).trim();
        const empresaLogada = getEmpresaGestor();
        const dataIso = String(opts.dataIso || ((document.getElementById('p-data-vale') && document.getElementById('p-data-vale').value) || '')).trim();
        if (!funcId || !valor || !desc) {
            await Swal.fire('Atenção', 'Selecione o funcionário, o valor e a descrição!', 'warning');
            return null;
        }
        const dataObj = new Date();
        const dataAtual = dataIsoParaBrVale(dataIso);
        const horaAtual = String(dataObj.getHours()).padStart(2, '0') + ':' + String(dataObj.getMinutes()).padStart(2, '0');
        const manual = !!opts.manual;
        const payload = {
            empresa_id: empresaLogada,
            funcionario_id: funcId,
            nome: funcNome,
            valor: valor,
            tipo: tipo,
            descricao: desc,
            status: manual ? 'assinado_manual' : 'pendente',
            assinatura_tipo: manual ? 'manual' : 'digital',
            origem: manual ? 'manual' : 'link',
            desconta_folha: manual,
            data_criacao: dataAtual,
            hora_criacao: horaAtual,
            data: dataAtual,
            timestamp: dataObj.getTime()
        };
        if (manual) {
            payload.data_assinatura = dataAtual;
            payload.hora_assinatura = horaAtual;
            payload.timestamp_assinatura = dataObj.getTime();
        }
        const docRef = await addDoc(collection(db, 'vales_sistema'), payload);
        const textoRecibo = 'Eu, <b>' + funcNome + '</b>, confirmo o recebimento do valor de <b>R$ ' + valor + '</b> em formato de <b>' + tipo + '</b>, referente a: <i>' + desc + '</i>.';
        await updateDoc(doc(db, 'vales_sistema', docRef.id), { texto: textoRecibo });
        const criado = Object.assign({ id: docRef.id, texto: textoRecibo }, payload);
        window.valesEncontrados = window.valesEncontrados || {};
        window.valesEncontrados[docRef.id] = criado;
        if (!opts.naoLimparForm) {
            const elValor = document.getElementById('p-valor');
            const elDesc = document.getElementById('p-desc');
            if (elValor) elValor.value = '';
            if (elDesc) elDesc.value = '';
        }
        return criado;
    }

    function dataIsoReferenciaFolha() {
        const mes = ((document.getElementById('folha-mes') && document.getElementById('folha-mes').value) || '').trim();
        const ano = Number((document.getElementById('folha-ano') && document.getElementById('folha-ano').value) || 0);
        const hoje = new Date();
        if (ano === hoje.getFullYear() && mes === String(hoje.getMonth() + 1).padStart(2, '0')) {
            return hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');
        }
        const ultimo = new Date(ano, Number(mes), 0).getDate();
        return ano + '-' + mes + '-' + String(ultimo).padStart(2, '0');
    }

    window.lancarValeManualNaFolha = async function () {
        const funcSelect = document.getElementById('folha-func-select');
        const funcId = funcSelect && funcSelect.value;
        const funcNome = (funcSelect && funcSelect.selectedIndex >= 0) ? funcSelect.options[funcSelect.selectedIndex].text : '';
        const valor = ((document.getElementById('folha-vale-valor') && document.getElementById('folha-vale-valor').value) || '').trim();
        const tipo = ((document.getElementById('folha-vale-tipo') && document.getElementById('folha-vale-tipo').value) || 'Dinheiro').trim();
        const desc = ((document.getElementById('folha-vale-desc') && document.getElementById('folha-vale-desc').value) || '').trim();
        if (!funcId) return Swal.fire('Atenção', 'Selecione o funcionário da folha.', 'warning');
        let criado = null;
        try {
            criado = await criarValeNoSistema({
                manual: true,
                naoLimparForm: true,
                funcId: funcId,
                funcNome: funcNome,
                valor: valor,
                tipo: tipo,
                desc: desc,
                dataIso: dataIsoReferenciaFolha()
            });
        } catch (e) {
            console.error(e);
            return Swal.fire('Erro', 'Não foi possível lançar o vale no holerite.', 'error');
        }
        if (!criado) return;
        const elValor = document.getElementById('folha-vale-valor');
        const elDesc = document.getElementById('folha-vale-desc');
        if (elValor) elValor.value = '';
        if (elDesc) elDesc.value = '';
        if (typeof window.listarValesManuaisDaFolha === 'function') {
            try { await window.listarValesManuaisDaFolha(); } catch (_) {}
        }
        if (typeof window.gerarFolhaPagamento === 'function') {
            try { await window.gerarFolhaPagamento(); } catch (_) {}
        }
        const result = await Swal.fire({
            title: 'Vale no holerite',
            html: 'O vale de <b>R$ ' + escapeHtmlBasico(String(criado.valor)) + '</b> já está descontando neste holerite.<br><br>Imprima para o funcionário assinar em papel.',
            icon: 'success',
            showCancelButton: true,
            confirmButtonText: '🖨️ Imprimir agora',
            cancelButtonText: 'Fechar',
            confirmButtonColor: '#1a2a43'
        });
        if (result.isConfirmed) await window.imprimirValeParaAssinaturaManual(criado.id);
    };

    window.listarValesManuaisDaFolha = async function () {
        const box = document.getElementById('folha-lista-vales-manuais');
        if (!box) return;
        const funcSelect = document.getElementById('folha-func-select');
        const funcId = funcSelect && funcSelect.value;
        if (!funcId) {
            box.innerHTML = '';
            return;
        }
        const mes = Number((document.getElementById('folha-mes') && document.getElementById('folha-mes').value) || 0);
        const ano = Number((document.getElementById('folha-ano') && document.getElementById('folha-ano').value) || 0);
        const empresaLogada = getEmpresaGestor();
        try {
            const qVales = query(collection(db, 'vales_sistema'), where('funcionario_id', '==', funcId));
            const snap = await getDocs(qVales);
            const lista = [];
            snap.forEach(function (d) {
                const vale = Object.assign({ id: d.id }, d.data() || {});
                if (vale.empresa_id !== empresaLogada) return;
                if (!valeContaComoDescontoFolha(vale) || !valeEhAssinaturaManual(vale)) return;
                const dataVale = separarDataSegura(vale.data_assinatura || vale.data_criacao || vale.data);
                if (Number(dataVale.mes) === mes && Number(dataVale.ano) === ano) lista.push(vale);
            });
            lista.sort(function (a, b) {
                return Number(b.timestamp_assinatura || b.timestamp || 0) - Number(a.timestamp_assinatura || a.timestamp || 0);
            });
            if (!lista.length) {
                box.innerHTML = '<p style="margin:10px 0 0;font-size:11px;color:#856404;line-height:1.4;text-decoration:none;font-weight:600;">Nenhum vale manual deste funcionário neste mês.</p>';
                return;
            }
            let html = '<div style="margin-top:12px;border-top:1px dashed #e0c36a;padding-top:10px;">'
                + '<b style="font-size:12px;color:#5c4a00;display:block;margin-bottom:8px;">Vales manuais deste holerite (' + lista.length + ') — clique em Excluir se lançou em duplicidade</b>';
            lista.forEach(function (v) {
                const hora = v.hora_assinatura || v.hora_criacao || '';
                const dataTxt = v.data_assinatura || v.data_criacao || v.data || '';
                html += '<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;background:#fff;border:1px solid #ffe08a;border-radius:8px;padding:8px 10px;margin-bottom:6px;flex-wrap:wrap;">'
                    + '<div style="flex:1;min-width:160px;font-size:12px;color:#333;line-height:1.35;font-weight:600;">'
                    + '<b>R$ ' + escapeHtmlBasico(String(v.valor || '0')) + '</b> · ' + escapeHtmlBasico(v.tipo || '') + '<br>'
                    + '<span style="color:#666;font-weight:500;">' + escapeHtmlBasico(dataTxt) + (hora ? ' às ' + escapeHtmlBasico(hora) : '')
                    + (v.descricao ? ' — ' + escapeHtmlBasico(v.descricao) : '') + '</span>'
                    + '</div>'
                    + '<button type="button" class="btn-excluir-vale-folha" onclick="excluirValeManualDaFolha(\'' + String(v.id).replace(/'/g, '') + '\')" style="background:#d9534f;color:#fff;border:none;border-radius:8px;padding:8px 12px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">🗑️ Excluir</button>'
                    + '</div>';
            });
            html += '</div>';
            box.innerHTML = html;
        } catch (e) {
            console.error(e);
            box.innerHTML = '<p style="margin:10px 0 0;font-size:11px;color:#d9534f;">Não foi possível listar os vales manuais.</p>';
        }
    };

    window.excluirValeManualDaFolha = async function (id) {
        if (!id) return;
        const ok = await Swal.fire({
            title: 'Excluir vale manual?',
            html: 'O vale será apagado e <b>sai do desconto deste holerite</b>. Esta ação não pode ser desfeita.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d9534f',
            cancelButtonColor: '#1a2a43',
            confirmButtonText: 'Sim, excluir',
            cancelButtonText: 'Cancelar'
        });
        if (!ok.isConfirmed) return;
        try {
            await deleteDoc(doc(db, 'vales_sistema', id));
            if (window.valesEncontrados && window.valesEncontrados[id]) delete window.valesEncontrados[id];
            if (typeof window.listarValesManuaisDaFolha === 'function') await window.listarValesManuaisDaFolha();
            const resultado = document.getElementById('resultado-folha');
            if (resultado && resultado.style.display !== 'none' && typeof window.gerarFolhaPagamento === 'function') {
                await window.gerarFolhaPagamento();
            }
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Vale excluído do holerite', showConfirmButton: false, timer: 2200 });
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível excluir o vale.', 'error');
        }
    };

    ['folha-func-select', 'folha-mes', 'folha-ano'].forEach(function (idEl) {
        const el = document.getElementById(idEl);
        if (!el || el._valeManualListaBound) return;
        el._valeManualListaBound = true;
        el.addEventListener('change', function () {
            if (typeof window.listarValesManuaisDaFolha === 'function') window.listarValesManuaisDaFolha();
        });
    });

    window.imprimirValesDoHolerite = async function () {
        const funcSelect = document.getElementById('folha-func-select');
        const funcId = funcSelect && funcSelect.value;
        if (!funcId) return Swal.fire('Atenção', 'Selecione o funcionário da folha.', 'warning');
        const mes = Number((document.getElementById('folha-mes') && document.getElementById('folha-mes').value) || 0);
        const ano = Number((document.getElementById('folha-ano') && document.getElementById('folha-ano').value) || 0);
        try {
            const qVales = query(collection(db, 'vales_sistema'), where('funcionario_id', '==', funcId));
            const snap = await getDocs(qVales);
            const lista = [];
            snap.forEach(function (d) {
                const vale = Object.assign({ id: d.id }, d.data() || {});
                if (!valeContaComoDescontoFolha(vale) && String(vale.status || '').toLowerCase() !== 'pendente') return;
                const dataVale = separarDataSegura(vale.data_assinatura || vale.data_criacao || vale.data);
                if (Number(dataVale.mes) === mes && Number(dataVale.ano) === ano) lista.push(vale);
            });
            if (!lista.length) return Swal.fire('Atenção', 'Não há vales deste funcionário neste mês para imprimir.', 'info');
            lista.sort(function (a, b) {
                return Number(a.timestamp || a.timestamp_assinatura || 0) - Number(b.timestamp || b.timestamp_assinatura || 0);
            });
            const w = window.open('', '_blank');
            if (!w) return Swal.fire('Atenção', 'O navegador bloqueou a janela de impressão. Permita pop-ups.', 'warning');
            w.document.open();
            w.document.write(htmlDocumentoImpressaoVales(lista));
            w.document.close();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível imprimir os vales.', 'error');
        }
    };

    function htmlBlocoValeImpressao(dados) {
        const empresa = escapeHtmlBasico(dados.empresa_id || getEmpresaGestor() || 'Empresa');
        const nome = escapeHtmlBasico(dados.nome || '');
        const valor = escapeHtmlBasico(String(dados.valor || '0'));
        const tipo = escapeHtmlBasico(dados.tipo || '');
        const data = escapeHtmlBasico(dados.data_criacao || dados.data || '');
        const desc = escapeHtmlBasico(dados.descricao || '');
        const texto = dados.texto || ('Eu, <b>' + nome + '</b>, confirmo o recebimento do valor de <b>R$ ' + valor + '</b> em formato de <b>' + tipo + '</b>, referente a: <i>' + desc + '</i>.');
        return '<div class="quebra">'
            + '<div class="folha"><div class="via">Via da empresa</div><h1>' + empresa + '</h1><div class="sub">RECIBO DE VALE / ADIANTAMENTO — ASSINATURA MANUAL</div>'
            + '<p><b>Data:</b> ' + data + ' &nbsp; <b>Tipo:</b> ' + tipo + ' &nbsp; <b>Valor:</b> R$ ' + valor + '</p>'
            + '<p style="text-align:justify;line-height:1.55;font-size:15px;">' + texto + '</p>'
            + '<p style="font-size:12px;color:#444;">Este vale foi lançado no holerite. O funcionário assina abaixo em papel, por não utilizar a assinatura no celular.</p>'
            + '<div class="linha-ass"><div class="risco"></div><div><b>' + nome + '</b></div><div style="font-size:12px;">Assinatura do funcionário</div></div></div>'
            + '<div style="height:18px;"></div>'
            + '<div class="folha"><div class="via">Via do funcionário</div><h1>' + empresa + '</h1><div class="sub">RECIBO DE VALE / ADIANTAMENTO — ASSINATURA MANUAL</div>'
            + '<p><b>Data:</b> ' + data + ' &nbsp; <b>Tipo:</b> ' + tipo + ' &nbsp; <b>Valor:</b> R$ ' + valor + '</p>'
            + '<p style="text-align:justify;line-height:1.55;font-size:15px;">' + texto + '</p>'
            + '<div class="linha-ass"><div class="risco"></div><div><b>' + nome + '</b></div><div style="font-size:12px;">Assinatura do funcionário</div></div></div>'
            + '</div>';
    }

    function htmlDocumentoImpressaoVales(lista) {
        const corpos = (lista || []).map(function (v) { return htmlBlocoValeImpressao(v); }).join('');
        return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Vale para assinatura</title>'
            + '<style>body{font-family:Arial,sans-serif;color:#111;margin:0;padding:18px;} .folha{max-width:720px;margin:0 auto;border:1px solid #333;padding:22px 24px;} h1{font-size:18px;margin:0 0 4px;text-align:center;} .sub{text-align:center;font-size:12px;color:#444;margin-bottom:18px;} .linha-ass{margin-top:48px;text-align:center;} .risco{border-top:1px solid #111;width:70%;margin:40px auto 6px;} .via{font-size:11px;color:#666;margin-top:8px;text-align:right;} .quebra{page-break-after:always;} .quebra:last-child{page-break-after:auto;} @media print { body{padding:0;} .no-print{display:none;} .folha{border:none;} }</style></head><body>'
            + '<div class="no-print" style="text-align:center;margin-bottom:12px;"><button onclick="window.print()" style="padding:10px 18px;font-weight:700;cursor:pointer;">Imprimir</button></div>'
            + corpos
            + '<script>setTimeout(function(){window.print();},400);<\/script></body></html>';
    }

    function htmlImpressaoValeManual(dados) {
        return htmlDocumentoImpressaoVales([dados]);
    }

    window.imprimirValeParaAssinaturaManual = async function (id) {
        try {
            const dados = await obterDadosValePorId(id);
            if (!dados) return Swal.fire('Erro', 'Vale não encontrado.', 'error');
            const w = window.open('', '_blank');
            if (!w) return Swal.fire('Atenção', 'O navegador bloqueou a janela de impressão. Permita pop-ups.', 'warning');
            w.document.open();
            w.document.write(htmlImpressaoValeManual(dados));
            w.document.close();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível montar a impressão.', 'error');
        }
    };

    window.marcarValeAssinadoPapel = async function (id) {
        const ok = await Swal.fire({
            title: 'Assinado em papel?',
            html: 'Confirma que o funcionário assinou o vale no papel? O valor <b>passa a descontar no holerite</b>.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sim, descontar no holerite',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1a2a43'
        });
        if (!ok.isConfirmed) return;
        const agora = new Date();
        const dataBr = String(agora.getDate()).padStart(2, '0') + '/' + String(agora.getMonth() + 1).padStart(2, '0') + '/' + agora.getFullYear();
        const hora = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
        try {
            await updateDoc(doc(db, 'vales_sistema', id), {
                status: 'assinado_manual',
                assinatura_tipo: 'manual',
                desconta_folha: true,
                data_assinatura: dataBr,
                hora_assinatura: hora,
                timestamp_assinatura: agora.getTime()
            });
            if (window.valesEncontrados && window.valesEncontrados[id]) {
                window.valesEncontrados[id].status = 'assinado_manual';
                window.valesEncontrados[id].desconta_folha = true;
            }
            Swal.fire('Pronto', 'Vale lançado no holerite (assinatura em papel).', 'success');
            if (typeof window.buscarVales === 'function') window.buscarVales();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível confirmar o vale.', 'error');
        }
    };

    const btnGerarLinkEl = document.getElementById('btnGerarLink');
    if (btnGerarLinkEl) btnGerarLinkEl.onclick = async function() {
        const btn = document.getElementById('btnGerarLink');
        btn.innerText = '⏳ A GERAR LINK...';
        btn.disabled = true;
        try {
            const criado = await criarValeNoSistema({ manual: false });
            if (!criado) return;
            const linkAssinatura = window.location.origin + window.location.pathname + '?id=' + criado.id;
            const msgWhats = 'Olá ' + criado.nome + ', acesse o link abaixo para assinar digitalmente o seu vale de R$ ' + criado.valor + ' (' + criado.tipo + '):\n\n' + linkAssinatura;
            Swal.fire({
                title: 'Vale Gerado!',
                text: 'O link de assinatura está pronto.',
                icon: 'success',
                showCancelButton: true,
                confirmButtonColor: '#25D366',
                cancelButtonColor: '#1a2a43',
                confirmButtonText: '🟢 Enviar no WhatsApp',
                cancelButtonText: 'Copiar Link'
            }).then((result) => {
                if (result.isConfirmed) {
                    const funcionario = window.listaFuncionarios[criado.funcionario_id];
                    if (funcionario && funcionario.tel) {
                        window.open('https://api.whatsapp.com/send?phone=55' + funcionario.tel + '&text=' + encodeURIComponent(msgWhats), '_blank');
                    } else {
                        Swal.fire('Aviso', 'Este funcionário não tem telefone cadastrado. Copie o link manualmente.', 'info');
                    }
                } else {
                    navigator.clipboard.writeText(linkAssinatura);
                    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Link Copiado!', showConfirmButton: false, timer: 2000 });
                }
            });
        } catch (e) {
            Swal.fire('Erro', 'Falha ao gerar o vale.', 'error');
        } finally {
            btn.innerText = 'GERAR VALE E ENVIAR LINK';
            btn.disabled = false;
        }
    };

    const btnValeManualHoleriteEl = document.getElementById('btnValeManualHolerite');
    if (btnValeManualHoleriteEl) btnValeManualHoleriteEl.onclick = async function () {
        const btn = document.getElementById('btnValeManualHolerite');
        const txt = btn.innerText;
        btn.innerText = '⏳ LANÇANDO...';
        btn.disabled = true;
        try {
            const criado = await criarValeNoSistema({ manual: true });
            if (!criado) return;
            const result = await Swal.fire({
                title: 'Vale no holerite',
                html: 'O vale de <b>R$ ' + escapeHtmlBasico(String(criado.valor)) + '</b> já desconta na folha, mesmo sem assinatura no celular.<br><br>Imprima para o funcionário assinar em papel.',
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: '🖨️ Imprimir agora',
                cancelButtonText: 'Fechar',
                confirmButtonColor: '#1a2a43'
            });
            if (result.isConfirmed) await window.imprimirValeParaAssinaturaManual(criado.id);
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Falha ao lançar o vale manual.', 'error');
        } finally {
            btn.innerText = txt;
            btn.disabled = false;
        }
    };

    const btnImprimirValePapelEl = document.getElementById('btnImprimirValePapel');
    if (btnImprimirValePapelEl) btnImprimirValePapelEl.onclick = async function () {
        const btn = document.getElementById('btnImprimirValePapel');
        const txt = btn.innerText;
        btn.innerText = '⏳ PREPARANDO...';
        btn.disabled = true;
        try {
            const criado = await criarValeNoSistema({ manual: true });
            if (!criado) return;
            await window.imprimirValeParaAssinaturaManual(criado.id);
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Falha ao gerar o vale para impressão.', 'error');
        } finally {
            btn.innerText = txt;
            btn.disabled = false;
        }
    };

    function obterDataReferenciaValeArquivo(v) {
        const isAssinado = valeContaComoDescontoFolha(v);
        if (isAssinado) {
            const dataStr = v.data_assinatura || v.data_assinado || v.data_criacao || v.data || '';
            const horaStr = v.hora_assinatura || v.hora_assinado || v.hora_criacao || '';
            const ts = v.timestamp_assinatura || v.timestamp || 0;
            const partes = separarDataSegura(dataStr);
            return {
                ano: partes.ano,
                mes: partes.mes,
                dia: partes.dia,
                dataStr,
                horaStr,
                ts,
                rotuloData: valeEhAssinaturaManual(v) ? 'Lançado no holerite em' : 'Assinado em'
            };
        }
        const dataStr = v.data_criacao || v.data || '';
        const horaStr = v.hora_criacao || '';
        const partes = separarDataSegura(dataStr);
        return {
            ano: partes.ano,
            mes: partes.mes,
            dia: partes.dia,
            dataStr,
            horaStr,
            ts: v.timestamp || 0,
            rotuloData: 'Gerado em'
        };
    }

    function montarHtmlCardValeArquivo(v) {
        const isAssinado = valeContaComoDescontoFolha(v);
        const manual = valeEhAssinaturaManual(v);
        const corBorda = isAssinado ? '#28a745' : '#f0ad4e';
        const badge = isAssinado ? (manual ? '📝 HOLERITE (PAPEL)' : '✅ ASSINADO') : '⏳ PENDENTE';
        const ref = obterDataReferenciaValeArquivo(v);
        const horaHtml = ref.horaStr ? ' às ' + ref.horaStr : '';
        return `
            <div class="resultado-item" style="border-left-color: ${corBorda}; background: ${isAssinado ? '#f8fff9' : '#fff'};">
                <div style="display:flex; justify-content: space-between; align-items:center;">
                    <b style="color:var(--dark-navy); font-size:16px;">R$ ${v.valor}</b>
                    <span style="font-size: 10px; font-weight:bold; background:#eef2f5; padding:4px 8px; border-radius:5px; color:${corBorda}">${badge}</span>
                </div>
                <span style="font-size: 12px; color: #555;"><b>Tipo:</b> ${v.tipo}</span><br>
                <span style="font-size: 12px; color: #888;"><b>${ref.rotuloData}:</b> ${ref.dataStr}${horaHtml}</span><br>
                <div style="margin-top: 5px; font-size: 12px; color: #444;"><i>${v.descricao}</i></div>
                <div style="display: flex; gap: 8px; margin-top: 15px; flex-wrap: wrap;">
                    ${isAssinado 
                        ? `<button type="button" onclick="abrirReciboValeTela('${v.id}')" style="flex:1; min-width:120px; background:#4285F4; color:white; border:none; padding:10px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">👁️ VER NA TELA</button>
                           <button type="button" onclick="imprimirValeParaAssinaturaManual('${v.id}')" style="flex:1; min-width:120px; background:#6c757d; color:white; border:none; padding:10px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">🖨️ IMPRIMIR</button>
                           <button type="button" onclick="visualizarReciboValePdf('${v.id}')" style="flex:1; min-width:120px; background:#217346; color:white; border:none; padding:10px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">📄 ABRIR PDF</button>
                           <button type="button" onclick="baixarReciboValePdf('${v.id}')" style="flex:1; min-width:120px; background:#1a2a43; color:white; border:none; padding:10px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">📥 BAIXAR PDF</button>
                           <button type="button" onclick="compartilharReciboValeWhats('${v.id}')" style="flex:1; min-width:120px; background:#25D366; color:white; border:none; padding:10px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">🟢 WHATSAPP</button>` 
                        : `<button type="button" onclick="abrirReciboValeTela('${v.id}')" style="flex:1; min-width:120px; background:#4285F4; color:white; border:none; padding:10px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">👁️ VER TEXTO</button>
                           <button type="button" onclick="imprimirValeParaAssinaturaManual('${v.id}')" style="flex:1; min-width:120px; background:#1a2a43; color:white; border:none; padding:10px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">🖨️ IMPRIMIR PARA ASSINAR</button>
                           <button type="button" onclick="marcarValeAssinadoPapel('${v.id}')" style="flex:1; min-width:120px; background:#d4a017; color:#1a2a43; border:none; padding:10px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">✔ ASSINADO EM PAPEL</button>
                           <button type="button" onclick="reenviarLinkVale('${v.id}')" style="flex:1; min-width:120px; background:#25D366; color:white; border:none; padding:10px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">🟢 REENVIAR LINK</button>`}
                    <button type="button" onclick="excluirVale('${v.id}')" style="flex:1; min-width:120px; background:#d9534f; color:white; border:none; padding:10px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">🗑️ APAGAR</button>
                </div>
            </div>
        `;
    }

    function montarHtmlPastasValesArquivo(arr) {
        const pendentes = [];
        const agrupado = {};
        let totalVales = 0;

        arr.forEach((v) => {
            window.dadosExportacaoVales.push(v);
            window.valesEncontrados[v.id] = v;
            const isAssinado = valeContaComoDescontoFolha(v);
            if (!isAssinado) {
                pendentes.push(v);
                return;
            }
            totalVales += parseMoedaLocal(v.valor);
            const ref = obterDataReferenciaValeArquivo(v);
            const ano = ref.ano || 'Outros';
            const mes = ref.mes || 'Outros';
            if (!agrupado[ano]) agrupado[ano] = {};
            if (!agrupado[ano][mes]) agrupado[ano][mes] = [];
            agrupado[ano][mes].push(v);
        });

        let html = '';

        if (pendentes.length) {
            pendentes.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            html += `<details class="pasta-ano" open><summary>⏳ Pendentes (ainda não descontam) (${pendentes.length})</summary><div class="folder-content">`;
            pendentes.forEach((v) => { html += montarHtmlCardValeArquivo(v); });
            html += `</div></details>`;
        }

        const chavesAno = Object.keys(agrupado).sort((a, b) => {
            if (a === 'Outros') return 1;
            if (b === 'Outros') return -1;
            return Number(b) - Number(a);
        });

        chavesAno.forEach((ano) => {
            html += `<details class="pasta-ano" open><summary>📅 Ano ${ano}</summary><div class="folder-content">`;
            const chavesMes = Object.keys(agrupado[ano]).sort((a, b) => {
                if (a === 'Outros') return 1;
                if (b === 'Outros') return -1;
                return Number(b) - Number(a);
            });
            chavesMes.forEach((mes) => {
                const listaMes = agrupado[ano][mes].slice().sort((a, b) => {
                    const ta = obterDataReferenciaValeArquivo(a).ts || 0;
                    const tb = obterDataReferenciaValeArquivo(b).ts || 0;
                    return tb - ta;
                });
                const nomeDoMes = nomeMeses[mes] || mes;
                let subtotalMes = 0;
                listaMes.forEach((v) => { subtotalMes += parseMoedaLocal(v.valor); });
                html += `<details class="pasta-mes"><summary>${nomeDoMes} — ${listaMes.length} vale(s) · ${formatarMoeda(subtotalMes)}</summary><div class="folder-content">`;
                listaMes.forEach((v) => { html += montarHtmlCardValeArquivo(v); });
                html += `</div></details>`;
            });
            html += `</div></details>`;
        });

        return { html, totalVales };
    }

    window.buscarVales = async function() {
        const funcId = document.getElementById('b-func-select').value;
        const empresaLogada = getEmpresaGestor();

        if (!funcId) {
            return Swal.fire('Atenção', 'Selecione um funcionário para buscar.', 'warning');
        }

        const divLista = document.getElementById('lista-resultados');
        const btnExportar = document.getElementById('btnExportarVales');
        
        divLista.innerHTML = "Buscando...";
        btnExportar.style.display = 'none';
        window.dadosExportacaoVales = [];
        window.valesEncontrados = {};

        try {
            const q = query(collection(db, "vales_sistema"), where("funcionario_id", "==", funcId), where("empresa_id", "==", empresaLogada));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                divLista.innerHTML = `<p style="text-align:center; color:#d9534f;">Nenhum vale encontrado.</p>`;
                return;
            }

            let arr = [];
            querySnapshot.forEach(doc => {
                let d = doc.data();
                d.id = doc.id;
                arr.push(d);
            });

            arr.sort((a, b) => {
                const ta = obterDataReferenciaValeArquivo(a).ts || 0;
                const tb = obterDataReferenciaValeArquivo(b).ts || 0;
                return tb - ta;
            });

            const { html, totalVales } = montarHtmlPastasValesArquivo(arr);

            btnExportar.style.display = 'block';
            divLista.innerHTML = `<div style="text-align:center; margin-bottom: 15px; padding: 10px; background: #eef2f5; border-radius: 10px;">Total em Vales no holerite: <b style="color:#d9534f; font-size:16px;">${formatarMoeda(totalVales)}</b><br><span style="font-size:11px;color:#666;">Assinados no celular e lançados manualmente (papel)</span></div>` + html;

        } catch (e) {
            divLista.innerHTML = `<p style="text-align:center; color:#d9534f;">Erro ao buscar vales.</p>`;
        }
    };

    window.reenviarLinkVale = function(id) {
        const v = window.valesEncontrados[id];
        const linkAssinatura = `${window.location.origin}${window.location.pathname}?id=${id}`;
        const msgWhats = `Olá ${v.nome}, você tem um vale pendente de assinatura no valor de R$ ${v.valor} (${v.tipo}). Acesse o link para assinar:\n\n${linkAssinatura}`;
        
        const funcionario = window.listaFuncionarios[v.funcionario_id];
        if (funcionario && funcionario.tel) {
            window.open(`https://api.whatsapp.com/send?phone=55${funcionario.tel}&text=${encodeURIComponent(msgWhats)}`, '_blank');
        } else {
            navigator.clipboard.writeText(linkAssinatura);
            Swal.fire('Copiado', 'Funcionário sem telefone. Link copiado para a área de transferência.', 'info');
        }
    };

    window.excluirVale = function(id) {
        Swal.fire({
            title: 'Apagar Vale?',
            text: "Deseja apagar este vale? Ele será removido da folha de pagamento.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d9534f',
            cancelButtonColor: '#1a2a43',
            confirmButtonText: 'Sim, apagar!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(db, "vales_sistema", id));
                    Swal.fire('Apagado!', 'Vale removido com sucesso.', 'success');
                    if (typeof buscarVales === 'function') buscarVales();
                    if (typeof window.listarValesManuaisDaFolha === 'function') window.listarValesManuaisDaFolha();
                    const resultadoFolha = document.getElementById('resultado-folha');
                    if (resultadoFolha && resultadoFolha.style.display !== 'none' && typeof window.gerarFolhaPagamento === 'function') {
                        window.gerarFolhaPagamento();
                    }
                } catch(e) {
                    Swal.fire('Erro', 'Não foi possível apagar.', 'error');
                }
            }
        });
    };

   // ==========================================
    // MÓDULO: MEUS VALES (VISÃO FUNCIONÁRIO)
    // ==========================================
    window.abrirTelaMeusVales = function() {
        document.querySelectorAll('.main-card').forEach(card => card.style.display = 'none');
        document.getElementById('tela-meus-vales').style.display = 'block';
        buscarMeusVales(); // Puxa os dados automaticamente ao abrir
    };

    window.voltarTelaRelogioDeVales = function() {
        document.querySelectorAll('.main-card').forEach(card => card.style.display = 'none');
        document.getElementById('tela-relogio').style.display = 'block';
        if (typeof atualizarUiBotoesPontoDia === 'function') atualizarUiBotoesPontoDia(false);
    };

    window.buscarMeusVales = async function() {
        const funcId = getSessaoFunc('funcLogadoId');
        const divLista = document.getElementById('lista-meus-vales');
        
        if (!funcId) return;
        
        divLista.innerHTML = "Buscando os seus vales...";
        window.valesEncontrados = {}; 

        try {
            // Busca os vales onde o funcionario_id é igual ao ID de quem está logado
            const q = query(collection(db, "vales_sistema"), where("funcionario_id", "==", funcId));
            const snap = await getDocs(q);

            if (snap.empty) {
                divLista.innerHTML = `<p style="text-align:center; color:#888;">Você não possui nenhum vale ou produto registrado.</p>`;
                return;
            }

            let arr = [];
            snap.forEach(doc => arr.push({id: doc.id, ...doc.data()}));
            arr.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            let html = "";
            let totalAssinado = 0;

            arr.forEach(v => {
                window.valesEncontrados[v.id] = v;

                const isAssinado = valeContaComoDescontoFolha(v);
                const manual = valeEhAssinaturaManual(v);
                const corBorda = isAssinado ? '#28a745' : '#f0ad4e';
                const badge = isAssinado ? (manual ? '📝 HOLERITE (PAPEL)' : '✅ ASSINADO') : '⏳ PENDENTE';
                
                if(isAssinado) totalAssinado += parseMoedaLocal(v.valor);

                html += `
                    <div class="resultado-item" style="border-left-color: ${corBorda}; background: ${isAssinado ? '#f8fff9' : '#fff'};">
                        <div style="display:flex; justify-content: space-between; align-items:center;">
                            <b style="color:var(--dark-navy); font-size:16px;">R$ ${v.valor}</b>
                            <span style="font-size: 10px; font-weight:bold; background:#eef2f5; padding:4px 8px; border-radius:5px; color:${corBorda}">${badge}</span>
                        </div>
                        <span style="font-size: 12px; color: #555;"><b>Tipo:</b> ${v.tipo}</span><br>
                        <span style="font-size: 12px; color: #888;"><b>Data:</b> ${v.data_criacao || v.data} ${v.hora_criacao ? 'às '+v.hora_criacao : ''}</span><br>
                        <div style="margin-top: 5px; font-size: 12px; color: #444;"><i>${v.descricao}</i></div>
                        
                        <div style="display: flex; gap: 8px; margin-top: 15px; flex-wrap: wrap;">
                            ${isAssinado 
                                ? `<button type="button" onclick="abrirReciboValeTela('${v.id}')" style="flex:1; min-width:120px; background:#4285F4; color:white; border:none; padding:10px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">👁️ VER NA TELA</button>
                                   <button type="button" onclick="imprimirValeParaAssinaturaManual('${v.id}')" style="flex:1; min-width:120px; background:#6c757d; color:white; border:none; padding:10px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">🖨️ IMPRIMIR</button>
                                   <button type="button" onclick="visualizarReciboValePdf('${v.id}')" style="flex:1; min-width:120px; background:#217346; color:white; border:none; padding:10px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">📄 ABRIR PDF</button>
                                   <button type="button" onclick="baixarReciboValePdf('${v.id}')" style="flex:1; min-width:120px; background:#1a2a43; color:white; border:none; padding:10px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">📥 BAIXAR PDF</button>` 
                                : `<button type="button" onclick="window.location.href='?id=${v.id}'" style="flex:1; min-width:120px; background:#d4a017; color:var(--dark-navy); border:none; padding:10px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">✍️ ASSINAR AGORA</button>
                                   <button type="button" onclick="imprimirValeParaAssinaturaManual('${v.id}')" style="flex:1; min-width:120px; background:#1a2a43; color:white; border:none; padding:10px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">🖨️ IMPRIMIR</button>
                                   <button type="button" onclick="abrirReciboValeTela('${v.id}')" style="flex:1; min-width:120px; background:#4285F4; color:white; border:none; padding:10px; border-radius:8px; font-size:11px; font-weight:bold; cursor:pointer;">👁️ VER TEXTO</button>`}
                        </div>
                    </div>
                `;
            });

            divLista.innerHTML = `<div style="text-align:center; margin-bottom: 15px; padding: 10px; background: #eef2f5; border-radius: 10px;">Total no holerite: <b style="color:#28a745; font-size:16px;">${formatarMoeda(totalAssinado)}</b></div>` + html;

        } catch (e) {
            divLista.innerHTML = `<p style="text-align:center; color:#d9534f;">Erro ao buscar seus vales. Tente novamente.</p>`;
        }
    };

    window.gerarPdfFuncionario = async function(id) {
        await window.baixarReciboValePdf(id);
    };

    window.checarNovosPedidosManutencao = async function() {
        if (typeof monitorarPedidosMaterialGestor === 'function') {
            await monitorarPedidosMaterialGestor();
        }
    };

            window.buscarPedidosMaterial = async function() {
        // ADICIONA O EFEITO PISCANTE VIA JAVASCRIPT PARA NÃO PRECISAR MEXER LÁ EM CIMA NO CSS
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

        const divLista = document.getElementById('lista-pedidos-resultados');
        divLista.innerHTML = "Carregando...";

        try {
            const empresaGestor = (typeof getEmpresaGestor === 'function' ? getEmpresaGestor() : '') || 'MANUTENÇÃO';
            const q = query(collection(db, "pedidos_material"), where("empresa_id", "==", empresaGestor));
            const snap = await getDocs(q);

            if (snap.empty) {
                divLista.innerHTML = `<p style="text-align:center; color:#888;">Nenhum pedido registrado.</p>`;
                return;
            }

            let arr = [];
            snap.forEach(doc => arr.push({id: doc.id, ...doc.data()}));
            arr.sort((a, b) => b.timestamp - a.timestamp); // Mais recentes primeiro

            let html = "";
            arr.forEach(p => {
                const isNovo = p.status === 'novo';
                const isAnalise = p.status === 'analise';
                
                // Cores dinâmicas baseadas no status
                const corBorda = isNovo ? '#d9534f' : (isAnalise ? '#f0ad4e' : '#1a2a43');
                
                let badgeHTML = '';
                if (isNovo) {
                    badgeHTML = `<span class="badge-piscar">🚨 NOVO</span>`;
                } else if (isAnalise) {
                    badgeHTML = `<span style="font-size: 10px; font-weight:bold; background:#fcf8e3; color:#8a6d3b; padding:4px 8px; border-radius:5px;">⏳ EM ANÁLISE</span>`;
                } else {
                    badgeHTML = `<span style="font-size: 10px; font-weight:bold; background:#eef2f5; padding:4px 8px; border-radius:5px;">${p.status.toUpperCase()}</span>`;
                }

                html += `
                    <div class="resultado-item" style="border-left-color: ${corBorda}; background: #fff;">
                        <div style="display:flex; justify-content: space-between; align-items:center;">
                            <b style="color:var(--dark-navy); font-size:15px;">${p.nome}</b>
                            ${badgeHTML}
                        </div>
                        <span style="font-size: 12px; color: #555;"><b>Equipe/Obra:</b> ${p.equipe}</span><br>
                        <span style="font-size: 12px; color: #888;"><b>Data:</b> ${p.data} às ${p.hora}</span><br>
                        
                        <div style="margin-top: 10px; padding: 10px; background: #fafcff; border: 1px dashed #ccc; border-radius: 8px; font-size: 13px; white-space: pre-wrap; color: #333;">${p.descricao}</div>

                        <div style="display: flex; gap: 8px; margin-top: 15px;">
                            <button onclick="pdfPedidoMaterial('${p.id}')" style="flex:1; background: #1a2a43; color: white; border: none; padding: 10px; border-radius: 8px; font-size: 11px; font-weight: bold; cursor:pointer;">📄 PDF</button>
                            
                            ${isNovo ? `<button onclick="marcarEmAnalise('${p.id}')" style="flex:1; background: #f0ad4e; color: white; border: none; padding: 10px; border-radius: 8px; font-size: 11px; font-weight: bold; cursor:pointer;">⏳ EM ANÁLISE</button>` : ''}
                            
                            <button onclick="marcarPedidoPronto('${p.id}')" style="flex:1; background: #28a745; color: white; border: none; padding: 10px; border-radius: 8px; font-size: 11px; font-weight: bold; cursor:pointer;">✅ ENTREGUE</button>
                            
                            <button onclick="excluirPedidoMaterial('${p.id}')" style="flex:1; background: #d9534f; color: white; border: none; padding: 10px; border-radius: 8px; font-size: 11px; font-weight: bold; cursor:pointer;">🗑️ EXCLUIR</button>
                        </div>
                    </div>
                `;
            });
            divLista.innerHTML = html;
            window.dadosPedidosMateriais = arr; // Salva para o gerador de PDF

        } catch(e) { divLista.innerHTML = `<p style="text-align:center; color:#d9534f;">Erro ao buscar pedidos.</p>`; }
    };

    window.marcarEmAnalise = async function(id) {
        try {
            await updateDoc(doc(db, "pedidos_material", id), { status: 'analise' });
            Swal.fire({toast:true, position:'top-end', icon:'info', title:'Status alterado para EM ANÁLISE!', showConfirmButton:false, timer:2000});
            buscarPedidosMaterial();
            if (typeof monitorarPedidosMaterialGestor === 'function') monitorarPedidosMaterialGestor();
        } catch(e) { Swal.fire('Erro', 'Não foi possível atualizar.', 'error'); }
    };

    window.marcarPedidoPronto = async function(id) {
        Swal.fire({
            title: 'Confirmar Entrega?',
            text: "Você confirma que o material deste pedido foi realmente entregue para a equipe?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#d9534f',
            confirmButtonText: 'Sim, foi entregue!',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    // Exclui o pedido do banco de dados automaticamente
                    await deleteDoc(doc(db, "pedidos_material", id));
                    
                    Swal.fire('Entregue!', 'O pedido foi marcado como entregue e removido da tela.', 'success');
                    buscarPedidosMaterial();
                    if (typeof monitorarPedidosMaterialGestor === 'function') monitorarPedidosMaterialGestor();
                } catch(e) { 
                    Swal.fire('Erro', 'Não foi possível confirmar a entrega.', 'error'); 
                }
            }
        });
    };

    window.excluirPedidoMaterial = function(id) {
        Swal.fire({
            title: 'Excluir Pedido?', text: "Deseja apagar permanentemente?", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#d9534f', confirmButtonText: 'Sim, apagar!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(db, "pedidos_material", id));
                    buscarPedidosMaterial();
                    if (typeof monitorarPedidosMaterialGestor === 'function') monitorarPedidosMaterialGestor();
                    Swal.fire('Excluído!', 'O pedido foi removido.', 'success');
                } catch(e) { Swal.fire('Erro', 'Não foi possível apagar.', 'error'); }
            }
        });
    };

    window.pdfPedidoMaterial = function(id) {
        const pedido = window.dadosPedidosMateriais.find(p => p.id === id);
        if(!pedido) return;

        const { jsPDF } = window.jspdf;
        const docPdf = new jsPDF('p', 'mm', 'a4');

        // Cabeçalho PDF
        docPdf.setFillColor(26, 42, 67);
        docPdf.rect(0, 0, 210, 22, 'F');
        docPdf.setTextColor(255, 255, 255);
        docPdf.setFontSize(16);
        docPdf.setFont("helvetica", "bold");
        docPdf.text("REQUISIÇÃO DE MATERIAIS", 14, 14);

        // Corpo
        docPdf.setTextColor(50, 50, 50);
        docPdf.setFontSize(11);
        docPdf.setFont("helvetica", "normal");
        
        docPdf.text(`Funcionario(a): ${pedido.nome}`, 14, 35);
        docPdf.text(`Equipe / Obra: ${pedido.equipe}`, 14, 42);
        docPdf.text(`Data do Pedido: ${pedido.data} às ${pedido.hora}`, 14, 49);
        
        let statusText = pedido.status === 'analise' ? 'EM ANÁLISE' : 'NOVO';
        docPdf.text(`Status Atual: ${statusText}`, 14, 56);

        docPdf.setDrawColor(200, 200, 200);
        docPdf.line(14, 65, 196, 65);

        docPdf.setFontSize(12);
        docPdf.setFont("helvetica", "bold");
        docPdf.text("LISTA DE MATERIAIS SOLICITADOS:", 14, 75);

        docPdf.setFontSize(11);
        docPdf.setFont("helvetica", "normal");
        
        // Quebra a linha da descrição para não sair do PDF
        const linhasDesc = docPdf.splitTextToSize(pedido.descricao, 180);
        docPdf.text(linhasDesc, 14, 85);

        docPdf.save(`Pedido_${pedido.equipe.replace(/\s+/g, '_')}_${pedido.data.replace(/\//g, '')}.pdf`);
    };
    
    // ==========================================
    // MÓDULO: PEDIDOS DE MATERIAL (FUNCIONÁRIO)
    // ==========================================

    window.abrirTelaPedidoMaterial = function() {
        // Esconde todas as telas
        document.querySelectorAll('.main-card').forEach(card => card.style.display = 'none');
        // Mostra a tela de pedido
        document.getElementById('tela-pedido-material').style.display = 'block';

        // Puxa o nome do funcionário logado automaticamente
        const nomeLogado = getSessaoFunc('funcLogadoNome');
        if (nomeLogado) {
            document.getElementById('pm-nome').value = nomeLogado;
        }
    };

    window.voltarTelaRelogio = function() {
        // Cancela o pedido e volta para a tela de relógio
        document.querySelectorAll('.main-card').forEach(card => card.style.display = 'none');
        document.getElementById('tela-relogio').style.display = 'block';
        if (typeof atualizarUiBotoesPontoDia === 'function') atualizarUiBotoesPontoDia(false);
    };

    window.enviarPedidoMaterial = async function() {
        const nome = document.getElementById('pm-nome').value.trim();
        const equipe = document.getElementById('pm-equipe').value.trim();
        const desc = document.getElementById('pm-desc').value.trim();
        const empresaLogada = getSessaoFunc('funcLogadoEmpresa') || 'MANUTENÇÃO';

        if (!nome || !equipe || !desc) {
            return Swal.fire('Atenção', 'Preencha todos os campos para pedir material!', 'warning');
        }

        Swal.fire({
            title: 'A enviar pedido...',
            text: 'Por favor, aguarde.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading() }
        });

        const dataObj = new Date();
        const dataAtual = `${String(dataObj.getDate()).padStart(2, '0')}/${String(dataObj.getMonth() + 1).padStart(2, '0')}/${dataObj.getFullYear()}`;
        const horaAtual = String(dataObj.getHours()).padStart(2, '0') + ':' + String(dataObj.getMinutes()).padStart(2, '0');

        try {
            await addDoc(collection(db, "pedidos_material"), {
                empresa_id: empresaLogada,
                nome: nome,
                equipe: equipe,
                descricao: desc,
                status: "novo",
                data: dataAtual,
                hora: horaAtual,
                timestamp: dataObj.getTime()
            });

            Swal.fire('Enviado!', 'O seu pedido foi encaminhado para o Gestor.', 'success');
            
            // Limpa os campos e volta para a tela inicial do ponto
            document.getElementById('pm-equipe').value = '';
            document.getElementById('pm-desc').value = '';
            window.voltarTelaRelogio();

        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Falha ao enviar o pedido de material. Tente novamente.', 'error');
        }
    };
