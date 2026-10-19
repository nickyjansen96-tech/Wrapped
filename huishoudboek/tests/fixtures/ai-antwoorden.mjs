export const ANSWERS = {
  "netjes JSON":
    '```json\n{"regels":[{"trefwoord":"Albert Heijn","categorie":"Boodschappen"},{"trefwoord":"Shell","categorie":"Brandstof, parkeren en OV"}]}\n```',
  "gekrulde quote (hobby’s)":
    '```json\n{"regels":[{"trefwoord":"Thuisbezorgd","categorie":"Uit eten, uitgaan en hobby’s"},{"trefwoord":"Albert Heijn","categorie":"Boodschappen"}]}\n```',
  "komma na laatste regel":
    '```json\n{\n  "regels": [\n    {"trefwoord": "Albert Heijn", "categorie": "Boodschappen"},\n    {"trefwoord": "Shell", "categorie": "Brandstof, parkeren en OV"},\n  ]\n}\n```',
  "slimme aanhalingstekens": "{“regels”:[{“trefwoord”:“Albert Heijn”,“categorie”:“Boodschappen”}]}",
  "categorie → trefwoorden":
    '```json\n{"Boodschappen":["Albert Heijn","Jumbo"],"Brandstof, parkeren en OV":["Shell"]}\n```',
  "tabel (ChatGPT)":
    "Hier is een overzicht:\n\n| Trefwoord | Categorie |\n|---|---|\n| Albert Heijn | Boodschappen |\n| Shell | Brandstof, parkeren en OV |\n",
  "regels met pijl":
    "- Albert Heijn → Boodschappen\n- Shell → Brandstof, parkeren en OV\n- Kruidvat → Persoonlijke verzorging",
  "kleine afwijking categorie":
    "```\nAlbert Heijn | boodschappen\nShell | Brandstof parkeren en OV\nZiggo | Abonnement\n```",
};
Object.assign(ANSWERS, {
  "Claude: uitleg + codeblok + onzeker":
    "Hier zijn de regels op basis van je transacties:\n\n```\nAlbert Heijn | Boodschappen\nThuisbezorgd | Uit eten, uitgaan en hobby's\nNS Reizigers | Brandstof, parkeren en OV\n```\n\nOnzeker: Bol.com (kan van alles zijn), Marktplaats.",
  "ChatGPT: lijst met vet":
    "Natuurlijk! Hier zijn de regels:\n\n1. **Albert Heijn** → Boodschappen\n2. **Kruidvat** → Persoonlijke verzorging\n3. **Vattenfall** → Energie en water\n\nLaat me weten als je nog iets wilt aanpassen.",
  "JSON als lijst van paren": '```json\n[["Albert Heijn","Boodschappen"],["Netflix","Abonnementen"]]\n```',
  "trefwoord: categorie": "Albert Heijn: Boodschappen\nNetflix: Abonnementen\nOok handig: check je abonnementen.",
});
