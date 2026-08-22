# Noketoki

Диктовка через [AssemblyAI Sync STT](https://www.assemblyai.com/docs/api-reference/sync-api/transcribe) и лёгкую очистку в [LLM Gateway](https://www.assemblyai.com/docs/llm-gateway/quickstart). Один репозиторий, оболочка [Tauri 2](https://v2.tauri.app/).

- **macOS** — иконка в строке меню, удержание Control+Option, плашка с уровнем (не живые слова), вставка в активное поле через буфер обмена.
- **iOS** — своё приложение с большой кнопкой hold-to-talk, результат в текстовом поле, Копировать / Поделиться. Это **не** системная клавиатура и не расширение Keyboard.

Аккаунтов нет. Каждый вставляет свой ключ AssemblyAI. На Mac и iPhone ключ лежит в связке ключей, не в git и не в логах.

## Что нужно на Mac

- Node.js 22+
- Rust 1.88+ (`rustup`; в репозитории есть `rust-toolchain.toml`)
- Xcode + Command Line Tools (`xcode-select --install`)
- Для iOS на устройстве: Apple ID в Xcode → Settings → Accounts
- Ключ AssemblyAI

Windows в этом цикле не поддерживается.

## Установка

```bash
npm install
```

CLI Tauri ставится как `@tauri-apps/cli` (`npx tauri`).

## macOS: разработка и диктовка

```bash
npx tauri dev
```

1. Выдайте **микрофон** при первом удержании.
2. Выдайте **Универсальный доступ** (кнопка в Настройках) — без него Cmd+V в другое окно не сработает.
3. Вставьте ключ AssemblyAI. Он сохраняется в Keychain.
4. Курсор в Notes или поле браузера → зажмите **Control+Option** → говорите → отпустите.
5. **Esc** отменяет. Если вставка не прошла — **Control+Shift+V**.

Умная очистка включена по умолчанию. Если LLM не ответил, вставляется сырой текст Sync.

Запросы к AssemblyAI (Sync POST / `warm` GET и LLM Gateway) идут из **нативного процесса** (`reqwest`), не из WKWebView. В собранном .app нет CORS к `sync.assemblyai.com`. Таймаут клиента — 60 секунд; на плашке показывается конкретная ошибка (401, 413, 429, 504, сеть), а не молчаливый обрыв.

## macOS: установочная сборка (.app / .dmg)

```bash
npx tauri build
```

Артефакты: `src-tauri/target/release/bundle/dmg` и `…/macos`. Подпись и нотаризация **не** включены. Для распространения задайте свой signing identity в Xcode / переменных окружения Apple.

## iOS

iOS-цель лежит в `src-tauri/gen/apple`. На Mac с Xcode обновите Xcode-проект:

```bash
npx tauri ios init
```

`--ci` пропускает лишние вопросы. Команда может перезаписать `gen/apple` актуальной схемой Tauri.

### Team ID

В конфиге стоит **заглушка**, не настоящий идентификатор:

- `src-tauri/tauri.conf.json` → `bundle.iOS.developmentTeam`: `YOUR_APPLE_TEAM_ID`
- `src-tauri/tauri.ios.conf.json` — то же
- `src-tauri/gen/apple/project.yml` → `DEVELOPMENT_TEAM`

Подставьте 10-символьный Team ID из Xcode → Settings → Accounts. Либо на время сборки:

```bash
export APPLE_DEVELOPMENT_TEAM=XXXXXXXXXX
npx tauri ios dev
```

Не коммитьте настоящий Team ID, если репозиторий публичный.

### Симулятор / устройство

```bash
npx tauri ios dev
npx tauri ios build
```

`ios build` собирает IPA / приложение, которое ставится на симулятор или устройство из Xcode. На телефоне: Settings → Privacy → Microphone — только микрофон.

Кастомная клавиатура (App Extension) **не** входит в этот цикл: это отдельный нативный Swift-таргет, не Tauri.

## Данные

- Настройки и история — в каталоге данных приложения (без ключа).
- Ключ — Keychain / iOS Keychain (`app.noketoki` / `assemblyai-api-key`).

## Скрипты

| Команда | Что делает |
| --- | --- |
| `npm install` | зависимости фронта и CLI |
| `npx tauri dev` | Vite + нативное окно/меню macOS |
| `npx tauri build` | .app / .dmg |
| `npx tauri ios init` | Xcode-проект в `gen/apple` |
| `npx tauri ios dev` | симулятор или устройство |
| `npx tauri ios build` | релизная iOS-сборка |
| `npm test` | vitest (WAV, hotkey, STT-конфиг, очистка) |

Hands-free (двойное нажатие) по-прежнему вне цикла — TODO в `src-tauri/src/macos.rs`.
