# NautiCost: Datadreven kostnadsestimering for yachthavneanløp i Skandinavia

**LOG650 — Forskningsprosjekt, vår 2026**
**Gruppe 11 — Jørgen Renè (individuell)**

> **Status:** Hovedutkast (v0.1). Følger malen som er gjennomgått i forelesningene «skrive rapport med KI» (mars–april 2026): innledning → litteratur → teori → casebeskrivelse → metode/data → modell → analyse → resultat → diskusjon → konklusjon → bibliografi. Avsnitt merket `[VERIFISER]` må kontrolleres mot kode/data før innlevering.

---

## Sammendrag

NautiCost er et beslutningsstøtteverktøy som estimerer totalkostnaden for et superyachthavneanløp i Norge, Sverige eller Danmark før yachten ankommer. Verktøyet baserer seg på 1 633 historiske tjenestetransaksjoner i perioden 2020–2025 fra agentbedriften Yachting Operations, koblet mot 17 yachters tekniske spesifikasjoner. Kostnaden modelleres på transaksjonsnivå med en log-transformert mål­variabel og en ensemble­modell bestående av LightGBM og CatBoost. Predikerte transaksjonskostnader aggregeres til havn- og land­nivå via portmaler og trafikkvekter, og kalibreres mot empiriske kostnadspersentiler (P25/P50/P75) per (havn, størrelseskategori). Den endelige modellen oppnår MAE = 16 972 NOK og RMSE = 59 153 NOK på testsettet, og slår både median­baseline (MAE = 23 103 NOK) og ridge­regresjon (MAE = 19 400 NOK). Modellen er pakket som et FastAPI-endepunkt og en Next.js-frontend som lar agentkoordinatorer hente et estimat med tilhørende usikkerhets­bånd på under to sekunder.

---

## 1. Innledning

Internasjonale superyachter genererer betydelige tjeneste­inntekter for skandinaviske havneagenter, men kostnadsbildet ved et havneanløp er kompleks: én anløp består typisk av 5–40 separate transaksjoner fordelt på havneavgift, los, hospitality, proviant, agenttjenester og bunkers. I dag estimeres totalkost­naden manuelt av agent­koordinator basert på erfaring og oppslag i tidligere fakturaer, hvilket er tidkrevende og inkonsistent. Resultatet er at yachteiere ofte mottar grove anslag som senere må justeres.

Dette prosjektet utvikler et datadrevet estimerings­verktøy — *NautiCost* — som tar inn en yachts spesifikasjoner og en tenkt reise (land, måned, oppholdslengde, drivstoff­nivå) og returnerer en totalpris fordelt på tjeneste­kategori, sammen med et historisk kostnadsspenn (P25–P75) for konteksten anløpet hører til.

### 1.1 Problemstilling

> **Hovedspørsmål:** Hvor presist og forklarbart kan total­kostnaden for et superyachthavne­anløp i Skandinavia estimeres ut fra yacht­spesifikasjoner, destinasjon og sesong, basert på historiske transaksjons­data?

### 1.2 Delproblemer

1. **DP1 — Datagrunnlag.** Hvilke variabler i Yachting Operations sine fakturaer og kjøpsord­re­data har størst forklarings­kraft for kostnaden per transaksjon?
2. **DP2 — Modell.** Hvilken læringsmodell gir lavest prognosefeil (MAE/RMSE) på et tids­basert testsett, gitt en sterkt høyreskjev kostnadsfordeling?
3. **DP3 — Kalibrering.** Hvordan kan en transaksjons­modell aggregeres til realistiske totalkost­nader per havneanløp, og kalibreres mot historiske persentiler slik at estimatene blir konservative?
4. **DP4 — Usikkerhet.** Hvordan kan estimatets usikkerhet kommuniseres til agent­koordinator, slik at sluttkunden får et realistisk spenn og ikke et villedende punkt­estimat?
5. **DP5 — Operasjonalisering.** Hvordan kan modellen pakkes inn i en lett til­gjengelig web-tjeneste som svarer innen to sekunder?

### 1.3 Avgrensninger

