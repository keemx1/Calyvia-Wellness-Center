# Calyvia Wellness Center — Design System & UI/UX Specification

## 1. Brand Identity & Design Principles

Calyvia Wellness Center is a premier addiction recovery and mental health rehabilitation facility situated in Mugutha, Ruiru (Kiambu County, Kenya). The facility's physical environment offers serene, green, therapeutic surroundings focused on holistic recovery: medical detox, inpatient/outpatient rehabilitation, counselling, family support, and relapse prevention.

### Core Visual & Emotional Tone
- **Calm & Grounded:** Organic earthy tones reflecting the tranquil Ruiru landscape.
- **Compassionate & Dignified:** Warm neutrals and gentle typography that convey respect and confidentiality.
- **Clinical Rigour & Trust:** High contrast ratios, crisp borders, and structured layouts that ensure data precision and healthcare compliance (Kenya Data Protection Act 2019).
- **Accessible & Data-Dense:** Built to WCAG 2.1 AA standards for healthcare practitioners who need rapid access to patient vitals, medications, and admission pipelines.

---

## 2. Color Palette & Semantic Tokens

Extracted directly from the official live brand assets (`https://calyviawellness.co.ke/`) and enhanced for data-dense clinical administrative interfaces:

### Primary Palette (Earthy & Forest Greens)
| Token Name | Hex Code | RGB | HSL | Semantic Meaning |
| :--- | :--- | :--- | :--- | :--- |
| `--color-forest-900` | `#1A2F26` | `26, 47, 38` | `154°, 29%, 14%` | High-emphasis headers, active dark navigation |
| `--color-forest-800` | `#2C4A3E` | `44, 74, 62` | `156°, 25%, 23%` | **Brand Primary:** Main header, primary buttons, brand accents |
| `--color-forest-700` | `#3D6656` | `61, 102, 86` | `157°, 25%, 32%` | Hover states for primary interactive elements |
| `--color-sage-500` | `#6A9777` | `106, 151, 119` | `137°, 18%, 50%` | Active tabs, secondary badges, supportive icons |
| `--color-sage-400` | `#7BA888` | `123, 168, 136` | `138°, 21%, 57%` | **Brand Secondary:** Soft highlight, focus rings, selected rows |
| `--color-sage-200` | `#9DC3A9` | `157, 195, 169` | `139°, 24%, 69%` | Subtle borders, light chip backgrounds |
| `--color-sage-50` | `#F4F6F4` | `244, 246, 244` | `120°, 6%, 96%` | Subtle table row alternating background, light badge tint |

### Warm Accent & Earth Palette (Terracotta & Sand)
| Token Name | Hex Code | RGB | Semantic Meaning |
| :--- | :--- | :--- | :--- |
| `--color-terracotta-600` | `#A65E43` | `166, 94, 67` | Terracotta hover / active state |
| `--color-terracotta-500` | `#C17B5F` | `193, 123, 95` | **Brand Accent:** CTAs, urgent attention flags, counselling badges |
| `--color-terracotta-100` | `#FFF5F0` | `255, 245, 240` | Background tint for counselling & therapy highlights |
| `--color-sand-500` | `#D4C5B9` | `212, 197, 185` | Muted divider borders, outline buttons |
| `--color-sand-200` | `#E8DCC8` | `232, 220, 200` | Card borders, subtle container dividing lines |
| `--color-sand-100` | `#F5EFE6` | `245, 239, 230` | Subpanel background, sidebar active item tint |
| `--color-sand-50` | `#FDFBF7` | `253, 251, 247` | **Main App Canvas Background (Warm linen)** |

