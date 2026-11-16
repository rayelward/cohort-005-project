// CODING_STANDARDS.md rules that a linter can check.

const isIdentifier = (node, name) =>
  node?.type === "Identifier" && node.name === name;

const isMember = (node, objectName, propertyName) =>
  node?.type === "MemberExpression" &&
  !node.computed &&
  isIdentifier(node.object, objectName) &&
  node.property.name === propertyName;

// "Inject the clock": a module takes the time as an argument.
const noClock = {
  meta: {
    type: "problem",
    messages: {
      clock:
        "Inject the clock (CODING_STANDARDS.md): take `now: Date` as an argument instead of reading the time here, so a test can fix the moment.",
    },
  },
  create(context) {
    return {
      NewExpression(node) {
        if (isIdentifier(node.callee, "Date") && node.arguments.length === 0) {
          context.report({ node, messageId: "clock" });
        }
      },
      CallExpression(node) {
        if (isMember(node.callee, "Date", "now")) {
          context.report({ node, messageId: "clock" });
        }
      },
    };
  },
};

// `params.x`, `formData.get(…)`, `searchParams.get(…)` and
// `url.searchParams.get(…)`: the request's own values.
const isUntrusted = (node) => {
  if (node?.type === "MemberExpression")
    return isIdentifier(node.object, "params");
  if (node?.type !== "CallExpression") return false;
  const { callee } = node;
  if (callee.type !== "MemberExpression" || callee.property.name !== "get") {
    return false;
  }
  const owner = callee.object;
  return (
    isIdentifier(owner, "formData") ||
    isIdentifier(owner, "searchParams") ||
    (owner.type === "MemberExpression" &&
      owner.property.name === "searchParams")
  );
};

// "Parse untrusted input with a schema, at the edge": `Number("")` is 0.
const noNumberCoercion = {
  meta: {
    type: "problem",
    messages: {
      coerce:
        'Parse untrusted input with a schema (CODING_STANDARDS.md): `Number("")` is 0. Use a zod schema, e.g. `z.coerce.number().int().positive()`.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          isIdentifier(node.callee, "Number") &&
          isUntrusted(node.arguments[0])
        ) {
          context.report({ node, messageId: "coerce" });
        }
      },
    };
  },
};

export default {
  meta: { name: "standards" },
  rules: {
    "no-clock": noClock,
    "no-number-coercion": noNumberCoercion,
  },
};
