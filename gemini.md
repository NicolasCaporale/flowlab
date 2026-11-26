# FlowLab — Documentazione Tecnica & Guida al Progetto

Benvenuto in **FlowLab**, un ambiente didattico avanzato per la creazione, modifica, esecuzione e traduzione di **diagrammi di flusso** e **diagrammi delle classi UML**, progettato per funzionare interamente nel browser web senza alcuna dipendenza runtime esterna.

---

## 1. Visione d'Insieme & Obiettivi

FlowLab nasce con l'obiettivo di offrire a studenti e docenti uno strumento moderno, accessibile e potente per l'apprendimento del pensiero computazionale e della programmazione sia procedurale che orientata agli oggetti (OOP).

### Punti di Forza
- **Nessuna installazione richiesta**: Funziona aprendo direttamente il file `dist/FlowLab.html` in qualsiasi browser moderno (Chrome, Edge, Firefox, Safari) o collegandosi alla versione web.
- **PWA (Progressive Web App)**: Installabile come applicazione desktop/Chromebook con supporto offline completo e associazione file di sistema per l'apertura con doppio clic dei file `.fprg`.
- **Compatibilità con Flowgorithm**: Apre e salva file nel formato standard `.fprg` (XML), garantendo piena interoperabilità con gli strumenti scolastici tradizionali.
- **Estensioni Linguistiche Avanzate**: Introduce concetti moderni (OOP con UML, Generics `<T>`, ritorno di valori multipli, array multidimensionali, costanti, moduli riutilizzabili) salvati in un formato esteso retrocompatibile quando possibile.
- **Transpiler Multilinguaggio**: Traduce istantaneamente il diagramma di flusso in pseudocodice italiano, Python, Java, C++, C# e JavaScript.

---

## 2. Architettura del Progetto

Il progetto è architettato come un'applicazione monolitica modulare distribuita come singolo file HTML autonomo (self-contained) tramite uno script di build in Python.

```
flowlab/
├── dist/                     # File distribuiti e pronti all'uso
│   ├── FlowLab.html          # Applicazione standalone completa
│   ├── artifact.html         # Versione incorporabile
│   ├── manifest.webmanifest  # Configurazione PWA
│   └── sw.js                 # Service Worker per cache offline
├── src/                      # Moduli sorgente dell'applicazione
│   ├── expr.js               # Parser espressioni, tipi, AST e valutatore
│   ├── model.js              # Modello dati programma, statement, classi e serializzazione .fprg
│   ├── interp.js             # Motore interprete a generatori (step-by-step, VFS, OOP)
│   ├── codegen.js            # Transpiler multilinguaggio con inferenza dei tipi
│   ├── render.js             # Calcolo geometrico del layout e rendering SVG del diagramma
│   ├── uml.js                # Diagramma delle classi UML (vista Oggetti)
│   ├── arrayview.js          # Finestre di debug e visualizzazione dinamica degli array
│   ├── pdf.js                # Generazione PDF vettoriale del progetto
│   ├── examples.js           # Programmi dimostrativi integrati
│   ├── pierangelo.js         # Assistente e Tutor AI socratico (Gemini + guida locale)
│   ├── app.js                # Controller UI, gestione eventi, stato e finestre
│   ├── body.html             # Struttura DOM dell'interfaccia
│   ├── style.css             # Regole di stile e layout
│   └── pwa/                  # Icone e scheletro Service Worker
├── moduli/                   # Libreria dei moduli standard (strutture dati, algoritmi)
├── esempi/                   # Esempi esportati in formato .fprg
├── tools/                    # Script di supporto e manutenzione
├── test/                     # Test unitari (Node.js) e UI (Playwright)
└── build.py                  # Script di bundling e compilazione
```

---

## 3. Analisi Dettagliata dei Componenti (`src/`)

### 3.1 Motore delle Espressioni (`src/expr.js`)
- **Parser & Lexer**: Implementa un parser ad operatori con gestione delle precedenze aritmetiche, logiche, relazionali e di concatenazione (`&`).
- **Valutatore a Generatore**: Le funzioni utente chiamate all'interno di un'espressione sono valutate tramite generatori (`yield`), permettendo all'interprete di fare step-in all'interno di una chiamata annidata in un'espressione senza bloccare l'interfaccia.
- **Sistema di Tipi**: Supporta tipi primitivi (`Integer`, `Real`, `String`, `Boolean`), oggetti di classe (`Object`), tipi parametrici/generici (`ArrayList<Integer>`, `T`) e inferenza dei tipi di ritorno e degli operandi.

