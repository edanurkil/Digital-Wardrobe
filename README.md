# Kombin

Kombin is a wardrobe and outfit-planning app with an Expo mobile client and a FastAPI backend.

## Architecture

Supabase Auth manages accounts, Supabase Postgres stores wardrobe/outfit data, and private Supabase Storage stores photos. The Expo app talks directly to Supabase for those features; the local FastAPI process is not required for normal browsing, saving, or outfit creation.

The FastAPI service optionally removes photo backgrounds with `rembg`, verifies the user's Supabase access token, and writes processed photos to Supabase Storage. If the service is unavailable, the app uploads the original photo directly to the user's private Storage folder, so a sleeping image API does not prevent saving a clothing item or outfit. The API is required only for background removal, not for normal app data or original photo storage.

## Supabase setup

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql). This creates the tables, per-user RLS policies, outfit ownership checks, and private photo bucket.
3. In Supabase Authentication settings, enable **Anonymous Sign-Ins**, **Manual Linking**, and the email provider. Manual Linking is required to attach an email to an anonymous user.
4. Copy `mobile/.env.example` to `mobile/.env`. Set the project URL and the public anon/publishable key from Supabase. Never use a `service_role`/secret key in the mobile app.

The app's entry screen offers email/password sign-in or **Continue as guest**; it does not offer a separate public sign-up flow. A guest can make the account permanent from the profile screen: verify an email address, then set a password. Supabase links the email to the existing anonymous user, so the user's ID and wardrobe records remain unchanged. Guests should upgrade before signing out, clearing app data, or switching devices because anonymous credentials cannot be recovered. An email already attached to another Supabase account cannot be merged automatically; the guest session and its data remain intact if linking fails.

Supabase's default Auth email service only sends to project team addresses and is heavily rate-limited. Configure a custom SMTP provider in Supabase Authentication > SMTP Settings to deliver verification emails to ordinary users. The app allows passwords from 4 characters in its own validation; the Supabase Auth password policy must also permit that length, if the project settings allow it. Passwords shorter than 8 characters are not recommended for account security.

## Local development

1. From `backend`, install `requirements.txt`, copy `backend/.env.example` to `backend/.env`, and set `SUPABASE_URL` plus the server-only `SUPABASE_SERVICE_KEY`.
2. Start the image API from `backend`: `python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`.
3. From `mobile`, run `npm ci` and `npm run web` (or `npm start` for Expo).

For local development, `EXPO_PUBLIC_API_URL` can be `http://localhost:8000`; the Expo client rewrites loopback to the Metro host on a device. The API exposes `/health`.

## Android APK

The installed app must not use a developer computer's address. Deploy the Dockerized FastAPI image service to an HTTPS host, then set these EAS environment variables for both `preview` and `production`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (or `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- `EXPO_PUBLIC_API_URL` (the HTTPS URL of the deployed image API)

Set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` as private environment variables on the API host. The service key must never be added to EAS or the app. Then build the APK with `cd mobile; eas build --profile preview --platform android`.

The Supabase data and photo storage persist independently of the API host. Free API hosts can sleep, so the first photo upload after inactivity may be delayed or temporarily unavailable; normal wardrobe and outfit data still use Supabase directly. Background removal uses the lightweight `u2netp` model by default; set `REMBG_MODEL=u2net` to use the larger, higher-quality model where memory allows.

## Security and existing data

The app's tables and private Storage bucket enforce per-user access. Anonymous users use the authenticated database role, so the same per-user RLS policies apply to guests. The Storage insert policy restricts direct original-photo uploads to a folder named for the signed-in user's ID. Keep the Supabase service key server-side and rotate any credentials that were exposed during development. Existing SQLite records are not automatically copied to Supabase; back up and migrate them before removing any local data.

## Validation

From `mobile`:

```powershell
npm ci
npm run lint
npm exec -- tsc --noEmit
npm exec -- expo export --platform web
```

From the repository root:

```powershell
python -m compileall backend/app backend/migrate_add_outfit_image.py
```