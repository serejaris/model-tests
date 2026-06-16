# EVALUATION — 02-3d-shooter-game-ct240

## Итоговый статус

`invalid-model-prd`

Артефакт полезен как evidence серверного CT-прогона, но тест не проходит новое
правило model-authored PRD: `PRD.md`, `PLAN.md` и `TASKS.md` должны быть
созданы тестируемым агентом внутри контейнера до кода.

## Что валидно

- Код создан Codex CLI внутри CT240 в
  `/workspace/agent-lab/fresh-02-3d-shooter-game`.
- Public preview работал: `http://51.178.66.9:24081/`.
- Smoke в упаковке `model-tests` прошел: `13/13 PASS`.
- Скриншоты сняты: 4 PNG по `1440x900`.
- Codex CLI token count за генерацию: `65,820`.

## Что невалидно

- Product `PRD.md` не был создан моделью до кода.
- `PLAN.md` и `TASKS.md` не были созданы моделью до реализации.
- Операторская документация была смешана с PRD и перенесена в `RUN.md`.

## Оценка результата игры

- Реализован простой browser FPS на Three.js.
- Есть арена, движение, pointer lock, враги, здоровье, счет, стрельба,
  win/lose flow.
- Нет ammo/reload, weapon pickups, perks, Vampire Survivors-like progression.

## Правильный повтор

1. Создать свежую пустую папку внутри CT.
2. Дать агенту prompt и repo rules.
3. Заставить агента сначала создать `PRD.md`, затем `PLAN.md`, затем
   `TASKS.md`.
4. Только после этого разрешить код.
5. Оператор отдельно пишет `RUN.md` и `EVALUATION.md`.
