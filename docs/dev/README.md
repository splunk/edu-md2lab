# Docs for devs

## 🚫 Sidebars and "chapter" headers

There are some limits to what we can do with the PDF output. Chrome's PDF renderer (used by Puppeteer) is a black box. There are two fundamental blockers:

1. **No named destinations.** Chrome does not embed a `/Names`→`/Dests` table in its PDF output, so `id` attributes on HTML elements produce no anchors in the PDF. Any outline entry pointing to a named destination (e.g. `#my-heading`) silently fails.

2. **No way to measure print pagination from JavaScript.** Chrome's internal print paginator decides where page breaks fall based on CSS rules, orphan/widow handling, and other internals that are not exposed to JavaScript. `getBoundingClientRect()` returns positions in the continuous scroll layout, not the paginated print layout. No formula converting CSS pixel offsets to PDF page numbers is reliable: the two layouts diverge, and the error compounds across pages.

The only technically correct solution would be to post-process the generated PDF with a text-extraction library (e.g. `pdfjs-dist`) to find where headings actually landed, then build the outline from those real positions. That's a significant dependency and complexity cost for a navigation sidebar. Probably not worth it given that PDF viewers already provide thumbnail navigation!
