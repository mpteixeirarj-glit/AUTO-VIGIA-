// Auto-Vigia v0.3.1
// IndexedDB | PWA | Correções: OIL_TYPES, onchange único, remoção de apelido

const DB_NAME = 'AutoVigiaDB';
const DB_VERSION = 1;
const BACKUP_VERSION = '1.0';
let db;

const CATEGORIES = [
  'Troca de óleo do motor',
  'Troca de óleo da transmissão/câmbio',
  'Filtros',
  'Pastilhas de freio',
  'Discos de freio',
  'Pneus',
  'Bateria',
  'Sistema de arrefecimento',
  'Correias',
  'Suspensão',
  'Revisão geral',
  'Outros'
];

const VISCOSITIES = ['0W-20', '5W-30', '10W-30', '10W-40', '15W-40', 'Outro'];
const OIL_TYPES = ['Sintético', 'Semissintético', 'Mineral', 'Outro / não informado'];
const REF_BANNERS = {
  'Troca de óleo do motor': '💡 Recomendado: 10W-40 Semissintético API SN • 4,2 L • trocar a cada 7.000–10.000 km',
  'Troca de óleo da transmissão/câmbio': '💡 Recomendado: ATF padrão JWS 3309 (Mobil ATF 3309) • 4,5 L (troca parcial)',
  'Pneus': '💡 Medida: 225/65 R17 • Pressão: verificar etiqueta na coluna da porta do motorista',
  'Filtros': '💡 Filtro de óleo: Mann W 68/80 / Tecfil PSL134 | Filtro de ar: Tecfil ARL8824 / Mahle LX2612 | Filtro de cabine: Wega AKX1971',
  'Pastilhas de freio': '💡 Dianteira: Fras-le PD/1077 (equiv. Cobreq N-1399) | Traseira: Fras-le PD/585 (equiv. SYL 3178)',
  'Sistema de arrefecimento': '💡 Fluido de freio: DOT 4 • 1 litro por sangria • trocar a cada 20.000 km ou 24 meses'
};

// ========== IndexedDB ==========
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
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

function getVehicle() {
  return new Promise(r => {
    const tx = db.transaction('vehicle', 'readonly');
    const req = tx.objectStore('vehicle').get(1);
    req.onsuccess = () => r(req.result || null);
  });
}

function saveVehicle(v) {
  return new Promise(r => {
    v.id = 1;
    const tx = db.transaction('vehicle', 'readwrite');
    tx.objectStore('vehicle').put(v);
    tx.oncomplete = () => r();
  });
}

function getMaintenances() {
  return new Promise(r => {
    const tx = db.transaction('maintenances', 'readonly');
    const req = tx.objectStore('maintenances').getAll();
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
      r(list);
    };
  });
}

function saveMaintenance(m) {
  return new Promise(r => {
    const tx = db.transaction('maintenances', 'readwrite');
    if (!m.id) m.criadoEm = new Date().toISOString();
    m.atualizadoEm = new Date().toISOString();
    const req = tx.objectStore('maintenances').put(m);
    req.onsuccess = () => r(req.result);
  });
}

function deleteMaintenance(id) {
  return new Promise(r => {
    const tx = db.transaction('maintenances', 'readwrite');
    tx.objectStore('maintenances').delete(id);
    tx.oncomplete = () => r();
  });
}

// ========== Date helpers (timezone-safe calendar dates) ==========
function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDate(str) {
  const d = parseDate(str);
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR');
}

function daysUntil(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

// ========== Status based only on user-provided next values ==========
function getStatus(m, currentKm) {
  let status = 'ok';
  let reason = '';

  if (m.proximaData) {
    const days = daysUntil(m.proximaData);
    if (days !== null) {
      if (days < 0) { status = 'overdue'; reason = 'Data vencida'; }
      else if (days <= 30) { status = 'near'; reason = `\( {days} dia \){days !== 1 ? 's' : ''}`; }
    }
  }

  if (m.proximaQuilometragem && currentKm != null) {
    const rem = m.proximaQuilometragem - currentKm;
    if (rem <= 0) { status = 'overdue'; reason = 'Km vencida'; }
    else if (rem <= 2000 && status !== 'overdue') { status = 'near'; reason = `${rem.toLocaleString('pt-BR')} km`; }
  }

  return { status, reason };
}

// ========== Safe DOM helpers ==========
function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v);
  }
  children.forEach(c => e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return e;
}

