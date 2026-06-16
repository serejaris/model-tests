# PRD — 02-3d-shooter-game-ct240

## 1. Контекст и цель

Проверить, что Codex CLI, запущенный внутри изолированного серверного
контейнера, может по короткому русскому промпту с нуля создать запускаемый
браузерный 3D-шутер.

Этот тест также проверяет Agent Lab workflow: код должен появиться в CT240 от
процесса агента, затем быть упакован в `model-tests` с evidence, smoke и
публичной preview-ссылкой.

## 2. Scope

### In scope

- Одностраничная браузерная 3D-игра от первого лица.
- Three.js/WebGL сцена с ареной, стенами, укрытиями и освещением.
- FPS-управление: WASD, мышь, pointer lock.
- Оружие от первого лица, raycast-стрельба, tracer/muzzle feedback.
- Враги, которые спавнятся на краях арены, преследуют игрока и наносят урон.
- HUD: здоровье и счет.
- Win/lose overlay и restart flow.
- Запуск через локальный HTTP server.
- Smoke-проверка через headless browser с системным Chrome.
- Скриншоты стартового экрана и gameplay.

### Out of scope

- Multiplayer.
- Несколько видов оружия, pickup-система, perks, progression tree.
- Ammo/reload механика.
- Производственный bundling pipeline.
- Mobile/touch controls.
- Физический движок, navmesh и сложный AI.

## 3. Пользовательские сценарии

1. Игрок открывает страницу, видит стартовый overlay и нажимает `Старт`.
2. Игрок двигается по арене WASD, смотрит мышью и стреляет LMB.
3. Враги преследуют игрока, при контакте снижают здоровье.
4. Уничтожение врагов повышает счет.
5. При достижении целевого счета показывается победа, при здоровье `0` —
   поражение.

## 4. Метрики успеха

| Проверка | Цель |
|---|---|
| `npm install` | PASS |
| `npm start` | HTTP 200 на `/` |
| WebGL canvas появляется и не пустой | PASS |
| Нет runtime console/page errors | PASS |
| Start flow скрывает overlay | PASS |
| Выстрел вызывает визуальный firing state | PASS |
| HP может снижаться от врагов | PASS |
| Victory path существует в коде | PASS |
| В артефакте нет внешних image/model/audio ассетов | PASS |

## 5. Технические ограничения

- Код создан внутри CT240 процессом `codex exec`.
- Исходник модели сохранен как `index.html`.
- Three.js используется как npm dependency и импортируется локально из
  `node_modules/three/build/three.module.js`.
- Public preview открыт отдельным временным портом
  `http://51.178.66.9:24081/`.
- Headless smoke в самом CT240 не прошел из-за отсутствующей системной
  библиотеки Chromium `libnspr4.so`; локальная упаковочная проверка запускается
  системным Chrome на Mac.

## 6. Non-goals

- Не исправлять вручную модельный код под полный Vampire Survivors-like scope.
- Не добавлять скрытые dev-hooks в игру ради smoke.
- Не менять core mechanics после завершения `codex exec`, чтобы оценка отражала
  фактический результат модели.

## 7. План работы

1. Создать чистую папку в CT240.
2. Запустить `codex exec` внутри CT240 с дословным prompt.
3. Поднять игру внутри CT и проверить HTTP endpoint.
4. Открыть отдельный public preview port для fresh-прогона.
5. Скопировать только исходники и package files в `model-tests`.
6. Добавить PRD, README, smoke и screenshots script.
7. Снять скриншоты и запустить smoke.
8. Зафиксировать GitHub issue и work-record.

## 8. Открытые вопросы

- Нужен отдельный scoring rubric для случаев, где пользователь в чате хотел
  richer task, но фактический benchmark prompt был короче.
- Нужна ли VM-версия стенда для headless browser smoke внутри guest.

## 9. Что в реальности получилось

- Codex сгенерировал одностраничную Three.js игру `Neon Range`.
- Реализованы арена, HUD, враги, HP, счет, стрельба, win/lose.
- Не реализованы ammo, pickup weapons, perks, Vampire Survivors progression.
- CT-local HTTP check прошел.
- CT-local Playwright не прошел из-за missing Chromium dependency.

