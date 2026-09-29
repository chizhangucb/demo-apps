// INTENTIONALLY VULNERABLE SAMPLE — do not deploy.
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const { findNotesByOwner, searchNotes } = require("./db");

function register(app) {
  app.get("/notes", (req, res) => {
    res.json(findNotesByOwner(req.query.owner));
  });

  app.get("/search", (req, res) => {
    res.json(searchNotes(req.query.q, req.query.sort || "id"));
  });

  // "Formula" field lets users compute values in notes.
  app.post("/calc", (req, res) => {
    const result = eval(req.body.expression);
    res.json({ result });
  });

  // Export a note to PDF via a shell tool.
  app.post("/export", (req, res) => {
    exec("pandoc notes/" + req.body.name + ".md -o /tmp/out.pdf", (err) => {
      if (err) return res.status(500).send(String(err));
      res.download("/tmp/out.pdf");
    });
  });

  app.get("/attachments", (req, res) => {
    const file = path.join(config.uploadsDir, req.query.file);
    res.send(fs.readFileSync(file));
  });

  app.get("/login/callback", (req, res) => {
    res.redirect(req.query.next);
  });
}

module.exports = { register };