function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

// ========== Screens ==========
let currentScreen = 'inicio';

function setActiveNav(screen) {
  document.querySelectorAll('#bottom-nav button').forEach(b => {
    b.classList.toggle('active', b.dataset.screen === screen);
  });
}

async function showScreen(screen) {
  currentScreen = screen;
  setActiveNav(screen);
  const main = document.getElementById('app');
  clear(main);

  if (screen === 'inicio') await renderInicio(main);
  else if (screen === 'historico') await renderHistorico(main);
  else if (screen === 'veiculos') await renderVeiculos(main);
  else if (screen === 'lembretes') await renderLembretes(main);
  else if (screen === 'mais') await renderMais(main);
  else if (screen === 'add' || screen === 'edit') await renderForm(main, screen === 'edit' ? window._editId : null);
}

// ========== Início ==========
async function renderInicio(main) {
  const vehicle = await getVehicle();
  const maintenances = await getMaintenances();
  const km = vehicle?.quilometragemAtual || 0;

  const header = document.getElementById('app-header');
  clear(header);
  header.appendChild(el('div', { className: 'greeting', text: getGreeting() }));
  if (vehicle) {
    header.appendChild(el('div', { className: 'vehicle-info', text: `${vehicle.marca || ''} ${vehicle.modelo || ''} ${vehicle.ano || ''}`.trim() || 'Veículo' }));
    header.appendChild(el('div', { className: 'vehicle-info', text: `Km atual: ${(km).toLocaleString('pt-BR')}` }));
  } else {
    header.appendChild(el('div', { className: 'vehicle-info', text: 'Nenhum veículo cadastrado' }));
  }

  if (!vehicle) {
    main.appendChild(el('div', { className: 'card empty-state' }, [
      el('p', { text: 'Cadastre seu primeiro veículo para começar.' }),
      el('button', { className: 'primary', text: 'Cadastrar veículo', onclick: () => showScreen('veiculos') })
    ]));
    return;
  }

  const next = maintenances
    .map(m => ({ m, s: getStatus(m, km) }))
    .filter(x => x.s.status !== 'ok')
    .sort((a, b) => (a.s.status === 'overdue' ? -1 : 1))[0];

  const nextCard = el('div', { className: 'card next-card' });
  nextCard.appendChild(el('h2', { text: 'Próxima manutenção' }));
  if (next) {
    const s = next.s;
    nextCard.appendChild(el('div', {}, [
      el('strong', { text: next.m.categoria }),
      el('span', { className: `status ${s.status}`, text: s.status === 'overdue' ? ' Vencida' : ' Próxima' })
    ]));
    nextCard.appendChild(el('p', { text: `${s.reason || ''} • ${formatDate(next.m.proximaData)} / ${next.m.proximaQuilometragem?.toLocaleString('pt-BR') || '—'} km` }));
  } else {
    nextCard.appendChild(el('p', { text: 'Nenhuma manutenção próxima ou vencida.' }));
  }
  nextCard.appendChild(el('button', { className: 'primary', text: 'Adicionar manutenção', onclick: () => showScreen('add') }));
  main.appendChild(nextCard);

  const actions = el('div', { className: 'quick-actions' });
  const qa = [
    { icon: '➕', label: 'Adicionar', screen: 'add' },
    { icon: '📋', label: 'Histórico', screen: 'historico' },
    { icon: '🔢', label: 'Atualizar km', screen: 'veiculos' },
    { icon: '🔔', label: 'Lembretes', screen: 'lembretes' }
  ];
  qa.forEach(a => {
    const btn = el('button', { className: 'quick-action', onclick: () => showScreen(a.screen) });
    btn.appendChild(el('div', { className: 'circle', text: a.icon }));
    btn.appendChild(el('span', { text: a.label }));
    actions.appendChild(btn);
  });
  main.appendChild(actions);

  const last = maintenances[0];
  const summary = el('div', { className: 'card' });
  summary.appendChild(el('h2', { text: 'Resumo' }));
  summary.appendChild(el('p', { text: `Manutenções registradas: ${maintenances.length}` }));
  if (last) summary.appendChild(el('p', { text: `Última: ${last.categoria} em ${formatDate(last.data)}` }));
  main.appendChild(summary);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia!';
  if (h < 18) return 'Boa tarde!';
  return 'Boa noite!';
}// ========== Histórico ==========
async function renderHistorico(main) {
  const list = await getMaintenances();
  window._all = list;

  const filters = el('div', { className: 'filters' });
  const catSel = el('select', { id: 'f-cat' });
  catSel.appendChild(el('option', { value: '', text: 'Todas categorias' }));
  CATEGORIES.forEach(c => catSel.appendChild(el('option', { value: c, text: c })));
  filters.appendChild(catSel);
  filters.appendChild(el('input', { id: 'f-oil', placeholder: 'Marca do óleo' }));
  const viscSel = el('select', { id: 'f-visc' });
  viscSel.appendChild(el('option', { value: '', text: 'Viscosidade' }));
  VISCOSITIES.forEach(v => viscSel.appendChild(el('option', { value: v, text: v })));
  filters.appendChild(viscSel);
  filters.appendChild(el('button', { className: 'secondary', text: 'Filtrar', onclick: applyFilters }));
  main.appendChild(filters);

  const listDiv = el('div', { id: 'h-list' });
  main.appendChild(listDiv);
  renderList(list);

  main.appendChild(el('button', { className: 'primary', text: 'Exportar PDF', onclick: exportPDF }));
}

