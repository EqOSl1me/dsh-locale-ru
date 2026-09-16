# Third-Party Notices

`dsh-locale-ru` is an independent community localization of the
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) project
("the upstream project"). It is not affiliated with, endorsed by, or an official
product of DeepSeek.

## Upstream project

- Upstream: [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
- Copyright © DeepSeek AI
- License: [MIT](https://github.com/deepseek-ai/deepseek-harness/blob/main/LICENSE)

This pack localizes the upstream web UI exclusively through its documented
external-plugin locale API (`ctx.locale.addLanguage`, `ctx.locale.register`)
and restates the permission preset display names through a configuration layer
(`cordis.patch.yml`). **No upstream source file is modified or redistributed.**
The upstream project must be installed separately; it is not distributed with
this pack. All upstream code, product names, and trademarks remain the property
of their respective owners.

The English and Chinese strings in `upstream/corpus.json` are the interface copy
of the upstream project, extracted from a clone for the purpose of keeping the
translation aligned with it. They remain under the upstream MIT license.

## Russian translation

A substantial part of the Russian dictionary was derived from
[warment/deepseek-harness-locale-ru](https://github.com/warment/deepseek-harness-locale-ru),
an MIT-licensed community translation.

- Copyright © deepseek-harness-locale-ru contributors
- License: MIT (full text in `LICENSE.third-party`)

That work is reused and extended under the terms of the MIT license. This
repository's translation was then re-measured against `dsh-v0.1.5-rc.1` and
extended to full coverage of that revision.

## This package's own dependencies

`dsh-locale-ru` ships **no third-party runtime dependencies**:

- Zero npm dependencies in `package.json`.
- The browser bundle (`lib/client.js`) is generated from this repository's own
  dictionaries (`dict/ru/*.json`).
- The host entry (`index.js`) is a no-op.
- The scripts (`scripts/*.mjs`) use only the Node.js standard library.

## License

This package is distributed under the [MIT](LICENSE) license.