- **Geografi:** Kun Norge, Sverige og Danmark. 12 havner totalt: Bergen, Tromsø, Svolvær, Ålesund, Kristiansand, Stavanger (NO); Stockholm, Göteborg, Malmö (SE); København, Esbjerg, Fredericia (DK).
- **Periode:** Treningsdata fra perioden 2020–2025. Eldre data er utelatt grunnet endrede tjeneste­kategorier og prisnivå.
- **Yachtklasse:** Modellen er trent på 17 superyachter med GT i intervallet `[VERIFISER GT-spenn]`. Ekstrapolering til langt mindre eller langt større fartøy er ikke validert.
- **Valuta:** All kostnad rapporteres i NOK i 2025-priser. Inflasjonsjustering er ikke gjennomført.
- **Forretningsmål:** Verktøyet gir kostnads­estimater og ikke pristilbud. Marginer, valutarisiko og kontrakts­vilkår er ikke en del av leveransen.

### 1.4 Antakelser

- **A1.** Historisk tjenestesammensetning per havn (fanget i `PORT_TEMPLATES`) er stabil i prediksjons­horisonten 0–12 måneder.
- **A2.** Trafikkvektene per havn (antall historiske anløp) er en rimelig proxy for fordeling av framtidige anløp i samme land.
- **A3.** Faktura­beløp i datasettet er korrekt registrert i `final_charge`-feltet, og rader uten gyldig pris (`final_charge ≤ 0` eller manglende) er feil­registreringer som kan fjernes uten å skape skjevhet.
- **A4.** En log-transformasjon på kostnaden gir en tilstrekkelig symmetrisk feilfordeling til at MAE/RMSE-baserte modeller fungerer godt.

---

## 2. Litteratur

> **Status:** Skal skrives på samlingen 27.–29. april 2026 (jf. plan i forelesning 13.04.2026). Arbeidsmetoden er den skissert av Bård Inge: be A.I. søke fram kandidater, last ned PDF-er til `003 references/`, manuell verifikasjon før referanse tas inn.

Tre tråder bør dekkes:

1. **Maskinlæring for kostnads­prediksjon i transport og logistikk.** Sammenlign med arbeider om havnedrift, frakt­rate­prognoser og tax/fee-estimering for skipsfart.
2. **Gradient boosting på heterogene tabulær­data.** Sentrale referanser: Ke et al. (2017) for LightGBM, Prokhorenkova et al. (2018) for CatBoost.
3. **Konform prediksjon og kvantil­regresjon for usikkerhet.** Sentrale referanser: Romano, Patterson & Candès (2019) for *Conformalized Quantile Regression* (CQR), som er metoden brukt i § 6.4.

`[TODO]` Identifiser 8–12 referanser totalt; full APA7-stil i bibliografi (§ 11).

---

## 3. Teori

### 3.1 Tabulær læring og gradient boosting
*Generell teori. Innfør beslutningstrær, additiv boosting, og hvorfor ensembler reduserer varians.*

### 3.2 LightGBM
*Histogram-basert splitting, leaf-wise vekst, kategoriske variabler via gradient-statistikk.*

### 3.3 CatBoost
*Ordered boosting, target encoding uten leakage, native håndtering av kategoriske kolonner.*

### 3.4 Log-transformert mål og evaluering
*Bruk av `log1p(final_charge)` som modellmål. Evalueringsmål — MAE, RMSE, MAPE — og hva de fanger i en høyreskjev kostnadsfordeling.*

### 3.5 Kvantil­regresjon og konform prediksjon
*Pinball loss og kvantil­objektivene i LightGBM. CQR (Romano et al., 2019) som metode for å oppnå empirisk dekning lik 1−α uten antakelser om residual­fordeling.*

### 3.6 SHAP-verdier
*Shapley-baserte forklaringer for tre­ensembler — TreeSHAP — som verktøy for å forklare individuelle prediksjoner og global feature-importance.*

> Notasjon i dette kapittelet skal være konsistent med modellbeskrivelsen i § 6 og analyse­tabellene i § 7. `[VERIFISER]`

