/**
 * Subs cleaner — limpia lo que etiquetas "Subs" en Gmail.
 *
 *  - SPAM / phishing (lo normal en "Subs"): lo manda a Spam. Gmail aprende de ello.
 *    No se abre ningún enlace del cuerpo y no se responde a nadie.
 *  - BOLETÍN legítimo: solo si trae la baja estándar de un clic (RFC 8058,
 *    cabeceras List-Unsubscribe + List-Unsubscribe-Post) Y el correo está firmado
 *    (DKIM pass), se hace la baja con un POST estándar. Después, a Spam igualmente.
 *
 * USO
 *  1. Pega este código en un proyecto nuevo de Apps Script (script.google.com).
 *  2. Deja DRY_RUN = true y ejecuta "run": mira el Registro de ejecución.
 *  3. Si te gusta lo que ve, pon DRY_RUN = false y ejecuta "install" una vez
 *     (crea un activador cada hora). Autoriza el acceso cuando Google lo pida.
 */
var CONFIG = {
  LABEL: 'Subs',
  DRY_RUN: true,      // true = solo escribe en el registro lo que haría
  MAX_THREADS: 40,    // hilos por ejecución (límite de tiempo de Apps Script)
  UNSUBSCRIBE: true   // baja de un clic para boletines legítimos firmados
};

function run() {
  var label = GmailApp.getUserLabelByName(CONFIG.LABEL);
  if (!label) { Logger.log('No existe la etiqueta "%s".', CONFIG.LABEL); return; }

  var threads = label.getThreads(0, CONFIG.MAX_THREADS);
  var stats = { hilos: threads.length, bajas: 0, spam: 0, errores: 0 };

  threads.forEach(function (thread) {
    try {
      var msg = thread.getMessages()[0];
      var h = parseHeaders_(msg.getRawContent());
      var from = msg.getFrom();
      var oneClick = CONFIG.UNSUBSCRIBE ? oneClickUrl_(h) : null;

      if (oneClick) {
        Logger.log('%s BAJA 1-clic: %s -> %s', CONFIG.DRY_RUN ? '[prueba]' : '', from, oneClick);
        if (!CONFIG.DRY_RUN) postUnsubscribe_(oneClick);
        stats.bajas++;
      }
      Logger.log('%s SPAM: %s | %s', CONFIG.DRY_RUN ? '[prueba]' : '', from, msg.getSubject());
      if (!CONFIG.DRY_RUN) {
        thread.removeLabel(label);
        thread.moveToSpam();
      }
      stats.spam++;
    } catch (e) {
      stats.errores++;
      Logger.log('ERROR en un hilo: %s', e);
    }
  });

  Logger.log('Resumen: %s', JSON.stringify(stats));
}

/** Crea (una vez) el activador horario. Borra antes cualquier activador viejo. */
function install() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('run').timeBased().everyHours(1).create();
  Logger.log('Activador horario creado para run().');
}

/** Quita el activador. */
function uninstall() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    ScriptApp.deleteTrigger(t);
  });
  Logger.log('Activadores eliminados.');
}

// ---------- utilidades ----------

function parseHeaders_(raw) {
  var head = raw.split(/\r?\n\r?\n/)[0].replace(/\r?\n[ \t]+/g, ' ');
  var out = {};
  head.split(/\r?\n/).forEach(function (line) {
    var i = line.indexOf(':');
    if (i > 0) {
      var k = line.slice(0, i).toLowerCase();
      out[k] = (out[k] ? out[k] + ' ' : '') + line.slice(i + 1).trim();
    }
  });
  return out;
}

/** Devuelve la URL https de baja de un clic solo si es legítima y verificable. */
function oneClickUrl_(h) {
  var lu = h['list-unsubscribe'] || '';
  var post = h['list-unsubscribe-post'] || '';
  var auth = (h['authentication-results'] || '').toLowerCase();
  if (!/list-unsubscribe\s*=\s*one-click/i.test(post)) return null;
  if (auth.indexOf('dkim=pass') < 0) return null;
  var m = lu.match(/<(https:\/\/[^>\s]+)>/i);
  return m ? m[1] : null;
}

function postUnsubscribe_(url) {
  var r = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: 'List-Unsubscribe=One-Click',
    followRedirects: false,
    muteHttpExceptions: true
  });
  Logger.log('  respuesta de la baja: HTTP %s', r.getResponseCode());
}
