# minimax-m3 — 3D shooter game

Результат общего теста `02-3d-shooter-game`, прогнанного на модели
`opencode-go/minimax-m3`. Self-contained Vite-проект: 3D-шутер от
первого лица, low-poly, full-auto, импакт-эффекты, боты с FSM.

## Скриншоты

| Экран | Кадр |
|---|---|
| Title overlay | ![start](./screenshots/01-start.png) |
| Gameplay | ![gameplay](./screenshots/02-gameplay.png) |
| Стрельба (muzzle + tracer) | ![firing](./screenshots/03-firing.png) |
| Победа (5/5) | ![victory](./screenshots/04-victory.png) |

## Где лежит

- Артефакт: [`index.html`](./index.html) + `src/…`
- Smoke: [`smoke.mjs`](./smoke.mjs)
- Скрины: [`screenshots/`](./screenshots/)
- Промпт (дословный): [`../../prompt.md`](../../prompt.md)
- Критерии: [`../../criteria.md`](../../criteria.md)

## Где ещё лежит этот же артефакт

В основном треке модели `minimax-m3/` этот же артефакт живёт как
**итерированный тест** `fps-cs-lowpoly`:

- [`minimax-m3/fps-cs-lowpoly/`](../../../../minimax-m3/fps-cs-lowpoly/)

Эта копия в `examples/minimax-m3/` — для self-contained-прохождения
общего теста. Когда в основном треке тест итерируется (новые
промпты, новые механики), эту копию можно регенерировать или
оставлять как snapshot на момент прохождения теста.

## Как запустить

```bash
npm install
npm run dev        # http://localhost:5173
# или production:
npm run build
npm run preview    # http://localhost:4173
```

## Что внутри

| Блок | Что делает |
|---|---|
| `src/main.js` | сцена, рендер-цикл, состояние игры, auto-fire, эффекты |
| `src/world.js` | арена 60×60, ящики, столбы, бочки, лампы |
| `src/player.js` | FPS-контроллер (WASD, прыжок, спринт, AABB-коллизии) |
| `src/weapon.js` | viewmodel, muzzle flash, raycast-стрельба, `muzzleWorldPos` |
| `src/bot.js` | FSM (PATROL/CHASE/ATTACK), pain reaction, death anim |
| `src/effects.js` | пул трассеров / декалей / искр (FIFO 30, fade 6с) |
| `src/ui.js` | HP / ammo / enemies HUD, overlay |
| `src/utils.js` | AABB-коллизии, raycast, line-of-sight, синтез-бипы |

## Smoke

`smoke.mjs` поднимает preview-сервер, открывает страницу в headless
Chromium, симулирует ввод, проверяет:

| # | Проверка | Результат |
|---|---|---|
| 1 | Full-auto очередь: `ammo 30→24` за 0.6с при удержании LMB | PASS |
| 2 | Эффекты спавнятся в середине очереди (трассеры, искры) | PASS |
| 3 | Hit reaction бота: `hp 60→32`, `painKick = 0.256` | PASS |
| 4 | Death anim: `deathProgress 0→1`, `bodyRotX → -π/2` | PASS |
| 5 | Победа: 5/5 мертвы → win overlay | PASS |

**5/5 PASS, 0 runtime-ошибок, 0 console.error.**

## Оценка по criteria.md

| Категория | Статус |
|---|---|
| Структурные (must-have) | ✅ все 6 |
| Содержательные (must-have) | ✅ все 7 |
| Антипаттерны | ✅ 0 (нет TODO в ключевых местах, нет внешних .glb, нет console.log-спама) |
| Визуальные / качественные (бонус) | ✅ все 7: low-poly, импакт-эффекты, full-auto, death anim, hit reaction, разнообразные экраны, WebAudio-звуки |

**Итог: 5/5.**

## Issue

- [#4 — minimax-m3 — 3d-shooter-game (общий тест 02)](https://github.com/serejaris/model-tests/issues/4)
- Parent epic: [#1 — minimax-m3 — testing track](https://github.com/serejaris/model-tests/issues/1)
