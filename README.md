# Quantum Information Dynamics Group website

This is a static website for the Quantum Information Dynamics Group in the Department of
Physics at the Indian Institute of Technology Bombay. It can be hosted directly with GitHub
Pages.

## Website files

- `index.html` — Home page and announcements
- `people.html` — Current and past members
- `research.html` — Research areas and related work
- `publications.html` — Group publications
- `activities.html` — Group activities and photographs
- `conferences.html` — Conference visits, talks, posters, recordings, and awards
- `openings.html` — Current and future opportunities
- `contact.html` — Contact information and map
- `styles.css` — Shared visual design
- `script.js` — Google Sheets data loading and page rendering
- `outputs/CONTENT_WORKFLOW.md` — Sheet columns and content-maintenance guidance

## Editing website content

Most content comes from published tabs in the connected Google Sheet. Set `Display` to `Yes`
for any row that should be visible on the website.

The conference page automatically groups records by the year in `Date`. The current calendar
year opens first; when there are no records for that year, the most recent year opens instead.

## Publishing with GitHub Pages

1. Upload the website files in this folder to the root of the GitHub repository.
2. In the repository, open **Settings → Pages**.
3. Choose **Deploy from a branch**, select the `main` branch and the `/ (root)` folder, then
   save.
4. GitHub will provide the public website address after deployment.

The `outputs/` folder contains editable templates and deployment helpers; it does not need to
be uploaded for the website itself to run.
