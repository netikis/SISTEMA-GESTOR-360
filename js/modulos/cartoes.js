/* js/modulos/cartoes.js — edite este arquivo para alterar só este módulo */
    window.mascaraNumeroCartao = function (input) {
        const dig = String(input.value || '').replace(/\D/g, '').slice(0, 16);
        input.value = dig.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    };

    window.initFormCadastroCartao = function () {
        preencherDiasFaturaCartao();
        window.renderTabelaCadastroCartoes();
    };

    window.limparFormCartao = function () {
        const ids = ['cartao-titular', 'cartao-nome', 'cartao-numero', 'cartao-cvc', 'cartao-validade', 'cartao-limite', 'cartao-link-fatura'];
        ids.forEach(function (id) {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const dia = document.getElementById('cartao-dia-fatura');
        if (dia) dia.value = '10';
        const st = document.getElementById('cartao-status');
        if (st) st.value = 'ATIVO';
        const band = document.getElementById('cartao-bandeira');
        if (band) band.value = '';
    };

    window.salvarCartaoCredito = async function () {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) return Swal.fire('Atenção', 'Entre como gestor para cadastrar cartões.', 'warning');
        const titular = ((document.getElementById('cartao-titular') && document.getElementById('cartao-titular').value) || '').trim().toUpperCase();
        const nome = ((document.getElementById('cartao-nome') && document.getElementById('cartao-nome').value) || '').trim();
        const numeroDig = ((document.getElementById('cartao-numero') && document.getElementById('cartao-numero').value) || '').replace(/\D/g, '');
        const bandeira = ((document.getElementById('cartao-bandeira') && document.getElementById('cartao-bandeira').value) || '').trim();
        const validade = ((document.getElementById('cartao-validade') && document.getElementById('cartao-validade').value) || '').trim();
        const diaFatura = Number((document.getElementById('cartao-dia-fatura') && document.getElementById('cartao-dia-fatura').value) || 0);
        const limite = parseMoedaLocal((document.getElementById('cartao-limite') && document.getElementById('cartao-limite').value) || '0');
        const statusCartao = ((document.getElementById('cartao-status') && document.getElementById('cartao-status').value) || 'ATIVO').trim();
        const linkFatura = ((document.getElementById('cartao-link-fatura') && document.getElementById('cartao-link-fatura').value) || '').trim();
        if (!titular) return Swal.fire('Atenção', 'Informe o titular.', 'warning');
        if (!nome) return Swal.fire('Atenção', 'Informe o apelido do cartão.', 'warning');
        if (numeroDig.length < 4) return Swal.fire('Atenção', 'Informe o número do cartão (pelo menos os 4 últimos dígitos).', 'warning');
        if (!(diaFatura >= 1 && diaFatura <= 31)) return Swal.fire('Atenção', 'Informe o dia de vencimento da fatura.', 'warning');
        const finais = numeroDig.slice(-4);
        try {
            await addDoc(collection(db, COLECAO_CARTOES), {
                empresa_id: empresaLogada,
                titular: titular,
                nome: nome,
                apelido: nome,
                finais: finais,
                numero_mascarado: '•••• ' + finais,
                bandeira: bandeira,
                validade: validade,
                dia_vencimento_fatura: diaFatura,
                limite: limite || 0,
                status_cartao: statusCartao,
                link_fatura: linkFatura,
                timestamp: Date.now(),
                criado_em: serverTimestamp()
            });
            window.limparFormCartao();
            await window.renderTabelaCadastroCartoes();
            Swal.fire('Sucesso!', 'Cartão cadastrado. O CVC não foi gravado.', 'success');
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível salvar o cartão.', 'error');
        }
    };

    async function listarCartoesEmpresa() {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) return [];
        const snap = await getDocs(query(collection(db, COLECAO_CARTOES), where('empresa_id', '==', empresaLogada)));
        const lista = [];
        snap.forEach(function (d) { lista.push(Object.assign({ id: d.id }, d.data() || {})); });
        lista.sort(function (a, b) { return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'); });
        return lista;
    }

    async function listarDespesasCartoesEmpresa() {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) return [];
        const snap = await getDocs(query(collection(db, COLECAO_CARTOES_DESPESAS), where('empresa_id', '==', empresaLogada)));
        const lista = [];
        snap.forEach(function (d) { lista.push(Object.assign({ id: d.id }, d.data() || {})); });
        return lista;
    }

    async function listarFaturasCartoesEmpresa() {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) return [];
        const snap = await getDocs(query(collection(db, COLECAO_CARTOES_FATURAS), where('empresa_id', '==', empresaLogada)));
        const lista = [];
        snap.forEach(function (d) { lista.push(Object.assign({ id: d.id }, d.data() || {})); });
        lista.sort(function (a, b) { return String(b.data_pagamento || b.competencia || '').localeCompare(String(a.data_pagamento || a.competencia || '')); });
        return lista;
    }

    window.renderTabelaCadastroCartoes = async function () {
        const tbody = document.getElementById('tabela-cadastro-cartoes');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#888;">Carregando...</td></tr>';
        try {
            const cartoes = await listarCartoesEmpresa();
            _todosCartoesCache = cartoes;
            if (!cartoes.length) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#888;">Nenhum cartão cadastrado.</td></tr>';
                return;
            }
            tbody.innerHTML = cartoes.map(function (c) {
                const link = String(c.link_fatura || '');
                return '<tr>'
                    + '<td>' + escapeHtmlBasico(titularDoCartao(c) || '—') + '</td>'
                    + '<td>' + escapeHtmlBasico(apelidoDoCartao(c) || '—') + '</td>'
                    + '<td>' + escapeHtmlBasico(finaisDoCartao(c) || '—') + '</td>'
                    + '<td>' + escapeHtmlBasico(c.bandeira || '—') + '</td>'
                    + '<td>' + escapeHtmlBasico(String(c.dia_vencimento_fatura || '—')) + '</td>'
                    + '<td class="num">' + escapeHtmlBasico(formatarMoeda(Number(c.limite) || 0)) + '</td>'
                    + '<td>' + escapeHtmlBasico(c.status_cartao || 'ATIVO') + '</td>'
                    + '<td>' + (link ? '<a href="' + escapeAttrBasico(link) + '" target="_blank" rel="noopener">abrir</a>' : '—') + '</td>'
                    + '<td><button type="button" style="background:#c0392b;color:#fff;border:none;padding:5px 8px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;" onclick="excluirCartaoCadastro(\'' + escapeAttrBasico(c.id) + '\')">Excluir</button></td>'
                    + '</tr>';
            }).join('');
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#d9534f;">Erro ao carregar.</td></tr>';
        }
    };

    window.excluirCartaoCadastro = async function (id) {
        const ok = await Swal.fire({ title: 'Excluir cartão?', text: 'As despesas lançadas nele continuam no histórico.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Excluir', cancelButtonText: 'Cancelar' });
        if (!ok.isConfirmed) return;
        try {
            await deleteDoc(doc(db, COLECAO_CARTOES, id));
            await window.renderTabelaCadastroCartoes();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível excluir.', 'error');
        }
    };

    function preencherSelectsCartoesDespesa(cartoes) {
        const selLanc = document.getElementById('cartao-desp-cartao');
        const selFiltro = document.getElementById('filtro-desp-cartao');
        const selTit = document.getElementById('filtro-desp-titular');
        const optsCartao = ['<option value="">Todos / selecione</option>'].concat(cartoes.map(function (c) {
            return '<option value="' + escapeAttrBasico(c.id) + '">' + escapeHtmlBasico(titularDoCartao(c) + ' — ' + apelidoDoCartao(c) + ' • ' + finaisDoCartao(c)) + '</option>';
        }));
        if (selLanc) {
            const atual = selLanc.value;
            selLanc.innerHTML = optsCartao.join('').replace('Todos / selecione', 'Selecione o cartão');
            if (atual) selLanc.value = atual;
        }
        if (selFiltro) {
            const atual = selFiltro.value;
            selFiltro.innerHTML = optsCartao.join('');
            if (atual) selFiltro.value = atual;
        }
        const titulares = [];
        cartoes.forEach(function (c) {
            const t = titularDoCartao(c);
            if (t && titulares.indexOf(t) === -1) titulares.push(t);
        });
        if (selTit) {
            const atual = selTit.value;
            selTit.innerHTML = '<option value="">Todos</option>' + titulares.map(function (t) {
                return '<option value="' + escapeAttrBasico(t) + '">' + escapeHtmlBasico(t) + '</option>';
            }).join('');
            if (atual) selTit.value = atual;
        }
    }

    window.aoEscolherCartaoDespesa = function () {
        const id = (document.getElementById('cartao-desp-cartao') && document.getElementById('cartao-desp-cartao').value) || '';
        _cartaoAberto = (_todosCartoesCache || []).find(function (c) { return String(c.id) === String(id); }) || null;
    };

    window.carregarCartoesCadastrados = async function () {
        preencherSelectCategoriasCartao();
        preencherDiasFaturaCartao();
        const dataCompra = document.getElementById('cartao-desp-data');
        const compDesp = document.getElementById('cartao-desp-competencia');
        const filtroFat = document.getElementById('filtro-desp-fatura');
        const hoje = competenciaAtualCartao();
        if (dataCompra && !dataCompra.value) dataCompra.value = dataIsoHojeCartao();
        if (compDesp && !compDesp.value) compDesp.value = hoje;
        if (filtroFat && !filtroFat.value) filtroFat.value = hoje;
        try {
            _todosCartoesCache = await listarCartoesEmpresa();
            preencherSelectsCartoesDespesa(_todosCartoesCache);
        } catch (e) {
            console.error(e);
        }
        await window.renderTabelaFaturaDespesas();
    };

    window.fecharDetalheCartao = function () {
        window.carregarCartoesCadastrados();
    };

    window.abrirCartaoCadastrado = async function (id) {
        await window.carregarCartoesCadastrados();
        const sel = document.getElementById('cartao-desp-cartao');
        const filtro = document.getElementById('filtro-desp-cartao');
        if (sel) sel.value = id;
        if (filtro) filtro.value = id;
        window.aoEscolherCartaoDespesa();
        await window.renderTabelaFaturaDespesas();
    };

    window.alternarParcelasCartao = function () {
        const tipo = (document.getElementById('cartao-desp-tipo') && document.getElementById('cartao-desp-tipo').value) || '';
        const wrap = document.getElementById('cartao-desp-parcelas-wrap');
        if (wrap) wrap.style.display = tipo === 'parcelamento' ? '' : 'none';
    };

    window.limparFormDespesaCartao = function (manterDatas) {
        const desc = document.getElementById('cartao-desp-descricao');
        const tipo = document.getElementById('cartao-desp-tipo');
        const valor = document.getElementById('cartao-desp-valor');
        const parc = document.getElementById('cartao-desp-parcelas');
        const comprov = document.getElementById('cartao-desp-comprovante');
        const status = document.getElementById('cartao-desp-status');
        const reemb = document.getElementById('cartao-desp-reembolsado');
        if (desc) desc.value = '';
        if (tipo) tipo.value = 'a_vista';
        if (valor) valor.value = '';
        if (parc) parc.value = '2';
        if (comprov) comprov.value = '';
        if (status) status.value = 'A PAGAR';
        if (reemb) reemb.value = 'NÃO';
        if (!manterDatas) {
            const dataCompra = document.getElementById('cartao-desp-data');
            const comp = document.getElementById('cartao-desp-competencia');
            if (dataCompra) dataCompra.value = dataIsoHojeCartao();
            if (comp) comp.value = competenciaAtualCartao();
        }
        window.alternarParcelasCartao();
    };

    window.salvarDespesaCartao = async function () {
        const empresaLogada = getEmpresaGestor();
        window.aoEscolherCartaoDespesa();
        if (!empresaLogada || !_cartaoAberto) return Swal.fire('Atenção', 'Selecione o cartão para lançar a despesa.', 'warning');
        const descricao = ((document.getElementById('cartao-desp-descricao') && document.getElementById('cartao-desp-descricao').value) || '').trim();
        const categoria = ((document.getElementById('cartao-desp-categoria') && document.getElementById('cartao-desp-categoria').value) || 'Outros').trim();
        const tipo = (document.getElementById('cartao-desp-tipo') && document.getElementById('cartao-desp-tipo').value) || 'a_vista';
        const valor = parseMoedaLocal((document.getElementById('cartao-desp-valor') && document.getElementById('cartao-desp-valor').value) || '0');
        const dataCompra = ((document.getElementById('cartao-desp-data') && document.getElementById('cartao-desp-data').value) || '').trim();
        const competencia = ((document.getElementById('cartao-desp-competencia') && document.getElementById('cartao-desp-competencia').value) || competenciaAtualCartao()).trim();
        const statusExcel = ((document.getElementById('cartao-desp-status') && document.getElementById('cartao-desp-status').value) || 'A PAGAR').trim();
        const reembolsado = ((document.getElementById('cartao-desp-reembolsado') && document.getElementById('cartao-desp-reembolsado').value) || 'NÃO').trim();
        const comprovante = ((document.getElementById('cartao-desp-comprovante') && document.getElementById('cartao-desp-comprovante').value) || '').trim();
        let qtdParcelas = 1;
        if (tipo === 'parcelamento') {
            qtdParcelas = Math.max(2, Math.min(24, Number((document.getElementById('cartao-desp-parcelas') && document.getElementById('cartao-desp-parcelas').value) || 2)));
        }
        if (!descricao) return Swal.fire('Atenção', 'Informe a descrição / fornecedor.', 'warning');
        if (!(valor > 0)) return Swal.fire('Atenção', 'Informe o valor da compra.', 'warning');
        if (!dataCompra) return Swal.fire('Atenção', 'Informe a data da compra.', 'warning');
        const valorParcela = Math.round((valor / qtdParcelas) * 100) / 100;
        const forma = tipo === 'parcelamento' ? 'PARCELADO' : 'A VISTA';
        try {
            const grupoId = 'grp_' + Date.now();
            for (let i = 0; i < qtdParcelas; i++) {
                const resto = i === qtdParcelas - 1
                    ? Math.round((valor - valorParcela * (qtdParcelas - 1)) * 100) / 100
                    : valorParcela;
                await addDoc(collection(db, COLECAO_CARTOES_DESPESAS), {
                    empresa_id: empresaLogada,
                    cartao_id: _cartaoAberto.id,
                    cartao_nome: apelidoDoCartao(_cartaoAberto),
                    titular: titularDoCartao(_cartaoAberto),
                    cartao_finais: finaisDoCartao(_cartaoAberto),
                    vcto_dia: Number(_cartaoAberto.dia_vencimento_fatura) || null,
                    tipo: tipo,
                    forma: forma,
                    descricao: descricao,
                    categoria: categoria,
                    valor_compra: valor,
                    valor_parcela: resto,
                    parcelas_total: qtdParcelas,
                    parcela_num: i + 1,
                    grupo_id: grupoId,
                    data_compra: dataCompra,
                    competencia: somarMesesCompetenciaCartao(competencia, i),
                    status: statusExcel === 'PAGO' ? 'paga' : 'aberta',
                    status_excel: statusExcel,
                    reembolsado: reembolsado,
                    link_comprovante: comprovante,
                    timestamp: Date.now() + i,
                    criado_em: serverTimestamp()
                });
            }
            window.limparFormDespesaCartao(true);
            await window.renderTabelaFaturaDespesas();
            Swal.fire('Sucesso!', qtdParcelas > 1 ? 'Parcelamento lançado em ' + qtdParcelas + ' faturas.' : 'Despesa salva.', 'success');
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível salvar a despesa.', 'error');
        }
    };

    window.renderTabelaFaturaDespesas = async function () {
        const tbody = document.getElementById('tabela-fatura-despesas');
        const totalEl = document.getElementById('cartao-fatura-total');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="17" style="text-align:center;color:#888;">Carregando...</td></tr>';
        const filtroTit = ((document.getElementById('filtro-desp-titular') && document.getElementById('filtro-desp-titular').value) || '').trim();
        const filtroCartao = ((document.getElementById('filtro-desp-cartao') && document.getElementById('filtro-desp-cartao').value) || '').trim();
        const filtroFat = ((document.getElementById('filtro-desp-fatura') && document.getElementById('filtro-desp-fatura').value) || '').trim();
        const filtroSt = ((document.getElementById('filtro-desp-status') && document.getElementById('filtro-desp-status').value) || '').trim();
        const hiddenComp = document.getElementById('cartao-fatura-competencia');
        if (hiddenComp) hiddenComp.value = filtroFat || competenciaAtualCartao();
        try {
            if (!_todosCartoesCache.length) _todosCartoesCache = await listarCartoesEmpresa();
            const todas = await listarDespesasCartoesEmpresa();
            _todasDespesasCartoesCache = todas;
            const filtradas = todas.filter(function (d) {
                const cartao = cartaoDaDespesa(d);
                const titular = String(d.titular || titularDoCartao(cartao) || '').toUpperCase();
                if (filtroTit && titular !== filtroTit.toUpperCase()) return false;
                if (filtroCartao && String(d.cartao_id) !== String(filtroCartao)) return false;
                if (filtroFat && String(d.competencia) !== String(filtroFat)) return false;
                if (filtroSt && statusDespesaExcel(d) !== filtroSt) return false;
                return true;
            }).sort(function (a, b) {
                return String(a.data_compra || '').localeCompare(String(b.data_compra || '')) || String(a.competencia || '').localeCompare(String(b.competencia || ''));
            });
            _despesasCartaoAberto = filtradas;
            if (filtroCartao) {
                _cartaoAberto = (_todosCartoesCache || []).find(function (c) { return String(c.id) === String(filtroCartao); }) || _cartaoAberto;
            }
            const abertas = filtradas.filter(function (d) { return statusDespesaExcel(d) !== 'PAGO'; });
            const totalAberto = abertas.reduce(function (s, d) { return s + (Number(d.valor_parcela) || 0); }, 0);
            if (totalEl) totalEl.textContent = 'Total em aberto (filtro): ' + formatarMoeda(totalAberto);
            if (!filtradas.length) {
                tbody.innerHTML = '<tr><td colspan="17" style="text-align:center;color:#888;">Nenhum lançamento neste filtro.</td></tr>';
                return;
            }
            tbody.innerHTML = filtradas.map(function (d) {
                const cartao = cartaoDaDespesa(d);
                const st = statusDespesaExcel(d);
                const reemb = reembolsadoDespesaExcel(d);
                const link = String(d.link_comprovante || '');
                const dataBr = (d.data_compra && /^\d{4}-\d{2}-\d{2}/.test(d.data_compra)) ? d.data_compra.split('-').reverse().join('/') : (d.data_compra || '—');
                return '<tr>'
                    + '<td>' + escapeHtmlBasico(dataBr) + '</td>'
                    + '<td>' + escapeHtmlBasico(d.titular || titularDoCartao(cartao) || '—') + '</td>'
                    + '<td>' + escapeHtmlBasico(d.cartao_nome || apelidoDoCartao(cartao) || '—') + '</td>'
                    + '<td>' + escapeHtmlBasico(d.cartao_finais || finaisDoCartao(cartao) || '—') + '</td>'
                    + '<td>' + escapeHtmlBasico(String(d.vcto_dia || cartao.dia_vencimento_fatura || '—')) + '</td>'
                    + '<td>' + escapeHtmlBasico(d.descricao || '—') + '</td>'
                    + '<td>' + escapeHtmlBasico(d.categoria || '—') + '</td>'
                    + '<td>' + escapeHtmlBasico(formatarCompetenciaCartao(d.competencia)) + '</td>'
                    + '<td>' + escapeHtmlBasico(formaDespesaExcel(d)) + '</td>'
                    + '<td class="num">' + escapeHtmlBasico(String(d.parcelas_total || 1)) + '</td>'
                    + '<td class="num">' + escapeHtmlBasico(String(d.parcela_num || 1)) + '</td>'
                    + '<td class="num">' + escapeHtmlBasico(formatarMoeda(Number(d.valor_compra) || 0)) + '</td>'
                    + '<td class="num"><b>' + escapeHtmlBasico(formatarMoeda(Number(d.valor_parcela) || 0)) + '</b></td>'
                    + '<td class="' + (st === 'PAGO' ? 'tag-pago' : 'tag-apagar') + '">' + escapeHtmlBasico(st) + '</td>'
                    + '<td>' + (link ? '<a href="' + escapeAttrBasico(link) + '" target="_blank" rel="noopener">abrir</a>' : '—') + '</td>'
                    + '<td><button type="button" style="background:' + (reemb === 'SIM' ? '#1e8449' : '#7f8c8d') + ';color:#fff;border:none;padding:5px 8px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;" onclick="alternarReembolsoDespesa(\'' + escapeAttrBasico(d.id) + '\',\'' + (reemb === 'SIM' ? 'NÃO' : 'SIM') + '\')">' + escapeHtmlBasico(reemb) + '</button></td>'
                    + '<td>' + (st === 'PAGO' ? '' : '<button type="button" style="background:#c0392b;color:#fff;border:none;padding:5px 8px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;" onclick="excluirDespesaCartao(\'' + escapeAttrBasico(d.id) + '\')">Excluir</button>') + '</td>'
                    + '</tr>';
            }).join('');
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="17" style="text-align:center;color:#d9534f;">Erro ao carregar lançamentos.</td></tr>';
        }
    };

    window.renderDespesasCartaoAberto = window.renderTabelaFaturaDespesas;

    window.alternarReembolsoDespesa = async function (id, novo) {
        try {
            await updateDoc(doc(db, COLECAO_CARTOES_DESPESAS, id), { reembolsado: novo });
            await window.renderTabelaFaturaDespesas();
            if (typeof window.carregarResumoReembolsoCartoes === 'function') window.carregarResumoReembolsoCartoes();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível atualizar o reembolso.', 'error');
        }
    };

    window.excluirDespesaCartao = async function (id) {
        const ok = await Swal.fire({ title: 'Excluir lançamento?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Excluir', cancelButtonText: 'Cancelar' });
        if (!ok.isConfirmed) return;
        try {
            await deleteDoc(doc(db, COLECAO_CARTOES_DESPESAS, id));
            await window.renderTabelaFaturaDespesas();
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível excluir.', 'error');
        }
    };

    window.marcarFaturaCartaoPaga = async function () {
        const filtroCartao = ((document.getElementById('filtro-desp-cartao') && document.getElementById('filtro-desp-cartao').value) || '').trim();
        if (filtroCartao) {
            _cartaoAberto = (_todosCartoesCache || []).find(function (c) { return String(c.id) === String(filtroCartao); }) || _cartaoAberto;
        }
        if (!_cartaoAberto) return Swal.fire('Atenção', 'Filtre por um cartão antes de marcar a fatura como paga.', 'warning');
        const competencia = ((document.getElementById('cartao-fatura-competencia') && document.getElementById('cartao-fatura-competencia').value) || ((document.getElementById('filtro-desp-fatura') && document.getElementById('filtro-desp-fatura').value) || '')).trim();
        if (!competencia) return Swal.fire('Atenção', 'Escolha o mês e o ano da fatura no filtro.', 'warning');
        const abertas = (_despesasCartaoAberto || []).filter(function (d) {
            return String(d.cartao_id) === String(_cartaoAberto.id) && statusDespesaExcel(d) !== 'PAGO';
        });
        if (!abertas.length) return Swal.fire('Atenção', 'Não há lançamentos em aberto nesta fatura.', 'info');
        const total = abertas.reduce(function (s, d) { return s + (Number(d.valor_parcela) || 0); }, 0);
        const result = await Swal.fire({
            title: 'Fatura paga',
            html: '<p style="margin:0 0 10px;">Cartão: <b>' + escapeHtmlBasico(apelidoDoCartao(_cartaoAberto)) + '</b><br>Fatura ' + escapeHtmlBasico(formatarCompetenciaCartao(competencia)) + '<br>Total: <b>' + escapeHtmlBasico(formatarMoeda(total)) + '</b></p>'
                + '<label style="display:block;text-align:left;font-size:13px;">Data do pagamento</label>'
                + '<input id="swal-cartao-data-pag" type="date" class="swal2-input" style="width:auto;margin:6px 0 12px;" value="' + dataIsoHojeCartao() + '">'
                + '<label style="display:block;text-align:left;font-size:13px;">Forma de pagamento</label>'
                + '<select id="swal-cartao-forma-pag" class="swal2-input" style="width:auto;margin:6px 0;">'
                + '<option value="DINHEIRO">Dinheiro</option>'
                + '<option value="PIX" selected>PIX</option>'
                + '<option value="DEBITO_CONTA">Débito em conta</option>'
                + '<option value="BOLETO">Boleto</option>'
                + '</select>',
            showCancelButton: true,
            confirmButtonText: 'Confirmar pagamento',
            cancelButtonText: 'Cancelar',
            preConfirm: function () {
                const dataPag = (document.getElementById('swal-cartao-data-pag') && document.getElementById('swal-cartao-data-pag').value) || '';
                const forma = (document.getElementById('swal-cartao-forma-pag') && document.getElementById('swal-cartao-forma-pag').value) || 'PIX';
                if (!dataPag) {
                    Swal.showValidationMessage('Informe a data do pagamento.');
                    return false;
                }
                return { dataPag: dataPag, forma: forma };
            }
        });
        if (!result.isConfirmed || !result.value) return;
        const empresaLogada = getEmpresaGestor();
        try {
            const faturaRef = await addDoc(collection(db, COLECAO_CARTOES_FATURAS), {
                empresa_id: empresaLogada,
                cartao_id: _cartaoAberto.id,
                cartao_nome: apelidoDoCartao(_cartaoAberto),
                competencia: competencia,
                data_pagamento: result.value.dataPag,
                forma_pagamento: result.value.forma,
                valor_total: total,
                qtd_lancamentos: abertas.length,
                status: 'paga',
                timestamp: Date.now(),
                criado_em: serverTimestamp()
            });
            for (let i = 0; i < abertas.length; i++) {
                await updateDoc(doc(db, COLECAO_CARTOES_DESPESAS, abertas[i].id), {
                    status: 'paga',
                    status_excel: 'PAGO',
                    fatura_id: faturaRef.id,
                    data_pagamento: result.value.dataPag,
                    forma_pagamento: result.value.forma
                });
            }
            await window.renderTabelaFaturaDespesas();
            Swal.fire('Sucesso!', 'Fatura lançada no relatório de faturas pagas.', 'success');
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível marcar a fatura como paga.', 'error');
        }
    };

    window.carregarDashboardCartoes = async function () {
        const tbCat = document.getElementById('dash-cartoes-categoria');
        const tbTit = document.getElementById('dash-cartoes-titular');
        const tbMes = document.getElementById('dash-cartoes-mes');
        if (!tbCat || !tbTit || !tbMes) return;
        tbCat.innerHTML = tbTit.innerHTML = tbMes.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#888;">Carregando...</td></tr>';
        try {
            _todosCartoesCache = await listarCartoesEmpresa();
            const despesas = await listarDespesasCartoesEmpresa();
            const porCat = {};
            const porTit = {};
            const porMes = {};
            const titulares = [];
            let geral = 0;
            despesas.forEach(function (d) {
                const v = Number(d.valor_parcela) || 0;
                const cat = d.categoria || 'Outros';
                const cartao = cartaoDaDespesa(d);
                const tit = String(d.titular || titularDoCartao(cartao) || '—').toUpperCase();
                const mes = formatarCompetenciaCartao(d.competencia);
                const forma = formaDespesaExcel(d);
                geral += v;
                porCat[cat] = (porCat[cat] || 0) + v;
                if (!porTit[tit]) porTit[tit] = { total: 0, vista: 0, parc: 0 };
                porTit[tit].total += v;
                if (forma === 'PARCELADO') porTit[tit].parc += v; else porTit[tit].vista += v;
                if (titulares.indexOf(tit) === -1) titulares.push(tit);
                if (!porMes[mes]) porMes[mes] = { total: 0, porTit: {} };
                porMes[mes].total += v;
                porMes[mes].porTit[tit] = (porMes[mes].porTit[tit] || 0) + v;
            });
            const cats = Object.keys(porCat).sort(function (a, b) { return porCat[b] - porCat[a]; });
            tbCat.innerHTML = (cats.length ? cats.map(function (c) {
                const pct = geral ? ((porCat[c] / geral) * 100).toFixed(1).replace('.', ',') + '%' : '0%';
                return '<tr><td>' + escapeHtmlBasico(c) + '</td><td class="num">' + escapeHtmlBasico(formatarMoeda(porCat[c])) + '</td><td class="num">' + pct + '</td></tr>';
            }).join('') : '<tr><td colspan="3" style="text-align:center;color:#888;">Sem lançamentos.</td></tr>');
            const tits = Object.keys(porTit).sort();
            let totT = 0, totV = 0, totP = 0;
            tbTit.innerHTML = (tits.length ? tits.map(function (t) {
                totT += porTit[t].total; totV += porTit[t].vista; totP += porTit[t].parc;
                return '<tr><td>' + escapeHtmlBasico(t) + '</td><td class="num">' + escapeHtmlBasico(formatarMoeda(porTit[t].total)) + '</td><td class="num">' + escapeHtmlBasico(formatarMoeda(porTit[t].vista)) + '</td><td class="num">' + escapeHtmlBasico(formatarMoeda(porTit[t].parc)) + '</td></tr>';
            }).join('') + '<tr><td><b>TOTAL</b></td><td class="num"><b>' + escapeHtmlBasico(formatarMoeda(totT)) + '</b></td><td class="num"><b>' + escapeHtmlBasico(formatarMoeda(totV)) + '</b></td><td class="num"><b>' + escapeHtmlBasico(formatarMoeda(totP)) + '</b></td></tr>' : '<tr><td colspan="4" style="text-align:center;color:#888;">Sem lançamentos.</td></tr>');
            const th = document.getElementById('dash-cartoes-mes-th-titulares');
            const headRow = tbMes.parentNode.querySelector('thead tr');
            if (headRow) {
                headRow.innerHTML = '<th>MÊS FATURA</th><th>TOTAL</th>' + titulares.map(function (t) {
                    return '<th>' + escapeHtmlBasico(t) + '</th>';
                }).join('');
            }
            const meses = Object.keys(porMes).sort(function (a, b) {
                const pa = a.split('/'); const pb = b.split('/');
                return String(pa[1] || '') + String(pa[0] || '') < String(pb[1] || '') + String(pb[0] || '') ? -1 : 1;
            });
            tbMes.innerHTML = (meses.length ? meses.map(function (m) {
                return '<tr><td>' + escapeHtmlBasico(m) + '</td><td class="num">' + escapeHtmlBasico(formatarMoeda(porMes[m].total)) + '</td>'
                    + titulares.map(function (t) { return '<td class="num">' + escapeHtmlBasico(formatarMoeda(porMes[m].porTit[t] || 0)) + '</td>'; }).join('')
                    + '</tr>';
            }).join('') : '<tr><td colspan="4" style="text-align:center;color:#888;">Sem lançamentos.</td></tr>');
        } catch (e) {
            console.error(e);
            tbCat.innerHTML = '<tr><td colspan="3" style="color:#d9534f;text-align:center;">Erro ao carregar.</td></tr>';
        }
    };

    window.carregarResumoReembolsoCartoes = async function () {
        const tbody = document.getElementById('tabela-resumo-reembolso');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">Carregando...</td></tr>';
        try {
            _todosCartoesCache = await listarCartoesEmpresa();
            const despesas = await listarDespesasCartoesEmpresa();
            const porTit = {};
            despesas.forEach(function (d) {
                const cartao = cartaoDaDespesa(d);
                const tit = String(d.titular || titularDoCartao(cartao) || '—').toUpperCase();
                if (!porTit[tit]) porTit[tit] = { gasto: 0, reemb: 0 };
                const v = Number(d.valor_parcela) || 0;
                porTit[tit].gasto += v;
                if (reembolsadoDespesaExcel(d) === 'SIM') porTit[tit].reemb += v;
            });
            const tits = Object.keys(porTit).sort();
            let tG = 0, tR = 0, tA = 0;
            if (!tits.length) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">Sem lançamentos.</td></tr>';
                return;
            }
            tbody.innerHTML = tits.map(function (t) {
                const a = porTit[t].gasto - porTit[t].reemb;
                const pct = porTit[t].gasto ? ((porTit[t].reemb / porTit[t].gasto) * 100).toFixed(1).replace('.', ',') + '%' : '0%';
                tG += porTit[t].gasto; tR += porTit[t].reemb; tA += a;
                return '<tr><td>' + escapeHtmlBasico(t) + '</td><td class="num">' + escapeHtmlBasico(formatarMoeda(porTit[t].gasto)) + '</td><td class="num">' + escapeHtmlBasico(formatarMoeda(porTit[t].reemb)) + '</td><td class="num">' + escapeHtmlBasico(formatarMoeda(a)) + '</td><td class="num">' + pct + '</td></tr>';
            }).join('') + '<tr><td><b>TOTAL</b></td><td class="num"><b>' + escapeHtmlBasico(formatarMoeda(tG)) + '</b></td><td class="num"><b>' + escapeHtmlBasico(formatarMoeda(tR)) + '</b></td><td class="num"><b>' + escapeHtmlBasico(formatarMoeda(tA)) + '</b></td><td></td></tr>';
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="5" style="color:#d9534f;text-align:center;">Erro ao carregar.</td></tr>';
        }
    };

    window.initRelatorioFaturasCartoes = function () {
        const ano = document.getElementById('cartao-rel-ano');
        if (ano && !ano.value) ano.value = String(new Date().getFullYear());
        const mes = document.getElementById('cartao-rel-mes');
        if (mes && !mes.value) mes.value = String(new Date().getMonth() + 1).padStart(2, '0');
        window.carregarRelatorioFaturasCartoes();
    };

    window.carregarRelatorioFaturasCartoes = async function () {
        const box = document.getElementById('lista-relatorio-faturas-cartao');
        const resumo = document.getElementById('cartao-rel-resumo');
        const totais = document.getElementById('cartao-rel-resumo-totais');
        if (!box) return;
        box.innerHTML = '<p style="text-align:center;color:#888;">Carregando...</p>';
        const dataFiltro = ((document.getElementById('cartao-rel-data') && document.getElementById('cartao-rel-data').value) || '').trim();
        const mesFiltro = ((document.getElementById('cartao-rel-mes') && document.getElementById('cartao-rel-mes').value) || '').trim();
        const anoFiltro = String((document.getElementById('cartao-rel-ano') && document.getElementById('cartao-rel-ano').value) || '').trim();
        try {
            let lista = await listarFaturasCartoesEmpresa();
            lista = lista.filter(function (f) {
                const dataPag = String(f.data_pagamento || '');
                const comp = String(f.competencia || '');
                if (dataFiltro && dataPag !== dataFiltro) return false;
                if (mesFiltro) {
                    const mesPag = dataPag.slice(5, 7) || comp.slice(5, 7);
                    if (mesPag !== mesFiltro) return false;
                }
                if (anoFiltro) {
                    const anoPag = dataPag.slice(0, 4) || comp.slice(0, 4);
                    if (anoPag !== anoFiltro) return false;
                }
                return true;
            });
            _faturasCartoesFiltradas = lista;
            const soma = lista.reduce(function (s, f) { return s + (Number(f.valor_total) || 0); }, 0);
            if (resumo) resumo.style.display = '';
            if (totais) totais.innerHTML = '<h2 style="margin:6px 0 0;color:#d9534f;">' + escapeHtmlBasico(formatarMoeda(soma)) + '</h2>'
                + '<p style="margin:6px 0 0;font-size:13px;">' + lista.length + ' fatura(s) paga(s)</p>';
            if (!lista.length) {
                box.innerHTML = '<p style="text-align:center;color:#888;">Nenhuma fatura paga neste filtro.</p>';
                return;
            }
            box.innerHTML = lista.map(function (f) {
                const forma = NOMES_FORMA_FATURA_CARTAO[f.forma_pagamento] || f.forma_pagamento || '—';
                const dataBr = (f.data_pagamento && /^\d{4}-\d{2}-\d{2}/.test(f.data_pagamento))
                    ? f.data_pagamento.split('-').reverse().join('/')
                    : (f.data_pagamento || '—');
                return '<div class="cartao-item" style="cursor:default;">'
                    + '<h4>' + escapeHtmlBasico(f.cartao_nome || 'Cartão') + '</h4>'
                    + '<div style="font-size:13px;color:#555;">Fatura ' + escapeHtmlBasico(formatarCompetenciaCartao(f.competencia))
                    + ' · Pago em ' + escapeHtmlBasico(dataBr)
                    + ' · ' + escapeHtmlBasico(forma) + '</div>'
                    + '<div style="margin-top:6px;font-weight:800;color:#1e8449;">' + escapeHtmlBasico(formatarMoeda(Number(f.valor_total) || 0)) + '</div>'
                    + '</div>';
            }).join('');
        } catch (e) {
            console.error(e);
            box.innerHTML = '<p style="text-align:center;color:#d9534f;">Erro ao carregar o relatório.</p>';
        }
    };

    window.exportarPDFFaturasCartoes = async function () {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            return Swal.fire('Erro', 'Biblioteca PDF não carregou. Recarregue a página (Ctrl+F5).', 'error');
        }
        if (!_faturasCartoesFiltradas.length) {
            return Swal.fire('Atenção', 'Busque o relatório antes de exportar.', 'warning');
        }
        const { jsPDF } = window.jspdf;
        const docPdf = new jsPDF('p', 'mm', 'a4');
        const empresa = getEmpresaGestor() || 'Empresa';
        docPdf.setFontSize(12);
        docPdf.setFont('helvetica', 'bold');
        docPdf.text(String(empresa), 14, 14);
        docPdf.setFontSize(11);
        docPdf.text('Relatorio de Faturas de Cartoes', 14, 21);
        const soma = _faturasCartoesFiltradas.reduce(function (s, f) { return s + (Number(f.valor_total) || 0); }, 0);
        const body = _faturasCartoesFiltradas.map(function (f) {
            const dataBr = (f.data_pagamento && /^\d{4}-\d{2}-\d{2}/.test(f.data_pagamento))
                ? f.data_pagamento.split('-').reverse().join('/')
                : (f.data_pagamento || '—');
            return [
                f.cartao_nome || '',
                formatarCompetenciaCartao(f.competencia),
                dataBr,
                NOMES_FORMA_FATURA_CARTAO[f.forma_pagamento] || f.forma_pagamento || '',
                formatarMoeda(Number(f.valor_total) || 0)
            ];
        });
        docPdf.autoTable({
            startY: 26,
            head: [['Cartao', 'Fatura', 'Pagamento', 'Forma', 'Valor']],
            body: body,
            foot: [['', '', '', 'Total', formatarMoeda(soma)]],
            styles: { fontSize: 9 }
        });
        docPdf.save('faturas-cartoes.pdf');
    };
