// Statische definitie van het Blisss-proces "Prospect naar Livegang".
// Dit bestand bevat de inhoudelijke procesflow: fases, stappen, eigenaren,
// betrokkenen, verantwoordelijkheden, output en normtijden. De voortgang per
// traject (welke stappen zijn afgetikt, door wie en wanneer) wordt apart
// bijgehouden in data/trajecten.json — zie store.js.

// normDagen wordt gebruikt om een indicatieve deadline te berekenen vanaf het
// moment dat de vorige stap is afgerond (of vanaf de startdatum van het
// traject voor de eerste stap). eenheid: 'werkdagen' | 'weken' | 'dagen'.
function dagenInKalenderdagen({ aantal, eenheid }) {
  if (eenheid === 'weken') return aantal * 7;
  if (eenheid === 'werkdagen') return Math.ceil(aantal * 1.4); // ruwe correctie voor weekenden
  return aantal;
}

export const FASES = [
  {
    id: 'kwalificatie',
    titel: 'Sales — Kwalificatie & kennismaking',
    omschrijving:
      'Van eerste contact tot een gevalideerd beeld van de klantvraag: is er een match tussen prospect en Blisss, en is er genoeg vertrouwen om een indicatie op te stellen?',
    stappen: ['1', '2', '3'],
  },
  {
    id: 'indicatie',
    titel: 'Sales — Indicatie & offerte diagnosefase',
    omschrijving:
      'De globale projectinschatting wordt opgesteld, intern getoetst en met de klant besproken. Bij akkoord volgt de offerte voor de diagnosefase.',
    stappen: ['4', '5', '6', '7'],
  },
  {
    id: 'diagnose',
    titel: 'Diagnosefase',
    omschrijving:
      'Het commerciële traject wordt formeel overgedragen aan de projectorganisatie. De diagnosefase levert een concreet projectplan op dat aan de klant wordt gepresenteerd.',
    stappen: ['8', '9', '10'],
  },
  {
    id: 'hoofdfase',
    titel: 'Hoofdfase — Implementatie',
    omschrijving:
      'Na akkoord op het projectplan wordt de hoofdfase geoffreerd, opgestart en uitgevoerd: sprints, stuurgroepen en bewaking van scope, planning en budget.',
    stappen: ['11', '12', '13'],
  },
  {
    id: 'livegang',
    titel: 'Livegang & nazorg',
    omschrijving:
      'De laatste stap naar productie: migratie, acceptatie en training, gevolgd door de livegang zelf en een gecontroleerde overdracht naar support.',
    stappen: ['14', '15', '16'],
  },
];

