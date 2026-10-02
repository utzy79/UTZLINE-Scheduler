// UTZLINE Scheduler offline service worker.
//
// This is a NEW, SEPARATE, standalone app in the UTZLINE family --
// requested directly by Andrew (2026-09-23): "now create a schedular app
// (seperate) that runs off all this info... Do not change any other apps.
// they are all working, just build the standalone scheduler." It sits
// alongside UTZLINE Site Measure (the editor), UTZLINE Viewer (the
// read-only browser), UTZLINE Install ITP, UTZLINE Manufacture ITP, and
// UTZLINE Projects (the master app) -- its own manifest, own icon (blue,
// the one accent hue not already used by a sibling: Site Measure/Viewer
// are orange-red, Install ITP is green, Manufacture ITP is purple,
// Projects is crimson), own taskbar/Start-menu entry, own cache namespace
// ("utzline-scheduler-cache-*"). It is NOT built from source.html -- like
// Install ITP/Manufacture ITP/Projects, it's its own small, purpose-built
// codebase, since it needs a different kind of screen (sortable schedule
// tables + a lightweight read-only plan viewer), not a drawing canvas.
//
// It reads the SAME Projects-root folder every other app in the family
// uses (project -> joinery-items.json / joinery-status.json / Project
// Saves/Floor Plans/<Level>.json), strictly READ-ONLY against every one of
// those existing files -- per Andrew's explicit instruction, this app
// never writes into any file another app owns. The only thing it ever
// writes is its own new file, "joinery-schedule.json", one per project,
// holding this app's own schedule records (required delivery date,
// manufacture lead time in business days, and the computed manufacture
// start date) keyed by level/room/joineryId -- the same identity triple
// joinery-status.json already uses, so it never introduces a new item-
// matching scheme.
//
// Same cache-first app shell strategy as every other app in the family: a
// small, fixed set of local files, no CDN calls once installed (no pdf.js
// import either -- this app never imports floor plans itself, only reads
// the ones Site Measure/Projects already saved. v16 briefly added a local
// pdf.js to render a job-note thumbnail on the "Open job note" button --
// Andrew's own verdict afterward was "thumbnails were a fail, revert back
// to the button" -- so v17 removes it again; this app is back to carrying
// no pdf.js dependency at all). Bump CACHE_NAME whenever index.html or any
// vendored asset changes, so installed copies pick up the update instead
// of serving stale files forever.
//
// (v1, 2026-09-23: first release. Projects-root folder picker/reconnect
// (same convention as Projects/Viewer), a cross-project sortable Overall
// Schedule table and a per-project Schedule table -- both listing every
// joinery item from joinery-items.json, enriched with its current status
// (joinery-status.json, read-only) and its schedule (this app's own new
// joinery-schedule.json) -- a read-only pan/zoom plan viewer reusing the
// family's own SVG marker-rendering code, right-click (or long-press, on
// touch) a marker to set/edit its Required Delivery Date and Manufacture
// Lead Time (business days, default 30), which computes and saves the
// Manufacture Start Date (delivery date minus lead time, skipping
// Saturdays/Sundays -- no public-holiday calendar exists anywhere in this
// ecosystem yet, so this is a disclosed, known limitation, consistent with
// how every other date-adjacent feature here has handled the same gap),
// and delay flags (Delivery overdue / Manufacture start overdue / On
// track / No schedule set) computed against today's date and the item's
// real status rank. Also added, as a disclosed convenience beyond
// Andrew's literal spec: an "Edit schedule" button directly on each table
// row (so a schedule can be set without needing to first find and
// right-click the marker on the plan), and a "Clear schedule" option in
// the same dialog. Does NOT touch source.html, Install ITP, Manufacture
// ITP, or Projects in any way.)
//
// (v3, 2026-09-23: Andrew, verbatim: "scheduler floor plan needs the zoom
// function, reset to centre, zoom on scroll functionality, mouse click on
// plan to change the dates. currenty only has pan." Added a zoom control
// group (zoom in / zoom out / Reset view) to the Level Plan topbar --
// scroll-wheel zoom and pinch-zoom were already wired up (copied from
// UTZLINE Projects' own plan canvas along with everything else there) but
// had no visible affordance and no way to reset drift back to a known-good
// view; "Reset view" re-runs the same fit-to-screen-centred transform the
// plan already opens with. Also: a plain tap/click on a marker now opens
// the real Set Schedule dialog directly (previously it only showed a
// read-only summary toast, a disclosed "accidental-tap safety" design
// choice Andrew's request above explicitly overrides) -- right-click and
// long-press are unchanged, now just a redundant second path to the same
// dialog. Does NOT touch source.html, Install ITP, Manufacture ITP, or
// Projects in any way.)
//
// (v5, 2026-09-23: Andrew, verbatim: "implement the username as per the
// delivery itp throughout the entire system, but instead of it opening a
// popup, the button is the selector, when you pick a name it opens a
// numberpad to input the pin (4 digit pin)." This app had no identity
// feature of its own before this -- added from scratch, copied verbatim
// from UTZLINE Delivery ITP's own reference implementation of this exact
// pattern. A new <select id="identitySelector"> on the Home screen IS the
// button: its dropdown lists every known name plus "+ Add a new name...",
// and choosing one opens a real on-screen numberpad (not a popup) to
// verify its 4-digit PIN; adding a brand-new name still types the name as
// text first. Reads/writes the same "utzline-identity" IndexedDB and the
// same <ProjectsRoot>/utzline-users.csv registry every sibling UTZLINE app
// now shares. Also, as a small disclosed enhancement, each
// joinery-schedule.json record now stamps a read-only `setBy` field with
// whoever was signed in when Save was pressed. Does NOT touch source.html,
// Install ITP, Manufacture ITP, Delivery ITP, or Projects in any way.)
//
// (v7, 2026-09-23: Andrew, verbatim: "scheduler status should have the
// same tracking on hover like the attached photo from the projects app.
// and delivery column should have scheduled delivery and actual delivery
// dates." The Status column, in both the Overall and Project Schedule
// tables, now hovers/taps open the exact same status-history popup as
// UTZLINE Projects' own Joinery Register -- ported verbatim from that
// app's own showStatusHistoryPop/joineryStatusHistoryFor. The former
// "Required delivery" column is relabelled "Scheduled delivery" (same
// field, unchanged), and a new "Actual delivery" column beside it shows
// the item's own "delivered"-stage joinery-status.json history timestamp
// once it's reached that stage. See index.html's own top-of-file comment
// for the full design note.)
//
// (v8, 2026-09-23: Andrew, verbatim: "once an item is dispatched, the
// delay column changes in the scheduler, (this could read Delivered
// early / Delivered late / Delivered on time (on time would be 2 days
// either side)." computeDelayInfo now takes the item's own actual
// "delivered"-stage timestamp (added in v7's Actual delivery column) as a
// 4th argument: once an item has genuinely reached "delivered" or later
// AND has that real timestamp, the Delay column stops showing the
// before-the-fact "Delivery overdue"/"On track" framing and instead
// compares the real delivered date against the required delivery date --
// "Delivered late" (more than 2 days after), "Delivered early" (more than
// 2 days before), or "Delivered on time" (within that window, inclusive).
// An item that reached "installed" without ever having a "delivered"
// history entry (a real, if less common, path -- Delivery ITP's own
// checklist is optional, not mandatory) still falls through to the
// unchanged pre-existing rules. See index.html's own top-of-file comment
// for the full design note.)
//
// (v9, 2026-09-23: Andrew, on the same status-history popup: "these status
// windows to show days between each process." A gap marker now sits
// between each pair of consecutive rows showing the elapsed time between
// them -- "Same day" for anything under 1 day, "1 day" (singular) for
// exactly one, otherwise "N days" -- ported verbatim from the identical
// change made to UTZLINE Projects' own copy of this popup the same day. No
// gap after the oldest (last) row, and none at all for an item with only
// one history entry.)
//
// (v10, 2026-09-23: Andrew, verbatim: "Where there is a table it needs to
// open the full width of the screen. To minimise scrolling." The Overall
// Schedule and per-project Schedule screens now stretch to the full
// viewport width instead of being capped to this app's usual 980px
// centered content column -- a new .wide-table CSS class (max-width:none)
// on just those two screens. Both tables already force a 900px min-width
// (.sched-table) that the old 980px cap left little room for once main's
// own side padding and the card's own padding were subtracted, so this
// removes most of the forced horizontal scroll on ordinary desktop/tablet
// viewports. The identical fix shipped to UTZLINE Projects' own Register/
// Rework Register screens the same day.)
//
// (v11, 2026-09-23: Andrew, verbatim: "Manufacture status needs to be
// split up into 2 parts. We need a machined and a manufactured tab. All
// traceable by user name. Machined to have its own app. Called machine
// schedule. This is where the machinist can mark off a joinery item as
// complete. It will add their name and date time to the system." A new
// "machined" stage is inserted into the shared joinery-status pipeline,
// between "in_manufacture" and "manufactured" -- written exclusively by a
// brand-new sibling app, "UTZLINE Machine Schedule" (built in parallel with
// this round, a separate codebase, not touched from here). Scheduler
// remains strictly read-only against joinery-status.json: it never sets
// "machined" itself, it only displays it -- joineryStatusRank/Label/Icon
// gained a "machined" case (⚙️ / "Machined"), both the Overall and
// per-project Schedule screens' status filter dropdowns gained a matching
// "Machined" option, and the status-history hover/tap popup needed no
// change at all since it already renders any history entry generically
// through those same label/icon functions.
//
// Inserting a stage in the MIDDLE of the pipeline (rather than appending
// one at the end, like every earlier stage addition in this family) shifts
// every rank number from "manufactured" onward up by one: manufactured
// 3->4, delivered 4->5, installed 5->6 ("in_manufacture" itself, and
// everything before it, is unaffected -- the new stage sits after it).
// computeDelayInfo() has three hard-coded rank-threshold comparisons, and
// this is exactly the kind of subtle bug this comment history has flagged
// before elsewhere in this family when a shared enum shifted under code
// that compared its numbers by value instead of by name: each threshold
// was re-derived against what it actually MEANS, not blindly bumped --
// - "has this item reached delivered-or-later" (switches into the v8
//   post-delivery early/late/on-time comparison): rank >= 4 -> rank >= 5
//   (delivered's new rank).
// - "is this item not yet installed" (the delivery-overdue exemption --
//   installed is the real completion marker, "delivered" being a
//   reserved-but-currently-unreachable-as-a-dead-end stage in this
//   pipeline): rank < 5 -> rank < 6 (installed's new rank).
// - "is this item not yet in_manufacture" (the manufacture-start-overdue
//   trigger): rank < 2 -- left UNCHANGED, since in_manufacture's own rank
//   is still 2. Bumping this one too would have been the actual bug: an
//   item newly sitting at "machined" (rank 3) would then have wrongly
//   tripped "Manufacture start overdue" (a stage it's already well past)
//   instead of correctly falling through to "On track"/"Delivery overdue",
//   the same treatment "manufactured" itself already got before this round.
//
// Verified with a throwaway Node harness running computeDelayInfo() (old
// ranks/thresholds vs. new) across measured/in_manufacture/manufactured/
// delivered/installed: identical outputs on both sides for every one of
// those pre-existing statuses, confirming the renumbering is a pure no-op
// for every status that didn't move. The new "machined" status (rank 3,
// which didn't exist under the old scheme) was checked on its own and
// correctly does NOT trip "Manufacture start overdue" and correctly DOES
// still trip "Delivery overdue" once past the required delivery date, same
// as "manufactured" already did. Full 9-file suite re-run clean afterward,
// zero regressions.)
//
// (v12, 2026-09-23: Andrew, verbatim: "floor plans viewer on both schedules
// do not work. rewrite them using the same format as the itp apps." Both
// entry points into this app's single shared plan-canvas screen -- the
// Overall Schedule table's "View on plan" button AND the per-project
// Schedule table's own "View on plan"/"Open plan" -- go through the same
// openPlanCanvasForLevel()/#planCanvasSvg, so "both schedules" were really
// one and the same bug.
//
// ROOT CAUSE: the plan `<svg id="planCanvasSvg">` in index.html carried
// viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" -- left over
// from an earlier draft of this screen and never actually matching this
// app's own pan/zoom math. Every ITP app's own working plan viewer (Install
// ITP / Manufacture ITP / Delivery ITP's #levelPlanSvg, all confirmed
// working per Andrew's own screenshot) has NO viewBox at all: with none,
// an inline SVG's user-coordinate space is simply 1 unit = 1 CSS pixel of
// its rendered box (this app's CSS already sets width:100%/height:100% on
// it), which is exactly what planFitToView/planClientToWorld/planZoomAt
// assume when they compute translate()/scale() straight from
// planCanvasStageWrap's clientWidth/clientHeight in CSS pixels. With
// viewBox="0 0 100 100" present instead, the browser first maps that
// 100x100 unit square onto the rendered box (letterboxed, per
// preserveAspectRatio), so 1 user unit became ~(renderedSize/100) pixels --
// a completely different scale to the one the JS math was computing in. A
// real plan image (e.g. 1200x900) positioned and fit via that pixel-based
// math ended up placed almost entirely outside the 0-100 unit square that
// was actually visible, so the stage rendered as a plain black rectangle --
// image, tiles and markers all present in the DOM (readLevelFile/
// planRenderTiles/planRenderMarkers were never the problem) but positioned
// far outside the tiny sliver of user-space the viewBox actually displays.
// This is also why the existing run_plan_zoom_and_reset.js regression test
// never caught it: that test only checks the JS-side pan/zoom/click math
// against itself (planView.tx/ty/scale round-tripping through
// planClientToWorld), which stayed internally consistent throughout --
// the bug was purely in how the browser's own SVG viewBox transform sits
// on top of that math, invisible to a check that never inspects actual
// rendered pixels. Confirmed with a real headless-Chromium screenshot
// before fixing: a seeded project with a real (non-1x1) floor plan image
// and a marker at a known position rendered as an entirely blank black
// screen, with zero console/page errors -- a silent rendering bug, not a
// load failure or exception.
//
// FIX: removed viewBox/preserveAspectRatio from #planCanvasSvg entirely,
// matching the ITP apps' own <svg id="levelPlanSvg"> byte-for-byte (no
// viewBox, width/height 100% via CSS only) -- the one change needed to put
// this app's already-correct image-loading (readLevelFile's flat-then-
// legacy dual-path reader, matching every ITP app's own loadLevelPlan) and
// already-correct marker rendering (planRenderMarkers, already ported from
// Install ITP's buildPlanMarkerEl per the v3 entry above) into a coordinate
// space its own pan/zoom math actually agrees with. Re-verified with the
// same seeded-project screenshot harness: the floor plan image now renders
// correctly, the marker sits exactly on its saved (x, y) position, pan/
// zoom/reset and marker-tap (opening the Set Schedule dialog) all still
// work, and the full existing 9-file regression suite (run_all.sh) passes
// unchanged.
//
// (v13, 2026-09-24: Andrew, verbatim: "on any scheduler, there needs to be
// a open job note button for each joinery item. between delay and view on
// plan." Ported UTZLINE Install ITP's own read-only "View job note"
// feature (2026-09-22) into both this app's schedule tables -- the Overall
// Schedule and the per-project Schedule -- since both already share the
// same scheduleRowCells()/wireRowActions() row-building code, so this
// needed no per-screen duplication. A job note is exclusively a PDF
// attachment (site instructions, a delivery docket, etc) -- there is no
// text body -- and this app only ever reads it; adding one only ever
// happens from Site Measure or the Viewer. Content lives in a per-item
// folder, <ProjectRoot>/Project Saves/Job Notes/<key>/ (key =
// joineryItemPageKey(level, room, joineryId), the same identity triple
// findJoineryStatus already uses), holding every PDF ever added, oldest
// never deleted; jobNoteSortKey (ported from UTZLINE Projects' own
// listJobNotesForItem) finds the "yyyy-mm-dd hh-mm-ss" stamp wherever it
// sits in the filename so both the old (prefix) and new (suffix) naming
// formats still sort newest-first.
//
// A new "Open job note" button leads the row-actions cell, right before
// "View on plan" (i.e. directly after the Delay column, per Andrew's
// "between delay and view on plan") -- but ONLY rendered for a row whose
// item actually has one, gated on the `jobNote` flag buildEnrichedRows()
// now also pulls off the very same joinery-status.json record
// findJoineryStatus() already fetches (no extra file read needed for the
// flag itself). This avoids a dead-end "no notes yet" dialog appearing on
// every single row, the same call already made in Install ITP/Projects.
// Clicking it opens a small dialog (reusing this app's existing
// .modal-backdrop/.modal), lists every PDF newest-first, and an "Open"
// button per row does getFile() -> an object URL -> window.open() in a new
// tab, revoking the URL after 60s.
//
// Verified with a seeded fake Projects-root folder (Playwright): a real
// PDF placed in an item's Job Notes folder plus jobNote:true in
// joinery-status.json shows the button on both the Overall Schedule and a
// per-project Schedule row for that item, opens the dialog, lists the PDF,
// and "Open" launches it in a new tab; a second item with no job note
// shows no button at all on either screen. Full existing 9-file regression
// suite (run_all.sh) re-run clean, zero regressions. Does NOT touch
// source.html, Install ITP, Manufacture ITP, or Projects in any way.)
// (v21, 2026-09-26, same day: Andrew, "now update the schedules," --
// "View on plan" now zooms/centers on the specific item's own marker
// (ported from UTZLINE Projects' openPlanCanvasForLevel(centerOnMarker))
// instead of just fitting the whole level; the existing v20 sticky-column
// treatment now has a real, working horizontal scrollbar (a
// .screen{min-width:0} fix -- the table was overflowing the whole page
// instead of its own .table-scroll wrapper) and is viewport-width-based,
// not OS/UA-based (sticky only at/above 900px; a plain, fully-scrollable
// table below it). No cache-strategy change; CACHE_NAME bumped. See the
// README's v21 entry.)
// (v22, 2026-09-26, same day: family-wide status icon revert -- in_manufacture
// back to 🏭, machined back to ⚙️ (NEXT_RUN_NOTES.md item 2). Shipped as its
// own version since v21 was already delivered before this fix landed. No
// cache-strategy change; CACHE_NAME bumped. See the README's v22 entry.)
// (v23, 2026-09-26, same day: NEXT_RUN_NOTES.md item 13 -- "unachievable
// manufacture start date" validation on the Set Schedule dialog. Red text
// on the computed-start preview while typing, plus a new blocking OK-only
// popup on Save when the computed start date is still in the past. No
// cache-strategy change; CACHE_NAME bumped. See the README's v23 entry.)
// (v24, 2026-09-27: sticky bottom horizontal scroll bar (general note, not
// scoped to one app) -- Andrew, verbatim: "can we make the horizontal
// scroll bars in the schedule always appear, we cant scroll all the way to
// the bottom of the page to find them." .table-scroll's own native
// horizontal scrollbar sat at the bottom of a potentially very tall table
// -- effectively the bottom of the whole page. A new #stickyHScrollBar,
// pinned to the bottom of the viewport (not the page), mirrors whichever
// .table-scroll is the active screen's own overflowing table, synced both
// ways (refreshStickyHScroll()). Identical fix also shipped to Machine
// Schedule and Solid Surface Schedule, each its own version bump. New
// run_sticky_hscroll_bar.js; full suite green (21/21).
var ICON_VERSION = "v1";
// (v25, 2026-09-27: company logo (general note, not scoped to one app) --
// Andrew, verbatim: "change company logo should only be visable in the
// projects app, in every other app it should load the one chosen in
// projects." This app never showed a company logo anywhere before now --
// a new read-only "Company logo" card on the Home screen, sourced from the
// shared "company-logo.png" file at the Projects root (projectsRootHandle),
// no upload/remove controls, no PDF-export wiring. New
// run_company_logo_readonly.js (pdftest-scheduler). Same fix already
// shipped family-wide to Install/Manufacture/Delivery ITP, Site Measure/
// Viewer, and Machine Schedule.)
// (v26, 2026-09-27, same day: new read-only "Ordered" column on both the
// Overall Schedule and per-project Schedule tables -- Andrew, verbatim:
// "add ordered (with a description) summary to the main schedule."
// Cross-references the sibling UTZLINE Sub Orders app's own per-item
// Orders file (readSubOrdersForItem), same read-only precedent as the
// Solid Surface Completed/Delivered columns. Summary text names the
// order type + supplier ("Steel — Acme Steel") or, for more than one
// order, a count plus the distinct types ("2 orders (Steel, Timber)");
// hovering/tapping a cell with at least one order opens a popup with the
// full per-order breakdown, same pattern as the Status column's own
// history popup. See index.html's own top-of-file "ORDERED COLUMN"
// comment for the full design note.)
// (v27, 2026-09-27, same day: "mark as received" -- Andrew, verbatim: "ok
// now we need all joinery summary pages to show the associated orders.
// with the option to mark them as recieved. the main schedule also needs
// a mark as received button for orders. on the schedule". The Ordered
// column's popup is now interactive (hover previews, click/tap pins; a
// short close delay lets the pointer reach it) with a per-order Received
// checkbox + date, and Scheduler's own Joinery Item page gets a grouped,
// openable "Sub orders" card with the same control. Both share one write,
// setSubOrderReceived: fresh read, shallow-copy the entry, whole-array
// write of Sub Orders' own Orders/*.json -- the one file of another app's
// this app now writes, and only received/receivedDate in it; never Inbox/
// or Files/. New run_mark_received.js (pdftest-scheduler). See
// index.html's own top-of-file "MARK AS RECEIVED" comment.)
// v28 (2026-09-27): daily Excel backup of the three schedules (first open of
// the day on a PC; "Back up now" on Home). exceljs.min.js precached.
// v29 (2026-09-27): whole-schedule backup into Schedule Backups in the main folder.
// v30 (2026-09-28): Rework register (shared rework module), per-rework PDFs; jspdf.umd.min.js precached.
// v31 (2026-09-28): rework module: Delivery ITP delivered events (pin, photo, retakes); PDF photos start on page 1.
// v31 (same build): drop shop drawings / job notes / orders onto the Joinery Item page cards.
// v32 (2026-09-28): "PC Date" beside a required delivery date; long press on a row opens its item page;
//   shop drawings Sent / Returned (a sent drop is always the next revision, REV A, B, C...).
// v33 (2026-09-28): Edit schedule starts 31 working days out; job notes stamped FOR CONSTRUCTION (pdf-lib.min.js precached).
// v34 (2026-09-29): RC 1.0 -- the version is shown as RC 1.0, with a small "RC 1.0" tag on the logo.
// v35 (2026-09-29): a job note always moves the status on; every save retried + checked; table titles pinned + zoom; plan markers 20% smaller.
// v36 (2026-09-29): RC 1.0 -- a click on a row opens its item page; Cutting file + Notes columns; reads retried twice; empty event files ignored; no "still syncing?" guesses.
// v37 (2026-09-29): RC 1.0 -- the ITP cards read each checklist with its change files.
// v38 (2026-09-30): RC 1.0 -- schedules load with about half the folder calls (Solid Surface Completion and Sub Orders listed once, not looked up per item).
// v39 (2026-09-30): RC 1.0 -- event layout v2: status / schedule / cut / completion / cutting file / note records are one folder per LEVEL (Project Saves/UTZLINE Events/<branch>/<Level>/); old per-item folders are still read.
// v40 (2026-09-30): RC 1.0 -- sign in on open (tablets / phones), change-folder button, load timer.
// v41 (2026-09-30): RC 1.0 -- day / night mode, status icons on the plan (blue, 25% smaller), tick-box status filters, hide / rearrange columns, one drawing for several items, the builder's logo.
// v42 (2026-10-01): RC 1.0 -- Windows' 260-character path limit: shorter record names in the event store (see README)
// v47 (2026-10-02): RC 1.0 -- builder logo far right of the top bar, logos folder, reversed Machined, dark-mode controls, drag and drop only.
var CACHE_NAME = "utzline-scheduler-cache-v48";

