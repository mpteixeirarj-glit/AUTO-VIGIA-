# Auto-Vigia 🚗

Versão atual: **1.0.0** (exibida no app: topo e Mais → Sobre e versões).

PWA offline-first de controle de manutenção veicular. HTML/CSS/JS puro, sem frameworks, sem backend.
Faz parte do ecossistema Vigia — o botão **HUB** no topo volta para a escolha dos apps
(https://mpteixeirarj-glit.github.io/Vigia-energy-/).

## Estrutura

```
index.html        Topo (HUB, versão, relógio), navegação, modal e toast
styles.css        Mesmo sistema visual do Vigia Energy (fonte pixel só nos títulos)
app.js            Telas, IndexedDB, lembretes, backup, PDF
version.js        Versão do app + histórico de novidades (fonte única)
sw.js             Service worker (cache "av-*"; navegação network-first)
manifest.json     Manifest PWA
img/*.webp        Ilustrações com fundo transparente
fonts/            Press Start 2P local (OFL) — funciona offline
vendor/           jsPDF 2.5.1 local (MIT) — PDF funciona offline
icon-*.png        Ícones do app
```

## Publicar uma versão nova

1. Suba `AV_VERSAO` e adicione a entrada em `AV_NOVIDADES` (`version.js`).
2. Suba `VERSAO` em `sw.js` para o mesmo número (`av-X.Y.Z`). Sem isso o celular não baixa a versão nova.
3. Arquivo novo que precisa funcionar offline → incluir em `ARQUIVOS` no `sw.js`.

## Regras importantes

- **Mesma origem dos outros Vigias** (`mpteixeirarj-glit.github.io`): o service worker só apaga caches
  com prefixo `av-`, e o app só usa chaves `av_` no localStorage. Nunca usar `localStorage.clear()`
  nem apagar caches de outros prefixos.
- **Lembretes**: só o registro mais recente de cada *categoria + item* gera lembrete.
  Aviso com 30 dias ou 2.000 km de antecedência.

## Modelo de dados (IndexedDB `AutoVigiaDB` v1)

```
vehicle:      { id: 1, marca, modelo, ano, motorizacao, transmissao, quilometragemAtual, observacoes,
                specs: { oil, transmission, tires, fuel, brake, pads, cooling, battery, filters, wipers } }
maintenances: { id (auto), categoria, item, data, quilometragem, oficina, custo, observacoes,
                proximaData, proximaQuilometragem, oil?: { marca, viscosidade, tipo, classificacaoAPI, classificacaoACEA },
                criadoEm, atualizadoEm }
```

Backup: arquivo JSON `{ app, version: 2, appVersion, exportedAt, vehicle, maintenances }`.
Backups da versão antiga (`version: "1.0"`) também são aceitos.
