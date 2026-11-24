import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');
const lines = html.split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join('\n');

const novo = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover">
    <title>FH Construções</title>
    <meta name="description" content="Ponto digital, vales e gestão — FH Construções / Gestor 360 (painel RH).">
    <link rel="manifest" href="./manifest.json">
    <link rel="apple-touch-icon" href="https://i.postimg.cc/zDRJMSTn/69420f5a-5b80-457e-8146-00485162d7f2.jpg">
    <link rel="icon" type="image/jpeg" href="https://i.postimg.cc/zDRJMSTn/69420f5a-5b80-457e-8146-00485162d7f2.jpg">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="theme-color" content="#1a2a43">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="./css/base.css?v=23">
    <link rel="stylesheet" href="./css/painel.css?v=23">
    <link rel="stylesheet" href="./css/assistente.css?v=23">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/signature_pad@4.1.7/dist/signature_pad.umd.min.js"></script>
    <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
</head>
<body>
<script src="./js/boot-erro.js?v=23"></script>
<script src="./js/boot-atualizacao.js?v=23"></script>

${slice(3517, 3533)}

${slice(3557, 3698)}
        </div>
    </div>
    </div>
</div>

<div id="telas-extras"></div>

${slice(5554, 5624)}

<script type="module" src="./js/carregar.js?v=23"></script>
</body>
</html>
`;

fs.writeFileSync('index.html', novo, 'utf8');
console.log('index.html', (novo.length / 1024).toFixed(1), 'KB', novo.split(/\n/).length, 'linhas');
