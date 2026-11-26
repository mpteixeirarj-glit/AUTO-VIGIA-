// Auto-Vigia — controle de manutenção veicular
// PWA offline-first · IndexedDB · sem frameworks
'use strict';

const VERSAO = self.AV_VERSAO || '?';
const DB_NAME = 'AutoVigiaDB';
const DB_VERSION = 1;
const BACKUP_FORMATO = 2;
const LS_ULTIMO_BACKUP = 'av_ultimoBackup'; // mesma origem dos outros Vigias: só chaves "av_", nunca localStorage.clear()
const DIAS_AVISO = 30;      // "próxima" quando faltam até 30 dias
const KM_AVISO = 2000;      // ... ou até 2.000 km
const DIAS_LEMBRETE_BACKUP = 30;
const HUB_URL = 'https://mpteixeirarj-glit.github.io/Vigia-energy-/';
const FINANCEIRO_URL = 'https://mpteixeirarj-glit.github.io/vigia/';

const CATEGORIES = [
  'Troca de óleo do motor',
  'Troca de óleo da transmissão/câmbio',
  'Filtros',
  'Pastilhas de freio',
  'Discos de freio',
  'Fluido de freio',
  'Pneus',
  'Bateria',
  'Sistema de arrefecimento',
  'Correias',
  'Suspensão',
  'Revisão geral',
  'Outros'
];

const ITEM_EXEMPLOS = {
  'Filtros': 'Ex.: filtro de ar, filtro de cabine',
  'Pneus': 'Ex.: rodízio, troca dianteiros',
  'Correias': 'Ex.: correia do alternador',
  'Suspensão': 'Ex.: amortecedores dianteiros',
  'Outros': 'Ex.: palhetas, alinhamento'
};

const VISCOSITIES = ['0W-20', '5W-30', '10W-30', '10W-40', '15W-40', 'Outro'];
const OIL_TYPES = ['Sintético', 'Semissintético', 'Mineral', 'Outro / não informado'];

const IMG = {
  lateral: 'img/gv-lateral.webp',
  tresQuartos: 'img/gv-34.webp',
  frontal: 'img/gv-frontal.webp',
  motor: 'img/gv-motor.webp',
  estepe: 'img/gv-traseira-estepe.webp',
  traseira: 'img/gv-traseira-pixel.webp'
};
const IMAGE_MAP = {
  'Troca de óleo do motor': IMG.motor,
  'Troca de óleo da transmissão/câmbio': IMG.motor,
  'Filtros': IMG.frontal,
  'Pastilhas de freio': IMG.traseira,
  'Discos de freio': IMG.traseira,
  'Fluido de freio': IMG.traseira,
  'Pneus': IMG.estepe,
  'Bateria': IMG.motor,
  'Sistema de arrefecimento': IMG.frontal,
  'Correias': IMG.motor,
  'Suspensão': IMG.lateral
};

// Especificações técnicas: [caminho, rótulo, valor padrão]
const SPEC_FIELDS = [
  ['oil.viscosidade', 'Óleo motor — viscosidade', '10W-40'],
  ['oil.tipo', 'Óleo motor — tipo', 'Semissintético'],
  ['oil.api', 'Óleo motor — API', 'SN'],
  ['oil.volume', 'Óleo motor — volume', '4,2 litros'],
  ['oil.intervalo', 'Óleo motor — intervalo', '7.000 a 10.000 km'],
  ['transmission.especificacao', 'Câmbio — especificação', 'ATF padrão JWS 3309 (ex.: Mobil ATF 3309)'],
  ['transmission.volume', 'Câmbio — volume (troca parcial)', '4,5 litros'],
  ['tires.medida', 'Pneus — medida', '225/65 R17'],
  ['tires.pressao', 'Pneus — pressão', ''],
  ['fuel.tipo', 'Combustível — tipo', 'Gasolina'],
  ['fuel.volume', 'Combustível — tanque', '66 litros'],
  ['brake.especificacao', 'Fluido de freio — especificação', 'DOT 4'],
  ['brake.volume', 'Fluido de freio — volume', '1 litro'],
  ['brake.intervalo', 'Fluido de freio — intervalo', '20.000 km ou 24 meses'],
  ['pads.dianteiras', 'Pastilhas dianteiras', 'Fras-le PD/1077 (equiv. Cobreq N-1399)'],
  ['pads.traseiras', 'Pastilhas traseiras', 'Fras-le PD/585 (equiv. SYL 3178)'],
  ['cooling.aditivo', 'Arrefecimento — aditivo', ''],
  ['cooling.intervalo', 'Arrefecimento — intervalo', ''],
  ['battery.especificacao', 'Bateria — especificação', ''],
  ['filters.oleo', 'Filtro de óleo', 'Mann W 68/80 (equiv. Tecfil PSL134)'],
  ['filters.ar', 'Filtro de ar', 'Tecfil ARL8824 (equiv. Mahle LX2612)'],
  ['filters.cabine', 'Filtro de cabine', 'Wega AKX1971'],
  ['wipers.dianteiras', 'Palhetas dianteiras', '19 polegadas, encaixe gancho'],
  ['wipers.traseira', 'Palheta traseira', '12 polegadas, encaixe Quick-Clip']
];

function specDe(specs, caminho) {
  const [g, k] = caminho.split('.');
  const v = specs && specs[g] && specs[g][k];
  if (v !== undefined && v !== null) return String(v);
  // spec nunca salva → valor padrão
  const def = SPEC_FIELDS.find(f => f[0] === caminho);
  return def ? def[2] : '';
}

// Dicas exibidas no formulário, montadas a partir das especificações do veículo
function dicaCategoria(cat, specs) {
  const s = c => specDe(specs, c).trim();
  const juntar = partes => partes.filter(Boolean).join(' • ');
  switch (cat) {
    case 'Troca de óleo do motor':
      return juntar([
        [s('oil.viscosidade'), s('oil.tipo'), s('oil.api') && 'API ' + s('oil.api')].filter(Boolean).join(' '),
        s('oil.volume'),
        s('oil.intervalo') && 'trocar a cada ' + s('oil.intervalo'),
        s('filters.oleo') && 'filtro: ' + s('filters.oleo')
      ]);
    case 'Troca de óleo da transmissão/câmbio':
      return juntar([s('transmission.especificacao'), s('transmission.volume') && s('transmission.volume') + ' (troca parcial)']);
    case 'Pneus':
      return juntar([s('tires.medida') && 'Medida: ' + s('tires.medida'),
        'Pressão: ' + (s('tires.pressao') || 'ver etiqueta na coluna da porta do motorista')]);
    case 'Filtros':
      return juntar([s('filters.oleo') && 'Óleo: ' + s('filters.oleo'), s('filters.ar') && 'Ar: ' + s('filters.ar'),
        s('filters.cabine') && 'Cabine: ' + s('filters.cabine')]);
    case 'Pastilhas de freio':
      return juntar([s('pads.dianteiras') && 'Dianteira: ' + s('pads.dianteiras'), s('pads.traseiras') && 'Traseira: ' + s('pads.traseiras')]);
    case 'Fluido de freio':
      return juntar([s('brake.especificacao'), s('brake.volume') && s('brake.volume') + ' por sangria',
        s('brake.intervalo') && 'trocar a cada ' + s('brake.intervalo')]);
    case 'Sistema de arrefecimento':
      return juntar([s('cooling.aditivo') && 'Aditivo: ' + s('cooling.aditivo'), s('cooling.intervalo') && 'trocar a cada ' + s('cooling.intervalo')])
        || 'Cadastre o aditivo em Veículo → Especificações. Confira o nível com o motor frio.';
    case 'Bateria':
      return s('battery.especificacao');
    default:
      return '';
  }
}

