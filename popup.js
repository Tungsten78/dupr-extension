async function signIn() {
  const result = await login(
    document.querySelector("#email").value,
    document.querySelector("#password").value
  );
  if (result) {
    const creds = {
      email: result.user.email,
      accessKey: result.accessToken,
    };
    await chrome.storage.local.set(creds);
    setSignedIn(creds);
  }
}

async function signOut() {
  await chrome.storage.local.remove("email");
  await chrome.storage.local.remove("accessKey");
  setSignedIn(false);
}

function setSignedIn(creds) {
  if (creds) {
    signInDiv.style.display = "none";
    signOutDiv.style.display = "block";
    document.querySelector("#user-name").textContent = creds.email;
  } else {
    signInDiv.style.display = "block";
    signOutDiv.style.display = "none";
  }
}

async function initialize() {
  document.querySelector("#signIn").addEventListener("click", signIn);
  document.querySelector("#signOut").addEventListener("click", signOut);

  const creds = await chrome.storage.local.get(["email", "accessKey"]);
  setSignedIn(creds);

  const response = await fetch(chrome.runtime.getURL("manifest.json"));
  const data = await response.json();
  document.getElementById("version").textContent = data.version;
}

async function login(email, password) {
  const response = await fetch("https://api.dupr.gg/auth/v1.0/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const json = await response.json();
  if (json.status == "SUCCESS") {
    return json.result;
  } else {
    console.console.warn(json);
  }
}

const signInDiv = document.querySelector("#sign-in");
const signOutDiv = document.querySelector("#sign-out");

initialize();
