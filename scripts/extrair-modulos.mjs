import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
const lines = html.split(/\r?\n/);

function sliceLines(from1, to1) {
  return lines.slice(from1 - 1, to1).join('\n');
}

function writeFile(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const header = rel.endsWith('.js')
    ? `/* ${rel} — edite este arquivo para alterar só este módulo */\n`
    : rel.endsWith('.css')
      ? `/* ${rel} */\n`
      : `<!-- ${rel} -->\n`;
  fs.writeFileSync(full, header + content.replace(/^\uFEFF/, '') + (content.endsWith('\n') ? '' : '\n'), 'utf8');
  console.log('ok', rel, (content.length / 1024).toFixed(1) + ' KB');
}

function extractById(id) {
  const re = new RegExp(`<div\\b[^>]*\\bid=["']${id}["'][^>]*>`, 'i');
  const m = re.exec(html);
  if (!m) throw new Error('Não achei #' + id);
  let i = m.index + m[0].length;
  let depth = 1;
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', i);
    const nextClose = html.indexOf('</div>', i);
    if (nextClose < 0) throw new Error('div sem fecho: ' + id);
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
    } else {
      depth -= 1;
      i = nextClose + 6;
    }
  }
  return html.slice(m.index, i);
}

function joinBlocks(ids) {
  return ids.map(extractById).join('\n\n');
}

// --- CSS ---
writeFile('css/base.css', sliceLines(33, 376));
writeFile('css/painel.css', sliceLines(377, 3264));
writeFile('css/assistente.css', sliceLines(3265, 3378));

// --- Telas HTML ---
writeFile('telas/inicio.html', extractById('aba-inicio'));
writeFile('telas/equipe.html', joinBlocks(['aba-cadastrar', 'aba-equipe-cadastrada', 'aba-criar', 'aba-buscar']));
writeFile('telas/ponto.html', extractById('aba-ponto'));
writeFile('telas/folha.html', joinBlocks(['aba-ajuda-custo', 'aba-descontos-folha', 'aba-folha']));
writeFile('telas/holerite.html', extractById('aba-holerites'));
writeFile('telas/calendario.html', extractById('aba-calendario'));
writeFile('telas/obras.html', joinBlocks([
  'aba-despesas-cadastrar',
  'aba-despesas-relatorio',
  'aba-relatorio-despesas',
  'aba-obras-relatorio-geral',
  'aba-notas-fiscais-geral',
  'aba-terceiros',
  'aba-arquivamento-contas'
]));
writeFile('telas/cartoes.html', joinBlocks([
  'aba-cartoes-cadastro',
  'aba-cartoes-cadastrados',
  'aba-cartoes-dashboard',
  'aba-cartoes-reembolso',
  'aba-cartoes-relatorio'
]));
writeFile('telas/entradas.html', joinBlocks(['aba-cadastrar-conta', 'aba-contas-receber', 'aba-recebimentos']));
writeFile('telas/documentos.html', joinBlocks([
  'aba-documentos-fh',
  'aba-documentos-hallana',
  'aba-documentos-felipe',
  'aba-documentos-wellington',
  'aba-documentos-licitacoes',
  'aba-documentos-contratos',
  'aba-documentos-empenhos'
]));
writeFile('telas/backup.html', extractById('aba-backup'));
writeFile('telas/pedidos.html', extractById('aba-pedidos'));
writeFile('telas/funcionario-login.html', extractById('tela-login'));
writeFile('telas/funcionario-relogio.html', extractById('tela-relogio'));
writeFile('telas/funcionario-vales.html', extractById('tela-meus-vales'));
writeFile('telas/funcionario.html', extractById('tela-funcionario'));
writeFile('telas/funcionario-holerite.html', extractById('tela-assinatura-holerite'));
writeFile('telas/pedido-material.html', extractById('tela-pedido-material'));

// --- JS boot ---
writeFile('js/boot-erro.js', sliceLines(3383, 3413));
writeFile('js/boot-atualizacao.js', sliceLines(3417, 3514));

// --- JS módulos (concatenados em um único escopo no carregador) ---
const jsSplits = [
  [5627, 5868, 'js/api/firebase.js'],
  [5869, 6279, 'js/modulos/login.js'],
  [6280, 6809, 'js/core/util.js'],
  [6810, 7771, 'js/api/despesas.js'],
  [7772, 9061, 'js/modulos/documentos.js'],
  [9062, 9515, 'js/modulos/folha-extras.js'],
  [9516, 9830, 'js/api/anexos.js'],
  [9831, 11486, 'js/modulos/despesas-cadastro.js'],
  [11487, 12384, 'js/modulos/entradas.js'],
  [12385, 17435, 'js/modulos/despesas-relatorio.js'],
  [17436, 17759, 'js/modulos/holerite.js'],
  [17760, 17984, 'js/modulos/backup.js'],
  [17985, 18189, 'js/modulos/funcionario-acesso.js'],
  [18190, 18681, 'js/modulos/navegacao.js'],
  [18682, 19344, 'js/modulos/cartoes.js'],
  [19345, 19468, 'js/modulos/calendario.js'],
  [19469, 21041, 'js/modulos/equipe.js'],
  [21042, 24032, 'js/modulos/ponto.js'],
  [24033, 24322, 'js/modulos/vales.js'],
  [24323, 25745, 'js/modulos/holerite-assinatura.js'],
  [25746, 26414, 'js/modulos/assistente.js'],
  [26415, 28101, 'js/modulos/alertas.js']
];

const jsLista = [];
for (const [from, to, rel] of jsSplits) {
  writeFile(rel, sliceLines(from, to));
  jsLista.push(rel.replace(/\\/g, '/'));
}

writeFile('js/modulos.json', JSON.stringify(jsLista, null, 2));

const telasPainel = [
  'inicio', 'equipe', 'ponto', 'folha', 'holerite', 'calendario',
  'obras', 'cartoes', 'entradas', 'documentos', 'backup', 'pedidos'
];
const telasExtras = [
  'pedido-material',
  'funcionario-login',
  'funcionario-relogio',
  'funcionario-vales',
  'funcionario',
  'funcionario-holerite'
];

writeFile('js/carregar.js', `const BUILD = window.APP_BUILD || 22;
const TELAS_PAINEL = ${JSON.stringify(telasPainel, null, 2)};
const TELAS_EXTRAS = ${JSON.stringify(telasExtras, null, 2)};
const MODULOS_JS = ${JSON.stringify(jsLista, null, 2)};

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
  wrap.insertAdjacentHTML('beforeend', htmlPainel.join('\\n'));
  extras.insertAdjacentHTML('beforeend', htmlExtras.join('\\n'));
}

async function carregarModulosJs() {
  const partes = await Promise.all(MODULOS_JS.map(carregarTexto));
  const codigo = partes.join('\\n;\\n');
  const blob = new Blob([codigo], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  await import(url);
}

try {
  await carregarTelas();
  await carregarModulosJs();
} catch (erro) {
  console.error('Falha ao montar o Gestor 360', erro);
  const el = document.getElementById('fatal-error');
  const msg = document.getElementById('fatal-error-msg');
  if (msg) msg.textContent = (erro && erro.message) ? erro.message : String(erro);
  if (el) el.style.display = 'block';
}
`);

console.log('\\nMódulos JS:', jsLista.length);
console.log('Pronto.');