// ========== Utilidades ==========
const $ = id => document.getElementById(id);

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'className') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'value') e.value = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return e;
}

function pad2(n) { return String(n).padStart(2, '0'); }
function isoLocal(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function hojeISO() { return isoLocal(new Date()); }

function parseDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getMonth() === m - 1 ? dt : null;
}
function formatDate(str) {
  const d = parseDate(str);
  return d ? d.toLocaleDateString('pt-BR') : '—';
}
function daysUntil(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.round((d - hoje) / 86400000);
}
function somarMeses(iso, meses) {
  const d = parseDate(iso) || new Date();
  const dia = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + meses);
  const ult = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ult));
  return isoLocal(d);
}

function fmtKm(n) { return (typeof n === 'number' && isFinite(n)) ? n.toLocaleString('pt-BR') + ' km' : '—'; }
// "20/05/2027 ou 131.000 km" — só o que foi informado
function fmtPrevista(m) {
  return [m.proximaData && formatDate(m.proximaData), m.proximaQuilometragem && fmtKm(m.proximaQuilometragem)].filter(Boolean).join(' ou ') || '—';
}
function fmtNum(n) { return (typeof n === 'number' && isFinite(n)) ? n.toLocaleString('pt-BR') : ''; }
function fmtMoeda(n) { return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function parseKm(v) {
  const d = String(v ?? '').replace(/\D/g, '');
  return d ? Number(d) : null;
}
function parseMoeda(v) {
  let s = String(v ?? '').replace(/[R$\s ]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}
function plural(n, s, p) { return `${n.toLocaleString('pt-BR')} ${n === 1 ? s : p}`; }

// Máscara de milhar para campos de km
function mascaraKm(inp) {
  inp.addEventListener('input', () => {
    const n = parseKm(inp.value);
    inp.value = n === null ? '' : n.toLocaleString('pt-BR');
  });
}

// ========== Toast e confirmação (no app, sem alert/confirm) ==========
let toastTimer;
function toast(msg, tipo = '', acao) {
  const t = $('toast');
  t.replaceChildren(document.createTextNode(msg));
  t.className = tipo;
  if (acao) {
    t.appendChild(document.createTextNode(' '));
    t.appendChild(el('button', { type: 'button', className: 'btn mini', text: acao.rotulo, onclick: acao.fn }));
  }
  t.hidden = false;
  clearTimeout(toastTimer);
  if (!acao) toastTimer = setTimeout(() => { t.hidden = true; }, tipo === 'erro' ? 6000 : 3500);
}

function confirmar(msg, { sim = 'Confirmar', perigo = false } = {}) {
  return new Promise(resolve => {
    const m = $('modal'), bSim = $('modal-sim'), bNao = $('modal-nao');
    $('modal-msg').textContent = msg;
    bSim.textContent = sim;
    bSim.className = 'btn ' + (perigo ? 'perigo' : 'amarelo');
    const fechar = r => {
      m.hidden = true; bSim.onclick = bNao.onclick = m.onclick = null;
      document.removeEventListener('keydown', esc);
      resolve(r);
    };
    const esc = e => { if (e.key === 'Escape') fechar(false); };
    bSim.onclick = () => fechar(true);
    bNao.onclick = () => fechar(false);
    m.onclick = e => { if (e.target === m) fechar(false); };
    document.addEventListener('keydown', esc);
    m.hidden = false;
    bNao.focus();
  });
}

function mostrarErro(e) {
  console.error(e);
  const msg = (e && (e.message || e.name)) || String(e);
  toast('Erro: ' + msg, 'erro');
}
window.addEventListener('unhandledrejection', ev => mostrarErro(ev.reason));
window.addEventListener('error', ev => mostrarErro(ev.error || ev.message));

// ========== IndexedDB ==========
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Banco bloqueado por outra aba do app. Feche-a e tente de novo.'));
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('vehicle')) d.createObjectStore('vehicle', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('maintenances')) {
        const s = d.createObjectStore('maintenances', { keyPath: 'id', autoIncrement: true });
        s.createIndex('data', 'data');
      }
    };
  });
}

function fimTx(t) {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Gravação cancelada'));
  });
}
function req2p(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function getVehicle() {
  const t = db.transaction('vehicle', 'readonly');
  return (await req2p(t.objectStore('vehicle').get(1))) || null;
}

async function saveVehicle(v) {
  v.id = 1;
  const t = db.transaction('vehicle', 'readwrite');
  const fim = fimTx(t);
  t.objectStore('vehicle').put(v);
  await fim;
}

function ordenarManutencoes(list) {
  // mais recente primeiro: data, depois km, depois ordem de cadastro
  return list.sort((a, b) =>
    (b.data || '').localeCompare(a.data || '') ||
    ((b.quilometragem || 0) - (a.quilometragem || 0)) ||
    ((b.id || 0) - (a.id || 0)));
}

async function getMaintenances() {
  const t = db.transaction('maintenances', 'readonly');
  return ordenarManutencoes((await req2p(t.objectStore('maintenances').getAll())) || []);
}

async function getMaintenance(id) {
  const t = db.transaction('maintenances', 'readonly');
  return (await req2p(t.objectStore('maintenances').get(id))) || null;
}

async function saveMaintenance(m) {
  const agora = new Date().toISOString();
  // Registro novo: SEM a propriedade id (id: undefined faz o IndexedDB recusar a gravação)
  if (m.id === undefined || m.id === null) { delete m.id; m.criadoEm = m.criadoEm || agora; }
  m.atualizadoEm = agora;
  const t = db.transaction('maintenances', 'readwrite');
  const fim = fimTx(t);
  const id = await req2p(t.objectStore('maintenances').put(m));
  await fim;
  return id;
}

async function deleteMaintenance(id) {
  const t = db.transaction('maintenances', 'readwrite');
  const fim = fimTx(t);
  t.objectStore('maintenances').delete(id);
  await fim;
}

// ========== Lembretes / status ==========
function chaveItem(m) { return (m.categoria || '') + '|' + String(m.item || '').trim().toLowerCase(); }

// Só o registro mais recente de cada (categoria + item) vale para lembrete:
// um serviço refeito "apaga" o lembrete do anterior.
function maisRecentesPorItem(list) {
  const vistos = new Map();
  for (const m of ordenarManutencoes([...list])) {
    const k = chaveItem(m);
    if (!vistos.has(k)) vistos.set(k, m);
  }
  return [...vistos.values()];
}

function getStatus(m, kmAtual) {
  const dias = m.proximaData ? daysUntil(m.proximaData) : null;
  const kmRest = (m.proximaQuilometragem && kmAtual > 0) ? m.proximaQuilometragem - kmAtual : null;
  if (dias === null && kmRest === null) return { status: 'none', motivo: '', urgencia: Infinity };

  const vencida = (dias !== null && dias < 0) || (kmRest !== null && kmRest <= 0);
  const proxima = !vencida && ((dias !== null && dias <= DIAS_AVISO) || (kmRest !== null && kmRest <= KM_AVISO));
  const partes = [];
  if (dias !== null) {
    partes.push(dias < 0 ? `venceu há ${plural(-dias, 'dia', 'dias')}` : dias === 0 ? 'vence hoje' : `faltam ${plural(dias, 'dia', 'dias')}`);
  }
  if (kmRest !== null) {
    partes.push(kmRest <= 0 ? `passou ${(-kmRest).toLocaleString('pt-BR')} km` : `faltam ${kmRest.toLocaleString('pt-BR')} km`);
  }
  // urgência: fração do limite de aviso que ainda resta (menor = mais urgente)
  const urgencia = Math.min(dias !== null ? dias / DIAS_AVISO : Infinity, kmRest !== null ? kmRest / KM_AVISO : Infinity);
  return { status: vencida ? 'overdue' : proxima ? 'near' : 'ok', motivo: partes.join(' · '), urgencia };
}

function lembretes(list, kmAtual) {
  return maisRecentesPorItem(list)
    .map(m => ({ m, s: getStatus(m, kmAtual) }))
    .filter(x => x.s.status !== 'none')
    .sort((a, b) => a.s.urgencia - b.s.urgencia);
}

const ROTULO_STATUS = { overdue: 'Vencida', near: 'Próxima', ok: 'Em dia' };
function seloStatus(s) { return el('span', { className: `status ${s}`, text: ROTULO_STATUS[s] || '' }); }
function nomeManut(m) { return m.item ? `${m.categoria} — ${m.item}` : m.categoria; }

// ========== Navegação ==========
const SCREENS = {
  inicio: renderInicio,
  historico: renderHistorico,
  veiculo: renderVeiculo,
  km: renderKm,
  lembretes: renderLembretes,
  mais: renderMais,
  backup: renderBackup,
  sobre: renderSobre,
  form: renderForm
};
const NAV_DE = { form: 'historico', km: 'inicio', backup: 'mais', sobre: 'mais' };
let telaAtual = 'inicio';
let renderSeq = 0;

async function showScreen(screen, params = {}) {
  const seq = ++renderSeq;
  telaAtual = screen;
  const nav = NAV_DE[screen] || screen;
  document.querySelectorAll('#bottom-nav button').forEach(b => b.classList.toggle('on', b.dataset.screen === nav));
  // Renderiza fora da tela e só troca no fim: toques rápidos não duplicam conteúdo
  const frag = document.createDocumentFragment();
  try {
    await SCREENS[screen](frag, params);
  } catch (e) {
    mostrarErro(e);
    frag.appendChild(el('div', { className: 'card perigo' }, [el('p', { text: 'Não foi possível abrir esta tela.' })]));
  }
  if (seq !== renderSeq) return; // outra tela foi pedida enquanto esta carregava
  $('app').replaceChildren(frag);
  window.scrollTo(0, 0);
}

function voltar(screen) { return el('button', { type: 'button', className: 'btn full', text: '‹ Voltar', onclick: () => showScreen(screen) }); }

// ========== Início ==========
function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Boa noite!';
  if (h < 12) return 'Bom dia!';
  if (h < 18) return 'Boa tarde!';
  return 'Boa noite!';
}

