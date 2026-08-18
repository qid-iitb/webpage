/*
 * Content is read from published Google Sheet tabs.
 * See CONTENT_WORKFLOW.md for the expected columns.
 */

const SHEET_ID = "16pFkeFT9tocUKJKI_FNg8JPKKE7uD-yyqHNZv26aik4";
const CURRENT_YEAR = new Date().getFullYear();

const csvUrl = (tab) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;

const icon = {
  email: "✉",
  scholar: "◎",
  orcid: "iD",
  home: "↗",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[character];
  });
}

function initials(name) {
  return (name || "?")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isYes(value) {
  return (value || "").toLowerCase() === "yes";
}

function driveImageUrl(url) {
  const source = url || "";
  const fileId =
    source.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([-\w]+)/)?.[1] ||
    source.match(/[?&]id=([-\w]+)/)?.[1];

  return fileId
    ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`
    : source;
}

function formatDate(value) {
  if (!value) return "";

  const isoDate = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = isoDate
    ? new Date(Date.UTC(isoDate[1], Number(isoDate[2]) - 1, isoDate[3]))
    : new Date(value);

  return Number.isNaN(date.valueOf())
    ? String(value)
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
}

function yearFromDate(value) {
  const match = String(value || "").match(/^(\d{4})/);
  if (match) return match[1];

  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Other" : String(date.getUTCFullYear());
}

function sortByOrder(rows) {
  return [...rows].sort((left, right) => {
    return (Number(left.Order) || 999) - (Number(right.Order) || 999);
  });
}

function sortByNewestDate(rows) {
  return [...rows].sort((left, right) => {
    const dateDifference = new Date(right.Date) - new Date(left.Date);
    return dateDifference || (Number(left.Order) || 999) - (Number(right.Order) || 999);
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(cell);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

async function readSheet(tab, requiredHeader = "") {
  const response = await fetch(csvUrl(tab));
  if (!response.ok) throw new Error(`Could not load ${tab}`);

  const rows = parseCsv(await response.text());
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => cell.trim().endsWith("Display")),
  );

  if (headerRowIndex < 0) throw new Error(`Could not find headers for ${tab}`);

  const headers = rows[headerRowIndex].map((cell, index) => {
    return index === 0 ? "Display" : cell.trim();
  });

  if (requiredHeader && !headers.includes(requiredHeader)) {
    /*
     * Google Sheets returns the first tab when a requested tab does not yet
     * exist. A schema check prevents that tab being displayed in the wrong page.
     */
    throw new Error(`${tab} does not have the expected columns`);
  }

  return rows.slice(headerRowIndex + 1).map((row) => {
    return Object.fromEntries(
      headers.map((header, index) => [header, (row[index] || "").trim()]),
    );
  });
}

function externalLink(url, label, className = "") {
  if (!url) return "";
  const classes = className ? ` class="${className}"` : "";
  return `<a${classes} href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)} ↗</a>`;
}

function simpleLink(url, label) {
  if (!url) return "";
  const external = /^https?:/i.test(url) ? ' target="_blank" rel="noopener"' : "";
  return `<a href="${escapeHtml(url)}"${external}>${escapeHtml(label)} →</a>`;
}

/* -------------------------------------------------------------------------- */
/* People                                                                     */
/* -------------------------------------------------------------------------- */

function memberCard(person, isPastMember = false) {
  const photo = driveImageUrl(person["Image URL"]);
  const links = [
    ["Email", "email", person.Email ? `mailto:${person.Email}` : ""],
    ["Google Scholar", "scholar", person["Google Scholar"]],
    ["ORCID", "orcid", person.ORCID],
    ["Personal Homepage", "home", person["Personal Homepage"]],
  ]
    .filter(([, , url]) => url)
    .map(([label, type, url]) => {
      const newTab = type === "email" ? "" : ' target="_blank" rel="noopener"';
      return `<a class="person-icon" href="${escapeHtml(url)}"${newTab} aria-label="${label}" title="${label}">${icon[type]}</a>`;
    })
    .join("");

  const currentAppointment = person["Current Designation"]
    ? `${escapeHtml(person["Current Designation"])}${
        person["Current Affiliation"]
          ? `, ${escapeHtml(person["Current Affiliation"])}`
          : ""
      }`
    : "";

  const pastDetails = [
    person["Graduation Year"] && `Graduated ${escapeHtml(person["Graduation Year"])}`,
    person["Project Title"] && escapeHtml(person["Project Title"]),
    currentAppointment,
  ]
    .filter(Boolean)
    .join(" · ");

  return `
    <article class="person">
      <div class="avatar">
        ${
          photo
            ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(person.Name)}" onerror="this.parentElement.textContent='${initials(person.Name)}'">`
            : initials(person.Name)
        }
      </div>
      <h3>${escapeHtml(person.Name)}</h3>
      <div class="role">${escapeHtml(person.Role || person["Member Type"])}</div>
      ${person["Research interests"] ? `<p class="interests">${escapeHtml(person["Research interests"])}</p>` : ""}
      ${isPastMember && pastDetails ? `<p class="member-history">${pastDetails}</p>` : ""}
      ${
        person.Bio
          ? `<details class="person-bio"><summary>About</summary><p>${escapeHtml(person.Bio)}</p></details>`
          : ""
      }
      ${links ? `<div class="person-links">${links}</div>` : ""}
    </article>
  `;
}

async function renderPeople() {
  const currentTarget = document.querySelector("#current-members");
  const pastTarget = document.querySelector("#past-members");
  if (!currentTarget) return;

  let currentMembers = [];
  try {
    currentMembers = await readSheet("Current Members", "Name");
  } catch {
    try {
      currentMembers = await readSheet("People", "Name");
    } catch {
      currentMembers = [];
    }
  }

  const visibleCurrentMembers = sortByOrder(
    currentMembers.filter(
      (person) =>
        isYes(person.Display) && !["alumni", "past"].includes((person.Status || "").toLowerCase()),
    ),
  );

  currentTarget.innerHTML = visibleCurrentMembers.length
    ? visibleCurrentMembers.map((person) => memberCard(person)).join("")
    : '<p class="muted">Current members will be listed here.</p>';

  if (!pastTarget) return;

  try {
    const pastMembers = (await readSheet("Past Members", "Member Type")).filter((person) =>
      isYes(person.Display),
    );
    const memberTypes = [
      "Postdoctoral researchers",
      "PhD students",
      "Project students",
      "Other members",
    ];

    pastTarget.innerHTML = memberTypes
      .map((memberType) => {
        const people = sortByOrder(
          pastMembers.filter((person) => (person["Member Type"] || "Other members") === memberType),
        );

        return people.length
          ? `
              <details class="member-group">
                <summary>${memberType}<span>${people.length}</span></summary>
                <div class="people-grid past-grid">${people.map((person) => memberCard(person, true)).join("")}</div>
              </details>
            `
          : "";
      })
      .join("") || '<p class="muted">Past members will be listed here.</p>';
  } catch {
    pastTarget.innerHTML = '<p class="muted">Past members will be listed here.</p>';
  }
}

/* -------------------------------------------------------------------------- */
/* Research                                                                   */
/* -------------------------------------------------------------------------- */

const RESEARCH_FALLBACK = [
  {
    Display: "Yes",
    Title: "Hybrid quantum systems",
    Description:
      "We study cavity-coupled atomic and spin ensembles as platforms for transferring and storing quantum information, including the effects of inhomogeneity and decoherence.",
    "Image Alt": "Illustration of a cavity-coupled atomic or spin ensemble for quantum information storage",
    "Related Works":
      "Protecting information | https://arxiv.org/abs/2207.14354; Quantum memory | https://arxiv.org/abs/2506.06651",
    Order: 1,
  },
  {
    Display: "Yes",
    Title: "Entanglement in many-body systems",
    Description:
      "We investigate how interactions and collective dynamics shape multipartite entanglement in extended quantum systems, from spin models to mesoscopic magnetic modes.",
    "Image Alt": "Illustration of entanglement and collective dynamics in a many-body quantum system",
    "Related Works":
      "Localized domain walls | https://arxiv.org/abs/2508.03450; Long-range interactions | https://arxiv.org/abs/1809.02335",
    Order: 2,
  },
  {
    Display: "Yes",
    Title: "Resource theory of coherence",
    Description:
      "We develop operational ways to quantify quantum coherence and examine its connection to entanglement, mixedness, and noise.",
    "Image Alt": "Illustration of quantum coherence and its relation to entanglement",
    "Related Works":
      "Coherence and entanglement | https://arxiv.org/abs/1502.05876; Coherent mixed states | https://arxiv.org/abs/1503.06303",
    Order: 3,
  },
  {
    Display: "Yes",
    Title: "Condensation of light",
    Description:
      "We study photon condensates in microcavities, with emphasis on temporal coherence, mode correlations, and phase and vortex phenomena.",
    "Image Alt": "Microcavity photon condensate with coherence and vortex features",
    "Related Works":
      "Photon correlations | https://arxiv.org/abs/2310.16604; Temporal coherence | https://arxiv.org/abs/2310.16598",
    Order: 4,
  },
  {
    Display: "Yes",
    Title: "CV quantum information",
    Description:
      "We investigate information-processing protocols based on optical quadratures, including sequential protocols, resource reuse, and entanglement detection.",
    "Image Alt": "Optical continuous-variable quantum-information protocol",
    "Related Works":
      "Sequential protocols | https://arxiv.org/abs/2410.15032; CV teleportation | https://arxiv.org/abs/1312.6226",
    Order: 5,
  },
  {
    Display: "Yes",
    Title: "Optomechanics",
    Description:
      "We explore cavity-mediated interactions between light and collective motional degrees of freedom, including platforms for storing and manipulating photon angular momentum.",
    "Image Alt": "Cavity-optomechanical system coupling light and collective motion",
    "Related Works": "Optomechanical quantum memory | https://arxiv.org/abs/2506.06651",
    Order: 6,
  },
  {
    Display: "Yes",
    Title: "Cavity QED",
    Description:
      "We study strongly coupled light–matter systems, including cavity-coupled spin ensembles and atomic-frequency-comb dynamics for photon storage and revival.",
    "Image Alt": "Cavity-QED system with coupled light and matter states",
    "Related Works":
      "Cavity state revivals | https://arxiv.org/abs/2107.05919; Atomic frequency comb | https://arxiv.org/abs/2310.04200",
    Order: 7,
  },
  {
    Display: "Yes",
    Title: "Non-Gaussian CV-QI",
    Description:
      "We examine non-Gaussian optical resource states and their use in continuous-variable protocols, including improvements to telecloning.",
    "Image Alt": "Non-Gaussian optical states for continuous-variable quantum information",
    "Related Works":
      "Non-Gaussian telecloning | https://arxiv.org/abs/2312.13586; CV teleportation | https://arxiv.org/abs/1312.6226",
    Order: 8,
  },
  {
    Display: "Yes",
    Title: "Quantum error correction",
    Description:
      "We design error-correction and protection methods for spin ensembles that cannot be individually addressed, targeting dephasing, decay, and pumping errors.",
    "Image Alt": "Spin-ensemble quantum-error-correction protocol",
    "Related Works":
      "Quantum error correction | https://arxiv.org/abs/2408.11628; Hybrid-system protection | https://arxiv.org/abs/2207.14354",
    Order: 9,
  },
];

function relatedWorkLinks(value = "") {
  return value
    .split(/\n|;/)
    .map((item) => {
      const [label, url] = item.split("|").map((part) => part.trim());
      return url
        ? externalLink(url, label || "Related work")
        : label
          ? `<span>${escapeHtml(label)}</span>`
          : "";
    })
    .join("");
}

function researchCards(areas) {
  return areas
    .map((area) => {
      const image = driveImageUrl(area["Image URL"]);
      return `
        <article class="research-card">
          <div class="research-media">
            ${
              image
                ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(area["Image Alt"] || area.Title)}">`
                : "<span>Figure or illustration</span>"
            }
          </div>
          <div class="research-copy">
            <h2>${escapeHtml(area.Title)}</h2>
            <p>${escapeHtml(area.Description)}</p>
            <div class="work-links">${relatedWorkLinks(area["Related Works"])}</div>
          </div>
        </article>
      `;
    })
    .join("");
}

async function renderResearch() {
  const target = document.querySelector("#research-cards");
  if (!target) return;

  let areas = [];
  try {
    areas = sortByOrder(
      (await readSheet("Research Areas", "Description")).filter((area) => isYes(area.Display)),
    );
  } catch {
    areas = RESEARCH_FALLBACK;
  }

  target.innerHTML = researchCards(areas.length ? areas : RESEARCH_FALLBACK);
}

/* -------------------------------------------------------------------------- */
/* Activities                                                                 */
/* -------------------------------------------------------------------------- */

async function renderActivities() {
  const target = document.querySelector("#activity-gallery");
  if (!target) return;

  let activities = [];
  try {
    activities = await readSheet("Activity Images", "Image URL");
  } catch {
    try {
      activities = await readSheet("Activities", "Image URL");
    } catch {
      activities = [];
    }
  }

  const visibleActivities = sortByNewestDate(activities.filter((activity) => isYes(activity.Display)));
  if (!visibleActivities.length) return;

  target.innerHTML = visibleActivities
    .map((activity) => {
      const image = driveImageUrl(activity["Image URL"]);
      return `
        <article class="activity-card">
          ${
            image
              ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(activity["Image Alt"] || activity.Title)}">`
              : '<div class="activity-placeholder">Image to be added</div>'
          }
          <div>
            <time>${escapeHtml(formatDate(activity.Date))}</time>
            <h2>${escapeHtml(activity.Title)}</h2>
            ${activity.Summary ? `<p>${escapeHtml(activity.Summary)}</p>` : ""}
            ${externalLink(activity["Album URL"], "View album")}
          </div>
        </article>
      `;
    })
    .join("");
}

/* -------------------------------------------------------------------------- */
/* Conference visits                                                          */
/* -------------------------------------------------------------------------- */

const CONFERENCE_FALLBACK = [
  {
    Display: "Yes",
    Date: "2025-03-20",
    Conference: "APS Global Physics Summit 2025",
    Location: "Anaheim Convention Center, Anaheim, California, USA",
    Presenter: "Harsh Sharma",
    "Contribution Title": "Quantum error correction for unresolvable spin ensemble",
    "Contribution Type": "Oral presentation",
    "Abstract URL": "https://meetings-archive.aps.org/smt/2025/mar-t33/11/",
    "Video URL": "",
    Award: "",
    "Image URL": "",
    "Image Alt": "",
    Order: 1,
  },
  {
    Display: "Yes",
    Date: "2025-01-27",
    Conference: "Quantum Trajectories",
    Location: "Ramanujan Lecture Hall, ICTS Bengaluru, India",
    Presenter: "Himadri Shekhar Dhar",
    "Contribution Title": "Dynamics of information in collective states of a spin ensemble",
    "Contribution Type": "Oral presentation",
    "Abstract URL": "https://www.icts.res.in/program/qt/talks",
    "Video URL": "https://www.youtube.com/watch?v=qjf0gFZ2-xg",
    Award: "",
    "Image URL": "",
    "Image Alt": "",
    Order: 2,
  },
  {
    Display: "Yes",
    Date: "2025-01-23",
    Conference: "Quantum Trajectories",
    Location: "Ramanujan Lecture Hall, ICTS Bengaluru, India",
    Presenter: "Harsh Sharma",
    "Contribution Title": "Quantum error correction for unresolvable spin ensemble",
    "Contribution Type": "Oral presentation",
    "Abstract URL": "https://www.icts.res.in/program/qt/talks",
    "Video URL": "https://www.youtube.com/watch?v=PrN4ENJrXX4",
    Award: "",
    "Image URL": "",
    "Image Alt": "",
    Order: 3,
  },
  {
    Display: "Yes",
    Date: "2024-11-25",
    Conference: "Quantum Many-Body Physics in the Age of Quantum Information",
    Location: "Ramanujan Lecture Hall, ICTS Bengaluru, India",
    Presenter: "Himadri Shekhar Dhar",
    "Contribution Title": "Quantum error correction for unresolvable spin ensemble",
    "Contribution Type": "Oral presentation",
    "Abstract URL": "https://icts.res.in/discussion-meeting/qmbpqi2024/title-and-abstract",
    "Video URL": "https://www.youtube.com/watch?v=YZLYNXWB08Q",
    Award: "",
    "Image URL": "",
    "Image Alt": "",
    Order: 4,
  },
  {
    Display: "Yes",
    Date: "2024-05-27",
    Conference: "2024 CAP Congress",
    Location: "Western University, Canada",
    Presenter: "Harsh Sharma",
    "Contribution Title": "Quantum error correction for unresolvable spin ensemble",
    "Contribution Type": "Oral presentation",
    "Abstract URL": "https://indico.global/event/440/contributions/10771/",
    "Video URL": "",
    Award: "",
    "Image URL": "",
    "Image Alt": "",
    Order: 5,
  },
];

function conferenceCard(visit) {
  const image = driveImageUrl(visit["Image URL"]);
  const links = [
    externalLink(visit["Abstract URL"], "Abstract"),
    externalLink(visit["Video URL"], "Presentation video"),
  ]
    .filter(Boolean)
    .join("");

  return `
    <article class="conference-card">
      ${
        image
          ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(visit["Image Alt"] || visit.Conference)}">`
          : `<div class="conference-placeholder"><span>${escapeHtml(visit["Contribution Type"] || "Conference visit")}</span></div>`
      }
      <div class="conference-copy">
        <div class="conference-topline">
          <time>${escapeHtml(formatDate(visit.Date))}</time>
          ${visit["Contribution Type"] ? `<span>${escapeHtml(visit["Contribution Type"])}</span>` : ""}
        </div>
        <h2>${escapeHtml(visit["Contribution Title"] || visit.Conference)}</h2>
        <p class="conference-event">${escapeHtml(visit.Conference)}${visit.Presenter ? ` · ${escapeHtml(visit.Presenter)}` : ""}</p>
        ${visit.Location ? `<p class="conference-location">${escapeHtml(visit.Location)}</p>` : ""}
        ${visit.Award ? `<p class="conference-award">Award: ${escapeHtml(visit.Award)}</p>` : ""}
        ${links ? `<div class="conference-links">${links}</div>` : ""}
      </div>
    </article>
  `;
}

function groupByYear(visits) {
  const groups = new Map();
  sortByNewestDate(visits).forEach((visit) => {
    const year = yearFromDate(visit.Date);
    groups.set(year, [...(groups.get(year) || []), visit]);
  });
  return [...groups.entries()].sort(([left], [right]) => Number(right) - Number(left));
}

async function renderConferences() {
  const target = document.querySelector("#conference-list");
  if (!target) return;

  let visits = CONFERENCE_FALLBACK;
  try {
    visits = await readSheet("Conference Visits", "Conference");
  } catch {
    visits = CONFERENCE_FALLBACK;
  }

  const visibleVisits = visits.filter((visit) => isYes(visit.Display));
  if (!visibleVisits.length) {
    target.innerHTML = '<p class="muted">Conference visits will be listed here.</p>';
    return;
  }

  target.innerHTML = groupByYear(visibleVisits)
    .map(([year, yearVisits], index) => {
      const shouldOpen = Number(year) === CURRENT_YEAR || index === 0;
      return `
        <details class="conference-year"${shouldOpen ? " open" : ""}>
          <summary><span>${escapeHtml(year)}</span><span>${yearVisits.length}</span></summary>
          <div class="conference-year-grid">${yearVisits.map(conferenceCard).join("")}</div>
        </details>
      `;
    })
    .join("");
}

/* -------------------------------------------------------------------------- */
/* Announcements and publications                                             */
/* -------------------------------------------------------------------------- */

async function renderAnnouncements() {
  const target = document.querySelector("#announcements");
  if (!target) return;

  try {
    const announcements = sortByNewestDate(
      (await readSheet("Announcements", "Link URL")).filter(
        (announcement) => isYes(announcement.Display) && announcement.Title,
      ),
    ).slice(0, 3);

    if (!announcements.length) return;

    target.innerHTML = announcements
      .map(
        (announcement) => `
          <article>
            <time>${escapeHtml(formatDate(announcement.Date))}</time>
            <h3>${escapeHtml(announcement.Title)}</h3>
            ${announcement.Summary ? `<p>${escapeHtml(announcement.Summary)}</p>` : ""}
            ${simpleLink(announcement["Link URL"], announcement["Link label"] || "Learn more")}
          </article>
        `,
      )
      .join("");
  } catch {
    // The static fallback in index.html remains visible.
  }
}

function publicationMarkup(publication) {
  const date = [publication.Month, publication.Year].filter(Boolean).join(" ");
  const venue = publication.Venue || publication["arXiv ID"] || "arXiv";
  const link = publication["Link URL"]
    ? ` · <a href="${escapeHtml(publication["Link URL"])}" target="_blank" rel="noopener">${escapeHtml(publication["Link label"] || "arXiv")}</a>`
    : "";

  return `
    <article class="publication">
      <time>${escapeHtml(date)}</time>
      <div>
        <h3>${escapeHtml(publication.Title)}</h3>
        <p>${escapeHtml(publication.Authors)} · <em>${escapeHtml(venue)}</em>${link}</p>
      </div>
    </article>
  `;
}

function highlightedPublicationMarkup(publication) {
  return `
    <article>
      <span>Selected paper</span>
      <h3>${escapeHtml(publication.Title)}</h3>
      <p>${escapeHtml(publication.Venue || publication["arXiv ID"] || "")}</p>
      ${externalLink(publication["Link URL"], "Read paper")}
    </article>
  `;
}

async function renderPublications() {
  const listTarget = document.querySelector("#publication-list");
  const highlightsTarget = document.querySelector("#highlighted-papers");
  const updatedTarget = document.querySelector("#publication-updated");
  if (!listTarget) return;

  let allPublications = [];
  try {
    allPublications = await readSheet("Publications", "Title");
  } catch {
    listTarget.innerHTML = '<p class="muted">Group publications will be listed here.</p>';
    highlightsTarget?.remove();
    return;
  }

  const groupFieldExists = allPublications.some((publication) => "Group Paper" in publication);
  const publications = allPublications
    .filter(
      (publication) =>
        isYes(publication.Display) && publication.Title && groupFieldExists && isYes(publication["Group Paper"]),
    )
    .sort((left, right) => {
      return Number(right.Year) - Number(left.Year) || (Number(left.Order) || 999) - (Number(right.Order) || 999);
    });

  if (!publications.length) {
    listTarget.innerHTML = '<p class="muted">Group publications will be listed here.</p>';
    highlightsTarget?.remove();
    return;
  }

  listTarget.innerHTML = publications.map(publicationMarkup).join("");

  const highlights = publications.filter((publication) => isYes(publication.Highlight)).slice(0, 3);
  if (highlightsTarget && highlights.length) {
    highlightsTarget.innerHTML = highlights.map(highlightedPublicationMarkup).join("");
  } else {
    highlightsTarget?.remove();
  }

  const lastUpdated = publications.find((publication) => publication["Last Updated"])?.["Last Updated"];
  if (updatedTarget && lastUpdated) updatedTarget.textContent = `Last updated ${lastUpdated}`;
}

/* -------------------------------------------------------------------------- */
/* Navigation and page initialisation                                         */
/* -------------------------------------------------------------------------- */

function addNavigationLink(nav, href, label) {
  if ([...nav.querySelectorAll("a")].some((link) => link.getAttribute("href") === href)) return;

  const link = document.createElement("a");
  link.href = href;
  link.textContent = label;
  const before = [...nav.children].find((item) => item.getAttribute?.("href") === "openings.html");
  nav.insertBefore(link, before || null);
}

function initialiseNavigation() {
  document.querySelectorAll("nav").forEach((nav) => {
    addNavigationLink(nav, "activities.html", "Activities");
    addNavigationLink(nav, "conferences.html", "Conference visits");
  });

  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector("nav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.textContent = isOpen ? "Close" : "Menu";
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

async function initialiseSite() {
  initialiseNavigation();
  await Promise.allSettled([
    renderPeople(),
    renderResearch(),
    renderActivities(),
    renderConferences(),
    renderAnnouncements(),
    renderPublications(),
  ]);
}

initialiseSite();