function renderList(list) {
  const container = document.getElementById('h-list');
  clear(container);
  if (!list.length) {
    container.appendChild(el('div', { className: 'empty-state', text: 'Nenhum registro.' }));
    return;
  }
  const card = el('div', { className: 'card' });
  list.forEach(m => {
    const item = el('div', { className: 'maintenance-item' });
    item.appendChild(el('strong', { text: m.categoria }));
    item.appendChild(el('div', { text: `${formatDate(m.data)} • ${m.quilometragem?.toLocaleString('pt-BR') || '—'} km` }));
    if (m.oil?.marca) item.appendChild(el('div', { text: `Óleo: ${m.oil.marca} \( {m.oil.viscosidade || ''} ( \){m.oil.tipo || ''})` }));
    const actions = el('div');
    actions.appendChild(el('button', { className: 'secondary', text: 'Editar', onclick: () => { window._editId = m.id; showScreen('edit'); } }));
    actions.appendChild(el('button', { className: 'danger', text: 'Excluir', onclick: () => confirmDelete(m.id) }));
    item.appendChild(actions);
    card.appendChild(item);
  });
  container.appendChild(card);
}

function applyFilters() {
  const cat = document.getElementById('f-cat').value;
  const oil = (document.getElementById('f-oil').value || '').toLowerCase();
  const visc = document.getElementById('f-visc').value;
  let f = window._all || [];
  if (cat) f = f.filter(m => m.categoria === cat);
  if (oil) f = f.filter(m => (m.oil?.marca || '').toLowerCase().includes(oil));
  if (visc) f = f.filter(m => m.oil?.viscosidade === visc);
  renderList(f);
}

async function confirmDelete(id) {
  if (confirm('Excluir este registro?')) {
    await deleteMaintenance(id);
    showScreen('historico');
  }
}

