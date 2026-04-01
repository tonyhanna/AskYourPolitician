# Komplet farve-audit — Introkrati

## 1. Systemfarver (CSS variables)

Defineret i `SystemColorProvider.tsx`, sat via blocking script i `layout.tsx`. Skifter automatisk mellem light/dark mode.

| Variable | Beskrivelse |
|----------|-------------|
| `--system-bg0` | Primær baggrund |
| `--system-bg0-contrast` | Kontrast baggrund |
| `--system-bg1` | Sekundær baggrund |
| `--system-bg2` | Tertiær baggrund |
| `--system-text0` | Primær tekst |
| `--system-text0-contrast` | Kontrast tekst |
| `--system-text1` | Sekundær tekst |
| `--system-text2` | Tertiær tekst |
| `--system-text3` | Kvartær tekst |
| `--system-icon0` | Primær ikon |
| `--system-icon0-contrast` | Kontrast ikon |
| `--system-icon1` | Sekundær ikon |
| `--system-icon2` | Tertiær ikon |
| `--system-icon3` | Kvartær ikon |
| `--system-accent0` | Primær accent |
| `--system-accent0-contrast` | Kontrast accent |
| `--system-accent1` | Sekundær accent |
| `--system-accent1-contrast` | Kontrast sekundær accent |
| `--system-success` | Succes-farve |
| `--system-success-contrast` | Succes kontrast |
| `--system-pending` | Afventende-farve |
| `--system-pending-contrast` | Afventende kontrast |
| `--system-error` | Fejl-farve |
| `--system-error-contrast` | Fejl kontrast |
| `--system-overlay` | Overlag (modal backdrop) |

**100+ brugstilfælde** på tværs af alle komponenter.

---

## 2. Partifarver (CSS variables)

Sat på `min-h-dvh` wrapper i borgerside, dashboard og detalje-side.

| Variable | Beskrivelse | Kilde |
|----------|-------------|-------|
| `--party-primary` | Partiets primære farve | `parties.color` |
| `--party-dark` | Partiets mørke farve | `parties.colorDark` |
| `--party-light` | Partiets lyse farve | `parties.colorLight` |

**Brugt i:** PoliticianTopBar, SuggestionModal, UpvoteModal, CircularUpvoteButton, QuestionFeedFilter, AnsweredQuestionCard, PlayableMediaCard, QuestionDetailCard, CopyLinkButton, UpvoteButton, DashboardTabs

---

## 3. Topbar override-farver (props)

Sat per parti i admin. Bruges KUN i `PoliticianTopBar.tsx` til at override tekst-farver.

| Prop | Beskrivelse | Mulige værdier |
|------|-------------|----------------|
| `topbarNameColor` | Politikernavn farve | "primary", "light", "dark", hex, null |
| `topbarNameOpacity` | Politikernavn opacity | 0-100, null (=100) |
| `topbarPartyColor` | Partinavn farve | "primary", "light", "dark", hex, null |
| `topbarPartyOpacity` | Partinavn opacity | 0-100, null (=100) |
| `topbarConstituencyColor` | Kreds farve | "primary", "light", "dark", hex, null |
| `topbarConstituencyOpacity` | Kreds opacity | 0-100, null (=100) |

---

## 4. Hardcodede hex-farver

### I komponenter

| Hex | Bruges til | Filer |
|-----|-----------|-------|
| `#ffffff` / `#FFFFFF` | Hvid tekst/baggrund | PoliticianTopBar, CircularUpvoteButton, UpvoteButton, PlayableMediaCard, IntroSection, BannerHero, SuggestionModal |
| `#000000` | Sort (admin farve-picker defaults) | AdminPartyForm, SystemColorProvider |
| `#E8E7E5` | Neutral lys grå baggrund | CopyLinkButton, AwaitingAnswerButton |
| `#fee2e2` / `#FEE2E2` | Lys rød fejl-baggrund | UpvoteModal, SuggestionModal, SuccessBanner |
| `#991B1B` | Mørk rød fejl-tekst | SuccessBanner |
| `#2E2E2E` | Mørk grå tekst | SuccessBanner |
| `#0E412E` | Mørk grøn (Alternativet-specifik?) | QuestionDetailCard, QuestionFeedFilter, AnsweredQuestionCard |
| `#ECF5DC` | Lys grøn baggrund | QuestionDetailCard, QuestionFeedFilter, AnsweredQuestionCard |
| `#3B82F6` | Blå fallback | icon.tsx, detalje-side (`:root { --party-color }`) |
| `#9ca3af` | Grå placeholder | PoliticianTopBar |
| `#f9fafb` | Admin baggrund | admin/page.tsx |
| `#AAAAAA` | Lys grå label | admin/page.tsx |

