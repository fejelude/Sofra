function errorDetails(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
    };
  }

  return { message: String(error) };
}

function serialize(context) {
  return JSON.stringify(context, (_key, value) => {
    if (value instanceof Error) {
      return errorDetails(value);
    }

    if (typeof value === "bigint") {
      return value.toString();
    }

    return value;
  });
}

function write(level, event, message, context = {}) {
  const timestamp = new Date().toISOString();
  const suffix = Object.keys(context).length > 0 ? ` ${serialize(context)}` : "";
  const line = `[${timestamp}] [${level}] [${event}] ${message}${suffix}`;

  if (level === "ERROR") {
    console.error(line);
  } else if (level === "WARN") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = Object.freeze({
  info(event, message, context) {
    write("INFO", event, message, context);
  },

  warn(event, message, context) {
    write("WARN", event, message, context);
  },

  error(event, message, error, context = {}) {
    write("ERROR", event, message, { ...context, error: errorDetails(error) });
  },
});
