# Local fonts used by the public landing release

Retained unchanged on October 1, 2026 from the existing successful Aegis frontend build. The source family, Latin subset, and weight ranges were identified from that build's generated `@font-face` CSS. Binary font axes were not independently inspected. The final static build passed, the live files matched their packaged SHA-256, browser fonts reported loaded, and the heading used Syne.

| Retained file | Original build asset | SHA-256 |
| --- | --- | --- |
| `fonts/inter-latin.woff2` | `frontend/.next/static/media/e4af272ccee01ff0-s.p.woff2` | `c940764593d0fe5d596be327ca7558855e018039fb78509aa21921fd3644c3e4` |
| `fonts/jetbrains-mono-latin.woff2` | `frontend/.next/static/media/bb3ef058b751a6ad-s.p.woff2` | `1e06740a02a443fb7f3eeda8fcaa685a0f6c620e3f01e6666e847295469ce3ad` |
| `fonts/syne-latin.woff2` | `frontend/.next/static/media/8a1d8947e5852e30-s.p.woff2` | `cfff412005eed2f0152d1c110c78ac564642b943e64322fbd687083177d6fa70` |

Inter and JetBrains Mono mapping came from `frontend/.next/static/css/2a2f71024aba4956.css`; Syne mapping came from `frontend/.next/static/css/2d223fd7dfaf0c97.css`. These cache paths may be replaced by a future app build. The retained files and source manifest keep the release reproducible.

OFL texts were obtained from the official Google Fonts repository on the same date: [Inter](https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt), [JetBrains Mono](https://raw.githubusercontent.com/google/fonts/main/ofl/jetbrainsmono/OFL.txt), and [Syne](https://raw.githubusercontent.com/google/fonts/main/ofl/syne/OFL.txt). Their copies in `licenses/` are shipped as `/licenses/` by the public release helper. No fonts were modified.
