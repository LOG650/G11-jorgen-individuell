---
title: "Forsvarsforberedelse — NautiCost muntlig eksamen"
subtitle: "LOG650 Forskningsprosjekt, juni 2026 — Gruppe 11, Jørgen Rene"
author: "Forberedelse til muntlig eksamen"
date: "2026-05-13"
---

# Forsvarsforberedelse — NautiCost muntlig eksamen

**Formål:** Forberede konsise, dekkende svar på de mest sannsynlige sensor-spørsmålene basert på rapportens svakheter, peer review og kompendiet. Hvert spørsmål har stikkord-svar (30–60 sekunder muntlig), en lengre faglig begrunnelse, og referanse til rapportseksjonen der dette er dokumentert.

---

## 1. Datagrunnlag og generaliserbarhet

### Spørsmål 1.1 — "Hvor representativ er en flåte på 17 yachter?"

**Stikkord-svar (45 sek):** Begrenset, og det er prosjektets viktigste enkeltsvakhet. Modellen kan ha lært yacht-spesifikke mønstre fremfor generaliserbare prinsipper. Vi har gjort tre ting for å håndtere dette: (a) eksplisitt avgrensning i § 1.3, (b) tids­basert split som speiler reell prognose­bruk, og (c) hybrid persentil-kalibrering som forankrer estimatene i empirisk virkelighet. Videre arbeid punkt 1 er å utvide flåten.

**Faglig begrunnelse:** Med n = 17 enheter har vi et rad-til-yacht-forhold på ca. 96 transaksjoner per yacht. Det er nok til å lære moderate kostnads­drivere, men ikke til å validere at en 18. yacht — særlig med ny motor­konfigurasjon eller bruks­mønster — vil bli predikert nøyaktig. Ekstern validitet til andre yachter er den primære åpne kanten (§ 9.6).

**Rapport-ref:** § 1.3 avgrensninger, § 9.4 punkt 1, § 9.6 ekstern validitet, § 9.7.1 data­utfordringer.

### Spørsmål 1.2 — "Hvorfor er datasettet i EUR når brukerne er i Norge?"

**Stikkord-svar (30 sek):** SDK Shipping registrerer fakturaer i EUR — cockpit-rapportenes egne kolonneoverskrifter sier "EUR". Vi trener modellen i kildevaluta for å unngå dobbel valuta­konvertering, og lar frontend gange opp med kurs ved API-grensa. En tidligere v0.2-feil hadde merket output NOK, noe brukertesten avdekket og v0.3 fikset.

**Rapport-ref:** § 1.3 valuta, § 9.5.1 enhetsfeil, § 9.4 punkt 6.

### Spørsmål 1.3 — "Hva hvis en yacht har vesentlig andre spesifikasjoner enn de 17?"

**Stikkord-svar (30 sek):** Modellen vil predikere, men med større feil. Tre­ensemblet ekstrapolerer ikke lineært — det binder seg til den nærmeste partisjonen. For yachter langt utenfor GT-spennet 52–2 407 er prediksjonen ikke validert. Vi rapporterer P25–P75-spennet som usikkerhets­indikator, slik at brukeren ser når estimatet er bredt og dermed usikkert.

**Rapport-ref:** § 9.4 punkt 1, § 9.6 ekstern validitet.

---

## 2. Modellvalg og evaluering

### Spørsmål 2.1 — "Hvorfor velger dere ensemble når LightGBM-base presterer bedre på testsettet?"

**Stikkord-svar (60 sek):** Forskjellen er innenfor støy. Bootstrap-konfidensintervall på MAE-differansen er Δ = −33 ± 870 EUR — KI omslutter null, statistisk insignifikant. Vi velger ensemble på sekundære kriterier: (a) varians­robusthet ved drift i underliggende data, (b) Catboosts ordered boosting gir uavhengig induktiv bias som dekorrelerer feilene med LightGBMs leaf-wise vekst. Det er en forsikrings­begrunnelse, ikke en gevinst­begrunnelse — vi er ærlige om det.

**Rapport-ref:** § 8.1 (bootstrap-KI), § 9.2, § 9.4 punkt 9.

### Spørsmål 2.2 — "Hvorfor er Optuna-tunet modell dårligere enn base?"