// ========== Veículos ==========
async function renderVeiculos(main) {
  const v = await getVehicle() || {};
  const card = el('div', { className: 'card' });
  card.appendChild(el('h2', { text: 'Veículo' }));

  const form = el('form');
  const fields = [
    ['marca', 'Marca', 'text'],
    ['modelo', 'Modelo', 'text'],
    ['ano', 'Ano', 'number'],
    ['motorizacao', 'Motorização (opcional)', 'text'],
    ['transmissao', 'Transmissão (opcional)', 'text'],
    ['quilometragemAtual', 'Quilometragem atual', 'text'],
    ['observacoes', 'Observações', 'textarea']
  ];
  fields.forEach(([name, label, type]) => {
    form.appendChild(el('label', { text: label }));
    if (type === 'textarea') {
      const ta = el('textarea', { name });
      ta.value = v[name] || '';
      form.appendChild(ta);
    } else {
      const inp = el('input', { name, type });
      if (name === 'quilometragemAtual') {
        inp.inputMode = 'numeric';
        inp.placeholder = 'Ex: 85.000';
        inp.value = v.quilometragemAtual ? Number(v.quilometragemAtual).toLocaleString('pt-BR') : '';
        inp.addEventListener('input', () => {
          let val = inp.value.replace(/\D/g, '');
          if (val) inp.value = Number(val).toLocaleString('pt-BR');
        });
      } else {
        inp.value = v[name] || '';
      }
      form.appendChild(inp);
    }
  });
  form.appendChild(el('button', { type: 'submit', className: 'primary', text: 'Salvar' }));
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    data.quilometragemAtual = Number(String(data.quilometragemAtual || '').replace(/\./g, '')) || 0;
    data.ano = Number(data.ano) || null;
    data.specs = {
      oil: {
        viscosidade: data.spec_oil_visc || '',
        tipo: data.spec_oil_tipo || '',
        api: data.spec_oil_api || '',
        volume: data.spec_oil_vol || '',
        intervalo: data.spec_oil_int || ''
      },
      transmission: {
        especificacao: data.spec_trans_spec || '',
        volume: data.spec_trans_vol || ''
      },
      tires: {
        medida: data.spec_tire_medida || '',
        pressao: data.spec_tire_press || ''
      },
      fuel: {
        tipo: data.spec_fuel_tipo || '',
        volume: data.spec_fuel_vol || ''
      },
      brake: {
        especificacao: data.spec_brake_spec || '',
        volume: data.spec_brake_vol || '',
        intervalo: data.spec_brake_int || ''
      },
      filters: {
        oleo: data.spec_filt_oleo || '',
        ar: data.spec_filt_ar || '',
        cabine: data.spec_filt_cabine || ''
      },
      wipers: {
        dianteiras: data.spec_wiper_front || '',
        traseira: data.spec_wiper_rear || ''
      }
    };
    Object.keys(data).forEach(k => { if (k.startsWith('spec_')) delete data[k]; });
    await saveVehicle(data);
    alert('Salvo.');
    showScreen('inicio');
  };
  card.appendChild(form);

  const specs = v.specs || {};
  const specsSection = el('div', { className: 'specs-section' });
  specsSection.appendChild(el('h3', { text: 'Especificações técnicas' }));

  const specFields = [
    ['spec_oil_visc', 'Óleo motor - Viscosidade', specs.oil?.viscosidade || '10W-40'],
    ['spec_oil_tipo', 'Óleo motor - Tipo', specs.oil?.tipo || 'Semissintético'],
    ['spec_oil_api', 'Óleo motor - API', specs.oil?.api || 'SN'],
    ['spec_oil_vol', 'Óleo motor - Volume', specs.oil?.volume || '4,2 litros'],
    ['spec_oil_int', 'Óleo motor - Intervalo', specs.oil?.intervalo || '7.000 a 10.000 km'],
    ['spec_trans_spec', 'Câmbio - Especificação', specs.transmission?.especificacao || 'ATF padrão JWS 3309 (ex: Mobil ATF 3309)'],
    ['spec_trans_vol', 'Câmbio - Volume parcial', specs.transmission?.volume || '4,5 litros'],
    ['spec_tire_medida', 'Pneus - Medida', specs.tires?.medida || '225/65 R17'],
    ['spec_tire_press', 'Pneus - Pressão', specs.tires?.pressao || ''],
    ['spec_fuel_tipo', 'Combustível - Tipo', specs.fuel?.tipo || 'Gasolina'],
    ['spec_fuel_vol', 'Combustível - Volume tanque', specs.fuel?.volume || '66 litros'],
    ['spec_brake_spec', 'Fluido freio - Especificação', specs.brake?.especificacao || 'DOT 4'],
    ['spec_brake_vol', 'Fluido freio - Volume', specs.brake?.volume || '1 litro'],
    ['spec_brake_int', 'Fluido freio - Intervalo', specs.brake?.intervalo || '20.000 km ou 24 meses'],
    ['spec_filt_oleo', 'Filtro óleo', specs.filters?.oleo || 'Mann W 68/80 (equiv. Tecfil PSL134)'],
    ['spec_filt_ar', 'Filtro ar', specs.filters?.ar || 'Tecfil ARL8824 (equiv. Mahle LX2612)'],
    ['spec_filt_cabine', 'Filtro cabine', specs.filters?.cabine || 'Wega AKX1971'],
    ['spec_wiper_front', 'Palhetas dianteiras', specs.wipers?.dianteiras || '19 polegadas, encaixe gancho'],
    ['spec_wiper_rear', 'Palheta traseira', specs.wipers?.traseira || '12 polegadas, encaixe Quick-Clip']
  ];

  specFields.forEach(([name, label, defaultVal]) => {
    specsSection.appendChild(el('label', { text: label }));
    const inp = el('input', { name, type: 'text' });
    inp.value = defaultVal;
    specsSection.appendChild(inp);
  });

  form.appendChild(specsSection);
  main.appendChild(card);
  main.appendChild(el('button', { className: 'secondary', text: 'Carregar dados de exemplo', onclick: loadDemo }));
}

