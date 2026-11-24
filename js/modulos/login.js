/* js/modulos/login.js — edite este arquivo para alterar só este módulo */
    // --- FUNÇÕES DE NAVEGAÇÃO INICIAL ---
    window.escolherGestao = async function() {
        const { value: senhaDigitada } = await Swal.fire({
            title: '🔐 Acesso Restrito',
            text: 'Digite a senha da Gestão Geral:',
            input: 'password',
            inputPlaceholder: 'Sua senha',
            showCancelButton: true,
            confirmButtonText: 'Entrar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1a2a43',
            cancelButtonColor: '#d9534f'
        });

        if (!senhaDigitada) return;

        Swal.fire({
            title: 'Verificando...',
            text: 'Por favor, aguarde.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            await ensureAuth();
            const docSnap = await getDoc(doc(db, 'sistema', 'config'));
            if (!docSnap.exists()) {
                Swal.fire('Erro', 'Senha da gestão não configurada no Firebase. Crie o documento sistema/config com o campo senha_gestao_geral.', 'error');
                return;
            }
            const senhaGestao = String(docSnap.data().senha_gestao_geral || '').trim();
            if (!senhaGestao) {
                Swal.fire('Erro', 'Campo senha_gestao_geral não encontrado em sistema/config. Configure no Firebase Console.', 'error');
                return;
            }
            if (senhaDigitada === senhaGestao) {
                Swal.close();
                document.getElementById('tela-escolha-inicial').style.display = 'none';
                document.getElementById('tela-selecao-empresa').style.display = 'block';
            } else {
                Swal.fire('Acesso Negado', 'A senha está incorreta!', 'error');
            }
        } catch (error) {
            console.error('Erro ao verificar senha da gestão:', error);
            Swal.fire('Erro de Conexão', 'Não foi possível verificar a senha. Verifique a internet e tente novamente.', 'error');
        }
    };

    window.escolherFuncionario = function() {
        document.getElementById('tela-escolha-inicial').style.display = 'none';
        document.getElementById('tela-selecao-empresa-funcionario').style.display = 'block';
    };

    window.voltarTelaInicial = function() {
        document.body.classList.remove('gestor-ativo');
        document.querySelectorAll('.main-card').forEach(card => card.style.display = 'none');
        const tp = document.getElementById('tela-patrao');
        if (tp) {
            tp.classList.remove('gestor-visivel');
            tp.style.display = 'none';
        }
        document.getElementById('tela-escolha-inicial').style.display = 'block';
        atualizarLogoInterface("FH CONSTRUÇÕES CIVIS");
        if (document.getElementById('alerta-container-global')) {
            document.getElementById('alerta-container-global').style.display = 'none';
        }
        if (document.getElementById('alerta-container-docs')) {
            document.getElementById('alerta-container-docs').style.display = 'none';
        }
        if (document.getElementById('alerta-container-ponto')) {
            document.getElementById('alerta-container-ponto').style.display = 'none';
        }
        if (document.getElementById('alerta-container-pedidos')) {
            document.getElementById('alerta-container-pedidos').style.display = 'none';
        }
        if (document.getElementById('alerta-stack-global')) {
            document.getElementById('alerta-stack-global').style.display = 'none';
        }
    };
   
    window.entrarEmpresaFuncionario = function(nomeEmpresa) {
        setSessaoFunc('empresaTemporariaFuncionario', nomeEmpresa);
        try { localStorage.setItem('empresaTemporariaFuncionario', nomeEmpresa); } catch (_) {}
        atualizarLogoInterface(nomeEmpresa);
        
        document.getElementById('tela-selecao-empresa-funcionario').style.display = 'none';
        document.getElementById('login-nome-empresa').innerText = nomeEmpresa;
        document.getElementById('tela-login').style.display = 'block';
    };

    // --- ROTAS INICIAIS REFORMULADAS ---
    const urlParams = new URLSearchParams(window.location.search);
    const valeId = urlParams.get('id');
    const holeriteId = urlParams.get('holerite');

    const idLogado = getSessaoFunc('funcLogadoId');
    const temSessaoGestor = getEmpresaGestor();

    if (holeriteId) {
        document.title = "ASSINATURA HOLERITE";
        document.getElementById('tela-assinatura-holerite').style.display = 'block';
        setTimeout(function () {
            if (typeof carregarHoleriteParaAssinatura === 'function') {
                carregarHoleriteParaAssinatura(holeriteId);
            }
        }, 0);
    } else if (valeId) {
        document.title = "ASSINATURA"; 
        document.getElementById('tela-funcionario').style.display = 'block';
        carregarValeParaAssinatura(valeId);
    } else if (idLogado) {
        document.title = "PONTO DIGITAL"; 
        document.getElementById('tela-relogio').style.display = 'block';
        document.getElementById('nome-logado').innerText = getSessaoFunc('funcLogadoNome');
        if (typeof atualizarDataRelogioPonto === 'function') atualizarDataRelogioPonto();
        if (typeof window.verificarAtualizacaoApp === 'function') window.verificarAtualizacaoApp();
        
        const empFunc = getSessaoFunc('funcLogadoEmpresa');
        if (empFunc) {
            document.getElementById('relogio-nome-empresa').innerText = empFunc;
            atualizarLogoInterface(empFunc);
        }

        if(!navigator.onLine) {
            document.getElementById('alerta-offline').style.display = 'block';
        }
        sincronizarPontoOffline().then(function () {
            if (typeof atualizarUiBotoesPontoDia === 'function') atualizarUiBotoesPontoDia(true);
            if (typeof atualizarAvisoPontoPendente === 'function') atualizarAvisoPontoPendente();
        }).catch(function () {
            if (typeof atualizarAvisoPontoPendente === 'function') atualizarAvisoPontoPendente();
        });
    } else if (temSessaoGestor) {
        document.title = "Gestor 360 — " + temSessaoGestor; 
        iniciarPainelGestor();
    } else {
        document.title = "FH Construções"; 
        document.getElementById('tela-escolha-inicial').style.display = 'block';
    }

    window.addEventListener('resize', function () {
        if (window.innerWidth > 900) fecharMenuMobileGestor();
    });

    // --- EVENTOS OFFLINE/ONLINE ---
    window.addEventListener('offline', () => { 
        document.getElementById('alerta-offline').style.display = 'block'; 
    });
    
    window.addEventListener('online', () => { 
        document.getElementById('alerta-offline').style.display = 'none'; 
        sincronizarPontoOffline(); 
    });

    // --- LÓGICA DE LOGIN MULTI-TENANT (GESTOR) ---
    window.entrarEmpresa = async function(nomeEmpresa) {
        const { value: senhaDigitada } = await Swal.fire({
            title: '🔐 Acesso Restrito',
            text: `Digite a senha para acessar o painel da ${nomeEmpresa}`,
            input: 'password',
            inputPlaceholder: 'Sua senha',
            showCancelButton: true,
            confirmButtonText: 'Entrar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1a2a43',
            cancelButtonColor: '#d9534f'
        });

        if (!senhaDigitada) return; 

        Swal.fire({
            title: 'Verificando...',
            text: 'Por favor, aguarde.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading() }
        });

        try {
            const q = query(collection(db, "empresas"), where("nome", "==", nomeEmpresa));
            const querySnapshot = await getDocs(q);

            let acessoLiberado = false;

            if (querySnapshot.empty) {
                Swal.fire('Erro', 'Esta empresa não tem uma senha cadastrada no sistema de segurança. Peça ao administrador para configurar.', 'error');
                return;
            }

            querySnapshot.forEach((doc) => {
                const dadosEmpresa = doc.data();
                if (dadosEmpresa.senha === senhaDigitada) {
                    acessoLiberado = true;
                }
            });

            if (acessoLiberado) {
                Swal.close();
                setEmpresaGestor(nomeEmpresa);
                limparCachesEmpresaGestor();
                iniciarPainelGestor();
            } else {
                Swal.fire('Acesso Negado', 'A senha está incorreta.', 'error');
            }

        } catch (error) {
            Swal.fire('Erro de Conexão', 'Não foi possível verificar a senha. Tente novamente.', 'error');
            console.error("Erro ao verificar senha:", error);
        }
    };

    window.sairPainelGestor = function() {
        fecharMenuMobileGestor();
        clearEmpresaGestor();
        location.reload();
    };

    function painelGestorEstaVisivel() {
        const el = document.getElementById('tela-patrao');
        return el && el.classList.contains('gestor-visivel');
    }

    function mostrarPainelGestor() {
        document.body.classList.add('gestor-ativo');
        const el = document.getElementById('tela-patrao');
        if (el) {
            el.classList.add('gestor-visivel');
            el.style.display = 'flex';
        }
    }

    function ocultarPainelGestor() {
        document.body.classList.remove('gestor-ativo');
        const el = document.getElementById('tela-patrao');
        if (el) {
            el.classList.remove('gestor-visivel');
            el.style.display = 'none';
        }
    }

    function atualizarBadgeSessaoGestor(nomeEmpresa) {
        const nome = nomeEmpresa || '—';
        const sidebar = document.getElementById('nome-empresa-painel');
        const fixa = document.getElementById('gestor-sessao-fixa-nome');
        const topbar = document.getElementById('gestor-sessao-topbar');
        if (sidebar) sidebar.innerText = '🏢 ' + nome;
        if (fixa) fixa.textContent = nome;
        if (topbar) topbar.setAttribute('data-empresa', nome);
        document.title = 'Gestor 360 — ' + nome;
    }

    function mostrarTelaInicioGestor() {
        document.querySelectorAll('.gestor-menu-btn').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
        const inicio = document.getElementById('aba-inicio');
        if (inicio) inicio.classList.add('active');

        const wrap = document.getElementById('gestor-sections-wrap');
        if (wrap) wrap.classList.add('gestor-wrap-inicio');

        const grupoEquipe = document.getElementById('grupo-menu-equipe');
        if (grupoEquipe) {
            grupoEquipe.classList.remove('has-active', 'open');
        }
        const btnEquipe = document.getElementById('btn-grupo-equipe');
        if (btnEquipe) btnEquipe.setAttribute('aria-expanded', 'false');

        const grupoObras = document.getElementById('grupo-menu-obras');
        if (grupoObras) {
            grupoObras.classList.remove('has-active', 'open');
        }
        const btnObras = document.getElementById('btn-grupo-obras');
        if (btnObras) btnObras.setAttribute('aria-expanded', 'false');

        const grupoDocumentos = document.getElementById('grupo-menu-documentos');
        if (grupoDocumentos) {
            grupoDocumentos.classList.remove('has-active', 'open');
        }
        const btnDocumentos = document.getElementById('btn-grupo-documentos');
        if (btnDocumentos) btnDocumentos.setAttribute('aria-expanded', 'false');

        const grupoEntradas = document.getElementById('grupo-menu-entradas');
        if (grupoEntradas) {
            grupoEntradas.classList.remove('has-active', 'open');
        }
        const btnEntradas = document.getElementById('btn-grupo-entradas');
        if (btnEntradas) btnEntradas.setAttribute('aria-expanded', 'false');

        const grupoCartoes = document.getElementById('grupo-menu-cartoes');
        if (grupoCartoes) {
            grupoCartoes.classList.remove('has-active', 'open');
        }
        const btnCartoes = document.getElementById('btn-grupo-cartoes');
        if (btnCartoes) btnCartoes.setAttribute('aria-expanded', 'false');

        const tituloEl = document.getElementById('gestor-titulo-aba');
        const empresa = getEmpresaGestor();
        if (tituloEl) tituloEl.textContent = empresa || 'Painel Gestor';

        const mainGestor = document.querySelector('.gestor-main-content');
        if (mainGestor) mainGestor.scrollTop = 0;
    }
    window.mostrarTelaInicioGestor = mostrarTelaInicioGestor;

    function fecharMenuMobileGestor() {
        document.body.classList.remove('gestor-menu-aberto');
        const btn = document.getElementById('btn-menu-mobile-gestor');
        const overlay = document.getElementById('gestor-menu-overlay');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        if (overlay) overlay.setAttribute('aria-hidden', 'true');
    }
    window.fecharMenuMobileGestor = fecharMenuMobileGestor;

    function toggleMenuMobileGestor() {
        const aberto = document.body.classList.toggle('gestor-menu-aberto');
        const btn = document.getElementById('btn-menu-mobile-gestor');
        const overlay = document.getElementById('gestor-menu-overlay');
        if (btn) btn.setAttribute('aria-expanded', aberto ? 'true' : 'false');
        if (overlay) overlay.setAttribute('aria-hidden', aberto ? 'false' : 'true');
    }
    window.toggleMenuMobileGestor = toggleMenuMobileGestor;

    function iniciarPainelGestor() {
        const empresaLogada = getEmpresaGestor();
        limparCachesEmpresaGestor();
        atualizarLogoInterface(empresaLogada);
        document.querySelectorAll('.main-card').forEach(card => card.style.display = 'none');
        mostrarPainelGestor();
        atualizarBadgeSessaoGestor(empresaLogada);
        mostrarTelaInicioGestor();
        setTimeout(function () {
            if (typeof iniciarHistoricoPainelGestor === 'function') iniciarHistoricoPainelGestor();
        }, 0);
        
        carregarListaDeFuncionarios();
        const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0');
        document.getElementById('folha-mes').value = mesAtual;
        initFolhaOpcoesCalculo();
        initAjudaCustoDatasPadrao();
        initDescontosFolhaDatasPadrao();
        document.getElementById('backup-mes').value = mesAtual;
        
        // CORREÇÃO: Aguardar a tela e as funções carregarem antes de puxar o alerta
        setTimeout(() => {
            if (typeof window.checarNovosPedidosManutencao === "function") {
                window.checarNovosPedidosManutencao();
            }
            monitorarVencimentosDocumentos();
            monitorarVencimentosObras();
            if (typeof monitorarSequenciaPontoGestor === 'function') {
                monitorarSequenciaPontoGestor();
            }
            if (typeof window.iniciarAssistenteVirtual === 'function') {
                window.iniciarAssistenteVirtual();
            }
         }, 800);
    }

    const nomeMeses = { 
        "01": "Janeiro", "1": "Janeiro", 
        "02": "Fevereiro", "2": "Fevereiro", 
        "03": "Março", "3": "Março", 
        "04": "Abril", "4": "Abril", 
        "05": "Maio", "5": "Maio", 
        "06": "Junho", "6": "Junho", 
        "07": "Julho", "7": "Julho", 
        "08": "Agosto", "8": "Agosto", 
        "09": "Setembro", "9": "Setembro", 
        "10": "Outubro", "11": "Novembro", "12": "Dezembro" 
    };

function separarDataSegura(dataString) {
    try {
        if (!dataString) {
            return { ano: 'Outros', mes: 'Outros', dia: '??' };
        }
        
        // CORREÇÃO 1: Adicionado o [0] para pegar a string da data antes de usar o replace
        let apenasData = String(dataString).trim().split(' ')[0]; 
        let textoLimpo = apenasData.replace(/[^\d\/\-]/g, '');
        let partes = textoLimpo.split(/[\/\-]/);
        
        if (partes.length >= 3) {
            // CORREÇÃO 2: Pegar os índices corretos da lista (0, 1 e 2)
            let p1 = partes[0]; 
            let p2 = partes[1]; 
            let p3 = partes[2];
            let ano, mes, dia;
            
            if (p3.length >= 4) { 
                ano = p3.substring(0, 4); 
                mes = p2; 
                dia = p1; 
            } else if (p1.length >= 4) { 
                ano = p1.substring(0, 4); 
                mes = p2; 
                dia = p3; 
            } else { 
                ano = "20" + p3; 
                mes = p2; 
                dia = p1; 
            }
            
            return { ano: ano, mes: mes.padStart(2, '0'), dia: dia.padStart(2, '0') };
        }
        return { ano: 'Outros', mes: 'Outros', dia: String(dataString) };
    } catch(e) { 
        console.error("Erro na data:", e);
        return { ano: 'Outros', mes: 'Outros', dia: '??' }; 
    }
}