export const STAPPEN = [
  {
    nummer: '1',
    titel: 'Ontstaan en kwalificeren prospect',
    eigenaar: 'Sales',
    betrokkenen: [],
    verantwoordelijkheden: [
      'Identificeren van nieuwe prospects.',
      'Eerste kwalificatie op branche, omvang, complexiteit en match met Blisss.',
      'Vaststellen of er voldoende potentie is voor een kennismaking.',
      'Toetsen kredietwaardigheid.',
    ],
    output: ['Gekwalificeerde prospect.', 'Ingeplande kennismaking.'],
    normTekst: 'Binnen 1 werkdag eerste contact.',
    normDagen: { aantal: 1, eenheid: 'werkdagen' },
  },
  {
    nummer: '2',
    titel: 'Eerste kennismaking / introductie Business Central',
    eigenaar: 'Sales',
    betrokkenen: ['Sales', 'Optioneel: Pré-sales (Edwin)'],
    verantwoordelijkheden: [
      'Kennismaking tussen Blisss en prospect.',
      'Inventariseren van de belangrijkste bedrijfsprocessen en uitdagingen.',
      'Optioneel: introductie van Business Central en de Blisss-aanpak.',
      'Bepalen of een vervolgtraject zinvol is.',
    ],
    output: ['Inzicht in wensen en uitdagingen klant.', 'Besluit over vervolg.'],
    volgendeStap:
      'Inhoudelijke demo / klantcasus plannen. COO informeren naar mogelijk projectteam en/of gewenste inzet (senior) consultant.',
    links: [
      {
        label: 'Flow Prospect naar livegang — stap 3 (Confluence)',
        url: 'https://blisss.atlassian.net/wiki/spaces/CON/pages/4539121669/Flow+Prospect+naar+livegang#3.-Inhoudelijke-demo-%2F-klantcasus',
      },
    ],
  },
  {
    nummer: '3',
    titel: 'Inhoudelijke demo / klantcasus',
    eigenaar: 'Sales',
    betrokkenen: [
      'Sales',
      'Pré-sales (Edwin)',
      'Optioneel: senior consultant (let op: seintje naar TC\'er over diens betrokkenheid!)',
    ],
    verantwoordelijkheden: [
      'Demonstreren hoe Business Central aansluit op de specifieke situatie van de klant.',
      'Valideren van de belangrijkste processen en wensen.',
      'Identificeren van mogelijke risico\'s, afwijkingen en maatwerkbehoeftes.',
    ],
    output: ['Voldoende inzicht om een projectindicatie op te stellen. Zo niet, dan nog een extra sessie.'],
    normTekst: 'Binnen 2 weken na kennismaking.',
    normDagen: { aantal: 2, eenheid: 'weken' },
  },
  {
    nummer: '4',
    titel: 'Opstellen projectindicatie (intern)',
    eigenaar: 'Sales',
    betrokkenen: ['Sales', 'Pré-sales (Edwin)', 'Senior consultant en/of projectleider', 'Administratie'],
    verantwoordelijkheden: [
      'Opstellen van een globale projectinschatting op basis van de Offertecalculator.',
      'Vaststellen van verwachte omvang van zowel diagnosefase als hoofdfase.',
      'Interne toets op haalbaarheid en verwachtingen.',
    ],
    output: ['Projectindicatie inclusief globale investering en doorlooptijd.'],
    normTekst: 'Maximaal 3 werkdagen na de inhoudelijke demo.',
    normDagen: { aantal: 3, eenheid: 'werkdagen' },
  },
  {
    nummer: '5',
    titel: 'Scope bespreken met klant (extern)',
    eigenaar: 'Sales',
    betrokkenen: ['Sales', 'Pré-sales', 'Senior consultant en/of projectleider', 'Sales Control'],
    verantwoordelijkheden: [
      'Doornemen van globale projectinschatting op basis van de offertecalculator met de klant.',
      'Vaststellen van verwachte omvang van zowel diagnosefase als hoofdfase.',
      'Uitvragen wensen qua voorwaarden (NLDigital).',
      'Interne én externe toets op haalbaarheid en verwachtingen.',
    ],
    output: ['Projectindicatie inclusief globale investering en doorlooptijd.'],
    normTekst: 'Maximaal 1 week na inhoudelijke demo.',
    normDagen: { aantal: 1, eenheid: 'weken' },
  },
  {
    nummer: '6',
    titel: 'Bespreken projectindicatie met klant',
    eigenaar: 'Sales',
    betrokkenen: ['Sales', 'Senior consultant en/of projectleider'],
    verantwoordelijkheden: [
      'Toelichten van de projectindicatie.',
      'Bespreken van aannames, risico\'s en verwachtingen.',
      'Verifiëren of de klant voldoende vertrouwen heeft in het vervolg.',
    ],
    aanpak: [
      'Indicatie minimaal 1 werkdag vooraf toesturen.',
      'Telefonische toelichting vooraf.',
      'Bespreking bij voorkeur op locatie.',
    ],
    output: ['Akkoord om diagnosefase te offreren.'],
    goNoGo: 'Wel of geen voorstel voor diagnosefase.',
    normTekst: 'Maximaal 2 à 3 weken na de laatste inhoudelijke demo.',
    normDagen: { aantal: 3, eenheid: 'weken' },
    links: [
      {
        label: 'Functieprofielen projectleider en key-user klant (SharePoint)',
        url: 'https://blisss365.sharepoint.com/:p:/r/sites/documents/Documenten/ERP-team/Projectmethode/Functieprofielen%20projectleider%20en%20key-user%20klant%202026.pptx?d=wbc7c82e81d7b4372a7f2c03b12e4f62b&csf=1&web=1&e=n3TNQc',
      },
    ],
  },
  {
    nummer: '7',
    titel: 'Opstellen en versturen offerte diagnosefase',
    eigenaar: 'Sales',
    betrokkenen: ['Sales', 'Senior consultant / projectleider', 'Administratie'],
    verantwoordelijkheden: [
      'Opstellen van de offerte voor de diagnosefase.',
      'Controleren van scope, uitgangspunten en randvoorwaarden.',
      'Uitvoeren van sales control.',
      'Verzenden via DocuSign.',
    ],
    output: ['Getekende offerte diagnosefase.'],
    normTekst: 'Maximaal 1 week na akkoord op projectindicatie. Let op: tijdig inplannen.',
    normDagen: { aantal: 1, eenheid: 'weken' },
  },
  {
    nummer: '8',
    titel: 'Interne projectoverdracht',
    eigenaar: 'Sales',
    betrokkenen: ['Sales', 'Teamcoördinator', 'Projectleider + projectteam'],
    verantwoordelijkheden: [
      'Aftrappen van het proces "Opstarten en afsluiten implementatieproject".',
      'Formele overdracht van commercieel traject naar projectorganisatie.',
      'Bespreken van: verwachtingen klant, scope en uitgangspunten, risico\'s, openstaande commerciële afspraken, klantspecifieke informatie, verwachte planning.',
    ],
    output: ['Geaccepteerde projectoverdracht.', 'Benoemde projectleider.', 'Gereserveerd projectteam.'],
    belangrijk: 'Zonder overdracht start geen diagnosefase.',
    links: [
      {
        label: 'Subproces — Opstarten en afsluiten implementatieproject: 1. Diagnosefase (Confluence)',
        url: 'https://blisss.atlassian.net/wiki/spaces/CON/pages/2533556235/Subproces+-+Opstarten+en+afsluiten+Implementatieproject#1.-Diagnosefase',
      },
    ],
  },
  {
    nummer: '9',
    titel: 'Diagnosefase',
    eigenaar: 'Projectleider',
    betrokkenen: [
      'Projectleider',
      'Consultants',
      'Architect (indien nodig)',
      'Projectleider klant',
      'Key-users klant',
      'Teamcoördinator',
      'Sales (periodiek betrokken)',
    ],
    verantwoordelijkheden: [
      'Organiseren kick-off.',
      'Uitwerken van huidige en gewenste processen.',
      'Uitvoeren procesflow- en verdiepingssessies.',
      'Vastleggen van backlog in Jira.',
      'Opstellen ureninschattingen.',
      'Identificeren van risico\'s en afhankelijkheden.',
      'Voorbereiden projectorganisatie, planning en migratie-aanpak.',
    ],
    verantwoordelijkhedenSales: [
      'Periodiek contact onderhouden met klant en projectleider Blisss.',
      'Vinger aan de pols houden.',
      'Tijdig escaleren indien nodig.',
      'Aangesloten blijven richting aanbieding hoofdfase.',
    ],
    output: [
      'Procesflows.',
      'Backlog.',
      'Ureninschattingen.',
      'Agile budget.',
      'Concept planning.',
      'Risico-overzicht.',
      'Projectplan.',
    ],
    normTekst: 'Doorlooptijd circa 6 tot 8 weken.',
    normDagen: { aantal: 56, eenheid: 'dagen' },
  },
  {
    nummer: '10',
    titel: 'Projectplanpresentatie',
    eigenaar: 'Projectleider',
    betrokkenen: ['Projectleider', 'Sales', 'Opdrachtgever klant', 'Projectleider klant', 'Administratie'],
    verantwoordelijkheden: [
      'Presenteren van de resultaten van de diagnosefase.',
      'Toelichten van: scope, fasering, planning, budget, risico\'s, projectorganisatie, livegang-aanpak.',
      'Uitvoeren van sales control (7 dagen vóór projectplanpresentatie).',
    ],
    output: ['Akkoord op inhoudelijke uitwerking.'],
    goNoGo: 'Go/no-go hoofdfase: scope akkoord, budget akkoord, planning akkoord, beschikbaarheid akkoord.',
  },
  {
    nummer: '11',
    titel: 'Opstellen en versturen offerte hoofdfase',
    eigenaar: 'Sales',
    betrokkenen: ['Sales', 'Projectleider', 'Administratie'],
    verantwoordelijkheden: [
      'Vertalen van de diagnosefase naar een definitieve offerte voor de hoofdfase.',
      'Controleren van scope, budget, planning en uitgangspunten.',
      'Uitvoeren van sales control.',
      'Verzenden via DocuSign.',
    ],
    output: ['Getekende opdracht hoofdfase.'],
    normTekst: 'Maximaal 1 week na projectplanpresentatie.',
    normDagen: { aantal: 1, eenheid: 'weken' },
  },
  {
    nummer: '12',
    titel: 'Start-up fase',
    eigenaar: 'Projectleider',
    betrokkenen: ['Projectleider', 'Teamcoördinator', 'Projectteam', 'Projectleider en key-users klant'],
    verantwoordelijkheden: [
      'Starten van het proces "Opstarten en afsluiten implementatieproject" (hoofdfase).',
      'Organiseren kick-off.',
      'Opstellen sprintplanning.',
      'Inrichten projectstructuur.',
      'Vastleggen overlegstructuur.',
      'Vastleggen escalatieproces.',
      'Vastleggen verantwoordelijkheden.',
    ],
    output: ['Project gereed voor uitvoering.', 'Eerste sprint ingepland.'],
    links: [
      {
        label: 'Subproces — Opstarten en afsluiten implementatieproject: 2. Hoofdfase (Confluence)',
        url: 'https://blisss.atlassian.net/wiki/spaces/CON/pages/2533556235/Subproces+-+Opstarten+en+afsluiten+Implementatieproject#2.-Hoofdfase',
      },
    ],
  },
  {
    nummer: '13',
    titel: 'Implementatiefase',
    eigenaar: 'Projectleider',
    betrokkenen: ['Stuurgroep', 'Sales', 'CFO'],
    verantwoordelijkheden: [
      'Bewaken van scope.',
      'Bewaken van planning.',
      'Bewaken van budget.',
      'Aansturen projectteam.',
      'Organiseren sprintplanning, demo\'s en stuurgroepen.',
      'Maandelijkse bespreking Project Control (CFO – projectleider).',
    ],
    output: ['Succesvolle oplevering van sprints.'],
  },
  {
    nummer: '14',
    titel: 'Migratie, acceptatie en go-live voorbereiding',
    eigenaar: 'Projectleider',
    betrokkenen: [],
    verantwoordelijkheden: [
      'Uitvoering gebruikersacceptatietest.',
      'Migratievoorbereiding.',
      'Training eindgebruikers.',
      'Go-live checklist.',
      'Go/no-go besluitvorming.',
    ],
    goNoGo: 'Voorwaarden livegang: UAT akkoord, migratie getest, training afgerond, stuurgroep akkoord.',
    links: [
      {
        label: 'Subproces — Taken richting livegang (Confluence)',
        url: 'https://blisss.atlassian.net/wiki/spaces/CON/pages/2533556235/Subproces+-+Opstarten+en+afsluiten+Implementatieproject#2.2.-Taken-richting-livegang',
      },
    ],
  },
  {
    nummer: '15',
    titel: 'Livegang',
    eigenaar: 'Projectleider',
    betrokkenen: ['Sales (vinger aan de pols)'],
    verantwoordelijkheden: [
      'Coördinatie livegang.',
      'Escalatiemanagement.',
      'Afstemming met klant.',
      'Begeleiding projectteam.',
    ],
    output: ['Succesvolle ingebruikname van Business Central.'],
  },
  {
    nummer: '16',
    titel: 'Nazorg en overdracht support',
    eigenaar: 'Vaste consultant en/of teamcoördinator',
    betrokkenen: ['Consultant', 'Support', 'Klant'],
    verantwoordelijkheden: [
      'Stabiliseren van de oplossing.',
      'Afhandelen openstaande projectpunten.',
      'Concretiseren verwachtingen van klant / Blisss m.b.t. support.',
      'Formele overdracht naar support.',
      'Toelichting hoe support werkt.',
    ],
    output: ['Afgerond implementatieproject.', 'Overgenomen door supportorganisatie.'],
    links: [
      {
        label: 'Support optimalisaties (Confluence)',
        url: 'https://blisss.atlassian.net/wiki/spaces/CON/pages/1733951643/Support+optimalisaties',
      },
    ],
  },
];

export const STAP_DOOR_NUMMER = Object.fromEntries(STAPPEN.map((s) => [s.nummer, s]));

// Vlakke, geordende lijst van stapnummers zoals ze na elkaar volgen.
export const STAP_VOLGORDE = FASES.flatMap((f) => f.stappen);

export function volgendeStapNummer(nummer) {
  const idx = STAP_VOLGORDE.indexOf(nummer);
  if (idx === -1 || idx === STAP_VOLGORDE.length - 1) return null;
  return STAP_VOLGORDE[idx + 1];
}

export function vorigeStapNummer(nummer) {
  const idx = STAP_VOLGORDE.indexOf(nummer);
  if (idx <= 0) return null;
  return STAP_VOLGORDE[idx - 1];
}

export function verwachteDeadline(stap, ankerDatumIso) {
  if (!stap.normDagen || !ankerDatumIso) return null;
  const anker = new Date(ankerDatumIso);
  if (Number.isNaN(anker.getTime())) return null;
  const dagen = dagenInKalenderdagen(stap.normDagen);
  const deadline = new Date(anker.getTime());
  deadline.setDate(deadline.getDate() + dagen);
  return deadline.toISOString();
}
