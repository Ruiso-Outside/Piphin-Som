# Piphin Som

Estúdio de música e efeitos sonoros, módulo do [Piphin Hub](https://github.com/Ruiso-Outside/Piphin-Hub). Roda dentro do Hub (cerca de 450 KB); todo o som é gerado no PC (Web Audio), sem amostras para baixar.

- **Arranjo** com faixas de instrumento, bateria e áudio; clipes por compasso (mover, redimensionar, copiar com Alt, duplicar, dividir); trecho de repetição (loop), metrônomo e swing
- **13 instrumentos sintetizados**: piano, piano elétrico, órgão, cordas, pad, baixo, baixo 808, lead, pluck, sino, chiptune, flauta e metais, com ajuste fino (onda, envelope, filtro, uníssono, FM, vibrato)
- **Bateria sintetizada** com 9 peças e 4 kits (808, acústico, lo-fi, eletrônico), sequenciador de passos e 10 ritmos prontos
- **Piano roll** com grade, escalas destacadas (para quem não sabe teoria) e escritor de acordes (`Am F C G`, `Dm7 G7 Cmaj7`, `C/E`...) em bloco, ritmado, arpejo, quebrado ou linha de baixo
- **Teclado do computador como piano** e gravação das notas tocadas; **gravação do microfone** nas faixas de áudio
- **Áudio**: importar WAV/MP3/OGG/M4A/FLAC, volume, velocidade, corte, entradas e saídas suaves, normalizar e inverter
- **Mixagem e efeitos** por faixa: volume, pan, reverb, eco sincronizado, distorção, filtros, EQ de 3 bandas e compressor; limitador final sem distorção
- **Efeitos sonoros**: gerador com 20 modelos (moeda, pulo, laser, explosão, power-up, sirene, magia, chuva...), variações, "surpresa" e mais de 20 parâmetros
- **Exportação** MP3, WAV, M4A (AAC) e OGG (Opus); projetos `.psom`
- **IA**: com o Piphin LLM, a IA compõe (faixas, acordes, batidas, notas), ajusta a mixagem, cria efeitos sonoros e exporta

## Mídia do Hub
Com o Piphin Hub 1.7.0 ou mais novo:
- Músicas exportadas e efeitos sonoros entram na **Mídia** do Hub; o Piphin Vídeo usa direto.
- Em Efeitos sonoros, **Salvar na Mídia** guarda o efeito em Música\Piphin Som\efeitos sem perguntar onde.
- **Importar da Mídia** (menu Arquivo ou na faixa de áudio): músicas baixadas no Piphin Música e áudios dos outros módulos.
- **Abrir no Piphin Som** em outro módulo: o áudio entra na música aberta.

## Créditos

- [Mediabunny](https://github.com/Vanilagy/mediabunny) (MPL-2.0): gravação de M4A, OGG e MP3
- Codificador MP3 [@mediabunny/mp3-encoder](https://www.npmjs.com/package/@mediabunny/mp3-encoder) (MPL-2.0) com o [LAME MP3 Encoder](https://lame.sourceforge.io) 3.100 (LGPL)

```
npm install
npm run vendor
npm run module
```
