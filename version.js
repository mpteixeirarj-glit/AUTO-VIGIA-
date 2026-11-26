/* Versão do Auto-Vigia — fonte única exibida no app (topo e Mais → Sobre).
 * A CADA atualização: suba AV_VERSAO aqui E a constante VERSAO em sw.js
 * (o navegador só detecta service worker novo se o sw.js mudar). */
self.AV_VERSAO = '1.0.0';
self.AV_NOVIDADES = [
  { v: '1.0.0', data: '26/11/2026', itens: [
    'Correção: salvar uma manutenção nova falhava sempre (só a edição funcionava)',
    'Correção: app instalável e offline de verdade (faltava o manifest; o service worker nunca ativava)',
    'Correção: o Auto-Vigia não apaga mais o cache dos outros Vigias no mesmo endereço',
    'Atualização automática: versão nova é baixada quando há internet, sem ficar preso na antiga',
    'Lembretes consideram só o registro mais recente de cada item (um serviço refeito não fica "vencido" para sempre)',
    'Campo "Item" (ex.: filtro de ar × filtro de óleo) para separar lembretes da mesma categoria',
    'Ordem de urgência real: vencidas primeiro, depois o que falta menos (dias ou km)',
    'Validações: data futura, próxima km menor que a atual, próxima data antes do serviço',
    'Km do veículo sobe sozinha ao registrar manutenção com km maior',
    'Campo de custo (R$) com total no histórico, no resumo do ano e no PDF',
    'Nova categoria "Fluido de freio"; dica do arrefecimento não mostra mais dado do freio',
    'Dicas de cada categoria vêm das especificações do seu veículo (editáveis)',
    'Backup: restauração atômica e validada; lembrete para fazer backup a cada 30 dias',
    'Pedido de armazenamento persistente para o navegador não apagar os dados',
    '"Dados de exemplo" removido (sobrescrevia o seu veículo)',
    'Confirmações e avisos dentro do app; erros de gravação agora aparecem na tela',
    'PDF completo (oficina, custo, observações, quebra de linha) e funciona offline',
    'Imagens com fundo transparente e 4× mais leves',
    'Texto legível (fonte pixel só nos títulos) e zoom liberado',
    'Fonte Vigia Pixel: maiúsculas acentuadas corretas (antes "INíCIO", "HISTóRICO")',
    'Botão HUB no topo para voltar à escolha dos apps Vigia',
    'Versão instalada no topo e histórico de versões em Mais → Sobre'
  ] },
  { v: '0.4.0', data: '26/11/2026', itens: [
    'Visual pixel art no padrão Vigia Energy (tema escuro, ciano e amarelo)',
    'Ilustrações pixel art do Grand Vitara por categoria de manutenção',
    'Relógio em tempo real no topo',
    'Tela Sobre com o ecossistema Vigia'
  ] },
  { v: '0.3.0', data: '11/11/2026', itens: [
    'Primeira versão: cadastro do veículo com especificações técnicas',
    'Manutenções por categoria, com detalhes do óleo (marca, viscosidade, tipo, API, ACEA)',
    'Histórico com filtros por categoria, marca do óleo e viscosidade',
    'Lembretes por data e por quilometragem',
    'Backup em arquivo JSON e exportação em PDF'
  ] }
];
