# AppliTrack

AppliTrack is a static, authenticated appliance-care web application. It uses Supabase Auth for persistent user sessions and Supabase Postgres with Row Level Security for private appliance and service records.

## Publish checklist

1. Create a Supabase project and run `supabase-schema.sql` in its SQL Editor.
2. In Supabase Auth settings, set your production site's URL and allowed redirect URLs. Configure email confirmation for production.
3. Copy the Project URL and **anon/publishable** key into `js/config.js`. Do not use a `service_role` key.
4. Deploy this folder to any static host such as Netlify, Vercel, GitHub Pages, or Cloudflare Pages.
5. Test sign-up, confirmation email, sign-in, data creation, sign-out, and that a second account cannot see the first account's data.

The app intentionally starts with no sample accounts, appliances, or service records.

## Appliance Care Chatbot setup

The floating Appliance Care Assistant is powered by the separate Supabase Edge Function `appliance-chat`. It keeps chat history in the browser only and reads appliance context only from the signed-in user's existing appliance data.

1. Install and authenticate the [Supabase CLI](https://supabase.com/docs/guides/cli), then link this folder to the appropriate Supabase project.
2. Set the Gemini key as a Supabase secret. Do not add this key to `js/config.js` or any project file:

   ```powershell
   supabase secrets set GEMINI_API_KEY=your_key_here
   ```

3. Deploy the function:

   ```powershell
   supabase functions deploy appliance-chat
   ```

4. Open the app, sign in, and use the assistant button at the bottom-right. The function uses Gemini `gemini-2.0-flash` and does not create or change any database tables.
