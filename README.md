# ISADORA'S NOTE — presente de aniversário

Uma experiência web interativa: telas negras, um caderno sobrenatural,
três regras, sete esferas mágicas, um dragão, uma sentença e uma carta.

Construída em **HTML + CSS + JavaScript puros** — sem dependências, sem build,
sem APIs externas. Funciona offline (a única exceção são as fontes do Google
Fonts, que caem com elegância para fontes do sistema quando não há internet).

---

## Como abrir

**Opção 1 — servidor local (recomendada):**

```bash
npm run dev
```

Depois abra <http://localhost:5173> no navegador. Não precisa de
`npm install` — o servidor (`tools/serve.mjs`) usa só módulos nativos do Node.
Porta alternativa: `PORT=8080 npm run dev`.

**Opção 2 — direto no navegador:** basta abrir o arquivo `index.html`
(duplo clique).

**Opção 3 — outro servidor:** `npx serve .` ou `python3 -m http.server`.

---

## Como personalizar

Tudo que precisa editar está em **`js/config.js`**:

| Campo             | O que faz                                                     |
|-------------------|---------------------------------------------------------------|
| `name`            | Nome escrito no livro (ex.: `ISADORA`)                        |
| `displayName`     | Nome usado em frases                                          |
| `birthday`        | Data que aparece em “Data de nascimento:” (pode ficar vazio)  |
| `letter`          | Array de parágrafos da carta — **substitua pelo texto real**  |
| `music.src`       | Caminho de uma música ambiente local (opcional)               |
| `music.volume`    | Volume da música (0 a 1)                                      |
| `sfx.volume`      | Volume dos efeitos (0 a 1)                                    |
| `timing.*`        | Velocidade da escrita e das transições                        |

### Música ambiente (opcional)

Coloque um arquivo **royalty-free** em:

```
assets/audio/ambient.mp3
```

Se o arquivo não existir, nada quebra — a experiência continua apenas com os
efeitos sonoros. Não use músicas com direitos autorais.

### Efeitos sonoros

Todos são **sintetizados em tempo real com WebAudio** (`js/audio.js`):
abertura do livro, página, escrita, esferas, reunião das sete, dragão,
fechamento do livro, presente e revelação final. Nenhum arquivo é necessário.

---

## Estrutura

```
index.html          estrutura das 11 cenas
package.json        scripts npm (dev, verify)
css/base.css        paleta, tipografia, palco, botões
css/scenes.css      composição de cada capítulo
css/animations.css  keyframes (transições, órbitas, caminhada)
js/config.js        ← edite aqui (nome, data, carta, música)
js/audio.js         efeitos sonoros sintetizados + música ambiente
js/fx.js            partículas em canvas (poeira e brilhos)
js/app.js           direção da experiência (cenas e interações)
assets/audio/       coloque ambient.mp3 aqui (opcional)
```

---

## A sequência

TELA PRETA → INTRODUÇÃO → O LIVRO → AS NOVAS REGRAS → AS SETE ESFERAS →
O DESEJO → O NOME DA ISADORA → A SENTENÇA → OS ANIMAIS → A CARTA →
A MENSAGEM FINAL

Toques durante a escrita aceleram a datilografia.
O botão **SOM** (canto superior direito) liga e desliga o áudio.

---

## Verificação automática (opcional)

```bash
npm run verify      # ou: node tools/verify.mjs
```

Abre o projeto no Chrome headless, percorre os 11 capítulos sozinho e confere
erros de JavaScript, os textos obrigatórios, o overflow e o enquadramento dos
elementos em 4 tamanhos de tela (desktop, celular, tablet e paisagem).
