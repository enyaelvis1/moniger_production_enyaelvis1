const allowedEnvironments = new Set(["development", "local", "qa", "sandbox", "staging", "test"]);

export const assertTestDataEnvironment = ({ allowTestData, environment }) => {
  const normalizedEnvironment = (environment || "").trim().toLowerCase();
  if (allowTestData !== "true" || !allowedEnvironments.has(normalizedEnvironment)) {
    throw new Error(
      `Refusing to create sample data. Set ALLOW_TEST_DATA=true and APP_ENVIRONMENT to one of: ${[...allowedEnvironments].join(", ")}.`,
    );
  }
};
