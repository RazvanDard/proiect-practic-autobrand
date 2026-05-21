# Proba practica Autobrand

Rezolvare pentru proba practica (vezi `Proba practica Autobrand.pdf`). Aplicatia rezolva ambele probleme cerute, plus toate cele 3 puncte de bonus.

## Ce face

Pe scurt, aplicatia:

1. se logheaza pe web-scraping.dev, ia produsele din categoria consumables si le salveaza in baza de date
2. ruleaza singura din ora in ora intre 12 si 18 prin cron
3. afiseaza produsele intr-un tabel cu sortare, filtrare si paginare
4. permite editare si stergere pe orice produs
5. accepta un PDF de eFactura, scoate liniile (cod, denumire, pret unitar, moneda, cantitate) si genereaza un CSV pentru download
6. ia automat cursul BNR din ziua curenta si convert preturile in RON
7. e in spatele unui sistem simplu de login cu email + parola

## Cum e structurat

Sunt trei piese care comunica intre ele:

```
React + Vite           Convex                 FastAPI + Playwright
+------------+  query  +----------------+    +---------------------+
|  web/      |<------->|  web/convex/   |<-->|  scraper/           |
|  (UI)      | mutate  |  (DB, auth,    |HTTP|  /scrape            |
|            | action  |   cron, FX)    |    |  /parse-invoice     |
+------------+         +----------------+    +---------------------+
                              ^ cron hourly, 12:00-18:00 Europe/Bucharest
```

Fiecare are treaba lui:

- **React (web/)** se ocupa doar de UI. Nu stie nimic despre scraping, parsing sau cron. Doar afiseaza date din Convex si trimite mutatii cand userul face ceva.

- **Convex (web/convex/)** e creierul. Tine baza de date, sesiunile de login, programul de cron, conversiile BNR si trimite apelurile catre serviciul Python. E aici regula de unicitate pe `name`, sortarea, filtrarea, totul.

- **FastAPI + Playwright (scraper/)** e singura piesa care chiar trebuie sa porneasca un browser real sau sa citeasca un PDF. Convex ruleaza in V8 sandboxed deci nu poate sa lanseze Chromium acolo, asa ca am scos partea grea intr-un microserviciu separat.

## De ce am ales fiecare lucru

### De ce Convex si nu Express + Postgres

Cateva motive concrete:

- queryurile sunt reactive. Cand cron-ul scrie produse noi, tabelul din UI se updateaza singur. Nu am scris niciun websocket, niciun polling.
- cron-ul e o functie in `crons.ts`. Fara worker separat, fara cron de sistem.
- auth e tot in pachet. `@convex-dev/auth`

### Cum e facuta paginarea

Paginarea ruleaza pe server prin Convex `paginate({ numItems: 25, cursor })`. Functioneaza in doua moduri in functie de context:

- daca user-ul scrie ceva in search, intra pe un search index full-text (`by_search_blob`, peste un camp `searchBlob` care e numele si descrierea lowercased). Convex ordoneaza dupa relevanta deci sortKey-ul ales e ignorat in branch-ul asta, dar filtrele pe pret si moneda raman.
- altfel mergem pe unul din indexurile clasice (`by_name`, `by_price`, `by_lastScrapedAt`) cu sortDirection cerut, plus `.filter()` pe priceRon si currency.

In React tin un stack de cursori, unul per pagina vizitata. Click pe Next pune `continueCursor` in stack. Click pe Prev decrementeaza index-ul. Asa Convex nu face requesturi inutile cand userul vrea pagina precedenta. Cand userul schimba search-ul sau sortarea, stack-ul se reseteaza la `[null]`.

Pentru "Showing 1-25 of N" am o query separata `api.products.count` care aplica aceleasi filtre si returneaza doar lungimea. E ok pentru orice dataset rezonabil ca volumul de citire e tot acolo (Convex face citirea, nu transferul de date in JS), iar daca devine vreodata o problema, scoti countul si lasi doar "Page X" plus disabled pe Next.

## Cum pornesti totul local

Sunt 4 procese care trebuie sa ruleze in paralel. Le tin in terminale separate.

### 1. Scraperul Python

```bash
cd scraper
python3 -m venv .venv-linux  
source .venv-linux/bin/activate
pip install -r requirements.txt
python -m playwright install chromium

# pune un secret pentru auth intre Convex si scraper
cp .env.example .env              # editeaza SCRAPER_SHARED_SECRET

python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Test rapid:

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

### 2. Tunelul public catre scraper

```bash
ngrok http 8000
# sau: cloudflared tunnel --url http://localhost:8000
```

Copiezi URL-ul `https://xxxx.ngrok-free.app`.

