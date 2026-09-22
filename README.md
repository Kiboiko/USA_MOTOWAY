# Carviondealer Website

Next.js website for Carviondealer.

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in production service values.
3. Run locally: `npm run dev`
4. Build for production: `npm run build`

## Notes

- Vehicle photos live under `public/inventory` and `public/sold`, but are **not in this repo** —
  hundreds of MB of JPEGs would stay in its history forever. A fresh clone shows listings without
  photos until those folders are copied in from the server (`/var/www/motoway/public/…`) or the
  photos are re-uploaded through `/admin/inventory`.
- Admin pages require `LIVE_CHAT_ADMIN_PASSCODE`.
- Lead and chat submissions require the Google webhook environment variables.
