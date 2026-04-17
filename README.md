# SignalDock

SignalDock is a multi-tenant mock platform for teams that need hosted REST endpoints and Socket.IO events before a backend is ready. It is designed for frontend development, QA flows, demos, integration testing, and mobile app prototyping.

## Live Demo

https://api.masudranadev.com/

## Features

- Hosted mock REST APIs under `/{username}`
- Hosted Socket.IO namespaces and triggerable events
- Dynamic response placeholders such as `[[UUID]]`, `[[NAME]]`, `[[EMAIL]]`, and `[[NOW_ISO]]`
- Per-route and per-event analytics
- Rate limiting with temporary IP blocking
- Server-rendered landing page with SEO metadata, structured data, `robots.txt`, and `sitemap.xml`
- Production-ready Tailwind build instead of CDN styling

## Stack

- Node.js 22+
- Express
- Socket.IO
- JSON file-backed persistence
- EJS
- Tailwind CSS

## Quick Start

Install dependencies:

```bash
npm install
```

Start the full development environment:

```bash
npm run dev
```

This runs:

- the Tailwind watcher
- the Express server in watch mode

Open:

```text
http://localhost:3000
```

## Scripts

- `npm run dev` starts the app in development mode with CSS watching and server reloads
- `npm run build` builds minified CSS and creates a production bundle in `dist/`
- `npm start` starts the app from the source workspace using the already-built CSS asset
- `npm run preview` runs the built app from `dist/`

## Production Build

Build the production bundle:

```bash
npm run build
```

Deploy the generated `public/assets/styles.css` file with the app. This avoids Tailwind rebuild issues on hosts that run npm scripts outside the project root.

The output lands in `dist/` and includes:

- server source
- EJS views
- public assets
- environment example
- package metadata for deployment

To preview the build locally:

```bash
npm run preview
```

## Environment

Copy the example file if you want explicit local configuration:

```bash
cp .env.example .env
```

Environment variables:

- `APP_URL`: canonical site URL used for sitemap and SEO metadata, for example `https://api.masudranadev.com/`
- `PORT`: HTTP port for the Express server
- `SESSION_SECRET`: session signing secret

## Project Structure

```text
.
|-- public/            # Browser assets
|-- scripts/           # Build scripts
|-- src/               # Server, data, and business logic
|-- views/             # EJS templates
|-- dist/              # Production build output
`-- data/              # Runtime JSON data created at runtime
```

## Notes

- Runtime data is stored in `data/signaldock.json`.
- The production bundle keeps runtime data separate under `dist/data/` when run from `dist/`.
- Dashboard pages are marked `noindex`; the public landing page is optimized for SEO.
- `health`, `robots.txt`, and `sitemap.xml` are available out of the box.

## License

MIT