### Clinical & Functional Semantic Colors
| Status | Token | Background | Border | Text | Icon |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Normal / Safe / Completed** | `--status-success` | `#F0FDF4` | `#BBF7D0` | `#166534` | CheckCircle |
| **Withdrawal / Risk / Warning**| `--status-warning` | `#FFFBEB` | `#FDE68A` | `#B45309` | AlertTriangle |
| **Critical / Detox Alert / Overdue**| `--status-critical` | `#FEF2F2` | `#FECACA` | `#991B1B` | AlertOctagon |
| **Observation / Info / Pending** | `--status-info` | `#EFF6FF` | `#BFDBFE` | `#1E40AF` | Info |
| **Kenya M-Pesa Integration** | `--brand-mpesa` | `#E8F8EE` | `#A3E635` | `#008000` | Smartphone |

### Typography Tokens
- **Display & Headings:** `Crimson Pro`, Georgia, serif (font weight: 600, 700). Used for major page titles, clinical section headers, invoice headers, and executive summaries to give a dignified, compassionate, high-end clinic feel.
- **Body & Clinical UI:** `Outfit`, system-ui, -apple-system, sans-serif (font weight: 400, 500, 600). Clean geometric sans-serif that remains highly legible at 11px and 12px for patient charts, medication records, vitals, and dosage tables.
- **Tabular & Medical Data:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`. Used for M-Pesa transaction codes, patient identifiers (e.g. `CAL-2026-0042`), ICD-10 diagnostic codes, dosage measurements (`mg`, `ml`), and audit timestamps.

---

## 3. Spacing, Elevation & Shape Tokens

### Radii (Subtly Organic & Softened)
- `radius-sm`: `6px` (badges, tags, compact buttons)
- `radius-md`: `8px` (inputs, table cells, standard buttons)
- `radius-lg`: `12px` (standard cards, clinical panels, dropdown popovers)
- `radius-xl`: `16px` (modal dialogues, summary cards)
- `radius-2xl`: `24px` (hero banners, patient overview headers)
- `radius-full`: `9999px` (status pills, patient avatar badges)

### Shadows (Soft Warm Glow)
- `shadow-sm`: `0 1px 2px 0 rgba(44, 74, 62, 0.05)`
- `shadow-md`: `0 4px 6px -1px rgba(44, 74, 62, 0.07), 0 2px 4px -2px rgba(44, 74, 62, 0.05)`
- `shadow-lg`: `0 10px 15px -3px rgba(44, 74, 62, 0.08), 0 4px 6px -4px rgba(44, 74, 62, 0.04)`
- `shadow-xl`: `0 20px 25px -5px rgba(44, 74, 62, 0.10), 0 8px 10px -6px rgba(44, 74, 62, 0.04)`

---

## 4. Component Design Patterns

### 1. Navigation Shell & Sidebar
- **Background:** `--color-forest-900` (`#1A2F26`) with gold/sage subtle accents.
- **Active Navigation Item:** Solid background `--color-forest-800` (`#2C4A3E`), left border 3px `--color-sage-400` (`#7BA888`), text color `#FFFFFF`.
- **Badge Indicators:** Compact pill with count of pending admissions, overdue vitals, or active detox alarms.

### 2. Clinical Data Tables
- Compact row height (`44px` default, `36px` dense mode for vitals).
- Sticky header with warm sand border (`#E8DCC8`).
- Hover row state: `--color-sage-50` (`#F4F6F4`).
- Status indicators: Rounded pill with colored dot indicator (e.g., `In Detox`, `Inpatient Rehab`, `On Pass`, `Discharged`).

### 3. Patient Medical & Detox Header Card
- Top banner with patient photo/avatar, full legal name, alias (if requested for privacy), Calyvia ID (`CAL-2026-XXXX`), age/gender, admission date, attending doctor, primary counsellor, and active allergies/risk flags highlighted in red or amber badges.

### 4. Forms & Inputs
- Default border: `1px solid #D4C5B9` on `#FFFFFF` input background.
- Focus state: Border color `#2C4A3E`, ring `2px rgba(123, 168, 136, 0.4)`.
- Error state: Border color `#DC2626`, ring `2px rgba(220, 38, 38, 0.2)`.

---

## 5. Tailwind CSS & shadcn/ui Configuration Integration

The admin dashboard will expose these tokens via CSS variables and Tailwind theme extensions:

