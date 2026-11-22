# CraftNDetail — studio & wardrobe prototype

A clickable class demonstration for a tailoring and clothing studio concept in Bakersfield, California. Built with plain JavaScript, CSS and Vite. No API keys or external services are required.

## Service catalog (Priority 1 — Oshea)

Open **Services** to browse 48 potential services across fit adjustments, silhouette changes, repairs, personalization, thrift transformations, and custom clothing. Search combines with category filters; each card includes options and garment-review considerations. The `#services` URL fragment opens the catalog directly.

Choose **Describe my idea** on a card to preselect the service, or **Describe my own idea** for an unlisted project. Describe the garment and desired change; optional details cover condition/fabric/previous alterations, details to preserve, preferred fit/measurements, inspiration references, budget, requested date, and leftover fabric. References are stored as text, not uploaded photos or generated previews. Review, edit, then save to **My requests** under the current sample profile. Older skirt requests remain compatible. Unsaved fields remain while browsing but reset on reload; saved requests persist only in this browser. Storage failures keep the review open and report that nothing was saved.

This is a classroom exploration catalog, not a promise of service availability. Every garment requires assessment; no prices or turnaround times are quoted. Requests do not contact the studio or create bookings. Use fictional customer details. The wardrobe and quote calculator remain separate workflows; catalog selections do not automatically price a job or change wardrobe records.

Catalog content is in `src/catalog-data.js`; browsing/intake is in `src/catalog.js`. Validate with the browser suite, build Pages, and export the standalone demo after changes. The committed ZIP download below predates this catalog; generate a fresh standalone HTML with `npm run export:demo` for an offline copy with Services.

## Open the clickable website

If a chat file preview says **Couldn't load this file**, download the [offline demo ZIP from GitHub](https://github.com/jaw6027/MGMT-3400-Team-5/raw/refs/heads/main/downloads/CraftNDetail-demo.zip) instead. Extract the ZIP, then open `CraftNDetail-demo.html` with a desktop web browser. Do not open the HTML inside the ZIP or a document preview. The archive contains the self-contained app and a short instruction file; it does not require installation. Download a new ZIP for updates. To refresh this archive after source changes, run `npm run package:demo` (Node.js and Python 3 are needed only to build/package, not to view it).

The repository includes a prebuilt GitHub Pages site in `docs/`. A repository administrator can enable hosting once:

1. In GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select **main** and **/docs**, then click **Save**.
4. Wait for GitHub to finish deployment. Open the site address GitHub displays on that page.

The expected address is `https://jaw6027.github.io/MGMT-3400-Team-5/`, but it is not live until Pages has been enabled and deployment succeeds. GitHub may restrict Pages based on repository visibility, account plan, or organization settings; do not change repository visibility just to enable hosting.

After UI changes, run `npm run build:pages` and commit the updated `docs/` alongside the source so Pages serves the latest version. `docs/` is generated output, not a separate application to edit. Relative asset paths support the repository URL.

For a version that opens without hosting, run `npm run export:demo`. Download `exports/CraftNDetail-demo.html` and open it in Chrome, Edge, Firefox, or Safari. No installation or account is needed to view it. After an update, download a new copy: an existing downloaded file does not update automatically. Browser storage for downloaded files is browser-specific and separate from the hosted website. Use fictional data. Regenerate this file after UI changes; the export is intentionally not committed.

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
4. Open **My wardrobe**. Four realistic AI-generated sample product photos are included. Add several garment photos, select their type and activity, and edit items individually afterward.
5. Filter by lounge, athletic, work, or everyday use. Drag garment photos onto the mannequin outfit board, or use the accessible **Add to outfit** buttons. A piece automatically goes into its top, bottom, or shoes slot; adding another of the same type replaces it. Name and save a look, or clear the current board without deleting saved outfits. Reload to demonstrate persistence.

## What is real, simulated, and deferred