### 3.2 Modello dei Dati & I/O `.fprg` (`src/model.js`)
- **Ast / Statement**: Rappresenta nodi istruzione (`declare`, `const`, `assign`, `input`, `output`, `if`, `while`, `for`, `do`, `call`, `comment`, `breakpoint`, `open`, `close`, `read`, `write`).
- **Modello OOP**: Mantiene classi (`prog.classes`), gerarchia di ereditarietà (`parent`), attributi con visibilità (`+`, `-`, `#`), metodi, costruttori e classi/metodi astratti.
- **Parser & Serializer XML**: Legge e genera XML compatibile con Flowgorithm. Rileva automaticamente se il programma fa uso di estensioni (Generics, Classi, Tuple, ecc.) per etichettare il file come standard o esteso.

### 3.3 Interprete Esecutivo (`src/interp.js`)
- **Coroutines & Eventi**: L'interprete avanza come un generatore che produce eventi (`stmt`, `input`, `break`, `call`, `return`). Questo consente l'esecuzione a varie velocità, la pausa, l'evidenziazione del blocco attivo e il debug passo-passo.
- **Call Stack & Ambienti**: Gestisce frame di chiamata, scope locali per funzioni/metodi, puntatore `this`, chiamata al costruttore genitore `super(...)`, risoluzione polimorfica a runtime dei metodi virtuali e controlli d'accesso a membri privati e protetti.
- **Virtual File System (VFS)**: Simula file su memoria persistente (tramite local storage) per le istruzioni di lettura/scrittura su file.

