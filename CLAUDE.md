# Vigia Auto (antigo Auto-Vigia) — instruções para o Claude

## Regra permanente: toda mudança vai para o "Sobre"

Pedido do dono do projeto (27/11/2026). Vale para TODA alteração entregue, por menor que seja
(funcionalidade, correção, texto, visual):

1. **Subir a versão** do app (semver: correção = patch, novidade = minor).
2. **Registrar e resumir a mudança no histórico de versões**, que aparece na aba/tela **Sobre**
   do app — em linguagem simples, um item por mudança visível para quem usa.
3. Manter a versão do service worker igual à do app (senão o celular não baixa a versão nova).
4. Atualizar a "Versão atual" do README.

Não entregar commit que mude o app sem a entrada correspondente no Sobre.

### Onde fica, neste repositório
- Versão e histórico: `version.js` → `AV_VERSAO` e nova entrada (com data) no topo de `AV_NOVIDADES`
  (aparece em Mais → Sobre e versões e no topo do app).
- Service worker: `sw.js` → `VERSAO = 'av-X.Y.Z'`.

## Outras regras do projeto
- Mesma origem dos outros Vigias (`mpteixeirarj-glit.github.io`): só chaves `av_` no localStorage,
  só caches `av-`; nunca `localStorage.clear()`.
- Dados no IndexedDB `AutoVigiaDB`; nuvem opcional no projeto Firebase `auto-vigia` (ver README).
- Visual igual ao Vigia Energy (olho piscando + "VIGIA AUTO" no topo).
