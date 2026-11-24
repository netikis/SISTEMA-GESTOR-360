/* js/carregar.js — edite este arquivo para alterar só este módulo */
const BUILD = window.APP_BUILD || 22;
const TELAS_PAINEL = [
  "inicio",
  "equipe",
  "ponto",
  "folha",
  "holerite",
  "calendario",
  "obras",
  "cartoes",
  "entradas",
  "documentos",
  "backup",
  "pedidos"
];
const TELAS_EXTRAS = [
  "pedido-material",
  "funcionario-login",
  "funcionario-relogio",
  "funcionario-vales",
  "funcionario",
  "funcionario-holerite"
];
const MODULOS_JS = [
  "js/api/firebase.js",
  "js/modulos/login.js",
  "js/core/util.js",
  "js/api/despesas.js",
  "js/modulos/documentos.js",
  "js/modulos/folha-extras.js",
  "js/api/anexos.js",
  "js/modulos/despesas-cadastro.js",
  "js/modulos/entradas.js",
  "js/modulos/despesas-relatorio.js",
  "js/modulos/holerite.js",
  "js/modulos/backup.js",
  "js/modulos/funcionario-acesso.js",
  "js/modulos/navegacao.js",
  "js/modulos/cartoes.js",
  "js/modulos/calendario.js",
  "js/modulos/equipe.js",
  "js/modulos/ponto.js",
  "js/modulos/vales.js",
  "js/modulos/holerite-assinatura.js",
  "js/modulos/assistente.js",
  "js/modulos/alertas.js"
];

async function carregarTexto(caminho) {
  const resp = await fetch('./' + caminho + '?v=' + BUILD, { cache: 'no-store' });
  if (!resp.ok) throw new Error('Não carregou ' + caminho + ' (' + resp.status + ')');
  return resp.text();
}

async function carregarTelas() {
  const wrap = document.getElementById('gestor-sections-wrap');
  const extras = document.getElementById('telas-extras');
  if (!wrap || !extras) throw new Error('Estrutura do index incompleta');
  const htmlPainel = await Promise.all(TELAS_PAINEL.map(function (nome) {
    return carregarTexto('telas/' + nome + '.html');
  }));
  const htmlExtras = await Promise.all(TELAS_EXTRAS.map(function (nome) {
    return carregarTexto('telas/' + nome + '.html');
  }));
  wrap.insertAdjacentHTML('beforeend', htmlPainel.join('\n'));
  extras.insertAdjacentHTML('beforeend', htmlExtras.join('\n'));
}

async function carregarModulosJs() {
  const partes = await Promise.all(MODULOS_JS.map(carregarTexto));
  const codigo = partes.map(function (txt) {
    return String(txt || '').replace(/^\/\*[\s\S]*?\*\/\s*/, '');
  }).join('\n;\n');
  const blob = new Blob([codigo], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  await import(url);
}

function ocultarCarregando() {
  const el = document.getElementById('gestor-carregando');
  if (el) el.remove();
}

try {
  await carregarTelas();
  await carregarModulosJs();
  ocultarCarregando();
} catch (erro) {
  console.error('Falha ao montar o Gestor 360', erro);
  ocultarCarregando();
  const el = document.getElementById('fatal-error');
  const msg = document.getElementById('fatal-error-msg');
  if (msg) msg.textContent = (erro && erro.message) ? erro.message : String(erro);
  if (el) el.style.display = 'block';
}
