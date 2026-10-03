# Gmail Subs Cleaner

Limpia tu Gmail con **una etiqueta**: todo lo que marques con `Subs` se da de baja (si se puede) y se
manda a la Papelera, automáticamente cada hora. Es un script de
[Google Apps Script](https://script.google.com): corre en tu cuenta, sin servidores ni dependencias.

> English: see [README.en.md](README.en.md)

## Qué hace

Para cada conversación con la etiqueta `Subs`, **como hacía el script original**:

1. Intenta **darse de baja**, en este orden:
   1. enlace `https` de la cabecera `List-Unsubscribe` (POST si es baja de un clic RFC 8058, si no GET);
   2. enlace "unsubscribe / opt-out / darse de baja" dentro del cuerpo del correo;
   3. correo al `mailto:` de la cabecera `List-Unsubscribe` (solo si el correo trae firma DKIM válida).
2. **Quita la etiqueta** y manda el hilo a la **Papelera** (Gmail la vacía a los 30 días; se puede
   recuperar antes). Si la baja falla (dominio muerto, dirección inválida) se limpia igualmente.

Los remitentes de `PROTECT` (por defecto `accounts.google.com` y `groups.google.com`) **nunca se tocan**:
solo se les quita la etiqueta.

## Instalación (5 minutos)

1. **Crea la etiqueta** `Subs` en Gmail (o cambia `LABEL` en el script).
2. Entra en <https://script.google.com> → **Nuevo proyecto**.
3. Borra el contenido de `Código.gs`, pega el de [`subs-cleaner.gs`](subs-cleaner.gs) y guarda (Ctrl+S).
4. **Prueba sin riesgo:** deja `DRY_RUN: true`, elige la función `run` y pulsa **Ejecutar**.
   - Google pedirá permiso: *Revisar permisos* → tu cuenta → si dice *"Google no ha verificado esta
     aplicación"*, pulsa **Avanzado → Ir a (nombre del proyecto) (no seguro)** → **Permitir**.
     Es normal: el script es tuyo y no está publicado. Lee el código antes de autorizar.
   - Mira el **Registro de ejecución**: verás qué haría con cada correo (`[prueba] BAJA (cabecera): …`,
     `[prueba] SIN BAJA: …`). No se toca nada.
5. **Actívalo:** cambia `DRY_RUN: true` por `DRY_RUN: false`, guarda y pulsa **Ejecutar** en `run`.
   Después elige `install` y ejecútalo **una sola vez** para crear el activador (cada 15 minutos, como
   el original).
6. Para pararlo: ejecuta `uninstall`.

Una pasada procesa conversaciones hasta `MAX_SECONDS` (270 s); si tienes cientos, el activador acaba el
resto. Nunca corren dos ejecuciones a la vez (candado), y un correo que no se pueda leer se limpia
igualmente en vez de reintentarse para siempre. Al pegar el código en el editor asegúrate de que **todo** el contenido anterior queda
sustituido (Ctrl+A antes de pegar) y no quedan dos copias.

## Configuración

```js
var CONFIG = {
  LABEL: 'Subs',      // etiqueta de Gmail a procesar
  DRY_RUN: true,      // true = solo escribe en el registro lo que haría (no hace nada)
  AFTER: 'trash',     // después de la baja: 'trash' | 'spam' | 'archive' | 'none'
  SAFE_ONLY: false,   // true = solo da de baja si el correo trae firma DKIM válida
  PROTECT: ['accounts.google.com', 'groups.google.com'],  // remitentes que nunca se tocan
  MAX_SECONDS: 270,   // tiempo máximo por ejecución (Apps Script permite 360 s)
  BATCH: 20,          // conversaciones que se leen cada vez
  EVERY_MINUTES: 15,  // frecuencia del activador: 1, 5, 10, 15 o 30 (tras cambiarlo, ejecuta install)
  CLEAN_BOUNCES: true // manda a la Papelera los rebotes de los correos de baja que envió el script
};
```

## Qué esperar en el registro

- `[prueba] …`: modo prueba, no se toca nada.
- `respuesta de la baja: HTTP 200`: el remitente aceptó la baja.
- `respuesta de la baja: HTTP 302`: redirige a una página de confirmación; suele estar aceptada.
- `la baja falló (…); se limpia igualmente`: dominio inexistente o dirección inválida (típico del spam).
- `SIN BAJA`: el correo no trae ningún método de baja; solo se limpia.
- `Resumen: {…}`: totales de la pasada.

## Seguridad y límites

- Pide acceso a tu Gmail (leer, etiquetar, mover, **enviar** el correo de baja `mailto:`), conexión
  externa (la baja por enlace) y activadores. **Revisa el código antes de autorizar.**
- **Con spam real, darse de baja puede confirmar que tu dirección existe.** Para ser prudente pon
  `SAFE_ONLY: true` (solo bajas con firma DKIM válida) o usa `AFTER: 'spam'` en lugar de la Papelera.
- El correo de baja por `mailto:` solo se envía a remitentes con firma DKIM válida; el spam suele traer
  direcciones inventadas y solo te devolvería correos de rebote.
- Cuotas de Apps Script: 6 min por ejecución, 20.000 llamadas externas al día, 100 correos enviados
  al día (cuentas personales).

## Créditos y agradecimientos

La idea de **darse de baja de boletines desde Gmail con una etiqueta y Google Apps Script** viene del
proyecto **"Gmail Unsubscribe"** de **[Amit Agarwal](https://github.com/labnol)**
([Digital Inspiration / labnol.org](https://www.labnol.org)), que lleva años ayudando a miles de
personas con sus guías y scripts de Google Workspace. **¡Gracias, Amit!** Según su propio artículo, su versión amplía una idea anterior de **Joshua Peak**, que solo usaba la cabecera List-Unsubscribe. El proyecto original (labnol/unsubscribe-gmail) es de código abierto con licencia MIT.

Este repositorio es una **reescritura independiente** (código propio, sin hoja de cálculo), no una
copia ni un fork del original: mantiene su orden de baja (cabecera → enlace → correo) y añade modo
prueba, protección de remitentes, manejo de fallos y bucle por tiempo. Para la herramienta original,
visita su sitio y su GitHub.

## Licencia

[MIT](LICENSE). Úsalo, modifícalo y compártelo; mantén los créditos de arriba si lo redistribuyes.