### 3. Convex

```bash
cd web
npm install
npx @convex-dev/auth          # genereaza JWT_PRIVATE_KEY si JWKS
npx convex dev                # lasi terminalul deschis, urmareste convex/

# in alt terminal, ii setezi env-ul cu URL-ul si secretul de la pasul 1+2
npx convex env set SCRAPER_BASE_URL https://xxxx.ngrok-free.app
npx convex env set SCRAPER_SHARED_SECRET dev-secret
```

### 4. Front-endul

```bash
cd web
cp .env.example .env             # pune VITE_CONVEX_URL pe care l-a aratat convex dev
npm run dev                      # http://localhost:5173
```

Deschizi `localhost:5173`, faci cont, dai Scrape now ca sa ai produse in tabel.

## Deploy pe Vercel

Aplicatia se imparte intre Vercel (front-endul), Convex (backend + DB) si un host extern pentru scraper. Vercel nu poate rula Playwright (Chromium e prea mare pentru un function lambda), deci scraperul ramane separat.

### 1. Front-end pe Vercel

Repo-ul are deja `web/vercel.json` care:

- foloseste build-ul Vite default
- ruleaza `npx convex deploy --cmd 'npm run build'` ca build command, ca sa fie deployat si Convex la fiecare push
- rewrite toate rutele catre `index.html` (SPA)
- cache imutabil pe `assets/`

In Vercel dashboard:

- New Project, conectezi repo-ul
- Root Directory: `web`
- Framework Preset: Vite (auto)
- Environment Variables:
  - `CONVEX_DEPLOY_KEY` = un deploy key generat din Convex dashboard pentru deployment-ul de productie
  - `VITE_CONVEX_URL` = URL-ul deployment-ului de productie Convex

Build-ul automat va face `convex deploy` (push schema + functii) inainte de `npm run build`. Output-ul pleaca la edge.

### 2. Convex pe productie

`npx convex deploy` din workflow-ul Vercel scrie schema, functiile, crons si HTTP routes catre deployment-ul de productie. Tot ce e env (BNR, SCRAPER_BASE_URL, SCRAPER_SHARED_SECRET, JWT_PRIVATE_KEY, JWKS, SITE_URL) trebuie setat manual cu `npx convex env set ... --prod`.

`SITE_URL` trebuie sa devina URL-ul Vercel (ex: `https://proba-practica.vercel.app`), nu mai e `localhost:5173`.

### 3. Scraperul

Vercel nu il poate gazdui. Optiuni:

- ngrok pe masina ta cat dureaza demo-ul (URL-ul se schimba dupa fiecare restart, deci nu e bun pentru ceva permanent)
- Fly.io sau Railway cu un Dockerfile FastAPI + Playwright (5 minute setup)
- orice VPS unde poti `uvicorn` si avea Playwright

URL-ul stabil ajunge in `SCRAPER_BASE_URL` din env-ul Convex de productie.

## Cum lucreaza partile impreuna

### Fluxul de scraping

```
[buton Scrape now sau cron 12-18]
       |
       v
api.scrape.runScrape (Convex action)
       |  fetch /scrape + X-Scraper-Secret
       v
serviciul Python
       |  porneste Chromium
       |  login pe web-scraping.dev
       |  walk page=1, 2, 3, ... dedup pe name
       v
returneaza JSON catre Convex action
       |
       v
products.upsertMany (Convex mutation interna)
       |  cauta dupa indexul by_name
       |  patch daca exista, insert daca nu
       |  calculeaza priceRon cu cursul BNR
       v
scrapeRuns audit log + UI reactiv se updateaza singur
```

### Fluxul de PDF

```
user trage PDF in dropzone
       |
       v
generateUploadUrl (Convex mutation)
       |
       v
browser face POST direct la storage Convex
       |  primeste storageId
       v
api.scrape.parseInvoice (Convex action)
       |  fetch /parse-invoice cu PDF binar
       v
serviciul Python
       |  pdfplumber extract_tables
       |  parser dedicat pentru RO eFactura
       v
returneaza linii + CSV gata facut
       |
       v
invoiceItems.saveBatch (persist) + UI face download CSV-ului
```
