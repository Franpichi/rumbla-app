# CLAUDE.md — Rumbla App

> This file is the authoritative context document for Claude Code working on the Rumbla mobile app.
> Read this entire file before touching any code. Do not make assumptions that contradict anything written here.
> When in doubt, ask. When something here is outdated, flag it — don't silently override it.

---

## 1. What is Rumbla?

Rumbla is a mobile running app that turns every run into a territorial battle. Users conquer city blocks represented as H3 hexagons (~50m radius) by physically running through them. Hexagons stay conquered until another user runs over them and steals them. The core loop is: run → conquer → get stolen from → run again.

**Tagline:** *Turn every run into a battle. Conquer your city, street by street.*

**Target market:** Copenhagen first → Nordics → Europe. iOS first.

**Primary persona:** Alex, 26yo, runs 2–3x/week, motivated by social competition and territorial ownership. Does not care about VO2 max. Opens the app on rest days to check if someone stole their zones.

---

## 2. Current Phase

**Phase 3 — Technical Architecture** (active)

We are in the pre-development phase. No app code has been written yet. The current work is:
- Locking remaining technical decisions
- Setting up the development environment
- Designing the Supabase schema before writing a single line of app code

**Do not start building features until Phase 3 architecture decisions are fully locked.**

Phase 4 (MVP Development) starts after:
1. User test with 3–5 Copenhagen runners on Figma prototype — pending
2. Database schema executed in Supabase (SQL in section 7)
3. `rumbla-contact` Edge Function deployed
4. Mapbox account + token + custom style created
5. This CLAUDE.md updated with final decisions

---

## 3. Tech Stack — Confirmed Decisions

Every item here is locked. Do not suggest alternatives without a strong reason.

| Layer | Technology | Notes |
|-------|-----------|-------|
| Mobile framework | React Native + Expo (managed workflow) | Solo founder, fastest iteration |
| Platform | iOS first | Android in V1.0 |
| Language | TypeScript | Strict mode. No `any`. |
| Maps | Mapbox via `@rnmapbox/maps` | Custom dark style matching Design System |
| Territory system | Uber H3 (resolution 10 or 11) | ~50m hex radius, validate with GPS testing |
| H3 → GeoJSON | `h3-js` | `cellToBoundary()` for rendering |
| Backend | Supabase | Auth + Postgres DB + Realtime + Edge Functions |
| Auth | Sign in with Apple (MVP) + Google OAuth (MVP) | Apple required by App Store. Google needed for Android testing. |
| Push notifications | `expo-notifications` | Zone stolen, friend joined, streak reminder |
| GPS tracking | `expo-location` | Background tracking during active run only |
| HealthKit | `expo-health` | iOS only, distance + steps sync |
| Contacts | `expo-contacts` | Find friends by phone number |
| Sharing | `expo-sharing` + `expo-media-library` | Stories export, WhatsApp deep link |
| State management | Zustand | One store per domain |
| Email | Resend | Already configured — rumbla.app domain verified |
| Hosting (landing) | Netlify | Live at rumbla.app |
| Analytics | TBD (Mixpanel or Amplitude free tier) | Phase 4 |
| Crash reporting | TBD (Sentry free tier) | Phase 4 |

---

## 4. Design System — Exact Tokens

All UI work must use these exact values. Never hardcode colors.

### Colors — Dark Mode (primary)
```typescript
export const colors = {
  bgBase:     '#0D0F14',
  bgSurface:  '#141720',
  bgElevated: '#1C2030',
  bgOverlay:  '#252A3A',
  textPrimary:   '#F0F2F8',
  textSecondary: '#8B93A8',
  textDisabled:  '#4A5168',
  accent:     '#FF5C35',
  accentDim:  'rgba(255, 92, 53, 0.12)',
  accentGlow: 'rgba(255, 92, 53, 0.25)',
  teal:    '#00E5CC',
  tealDim: 'rgba(0, 229, 204, 0.1)',
  blue:    '#4D8EFF',
  hexOwn:     '#FF5C35',
  hexFriend:  '#4D8EFF',
  hexEnemy:   '#FF3B6E',
  hexNeutral: '#1C2030',
  borderSubtle: '#1F2435',
  borderStrong: '#2D3350',
}
```

### Colors — Light Mode
```typescript
export const colorsLight = {
  bgBase:     '#F2F3F7',
  bgSurface:  '#FFFFFF',
  bgElevated: '#ECEEF4',
  bgOverlay:  '#E2E5ED',
  textPrimary:   '#0D0F14',
  textSecondary: '#4A5168',
  textDisabled:  '#8B93A8',
  accent:     '#FF4D1F',
  teal:       '#00CCBA',
  blue:       '#3D7FFF',
  borderSubtle: '#DDE0EA',
  borderStrong: '#C2C8D8',
}
```

