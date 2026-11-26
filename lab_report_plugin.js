/* ==========================================================================
   Sample Standalone FlowLab Plugin — Generatore Scheda Relazione & Quiz
   File di prova autonomo (NON collegato a build.py):
   Puoi importarlo manualmente in FlowLab cliccando su:
   Plugin -> "Carica plugin da file (.js)…" -> scegli `lab_report_plugin.js`
   ========================================================================== */

FlowLabPlugins.register({
  id: 'lab-report-generator',
  name: 'Generatore Relazione & Statistiche (Markdown)',
  description: 'Conta tutti i blocchi del diagramma e genera automaticamente la scheda tecnica in Markdown (con pseudocodice e Java) pronta da copiare per la relazione di laboratorio.',
  shortLabel: 'Relazione',
  version: '1.0',
  author: 'Nicolas Caporale',
  iconSvg: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/></svg>',

  onOpen(ctx) {
    const { openModal, h, toast } = ctx.ui;
    const prog = ctx.prog;
    const counts = {};
    let total = 0;

    for (const fn of prog.functions) {
      ModelLib.walk(fn.body, (stmt) => {
        total++;
        counts[stmt.kind] = (counts[stmt.kind] || 0) + 1;
      });
    }

    const pseudo = CodeGen.generate(prog, 'pseudo');
    const javaCode = CodeGen.generate(prog, 'java');
    const oggi = new Date().toLocaleDateString('it-IT');

    const md = [
      `# Relazione di Laboratorio: ${prog.attrs.name || 'Programma'}`,
      `- **Data:** ${oggi}`,
      prog.attrs.authors ? `- **Autore:** ${prog.attrs.authors}` : null,
      prog.attrs.about ? `- **Traccia:** ${prog.attrs.about}` : null,
      '',
      `## 1. Statistiche del Diagramma`,
      `- **Funzioni / Metodi totali:** ${prog.functions.length}`,
      `- **Blocchi complessivi:** ${total}`,
      ...Object.entries(counts).map(([k, n]) => `  - Blocco \`${k}\`: **${n}**`),
      '',
      `## 2. Pseudocodice`,
      '```text',
      pseudo.trim(),
      '```',
      '',
      `## 3. Codice Java Generato`,
      '```java',
      javaCode.trim(),
      '```'
    ].filter((l) => l !== null).join('\n');

    const ta = h('textarea', {
      class: 'mono',
      rows: 14,
      readonly: true,
      style: 'width:100%'
    });
    ta.value = md;

    openModal({
      title: '📄 Generatore Relazione di Laboratorio',
      wide: true,
      body: h('div', { class: 'fields' },
        h('p', { class: 'help' }, 'Ecco la relazione generata dal tuo diagramma attuale. Puoi copiarla negli appunti o aggiungere un blocco Commento di intestazione nel diagramma:'),
        ta,
        h('div', { style: 'display:flex; gap:8px; justify-content:flex-end;' },
          h('button', {
            type: 'button',
            class: 'btn small',
            onclick: () => {
              const mainFn = prog.functions[0];
              if (!mainFn) return;
              mainFn.body.unshift(ModelLib.makeStmt('comment', {
                text: `${prog.attrs.name || 'Esercizio'} — ${prog.attrs.authors || 'Studente'} (${oggi})`
              }));
              ctx.flowlab.render();
              toast('Commento di intestazione aggiunto in cima al Main!', 'ok');
            }
          }, '+ Inserisci intestazione nel Main'),
          h('button', {
            type: 'button',
            class: 'btn small primary',
            onclick: async () => {
              await navigator.clipboard.writeText(md);
              toast('Relazione Markdown copiata negli appunti!', 'ok');
            }
          }, 'Copia Markdown negli appunti')
        )
      ),
      okText: 'Chiudi',
      noCancel: true
    });
  }
});