**Stikkord-svar (45 sek):** Sannsynligvis overtilpasning til fold­strukturen i 5-fold CV på et lite valideringssett (n = 490). Bayes­optimering finner en hyperparameter-kombinasjon som er optimal for de spesifikke foldene, men ikke for et uavhengig testsett. Dette er et empirisk argument for å beholde base-modellen som fallback ved re-trening — noe vi rapporterer i § 9.2 og § 9.4 punkt 8.

**Rapport-ref:** § 8.1 (test-tall), § 9.2, § 9.4 punkt 8.

### Spørsmål 2.3 — "MAE på 19 000 EUR er nesten det dobbelte av medianfakturaen. Er det akseptabelt?"

**Stikkord-svar (60 sek):** Tre poenger. (a) MAE måles på transaksjons­nivå der enkelt­fakturaer varierer fra 2 000 til 91 000 EUR (P25–P95); en feil på 19 000 betyr at modellen treffer typiske store fakturaer godt, men bommer mer relativt på de små. (b) wMAPE = 74 % er volum­vektet og mer rettferdig — der ligger vi i nedre ende av sammenlignbare studier (Jang et al. rapporterer 65–75 %, Çerçi et al. 60–80 %). (c) Anløpsnivå er den operasjonelle målestokken, og alle fem testede konfigurasjoner i § 8.3 ligger innenfor P25–P75.

**Rapport-ref:** § 8.3, § 9.1 kvantitativ litteratur­sammenligning, § 9.4 punkt 16.

### Spørsmål 2.4 — "Modellen overpredikerer 18 % i log-rom. Hvorfor?"

**Stikkord-svar (45 sek):** Mean residual = −0,20 i log-rom betyr at modellen i snitt estimerer høyere enn faktisk. Bias-en er konsentrert i lave faktura­beløp (< 1 000 EUR) — typisk små Agency Services-fakturaer der modellen mangler tilstrekkelig signal til å predikere ned i dette beløpsspennet. På anløpsnivå dempes effekten fordi mange transaksjoner aggregeres og den hybride persentil-kalibreringen forankrer mot empirisk median. Bias-en er ærlig dokumentert i § 7.4 i stedet for skjult.

**Rapport-ref:** § 7.4 Figur 7.8.

### Spørsmål 2.5 — "Hvordan vet dere modellen ikke er overtilpasset?"

**Stikkord-svar (45 sek):** Vi har et uavhengig testsett (2025, n = 649) som aldri ble brukt i seleksjon. Generaliseringen viser +10 % MAE på test mot val — det er konsistent med litteraturen for tilsvarende oppgaver (Jang et al. rapporterer 8–12 % degradering). En overtilpasset modell ville ha vist 30–50 % degradering, ikke 10 %. Vi rapporterer også at Ridge eksploderer på test (RMSE 6× høyere) som kontrast — den modellen er overtilpasset til trenings­rangen.

**Rapport-ref:** § 8.1.1 Tabell 8.2.

### Spørsmål 2.6 — "Hvorfor ikke nevralt nett eller deep learning?"

**Stikkord-svar (45 sek):** Tre grunner. (a) Grinsztajn et al. (2022) og Shwartz-Ziv & Armon (2022) viser i uavhengige benchmarks at tre­ensembler dominerer nevrale nett på heterogene tabulære data i mellom­størrelse. (b) Kompendiet (Pettersen & Rekdal, 2026, tabell 1.1) foreskriver eksplisitt LightGBM/XGBoost for problemer med "Mange forklaringsvariabler". (c) Med n = 1 626 rader er datasettet for lite til at deep learning utnytter sin overlegne kapasitet — det er trebaserte modellers regime.

**Rapport-ref:** § 2.2, § 3.1, § 5.0.

---

## 3. Usikkerhet og konformprediksjon

### Spørsmål 3.1 — "Hva betyr 80 % dekning egentlig?"

**Stikkord-svar (60 sek):** Det er marginal dekning — over hele populasjonen vil 80 % av faktiske kostnader ligge innenfor P10–P90-båndet. Det betyr ikke at hver enkelt yacht har 80 % dekning. For Mellomstor-gruppen er reell dekning 74 % — der er båndet for smalt. Dette er CQR-teoriens forskjell mellom marginal og betinget dekning (Vovk et al., 2005; Romano et al., 2019), og en sentral begrensning vi løfter frem som ett av studiens bidragspunkter (§ 1.5 punkt ii).