var PRECACHE_URLS = [
  "./exceljs.min.js", // v28: spreadsheet library for the daily Excel backup (only ever loaded on a PC)
  "./jspdf.umd.min.js", // v30: PDF library for rework Print/Share (only loaded when someone prints or shares)
  "./pdf-lib.min.js", // v33: stamps job notes FOR CONSTRUCTION (only loaded when a job note is added)
  "./",
  "./index.html",
  "./manifest.json?v=" + ICON_VERSION,
  "./icons/icon-192.png?v=" + ICON_VERSION,
  "./icons/icon-512.png?v=" + ICON_VERSION,
  "./icons/icon-192-maskable.png?v=" + ICON_VERSION,
  "./icons/icon-512-maskable.png?v=" + ICON_VERSION
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(PRECACHE_URLS);
    }).then(function(){
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(names){
      return Promise.all(
        names.filter(function(n){ return n !== CACHE_NAME; })
             .map(function(n){ return caches.delete(n); })
      );
    }).then(function(){
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function(event){
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(function(cached){
      var networkFetch = fetch(event.request).then(function(response){
        if (response && response.status === 200){
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
        }
        return response;
      }).catch(function(){
        return cached;
      });
      // Cache-first for instant offline loads; refresh the cache in the
      // background whenever the network is available.
      return cached || networkFetch;
    })
  );
});
