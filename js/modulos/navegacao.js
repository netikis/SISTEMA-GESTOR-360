/* js/modulos/navegacao.js — edite este arquivo para alterar só este módulo */
    window.fazerLogout = function() { 
        clearSessaoFuncionario();
        location.reload(); 
    };

    window.irParaEquipeCadastrada = function () {
        abrirGrupoMenuEquipe();
        const btn = document.getElementById('btn-menu-equipe-cadastrada');
        if (btn) mudarAba('equipe-cadastrada', btn);
    };

    const ABAS_GRUPO_EQUIPE = ['cadastrar', 'equipe-cadastrada', 'criar', 'buscar', 'ponto', 'ajuda-custo', 'descontos-folha', 'folha', 'holerites', 'pedidos'];
    const ABAS_GRUPO_OBRAS = ['despesas-cadastrar', 'despesas-relatorio', 'relatorio-despesas', 'obras-relatorio-geral', 'notas-fiscais-geral', 'terceiros'];
    const ABAS_GRUPO_CARTOES = ['cartoes-cadastro', 'cartoes-cadastrados', 'cartoes-dashboard', 'cartoes-reembolso', 'cartoes-relatorio'];
    const ABAS_GRUPO_ENTRADAS = ['cadastrar-conta', 'contas-receber', 'recebimentos'];
    const ABAS_GRUPO_DOCUMENTOS = ['documentos-fh', 'documentos-hallana', 'documentos-felipe', 'documentos-wellington', 'documentos-licitacoes', 'documentos-contratos', 'documentos-empenhos'];

    window.abrirGrupoMenuObras = function () {
        const grupo = document.getElementById('grupo-menu-obras');
        const titulo = document.getElementById('btn-grupo-obras');
        if (grupo) grupo.classList.add('open');
        if (titulo) titulo.setAttribute('aria-expanded', 'true');
    };

    window.toggleGrupoMenuObras = function () {
        const grupo = document.getElementById('grupo-menu-obras');
        const titulo = document.getElementById('btn-grupo-obras');
        if (!grupo) return;
        grupo.classList.toggle('open');
        const aberto = grupo.classList.contains('open');
        if (titulo) titulo.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    };

    window.abrirGrupoMenuEquipe = function () {
        const grupo = document.getElementById('grupo-menu-equipe');
        const titulo = document.getElementById('btn-grupo-equipe');
        if (grupo) grupo.classList.add('open');
        if (titulo) titulo.setAttribute('aria-expanded', 'true');
    };

    window.toggleGrupoMenuEquipe = function () {
        const grupo = document.getElementById('grupo-menu-equipe');
        const titulo = document.getElementById('btn-grupo-equipe');
        if (!grupo) return;
        grupo.classList.toggle('open');
        const aberto = grupo.classList.contains('open');
        if (titulo) titulo.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    };

    window.abrirGrupoMenuEntradas = function () {
        const grupo = document.getElementById('grupo-menu-entradas');
        const titulo = document.getElementById('btn-grupo-entradas');
        if (grupo) grupo.classList.add('open');
        if (titulo) titulo.setAttribute('aria-expanded', 'true');
    };

    window.toggleGrupoMenuEntradas = function () {
        const grupo = document.getElementById('grupo-menu-entradas');
        const titulo = document.getElementById('btn-grupo-entradas');
        if (!grupo) return;
        grupo.classList.toggle('open');
        const aberto = grupo.classList.contains('open');
        if (titulo) titulo.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    };

    window.abrirGrupoMenuDocumentos = function () {
        const grupo = document.getElementById('grupo-menu-documentos');
        const titulo = document.getElementById('btn-grupo-documentos');
        if (grupo) grupo.classList.add('open');
        if (titulo) titulo.setAttribute('aria-expanded', 'true');
    };

    window.toggleGrupoMenuDocumentos = function () {
        const grupo = document.getElementById('grupo-menu-documentos');
        const titulo = document.getElementById('btn-grupo-documentos');
        if (!grupo) return;
        grupo.classList.toggle('open');
        const aberto = grupo.classList.contains('open');
        if (titulo) titulo.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    };

    window.abrirGrupoMenuCartoes = function () {
        const grupo = document.getElementById('grupo-menu-cartoes');
        const titulo = document.getElementById('btn-grupo-cartoes');
        if (grupo) grupo.classList.add('open');
        if (titulo) titulo.setAttribute('aria-expanded', 'true');
    };

    window.toggleGrupoMenuCartoes = function () {
        const grupo = document.getElementById('grupo-menu-cartoes');
        const titulo = document.getElementById('btn-grupo-cartoes');
        if (!grupo) return;
        grupo.classList.toggle('open');
        const aberto = grupo.classList.contains('open');
        if (titulo) titulo.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    };

    const GESTOR_HIST_MARCA = 'gestor360';
    let _gestorAbaAtual = 'inicio';
    let _gestorHistIndice = 0;
    let _gestorHistMax = 0;

    function gestorUrlAba(aba) {
        try {
            const url = new URL(location.href);
            url.hash = 'g/' + (aba || 'inicio');
            return url.pathname + url.search + url.hash;
        } catch (_) {
            return '#g/' + (aba || 'inicio');
        }
    }

    function capturarScrollGestor() {
        const main = document.querySelector('.gestor-main-content');
        return main ? main.scrollTop : 0;
    }

    function restaurarScrollGestor(topo) {
        const main = document.querySelector('.gestor-main-content');
        if (!main) return;
        const valor = typeof topo === 'number' ? topo : 0;
        requestAnimationFrame(() => { main.scrollTop = valor; });
    }

    function estadoHistoricoAbaGestor(aba, idx, scroll) {
        return {
            gestor: GESTOR_HIST_MARCA,
            aba: aba || 'inicio',
            idx: typeof idx === 'number' ? idx : _gestorHistIndice,
            scroll: typeof scroll === 'number' ? scroll : 0
        };
    }

    function atualizarBotoesHistoricoGestor() {
        const btnVoltar = document.getElementById('btn-gestor-voltar');
        const btnAvancar = document.getElementById('btn-gestor-avancar');
        if (btnVoltar) btnVoltar.disabled = _gestorHistIndice <= 0;
        if (btnAvancar) btnAvancar.disabled = _gestorHistIndice >= _gestorHistMax;
    }

    function encontrarBotaoAbaGestor(aba) {
        if (!aba || aba === 'inicio') return null;
        const needle = "mudarAba('" + aba + "'";
        return Array.from(document.querySelectorAll('.gestor-menu-btn')).find((btn) => {
            const oc = btn.getAttribute('onclick') || '';
            return oc.indexOf(needle) !== -1;
        }) || null;
    }

    function iniciarHistoricoPainelGestor() {
        _gestorAbaAtual = 'inicio';
        _gestorHistIndice = 0;
        _gestorHistMax = 0;
        const url = gestorUrlAba('inicio');
        try {
            history.replaceState({ gestor: GESTOR_HIST_MARCA, sentinel: true }, '', url);
            history.pushState(estadoHistoricoAbaGestor('inicio', 0, 0), '', url);
        } catch (_) {}
        atualizarBotoesHistoricoGestor();
    }
    window.iniciarHistoricoPainelGestor = iniciarHistoricoPainelGestor;

    function registrarNavegacaoAbaGestor(aba) {
        if (!aba || aba === _gestorAbaAtual) return;
        const urlAtual = gestorUrlAba(_gestorAbaAtual);
        try {
            history.replaceState(
                estadoHistoricoAbaGestor(_gestorAbaAtual, _gestorHistIndice, capturarScrollGestor()),
                '',
                urlAtual
            );
            _gestorHistIndice += 1;
            _gestorHistMax = _gestorHistIndice;
            _gestorAbaAtual = aba;
            history.pushState(estadoHistoricoAbaGestor(aba, _gestorHistIndice, 0), '', gestorUrlAba(aba));
        } catch (_) {
            _gestorAbaAtual = aba;
        }
        atualizarBotoesHistoricoGestor();
    }

    window.voltarAbaGestor = function () {
        if (_gestorHistIndice <= 0) return;
        history.back();
    };

    window.avancarAbaGestor = function () {
        if (_gestorHistIndice >= _gestorHistMax) return;
        history.forward();
    };

    window.addEventListener('popstate', function (ev) {
        if (typeof painelGestorEstaVisivel === 'function' && !painelGestorEstaVisivel()) return;
        if (window.Swal && typeof Swal.isVisible === 'function' && Swal.isVisible()) {
            try { Swal.close(); } catch (_) {}
        }
        const st = ev.state;
        if (!st || st.gestor !== GESTOR_HIST_MARCA || st.sentinel) {
            try {
                history.pushState(
                    estadoHistoricoAbaGestor(_gestorAbaAtual, _gestorHistIndice, capturarScrollGestor()),
                    '',
                    gestorUrlAba(_gestorAbaAtual)
                );
            } catch (_) {}
            atualizarBotoesHistoricoGestor();
            return;
        }
        _gestorHistIndice = typeof st.idx === 'number' ? st.idx : _gestorHistIndice;
        _gestorAbaAtual = st.aba || 'inicio';
        window.mudarAba(_gestorAbaAtual, encontrarBotaoAbaGestor(_gestorAbaAtual), {
            preservarConteudo: true,
            semHistorico: true,
            scroll: st.scroll
        });
        atualizarBotoesHistoricoGestor();
    });

    window.mudarAba = function(aba, elementoAtivado, opcoes) {
        opcoes = opcoes || {};
        const preservarConteudo = !!opcoes.preservarConteudo;
        const semHistorico = !!opcoes.semHistorico || preservarConteudo;

        if (!semHistorico) registrarNavegacaoAbaGestor(aba);

        if (window.innerWidth <= 900) fecharMenuMobileGestor();

        if (aba === 'inicio') {
            if (typeof mostrarTelaInicioGestor === 'function') mostrarTelaInicioGestor();
            if (preservarConteudo) restaurarScrollGestor(opcoes.scroll);
            return;
        }

        document.querySelectorAll('.gestor-menu-btn').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));

        const wrap = document.getElementById('gestor-sections-wrap');
        if (wrap) wrap.classList.remove('gestor-wrap-inicio');

        const grupoEquipe = document.getElementById('grupo-menu-equipe');
        if (grupoEquipe) {
            if (ABAS_GRUPO_EQUIPE.includes(aba)) {
                grupoEquipe.classList.add('has-active');
                abrirGrupoMenuEquipe();
            } else {
                grupoEquipe.classList.remove('has-active');
            }
        }

        const grupoObras = document.getElementById('grupo-menu-obras');
        if (grupoObras) {
            if (ABAS_GRUPO_OBRAS.includes(aba)) {
                grupoObras.classList.add('has-active');
                abrirGrupoMenuObras();
            } else {
                grupoObras.classList.remove('has-active');
            }
        }

        const grupoDocumentos = document.getElementById('grupo-menu-documentos');
        if (grupoDocumentos) {
            if (ABAS_GRUPO_DOCUMENTOS.includes(aba)) {
                grupoDocumentos.classList.add('has-active');
                abrirGrupoMenuDocumentos();
            } else {
                grupoDocumentos.classList.remove('has-active');
            }
        }

        const grupoEntradas = document.getElementById('grupo-menu-entradas');
        if (grupoEntradas) {
            if (ABAS_GRUPO_ENTRADAS.includes(aba)) {
                grupoEntradas.classList.add('has-active');
                abrirGrupoMenuEntradas();
            } else {
                grupoEntradas.classList.remove('has-active');
            }
        }

        const grupoCartoes = document.getElementById('grupo-menu-cartoes');
        if (grupoCartoes) {
            if (ABAS_GRUPO_CARTOES.includes(aba)) {
                grupoCartoes.classList.add('has-active');
                abrirGrupoMenuCartoes();
            } else {
                grupoCartoes.classList.remove('has-active');
            }
        }

        if (!elementoAtivado) elementoAtivado = encontrarBotaoAbaGestor(aba);

        if (elementoAtivado) {
            elementoAtivado.classList.add('active');
            const tituloEl = document.getElementById('gestor-titulo-aba');
            if (tituloEl && elementoAtivado.dataset.titulo) {
                tituloEl.textContent = elementoAtivado.dataset.titulo;
            }
        }
        const secao = document.getElementById(`aba-${aba}`);
        if (secao) secao.classList.add('active');

        if (preservarConteudo) {
            restaurarScrollGestor(opcoes.scroll);
            return;
        }

        const mainGestor = document.querySelector('.gestor-main-content');
        if (mainGestor) mainGestor.scrollTop = 0;

        if (aba === 'equipe-cadastrada') {
            carregarListaDeFuncionarios();
        }
        if (aba === 'despesas-cadastrar') {
            if (typeof window.carregarNomesCadastroDespesas === 'function') {
                window._cacheNomesDespesas = null;
                window.carregarNomesCadastroDespesas();
            }
        }
        if (aba === 'despesas-relatorio') {
            carregarFiltrosDespesas();
        }
        if (aba === 'relatorio-despesas') {
            if (typeof window.carregarNomesRelatorioDespesas === 'function') {
                window.carregarNomesRelatorioDespesas();
            }
        }
        if (aba === 'obras-relatorio-geral') {
            if (typeof window.carregarRelatorioGeralObras === 'function') {
                window.carregarRelatorioGeralObras();
            }
        }
        if (aba === 'notas-fiscais-geral') {
            if (typeof window.carregarSugestoesRelGeralNF === 'function') {
                window.carregarSugestoesRelGeralNF();
            }
            if (typeof window.carregarRelatorioGeralNotasFiscais === 'function') {
                window.carregarRelatorioGeralNotasFiscais();
            }
        }
        if (aba === 'criar' && typeof preencherDataValePadrao === 'function') {
            preencherDataValePadrao();
        }
        if (aba === 'folha' && typeof window.listarValesManuaisDaFolha === 'function') {
            window.listarValesManuaisDaFolha();
        }
        if (aba === 'pedidos') {
            buscarPedidosMaterial();
        }
        if (aba === 'holerites') {
            if (typeof buscarHoleritesAssinatura === 'function') {
                // lista só após escolher funcionário; mantém select atualizado
            }
        }
        if (aba === 'arquivamento-contas' && typeof window.carregarArquivamentoContas === 'function') {
            window.carregarArquivamentoContas();
        }
        if (aba === 'calendario') {
            carregarFeriados();
        }
        if (aba === 'ajuda-custo') {
            initAjudaCustoDatasPadrao();
            carregarAjudaCustoLista();
        }
        if (aba === 'descontos-folha') {
            initDescontosFolhaDatasPadrao();
            carregarDescontosFolhaLista();
        }
        if (aba === 'contas-receber' && typeof window.renderContasReceber === 'function') {
            window.renderContasReceber();
        }
        if (aba === 'recebimentos' && typeof window.renderRecebimentos === 'function') {
            window.renderRecebimentos();
        }
        if (aba === 'cartoes-cadastro' && typeof window.initFormCadastroCartao === 'function') {
            window.initFormCadastroCartao();
        }
        if (aba === 'cartoes-cadastrados' && typeof window.carregarCartoesCadastrados === 'function') {
            window.carregarCartoesCadastrados();
        }
        if (aba === 'cartoes-dashboard' && typeof window.carregarDashboardCartoes === 'function') {
            window.carregarDashboardCartoes();
        }
        if (aba === 'cartoes-reembolso' && typeof window.carregarResumoReembolsoCartoes === 'function') {
            window.carregarResumoReembolsoCartoes();
        }
        if (aba === 'cartoes-relatorio' && typeof window.initRelatorioFaturasCartoes === 'function') {
            window.initRelatorioFaturasCartoes();
        }
        if (ABAS_GRUPO_DOCUMENTOS.includes(aba)) {
            if (aba === 'documentos-contratos' && typeof window.carregarAbaContratosDocumentos === 'function') {
                window.carregarAbaContratosDocumentos();
            } else {
                const pasta = aba.replace('documentos-', '');
                if (typeof window.carregarDocumentosPessoais === 'function') {
                    window.carregarDocumentosPessoais(pasta);
                }
            }
        }
    };

    const NOMES_TIPO_DESPESA_CARTAO = {
        pagamento_realizado: 'A VISTA',
        parcelamento: 'PARCELADO',
        a_vista: 'A VISTA'
    };
    const CATEGORIAS_CARTAO_EXCEL = ['Escritório', 'Combustível', 'Marketing', 'Alimentação', 'Transporte', 'Imposto', 'Outros'];
    const NOMES_FORMA_FATURA_CARTAO = {
        DINHEIRO: 'Dinheiro',
        PIX: 'PIX',
        DEBITO_CONTA: 'Débito em conta',
        BOLETO: 'Boleto'
    };
    let _cartaoAberto = null;
    let _despesasCartaoAberto = [];
    let _todasDespesasCartoesCache = [];
    let _todosCartoesCache = [];
    let _faturasCartoesFiltradas = [];

    function apelidoDoCartao(c) { return String((c && (c.apelido || c.nome)) || '').trim(); }
    function titularDoCartao(c) { return String((c && c.titular) || '').trim(); }
    function finaisDoCartao(c) { return String((c && c.finais) || '').replace(/\D/g, '').slice(-4); }
    function formaDespesaExcel(d) {
        if (d && d.forma) return String(d.forma).toUpperCase() === 'PARCELADO' ? 'PARCELADO' : 'A VISTA';
        if (d && (d.tipo === 'parcelamento' || Number(d.parcelas_total) > 1)) return 'PARCELADO';
        return 'A VISTA';
    }
    function statusDespesaExcel(d) {
        if (d && d.status_excel) return d.status_excel;
        return (d && d.status === 'paga') ? 'PAGO' : 'A PAGAR';
    }
    function reembolsadoDespesaExcel(d) {
        const v = String((d && (d.reembolsado != null ? d.reembolsado : d.reembolsado_excel)) || 'NÃO').toUpperCase();
        return v === 'SIM' || v === 'S' || v === 'TRUE' ? 'SIM' : 'NÃO';
    }
    function cartaoDaDespesa(d) {
        return (_todosCartoesCache || []).find(function (c) { return String(c.id) === String(d && d.cartao_id); }) || {};
    }

    function preencherSelectCategoriasCartao() {
        const sel = document.getElementById('cartao-desp-categoria');
        if (!sel || sel.options.length > 1) return;
        sel.innerHTML = CATEGORIAS_CARTAO_EXCEL.map(function (c) {
            return '<option value="' + c + '">' + c + '</option>';
        }).join('');
    }

    function competenciaAtualCartao() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }

    function dataIsoHojeCartao() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function formatarCompetenciaCartao(comp) {
        if (!comp || !/^\d{4}-\d{2}$/.test(comp)) return comp || '—';
        const p = comp.split('-');
        return p[1] + '/' + p[0];
    }

    function formatarValidadeCartao(val) {
        if (!val) return '—';
        if (/^\d{4}-\d{2}$/.test(val)) {
            const p = val.split('-');
            return p[1] + '/' + p[0];
        }
        return val;
    }

    function somarMesesCompetenciaCartao(comp, add) {
        const base = (comp && /^\d{4}-\d{2}$/.test(comp)) ? comp : competenciaAtualCartao();
        const y = Number(base.slice(0, 4));
        const m = Number(base.slice(5, 7));
        const dt = new Date(y, m - 1 + (Number(add) || 0), 1);
        return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
    }

    function preencherDiasFaturaCartao() {
        const sel = document.getElementById('cartao-dia-fatura');
        if (!sel || sel.options.length > 1) return;
        sel.innerHTML = '';
        for (let i = 1; i <= 31; i++) {
            const op = document.createElement('option');
            op.value = String(i);
            op.textContent = 'Dia ' + i;
            sel.appendChild(op);
        }
        sel.value = '10';
    }
