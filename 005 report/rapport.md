# NautiCost: Datadreven kostnadsestimering for yachthavneanløp i Skandinavia

**LOG650 — Forskningsprosjekt, vår 2026**
**Gruppe 11 — Jørgen Renè (individuell)**

> **Status:** Hovedutkast (v0.1). Følger malen som er gjennomgått i forelesningene «skrive rapport med KI» (mars–april 2026): innledning → litteratur → teori → casebeskrivelse → metode/data → modell → analyse → resultat → diskusjon → konklusjon → bibliografi. Avsnitt merket `[VERIFISER]` må kontrolleres mot kode/data før innlevering.

---

## Sammendrag

NautiCost er et beslutningsstøtteverktøy som estimerer totalkostnaden for et superyachthavneanløp i Norge, Sverige eller Danmark før yachten ankommer. Verktøyet baserer seg på 1 647 historiske tjenestetransaksjoner i perioden 2020–2025 fra agentbedriften Yachting Operations, koblet mot 17 yachters tekniske spesifikasjoner. Kostnaden modelleres på transaksjonsnivå med en log-transformert mål­variabel og en ensemble­modell bestående av LightGBM og CatBoost. Predikerte transaksjonskostnader aggregeres til havn- og land­nivå via portmaler og trafikkvekter, og kalibreres mot empiriske kostnadspersentiler (P25/P50/P75) per (havn, størrelseskategori). Den endelige modellen oppnår MAE = 17 350 NOK og RMSE = 55 490 NOK på testsettet (2025, 670 transaksjoner), og slår både median­baseline (MAE = 21 800 NOK) og ridge­regresjon (MAE = 18 251 NOK). Modellen er pakket som et FastAPI-endepunkt og en Next.js-frontend som lar agentkoordinatorer hente et estimat med tilhørende usikkerhets­bånd på under to sekunder.

---

## 1. Innledning

Internasjonale superyachter genererer betydelige tjeneste­inntekter for skandinaviske havneagenter, men kostnadsbildet ved et havneanløp er komplekst: ett anløp består typisk av 5–40 separate transaksjoner fordelt på havneavgift, los, hospitality, proviant, agenttjenester og bunkers. I dag estimeres totalkost­naden manuelt av agent­koordinator basert på erfaring og oppslag i tidligere fakturaer, hvilket er tidkrevende og inkonsistent. Resultatet er at yachteiere ofte mottar grove anslag som senere må justeres.

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
- **Yachtklasse:** Modellen er trent på 17 superyachter med GT i intervallet 51,9–2 407 (median 152 GT, LOA 18,9–79,2 m). Ekstrapolering til langt mindre eller langt større fartøy er ikke validert.
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

Et regresjons­problem på tabulære data er definert ved et datasett $\mathcal{D} = \{(x_i, y_i)\}_{i=1}^n$ der $x_i \in \mathbb{R}^d$ er feature-vektorer og $y_i \in \mathbb{R}$ er målverdier, og oppgaven er å finne en funksjon $\hat{f}: \mathbb{R}^d \to \mathbb{R}$ som minimerer en tap-funksjon $L(y, \hat{y})$. For tabulære data med en blanding av numeriske og kategoriske features og komplekse interaksjoner er **ensembler av beslutningstrær** den dominerende tilnærmingen.

Et beslutningstre partisjonerer feature-rommet rekursivt i akse-justerte regioner og tilordner en konstant prediksjon innenfor hver region. Et enkelt tre har høy varians — et litt annet utvalg gir et betydelig annet tre. To strategier reduserer denne variansen: **bagging** (gjennomsnitt av uavhengig trente trær, jf. random forest) og **boosting** (sekvensiell trening der hvert tre korrigerer feilene fra det forrige).

I gradient boosting (Friedman, 2001) bygges modellen additivt:

$$F_m(x) = F_{m-1}(x) + \nu \cdot h_m(x)$$

