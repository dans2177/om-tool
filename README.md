# OM Tool – Phase 1

A Next.js app that helps real estate teams process Offering Memorandums (OMs) by extracting key info and images fast, saving ~1 hour of manual hunting.

## Setup

### 1. Environment Variables

Add these to your Vercel dashboard (Settings → Environment Variables) or to a local `.env.local`:

```
OPENAI_API_KEY=sk-...
OPENCAGE_API_KEY=...
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

- **OPENAI_API_KEY** – Get from [platform.openai.com](https://platform.openai.com)
- **OPENCAGE_API_KEY** – Get from [opencagedata.com](https://opencagedata.com)
- **BLOB_READ_WRITE_TOKEN** – Vercel Dashboard → Storage → Blob → Create Store → Copy token

### 2. Logo (Optional)

Place your watermark logo at `public/logo.png`. If missing, a text-based "CONFIDENTIAL" watermark is used instead.

### 3. Install & Run

```bash
npm install
npm run dev
```

### 4. Deploy

```bash
npx vercel --prod
```

## Flow

1. **Upload** – Drag-drop a PDF OM
2. **Image Approval** – Select/deselect images, toggle watermark, compress, upload extras
3. **Review** – Download locked PDF + images, edit extracted data, preview PDF

## Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Vercel Blob (file storage)
- OpenAI gpt-4o-mini (data extraction)
- OpenCage (geocoding)
- pdf-parse + pdfjs-dist + pdf-lib (PDF processing)
- Sharp (image processing)
- react-pdf (PDF viewer)
- React Hook Form (editable data)
- lucide-react (icons)
