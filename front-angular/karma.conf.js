module.exports = function (config) {
  config.set({
    coverageReporter: {
      check: {
        global: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  });
};
