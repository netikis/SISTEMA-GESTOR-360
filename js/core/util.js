/* js/core/util.js — edite este arquivo para alterar só este módulo */
    /** Coordenadas numéricas válidas para Maps / Firestore; evita gravar texto em latitude/longitude. */
    function normalizarCoordenadasGPS(lat, lng) {
        const la = typeof lat === 'number' ? lat : parseFloat(String(lat).replace(',', '.').trim());
        const lo = typeof lng === 'number' ? lng : parseFloat(String(lng).replace(',', '.').trim());
        if (Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180) {
            return { ok: true, lat: la, lng: lo };
        }
        return { ok: false, lat: null, lng: null };
    }

    function montarLinkGoogleMapsOuNull(lat, lng) {
        const g = normalizarCoordenadasGPS(lat, lng);
        if (!g.ok) return null;
        return 'https://www.google.com/maps?q=' + g.lat + ',' + g.lng;
    }

    function textoCoordenadasParaExibicao(dados) {
        const g = normalizarCoordenadasGPS(dados.latitude, dados.longitude);
        if (g.ok) return g.lat + ', ' + g.lng;
        return 'GPS indisponível neste registro';
    }

    /**
     * Mesma lógica “certeira” de antes: pedido de alta precisão primeiro (GPS real).
     * Só depois tenta posição de rede; por último aceita cache recente se ainda não houver fix.
     */
    async function obterCoordenadasGeolocalizacaoRapida() {
        if (!navigator.geolocation) return { lat: null, lng: null };
        function tentar(opcoes) {
            return new Promise(function (resolve, reject) {
                navigator.geolocation.getCurrentPosition(resolve, reject, opcoes);
            });
        }
        const tentativas = [
            { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
            { enableHighAccuracy: false, maximumAge: 0, timeout: 8000 },
            { enableHighAccuracy: false, maximumAge: 300000, timeout: 6000 }
        ];
        for (let i = 0; i < tentativas.length; i++) {
            try {
                const pos = await tentar(tentativas[i]);
                const la = pos.coords.latitude;
                const lo = pos.coords.longitude;
                if (Number.isFinite(la) && Number.isFinite(lo)) return { lat: la, lng: lo };
            } catch (err) {
                console.warn('Geolocalização tentativa ' + (i + 1), err && err.code, err && err.message);
            }
        }
        return { lat: null, lng: null };
    }

    function escapeHtmlBasico(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /** Converte DD/MM/AAAA ↔ input type="date" (AAAA-MM-DD). */
    function dataBrParaInputDateIso(ddmmyyyy) {
        const p = String(ddmmyyyy || '').trim().split('/');
        if (p.length !== 3) return '';
        const d = String(p[0]).padStart(2, '0');
        const m = String(p[1]).padStart(2, '0');
        const y = String(p[2]);
        if (y.length < 4) return '';
        return `${y}-${m}-${d}`;
    }
    function inputDateIsoParaDataBr(ymd) {
        if (!ymd || String(ymd).indexOf('-') < 0) return '';
        const p = String(ymd).split('-');
        if (p.length !== 3) return '';
        return `${String(p[2]).padStart(2, '0')}/${String(p[1]).padStart(2, '0')}/${p[0]}`;
    }
    function normalizarHoraHHmm(hora) {
        const hp = String(hora || '').trim().split(':');
        const hh = Math.min(23, Math.max(0, parseInt(hp[0], 10) || 0));
        const mm = Math.min(59, Math.max(0, parseInt(hp[1] || '0', 10)));
        return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    }
    /** Data/hora em calendário local (mesmo critério da folha). */
    function parseDataHoraBrLocalParaTimestamp(dataBR, horaHM) {
        const p = String(dataBR || '').trim().split('/');
        if (p.length !== 3) return NaN;
        const dia = parseInt(p[0], 10);
        const mes = parseInt(p[1], 10) - 1;
        const ano = parseInt(p[2], 10);
        const hp = String(horaHM || '00:00').trim().split(':');
        const hh = parseInt(hp[0], 10);
        const mm = parseInt(hp[1] || '0', 10);
        if (!Number.isFinite(dia) || !Number.isFinite(mes) || !Number.isFinite(ano) || !Number.isFinite(hh) || !Number.isFinite(mm)) return NaN;
        const dt = new Date(ano, mes, dia, hh, mm, 0, 0);
        return dt.getTime();
    }

    /** Chave única DD/MM/AAAA para agrupar batidas do mesmo dia na folha. */
    function formatarDataBrPadrao(dataString) {
        const s = separarDataSegura(dataString);
        if (!dataString || s.ano === 'Outros') return String(dataString || '').trim();
        return `${s.dia}/${s.mes}/${s.ano}`;
    }

    /** Unifica variações de texto (acentos, maiúsculas) nos tipos de batida. */
    function normalizarTipoBatidaPonto(tipo) {
        const t = String(tipo || '').trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (t === 'entrada') return 'Entrada';
        if (t === 'saida' || t === 'saida final' || t === 'sair') return 'Saída';
        if (t === 'inicio intervalo' || t === 'intervalo' || t === 'almoco' || t === 'saida almoco') return 'Início Intervalo';
        if (t === 'fim intervalo' || t === 'volta' || t === 'retorno' || t === 'retorno intervalo' || t === 'volta almoco') return 'Fim Intervalo';
        return String(tipo || '').trim();
    }

    function resumoBatidasDiaParaFolha(batidasRaw) {
        const dedup = deduplicarBatidasPonto(batidasRaw, null);
        const batidas = (dedup.validas || [])
            .map(b => (b ? { ...b, tipo: normalizarTipoBatidaPonto(b.tipo) } : b))
            .filter(b => b && ['Entrada', 'Saída', 'Início Intervalo', 'Fim Intervalo'].includes(b.tipo))
            .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
        if (!batidas.length) return 'Nenhuma batida válida (ou todas canceladas).';
        const tipos = new Set(batidas.map(b => b.tipo));
        const faltam = [];
        if (!tipos.has('Entrada')) faltam.push('Entrada');
        if (!tipos.has('Saída')) faltam.push('Saída');
        if (tipos.has('Início Intervalo') && !tipos.has('Fim Intervalo')) faltam.push('Fim intervalo');
        if (tipos.has('Fim Intervalo') && !tipos.has('Início Intervalo')) faltam.push('Início intervalo');
        const lista = batidas.map(b => `${b.tipo} ${b.hora || '?'}`).join('; ');
        if (!faltam.length) return `Batidas: ${lista}.`;
        return `Batidas: ${lista}. Falta(m) no dia: ${faltam.join(', ')}.`;
    }

    function horariosJornadaPadraoFuncionario(func, dataBR) {
        const he = normalizarHoraHHmm(func.hora_entrada || '07:30');
        const hs = normalizarHoraHHmm(func.hora_saida || '17:00');
        const intMin = Math.max(0, Number(func.intervalo_minutos ?? 60));
        const tsEnt = parseDataHoraBrLocalParaTimestamp(dataBR, he);
        const tsSai = parseDataHoraBrLocalParaTimestamp(dataBR, hs);
        let inicioInt = '12:00';
        let fimInt = '13:00';
        if (Number.isFinite(tsEnt) && Number.isFinite(tsSai) && tsSai > tsEnt) {
            const meio = tsEnt + (tsSai - tsEnt) / 2;
            const dtMeio = new Date(meio);
            inicioInt = normalizarHoraHHmm(`${dtMeio.getHours()}:${dtMeio.getMinutes()}`);
            const dtFim = new Date(meio + intMin * 60000);
            fimInt = normalizarHoraHHmm(`${dtFim.getHours()}:${dtFim.getMinutes()}`);
        }
        return { entrada: he, inicioIntervalo: inicioInt, fimIntervalo: fimInt, saida: hs };
    }

    /** Funcionário ativo no contexto RH (folha, ponto, etc.). */
    function obterFuncionarioIdContextoRH() {
        if (window.ultimoFuncIdFolha) return window.ultimoFuncIdFolha;
        const ordem = ['folha-func-select', 'pt-func-select', 'p-func-select', 'b-func-select', 'ac-func-select', 'df-func-select'];
        for (let i = 0; i < ordem.length; i++) {
            const el = document.getElementById(ordem[i]);
            if (el && el.value) return el.value;
        }
        return '';
    }

    function registrarFuncionarioContextoRH(funcId) {
        if (!funcId) return;
        window.ultimoFuncIdFolha = funcId;
        ['folha-func-select', 'pt-func-select', 'p-func-select', 'b-func-select'].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) el.value = funcId;
        });
    }

    function vincularSelectsFuncionarioContextoRH() {
        ['folha-func-select', 'pt-func-select'].forEach(function (id) {
            const el = document.getElementById(id);
            if (!el || el.dataset.ctxRhBound === '1') return;
            el.dataset.ctxRhBound = '1';
            el.addEventListener('change', function () {
                if (el.value) registrarFuncionarioContextoRH(el.value);
            });
        });
    }

    function initFolhaOpcoesCalculo() {
        const elEx = document.getElementById('folha-opc-extras');
        const elDc = document.getElementById('folha-opc-desconto-horas');
        if (!elEx || !elDc) return;
        const sEx = localStorage.getItem('folha_incluir_extras');
        const sDc = localStorage.getItem('folha_incluir_desconto_horas');
        if (sEx !== null) elEx.checked = sEx === '1';
        if (sDc !== null) elDc.checked = sDc === '1';
        const gravar = function () {
            localStorage.setItem('folha_incluir_extras', elEx.checked ? '1' : '0');
            localStorage.setItem('folha_incluir_desconto_horas', elDc.checked ? '1' : '0');
        };
        if (elEx.dataset.folhaOpcBound !== '1') {
            elEx.dataset.folhaOpcBound = '1';
            elDc.dataset.folhaOpcBound = '1';
            elEx.addEventListener('change', gravar);
            elDc.addEventListener('change', gravar);
        }
    }

    function lerFolhaOpcoesCalculo() {
        const elEx = document.getElementById('folha-opc-extras');
        const elDc = document.getElementById('folha-opc-desconto-horas');
        return {
            incluirExtras: elEx ? elEx.checked : true,
            incluirDescontoHoras: elDc ? elDc.checked : true
        };
    }

    function isoParaDataBr(iso) {
        if (!iso || String(iso).indexOf('-') < 0) return '';
        const p = String(iso).split('-');
        return `${p[2]}/${p[1]}/${p[0]}`;
    }

    function chaveSemanaDsrDomingo(isoOuDate) {
        const dt = typeof isoOuDate === 'string' ? isoParaDateLocal(isoOuDate) : isoOuDate;
        if (!dt) return '';
        const d = new Date(dt.getTime());
        d.setDate(d.getDate() - d.getDay());
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    /** DSR perdido: 1 descanso (domingo) por semana com falta injustificada em dia devido (CLT / Súmula 146). */
    function calcularDsrPerdidosPorFaltas(faltasIsoLista, anoNum, mesNum, diasNoMesCalc, admIso, demIso) {
        const semanasComFalta = new Set();
        (faltasIsoLista || []).forEach(function (iso) {
            if (!iso || !isDiaContratoAtivo(iso, admIso, demIso)) return;
            const k = chaveSemanaDsrDomingo(iso);
            if (k) semanasComFalta.add(k);
        });
        const domingosPerdidos = [];
        for (let d = 1; d <= diasNoMesCalc; d++) {
            const isoD = `${anoNum}-${String(mesNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dt = new Date(anoNum, mesNum - 1, d);
            if (dt.getDay() !== 0) continue;
            if (!isDiaContratoAtivo(isoD, admIso, demIso)) continue;
            const semKey = chaveSemanaDsrDomingo(isoD);
            if (semanasComFalta.has(semKey)) {
                domingosPerdidos.push({ iso: isoD, dataBr: isoParaDataBr(isoD), semana: semKey });
            }
        }
        return { dsrPerdidos: domingosPerdidos.length, domingosPerdidos: domingosPerdidos };
    }

    function eventoFaltaNoMes(ev, mesSelected, anoSelected) {
        if (!ev) return false;
        let iso = ev.data_iso || '';
        if (!iso && ev.data_br) {
            const br = formatarDataBrPadrao(ev.data_br);
            const s = separarDataSegura(br);
            if (s.ano !== 'Outros') iso = `${s.ano}-${s.mes}-${s.dia}`;
        }
        if (!iso) return false;
        const p = iso.split('-');
        return Number(p[1]) === Number(mesSelected) && Number(p[0]) === Number(anoSelected);
    }

    function indexarEventosFaltasRh(snapEvt, mesSelected, anoSelected) {
        const injust = new Map();
        const just = new Map();
        snapEvt.forEach(function (ed) {
            const ev = ed.data();
            if (!ev || !eventoFaltaNoMes(ev, mesSelected, anoSelected)) return;
            let iso = ev.data_iso || '';
            if (!iso && ev.data_br) {
                const br = formatarDataBrPadrao(ev.data_br);
                const s = separarDataSegura(br);
                if (s.ano !== 'Outros') iso = `${s.ano}-${s.mes}-${s.dia}`;
            }
            if (!iso) return;
            const item = {
                id: ed.id,
                motivo: ev.motivo || '',
                iso: iso,
                dataBr: isoParaDataBr(iso),
                descontarDsr: ev.descontar_dsr !== false
            };
            if (ev.tipo === 'FALTA_INJUSTIFICADA') injust.set(iso, item);
            if (ev.tipo === 'FALTA_JUSTIFICADA') just.set(iso, item);
        });
        return { injust: injust, just: just };
    }

    function obterIsoHojeLocal() {
        const ag = new Date();
        return `${ag.getFullYear()}-${String(ag.getMonth() + 1).padStart(2, '0')}-${String(ag.getDate()).padStart(2, '0')}`;
    }

    /** Hoje e dias futuros sem ponto não viram falta automática — só após a data passar. */
    function diaAguardandoPontoFolha(isoD, hojeIso, marcadaRhInjust, marcadaRhJust, workedD) {
        if (marcadaRhInjust || marcadaRhJust) return false;
        if ((Number(workedD) || 0) > 0) return false;
        return isoD >= hojeIso;
    }

    function ehFaltaInjustificadaNoDia(isoD, workedD, faltasRhInjust, faltasRhJust, hojeIso) {
        if (faltasRhJust && faltasRhJust.has(isoD)) return false;
        if (faltasRhInjust && faltasRhInjust.has(isoD)) return true;
        const hoje = hojeIso || obterIsoHojeLocal();
        if (isoD >= hoje) return false;
        return workedD <= 0;
    }

    /** Falta automática (sem RH) sempre desconta DSR; RH pode optar por não descontar DSR no registro. */
    function faltaInjustDescontaDsr(evRh, marcadaRhInjust) {
        if (!marcadaRhInjust) return true;
        if (!evRh) return true;
        return evRh.descontarDsr !== false;
    }

    function textoDescontoFaltaInjust(marcadaRhInjust, evRh, textoBaseAutomatico, resumoExtra) {
        const comDsr = faltaInjustDescontaDsr(evRh, marcadaRhInjust);
        const motivoTxt = evRh && evRh.motivo ? ' — ' + evRh.motivo : '';
        const base = marcadaRhInjust
            ? 'Falta injustificada registada pelo RH' + motivoTxt + '.'
            : textoBaseAutomatico;
        const extra = resumoExtra ? ' ' + resumoExtra : '';
        if (comDsr) {
            return base + ' Desconto: 1 dia + DSR da semana (se domingo no mês).' + extra;
        }
        return base + ' Desconto: 1 dia apenas (RH optou por não descontar DSR).' + extra;
    }

    /** Quantidade de dias do mês no calendário (mes 1–12). Maio/2026 = 31. */
    function diasNoCalendarioMes(ano, mes1a12) {
        const y = parseInt(String(ano), 10);
        const m = parseInt(String(mes1a12), 10);
        if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return 0;
        return new Date(y, m, 0).getDate();
    }

    function parseDataIsoFuncionario(campo) {
        if (!campo) return null;
        const s = String(campo).trim();
        if (!s) return null;
        if (s.indexOf('-') >= 0) return s.substring(0, 10);
        const br = dataBrParaInputDateIso(s);
        return br || null;
    }

    function isoParaDateLocal(iso) {
        if (!iso) return null;
        const p = String(iso).split('-').map(Number);
        if (p.length !== 3 || !Number.isFinite(p[0])) return null;
        return new Date(p[0], p[1] - 1, p[2], 12, 0, 0, 0);
    }

    function formatarDataBrDeIso(iso) {
        if (!iso) return '—';
        const p = String(iso).split('-');
        if (p.length !== 3) return iso;
        return `${p[2]}/${p[1]}/${p[0]}`;
    }

    function isDiaContratoAtivo(isoD, admIso, demIso) {
        if (admIso && isoD < admIso) return false;
        if (demIso && isoD > demIso) return false;
        return true;
    }

    function isDiaEmFerias(isoD, inicioFeriasIso, diasFerias) {
        if (!inicioFeriasIso) return false;
        const ini = isoParaDateLocal(inicioFeriasIso);
        if (!ini) return false;
        const dias = Math.min(30, Math.max(1, Number(diasFerias) || 30));
        const fim = new Date(ini.getTime());
        fim.setDate(fim.getDate() + dias - 1);
        const cur = isoParaDateLocal(isoD);
        if (!cur) return false;
        return cur >= ini && cur <= fim;
    }

    function dateLocalParaIso(dt) {
        if (!dt || !(dt instanceof Date) || Number.isNaN(dt.getTime())) return '';
        return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    }

    function normalizarDiasAtestado(dias) {
        const n = Number(dias);
        if (!Number.isFinite(n) || n < 1) return 0;
        return Math.min(365, Math.max(1, Math.round(n)));
    }

    function fimIsoPeriodoDias(inicioIso, dias) {
        const ini = isoParaDateLocal(inicioIso);
        const n = normalizarDiasAtestado(dias);
        if (!ini || n < 1) return '';
        const fim = new Date(ini.getTime());
        fim.setDate(fim.getDate() + n - 1);
        return dateLocalParaIso(fim);
    }

    function isDiaEmAtestado(isoD, inicioAtestadoIso, diasAtestado) {
        const dia = parseDataIsoFuncionario(isoD) || isoD;
        const inicio = parseDataIsoFuncionario(inicioAtestadoIso) || inicioAtestadoIso;
        if (!dia || !inicio) return false;
        const n = normalizarDiasAtestado(diasAtestado);
        if (n < 1) return false;
        const ini = isoParaDateLocal(inicio);
        const cur = isoParaDateLocal(dia);
        const fimIso = fimIsoPeriodoDias(inicio, n);
        const fim = isoParaDateLocal(fimIso);
        if (!ini || !cur || !fim) return false;
        return cur >= ini && cur <= fim;
    }

    function infoAtestadoFuncionario(func, hojeIso) {
        const inicioIso = parseDataIsoFuncionario(func && func.data_inicio_atestado);
        const dias = normalizarDiasAtestado(func && func.atestado_dias);
        if (!inicioIso || dias < 1) {
            return { ativo: false, inicioIso: null, fimIso: null, dias: 0 };
        }
        const fimIso = fimIsoPeriodoDias(inicioIso, dias);
        const hoje = hojeIso || obterIsoHojeLocal();
        return {
            ativo: isDiaEmAtestado(hoje, inicioIso, dias),
            inicioIso: inicioIso,
            fimIso: fimIso,
            dias: dias
        };
    }

    function mesesCobertosPorPeriodo(inicioIso, dias) {
        const out = [];
        const ini = isoParaDateLocal(inicioIso);
        const n = normalizarDiasAtestado(dias);
        if (!ini || n < 1) return out;
        const seen = {};
        for (let i = 0; i < n; i++) {
            const d = new Date(ini.getTime());
            d.setDate(d.getDate() + i);
            const y = String(d.getFullYear());
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const key = y + '-' + m;
            if (seen[key]) continue;
            seen[key] = true;
            out.push({ ano: y, mes: m });
        }
        return out;
    }

    function payloadAtestadoParaSalvar(emAtestado, inicioForm, diasForm, existenteInicio, existenteDias) {
        const hoje = obterIsoHojeLocal();
        if (emAtestado) {
            const ini = parseDataIsoFuncionario(inicioForm) || hoje;
            const n = normalizarDiasAtestado(diasForm) || 1;
            return { data_inicio_atestado: ini, atestado_dias: n };
        }
        const iniEx = parseDataIsoFuncionario(existenteInicio);
        const diasEx = normalizarDiasAtestado(existenteDias);
        if (iniEx && diasEx && isDiaEmAtestado(hoje, iniEx, diasEx)) {
            const iniDt = isoParaDateLocal(iniEx);
            const ontem = isoParaDateLocal(hoje);
            if (iniDt && ontem) {
                ontem.setDate(ontem.getDate() - 1);
                const diff = Math.round((ontem.getTime() - iniDt.getTime()) / 86400000) + 1;
                if (diff < 1) return { data_inicio_atestado: null, atestado_dias: 0 };
                return { data_inicio_atestado: iniEx, atestado_dias: Math.min(365, diff) };
            }
        }
        if (iniEx && diasEx) {
            return { data_inicio_atestado: iniEx, atestado_dias: diasEx };
        }
        return { data_inicio_atestado: null, atestado_dias: 0 };
    }

    window.infoAtestadoFuncionario = infoAtestadoFuncionario;
    window.isDiaEmAtestado = isDiaEmAtestado;

    function normalizarTipoRemuneracao(tipo) {
        const s = String(tipo || 'ponto').toLowerCase().trim();
        return s === 'mensal' ? 'mensal' : 'ponto';
    }

    function labelTipoRemuneracao(tipo) {
        return normalizarTipoRemuneracao(tipo) === 'mensal' ? 'Mensal (CLT)' : 'Por ponto';
    }

    function isDiaUtilTrabalhoFolha(dowD, isoD, feriadosSet, sabadoHorasPadrao) {
        if (dowD === 0 || feriadosSet.has(isoD)) return false;
        if (dowD === 6 && !(Number.isFinite(sabadoHorasPadrao) && sabadoHorasPadrao > 0)) return false;
        return true;
    }

    function mesCalendarioInteiroNoVinculo(anoNum, mesNum, diasNoMesCalc, admIso, demIso) {
        const pad2 = (n) => String(n).padStart(2, '0');
        const primeiro = `${anoNum}-${pad2(mesNum)}-01`;
        const ultimo = `${anoNum}-${pad2(mesNum)}-${pad2(diasNoMesCalc)}`;
        return isDiaContratoAtivo(primeiro, admIso, demIso) && isDiaContratoAtivo(ultimo, admIso, demIso);
    }

    window.mascaraMoeda = function(input) {
        let value = input.value.replace(/\D/g, '');
        if (value === "") { input.value = ""; return; }
        value = (value / 100).toFixed(2) + '';
        value = value.replace('.', ',');
        value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        input.value = value;
    };

    function formatarMoeda(valor) {
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function parseMoedaLocal(stringValor) {
        if (!stringValor) return 0;
        let limpo = String(stringValor).replace(/\./g, '').replace(',', '.');
        return parseFloat(limpo) || 0;
    }

    function normalizarCpfSomenteDigitos(valor) {
        if (valor == null || valor === '') return '';
        // Número vindo do Firestore (evita notação científica em string)
        if (typeof valor === 'number' && Number.isFinite(valor)) {
            return String(Math.trunc(Math.abs(valor)));
        }
        let s = String(valor).trim();
        // Ex.: "1.2345678901e+10" → converte para inteiro
        if (/e\+/i.test(s)) {
            const n = Number(s);
            if (Number.isFinite(n)) return String(Math.trunc(Math.abs(n)));
        }
        return s.replace(/\D/g, '');
    }

    /** Compara CPF ignorando pontuação e zeros à esquerda (ex.: 0123... vs 123...). */
    function cpfParaComparacao(valor) {
        let digitos = normalizarCpfSomenteDigitos(valor);
        if (!digitos) return '';
        // Firestore/número antigo pode ter perdido zero à esquerda — alinha em 11 dígitos
        if (digitos.length < 11) digitos = digitos.padStart(11, '0');
        if (digitos.length > 11) digitos = digitos.slice(-11);
        return digitos;
    }

    function obterCpfDoFuncionario(dados) {
        if (!dados) return '';
        const bruto = dados.cpf != null ? dados.cpf
            : (dados.CPF != null ? dados.CPF
                : (dados.documento != null ? dados.documento : ''));
        return bruto;
    }

    function cpfsSaoIguais(a, b) {
        const da = normalizarCpfSomenteDigitos(a);
        const db = normalizarCpfSomenteDigitos(b);
        if (!da || !db) return false;
        if (da === db) return true;
        // Também compara com 11 dígitos (zero à esquerda)
        const ca = cpfParaComparacao(a);
        const cb = cpfParaComparacao(b);
        return Boolean(ca && cb && ca === cb);
    }

    function empresasSaoIguais(a, b) {
        return normalizarTextoSemAcentoLower(a) === normalizarTextoSemAcentoLower(b);
    }

    function resolverEmpresaLoginFuncionario() {
        let emp = getSessaoFunc('empresaTemporariaFuncionario');
        if (emp) return String(emp).trim();
        try {
            emp = localStorage.getItem('empresaTemporariaFuncionario');
            if (emp) {
                setSessaoFunc('empresaTemporariaFuncionario', emp);
                return String(emp).trim();
            }
        } catch (_) {}
        const el = document.getElementById('login-nome-empresa');
        const txt = el ? String(el.textContent || '').trim() : '';
        if (txt && txt !== 'Login do Funcionário') return txt;
        return '';
    }

    function normalizarSenhaFuncionario(valor) {
        return String(valor || '').trim();
    }

    function senhaFuncionarioEstaVazia(senha) {
        return senha == null || normalizarSenhaFuncionario(senha) === '';
    }

    function senhasFuncionarioCoincidem(armazenada, digitada) {
        const a = normalizarSenhaFuncionario(armazenada);
        const b = normalizarSenhaFuncionario(digitada);
        if (!a || !b) return false;
        return a.toLowerCase() === b.toLowerCase();
    }

    function normalizarTextoSemAcentoLower(s) {
        return String(s || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    // INSS (empregado CLT) — Tabela progressiva válida a partir da competência JAN/2026
    // Fonte: https://www.gov.br/inss/.../tabela-de-contribuicao-mensal (Atualizado em 13/01/2026)
    const TABELA_INSS_EMPREGADO_2026 = [
        { ate: 1621.00, aliquota: 0.075 },
        { ate: 2902.84, aliquota: 0.09 },
        { ate: 4354.27, aliquota: 0.12 },
        { ate: 8475.55, aliquota: 0.14 }
    ];

    function calcularInssEmpregado2026(salarioContribuicao) {
        const base = Math.max(0, Number(salarioContribuicao) || 0);
        if (!base) return 0;
        let restante = Math.min(base, TABELA_INSS_EMPREGADO_2026[TABELA_INSS_EMPREGADO_2026.length - 1].ate);
        let anterior = 0;
        let total = 0;
        for (const fx of TABELA_INSS_EMPREGADO_2026) {
            if (restante <= 0) break;
            const teto = fx.ate;
            const faixaValor = Math.max(0, Math.min(restante, teto) - anterior);
            if (faixaValor > 0) total += faixaValor * fx.aliquota;
            anterior = teto;
        }
        // Arredondamento padrão a centavos
        return Math.round(total * 100) / 100;
    }

    window.calcularInssEmpregado2026 = calcularInssEmpregado2026;