**Rapport-ref:** § 6.4, § 8.2, § 9.2, § 9.4 punkt 15.

### Spørsmål 3.2 — "CQR-korreksjonen er bare 3 EUR. Er det riktig?"

**Stikkord-svar (30 sek):** Ja, og det er ikke fordi vi har valgt en triviell metode. Lavt korreksjons­behov betyr at de underliggende kvantil­modellene allerede er godt kalibrert — empirisk dekning på 79,8 % rå mot nominelt 80 %. CQR-garantien er fortsatt verdifull fordi den er distribusjons­fri og holder selv hvis fremtidige data drifter.

**Rapport-ref:** § 6.4, § 8.2.

---

## 4. Kalibrering og operasjonalisering

### Spørsmål 4.1 — "Hybrid kalibrering — er ikke det å snyte modellen?"

**Stikkord-svar (60 sek):** Nei, det er å forankre modellen i empirisk virkelighet. Rene transaksjons­summer kan produsere urealistisk lave totaler fordi få av P25-fakturaene følges av tilsvarende lave P25-er på andre transaksjoner. Vi ankrer mot empirisk medianpris per (havn, størrelse) og skalerer proporsjonalt med modellens forhold til en baseline-prediksjon. Dette gjør at totalen alltid har historisk basis. På anløpsnivå i § 8.3 plasserer alle fem eksempler seg innenfor P25–P75.

**Rapport-ref:** § 6.5 hybrid kalibrering, § 8.3 anløps-eksempler.

### Spørsmål 4.2 — "Hvorfor er los modellert som sannsynlighet når det er obligatorisk for store yachter?"

**Stikkord-svar (45 sek):** Det er en strukturell modellfeil vi har erkjent. `PORT_TEMPLATES` lærte historisk frekvens (17–73 % på tvers av havner) uten å betinge på LOA. Vi løste det operasjonelt ved å gjøre `pilot_cost` til obligatorisk API-input når `loskrav = "Ja"`. Den fundamentale fixen — størrelse-betingede sannsynligheter — er flagget som videre arbeid punkt 8. Mønsteret er kjent fra havne­effektivitets­litteraturen (Garrido Albarracín et al., 2024) der regulatoriske inngrep krever eksplisitte features.

**Rapport-ref:** § 9.5.2, § 9.4 punkt 10.

### Spørsmål 4.3 — "Hvorfor fjernet dere provisions-override?"

**Stikkord-svar (45 sek):** Metodisk konsistens. En override som *erstatter* modellens prediksjon med et magefølelses­tall introduserer en parallel mental modell utenfor verktøyets formål. For bunkers er overriden forsvarlig fordi den substitueres med en *deterministisk fysisk formel* (distanse × forbruk × pris). For Provisions finnes ingen tilsvarende deterministisk substitutt før `guest_experience` er observerbar. Provisions-feilen er en ærlig dokumentert begrensning som skal lukkes via labels + re-trening, ikke maskeres via UI.

**Rapport-ref:** § 9.5.7, § 9.5.4, Vedlegg E.

---

## 5. Validitet og forskningsdesign

### Spørsmål 5.1 — "Hva er den viktigste begrensningen i prosjektet?"

**Stikkord-svar (45 sek):** Dataen, ikke modellen. 17 yachter er strukturelt for få for sterk ekstern validitet, og `guest_experience` mangler som sentral kostnads­driver for Provisions. Modell­arkitekturen kan ikke kompensere for noen av disse — videre arbeid må gå i datainnsamlings­retning, ikke modell­retning. Vi rapporterer det åpent i § 9.4 punkt 1 og § 9.4 punkt 4.

**Rapport-ref:** § 9.4, § 9.6, § 9.7.1.

### Spørsmål 5.2 — "Generaliseres modellen til andre yacht-agenter?"

**Stikkord-svar (30 sek):** Nei, ikke validert. Modellen er trent kun på SDK Shipping sine fakturaer og lærer denne agentens spesifikke pris­modeller. Vi anbefaler ikke bruk hos en annen agent uten re-trening — § 9.6 ekstern validitet på operatør­nivå.

**Rapport-ref:** § 9.6.

### Spørsmål 5.3 — "Hva med konstrukt­validitet — er `final_charge` egentlig 'kostnad'?"

