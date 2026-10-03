/**
 * Subs cleaner — da de baja y limpia lo que etiquetes "Subs" en Gmail.
 *
 * Idea original: "Gmail Unsubscribe" de Amit Agarwal (labnol.org). Esta es una
 * reescritura independiente, sin hoja de cálculo.
 *
 * Para cada conversación con la etiqueta:
 *   1. Se da de baja, en este orden (como el original):
 *        a) enlace https de la cabecera List-Unsubscribe  (POST si es baja de un clic RFC 8058, si no GET)
 *        b) enlace "unsubscribe / opt-out / darse de baja" del cuerpo del correo
 *        c) correo al mailto: de la cabecera List-Unsubscribe
 *   2. Quita la etiqueta y aplica CONFIG.AFTER (Papelera por defecto).
 *
 * USO
 *  1. Pega este código en un proyecto nuevo de Apps Script (script.google.com).
 *  2. Deja DRY_RUN = true y ejecuta "run": mira el Registro de ejecución (no toca nada).
 *  3. Si te gusta, pon DRY_RUN = false, ejecuta "run" y luego "install" una vez
 *     (crea un activador cada CONFIG.EVERY_MINUTES minutos).
 */
var CONFIG = {
  LABEL: 'Subs',
  DRY_RUN: true,        // true = solo escribe en el registro lo que haría (no hace nada)
  AFTER: 'trash',       // qué hacer después de la baja: 'trash' | 'spam' | 'archive' | 'none'
  SAFE_ONLY: false,     // true = solo da de baja si el correo trae firma DKIM válida (más prudente con spam)
  PROTECT: ['accounts.google.com', 'groups.google.com'],  // remitentes que NUNCA se tocan: solo se les quita la etiqueta
  MAX_SECONDS: 270,     // tiempo máximo por ejecución (Apps Script permite 360 s)
  BATCH: 20,            // conversaciones que se leen cada vez
  EVERY_MINUTES: 15,    // frecuencia del activador (como el original: 15 min). Valores válidos: 1, 5, 10, 15, 30
  CLEAN_BOUNCES: true   // manda a la Papelera los rebotes de los correos de baja enviados por el script
};

function run() {
  // evita dos ejecuciones a la vez (activador + ejecución manual)
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) { Logger.log('Ya hay otra ejecución en marcha; esta se salta.'); return; }
  try {
    process_();
    if (CONFIG.CLEAN_BOUNCES && !CONFIG.DRY_RUN) cleanBounces_();
  } finally {
    lock.releaseLock();
  }
}

function process_() {
  var label = GmailApp.getUserLabelByName(CONFIG.LABEL);
  if (!label) { Logger.log('No existe la etiqueta "%s".', CONFIG.LABEL); return; }

  var start = Date.now();
  var stats = { hilos: 0, cabecera: 0, enlace: 0, email: 0, sinBaja: 0, protegidos: 0, bajaFallida: 0, errores: 0 };
  var stuck = 0;   // hilos que siguen con la etiqueta (prueba o error): se saltan en la siguiente lectura
  var timeUp = function () { return Date.now() - start > CONFIG.MAX_SECONDS * 1000; };

  while (!timeUp()) {
    var threads = label.getThreads(stuck, CONFIG.BATCH);
    if (!threads.length) break;
    for (var i = 0; i < threads.length; i++) {
      if (timeUp()) break;
      var thread = threads[i];
      stats.hilos++;
      var done = false;
      try {
        var msg = thread.getMessages()[0];
        var raw = msg.getRawContent();
        var h = parseHeaders_(raw);
        var prot = isProtected_(msg.getFrom());
        var act = prot ? null : findUnsubscribe_(msg, h);
        var prefix = CONFIG.DRY_RUN ? '[prueba] ' : '';

        if (act) {
          Logger.log('%sBAJA (%s): %s | %s -> %s', prefix, act.type, msg.getFrom(), msg.getSubject(), act.url || act.to);
          if (!CONFIG.DRY_RUN) {
            // si la baja falla (dominio muerto, mailto inválido…) se limpia igualmente, como hacía el original
            try { unsubscribe_(act); }
            catch (e) { Logger.log('  la baja falló (%s); se limpia igualmente', e); stats.bajaFallida++; }
          }
          stats[act.type === 'cabecera' ? 'cabecera' : act.type === 'enlace' ? 'enlace' : 'email']++;
        } else if (prot) {
          Logger.log('%sPROTEGIDO (solo se quita la etiqueta): %s | %s', prefix, msg.getFrom(), msg.getSubject());
          stats.protegidos++;
        } else {
          Logger.log('%sSIN BAJA: %s | %s', prefix, msg.getFrom(), msg.getSubject());
          stats.sinBaja++;
        }

        if (!CONFIG.DRY_RUN) {
          cleanup_(thread, label, prot);
          done = true;
        }
      } catch (e) {
        stats.errores++;
        Logger.log('ERROR en un hilo: %s', e);
        // no se pudo leer el correo: se limpia igualmente para que no se reintente cada vez
        if (!CONFIG.DRY_RUN) {
          try { cleanup_(thread, label, false); done = true; }
          catch (e2) { Logger.log('  tampoco se pudo limpiar (%s); se reintentará', e2); }
        }
      }
      if (!done) stuck++;
    }
    if (threads.length < CONFIG.BATCH) break;
  }

  Logger.log('Resumen: %s', JSON.stringify(stats));
}