function nomeVeiculo(v) {
  return v ? ([v.marca, v.modelo, v.ano].filter(Boolean).join(' ') || 'Meu veículo') : '';
}

function lerUltimoBackup() {
  try { return localStorage.getItem(LS_ULTIMO_BACKUP); } catch (e) { return null; }
}

async function renderInicio(main) {
  const [vehicle, list] = await Promise.all([getVehicle(), getMaintenances()]);
  const km = vehicle?.quilometragemAtual || 0;

  main.appendChild(el('img', { src: IMG.lateral, className: 'arte home', alt: 'Ilustração do veículo', width: 720, height: 323 }));
  main.appendChild(el('div', { className: 'saudacao', text: getGreeting() }));

  if (!vehicle) {
    main.appendChild(el('div', { className: 'card' }, [
      el('h2', { text: 'Bem-vindo' }),
      el('p', { text: 'Cadastre seu veículo para começar a registrar as manutenções e receber lembretes por data e quilometragem.' }),
      el('button', { type: 'button', className: 'btn cheio full', text: 'Cadastrar veículo', onclick: () => showScreen('veiculo') }),
      el('button', { type: 'button', className: 'btn full', text: 'Restaurar um backup', onclick: () => showScreen('backup') })
    ]));
    return;
  }

  main.appendChild(el('div', { className: 'veic-nome', text: nomeVeiculo(vehicle) }));
  main.appendChild(el('div', { className: 'veic-km', text: 'Km atual: ' + fmtKm(km) }));

  // Lembrete de backup
  const ult = lerUltimoBackup();
  const diasBackup = ult ? Math.floor((Date.now() - new Date(ult).getTime()) / 86400000) : null;
  if (list.length && (diasBackup === null || diasBackup >= DIAS_LEMBRETE_BACKUP)) {
    main.appendChild(el('div', { className: 'card alerta' }, [
      el('h3', { text: '💾 Backup', style: 'margin-top:0' }),
      el('p', { className: 'dim', text: diasBackup === null
        ? 'Você ainda não fez backup. Os dados ficam só neste aparelho: se o navegador for limpo, eles se perdem.'
        : `Último backup há ${plural(diasBackup, 'dia', 'dias')}. Faça um novo e guarde fora do celular.` }),
      el('button', { type: 'button', className: 'btn amarelo full', text: 'Fazer backup agora', onclick: () => showScreen('backup') })
    ]));
  }

  const lemb = lembretes(list, km);
  const next = lemb[0];
  const nextCard = el('div', { className: 'card' + (next?.s.status === 'overdue' ? ' perigo' : next?.s.status === 'near' ? ' alerta' : '') });
  nextCard.appendChild(el('h2', { text: '▶ Próxima manutenção' }));
  if (next) {
    nextCard.appendChild(el('div', { className: 'item' }, [
      el('div', { className: 'tit' }, [el('b', { text: nomeManut(next.m) }), seloStatus(next.s.status)]),
      el('div', { className: 'det', text: next.s.motivo }),
      el('div', { className: 'det', text: `Prevista: ${fmtPrevista(next.m)}` })
    ]));
    const outras = lemb.filter(x => x !== next && x.s.status !== 'ok').length;
    if (outras) nextCard.appendChild(el('button', { type: 'button', className: 'btn mini', style: 'margin-top:10px',
      text: `+ ${outras} ${outras === 1 ? 'lembrete' : 'lembretes'}`, onclick: () => showScreen('lembretes') }));
  } else {
    nextCard.appendChild(el('p', { className: 'dim', text: list.length
      ? 'Nenhuma manutenção com próxima data ou km prevista.'
      : 'Nenhuma manutenção registrada ainda.' }));
  }
  nextCard.appendChild(el('button', { type: 'button', className: 'btn cheio full', text: '+ Adicionar manutenção', onclick: () => showScreen('form') }));
  main.appendChild(nextCard);

  const atalhos = el('div', { className: 'atalhos' });
  [
    { e: '➕', t: 'Nova', fn: () => showScreen('form') },
    { e: '📋', t: 'Histórico', fn: () => showScreen('historico') },
    { e: '🔢', t: 'Atualizar km', fn: () => showScreen('km') },
    { e: '🔔', t: 'Lembretes', fn: () => showScreen('lembretes') }
  ].forEach(a => atalhos.appendChild(el('button', { type: 'button', className: 'atalho', onclick: a.fn }, [el('span', { className: 'e', text: a.e }), a.t])));
  main.appendChild(atalhos);

  const ano = String(new Date().getFullYear());
  const gastoAno = list.filter(m => (m.data || '').startsWith(ano)).reduce((s, m) => s + (Number(m.custo) || 0), 0);
  const resumo = el('div', { className: 'card' }, [
    el('h2', { text: '▶ Resumo' }),
    el('div', { className: 'stats' }, [
      el('div', { className: 'stat' }, [el('div', { className: 'v', text: String(list.length) }), el('div', { className: 'r', text: 'registros' })]),
      el('div', { className: 'stat' }, [el('div', { className: 'v', text: fmtMoeda(gastoAno) }), el('div', { className: 'r', text: `gasto em ${ano}` })])
    ])
  ]);
  if (list[0]) resumo.appendChild(el('p', { className: 'dim', style: 'margin-top:10px', text: `Última: ${nomeManut(list[0])} em ${formatDate(list[0].data)}` }));
  main.appendChild(resumo);
}