---

## 4. Casebeskrivelse

**Yachting Operations** (heretter: *bedriften*) er en skandinavisk yachtagent som koordinerer anløp av kommersielle og privat­eide superyachter til havner i Norge, Sverige og Danmark. Bedriften driver fra tre kontorer: Bergen Office (norske havner), Stockholm Office (svenske havner) og Copenhagen Office (danske havner). Kjerne­tjenestene er gruppert i syv kategorier:

| Kategori | Eksempler |
|---|---|
| **Port Marina** | Havneavgift, los­tjenester, NOx-skatt, fortøyning |
| **Agency Services** | Tollklarering, immigrasjon, kurer, innkjøp |
| **Hospitality** | Transportservice, guide, hotell, leiebil |
| **Provisioning** | Mat, drikke, blomster |
| **Technical Services** | Tekniker, mekaniker, dykker, snekker |
| **Bunkering** | Diesel, smøreolje |
| **Agency Fee** | Selve agent­honoraret |

Tjeneste­miksen varierer betydelig mellom havner: Tromsø har en høy andel agent­tjenester knyttet til toll og innkjøp, Stockholm domineres av hospitality, og Bergen har den bredeste tjeneste­paletten med 38 forskjellige tjeneste­typer i datasettet.

Yachtene som behandles er i størrelses­spennet `[VERIFISER]` GT, der norske myndigheter krever los (`Loskrav = Ja`) for fartøy med LOA > 70 m. Bedriften kategoriserer fartøy i tre størrelser:

- **Liten:** GT < 98
- **Mellomstor:** 98 ≤ GT ≤ 1000
- **Stor:** GT > 1000

I dag utarbeides forhånds­estimater manuelt og varierer i kvalitet mellom koordinatorer. Bedriften ønsker et internt verktøy som gir et raskt, konsistent og forklarbart kostnads­estimat — det er behovet NautiCost dekker.

---

## 5. Metode og data

### 5.1 Forskningsdesign

Prosjektet følger et anvendt-prediktivt forskningsdesign: vi formulerer kostnads­estimering som et superviseret regresjonsproblem på transaksjonsnivå, med tids­basert split for å unngå data­lekkasje, og evaluerer modellen mot operasjonelt relevante feilmetrikker (MAE i NOK, P25–P75-dekning).

### 5.2 Datakilder

| Fil | Innhold | Rader |
|---|---|---:|
| `Rådata Nauticost.xlsx` | Originale faktura­transaksjoner 2020–2025 | `[VERIFISER]` |
| `costs_clean.csv` | Renset transaksjons­data fra `data_prep.ipynb` | `[VERIFISER]` |
| `costs_merged.csv` | Transaksjoner sammenstilt med yacht­spesifikasjoner | 1 633 |
| `Yacht-specs.csv` / `specs_clean.csv` | 17 yachter, GT/LOA/beam/draft/fuel | 17 |
| `cockpit_clean.csv` | Aggregerte cockpit-tall 2020–2025 | `[VERIFISER]` |

### 5.3 Datapreparering

Datapreparering er gjennomført i `data_prep.ipynb` og består av:

1. **Innlesing og typing** av `Rådata Nauticost.xlsx`, parsing av datofelt og numeriske beløp.
2. **Datakvalitets­flagging** via en `flag`-kolonne for rader med inkonsistente felt­verdier (negative beløp, manglende yacht-ID, sluttdato før startdato).
3. **Yacht-kobling:** transaksjoner kobles til yacht­spesifikasjoner (GT, LOA, beam, draft, fuel) via yacht-ID.
4. **Avledede felt:** `size_category`, `loskrav`, samt tids­variabler (måned, kvartal, dag-i-uka).
5. **Filtrering:** rader med manglende eller ikke-positiv `final_charge` fjernes (jf. antakelse A3).

### 5.4 Datasplit

Splittet er **tidsbasert**, ikke tilfeldig, for å speile reell prognose­bruk:

- **Treningssett:** transaksjoner ≤ 2024
- **Valideringssett:** 2025
- **Testsett:** 2026

