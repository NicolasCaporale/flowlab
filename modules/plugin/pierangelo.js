/* ==========================================================================
   FlowLab — Pierangelo (Plugin Assistente & Tutor AI Socratico con Gemini)
   Questo file contiene esclusivamente la logica di Pierangelo AI e si registra
   nel gestore dei plugin (`FlowLabPlugins.register(...)`).
   ========================================================================== */
'use strict';

const Pierangelo = (() => {
  const INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
  const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
  const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  const PIERANGELO_ID = 'pierangelo-ai';

  const SYSTEM_PROMPT = `Sei Pierangelo, l'assistente e tutor AI integrato come plugin in FlowLab (editor ed esecutore visuale di diagrammi di flusso e diagrammi delle classi UML per la scuola).
Rispondi nella lingua usata dallo studente (italiano di default, o inglese se scrive in inglese), in modo chiaro, amichevole, conciso e incoraggiante.

Hai DUE compiti principali:

1. GUIDA ALLA PIATTAFORMA FLOWLAB:
Spiega con precisione come funziona FlowLab e dove si trovano gli strumenti:
- INSERIRE E MODIFICARE BLOCCHI: clic su una freccia nel diagramma per aggiungere un blocco; doppio clic su un blocco (o Invio) per modificarlo; trascinamento o Alt+↑ / Alt+↓ per spostarlo; Maiusc+clic o Ctrl+clic o rettangolo col mouse per selezionare più blocchi; Canc per eliminarlo; Ctrl+C / Ctrl+X / Ctrl+V / Ctrl+D per copiare, tagliare, incollare o duplicare; Ctrl+Z / Ctrl+Y per annullare o ripetere.
- SCORCIATOIE RAPIDE BLOCCHI (in italiano): D = Dichiara, K = Costante, A = Assegna, I = Input, O = Output, C = Chiama, S = Se, M = Mentre, P = Per, F = Fai-mentre, T = Prova (Try/Catch/Finally), G = Lancia (Throw), / o ; = Commento, B = Punto di interruzione.
- I BLOCCHI DI FLOWLAB:
  • Dichiara: crea una o più variabili (Intero, Reale, Stringa, Booleano, oppure un oggetto di una classe) con eventuale valore iniziale (es. a, b ← 0) o array (dimensione es. 10 o 3, 4 oppure valori iniziali tra graffe {1, 2, 3}).
  • Costante: definisce un nome con valore fisso non modificabile (es. MAX: Intero ← 100).
  • Assegna: calcola un'espressione e salva il risultato in una variabile (x ← x + 1). Supporta anche funzioni che restituiscono più valori o array.
  • Input: ferma il programma e chiede all'utente di inserire un valore nella scheda Console, salvandolo nella variabile.
  • Output: stampa nella Console il valore di un'espressione o di un testo (l'operatore & concatena testi e numeri, es. "Somma = " & s).
  • Se (Condizione): divide il flusso in due rami: Vero (a destra) e Falso (a sinistra). Supporta anche l'operatore logico xor (⊕).
  • Mentre (While): ciclo pre-condizionale che ripete il corpo finché la condizione resta vera.
  • Per (For): ciclo con contatore che varia da un valore iniziale a un valore finale con passo crescente o decrescente.
  • Fai-mentre (Do-While): ciclo post-condizionale che esegue il corpo almeno una volta e ripete finché la condizione è vera.
  • Chiama: invoca una funzione/procedura o un metodo (es. ordina(v, n), p.sposta(2, 3), super(...)).
  • Prova / Cattura / Infine (Try / Catch / Finally) e Lancia (Throw): intercetta o solleva eccezioni a runtime (es. DivisionByZero, IndexOutOfRange, InvalidConversion, NullReference, FileError, o eccezioni personalizzate definite nel diagramma delle classi). Nel ramo Catch è disponibile e.message.
  • File (Apri, Leggi, Scrivi, Chiudi): legge o scrive file di testo virtuali gestiti nella scheda "File" del pannello destro; la funzione EOF() controlla se il file in lettura è finito.
  • Commento e Punto di interruzione (ferma l'esecuzione per il debug, sempre o con condizione; anche con F9 o clic destro "Esegui fino a qui").
- BARRA IN ALTO, VISTE E PLUGIN:
  • Menu File: Nuovo, Apri .fprg (Ctrl+O), Apri da indirizzo web, Salva .fprg (Ctrl+S), Esporta SVG / PNG / PDF completo, Lingua (Italiano / English), Plugin, Installa come app.
  • Selettore "Funzioni / Oggetti": passa dalla vista procedurale (Funzioni) alla vista ad Oggetti (diagramma delle classi UML con attributi + pubblico, - privato, # protetto, metodi, costruttori, ereditarietà, classi astratte, eccezioni e Tipi Generici <T>).
  • Pulsante "Plugin" (in alto a destra e barra rapida in basso a destra): gestisce i plugin come Pierangelo AI, Correttore Automatico (Test), Analizzatore di Complessità O(n) e Linter.

2. SUPPORTO AGLI ESERCIZI (METODO SOCRATICO — VIETATO DARE LA SOLUZIONE DIRETTA):
- REGOLA FONDAMENTALE E INVIOLABILE: NON dare MAI la soluzione completa di un esercizio, NON scrivere la sequenza completa dei blocchi pronta da copiare e NON scrivere il codice risolutivo completo.
- Dai SOLO dritte, indizi ragionati e domande guida (1 o 2 passi alla volta).
- ECCEZIONE SPECIALE:
  • Se l'utente chiede "cos'è la masturbazione del codice", rispondi ESATTAMENTE con: "Ehehehe la masturbazione del codice (il code masturbing ahhaha) prevede la scrittura del codice a una mano eheheh (one handed programming) ehhehe mentre con l'altra il divertimento ehehehe"
  • Se la domanda dell'utente contiene qualsiasi cosa con "masturbing", mantieni questo stesso tono scherzoso ("eheheh", parlando del code masturbing / programmazione a una mano) e verso la fine della risposta DEVI dire almeno un "va ben eheh?"`;

  const CODE_MASTURBING_REPLY = "Ehehehe la masturbazione del codice (il code masturbing ahhaha) prevede la scrittura del codice a una mano eheheh (one handed programming) ehhehe mentre con l'altra il divertimento ehehehe";

  function isCodeMasturbingQuestion(text) {
    const q = String(text || '').toLowerCase();
    return q.includes('masturbazione del codice');
  }

  function hasMasturbingKeyword(text) {
    return /masturbing/i.test(String(text || ''));
  }

  function ensureVaBenEheh(reply) {
    const r = String(reply || '').trim();
    if (/va ben\s+eheh\??/i.test(r)) return r;
    return r + ' va ben eheh?';
  }

  const BLOCK_DOCS_IT = {
    declare: {
      name: 'Dichiara',
      shortcut: 'D',
      desc: 'Serve a creare una o più variabili prima di usarle nel programma, scegliendo il tipo (`Intero`, `Reale`, `Stringa`, `Booleano` o una classe). Puoi anche assegnare subito un valore iniziale (es. `somma ← 0`) o creare un **array** indicando la dimensione (es. `10` o `3, 4`) oppure i valori iniziali tra graffe (es. `{1, 2, 3}`).'
    },
    const: {
      name: 'Costante',
      shortcut: 'K',
      desc: 'Definisce una costante il cui valore non può mai essere modificato durante l\'esecuzione (es. `MAX: Intero ← 100`). È utile per rendere il diagramma più leggibile ed evitare numeri fissi sparsi nei blocchi.'
    },
    assign: {
      name: 'Assegna',
      shortcut: 'A',
      desc: 'Calcola il valore dell\'espressione a destra e lo salva nella variabile indicata a sinistra (es. `contatore ← contatore + 1`). Prima di assegnare una variabile ricordati di dichiararla con un blocco **Dichiara**!'
    },
    input: {
      name: 'Input',
      shortcut: 'I',
      desc: 'Mette in pausa l\'esecuzione e chiede all\'utente di digitare un valore nella **Console** (nel pannello a destra), salvandolo nella variabile scelta.'
    },
    output: {
      name: 'Output',
      shortcut: 'O',
      desc: 'Mostra nella **Console** il risultato di un\'espressione o un messaggio di testo (tra virgolette `"..."`). Per unire testo e variabili usa l\'operatore `&`, ad esempio: `"Risultato: " & totale`.'
    },
    if: {
      name: 'Se (Condizione)',
      shortcut: 'S',
      desc: 'Controlla una condizione logica (es. `x > 0`, `n mod 2 == 0`): se è **Vera** segue il ramo di destra (`Vero`), altrimenti segue il ramo di sinistra (`Falso`).'
    },
    while: {
      name: 'Mentre (While)',
      shortcut: 'M',
      desc: 'È un ciclo con controllo in testa: valuta la condizione e, finché è **Vera**, ripete i blocchi nel corpo del ciclo. Attenzione a modificare dentro il corpo le variabili della condizione, altrimenti il ciclo non termina!'
    },
    for: {
      name: 'Per (For)',
      shortcut: 'P',
      desc: 'È il ciclo ideale quando sai già quante volte ripetere un\'azione: fa variare automaticamente una variabile contatore dal valore iniziale al valore finale (con passo crescente o decrescente).'
    },
    do: {
      name: 'Fai-mentre (Do-While)',
      shortcut: 'F',
      desc: 'È un ciclo con controllo in coda: esegue il corpo **almeno una volta** e poi controlla la condizione; se è vera ripete il ciclo. Molto utile per validare un dato letto in `Input`!'
    },
    call: {
      name: 'Chiama',
      shortcut: 'C',
      desc: 'Chiama una funzione o un metodo che non restituisce valori (oppure `super(...)` come primo blocco di un costruttore nella vista Oggetti).'
    },
    try: {
      name: 'Prova (Try / Catch / Finally)',
      shortcut: 'T',
      desc: 'Permette di gestire gli errori (eccezioni) durante l\'esecuzione: esegue i blocchi nel ramo **Prova** (`Try`); se si verifica un errore compatibile, salta al ramo **Cattura** (`Catch`, dove puoi leggere `e.message`), e infine esegue sempre l\'eventuale blocco **Infine** (`Finally`).'
    },
    throw: {
      name: 'Lancia (Throw)',
      shortcut: 'G',
      desc: 'Solleva un\'eccezione (es. `new InvalidArgument("Valore negativo")` o una tua classe eccezione definita nel diagramma delle classi) interrompendo il flusso normale.'
    },
    comment: {
      name: 'Commento',
      shortcut: '/',
      desc: 'Aggiunge una nota descrittiva nel diagramma per spiegare cosa fa una parte dell\'algoritmo. Non ha effetto sull\'esecuzione.'
    },
    breakpoint: {
      name: 'Punto di interruzione',
      shortcut: 'B',
      desc: 'Mette in pausa l\'esecuzione in quel punto (sempre oppure solo quando una condizione è vera) così puoi controllare il valore delle variabili nella scheda **Variabili**.'
    },
    open: {
      name: 'Apri file',
      shortcut: 'Maiusc+A',
      desc: 'Apre un file di testo virtuale (dalla scheda **File** nel pannello destro) in modalità lettura o scrittura.'
    },
    read: {
      name: 'Leggi da file',
      shortcut: 'Maiusc+L',
      desc: 'Legge la riga successiva dal file aperto in lettura e la salva nella variabile indicata. Usa `EOF()` nella condizione di un ciclo `Mentre (not EOF())` per fermarti a fine file.'
    },
    write: {
      name: 'Scrivi su file',
      shortcut: 'Maiusc+S',
      desc: 'Scrive una riga nel file attualmente aperto in scrittura.'
    },
    close: {
      name: 'Chiudi file',
      shortcut: 'Maiusc+C',
      desc: 'Chiude il file aperto in lettura o in scrittura (salvando le modifiche nella scheda **File**).'
    }
  };

  const CHIP_QUESTIONS = {
    it: {
      selected: 'Che cosa fa il blocco che ho selezionato e come si usa?',
      hint: 'Mi dai un indizio su come impostare o proseguire il mio esercizio nel diagramma?',
      error: 'Mi aiuti a capire perché il mio diagramma ha un problema o un errore, senza darmi la soluzione pronta?',
      guide: 'Dove trovo i blocchi e gli strumenti principali in FlowLab?'
    },
    en: {
      selected: 'What does the block I selected do and how is it used?',
      hint: 'Can you give me a hint on how to set up or continue my exercise in the flowchart?',
      error: 'Can you help me understand why my flowchart has a problem or an error, without giving me the full solution?',
      guide: 'Where can I find the main blocks and tools in FlowLab?'
    }
  };

  let prevInteractionId = null;
  let lastUsedModel = null;
  let busy = false;
  let history = [];
  let hostApiKey = typeof HOST_GEMINI_KEY === 'string' ? HOST_GEMINI_KEY.trim() : '';
  let secretLoadPromise = null;
  let domBound = false;

  const $ = (s, el) => (el || document).querySelector(s);
  const isEn = () => typeof I18n !== 'undefined' && I18n.lang === 'en';

  /* -------------------- Gestione Chiave Gemini (`secret`) -------------------- */
  function parseSecretText(raw) {
    if (!raw) return '';
    for (const line of String(raw).split(/\r?\n/)) {
      let s = line.trim();
      if (!s || s.startsWith('#') || s.startsWith('//') || s.startsWith('/*') || s.startsWith('*')) continue;
      s = s.replace(/^(?:window\.)?(?:export\s+|const\s+|let\s+|var\s+)?(?:FLOWLAB_SECRET|GEMINI_API_KEY|GOOGLE_API_KEY|API_KEY|KEY|SECRET)\s*[:=]\s*/i, '').trim();
      s = s.replace(/;+$/, '').trim();
      s = s.replace(/^['"`]|['"`]$/g, '').trim();
      if (s && !/^inserisci/i.test(s) && !/^your_/i.test(s) && s !== '...') {
        return s;
      }
    }
    return '';
  }

  function loadSecretViaScript(url) {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      const onErr = (ev) => {
        const msg = (ev && ev.message) || '';
        const m = msg.match(/(?:ReferenceError:\s*|variable:\s*)(AIza[0-9A-Za-z_]{20,})/);
        if (m && m[1] && !hostApiKey) {
          hostApiKey = m[1];
          if (ev.preventDefault) ev.preventDefault();
        }
      };
      window.addEventListener('error', onErr);
      const done = () => {
        window.removeEventListener('error', onErr);
        s.remove();
        if (typeof window.FLOWLAB_SECRET === 'string') {
          const parsed = parseSecretText(window.FLOWLAB_SECRET);
          if (parsed) hostApiKey = parsed;
        }
        resolve(hostApiKey);
      };
      s.onload = done;
      s.onerror = done;
      document.head.appendChild(s);
    });
  }

  async function ensureSecretLoaded() {
    if (hostApiKey) return hostApiKey;
    if (typeof window.FLOWLAB_SECRET === 'string') {
      const parsed = parseSecretText(window.FLOWLAB_SECRET);
      if (parsed) {
        hostApiKey = parsed;
        updateStatusBadge();
        return hostApiKey;
      }
    }
    if (secretLoadPromise) return secretLoadPromise;
    secretLoadPromise = (async () => {
      for (const path of ['./secret', '../secret']) {
        try {
          const r = await fetch(path, { cache: 'no-store' });
          if (r.ok) {
            const txt = await r.text();
            const parsed = parseSecretText(txt);
            if (parsed) {
              hostApiKey = parsed;
              updateStatusBadge();
              return hostApiKey;
            }
          }
        } catch (e) { /* su file:// fetch può essere bloccato dal browser */ }
      }
      for (const path of ['../secret', './secret']) {
        await loadSecretViaScript(path);
        if (hostApiKey) {
          updateStatusBadge();
          return hostApiKey;
        }
      }
      if (!hostApiKey) secretLoadPromise = null;
      return hostApiKey;
    })();
    return secretLoadPromise;
  }

  function getApiKey() {
    if (typeof window.FLOWLAB_SECRET === 'string') {
      const wKey = parseSecretText(window.FLOWLAB_SECRET);
      if (wKey) hostApiKey = wKey;
    }
    return (hostApiKey || '').trim();
  }

  /* -------------------- Lettura Contesto Diagramma -------------------- */
  function findStmtById(list, id) {
    for (const s of list || []) {
      if (s.id === id) return s;
      for (const b of ['then', 'else', 'body', 'finally']) {
        if (Array.isArray(s[b])) {
          const found = findStmtById(s[b], id);
          if (found) return found;
        }
      }
      if (Array.isArray(s.catches)) {
        for (const c of s.catches) {
          if (Array.isArray(c.body)) {
            const found = findStmtById(c.body, id);
            if (found) return found;
          }
        }
      }
    }
    return null;
  }

  function describeStmt(s) {
    if (!s) return null;
    const info = BLOCK_DOCS_IT[s.kind] || { name: s.kind };
    let detail = '';
    switch (s.kind) {
      case 'declare':
        detail = `${s.name || '(senza nome)'}: ${s.type}${s.array ? `[${s.size || '?'}]` : ''}${s.init ? ' ← ' + s.init : ''}`;
        break;
      case 'const':
        detail = `${s.name || '(senza nome)'}: ${s.type} ← ${s.expression || '?'}`;
        break;
      case 'assign':
        detail = `${s.variable || '?'} ← ${s.expression || '?'}`;
        break;
      case 'input':
        detail = `variabile: ${s.variable || '(vuota)'}`;
        break;
      case 'output':
        detail = `espressione: ${s.expression || '(vuota)'}`;
        break;
      case 'if':
      case 'while':
      case 'do':
        detail = `condizione: ${s.expression || '(vuota)'}`;
        break;
      case 'for':
        detail = `${s.variable || '?'} da ${s.start || '?'} a ${s.end || '?'} (${s.direction === 'dec' ? 'decrescente' : 'crescente'}, passo ${s.step || '1'})`;
        break;
      case 'call':
        detail = `${s.expression || '(vuota)'}`;
        break;
      case 'try':
        detail = `Prova (${(s.catches || []).map((c) => `Catch ${c.variable || 'e'}: ${c.type || 'Exception'}`).join(', ')}${s.finally && s.finally.length ? ' + Finally' : ''})`;
        break;
      case 'throw':
        detail = `Lancia ${s.expression || '(vuota)'}`;
        break;
      case 'comment':
        detail = `"${s.text || ''}"`;
        break;
      default:
        detail = JSON.stringify(s);
    }
    return { kind: s.kind, label: info.name, detail, raw: s };
  }

  function getDiagramContext() {
    const fl = window.FlowLab;
    if (!fl || !fl.state || !fl.state.prog) return { summary: 'Nessun programma caricato.' };
    const st = fl.state;
    const prog = st.prog;
    const curFn = prog.functions[st.fi] || prog.functions[0];
    const selStmt = st.sel && curFn ? findStmtById(curFn.body, st.sel) : null;
    const selDesc = describeStmt(selStmt);
    const errStmt = fl.run && fl.run.errId && curFn ? findStmtById(curFn.body, fl.run.errId) : null;
    const errDesc = describeStmt(errStmt);
    const statusEl = $('#statusText');
    const statusText = statusEl ? statusEl.textContent.trim() : '';
    const isErr = $('#status') && $('#status').classList.contains('error');

    let pseudo = '';
    if (typeof CodeGen !== 'undefined' && CodeGen.generate) {
      pseudo = CodeGen.generate(prog, 'pseudo');
      if (pseudo.length > 3500) pseudo = pseudo.slice(0, 3500) + '\n... (troncato)';
    }

    const lines = [
      `Lingua interfaccia: ${isEn() ? 'English' : 'Italiano'}`,
      `Nome programma: ${prog.attrs && prog.attrs.name ? prog.attrs.name : 'Programma'}`,
      prog.attrs && prog.attrs.about ? `Descrizione/Traccia: ${prog.attrs.about}` : '',
      `Vista attiva: ${st.view === 'objects' ? (st.uml ? 'Oggetti (Diagramma classi UML)' : 'Oggetti (Metodo)') : 'Funzioni'}`,
      curFn ? `Funzione/Metodo aperto: ${curFn.name} (${(curFn.body || []).length} blocchi principali)` : '',
      selDesc ? `Blocco selezionato dallo studente: [${selDesc.label}] ${selDesc.detail}` : 'Blocco selezionato: nessuno',
      isErr ? `ERRORE RILEVATO: ${statusText}${errDesc ? ` sul blocco [${errDesc.label}] (${errDesc.detail})` : ''}` : `Stato esecuzione: ${statusText}`,
      pseudo ? `Pseudocodice attuale del diagramma:\n${pseudo}` : ''
    ].filter(Boolean);

    return {
      prog,
      curFn,
      selDesc,
      errDesc,
      isErr,
      statusText,
      pseudo,
      summary: lines.join('\n')
    };
  }

  /* -------------------- Rendering Messaggi & Guida Locale -------------------- */
  function renderMarkdown(text) {
    const esc = (s) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const blocks = [];
    const withPlaceholders = String(text || '').replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (_, code) => {
      const idx = blocks.length;
      blocks.push(`<pre><code>${esc(code.trim())}</code></pre>`);
      return `\u0000CODE${idx}\u0000`;
    });

    const inlineFmt = (line) => esc(line)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');

    const lines = withPlaceholders.split(/\r?\n/);
    let html = '';
    let inList = false;

    for (const raw of lines) {
      const trimmed = raw.trim();
      if (/^\u0000CODE(\d+)\u0000$/.test(trimmed)) {
        if (inList) { html += '</ul>'; inList = false; }
        const idx = +trimmed.match(/^\u0000CODE(\d+)\u0000$/)[1];
        html += blocks[idx];
        continue;
      }
      const listMatch = trimmed.match(/^(?:[-•*]|\d+\.)\s+(.*)$/);
      if (listMatch) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${inlineFmt(listMatch[1])}</li>`;
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        if (trimmed) {
          html += `<p>${inlineFmt(trimmed)}</p>`;
        }
      }
    }
    if (inList) html += '</ul>';
    return html.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => blocks[+i]);
  }

  function localTutorReply(userQuestion, ctx) {
    if (isCodeMasturbingQuestion(userQuestion)) {
      return hasMasturbingKeyword(userQuestion)
        ? ensureVaBenEheh(CODE_MASTURBING_REPLY)
        : CODE_MASTURBING_REPLY;
    }
    if (hasMasturbingKeyword(userQuestion)) {
      return ensureVaBenEheh(CODE_MASTURBING_REPLY);
    }
    const q = userQuestion.toLowerCase();

    if ((q.includes('questo blocco') || q.includes('blocco selezionato') || q.includes('blocco che ho selezionato') || q.includes('selected block') || q.includes('block i selected')) && ctx.selDesc) {
      const d = BLOCK_DOCS_IT[ctx.selDesc.kind];
      return `Hai selezionato un blocco **${ctx.selDesc.label}** (\`${ctx.selDesc.detail}\`).\n\n` +
        `${d ? d.desc : ''}\n\n` +
        `- Per **modificarlo**: fai doppio clic sul blocco oppure premi \`Invio\`.\n` +
        `- Per **spostarlo**: trascinalo su un'altra freccia o usa \`Alt+↑\` / \`Alt+↓\`.`;
    }
    if (q.includes('questo blocco') || q.includes('blocco selezionato') || q.includes('blocco che ho selezionato') || q.includes('selected block') || q.includes('block i selected')) {
      return `Al momento non hai selezionato nessun blocco nel diagramma.\n\n` +
        `Clicca con il tasto sinistro su un blocco del diagramma di flusso per selezionarlo (diventerà bordato) e poi chiedimi pure **"Che fa questo blocco?"**, oppure dimmi il nome del blocco che ti interessa (es. *Dichiara*, *Assegna*, *Se*, *Mentre*, *Per*, *Prova*)!`;
    }

    for (const [, info] of Object.entries(BLOCK_DOCS_IT)) {
      const kName = info.name.toLowerCase().split(' ')[0];
      if (q.includes(`blocco ${kName}`) || q.includes(`come funziona ${kName}`) || q.includes(`cosa fa ${kName}`) || (q.includes(kName) && (q.includes('blocco') || q.includes('serve') || q.includes('usa')))) {
        return `### Blocco ${info.name}${info.shortcut ? ` (scorciatoia \`${info.shortcut}\`)` : ''}\n\n` +
          `${info.desc}\n\n` +
          `**Dove lo trovi:** clicca su una qualsiasi **freccia** del diagramma e scegli **${info.name}** dal menu dei blocchi.`;
      }
    }

    if (q.includes('dove trovo') || q.includes('guida piattaforma') || q.includes('platform guide') || q.includes('main blocks and tools') || q.includes('come funzionano i blocchi') || q.includes('aggiungere un blocco') || q.includes('come si usa')) {
      return `Ecco una bussola rapida di **FlowLab**:\n\n` +
        `- **Aggiungere un blocco**: clicca su una **freccia** tra due blocchi (compare il pallino \`+\`) oppure seleziona un blocco e premi l'iniziale (\`D\` Dichiara, \`A\` Assegna, \`I\` Input, \`O\` Output, \`S\` Se, \`M\` Mentre, \`P\` Per, \`T\` Prova/Try).\n` +
        `- **Modificare, selezionare o eliminare**: **doppio clic** (o \`Invio\`) su un blocco per modificarlo, \`Maiusc+clic\` o rettangolo col mouse per selezionarne più d'uno, \`Canc\` per eliminarlo.\n` +
        `- **Eseguire e fare debug**: in alto trovi **Esegui** (\`F5\`) e **Passo** (\`F10\`), più i punti di interruzione (\`F9\` o clic destro sul blocco).\n` +
        `- **Plugin Preinstallati**: clicca su **Plugin** in alto (o sui pulsanti rapidi in basso a destra) per usare il **Correttore Automatico (Test)**, l'**Analizzatore di Complessità O(n)** e il **Linter del diagramma**!`;
    }

    if (q.includes('array') || q.includes('vettor') || q.includes('matric')) {
      return `Per usare gli **array** (vettori o matrici) in FlowLab:\n\n` +
        `- **Dichiarazione**: inserisci un blocco **Dichiara**, spunta **Array** e scrivi la dimensione (es. \`10\` o \`3, 4\`) oppure direttamente i valori iniziali tra parentesi graffe (es. \`{1, 2, 3}\`).\n` +
        `- **Accesso agli elementi**: gli indici partono da \`0\` fino a \`dimensione - 1\` (es. \`v[i]\` o \`m[r, c]\`). La funzione \`Size(v)\` restituisce il numero di elementi.\n` +
        `- **Debug visuale**: durante l'esecuzione passo-passo (\`F10\`), nella scheda **Variabili** clicca sull'icona accanto all'array per aprirlo in una finestra grafica interattiva!`;
    }

    if (q.includes('eccezion') || q.includes('try') || q.includes('catch') || q.includes('throw') || q.includes('prova')) {
      return `Per gestire le **eccezioni** in FlowLab:\n\n` +
        `- Usa il blocco **Prova (Try)** (scorciatoia \`T\`): metti nel ramo principale le istruzioni che potrebbero fallire e nel ramo **Catch** cosa fare se si verifica l'errore (puoi stampare \`e.message\`).\n` +
        `- Puoi aggiungere anche un blocco **Finally** (eseguito sempre alla fine) o sollevare un errore con il blocco **Lancia (Throw)** (scorciatoia \`G\`).`;
    }

    if (q.includes('class') || q.includes('oggett') || q.includes('uml') || q.includes('eredit')) {
      return `Nella **Vista Oggetti** (pulsante **Oggetti** nella barra in alto):\n\n` +
        `- Vedi il **diagramma delle classi UML**: clic destro su una classe per aggiungere **attributi** (\`+\` pubblico, \`-\` privato, \`#\` protetto), **costruttori** e **metodi**.\n` +
        `- Fai **doppio clic su un metodo** per disegnare il suo diagramma di flusso.\n` +
        `- Per creare un oggetto in un blocco **Assegna**: \`p ← new Punto(1, 2)\` e poi usa il punto (\`p.\`) per l'autocompletamento!`;
    }

    if (ctx.isErr || q.includes('errore') || q.includes('error') || q.includes('non funziona') || q.includes('problema')) {
      if (ctx.isErr) {
        return `Ho guardato lo stato del tuo diagramma e vedo questo messaggio:\n\n` +
          `> **${ctx.statusText}**${ctx.errDesc ? ` nel blocco **${ctx.errDesc.label}** (\`${ctx.errDesc.detail}\`)` : ''}\n\n` +
          `**Indizio per risolverlo da solo:**\n` +
          `- Tutte le variabili usate in quel blocco sono state prima create con un blocco **Dichiara** del tipo giusto e inizializzate?\n` +
          `- Prova anche ad aprire il plugin **Linter** (in basso a destra) per verificare subito eventuali variabili non inizializzate o cicli rischiosi!`;
      }
      const stmts = (ctx.curFn && ctx.curFn.body) || [];
      if (!stmts.length) {
        return `Il tuo diagramma in **${ctx.curFn ? ctx.curFn.name : 'Inizio'}** è ancora vuoto!\n\n` +
          `Clicca sulla freccia tra **Inizio** e **Fine** per inserire il primo blocco. Chiediti: *di quali variabili ho bisogno all'inizio del problema?*`;
      }
      return `Per trovare il problema nel tuo diagramma senza svelarti la soluzione, ti consiglio questa strategia:\n\n` +
        `1. Clicca sul plugin **Linter** in basso a destra per controllare se ci sono variabili non inizializzate o rami vuoti.\n` +
        `2. Premi **Passo** (\`F10\`) e osserva la scheda **Variabili** a destra.\n` +
        `3. Controlla bene l'operatore delle condizioni nei blocchi **Se** o **Mentre** (\`< \`, \`<=\`, \`==\`).`;
    }

    const stmts = (ctx.curFn && ctx.curFn.body) || [];
    const hasDecl = stmts.some((s) => s.kind === 'declare');
    const hasInput = stmts.some((s) => s.kind === 'input');
    const hasLoop = stmts.some((s) => ['while', 'for', 'do'].includes(s.kind));
    const hasOut = stmts.some((s) => s.kind === 'output');

    let stepHint = '';
    if (stmts.length === 0) {
      stepHint = `Vedo che il diagramma è ancora vuoto. Partiamo dal **Passo 1 (I dati)**:\n` +
        `- Quali dati deve inserire l'utente da tastiera?\n` +
        `- Crea prima un blocco **Dichiara** per le tue variabili e poi un blocco **Input** per leggerle!`;
    } else if (!hasDecl) {
      stepHint = `Nel tuo diagramma ci sono già dei blocchi, ma non vedo ancora un blocco **Dichiara** all'inizio: ricorda che in FlowLab ogni variabile va dichiarata con il suo tipo prima di essere usata.`;
    } else if (!hasInput && !hasLoop) {
      stepHint = `Hai già dichiarato le variabili! Ora chiediti:\n` +
        `- Ti serve leggere dei valori dall'utente con un blocco **Input**?\n` +
        `- Oppure devi prendere una decisione (**Se**) o ripetere un'operazione più volte (**Mentre** / **Per**)?`;
    } else if (!hasOut) {
      stepHint = `Hai già impostato la logica principale del diagramma! Ora ragiona sul **risultato finale**:\n` +
        `- In quale variabile si trova il risultato calcolato?\n` +
        `- Dove va posizionato il blocco **Output** (dentro il ciclo o *dopo* la fine del ciclo)?`;
    } else {
      stepHint = `Il tuo diagramma ha già dichiarazioni, elaborazione e output! Puoi metterlo alla prova con il plugin **Test (Correttore Automatico)** in basso a destra o eseguirlo con **Passo** (\`F10\`).`;
    }

    return `Ragioniamo insieme sul tuo esercizio (senza spoilerarti la soluzione pronta!).\n\n` +
      `${stepHint}\n\n` +
      `Se vuoi una dritta più mirata, scrivimi qui sotto **qual è la traccia dell'esercizio** e qual è il punto che ti mette in difficoltà!`;
  }

  /* -------------------- Chiamata API Gemini Interactions -------------------- */
  async function callGemini(userText, ctx) {
    await ensureSecretLoaded();
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('Chiave API non configurata.');

    const promptWithContext =
      `[Contesto attuale del diagramma dello studente in FlowLab]\n` +
      `${ctx.summary}\n\n` +
      `[Domanda dello studente]\n` +
      `${userText}\n\n` +
      `(Ricorda: se chiede aiuto su un esercizio, NON dare la soluzione diretta né il codice/blocchi completi, ma solo indizi socratici e domande guida.)`;

    const modelsToTry = [DEFAULT_MODEL, ...FALLBACK_MODELS.filter((m) => m !== DEFAULT_MODEL)];
    let lastErr = null;
    const url = `${INTERACTIONS_URL}?key=${encodeURIComponent(apiKey)}`;

    for (const model of modelsToTry) {
      const canUsePrev = Boolean(prevInteractionId && lastUsedModel === model);
      const makeBody = (usePrev) => {
        const b = {
          model,
          system_instruction: SYSTEM_PROMPT,
          input: promptWithContext,
        };
        if (usePrev && prevInteractionId) {
          b.previous_interaction_id = prevInteractionId;
        }
        return b;
      };

      let res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(makeBody(canUsePrev))
      });

      if (!res.ok && canUsePrev && (res.status === 400 || res.status === 404)) {
        prevInteractionId = null;
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(makeBody(false))
        });
      }

      if (!res.ok) {
        let errMsg = `Errore HTTP ${res.status}`;
        let errReason = '';
        try {
          const errJson = await res.json();
          const root = Array.isArray(errJson) ? errJson[0] : errJson;
          const errObj = (root && root.error) || root;
          if (errObj && errObj.message) errMsg = errObj.message;
          if (errObj && Array.isArray(errObj.details)) {
            const info = errObj.details.find((d) => d && d.reason);
            if (info && info.reason) errReason = info.reason;
          }
        } catch (e) { /* ignore */ }

        lastErr = new Error(errMsg);
        if (errReason === 'API_KEY_INVALID' || /API key not valid/i.test(errMsg) || res.status === 401 || res.status === 403) {
          throw lastErr;
        }
        if (res.status === 503 || res.status === 429 || res.status === 404 || res.status === 400) {
          continue;
        }
        throw lastErr;
      }

      const data = await res.json();
      const interaction = data.interaction || data;
      if (interaction.id) {
        prevInteractionId = interaction.id;
        lastUsedModel = model;
      }

      if (typeof interaction.output_text === 'string' && interaction.output_text.trim()) {
        return interaction.output_text.trim();
      }
      const steps = interaction.steps || [];
      const texts = [];
      for (const step of steps) {
        if (step.type === 'model_output' && Array.isArray(step.content)) {
          for (const part of step.content) {
            if (part.type === 'text' && part.text) texts.push(part.text);
          }
        }
      }
      if (texts.length) return texts.join('\n').trim();
      lastErr = new Error('Risposta vuota ricevuta da Gemini.');
    }

    throw lastErr || new Error('Impossibile contattare Gemini.');
  }

  /* -------------------- Controlli Interfaccia Chat -------------------- */
  function updateStatusBadge() {
    const sub = $('#paSub');
    const hasKey = !!getApiKey();
    if (sub) {
      sub.textContent = hasKey ? L('pa.subOnline') : L('pa.subOffline');
      sub.classList.toggle('online', hasKey);
    }
  }

  function addMessage(role, markdownText) {
    const box = $('#paMsgs');
    if (!box) return null;
    const msg = document.createElement('div');
    msg.className = 'pa-msg ' + (role === 'user' ? 'user' : 'bot');
    msg.innerHTML = renderMarkdown(markdownText);
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight;
    return msg;
  }

  function showTyping() {
    const box = $('#paMsgs');
    if (!box) return null;
    const el = document.createElement('div');
    el.className = 'pa-msg bot';
    el.innerHTML = '<div class="pa-typing" aria-label="Pierangelo"><span></span><span></span><span></span></div>';
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    return el;
  }

  function addWelcomeMessage() {
    const box = $('#paMsgs');
    if (!box) return;
    box.innerHTML = '';
    addMessage('bot', L('pa.welcomeMsg'));
  }

  function isEnabled() {
    if (typeof Plugins !== 'undefined' && Plugins.getState) {
      const st = Plugins.getState(PIERANGELO_ID);
      return st.installed && st.enabled;
    }
    return true;
  }

  function togglePanel(forceOpen) {
    const panel = $('#pierangeloPanel');
    const fab = $('#pierangeloFab');
    if (!panel || !fab) return;
    if (!isEnabled()) {
      panel.hidden = true;
      fab.setAttribute('aria-expanded', 'false');
      return;
    }
    const open = forceOpen != null ? forceOpen : panel.hidden;
    panel.hidden = !open;
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      ensureSecretLoaded();
      const inp = $('#paInput');
      if (inp) setTimeout(() => inp.focus(), 40);
    }
  }

  async function handleSend(rawText) {
    const text = String(rawText || '').trim();
    if (!text || busy) return;
    const inp = $('#paInput');
    const sendBtn = $('#paSend');
    if (inp) { inp.value = ''; inp.style.height = '34px'; }

    addMessage('user', text);
    history.push({ role: 'user', text });

    busy = true;
    if (sendBtn) sendBtn.disabled = true;
    const typingEl = showTyping();
    const ctx = getDiagramContext();

    try {
      await ensureSecretLoaded();
      let reply = '';
      let usedLocal = false;
      if (isCodeMasturbingQuestion(text)) {
        await new Promise((r) => setTimeout(r, 200));
        reply = CODE_MASTURBING_REPLY;
      } else if (getApiKey()) {
        try {
          reply = await callGemini(text, ctx);
        } catch (err) {
          reply = hasMasturbingKeyword(text)
            ? localTutorReply(text, ctx)
            : `*(${L('pa.fallbackNotice', { message: err.message })})*\n\n` + localTutorReply(text, ctx);
          usedLocal = true;
        }
      } else {
        await new Promise((r) => setTimeout(r, 240));
        reply = localTutorReply(text, ctx);
        usedLocal = true;
      }
      if (hasMasturbingKeyword(text)) {
        reply = ensureVaBenEheh(reply);
      }
      if (typingEl) typingEl.remove();
      addMessage('bot', reply);
      history.push({ role: 'bot', text: reply, local: usedLocal });
    } finally {
      if (typingEl && typingEl.isConnected) typingEl.remove();
      busy = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  function bindDomOnce() {
    if (domBound) return;
    const fab = $('#pierangeloFab');
    const panel = $('#pierangeloPanel');
    if (!fab || !panel) return;
    domBound = true;

    updateStatusBadge();
    addWelcomeMessage();
    ensureSecretLoaded();

    fab.addEventListener('click', () => togglePanel());
    $('#paCloseBtn').addEventListener('click', () => togglePanel(false));

    $('#paClearBtn').addEventListener('click', () => {
      prevInteractionId = null;
      lastUsedModel = null;
      history = [];
      addWelcomeMessage();
    });

    document.querySelectorAll('.pa-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const key = chip.getAttribute('data-chip');
        const lang = isEn() ? 'en' : 'it';
        const q = (CHIP_QUESTIONS[lang] && CHIP_QUESTIONS[lang][key]) || chip.getAttribute('data-q') || chip.textContent;
        if (q) handleSend(q);
      });
    });

    const form = $('#paForm');
    const inp = $('#paInput');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSend(inp.value);
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        handleSend(inp.value);
      }
    });
    inp.addEventListener('input', () => {
      inp.style.height = '34px';
      inp.style.height = Math.min(96, Math.max(34, inp.scrollHeight)) + 'px';
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.hidden) {
        togglePanel(false);
      }
    });
  }

  /* Registrazione di Pierangelo come plugin nel motore FlowLabPlugins */
  if (typeof FlowLabPlugins !== 'undefined' && FlowLabPlugins.register) {
    FlowLabPlugins.register({
      id: PIERANGELO_ID,
      getName: () => L('pa.pierangeloName'),
      getDesc: () => L('pa.pierangeloDesc'),
      version: '1.0',
      author: 'FlowLab Team',
      icon: () => (typeof PIERANGELO_ICON === 'string' && PIERANGELO_ICON)
        ? PIERANGELO_ICON
        : ($('#pierangeloFab img') ? $('#pierangeloFab img').getAttribute('src') : ''),
      showInDock: false, // Ha il suo pulsante circolare dedicato (#pierangeloFab)
      preinstalled: true,
      defaultInstalled: true,
      defaultEnabled: true,
      onInit: () => bindDomOnce(),
      onEnable: () => {
        bindDomOnce();
        const root = $('#pierangeloRoot');
        if (root) root.hidden = false;
        document.body.classList.remove('pa-disabled');
      },
      onDisable: () => {
        togglePanel(false);
        const root = $('#pierangeloRoot');
        if (root) root.hidden = true;
        document.body.classList.add('pa-disabled');
      },
      onOpen: () => togglePanel(true)
    });
  }

  return {
    id: PIERANGELO_ID,
    toggle: togglePanel,
    ask: handleSend
  };
})();
