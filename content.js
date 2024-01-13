let apiKey, observer;

playByCourt = {
  urls: [
    /^https:\/\/playbycourt\.com\//,
    /^https:\/\/.*\.playbypoint\.com\/(?!admin).*$/,
  ],
  headerSelector: ".item.header",
  rosterHeaderSelector: "#modal-roster-header-text>div",
  rosterRowSelector:
    ".FacilityItem:not(.ReservationGame)>.content>h1,.FacilityItem>.content>span",
  getTargetRating() {
    const propsText = document.querySelector(
      'div[data-react-class="ClinicStepperIndividualSesions"]'
    )?.attributes["data-react-props"].value;

    if (!propsText) return {};

    const props = JSON.parse(propsText);

    return {
      min: props.minRating,
      max: props.maxRating,
    };
  },
};

// playByPointAdmin = {
//   urls: [/^https:\/\/.*\.playbypoint\.com\/admin\/.*$/],
//   headerSelector: "",
//   rosterHeaderSelector: "",
//   rosterRowSelector: "",
//   getTargetRating() {
//     return {};
//   },
// };

courtReserve = {
  urls: [/^https:\/\/app\.courtreserve\.com\//],
  headerSelector: ".navbar_brand",
  rosterHeaderSelector: "#EventDetailsTabStrip-registrants",
  rosterRowSelector:
    "#EventDetailsTabStrip-registrants tbody>tr>th[scope=row],#EventDetailsTabStrip-registration tbody>tr>th[scope=row]",
  getTargetRating() {
    const targets = document.querySelector(".restriction-value")?.textContent;
    if (!targets) return {};

    const targetValues = targets.split(", ").map(parseFloat);
    const min = Math.min(...targetValues);
    const max = Math.max(...targetValues);

    return {
      min,
      max,
    };
  },
};

const sites = [playByCourt, courtReserve];
const context = sites.find((site) =>
  site.urls.some((r) => r.test(window.location.href))
);

async function attach() {
  if (!context) {
    console.log("Could not determine context for", window.location.href);
    return;
  }

  const { accessKey, email } = await chrome.storage.local.get([
    "accessKey",
    "email",
  ]);
  apiKey = accessKey;

  const header = document.querySelector(context.headerSelector);
  if (!header) return;

  let active = document.querySelector("#dupr-active");
  let logo = document.querySelector("#dupr-logo");
  if (!logo) {
    logo = document.createElement("img");
    logo.id = "dupr-logo";
    logo.src = chrome.runtime.getURL("img/favicon-32x32.png");
    header.appendChild(logo);

    active = document.createElement("span");
    active.id = "dupr-active";
    header.appendChild(active);
  }

  if (!apiKey) {
    observer.disconnect();
    active.textContent = "(not signed in)";
    active.style["background-color"] = "red";
    return;
  }

  active.textContent = `(${email})`;
  active.style["background-color"] = "";

  attachToPlayersList();
}

async function attachToPlayersList() {
  observer.disconnect();

  const targetRating = context.getTargetRating();
  const header = document.querySelector(context.rosterHeaderSelector);

  if (header && targetRating && !document.querySelector("#dupr-target")) {
    const target = document.createElement("span");
    target.id = "dupr-target";
    target.textContent = `(Rating: ${targetRating.min} - ${targetRating.max})`;
    header.insertBefore(target, header.firstChild);
  }

  const promises = [];
  document.querySelectorAll(context.rosterRowSelector).forEach((p) => {
    if (p.querySelector("#dupr-rating")) return;

    const nameElement = p.childNodes[0];
    const ratingElement = p.childNodes[1];
    const player = {
      name: trimName(nameElement.textContent),
      rating: parseFloat(ratingElement?.textContent.trim(), 10) ?? undefined,
    };

    const duprHyperlink = document.createElement("a");
    duprHyperlink.classList.add("dupr-link");
    p.appendChild(duprHyperlink);

    const dupr = document.createElement("span");
    dupr.id = "dupr-rating";
    dupr.classList.add("text", "small", "ml5");
    dupr.textContent = "(DUPR - loading...)";
    duprHyperlink.appendChild(dupr);

    promises.push(
      duprLookup(player.name).then(async (match) => {
        const alert = "red";
        if (!match) {
          //no exact match, try shortening the name
          const nameParts = player.name.split(" ");
          const shortName = nameParts
            .map((part, i) => {
              if (i == 0) return part[0];
              return part;
            })
            .join(" ");
          match = await duprLookup(shortName);
        }
        if (match) {
          duprHyperlink.classList.add("active");
          duprHyperlink.target = "_blank";
          duprHyperlink.href = match.href;

          if (match.name.toLowerCase() === player.name.toLowerCase()) {
            dupr.textContent = `(DUPR: ${match.rating})`;
          } else {
            dupr.textContent = `(DUPR: [${match.name}] ${match.rating})`;
            dupr.style.color = "orange";
          }

          if (
            match.rating == "NR" ||
            match.rating < targetRating.min ||
            match.rating > targetRating.max
          ) {
            dupr.style.color = alert;
          }
        } else {
          dupr.textContent = "(DUPR: not found)";
          dupr.style.color = alert;
        }
      })
    );
  });

  await Promise.all(promises);

  observer.observe(document.body, { childList: true, subtree: true });
}

function trimName(name) {
  return name
    .split(" ")
    .filter((part) => part.length > 0)
    .join(" ")
    .trim();
}

observer = new MutationObserver((mutations) => {
  if (mutations.some((mutation) => mutation.type === "childList")) {
    attach();
  }
});
observer.observe(document.body, { childList: true, subtree: true });

chrome.storage.onChanged.addListener(async ({ accessKey }, namespace) => {
  if (namespace != "local") return;
  if (accessKey) attach();
});

attach();