- Working: browser navigation, original/proposed view selection, editable sample profile, saved demo requests, batch photo upload, wardrobe inventory edits/deletion, activity filtering, mouse/touch drag-and-drop mannequin outfit arrangement, outfit saving/loading/deletion, responsive layout.
- Prepared AI sample: `public/images/skirt-comparison.png` is a generated before/after illustration inspired by the user's mannequin reference. Changing notes does not generate a new image. Original/short toggles select prepared imagery; no fabricated generation progress is displayed.
- Wardrobe preview: the four built-in garments use prepared AI images of dressed mannequins, with separate previews for single garments and all four top/bottom combinations. This is not live AI generation or a calculated fit. Uploaded/custom combinations use transparent-margin trimming and adjustable size/height placement. Opaque backgrounds are preserved; background removal, physical garment draping and body-measurement simulation are not implemented. Placement settings are saved with each outfit.
- Storage: measurements and requests use localStorage; garment images and outfits use IndexedDB. Data is specific to this browser/site and does not synchronize between customers, devices or teammates. Use fictional data only. Clearing browser site data deletes everything. This is customer wardrobe inventory, not a business stock or production management system.
- Future work: live AI generation through a server-side service, photo consent and retention controls, authenticated customer accounts/database, additional services, staff intake for phone/email/in-person requests, real booking and pricing, optional measurement-based mannequins. Never put AI service credentials in browser code.

## Service Quote Calculator (Priority 3)

Open **Service quotes** for staff pricing examples. Select a suggested alteration/repair or enter a custom service. All initial figures are hypothetical. Materials, labor hours/rate, overhead, additional fitting minutes, and target profit margin update estimates immediately. Fitting minutes use the labor rate and are additional to labor hours.

Total cost = materials + overhead + (labor hours + fitting minutes / 60) × hourly rate. Suggested customer price = cost / (1 − target margin), rounded up to cents. Profit = price − cost; margin = profit / price. A zero price has no defined margin. This uses margin on revenue, not markup on cost. Tax and expenses not entered are excluded.

The separate **Fixed quoted price** stays unchanged as costs change. Compare profit before/after additional fitting and its dollar reduction. **Use suggested price as fixed quote** explicitly copies the current suggestion. For example, $5 materials + 1 hour at $25 + $10 overhead costs $40. A 30% target margin suggests $57.15. At a fixed $60 quote, adding 30 fitting minutes costs $12.50 and reduces profit from $20 to $7.50; 60 minutes creates a $5 loss.

Save drafts, reopen/edit them, or delete them. Quote records use the separate `cnd-service-quotes` localStorage key and do not change customer, request or wardrobe records. Confirmation requires the reviewing tailor's name and approval checkbox. Editing quote inputs or reopening a record requires fresh approval. Saving an edited record as a draft replaces its previous confirmation. This is a local classroom approval record, not authenticated authorization or an immutable audit trail; no customer message, payment or booking is created. Browser data does not sync and is lost when site storage is cleared.

## Validation

```sh
npm run build
npm test
```

Browser tests use Playwright with `/usr/bin/chromium` in this cloud environment. Set `CHROMIUM_PATH` to a compatible local Chromium executable elsewhere. Tests cover preview choices, sample profile/request persistence, photo upload, wardrobe filters and editing, saved outfits and removal, phone layout, real Chromium touch input, cancellation, dressed preview selection, and saved placement controls. Quote tests additionally cover multiple pricing examples, fitting-time losses, zero costs/prices, invalid inputs, local draft persistence, approval requirements/reset, and navigation at phone, tablet and desktop widths.

## Team integration

No customer, appointment, economics or service-catalog module was present when this section was created. Before joining sections, agree on the service list, customer identifiers, measurement units/source/date and recheck process, fitting-request handoff, pricing ownership, and who owns shared navigation/storage. Keep payment and confirmed orders separate from consultation requests. All current prices/dates are intentionally unconfirmed.

Prototype imagery, including the four transparent sample garment product photos, was generated with OpenAI image generation. The lighter interface uses white cards, charcoal text, and muted teal accents. Existing built-in sample items receive the new imagery without changing their names, tags, or saved outfit references; uploaded clothing and deleted samples are preserved.

Mouse/pen/touch dragging uses Pointer Events and pointer capture rather than native HTML drag-and-drop. A floating mannequin drop target appears for touch layouts or when the board is off-screen. Release outside the target or press Escape to cancel. Button controls remain available for keyboard access.
