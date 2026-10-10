# SmartDrinkers

Mini-jeux de soirée en PWA (appli web installable). Le perdant d'un mini-jeu passe au quiz : il choisit Facile, Moyen ou Difficile, répond à voix haute, et boit s'il se trompe.

## Les jeux

| Jeu | Mode | Principe |
|---|---|---|
| Plus ou Moins | 1 téléphone | La prochaine carte sera-t-elle plus haute ou plus basse ? |
| Roulette russe | 1 téléphone | Six 0, un seul 1 : prendre ou retirer |
| La Bombe | 1 téléphone | On cite un mot de la catégorie et on passe le téléphone avant l'explosion |
| Réflexe | 1 téléphone | Duel face à face, le premier qui tape quand l'écran passe au vert |
| L'Intrus | Chacun son téléphone | Même mot pour tous sauf l'intrus (code partagé) |
| Quiz Synchro | Chacun son téléphone | Les mêmes questions sur tous les téléphones (code partagé) |

Règles : bouton « ? » sur chaque jeu, ou appui long sur la carte du jeu.

## Code partagé et QR code

Seuls les jeux « chacun son téléphone » utilisent un code. L'hôte crée la partie et un QR code s'affiche avec un code du type `IN-K7M2Q-6`. Les autres scannent le QR dans « Rejoindre une partie » ou tapent le code. Tous les tirages sont calculés à partir de ce code : aucun serveur, aucune connexion entre les téléphones.

Pour Quiz Synchro, tout le monde doit avoir la même liste de questions. Le code contient une empreinte de la liste, et l'appli prévient si elle diffère.

## Tester sur ton PC

Ouvrir `index.html` en double-cliquant marche pour tout, sauf le scan QR et le mode hors ligne. Pour un test complet, dans ce dossier :

```
python -m http.server 8000
```

puis ouvre http://localhost:8000

## Mettre en ligne pour l'installer sur téléphone

Une PWA doit être servie en HTTPS. Deux options gratuites :

- **Netlify Drop** (le plus rapide) : va sur https://app.netlify.com/drop et glisse-dépose le dossier `SmartDrinkers`. Tu obtiens un lien en HTTPS tout de suite.
- **GitHub Pages** : pousse le dossier dans un dépôt, puis Settings › Pages › Deploy from branch.

Ensuite, sur le téléphone, ouvre le lien :
- iPhone (Safari) : Partager › « Sur l'écran d'accueil »
- Android (Chrome) : menu ⋮ › « Installer l'application »

## Modifier les questions

Format du fichier (`data/questions.tsv`, export TSV de Google Sheets) :

`Thème | Theme_EN | E1 | E1_Ans | E1_EN | E1_Ans_EN | E2 | E2_Ans | E2_EN | E2_Ans_EN | M1 | … | H2_Ans_EN`

E = facile, M = moyen, H = difficile. Les colonnes `_EN` contiennent la version anglaise (affichée quand l'appli est en anglais) ; si elles sont vides, la question reste en français. On peut ajouter autant de colonnes E3, M3… qu'on veut. Le fichier fourni contient 1 500 questions traduites. Tu peux l'importer tel quel dans Google Sheets (Fichier › Importer). Une précision entre parenthèses longue dans une réponse s'affiche en petit sous la réponse.

- **Pour tout le monde** : remplace `data/questions.tsv`, lance `node outils/maj-questions.js`, change `VERSION` dans `sw.js`, puis remets en ligne.
- **Juste sur un téléphone** : Réglages › Importer un fichier, ou colle le lien Google Sheets (Fichier › Partager › Publier sur le Web, format TSV).

## Structure

```
index.html            page de l'appli
manifest.webmanifest  nom, icônes, couleurs pour l'installation
sw.js                 mode hors ligne
css/style.css         style (thème sombre et clair)
js/i18n.js            textes FR/EN, catégories de La Bombe, mots de L'Intrus
js/core.js            état, sons, hasard déterministe, navigation
js/quiz.js            lecture des questions et déroulé du quiz
js/games.js           jeux sur 1 téléphone
js/share.js           code partagé, QR, L'Intrus, Quiz Synchro
js/main.js            accueil et réglages
js/lib/               qrcode-generator (MIT), jsQR (Apache 2.0)
data/                 questions
icons/                icônes de l'appli
```

Ajouter un jeu : copie un bloc de `js/games.js`, appelle `SD.addGame({ id, mode: "one", min: 2, start })`, et ajoute ses textes `g_<id>`, `g_<id>_d`, `g_<id>_r` dans `js/i18n.js`.

À consommer avec modération.
