/* js/modulos/equipe.js — edite este arquivo para alterar só este módulo */
    async function carregarListaDeFuncionarios() {
        const empresaLogada = getEmpresaGestor();
        try {
            const q = query(collection(db, "funcionarios"), where("empresa_id", "==", empresaLogada));
            const querySnapshot = await getDocs(q);
            
            let opcoesHTML = '<option value="">Selecione o funcionário...</option>'; 
            let gerenciaHTML = ''; 
            
            window.listaFuncionarios = {};
            
            if (querySnapshot.empty) {
                gerenciaHTML = '<p style="text-align: center; color: #888; font-size: 13px;">Nenhum funcionário cadastrado ainda.<br><span style="font-size:12px;">Use <b>Cadastrar Funcionário</b> no menu lateral para adicionar.</span></p>';
            }

            let funcsArray = [];
            querySnapshot.forEach(doc => funcsArray.push({id: doc.id, ...doc.data()}));
            funcsArray.sort((a, b) => a.nome.localeCompare(b.nome));

            funcsArray.forEach((func) => {
                window.listaFuncionarios[func.id] = func;
                opcoesHTML += `<option value="${func.id}">${func.nome}</option>`;
                
                gerenciaHTML += `
                    <div class="func-item">
                        <div>
                            <b style="color:var(--dark-navy);">${func.nome}</b><br>
                            <span style="font-size: 11px; color: #666;">📱 ${func.tel} | CPF: ${func.cpf}</span><br>
                            <span style="font-size: 11px; color: #d4a017; font-weight: bold;">💸 PIX: ${func.pix || 'Não informado'}</span><br>
                            <span style="font-size: 11px; color: #28a745;">R$ ${func.salario || '0,00'} | ${labelTipoRemuneracao(func.tipo_remuneracao)} | Horário: ${func.hora_entrada || '07:00'} às ${func.hora_saida || '17:00'} | Almoço: ${(func.intervalo_minutos ?? 60)} min | Sábado: ${(func.sabado_horas ?? 0)}h</span><br>
                            <span style="font-size: 10px; color: #666;">Entrada: ${formatarDataBrDeIso(parseDataIsoFuncionario(func.data_admissao))} | Saída: ${formatarDataBrDeIso(parseDataIsoFuncionario(func.data_demissao))} | Férias desde: ${formatarDataBrDeIso(parseDataIsoFuncionario(func.data_inicio_ferias))} (${func.ferias_dias ?? 30} dias)</span>
                        </div>
                        <div style="display: flex; gap: 5px; flex-direction: column;">
                            <button class="btn-gold" style="padding: 6px 10px; margin: 0; font-size: 11px;" onclick="resetarSenhaFuncionario('${func.id}', '${func.nome}')">🔑 Resetar</button>
                            <button style="background: #4285F4; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: bold;" onclick="editarFuncionario('${func.id}')">✏️ Editar</button>
                            <button class="btn-excluir" onclick="excluirFuncionario('${func.id}', '${func.nome}')">🗑️ Excluir</button>
                        </div>
                    </div>`;
            });
            
            document.querySelectorAll('.lista-funcs').forEach(select => {
                if (select.id === 'ac-lista-func' || select.id === 'df-lista-func') {
                    select.innerHTML = '<option value="">Todos (empresa)</option>' + opcoesHTML;
                } else if (select.id === 'pt-func-select') {
                    select.innerHTML = '<option value="">Selecione o funcionário...</option>'
                        + '<option value="__TODOS__">👥 TODOS OS FUNCIONÁRIOS</option>'
                        + opcoesHTML.replace(/^<option value="">Selecione o funcionário\.\.\.<\/option>/, '');
                } else {
                    select.innerHTML = opcoesHTML;
                }
            });
            vincularSelectsFuncionarioContextoRH();
            
            if (document.getElementById('lista-funcionarios-gerencial')) {
                document.getElementById('lista-funcionarios-gerencial').innerHTML = gerenciaHTML;
            }
            const elContagem = document.getElementById('equipe-cadastrada-contagem');
            if (elContagem) {
                elContagem.textContent = funcsArray.length
                    ? `${funcsArray.length} funcionário(s) cadastrado(s) nesta empresa`
                    : 'Nenhum funcionário cadastrado nesta empresa';
            }
            const btnEquipe = document.getElementById('btn-menu-equipe-cadastrada');
            if (btnEquipe) {
                btnEquipe.textContent = funcsArray.length
                    ? `👥 Equipe Cadastrada (${funcsArray.length})`
                    : '👥 Equipe Cadastrada';
            }
        } catch(e) { 
            console.error("Erro ao carregar:", e); 
        }
    }