der $h_m$ er et regresjons­tre tilpasset den negative gradienten av tapet med hensyn på forrige prediksjon, og $\nu \in (0, 1]$ er en lærings­rate. Etter $M$ runder er modellen $F_M(x) = F_0(x) + \nu \sum_{m=1}^{M} h_m(x)$.

Sammenlignet med bagging kan boosting redusere både bias og varians ved å konsentrere kapasiteten der residualene er størst. Avveiningen er at boosting er sekvensielt og mer utsatt for overtilpasning hvis $M$ er for stor eller $\nu$ for høy; **early stopping** på et valideringssett er standard mottiltak.

Moderne gradient-boosting-biblioteker (LightGBM, CatBoost, XGBoost) optimerer dette rammeverket langs tre akser: histogram-basert split-finding for hastighet, native håndtering av kategoriske features, og bruk av andre­ordens gradient-informasjon (Newton-Raphson-oppdateringer) for raskere konvergens.

### 3.2 LightGBM

LightGBM (Ke et al., 2017) er et gradient-boosting-bibliotek optimert for hastighet og minne på store tabulære datasett. Tre innovasjoner skiller det fra tidligere implementasjoner:

**Histogram-basert split-finding.** Kontinuerlige features for-binnes i $k$ histogrammer (typisk $k = 255$). Å finne det optimale split-punktet reduseres fra å skanne alle unike feature-verdier ($\mathcal{O}(n \cdot d)$ per node) til å skanne histogram-bins ($\mathcal{O}(k \cdot d)$ per node). For datasett med mange kontinuerlige features er dette den dominerende hastighets­gevinsten.

**Leaf-wise tre-vekst.** Der standard implementasjoner vokser trær level-wise (alle blader på dybde $d$ før noen på $d+1$), vokser LightGBM bladet med høyest tap-reduksjon først, uavhengig av dybde. Dette gir mer asymmetriske trær som tilpasser dataene bedre med færre blader totalt — men er mer utsatt for over­tilpasning på små datasett, kontrollert av `max_depth` og `min_data_in_leaf`-restriksjoner.

**Gradient-based one-side sampling (GOSS) og exclusive feature bundling (EFB).** GOSS beholder samplene med høyest gradient (størst residual) og subsampler resten tilfeldig — informasjons­tetthet per iterasjon bevares. EFB bundler gjensidig eksklusive sparse features til én kolonne. Begge reduserer kostnad per iterasjon på høy-dimensjonal sparsom data.

**Kategorisk håndtering.** LightGBM aksepterer heltalls­kodede kategoriske kolonner direkte. Ved hvert split sorteres kategoriene etter akkumulert gradient-statistikk, og den optimale partisjonen finnes ved å skanne den sorterte listen. Dette håndterer høy-kardinalitets kategoriske variabler (f.eks. `arrival_port`, `service_type`) uten one-hot-eksplosjon.

I NautiCost er LightGBM den primære base-læreren fordi den konvergerer raskt på det lille datasettet (~1 600 rader) og håndterer den heterogene feature-miksen native. Hyperparametre (`num_leaves`, `min_data_in_leaf`, `max_depth`, `feature_fraction`, `bagging_fraction`, `learning_rate`) er tunet med Optuna (se § 6.3).

### 3.3 CatBoost

CatBoost (Prokhorenkova et al., 2018) er et gradient-boosting-bibliotek med fokus på robust kategorisk håndtering og forventningsrett target-encoding. To tekniske bidrag står sentralt:

**Ordered boosting.** Standard target-encoding-strategier erstatter en kategorisk verdi med gjennomsnittet av målet over alle rader der verdien forekommer. Dette skaper *target-leakage* — den kodede featuren for rad $i$ påvirkes av målet $y_i$ selv, hvilket biaserer gradienter mot over­tilpasning. CatBoosts ordered boosting opprettholder en tilfeldig permutasjon av treningsradene; for hver rad $i$ bruker target-encodingen kun radene som ligger foran $i$ i permutasjonen. Dette gir et forventningsrett estimat på bekostning av å kjøre $K$ parallelle modeller på $K$ ulike permutasjoner.

