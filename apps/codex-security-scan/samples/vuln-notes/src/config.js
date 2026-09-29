// INTENTIONALLY VULNERABLE SAMPLE — do not deploy.
module.exports = {
  port: 3000,
  // Hardcoded credential committed to source control (fake placeholder value).
  paymentsApiKey: "sk_demo_FAKE_0000_not_a_real_key_0000",
  sessionSecret: "changeme",
  uploadsDir: __dirname + "/../uploads",
};
