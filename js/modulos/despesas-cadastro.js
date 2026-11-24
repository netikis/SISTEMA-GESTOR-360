/* js/modulos/despesas-cadastro.js — edite este arquivo para alterar só este módulo */
    function normalizarChaveNomeDespesa(nome) {
        return String(nome || '')
            .trim()
            .replace(/\s+/g, ' ')
            .toLowerCase();
    }

    function formatarNomeCanonicoDespesa(nome) {
        return String(nome || '')
            .trim()
            .replace(/\s+/g, ' ')
            .toUpperCase();
    }

    function registrarNomeUnicoNoMapa(mapa, nome) {
        const chave = normalizarChaveNomeDespesa(nome);
        if (!chave) return;
        const canonico = formatarNomeCanonicoDespesa(nome);
        const atual = mapa.get(chave);
        if (!atual) {
            mapa.set(chave, { canonico, count: 1 });
        } else {
            atual.count += 1;
        }
    }

    function registrarFornecedorGeralNoMapa(mapa, d) {
        if (!d.loja_nome) return;
        const chLoja = normalizarChaveNomeDespesa(d.loja_nome);
        const chObra = normalizarChaveNomeDespesa(d.obra_nome || '') || '__sem_obra__';
        const canonLoja = formatarNomeCanonicoDespesa(d.loja_nome);
        const canonObra = formatarNomeCanonicoDespesa(d.obra_nome) || 'SEM OBRA';
        const valor = valorEmAbertoDespesa(d) || (despesaEstaPaga(d) ? 0 : valorOriginalDespesa(d));
        const pago = despesaEstaPaga(d);
        const pagoParc = valorPagoDespesa(d);

        if (!mapa.has(chLoja)) {
            mapa.set(chLoja, { chave: chLoja, canonico: canonLoja, vencido: 0, aVencer: 0, pago: 0, obras: new Map() });
        }
        const forn = mapa.get(chLoja);
        if (!forn.obras.has(chObra)) {
            forn.obras.set(chObra, { chave: chObra, canonico: canonObra, vencido: 0, aVencer: 0, pago: 0 });
        }
        const obra = forn.obras.get(chObra);

        if (pagoParc > 0) {
            forn.pago += pagoParc;
            obra.pago += pagoParc;
        }
        if (!pago && valor > 0) {
            if (despesaEstaVencida(d)) {
                forn.vencido += valor;
                obra.vencido += valor;
            } else {
                forn.aVencer += valor;
                obra.aVencer += valor;
            }
        }
    }

    function montarCacheNomesDespesas(querySnapshot) {
        const mapaObras = new Map();
        const mapaLojas = new Map();
        const mapaObraLojas = new Map();
        const mapaFornecedorGeral = new Map();
        querySnapshot.forEach((docSnap) => {
            const d = docSnap.data();
            registrarFornecedorGeralNoMapa(mapaFornecedorGeral, d);
            if (d.obra_nome) registrarNomeUnicoNoMapa(mapaObras, d.obra_nome);
            if (d.loja_nome) registrarNomeUnicoNoMapa(mapaLojas, d.loja_nome);
            if (d.obra_nome && d.loja_nome) {
                const chObra = normalizarChaveNomeDespesa(d.obra_nome);
                const chLoja = normalizarChaveNomeDespesa(d.loja_nome);
                if (!mapaObraLojas.has(chObra)) mapaObraLojas.set(chObra, new Map());
                const lojasDaObra = mapaObraLojas.get(chObra);
                const canonLoja = formatarNomeCanonicoDespesa(d.loja_nome);
                const valor = valorEmAbertoDespesa(d);
                const pagoParc = valorPagoDespesa(d);
                if (!lojasDaObra.has(chLoja)) {
                    lojasDaObra.set(chLoja, { canonico: canonLoja, count: 1, vencido: 0, aVencer: 0, pago: 0 });
                } else {
                    lojasDaObra.get(chLoja).count += 1;
                }
                const lojaObra = lojasDaObra.get(chLoja);
                if (pagoParc > 0) lojaObra.pago += pagoParc;
                if (!despesaEstaPaga(d) && valor > 0) {
                    if (despesaEstaVencida(d)) lojaObra.vencido += valor;
                    else lojaObra.aVencer += valor;
                }
            }
        });
        const obras = Array.from(mapaObras.values()).map((x) => x.canonico).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        const lojas = Array.from(mapaLojas.values()).map((x) => x.canonico).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        const mapaTodos = new Map();
        mapaObras.forEach((v, chave) => {
            mapaTodos.set(chave, { canonico: v.canonico, tipo: 'obra', count: v.count });
        });
        mapaLojas.forEach((v, chave) => {
            const existente = mapaTodos.get(chave);
            if (!existente || v.count > existente.count) {
                mapaTodos.set(chave, { canonico: v.canonico, tipo: 'loja', count: v.count });
            }
        });
        const todos = Array.from(new Set([...obras, ...lojas])).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        const sugestoes = Array.from(mapaTodos.entries()).map(([chave, info]) => ({
            chave,
            nome: info.canonico,
            tipo: info.tipo,
            count: info.count
        })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        const listaFornecedoresGeral = Array.from(mapaFornecedorGeral.values()).sort((a, b) => {
            const pa = a.vencido + a.aVencer;
            const pb = b.vencido + b.aVencer;
            if (pb !== pa) return pb - pa;
            return a.canonico.localeCompare(b.canonico, 'pt-BR');
        });
        window._cacheNomesDespesas = { mapaObras, mapaLojas, mapaObraLojas, mapaFornecedorGeral, listaFornecedoresGeral, mapaTodos, obras, lojas, todos, sugestoes };
        return window._cacheNomesDespesas;
    }

    function getFornecedoresDaObra(cache, nomeObra, apenasComDivida) {
        if (!cache || !cache.mapaObraLojas || !nomeObra) return [];
        const chObra = normalizarChaveNomeDespesa(nomeObra);
        const mapa = cache.mapaObraLojas.get(chObra);
        if (!mapa) return [];
        let lista = Array.from(mapa.values());
        if (apenasComDivida !== false) {
            lista = lista.filter((x) => (x.vencido + x.aVencer) > 0);
        }
        return lista.sort((a, b) => {
            const pa = a.vencido + a.aVencer;
            const pb = b.vencido + b.aVencer;
            if (pb !== pa) return pb - pa;
            return a.canonico.localeCompare(b.canonico, 'pt-BR');
        });
    }

    function resolverNomeCanonicoDespesa(valorDigitado, tipo) {
        const formatado = formatarNomeCanonicoDespesa(valorDigitado);
        const chave = normalizarChaveNomeDespesa(valorDigitado);
        if (!chave) return formatado;
        const cache = window._cacheNomesDespesas || window._cacheNomesRelDespesas;
        if (!cache) return formatado;
        const mapa = tipo === 'obra' ? cache.mapaObras : cache.mapaLojas;
        const hit = mapa.get(chave);
        return hit ? hit.canonico : formatado;
    }

    function atualizarDatalistsNomesDespesas(cache) {
        const dlObras = document.getElementById('datalist-obras-desp');
        const dlLojas = document.getElementById('datalist-lojas-desp');
        if (dlObras) {
            dlObras.innerHTML = cache.obras.map((n) => `<option value="${escapeHtmlBasico(n)}"></option>`).join('');
        }
        if (dlLojas) {
            dlLojas.innerHTML = cache.lojas.map((n) => `<option value="${escapeHtmlBasico(n)}"></option>`).join('');
        }
    }

    function htmlItemCadastroDespesa(nome, tipo, obraPai) {
        const n = escapeHtmlBasico(nome);
        const t = tipo === 'obra' ? 'obra' : 'loja';
        const obraAttr = obraPai ? ' data-obra="' + escapeHtmlBasico(obraPai) + '"' : '';
        const delObraAttr = obraPai ? ' data-obra="' + escapeHtmlBasico(obraPai) + '"' : '';
        const filtro = window._filtroCadastroDespesa || {};
        let selClass = '';
        if (t === 'obra' && window._obraSelecionadaCadastros && formatarNomeCanonicoDespesa(nome) === formatarNomeCanonicoDespesa(window._obraSelecionadaCadastros)) {
            selClass = ' badge-tag-selecionado';
        } else if (t === 'loja' && filtro.fornecedor && formatarNomeCanonicoDespesa(nome) === formatarNomeCanonicoDespesa(filtro.fornecedor)) {
            selClass = ' badge-tag-selecionado';
        }
        return '<span class="badge-tag-wrap' + selClass + '">'
            + '<span role="button" tabindex="0" class="badge-tag badge-tag-desp" data-nome="' + n + '" data-tipo="' + t + '"' + obraAttr + ' title="Buscar: ' + n + '">' + n + '</span>'
            + '<button type="button" class="badge-tag-excluir" data-nome="' + n + '" data-tipo="' + t + '"' + delObraAttr + ' title="Arquivar cadastro e histórico">×</button>'
            + '</span>';
    }

    function htmlBalaoFornecedorObra(forn, obraPai) {
        const pendente = forn.vencido + forn.aVencer;
        const nome = escapeHtmlBasico(forn.canonico);
        const obra = escapeHtmlBasico(obraPai || '');
        const extra = pendente > 0 ? ' <small style="opacity:0.85;font-weight:600;">(' + formatarMoeda(pendente) + ')</small>' : '';
        const filtro = window._filtroCadastroDespesa || {};
        let selClass = '';
        if (filtro.fornecedor && formatarNomeCanonicoDespesa(forn.canonico) === formatarNomeCanonicoDespesa(filtro.fornecedor)) {
            selClass = ' badge-tag-selecionado';
        }
        return '<span class="badge-tag-wrap' + selClass + '">'
            + '<span role="button" tabindex="0" class="badge-tag badge-tag-desp" data-nome="' + nome + '" data-tipo="loja" data-obra="' + obra + '" title="Buscar: ' + nome + '">' + nome + extra + '</span>'
            + '<button type="button" class="badge-tag-excluir" data-nome="' + nome + '" data-tipo="loja" data-obra="' + obra + '" title="Arquivar fornecedor e histórico">×</button>'
            + '</span>';
    }

    function termoFiltroListaCadastrosDesp(termo, obraSelecionada) {
        if (!termo) return '';
        if (obraSelecionada && termo === normalizarChaveNomeDespesa(obraSelecionada)) return '';
        return termo;
    }

    function montarPainelCadastrosDespesasHtml() {
        return ''
            + '<div class="painel-cadastros-desp-header">'
            + '<input type="text" id="filtro-lista-cadastros-desp" placeholder="Filtrar obras ou fornecedores..." autocomplete="off" oninput="filtrarListaCadastrosDespesas()">'
            + '</div>'
            + '<div id="aviso-unificar-obras-desp" style="display:none;"></div>'
            + '<div class="desp-baloes-secao">'
            + '<p class="desp-baloes-titulo">Obras: <span id="contagem-obras-desp" class="desp-cadastro-contagem">0</span></p>'
            + '<div id="lista-cadastros-obras-desp" class="desp-baloes-lista"></div>'
            + '</div>'
            + '<div id="painel-fornecedores-obra-desp" class="painel-fornecedores-obra" style="display:none;">'
            + '<p class="desp-baloes-titulo">Fornecedores com pendências em <span id="nome-obra-selecionada-desp"></span>: <span id="contagem-lojas-desp" class="desp-cadastro-contagem">0</span></p>'
            + '<div id="lista-cadastros-lojas-desp" class="desp-baloes-lista"></div>'
            + '</div>'
            + '<p class="texto-explicacao" style="margin:0;padding:8px 12px;font-size:11px;">Clique na etiqueta para buscar. Use <b>×</b> para <b>arquivar</b> a obra/fornecedor e todo o histórico (pasta com o nome da obra em Arquivamento de Contas). Digite <b>ARQUIVAR</b> para confirmar. Use <b>Unificar obras</b> para juntar duas obras iguais.</p>';
    }

    const PARES_OBRAS_DUPLICADAS = [
        { origem: 'CMEI RODOVIARIA', destino: 'CRECHE VIDA NOVA' },
        { origem: 'CMI RODOVIARIA', destino: 'CRECHE VIDA NOVA' },
        { origem: 'CMEI RODOVIÁRIA', destino: 'CRECHE VIDA NOVA' },
        { origem: 'BARRACÃO', destino: 'BARRACÃO SP' },
        { origem: 'BARRACAO', destino: 'BARRACÃO SP' },
        { origem: 'BARRACÃO PILARES', destino: 'BARRACÃO SP' },
        { origem: 'BARRACAO PILARES', destino: 'BARRACÃO SP' }
    ];

    const PARES_FORNECEDORES_DUPLICADOS = [
        { origem: 'ADILSON CAETANO', destino: 'ADILSON / EMPREITA VIDA NOVA' },
        { origem: 'ADILSON CAETANO DE OLIVEIRA', destino: 'ADILSON / EMPREITA VIDA NOVA' },
        { origem: 'ADILSON EMPREITA VIDA NOVA', destino: 'ADILSON / EMPREITA VIDA NOVA' }
    ];

    function chavesFornecedorEquivalentes(nome) {
        const ch = chaveObraUnificar(nome);
        const set = new Set([ch]);
        if (!ch) return set;
        PARES_FORNECEDORES_DUPLICADOS.forEach((par) => {
            const chO = chaveObraUnificar(par.origem);
            const chD = chaveObraUnificar(par.destino);
            if (ch === chO || ch === chD) {
                set.add(chO);
                set.add(chD);
            }
        });
        return set;
    }

    function fornecedorEquivalente(nomeA, nomeB) {
        if (!nomeA || !nomeB) return false;
        const a = chaveObraUnificar(nomeA);
        const b = chaveObraUnificar(nomeB);
        if (a === b) return true;
        const setA = chavesFornecedorEquivalentes(nomeA);
        if (setA.has(b)) return true;
        // Mesmo primeiro nome (ex.: ADILSON CAETANO ≈ ADILSON / EMPREITA…)
        const tokA = a.split(/[\s\/\-]+/).filter(Boolean)[0] || '';
        const tokB = b.split(/[\s\/\-]+/).filter(Boolean)[0] || '';
        if (tokA && tokA === tokB && tokA.length >= 4) return true;
        return false;
    }

    function despesaOuTerceiroCasaComBusca(d, filtroAtual, termoBusca, ehTerceiro) {
        const nomeObraRaw = ehTerceiro ? (d.obra || d.obra_lower || d.obra_nome || '') : (d.obra_nome || d.obra_lower || '');
        const nomeObra = normalizarChaveNomeDespesa(nomeObraRaw);
        const nomePessoa = normalizarChaveNomeDespesa(
            ehTerceiro ? (d.nome || d.loja_nome || '') : (d.loja_nome || d.loja_lower || '')
        );
        if (filtroAtual && filtroAtual.obra && filtroAtual.fornecedor) {
            return obraEquivalenteDespesa(nomeObraRaw, filtroAtual.obra)
                && fornecedorEquivalente(filtroAtual.fornecedor, ehTerceiro ? (d.nome || d.loja_nome || '') : (d.loja_nome || ''));
        }
        if (filtroAtual && filtroAtual.obra) {
            return obraEquivalenteDespesa(nomeObraRaw, filtroAtual.obra);
        }
        if (filtroAtual && filtroAtual.fornecedor) {
            return fornecedorEquivalente(filtroAtual.fornecedor, ehTerceiro ? (d.nome || d.loja_nome || '') : (d.loja_nome || ''));
        }
        if (!termoBusca) return false;
        return nomeObra.includes(termoBusca) || nomePessoa.includes(termoBusca);
    }

    function normalizarTerceiroComoDespesaPaga(d) {
        return {
            id: d.id,
            _origem: 'pagamentos_terceiros',
            status: 'pago',
            obra_nome: formatarNomeCanonicoDespesa(d.obra || ''),
            obra_lower: normalizarChaveNomeDespesa(d.obra || d.obra_lower || ''),
            loja_nome: formatarNomeCanonicoDespesa(d.nome || ''),
            loja_lower: normalizarChaveNomeDespesa(d.nome || ''),
            nota_fiscal: '',
            data_pagamento: d.data || '',
            data: d.data || '',
            valor_string: d.valor_string || String(d.valor_numero || 0),
            valor_numero: Number(d.valor_numero) || parseMoedaLocal(d.valor_string) || 0,
            descricao: (d.descricao ? String(d.descricao) : '') + (d.descricao ? ' — ' : '') + 'Pagamento a terceiro',
            foto_recibo: d.foto_recibo || null,
            timestamp: d.timestamp || 0
        };
    }

    function obraEquivalenteDespesa(obraA, obraB) {
        const a = chaveObraUnificar(obraA);
        const b = chaveObraUnificar(obraB);
        if (!a || !b) return false;
        if (a === b) return true;
        for (let i = 0; i < PARES_OBRAS_DUPLICADAS.length; i++) {
            const par = PARES_OBRAS_DUPLICADAS[i];
            const set = new Set([chaveObraUnificar(par.origem), chaveObraUnificar(par.destino)]);
            if (set.has(a) && set.has(b)) return true;
        }
        return false;
    }

    function terceiroCasaComDespesaFornecedor(terc, desp) {
        if (!terc || !desp) return false;
        const obraT = terc.obra_nome || terc.obra || '';
        const obraD = desp.obra_nome || desp.obra || '';
        const fornT = terc.loja_nome || terc.nome || '';
        const fornD = desp.loja_nome || '';
        return obraEquivalenteDespesa(obraT, obraD) && fornecedorEquivalente(fornT, fornD);
    }

    /**
     * Abate pagamentos a terceiros (mesma obra + fornecedor) no saldo em aberto das despesas.
     * Só em memória no relatório — não grava no Firestore. Evita contar o mesmo terceiro duas vezes.
     */
    function aplicarAbatimentoTerceirosNasDespesas(despesas, terceirosNorm) {
        const listaDesp = despesas || [];
        const listaTer = terceirosNorm || [];
        listaDesp.forEach((d) => {
            d._abatimento_terceiros = 0;
            d._terceiros_abatendo = [];
        });
        if (!listaDesp.length || !listaTer.length) return;

        const restanteTer = new Map();
        listaTer.forEach((t) => {
            const v = Number(t.valor_numero) || parseMoedaLocal(t.valor_string) || valorOriginalDespesa(t) || 0;
            restanteTer.set(t.id, Math.max(0, v));
        });

        const pendentes = listaDesp
            .filter((d) => d && d._origem !== 'pagamentos_terceiros' && !despesaEstaPaga(d) && valorEmAbertoDespesa(d) > 0.009)
            .slice()
            .sort((a, b) => {
                const ta = dataVencimentoTsDespesa(a);
                const tb = dataVencimentoTsDespesa(b);
                const va = ta != null ? ta : Number.MAX_SAFE_INTEGER;
                const vb = tb != null ? tb : Number.MAX_SAFE_INTEGER;
                if (va !== vb) return va - vb;
                return (a.timestamp || 0) - (b.timestamp || 0);
            });

        pendentes.forEach((d) => {
            let saldoAberto = valorEmAbertoDespesa(d);
            if (saldoAberto <= 0.009) return;
            listaTer.forEach((t) => {
                let rest = restanteTer.get(t.id) || 0;
                if (rest <= 0.009) return;
                if (!terceiroCasaComDespesaFornecedor(t, d)) return;
                const abate = Math.min(rest, saldoAberto);
                if (abate <= 0.009) return;
                restanteTer.set(t.id, Math.round((rest - abate) * 100) / 100);
                saldoAberto = Math.round((saldoAberto - abate) * 100) / 100;
                d._abatimento_terceiros = Math.round(((d._abatimento_terceiros || 0) + abate) * 100) / 100;
                d._terceiros_abatendo.push({
                    id: t.id,
                    valor: abate,
                    data: t.data_pagamento || t.data || '',
                    descricao: t.descricao || 'Pagamento a terceiro'
                });
            });
        });
    }

    function valorPagoComTerceirosDespesa(d) {
        return Math.round((valorPagoDespesa(d) + (Number(d && d._abatimento_terceiros) || 0)) * 100) / 100;
    }

    function valorEmAbertoComTerceirosDespesa(d) {
        if (!d || despesaEstaPaga(d)) return 0;
        const aberto = Math.max(0, valorEmAbertoDespesa(d) - (Number(d._abatimento_terceiros) || 0));
        return Math.round(aberto * 100) / 100;
    }

    /** Igual normalizarChaveNomeDespesa, mas ignora acentos (BARRACÃO = BARRACAO). */
    function chaveObraUnificar(nome) {
        return normalizarChaveNomeDespesa(nome)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function encontrarNomeObraPorChave(obras, chaveAlvo) {
        const ch = chaveObraUnificar(chaveAlvo);
        return (obras || []).find((o) => chaveObraUnificar(o) === ch) || '';
    }

    /** Retorna grupo com 1+ origens presentes e o destino presente (ou canônico do par). */
    function encontrarGrupoObraDuplicada(obras) {
        const lista = obras || [];
        const chavesPresentes = new Set(lista.map((o) => chaveObraUnificar(o)));
        const porDestino = new Map();
        PARES_OBRAS_DUPLICADAS.forEach((par) => {
            const chD = chaveObraUnificar(par.destino);
            if (!porDestino.has(chD)) {
                porDestino.set(chD, { destinoCanon: formatarNomeCanonicoDespesa(par.destino), origensCanon: [] });
            }
            const g = porDestino.get(chD);
            const chO = chaveObraUnificar(par.origem);
            if (!g.origensCanon.some((x) => chaveObraUnificar(x) === chO)) {
                g.origensCanon.push(formatarNomeCanonicoDespesa(par.origem));
            }
        });

        for (const [, meta] of porDestino) {
            const chD = chaveObraUnificar(meta.destinoCanon);
            const destinoReal = encontrarNomeObraPorChave(lista, meta.destinoCanon) || meta.destinoCanon;
            const destExiste = chavesPresentes.has(chD);
            const origensReais = [];
            meta.origensCanon.forEach((oCanon) => {
                const chO = chaveObraUnificar(oCanon);
                if (chO === chD) return;
                if (chavesPresentes.has(chO)) {
                    const nomeReal = encontrarNomeObraPorChave(lista, oCanon) || oCanon;
                    if (!origensReais.some((x) => chaveObraUnificar(x) === chO)) origensReais.push(nomeReal);
                }
            });
            if (destExiste && origensReais.length) {
                return { origens: origensReais, destino: destinoReal, origem: origensReais[0] };
            }
        }
        return null;
    }

    function atualizarAvisoUnificarObrasDuplicadas(obras) {
        const box = document.getElementById('aviso-unificar-obras-desp');
        if (!box) return;
        const grupo = encontrarGrupoObraDuplicada(obras);
        if (!grupo) {
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }
        const listaOrig = grupo.origens.map((o) => '<b>' + escapeHtmlBasico(o) + '</b>').join(' + ');
        box.style.display = 'block';
        box.innerHTML = ''
            + '<div style="margin:8px 12px 12px;padding:12px 14px;background:#fff3cd;border:2px solid #856404;border-radius:10px;text-align:left;">'
            + '<p style="margin:0 0 10px 0;font-size:13px;color:#856404;line-height:1.4;">'
            + listaOrig + ' → juntar tudo em <b>' + escapeHtmlBasico(grupo.destino) + '</b>.'
            + '</p>'
            + '<button type="button" id="btn-juntar-obras-duplicadas" data-origem="' + escapeHtmlBasico(grupo.origem) + '" data-destino="' + escapeHtmlBasico(grupo.destino) + '"'
            + ' style="background:#856404;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-weight:bold;cursor:pointer;font-size:13px;">'
            + 'Juntar tudo em ' + escapeHtmlBasico(grupo.destino)
            + '</button>'
            + '</div>';
        const btn = document.getElementById('btn-juntar-obras-duplicadas');
        if (btn) {
            btn.addEventListener('click', function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                const origem = btn.getAttribute('data-origem') || '';
                const destino = btn.getAttribute('data-destino') || '';
                if (origem && destino) executarUnificarObraDespesas(origem, destino);
            });
        }
    }

    window.renderizarPainelCadastrosDespesas = function (filtroDigitado) {
        const cache = window._cacheNomesDespesas;
        const divObras = document.getElementById('lista-cadastros-obras-desp');
        const divLojas = document.getElementById('lista-cadastros-lojas-desp');
        const painelForn = document.getElementById('painel-fornecedores-obra-desp');
        const lblObras = document.getElementById('contagem-obras-desp');
        const lblLojas = document.getElementById('contagem-lojas-desp');
        const lblObraSel = document.getElementById('nome-obra-selecionada-desp');
        if (!cache || !divObras) return;

        const filtroEl = document.getElementById('filtro-lista-cadastros-desp');
        const termoBruto = normalizarChaveNomeDespesa(
            filtroDigitado != null ? filtroDigitado : (filtroEl ? filtroEl.value : '')
        );
        const termoFornObra = termoFiltroListaCadastrosDesp(termoBruto, window._obraSelecionadaCadastros);
        const passaFiltro = (nome) => !termoBruto || normalizarChaveNomeDespesa(nome).includes(termoBruto);
        const passaFiltroFornObra = (nome) => !termoFornObra || normalizarChaveNomeDespesa(nome).includes(termoFornObra);
        const obrasF = cache.obras.filter(passaFiltro);

        if (window._obraSelecionadaCadastros) {
            const chSel = normalizarChaveNomeDespesa(window._obraSelecionadaCadastros);
            const aindaExiste = cache.obras.some((o) => normalizarChaveNomeDespesa(o) === chSel);
            if (!aindaExiste) {
                window._obraSelecionadaCadastros = null;
                window._filtroCadastroDespesa = null;
            }
        }

        if (lblObras) {
            lblObras.textContent = termoBruto ? (obrasF.length + ' / ' + cache.obras.length) : String(cache.obras.length);
        }

        divObras.innerHTML = obrasF.length
            ? obrasF.map((o) => htmlItemCadastroDespesa(o, 'obra')).join('')
            : '<p class="cadastro-desp-vazio">Nenhuma obra' + (termoBruto ? ' com este filtro' : '') + '.</p>';

        atualizarAvisoUnificarObrasDuplicadas(cache.obras);

        if (window._obraSelecionadaCadastros && painelForn && divLojas) {
            const lojasObra = getFornecedoresDaObra(cache, window._obraSelecionadaCadastros, true);
            const lojasF = lojasObra.filter((f) => passaFiltroFornObra(f.canonico));
            painelForn.style.display = 'block';
            if (lblObraSel) lblObraSel.textContent = window._obraSelecionadaCadastros;
            if (lblLojas) {
                lblLojas.textContent = termoFornObra ? (lojasF.length + ' / ' + lojasObra.length) : String(lojasObra.length);
            }
            divLojas.innerHTML = lojasF.length
                ? lojasF.map((f) => htmlBalaoFornecedorObra(f, window._obraSelecionadaCadastros)).join('')
                : '<p class="cadastro-desp-vazio">Nenhum fornecedor com pendências nesta obra' + (termoFornObra ? ' com este filtro' : '') + '.</p>';
        } else if (painelForn) {
            painelForn.style.display = 'none';
            if (divLojas) divLojas.innerHTML = '';
        }
    };

    window.filtrarListaCadastrosDespesas = function () {
        renderizarPainelCadastrosDespesas();
    };

    function htmlBadgeCadastroDespesa(nome, tipo) {
        return htmlItemCadastroDespesa(nome, tipo);
    }

    function despesaCombinaNomeCadastro(d, chaveAlvo, tipo) {
        if (tipo === 'obra') {
            return normalizarChaveNomeDespesa(d.obra_nome || d.obra_lower || '') === chaveAlvo;
        }
        return normalizarChaveNomeDespesa(d.loja_nome || d.loja_lower || '') === chaveAlvo;
    }

    window.excluirCadastroNomeDespesa = async function (nome, tipo, obraContexto) {
        const chaveAlvo = normalizarChaveNomeDespesa(nome);
        if (!chaveAlvo) return;
        const empresaLogada = getEmpresaGestor();
        const tipoLabel = tipo === 'obra' ? 'Obra' : 'Loja / Fornecedor';
        const nomeExibir = formatarNomeCanonicoDespesa(nome);
        const chObraCtx = obraContexto ? normalizarChaveNomeDespesa(obraContexto) : '';

        Swal.fire({ title: 'Verificando histórico...', allowOutsideClick: false });
        Swal.showLoading();

        try {
            const q = query(collection(db, 'despesas_obras'), where('empresa_id', '==', empresaLogada));
            const snap = await getDocs(q);
            const paraArquivar = [];
            snap.forEach((docSnap) => {
                const data = Object.assign({ id: docSnap.id }, docSnap.data() || {});
                if (tipo === 'loja' && chObraCtx) {
                    if (despesaCombinaNomeCadastro(data, chaveAlvo, 'loja')
                        && normalizarChaveNomeDespesa(data.obra_nome || data.obra_lower || '') === chObraCtx) {
                        paraArquivar.push(data);
                    }
                } else if (despesaCombinaNomeCadastro(data, chaveAlvo, tipo)) {
                    paraArquivar.push(data);
                }
            });

            // Terceiros + linhas do relatório de despesas (só quando arquivar obra)
            const terceirosArquivar = [];
            const relatorioArquivar = [];
            if (tipo === 'obra') {
                try {
                    const snapTer = await getDocs(query(collection(db, 'pagamentos_terceiros'), where('empresa_id', '==', empresaLogada)));
                    snapTer.forEach((docSnap) => {
                        const t = Object.assign({ id: docSnap.id }, docSnap.data() || {});
                        if (normalizarChaveNomeDespesa(t.obra || t.obra_lower || '') === chaveAlvo) {
                            terceirosArquivar.push(t);
                        }
                    });
                } catch (eTer) {
                    console.warn(eTer);
                }
                try {
                    const snapRel = await getDocs(query(collection(db, COLECAO_RELATORIO_DESPESAS), where('empresa_id', '==', empresaLogada)));
                    snapRel.forEach((docSnap) => {
                        const r = Object.assign({ id: docSnap.id }, docSnap.data() || {});
                        if (normalizarChaveNomeDespesa(r.obra_nome || r.obra_lower || '') === chaveAlvo) {
                            relatorioArquivar.push(r);
                        }
                    });
                } catch (eRel) {
                    console.warn(eRel);
                }
            } else if (tipo === 'loja') {
                try {
                    const snapRel = await getDocs(query(collection(db, COLECAO_RELATORIO_DESPESAS), where('empresa_id', '==', empresaLogada)));
                    snapRel.forEach((docSnap) => {
                        const r = Object.assign({ id: docSnap.id }, docSnap.data() || {});
                        const mesmaLoja = normalizarChaveNomeDespesa(r.loja_nome || r.loja_lower || '') === chaveAlvo;
                        const mesmaObra = !chObraCtx || normalizarChaveNomeDespesa(r.obra_nome || r.obra_lower || '') === chObraCtx;
                        if (mesmaLoja && mesmaObra) relatorioArquivar.push(r);
                    });
                } catch (eRel) {
                    console.warn(eRel);
                }
            }

            Swal.close();
            const totalItens = paraArquivar.length + terceirosArquivar.length + relatorioArquivar.length;
            if (!totalItens) {
                return Swal.fire('Nada a arquivar', 'Nenhum lançamento encontrado com este nome.', 'info');
            }

            const escopoHtml = (tipo === 'loja' && obraContexto)
                ? '<br>Escopo: fornecedor <b>' + escapeHtmlBasico(nomeExibir) + '</b> na obra <b>' + escapeHtmlBasico(formatarNomeCanonicoDespesa(obraContexto)) + '</b>.'
                : '';
            const confirmacao = await Swal.fire({
                title: 'Arquivar ' + (tipo === 'obra' ? 'obra' : 'fornecedor') + '?',
                html: 'Arquivar o cadastro <b>' + escapeHtmlBasico(nomeExibir) + '</b> (' + tipoLabel + ')?' + escopoHtml
                    + '<br><br>Serão enviados ao <b>Arquivamento de Contas</b> (Ano → Mês → Dia):'
                    + '<br>• <b>' + paraArquivar.length + '</b> despesa(s)/conta(s)'
                    + (terceirosArquivar.length ? '<br>• <b>' + terceirosArquivar.length + '</b> pagamento(s) a terceiros' : '')
                    + (relatorioArquivar.length ? '<br>• <b>' + relatorioArquivar.length + '</b> linha(s) do relatório de despesas' : '')
                    + '<br><br>Eles <b>saem</b> dos relatórios ativos, mas o histórico e os comprovantes ficam guardados.'
                    + '<br><br>Digite <b>ARQUIVAR</b> para confirmar.',
                icon: 'question',
                input: 'text',
                inputPlaceholder: 'ARQUIVAR',
                showCancelButton: true,
                confirmButtonColor: '#856404',
                confirmButtonText: 'Sim, arquivar tudo',
                cancelButtonText: 'Cancelar',
                preConfirm: (val) => {
                    if (String(val || '').trim().toUpperCase() !== 'ARQUIVAR') {
                        Swal.showValidationMessage('Digite ARQUIVAR para confirmar.');
                        return false;
                    }
                    return true;
                }
            });

            if (!confirmacao.isConfirmed) return;

            Swal.fire({ title: 'Arquivando histórico...', allowOutsideClick: false });
            Swal.showLoading();

            const motivoLote = tipo === 'obra' ? ('Exclusão da obra ' + nomeExibir) : ('Exclusão do fornecedor ' + nomeExibir);
            const loteId = 'cadastro_' + tipo + '_' + Date.now();
            let ok = 0;
            for (let i = 0; i < paraArquivar.length; i++) {
                const d = paraArquivar[i];
                const payload = await montarPayloadArquivoDespesa(d);
                payload.motivo_arquivo = motivoLote;
                payload.lote_arquivo = loteId;
                await addDoc(collection(db, COLECAO_CONTAS_ARQUIVADAS), payload);
                await deleteDoc(doc(db, 'despesas_obras', d.id));
                ok += 1;
            }
            for (let i = 0; i < terceirosArquivar.length; i++) {
                const t = terceirosArquivar[i];
                const payload = montarPayloadArquivoTerceiro(t, motivoLote);
                payload.lote_arquivo = loteId;
                await addDoc(collection(db, COLECAO_CONTAS_ARQUIVADAS), payload);
                await deleteDoc(doc(db, 'pagamentos_terceiros', t.id));
                ok += 1;
            }
            for (let i = 0; i < relatorioArquivar.length; i++) {
                const r = relatorioArquivar[i];
                const payload = await montarPayloadArquivoDespesa(r);
                payload.origem_colecao = COLECAO_RELATORIO_DESPESAS;
                payload.tipo_arquivo = 'relatorio_despesa';
                payload.motivo_arquivo = motivoLote;
                payload.lote_arquivo = loteId;
                await addDoc(collection(db, COLECAO_CONTAS_ARQUIVADAS), payload);
                await deleteDoc(doc(db, COLECAO_RELATORIO_DESPESAS, r.id));
                ok += 1;
            }

            const busca = document.getElementById('busca-obra');
            const limparBusca = (busca && normalizarChaveNomeDespesa(busca.value) === chaveAlvo)
                || (tipo === 'obra' && window._obraSelecionadaCadastros && normalizarChaveNomeDespesa(window._obraSelecionadaCadastros) === chaveAlvo)
                || (tipo === 'loja' && window._filtroCadastroDespesa && window._filtroCadastroDespesa.fornecedor && normalizarChaveNomeDespesa(window._filtroCadastroDespesa.fornecedor) === chaveAlvo);
            if (limparBusca) {
                if (busca) busca.value = '';
                window._obraSelecionadaCadastros = null;
                window._filtroCadastroDespesa = null;
                const divLista = document.getElementById('lista-despesas-resultados');
                if (divLista) {
                    divLista.innerHTML = '<p style="text-align: center; color: #888; font-size: 13px;">Selecione uma obra acima para ver os fornecedores e despesas.</p>';
                }
                ocultarQuadroControlesDespesas();
                const divTotal = document.getElementById('resumo-total-despesas');
                if (divTotal) divTotal.style.display = 'none';
                const btnPdf = document.getElementById('btnExportarDespesas');
                const btnXls = document.getElementById('btnExportarDespesasExcel');
                if (btnPdf) btnPdf.style.display = 'none';
                if (btnXls) btnXls.style.display = 'none';
            }

            await carregarFiltrosDespesas();
            Swal.fire(
                'Arquivado!',
                ok + ' lançamento(s) da ' + (tipo === 'obra' ? 'obra' : 'loja') + ' <b>' + escapeHtmlBasico(nomeExibir) + '</b> foram para o Arquivamento de Contas.',
                'success'
            );
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível arquivar o cadastro: ' + (e.message || ''), 'error');
        }
    };

    async function coletarDocsObraParaUnificar(empresaLogada, chaveOrigemOuNome) {
        const chOrigem = chaveObraUnificar(chaveOrigemOuNome);
        const chavesOrigem = new Set([chOrigem]);
        let chDestinoGrupo = '';
        for (const par of PARES_OBRAS_DUPLICADAS) {
            if (chaveObraUnificar(par.origem) === chOrigem) {
                chDestinoGrupo = chaveObraUnificar(par.destino);
                break;
            }
        }
        if (chDestinoGrupo) {
            PARES_OBRAS_DUPLICADAS.forEach((p) => {
                if (chaveObraUnificar(p.destino) === chDestinoGrupo) {
                    const chO = chaveObraUnificar(p.origem);
                    if (chO !== chDestinoGrupo) chavesOrigem.add(chO);
                }
            });
        }

        const colecoes = [
            { nome: 'despesas_obras', campos: { nome: 'obra_nome', lower: 'obra_lower' } },
            { nome: COLECAO_RELATORIO_DESPESAS, campos: { nome: 'obra_nome', lower: 'obra_lower' } },
            { nome: 'pagamentos_terceiros', campos: { nome: 'obra', lower: 'obra_lower' } }
        ];
        const resultado = [];
        for (const col of colecoes) {
            try {
                const snap = await getDocs(query(collection(db, col.nome), where('empresa_id', '==', empresaLogada)));
                snap.forEach((docSnap) => {
                    const d = docSnap.data();
                    const chave = chaveObraUnificar(d[col.campos.nome] || d[col.campos.lower] || '');
                    if (chavesOrigem.has(chave)) {
                        resultado.push({ colecao: col.nome, id: docSnap.id, campos: col.campos });
                    }
                });
            } catch (errCol) {
                console.warn('unificar obra: falha ao ler', col.nome, errCol);
            }
        }
        return resultado;
    }

    window.abrirUnificarObrasDespesas = async function () {
        if (!window._cacheNomesDespesas || !window._cacheNomesDespesas.obras || !window._cacheNomesDespesas.obras.length) {
            await carregarFiltrosDespesas();
        }
        const obras = ((window._cacheNomesDespesas && window._cacheNomesDespesas.obras) || []).slice().sort((a, b) => a.localeCompare(b, 'pt-BR'));
        if (obras.length < 2) {
            return Swal.fire('Atenção', 'É preciso ter pelo menos duas obras cadastradas para unificar.', 'info');
        }

        const grupoSug = encontrarGrupoObraDuplicada(obras);
        const preferOrigem = grupoSug ? grupoSug.origem : '';
        const preferDestino = grupoSug ? grupoSug.destino : '';
        const temSugestao = Boolean(grupoSug);

        const opts = obras.map((o) => {
            const esc = escapeHtmlBasico(o);
            return `<option value="${esc}">${esc}</option>`;
        }).join('');

        const result = await Swal.fire({
            title: 'Unificar obras',
            html: ''
                + '<p style="text-align:left;font-size:13px;margin:0 0 12px 0;">Tudo cadastrado na obra <b>origem</b> passa para a obra <b>destino</b>. A etiqueta da origem some da lista. Se for um grupo conhecido (ex.: Barracão), as obras irmãs também são movidas juntas.</p>'
                + '<label style="display:block;text-align:left;font-size:12px;margin-bottom:4px;">Obra origem (será esvaziada)</label>'
                + '<select id="unificar-obra-origem" class="swal2-input" style="width:100%;margin:0 0 12px 0;">' + opts + '</select>'
                + '<label style="display:block;text-align:left;font-size:12px;margin-bottom:4px;">Obra destino (fica com tudo)</label>'
                + '<select id="unificar-obra-destino" class="swal2-input" style="width:100%;margin:0;">' + opts + '</select>'
                + (temSugestao
                    ? '<p style="text-align:left;font-size:12px;color:#856404;margin:10px 0 0 0;">Sugestão: <b>'
                        + escapeHtmlBasico(grupoSug.origens.join(' + '))
                        + '</b> → <b>' + escapeHtmlBasico(preferDestino) + '</b>.</p>'
                    : ''),
            showCancelButton: true,
            confirmButtonText: 'Continuar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#856404',
            didOpen: () => {
                const selO = document.getElementById('unificar-obra-origem');
                const selD = document.getElementById('unificar-obra-destino');
                if (temSugestao && selO) selO.value = preferOrigem;
                if (temSugestao && selD) selD.value = preferDestino;
                else if (selD && obras[0]) selD.value = obras.find((o) => o !== (selO && selO.value)) || obras[0];
            },
            preConfirm: () => {
                const origem = formatarNomeCanonicoDespesa(document.getElementById('unificar-obra-origem').value);
                const destino = formatarNomeCanonicoDespesa(document.getElementById('unificar-obra-destino').value);
                if (!origem || !destino) {
                    Swal.showValidationMessage('Selecione origem e destino.');
                    return false;
                }
                if (chaveObraUnificar(origem) === chaveObraUnificar(destino)) {
                    Swal.showValidationMessage('Origem e destino devem ser obras diferentes.');
                    return false;
                }
                return { origem, destino };
            }
        });

        if (!result.isConfirmed || !result.value) return;
        await executarUnificarObraDespesas(result.value.origem, result.value.destino);
    };

    window.executarUnificarObraDespesas = async function (origem, destino) {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) {
            return Swal.fire('Atenção', 'Empresa não identificada. Entre de novo no painel e tente outra vez.', 'warning');
        }
        const chaveOrigem = chaveObraUnificar(origem);
        const destinoCanon = formatarNomeCanonicoDespesa(destino);
        const destinoLower = normalizarChaveNomeDespesa(destinoCanon);
        if (!chaveOrigem || !destinoLower) {
            return Swal.fire('Atenção', 'Origem ou destino inválidos.', 'warning');
        }

        try {
            Swal.fire({ title: 'Contando registros...', html: 'Aguarde, pode demorar alguns segundos...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            const docs = await coletarDocsObraParaUnificar(empresaLogada, origem);
            const grupo = encontrarGrupoObraDuplicada((window._cacheNomesDespesas && window._cacheNomesDespesas.obras) || []);
            const origensLabel = (grupo && chaveObraUnificar(grupo.destino) === chaveObraUnificar(destinoCanon) && grupo.origens.length)
                ? grupo.origens.join(' + ')
                : origem;

            if (!docs.length) {
                return Swal.fire('Nada encontrado', `Nenhum registro com a obra <b>${escapeHtmlBasico(origem)}</b>.`, 'info');
            }

            const porColecao = docs.reduce((acc, d) => {
                acc[d.colecao] = (acc[d.colecao] || 0) + 1;
                return acc;
            }, {});
            const detalhe = Object.keys(porColecao).map((k) => `${porColecao[k]} em ${k}`).join('<br>');

            const confirmacao = await Swal.fire({
                title: 'Confirmar unificação?',
                html: ''
                    + `Mover <b>${docs.length}</b> registro(s) de<br><b>${escapeHtmlBasico(origensLabel)}</b><br>para<br><b>${escapeHtmlBasico(destinoCanon)}</b>?<br><br>`
                    + `<span style="font-size:12px;text-align:left;display:block;">${detalhe}</span><br>`
                    + '<span style="color:#d9534f;font-weight:bold;">Digite <b>UNIFICAR</b> para confirmar.</span>',
                icon: 'warning',
                input: 'text',
                inputPlaceholder: 'UNIFICAR',
                showCancelButton: true,
                confirmButtonColor: '#856404',
                confirmButtonText: 'Sim, unificar',
                cancelButtonText: 'Cancelar',
                preConfirm: (val) => {
                    if (String(val || '').trim() !== 'UNIFICAR') {
                        Swal.showValidationMessage('Digite UNIFICAR em maiúsculas para confirmar.');
                        return false;
                    }
                    return true;
                }
            });
            if (!confirmacao.isConfirmed) return;

            Swal.fire({ title: 'Unificando...', html: 'Atualizando ' + docs.length + ' registro(s)...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            for (let i = 0; i < docs.length; i++) {
                const item = docs[i];
                const payload = {};
                payload[item.campos.nome] = destinoCanon;
                payload[item.campos.lower] = destinoLower;
                await updateDoc(doc(db, item.colecao, item.id), payload);
                if (i % 20 === 0) {
                    Swal.update({ html: 'Atualizando ' + (i + 1) + ' / ' + docs.length + '...' });
                }
            }

            const busca = document.getElementById('busca-obra');
            const chavesMovidas = new Set([chaveOrigem]);
            PARES_OBRAS_DUPLICADAS.forEach((p) => {
                if (chaveObraUnificar(p.destino) === chaveObraUnificar(destinoCanon)) {
                    chavesMovidas.add(chaveObraUnificar(p.origem));
                }
            });
            if (busca && chavesMovidas.has(chaveObraUnificar(busca.value))) {
                busca.value = destinoCanon;
            }
            if (window._obraSelecionadaCadastros && chavesMovidas.has(chaveObraUnificar(window._obraSelecionadaCadastros))) {
                window._obraSelecionadaCadastros = destinoCanon;
            }
            if (window._filtroCadastroDespesa && window._filtroCadastroDespesa.obra
                && chavesMovidas.has(chaveObraUnificar(window._filtroCadastroDespesa.obra))) {
                window._filtroCadastroDespesa.obra = destinoCanon;
            }

            await carregarFiltrosDespesas();
            if (busca && busca.value) {
                buscarDespesasObra();
            }

            Swal.fire('Pronto!', `${docs.length} registro(s) movidos para <b>${escapeHtmlBasico(destinoCanon)}</b>.`, 'success');
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível unificar as obras: ' + (e && e.message ? e.message : 'tente novamente.'), 'error');
        }
    };

    window.fecharSugestoesBuscaDespesas = function () {
        const box = document.getElementById('busca-obra-sugestoes');
        if (box) box.style.display = 'none';
    };

    window.selecionarObraDespesa = function (nome) {
        window._obraSelecionadaCadastros = formatarNomeCanonicoDespesa(nome);
        window._filtroCadastroDespesa = { obra: window._obraSelecionadaCadastros, fornecedor: null };
        const inp = document.getElementById('busca-obra');
        if (inp) inp.value = window._obraSelecionadaCadastros;
        fecharSugestoesBuscaDespesas();
        renderizarPainelCadastrosDespesas(document.getElementById('filtro-lista-cadastros-desp') ? document.getElementById('filtro-lista-cadastros-desp').value : '');
        buscarDespesasObra();
    };

    window.selecionarFornecedorDespesa = function (fornecedor, obra) {
        const obraNome = formatarNomeCanonicoDespesa(obra || window._obraSelecionadaCadastros || '');
        const fornNome = formatarNomeCanonicoDespesa(fornecedor);
        if (!obraNome) return selecionarBuscaDespesa(fornNome, 'loja');
        window._obraSelecionadaCadastros = obraNome;
        window._filtroCadastroDespesa = { obra: obraNome, fornecedor: fornNome };
        const inp = document.getElementById('busca-obra');
        if (inp) inp.value = fornNome;
        fecharSugestoesBuscaDespesas();
        renderizarPainelCadastrosDespesas(document.getElementById('filtro-lista-cadastros-desp') ? document.getElementById('filtro-lista-cadastros-desp').value : '');
        buscarDespesasObra();
    };

    window.selecionarBuscaDespesa = function (nome, tipo) {
        const t = tipo || '';
        if (t === 'obra') {
            selecionarObraDespesa(nome);
            return;
        }
        if (t === 'loja') {
            window._obraSelecionadaCadastros = null;
            window._filtroCadastroDespesa = { obra: null, fornecedor: formatarNomeCanonicoDespesa(nome) };
            const inp = document.getElementById('busca-obra');
            if (inp) inp.value = formatarNomeCanonicoDespesa(nome);
            fecharSugestoesBuscaDespesas();
            renderizarPainelCadastrosDespesas(document.getElementById('filtro-lista-cadastros-desp') ? document.getElementById('filtro-lista-cadastros-desp').value : '');
            buscarDespesasObra();
            return;
        }
        const inp = document.getElementById('busca-obra');
        if (inp) inp.value = nome;
        window._obraSelecionadaCadastros = null;
        window._filtroCadastroDespesa = null;
        fecharSugestoesBuscaDespesas();
        buscarDespesasObra();
    };

    window.filtrarAutocompleteBuscaDespesas = function () {
        const input = document.getElementById('busca-obra');
        const box = document.getElementById('busca-obra-sugestoes');
        const cache = window._cacheNomesDespesas;
        if (!input || !box || !cache) return;
        const termo = normalizarChaveNomeDespesa(input.value);
        if (document.getElementById('lista-cadastros-obras-desp')) {
            renderizarPainelCadastrosDespesas(document.getElementById('filtro-lista-cadastros-desp') ? document.getElementById('filtro-lista-cadastros-desp').value : '');
        }
        if (!termo || termo.length < 1) {
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }
        const matches = cache.sugestoes.filter((s) => s.chave.includes(termo)).slice(0, 15);
        if (!matches.length) {
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }
        box.innerHTML = matches.map((s) => {
            const tipoLabel = s.tipo === 'obra' ? '🏢 Obra' : '🏪 Loja';
            return `<button type="button" class="busca-desp-sugestao" data-nome="${escapeHtmlBasico(s.nome)}" data-tipo="${s.tipo}"><span class="busca-desp-sug-tipo">${tipoLabel}</span>${escapeHtmlBasico(s.nome)}</button>`;
        }).join('');
        box.style.display = 'block';
    };

    window.teclaAutocompleteBuscaDespesas = function (ev) {
        if (ev.key === 'Enter') {
            fecharSugestoesBuscaDespesas();
            buscarDespesasObra();
        } else if (ev.key === 'Escape') {
            fecharSugestoesBuscaDespesas();
        }
    };

    (function initAutocompleteBuscaDespesasGlobal() {
        document.addEventListener('click', (ev) => {
            const wrap = document.querySelector('.busca-despesas-wrap');
            if (wrap && !wrap.contains(ev.target)) fecharSugestoesBuscaDespesas();
        });
        const box = document.getElementById('busca-obra-sugestoes');
        if (box) {
            box.addEventListener('mousedown', (ev) => {
                const alvo = ev.target.closest('.busca-desp-sugestao');
                if (!alvo) return;
                ev.preventDefault();
                selecionarBuscaDespesa(alvo.getAttribute('data-nome') || '', alvo.getAttribute('data-tipo') || '');
            });
        }
        const divTags = document.getElementById('tags-filtros-despesas');
        if (divTags && !divTags._delegacaoOk) {
            divTags._delegacaoOk = true;
            divTags.addEventListener('click', (ev) => {
                const btnDel = ev.target.closest('.badge-tag-excluir');
                if (btnDel) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    excluirCadastroNomeDespesa(
                        btnDel.getAttribute('data-nome') || '',
                        btnDel.getAttribute('data-tipo') || 'loja',
                        btnDel.getAttribute('data-obra') || ''
                    );
                    return;
                }
                const badge = ev.target.closest('.badge-tag-desp');
                if (badge) {
                    const nome = badge.getAttribute('data-nome') || '';
                    const tipo = badge.getAttribute('data-tipo') || 'obra';
                    const obra = badge.getAttribute('data-obra') || '';
                    if (tipo === 'loja' && obra) {
                        selecionarFornecedorDespesa(nome, obra);
                    } else if (tipo === 'obra') {
                        selecionarObraDespesa(nome);
                    } else {
                        selecionarBuscaDespesa(nome, tipo);
                    }
                }
            });
        }
    })();

window.carregarFiltrosDespesas = async function() {
        const divTags = document.getElementById('tags-filtros-despesas');
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) return;
        try {
            const q = query(collection(db, "despesas_obras"), where("empresa_id", "==", empresaLogada));
            const querySnapshot = await getDocs(q);
            const cache = montarCacheNomesDespesas(querySnapshot);
            atualizarDatalistsNomesDespesas(cache);

            if (!divTags) return;

            if (cache.obras.length === 0 && cache.lojas.length === 0) {
                divTags.innerHTML = '<p class="cadastro-desp-vazio" style="padding:16px;">Nenhuma obra ou loja registada.</p>';
                return;
            }

            divTags.innerHTML = montarPainelCadastrosDespesasHtml();
            renderizarPainelCadastrosDespesas('');
        } catch (e) {
            if (divTags) {
                divTags.innerHTML = '<p class="cadastro-desp-vazio" style="padding:16px;color:#d9534f;">Erro ao carregar locais.</p>';
            }
        }
    };

    window.carregarNomesCadastroDespesas = async function () {
        const empresaLogada = getEmpresaGestor();
        if (!empresaLogada) return null;
        try {
            if (window._cacheNomesDespesas && window._cacheNomesDespesas.obras) {
                atualizarDatalistsNomesDespesas(window._cacheNomesDespesas);
                return window._cacheNomesDespesas;
            }
            const q = query(collection(db, 'despesas_obras'), where('empresa_id', '==', empresaLogada));
            const snap = await getDocs(q);
            const cache = montarCacheNomesDespesas(snap);
            atualizarDatalistsNomesDespesas(cache);
            return cache;
        } catch (e) {
            console.error('carregarNomesCadastroDespesas', e);
            return null;
        }
    };

    window.fecharSugestoesCadastroDespesa = function (tipo) {
        const ids = tipo
            ? [(tipo === 'obra' ? 'd-obra-sugestoes' : 'd-loja-sugestoes')]
            : ['d-obra-sugestoes', 'd-loja-sugestoes'];
        ids.forEach((id) => {
            const box = document.getElementById(id);
            if (box) {
                box.style.display = 'none';
                box.innerHTML = '';
            }
        });
    };

    window.selecionarCadastroDespesaSugestao = function (tipo, nome) {
        const inputId = tipo === 'obra' ? 'd-obra' : 'd-loja';
        const inp = document.getElementById(inputId);
        if (inp) inp.value = formatarNomeCanonicoDespesa(nome);
        fecharSugestoesCadastroDespesa(tipo);
        if (tipo === 'obra') {
            const loja = document.getElementById('d-loja');
            if (loja) loja.focus();
        } else {
            const nf = document.getElementById('d-nf');
            if (nf) nf.focus();
        }
    };

    window.filtrarAutocompleteCadastroDespesa = async function (tipo) {
        const inputId = tipo === 'obra' ? 'd-obra' : 'd-loja';
        const boxId = tipo === 'obra' ? 'd-obra-sugestoes' : 'd-loja-sugestoes';
        const input = document.getElementById(inputId);
        const box = document.getElementById(boxId);
        if (!input || !box) return;

        let cache = window._cacheNomesDespesas;
        if (!cache) {
            box.innerHTML = '<div style="padding:10px 12px;font-size:12px;color:#666;">Carregando nomes...</div>';
            box.style.display = 'block';
            cache = await carregarNomesCadastroDespesas();
        }
        if (!cache) {
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }

        const termo = normalizarChaveNomeDespesa(input.value);
        const lista = tipo === 'obra' ? (cache.obras || []) : (cache.lojas || []);
        let matches;
        if (!termo) {
            matches = lista.slice(0, 20);
        } else {
            matches = lista.filter((n) => normalizarChaveNomeDespesa(n).includes(termo)).slice(0, 20);
        }

        if (!matches.length) {
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }

        const tipoLabel = tipo === 'obra' ? '🏢 Obra' : '🏪 Fornecedor';
        box.innerHTML = matches.map((nome) => {
            return '<button type="button" class="busca-desp-sugestao" data-tipo="' + tipo + '" data-nome="' + escapeHtmlBasico(nome) + '">'
                + '<span class="busca-desp-sug-tipo">' + tipoLabel + '</span>'
                + escapeHtmlBasico(nome)
                + '</button>';
        }).join('');
        box.style.display = 'block';
    };

    window.teclaAutocompleteCadastroDespesa = function (ev, tipo) {
        if (ev.key === 'Escape') {
            fecharSugestoesCadastroDespesa(tipo);
        } else if (ev.key === 'Enter') {
            const boxId = tipo === 'obra' ? 'd-obra-sugestoes' : 'd-loja-sugestoes';
            const box = document.getElementById(boxId);
            const primeiro = box && box.querySelector('.busca-desp-sugestao');
            if (primeiro && box.style.display !== 'none') {
                ev.preventDefault();
                selecionarCadastroDespesaSugestao(tipo, primeiro.getAttribute('data-nome') || '');
            }
        }
    };

    (function initAutocompleteCadastroDespesas() {
        document.addEventListener('click', (ev) => {
            const wrapObra = document.getElementById('d-obra') && document.getElementById('d-obra').closest('.busca-despesas-wrap');
            const wrapLoja = document.getElementById('d-loja') && document.getElementById('d-loja').closest('.busca-despesas-wrap');
            if (wrapObra && !wrapObra.contains(ev.target)) fecharSugestoesCadastroDespesa('obra');
            if (wrapLoja && !wrapLoja.contains(ev.target)) fecharSugestoesCadastroDespesa('loja');
        });
        ['d-obra-sugestoes', 'd-loja-sugestoes'].forEach((id) => {
            const box = document.getElementById(id);
            if (!box || box._delegacaoOk) return;
            box._delegacaoOk = true;
            box.addEventListener('mousedown', (ev) => {
                const alvo = ev.target.closest('.busca-desp-sugestao');
                if (!alvo) return;
                ev.preventDefault();
                selecionarCadastroDespesaSugestao(
                    alvo.getAttribute('data-tipo') || 'obra',
                    alvo.getAttribute('data-nome') || ''
                );
            });
        });
    })();

  window.cancelarDespesaObra = function () {
        const limpar = function (id) {
            const el = document.getElementById(id);
            if (el) el.value = '';
        };
        limpar('d-obra');
        limpar('d-loja');
        limpar('d-nf');
        limpar('d-vencimento');
        limpar('d-valor');
        limpar('d-desc');
        limpar('d-anexo');
        limpar('d-anexo-base64');
        limparParcelamentoDespesa();
        const sugObra = document.getElementById('d-obra-sugestoes');
        const sugLoja = document.getElementById('d-loja-sugestoes');
        if (sugObra) sugObra.innerHTML = '';
        if (sugLoja) sugLoja.innerHTML = '';
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: 'Cadastro cancelado',
            showConfirmButton: false,
            timer: 1800
        });
    };

    function parcelamentoDespesaAtivo() {
        const box = document.getElementById('d-parcelamento-box');
        return Boolean(box && box.style.display !== 'none');
    }

    /** Último dia do mês (mês 0–11), respeitando ano bissexto. */
    function ultimoDiaDoMesCalendario(ano, mes0) {
        return new Date(ano, mes0 + 1, 0).getDate();
    }

    /**
     * Soma meses no calendário civil sem “pular” o mês.
     * Ex.: 29/07/2026 + 7 meses → 28/02/2027 (não existe 29/02/2027).
     * Evita o bug do Date.setMonth, que vira 01/03 e pode zerar o <input type="date">.
     */
    function adicionarMesesCalendarioIso(isoBase, mesesAdd) {
        const m = String(isoBase || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (!m) return '';
        let y = parseInt(m[1], 10);
        let mo = parseInt(m[2], 10) - 1;
        const diaOrig = parseInt(m[3], 10);
        if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(diaOrig) || diaOrig < 1) return '';
        const add = Number(mesesAdd) || 0;
        const totalMes = mo + add;
        y += Math.floor(totalMes / 12);
        mo = ((totalMes % 12) + 12) % 12;
        const dia = Math.min(diaOrig, ultimoDiaDoMesCalendario(y, mo));
        return y + '-' + String(mo + 1).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
    }

    function formatarMoedaBrFromNumber(n) {
        const v = Number(n) || 0;
        return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function atualizarTotalParcelasDespesa() {
        const lista = document.getElementById('d-parcelas-lista');
        const elTotal = document.getElementById('d-parcelas-total');
        if (!lista || !elTotal) return;
        let soma = 0;
        lista.querySelectorAll('.d-parcela-valor').forEach(function (inp) {
            soma += parseMoedaLocal(inp.value || '0');
        });
        elTotal.textContent = formatarMoedaBrFromNumber(soma);
    }

    function renumerarLinhasParcelasDespesa() {
        const lista = document.getElementById('d-parcelas-lista');
        if (!lista) return;
        const rows = lista.querySelectorAll('.d-parcela-linha');
        rows.forEach(function (row, idx) {
            const lab = row.querySelector('.d-parcela-label');
            if (lab) lab.textContent = 'Parcela ' + (idx + 1);
            row.dataset.parcela = String(idx + 1);
        });
        const qtd = document.getElementById('d-qtd-parcelas');
        if (qtd) qtd.value = String(Math.max(rows.length, 2));
        atualizarTotalParcelasDespesa();
    }

    function criarLinhaParcelaDespesaHtml(num, valorStr, vencIso) {
        const wrap = document.createElement('div');
        wrap.className = 'd-parcela-linha';
        wrap.dataset.parcela = String(num);
        wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin-bottom:10px;padding:10px;background:#fff;border:1px solid #e0e6ed;border-radius:10px;';
        wrap.innerHTML = ''
            + '<div style="min-width:80px;"><span class="d-parcela-label" style="display:block;font-size:12px;font-weight:800;color:#1a2a43;padding-bottom:8px;">Parcela ' + num + '</span></div>'
            + '<div style="flex:1;min-width:120px;"><label style="font-size:11px;margin:0;">Valor (R$)</label>'
            + '<input type="text" class="d-parcela-valor" placeholder="0,00" value="' + String(valorStr || '').replace(/"/g, '&quot;') + '" style="width:100%;margin:4px 0 0 0;padding:8px;border:1px solid #ccc;border-radius:8px;box-sizing:border-box;"></div>'
            + '<div style="flex:1;min-width:140px;"><label style="font-size:11px;margin:0;">Vencimento</label>'
            + '<input type="date" class="d-parcela-venc" value="' + String(vencIso || '') + '" style="width:100%;margin:4px 0 0 0;padding:8px;border:1px solid #ccc;border-radius:8px;box-sizing:border-box;"></div>'
            + '<button type="button" title="Remover parcela" style="height:38px;min-width:40px;margin-bottom:1px;background:#b02a37;color:#fff;border:none;border-radius:8px;font-weight:800;cursor:pointer;">✕</button>';

        const inpValor = wrap.querySelector('.d-parcela-valor');
        const btnRem = wrap.querySelector('button');
        if (inpValor) {
            inpValor.addEventListener('input', function () {
                mascaraMoeda(inpValor);
                atualizarTotalParcelasDespesa();
            });
        }
        if (btnRem) {
            btnRem.addEventListener('click', function () {
                wrap.remove();
                renumerarLinhasParcelasDespesa();
            });
        }
        return wrap;
    }

    window.adicionarLinhaParcelaDespesa = function () {
        const lista = document.getElementById('d-parcelas-lista');
        if (!lista) return;
        const n = lista.querySelectorAll('.d-parcela-linha').length + 1;
        if (n > 48) {
            return Swal.fire('Atenção', 'Limite de 48 parcelas.', 'warning');
        }
        lista.appendChild(criarLinhaParcelaDespesaHtml(n, '', ''));
        renumerarLinhasParcelasDespesa();
    };

    window.gerarLinhasParcelasDespesa = function () {
        const qtdEl = document.getElementById('d-qtd-parcelas');
        const lista = document.getElementById('d-parcelas-lista');
        if (!qtdEl || !lista) return;
        let qtd = parseInt(qtdEl.value, 10);
        if (!Number.isFinite(qtd) || qtd < 2) qtd = 2;
        if (qtd > 48) qtd = 48;
        qtdEl.value = String(qtd);

        const valorTotalStr = (document.getElementById('d-valor') && document.getElementById('d-valor').value) || '';
        const totalNum = parseMoedaLocal(valorTotalStr || '0');
        const vencBase = (document.getElementById('d-vencimento') && document.getElementById('d-vencimento').value) || '';

        lista.innerHTML = '';
        let somaCentavos = 0;
        const totalCentavos = Math.round(totalNum * 100);
        for (let i = 1; i <= qtd; i += 1) {
            let valorParcela = '';
            let vencIso = '';
            if (totalCentavos > 0) {
                let cents;
                if (i < qtd) {
                    cents = Math.floor(totalCentavos / qtd);
                    somaCentavos += cents;
                } else {
                    cents = totalCentavos - somaCentavos;
                }
                valorParcela = (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
            if (vencBase) {
                vencIso = adicionarMesesCalendarioIso(vencBase, i - 1);
            }
            lista.appendChild(criarLinhaParcelaDespesaHtml(i, valorParcela, vencIso));
        }
        atualizarTotalParcelasDespesa();
    };

    window.toggleParcelamentoDespesa = function () {
        const box = document.getElementById('d-parcelamento-box');
        const btn = document.getElementById('btnToggleParcelamento');
        const wrapValor = document.getElementById('d-valor');
        const wrapVenc = document.getElementById('d-vencimento');
        if (!box) return;
        const abrir = box.style.display === 'none' || !box.style.display;
        if (abrir) {
            box.style.display = 'block';
            if (btn) {
                btn.style.background = '#1a2a43';
                btn.style.color = '#fff';
                btn.textContent = '💳 PARCELAMENTO (ativo)';
            }
            if (wrapValor) wrapValor.style.opacity = '0.55';
            if (wrapVenc) wrapVenc.style.opacity = '0.55';
            const lista = document.getElementById('d-parcelas-lista');
            if (lista && !lista.querySelector('.d-parcela-linha')) {
                gerarLinhasParcelasDespesa();
            }
        } else {
            box.style.display = 'none';
            if (btn) {
                btn.style.background = '#eef2f5';
                btn.style.color = '#1a2a43';
                btn.textContent = '💳 PARCELAMENTO';
            }
            if (wrapValor) wrapValor.style.opacity = '1';
            if (wrapVenc) wrapVenc.style.opacity = '1';
        }
    };

    function limparParcelamentoDespesa() {
        const box = document.getElementById('d-parcelamento-box');
        const btn = document.getElementById('btnToggleParcelamento');
        const lista = document.getElementById('d-parcelas-lista');
        const qtd = document.getElementById('d-qtd-parcelas');
        const elTotal = document.getElementById('d-parcelas-total');
        const wrapValor = document.getElementById('d-valor');
        const wrapVenc = document.getElementById('d-vencimento');
        if (box) box.style.display = 'none';
        if (lista) lista.innerHTML = '';
        if (qtd) qtd.value = '2';
        if (elTotal) elTotal.textContent = 'R$ 0,00';
        if (btn) {
            btn.style.background = '#eef2f5';
            btn.style.color = '#1a2a43';
            btn.textContent = '💳 PARCELAMENTO';
        }
        if (wrapValor) wrapValor.style.opacity = '1';
        if (wrapVenc) wrapVenc.style.opacity = '1';
    }

    function coletarParcelasDespesaForm() {
        const lista = document.getElementById('d-parcelas-lista');
        if (!lista) return [];
        const out = [];
        lista.querySelectorAll('.d-parcela-linha').forEach(function (row, idx) {
            const valorStr = (row.querySelector('.d-parcela-valor') && row.querySelector('.d-parcela-valor').value) || '';
            const venc = (row.querySelector('.d-parcela-venc') && row.querySelector('.d-parcela-venc').value) || '';
            const valorNum = parseMoedaLocal(valorStr || '0');
            out.push({
                numero: idx + 1,
                valor_string: valorStr,
                valor_numero: valorNum,
                data_vencimento: venc
            });
        });
        return out;
    }

  window.salvarDespesaObra = async function() {
        const empresaLogada = getEmpresaGestor();
        if (!window._cacheNomesDespesas) {
            try {
                const qCache = query(collection(db, "despesas_obras"), where("empresa_id", "==", empresaLogada));
                montarCacheNomesDespesas(await getDocs(qCache));
            } catch (e) { /* segue com cache vazio */ }
        }
        const obra = resolverNomeCanonicoDespesa(document.getElementById('d-obra').value, 'obra');
        const loja = resolverNomeCanonicoDespesa(document.getElementById('d-loja').value, 'loja');
        const nf = document.getElementById('d-nf') ? document.getElementById('d-nf').value.trim() : "";
        const vencimento = document.getElementById('d-vencimento') ? document.getElementById('d-vencimento').value : "";
        const valor = document.getElementById('d-valor').value;
        const desc = document.getElementById('d-desc').value;
        const fotoBase64 = document.getElementById('d-anexo-base64').value;
        const ehParcelado = parcelamentoDespesaAtivo();
        const parcelas = ehParcelado ? coletarParcelasDespesaForm() : [];

        if (!obra || !loja) {
            return Swal.fire('Atenção', 'Preencha a Obra e a Loja!', 'warning');
        }
        if (ehParcelado) {
            if (!parcelas.length) {
                return Swal.fire('Atenção', 'Gere as linhas do parcelamento e informe os valores.', 'warning');
            }
            const invalidas = parcelas.filter(function (p) { return !(p.valor_numero > 0); });
            if (invalidas.length) {
                return Swal.fire('Atenção', 'Informe o valor de todas as parcelas.', 'warning');
            }
            // Completa vencimentos vazios/inválidos pelo calendário (mesmo dia do mês ou último dia válido)
            const vencBaseSalvar = (document.getElementById('d-vencimento') && document.getElementById('d-vencimento').value) || '';
            parcelas.forEach(function (p, idx) {
                if (p.data_vencimento && /^\d{4}-\d{2}-\d{2}$/.test(p.data_vencimento)) {
                    const partes = p.data_vencimento.split('-');
                    const y = parseInt(partes[0], 10);
                    const mo = parseInt(partes[1], 10) - 1;
                    const d = parseInt(partes[2], 10);
                    const maxD = ultimoDiaDoMesCalendario(y, mo);
                    if (d > maxD) {
                        p.data_vencimento = y + '-' + String(mo + 1).padStart(2, '0') + '-' + String(maxD).padStart(2, '0');
                    }
                    return;
                }
                if (vencBaseSalvar) {
                    p.data_vencimento = adicionarMesesCalendarioIso(vencBaseSalvar, idx);
                }
            });
            const semVenc = parcelas.filter(function (p) { return !p.data_vencimento; });
            if (semVenc.length) {
                return Swal.fire('Atenção', 'Informe o vencimento da 1ª parcela (campo Data de Vencimento) ou preencha o vencimento de cada parcela.', 'warning');
            }
        } else if (!valor) {
            return Swal.fire('Atenção', 'Preencha a Obra, Loja e o Valor!', 'warning');
        }
        
        const btn = document.getElementById('btnConfirmarDespesa') || document.getElementById('btnSalvarDespesa');
        const btnCancel = document.getElementById('btnCancelarDespesa');
        const txtOriginal = btn ? btn.innerText : 'CONFIRMAR';
        if (btn) { btn.innerText = "⏳ AGUARDE..."; btn.disabled = true; }
        if (btnCancel) btnCancel.disabled = true;
        
        const dataObj = new Date(); 
        const dataAtual = `${String(dataObj.getDate()).padStart(2, '0')}/${String(dataObj.getMonth() + 1).padStart(2, '0')}/${dataObj.getFullYear()}`;
        
        try {
            if (ehParcelado) {
                const totalParcelas = parcelas.length;
                const grupoId = 'parc_' + dataObj.getTime() + '_' + Math.random().toString(36).slice(2, 8);
                for (let i = 0; i < parcelas.length; i += 1) {
                    const p = parcelas[i];
                    const descParc = (desc ? String(desc).trim() + ' — ' : '') + 'Parcela ' + p.numero + '/' + totalParcelas;
                    await addDoc(collection(db, "despesas_obras"), {
                        empresa_id: empresaLogada,
                        obra_nome: obra,
                        obra_lower: normalizarChaveNomeDespesa(obra),
                        loja_nome: loja,
                        loja_lower: normalizarChaveNomeDespesa(loja),
                        nota_fiscal: nf,
                        data_vencimento: p.data_vencimento || '',
                        data_vencimento_ts: parseDataVencimentoParaTimestamp(p.data_vencimento || ''),
                        valor_string: p.valor_string,
                        valor_numero: p.valor_numero,
                        descricao: descParc,
                        foto_recibo: fotoBase64,
                        data: dataAtual,
                        timestamp: dataObj.getTime() + i,
                        status: 'pendente',
                        parcelado: true,
                        parcela_numero: p.numero,
                        parcela_total: totalParcelas,
                        parcelamento_id: grupoId
                    });
                }
                Swal.fire('Sucesso!', totalParcelas + ' parcelas cadastradas.', 'success');
            } else {
                await addDoc(collection(db, "despesas_obras"), { 
                    empresa_id: empresaLogada, 
                    obra_nome: obra, obra_lower: normalizarChaveNomeDespesa(obra), 
                    loja_nome: loja, loja_lower: normalizarChaveNomeDespesa(loja), 
                    nota_fiscal: nf,
                    data_vencimento: vencimento,
                    data_vencimento_ts: parseDataVencimentoParaTimestamp(vencimento),
                    valor_string: valor, valor_numero: parseMoedaLocal(valor), 
                    descricao: desc, foto_recibo: fotoBase64, 
                    data: dataAtual, timestamp: dataObj.getTime(), status: "pendente" 
                });
                Swal.fire('Sucesso!', 'Despesa cadastrada.', 'success');
            }
            document.getElementById('d-obra').value = ''; 
            document.getElementById('d-loja').value = ''; 
            if(document.getElementById('d-nf')) document.getElementById('d-nf').value = '';
            if(document.getElementById('d-vencimento')) document.getElementById('d-vencimento').value = '';
            document.getElementById('d-valor').value = ''; 
            document.getElementById('d-desc').value = ''; 
            document.getElementById('d-anexo').value = ''; 
            document.getElementById('d-anexo-base64').value = '';
            limparParcelamentoDespesa();
            carregarFiltrosDespesas();
        } catch (e) { 
            console.error(e);
            Swal.fire('Falha Técnica', 'Não foi possível salvar.', 'error'); 
        } finally { 
            if (btn) { btn.innerText = txtOriginal || 'CONFIRMAR'; btn.disabled = false; }
            if (btnCancel) btnCancel.disabled = false;
        }
    };

    const COLECAO_CONTAS_RECEBER = 'contas_receber';

    function formatarMoedaEntrada(n) {
        return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function formatarDataBrEntrada(isoOuBr) {
        const s = String(isoOuBr || '').trim();
        if (!s) return '—';
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
            const [y, m, d] = s.slice(0, 10).split('-');
            return d + '/' + m + '/' + y;
        }
        return s;
    }

    function statusContaReceberNorm(c) {
        return String(c && (c.statusPagamento || c.status) || 'PENDENTE').toUpperCase();
    }

    function contaReceberEmAberto(c) {
        const st = statusContaReceberNorm(c);
        if (st === 'PAGO' || st === 'PAGA') return false;
        return saldoDevedorConta(c) > 0.009;
    }

    function saldoDevedorConta(c) {
        if (c.saldoDevedor != null && Number.isFinite(Number(c.saldoDevedor))) return Number(c.saldoDevedor);
        if (c.saldo_devedor != null && Number.isFinite(Number(c.saldo_devedor))) return Number(c.saldo_devedor);
        const st = statusContaReceberNorm(c);
        if (st === 'PAGO' || st === 'PAGA') return 0;
        return Number(c.total != null ? c.total : c.valor_numero) || 0;
    }

    function totalContaReceber(c) {
        return Number(c.total != null ? c.total : c.valor_numero) || 0;
    }

    function valorRecebidoConta(c) {
        if (c.valorRecebidoParcial != null) return Number(c.valorRecebidoParcial) || 0;
        if (c.valor_recebido_parcial != null) return Number(c.valor_recebido_parcial) || 0;
        const st = statusContaReceberNorm(c);
        if (st === 'PAGO' || st === 'PAGA') return totalContaReceber(c);
        return Math.max(0, totalContaReceber(c) - saldoDevedorConta(c));
    }

    function listaRecebimentosParciaisConta(c) {
        const h = c.recebimentosParciais || c.recebimentos_parciais;
        if (!h) return [];
        return Array.isArray(h) ? h : Object.values(h);
    }

    function htmlSelectFormaPagtoConta(idSel) {
        return '<select id="' + idSel + '" class="swal2-input" style="width:100%;margin:0;height:42px;">'
            + '<option value="PIX">PIX</option>'
            + '<option value="Dinheiro">Dinheiro</option>'
            + '<option value="Transferência">Transferência</option>'
            + '<option value="Cartão">Cartão</option>'
            + '<option value="Boleto">Boleto</option>'
            + '<option value="Cheque">Cheque</option>'
            + '<option value="Outro">Outro</option>'
            + '</select>';
    }

    function htmlHistRecebimentosParciaisConta(c) {
        const hist = listaRecebimentosParciaisConta(c);
        if (!hist.length) return '';
        return '<div style="margin-top:6px;padding:6px 8px;background:#f0f9ff;border-radius:8px;font-size:11px;color:#0c5460;">'
            + '<b>Recebimentos parciais (' + hist.length + '):</b>'
            + '<ul style="margin:4px 0 0 16px;padding:0;">'
            + hist.map(function (h) {
                const dataStr = h.dataStr || h.data || '';
                const dataCurta = dataStr ? String(dataStr).split(/\s+/)[0].replace(',', '') : '—';
                const forma = h.formaPagamento || h.forma_pagamento || '';
                const obs = h.observacao || h.obs || '';
                return '<li>' + escapeHtmlBasico(dataCurta) + ' — <b>' + formatarMoedaEntrada(h.valor || 0) + '</b>'
                    + (forma ? ' · ' + escapeHtmlBasico(forma) : '')
                    + (obs ? ' <span style="color:#666;">(' + escapeHtmlBasico(obs) + ')</span>' : '')
                    + '</li>';
            }).join('')
            + '</ul></div>';
    }

    function nomeClienteConta(c) {
        return c.clienteNome || c.cliente || '—';
    }

    function docContaReceber(c) {
        return c.os || c.documento || '';
    }

    function descContaReceber(c) {
        return c.observacao || c.descricao || '';
    }
