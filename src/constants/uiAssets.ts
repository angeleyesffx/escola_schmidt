/** Imagens disponíveis no repositório — único ponto de require para evitar paths quebrados. */
export const uiAssets = {
  icon: {
    notificacoes: require('../../assets/icon-notificacoes.png'),
    mensagens: require('../../assets/icon-mensagens.png'),
  },
  /** Ilustrações largas (proporção ~3,5:1) para faixas de destaque no topo/rodapé das telas. */
  banner: {
    hero: require('../../assets/banner-hero.png'),
    secundario: require('../../assets/banner-secundario.png'),
    rodape: require('../../assets/banner-rodape.png'),
  },
  card: {
    inicio: require('../../assets/cards/card-inicio.png'),
    calendario: require('../../assets/cards/card-calendario.png'),
    chamada: require('../../assets/cards/card-chamada.png'),
    alunos: require('../../assets/cards/card-alunos.png'),
    desempenho: require('../../assets/cards/card-desempenho.png'),
    eventos: require('../../assets/cards/card-eventos.png'),
    frequencia: require('../../assets/cards/card-frequencia.png'),
    // Engrenagem — reservado pra uma futura tela de Configurações, não é o ícone de perfil.
    perfil: require('../../assets/cards/card-perfil.png'),
    logout: require('../../assets/cards/card-logout.png'),
  },
} as const;