async function loadDemo() {
  if (!confirm('Isso adicionará dados de demonstração. Continuar?')) return;
  await saveVehicle({
    marca: 'Honda',
    modelo: 'Civic',
    ano: 2018,
    quilometragemAtual: 85000,
    observacoes: 'DADOS DE DEMONSTRAÇÃO'
  });
  await saveMaintenance({
    categoria: 'Troca de óleo do motor',
    data: '2024-03-15',
    quilometragem: 78000,
    oficina: 'Oficina Exemplo',
    proximaData: '2024-09-15',
    proximaQuilometragem: 83000,
    oil: { marca: 'Mobil', viscosidade: '5W-30', tipo: 'Sintético', classificacaoAPI: 'SP' },
    observacoes: 'DEMO'
  });
  alert('Exemplos carregados (identificados como DEMO).');
  showScreen('inicio');
}

// ========== Lembretes ==========
async function renderLembretes(main) {
  const vehicle = await getVehicle();
  const list = await getMaintenances();
  const km = vehicle?.quilometragemAtual || 0;

  const sorted = list
    .map(m => ({ m, s: getStatus(m, km) }))
    .filter(x => x.s.status !== 'ok')
    .sort((a, b) => (a.s.status === 'overdue' ? -1 : 1));

  const card = el('div', { className: 'card' });
  card.appendChild(el('h2', { text: 'Lembretes' }));
  if (!sorted.length) {
    card.appendChild(el('p', { text: 'Nenhum lembrete ativo.' }));
  } else {
    sorted.forEach(({ m, s }) => {
      const item = el('div', { className: 'maintenance-item' });
      item.appendChild(el('strong', { text: m.categoria }));
      item.appendChild(el('span', { className: `status ${s.status}`, text: s.status === 'overdue' ? ' Vencida' : ' Próxima' }));
      item.appendChild(el('div', { text: `${formatDate(m.proximaData)} / ${m.proximaQuilometragem?.toLocaleString('pt-BR') || '—'} km` }));
      card.appendChild(item);
    });
  }
  main.appendChild(card);
}

// ========== Mais (Backup + PDF) ==========
async function renderMais(main) {
  const card = el('div', { className: 'card' });
  card.appendChild(el('h2', { text: 'Backup e dados' }));
  card.appendChild(el('p', { text: 'Exporte um arquivo JSON. Guarde em local seguro.' }));
  card.appendChild(el('button', { className: 'primary', text: 'Exportar backup', onclick: exportBackup }));
  card.appendChild(el('label', { text: 'Restaurar backup' }));
  const file = el('input', { type: 'file', id: 'restore-file', accept: '.json' });
  card.appendChild(file);
  card.appendChild(el('button', { className: 'secondary', text: 'Restaurar', onclick: restoreBackup }));
  card.appendChild(el('p', { text: 'A restauração substitui os dados atuais após validação.' }));
  main.appendChild(card);
  main.appendChild(el('button', { className: 'primary', text: 'Exportar PDF do histórico', onclick: exportPDF }));
}