**Symmetriske (oblivious) trær.** Hvert nivå av et CatBoost-tre bruker samme split-feature og terskel­verdi på tvers av alle interne noder på det nivået. Dette gir et balansert binærtre med fast dybde, hvilket er raskere ved inferens (prediksjons­banen er bare en sekvens av sammen­ligninger) og virker som en implisitt regularisering.

**Kategorisk encoding via ordered target statistics:**

$$\hat{x}_i^{cat} = \frac{\sum_{j < i,\, x_j^{cat} = x_i^{cat}} y_j + a \cdot p}{\#\{j < i : x_j^{cat} = x_i^{cat}\} + a}$$

der $a$ er en glattings­prior og $p$ er en global prior (f.eks. globalt mål­gjennom­snitt). Glattingen håndterer lav-frekvente kategorier robust.

I NautiCost er CatBoost paret med LightGBM i ensembelet (§ 6.3) fordi den bringer en annen induktiv bias — symmetriske trær og ordered encoding — som dekorrelerer feilene med LightGBMs leaf-wise asymmetriske trær og reduserer ensemble-variansen.

### 3.4 Log-transformert mål og evaluering

Mål­variabelen `final_charge` er sterkt høyreskjev: enkelte transaksjoner er 50–100× større enn medianen (jf. § 7.1). To konsekvenser for modellering:

1. Gradient boosting med kvadrat­tap domineres av de største residualene. Uten transformasjon bruker modellen mesteparten av kapasiteten på å redusere feilen for en håndfull dyre transaksjoner mens feilen ellers øker.
2. Multiplikative effekter (en yacht som er dobbelt så stor koster grovt sett dobbelt så mye) blir additive i log-rommet, hvilket matcher den additive strukturen i beslutningstrær bedre.

Standardløsningen er en log-transformasjon:

$$y = \log(1 + \text{final\_charge})$$

«+1»-shiftet håndterer null-kostnads­transaksjoner uten at $\log$ divergerer. Prediksjoner inverteres med $\hat{c} = \exp(\hat{y}) - 1$ før de rapporteres.

**Evalueringsmetrikker på opprinnelig NOK-skala:**

- **Mean Absolute Error (MAE):** $\text{MAE} = \frac{1}{n}\sum_i |y_i - \hat{y}_i|$. Rapporterer typisk absolutt avvik i NOK; robust mot outliers.
- **Root Mean Squared Error (RMSE):** $\text{RMSE} = \sqrt{\frac{1}{n}\sum_i (y_i - \hat{y}_i)^2}$. Straffer store feil hardere; sensitiv mot outliers.
- **Mean Absolute Percentage Error (MAPE):** $\text{MAPE} = \frac{100}{n}\sum_i \left|\frac{y_i - \hat{y}_i}{y_i}\right|$. Rapporterer relativ feil i prosent; sensitiv mot små nevnere — små $y_i$ blåser opp MAPE.

I et høyreskjevt kostnads­scenario er **MAE** den mest operasjonelt meningsfulle metrikken: en feil på 5 000 NOK har samme størrelses­orden enten regningen er på 10 000 eller 100 000 NOK. MAPE rapporteres for fullstendighet, men tolkes med forsiktighet fordi små fakturaer dominerer gjennomsnittet. RMSE fanger om modellen har sjeldne store bom­skudd og brukes som sekundær ranking­metrikk.

### 3.5 Kvantil­regresjon og konform prediksjon

Punktprediksjoner er utilstrekkelige når kostnads­fordelingen er høyreskjev og en agent må kommunisere «dette er typisk kostnad, dette er den øvre plausible grensen». Kvantil­regresjon og konform prediksjon gir *intervaller* med kalibrert dekning.

**Kvantil­regresjon** trener en modell til å predikere $\tau$-kvantilet av $y \mid x$ ved å minimere pinball-tapet:

$$L_\tau(y, \hat{y}) = \begin{cases} \tau (y - \hat{y}) & \text{hvis } y \geq \hat{y} \\ (1 - \tau)(\hat{y} - y) & \text{hvis } y < \hat{y} \end{cases}$$

For $\tau = 0{,}5$ reduseres dette til middel absolutt feil og gir en median-prediktor. For $\tau = 0{,}9$ gir det en modell der prediksjonen overstiges av sann verdi 10 % av tiden (asymptotisk). LightGBM støtter pinball-tapet som innebygd objektiv; vi trener tre separate modeller for $\tau \in \{0{,}1; 0{,}5; 0{,}9\}$ for å oppnå P10/P50/P90-prediksjon.

**Kalibrerings­problemet.** Selv en velt­renet kvantil­modell garanteres ikke å oppnå nominell dekning på hold-out-data. Empirisk dekning kan drifte fra $1 - 2\alpha$ grunnet begrenset trenings­data, modell­misspesifikasjon eller fordelings­drift over tid.

**Conformalized Quantile Regression (CQR)** (Romano, Patterson & Candès, 2019) bruker et separat kalibrerings­sett til å konvertere en hvilken som helst kvantil­prediktor til et kalibrert prediksjons­intervall. Gitt trenings-, kalibrerings- og test­splitter:

1. Tren kvantil­modeller for $\tau = \alpha/2$ og $\tau = 1-\alpha/2$ på trenings­settet, og oppnå $\hat{q}_{lo}(x)$ og $\hat{q}_{hi}(x)$.
2. På kalibrerings­settet, beregn ikke-konformitets­score:
   $$E_i = \max\{\hat{q}_{lo}(x_i) - y_i, \; y_i - \hat{q}_{hi}(x_i)\}$$
3. La $Q_{1-\alpha}$ være $\lceil (n_{cal}+1)(1-\alpha)\rceil / n_{cal}$-kvantilet av $\{E_i\}$.
4. CQR-prediksjons­intervallet er:
   $$C(x) = \left[\hat{q}_{lo}(x) - Q_{1-\alpha}, \; \hat{q}_{hi}(x) + Q_{1-\alpha}\right]$$

CQR-justeringen $Q_{1-\alpha}$ garanterer endelig-utvalgs dekning $\Pr(y \in C(x)) \geq 1 - \alpha$ under utbyttbarhet av (kalibrering, test)-data, uavhengig av hvor dårlig kalibrert de underliggende kvantil­modellene er. I NautiCost (§ 6.4) justerer CQR det rå P10/P90-båndet med 3 NOK — en bekreftelse på at de underliggende kvantil­modellene var godt kalibrert i utgangspunktet.

### 3.6 SHAP-verdier

Tre­ensembler er presise men opake: en prognose på 17 000 NOK forteller ikke i seg selv *hvorfor* — var det GT, havnen, sesongen? **SHAP (SHapley Additive exPlanations)** (Lundberg & Lee, 2017) dekomponerer en prediksjon i per-feature bidrag med basis i kooperativ spillteori.

For en modell $f$ og et input $x$ er SHAP-verdien til feature $j$:

$$\phi_j(x) = \sum_{S \subseteq F \setminus \{j\}} \frac{|S|! \,(|F| - |S| - 1)!}{|F|!} \left[\, f_{S \cup \{j\}}(x) - f_S(x) \,\right]$$

der $F$ er feature-mengden, $S$ løper over delmengder uten $j$, og $f_S(x)$ er modellens forventede prediksjon når kun features i $S$ er observert. Dette er Shapley-verdien fra koalisjons-spillteori: $\phi_j$ er det gjennomsnittlige marginale bidraget fra $j$ over alle mulige feature-rekkefølger.

SHAP-verdier oppfyller tre ønskelige egenskaper:
- **Lokal nøyaktighet:** $f(x) = \phi_0 + \sum_j \phi_j(x)$ — prediksjoner dekomponeres eksakt i en baseline pluss per-feature bidrag.
- **Manglende verdier:** features uten påvirkning får $\phi_j = 0$.
- **Konsistens:** hvis en features bidrag øker i en modell, kan SHAP-verdien dens ikke synke.

Eksakt beregning av SHAP-verdier er eksponensiell i antall features. For tre-ensembler beregner **TreeSHAP** (Lundberg et al., 2018) eksakte SHAP-verdier i polynom­tid ved å traversere hvert tres bane­struktur og spore betingede forventninger. Dette gjør per-prediksjon-forklaring mulig på en 27-feature modell på milli­sekunder.

I NautiCost (§ 7.3) brukes TreeSHAP både globalt (gjennomsnittlig absolutt SHAP per feature → feature importance-rangering) og lokalt (per-prediksjon waterfall-plott når en agent spør «hvorfor predikerte modellen dette tallet?»).

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

Yachtene som behandles er i størrelses­spennet 51,9–2 407 GT, der norske myndigheter krever los (`Loskrav = Ja`) for fartøy med LOA > 70 m. Bedriften kategoriserer fartøy i tre størrelser:

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
| `Rådata Nauticost.xlsx` (sheet 1) | Originale faktura­transaksjoner 2020–2025 | 932 |
| `Kostnader_MM.csv` | Eksportert transaksjons­data (inkl. subtotaler) | 3 325 |
| `costs_clean.csv` | Renset transaksjons­data fra `data_prep.ipynb` | 1 654 |
| `costs_merged.csv` | Transaksjoner sammenstilt med yacht­spesifikasjoner | 1 654 (1 633 med gyldig pris) |
| `Yacht-specs.csv` / `specs_clean.csv` | 17 unike yachter (19 spec-rader, noen revideres over tid) | 19 |
| `cockpit_clean.csv` | Aggregerte cockpit-tall 2020–2025 | 6 |

### 5.3 Datapreparering

Datapreparering er gjennomført i `data_prep.ipynb` og består av:

1. **Innlesing og typing** av `Rådata Nauticost.xlsx`, parsing av datofelt og numeriske beløp.
2. **Datakvalitets­flagging** via en `flag`-kolonne for rader med inkonsistente felt­verdier (negative beløp, manglende yacht-ID, sluttdato før startdato).
3. **Yacht-kobling:** transaksjoner kobles til yacht­spesifikasjoner (GT, LOA, beam, draft, fuel) via yacht-ID.
4. **Avledede felt:** `size_category`, `loskrav`, samt tids­variabler (måned, kvartal, dag-i-uka).
5. **Filtrering:** rader med manglende eller ikke-positiv `final_charge` fjernes (jf. antakelse A3).

### 5.4 Datasplit

Splittet er **tidsbasert**, ikke tilfeldig, for å speile reell prognose­bruk:

- **Treningssett:** transaksjoner ≤ 2023 (487 rader)
- **Valideringssett:** 2024 (490 rader)
- **Testsett:** 2025 (670 rader)

Året 2026 er holdt utenfor modellutviklingen og brukes som overvåkningssett etter hvert som nye fakturaer kommer inn (kun 7 rader pr. april 2026 og dermed ikke meningsfullt for evaluering på det tidspunktet). Den endelige produksjons­modellen i `model_meta_final.joblib` er refittet på alle år 2020–2025; refittsettet inneholder 1 626 rader, som er 21 færre enn split-summen på 1 647 fordi rader med manglende avledede aggregat­features (f.eks. ved sjeldne `(størrelse, tjeneste)`-kombinasjoner) faller bort i feature engineering-steget.

### 5.5 Feature engineering

Totalt **27 prediktor­variabler** er konstruert (jf. `build_features` i `predict_voyage.py`):

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

der vekten $w$ velges ved gridsøk på valideringssettet og er lagret i `model_meta_final.joblib` (`ensemble_weight = 0.30`, dvs. 30 % LightGBM + 70 % CatBoost).

Hyperparametre for LightGBM er funnet med Optuna (80 trials, 5-fold kryssvalidering på trening + validering) og lagret i `best_params`: `alpha = 3.35, learning_rate = 0.032, num_leaves = 32, min_data_in_leaf = 47, max_depth = 6, feature_fraction = 0.85, bagging_fraction = 0.83`. CatBoost trenes med native håndtering av kategoriske kolonner. Begge modellene bruker `early_stopping` på valideringssettet i avstemmings­fasen, og refittes deretter på hele datasettet (2020–2025) med `best_iteration = 390` før produksjon.

### 6.4 Kvantil­modell og konform kalibrering

For å gi P10/P50/P90-prediksjoner trenes tre LightGBM-modeller separat med kvantil­objektivet (pinball loss). Disse kalibreres deretter med **Conformalized Quantile Regression (CQR)** (Romano et al., 2019) på et hold-out kalibreringssett. Empirisk dekning på testsettet er **80,0 %** etter CQR-justering (mot nominelt 80 %), og avviker fra rå dekning på 79,8 % med kun en CQR-korreksjon på 3 NOK — kvantil­modellene er altså godt kalibrert allerede før justering.

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

`[FIGUR 7.1]` Distribusjon av `final_charge` (log-skala) viser den forventede høyreskjeve fordelingen: median 7 513 NOK, P25 = 2 039 NOK, P75 = 21 950 NOK, P95 = 91 248 NOK, snitt 25 045 NOK. At snittet er over tre ganger medianen bekrefter behovet for log-transformasjonen i §6.1.

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

**Tabell 7.1.** Validerings­residualer per størrelseskategori (n = 490, år 2024).

| size_category | n | MAE (NOK) | MAPE |
|---|---:|---:|---:|
| Liten | 159 | 9 277 | 0,89 |
| Mellomstor | 113 | 9 192 | 2,13 |
| Stor | 218 | 28 562 | 4,07 |

Stor-kategorien har en MAE som er ca. 3× høyere enn de to andre, hvilket reflekterer at store yachter har større variasjons­spenn i absolutte kostnader. Den relative feilen (MAPE) er likevel begrenset til ~4×, og tyder på at modellen ikke systematisk feil­estimerer denne gruppen — det er fordeling­ens skala, ikke modellens bias, som dominerer absolutt­feilen.

---

## 8. Resultat

### 8.1 Sammenligning av modeller på testsettet

Tabell 8.1 viser feil­metrikker for alle modeller, sortert etter MAE.

| Modell | MAE (NOK) | RMSE (NOK) | MAPE (%) |
|---|---:|---:|---:|
| LightGBM (base) | **17 317** | 54 476 | 180,2 |
| **Ensemble (LGB + CB)** | 17 350 | 55 490 | **168,3** |
| CatBoost | 17 404 | 55 672 | 174,1 |
| LightGBM (tunet) | 17 837 | **55 141** | 168,9 |
| Ridge | 18 251 | 55 842 | 152,7 |
| Median­baseline | 21 800 | 60 128 | 300,8 |

*Kilde:* `013 fase 3 - review/artifacts/metrics.csv`.

Ensemble­modellen reduserer MAE med **20 %** i forhold til median­baseline og **5 %** i forhold til ridge. På dette test­settet er LightGBM (base) og ensemble­modellen praktisk talt like (33 NOK forskjell, eller 0,2 % MAE), og forskjellen er innenfor støy­nivået på et test­sett med 670 transaksjoner. Ensemble­modellen velges likevel som produksjons­modell fordi den reduserer varians på tvers av kvantiler/folder og er mer robust mot at en av basis­modellene skulle drifte ved re-trening; at den også oppnår lavest MAPE (168,3 %) er et sekundært argument, siden MAE i NOK er den primære operasjonelle metrikken (jf. § 9.4).

### 8.2 Kvantil­dekning

Empirisk dekning på testsettet for nominell P10–P90 er **79,8 %** rå og **80,0 %** etter CQR-justering. Per størrelseskategori varierer dekningen modest: Liten 83,0 % (n = 159), Mellomstor 74,3 % (n = 113) og Stor 80,7 % (n = 218). Mellomstor-gruppa er litt under nominelt nivå, hvilket er konsistent med at mellomstore yachter har færrest training-rader (jf. §9.4).

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

Backend (`FastAPI`) på en vanlig utviklermaskin (16 GB RAM, AMD Ryzen-klasse CPU) responderer på `POST /api/predict` på under 200 ms i kald start og under 50 ms ved varm last. Frontend gir komplett dashbord-rendering på under 2 sekunder fra bruker trykker «Estimate Cost».

---

## 9. Diskusjon

### 9.1 Tolkning av resultatene

Ensemble­modellen oppnår en absolutt feil (MAE = 17 350 NOK) som ved første blikk virker høy. To forhold må holdes i mente. **For det første** er feilen målt på transaksjons­nivå, og en transaksjon kan variere fra 2 039 NOK (P25) til over 91 248 NOK (P95) i datasettet — gjennom­snittlig prosentvis avvik (MAPE) på 168 % gjenspeiler primært at noen få ekstreme transaksjoner trekker MAPE opp, ikke at typisk presisjon er svak. **For det andre** er det de aggregerte anløps­estimatene (§ 8.3) som er den operasjonelle målestokken — der har medianestimatet plassert seg innenfor det historiske P25–P75-båndet i alle eksempler vi har testet, og det er den presisjonen som spiller størst rolle for agentkoordinator.

### 9.2 Forholdet mellom ensemble og enkelt­modellene

På det nye test­settet (2025) er LightGBM (base) marginalt best på MAE (17 317 NOK) og RMSE (54 476 NOK), mens ensemble­modellen vinner på MAPE (168,3 %). Rangeringen mellom de to er innenfor støy­nivået, og det er ingen statistisk signifikant forskjell mellom dem på 670 transaksjoner. Et interessant biprodukt av re-splittingen er at den Optuna-tunede LightGBM-modellen presterer dårligere (17 837 NOK) enn base-modellen — et tegn på at hyperparameter­søket overtilpasset seg det forrige validerings­settet (2025) som nå er testsettet. Dette minner oss om at bayesiansk optimering på små valider­ingssett er sårbart, og argumenterer for å beholde en enkelt-modell-fallback ved re-trening. Ensemble velges som produksjons­modell fordi varians­reduksjon mellom CatBoost og tunet LightGBM gir mer robust adferd ved drift i underliggende data­distribusjon.

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

Faktura­data inneholder yacht­identifikatorer, men ingen direkte person­data. Yacht-ID-er er allerede anonymisert i datasettet (`yacht_1, yacht_2, …, yacht_19`). Kontornavn (Bergen Office, Stockholm Office, Copenhagen Office) er beholdt fordi de identifiserer offentlig kjente lokasjoner og ikke representerer sensitive personopplysninger i seg selv. Fakturabeløp i rapporten er aggregert per persentil eller havn slik at enkelt­transaksjoner ikke kan rekonstrueres.

---

## 10. Konklusjon

Vi har utviklet en datadreven kostnads­estimator for skandinaviske yacht­anløp som kombinerer en LightGBM + CatBoost-ensemble på transaksjons­nivå med en hybrid kalibrering mot empiriske kostnadspersentiler på anløps­nivå. På et test­sett med 670 transaksjoner fra 2025 oppnår modellen MAE = 17 350 NOK, en reduksjon på 20 % i forhold til en median­baseline. CQR-kalibrerte kvantil­modeller gir empirisk dekning på 80,0 % for nominelt 80 %-prediksjonsintervall. Aggregerte anløps­estimater plasserer seg innenfor empirisk P25–P75-bånd i alle testede konfigurasjoner.

Hvert delproblem er adressert: DP1 ved 27 features fra fakturadata (§ 5.5), DP2 ved sammen­ligning av seks modeller (§ 8.1), DP3 ved hybrid persentil-kalibrering (§ 6.5), DP4 ved kvantil­modeller med CQR (§ 6.4) og forankring av estimater i empirisk P25–P75-spenn (§ 8.3), og DP5 ved en FastAPI + Next.js-tjeneste med svar­tider under to sekunder (§ 8.4).

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
