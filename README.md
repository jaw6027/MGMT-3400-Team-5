# CraftNDetail — studio & wardrobe prototype

A clickable class demonstration for a tailoring and clothing studio concept in Bakersfield, California. Built with plain JavaScript, CSS and Vite. No API keys or external services are required.

## Run locally

Use Node.js 22.12+ (tested with Node 24) and npm:

```sh
npm ci
npm run dev
```

Open the development address printed by Vite. `npm run build` creates a static `dist/` folder; `npm run preview` serves that production build. Use the existing checkout in cloud tasks; no worktree is needed.

## Presentation walkthrough

1. In **Design studio**, compare the terracotta skirt before and after shortening on neutral dressmaker mannequins. Switch between original and knee length, and side-by-side and proposed look.
2. Open **Jamie's profile** to edit fictional contact details, optional measurements in inches, and their source. These measurements do not reshape the mannequin.
3. Add alteration notes, review a fitting request, and save it. **My requests** shows the saved request. Nothing is sent or booked; prices and timing require a fitting.
4. Open **My wardrobe**. Four illustrated example pieces are included. Add several garment photos, select their type and activity, and edit items individually afterward.
5. Filter by lounge, athletic, work, or everyday use. Add pieces to the mannequin outfit board, name an outfit, and save it. Reload to demonstrate persistence.

## What is real, simulated, and deferred

- Working: browser navigation, original/proposed view selection, editable sample profile, saved demo requests, batch photo upload, wardrobe inventory edits/deletion, activity filtering, mannequin outfit arrangement, outfit saving/loading/deletion, responsive layout.
- Prepared AI sample: `public/images/skirt-comparison.png` is a generated before/after illustration inspired by the user's mannequin reference. Changing notes does not generate a new image. Original/short toggles select prepared imagery; no fabricated generation progress is displayed.
- Wardrobe arrangement: photographs appear as simple tiles over a neutral mannequin. Background removal, realistic garment draping and body-measurement simulation are not implemented.
- Storage: measurements and requests use localStorage; garment images and outfits use IndexedDB. Data is specific to this browser/site and does not synchronize between customers, devices or teammates. Use fictional data only. Clearing browser site data deletes everything. This is customer wardrobe inventory, not a business stock or production management system.
- Future work: live AI generation through a server-side service, photo consent and retention controls, authenticated customer accounts/database, additional services, staff intake for phone/email/in-person requests, real booking and pricing, optional measurement-based mannequins. Never put AI service credentials in browser code.

## Validation

```sh
npm run build
npm test
```

Browser tests use Playwright with `/usr/bin/chromium` in this cloud environment. Set `CHROMIUM_PATH` to a compatible local Chromium executable elsewhere. Tests cover preview choices, sample profile/request persistence, photo upload, wardrobe filters and editing, saved outfits and removal, and phone layout.

## Team integration

No customer, appointment, economics or service-catalog module was present when this section was created. Before joining sections, agree on the service list, customer identifiers, measurement units/source/date and recheck process, fitting-request handoff, pricing ownership, and who owns shared navigation/storage. Keep payment and confirmed orders separate from consultation requests. All current prices/dates are intentionally unconfirmed.

Prototype assets were generated with OpenAI image generation; sample clothing tiles are original SVG illustrations.
