const base = 'http://localhost:4173/';

async function get(p) {
  const r = await fetch(base + p);
  const t = await r.text();
  return { status: r.status, bytes: t.length, text: t };
}

const checks = [
  '',
  'css/base.css',
  'css/painel.css',
  'css/assistente.css',
  'js/carregar.js',
  'js/api/firebase.js',
  'js/modulos/holerite.js',
  'js/modulos/ponto.js',
  'telas/holerite.html',
  'telas/inicio.html',
  'telas/folha.html',
  'app-version.json'
];

for (const p of checks) {
  const r = await get(p);
  console.log(r.status, String(r.bytes).padStart(8), p || '/');
}

const idx = await get('');
console.log('index has carregar.js', idx.text.includes('js/carregar.js'));
console.log('index has inline style', idx.text.includes('<style>'));
console.log('index has aba-holerites', idx.text.includes('aba-holerites'));
console.log('index has gestor-carregando', idx.text.includes('gestor-carregando'));

const hol = await get('telas/holerite.html');
console.log('tela holerite id', hol.text.includes('id="aba-holerites"'));

const fb = await get('js/api/firebase.js');
console.log('firebase import', fb.text.includes('initializeApp'));

const lista = JSON.parse((await get('js/modulos.json')).text.replace(/^<!--[\s\S]*?-->\s*/, ''));
const partes = [];
for (const p of lista) {
  const r = await get(p);
  partes.push(r.text.replace(/^\/\*[\s\S]*?\*\/\s*/, ''));
}
const codigo = partes.join('\n;\n');
console.log('js concatenado KB', (codigo.length / 1024).toFixed(1));
console.log('comeca com import', /^\s*import\s/.test(codigo));
const abres = (codigo.match(/\{/g) || []).length;
const fechas = (codigo.match(/\}/g) || []).length;
console.log('chaves { }', abres, fechas, 'diff', abres - fechas);
