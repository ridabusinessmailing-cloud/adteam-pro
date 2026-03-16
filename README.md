# AdTeam Pro — Internal Platform

A production-ready internal tool for ecommerce teams managing product testing,
creative production, advertising launches, and inventory.

---

## Tech Stack

- **Frontend**: React 18 + Vite
- **Backend / DB**: Supabase (Postgres + Auth + Realtime)
- **Deployment**: Vercel

---

## 1. Set up Supabase

### a) Create a project
1. Go to https://app.supabase.com
2. Click **New Project**
3. Give it a name (e.g. `adteam-pro`), set a strong DB password, pick a region

### b) Run the schema
1. In your Supabase dashboard → **SQL Editor** → **New Query**
2. Paste the entire contents of `supabase-schema.sql`
3. Click **Run**

### c) Create the 4 team accounts
1. Go to **Authentication** → **Users** → **Add User**
2. Create these 4 accounts with email + password:

| Name    | Email                     | Role   |
|---------|---------------------------|--------|
| Rida    | rida@yourcompany.com      | admin  |
| Oussama | oussama@yourcompany.com   | admin  |
| Saida   | saida@yourcompany.com     | member |
| Sana    | sana@yourcompany.com      | member |

3. After creating each user in Auth, copy their **UUID** from the Users table
4. Run this SQL to link them to the `users` table (replace UUIDs and emails):

```sql
insert into public.users (id, email, name, role) values
  ('RIDA-UUID',    'rida@yourcompany.com',    'Rida',    'admin'),
  ('OUSSAMA-UUID', 'oussama@yourcompany.com', 'Oussama', 'admin'),
  ('SAIDA-UUID',   'saida@yourcompany.com',   'Saida',   'member'),
  ('SANA-UUID',    'sana@yourcompany.com',    'Sana',    'member');
```

### d) Get your API credentials
1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

---

## 2. Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local and paste your Supabase URL and anon key

# 3. Start the dev server
npm run dev
# Opens at http://localhost:3000
```

---

## 3. Deploy to Vercel

### Option A — Vercel CLI (fastest)
```bash
npm install -g vercel
vercel
# Follow the prompts, set env vars when asked
```

### Option B — GitHub + Vercel Dashboard
1. Push this project to a GitHub repo
2. Go to https://vercel.com → **New Project** → Import your repo
3. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
4. Click **Deploy**

Vercel auto-deploys on every `git push` to `main`.

---

## 4. Project Structure

```
adteam-pro/
├── src/
│   ├── lib/
│   │   ├── supabase.js          # Supabase client
│   │   └── AuthContext.jsx      # Auth state + signIn/signOut
│   ├── hooks/
│   │   ├── useRealtimeTable.js  # Generic realtime CRUD hook
│   │   └── useInventory.js      # Stock movement logic
│   ├── components/
│   │   └── ui.jsx               # All shared UI components
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── Dashboard.jsx
│   │   ├── IdeasDB.jsx
│   │   ├── ProductPipeline.jsx
│   │   ├── CreativeBoard.jsx
│   │   ├── AdsTracker.jsx
│   │   ├── InventoryPage.jsx
│   │   ├── TaskManager.jsx
│   │   └── CalendarView.jsx
│   ├── App.jsx                  # Root with AuthProvider + sidebar
│   └── main.jsx                 # React entry point
├── supabase-schema.sql          # Full DB schema + RLS policies
├── vercel.json                  # SPA routing config
├── .env.example                 # Env var template
└── vite.config.js
```

---

## 5. Features

| Module               | Description |
|----------------------|-------------|
| 🏠 Dashboard          | Live KPIs, alerts, my tasks, team activity |
| 💡 Creative Ideas     | Library of ad concepts with statuses |
| 🧪 Product Pipeline   | Product validation, admin approve/reject |
| 🎬 Creatives          | Production Kanban with Drive links |
| 📊 Ads Tracker        | Multi-platform performance tracking |
| 📦 Inventory          | Stock cards, movements, history log |
| ✅ Tasks              | Drag-and-drop Kanban, completion checkbox |
| 📅 Calendar           | Monthly deadline view per member |

### Role-based permissions
- **Admins** (Rida, Oussama): full access, approve products, manage inventory
- **Members** (Saida, Sana): can add/edit their assigned items, read everything

### Realtime collaboration
All tables subscribe to Supabase Realtime — changes from one user
appear instantly for all others without page refresh.

### Inventory stock flow
```
Requested → Received → Available → Sale
```
Every movement is recorded in `stock_history` (append-only, never deleted).
Low stock alerts fire automatically when available stock drops below threshold.

---

## 6. Changing passwords

Users can reset their own passwords via Supabase Auth emails, or an admin can
reset them manually from the Supabase Dashboard → Authentication → Users.

---

## 7. Local development without Supabase

If you just want to preview the UI without setting up Supabase, the original
`adteam-pro.jsx` file (single-file version with localStorage) is still available
as a standalone React artifact.