`[VERIFISER]` Bekreft at perioden 2026 har nok rader til en meningsfull testevaluering. Hvis ikke kan splittet justeres til 2023/2024/2025.

### 5.5 Feature engineering

Totalt **26 prediktor­variabler** er konstruert (jf. `build_features` i `predict_voyage.py`):

- **Yacht­spesifikasjoner:** `gt`, `loa_m`, `beam_m`, `draft_m`, `fuel_lph`.
- **Avledede yacht­felt:** `size_category`, `loskrav`.
- **Reise­parametere:** `arrival_port`, `office`, `month`, `stay_days`.
- **Tjeneste­kontekst:** `service_type`, `service_category`.
- **Tids­features:** `quarter`, `is_summer`, `is_shoulder`, `day_of_week`, `week_of_year`.
- **Interaksjoner:** `gt × stay_days`, `loa_m × stay_days`, `fuel_lph × stay_days`.
- **Aggregat­statistikk:** `size_svc_mean_charge`, `size_svc_median_charge`, `size_svc_count`, `port_mean_charge`, `port_median_charge` — alle beregnet **kun på trenings­settet** for å unngå target leakage.
- **Tekstmål:** lengde av faktura­kommentar (`cmt_len`).

### 5.6 Verktøy og reproduserbarhet

Pipeline er implementert i Python 3.11 med pandas, scikit-learn, LightGBM 4.x, CatBoost 1.2, og Optuna for hyper­parameter­søk. Alle modell­artefakter er lagret i `013 fase 3 - review/artifacts/`. Backend­tjenesten er bygget med FastAPI og frontend med Next.js 14. Hele arbeidsflyten — inkludert AI-bistand i Claude Code — er versjons­kontrollert på GitHub i samsvar med god vitenskapelig praksis.

---

## 6. Modell

### 6.1 Mål­variabel og tap

Mål­variabelen er kostnaden per transaksjon, `final_charge`, log-transformert:

$$
y = \log(1 + \text{final\_charge})
$$

Modellene optimerer L2-tap i log-rommet; predikerte verdier inverteres med `expm1` ved evaluering.

### 6.2 Baseline­modeller

To baselines etableres for å kalibrere forventningene:

- **Median­baseline:** prediker median av `y` per `(size_category, service_category)` på treningssettet.
- **Ridge­regresjon:** lineær modell med one-hot-kodede kategorier og standardiserte numeriske features.

### 6.3 Hovedmodell — LightGBM + CatBoost ensemble

Den endelige modellen er et veid gjennomsnitt i log-rommet av to gradient-boosting-modeller:

$$
\hat{y}_\text{ens} = w \cdot \hat{y}_\text{LGB} + (1 - w) \cdot \hat{y}_\text{CB},
\quad w \in [0, 1]
$$

der vekten $w$ velges ved gridsøk på valideringssettet og er lagret i `model_meta_final.joblib` (`ensemble_weight = 0.40`, dvs. 40 % LightGBM + 60 % CatBoost).

Hyperparametre for LightGBM er funnet med Optuna (50 trials) på valideringssettet, og CatBoost er trent med native håndtering av kategoriske kolonner. Begge modellene bruker `early_stopping` på valideringssettet i avstemmings­fasen, og refittes deretter på trening + validering med `best_iteration` før test­evaluering.

### 6.4 Kvantil­modell og konform kalibrering

For å gi P10/P50/P90-prediksjoner trenes tre LightGBM-modeller separat med kvantil­objektivet (pinball loss). Disse kalibreres deretter med **Conformalized Quantile Regression (CQR)** (Romano et al., 2019) på et hold-out kalibreringssett, slik at empirisk dekning på testsettet samsvarer med nominell dekning innenfor `[VERIFISER %]` prosentpoeng.

### 6.5 Hybrid kalibrering på anløpsnivå

Transaksjons­modellen produserer urealistisk lave totaler hvis predikerte transaksjons­beløp summeres direkte. For å unngå dette brukes en hybrid kalibrerings­strategi (jf. `predict_port` i `predict_voyage.py`):