### Typography
```typescript
export const typography = {
  fontFamily: 'Inter',
  xs: 11, sm: 13, base: 15, md: 17, lg: 20, xl: 24, xxl: 32,
  light: '300', regular: '400', medium: '500', semibold: '600', bold: '700',
  // Logo: Barlow Condensed Black (web only). In app: Inter Bold for headings.
}
```

### Spacing (8px grid) + Border Radius
```typescript
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 }
export const radius  = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 }
```

### Mapbox dark style (create in Mapbox Studio)
```
Background: #0D0F14 · Roads: #1C2030 · Labels: #8B93A8 · Water: #0A0D12
```

---

## 5. Folder Structure

Confirmed as of 2026-03-18. The `src/` folder is currently empty — populate according to this spec.

```
rumbla-app/
├── CLAUDE.md                    ← you are here
├── app.json
├── App.tsx                      ← Expo boilerplate entry — will be replaced
├── index.ts
├── package.json
├── tsconfig.json
├── .env.example
├── .env                         ← NOT committed
├── .gitignore
│
├── src/
│   ├── screens/
│   │   ├── MapScreen.tsx
│   │   ├── RunScreen.tsx
│   │   ├── RunSummaryScreen.tsx
│   │   ├── FeedScreen.tsx
│   │   ├── RankingsScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   ├── OnboardingScreen.tsx
│   │   └── SettingsScreen.tsx
│   │
│   ├── components/
│   │   ├── map/
│   │   │   ├── HexLayer.tsx     ← H3 hex rendering (ShapeSource + FillLayer)
│   │   │   ├── RunRoute.tsx
│   │   │   └── GpsDot.tsx
│   │   ├── feed/
│   │   │   ├── FeedPost.tsx
│   │   │   └── ReactionBar.tsx
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Avatar.tsx
│   │   │   └── HexCount.tsx
│   │   └── notifications/
│   │       └── ZoneStolenToast.tsx
│   │
│   ├── hooks/
│   │   ├── useGPS.ts
│   │   ├── useHexConquest.ts
│   │   ├── useRealtime.ts
│   │   ├── useAuth.ts
│   │   └── useTheme.ts
│   │
│   ├── services/
│   │   ├── supabase.ts
│   │   ├── mapbox.ts
│   │   ├── h3.ts
│   │   ├── notifications.ts
│   │   └── sharing.ts
│   │
│   ├── store/
│   │   ├── authStore.ts
│   │   ├── runStore.ts
│   │   ├── mapStore.ts
│   │   └── uiStore.ts
│   │
│   ├── utils/
│   │   ├── hex.ts
│   │   ├── formatting.ts
│   │   └── constants.ts
│   │
│   ├── types/
│   │   ├── database.ts          ← Supabase generated types
│   │   ├── navigation.ts
│   │   └── models.ts
│   │
│   └── navigation/
│       ├── RootNavigator.tsx
│       ├── TabNavigator.tsx
│       └── OnboardingNavigator.tsx
│
├── assets/
│
└── supabase/                    ← Supabase CLI — DO NOT DELETE OR MODIFY STRUCTURE
    └── functions/
        ├── rumbla-waitlist/
        │   └── index.ts         ← LIVE in production
        └── rumbla-contact/
            └── index.ts         ← TO CREATE — then: supabase functions deploy rumbla-contact
```

---

## 6. Environment Variables

```bash
# .env.example — commit this
# .env — never commit

EXPO_PUBLIC_SUPABASE_URL=https://rocqjhbixkxzpyczvccl.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
EXPO_PUBLIC_MAPBOX_STYLE_URL=mapbox://styles/your_username/your_style_id

EXPO_PUBLIC_APP_ENV=development
```

**Rules:**
- All client-side vars must be prefixed `EXPO_PUBLIC_`
- Service role key NEVER in the app — Edge Functions only
- Rotate any accidentally committed token immediately

---

## 7. Database Schema

Run this SQL in Supabase SQL Editor before starting Phase 4.

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  city TEXT DEFAULT 'Copenhagen',
  hex_count_total INTEGER DEFAULT 0,
  hex_count_current INTEGER DEFAULT 0,
  streak_current INTEGER DEFAULT 0,
  streak_longest INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hexagons (
  h3_index TEXT PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id),
  city TEXT NOT NULL DEFAULT 'Copenhagen',
  conquered_at TIMESTAMPTZ DEFAULT NOW(),
  previous_owner_id UUID REFERENCES profiles(id),
  conquest_count INTEGER DEFAULT 1
);

