const duprCache = {};

async function duprLookup(playerName) {
  if (duprCache[playerName]) return duprCache[playerName];

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

    duprCache[playerName] = {
      name,
      rating,
    };

    return duprCache[playerName];
  } else {
    console.log("DUPR", playerName, "not found");
  }
}
