/* js/modulos/funcionario-acesso.js — edite este arquivo para alterar só este módulo */
    window.iniciarCamera = async function (facing) {
        const modo = facing === 'environment' ? 'environment' : 'user';
        const video = document.getElementById('video-selfie');
        const btnIniciar = document.getElementById('btn-iniciar-camera');
        const btnTirar = document.getElementById('btn-tirar-foto');
        const btnTrocar = document.getElementById('btn-trocar-camera');
        const blocoAbrir = document.getElementById('botoes-abrir-camera');
        const imgFoto = document.getElementById('foto-tirada');

        pararCamera();
        cameraFacingAtual = modo;

        try {
            streamCamera = await obterStreamCamera(modo);
            video.srcObject = streamCamera;
            await video.play().catch(function () {});
            video.style.display = 'block';
            if (blocoAbrir) blocoAbrir.style.display = 'none';
            if (btnIniciar) btnIniciar.style.display = 'none';
            if (btnTrocar) btnTrocar.style.display = 'block';
            if (btnTirar) btnTirar.style.display = 'block';
            if (imgFoto) imgFoto.style.display = 'none';
            aplicarEspelhoCamera(modo === 'user');
        } catch (err) {
            console.warn('Câmera', modo, err);
            const msg = modo === 'environment'
                ? 'Não foi possível abrir a câmera traseira. Tente a selfie (frontal) ou verifique a permissão da câmera no celular.'
                : 'Permissão da câmera negada ou não suportada neste aparelho.';
            Swal.fire('Erro', msg, 'error');
            if (blocoAbrir) blocoAbrir.style.display = 'flex';
        }
    };

    window.alternarCamera = function () {
        const proximo = cameraFacingAtual === 'user' ? 'environment' : 'user';
        iniciarCamera(proximo);
    };

    window.tirarFoto = function() {
        const video = document.getElementById('video-selfie'); 
        const canvas = document.getElementById('canvas-selfie'); 
        const imgFoto = document.getElementById('foto-tirada'); 
        const inputBase64 = document.getElementById('foto-base64'); 
        const btnTirar = document.getElementById('btn-tirar-foto'); 
        const btnIniciar = document.getElementById('btn-iniciar-camera');
        const btnTrocar = document.getElementById('btn-trocar-camera');
        const blocoAbrir = document.getElementById('botoes-abrir-camera');
        
        // Redimensiona a selfie antes de gravar no Firestore (fotos full-HD
        // em base64 estouram cota/armazenamento e param de registrar o mês seguinte).
        const vw = video.videoWidth || 640;
        const vh = video.videoHeight || 480;
        const maxLado = 640;
        const escala = Math.min(1, maxLado / Math.max(vw, vh));
        canvas.width = Math.max(1, Math.round(vw * escala));
        canvas.height = Math.max(1, Math.round(vh * escala));
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const fotoDataUrl = canvas.toDataURL('image/jpeg', 0.42); 
        imgFoto.src = fotoDataUrl; 
        inputBase64.value = fotoDataUrl;
        
        video.style.display = 'none'; 
        imgFoto.style.display = 'block'; 
        btnTirar.style.display = 'none'; 
        if (btnTrocar) btnTrocar.style.display = 'none';
        if (btnIniciar) {
            btnIniciar.style.display = 'block';
            btnIniciar.innerText = '🔄 Tirar outra foto';
        }
        if (blocoAbrir) blocoAbrir.style.display = 'flex';
        
        pararCamera();
    };

    window.reporUiCameraAposPonto = function () {
        pararCamera();
        const blocoAbrir = document.getElementById('botoes-abrir-camera');
        const btnIniciar = document.getElementById('btn-iniciar-camera');
        const btnTirar = document.getElementById('btn-tirar-foto');
        const btnTrocar = document.getElementById('btn-trocar-camera');
        if (blocoAbrir) blocoAbrir.style.display = 'flex';
        if (btnIniciar) {
            btnIniciar.style.display = 'none';
            btnIniciar.innerText = '📷 Abrir câmera novamente';
        }
        if (btnTirar) btnTirar.style.display = 'none';
        if (btnTrocar) btnTrocar.style.display = 'none';
        aplicarEspelhoCamera(false);
    };

    window.esqueciSenha = function() {
        Swal.fire({ 
            icon: 'info', 
            title: 'Recuperar Senha', 
            text: 'Para manter a conta segura, apenas o gestor (RH) pode resetar a sua senha. Peça para ele aceder ao painel administrativo e clicar em "Resetar" no seu cadastro.', 
            confirmButtonColor: '#1a2a43' 
        });
    };

    window.fazerLogin = async function() {
        const cpfDigitado = document.getElementById('login-cpf').value;
        const cpf = normalizarCpfSomenteDigitos(cpfDigitado);
        const senha = normalizarSenhaFuncionario(document.getElementById('login-senha').value);
        let empresaEscolhida = resolverEmpresaLoginFuncionario();
        
        if (!cpf || !senha) {
            return Swal.fire('Atenção', 'Preencha o CPF e a Senha!', 'warning');
        }
        
        Swal.fire({
            title: 'Autenticando...',
            allowOutsideClick: false,
            didOpen: function () { Swal.showLoading(); }
        });
        
        try {
            try { await ensureAuth(); } catch (_) {}

            // Busca em toda a coleção (mais confiável) e filtra por CPF;
            // assim não falha se a empresa da sessão estiver diferente/ausente.
            const snapTodos = await getDocs(collection(db, 'funcionarios'));
            const candidatos = [];
            snapTodos.forEach((docSnap) => {
                const d = docSnap.data() || {};
                if (cpfsSaoIguais(obterCpfDoFuncionario(d), cpf)) {
                    candidatos.push({ id: docSnap.id, data: d, empresa: String(d.empresa_id || '').trim() });
                }
            });

            if (!candidatos.length) {
                return Swal.fire({
                    icon: 'error',
                    title: 'CPF não encontrado',
                    html: 'Não encontramos o CPF <b>' + escapeHtmlBasico(cpf) + '</b> no sistema.<br><br>'
                        + 'Peça ao RH para conferir em <b>Equipe → Equipe Cadastrada</b> se o CPF está correto.',
                    confirmButtonColor: '#1a2a43'
                });
            }

            let escolhido = null;
            if (empresaEscolhida) {
                escolhido = candidatos.find((c) => empresasSaoIguais(c.empresa, empresaEscolhida)) || null;
            }
            if (!escolhido && candidatos.length === 1) {
                escolhido = candidatos[0];
                empresaEscolhida = escolhido.empresa;
            }
            if (!escolhido && candidatos.length > 1) {
                const listaEmp = candidatos.map((c) => c.empresa || '(sem empresa)').filter(Boolean);
                return Swal.fire({
                    icon: 'warning',
                    title: 'Escolha a empresa',
                    html: 'Este CPF existe em mais de uma empresa:<br><b>'
                        + listaEmp.map((e) => escapeHtmlBasico(e)).join('</b><br><b>')
                        + '</b><br><br>Volte e selecione a empresa correta antes de entrar.',
                    confirmButtonColor: '#1a2a43'
                });
            }
            if (!escolhido) {
                return Swal.fire({
                    icon: 'error',
                    title: 'Empresa incorreta',
                    html: 'O CPF está cadastrado em <b>'
                        + candidatos.map((c) => escapeHtmlBasico(c.empresa || '?')).join('</b>, <b>')
                        + '</b>.<br>Você selecionou: <b>' + escapeHtmlBasico(empresaEscolhida || '(nenhuma)') + '</b>.',
                    confirmButtonColor: '#1a2a43'
                });
            }

            const funcId = escolhido.id;
            const funcData = escolhido.data;
            empresaEscolhida = escolhido.empresa || empresaEscolhida;
            setSessaoFunc('empresaTemporariaFuncionario', empresaEscolhida);
            try { localStorage.setItem('empresaTemporariaFuncionario', empresaEscolhida); } catch (_) {}

            // Corrige CPF antigo salvo com formatação/número
            const cpfCanonico = cpfParaComparacao(obterCpfDoFuncionario(funcData)) || cpf;
            if (String(funcData.cpf || '') !== cpfCanonico) {
                try { await updateDoc(doc(db, 'funcionarios', funcId), { cpf: cpfCanonico }); } catch (_) {}
            }

            if (senhaFuncionarioEstaVazia(funcData.senha)) {
                await updateDoc(doc(db, "funcionarios", funcId), { senha: senha });
                setSessaoFunc('funcLogadoId', funcId);
                setSessaoFunc('funcLogadoNome', funcData.nome);
                setSessaoFunc('funcLogadoEmpresa', empresaEscolhida);
                
                Swal.fire('Senha Criada!', 'O seu usuário foi ativado com sucesso.', 'success').then(() => {
                    location.reload();
                });
            } else if (!senhasFuncionarioCoincidem(funcData.senha, senha)) {
                Swal.fire('Erro', 'Senha incorreta! Se esqueceu, peça ao RH para clicar em "Resetar" no seu cadastro.', 'error');
            } else {
                setSessaoFunc('funcLogadoId', funcId);
                setSessaoFunc('funcLogadoNome', funcData.nome);
                setSessaoFunc('funcLogadoEmpresa', empresaEscolhida);
                location.reload();
            }
        } catch(e) {
            console.error('fazerLogin', e);
            Swal.fire('Erro', 'Falha na autenticação. Verifique a internet (ou se o Firebase está no limite diário) e tente novamente.', 'error');
        }
    };
