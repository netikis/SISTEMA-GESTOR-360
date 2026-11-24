/* js/api/firebase.js — edite este arquivo para alterar só este módulo */
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { getFirestore, collection, addDoc, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, getDocs, orderBy, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
    import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
    
    const LOGOS_EMPRESAS = {
        "FH CONSTRUÇÕES CIVIS": "https://image2url.com/r2/default/images/1774578957071-f27e2520-816d-436f-a537-ee8a160f90ca.jpeg",
        "MANUTENÇÃO": "https://image2url.com/r2/default/images/1774579047667-4e0abef4-e2c7-4472-8d55-7ea75061c935.jpeg",
        "OLIVEIRA DANTAS": "https://image2url.com/r2/default/images/1774579115875-510042b0-4e68-48a7-815f-aaa204278ab3.jpeg",
        "WORKMAN": "https://image2url.com/r2/default/images/1775222635762-bb7b4bc7-d027-4c9a-abc4-add5cdbf79ba.png"
    };

    window.atualizarLogoInterface = function(nomeEmpresa) {
        const urlLogo = LOGOS_EMPRESAS[nomeEmpresa];
        if (urlLogo) {
            document.querySelectorAll('.logo-img').forEach(img => {
                img.src = urlLogo;
            });
        }
        const telaInicio = document.getElementById('aba-inicio');
        const logoGrande = document.getElementById('gestor-inicio-logo');
        const nomeEl = document.getElementById('gestor-inicio-nome');
        if (telaInicio && urlLogo) {
            telaInicio.style.backgroundImage = "url('" + urlLogo + "')";
        }
        if (logoGrande && urlLogo) logoGrande.src = urlLogo;
        if (nomeEl && nomeEmpresa) nomeEl.textContent = nomeEmpresa;
    };

    const firebaseConfig = {
        apiKey: "AIzaSyBKlQXW4JRrPxv_NcoG8Jq2-7KZZALrTuU",
        authDomain: "fhconstrucoes-f36d0.firebaseapp.com",
        projectId: "fhconstrucoes-f36d0",
        storageBucket: "fhconstrucoes-f36d0.firebasestorage.app",
        messagingSenderId: "621427159155",
        appId: "1:621427159155:web:85a4975d35a24513d6ba06"
    };
    
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

    // Auth anônimo (sem mudar o fluxo do usuário). Isso cria um UID seguro por dispositivo.
    let authReadyResolve;
    const authReady = new Promise((resolve) => { authReadyResolve = resolve; });

    onAuthStateChanged(auth, (user) => {
        if (user) {
            localStorage.setItem('auth_uid', user.uid);
            authReadyResolve?.(user);
        }
    });

    async function ensureAuth() {
        if (auth.currentUser) return auth.currentUser;
        try {
            const cred = await Promise.race([
                signInAnonymously(auth),
                new Promise(function (_, reject) {
                    setTimeout(function () { reject(new Error('timeout_anon')); }, 8000);
                })
            ]);
            if (cred && cred.user) return cred.user;
        } catch (e) {
            console.error('Falha no Auth anônimo', e);
        }
        if (auth.currentUser) return auth.currentUser;
        try {
            return await Promise.race([
                authReady,
                new Promise((resolve) => setTimeout(() => resolve(auth.currentUser || null), 8000))
            ]);
        } catch (_) {
            return auth.currentUser || null;
        }
    }

    // Sessão independente por aba/janela (sessionStorage não é compartilhado entre tabs)
    const SESSAO_GESTOR_KEY = 'empresaGestor';
    const SESSAO_FUNC_KEYS = ['funcLogadoId', 'funcLogadoNome', 'funcLogadoEmpresa', 'empresaTemporariaFuncionario'];
    // Login do FUNCIONÁRIO deve permanecer salvo mesmo após fechar o app/navegador
    // (evita pedir CPF e senha a cada batida de ponto). Fica no localStorage.
    const SESSAO_FUNC_PERSISTENTE = ['funcLogadoId', 'funcLogadoNome', 'funcLogadoEmpresa'];

    function limparChaveSessaoLegadoLocalStorage(chave) {
        try { localStorage.removeItem(chave); } catch (_) {}
    }

    function getEmpresaGestor() {
        try {
            let v = sessionStorage.getItem(SESSAO_GESTOR_KEY);
            if (!v) {
                const legado = localStorage.getItem(SESSAO_GESTOR_KEY);
                if (legado) {
                    sessionStorage.setItem(SESSAO_GESTOR_KEY, legado);
                    limparChaveSessaoLegadoLocalStorage(SESSAO_GESTOR_KEY);
                    v = legado;
                }
            }
            return v || null;
        } catch (_) {
            return localStorage.getItem(SESSAO_GESTOR_KEY);
        }
    }

    function setEmpresaGestor(nomeEmpresa) {
        try {
            sessionStorage.setItem(SESSAO_GESTOR_KEY, nomeEmpresa);
            limparChaveSessaoLegadoLocalStorage(SESSAO_GESTOR_KEY);
        } catch (_) {
            localStorage.setItem(SESSAO_GESTOR_KEY, nomeEmpresa);
        }
    }

    function clearEmpresaGestor() {
        try { sessionStorage.removeItem(SESSAO_GESTOR_KEY); } catch (_) {}
        limparChaveSessaoLegadoLocalStorage(SESSAO_GESTOR_KEY);
    }

    function getSessaoFunc(chave) {
        // Chaves persistentes do funcionário ficam no localStorage (login permanente)
        if (SESSAO_FUNC_PERSISTENTE.includes(chave)) {
            try {
                let v = localStorage.getItem(chave);
                if (!v) {
                    // Migra sessão antiga que ficou no sessionStorage
                    const legado = sessionStorage.getItem(chave);
                    if (legado) {
                        localStorage.setItem(chave, legado);
                        try { sessionStorage.removeItem(chave); } catch (_) {}
                        v = legado;
                    }
                }
                return v;
            } catch (_) {
                return localStorage.getItem(chave);
            }
        }
        try {
            let v = sessionStorage.getItem(chave);
            if (!v && SESSAO_FUNC_KEYS.includes(chave)) {
                const legado = localStorage.getItem(chave);
                if (legado) {
                    sessionStorage.setItem(chave, legado);
                    limparChaveSessaoLegadoLocalStorage(chave);
                    v = legado;
                }
            }
            return v;
        } catch (_) {
            return localStorage.getItem(chave);
        }
    }

    function setSessaoFunc(chave, valor) {
        // Login permanente do funcionário: grava no localStorage
        if (SESSAO_FUNC_PERSISTENTE.includes(chave)) {
            try {
                localStorage.setItem(chave, valor);
                try { sessionStorage.removeItem(chave); } catch (_) {}
            } catch (_) {
                try { sessionStorage.setItem(chave, valor); } catch (__) {}
            }
            return;
        }
        try {
            sessionStorage.setItem(chave, valor);
            if (SESSAO_FUNC_KEYS.includes(chave)) limparChaveSessaoLegadoLocalStorage(chave);
        } catch (_) {
            localStorage.setItem(chave, valor);
        }
    }

    function clearSessaoFuncionario() {
        SESSAO_FUNC_KEYS.forEach((chave) => {
            try { sessionStorage.removeItem(chave); } catch (_) {}
            limparChaveSessaoLegadoLocalStorage(chave);
        });
    }

    function limparCachesEmpresaGestor() {
        window._cacheNomesDespesas = null;
        window._cacheNomesRelDespesas = null;
        window._obraSelecionadaCadastros = null;
        window._filtroCadastroDespesa = null;
        window._mapDespesasResumoFornecedor = {};
        window._despesasRelatorioExport = [];
        window._mapRelatorioDespesasParaEdicao = {};
        window._relDespDadosFiltrados = null;
        window._mapAjudaCustoEdicao = {};
        window._mapDescontoFolhaEdicao = {};
        window.dadosExportacaoDespesas = [];
        window.dadosExportacaoVales = [];
        window.dadosExportacaoPonto = [];
    }

    window.getEmpresaGestor = getEmpresaGestor;

    function chaveAlertaSilenciado(idDoc, dataStr) {
        const emp = getEmpresaGestor() || 'global';
        return `novo_aviso_${emp}_${idDoc}_${dataStr}`;
    }

    function chaveAlertaSilenciadoDoc(idDoc, dataStr) {
        const emp = getEmpresaGestor() || 'global';
        return `doc_cert_${emp}_${idDoc}_${dataStr}`;
    }

    function chaveAlertaSilenciadoPonto(chave, dataStr) {
        const emp = getEmpresaGestor() || 'global';
        return `ponto_seq_${emp}_${chave}_${dataStr}`;
    }

    function chaveAlertaSilenciadoPedido(idPedido, dataStr) {
        const emp = getEmpresaGestor() || 'global';
        return `pedido_mat_${emp}_${idPedido}_${dataStr}`;
    }

    window.chaveAlertaSilenciado = chaveAlertaSilenciado;
    window.chaveAlertaSilenciadoPonto = chaveAlertaSilenciadoPonto;
    window.chaveAlertaSilenciadoPedido = chaveAlertaSilenciadoPedido;

    // CHECAGEM DO STATUS (KILL SWITCH)
    async function verificarStatusSistema() {
        try {
            const docRef = doc(db, "sistema", "config");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().status === "bloqueado") {
                document.getElementById('tela-bloqueio').style.display = 'flex';
            }
        } catch(e) {
            console.log("Sistema OK");
        }
    }
    verificarStatusSistema();
    // Garante que o app sempre tenha um UID (sem pedir login)
    ensureAuth();

    window.listaFuncionarios = {};
    window.dadosExportacaoVales = [];
    window.dadosExportacaoPonto = [];
    window.dadosExportacaoDespesas = [];
