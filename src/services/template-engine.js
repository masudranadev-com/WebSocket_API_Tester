import crypto from "node:crypto";

const FIRST_NAMES = [
  "Avery",
  "Mila",
  "Kai",
  "Noah",
  "Leila",
  "Rowan",
  "Iris",
  "Theo",
  "Nadia",
  "Owen"
];

const LAST_NAMES = [
  "Kins",
  "Harper",
  "Rahman",
  "Torres",
  "Blake",
  "Chowdhury",
  "Patel",
  "Morales",
  "Nguyen",
  "Ahmed"
];

export const PLACEHOLDER_GUIDE = [
  { token: "[[NAME]]", meaning: "Random first and last name" },
  { token: "[[F_NAME]]", meaning: "Random first name" },
  { token: "[[L_NAME]]", meaning: "Random last name" },
  { token: "[[NUMBER_100000_999999]]", meaning: "Random number in an inclusive range" },
  { token: "[[UUID]]", meaning: "Generated UUID" },
  { token: "[[EMAIL]]", meaning: "Random email address" },
  { token: "[[NOW_ISO]]", meaning: "Current ISO timestamp" },
  { token: "[[USERNAME]]", meaning: "Current workspace username" }
];

function randomItem(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function randomName() {
  return {
    first: randomItem(FIRST_NAMES),
    last: randomItem(LAST_NAMES)
  };
}

function randomInteger(min, max) {
  const low = Number(min);
  const high = Number(max);

  if (!Number.isFinite(low) || !Number.isFinite(high) || high < low) {
    return "";
  }

  return String(Math.floor(Math.random() * (high - low + 1)) + low);
}

export function renderTemplate(template, context = {}) {
  const source = String(template ?? "");

  return source.replace(/\[\[([A-Z0-9_]+)\]\]/g, (_, rawToken) => {
    if (rawToken.startsWith("NUMBER_")) {
      const parts = rawToken.split("_");
      return randomInteger(parts[1], parts[2]);
    }

    switch (rawToken) {
      case "NAME": {
        const name = randomName();
        return `${name.first} ${name.last}`;
      }
      case "F_NAME":
        return randomName().first;
      case "L_NAME":
        return randomName().last;
      case "UUID":
        return crypto.randomUUID();
      case "EMAIL": {
        const first = randomName().first.toLowerCase();
        const last = randomName().last.toLowerCase();
        return `${first}.${last}@example.com`;
      }
      case "NOW_ISO":
        return new Date().toISOString();
      case "USERNAME":
        return String(context.username ?? "");
      default:
        return `[[${rawToken}]]`;
    }
  });
}
