# gpt-5-codex

Тестовый трек Codex CLI внутри серверного контейнера.

## Контекст

- Runtime: Codex CLI `0.140.0`
- Reported model in run: `gpt-5.5`
- Host: `pc-sys2-pve01` / `51.178.66.9`
- Container: CT `240` / `agent-lab-01` / `10.50.0.140`
- Linux user: `agent`
- Workspace: `/workspace/agent-lab/fresh-02-3d-shooter-game`

Ключевое условие этого трека: код создавался агентом внутри CT240 через
`codex exec`, локальная машина использовалась для упаковки, smoke и фиксации
результатов.

## Тесты

| Тест | Промпт | Статус |
|---|---|---|
| [`02-3d-shooter-game-ct240`](./02-3d-shooter-game-ct240/) | `сделай 3д игру шутер` | smoke `13/13 PASS`, `65,820` Codex CLI tokens |