// ========== Atualizar km ==========
async function renderKm(main) {
  const v = await getVehicle();
  if (!v) return showScreen('veiculo');
  const card = el('div', { className: 'card' }, [el('h2', { text: '▶ Atualizar km' })]);
  const inp = el('input', { inputmode: 'numeric', autocomplete: 'off', className: 'num', value: fmtNum(v.quilometragemAtual), 'aria-label': 'Quilometragem atual' });
  mascaraKm(inp);
  const erro = el('div', { className: 'erro' });
  card.appendChild(el('p', { className: 'dim', text: `Atual registrada: ${fmtKm(v.quilometragemAtual)}` }));
  card.appendChild(el('label', { text: 'Quilometragem do painel' }));
  card.appendChild(inp);
  card.appendChild(erro);
  card.appendChild(el('button', { type: 'button', className: 'btn cheio full', text: 'Salvar', onclick: async () => {
    const n = parseKm(inp.value);
    if (!n) { erro.textContent = 'Informe a quilometragem.'; return; }
    if (n < (v.quilometragemAtual || 0) &&
        !(await confirmar(`A km informada (${fmtKm(n)}) é menor que a registrada (${fmtKm(v.quilometragemAtual)}). Salvar mesmo assim?`))) return;
    v.quilometragemAtual = n;
    await saveVehicle(v);
    toast('Km atualizada.');
    showScreen('inicio');
  } }));
  main.appendChild(card);
  main.appendChild(voltar('inicio'));
  setTimeout(() => inp.focus(), 50);
}

// ========== Histórico ==========
async function renderHistorico(main) {
  const list = await getMaintenances();

  const catSel = el('select', { 'aria-label': 'Categoria' }, [el('option', { value: '', text: 'Todas as categorias' })]);
  const cats = new Set([...CATEGORIES, ...list.map(m => m.categoria).filter(Boolean)]);
  cats.forEach(c => catSel.appendChild(el('option', { value: c, text: c })));
  const viscSel = el('select', { 'aria-label': 'Viscosidade' }, [el('option', { value: '', text: 'Qualquer viscosidade' })]);
  VISCOSITIES.filter(v => v !== 'Outro').forEach(v => viscSel.appendChild(el('option', { value: v, text: v })));
  const busca = el('input', { type: 'search', placeholder: 'Buscar: óleo, oficina, item, observação…', 'aria-label': 'Buscar' });

  main.appendChild(el('div', { className: 'filtros' }, [catSel, viscSel, el('div', { className: 'largo' }, [busca])]));
  const listDiv = el('div');
  main.appendChild(listDiv);

  const aplicar = () => {
    const cat = catSel.value, visc = viscSel.value, q = busca.value.trim().toLowerCase();
    const f = list.filter(m =>
      (!cat || m.categoria === cat) &&
      (!visc || m.oil?.viscosidade === visc) &&
      (!q || [m.categoria, m.item, m.oficina, m.observacoes, m.oil?.marca, m.oil?.viscosidade, m.oil?.tipo]
        .some(t => String(t || '').toLowerCase().includes(q))));
    renderLista(listDiv, f, list.length);
  };
  catSel.addEventListener('change', aplicar);
  viscSel.addEventListener('change', aplicar);
  busca.addEventListener('input', aplicar);
  aplicar();

  main.appendChild(el('button', { type: 'button', className: 'btn cheio full', text: '+ Nova manutenção', onclick: () => showScreen('form') }));
  main.appendChild(el('button', { type: 'button', className: 'btn full', text: '📄 Exportar PDF', onclick: exportPDF }));
}

function renderLista(container, list, total) {
  container.replaceChildren();
  if (!list.length) {
    container.appendChild(el('div', { className: 'card' }, [el('div', { className: 'vazio', text: total ? 'Nenhum registro com esses filtros.' : 'Nenhum registro ainda.' })]));
    return;
  }
  const card = el('div', { className: 'card' });
  list.forEach(m => {
    const det = [`${formatDate(m.data)} • ${fmtKm(m.quilometragem)}`];
    if (m.oficina) det.push(m.oficina);
    if (m.custo) det.push(fmtMoeda(m.custo));
    const item = el('div', { className: 'item' }, [
      el('div', { className: 'tit' }, [el('b', { text: nomeManut(m) })]),
      el('div', { className: 'det', text: det.join(' • ') })
    ]);
    if (m.oil && (m.oil.marca || m.oil.viscosidade)) {
      item.appendChild(el('div', { className: 'det', text: 'Óleo: ' + [m.oil.marca, m.oil.viscosidade, m.oil.tipo && `(${m.oil.tipo})`].filter(Boolean).join(' ') }));
    }
    if (m.proximaData || m.proximaQuilometragem) {
      item.appendChild(el('div', { className: 'det', text: `Próxima: ${fmtPrevista(m)}` }));
    }
    if (m.observacoes) item.appendChild(el('div', { className: 'obs', text: m.observacoes }));
    item.appendChild(el('div', { className: 'acoes' }, [
      el('button', { type: 'button', className: 'btn mini', text: 'Editar', onclick: () => showScreen('form', { id: m.id }) }),
      el('button', { type: 'button', className: 'btn mini perigo', text: 'Excluir', onclick: () => confirmDelete(m) })
    ]));
    card.appendChild(item);
  });
  const soma = list.reduce((s, m) => s + (Number(m.custo) || 0), 0);
  card.appendChild(el('div', { className: 'total' }, [
    el('span', { text: plural(list.length, 'registro', 'registros') }),
    el('span', {}, ['Total: ', el('span', { className: 'num', text: fmtMoeda(soma) })])
  ]));
  container.appendChild(card);
}

async function confirmDelete(m) {
  if (!(await confirmar(`Excluir "${nomeManut(m)}" de ${formatDate(m.data)}?`, { sim: 'Excluir', perigo: true }))) return;
  await deleteMaintenance(m.id);
  toast('Registro excluído.');
  showScreen('historico');
}