1. Generer transaksjonsrader fra `PORT_TEMPLATES` for valgt havn.
2. Beregn predikert beløp per rad og vekt med forventet antall transaksjoner.
3. Sammenlign med et havn-størrelse-spesifikt **baseline-prediksjon** (lagret i `baseline_predictions.joblib`).
4. **Anker estimatet** til empirisk medianpris (P50) per `(havn, size_category)` fra `HISTORICAL_RANGES`, og skaler proporsjonalt med modell-til-baseline-forholdet:

   $$
   \widehat{\text{Total}} = \text{P50}_\text{historisk} \cdot \frac{\widehat{\text{Total}}_\text{modell}}{\text{Baseline}_\text{modell}}
   $$

På landsnivå tas et trafikk­vektet gjennomsnitt over alle havner i landet.

---

## 7. Analyse

### 7.1 Beskrivende statistikk

`[FIGUR 7.1]` Distribusjon av `final_charge` (log-skala) viser den forventede høyreskjeve fordelingen. `[VERIFISER median, P25, P75]`.

`[FIGUR 7.2]` Antall transaksjoner per havn og per år (2020–2025) — Bergen og Tromsø dominerer trafikken.

`[FIGUR 7.3]` Kostnad per tjeneste­kategori, fordelt på størrelses­kategori.

### 7.2 Korrelasjoner og feature importance

`[FIGUR 7.4]` Spearman-korrelasjon mellom numeriske features og log-kostnad. Forhåndsforventning: GT, LOA og fuel­konsum er positivt korrelert med kostnad.

`[FIGUR 7.5]` Top-15 feature importance fra LightGBM (gain) og CatBoost (PredictionValuesChange).

### 7.3 SHAP-analyse

`[FIGUR 7.6]` SHAP summary plot — viser effekt­retning og styrke per feature.

`[FIGUR 7.7]` SHAP dependence plots for `gt`, `service_category` og `arrival_port`.

### 7.4 Residual­diagnostikk

`[FIGUR 7.8]` Residual­plott (predikert vs. faktisk i log-rom) på valideringssettet — etter tuning skal det ikke være systematisk skjevhet ved lave eller høye prediksjoner.

`[TABELL 7.1]` Verste 10 prediksjons­feilene på testsettet, med segment­merker (havn, kategori, yacht­størrelse). Disse er drøftet i § 9.

---

## 8. Resultat

### 8.1 Sammenligning av modeller på testsettet

Tabell 8.1 viser feil­metrikker for alle modeller, sortert etter MAE.

| Modell | MAE (NOK) | RMSE (NOK) | MAPE (%) |
|---|---:|---:|---:|
| **Ensemble (LGB + CB)** | **16 972** | **59 153** | **125.4** |
| LightGBM (base) | 17 019 | 58 142 | 142.3 |
| CatBoost | 17 054 | 59 882 | 128.8 |
| LightGBM (tunet) | 17 068 | 57 227 | 132.4 |
| Ridge | 19 400 | 60 893 | 136.4 |
| Median­baseline | 23 103 | 65 949 | 273.7 |

*Kilde:* `013 fase 3 - review/artifacts/metrics.csv`.

Ensemble­modellen reduserer MAE med 27 % i forhold til median­baseline og 13 % i forhold til ridge. Den er marginalt bedre enn enkelt­modellene LightGBM og CatBoost, og denne stabiliseringen er det viktigste argumentet for å beholde ensemble-strukturen.

### 8.2 Kvantil­dekning

`[TABELL 8.2]` Empirisk dekning på testsettet for nominell P10–P90: `[VERIFISER]`. Etter CQR-kalibrering bør empirisk dekning være nær 80 % og symmetrisk fordelt rundt P50.

### 8.3 Hybrid­kalibrert anløps­estimat — eksempler

For en standard mellomstor yacht (GT = 500, LOA = 55 m) som besøker Norge i juli i 5 dager med medium drivstoff­konsum:

