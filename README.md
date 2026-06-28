# JOSHGRAPHIX_WORLD Portfolio Website

Premium portfolio website foundation for JOSHGRAPHIX_WORLD.

## What is included

- Luxury purple, violet, black, white, gold, and silver design system.
- Landing page with generated 3D creative-studio hero asset.
- Animated statistics, services, category covers, albums, masonry-style projects, project modal, fullscreen viewer, share button, watermark text, and disabled right-click on project previews.
- Search and sorting by keyword, category, price, newest, oldest, and popularity.
- Pricing samples, about section, testimonials, FAQ, contact form, email/call buttons, and WhatsApp integration.
- Admin dashboard preview showing the management surface for categories, albums, projects, messages, analytics, and storage.
- SEO basics: meta tags, Open Graph, Twitter card, schema markup, robots.txt, and sitemap.xml.

## Editing content

Most visible content lives in `data.js`.

- Add services in `services`.
- Add portfolio categories in `categories`.
- Add samples and prices in `projects`.
- Update WhatsApp, email, phone, address, and social platforms in `contact`.

## Preview

Run `node preview-server.cjs` and open `http://127.0.0.1:4173`.

## Admin

Open `admin.html` to sign in with the configured admin email and password. The current login is a static front-end gate for the dashboard preview; production security should be handled by the future Next.js/backend phase.

## Next production phases

1. Rebuild this UI in Next.js App Router with TypeScript and Tailwind CSS.
2. Add Prisma and PostgreSQL using the schema in `architecture/prisma-schema.prisma`.
3. Add secure admin authentication, Cloudinary/Supabase uploads, image compression, thumbnails, and WebP generation.
4. Add contact email delivery, spam protection, internal analytics, GA4, and deployment configuration.