CREATE TABLE runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  distance_meters FLOAT,
  duration_seconds INTEGER,
  hexagons_conquered INTEGER DEFAULT 0,
  hexagons_stolen INTEGER DEFAULT 0,
  hexagons_lost INTEGER DEFAULT 0,
  map_snapshot_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE follows (
  follower_id UUID REFERENCES profiles(id),
  following_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE feed_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  run_id UUID REFERENCES runs(id),
  map_snapshot_url TEXT,
  distance_meters FLOAT,
  hexagons_conquered INTEGER,
  hexagons_stolen INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES feed_posts(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES feed_posts(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rankings_weekly (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  city TEXT NOT NULL DEFAULT 'Copenhagen',
  week_start DATE NOT NULL,
  hexagons_conquered INTEGER DEFAULT 0,
  rank INTEGER,
  UNIQUE(user_id, week_start)
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hexagons ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rankings_weekly ENABLE ROW LEVEL SECURITY;
```

**RLS rules (implement after table creation):**
- `profiles` — public read, authenticated write own row only
- `hexagons` — public read (city-scoped), write via Edge Function only
- `runs` — owner read/write, public read for feed
- `follows` — authenticated CRUD own rows
- `feed_posts` — owner write, followers read
- `reactions` + `comments` — authenticated write, owner/follower read

---

## 8. Core Mechanics — Hex Conquest

### GPS → H3 Index
```typescript
import { latLngToCell } from 'h3-js';

const H3_RESOLUTION = 10; // Validate with GPS testing. Candidate: 11.

function gpsToHexId(lat: number, lng: number): string {
  return latLngToCell(lat, lng, H3_RESOLUTION);
}
```

### Conquest Logic — runs in Edge Function ONLY, never in client
```typescript
async function processHexConquest(userId: string, h3Index: string) {
  const { data: existing } = await supabase
    .from('hexagons')
    .select('owner_id, conquest_count, profiles(display_name)')
    .eq('h3_index', h3Index)
    .single();

  if (!existing || existing.owner_id === userId) {
    await supabase.from('hexagons').upsert({
      h3_index: h3Index,
      owner_id: userId,
      conquered_at: new Date().toISOString(),
    });
    return { conquered: true, stolen_from: null };
  }

  // THEFT
  await supabase.from('hexagons').update({
    owner_id: userId,
    conquered_at: new Date().toISOString(),
    previous_owner_id: existing.owner_id,
    conquest_count: existing.conquest_count + 1,
  }).eq('h3_index', h3Index);

  await triggerZoneStolenNotification(existing.owner_id, userId, h3Index);
  return { conquered: true, stolen_from: existing.profiles };
}
```

### H3 → GeoJSON for Mapbox
```typescript
import { cellToBoundary } from 'h3-js';

const toGeoJSON = (hexIds: string[]) => ({
  type: 'FeatureCollection' as const,
  features: hexIds.map(id => ({
    type: 'Feature' as const,
    geometry: { type: 'Polygon' as const, coordinates: [cellToBoundary(id, true)] },
    properties: { id }
  }))
});
```

### Realtime subscription
```typescript
const subscription = supabase
  .channel('hex-updates')
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'hexagons',
    filter: 'city=eq.Copenhagen'
  }, (payload) => { mapStore.updateHex(payload.new); })
  .subscribe();

// Always unsubscribe on screen blur / run end
return () => { supabase.removeChannel(subscription); };
```

---

## 9. Navigation Structure

```
RootNavigator
├── OnboardingStack (when !authenticated)
│   ├── SplashScreen
│   ├── AuthScreen (Apple + email)
│   ├── ProfileSetupScreen
│   ├── PermissionsScreen (GPS → Notifications)
│   └── FindFriendsScreen (skippable)
└── MainTabs (when authenticated)
    ├── MapTab → MapScreen
    ├── RunTab → RunScreen
    ├── FeedTab → FeedScreen
    └── ProfileTab → ProfileScreen
        └── RankingsScreen
```

**Deep links:**
- Zone stolen → MapScreen centered on stolen hex
- Friend joined → ProfileScreen
- Weekly ranking update → RankingsScreen

---

## 10. MVP Scope

### ✅ Build in Phase 4
Sign in with Apple + email · GPS run tracking · H3 conquest + theft · Real-time map · Zone stolen notifications · Run summary + Stories share · Social feed (friends + global) · Friend system (contacts + username) · Weekly + all-time rankings · Profile + streak · Block + report (Apple required) · Delete account + data export (GDPR required) · Notification preferences (Apple required)

### ❌ Do NOT build
Teams · Decay system · Hex history · Neighborhood summaries · Friend challenges · Calories/elevation · Audio cues · Meta friend finding · TikTok share · Light mode toggle · Advanced stats · Premium features

---

## 11. Performance Rules

**GPS:** Background mode during active run only. Stop immediately on run end. Max 15% battery per 30min. Debounce conquest: every 5s, only on new hex entry.

**Map:** Max 2,000 hexagons rendered. Viewport-based loading only. `setNativeProps` for updates. `ShapeSource` + `FillLayer` — never `Marker`.

**Realtime:** Subscribe only during active run or MapScreen focus. Unsubscribe on blur/end. Max 10 hex updates/second.

**Startup:** Cold start < 3s. Lazy load Feed and Rankings.

---

## 12. Security Rules

- Service role key: Edge Functions only, never in app
- Mapbox token: read-only scopes only
- Hex conquest: server-side validation only
- Direct writes to `hexagons`: forbidden from client
- RLS: enabled on every table, no exceptions

**Anti-spoofing:**
- Min 3s between adjacent hex conquests
- GPS velocity > 12 m/s = flagged
- Statistically impossible patterns = flagged for review

---

## 13. Code Conventions

**TypeScript:** Strict mode. No `any`. Explicit types everywhere.

**Components:** Functional, named exports, typed props interface.

**Naming:** Components `PascalCase` · Hooks `useX` · Services `camelCase` · Constants `SCREAMING_SNAKE` · Types `PascalCase`

**Import order:** React → React Native → Expo → Third-party → Internal (`@/`) → Relative

**Zustand:** One store per domain, fully typed interface.

---

## 14. Microcopy Rules

- Territorial + personal: "You conquered 3 zones" not "You earned 3 hexagons"
- Name the rival: "Mads stole 5 of your zones in Nørrebro" not "Someone stole your zone"
- Create urgency: "Mads has had your zones for 2 hours"
- Motivate at rank boundary: "3 zones from #4. You know what to do."
- Celebrate theft: "You stole 3 zones from Mads. He's going to want them back."
- Never generic. Every empty state, CTA, and notification must feel personal.

---

## 15. What NOT to Do

❌ Team features · Decay system · Android build · Light mode toggle · Scope creep
❌ `any` in TypeScript · Secrets in app bundle · Client writes to `hexagons`
❌ Indefinite realtime subscriptions · `Marker` for hex rendering
❌ Analytics or crash reporting in Phase 3

---

## 16. External Services — Live Status

**Supabase** — `https://rocqjhbixkxzpyczvccl.supabase.co` · Ireland eu-west-1
CLI initialized at `supabase/` in repo root. Deploy: `supabase functions deploy <name>`

| Resource | Status |
|----------|--------|
| Table: `waitlist` | ✅ Live |
| Table: `contacts` | ✅ Live |
| Table: `profiles` | ⬜ Create — SQL in section 7 |
| Table: `hexagons` | ⬜ Create |
| Table: `runs` | ⬜ Create |
| Table: `follows` | ⬜ Create |
| Table: `feed_posts` | ⬜ Create |
| Table: `reactions` | ⬜ Create |
| Table: `comments` | ⬜ Create |
| Table: `rankings_weekly` | ⬜ Create |
| Edge Function: `rumbla-waitlist` | ✅ Live — `supabase/functions/rumbla-waitlist/index.ts` |
| Edge Function: `rumbla-contact` | ⬜ Create file at `supabase/functions/rumbla-contact/index.ts` → deploy |
| Edge Function: `rumbla-conquest` | ⬜ Phase 4 |

**Resend** — `rumbla.app` verified · Ireland eu-west-1 · 3,000 emails/mo free · sends from `info@rumbla.app`

**Mapbox** — Account to create · Token name: `rumbla-app-prod` · Scopes: styles:read, fonts:read, tiles:read

**Expo / EAS** — Account to create · Bundle ID: `app.rumbla` · Apple Developer: pending (~$99/yr)

---

## 17. Repos & Branching

```
github.com/Franpichi/rumbla-app   ← this repo
github.com/Franpichi/rumbla-web   ← landing page (live)
```

Branches: `main` (production) · `dev` (active) · feature branches from `dev`
Never push directly to `main`.

---

## 18. Project Documentation

Notion workspace: `31b454f2-d01b-81d2-9bb7-fa0fe9f26494`
Key pages: Decisions Log · Feature Map · Core User Flows · Technical page · CLAUDE.md mirror

When you lock a new decision → add to Decisions Log. Don't keep decisions only in code comments.

---

## 19. Session Workflow

1. Read this CLAUDE.md
2. Before building a feature → check section 10 (MVP scope)
3. Before DB queries → check section 7 (schema)
4. Before any UI → use exact tokens from section 4
5. After significant work → update this file
6. If something here is wrong → flag it, don't silently override

---

*Last updated: 2026-03-18*
*Phase: 3 — Technical Architecture*
*Next: deploy rumbla-contact → execute DB schema → Mapbox setup → user test → Phase 4*