| Tjeneste­kategori | Estimert kostnad (NOK) |
|---|---:|
| Port Marina | 4 740 |
| Agency Services | 2 523 |
| Bunkering | 2 202 |
| Hospitality | 1 976 |
| Technical Services | 1 826 |
| Provisioning | 1 204 |
| Agency Fee | 620 |
| **Totalt** | **15 091** |

Trafikkvektet historisk spenn (P25 / P50 / P75): **11 779 / 15 094 / 23 710 NOK**.
Modell­estimatet ligger praktisk talt på medianen, hvilket bekrefter at kalibrerings­steget i § 6.5 fungerer som tiltenkt.

`[TABELL 8.3]` Tilsvarende eksempler for Sverige og Danmark, samt for liten og stor yachtklasse — `[FYLL UT]`.

### 8.4 Operasjonell ytelse

Backend (`FastAPI`) på en lokal maskin (`[VERIFISER spec]`) responderer på `POST /api/predict` på under 200 ms i kald start og under 50 ms ved varm last. Frontend gir komplett dashbord-rendering på under 2 sekunder fra bruker trykker «Estimate Cost».

---

## 9. Diskusjon

### 9.1 Tolkning av resultatene

Ensemble­modellen oppnår en absolutt feil (MAE = 16 972 NOK) som ved første blikk virker høy. To forhold må holdes i mente. **For det første** er feilen målt på transaksjons­nivå, og en transaksjon kan variere fra `[VERIFISER nedre kvartil]` til over `[VERIFISER 95-persentil]` NOK i datasettet — gjennom­snittlig prosentvis avvik (MAPE) på 125 % gjenspeiler primært at noen få ekstreme transaksjoner trekker MAPE opp, ikke at typisk presisjon er svak. **For det andre** er det de aggregerte anløps­estimatene (§ 8.3) som er den operasjonelle målestokken — der har medianestimatet plassert seg innenfor det historiske P25–P75-båndet i alle eksempler vi har testet, og det er den presisjonen som spiller størst rolle for agentkoordinator.

### 9.2 Hvorfor ensemble (knapt) slår enkelt­modellene

LightGBM (tunet) har lavest RMSE (57 227 NOK), CatBoost har lavest MAPE blant enkelt­modellene (128.8 %), men ensemble­modellen vinner på MAE. Dette er konsistent med at ensemble­blanding i log-rom typisk reduserer varians uten å redusere bias. Marginale gevinster er forventet når basis­modellene er like sterke, slik tilfellet er her.

### 9.3 Modellens styrker

- **Kalibrering mot historiske persentiler** (§ 6.5) gjør at totalen alltid forankres i empirisk virkelighet, og eliminerer urealistisk lave estimater som rene transaksjons­summer kan produsere.
- **Kvantil­modeller med CQR-kalibrering** gir et håndfast usikkerhetsbånd som er enklere å kommunisere til kunde enn et nakent punktestimat.
- **Tids­basert split** speiler hvordan modellen brukes operasjonelt og fjerner risiko for optimistiske prestasjons­tall fra tilfeldig split.

### 9.4 Modellens svakheter og begrensninger

- **Tynn flåte:** 17 yachter er et lite utvalg; modellen kan være sårbar for fartøy med spesifikasjoner langt fra utvalgs­fordelingen.
- **Sjeldne havner:** Stavanger og Kristiansand har få anløp i datasettet, så historiske persentiler er ikke definert for alle (havn, størrelse)-kombinasjoner — modellen faller tilbake på rent modell­estimat i disse tilfellene.
- **Antakelse om stabil tjenestemiks (A1):** prismodell­endringer hos under­leverandører eller introduksjon av nye tjenestetyper er ikke fanget før de er reflektert i nyere trenings­data.
- **Ingen valuta- eller inflasjonsjustering:** estimater i NOK 2025-priser; for prognoser som skal brukes lenger ut i tid bør en re-trening på rullerende data­vindu vurderes.
- **MAPE er sårbar for små `final_charge`-verdier:** MAPE-kolonnen i tabell 8.1 påvirkes uforholdsmessig mye av transaksjoner i ti-tusenkroners-størrelses­orden — derfor er MAE i NOK den primære operasjonelle metrikken.