window.gerarFolhaPagamento = async function() {
        const funcId = document.getElementById('folha-func-select').value;
        const mesSelected = document.getElementById('folha-mes').value;
        const anoSelected = document.getElementById('folha-ano').value;

        if (!funcId || !mesSelected || !anoSelected) {
            return Swal.fire('Atenção', 'Selecione o funcionário, mês e ano.', 'warning');
        }

        Swal.fire({ 
            title: 'A calcular Folha...', 
            text: 'Buscando pontos e descontos.', 
            allowOutsideClick: false 
        });
        Swal.showLoading();

        const funcionario = window.listaFuncionarios[funcId];
        registrarFuncionarioContextoRH(funcId);
        // Trava de segurança: se o salário vier quebrado, assume 0
        const salarioBase = parseMoedaLocal(funcionario.salario || "0") || 0; 
        const horaEntPadrão = funcionario.hora_entrada || "07:00";
        const horaSaiPadrão = funcionario.hora_saida || "17:00";
        const intervaloMinutosPadrao = Number(funcionario.intervalo_minutos ?? 60);
        const sabadoHorasPadrao = Number(funcionario.sabado_horas ?? 0);
        const admIso = parseDataIsoFuncionario(funcionario.data_admissao);
        const demIso = parseDataIsoFuncionario(funcionario.data_demissao);
        const feriasInicioIso = parseDataIsoFuncionario(funcionario.data_inicio_ferias);
        const feriasDiasCad = Number(funcionario.ferias_dias ?? 30);
        const tipoRemuneracao = normalizarTipoRemuneracao(funcionario.tipo_remuneracao);

        let [eH, eM] = horaEntPadrão.split(':').map(Number);
        let [sH, sM] = horaSaiPadrão.split(':').map(Number);
        let jornadaDiariaHoras = (sH + sM/60) - (eH + eM/60);
        if (jornadaDiariaHoras < 0) jornadaDiariaHoras += 24; 
        if (Number.isFinite(intervaloMinutosPadrao) && intervaloMinutosPadrao > 0) {
            jornadaDiariaHoras = Math.max(0, jornadaDiariaHoras - (intervaloMinutosPadrao / 60));
        }

        function pad2(n) { return String(n).padStart(2, '0'); }

        function isoDateLocal(ano, mes1a12, dia) {
            return `${ano}-${pad2(mes1a12)}-${pad2(dia)}`;
        }

        // Calcula Páscoa (Meeus/Jones/Butcher) para suportar feriados móveis, se você quiser cadastrar no Firestore.
        function calcularPascoa(ano) {
            const a = ano % 19;
            const b = Math.floor(ano / 100);
            const c = ano % 100;
            const d = Math.floor(b / 4);
            const e = b % 4;
            const f = Math.floor((b + 8) / 25);
            const g = Math.floor((b - f + 1) / 3);
            const h = (19 * a + b - d - g + 15) % 30;
            const i = Math.floor(c / 4);
            const k = c % 4;
            const l = (32 + 2 * e + 2 * i - h - k) % 7;
            const m = Math.floor((a + 11 * h + 22 * l) / 451);
            const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3=março, 4=abril
            const dia = ((h + l - 7 * m + 114) % 31) + 1;
            return { mes, dia }; // mes 3-4
        }

        function addDias(ano, mesIndex0, dia, delta) {
            const dt = new Date(ano, mesIndex0, dia);
            dt.setDate(dt.getDate() + delta);
            return dt;
        }

        // Feriados nacionais fixos (Brasil). Municipais/estaduais devem ser cadastrados no Firestore (coleção "feriados").
        function feriadosNacionaisFixos(ano) {
            return new Set([
                `${ano}-01-01`, // Confraternização Universal
                `${ano}-04-21`, // Tiradentes
                `${ano}-05-01`, // Dia do Trabalho
                `${ano}-09-07`, // Independência
                `${ano}-10-12`, // Nossa Senhora Aparecida
                `${ano}-11-02`, // Finados
                `${ano}-11-15`, // Proclamação da República
                `${ano}-12-25`  // Natal
            ]);
        }

        function isFeriadoOuDomingo(dataIso, holidaySet) {
            // dataIso: YYYY-MM-DD
            const [y, m, d] = dataIso.split('-').map(Number);
            const dow = new Date(y, m - 1, d).getDay(); // 0=domingo
            return dow === 0 || holidaySet.has(dataIso);
        }

        function isSabado(dataIso) {
            const [y, m, d] = dataIso.split('-').map(Number);
            return new Date(y, m - 1, d).getDay() === 6;
        }

        function isDiaUtil(dataIso, holidaySet) {
            const [y, m, d] = dataIso.split('-').map(Number);
            const dow = new Date(y, m - 1, d).getDay();
            if (dow === 0) return false;
            if (holidaySet.has(dataIso)) return false;
            return true;
        }

        function horasDevidasNoMes(ano, mes1a12, jornadaLiquidaHoras, sabadoHoras, holidaySet) {
            const totalDias = diasNoCalendarioMes(ano, mes1a12);
            let soma = 0;
            for (let d = 1; d <= totalDias; d++) {
                const iso = isoDateLocal(ano, mes1a12, d);
                const [yy, mm, dd] = iso.split('-').map(Number);
                const dow = new Date(yy, mm - 1, dd).getDay(); // 0=dom ... 6=sáb
                if (holidaySet.has(iso) || dow === 0) continue;
                if (dow === 6) {
                    if (Number.isFinite(sabadoHoras) && sabadoHoras > 0) soma += sabadoHoras;
                    continue;
                }
                if (isDiaUtil(iso, holidaySet)) soma += jornadaLiquidaHoras;
            }
            return soma;
        }

        try {
            const empresaLogada = getEmpresaGestor();

            // 1. BUSCA DE VALES - Simplificada para evitar erro de índice ausente no Firebase
            const qVales = query(collection(db, "vales_sistema"), where("funcionario_id", "==", funcId));
            const valesSnap = await getDocs(qVales);
            
            let totalDinheiro = 0; 
            let totalProduto = 0;
            const itensValesFolha = [];

            valesSnap.forEach(doc => {
                const vale = doc.data();
                
                // ESPIÃO 1: Mostra todos os vales desse funcionário que vieram do banco
                console.log("🔍 Vale encontrado no banco:", vale);
                
                // Compara ignorando maiúsculas e minúsculas para evitar erro de digitação no status
                const statusVale = String(vale.status || "").toLowerCase();
                const contaNaFolha = statusVale === 'assinado' || statusVale === 'assinado_manual' || vale.desconta_folha === true;
                
                if (vale.empresa_id === empresaLogada && contaNaFolha) {
                    const dataVale = separarDataSegura(vale.data_assinatura || vale.data_criacao || vale.data);
                    
                    // ESPIÃO 2: Mostra como a data foi separada
                    console.log("📅 Data extraída do vale:", dataVale, " | Mês/Ano selecionado:", mesSelected, anoSelected);
                    
                    if (Number(dataVale.mes) === Number(mesSelected) && Number(dataVale.ano) === Number(anoSelected)) {
                        let v = parseMoedaLocal(vale.valor) || 0;
                        const tipoVale = String(vale.tipo || "").toLowerCase();
                        const ehProduto = tipoVale.includes('produto') || tipoVale.includes('material');
                        const ehManual = statusVale === 'assinado_manual' || String(vale.assinatura_tipo || vale.origem || '').toLowerCase() === 'manual';
                        itensValesFolha.push({
                            id: doc.id,
                            data: vale.data_assinatura || vale.data_criacao || vale.data || '',
                            hora: vale.hora_assinatura || vale.hora_criacao || '',
                            tipo: vale.tipo || '',
                            valor: v,
                            descricao: vale.descricao || '',
                            manual: ehManual,
                            produto: ehProduto
                        });
                        if (ehProduto) {
                            totalProduto += v;
                            console.log("✅ Adicionado aos Produtos:", v);
                        } else {
                            // Dinheiro, PIX e outros adiantamentos
                            totalDinheiro += v;
                            console.log("✅ Adicionado aos Vales/PIX:", v);
                        }
                    } else {
                        console.log("❌ Ignorado: O mês ou ano não bateu.");
                    }
                } else {
                    console.log("❌ Ignorado: Empresa ou Status diferente. Empresa:", vale.empresa_id, " | Status:", vale.status);
                }
            });

            // 1b. AJUDA DE CUSTO (lançamentos do mês de referência)
            let totalAjudaCusto = 0;
            let itensAjudaCusto = [];
            try {
                const qAjuda = query(collection(db, COLECAO_AJUDA_CUSTO), where('funcionario_id', '==', funcId));
                const ajudaSnap = await getDocs(qAjuda);
                ajudaSnap.forEach(docu => {
                    const a = docu.data();
                    if (a.empresa_id !== empresaLogada) return;
                    const ref = separarDataSegura(a.data || a.data_iso);
                    if (Number(ref.mes) === Number(mesSelected) && Number(ref.ano) === Number(anoSelected)) {
                        const v = parseMoedaLocal(a.valor_string) || a.valor_numero || 0;
                        totalAjudaCusto += v;
                        itensAjudaCusto.push({
                            id: docu.id,
                            data: a.data || dataBrDeIsoAjuda(a.data_iso),
                            discriminacao: a.discriminacao || '',
                            valor: v,
                            valor_fmt: a.valor_string || formatarMoeda(v)
                        });
                    }
                });
                itensAjudaCusto.sort((x, y) => {
                    const tx = parseDataVencimentoParaTimestamp(x.data) || 0;
                    const ty = parseDataVencimentoParaTimestamp(y.data) || 0;
                    return tx - ty;
                });
            } catch (eAj) {
                console.warn('Ajuda de custo:', eAj);
            }

            // 1c. DESCONTOS LANÇADOS NA FOLHA (INSS, IRRF, etc. — mês de referência)
            let totalDescontosLancados = 0;
            let itensDescontosFolha = [];
            try {
                const qDesc = query(collection(db, COLECAO_DESCONTOS_FOLHA), where('funcionario_id', '==', funcId));
                const descSnap = await getDocs(qDesc);
                descSnap.forEach(docu => {
                    const d = docu.data();
                    if (d.empresa_id !== empresaLogada) return;
                    if (String(d.mes_ref || '').padStart(2, '0') !== String(mesSelected).padStart(2, '0')) return;
                    if (String(d.ano_ref || '') !== String(anoSelected)) return;
                    const v = parseMoedaLocal(d.valor_string) || d.valor_numero || 0;
                    totalDescontosLancados += v;
                    itensDescontosFolha.push({
                        id: docu.id,
                        tipo_desconto: d.tipo_desconto || 'Outros',
                        observacao: d.observacao || '',
                        valor: v,
                        valor_fmt: d.valor_string || formatarMoeda(v)
                    });
                });
                itensDescontosFolha.sort((a, b) => String(a.tipo_desconto).localeCompare(String(b.tipo_desconto), 'pt-BR'));
            } catch (eDf) {
                console.warn('Descontos folha:', eDf);
            }

            // INSS automático (CLT): calcula pela tabela progressiva vigente e injeta como desconto do mês
            // Só aplica se o funcionário estiver marcado com a opção de INSS automático e se ainda não houver INSS lançado manualmente.
            const deveInssAuto = normalizarTipoRemuneracao(funcionario.tipo_remuneracao) === 'mensal' && funcionario.descontar_inss === true;
            const jaTemInssLancado = itensDescontosFolha.some((it) => normalizarTextoSemAcentoLower(it.tipo_desconto).includes('inss'));
            let inssAutoValor = 0;

            // 2. BUSCA DE PONTOS (ignora registros cancelados por evento de auditoria)
            const qPonto = query(collection(db, "ponto_registros"), where("funcionario_id", "==", funcId));
            const pontoSnap = await getDocs(qPonto);

            const canceladosPonto = new Set();
            let faltasRhInjust = new Map();
            let faltasRhJust = new Map();
            try {
                const qEvtP = query(collection(db, "ponto_eventos"), where("funcionario_id", "==", funcId));
                const snapEvtP = await getDocs(qEvtP);
                snapEvtP.forEach((ed) => {
                    const ev = ed.data();
                    if (ev && ev.tipo === "CANCELAMENTO" && ev.ponto_id) canceladosPonto.add(ev.ponto_id);
                });
                const idxF = indexarEventosFaltasRh(snapEvtP, mesSelected, anoSelected);
                faltasRhInjust = idxF.injust;
                faltasRhJust = idxF.just;
            } catch (_) { /* sem eventos */ }

            let pontosDoMes = [];
            pontoSnap.forEach(doc => {
                if (canceladosPonto.has(doc.id)) return;
                const pt = doc.data();
                const dataPonto = separarDataSegura(pt.data);
                
                if (Number(dataPonto.mes) === Number(mesSelected) && Number(dataPonto.ano) === Number(anoSelected)) {
                    pontosDoMes.push({ id: doc.id, ...pt });
                }
            });
                          
            let diasTrabalhados = {};
            pontosDoMes.forEach(pt => {
                const keyDiaPt = formatarDataBrPadrao(pt.data);
                const ptNorm = { ...pt };
                if (!Number.isFinite(ptNorm.timestamp)) {
                    const tsFix = parseDataHoraBrLocalParaTimestamp(ptNorm.data, ptNorm.hora);
                    if (Number.isFinite(tsFix)) ptNorm.timestamp = tsFix;
                }
                if (!diasTrabalhados[keyDiaPt]) diasTrabalhados[keyDiaPt] = [];
                diasTrabalhados[keyDiaPt].push(ptNorm);
            });
            Object.keys(diasTrabalhados).forEach((keyDiaPt) => {
                const dedup = deduplicarBatidasPonto(diasTrabalhados[keyDiaPt], canceladosPonto);
                diasTrabalhados[keyDiaPt] = dedup.validas;
            });

            let totalHorasExtras50Decimais = 0;
            let totalHorasExtras100Decimais = 0; // domingo e feriado (adicional 100%)
            let bancoHorasCreditoDecimais = 0; // sábado sem escala, etc. (sem pagamento extra nesta folha)

            // Feriados (nacionais fixos + cadastrados no Firestore por empresa)
            const feriadosSet = feriadosNacionaisFixos(Number(anoSelected));
            try {
                const qFer = query(collection(db, "feriados"), where("empresa_id", "==", empresaLogada));
                const ferSnap = await getDocs(qFer);
                ferSnap.forEach((d) => {
                    const f = d.data();
                    if (!f) return;
                    // Aceita "data_iso" (YYYY-MM-DD) ou "data" (DD/MM/AAAA)
                    if (typeof f.data_iso === 'string' && f.data_iso.includes('-')) {
                        if (f.data_iso.startsWith(String(anoSelected))) feriadosSet.add(f.data_iso);
                    } else if (typeof f.data === 'string' && f.data.includes('/')) {
                        const parts = f.data.split('/');
                        if (parts.length === 3) {
                            const iso = `${parts[2]}-${pad2(parts[1])}-${pad2(parts[0])}`;
                            if (iso.startsWith(String(anoSelected))) feriadosSet.add(iso);
                        }
                    }
                });
            } catch (e) {
                // Se a coleção não existir ou falhar, segue só com feriados fixos
            }

            function calcularHorasDoDia(batidasRaw) {
                const dedupDia = deduplicarBatidasPonto(batidasRaw, null);
                const batidas = (dedupDia.validas || [])
                    .map(b => (b ? { ...b, tipo: normalizarTipoBatidaPonto(b.tipo) } : b))
                    .filter(b => b && ['Entrada', 'Saída', 'Início Intervalo', 'Fim Intervalo'].includes(b.tipo) && Number.isFinite(b.timestamp))
                    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

                let trabalhandoDesde = null;
                let emIntervalo = false;
                let segundosTrabalhados = 0;
                let tevePar = false;
                let segundosIntervaloMedido = 0;
                let inicioIntervaloTs = null;

                for (const b of batidas) {
                    if (b.tipo === 'Entrada') {
                        if (!emIntervalo && trabalhandoDesde == null) trabalhandoDesde = b.timestamp;
                    } else if (b.tipo === 'Saída') {
                        if (trabalhandoDesde != null && b.timestamp > trabalhandoDesde) {
                            segundosTrabalhados += (b.timestamp - trabalhandoDesde) / 1000;
                            trabalhandoDesde = null;
                            tevePar = true;
                        }
                        emIntervalo = false;
                        inicioIntervaloTs = null;
                    } else if (b.tipo === 'Início Intervalo') {
                        if (trabalhandoDesde != null && b.timestamp > trabalhandoDesde) {
                            segundosTrabalhados += (b.timestamp - trabalhandoDesde) / 1000;
                            trabalhandoDesde = null;
                            tevePar = true;
                        }
                        inicioIntervaloTs = b.timestamp;
                        emIntervalo = true;
                    } else if (b.tipo === 'Fim Intervalo') {
                        if (inicioIntervaloTs != null && b.timestamp > inicioIntervaloTs) {
                            segundosIntervaloMedido += (b.timestamp - inicioIntervaloTs) / 1000;
                        }
                        if (emIntervalo) {
                            trabalhandoDesde = b.timestamp;
                            emIntervalo = false;
                        }
                        inicioIntervaloTs = null;
                    }
                }

                if (trabalhandoDesde != null && batidas.length) {
                    const ult = batidas[batidas.length - 1];
                    if (ult.tipo === 'Saída' && ult.timestamp > trabalhandoDesde) {
                        segundosTrabalhados += (ult.timestamp - trabalhandoDesde) / 1000;
                        tevePar = true;
                    }
                }

                const firstEntrada = batidas.find(b => b.tipo === 'Entrada');
                const lastSaida = [...batidas].reverse().find(b => b.tipo === 'Saída');
                const firstTs = batidas.length ? batidas[0].timestamp : null;
                const lastTs = batidas.length ? batidas[batidas.length - 1].timestamp : null;
                return {
                    horasFechadas: segundosTrabalhados / 3600,
                    tevePar,
                    firstTs,
                    lastTs,
                    firstTsEntrada: firstEntrada ? firstEntrada.timestamp : null,
                    lastTsSaida: lastSaida ? lastSaida.timestamp : null,
                    segundosIntervaloMedido,
                    nBatidas: batidas.length,
                    temEntrada: !!firstEntrada,
                    temSaida: !!lastSaida
                };
            }

            function horasTrabalhadasParaDesconto(r, horasDevidasNoDia) {
                const intervaloAlmocoH = intervaloMinutosPadrao / 60;
                let h = r.horasFechadas;
                const cap = (horasDevidasNoDia || 8) * 1.35;

                if (r.temEntrada && r.temSaida && r.firstTsEntrada != null && r.lastTsSaida != null && r.lastTsSaida > r.firstTsEntrada) {
                    const spanH = (r.lastTsSaida - r.firstTsEntrada) / (1000 * 60 * 60);
                    const intervaloH = r.segundosIntervaloMedido > 0
                        ? r.segundosIntervaloMedido / 3600
                        : intervaloAlmocoH;
                    const porFaixa = Math.max(0, spanH - intervaloH);
                    const porFaixaCap = Math.min(porFaixa, cap);
                    if (!r.tevePar && r.nBatidas >= 2) {
                        h = Math.max(h, porFaixaCap);
                    } else if (porFaixaCap > h + 0.08) {
                        h = Math.max(h, Math.min(porFaixaCap, horasDevidasNoDia || porFaixaCap));
                    }
                } else if (!r.tevePar && r.nBatidas >= 2 && r.firstTs != null && r.lastTs != null && r.lastTs > r.firstTs) {
                    const spanH = (r.lastTs - r.firstTs) / (1000 * 60 * 60);
                    h = Math.max(h, Math.min(spanH, cap));
                }
                return h;
            }

            Object.keys(diasTrabalhados).forEach(dia => {
                const r = calcularHorasDoDia(diasTrabalhados[dia]);
                if (r.nBatidas === 0) return;

                const { ano, mes, dia: dd } = separarDataSegura(dia);
                const dataIso = `${ano}-${pad2(mes)}-${pad2(dd)}`;

                const sabadoEhDevido = isSabado(dataIso) && Number.isFinite(sabadoHorasPadrao) && sabadoHorasPadrao > 0;
                const diaEhDevido = sabadoEhDevido || isDiaUtil(dataIso, feriadosSet);
                const horasDevidasNoDia = sabadoEhDevido ? sabadoHorasPadrao : jornadaDiariaHoras;

                const horasTrabalhadas = horasTrabalhadasParaDesconto(r, horasDevidasNoDia);
                if (horasTrabalhadas <= 0 && !r.tevePar) return;

                // Domingo/feriado: hora extra 100% (valor da hora × 2) sobre as horas trabalhadas
                if (isFeriadoOuDomingo(dataIso, feriadosSet)) {
                    if (horasTrabalhadas > 0) {
                        totalHorasExtras100Decimais += horasTrabalhadas;
                    }
                    return;
                }

                if (!diaEhDevido) {
                    bancoHorasCreditoDecimais += horasTrabalhadas;
                    return;
                }

                // Extra 50% só com fechamento de períodos (evita inflar por batida solta)
                if (r.tevePar && horasTrabalhadas > jornadaDiariaHoras) {
                    totalHorasExtras50Decimais += (horasTrabalhadas - jornadaDiariaHoras);
                }
            });

            // Hora extra: salário ÷ 220 × adicional (50% dia útil | 100% domingo/feriado)
            const valorHoraNormal220 = salarioBase / 220;
            let valorTotalReceberExtras =
                (totalHorasExtras50Decimais * (valorHoraNormal220 * 1.5)) +
                (totalHorasExtras100Decimais * (valorHoraNormal220 * 2.0));

            // Mensal CLT usa ÷ 30 para falta/DSR; por ponto usa ÷ dias a trabalhar no mês
            const diasMesParaSalario = 30;
            const horasBaseDescontoPorDia = 8;
            const valorDiaMensalClt = salarioBase / diasMesParaSalario;
            let valorDiaSalario = valorDiaMensalClt;
            let valorHoraDesconto = valorDiaMensalClt / horasBaseDescontoPorDia;
            const anoNum = Number(anoSelected);
            const mesNum = parseInt(String(mesSelected).trim(), 10);
            const diasNoMesCalc = diasNoCalendarioMes(anoNum, mesNum);
            let horasFaltantes = 0;
            let diasPagos = 0;
            let diasDescansoIncluidosRef = 0;
            let diasNoVinculoCalendario = 0;
            let faltasInjustificadas = 0;
            const datasFaltasInjustificadasIso = [];
            const datasFaltasComDsrIso = [];
            let diasFeriasNoMes = 0;
            let diasDevidosNoMes = 0;
            const discriminacaoDias = [];
            const nomesDiasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
            const hojeIsoFolha = obterIsoHojeLocal();

            function formatarHorasDecimais(hDec) {
                const neg = hDec < 0;
                const a = Math.abs(Number(hDec) || 0);
                const hh = Math.floor(a);
                const mm = Math.round((a - hh) * 60);
                return (neg ? '−' : '') + `${hh}h ${mm}m`;
            }

            for (let d = 1; d <= diasNoMesCalc; d++) {
                const isoD = isoDateLocal(anoNum, mesNum, d);
                const dt = new Date(anoNum, mesNum - 1, d);
                const dowD = dt.getDay();
                const nomeSemana = nomesDiasSemana[dowD];
                const keyDia = `${String(d).padStart(2, '0')}/${String(mesNum).padStart(2, '0')}/${anoNum}`;

                if (!isDiaContratoAtivo(isoD, admIso, demIso)) {
                    discriminacaoDias.push({
                        keyDia, nomeSemana, tipoDia: 'Fora do vínculo',
                        esperadoTxt: '—',
                        trabalhadoTxt: '—',
                        diferencaTxt: '—',
                        diaPagoTxt: 'Não',
                        situacao: admIso && isoD < admIso
                            ? `Antes da admissão (${formatarDataBrDeIso(admIso)}).`
                            : (demIso ? `Após desligamento (${formatarDataBrDeIso(demIso)}).` : 'Dia fora do período contratual.')
                    });
                    continue;
                }

                if (isDiaEmFerias(isoD, feriasInicioIso, feriasDiasCad)) {
                    diasFeriasNoMes += 1;
                    discriminacaoDias.push({
                        keyDia, nomeSemana, tipoDia: 'Férias (gozo)',
                        esperadoTxt: 'Sem jornada (férias CLT)',
                        trabalhadoTxt: '—',
                        diferencaTxt: '—',
                        diaPagoTxt: 'Férias',
                        situacao: 'Remuneração de férias + 1/3 constitucional (CLT — art. 7º, XVII e art. 142). Não exige ponto; valor na linha «Férias (CLT)» do holerite.'
                    });
                    continue;
                }

                if (tipoRemuneracao === 'mensal') {
                    diasNoVinculoCalendario += 1;
                }

                if (dowD === 0 || feriadosSet.has(isoD)) {
                    const rD = calcularHorasDoDia(diasTrabalhados[keyDia] || []);
                    const workedD = horasTrabalhadasParaDesconto(rD, 24);
                    const descansoPendente = isoD > hojeIsoFolha;
                    if (tipoRemuneracao === 'mensal' && !descansoPendente) {
                        diasDescansoIncluidosRef += 1;
                    }
                    discriminacaoDias.push({
                        keyDia, nomeSemana, tipoDia: feriadosSet.has(isoD) ? 'Feriado' : 'Domingo',
                        esperadoTxt: '0h (descanso)',
                        trabalhadoTxt: formatarHorasDecimais(workedD),
                        diferencaTxt: formatarHorasDecimais(0 - workedD),
                        diaPagoTxt: tipoRemuneracao === 'mensal'
                            ? (descansoPendente ? 'Pendente' : 'Incluído (DSR)')
                            : 'Não',
                        situacao: workedD > 0
                            ? (tipoRemuneracao === 'mensal'
                                ? 'Trabalho em descanso/feriado — pago como hora extra +100%. Dia de DSR incluído no salário mensal.'
                                : 'Há registro de trabalho em descanso/feriado (pago como hora extra +100% na folha, conforme regra).')
                            : (tipoRemuneracao === 'mensal'
                                ? 'Descanso sem ponto — incluído no salário mensal (DSR).'
                                : 'Sem registro de ponto.')
                    });
                    continue;
                }

                if (dowD === 6 && !(Number.isFinite(sabadoHorasPadrao) && sabadoHorasPadrao > 0)) {
                    const rD = calcularHorasDoDia(diasTrabalhados[keyDia] || []);
                    const workedD = horasTrabalhadasParaDesconto(rD, 24);
                    const sabadoPendente = isoD > hojeIsoFolha;
                    if (tipoRemuneracao === 'mensal' && !sabadoPendente) {
                        diasDescansoIncluidosRef += 1;
                    }
                    discriminacaoDias.push({
                        keyDia, nomeSemana, tipoDia: 'Sábado (sem escala)',
                        esperadoTxt: '0h (não devido)',
                        trabalhadoTxt: formatarHorasDecimais(workedD),
                        diferencaTxt: formatarHorasDecimais(0 - workedD),
                        diaPagoTxt: tipoRemuneracao === 'mensal'
                            ? (sabadoPendente ? 'Pendente' : 'Incluído (mensal)')
                            : 'Não',
                        situacao: workedD > 0
                            ? (tipoRemuneracao === 'mensal'
                                ? 'Trabalho em sábado sem escala — crédito de banco de horas. Sábado sem jornada entra no mensal (DSR).'
                                : 'Há trabalho em sábado sem jornada cadastrada (conta como crédito de banco de horas, não como dia pago).')
                            : (tipoRemuneracao === 'mensal'
                                ? 'Sábado sem jornada — incluído no salário mensal.'
                                : '—')
                    });
                    continue;
                }

                let expectedD = 0;
                let tipoDia = 'Dia útil';
                if (dowD === 6) {
                    expectedD = sabadoHorasPadrao;
                    tipoDia = 'Sábado (escala)';
                } else {
                    expectedD = jornadaDiariaHoras;
                }

                if (tipoRemuneracao === 'ponto') {
                    diasDevidosNoMes += 1;
                }

                const batidasDiaArr = diasTrabalhados[keyDia] || [];
                const resumoBatidasDia = resumoBatidasDiaParaFolha(batidasDiaArr);
                const rD = calcularHorasDoDia(batidasDiaArr);
                const workedD = horasTrabalhadasParaDesconto(rD, expectedD);
                const faltaD = workedD > 0 ? Math.max(0, expectedD - workedD) : null;
                let diaPago = workedD > 0;
                let situacao = '';

                const marcadaRhInjust = faltasRhInjust.has(isoD);
                const marcadaRhJust = faltasRhJust.has(isoD);
                const diaAguardando = diaAguardandoPontoFolha(isoD, hojeIsoFolha, marcadaRhInjust, marcadaRhJust, workedD);
                const ehFaltaInjust = ehFaltaInjustificadaNoDia(isoD, workedD, faltasRhInjust, faltasRhJust, hojeIsoFolha);

                if (diaAguardando) {
                    diaPago = false;
                    situacao = isoD > hojeIsoFolha
                        ? 'Dia futuro — ainda não ocorreu. Não conta como falta até passar a data.'
                        : 'Dia em andamento — aguardando registro de ponto ou fechamento do dia.';
                } else if (tipoRemuneracao === 'mensal') {
                    if (ehFaltaInjust) {
                        faltasInjustificadas += 1;
                        datasFaltasInjustificadasIso.push(isoD);
                        const evRh = faltasRhInjust.get(isoD);
                        if (faltaInjustDescontaDsr(evRh, marcadaRhInjust)) datasFaltasComDsrIso.push(isoD);
                        diaPago = false;
                        situacao = textoDescontoFaltaInjust(
                            marcadaRhInjust,
                            evRh,
                            'Falta injustificada (sem registro de ponto).',
                            resumoBatidasDia
                        );
                    } else if (workedD > 0) {
                        diasPagos += 1;
                        horasFaltantes += Math.max(0, expectedD - workedD);
                        diaPago = true;
                        situacao = (faltaD === 0)
                            ? 'Jornada do dia cumprida (sem horas devidas).'
                            : `Atraso e/ou saída antecipada: faltaram ${formatarHorasDecimais(faltaD)} para completar a jornada esperada. ${resumoBatidasDia}`;
                        if (marcadaRhJust) {
                            const ej = faltasRhJust.get(isoD);
                            situacao += ` Atestado/justificativa RH${ej && ej.motivo ? ': ' + ej.motivo : ''}.`;
                        }
                    } else {
                        diaPago = false;
                        situacao = 'Sem registro de ponto — verifique se há atestado RH ou marque falta injustificada.';
                    }
                } else if (ehFaltaInjust) {
                    faltasInjustificadas += 1;
                    datasFaltasInjustificadasIso.push(isoD);
                    const evRh = faltasRhInjust.get(isoD);
                    if (faltaInjustDescontaDsr(evRh, marcadaRhInjust)) datasFaltasComDsrIso.push(isoD);
                    diaPago = false;
                    situacao = textoDescontoFaltaInjust(
                        marcadaRhInjust,
                        evRh,
                        'Falta injustificada (dia útil/sábado de escala sem ponto).',
                        resumoBatidasDia
                    );
                } else if (diaPago) {
                    diasPagos += 1;
                    horasFaltantes += Math.max(0, expectedD - workedD);
                    situacao = (faltaD === 0)
                        ? 'Jornada do dia cumprida (sem horas devidas).'
                        : `Atraso e/ou saída antecipada: faltaram ${formatarHorasDecimais(faltaD)} para completar a jornada esperada. ${resumoBatidasDia}`;
                    if (marcadaRhJust) {
                        const ej = faltasRhJust.get(isoD);
                        situacao += ` Justificada pelo RH${ej && ej.motivo ? ': ' + ej.motivo : ''}.`;
                    }
                } else if (marcadaRhJust) {
                    const ej = faltasRhJust.get(isoD);
                    situacao = `Ausência justificada pelo RH (atestado)${ej && ej.motivo ? ' — ' + ej.motivo : ''}. Não conta como falta nem desconta DSR.`;
                } else {
                    situacao = `Sem registro de ponto. Marque <b>falta injustificada</b> ou <b>atestado</b> no RH se aplicável. ${resumoBatidasDia}`;
                }

                const esperadoTxtLinha = (dowD === 6)
                    ? `${formatarHorasDecimais(expectedD)} (carga de sábado: ${sabadoHorasPadrao}h)`
                    : `${formatarHorasDecimais(expectedD)} (jornada: ${funcionario.hora_entrada || '—'} às ${funcionario.hora_saida || '—'}, almoço ${funcionario.intervalo_minutos ?? 60} min)`;

                discriminacaoDias.push({
                    keyDia,
                    nomeSemana,
                    tipoDia,
                    esperadoTxt: esperadoTxtLinha,
                    trabalhadoTxt: formatarHorasDecimais(workedD),
                    diferencaTxt: formatarHorasDecimais(expectedD - workedD),
                    diaPagoTxt: diaAguardando
                        ? 'Pendente'
                        : ((tipoRemuneracao === 'mensal' || tipoRemuneracao === 'ponto')
                            ? (diaPago ? 'Sim' : 'Falta')
                            : (diaPago ? 'Sim' : 'Não')),
                    situacao
                });
            }
            let salarioProporcional;
            let diasPagosExibir;
            const mesCheio = mesCalendarioInteiroNoVinculo(anoNum, mesNum, diasNoMesCalc, admIso, demIso);

            if (tipoRemuneracao === 'mensal') {
                valorDiaSalario = valorDiaMensalClt;
            } else {
                const divPonto = diasDevidosNoMes > 0 ? diasDevidosNoMes : diasMesParaSalario;
                valorDiaSalario = salarioBase / divPonto;
                const diasElegiveisPonto = Math.max(0, diasDevidosNoMes - faltasInjustificadas);
                const diasRemuneradosPonto = Math.min(diasPagos, diasElegiveisPonto);
                salarioProporcional = valorDiaSalario * diasRemuneradosPonto;
                diasPagosExibir = diasRemuneradosPonto;
            }
            valorHoraDesconto = valorDiaSalario / horasBaseDescontoPorDia;
            const valorBaseFeriasMes = valorDiaMensalClt * diasFeriasNoMes;
            const valorFeriasClt = feriasInicioIso && diasFeriasNoMes > 0 ? valorBaseFeriasMes * (4 / 3) : 0;
            const valorDescontoHorasCalc = horasFaltantes * valorHoraDesconto;
            const opcoesFolha = lerFolhaOpcoesCalculo();
            const valorExtrasFolha = opcoesFolha.incluirExtras ? valorTotalReceberExtras : 0;
            const valorDescontoHorasFolha = opcoesFolha.incluirDescontoHoras ? valorDescontoHorasCalc : 0;

            const dsrCalc = calcularDsrPerdidosPorFaltas(
                datasFaltasComDsrIso, anoNum, mesNum, diasNoMesCalc, admIso, demIso
            );
            const dsrPerdidos = dsrCalc.dsrPerdidos;
            const valorDescontoFaltasLinha = valorDiaSalario * faltasInjustificadas;
            const valorDescontoDsr = valorDiaSalario * dsrPerdidos;
            let salarioBrutoPeriodoMensal = 0;

            if (tipoRemuneracao === 'mensal') {
                // Base do salário do mês = dias úteis + descansos + faltas (reincorporadas).
                // As faltas e o DSR perdido são descontados UMA única vez no líquido; por isso
                // NÃO podem reduzir o salário aqui também (senão o desconto seria em dobro:
                // uma vez no proporcional/base e outra no líquido).
                const diasBaseSalarioMensal = diasPagos + diasDescansoIncluidosRef + faltasInjustificadas;
                diasPagosExibir = Math.max(0, mesCheio ? Math.min(diasNoMesCalc, diasBaseSalarioMensal) : diasBaseSalarioMensal);
                salarioBrutoPeriodoMensal = valorDiaSalario * diasBaseSalarioMensal;
                salarioProporcional = salarioBrutoPeriodoMensal;
                if (mesCheio) {
                    salarioProporcional = Math.min(salarioBase, salarioProporcional);
                }
                salarioProporcional = Math.max(0, salarioProporcional);
            }

            if (deveInssAuto && !jaTemInssLancado) {
                // Base do INSS: salário do período + férias/1/3 + extras incluídas na folha.
                // O cálculo só pode ocorrer depois que a base salarial final do mês já estiver definida.
                const baseInss = Math.max(0, (salarioProporcional || 0) + (valorFeriasClt || 0) + (valorExtrasFolha || 0));
                inssAutoValor = calcularInssEmpregado2026(baseInss);
                if (inssAutoValor > 0) {
                    totalDescontosLancados += inssAutoValor;
                    itensDescontosFolha.push({
                        id: 'auto_inss',
                        tipo_desconto: 'INSS',
                        observacao: 'Automático (tabela INSS 2026)',
                        valor: inssAutoValor,
                        valor_fmt: formatarMoeda(inssAutoValor)
                    });
                    itensDescontosFolha.sort((a, b) => String(a.tipo_desconto).localeCompare(String(b.tipo_desconto), 'pt-BR'));
                }
            }

            const descontoFaltasNoLiquido = (tipoRemuneracao === 'mensal' && faltasInjustificadas > 0)
                ? valorDescontoFaltasLinha
                : 0;
            const descontoDsrNoLiquido = (tipoRemuneracao === 'mensal' && dsrPerdidos > 0)
                ? valorDescontoDsr
                : (tipoRemuneracao === 'ponto' ? valorDescontoDsr : 0);

            // Banco de horas (saldo): crédito - débito (atrasos)
            const bancoHorasSaldoDecimais = (bancoHorasCreditoDecimais || 0) - (horasFaltantes || 0);

            // --- LOG PARA DEBUG (Aperte F12 no navegador para ver esses valores) ---
            console.log("=== RESUMO CÁLCULO ===");
            console.log("Hora desconto (salário/30/8):", valorHoraDesconto.toFixed(4));
            console.log("Hora normal 220h:", valorHoraNormal220.toFixed(4));
            console.log("Horas faltantes (soma dia a dia):", horasFaltantes.toFixed(2));
            console.log("Dias úteis com ponto:", diasPagos);
            console.log("Descansos incluídos (CLT até hoje):", diasDescansoIncluidosRef);
            console.log("DSR perdidos:", dsrPerdidos);
            console.log("Dias referência exibir:", diasPagosExibir);
            console.log("Salário bruto período:", salarioBrutoPeriodoMensal.toFixed(2));
            console.log("Desconto faltas no líquido:", descontoFaltasNoLiquido);
            console.log("Desconto DSR no líquido:", descontoDsrNoLiquido);
            console.log("Salário proporcional (dias referência):", salarioProporcional.toFixed(2));
            console.log("Salário Base:", salarioBase);
            console.log("Total Extras (calc):", valorTotalReceberExtras, "| no líquido:", valorExtrasFolha);
            console.log("Desconto horas (calc):", valorDescontoHorasCalc, "| no líquido:", valorDescontoHorasFolha);
            console.log("Opções folha:", opcoesFolha);
            console.log("Total Vales Dinheiro:", totalDinheiro);
            console.log("Total Vales Produto:", totalProduto);

            // 3. CÁLCULO DO LÍQUIDO — valor real do fechamento (pode ser negativo se vales/atrasos excederem créditos)
            const liquidoReceber =
                (salarioProporcional + valorFeriasClt + valorExtrasFolha) -
                (totalDinheiro + totalProduto + valorDescontoHorasFolha + descontoFaltasNoLiquido + descontoDsrNoLiquido + totalDescontosLancados);

            document.getElementById('f-nome-display').innerText = funcionario.nome;
            const mesNomeCal = nomeMeses[mesSelected] || mesSelected;
            document.getElementById('f-periodo-display').innerText =
                `Referência: ${mesNomeCal} / ${anoSelected} (${diasNoMesCalc} dias no calendário)`;

            document.getElementById('f-salario-mensal-contrato').innerText = formatarMoeda(salarioBase);

            const elLabelValorDia = document.getElementById('f-label-valor-dia');
            if (elLabelValorDia) {
                elLabelValorDia.innerText = tipoRemuneracao === 'mensal'
                    ? 'Valor de 1 dia (salário ÷ 30):'
                    : ('Valor de 1 dia (salário ÷ ' + (diasDevidosNoMes > 0 ? diasDevidosNoMes : diasMesParaSalario) + ' dias a trabalhar):');
            }
            document.getElementById('f-valor-dia-salario').innerText = formatarMoeda(valorDiaSalario);

            const elLinhaDevidos = document.getElementById('f-linha-dias-devidos');
            const elDiasDevidos = document.getElementById('f-dias-devidos');
            if (elLinhaDevidos && elDiasDevidos) {
                if (tipoRemuneracao === 'ponto') {
                    elLinhaDevidos.style.display = 'flex';
                    elDiasDevidos.innerText = String(diasDevidosNoMes);
                } else {
                    elLinhaDevidos.style.display = 'none';
                }
            }

            const elLabelDias = document.getElementById('f-label-dias-pagos');
            const elLinhaDiasCal = document.getElementById('f-linha-dias-calendario');
            if (elLinhaDiasCal) {
                elLinhaDiasCal.style.display = tipoRemuneracao === 'mensal' ? 'flex' : 'none';
            }
            if (elLabelDias) {
                elLabelDias.innerText = tipoRemuneracao === 'mensal'
                    ? 'Dias base do salário (úteis + descansos + faltas):'
                    : 'Dias trabalhados (com batida de ponto):';
            }
            document.getElementById('f-dias-pagos').innerText = String(diasPagosExibir);
            const elDiasCal = document.getElementById('f-dias-calendario-mes');
            if (elDiasCal) {
                elDiasCal.innerText = String(diasNoMesCalc);
            }

            const elLinhaFaltas = document.getElementById('f-linha-faltas-mensal');
            const elFaltas = document.getElementById('f-faltas-mensal');
            if (elLinhaFaltas && elFaltas) {
                elLinhaFaltas.style.display = faltasInjustificadas > 0 ? 'flex' : 'none';
                elFaltas.innerText = String(faltasInjustificadas);
            }
            const elLabelFaltas = document.querySelector('#f-linha-faltas-mensal span');
            if (elLabelFaltas) {
                elLabelFaltas.innerText = tipoRemuneracao === 'mensal'
                    ? 'Faltas (desconto 1 dia cada, ÷ 30):'
                    : 'Faltas sem ponto (desconto 1 dia cada):';
            }
            const elTipoRem = document.getElementById('f-tipo-remuneracao-display');
            if (elTipoRem) elTipoRem.innerText = labelTipoRemuneracao(tipoRemuneracao);

            document.getElementById('f-salario-base').innerText = formatarMoeda(salarioProporcional);
            const detSal = document.getElementById('f-detalhe-salario-proporcional');
            if (detSal) {
                if (tipoRemuneracao === 'mensal') {
                    if (mesCheio) {
                        detSal.innerHTML = `<b>Modo mensal CLT</b> — salário contrato ${formatarMoeda(salarioBase)} (÷ 30 = ${formatarMoeda(valorDiaSalario)}/dia).<br>
                        <b>(+) Salário integral:</b> ${diasPagosExibir} dia(s) × ${formatarMoeda(valorDiaSalario)} = <b>${formatarMoeda(salarioProporcional)}</b><br>
                        <span style="color:#666;">Composição: ${diasPagos} útil(is) c/ ponto + ${diasDescansoIncluidosRef} descanso(s) + ${faltasInjustificadas} falta(s) (reincorporadas na base).</span><br>
                        <b>(−) Descontado só uma vez no líquido:</b> faltas ${formatarMoeda(valorDescontoFaltasLinha)} (${faltasInjustificadas} dia(s)) + DSR ${formatarMoeda(valorDescontoDsr)} (${dsrPerdidos} descanso(s)).`;
                    } else {
                        detSal.innerHTML = `<b>Modo mensal CLT</b> — mês parcial (admissão/desligamento).<br>
                        <b>(+) Salário do período:</b> ${diasPagosExibir} dia(s) × ${formatarMoeda(valorDiaSalario)} = <b>${formatarMoeda(salarioProporcional)}</b>.<br>
                        <b>(−) Descontado só uma vez no líquido:</b> faltas ${formatarMoeda(valorDescontoFaltasLinha)} + DSR ${formatarMoeda(valorDescontoDsr)}.`;
                    }
                } else {
                    const divP = diasDevidosNoMes > 0 ? diasDevidosNoMes : diasMesParaSalario;
                    detSal.innerHTML = `<b>Modo por ponto</b> — salário ÷ <b>${divP}</b> dias a trabalhar no mês.<br>
                        <b>Conta:</b> ${formatarMoeda(salarioBase)} ÷ ${divP} = ${formatarMoeda(valorDiaSalario)}/dia` +
                        (faltasInjustificadas > 0
                            ? ` × ${divP} dias devidos − ${faltasInjustificadas} falta(s) × ${formatarMoeda(valorDiaSalario)} = <b>${formatarMoeda(salarioProporcional)}</b>.`
                            : ` × ${diasPagosExibir} dia(s) com ponto = <b>${formatarMoeda(salarioProporcional)}</b>.`) +
                        `<br><span style="color:#888;">Dia útil ou sábado de escala <b>sem batida</b> = falta (desconto de 1 dia). Domingo/feriado não entram no proporcional.</span>`;
                }
            }

            if (document.getElementById('f-dias-ferias-mes')) {
                document.getElementById('f-dias-ferias-mes').innerText = String(diasFeriasNoMes);
            }
            if (document.getElementById('f-valor-ferias-clt')) {
                document.getElementById('f-valor-ferias-clt').innerText = formatarMoeda(valorFeriasClt);
            }
            const detFer = document.getElementById('f-detalhe-ferias-clt');
            if (detFer) {
                if (feriasInicioIso && diasFeriasNoMes > 0) {
                    const fimFeriasIso = (function () {
                        const ini = isoParaDateLocal(feriasInicioIso);
                        if (!ini) return feriasInicioIso;
                        const f = new Date(ini.getTime());
                        f.setDate(f.getDate() + Math.min(30, Math.max(1, feriasDiasCad)) - 1);
                        return `${f.getFullYear()}-${pad2(f.getMonth() + 1)}-${pad2(f.getDate())}`;
                    })();
                    detFer.innerHTML = `<b>CLT:</b> remuneração de férias = salário proporcional ao gozo + <b>1/3 constitucional</b> sobre esse valor.<br>
                    <b>Conta:</b> ${diasFeriasNoMes} dia(s) × ${formatarMoeda(valorDiaSalario)} × 4/3 = <b>${formatarMoeda(valorFeriasClt)}</b>.<br>
                    <span style="color:#888;">Período cadastrado: ${formatarDataBrDeIso(feriasInicioIso)} a ${formatarDataBrDeIso(fimFeriasIso)} (${feriasDiasCad} dias de gozo). Pagamento deve ocorrer até 2 dias antes do início das férias (art. 145 CLT).</span>`;
                } else {
                    detFer.innerHTML = '<span style="color:#888;">Sem início de férias cadastrado neste mês, ou nenhum dia de gozo no período calculado. Cadastre em Editar funcionário → Início das férias.</span>';
                }
            }

            const h50 = Math.floor(totalHorasExtras50Decimais);
            const m50 = Math.round((totalHorasExtras50Decimais - h50) * 60);
            const h100 = Math.floor(totalHorasExtras100Decimais);
            const m100 = Math.round((totalHorasExtras100Decimais - h100) * 60);
            const sufixoExtrasLiq = opcoesFolha.incluirExtras ? '' : ' — não incluído no líquido';
            document.getElementById('f-horas-extras-texto').innerText =
                `(+) Horas extras (${h50}h ${m50}m úteis +50% · ${h100}h ${m100}m dom/fer +100%)${sufixoExtrasLiq}:`;
            document.getElementById('f-valor-extras').innerText = formatarMoeda(valorExtrasFolha);
            const detEx = document.getElementById('f-detalhe-extras');
            if (detEx) {
                const v50 = totalHorasExtras50Decimais * (valorHoraNormal220 * 1.5);
                const v100 = totalHorasExtras100Decimais * (valorHoraNormal220 * 2.0);
                let htmlEx = `<b>Base da hora extra:</b> salário ÷ 220 = <b>${formatarMoeda(valorHoraNormal220)}/h</b>.<br>
                • Dia útil (+50%): ${h50}h ${m50}m → ${formatarMoeda(v50)}<br>
                • Domingo/feriado (+100%): ${h100}h ${m100}m → ${formatarMoeda(v100)}<br>
                <b>Total calculado:</b> ${formatarMoeda(valorTotalReceberExtras)}`;
                if (!opcoesFolha.incluirExtras) {
                    htmlEx += `<br><span style="color:#856404;background:#fff3cd;padding:4px 8px;border-radius:6px;display:inline-block;margin-top:4px;">Opção desmarcada: extras <b>não entram</b> no líquido (use banco de horas ou acerto à parte).</span>`;
                } else {
                    htmlEx += `<br><span style="color:#888;">Domingo e feriados cadastrados no calendário entram como +100% (paga como 2× a hora normal).</span>`;
                }
                detEx.innerHTML = htmlEx;
            }

            const bancoAbs = Math.abs(bancoHorasSaldoDecimais);
            const bancoH = Math.floor(bancoAbs);
            const bancoM = Math.round((bancoAbs - bancoH) * 60);
            const sinalBanco = bancoHorasSaldoDecimais >= 0 ? '+' : '-';
            if (document.getElementById('f-banco-horas-texto')) {
                document.getElementById('f-banco-horas-texto').innerText = `(=) Banco de horas (saldo ${sinalBanco}${bancoH}h ${bancoM}m):`;
            }
            if (document.getElementById('f-banco-horas')) {
                document.getElementById('f-banco-horas').innerText = `${sinalBanco}${bancoH}h ${bancoM}m`;
            }
            const detBk = document.getElementById('f-detalhe-banco-horas');
            if (detBk) {
                const credH = Math.floor(bancoHorasCreditoDecimais || 0);
                const credM = Math.round(((bancoHorasCreditoDecimais || 0) - credH) * 60);
                const debH = Math.floor(horasFaltantes || 0);
                const debM = Math.round(((horasFaltantes || 0) - debH) * 60);
                detBk.innerHTML = `<b>Crédito</b> (trabalho em domingo/feriado ou dia fora da escala): <b>${credH}h ${credM}m</b> &nbsp;|&nbsp;
                <b>Débito</b> (horas que faltaram nos dias pagos): <b>${debH}h ${debM}m</b><br>
                <span style="color:#888;"><b>Saldo</b> = crédito − débito. Este saldo é informativo; o desconto em R$ vem só dos atrasos (linha abaixo).</span>`;
            }
            
            const nAjuda = itensAjudaCusto.length;
            if (document.getElementById('f-ajuda-custo-texto')) {
                document.getElementById('f-ajuda-custo-texto').innerText =
                    `🧳 Ajuda de custo — PLUS (${nAjuda} lançamento${nAjuda === 1 ? '' : 's'}):`;
            }
            if (document.getElementById('f-valor-ajuda-custo')) {
                document.getElementById('f-valor-ajuda-custo').innerText = formatarMoeda(totalAjudaCusto);
            }
            const detAj = document.getElementById('f-detalhe-ajuda-custo');
            if (detAj) {
                if (nAjuda > 0) {
                    detAj.innerHTML =
                        '<span class="linha-plus"><b>Total PLUS:</b> ' + formatarMoeda(totalAjudaCusto) + ' — lançamentos com data em ' + mesSelected + '/' + anoSelected + '.</span>' +
                        '<span class="linha-plus" style="color:#0d6efd;"><b>Não entra no líquido.</b> Pague este valor à parte do fechamento salarial (ajuda de custo / reembolso).</span>';
                } else {
                    detAj.innerHTML = '<span class="linha-plus" style="color:#888;">Nenhuma ajuda de custo neste mês. O líquido acima não inclui PLUS.</span>';
                }
            }
            const tabAj = document.getElementById('f-tabela-ajuda-custo');
            if (tabAj) {
                if (nAjuda > 0) {
                    tabAj.innerHTML = `
                        <table style="width:100%;border-collapse:collapse;">
                            <thead><tr style="background:#eef2f5;">
                                <th style="text-align:left;padding:6px;">Data</th>
                                <th style="text-align:left;padding:6px;">Valor</th>
                                <th style="text-align:left;padding:6px;">Discriminação</th>
                            </tr></thead>
                            <tbody>${itensAjudaCusto.map(it => `
                                <tr style="border-bottom:1px solid #eee;">
                                    <td style="padding:6px;white-space:nowrap;">${escapeHtmlBasico(it.data)}</td>
                                    <td style="padding:6px;">R$ ${escapeHtmlBasico(it.valor_fmt)}</td>
                                    <td style="padding:6px;">${escapeHtmlBasico(it.discriminacao)}</td>
                                </tr>`).join('')}</tbody>
                        </table>`;
                } else {
                    tabAj.innerHTML = '<p style="padding:8px;color:#888;margin:0;">Sem lançamentos.</p>';
                }
            }

            document.getElementById('f-valor-vales').innerText = formatarMoeda(totalDinheiro);
            document.getElementById('f-valor-produtos').innerText = formatarMoeda(totalProduto);
            const detVales = document.getElementById('f-detalhe-vales');
            if (detVales) {
                if (itensValesFolha.length) {
                    const linhas = itensValesFolha.map(function (it) {
                        const origem = it.manual ? 'papel / manual' : 'assinado no celular';
                        const desc = it.descricao ? ' — ' + escapeHtmlBasico(it.descricao) : '';
                        const hora = it.hora ? ' ' + escapeHtmlBasico(it.hora) : '';
                        const btnExcluir = (it.manual && it.id)
                            ? ' <button type="button" class="btn-excluir-vale-folha" onclick="excluirValeManualDaFolha(\'' + String(it.id).replace(/'/g, '') + '\')" style="margin-left:6px;background:#d9534f;color:#fff;border:none;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;cursor:pointer;">Excluir</button>'
                            : '';
                        return '<div>' + escapeHtmlBasico(it.data || '') + hora + ' · ' + escapeHtmlBasico(it.tipo || '') + ' · ' + escapeHtmlBasico(formatarMoeda(it.valor)) + ' <span style="color:#888;">(' + origem + ')</span>' + desc + btnExcluir + '</div>';
                    }).join('');
                    detVales.innerHTML = linhas + '<div style="margin-top:6px;">Pendentes só com link, sem assinar, <b>não descontam</b>. Vales manuais podem ser excluídos aqui.</div>';
                } else {
                    detVales.innerHTML = 'Nenhum vale confirmado neste mês. Vale só com link, sem assinar, <b>não desconta</b>. Use o bloco amarelo <b>Vale sem celular</b> acima para lançar e imprimir.';
                }
                if (typeof window.listarValesManuaisDaFolha === 'function') {
                    window.listarValesManuaisDaFolha();
                }
            }

            const elLinhaDf = document.getElementById('f-linha-desconto-faltas');
            const elLinhaDsr = document.getElementById('f-linha-desconto-dsr');
            if (elLinhaDf) {
                elLinhaDf.style.display = faltasInjustificadas > 0 ? 'flex' : 'none';
                const elTxt = document.getElementById('f-desconto-faltas-texto');
                const elVal = document.getElementById('f-valor-desconto-faltas');
                if (elTxt) elTxt.innerText = `(-) Faltas injustificadas (${faltasInjustificadas} dia${faltasInjustificadas === 1 ? '' : 's'}):`;
                if (elVal) elVal.innerText = formatarMoeda(valorDescontoFaltasLinha);
            }
            const detDf = document.getElementById('f-detalhe-desconto-faltas');
            if (detDf) {
                if (faltasInjustificadas > 0) {
                    const datasTxt = datasFaltasInjustificadasIso.map(isoParaDataBr).join(', ');
                    const faltasSemDsrTxt = datasFaltasInjustificadasIso
                        .filter(function (iso) {
                            const ev = faltasRhInjust.get(iso);
                            return faltasRhInjust.has(iso) && ev && ev.descontarDsr === false;
                        })
                        .map(isoParaDataBr)
                        .join(', ');
                    detDf.innerHTML = `<b>Desconto por falta:</b> ${faltasInjustificadas} × ${formatarMoeda(valorDiaSalario)}/dia = <b>${formatarMoeda(valorDescontoFaltasLinha)}</b> (descontado no líquido).` +
                        (datasTxt ? `<br><span style="color:#666;">Datas: ${datasTxt}. Pode marcar/alterar em <b>Ponto → Falta injustificada / atestado (RH)</b>.</span>` : '') +
                        (faltasSemDsrTxt ? `<br><span style="color:#856404;">Sem desconto de DSR (opção RH): ${faltasSemDsrTxt}.</span>` : '');
                } else {
                    detDf.innerHTML = '';
                }
            }
            if (elLinhaDsr) {
                elLinhaDsr.style.display = dsrPerdidos > 0 ? 'flex' : 'none';
                const elTxtD = document.getElementById('f-desconto-dsr-texto');
                const elValD = document.getElementById('f-valor-desconto-dsr');
                if (elTxtD) elTxtD.innerText = `(-) DSR perdido (${dsrPerdidos} descanso${dsrPerdidos === 1 ? '' : 's'}):`;
                if (elValD) elValD.innerText = formatarMoeda(valorDescontoDsr);
            }
            const detDsr = document.getElementById('f-detalhe-desconto-dsr');
            if (detDsr) {
                if (dsrPerdidos > 0) {
                    const doms = (dsrCalc.domingosPerdidos || []).map(function (x) { return x.dataBr; }).join(', ');
                    detDsr.innerHTML = `<b>Descanso semanal remunerado (CLT):</b> falta injustificada na semana → perde 1 DSR (${formatarMoeda(valorDiaSalario)}/descanso) — descontado no líquido.` +
                        `<br><b>Domingos descontados neste mês:</b> ${doms || '—'}.`;
                } else {
                    const faltasSemDsrCount = datasFaltasInjustificadasIso.length - datasFaltasComDsrIso.length;
                    detDsr.innerHTML = faltasInjustificadas > 0
                        ? '<span style="color:#888;">Nenhum DSR descontado neste mês' +
                            (faltasSemDsrCount > 0 ? ' (RH optou por não descontar DSR em ' + faltasSemDsrCount + ' falta(s)).' : ' (semana sem domingo no período ou sem falta com DSR).') +
                            '</span>'
                        : '';
                }
            }

            const horasFaltDisplay = Math.floor(horasFaltantes);
            const minFaltDisplay = Math.round((horasFaltantes - horasFaltDisplay) * 60);
            const sufixoDescLiq = opcoesFolha.incluirDescontoHoras ? '' : ' — não incluído no líquido';
            document.getElementById('f-desconto-horas-texto').innerText =
                `(-) Atrasos / horas devidas (${horasFaltDisplay}h ${minFaltDisplay}m)${sufixoDescLiq}:`;
            document.getElementById('f-valor-desconto-horas').innerText = formatarMoeda(valorDescontoHorasFolha);
            const detAtr = document.getElementById('f-detalhe-desconto-atrasos');
            if (detAtr) {
                let htmlAtr = `<b>Hora de desconto (atraso):</b> (salário ÷ 30 ÷ 8) = <b>${formatarMoeda(valorHoraDesconto)}/h</b>.<br>
                <b>Conta:</b> ${horasFaltDisplay}h ${minFaltDisplay}m × ${formatarMoeda(valorHoraDesconto)}/h = <b>${formatarMoeda(valorDescontoHorasCalc)}</b>.`;
                if (!opcoesFolha.incluirDescontoHoras) {
                    htmlAtr += `<br><span style="color:#856404;background:#fff3cd;padding:4px 8px;border-radius:6px;display:inline-block;margin-top:4px;">Opção desmarcada: desconto por atrasos <b>não reduz</b> o líquido neste fechamento.</span>`;
                } else {
                    htmlAtr += `<br><span style="color:#888;">São somadas, dia a dia, as horas que faltaram para completar a jornada esperada em cada dia em que houve trabalho.</span>`;
                }
                detAtr.innerHTML = htmlAtr;
            }

            const nDescLanc = itensDescontosFolha.length;
            const blocoDesc = document.getElementById('f-bloco-descontos-lancados');
            const detDescLanc = document.getElementById('f-detalhe-descontos-lancados');
            if (blocoDesc) {
                if (nDescLanc > 0) {
                    blocoDesc.innerHTML = itensDescontosFolha.map(it => `
                        <div class="folha-linha desconto">
                            <span>(−) ${escapeHtmlBasico(labelDescontoFolhaExibir(it))}:</span>
                            <strong>${formatarMoeda(it.valor)}</strong>
                        </div>`).join('');
                } else {
                    blocoDesc.innerHTML = '';
                }
            }
            if (detDescLanc) {
                if (nDescLanc > 0) {
                    detDescLanc.innerHTML = `<b>Descontos lançados pelo RH</b> (aba Descontos Folha) para ${mesSelected}/${anoSelected}: total <b>${formatarMoeda(totalDescontosLancados)}</b>. INSS, IRRF e demais tipos entram no líquido.`;
                } else {
                    detDescLanc.innerHTML = '<span style="color:#888;">Nenhum desconto lançado (INSS, etc.) neste mês. Use a aba "Descontos Folha" para incluir.</span>';
                }
            }
            
            const elValorLiq = document.getElementById('f-valor-liquido');
            const elLabelLiq = document.getElementById('f-label-liquido');
            if (elValorLiq) {
                elValorLiq.innerText = formatarMoeda(liquidoReceber);
                elValorLiq.style.color = liquidoReceber < 0 ? '#c0392b' : '#28a745';
            }
            if (elLabelLiq) {
                elLabelLiq.innerText =
                    liquidoReceber < 0 ? 'SALDO DO FECHAMENTO (negativo):' : 'LÍQUIDO A RECEBER:';
            }
            const detLiq = document.getElementById('f-formula-liquido');
            if (detLiq) {
                const lblExtrasForm = opcoesFolha.incluirExtras
                    ? formatarMoeda(valorExtrasFolha) + ' (extras)'
                    : '0,00 (extras — opção desligada; calc. ' + formatarMoeda(valorTotalReceberExtras) + ')';
                const lblAtrasosForm = opcoesFolha.incluirDescontoHoras
                    ? formatarMoeda(valorDescontoHorasFolha) + ' (atrasos)'
                    : '0,00 (atrasos — opção desligada; calc. ' + formatarMoeda(valorDescontoHorasCalc) + ')';
                const lblDsrForm = dsrPerdidos > 0 ? formatarMoeda(valorDescontoDsr) + ' (DSR ' + dsrPerdidos + '×)' : '0,00 (DSR)';
                const lblFaltasForm = faltasInjustificadas > 0
                    ? formatarMoeda(valorDescontoFaltasLinha) + ' (faltas ' + faltasInjustificadas + '×)'
                    : '0,00 (faltas)';
                const subFaltas = (tipoRemuneracao === 'mensal' && faltasInjustificadas > 0) ? (' − ' + lblFaltasForm) : '';
                const subDsr = dsrPerdidos > 0 ? (' − ' + lblDsrForm) : '';
                let txtForm = `<b>Fórmula do líquido:</b><br>
                ${formatarMoeda(salarioProporcional)} (salário integral) + ${formatarMoeda(valorFeriasClt)} (férias CLT) + ${lblExtrasForm}
                − ${formatarMoeda(totalDinheiro)} (vales) − ${formatarMoeda(totalProduto)} (produtos)${subFaltas}${subDsr} − ${lblAtrasosForm}${totalDescontosLancados > 0 ? ' − ' + formatarMoeda(totalDescontosLancados) + ' (INSS/outros)' : ''}
                = <b>${formatarMoeda(liquidoReceber)}</b>`;
                if (nAjuda > 0) {
                    txtForm += `<br><br><span style="color:#0d6efd;"><b>Recebimento PLUS (fora do líquido):</b> Ajuda de custo ${formatarMoeda(totalAjudaCusto)} — pago à parte, sem somar nem descontar do valor acima.</span>`;
                }
                if (liquidoReceber < 0) {
                    txtForm +=
                        `<br><span style="color:#922b21;font-size:12px;">Saldo negativo: neste fechamento, descontos e vales somam mais do que o proporcional + extras. Na prática não há valor a pagar ao colaborador nesta vista — reveja vales, batidas ou proporcional.</span>`;
                }
                detLiq.innerHTML = txtForm;
            }

            const tabDisc = document.getElementById('f-tabela-discriminacao');
            if (tabDisc && Array.isArray(discriminacaoDias)) {
                const linhas = discriminacaoDias.map((r) => `
                    <tr style="border-bottom:1px solid #eee;">
                        <td style="padding:8px 6px; white-space:nowrap; font-weight:600;">${r.keyDia}</td>
                        <td style="padding:8px 6px;">${r.nomeSemana}</td>
                        <td style="padding:8px 6px; font-size:10px;">${r.tipoDia}</td>
                        <td style="padding:8px 6px; font-size:10px; max-width:140px;">${r.esperadoTxt}</td>
                        <td style="padding:8px 6px;">${r.trabalhadoTxt}</td>
                        <td style="padding:8px 6px; font-weight:700;">${r.diferencaTxt}</td>
                        <td style="padding:8px 6px;">${r.diaPagoTxt}</td>
                        <td style="padding:8px 6px; font-size:10px; color:#444;">${r.situacao}</td>
                    </tr>
                `).join('');
                tabDisc.innerHTML = `
                    <table style="width:100%; border-collapse:collapse; font-size:11px;">
                        <thead>
                            <tr style="background:#eef2f5; position:sticky; top:0; z-index:1;">
                                <th style="text-align:left; padding:8px 6px;">Data</th>
                                <th style="text-align:left; padding:8px 6px;">Dia</th>
                                <th style="text-align:left; padding:8px 6px;">Tipo</th>
                                <th style="text-align:left; padding:8px 6px;">Jornada esperada</th>
                                <th style="text-align:left; padding:8px 6px;">Horas no ponto</th>
                                <th style="text-align:left; padding:8px 6px;">Dif. (esp. − trab.)</th>
                                <th style="text-align:left; padding:8px 6px;">Dia pago?</th>
                                <th style="text-align:left; padding:8px 6px;">Observação</th>
                            </tr>
                        </thead>
                        <tbody>${linhas}</tbody>
                    </table>
                `;
                window.folhaDiscriminacaoPDF = {
                    empresaNome: getEmpresaGestor() || 'Empresa',
                    funcionarioNome: funcionario.nome,
                    mesRef: `${String(mesSelected).padStart(2, '0')}/${anoSelected}`,
                    emitidoEm: new Date().toLocaleString('pt-BR'),
                    diasPagos: diasPagosExibir,
                    salarioProporcionalFmt: formatarMoeda(salarioProporcional),
                    liquidoFmt: formatarMoeda(liquidoReceber),
                    linhas: discriminacaoDias
                };
            } else {
                window.folhaDiscriminacaoPDF = null;
            }

            const mesNomeRef = nomeMeses[mesSelected] || mesSelected;
            const diasBrutoProporcionalMensal = tipoRemuneracao === 'mensal'
                ? (diasPagos + diasDescansoIncluidosRef + faltasInjustificadas)
                : 0;
            const labelSalProp = tipoRemuneracao === 'mensal'
                ? ('Salário mensal CLT (' + diasPagosExibir + ' dias × ' + formatarMoeda(valorDiaSalario) + ')')
                : ('Salário por ponto (' + diasPagosExibir + ' dias × ' + formatarMoeda(valorDiaSalario) + ')');
            const usarSalarioBrutoHolerite = tipoRemuneracao === 'ponto';
            let valorProventoSalarioPdf = salarioProporcional;
            if (tipoRemuneracao === 'ponto') {
                const divP = diasDevidosNoMes > 0 ? diasDevidosNoMes : diasMesParaSalario;
                valorProventoSalarioPdf = valorDiaSalario * divP;
            }
            const proventosPdf = [
                { label: usarSalarioBrutoHolerite ? 'Salário por ponto (dias devidos)' : labelSalProp, valor: usarSalarioBrutoHolerite ? valorProventoSalarioPdf : salarioProporcional },
                { label: 'Férias + 1/3 constitucional (' + diasFeriasNoMes + ' dias)', valor: valorFeriasClt },
                {
                    label: 'Horas extras (' + h50 + 'h ' + m50 + 'm +50% · ' + h100 + 'h ' + m100 + 'm +100%)',
                    valor: valorExtrasFolha,
                    valorCalculado: valorTotalReceberExtras
                }
            ];
            const descontosPdf = [];
            if (faltasInjustificadas > 0 && tipoRemuneracao === 'mensal') {
                descontosPdf.push({
                    label: 'Faltas injustificadas (' + faltasInjustificadas + ' dia' + (faltasInjustificadas === 1 ? '' : 's') + ')',
                    valor: valorDescontoFaltasLinha
                });
            }
            if (faltasInjustificadas > 0 && usarSalarioBrutoHolerite) {
                descontosPdf.push({
                    label: 'Faltas injustificadas (' + faltasInjustificadas + ' dia' + (faltasInjustificadas === 1 ? '' : 's') + ')',
                    valor: valorDescontoFaltasLinha
                });
            }
            if (dsrPerdidos > 0 && (tipoRemuneracao === 'mensal' || tipoRemuneracao === 'ponto')) {
                descontosPdf.push({
                    label: 'DSR perdido (' + dsrPerdidos + ' descanso' + (dsrPerdidos === 1 ? '' : 's') + ')',
                    valor: valorDescontoDsr
                });
            }
            descontosPdf.push(
                { label: 'Vales / adiantamentos', valor: totalDinheiro },
                { label: 'Produtos / materiais', valor: totalProduto },
                {
                    label: 'Atrasos / horas devidas (' + horasFaltDisplay + 'h ' + minFaltDisplay + 'm)',
                    valor: valorDescontoHorasFolha,
                    valorCalculado: valorDescontoHorasCalc
                }
            );
            itensDescontosFolha.forEach(it => {
                descontosPdf.push({
                    label: labelDescontoFolhaExibir(it),
                    valor: it.valor
                });
            });

            window.folhaHoleritePDF = {
                empresaNome: getEmpresaGestor() || 'Empresa',
                funcionarioNome: funcionario.nome,
                cpf: funcionario.cpf || '',
                pix: funcionario.pix || '',
                horario: (horaEntPadrão || '—') + ' às ' + (horaSaiPadrão || '—') + ' (alm. ' + (intervaloMinutosPadrao ?? 60) + ' min)',
                mesRef: mesNomeRef + ' / ' + anoSelected,
                mesAnoRef: String(mesSelected).padStart(2, '0') + '/' + anoSelected,
                emitidoEm: new Date().toLocaleString('pt-BR'),
                salarioContrato: salarioBase,
                valorDia: valorDiaSalario,
                diasPagos: diasPagosExibir,
                proventos: proventosPdf,
                descontos: descontosPdf,
                totalProventos: (usarSalarioBrutoHolerite ? valorProventoSalarioPdf : salarioProporcional) + valorFeriasClt + valorExtrasFolha,
                totalDescontos: descontoFaltasNoLiquido + descontoDsrNoLiquido + totalDinheiro + totalProduto + valorDescontoHorasFolha + totalDescontosLancados,
                liquido: liquidoReceber,
                liquidoNegativo: liquidoReceber < 0,
                opcoesFolha: opcoesFolha,
                extrasCalculado: valorTotalReceberExtras,
                descontoHorasCalculado: valorDescontoHorasCalc,
                bancoHorasTxt: (typeof sinalBanco !== 'undefined' ? sinalBanco : '') + bancoH + 'h ' + bancoM + 'm',
                ajudaCustoTotal: totalAjudaCusto,
                ajudaCustoItens: itensAjudaCusto.slice(),
                tipoRemuneracao: tipoRemuneracao,
                faltasMensal: faltasInjustificadas,
                dsrPerdidos: dsrPerdidos,
                valorDescontoFaltas: valorDescontoFaltasLinha,
                valorDescontoDsr: valorDescontoDsr
            };

            document.getElementById('resultado-folha').style.display = 'block';
            Swal.close();

        } catch (e) {
            console.error("Erro na folha:", e);
            Swal.fire('Erro', 'Ocorreu um erro ao calcular a folha de pagamento.', 'error');
        }
    };
       document.getElementById('btnCadastrarFunc').onclick = async function() {
        const nome = document.getElementById('c-nome').value.trim();
        const cpf = cpfParaComparacao(document.getElementById('c-cpf').value.trim());
        const salario = document.getElementById('c-salario').value.trim();
        const tel = document.getElementById('c-tel').value.trim();
        const pix = document.getElementById('c-pix') ? document.getElementById('c-pix').value.trim() : '';
        const entrada = document.getElementById('c-entrada').value;
        const saida = document.getElementById('c-saida').value;
        const intervaloMinutos = Number(document.getElementById('c-intervalo')?.value || 60);
        const sabadoHoras = Number(document.getElementById('c-sabado-horas')?.value || 0);
        const empresaLogada = getEmpresaGestor();
        const dataAdmissao = document.getElementById('c-data-admissao') ? document.getElementById('c-data-admissao').value : '';
        const dataDemissao = document.getElementById('c-data-demissao') ? document.getElementById('c-data-demissao').value : '';
        const dataInicioFerias = document.getElementById('c-data-inicio-ferias') ? document.getElementById('c-data-inicio-ferias').value : '';
        const feriasDiasCad = Number(document.getElementById('c-ferias-dias')?.value || 30);
        const tipoRemuneracaoCad = document.getElementById('c-tipo-remuneracao') ? document.getElementById('c-tipo-remuneracao').value : 'mensal';
       const descontarInss = Boolean(document.getElementById('c-descontar-inss') && document.getElementById('c-descontar-inss').checked);

        if (!nome || !cpf) {
            return Swal.fire('Atenção', 'Preencha pelo menos o Nome e o CPF!', 'warning');
        }
        if (cpf.length !== 11) {
            return Swal.fire('Atenção', 'CPF deve ter 11 dígitos (somente números).', 'warning');
        }

        const btn = document.getElementById('btnCadastrarFunc');
        btn.innerText = "⏳ A SALVAR...";
        btn.disabled = true;

        try {
            await addDoc(collection(db, "funcionarios"), {
                empresa_id: empresaLogada,
                nome: nome,
                cpf: cpf,
                salario: salario,
                tel: tel,
                pix: pix,
                hora_entrada: entrada,
                hora_saida: saida,
                intervalo_minutos: Number.isFinite(intervaloMinutos) ? intervaloMinutos : 60,
                sabado_horas: Number.isFinite(sabadoHoras) ? sabadoHoras : 0,
                data_admissao: dataAdmissao || null,
                data_demissao: dataDemissao || null,
                data_inicio_ferias: dataInicioFerias || null,
                ferias_dias: Number.isFinite(feriasDiasCad) ? Math.min(30, Math.max(1, feriasDiasCad)) : 30,
                tipo_remuneracao: normalizarTipoRemuneracao(tipoRemuneracaoCad),
                descontar_inss: descontarInss,
                senha: "" // Senha vazia para ele criar no 1º acesso
            });
            
            Swal.fire('Sucesso!', 'Funcionário cadastrado na equipa.', 'success');
            
            // Limpa os campos
            document.getElementById('c-nome').value = '';
            document.getElementById('c-cpf').value = '';
            document.getElementById('c-salario').value = '';
            document.getElementById('c-tel').value = '';
            if(document.getElementById('c-pix')) document.getElementById('c-pix').value = '';
            if(document.getElementById('c-intervalo')) document.getElementById('c-intervalo').value = '60';
            if(document.getElementById('c-sabado-horas')) document.getElementById('c-sabado-horas').value = '0';
            if (document.getElementById('c-data-admissao')) document.getElementById('c-data-admissao').value = '';
            if (document.getElementById('c-data-demissao')) document.getElementById('c-data-demissao').value = '';
            if (document.getElementById('c-data-inicio-ferias')) document.getElementById('c-data-inicio-ferias').value = '';
            if (document.getElementById('c-ferias-dias')) document.getElementById('c-ferias-dias').value = '30';
            if (document.getElementById('c-tipo-remuneracao')) document.getElementById('c-tipo-remuneracao').value = 'mensal';
            if (document.getElementById('c-descontar-inss')) document.getElementById('c-descontar-inss').checked = false;
            
            // Recarrega a lista na hora
            await carregarListaDeFuncionarios();
            irParaEquipeCadastrada();
            
        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Não foi possível cadastrar o funcionário.', 'error');
        } finally {
            btn.innerText = "SALVAR FUNCIONÁRIO";
            btn.disabled = false;
        }
    };

     window.editarFuncionario = function(id) {
        const func = window.listaFuncionarios[id];
        if (!func) return;

        function padHoraParaInput(t, padrao) {
            if (t == null || t === '') return padrao;
            const s = String(t).trim();
            const p = s.split(':');
            if (p.length < 2) return padrao;
            const h = Math.min(23, Math.max(0, parseInt(p[0], 10) || 0));
            const m = Math.min(59, Math.max(0, parseInt(p[1], 10) || 0));
            return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        }
        const entradaEdit = padHoraParaInput(func.hora_entrada, '07:00');
        const saidaEdit = padHoraParaInput(func.hora_saida, '17:00');
        const vAdm = escapeHtmlBasico(parseDataIsoFuncionario(func.data_admissao) || '');
        const vDem = escapeHtmlBasico(parseDataIsoFuncionario(func.data_demissao) || '');
        const vFer = escapeHtmlBasico(parseDataIsoFuncionario(func.data_inicio_ferias) || '');
        const vFerDias = escapeHtmlBasico(String(func.ferias_dias ?? 30));
        const tipoRemEdit = normalizarTipoRemuneracao(func.tipo_remuneracao);
        const descontarInssEdit = func.descontar_inss === true;

        Swal.fire({
            title: '✏️ Editar Funcionário',
            html: `
                <div style="text-align: left; font-size: 13px;">
                    <label style="margin-top: 10px;">Nome Completo:</label>
                    <input id="edit-f-nome" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${func.nome || ''}">
                    
                    <label style="margin-top: 10px;">Salário (R$):</label>
                    <input id="edit-f-salario" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${func.salario || ''}" oninput="mascaraMoeda(this)">
                    
                    <label style="margin-top: 10px;">Telefone:</label>
                    <input id="edit-f-tel" type="number" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${func.tel || ''}">
                    
                    <label style="margin-top: 10px;">Chave PIX:</label>
                    <input id="edit-f-pix" type="text" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${func.pix || ''}">

                    <p style="margin:14px 0 6px 0;font-weight:700;color:#1a2a43;border-bottom:1px solid #eee;padding-bottom:4px;">Jornada padrão (folha / discriminação)</p>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;">
                        <div style="flex:1;min-width:120px;">
                            <label>Horário de entrada</label>
                            <input id="edit-f-entrada" type="time" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${entradaEdit}">
                        </div>
                        <div style="flex:1;min-width:120px;">
                            <label>Horário de saída</label>
                            <input id="edit-f-saida" type="time" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${saidaEdit}">
                        </div>
                    </div>
                    <p style="font-size:11px;color:#666;margin:6px 0 0 0;">Altere aqui (ex.: 07:30) para atualizar o registro no sistema e o cálculo da jornada esperada na folha.</p>

                    <label style="margin-top: 10px;">Almoço / pausa não remunerada (minutos):</label>
                    <input id="edit-f-intervalo" type="number" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${(func.intervalo_minutos ?? 60)}" min="0" max="300" title="Descontado da faixa entrada–saída na jornada esperada.">
                    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
                        <button type="button" style="margin:0;padding:4px 10px;font-size:12px;background:#eef2f5;color:#1a2a43;border:1px solid #ccd6e0;border-radius:6px;cursor:pointer;" onclick="document.getElementById('edit-f-intervalo').value='30'">30 min</button>
                        <button type="button" style="margin:0;padding:4px 10px;font-size:12px;background:#eef2f5;color:#1a2a43;border:1px solid #ccd6e0;border-radius:6px;cursor:pointer;" onclick="document.getElementById('edit-f-intervalo').value='60'">1 h</button>
                        <button type="button" style="margin:0;padding:4px 10px;font-size:12px;background:#eef2f5;color:#1a2a43;border:1px solid #ccd6e0;border-radius:6px;cursor:pointer;" onclick="document.getElementById('edit-f-intervalo').value='90'">1 h 30</button>
                    </div>

                    <label style="margin-top: 10px;">Sábado (horas):</label>
                    <input id="edit-f-sabado-horas" type="number" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${(func.sabado_horas ?? 0)}" min="0" max="12" step="0.5">

                    <label style="margin-top: 10px;">Tipo de salário (folha)</label>
                    <select id="edit-f-tipo-remuneracao" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;">
                        <option value="mensal" ${tipoRemEdit === 'mensal' ? 'selected' : ''}>Mensal (CLT)</option>
                        <option value="ponto" ${tipoRemEdit === 'ponto' ? 'selected' : ''}>Por ponto</option>
                    </select>
                    <label style="display:flex;align-items:center;gap:10px;margin-top:10px;padding:10px;border:1px solid #e0e6ed;border-radius:10px;background:#fafcff;cursor:pointer;">
                        <input type="checkbox" id="edit-f-descontar-inss" style="width:18px;height:18px;" ${descontarInssEdit ? 'checked' : ''}>
                        <span style="font-size:13px;color:#333;">
                            <b>Descontar INSS automaticamente (CLT)</b><br>
                            <span style="font-size:12px;color:#666;">Tabela progressiva (competência 01/2026).</span>
                        </span>
                    </label>

                    <p style="margin:14px 0 6px 0;font-weight:700;color:#1a2a43;border-bottom:1px solid #eee;padding-bottom:4px;">Vínculo e férias</p>
                    <label style="margin-top: 8px;">Data de entrada (admissão)</label>
                    <input id="edit-f-admissao" type="date" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${vAdm}">
                    <label style="margin-top: 8px;">Data de saída (desligamento)</label>
                    <input id="edit-f-demissao" type="date" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${vDem}">
                    <label style="margin-top: 8px;">Início das férias</label>
                    <input id="edit-f-inicio-ferias" type="date" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${vFer}">
                    <label style="margin-top: 8px;">Dias de férias (CLT)</label>
                    <input id="edit-f-ferias-dias" type="number" class="swal2-input" style="margin: 0; width: 100%; height: 40px; font-size: 14px;" value="${vFerDias}" min="1" max="30" step="1">
                </div>
            `,
            showCancelButton: true,
            confirmButtonColor: '#1a2a43',
            cancelButtonColor: '#d9534f',
            confirmButtonText: 'SALVAR',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const fd = Number(document.getElementById('edit-f-ferias-dias').value || 30);
                return {
                    nome: document.getElementById('edit-f-nome').value.trim(),
                    salario: document.getElementById('edit-f-salario').value.trim(),
                    tel: document.getElementById('edit-f-tel').value.trim(),
                    pix: document.getElementById('edit-f-pix').value.trim(),
                    hora_entrada: document.getElementById('edit-f-entrada').value || '07:00',
                    hora_saida: document.getElementById('edit-f-saida').value || '17:00',
                    intervalo_minutos: Number(document.getElementById('edit-f-intervalo').value || 60),
                    sabado_horas: Number(document.getElementById('edit-f-sabado-horas').value || 0),
                    data_admissao: document.getElementById('edit-f-admissao').value || null,
                    data_demissao: document.getElementById('edit-f-demissao').value || null,
                    data_inicio_ferias: document.getElementById('edit-f-inicio-ferias').value || null,
                    ferias_dias: Number.isFinite(fd) ? Math.min(30, Math.max(1, fd)) : 30,
                    tipo_remuneracao: normalizarTipoRemuneracao(document.getElementById('edit-f-tipo-remuneracao').value),
                    descontar_inss: Boolean(document.getElementById('edit-f-descontar-inss') && document.getElementById('edit-f-descontar-inss').checked)
                }
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await updateDoc(doc(db, "funcionarios", id), result.value);
                    Swal.fire('Atualizado!', 'Os dados do funcionário foram alterados.', 'success');
                    carregarListaDeFuncionarios();
                } catch (e) {
                    Swal.fire('Erro', 'Não foi possível editar.', 'error');
                }
            }
        });
    };
    window.resetarSenhaFuncionario = async function(id, nome) {
        Swal.fire({
            title: 'Resetar Senha?', 
            text: `Deseja apagar a senha de ${nome}? Ele precisará criar uma nova no próximo acesso.`, 
            icon: 'warning',
            showCancelButton: true, 
            confirmButtonColor: '#d4a017', 
            cancelButtonColor: '#1a2a43', 
            confirmButtonText: 'Sim, resetar!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try { 
                    await updateDoc(doc(db, "funcionarios", id), { senha: "" }); 
                    Swal.fire('Resetada!', `A senha de ${nome} foi apagada.`, 'success'); 
                } catch (e) { 
                    Swal.fire('Erro', 'Não foi possível resetar a senha.', 'error'); 
                }
            }
        });
    };

    window.excluirFuncionario = async function(id, nome) {
        Swal.fire({ 
            title: 'Excluir?', 
            text: `Deseja excluir ${nome}?`, 
            icon: 'warning', 
            showCancelButton: true, 
            confirmButtonColor: '#d33', 
            confirmButtonText: 'Sim' 
        }).then(async (result) => {
            if (result.isConfirmed) { 
                try { 
                    await deleteDoc(doc(db, "funcionarios", id)); 
                    Swal.fire('Excluído!', 'Removido.', 'success'); 
                    carregarListaDeFuncionarios(); 
                } catch (e) { 
                    Swal.fire('Erro', 'Não foi possível.', 'error'); 
                } 
            }
        });
    };