// ========== Veículo ==========
async function renderVeiculo(main) {
  const v = (await getVehicle()) || {};
  const novo = !v.id;
  const card = el('div', { className: 'card' });
  card.appendChild(el('img', { src: IMG.tresQuartos, className: 'arte secao', alt: '', width: 720, height: 428 }));
  card.appendChild(el('h2', { text: novo ? '▶ Cadastrar veículo' : '▶ Meu veículo' }));

  const form = el('form', { novalidate: true });
  const campos = {};
  const campo = (name, label, attrs = {}) => {
    form.appendChild(el('label', { text: label, for: 'v-' + name }));
    const inp = el(attrs.tag || 'input', { id: 'v-' + name, name, ...attrs, tag: undefined });
    form.appendChild(inp);
    campos[name] = inp;
    return inp;
  };
  campo('marca', 'Marca', { value: v.marca || '', autocomplete: 'off' });
  campo('modelo', 'Modelo', { value: v.modelo || '', autocomplete: 'off' });
  campo('ano', 'Ano', { type: 'number', inputmode: 'numeric', min: 1950, max: new Date().getFullYear() + 1, value: v.ano || '' });
  campo('motorizacao', 'Motorização (opcional)', { value: v.motorizacao || '' });
  campo('transmissao', 'Transmissão (opcional)', { value: v.transmissao || '' });
  const kmInp = campo('quilometragemAtual', 'Quilometragem atual', { inputmode: 'numeric', className: 'num', placeholder: 'Ex.: 85.000', value: fmtNum(v.quilometragemAtual) });
  mascaraKm(kmInp);
  campo('observacoes', 'Observações', { tag: 'textarea', value: v.observacoes || '' });

  const det = el('details', { open: novo });
  det.appendChild(el('summary', { className: 'pixel', style: 'font-size:9px;color:var(--amarelo);margin-top:16px;cursor:pointer;line-height:1.6', text: 'Especificações técnicas' }));
  det.appendChild(el('p', { className: 'dim', style: 'margin-top:6px', text: 'Usadas nas dicas do formulário de manutenção.' }));
  const specInputs = {};
  SPEC_FIELDS.forEach(([caminho, label]) => {
    const id = 'spec-' + caminho.replace('.', '-');
    det.appendChild(el('label', { text: label, for: id }));
    const inp = el('input', { id, value: specDe(v.specs, caminho), autocomplete: 'off' });
    specInputs[caminho] = inp;
    det.appendChild(inp);
  });
  form.appendChild(det);

  const erro = el('div', { className: 'erro' });
  form.appendChild(erro);
  form.appendChild(el('button', { type: 'submit', className: 'btn cheio full', text: 'Salvar' }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erro.textContent = '';
    form.querySelectorAll('.invalido').forEach(x => x.classList.remove('invalido'));
    const falha = (inp, msg) => { inp.classList.add('invalido'); erro.textContent = msg; inp.focus(); };

    const ano = campos.ano.value ? Number(campos.ano.value) : null;
    const km = parseKm(kmInp.value) || 0;
    if (!campos.marca.value.trim() && !campos.modelo.value.trim()) return falha(campos.modelo, 'Informe ao menos a marca ou o modelo.');
    if (ano !== null && (ano < 1950 || ano > new Date().getFullYear() + 1)) return falha(campos.ano, 'Ano inválido.');

    const list = await getMaintenances();
    const kmMax = Math.max(0, ...list.map(m => m.quilometragem || 0));
    if (km && km < kmMax &&
        !(await confirmar(`A km atual (${fmtKm(km)}) é menor que a de uma manutenção já registrada (${fmtKm(kmMax)}). Salvar mesmo assim?`))) return;

    const specs = {};
    SPEC_FIELDS.forEach(([caminho]) => {
      const [g, k] = caminho.split('.');
      (specs[g] = specs[g] || {})[k] = specInputs[caminho].value.trim();
    });
    await saveVehicle({
      ...v,
      marca: campos.marca.value.trim(),
      modelo: campos.modelo.value.trim(),
      ano,
      motorizacao: campos.motorizacao.value.trim(),
      transmissao: campos.transmissao.value.trim(),
      quilometragemAtual: km,
      observacoes: campos.observacoes.value.trim(),
      specs
    });
    pedirArmazenamentoPersistente();
    toast('Veículo salvo.');
    showScreen('inicio');
  });

  card.appendChild(form);
  main.appendChild(card);
}

// ========== Lembretes ==========
async function renderLembretes(main) {
  const [vehicle, list] = await Promise.all([getVehicle(), getMaintenances()]);
  const km = vehicle?.quilometragemAtual || 0;
  main.appendChild(el('img', { src: IMG.tresQuartos, className: 'arte pequena', alt: '', width: 720, height: 428 }));

  const todos = lembretes(list, km);
  const ativos = todos.filter(x => x.s.status !== 'ok');
  const emDia = todos.filter(x => x.s.status === 'ok');

  const item = ({ m, s }) => el('div', { className: 'item' }, [
    el('div', { className: 'tit' }, [el('b', { text: nomeManut(m) }), seloStatus(s.status)]),
    el('div', { className: 'det', text: s.motivo }),
    el('div', { className: 'det', text: `Prevista: ${fmtPrevista(m)} • feita em ${formatDate(m.data)}` }),
    el('div', { className: 'acoes' }, [
      el('button', { type: 'button', className: 'btn mini', text: '✔ Registrar feita',
        onclick: () => showScreen('form', { categoria: m.categoria, item: m.item }) })
    ])
  ]);

  const card = el('div', { className: 'card' }, [el('h2', { text: '▶ Lembretes' })]);
  if (!km) card.appendChild(el('p', { className: 'dim', style: 'margin-bottom:8px', text: 'Cadastre a km atual do veículo para ativar os lembretes por quilometragem.' }));
  if (!ativos.length) card.appendChild(el('div', { className: 'vazio', text: 'Nenhuma manutenção vencida ou próxima. 👍' }));
  ativos.forEach(x => card.appendChild(item(x)));
  main.appendChild(card);

  if (emDia.length) {
    const c2 = el('div', { className: 'card' }, [el('h2', { text: '▶ Em dia' })]);
    emDia.forEach(x => c2.appendChild(item(x)));
    main.appendChild(c2);
  }
  main.appendChild(el('p', { className: 'dim', style: 'text-align:center', text: `Aviso com ${DIAS_AVISO} dias ou ${KM_AVISO.toLocaleString('pt-BR')} km de antecedência. Só o registro mais recente de cada item conta.` }));
}