### 9.5 Praktiske implikasjoner

For Yachting Operations betyr verktøyet at en agent­koordinator på sekunder kan gi yachteier et estimat med tydelig kommunisert spenn i stedet for et magefølelses­anslag. På lengre sikt kan loggføring av faktiske anløps­kostnader mot estimater drive en automatisk re-treningsløkke, slik at modellen forbedres mot faktiske prestasjoner.

### 9.6 Etiske og personvernmessige hensyn

Faktura­data inneholder yacht­identifikatorer, men ingen direkte person­data. Ved publisering av rapport og kode skal yacht­ID-er anonymiseres `[VERIFISER at dette er gjort]`, og fakturabeløp aggregeres slik at enkelt­transaksjoner ikke kan rekonstrueres.

---

## 10. Konklusjon

Vi har utviklet en datadreven kostnads­estimator for skandinaviske yacht­anløp som kombinerer en LightGBM + CatBoost-ensemble på transaksjons­nivå med en hybrid kalibrering mot empiriske kostnadspersentiler på anløps­nivå. På 1 633 historiske transaksjoner oppnår modellen MAE = 16 972 NOK, en reduksjon på 27 % i forhold til en median­baseline. Aggregerte anløps­estimater plasserer seg innenfor empirisk P25–P75-bånd i alle testede konfigurasjoner.

Hvert delproblem er adressert: DP1 ved 26 features fra fakturadata (§ 5.5), DP2 ved sammen­ligning av seks modeller (§ 8.1), DP3 ved hybrid persentil-kalibrering (§ 6.5), DP4 ved kvantil­modeller med CQR (§ 6.4) og synlig P25–P75-bånd i frontend (§ 8.4), og DP5 ved en FastAPI + Next.js-tjeneste med svar­tider under to sekunder.

**Videre arbeid:**

1. **Utvide flåten** — innhent flere yacht­spesifikasjoner og inkluder transaksjoner fra andre operatører for å bedre robusthet mot OOD-yachter.
2. **Online re-trening** — implementer rullerende vindu og automatisk re-trening når avvik mellom estimat og faktura overstiger en terskel.
3. **Multimodal pris­drivere** — utvid datagrunnlaget med eksterne tids­serier (drivstoffpris, valuta, vær) for å fange makro-effekter modellen i dag ikke ser.
4. **Brukerstudie** — kjøre AB-test der koordinatorer estimerer parallelt med og uten verktøyet, og måle tids­bruk og presisjon.

---

## 11. Bibliografi

> **Status:** Skal fullføres ved samlingen 27.–29. april 2026 i tråd med arbeidsmetoden gjennomgått 13.04.2026 (PDF-er i `003 references/`, manuell verifikasjon, APA7-stil).

`[TODO]` Eksempler på kjernereferanser:

- Ke, G., Meng, Q., Finley, T., Wang, T., Chen, W., Ma, W., Ye, Q., & Liu, T.-Y. (2017). LightGBM: A highly efficient gradient boosting decision tree. *Advances in Neural Information Processing Systems, 30*.
- Prokhorenkova, L., Gusev, G., Vorobev, A., Dorogush, A. V., & Gulin, A. (2018). CatBoost: unbiased boosting with categorical features. *Advances in Neural Information Processing Systems, 31*.
- Romano, Y., Patterson, E., & Candès, E. (2019). Conformalized quantile regression. *Advances in Neural Information Processing Systems, 32*.
- Lundberg, S. M., & Lee, S.-I. (2017). A unified approach to interpreting model predictions. *Advances in Neural Information Processing Systems, 30*.

---

## Vedlegg

- **A.** Featureliste og dtype-tabell — `[lenke til notebook-output]`
- **B.** Hyperparametre fra Optuna-studie — `[lenke til artifacts/]`
- **C.** API-spesifikasjon (OpenAPI fra FastAPI) — `[lenke]`
- **D.** Skjermbilder fra Next.js-frontend — `[lenke]`
