# Тест 01 — model-showcase

Один HTML-файл: модель делает **маркетинговый сайт про себя**.
Прокси-тест на вкус, смелость в дизайне и фронтенд-скилл — и на то,
**насколько по-разному** разные модели подают одну и ту же задачу.

> **v2 — ослаблено.** Бриф сменился с «технической визитки» на
> «маркетинговый сайт», а из `criteria.md` убран чеклист обязательных
> виджетов. Раньше все модели закрывали один список (диаграмма
> пайплайна + comparison-таблица + playground + тёмная тема) и
> выдавали почти одинаковые страницы. Теперь дизайн целиком на
> модели; оцениваем разброс и уместность. Диаграммы и «не ИИ-слоп»
> остаются. Детали — в [`prompt.md`](./prompt.md) и
> [`criteria.md`](./criteria.md).

## Вход

Действующий бриф и архив v1 — в [`prompt.md`](./prompt.md).

## Ожидаемый артефакт

Один самодостаточный HTML (всё inline, без сети, < 200 КБ). Должен
рассказывать про модель конкретикой, содержать осмысленную диаграмму
и не звучать как ИИ-слоп. **Layout, виджеты, тема, медиум — на выбор
модели**; обязательного набора нет.

## Критерии оценки

В [`criteria.md`](./criteria.md). Сравниваем не по «сколько виджетов
из списка закрыто», а по непохожести и уместности подачи.

## Примеры

- [`claude-opus-4/01-model-showcase/`](../../claude-opus-4/01-model-showcase/) —
  Claude Opus 4.8. ⚠️ сделан по **v1** (спек-визитка), до ослабления.
- [`examples/minimax-m3/`](./examples/minimax-m3/) — `minimax-m3`,
  тоже **v1**.

Ранние примеры показывают ровно ту проблему, ради которой ослабляли
тест: они похожи друг на друга.

## Как запустить тест на новой модели

1. Открой новую сессию с целевой моделью.
2. Отправь действующий бриф из `prompt.md` (раздел «Промпт
   (действующий)»).
3. Получи артефакт, прогони `criteria.md`, зафиксируй оценку.
4. Положи артефакт в `examples/<model-slug>/` (или в трек модели
   `<model>/01-model-showcase/`).
5. Сделай скриншоты через `smoke.mjs`, добавь секцию «Скриншоты» в
   README артефакта.

## Шаблон smoke-скрипта

Сохрани рядом с артефактом (адаптировано из
`minimax-m3/fps-cs-lowpoly/screenshots.mjs`):

```js
import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const PORT = 4101;
const DIR = new URL('.', import.meta.url).pathname;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png'
};

const server = createServer(async (req, res) => {
  const file = join(DIR, req.url === '/' ? 'index.html' : req.url);
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end(String(e)); }
});
server.listen(PORT);

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });

await page.screenshot({ path: 'screenshots/01-hero.png' });
const svgCount = await page.$$eval('svg', els => els.length);
const interactiveCount = await page.$$eval('button, details, [role="tab"]', els => els.length);
console.log({ svgCount, interactiveCount });  // информационно, не pass/fail
// scroll, more screenshots
await browser.close();
server.close();
```

`smoke.mjs` проверяет инварианты (грузится, консоль чистая, нет
overflow на 360px), а не дизайн. Счётчики `<svg>` / интерактива —
справочные: в v2 форма свободна, виджеты не обязательны.

## Чего этот тест НЕ измеряет

- Реальное качество модели в продакшене (код, рассуждения,
  tool-use). Это презентационный тест.
- Скорость генерации (один HTML, не performance).
- Способность следовать точным инструкциям. Тест про «как
  презентует», а не «точно ли следует ТЗ» — наоборот, в v2 свобода
  важнее буквального следования.
