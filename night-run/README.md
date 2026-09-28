# Noćni run: Mihajlo Estate

Automatski build celog sajta i admin panela preko Claude Code-a, korak po korak, bez tvog učešća.

## Pokretanje (jedna komanda)
Otvori PowerShell u folderu projekta (`C:\Users\admin\Desktop\Web Dev Projects\mihajlo-estate`) i pokreni:

```powershell
powershell -ExecutionPolicy Bypass -File .\night-run\night-run.ps1
```

Pre pokretanja:
- Laptop mora biti na punjaču. Ne zatvaraj poklopac.
  - Skripta sama sprečava sleep dok radi.
  - Poklopac ipak može da uspava mašinu, pa u *Power options* podesi "When I close the lid: Do nothing".
- Windows Update: *Settings → Windows Update → Pause updates* (1 nedelja), da ti ne restartuje mašinu noću.
- Claude Code mora biti ulogovan (`claude` jednom interaktivno).
- Convex mora biti ulogovan. `npx convex dev` je već radio, pa jeste.
- Chrome sme da ostane otvoren; runner ga ne koristi.

## Šta radi
1. **Preflight:**
   - proverava node, git i Claude Code (po potrebi radi `claude update`)
   - pravi baseline git commit, granu `night-run` i tag `night-run/baseline`
   - radi `npm install`
   - postavlja Convex Auth ključeve na DEV deployment
   - generiše admin nalog u `night-run/state/admin.json`
   - pravi popis skillova
   - probno pinguje model (Opus 5.5), auto mode i ultracode
   - gasi zaostale Claude procese iz prekinutog prethodnog runa
2. **16 koraka** iz `steps.psd1`. Svaki korak ima:
   - **Model:** `claude-opus-5-5` (Opus 5.5) za sve korake. Koristi se eksplicitni ID jer alias `opus` na ovom nalogu vodi na Opus 5.
     - Ako Opus 5.5 udari dugačak limit, runner prelazi na `opus` (Opus 5), pa na `sonnet`.
   - **Effort:** `max` za plan, dizajn i landing; `xhigh` za veliku implementaciju; `ultracode` za QA
     - `ultracode` = xhigh + automatski workflow sa više paralelnih agenata.
     - `max` nije svuda jer Anthropic za njega kaže da je "sklon overthinkingu". Tamo gde je posao dugačak i mehanički, `xhigh` daje isti kvalitet brže.
   - **Session:** `new` (čist kontekst, čita docs + PROGRESS.md) ili `continue`
     - `continue` nastavlja sesiju prethodnog koraka. Tako radi 05b, kritika landinga, u istoj sesiji u kojoj je landing napravljen.
   - **Mode:**
     - `plan`: korak 01, read-only plan koji se snima u `docs/IMPLEMENTATION-PLAN.md`
     - `goal`: `/goal` petlja u **auto** permission modu. Claude radi dok "Definition of done" iz prompta nije dokazan, a posle svakog turna ga proverava nezavisni evaluator.
3. **Posle svakog koraka:**
   - `npm run verify` (Convex push + typegen + typecheck + lint + build)
   - ako padne, ista sesija dobija grešku i popravlja (do 2 puta)
   - zatim git commit + tag `night-run/step-XX`
4. **Usage limit:** runner pročita vreme reseta, čeka i nastavi **istu sesiju**. Ako je limit nedeljni, prelazi na sledeći model (Opus 5.5 → Opus 5 → Sonnet).
5. **Timeout koraka:** proces se gasi i sesija se nastavlja (`--resume`).

## Kako pratiš
- `night-run\STATUS.md`: tabela svih koraka (status, pokušaji, trajanje, procena troška).
- `night-run\logs\<vreme>\runner.log`: sve što runner radi. `*.jsonl` sadrži kompletan Claude stream po pokušaju.
- `night-run\state\steps\XX.done.md`: izveštaj svakog koraka.
- `docs\PROGRESS.md`: dnevnik napretka.
- `git log --oneline`: commit za svaki korak.

## Ujutru
```powershell
npm run dev          # http://localhost:3000/sr  (admin: http://localhost:3000/admin)
```
Admin login je u `night-run\state\admin.json`. Promeni lozinku posle prvog logina.

## Nastavak / ponavljanje
```powershell
# nastavi gde je stalo (preskače završene korake)
powershell -ExecutionPolicy Bypass -File .\night-run\night-run.ps1
# kreni od koraka 06
powershell -ExecutionPolicy Bypass -File .\night-run\night-run.ps1 -From 06
# ponovi samo jedan korak
powershell -ExecutionPolicy Bypass -File .\night-run\night-run.ps1 -Only 05b -Redo
# čist restart: zaboravi nedovršene sesije i fallback modele (posle prekida ili promene modela)
powershell -ExecutionPolicy Bypass -File .\night-run\night-run.ps1 -Fresh
# samo prikaži komande, bez pokretanja
powershell -ExecutionPolicy Bypass -File .\night-run\night-run.ps1 -DryRun
```
Prekid: Ctrl+C u PowerShell prozoru. Runner tada ugasi i Claude proces koji je u toku. Sve sesije se zovu `mihajlo-night-XX`. Bilo koju možeš otvoriti interaktivno sa `claude --resume mihajlo-night-05`.

## Menjanje podešavanja
Sve je u `night-run\steps.psd1`: model, effort, session i mode po koraku.
- `PermissionMode = 'auto'` je preporuka: klasifikator blokira opasne akcije.
- Ako auto mode nije dostupan na nalogu, runner sam prelazi na `bypassPermissions` (`FallbackToBypass`).

## Slike i video za hero
Ubaci AI rendere u folder `media-src\` (vidi `media-src\README.md`). Korak 05 (landing) i korak 15 (finalni polish) ih automatski optimizuju i ugrađuju.

## Bezbednost
- Runner nikad ne radi push, deploy ni produkciju (deny pravila u `claude-settings.json`).
- Radi samo u ovom folderu i na DEV Convex deploymentu.
- Sve je u git-u, pa svaki korak možeš vratiti: `git reset --hard night-run/step-04`.