// ========== Formulário de manutenção ==========
async function renderForm(main, params = {}) {
  const editId = params.id || null;
  const [vehicle, original] = await Promise.all([getVehicle(), editId ? getMaintenance(editId) : null]);
  if (editId && !original) { toast('Registro não encontrado.', 'erro'); return showScreen('historico'); }
  const m = original || { categoria: params.categoria || '', item: params.item || '' };
  const kmVeic = vehicle?.quilometragemAtual || 0;

  const card = el('div', { className: 'card' });
  card.appendChild(el('h2', { text: editId ? '▶ Editar manutenção' : '▶ Nova manutenção' }));
  const arte = el('img', { className: 'arte secao', alt: '', hidden: true });
  card.appendChild(arte);

  const form = el('form', { novalidate: true });
  const lbl = (t, f) => form.appendChild(el('label', { text: t, for: f }));

  lbl('Tipo', 'f-cat');
  const cat = el('select', { id: 'f-cat' }, [el('option', { value: '', text: 'Selecione…' })]);
  const cats = CATEGORIES.includes(m.categoria) || !m.categoria ? CATEGORIES : [...CATEGORIES, m.categoria];
  cats.forEach(c => cat.appendChild(el('option', { value: c, text: c, selected: m.categoria === c })));
  form.appendChild(cat);
  const dica = el('div', { className: 'dica', hidden: true });
  form.appendChild(dica);

  lbl('Item (opcional — separa lembretes da mesma categoria)', 'f-item');
  const itemInp = el('input', { id: 'f-item', value: m.item || '', autocomplete: 'off' });
  form.appendChild(itemInp);

  lbl('Data do serviço', 'f-data');
  const dataInp = el('input', { id: 'f-data', type: 'date', max: hojeISO(), value: m.data || (editId ? '' : hojeISO()) });
  form.appendChild(dataInp);

  lbl('Quilometragem no serviço', 'f-km');
  const kmInp = el('input', { id: 'f-km', inputmode: 'numeric', className: 'num', placeholder: 'Ex.: 85.000',
    value: fmtNum(editId ? m.quilometragem : kmVeic || null) });
  mascaraKm(kmInp);
  form.appendChild(kmInp);

  const linha = el('div', { className: 'linha' });
  const colOf = el('div'), colCu = el('div');
  colOf.appendChild(el('label', { text: 'Oficina (opcional)', for: 'f-of' }));
  const ofInp = el('input', { id: 'f-of', value: m.oficina || '' });
  colOf.appendChild(ofInp);
  colCu.appendChild(el('label', { text: 'Custo R$ (opcional)', for: 'f-custo' }));
  const custoInp = el('input', { id: 'f-custo', inputmode: 'decimal', className: 'num', placeholder: '0,00',
    value: m.custo ? m.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '' });
  colCu.appendChild(custoInp);
  linha.appendChild(colOf); linha.appendChild(colCu);
  form.appendChild(linha);

  // Próxima
  form.appendChild(el('h3', { text: 'Próxima (lembrete)' }));
  lbl('Próxima data (opcional)', 'f-pd');
  const pd = el('input', { id: 'f-pd', type: 'date', value: m.proximaData || '' });
  form.appendChild(pd);
  const atalhosData = el('div', { className: 'acoes', style: 'display:flex;gap:6px;margin-top:6px;flex-wrap:wrap' });
  [6, 12, 24].forEach(n => atalhosData.appendChild(el('button', { type: 'button', className: 'btn mini', text: `+${n} meses`,
    onclick: () => { pd.value = somarMeses(dataInp.value || hojeISO(), n); } })));
  form.appendChild(atalhosData);

  lbl('Próxima quilometragem (opcional)', 'f-pk');
  const pk = el('input', { id: 'f-pk', inputmode: 'numeric', className: 'num', placeholder: 'Ex.: 95.000', value: fmtNum(m.proximaQuilometragem) });
  mascaraKm(pk);
  form.appendChild(pk);
  const atalhosKm = el('div', { style: 'display:flex;gap:6px;margin-top:6px;flex-wrap:wrap' });
  [5000, 10000, 20000].forEach(n => atalhosKm.appendChild(el('button', { type: 'button', className: 'btn mini', text: `+${n / 1000} mil km`,
    onclick: () => { const base = parseKm(kmInp.value) || kmVeic; pk.value = (base + n).toLocaleString('pt-BR'); } })));
  form.appendChild(atalhosKm);

  // Óleo
  const oilDiv = el('div', { hidden: true });
  oilDiv.appendChild(el('h3', { text: 'Detalhes do óleo' }));
  oilDiv.appendChild(el('label', { text: 'Marca', for: 'f-om' }));
  const om = el('input', { id: 'f-om', value: m.oil?.marca || '' });
  oilDiv.appendChild(om);
  oilDiv.appendChild(el('label', { text: 'Viscosidade', for: 'f-ov' }));
  const viscCustom = m.oil?.viscosidade && !VISCOSITIES.includes(m.oil.viscosidade);
  const ov = el('select', { id: 'f-ov' }, [el('option', { value: '', text: 'Selecione…' })]);
  VISCOSITIES.forEach(v => ov.appendChild(el('option', { value: v, text: v, selected: viscCustom ? v === 'Outro' : m.oil?.viscosidade === v })));
  oilDiv.appendChild(ov);
  const ovc = el('input', { placeholder: 'Viscosidade (ex.: 5W-40)', style: 'margin-top:6px', value: viscCustom ? m.oil.viscosidade : '', 'aria-label': 'Viscosidade personalizada' });
  oilDiv.appendChild(ovc);
  const syncVisc = () => { ovc.hidden = ov.value !== 'Outro'; };
  ov.addEventListener('change', syncVisc); syncVisc();
  oilDiv.appendChild(el('label', { text: 'Tipo de óleo', for: 'f-ot' }));
  const ot = el('select', { id: 'f-ot' }, [el('option', { value: '', text: 'Selecione…' })]);
  OIL_TYPES.forEach(t => ot.appendChild(el('option', { value: t, text: t, selected: m.oil?.tipo === t })));
  oilDiv.appendChild(ot);
  const linhaOil = el('div', { className: 'linha' });
  const cApi = el('div'), cAcea = el('div');
  cApi.appendChild(el('label', { text: 'API (opcional)', for: 'f-api' }));
  const api = el('input', { id: 'f-api', value: m.oil?.classificacaoAPI || '' });
  cApi.appendChild(api);
  cAcea.appendChild(el('label', { text: 'ACEA (opcional)', for: 'f-acea' }));
  const acea = el('input', { id: 'f-acea', value: m.oil?.classificacaoACEA || '' });
  cAcea.appendChild(acea);
  linhaOil.appendChild(cApi); linhaOil.appendChild(cAcea);
  oilDiv.appendChild(linhaOil);
  form.appendChild(oilDiv);

  lbl('Observações', 'f-obs');
  const obs = el('textarea', { id: 'f-obs', value: m.observacoes || '' });
  form.appendChild(obs);

  const ehOleo = () => /óleo|oleo/i.test(cat.value);
  const atualizarCategoria = () => {
    const txt = dicaCategoria(cat.value, vehicle?.specs);
    dica.textContent = txt ? '💡 ' + txt : '';
    dica.hidden = !txt;
    const src = cat.value ? (IMAGE_MAP[cat.value] || IMG.tresQuartos) : '';
    arte.hidden = !src;
    if (src && arte.getAttribute('src') !== src) arte.src = src;
    oilDiv.hidden = !ehOleo();
    itemInp.placeholder = ITEM_EXEMPLOS[cat.value] || '';
  };
  cat.addEventListener('change', atualizarCategoria);
  atualizarCategoria();

  const erro = el('div', { className: 'erro', role: 'alert' });
  form.appendChild(erro);
  form.appendChild(el('button', { type: 'submit', className: 'btn cheio full', text: 'Salvar' }));
  form.appendChild(el('button', { type: 'button', className: 'btn full', text: 'Cancelar', onclick: () => showScreen(editId ? 'historico' : 'inicio') }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erro.textContent = '';
    form.querySelectorAll('.invalido').forEach(x => x.classList.remove('invalido'));
    const falha = (inp, msg) => { inp.classList.add('invalido'); erro.textContent = msg; inp.focus(); toast(msg, 'erro'); };

    const km = parseKm(kmInp.value);
    const proxKm = parseKm(pk.value);
    const custo = parseMoeda(custoInp.value);
    if (!cat.value) return falha(cat, 'Selecione o tipo de manutenção.');
    if (!parseDate(dataInp.value)) return falha(dataInp, 'Informe a data do serviço.');
    if (dataInp.value > hojeISO()) return falha(dataInp, 'A data do serviço não pode ser no futuro.');
    if (!km) return falha(kmInp, 'Informe a quilometragem no serviço.');
    if (pd.value && !parseDate(pd.value)) return falha(pd, 'Próxima data inválida.');
    if (pd.value && pd.value <= dataInp.value) return falha(pd, 'A próxima data deve ser depois da data do serviço.');
    if (proxKm !== null && proxKm <= km) return falha(pk, 'A próxima km deve ser maior que a km do serviço.');
    if (Number.isNaN(custo)) return falha(custoInp, 'Custo inválido. Use, por exemplo, 350,00.');
    if (kmVeic && km > kmVeic + 50000 &&
        !(await confirmar(`A km do serviço (${fmtKm(km)}) está muito acima da km atual do veículo (${fmtKm(kmVeic)}). Confere?`))) return;

    const maint = {
      categoria: cat.value,
      item: itemInp.value.trim(),
      data: dataInp.value,
      quilometragem: km,
      oficina: ofInp.value.trim(),
      custo: custo || 0,
      observacoes: obs.value.trim(),
      proximaData: pd.value || null,
      proximaQuilometragem: proxKm
    };
    if (editId) { maint.id = editId; maint.criadoEm = original.criadoEm; }
    if (ehOleo() && (om.value.trim() || ov.value)) {
      maint.oil = {
        marca: om.value.trim(),
        viscosidade: ov.value === 'Outro' ? ovc.value.trim() : ov.value,
        tipo: ot.value,
        classificacaoAPI: api.value.trim(),
        classificacaoACEA: acea.value.trim()
      };
    }
    await saveMaintenance(maint);

    // km do veículo acompanha o registro mais alto
    if (vehicle && km > kmVeic) {
      vehicle.quilometragemAtual = km;
      await saveVehicle(vehicle);
      toast(`Salvo. Km do veículo atualizada para ${fmtKm(km)}.`);
    } else {
      toast('Manutenção salva.');
    }
    pedirArmazenamentoPersistente();
    showScreen('historico');
  });

  card.appendChild(form);
  main.appendChild(card);
}

