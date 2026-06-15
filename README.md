<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/dd54e446-d922-4ca5-9502-4e69c605c853

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the required environment variables in [.env.local](.env.local)
3. Run the app:
   `npm run dev`

## Deploy on Hostinger

This project is configured as a static Next.js export for Hostinger.

Use these settings in the Hostinger deployment panel:

```text
Framework: Other / Static site
Install command: npm install
Build command: npm run build
Publish directory: out
```

Add the Supabase variables below in the Hostinger environment variables before building.

## Supabase contact sync

The contact, simulator, and diagnostic forms are saved directly from the browser with the Supabase SDK. This keeps the forms working without GitHub and without depending on the Next.js API routes.

Required environment variables in local development and in Hostinger:

```env
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT_ID].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key-here"
GEMINI_API_KEY="your-gemini-api-key"
APP_URL="https://your-domain.com"
```

`DATABASE_URL` is optional now. It is only needed if you want to use Drizzle migrations or the API route fallback.

Before testing the forms, create the tables and insert policies in Supabase using:

```sql
-- lib/db/migrations/0000_strange_redwing.sql
-- lib/db/migrations/0001_public_insert_policies.sql
```
