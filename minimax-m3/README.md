# minimax-m3

`MiniMax-M3` (model ID `opencode-go/minimax-m3`). Low-poly 3D FPS в
браузере, Three.js, full-auto очередь, боты, hit reaction, плавная
анимация смерти.

## Что тестирует этот трек

- Генерация **запускаемого** Three.js + Vite проекта с нуля по
  первому промпту (без скаффолда от пользователя).
- Итерация по работающей игре: добавить full-auto очередь, импакт-
  эффекты, анимации ботов и проверить headless smoke-тестом — всё в
  одной сессии.
- Способность читать собственный код из той же сессии и
  рефакторить, не ломая smoke-проверки.

## Тесты в этом треке

| # | Тест | Промпт | PRD | Скрины | Что измеряли |
|---|---|---|---|---|---|
| 01 | [fps-cs-lowpoly](./fps-cs-lowpoly/) | [01](./prompts/01-low-poly-fps-cs16/prompt.md) | [PRD.md](./fps-cs-lowpoly/PRD.md) | [screenshots/](./fps-cs-lowpoly/screenshots/) | Cold-start: запускаемый билд + smoke |
| 02 | [fps-cs-lowpoly](./fps-cs-lowpoly/) | [02](./prompts/02-queue-impact-anim/prompt.md) | [PRD.md](./fps-cs-lowpoly/PRD.md) | [screenshots/](./fps-cs-lowpoly/screenshots/) | Патч из нескольких механик, smoke не падает |
| 03 | [model-showcase](./model-showcase/) | [общий 01](../../prompts/01-model-showcase/prompt.md) | [PRD.md](./model-showcase/PRD.md) | [screenshots/](./model-showcase/screenshots/) | Self-presentation: 1 HTML, 0 слопа, smoke 8/8 |

Артефакт `fps-cs-lowpoly` один и тот же для обоих промптов — это
каноническая папка теста для трека. Последующие промпты дорабатывают
его, а не начинают заново. PRD тоже один на весь артефакт — он
описывает фиче-сет, который мы хотим видеть, а не отдельную итерацию.

`model-showcase` — общий тест из `prompts/01-model-showcase/`.
Канонический артефакт в [`./model-showcase/`](./model-showcase/),
а в `prompts/01-model-showcase/examples/minimax-m3/` лежит
только work-record со ссылкой (без дубликата).