### 3.4 Transpiler di Codice (`src/codegen.js`)
- Genera codice sorgente pulito e idiomatico per **Pseudocodice**, **Python**, **C++**, **Java**, **C#** e **JavaScript**.
- **Mapping Intelligente**: Mappa automaticamente i tipi generici e le strutture dati dei moduli standard sui corrispondenti nativi di ogni linguaggio (ad esempio `ArrayList<T>` diventa `std::vector<T>*` in C++, `List<T>` in C#, `list` in Python, `ArrayList<T>` in Java, `Array` in JavaScript).

### 3.5 Rendering SVG del Diagramma (`src/render.js` e `src/uml.js`)
- **Layout Geometrico Dinamico**: Calcola larghezze e altezze dei rami (`L`, `R`), gestisce giunzioni, ritorni dei cicli senza sovrapposizioni e allineamento dei rami dei condizionali.
- **Vista Estesa vs Vista Compatta**: Permette di compattare blocchi sequenziali consecutivi dello stesso tipo eliminando frecce superflue per rendere leggibili diagrammi complessi.
- **Diagramma Classi UML**: Visualizza scatole UML complete con stereotipi, attributi, metodi e frecce di ereditarietà e associazione calcolate con clipping geometrico.

### 3.6 Ispezione e Debug degli Array (`src/arrayview.js`)
- Finestre fluttuanti interattive che renderizzano array 1D (striscia), 2D (griglia a matrice) e 3D (volume a pagine sfogliabili) con virtualizzazione delle celle visibili, sfumatura dei bordi e tracciamento in tempo reale della cella modificata con connettori curvi SVG.

### 3.7 Pierangelo — Assistente e Tutor AI (`src/pierangelo.js`)
- **Bottone Fluttuante & Chat**: Cerchio in basso a destra con icona SVG vettoriale di un robot che apre il pannello di conversazione di **Pierangelo**.
- **Doppia Funzione Didattica**:
  1. **Guida alla Piattaforma**: spiega cosa fa ogni blocco (incluso il blocco attualmente selezionato nel diagramma) e dove trovare gli strumenti di FlowLab.
  2. **Tutor Socratico per gli Esercizi**: legge in tempo reale il diagramma corrente (pseudocodice, blocco selezionato ed eventuali errori di esecuzione) e fornisce **solo indizi, domande guida e suggerimenti ragionati**, senza mai dare la soluzione pronta.
- **Integrazione Gemini + Chiave Host (`secret`) + Guida Locale**: utilizza `gemini-2.5-flash` / `gemini-2.5-flash-lite` / `gemini-2.0-flash` leggendo automaticamente la chiave API dal file locale `secret` del progetto (sia a runtime sia in fase di build con `python3 build.py`), affiancato da un motore di risposta locale integrato che funziona anche offline.

---

## 4. Pipeline di Build e Test

### Compilazione del Progetto
Per unire i sorgenti e rigenerare la cartella di distribuzione:
```bash
python3 build.py
```
Lo script:
1. Concatena file CSS, template HTML e script JavaScript nell'ordine corretto.
2. Incorpora la libreria moduli in formato JSON direttamente nello script.
3. Calcola l'hash sha1 per l'aggiornamento automatico del Service Worker.
4. Genera `dist/FlowLab.html`, `dist/artifact.html` e il manifest PWA.

### Esecuzione dei Test
- **Test Interprete**: `node test/node_interp.js`
- **Test OOP e Polimorfismo**: `node test/node_oo.js`
- **Test Costanti e Vincoli**: `node test/node_const.js`
- **Test Ritorno Multiplo**: `node test/node_multi.js`
- **Test Array Multidimensionali**: `node test/node_md.js`
- **Test Transpiler**: `node test/node_codegen.js all`
- **Test E2E Interfaccia (con Playwright)**: `node test/ui.mjs`, `node test/oo_ui.mjs`

---

## 5. Spazio Funzioni da Fare / Backlog di Sviluppo

Questa sezione è dedicata alla pianificazione e al tracciamento delle nuove funzionalità, miglioramenti e idee di espansione per FlowLab.

### 📌 5.1 Funzionalità Linguaggio & Runtime
- [ ] **Blocco Switch / Scelta Multipla**:
  - Aggiunta del costrutto `Switch / Case` per evitare catene annidate di `Se ... Altrimenti Se`.
  - Aggiornamento di rendering SVG, parser `.fprg`, interprete e generatori di codice.
- [ ] **Tipi Enumerativi (`Enum`)**:
  - Definizione di tipi enumerati personalizzati con valori simbolici leggibili.
  - Supporto nel visualizzatore variabili e nell'autocompletamento.
- [ ] **Gestione delle Eccezioni (`Prova / Cattura` - Try / Catch)**:
  - Blocco per intercettare errori di runtime (es. divisione per zero, indice array fuori dai limiti, formato non valido in input o conversioni).
- [ ] **Funzioni Matematiche e di Stringa Aggiuntive**:
  - Metodi di stringa comuni: `Split()`, `Join()`, `Replace()`, `IndexOf()`, `Trim()`, `Substring(start, len)`.
  - Costante `E` (numero di Eulero), funzione `Hypot()`, `Floor()`, `Ceil()`.

### 🎨 5.2 Esperienza Utente (UX) & Editor Grafico
- [ ] **Tema Scuro (Dark Mode)**:
  - Toggle rapido per alternare tema chiaro e scuro sia per l'editor che per la console e i pannelli.
  - Palette colori SVG dedicata ad alto contrasto per le ore notturne.
- [ ] **Navigazione & Canvas**:
  - Supporto zoom fluido con rotellina del mouse / gesture pinch-to-zoom su touchpad.
  - Panorami (pan) tramite trascinamento con tasto centrale del mouse o barra spaziatrice premuta.
  - Mini-mappa nell'angolo inferiore per orientarsi in diagrammi molto estesi.
- [ ] **Grafica Tartaruga (Turtle Graphics)**:
  - Supporto completo ai blocchi grafici per il disegno stile Logo/Tartaruga (avanti, ruota, alza/abbassa penna, colore).

### 🔍 5.3 Debugger & Strumenti di Analisi
- [ ] **Time-Travel Debugging (Step Back)**:
  - Possibilità di tornare indietro di un passo durante l'esecuzione registrando snapshot dei delta di stato.
- [ ] **Analizzatore di Complessità / Profiling**:
  - Contatore del numero totale di istruzioni eseguite, confronti effettuati e accessi a memoria (utile per spiegare la complessità computazionale asintotica $O(n)$ in classe).
- [ ] **Visualizzatore Grafico di Strutture Dati Dinamiche**:
  - Rappresentazione ad albero o a grafo orientato per oggetti collegati tramite puntatori/riferimenti (es. liste concatenate, alberi binari).

### 🚀 5.4 Transpiler & Esportazione
- [ ] **Supporto a Nuovi Linguaggi di Target**:
  - Esportazione in **Rust** (con gestione del borrowing e tipi opzionali).
  - Esportazione in **TypeScript** con interfacce e tipi stringenti.
- [ ] **Importazione ed Esportazione Immagini con Metadati**:
  - Esportazione PNG/SVG con il sorgente `.fprg` incorporato nei metadati del file per consentire il drag-and-drop dell'immagine direttamente nell'editor per riaprire il progetto.

### 📚 5.5 Moduli & Didattica
- [ ] **Nuovi Moduli della Libreria Ufficiale**:
  - Modulo `AlberoBinario<T>` con visite (in-order, pre-order, post-order).
  - Modulo `Matrici` per operazioni matematiche su matrici (somma, moltiplicazione, determinante, trasposta).
- [ ] **Sistema di Esercizi Guidati con Validazione Automatica**:
  - Possibilità per il docente di impostare casi di test di input/output attesi per verificare automaticamente la correttezza del diagramma di uno studente.

---

*Documento generato per il progetto FlowLab.*
