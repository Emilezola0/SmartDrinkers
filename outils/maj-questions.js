// Met à jour data/questions.js à partir de data/questions.tsv
// Utilisation (dans le dossier SmartDrinkers) :  node outils/maj-questions.js
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const tsv = fs.readFileSync(path.join(root, "data", "questions.tsv"), "utf8");
fs.writeFileSync(path.join(root, "data", "questions.js"),
  "/* Généré depuis questions.tsv — relance outils/maj-questions.js après chaque modification. */\nwindow.SD_QUESTIONS_TSV = " + JSON.stringify(tsv) + ";\n");
console.log("data/questions.js mis à jour (" + tsv.split(/\n/).length + " lignes). Pense à changer VERSION dans sw.js.");
