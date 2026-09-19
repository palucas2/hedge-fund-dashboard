# Hedge Fund Dashboard

Terminal propriétaire — Pierre-Antoine Lucas. Spec complète : voir le document `HedgeFund_Dashboard_Spec.docx`.

## Étape 1 — scaffold (livrée)

- Next.js 16 + TypeScript + Tailwind CSS + React 19 (upgradé depuis Next 14 suite à des failles de sécurité high sur toute la branche 14.x/15.x)
- NextAuth.js — provider Credentials (email/password), rôles `admin` / `viewer`
- Layout global : sidebar fixe 240px (dark `#0b0d12`) avec les 9 modules, header fixe (horloge US/EU/HK live, emplacements BTC / S&P 500 / régime / alertes)
- Schéma Prisma complet (`users`, `positions`, `trades`, `wheel_cycles`, `market_recaps`, `alerts`)
- Base Neon Postgres liée (`neon link`) — `.env.local` / `.env` déjà configurés

## Étape 2 — Module 2 (Dashboard Performance) + Module 8 (Trade Journal) (livrée)

- **Trade Journal** (`/journal`) : CRUD complet des trades (asset, stratégie, direction, sizing, SL/TP, thèse, leçon, tags), PnL $ et % auto-calculés à la clôture, filtres (stratégie/tag/statut/période), export CSV, analytics (win rate global et par stratégie, profit factor, avg win/loss, max drawdown, equity curve, PnL par asset/jour de semaine/mois, top 5 meilleurs/pires trades). Éditable par tous les rôles (Admin + Viewer), y compris côté API.
- **Dashboard Performance** (`/performance`) : portefeuille ETF (CRUD réservé Admin, date d'entrée par défaut 3 avril 2026), trades actifs avec code couleur zone (🟢 TP1+ / 🟡 en cours / 🔴 SL proche), Kelly sizing calculé depuis l'historique clôturé par stratégie, bouton "Fermer le trade" → enregistrement automatique dans le Journal, métriques globales (Sharpe, win rate, profit factor, max drawdown).
- Prix live (portefeuille ETF + trades actifs, watchlist TradingView) : **Yahoo Finance, gratuit et sans clé** (migré depuis Alpha Vantage — voir Étape 8). Le benchmark S&P 500 ("Alpha généré") n'est lui pas encore implémenté (pas une question de clé, juste pas construit).
- RBAC vérifié à la fois côté UI et côté API (`403` si un Viewer tente d'écrire sur `/api/positions`).

## Étape 3 — Module 1 (Map Monde) + Module 3 (TradingView) (livrée)

- **TradingView** (`/tradingview`) : widget public officiel embarqué (aucune clé requise), watchlist des 10 symboles favoris du spec, sélecteur symbole/timeframe, lien "Open in TradingView", lien Markov Regime Detector (désactivé tant que `NEXT_PUBLIC_MARKOV_SCRIPT_URL` n'est pas renseigné — script pas encore publié, Module 5). Les symboles indices "cash" (SPX, NQ) utilisent leurs équivalents CFD broker (`FOREXCOM:SPXUSD`/`NSXUSD`) — les tickers `SP:SPX`/`CME_MINI:NQ1!` ne sont pas embarquables gratuitement (réservés à tradingview.com).
- **Map Monde** (`/map`) : globe 3D (MapLibre GL + OpenFreeMap, gratuit, sans clé — voir Étape 9), pins colorés par catégorie (🔴 géopolitique · 🟠 macro · 🟢 corporate · 🔵 commodités) avec popup (titre/source/heure/résumé/lien), filtres catégorie + timeframe (6h/24h/7j), zones de tension permanentes pulsantes (Ormuz, mer Rouge, Taiwan, Ukraine) + hotspots dynamiques dérivés de la densité de news réelles, compteur de news par région.
  - **Source de news : flux RSS investing.com** (`lib/rss.ts`, 4 flux : Economy/Stock Market/Commodities/Forex), **gratuit et sans clé**, fraîcheur vérifiée en conditions réelles : article vu avec 11 min de retard (vs ~24h avec NewsAPI seul — voir plus bas). Refresh toutes les 2 minutes (au lieu des 15 min du spec, pour rester sous la barre des 3 min de retard demandée). `NEWS_API_KEY` (NewsAPI.org) reste utilisé en complément si renseigné, pour élargir la couverture au-delà des 4 flux RSS.
  - **NewsAPI.org seul a un délai d'indexation ~24h sur le plan gratuit** (vérifié : 0 résultat sur les dernières 24h, résultats normaux à 48h+) — c'est pour ça qu'il n'est plus la source principale, seulement un complément.
  - **Important — géocodage simplifié** : pas de NLP ni d'appel Mapbox Geocoding par article (hors scope pour cette itération) — un article est placé sur la carte via un dictionnaire de mots-clés lieu→coordonnées (`lib/geo.ts`, ~30 entités) matché sur titre (+description quand disponible). Un article sans lieu ET catégorie reconnus n'apparaît pas sur la carte — donc même si le flux RSS lui-même est très frais, le prochain **pin affiché** dépend de la prochaine actu qui matche les deux critères (pas garanti à chaque cycle de 2 min, mais la donnée sous-jacente n'a plus le délai de 24h).
  - Carte toujours active — aucune clé/compte requis (voir Étape 9).

## Étape 4 — Module 4 (Wheel BTC Tracker) (livrée)

- **Cycle en cours** (`/wheel-btc`) : phase (1 = put vendu / 2 = call vendu), strike, prime, expiration, SL, jauge visuelle BTC live vs strike/SL, alerte 🔴 si à moins de 2% du SL, prix de revient effectif (strike − Σ primes encaissées). CRUD réservé Admin (Viewer lecture seule, comme le portefeuille ETF du Module 2).
- **Prix BTC live** : CoinGecko, gratuit, sans clé, refresh 30s (testé en conditions réelles).
- **Métriques cumulées** : total primes, cycles win/loss/en cours, win rate réel vs projeté Monte Carlo, PnL net, rendement annualisé, equity curve.
- **Monte Carlo** (1 000 simulations) : modèle GBM (drift neutre) + choc de queue optionnel (`crashProb`), implémenté nativement en TypeScript (`lib/monte-carlo.ts`) plutôt qu'un script Python séparé comme suggéré dans le spec — même résultat fonctionnel, sans dépendance d'exécution Python en prod. Formule et hypothèses simplificatrices documentées en commentaire dans le fichier. Résultats vérifiés par un calcul théorique indépendant (approximation loi normale de la probabilité d'assignation).
- Formulaire "Nouveau cycle" et "Clôture de cycle" testés de bout en bout (calculs de distance, prix de revient, equity curve).

## Étape 5 — Module 5 (Regime Detector) (livrée)

- **Vrai modèle Markov** (`/regime`) : Hidden Markov Model gaussien à 3 états (Bull/Bear/Lateral) entraîné par l'algorithme Baum-Welch (EM), implémenté from scratch en TypeScript (`lib/hmm.ts`, forward-backward mis à l'échelle pour la stabilité numérique) — **pas de probabilités inventées** : tout est calculé sur les rendements journaliers réels des 300 dernières bougies daily de chaque asset.
- **Source de données** : Yahoo Finance chart API (gratuite, sans clé — `lib/yahoo-finance.ts`), couvre les 6 assets du spec (S&P 500 `^GSPC`, NQ `^NDX`, BTC `BTC-USD`, Gold `GC=F`, WTI `CL=F`, EUR/USD `EURUSD=X`), toutes vérifiées individuellement avant intégration.
- **Validation du modèle** : testé sur données réelles avant intégration UI — les 3 états convergent vers des paramètres non-dégénérés et cohérents avec la théorie financière (état "bear" = rendement moyen négatif + volatilité la plus élevée, "lateral" = rendement quasi-nul + volatilité la plus faible, "bull" = rendement positif). Les états sont triés par rendement moyen (pas de mapping arbitraire des labels).
- **Header global mis à jour** : le point de régime dominant (🟢/🔴/🟡) était un placeholder statique, il reflète maintenant le vrai calcul (vote majoritaire sur les 6 assets). Le prix S&P 500 du header, aussi en attente d'Alpha Vantage jusqu'ici, utilise maintenant Yahoo Finance (gratuit).
- Timeline des régimes sur 30 jours, recommandation de sizing automatique par régime dominant (texte du spec).
- Refresh horaire (régimes daily, spec), cache 1h côté serveur sur l'historique Yahoo pour limiter les appels.

## Étape 6 — Module 6 (Market Recap) + Module 7 (Antecede Graph) (livrée)

- **IA (Anthropic) désactivée par défaut** — pas de clé payante disponible pour l'instant. `ANTHROPIC_API_KEY` non renseigné → "Generate MC" et "Analyser avec Claude" sont désactivés avec message explicite (403/503 aussi côté API, pas juste caché côté UI). Dès qu'une clé sera dispo (`console.anthropic.com`), tout s'active sans changement de code — architecture déjà en place (`lib/market-recap.ts`, `lib/antecede.ts`), non testée en live faute de clé, mais testée en dégradation gracieuse.
- **Market Recap** (`/market-recap`) : génération via `claude-opus-5` + tool `web_search` (server-side, un seul appel), archivage Postgres, historique par date, rendu formaté par section (9 sections du spec), **Export PDF** (jsPDF, réel, testé), **Pin comme Alpha** (réel, testé — affiche un bandeau "★ Alpha du jour" dans le Dashboard Performance), **Partager** (crée une vraie alerte en base, réel, testé — visible dans le feed d'alertes une fois le Module 9 construit).
- **Antecede Graph** (`/antecede`) : Cytoscape.js (formes/couleurs par type de node, épaisseur d'edge proportionnelle au poids, badge ⛔ chokepoint), recherche + centrage, filtres par catégorie de relation, panel latéral (description, fondamentaux Company via Alpha Vantage, relations, **dernières news réelles** via réutilisation du pipeline RSS/NewsAPI du Module 1 — testé sur "Taiwan", résultats pertinents), **"Structurer le trade"** pré-remplit réellement le formulaire Trade Journal (testé de bout en bout, ticker transmis par URL).
  - **Postgres au lieu de Neo4j** (décision) : tables `antecede_nodes` / `antecede_edges`, largement suffisant pour ~70 nœuds/arêtes — pas de service graphe dédié à opérer.
  - **Dataset d'exemple** (19 entités / 49 relations, thème défense — RTX, Iran, Taiwan, OPEC+, F-35...) : `prisma/seed-antecede.ts`, à remplacer par le vrai dataset de production (`npx tsx prisma/seed-antecede.ts` pour re-seeder).

## Démarrage local

```bash
cd ~/Documents/hedge-fund-dashboard
npm install
```

`.env.local` et `.env` sont déjà configurés avec la base Neon liée à ce projet. Si tu changes de machine ou de branche Neon :

```bash
cp .env.example .env.local
openssl rand -base64 32   # → NEXTAUTH_SECRET
```

`DATABASE_URL` doit pointer vers un Postgres (Neon.tech en prod, ou un Postgres local pour dev). **Important** : Prisma CLI ne lit que `.env` (pas `.env.local`) — garde les deux synchronisés (voir commentaire en tête de `.env`).

Applique le schéma et crée le compte Admin :

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

Le seed crée un admin avec l'email `duelparis@gmail.com` et le mot de passe `changeme123` (variables `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` pour changer) — **change ce mot de passe après la première connexion**.

Seed le dataset d'exemple pour l'Antecede Graph (Module 7) :

```bash
npx tsx prisma/seed-antecede.ts
```

Lance le serveur de dev :

```bash
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000) → redirigé vers `/auth/login`, puis vers `/map` après connexion.

## Étape 7 — Module 9 (Volatility & Event Tracker) (livrée)

- **2 des 5 catégories construites avec de vraies données** :
  - **Conflits géopolitiques** : réutilise le pipeline RSS/NewsAPI du Module 1 — testé en conditions réelles (alertes générées sur de vraies tensions Iran/Golfe, Allemagne/cyberdéfense).
  - **Décisions banques centrales** : calendrier codé en dur (`lib/central-bank-calendar.ts`) avec les **vraies dates 2026** vérifiées le 06/09/2026 sur les sites officiels (Fed, BCE, BoE, BoJ, RBA) — countdown en direct, pré-alerte 30 min avant, alerte "décision tombée". À revérifier périodiquement (spec : "scrapé mensuellement"), en particulier les horaires BoJ (pas d'heure fixe officielle).
  - **Volume inhabituel / Mouvements de prix anormaux** : finalement **pas besoin de Polygon.io** — Yahoo Finance (déjà utilisé pour le Regime Detector) expose aussi le volume (bougies daily) et l'intraday 5 min, **gratuit et sans clé**, testé en conditions réelles (`lib/market-events.ts`). Watchlist = tickers réellement suivis par l'app (positions ETF + companies Antecede), pas de liste codée en dur séparée.
  - **Earnings Surprises** : seule catégorie encore bloquée — nécessite un vrai calendrier d'earnings (EPS réel vs attendu). L'endpoint calendrier de Yahoo est protégé par une authentification "crumb" qu'on ne contourne pas ; Alpha Vantage (`ALPHA_VANTAGE_KEY`) reste la voie la plus propre. `detectEarningsSurprises()` renvoie `[]` explicitement en attendant, plutôt que de deviner une intégration non vérifiée.
- **Feed d'alertes** (`/volatility`) : filtres catégorie + urgence, tag d'issue (Exploité ✅ / Ignoré ➡️ / Raté ❌, persisté), score de pertinence, boutons **Structurer le trade** / **Voir dans le graphe** (teste sur "Iran" → sélectionne le bon nœud Antecede) / **Analyser avec Claude** (dégradé gracieux, comme Module 6/7) — tous testés.
- **Badge alertes non lues** dans la sidebar (item 9) et le header — était un placeholder statique, reflète maintenant le vrai compte (`outcome = pending`).
- Pas d'infra de cron job dédiée : le scan (dédupliqué en base) se déclenche à chaque poll client de la page Volatility (toutes les 2 min), effet équivalent pour un outil interne mono-tenant.

## Étape 8 — Consolidation des sources de données gratuites

Après audit de ce qui restait vraiment bloqué par une clé API payante :

- **Volume inhabituel + Mouvements de prix anormaux (Module 9)** : migrés de "TODO Polygon.io" vers Yahoo Finance (gratuit, testé en conditions réelles — vraies données de volume/intraday RTX).
- **Cotations live** (portefeuille ETF, trades actifs, watchlist TradingView) : migrées d'Alpha Vantage vers Yahoo Finance — plus besoin de `ALPHA_VANTAGE_KEY` du tout pour ces usages. Testé en conditions réelles (RTX $200.79, NOK $10.03, XLE $64.06, CIBR $94.59 récupérés sans clé).
- **Alpha Vantage configuré** (`ALPHA_VANTAGE_KEY`, gratuit, 25 req/jour) — débloque les 2 seuls usages que Yahoo Finance ne pouvait pas couvrir :
  1. **Fondamentaux Company** dans le panel Antecede (P/E, revenue growth, market cap) — testé en conditions réelles sur RTX (P/E 35.6, croissance revenus +14.5%, market cap $270.6B).
  2. **Earnings Surprises** (Module 9, catégorie 1) — `lib/market-events.ts` : EPS réel vs attendu via Alpha Vantage EARNINGS, alerte si surprise ≥10% ET publiée dans les 3 derniers jours (pour ne pas remonter tout l'historique). Logique vérifiée sur données réelles : RTX a un vrai surprise de +13.9% (23 juillet 2026), correctement filtré car trop ancien (45j > seuil 3j) — se déclenchera au prochain earnings frais.
  - Cache 12h par ticker côté serveur pour rester large sous le quota gratuit (25 req/jour).

  Polygon.io n'est plus nécessaire du tout — tout ce qui lui était initialement destiné (BTC, volume, intraday) tourne sur CoinGecko/Yahoo, gratuits. **Les 5 catégories du Module 9 et le panel Antecede tournent maintenant à 100% sur données réelles.**

## Étape 9 — Map Monde : globe 3D, migration Mapbox → MapLibre

Mapbox nécessitait un compte, et le CAPTCHA d'inscription bloquait de façon répétée. Migration vers **MapLibre GL JS + OpenFreeMap** :

- **Aucune clé, aucun compte, aucun CAPTCHA** — `NEXT_PUBLIC_MAPBOX_TOKEN` n'existe plus, la carte fonctionne immédiatement.
- **Globe 3D** : `map.setProjection({ type: 'globe' })`, style OpenFreeMap `dark` (fond `rgb(12,12,12)`), atmosphère via `map.setSky(...)`. Étoiles simulées en CSS (radial-gradient) sur le conteneur — MapLibre n'a pas d'équivalent au `star-intensity` de Mapbox.
- **Zones de tension** (Ormuz, mer Rouge, Taiwan, Ukraine) : re-stylées en halos circulaires pulsants (`circle-blur` + anneau `circle-stroke`, animés via `requestAnimationFrame`) plutôt qu'en polygones plats.
- **Hotspots dynamiques** : nouvelle couche dérivée de la densité réelle de news géopolitiques (regroupement ~4° de rayon), sévérité Critical/High/Medium selon le nombre d'articles — légende directement sur la carte.
- API MapLibre vérifiée sur la doc officielle avant écriture (`setProjection`/`setSky` diffèrent de l'API Mapbox `setFog`) plutôt que devinée par analogie.
- **Non testé visuellement** au moment de la migration (session en cours) — à vérifier au prochain lancement de `npm run dev`.

## Étape 10 — Redux Toolkit (RTK Query) pour l'état partagé Header/Sidebar

Header et Sidebar interrogeaient chacun `/api/alerts/unread-count` indépendamment (deux `useEffect`/`setInterval` séparés montés en même temps) — deux requêtes réseau pour la même donnée à chaque chargement de page.

- **`lib/store/api.ts`** : couche RTK Query unique (`dashboardApi`) avec 4 endpoints — `getBtcPrice`, `getSpxPrice`, `getRegime`, `getUnreadAlertsCount` — chacun un simple GET vers les routes existantes (`/api/btc-price`, `/api/spx-price`, `/api/regime`, `/api/alerts/unread-count`).
- **`lib/store/store.ts`** : store Redux minimal (juste le reducer + middleware de `dashboardApi`).
- **`components/Providers.tsx`** : `<ReduxProvider store={store}>` ajouté à l'intérieur du `SessionProvider` existant.
- **Header** et **Sidebar** utilisent maintenant `useGetUnreadAlertsCountQuery(undefined, { pollingInterval: 2*60*1000 })` — RTK Query déduplique automatiquement les deux abonnements à la même clé de requête : **une seule requête réseau sert les deux composants** (vérifié en conditions réelles via l'onglet réseau — un seul `GET /api/alerts/unread-count` au lieu de deux).
- Header garde son propre `useEffect` pour l'horloge (US-E/EU/HK) — c'est du state purement local au composant, pas une donnée partagée, donc pas de raison de le faire transiter par Redux.
- Testé en conditions réelles (`npm run dev` + navigateur) : prix BTC/S&P live, régime dominant, badge alertes (sidebar item 9 + cloche header) tous corrects après migration, aucune régression.

## Étape 11 — Signal Engine (`tools/signal-engine/`) + extension Antecede Graph

- **Signal Engine** : pipeline Python autonome, news → score d'impact (0-100) → actifs touchés → banque de 9 signaux quant (HMM, Kalman, VWAP, OFI, Bai-Perron, dark pool, GEX, vol skew, VRP) → idée de trade avec conviction → sizing par volatilité + stops/targets → écriture dans les vraies tables `alerts` et `trades` de cette base. Voir `tools/signal-engine/README.md` pour tout le détail (7-8 des 9 signaux tournent sur données réelles gratuites — Alpha Vantage/yfinance/Polygon free tier/Alpaca free tier — pas de mock caché). Inclut un tournoi de backtest (8 stratégies, validation multi-fenêtres, frais inclus) et un daemon (`run_daemon.py`) pour tourner en continu.
- **Antecede Graph** étendu de 19 entités (dataset défense) à 136 nœuds / 163 relations couvrant tout l'univers d'actifs (stocks, ETF, commodités, obligations, FX, crypto) — additif, le dataset défense original est intact.
- Dépôt initialisé sous git et poussé sur GitHub à cette occasion (aucun historique de version n'existait avant, malgré ~2 semaines de travail).

## Étape 12 — Déploiement

**Build vérifié** (`npm run build`, compile proprement, toutes les routes générées) — l'app est prête côté code. Ce qui manque pour un vrai déploiement ne peut être fait que depuis un compte Vercel/Render (identifiants nécessaires, non disponibles pour un agent) :

1. **Vercel** (frontend) : `vercel login` (ou import direct du repo GitHub `palucas2/hedge-fund-dashboard` sur vercel.com/new), puis configurer ces variables d'environnement (valeurs déjà présentes en local dans `.env.local`, à recopier dans Vercel → Project Settings → Environment Variables) :
   - `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (mettre l'URL de prod une fois assignée par Vercel)
   - `DATABASE_URL` (déjà la même base Neon utilisée en dev)
   - `NEWS_API_KEY`, `ALPHA_VANTAGE_KEY`
   - `ANTHROPIC_API_KEY`, `MARKET_RECAP_PROMPT` — **pas encore configurées, même en local** ; Module 6 (Market Recap) et le bouton "Analyser avec Claude" du Module 7 dégradent gracieusement sans, mais ne fonctionnent pas tant que ces deux-là ne sont pas renseignées
2. **Backend/daemon** (Render/Railway, ou tout hôte qui garde un process actif) : `tools/signal-engine/Dockerfile` est prêt (non testé — pas de `docker` dans cet environnement de dev, voir `tools/signal-engine/README.md`), tourne `run_daemon.py` en continu.

Aucune action de déploiement effective n'a été prise (création de projet Vercel, connexion de compte) — nécessite une décision + des identifiants qui ne m'appartiennent pas.
