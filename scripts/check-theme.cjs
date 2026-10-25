// Run against a local geckodriver. Uses a temporary Firefox profile and no vault.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const webdriver = process.env.WEBDRIVER_URL || "http://127.0.0.1:4444";
const css = fs.readFileSync(process.argv[2] || path.join(__dirname, "../styles.css"), "utf8");
const legacy = `
  .calendar { background-color: #1e1e1e !important; padding: 10px !important; }
  .calendar tr, .calendar td, .calendar th { background: #222 !important; }
  .dot-container .dot { background-color: #5ead7e !important; }
`;
const states = ["", "today", "has-deadline", "has-deadline today",
  "has-deadline has-overdue-deadline", "has-deadline has-overdue-deadline today"];
const dots = '<div class="dot-container"><svg class="dot filled" viewBox="0 0 6 6"><circle cx="3" cy="3" r="2"/></svg><svg class="hollow" viewBox="0 0 6 6"><circle cx="3" cy="3" r="2"/></svg></div>';
const html = `<!doctype html><html><head><meta charset="utf-8">
  <style>${css}</style><style id="legacy">${legacy}</style>
  <style>/* Assert final colours independently of the 100ms animation. */
    .calendar-deadlines-root * { transition: none !important; }
  </style></head>
  <body class="theme-dark"><div class="calendar-deadlines-root" style="width:320px">
    <div id="calendar-container"><table class="calendar">
      <colgroup>${states.map(() => '<col class="weekend">').join("")}</colgroup>
      <thead><tr>${states.map(() => '<th>Sun</th>').join("")}</tr></thead>
      <tbody><tr>${states.map((state, i) => `<td><div class="day ${state}">${i + 1}${dots}</div></td>`).join("")}</tr></tbody>
    </table></div>
    <section class="calendar-deadlines"><div class="deadline-group"><ul><li class="overdue">
      <button class="deadline-marker">Open</button><button class="deadline-task">
      <span class="deadline-time">09:00</span><span class="deadline-title">Task</span></button>
    </li></ul></div></section>
  </div><table class="calendar" id="original"><tr><td>Original Calendar</td></tr></table>
  </body></html>`;

async function request(route, method = "GET", body) {
  const response = await fetch(`${webdriver}${route}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  const { value } = await response.json();
  if (!response.ok || value?.error) throw new Error(JSON.stringify(value));
  return value;
}

(async () => {
  let session;
  try {
    session = (await request("/session", "POST", { capabilities: { alwaysMatch: {
      browserName: "firefox", "moz:firefoxOptions": { args: ["-headless"] },
    } } })).sessionId;
    const run = (fn, args = []) => request(`/session/${session}/execute/sync`, "POST", {
      script: `return (${fn.toString()})(...arguments)`, args,
    });
    await request(`/session/${session}/url`, "POST", { url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}` });
    const results = await run(() => {
      const root = document.querySelector(".calendar-deadlines-root");
      const days = [...document.querySelectorAll(".day")];
      const failures = [];
      let checks = 0;
      const equal = (actual, expected, label) => {
        checks++;
        if (actual !== expected) failures.push(`${document.body.className}: ${label}: ${actual} != ${expected}`);
      };
      // A colour probe lets the browser resolve variables without duplicating the palette.
      const probe = document.createElement("span");
      root.append(probe);
      const color = name => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color; };
      for (const snippetFirst of [false, true]) {
        const legacyStyle = document.querySelector("#legacy");
        document.head[snippetFirst ? "prepend" : "append"](legacyStyle);
        for (const theme of ["theme-dark", "theme-light", "theme-dark", "theme-light"]) {
          document.body.className = theme;
          equal(getComputedStyle(root).backgroundColor,
            theme === "theme-light" ? "rgb(247, 250, 252)" : "rgb(25, 25, 25)", "root background");
          for (const el of root.querySelectorAll("table, colgroup, col, thead, tbody, tr, td, th")) {
            equal(getComputedStyle(el).backgroundColor, "rgba(0, 0, 0, 0)", `transparent ${el.tagName}`);
          }
          equal(getComputedStyle(root.querySelector(".calendar")).paddingTop, "0px", "legacy table padding");
          days.forEach((day, i) => {
            day.classList.remove("active");
            const style = getComputedStyle(day);
            const background = i >= 4 ? color("--cd-danger") : i >= 2 ? color("--cd-deadline") : i === 1 ? color("--cd-today") : "rgba(0, 0, 0, 0)";
            equal(style.backgroundColor, background, `day ${i} background`);
            equal(day.getBoundingClientRect().width, days[0].getBoundingClientRect().width, "equal day widths");
            const dot = day.querySelector(".dot");
            equal(getComputedStyle(dot).backgroundColor, "rgba(0, 0, 0, 0)", "no square dot background");
            if (i >= 2 && i < 4) equal(getComputedStyle(dot).fill, color("--cd-deadline-dot"), "dark dot on white day");
            day.classList.add("active");
            const selected = getComputedStyle(day);
            equal(selected.backgroundColor, color("--cd-selected"), `selected day ${i}`);
            equal(selected.borderTopStyle, "none", "selection border");
            equal(selected.boxShadow, "none", "selection inset border");
            equal(getComputedStyle(dot).fill, color("--cd-selected-text"), "selected dot contrast");
          });
          const marker = root.querySelector(".deadline-marker");
          equal(getComputedStyle(marker).backgroundColor, color("--cd-danger"), "overdue icon matches calendar");
          equal(getComputedStyle(root.querySelector(".deadline-title")).color, color("--cd-danger"), "overdue title");
          equal(getComputedStyle(root.querySelector(".deadline-time")).color, color("--cd-danger"), "overdue time");
          equal(getComputedStyle(document.querySelector("#original")).backgroundColor, "rgb(30, 30, 30)", "original Calendar untouched");
        }
      }
      return { checks, failures };
    });
    assert.deepStrictEqual(results.failures, []);
    const hovered = await request(`/session/${session}/element`, "POST", { using: "css selector", value: ".day" });
    await request(`/session/${session}/actions`, "POST", { actions: [{
      type: "pointer", id: "mouse", parameters: { pointerType: "mouse" },
      actions: [{ type: "pointerMove", duration: 0, origin: hovered, x: 0, y: 0 }],
    }] });
    const hoverFailures = await run(states => {
      const day = document.querySelector(".day");
      const root = document.querySelector(".calendar-deadlines-root");
      const probe = document.createElement("span");
      root.append(probe);
      const failures = [];
      for (const theme of ["theme-dark", "theme-light"]) {
        document.body.className = theme;
        for (const state of states) {
          day.className = `day ${state} active`;
          const style = getComputedStyle(day);
          probe.style.color = "var(--cd-selected)";
          if (!day.matches(":hover") || style.backgroundColor !== getComputedStyle(probe).color ||
              style.boxShadow !== "none" || style.borderTopStyle !== "none") {
            failures.push(`${theme}: selected + hover + ${state}`);
          }
        }
      }
      return failures;
    }, [states]);
    assert.deepStrictEqual(hoverFailures, []);
    console.log(`Firefox theme regression: ${results.checks} checks passed (theme switching, legacy snippet in both load orders, day states, dots, timeline, CSS isolation).`);
    console.log("Selected day hover: all 12 state/theme combinations passed without a border.");
  } finally {
    if (session) await request(`/session/${session}`, "DELETE");
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
