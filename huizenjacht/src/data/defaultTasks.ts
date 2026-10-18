import type { Phase, Task } from '../domain/types'

// Gebaseerd op het aankoopproces volgens Rijksoverheid (checklist woning kopen),
// KNB/notaris.nl (koopcontract, bedenktijd, overdracht) en NHG. Peildatum 2026-10-07.

export const DEFAULT_PHASES: Phase[] = [
  { id: 'voorbereiding', name: 'Voorbereiding' },
  { id: 'zoeken', name: 'Zoeken & bezichtigen' },
  { id: 'bieden', name: 'Bieden' },
  { id: 'akkoord', name: 'Na akkoord' },
  { id: 'overdracht', name: 'Overdracht' },
  { id: 'daarna', name: 'Daarna' },
]

type Seed = [phaseId: string, title: string, info?: string]

const seeds: Seed[] = [
  // Voorbereiding
  ['voorbereiding', 'Budget bepalen', 'Maximale hypotheek berekenen (tab Hypotheek) én bepalen welke maandlast je comfortabel vindt.'],
  ['voorbereiding', 'Eigen geld op een rij', 'Kosten koper (meestal niet mee te financieren), eventueel overbieden boven taxatiewaarde, buffer. Denk aan schenking ouders.'],
  ['voorbereiding', 'BKR-registratie controleren', 'Gratis inzage via bkr.nl. Lopende kredieten en roodstand tellen mee.'],
  ['voorbereiding', 'Oriënterend gesprek hypotheekadviseur', 'Vaak gratis. Vraag naar kosten advies/bemiddeling (vast bedrag of uurtarief).'],
  ['voorbereiding', 'Document: geldig ID (paspoort/ID-kaart)'],
  ['voorbereiding', 'Document: recente loonstroken', 'Meestal de laatste 1–3 maanden.'],
  ['voorbereiding', 'Document: werkgeversverklaring', 'Niet ouder dan 3 maanden bij aanvraag. Intentieverklaring bij tijdelijk contract.'],
  ['voorbereiding', 'Document: jaaropgaven', 'Laatste jaaropgave(n) van werkgever(s).'],
  ['voorbereiding', 'Document: UWV-verzekeringsbericht', 'Downloaden via mijn.uwv.nl met DigiD.'],
  ['voorbereiding', 'Document: bankafschriften eigen geld', 'Om aan te tonen dat het eigen geld er is.'],
  ['voorbereiding', 'Document: overzicht studieschuld DUO', 'Via Mijn DUO: actuele schuld en maandbedrag.'],
  ['voorbereiding', 'Document: overzicht andere leningen', 'Persoonlijke lening, private lease, creditcard, roodstand.'],
  ['voorbereiding', 'Aankoopmakelaar: ja of nee kiezen', 'Een aankoopmakelaar helpt bij waardebepaling, bieden en de koopovereenkomst.'],

  // Zoeken & bezichtigen
  ['zoeken', 'Zoekprofielen aanmaken', 'Funda, Pararius, websites van lokale makelaars; meldingen aanzetten.'],
  ['zoeken', 'Wensen en eisen vastleggen', 'Tab Wensen invullen, zodat je huizen kunt scoren.'],
  ['zoeken', 'Bezichtigingen plannen', 'Neem de checklist mee: fundering, vocht, dak, kozijnen, cv-ketel, meterkast.'],
  ['zoeken', 'Buurt onderzoeken', 'Op verschillende tijden langsgaan; Leefbaarometer, Klimaateffectatlas, bestemmingsplan (Omgevingsloket).'],
  ['zoeken', 'Verkoopdocument: vragenlijst verkoper'],
  ['zoeken', 'Verkoopdocument: energielabel', 'Controleren op ep-online.nl.'],
  ['zoeken', 'Verkoopdocument: Kadaster/eigendomsbewijs', 'Eigendomsinformatie, erfpacht, erfdienstbaarheden en kwalitatieve verplichtingen.'],
  ['zoeken', 'Verkoopdocument: VvE-stukken en MJOP', 'Notulen laatste 3 jaar, jaarrekening, reservefonds, meerjarenonderhoudsplan, splitsingsakte.'],
  ['zoeken', 'Verkoopdocument: funderingsinformatie', 'Funderingslabel/-onderzoek; vooral bij houten palen of oudere bouw.'],
  ['zoeken', 'Verkoopdocument: bestemmingsplan/omgevingsplan', 'Wat mag er gebouwd worden in de omgeving?'],
  ['zoeken', 'WOZ-waarde en verkochte woningen in de buurt bekijken', 'WOZ-waardeloket en Kadaster/Funda voor referenties.'],

  // Bieden
  ['bieden', 'Biedstrategie en maximum bedrag bepalen'],
  ['bieden', 'Bod uitbrengen met voorwaarden', 'Ontbindende voorwaarden: financiering, bouwkundige keuring, eventueel NHG. Plus gewenste opleverdatum en roerende zaken.'],
  ['bieden', 'Koopovereenkomst controleren en tekenen', 'Let op data van ontbindende voorwaarden, bankgarantie en boeteclausule.'],
  ['bieden', '3 dagen wettelijke bedenktijd', 'Start de dag na ontvangst van de getekende koopovereenkomst; minimaal 2 werkdagen.'],
  ['bieden', 'Koopovereenkomst laten inschrijven (optioneel)', 'Inschrijven in de openbare registers via de notaris beschermt je tot de overdracht.'],

  // Na akkoord
  ['akkoord', 'Bouwkundige keuring laten uitvoeren', 'Binnen de termijn van de ontbindende voorwaarde.'],
  ['akkoord', 'Taxateur inschakelen (gevalideerd taxatierapport)', 'Taxateur via de geldverstrekker of adviseur; rapport wordt gevalideerd (NWWI/taxatievalidatie).'],
  ['akkoord', 'Hypotheekaanvraag indienen', 'Documenten uit de voorbereiding aanleveren.'],
  ['akkoord', 'Hypotheekofferte ontvangen en tekenen', 'Controleer rente, rentevaste periode, looptijd en geldigheid.'],
  ['akkoord', 'Ontbindende voorwaarde financiering: op tijd beslissen', 'Uiterlijk op de datum in de koopovereenkomst.'],
  ['akkoord', 'Bankgarantie of waarborgsom regelen', 'Meestal 10% van de koopsom, binnen de termijn in de koopovereenkomst.'],
  ['akkoord', 'Notaris kiezen en opdracht geven', 'Koper kiest de notaris; vraag offertes op.'],
  ['akkoord', 'Overlijdensrisicoverzekering afsluiten', 'Vaak verplicht bij hoge hypotheek t.o.v. woningwaarde.'],
  ['akkoord', 'Opstalverzekering afsluiten', 'Ingangsdatum: dag van overdracht.'],
  ['akkoord', 'Huur opzeggen (indien van toepassing)', 'Let op de opzegtermijn.'],

  // Overdracht
  ['overdracht', 'Concept-akten en nota van afrekening controleren'],
  ['overdracht', 'Eigen geld overmaken naar de notaris', 'Bedrag uit de nota van afrekening, op tijd overmaken.'],
  ['overdracht', 'Eindinspectie', 'Kort voor de overdracht: staat zoals afgesproken, meterstanden noteren.'],
  ['overdracht', 'Leveringsakte en hypotheekakte tekenen bij de notaris', 'Startersvrijstelling: verklaring overdrachtsbelasting tekenen.'],
  ['overdracht', 'Sleuteloverdracht'],

  // Daarna
  ['daarna', 'Inschrijven bij de gemeente', 'Verhuizing binnen 5 dagen na verhuizing doorgeven.'],
  ['daarna', 'Energie, water en internet regelen', 'Meterstanden doorgeven.'],
  ['daarna', 'Inboedelverzekering (aanpassen)'],
  ['daarna', 'Voorlopige aanslag aanvragen (maandelijks teruggave hypotheekrenteaftrek)', 'Via Mijn Belastingdienst.'],
  ['daarna', 'Aangifte eigen woning bij de inkomstenbelasting', 'In het jaar na aankoop; aftrekbare kosten (advies, taxatie, notaris hypotheekakte, NHG) meenemen.'],
  ['daarna', 'Adreswijziging doorgeven', 'Bank, verzekeringen, werkgever, abonnementen; postdoorstuurservice.'],
]

export function defaultTasks(): Task[] {
  return seeds.map(([phaseId, title, info], i) => ({
    id: `t-${phaseId}-${i}`,
    phaseId,
    title,
    info,
    status: 'todo',
  }))
}
