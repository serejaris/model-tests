# minimax-m3 — model-showcase

Результат прогона общего теста
[`prompts/01-model-showcase/`](../../) на модели `minimax-m3`.

## Где артефакт

Канонический артефакт живёт в треке модели:
[`minimax-m3/model-showcase/`](../../../../minimax-m3/model-showcase/)

- `index.html` — сам артефакт (38.5 КБ)
- `PRD.md` — что и зачем строили
- `smoke.mjs` — headless-проверка
- `screenshots/` — `01-hero`, `02-scroll`, `03-tab-active`,
  `04-mobile`, `05-dark`, `00-full`
- `README.md` — как открыть, smoke-таблица, оценка

Здесь — только work-record, без дубликата. Дублировать артефакт
в двух местах запрещает [`AGENTS.md`](../../../../AGENTS.md) —
«одна каноническая локация, в соседних — ссылка».

## Промпт теста

[`prompts/01-model-showcase/prompt.md`](../../prompt.md) — дословный
user-промпт, без подсказок о стеке и без готового решения.

## Результат

- **smoke.mjs**: 8/8 PASS
- **оценка по `criteria.md`**: 5/5 (все 4 структурных + все 5
  содержательных + 0 стоп-слов + 5 бонусных)
- **issue**: [serejaris/model-tests#3](https://github.com/serejaris/model-tests/issues/3)

## Что в артефакте (коротко)

- hero с ASCII-figlet `MINIMAX` (ANSI Shadow)
- таблица «кто я» — 7 фактов о модели, vendor, cutoff
- inline-SVG pipeline (промпт → transformer → ответ)
- 4 вкладки с playground: код / структура / длинный контекст / языки
- comparison table «хорошо получается / плохо или никак»
- timeline M1 → M2 → M3
- светлая/тёмная тема с переключателем
- footer с пометкой про self-reporting
