/* js/modulos/backup.js — edite este arquivo para alterar só este módulo */
    window.fazerBackupMes = async function() {
        const mesSelected = document.getElementById('backup-mes').value;
        const anoSelected = document.getElementById('backup-ano').value;
        const empresaLogada = getEmpresaGestor();

        Swal.fire({ title: 'Gerando Backup Offline...', text: 'Isto pode demorar alguns segundos.', allowOutsideClick: false });
        Swal.showLoading();

        try {
            const qVales = query(collection(db, "vales_sistema"), where("empresa_id", "==", empresaLogada));
            const snapVales = await getDocs(qVales);
            let valesHTML = "";
            snapVales.forEach(doc => {
                let d = doc.data();
                let {mes, ano} = separarDataSegura(d.data_criacao || d.data);
                if(mes === mesSelected && ano === anoSelected) {
                    valesHTML += `<div style="border:1px solid #ccc; margin-bottom:10px; padding:10px;">
                        <b>Vale:</b> ${d.nome} - R$ ${d.valor} (${d.tipo})<br>
                        <b>Data:</b> ${d.data_criacao || d.data} - ${d.descricao}<br>
                        ${d.assinatura ? `<img src="${d.assinatura}" style="max-height:80px; border:1px solid #000;">` : 'Não assinado'}
                    </div>`;
                }
            });

            const qPonto = query(collection(db, "ponto_registros"), where("empresa_id", "==", empresaLogada));
            const snapPonto = await getDocs(qPonto);
            let pontoHTML = "";
            snapPonto.forEach(doc => {
                let d = doc.data();
                let {mes, ano} = separarDataSegura(d.data);
                if(mes === mesSelected && ano === anoSelected) {
                    pontoHTML += `<div style="border:1px solid #ccc; margin-bottom:10px; padding:10px;">
                        <b>Ponto:</b> ${d.nome} - ${d.tipo}<br>
                        <b>Obra:</b> ${d.obra} - <b>Data/Hora:</b> ${d.data} ${d.hora}<br>
                        <b>GPS:</b> ${d.latitude}, ${d.longitude}<br>
                        ${d.foto ? `<img src="${d.foto}" style="max-height:100px; border:1px solid #000;">` : ''}
                    </div>`;
                }
            });

            const qDespesas = query(collection(db, "despesas_obras"), where("empresa_id", "==", empresaLogada));
            const snapDespesas = await getDocs(qDespesas);
            let despesasHTML = "";
            snapDespesas.forEach(doc => {
                let d = doc.data();
                let {mes, ano} = separarDataSegura(d.data);
                if(mes === mesSelected && ano === anoSelected) {
                    despesasHTML += `<div style="border:1px solid #ccc; margin-bottom:10px; padding:10px;">
                        <b>Despesa Obra:</b> ${d.obra_nome} - <b>Loja:</b> ${d.loja_nome}<br>
                        <b>Valor:</b> R$ ${d.valor_string} - <b>Data:</b> ${d.data}<br>
                        <b>Desc:</b> ${d.descricao}<br>
                        ${d.foto_recibo ? `<img src="${d.foto_recibo}" style="max-height:150px; border:1px solid #000;">` : ''}
                    </div>`;
                }
            });

            const qRelDesp = query(collection(db, COLECAO_RELATORIO_DESPESAS), where("empresa_id", "==", empresaLogada));
            const snapRelDesp = await getDocs(qRelDesp);
            let relatorioDespesasHTML = "";
            snapRelDesp.forEach(doc => {
                let d = doc.data();
                let {mes, ano} = separarDataSegura(d.data);
                if(mes === mesSelected && ano === anoSelected) {
                    relatorioDespesasHTML += `<div style="border:1px solid #ccc; margin-bottom:10px; padding:10px;">
                        <b>Relatório despesa:</b> ${d.obra_nome} - <b>Fornec.:</b> ${d.loja_nome}<br>
                        <b>Valor:</b> R$ ${d.valor_string} - <b>Lançamento:</b> ${d.data}<br>
                        <b>Chq/Bol:</b> ${d.cheque_boleto_num || '-'} <b>Obs:</b> ${d.observacao || '-'}<br>
                        ${d.foto_recibo ? `<img src="${d.foto_recibo}" style="max-height:150px; border:1px solid #000;">` : ''}
                    </div>`;
                }
            });

            if(!valesHTML && !pontoHTML && !despesasHTML && !relatorioDespesasHTML) {
                return Swal.fire('Aviso', 'Não há dados registrados neste mês para fazer backup.', 'info');
            }

            let backupContent = `
                <html>
                <head><meta charset="utf-8"><title>Backup - ${empresaLogada} - ${mesSelected}/${anoSelected}</title></head>
                <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <h1>Backup Completo - ${empresaLogada}</h1>
                    <h2>Período: Mês ${mesSelected} / Ano ${anoSelected}</h2>
                    <hr>
                    <h3>1. DESPESAS E NOTAS FISCAIS (obras)</h3>
                    ${despesasHTML || '<p>Sem despesas de obra.</p>'}
                    <hr>
                    <h3>2. RELATÓRIO DE DESPESAS (tabela separada)</h3>
                    ${relatorioDespesasHTML || '<p>Sem linhas de relatório de despesas.</p>'}
                    <hr>
                    <h3>3. REGISTROS DE PONTO (GPS E SELFIE)</h3>
                    ${pontoHTML || '<p>Sem pontos.</p>'}
                    <hr>
                    <h3>4. VALES E PRODUTOS (ASSINATURAS)</h3>
                    ${valesHTML || '<p>Sem vales.</p>'}
                </body>
                </html>
            `;

            const blob = new Blob([backupContent], { type: 'text/html' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Backup_${empresaLogada.replace(/\s+/g, '_')}_${mesSelected}_${anoSelected}.html`;
            link.click();

            Swal.fire('Backup Salvo!', 'O arquivo HTML foi transferido para o seu computador. Abra-o no navegador para ver tudo offline.', 'success');

        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Falha ao gerar o Backup.', 'error');
        }
    };

    window.limparDadosMes = async function() {
        const mesSelected = document.getElementById('backup-mes').value;
        const anoSelected = document.getElementById('backup-ano').value;
        const empresaLogada = getEmpresaGestor();

        Swal.fire({
            title: '⚠️ CUIDADO: ZERAR NUVEM?',
            html: `Você está prestes a <b>APAGAR TODOS OS DADOS E FOTOS</b> do Mês <b>${mesSelected}/${anoSelected}</b> para economizar servidor.<br><br>Você tem certeza que já baixou o Backup e guardou o arquivo HTML com segurança?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d9534f',
            cancelButtonColor: '#1a2a43',
            confirmButtonText: 'Sim, eu já baixei o Backup. Apagar!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                Swal.fire({ title: 'A Apagar Dados...', allowOutsideClick: false });
                Swal.showLoading();

                try {
                    let deletados = 0;

                    const qVales = query(collection(db, "vales_sistema"), where("empresa_id", "==", empresaLogada));
                    const snapVales = await getDocs(qVales);
                    for (const docSnap of snapVales.docs) {
                        let {mes, ano} = separarDataSegura(docSnap.data().data_criacao || docSnap.data().data);
                        if(mes === mesSelected && ano === anoSelected) {
                            await deleteDoc(doc(db, "vales_sistema", docSnap.id));
                            deletados++;
                        }
                    }

                    const qPonto = query(collection(db, "ponto_registros"), where("empresa_id", "==", empresaLogada));
                    const snapPonto = await getDocs(qPonto);
                    for (const docSnap of snapPonto.docs) {
                        let {mes, ano} = separarDataSegura(docSnap.data().data);
                        if(mes === mesSelected && ano === anoSelected) {
                            await deleteDoc(doc(db, "ponto_registros", docSnap.id));
                            deletados++;
                        }
                    }

                    const qDespesas = query(collection(db, "despesas_obras"), where("empresa_id", "==", empresaLogada));
                    const snapDespesas = await getDocs(qDespesas);
                    for (const docSnap of snapDespesas.docs) {
                        let {mes, ano} = separarDataSegura(docSnap.data().data);
                        if(mes === mesSelected && ano === anoSelected) {
                            await deleteDoc(doc(db, "despesas_obras", docSnap.id));
                            deletados++;
                        }
                    }

                    const qRelDespLimp = query(collection(db, COLECAO_RELATORIO_DESPESAS), where("empresa_id", "==", empresaLogada));
                    const snapRelDespLimp = await getDocs(qRelDespLimp);
                    for (const docSnap of snapRelDespLimp.docs) {
                        let {mes, ano} = separarDataSegura(docSnap.data().data);
                        if(mes === mesSelected && ano === anoSelected) {
                            await deleteDoc(doc(db, COLECAO_RELATORIO_DESPESAS, docSnap.id));
                            deletados++;
                        }
                    }

                    Swal.fire('Limpeza Concluída!', `Foram apagados ${deletados} registros. O seu armazenamento na nuvem está livre!`, 'success');

                } catch (e) {
                    console.error(e);
                    Swal.fire('Erro', 'Falha ao limpar o banco de dados. Pode haver arquivos demais.', 'error');
                }
            }
        });
    };

    let streamCamera = null;
    let cameraFacingAtual = 'user';

    function pararCamera() {
        if (streamCamera) {
            streamCamera.getTracks().forEach(function (track) { track.stop(); });
            streamCamera = null;
        }
        const video = document.getElementById('video-selfie');
        if (video) video.srcObject = null;
    }

    function aplicarEspelhoCamera(espelhar) {
        const video = document.getElementById('video-selfie');
        const imgFoto = document.getElementById('foto-tirada');
        if (video) video.classList.toggle('camera-espelhada', !!espelhar);
        if (imgFoto) imgFoto.classList.toggle('camera-espelhada', !!espelhar);
    }

    async function obterStreamCamera(facing) {
        const querTraseira = facing === 'environment';
        const tentativas = querTraseira
            ? [
                { video: { facingMode: { ideal: 'environment' } }, audio: false },
                { video: { facingMode: 'environment' }, audio: false },
                { video: true, audio: false }
            ]
            : [
                { video: { facingMode: 'user' }, audio: false },
                { video: true, audio: false }
            ];
        let ultimoErro = null;
        for (let i = 0; i < tentativas.length; i++) {
            try {
                return await navigator.mediaDevices.getUserMedia(tentativas[i]);
            } catch (err) {
                ultimoErro = err;
            }
        }
        throw ultimoErro || new Error('camera_unavailable');
    }
