let apiKey, modal, observer;

async function attach() {
  const { accessKey, email } = await chrome.storage.local.get([
    "accessKey",
    "email",
  ]);
  apiKey = accessKey;

  const header = document.querySelector(".item.header");
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

  if (!modal) {
    modal = document.querySelector("#modal-players");
    if (!modal) return;
    observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === "childList")) {
        playerListVisible(observer, modal);
      }
    });
  }

  if (!apiKey) {
    observer.disconnect();
    active.textContent = "(not signed in)";
    active.style["background-color"] = "red";
    return;
  }

  active.textContent = `(${email})`;
  active.style["background-color"] = "";

  observer.observe(modal, { childList: true, subtree: true });
}

async function playerListVisible(observer, modal) {
  observer.disconnect();

  const targetRating = getTargetRating();
  const header = modal.querySelector("#modal-roster-header-text");
  const target = document.createElement("span");

  target.textContent = `(Rating: ${targetRating.min} - ${targetRating.max})`;
  header.appendChild(target);

  const promises = [];
  modal.querySelectorAll(".FacilityItem > * > .pbc").forEach((p) => {
    if (p.childNodes.length > 1) {
      const nameElement = p.childNodes[0];
      const ratingElement = p.childNodes[1];
      const player = {
        name: trimName(nameElement.nodeValue),
        rating: parseFloat(ratingElement?.textContent.trim(), 10) ?? undefined,
      };

      const dupr = document.createElement("span");
      dupr.classList.add("text", "small", "ml5");
      dupr.textContent = "(DUPR - loading...)";
      p.appendChild(dupr);

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
    }
  });

  await Promise.all(promises);

  observer.observe(modal, { childList: true, subtree: true });
}

function getTargetRating() {
  const propsText = document.querySelector(
    'div[data-react-class="ClinicStepperIndividualSesions"]'
  ).attributes["data-react-props"].value;

  const props = JSON.parse(propsText);

  return {
    min: props.minRating,
    max: props.maxRating,
  };
}

async function duprLookup(playerName) {
  var headers = new Headers();
  headers.append("Content-Type", "application/json");
  headers.append("Authorization", `Bearer ${apiKey}`);

  var raw = JSON.stringify({
    limit: 3,
    offset: 0,
    query: playerName,
    exclude: [],
    includeUnclaimedPlayers: false,
    filter: {
      lat: 53.4233228,
      lng: -113.5939847,
      radiusInMeters: 500000,
      rating: {
        maxRating: null,
        minRating: null,
      },
      locationText: "",
    },
  });

  var requestOptions = {
    method: "POST",
    headers,
    body: raw,
    redirect: "follow",
  };

  const response = await fetch(
    "https://api.dupr.gg/player/v1.0/search",
    requestOptions
  );
  const data = await response.json();
  if (data.status == "SUCCESS" && data.result.hits.length > 0) {
    const name = trimName(data.result.hits[0].fullName);
    const rating = data.result.hits[0].ratings.doubles;

    console.log("DUPR", playerName, "found", name, rating);

    return {
      name,
      rating,
    };
  } else {
    console.log("DUPR", playerName, "not found");
  }
}

function trimName(name) {
  return name
    .split(" ")
    .filter((part) => part.length > 0)
    .join(" ")
    .trim();
}

(async function () {
  await attach();
})();

chrome.storage.onChanged.addListener(async ({ accessKey }, namespace) => {
  if (namespace != "local") return;
  if (accessKey) attach();
});