**Stikkord-svar (45 sek):** Bare delvis. `final_charge` er agentens fakturasum før moms — fanger agentens direkte tjeneste­kostnad + under­leverandørene, men ikke (a) udokumenterte rabatter, (b) yachteierens skjulte kostnader (egen besetnings­lønn, valutarisiko), eller (c) opportunitets­kostnad. Konstrukt­validiteten er en valid proxy for agentens fakturasum, men en partiell proxy for yachteierens totale anløps­kostnad. Brukere må legge til egne kostnader på toppen.

**Rapport-ref:** § 9.6 konstrukt­validitet.

### Spørsmål 5.4 — "Produksjons­modellen har ingen uavhengig holdout. Hvordan vet dere den fungerer?"

**Stikkord-svar (60 sek):** Korrekt, og vi rapporterer det åpent. Vi har test-set-evaluering for *prefit-modellen* (trent på ≤ 2023) som proxy for model­klassens generaliseringsevne. Produksjons­modellen (refittet på 2020–2025 inkludert test) har mer trenings­data, og forventes derfor å være minst like god, men ikke verifisert uavhengig. Dette er en strukturell konsekvens av tids­basert split kombinert med ønske om å deploye på all tilgjengelig data (Hastie, Tibshirani & Friedman, 2009, § 7.10). Lukkes når 2026-data er tilstrekkelig — videre arbeid punkt 10.

**Rapport-ref:** § 8.1.1, § 9.7.6.

---

## 6. Pensum-justering

### Spørsmål 6.1 — "Hvordan er prosjektet forankret i kompendiet?"

**Stikkord-svar (45 sek):** Kompendiet (Pettersen & Rekdal, 2026, tabell 1.1) klassifiserer problemer med "Mange forklaringsvariabler" under metodefamilien Random Forest / XGBoost / **LightGBM** med metodene gradient boosting, kryssvalidering, SHAP og hyperparameter­tuning. Vårt metodevalg — LightGBM + CatBoost ensemble, 5-fold CV ved Optuna, TreeSHAP, hyperparameter­tuning — er nøyaktig denne kombinasjonen. Vi følger også kompendiets femtrinns prosess (§ i.4) som er kallet ut eksplisitt i § 5.0.

**Rapport-ref:** § 2.2, § 5.0.

### Spørsmål 6.2 — "Hvilke av kompendiets prosess­steg adresserer dere?"

**Stikkord-svar (30 sek):** Alle fem. § 5.2–5.3 er steg 1 (datainnsamling), § 5.7 + § 7.4 er steg 2 (antakelses­sjekk), § 6.3–6.5 er steg 3 (løsning), § 8 er steg 4 (sjekk av løsning med val og test), og § 6.5 + § 8.4 + § 9.5 er steg 5 (anvendelse). Mappingen er tabellert i § 5.0.

**Rapport-ref:** § 5.0.

---

## 7. Peer review og prosess

### Spørsmål 7.1 — "Hvordan reagerte dere på peer review?"

**Stikkord-svar (45 sek):** G10/Julie ga 2026-05-07 syv konkrete forbedrings­punkter. Alle ble adressert i v0.4, og noen ble forsterket i v1.0. Eksempler: akademisk bidrag i § 1.5 omskrevet med tre eksplisitte hull; figurer henvist til notebooks ble eksportert som PNG og embedet; endelig testsett-evaluering (etterlyst som mangel) ble gjennomført med eget skript `eval_test_2025.py`. Hele responsen er tabellert i § 9.7.5.

**Rapport-ref:** § 9.7.5.

### Spørsmål 7.2 — "Hva har AI bidratt med, og hva har dere gjort selv?"

**Stikkord-svar (60 sek):** AI har bidratt med kode­generering, draft-skriving av prosa-avsnitt, litteratur­søk, og figur­produksjon. Vi har gjort: valg av problemstilling, vurdert hvilke metoder som er pensum­forankret, sparret iterativt om struktur, kritisk vurdert AI-genererte forslag (f.eks. avvist provisions-override og forkastet uvalidert Shadish, Cook & Campbell-referanse), kvalitetssikret hver referanse mot Google Scholar, og foretatt alle metodiske avveininger (CQR vs. standard konform, hybrid kalibrering vs. rene transaksjons­summer, ensemble­valg). AI gjorde grovarbeidet; vi gjorde de faglige vurderingene. Dette samsvarer med kompendiets rollefordeling (§ iii.1).

