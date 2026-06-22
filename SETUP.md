# Fittnessimo — Setup Guide
### 3 steps, ~10 minutes, completely free

---

## Step 1 — Supabase (your database)

1. Go to **https://supabase.com** → click "Start your project" → sign up free
2. Click **"New project"** → give it any name → set a password → click Create
3. Wait ~1 minute for it to load
4. In the left sidebar click **"SQL Editor"** → click **"New query"**
5. Open the file `supabase_schema.sql` from this folder, copy everything, paste it in, click **Run**
6. Go to **Settings → API** (left sidebar)
7. Copy two values:
   - **Project URL** (looks like `https://abcdef.supabase.co`)
   - **anon / public key** (long string starting with `eyJ…`)

---

## Step 2 — Deploy to Vercel

1. Go to **https://github.com** → sign up / log in → create a **New repository** called `fittnessimo`
2. Upload all the files from this folder into it (drag and drop works)
3. Go to **https://vercel.com** → sign up free with your GitHub account
4. Click **"Add New Project"** → import your `fittnessimo` repo → click Deploy
5. Once deployed, go to your project → **Settings → Environment Variables** → add these 3:

   | Name | Value |
   |------|-------|
   | `REACT_APP_SUPABASE_URL` | your Project URL from step 1 |
   | `REACT_APP_SUPABASE_ANON_KEY` | your anon key from step 1 |
   | `REACT_APP_COACH_EMAIL` | **your own email address** |

6. Go to **Deployments** → click the three dots on the latest → **Redeploy**
7. Your app is now live at `fittnessimo.vercel.app` (or similar)

---

## Step 3 — Enable magic link emails in Supabase

1. In Supabase go to **Authentication → Providers**
2. Make sure **Email** is enabled (it is by default)
3. Go to **Authentication → URL Configuration**
4. Set **Site URL** to your Vercel URL (e.g. `https://fittnessimo.vercel.app`)

---

## You're live! How to use it

**As coach:**
- Go to your app URL → enter your email → click the magic link
- You'll see the Coach dashboard
- Add clients by their email under the "Clients" tab
- Build and assign workouts under "Build workout"
- Read client feedback under "Feedback"

**Inviting clients:**
- Just tell them to go to your app URL and enter their email
- They'll get a magic link and land on their personal client view
- Note: you must add their email in the Clients tab first so the app recognises them

---

## Optional: get notified by email when a client submits

1. In Supabase go to **Database → Webhooks** → Create a new webhook
2. Table: `feedback`, Event: `INSERT`
3. Use **https://resend.com** (free, 3000 emails/month) to receive the notification
   - Sign up → get API key → follow their webhook docs to forward to your email

