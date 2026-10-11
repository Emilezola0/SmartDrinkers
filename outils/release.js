// Publie une nouvelle version : met à jour le numéro partout d'un coup.
// Utilisation (dans le dossier SmartDrinkers) :
//   node outils/release.js          → 1.6.0 devient 1.6.1 (petite correction)
//   node outils/release.js minor    → 1.6.0 devient 1.7.0 (nouveauté)
//   node outils/release.js 2.0.0    → numéro choisi
// Ensuite : Valider + Synchroniser dans VS Code. Les téléphones verront « Nouvelle version disponible ».
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const f = p => path.join(root, p);
const cur = JSON.parse(fs.readFileSync(f("version.json"), "utf8")).version;
const arg = process.argv[2] || "patch";
let [a, b, c] = cur.split(".").map(Number);
let next;
if (/^\d+\.\d+\.\d+$/.test(arg)) next = arg;
else if (arg === "major") next = `${a + 1}.0.0`;
else if (arg === "minor") next = `${a}.${b + 1}.0`;
else next = `${a}.${b}.${c + 1}`;
fs.writeFileSync(f("version.json"), `{ "version": "${next}" }\n`);
const rep = (file, re, val) => { const s = fs.readFileSync(f(file), "utf8"); if (!re.test(s)) throw new Error("Version introuvable dans " + file); fs.writeFileSync(f(file), s.replace(re, val)); };
rep("js/version.js", /APP_VERSION = "[^"]*"/, `APP_VERSION = "${next}"`);
rep("sw.js", /const VERSION = "[^"]*"/, `const VERSION = "sd-v${next}"`);
console.log(`Version ${cur} → ${next}. Pense à Valider + Synchroniser.`);
