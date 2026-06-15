# Тест 01 — model-showcase

Один HTML-файл, который модель делает **про саму себя**. Это
прокси-тест на self-presentation, структурное мышление и
фронтенд-скилл одновременно.

## Вход

Дословный промпт в [`prompt.md`](./prompt.md). Контекст, в котором
промпт был сформулирован — в секции «Контекст» того же файла.

## Ожидаемый артефакт

Один HTML-файл. Inline CSS, inline JS, inline SVG. Без внешних
зависимостей. Размер < 200 КБ.

## Критерии оценки

В [`criteria.md`](./criteria.md). Используется единый чеклист для
всех моделей, чтобы результаты были сравнимыми.

## Примеры

- [`examples/minimax-m3/`](./examples/minimax-m3/) — как этот тест
  прошла модель `opencode-go/minimax-m3`.

## Как запустить тест на новой модели

1. Открой новую сессию с целевой моделью.
2. Скопируй дословный текст из `prompt.md` и отправь модели.
3. Получи артефакт.
4. Прогони `criteria.md` по результату. Зафиксируй оценку.
5. Положи артефакт в `examples/<model-slug>/index.html`.
6. Сделай скриншоты через `smoke.mjs` (шаблон ниже), положи в
   `examples/<model-slug>/screenshots/`.
7. Напиши `examples/<model-slug>/README.md`: модель, оценка,
   smoke-результат, ссылка на issue в `serejaris/model-tests`.
8. Создай child issue от трека модели по правилам `manager`.

## Шаблон smoke-скрипта

Сохрани в `examples/<model>/smoke.mjs` (адаптировано из
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
console.log({ svgCount, interactiveCount });
// click first tab if exists, scroll, more screenshots
await browser.close();
server.close();
```

## Чего этот тест НЕ измеряет

- Реальное качество модели в продакшене (код, рассуждения,
  tool-use). Это презентационный тест.
- Скорость генерации (один HTML, не performance).
- Способность следовать точным инструкциям. Тест про «как
  презентует», а не «точно ли следует ТЗ».