async function exportBackup() {
  const vehicle = await getVehicle();
  const maintenances = await getMaintenances();
  const backup = { version: BACKUP_VERSION, vehicle, maintenances, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `auto-vigia-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

async function restoreBackup() {
  const file = document.getElementById('restore-file')?.files[0];
  if (!file) return alert('Selecione um arquivo.');
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.version || !data.maintenances) throw new Error('Formato inválido');
    if (!confirm('Isso substituirá todos os dados atuais. Continuar?')) return;

    if (data.vehicle) await saveVehicle(data.vehicle);
    const tx = db.transaction('maintenances', 'readwrite');
    const store = tx.objectStore('maintenances');
    store.clear();
    for (const m of data.maintenances) store.put(m);
    await new Promise(r => { tx.oncomplete = r; });
    alert('Backup restaurado com sucesso.');
    showScreen('inicio');
  } catch (err) {
    alert('Arquivo inválido. Dados atuais não foram alterados.');
  }
}// ========== Form Manutenção ==========
async function renderForm(main, editId) {
  let m = {};
  if (editId) {
    const all = await getMaintenances();
    m = all.find(x => x.id === editId) || {};
  }

  const card = el('div', { className: 'card' });
  card.appendChild(el('h2', { text: editId ? 'Editar manutenção' : 'Nova manutenção' }));

  const form = el('form');
  form.appendChild(el('label', { text: 'Tipo' }));
  const cat = el('select', { name: 'categoria', required: true });
  cat.appendChild(el('option', { value: '', text: 'Selecione...' }));
  CATEGORIES.forEach(c => {
    const o = el('option', { value: c, text: c });
    if (m.categoria === c) o.selected = true;
    cat.appendChild(o);
  });
  form.appendChild(cat);

  const banner = el('div', { id: 'ref-banner', className: 'ref-banner', style: 'display:none' });
  form.appendChild(banner);

  const updateBanner = () => {
    const text = REF_BANNERS[cat.value] || '';
    if (text) {
      banner.textContent = text;
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  };

  form.appendChild(el('label', { text: 'Data' }));
  const dataInp = el('input', { type: 'date', name: 'data', required: true });
  dataInp.value = m.data || '';
  form.appendChild(dataInp);

  form.appendChild(el('label', { text: 'Quilometragem' }));
  const kmInp = el('input', { name: 'quilometragem', inputmode: 'numeric', placeholder: 'Ex: 85.000', required: true });
  kmInp.value = m.quilometragem ? Number(m.quilometragem).toLocaleString('pt-BR') : '';
  kmInp.addEventListener('input', () => {
    let v = kmInp.value.replace(/\D/g, '');
    if (v) kmInp.value = Number(v).toLocaleString('pt-BR');
  });
  form.appendChild(kmInp);

  form.appendChild(el('label', { text: 'Oficina (opcional)' }));
  const ofInp = el('input', { name: 'oficina' });
  ofInp.value = m.oficina || '';
  form.appendChild(ofInp);

  form.appendChild(el('label', { text: 'Observações' }));
  const obs = el('textarea', { name: 'observacoes' });
  obs.value = m.observacoes || '';
  form.appendChild(obs);

  form.appendChild(el('label', { text: 'Próxima data (opcional)' }));
  const pd = el('input', { type: 'date', name: 'proximaData' });
  pd.value = m.proximaData || '';
  form.appendChild(pd);

  form.appendChild(el('label', { text: 'Próxima quilometragem (opcional)' }));
  const pk = el('input', { name: 'proximaQuilometragem', inputmode: 'numeric', placeholder: 'Ex: 90.000' });
  pk.value = m.proximaQuilometragem ? Number(m.proximaQuilometragem).toLocaleString('pt-BR') : '';
  pk.addEventListener('input', () => {
    let v = pk.value.replace(/\D/g, '');
    if (v) pk.value = Number(v).toLocaleString('pt-BR');
  });
  form.appendChild(pk);

  const oilDiv = el('div', { id: 'oil-fields', style: 'display:none' });
  oilDiv.appendChild(el('h3', { text: 'Detalhes do óleo' }));
  oilDiv.appendChild(el('label', { text: 'Marca' }));
  const om = el('input', { name: 'oil_marca' });
  om.value = m.oil?.marca || '';
  oilDiv.appendChild(om);

  oilDiv.appendChild(el('label', { text: 'Viscosidade' }));
  const ov = el('select', { name: 'oil_viscosidade' });
  ov.appendChild(el('option', { value: '', text: 'Selecione...' }));
  VISCOSITIES.forEach(v => {
    const o = el('option', { value: v, text: v });
    if (m.oil?.viscosidade === v) o.selected = true;
    ov.appendChild(o);
  });
  oilDiv.appendChild(ov);

  const customVisc = el('input', { name: 'oil_viscosidade_custom', placeholder: 'Viscosidade personalizada', style: 'display:none; margin-top:6px' });
  if (m.oil?.viscosidade && !VISCOSITIES.includes(m.oil.viscosidade)) customVisc.value = m.oil.viscosidade;
  oilDiv.appendChild(customVisc);

  ov.onchange = () => {
    customVisc.style.display = ov.value === 'Outro' ? 'block' : 'none';
  };
  if (ov.value === 'Outro' || (m.oil?.viscosidade && !VISCOSITIES.includes(m.oil.viscosidade))) customVisc.style.display = 'block';

  oilDiv.appendChild(el('label', { text: 'Tipo de óleo' }));
  const ot = el('select', { name: 'oil_tipo' });
  ot.appendChild(el('option', { value: '', text: 'Selecione...' }));
  OIL_TYPES.forEach(t => {
    const o = el('option', { value: t, text: t });
    if (m.oil?.tipo === t) o.selected = true;
    ot.appendChild(o);
  });
  oilDiv.appendChild(ot);

  oilDiv.appendChild(el('label', { text: 'API (opcional)' }));
  const api = el('input', { name: 'oil_api' });
  api.value = m.oil?.classificacaoAPI || '';
  oilDiv.appendChild(api);

  oilDiv.appendChild(el('label', { text: 'ACEA (opcional)' }));
  const acea = el('input', { name: 'oil_acea' });
  acea.value = m.oil?.classificacaoACEA || '';
  oilDiv.appendChild(acea);

  form.appendChild(oilDiv);

  const toggleOil = () => {
    const c = cat.value || '';
    oilDiv.style.display = c.toLowerCase().includes('óleo') || c.toLowerCase().includes('oleo') ? 'block' : 'none';
  };
  cat.onchange = () => {
    updateBanner();
    toggleOil();
  };
  toggleOil();
  updateBanner();

  form.appendChild(el('button', { type: 'submit', className: 'primary', text: 'Salvar' }));
  form.appendChild(el('button', { type: 'button', className: 'secondary', text: 'Cancelar', onclick: () => showScreen('historico') }));

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = Object.fromEntries(fd);
    const parseKm = (v) => v ? Number(String(v).replace(/\./g, '')) : null;
    const maint = {
      id: editId || undefined,
      categoria: data.categoria,
      data: data.data,
      quilometragem: parseKm(data.quilometragem),
      oficina: data.oficina || null,
      observacoes: data.observacoes || '',
      proximaData: data.proximaData || null,
      proximaQuilometragem: parseKm(data.proximaQuilometragem)
    };
    if (oilDiv.style.display !== 'none' && (data.oil_marca || data.oil_viscosidade)) {
      let visc = data.oil_viscosidade;
      if (visc === 'Outro') visc = data.oil_viscosidade_custom || '';
      maint.oil = {
        marca: data.oil_marca || '',
        viscosidade: visc,
        tipo: data.oil_tipo || '',
        classificacaoAPI: data.oil_api || '',
        classificacaoACEA: data.oil_acea || ''
      };
    }
    await saveMaintenance(maint);
    alert('Salvo.');
    showScreen('historico');
  };

  card.appendChild(form);
  main.appendChild(card);
}

// ========== PDF ==========
async function exportPDF() {
  if (typeof window.jspdf === 'undefined') {
    alert('Biblioteca PDF não disponível (depende de CDN).');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const vehicle = await getVehicle();
  const list = await getMaintenances();

  doc.setFontSize(16);
  doc.text('Auto-Vigia — Histórico', 14, 18);
  doc.setFontSize(10);
  doc.text(`${(vehicle?.marca || '') + ' ' + (vehicle?.modelo || '') + ' ' + (vehicle?.ano || '')}`.trim() || 'Veículo', 14, 26);
  doc.text(`Km atual: ${vehicle?.quilometragemAtual?.toLocaleString('pt-BR') || '—'} • Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 14, 32);

  let y = 42;
  list.forEach((m, i) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(`${i + 1}. ${m.categoria} — ${formatDate(m.data)} — ${m.quilometragem?.toLocaleString('pt-BR') || '—'} km`, 14, y);
    y += 5;
    if (m.oil?.marca) {
      doc.text(`   Óleo: ${m.oil.marca} \( {m.oil.viscosidade || ''} ( \){m.oil.tipo || ''}) API:\( {m.oil.classificacaoAPI || '-'} ACEA: \){m.oil.classificacaoACEA || '-'}`, 14, y);
      y += 5;
    }
    if (m.proximaData || m.proximaQuilometragem) {
      doc.text(`   Próxima: ${formatDate(m.proximaData)} / ${m.proximaQuilometragem || '—'} km`, 14, y);
      y += 5;
    }
    y += 3;
  });
  doc.save(`auto-vigia-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ========== Init ==========
document.querySelectorAll('#bottom-nav button').forEach(btn => {
  btn.onclick = () => showScreen(btn.dataset.screen);
});

async function init() {
  await openDB();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  showScreen('inicio');
}

init();