// ========== Mais ==========
async function renderMais(main) {
  const card = el('div', { className: 'card' }, [el('h2', { text: '▶ Mais opções' })]);
  const itens = [
    { e: '💾', t: 'Backup e dados', fn: () => showScreen('backup') },
    { e: '📄', t: 'Exportar PDF', fn: exportPDF },
    { e: 'ℹ️', t: 'Sobre e versões', fn: () => showScreen('sobre') }
  ];
  itens.forEach(i => card.appendChild(el('button', { type: 'button', className: 'mais-item', onclick: i.fn },
    [el('span', { className: 'e', text: i.e }), i.t, el('span', { className: 'seta', text: '›' })])));
  card.appendChild(el('a', { className: 'mais-item', href: HUB_URL },
    [el('span', { className: 'e', text: '🧭' }), 'Voltar ao HUB Vigia', el('span', { className: 'seta', text: '›' })]));
  main.appendChild(card);
  main.appendChild(el('p', { className: 'pixel', style: 'text-align:center;font-size:8px;color:var(--dim)', text: 'AUTO-VIGIA v' + VERSAO }));
}

// ========== Backup ==========
async function renderBackup(main) {
  const card = el('div', { className: 'card' }, [el('h2', { text: '▶ Backup e dados' })]);
  const ult = lerUltimoBackup();
  card.appendChild(el('p', { className: 'dim', text: 'Seus dados ficam só neste aparelho. Exporte um arquivo de backup e guarde fora do celular (Drive, e-mail, computador).' }));
  card.appendChild(el('p', { className: 'dim', style: 'margin-top:6px', text: 'Último backup: ' + (ult ? new Date(ult).toLocaleString('pt-BR') : 'nunca') }));
  const persist = el('p', { className: 'dim', style: 'margin-top:6px' });
  card.appendChild(persist);
  if (navigator.storage?.persisted) {
    navigator.storage.persisted().then(p => {
      persist.textContent = p ? '✔ Armazenamento protegido: o navegador não apaga os dados sozinho.'
        : '⚠ Armazenamento não protegido: instale o app na tela inicial e faça backups.';
    }).catch(() => {});
  }
  card.appendChild(el('button', { type: 'button', className: 'btn cheio full', text: 'Exportar backup', onclick: exportBackup }));

  card.appendChild(el('h3', { text: 'Restaurar' }));
  const file = el('input', { type: 'file', accept: '.json,application/json', 'aria-label': 'Arquivo de backup' });
  card.appendChild(file);
  card.appendChild(el('button', { type: 'button', className: 'btn amarelo full', text: 'Restaurar backup', onclick: () => restoreBackup(file) }));
  card.appendChild(el('p', { className: 'dim', style: 'margin-top:8px', text: 'A restauração substitui TODOS os dados atuais. O arquivo é conferido antes; se algo falhar, nada é alterado.' }));
  main.appendChild(card);
  main.appendChild(voltar('mais'));
}

function baixarArquivo(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: nome, style: 'display:none' });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}

async function exportBackup() {
  const [vehicle, maintenances] = await Promise.all([getVehicle(), getMaintenances()]);
  const backup = { app: 'auto-vigia', version: BACKUP_FORMATO, appVersion: VERSAO, exportedAt: new Date().toISOString(), vehicle, maintenances };
  baixarArquivo(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), `auto-vigia-backup-${hojeISO()}.json`);
  try { localStorage.setItem(LS_ULTIMO_BACKUP, new Date().toISOString()); } catch (e) { /* armazenamento indisponível */ }
  toast('Backup exportado.');
}

// Valida e normaliza um registro vindo de arquivo. Lança erro se inválido.
function normalizarManutencao(m, i) {
  if (!m || typeof m !== 'object') throw new Error(`registro ${i + 1} inválido`);
  if (typeof m.categoria !== 'string' || !m.categoria.trim()) throw new Error(`registro ${i + 1} sem categoria`);
  if (!parseDate(m.data)) throw new Error(`registro ${i + 1} com data inválida`);
  const num = v => (v === null || v === undefined || v === '') ? null : (isFinite(Number(v)) ? Number(v) : null);
  const str = v => (v === null || v === undefined) ? '' : String(v);
  const out = {
    categoria: m.categoria.trim(),
    item: str(m.item),
    data: m.data,
    quilometragem: num(m.quilometragem),
    oficina: str(m.oficina),
    custo: num(m.custo) || 0,
    observacoes: str(m.observacoes),
    proximaData: parseDate(m.proximaData) ? m.proximaData : null,
    proximaQuilometragem: num(m.proximaQuilometragem),
    criadoEm: typeof m.criadoEm === 'string' ? m.criadoEm : new Date().toISOString(),
    atualizadoEm: typeof m.atualizadoEm === 'string' ? m.atualizadoEm : new Date().toISOString()
  };
  if (Number.isInteger(m.id) && m.id > 0) out.id = m.id;
  if (m.oil && typeof m.oil === 'object') {
    out.oil = { marca: str(m.oil.marca), viscosidade: str(m.oil.viscosidade), tipo: str(m.oil.tipo),
      classificacaoAPI: str(m.oil.classificacaoAPI), classificacaoACEA: str(m.oil.classificacaoACEA) };
  }
  return out;
}

async function restoreBackup(fileInput) {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return toast('Selecione o arquivo de backup.', 'erro');
  let vehicle, maints;
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== 'object' || !data.version || !Array.isArray(data.maintenances)) throw new Error('não é um backup do Auto-Vigia');
    if (data.vehicle !== null && data.vehicle !== undefined && typeof data.vehicle !== 'object') throw new Error('veículo inválido');
    maints = data.maintenances.map(normalizarManutencao);
    vehicle = data.vehicle ? { ...data.vehicle, id: 1 } : null;
    if (vehicle) vehicle.quilometragemAtual = Number(vehicle.quilometragemAtual) || 0;
  } catch (err) {
    return toast('Arquivo inválido (' + (err.message || 'erro de leitura') + '). Nada foi alterado.', 'erro');
  }
  const resumo = `${vehicle ? nomeVeiculo(vehicle) : 'sem veículo'} • ${plural(maints.length, 'manutenção', 'manutenções')}`;
  if (!(await confirmar(`Restaurar backup?\n${resumo}\n\nTODOS os dados atuais serão substituídos.`, { sim: 'Restaurar', perigo: true }))) return;

  // Uma única transação para os dois stores: ou grava tudo, ou nada
  const t = db.transaction(['vehicle', 'maintenances'], 'readwrite');
  const fim = fimTx(t);
  try {
    const sv = t.objectStore('vehicle'), sm = t.objectStore('maintenances');
    sv.clear(); sm.clear();
    if (vehicle) sv.put(vehicle);
    maints.forEach(m => sm.put(m));
    await fim;
  } catch (err) {
    try { t.abort(); } catch (e) { /* já encerrada */ }
    return toast('Falha ao restaurar (' + (err?.message || err) + '). Dados atuais mantidos.', 'erro');
  }
  toast('Backup restaurado.');
  showScreen('inicio');
}