```css
:root {
  --background: 40 43% 98%;          /* #FDFBF7 */
  --foreground: 18 21% 20%;          /* #3D2E28 */

  --card: 0 0% 100%;                 /* #FFFFFF */
  --card-foreground: 18 21% 20%;

  --popover: 0 0% 100%;
  --popover-foreground: 18 21% 20%;

  --primary: 156 25% 23%;            /* #2C4A3E (Calyvia Pine Forest) */
  --primary-foreground: 0 0% 100%;

  --secondary: 138 21% 57%;          /* #7BA888 (Sage Green) */
  --secondary-foreground: 156 25% 15%;

  --muted: 40 25% 93%;               /* #F5EFE6 */
  --muted-foreground: 18 11% 38%;    /* #6B5D56 */

  --accent: 18 45% 56%;              /* #C17B5F (Terracotta) */
  --accent-foreground: 0 0% 100%;

  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;

  --border: 37 32% 86%;              /* #E8DCC8 */
  --input: 37 32% 86%;
  --ring: 138 21% 57%;               /* #7BA888 */

  --radius: 0.5rem;
}
```

This guarantees an elegant, reassuring, brand-coherent experience designed specifically for the healthcare professionals and administrative team at Calyvia Wellness Center.

---

## 6. Portal UI Conventions & Safe CMS Public Content Rendering

### 1. Management Portal Conventions (`portal.calyviawellness.co.ke`)
- **Protected Environment:** The portal operates strictly behind authenticated sessions with HTTP-only cookies on `portal.calyviawellness.co.ke`.
- **Data-Dense Layout:** Clinical tables use compact row padding (`py-2` to `py-2.5`), sticky column headers, and explicit loading/empty/error states.
- **Critical Action Safeguards:** Destructive or high-consequence clinical actions (e.g. discharging a patient, voiding an invoice, administering controlled medication) require double-confirmation dialogs with reason logging.
- **Accessibility:** Meets WCAG 2.1 AA standards for color contrast, full keyboard navigation (focus rings on `sage-400`), and screen-reader announcements on dynamic clinical alerts.

### 2. Public Site Protection & CMS Rendering Architecture
The public marketing website (`https://calyviawellness.co.ke/`) is **strictly protected** and must never be redirected, replaced, or broken. The implemented CMS adds routes for published careers, vlogs and announcements; all existing pages and branding remain unchanged.

#### Implemented security rules for public rendering:
1. **Anon-safe public view:** The `anon` role has no privileges on `cms_posts`. It can only `SELECT` from `published_cms_posts`, a security-barrier view that hard-filters `status = 'PUBLISHED'`, `published_at <= now()` and unexpired posts. Drafts and archived content cannot be selected.
2. **Draft isolation:** `DRAFT`, `IN_REVIEW` and `ARCHIVED` posts are visible only through authenticated, role-gated staff API routes (`SUPER_ADMIN`, `FACILITY_ADMIN`, `MANAGEMENT_EXECUTIVE`).
3. **No raw HTML:** Content is stored as structured blocks (`heading`, `paragraph`, `list`, `quote`). The API strips markup and control characters before persistence, and the website renders these values as React text nodes — never `dangerouslySetInnerHTML`. XSS through the editor is therefore not possible.
4. **Video safety:** Vlog URLs are normalized server-side to `youtube-nocookie.com/embed/...` or `player.vimeo.com/video/...`. The website re-validates the host before rendering an iframe; arbitrary iframes are rejected.
5. **Storage separation:** Public images use ordinary HTTPS URLs supplied in the CMS and are rendered as plain `<img>` tags. Patient charts, laboratory scans and signed consent PDFs remain in private storage with signed URLs and are never referenced by CMS posts.
6. **Automatic publishing:** Publishing, updating a live post, or unpublishing calls a Netlify build hook (`NETLIFY_CMS_BUILD_HOOK_URL`, server-side secret only). The website's prebuild fetches `GET /cms/published` and generates static data plus sitemap entries. If the API is unreachable, the site still builds with an empty list rather than failing.

