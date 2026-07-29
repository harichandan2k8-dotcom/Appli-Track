# AppliTrack

AppliTrack is a static, authenticated appliance-care web application. It uses Supabase Auth for persistent user sessions and Supabase Postgres with Row Level Security for private appliance and service records.

## Publish checklist

1. Create a Supabase project and run `supabase-schema.sql` in its SQL Editor.
2. In Supabase Auth settings, set your production site's URL and allowed redirect URLs. Configure email confirmation for production.
3. Copy the Project URL and **anon/publishable** key into `js/config.js`. Do not use a `service_role` key.
4. Deploy this folder to any static host such as Netlify, Vercel, GitHub Pages, or Cloudflare Pages.
5. Test sign-up, confirmation email, sign-in, data creation, sign-out, and that a second account cannot see the first account's data.

The app intentionally starts with no sample accounts, appliances, or service records.
