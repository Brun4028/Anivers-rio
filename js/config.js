/* ============================================================
   CONFIGURAÇÃO — edite aqui para personalizar o presente
   ------------------------------------------------------------
   Este é o único arquivo que você precisa alterar para
   modificar nome, data, carta, música e efeitos sonoros.
   ============================================================ */

window.DN_CONFIG = {

  /* --- Dados da aniversariante --- */
  name: "ISADORA",            // como o nome deve ser escrito no livro
  displayName: "Isadora",     // como o nome aparece em frases
  birthday: "26/10",      // ex.: "14 de abril"  (deixe vazio para manter só o rótulo)

  /* --- Carta / mensagem pessoal -------------------------
     Edite o conteúdo abaixo. Cada string entre crases
     ( ` ) é um parágrafo da carta, na ordem.            */
  letter: [
    `Isadora,

se você está lendo isso, então chegou ao fim dessa pequena jornada que preparei para você.`,

    `Cada detalhe dessa experiência foi pensado para tornar esse momento um pouco mais especial, mas no fim das contas, nenhuma regra, nenhum desejo, nem mesmo as sete Esferas do Dragão conseguem expressar aquilo que eu realmente desejo para você.`,

    `Que esse novo ciclo seja cheio de momentos felizes, sonhos realizados e novas conquistas. Que seu estúdio de tatuagem se encha cada vez mais, que você possa voltar a tatuar cada vez mais e conquistar novos clientes, e que cada novo desenho seja mais uma história para guardar.`,

    `Que nunca faltem pessoas que te façam bem, motivos para sorrir e momentos que você tenha orgulho de lembrar.`,

    `Que você continue sendo essa pessoa única, criativa e especial que você é, e que nunca perca aquilo que faz você ser você.`,

    `Espero que essa pequena surpresa tenha conseguido arrancar pelo menos um sorriso seu.`,

    `Feliz aniversário, Isadora. ❤️

Que o melhor ainda esteja por vir.`
  ],

  /* --- Trilha sonora -----------------------------------
     “Story Of A Birthday Child” — Sascha Ende
     Licença CC BY 4.0 — https://ende.app/en/song/12695-story-of-a-birthday-child */
  music: {
    enabled: true,
    src: "assets/audio/story-of-a-birthday-child.mp3",
    volume: 0.16,        // volume inicial, discreto (0 a 1)
    finalVolume: 0.28,   // leve clímax na última cena (0 a 1)
    finalFadeMs: 5000    // transição gradual de volume (ms)
  },

  /* --- Efeitos sonoros ------------------------------- */
  sfx: {
    enabled: true,
    volume: 0.6    // 0 a 1
  },

  /* --- Ritmo da experiência ------------------------- */
  timing: {
    typeSpeed: 52,      // velocidade da escrita (ms por caractere)
    sceneFade: 1400     // duração das transições (ms)
  }
};