---

## 8. Etiske og praktiske spørsmål

### Spørsmål 8.1 — "Hva med personvern?"

**Stikkord-svar (30 sek):** Ingen direkte personopplysninger i datasettet. Yacht-ID-er er anonymisert (`yacht_1`, ..., `yacht_19`). Kontornavn beholdt fordi de er offentlig kjente lokasjoner. Fakturabeløp i rapporten er aggregert per persentil eller havn.

**Rapport-ref:** § 9.9 etiske hensyn.

### Spørsmål 8.2 — "Hva er nettoverdien for SDK Shipping?"

**Stikkord-svar (45 sek):** Verktøyet gjør at en agent­koordinator kan gi yachteier et estimat på sekunder med kommunisert spenn — i stedet for et magefølelses­anslag som tar minutter og er inkonsistent mellom koordinatorer. På sikt kan logging av faktura mot estimat drive automatisk re-trening. Forecast-funksjonen svarer på forretningsspørsmål som "30 yachter neste år, hvilken inntekt?". Krav er at brukeren forstår at det er estimater, ikke pristilbud.

**Rapport-ref:** § 9.8.

---

## 9. Konklusjon-spørsmål

### Spørsmål 9.1 — "Hva er studiens viktigste bidrag?"

**Stikkord-svar (45 sek):** Tre bidrag (jf. § 1.5). (a) En **transaksjonsnivå-ensemble­modell med trafikkvektet aggregering og hybrid persentil­kalibrering** som fungerer i et lite, høyt­skjevt regime (n ≈ 1 600, 17 enheter) — utvider litteraturen ned i datasparsomme størrelses­ordener. (b) En **empirisk dokumentasjon av forskjellen mellom marginal og betinget CQR-dekning** når en sentral kostnads­driver er u­observert. (c) Et **metodisk mønster** for hvordan tabulære ML-modeller møter operasjonell virkelighet i regulerte bransjer (kombinasjon av lærte features, obligatoriske brukerinputs, og deterministiske formler).

**Rapport-ref:** § 1.5, § 9.7.7, § 10.

### Spørsmål 9.2 — "Hvis dere skulle starte på nytt, hva ville dere gjort annerledes?"

**Stikkord-svar (60 sek):** Tre ting. (a) **Starte med `guest_experience`-rubrikken**, ikke vente til brukertesten avdekket gapet. (b) **Logge `distance_nm` per leg** fra dag én, slik at bunkers kunne vært feature i stedet for override-formel. (c) **Skille mellom Norge/Sverige/Danmark i aggregat-features** fra start (jf. § 9.5.5), slik at land­signalet ikke gikk tapt i `size_svc_*`-statistikkene. Tilstanden er nå at vi har et fungerende verktøy med ærlig dokumenterte begrensninger — fremtidig arbeid vet nøyaktig hvor de skal grave.

**Rapport-ref:** § 9.5, § 9.7.

---

## 10. Stikkord-arsenal for åpne diskusjoner

Forsvarspunkter du sannsynligvis vil trekke fram uansett spørsmål:

- **Pensum-forankret:** Pettersen & Rekdal (2026) tabell 1.1 foreskriver eksplisitt LightGBM + gradient boosting + CV + SHAP + tuning. Vi følger dette nøyaktig.
- **Ærlighet om svakheter:** 16-punkts § 9.4 og § 9.7-refleksjon viser kritisk modenhet. Sjeldent at master­rapporter er så åpne om hva som *ikke* ble løst.
- **Operasjonelt verifisert:** § 8.4 — backend < 200 ms kald, < 50 ms varm; dashboard < 2 sek.
- **Test-sett-verifisert:** Endelig generalisering på 649 transaksjoner fra 2025 viser +10 % MAE (forventet etter modell­seleksjon), ikke katastrofalt fall.
- **Peer review-respons:** Alle syv punkter fra G10/Julie er adressert.
- **Reproduserbarhet:** `eval_test_2025.py`, `generate_figures.py`, `convert_to_word.py` gjør rapportens tall og figurer reproduserbare fra git.
- **Litteratur-sammenligning:** Våre wMAPE-tall (71–74 %) ligger i nedre ende av Jang et al. (2023) og Çerçi et al. (2024).

---

*Versjon: 2026-05-13. Skrevet som forberedelse til muntlig eksamen juni 2026.*