// ========== Sobre ==========
async function renderSobre(main) {
  const card = el('div', { className: 'card' });
  card.appendChild(el('img', { src: IMG.tresQuartos, className: 'arte pequena', alt: 'Ilustração do veículo', width: 720, height: 428 }));
  card.appendChild(el('h2', { text: '▶ Sobre', style: 'text-align:center' }));
  card.appendChild(el('p', { className: 'versao-atual' }, ['Versão instalada: ', el('b', { text: VERSAO })]));
  card.appendChild(el('p', { className: 'dim', style: 'margin-top:4px', text: 'Controle de manutenção do seu veículo. Funciona offline; dados guardados neste aparelho.' }));

  const nov = el('div', { className: 'novidades' });
  (self.AV_NOVIDADES || []).forEach(n => {
    nov.appendChild(el('h4', {}, ['v' + n.v, n.data ? el('small', { text: n.data }) : null]));
    nov.appendChild(el('ul', {}, n.itens.map(t => el('li', { text: t }))));
  });
  card.appendChild(el('h3', { text: 'Histórico de versões' }));
  card.appendChild(nov);
  main.appendChild(card);

  const eco = el('div', { className: 'card eco' }, [el('h2', { text: '▶ Ecossistema Vigia' })]);
  [
    { e: '🧭', t: 'HUB Vigia', d: 'Escolher outro app Vigia', href: HUB_URL },
    { e: '⚡', t: 'Vigia Energy', d: 'Consumo de energia elétrica', href: HUB_URL + 'energy/' },
    { e: '💰', t: 'Vigia Financeiro', d: 'Finanças pessoais', href: FINANCEIRO_URL },
    { e: '🚗', t: 'Auto-Vigia', d: 'Você está aqui', atual: true }
  ].forEach(x => eco.appendChild(el('a', { href: x.href || '#', className: x.atual ? 'atual' : '', 'aria-current': x.atual ? 'page' : null,
    onclick: x.atual ? (e => e.preventDefault()) : null },
    [el('span', { className: 'e', text: x.e }), el('span', {}, [el('div', { className: 't', text: x.t }), el('div', { className: 'd', text: x.d })])])));
  eco.appendChild(el('p', { className: 'dim', style: 'margin-top:12px;text-align:center', text: 'Desenvolvido por Marcos • Rio de Janeiro' }));
  main.appendChild(eco);
  main.appendChild(voltar('mais'));
}

// ========== PDF ==========
// Fontes padrão do PDF só têm Latin-1: troca o resto (travessão, emoji…)
function pdfTxt(s) {
  return String(s ?? '')
    .replace(/[–—]/g, '-').replace(/[•·]/g, '|').replace(/[  ]/g, ' ')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...')
    .replace(/[^\x00-\xff]/g, '');
}

async function exportPDF() {
  if (!window.jspdf?.jsPDF) return toast('Gerador de PDF não carregou. Recarregue o app.', 'erro');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const [vehicle, list] = await Promise.all([getVehicle(), getMaintenances()]);
  const M = 14, W = 210 - 2 * M, FIM = 282;
  let y = 18;

  const escrever = (texto, { size = 10, bold = false, cor = [30, 30, 30], recuo = 0, apos = 1.5 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...cor);
    const linhas = doc.splitTextToSize(pdfTxt(texto), W - recuo);
    const alt = size * 0.42;
    linhas.forEach(l => {
      if (y > FIM) { doc.addPage(); y = 18; }
      doc.text(l, M + recuo, y);
      y += alt;
    });
    y += apos;
  };
  const regua = () => { if (y > FIM) { doc.addPage(); y = 18; } doc.setDrawColor(200); doc.line(M, y, M + W, y); y += 5; };

  escrever('Auto-Vigia - Histórico de manutenção', { size: 16, bold: true, apos: 3 });
  escrever(nomeVeiculo(vehicle) || 'Veículo não cadastrado', { size: 11, bold: true });
  escrever(`Km atual: ${fmtKm(vehicle?.quilometragemAtual)}   |   Gerado em ${new Date().toLocaleString('pt-BR')}   |   App v${VERSAO}`, { size: 9, cor: [90, 90, 90], apos: 4 });

  const lemb = lembretes(list, vehicle?.quilometragemAtual || 0);
  if (lemb.length) {
    regua();
    escrever('Próximas manutenções', { size: 12, bold: true, apos: 2 });
    lemb.forEach(({ m, s }) => {
      escrever(`[${ROTULO_STATUS[s.status]}] ${nomeManut(m)}: ${fmtPrevista(m)} (${s.motivo})`,
        { size: 9.5, cor: s.status === 'overdue' ? [180, 0, 0] : s.status === 'near' ? [150, 110, 0] : [30, 30, 30], apos: 1 });
    });
    y += 3;
  }

  regua();
  escrever(`Histórico (${plural(list.length, 'registro', 'registros')})`, { size: 12, bold: true, apos: 2 });
  if (!list.length) escrever('Nenhum registro.', { size: 10, cor: [90, 90, 90] });
  list.forEach((m, i) => {
    if (y > FIM - 14) { doc.addPage(); y = 18; }
    escrever(`${i + 1}. ${formatDate(m.data)} - ${nomeManut(m)}`, { size: 10.5, bold: true, apos: 0.8 });
    const det = [`Km: ${fmtKm(m.quilometragem)}`];
    if (m.oficina) det.push(`Oficina: ${m.oficina}`);
    if (m.custo) det.push(`Custo: ${fmtMoeda(m.custo)}`);
    escrever(det.join('   |   '), { size: 9.5, recuo: 4, apos: 0.8 });
    if (m.oil && (m.oil.marca || m.oil.viscosidade)) {
      escrever(`Óleo: ${[m.oil.marca, m.oil.viscosidade, m.oil.tipo].filter(Boolean).join(' ')}   API: ${m.oil.classificacaoAPI || '-'}   ACEA: ${m.oil.classificacaoACEA || '-'}`, { size: 9.5, recuo: 4, apos: 0.8 });
    }
    if (m.proximaData || m.proximaQuilometragem) {
      escrever(`Próxima: ${fmtPrevista(m)}`, { size: 9.5, recuo: 4, apos: 0.8 });
    }
    if (m.observacoes) escrever(`Obs.: ${m.observacoes}`, { size: 9.5, recuo: 4, cor: [90, 90, 90], apos: 0.8 });
    y += 3;
  });

  const total = list.reduce((s, m) => s + (Number(m.custo) || 0), 0);
  if (total) { regua(); escrever(`Total gasto registrado: ${fmtMoeda(total)}`, { size: 11, bold: true }); }

  const pags = doc.getNumberOfPages();
  for (let p = 1; p <= pags; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(140);
    doc.text(`Página ${p} de ${pags}`, 210 - M, 292, { align: 'right' });
  }
  doc.save(`auto-vigia-${hojeISO()}.pdf`);
  toast('PDF gerado.');
}

// ========== Relógio e versão no topo ==========
function atualizarRelogio() {
  const agora = new Date();
  const dia = agora.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const data = agora.toLocaleDateString('pt-BR');
  const hora = agora.toLocaleTimeString('pt-BR');
  $('relogio').textContent = `${dia.charAt(0).toUpperCase() + dia.slice(1)}, ${data}   ${hora}`;
}

// ========== Armazenamento persistente ==========
function pedirArmazenamentoPersistente() {
  try { navigator.storage?.persist?.().catch(() => {}); } catch (e) { /* sem suporte */ }
}

// ========== Service worker ==========
function registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  const tinhaControle = !!navigator.serviceWorker.controller;
  let avisado = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Primeira instalação: nada a fazer. Atualização: recarrega para usar a versão nova.
    if (!tinhaControle || avisado) return;
    avisado = true;
    if (['form', 'veiculo', 'km'].includes(telaAtual)) {
      toast('Nova versão disponível.', '', { rotulo: 'Atualizar', fn: () => location.reload() });
    } else {
      location.reload();
    }
  });
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker não registrado:', e));
}

// ========== Início do app ==========
async function init() {
  $('versao-topo').textContent = 'v' + VERSAO;
  atualizarRelogio();
  setInterval(atualizarRelogio, 1000);
  document.querySelectorAll('#bottom-nav button').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.screen));
  });
  try {
    await openDB();
  } catch (e) {
    mostrarErro(e);
    $('app').replaceChildren(el('div', { className: 'card perigo' }, [
      el('h2', { text: 'Erro' }),
      el('p', { text: 'Não foi possível abrir o banco de dados do app. Se estiver em aba anônima, abra em uma aba normal.' })
    ]));
    return;
  }
  registrarSW();
  showScreen('inicio');
}

init();
