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
  {
    token: "[[NAME]]",
    meaning: "Random first and last name",
    example: '{"customer":"[[NAME]]"}',
    note: "Creates a full name like Avery Patel every time the template is rendered."
  },
  {
    token: "[[F_NAME]]",
    meaning: "Random first name",
    example: '{"firstName":"[[F_NAME]]"}',
    note: "Useful when your payload stores first and last names separately."
  },
  {
    token: "[[L_NAME]]",
    meaning: "Random last name",
    example: '{"lastName":"[[L_NAME]]"}',
    note: "Pairs well with [[F_NAME]] for split name fields."
  },
  {
    token: "[[NUMBER_100000_999999]]",
    meaning: "Random number in an inclusive range",
    example: '{"otp":"[[NUMBER_100000_999999]]"}',
    note: "Replace the min and max with any integer or decimal values, like [[NUMBER_1.00_150.00]]."
  },
  {
    token: "[[UUID]]",
    meaning: "Generated UUID",
    example: '{"id":"[[UUID]]"}',
    note: "Great for request ids, resource ids, and fake references."
  },
  {
    token: "[[EMAIL]]",
    meaning: "Random email address",
    example: '{"email":"[[EMAIL]]"}',
    note: "Creates a fake example.com address from random name parts."
  },
  {
    token: "[[NOW_ISO]]",
    meaning: "Current ISO timestamp",
    example: '{"createdAt":"[[NOW_ISO]]"}',
    note: "Rendered in ISO 8601 format at request time."
  },
  {
    token: "[[USERNAME]]",
    meaning: "Current workspace username",
    example: '{"workspace":"[[USERNAME]]"}',
    note: "Useful when you want the active workspace name inside a response."
  }
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

function decimalPlaces(value) {
  const source = String(value ?? "");
  if (!source.includes(".")) {
    return 0;
  }

  return source.split(".")[1].length;
}

function randomNumberInRange(min, max) {
  const precision = Math.max(decimalPlaces(min), decimalPlaces(max));
  if (precision === 0) {
    return randomInteger(min, max);
  }

  const scale = 10 ** precision;
  const low = Math.round(Number(min) * scale);
  const high = Math.round(Number(max) * scale);

  if (!Number.isFinite(low) || !Number.isFinite(high) || high < low) {
    return "";
  }

  const value = Math.floor(Math.random() * (high - low + 1)) + low;
  return (value / scale).toFixed(precision);
}

export function renderTemplate(template, context = {}) {
  const source = String(template ?? "");

  return source.replace(/\[\[([A-Z0-9_.-]+)\]\]/g, (_, rawToken) => {
    const numberMatch = rawToken.match(/^NUMBER_(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?)$/);
    if (numberMatch) {
      return randomNumberInRange(numberMatch[1], numberMatch[2]);
    }

    if (rawToken.startsWith("NUMBER_")) {
      return `[[${rawToken}]]`;
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