/** Quita la etiqueta y aplica CONFIG.AFTER (los protegidos solo pierden la etiqueta). */
function cleanup_(thread, label, prot) {
  thread.removeLabel(label);
  if (prot) return;
  if (CONFIG.AFTER === 'trash') thread.moveToTrash();
  else if (CONFIG.AFTER === 'spam') thread.moveToSpam();
  else if (CONFIG.AFTER === 'archive') thread.moveToArchive();
}

/**
 * Manda a la Papelera las conversaciones de correos de baja que envió el script y rebotaron
 * ("No se ha encontrado la dirección"). Solo toca hilos ENVIADOS por ti cuyo asunto contiene
 * "unsubscribe"/"baja" y que tienen respuesta de mailer-daemon.
 */
function cleanBounces_() {
  var threads = GmailApp.search('in:sent subject:(unsubscribe OR baja) newer_than:7d', 0, 50);
  var n = 0;
  threads.forEach(function (t) {
    var msgs = t.getMessages();
    // el script envía cuerpo == asunto; así no se toca ningún correo escrito por ti
    var first = msgs[0];
    if (first.getPlainBody().trim() !== first.getSubject().trim()) return;
    var bounced = msgs.some(function (m) { return /mailer-daemon|postmaster/i.test(m.getFrom()); });
    if (bounced) { t.moveToTrash(); n++; }
  });
  if (n) Logger.log('Rebotes de bajas limpiados: %s', n);
}

/** Crea (una vez) el activador periódico. Borra antes cualquier activador viejo. */
function install() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('run').timeBased().everyMinutes(CONFIG.EVERY_MINUTES).create();
  Logger.log('Activador creado para run() cada %s minutos.', CONFIG.EVERY_MINUTES);
}

/** Quita el activador. */
function uninstall() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  Logger.log('Activadores eliminados.');
}

// ---------- baja ----------

function findUnsubscribe_(msg, h) {
  var auth = (h['authentication-results'] || '').toLowerCase();
  if (CONFIG.SAFE_ONLY && auth.indexOf('dkim=pass') < 0) return null;

  var lu = h['list-unsubscribe'] || '';
  var oneClick = /list-unsubscribe\s*=\s*one-click/i.test(h['list-unsubscribe-post'] || '');

  // a) enlace https de la cabecera
  var m = lu.match(/<(https?:\/\/[^>\s]+)>/i);
  if (m && isPublicUrl_(m[1])) return { type: 'cabecera', url: m[1], oneClick: oneClick };

  // b) enlace de baja dentro del cuerpo
  var body = msg.getBody();
  var re = /<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  var a;
  while ((a = re.exec(body)) !== null) {
    var url = a[1].replace(/&amp;/g, '&');
    var text = a[2].replace(/<[^>]*>/g, ' ');
    if (/unsubscribe|opt-?out|optout|remove|desuscri|darse de baja/i.test(url + ' ' + text) && isPublicUrl_(url)) {
      return { type: 'enlace', url: url, oneClick: false };
    }
  }

  // c) correo al mailto de la cabecera (solo con firma DKIM válida: el spam suele traer direcciones
  //    inventadas y solo conseguirías correos de rebote en tu bandeja)
  var mt = auth.indexOf('dkim=pass') >= 0 ? lu.match(/<mailto:([^>]+)>/i) : null;
  if (mt) {
    var parts = mt[1].split('?');
    var to = decodeURIComponent(parts[0]).trim();
    var subject = 'Unsubscribe';
    var sm = (parts[1] || '').match(/subject=([^&]+)/i);
    if (sm) subject = decodeURIComponent(sm[1].replace(/\+/g, ' '));
    // no te envíes la baja a ti mismo (si el destinatario del mensaje es esa misma dirección)
    var recipients = (msg.getTo() || '').toLowerCase();
    if (to && recipients.indexOf(to.toLowerCase()) < 0) return { type: 'email', to: to, subject: subject };
  }
  return null;
}

function unsubscribe_(act) {
  if (act.type === 'email') {
    GmailApp.sendEmail(act.to, act.subject, act.subject);
    return;
  }
  var opts = { muteHttpExceptions: true, followRedirects: true };
  if (act.oneClick) {
    opts.method = 'post';
    opts.contentType = 'application/x-www-form-urlencoded';
    opts.payload = 'List-Unsubscribe=One-Click';
  }
  var r = UrlFetchApp.fetch(act.url, opts);
  Logger.log('  respuesta de la baja: HTTP %s', r.getResponseCode());
}

/** true si el remitente (From) pertenece a un dominio/dirección de CONFIG.PROTECT. */
function isProtected_(from) {
  from = (from || '').toLowerCase();
  return CONFIG.PROTECT.some(function (p) { return p && from.indexOf(p.toLowerCase()) >= 0; });
}

/** Evita llamar a direcciones internas (localhost, redes privadas). */
function isPublicUrl_(url) {
  var host = (url.match(/^https?:\/\/([^\/:?#]+)/i) || [])[1] || '';
  host = host.toLowerCase();
  if (!host || host === 'localhost' || /\.local$/.test(host)) return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(host)) return false;
  return true;
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