### I admin-formularer (Tailwind-hardcoded)

| Farve | Bruges til |
|-------|-----------|
| `bg-gray-50` | Side-baggrund |
| `bg-white` | Kort/sektion-baggrund |
| `border-gray-200` | Kort-kanter |
| `border-gray-300` | Input-kanter |
| `text-gray-900` | Primær tekst |
| `text-gray-700` | Labels |
| `text-gray-600` | Sekundær tekst |
| `text-gray-500` | Tertiær tekst |
| `text-gray-400` | Kvartær tekst |
| `bg-blue-600` / `hover:bg-blue-700` | Primære knapper |
| `bg-green-600` / `hover:bg-green-700` | Succes-knapper |
| `text-red-600` / `hover:text-red-800` | Slet/fejl-tekst |
| `bg-red-600` / `hover:bg-red-700` | Slet-knapper |
| `focus:ring-blue-500` | Fokus-ringe |
| `text-blue-600` / `hover:text-blue-800` | Links |

---

## 5. RGBA/transparens

| Farve | Bruges til | Fil |
|-------|-----------|-----|
| `rgba(255,255,255,0.25)` | Semi-transparent hvid overlay | PoliticianTopBar |
| `rgba(255,255,255,0.5)` | Semi-transparent hvid knap-bg | PoliticianTopBar |
| `rgba(0,0,0,0.5)` | Semi-transparent sort | IntroSection |
| `rgba(0,0,0,0.6)` | Processing overlay | PlayableMediaCard |
| `rgba(255,255,255,0.25)` | Buffering spinner border | PlayableMediaCard |
| `rgba(0,0,0,0.15)` | FAB skygge | DashboardTabs |

---

## 6. color-mix() brugstilfælde

| Fil | Hvad | Mix |
|-----|------|-----|
| CircularUpvoteButton | Party bg med alpha | `--party-primary` 75%/50% + transparent |
| SuggestionModal | Luk-knap bg | `--party-dark` 50% + transparent |
| UpvoteModal | Luk-knap bg | `--party-dark` 50% + transparent |
| StickyPillNav | Blur-baggrund | `--system-bg0` 70% + transparent |

---

## 7. Potentielle problemer

### Hardcodede farver der burde være system/parti-variabler
- `#0E412E` og `#ECF5DC` — bruges til "Svar indsendt" badge. Ser Alternativet-specifik ud.
- `#E8E7E5` — neutral grå, bruges i CopyLinkButton og AwaitingAnswerButton. Burde muligvis være `--system-bg1` eller lignende.
- `#fee2e2` — lys rød fejl-baggrund. Burde muligvis bruge system-error med opacity.
- `#3B82F6` — blå fallback i et par steder. Meningsløs da partifarver altid er sat.

### Admin-sider bruger Tailwind farver, ikke systemfarver
- Alle admin-formularer bruger Tailwind's `gray-*`, `blue-*`, `green-*`, `red-*` paletter.
- Disse skifter IKKE med dark/light mode.
- Anbefaling: migrér admin til systemfarver hvis dark mode skal supporteres.

### ThemeColorSetter modtager stadig `partyColor` som prop
- `ThemeColorSetter` i alle 3 pages modtager `color={partyColor}` / `color={party.color}` som prop.
- Den bruges til at sætte `body.style.backgroundColor` dynamisk ved scroll.
- Kan ikke bruge CSS var her fordi den sætter farven via JS (getComputedStyle kan ikke resolve vars der ikke er på body).
