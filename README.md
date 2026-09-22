# Kombin

Kombin is a wardrobe and outfit-planning app with an Expo mobile client and a FastAPI backend.

## Local development

1. Copy `backend/.env.example` to `backend/.env` and fill in the backend-only values.
2. Create a Python environment with Python 3.11+ and install `backend/requirements.txt`.
3. Start the API from `backend` with `python -m uvicorn app.main:app --reload --port 8000`.
4. Copy `mobile/.env.example` to `mobile/.env` and set `EXPO_PUBLIC_API_URL` to the API URL reachable by the device or browser.
5. From `mobile`, run `npm ci` and `npm start`.

The API exposes `/health` for deployment health checks. Production deployments must use HTTPS and set `ALLOWED_ORIGINS` to the deployed web origins.

## Security

Never commit `.env` files. The previously used Supabase service key and database password must be rotated in Supabase before deployment because they have been exposed during development. The service key belongs only on the backend; the mobile app may use the public anon key with correct Supabase RLS policies.

## Validation

From `mobile`:

```powershell
npm ci
npm run lint
npm exec -- tsc --noEmit
npm exec -- expo export --platform web
```

From the repository root, with the backend environment active:

```powershell
python -m compileall backend/app backend/migrate_add_outfit_image.py
```