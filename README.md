# Gmail Subs Cleaner

Limpia tu Gmail con **una etiqueta**: todo lo que marques con `Subs` se manda a Spam
automáticamente cada hora, y si es un boletín legítimo con baja estándar de un clic,
se da de baja antes. Es un script de [Google Apps Script](https://script.google.com):
corre en tu cuenta, sin servidores ni dependencias.

> English: see [README.en.md](README.en.md)

## Qué hace

Cada hora (o cuando lo ejecutes), para cada conversación con la etiqueta `Subs`:

| Caso | Acción |
| --- | --- |
| **Spam / phishing** (lo normal) | Lo manda a **Spam** y quita la etiqueta. Gmail aprende de ello. **No abre enlaces ni responde.** |
| **Boletín legítimo** con las cabeceras `List-Unsubscribe` + `List-Unsubscribe-Post` (baja de un clic, RFC 8058) **y** firma DKIM válida | Hace la baja con un `POST` estándar y luego lo manda a Spam. |

### Por qué no "pulsa todos los enlaces de baja"
Abrir el enlace de baja de un remitente de spam confirma que tu dirección está viva y suele traer
**más** spam. Por eso solo se usa la baja de un clic **verificable** (RFC 8058 + DKIM). Nunca se
raspan enlaces del cuerpo ni se envían correos de baja.

## Instalación (5 minutos)

1. **Crea la etiqueta** `Subs` en Gmail (o cambia `LABEL` en el script).
2. Entra en <https://script.google.com> → **Nuevo proyecto**.
3. Borra el contenido de `Código.gs`, pega el de [`subs-cleaner.gs`](subs-cleaner.gs) y guarda (Ctrl+S).
4. **Prueba sin riesgo:** deja `DRY_RUN: true`, elige la función `run` y pulsa **Ejecutar**.
   - Google pedirá permiso: *Revisar permisos* → tu cuenta → si dice *"Google no ha verificado esta
     aplicación"*, pulsa **Avanzado → Ir a (nombre del proyecto) (no seguro)** → **Permitir**.
     Es normal: el script es tuyo y no está publicado. Puedes leer el código antes.
   - Abre el **Registro de ejecución**: verás qué haría con cada correo (`[prueba] SPAM: …`,
     `[prueba] BAJA 1-clic: …`). No se toca nada.
5. **Actívalo:** cambia `DRY_RUN: true` por `DRY_RUN: false`, guarda, elige la función `install` y
   pulsa **Ejecutar** (una sola vez). Crea un activador horario.
6. Listo. Para pararlo: ejecuta `uninstall`.

Cada ejecución procesa hasta `MAX_THREADS` (40) conversaciones; si tienes cientos, se vacía en unas horas.
También puedes ejecutar `run` a mano varias veces.

## Configuración

```js
var CONFIG = {
  LABEL: 'Subs',      // etiqueta de Gmail a procesar
  DRY_RUN: true,      // true = solo escribe en el registro lo que haría
  MAX_THREADS: 40,    // conversaciones por ejecución (límite de tiempo de Apps Script)
  UNSUBSCRIBE: true   // baja de un clic para boletines legítimos firmados
};
```

## Seguridad y límites

- Pide acceso a tu Gmail (leer/modificar etiquetas y mover a Spam), conexión externa (la baja de un
  clic) y activadores. **Revisa el código antes de autorizar**; son ~100 líneas.
- Lo que va a Spam se puede recuperar durante 30 días.
- Cuotas de Apps Script: 6 min por ejecución y 20.000 llamadas externas al día (cuentas personales).
- La baja de un clic puede confirmar a un remitente dudoso que tu dirección existe. Si prefieres
  no hacerlo, pon `UNSUBSCRIBE: false` y todo irá solo a Spam.

## Qué esperar en el registro

- `[prueba] ...`: modo prueba (`DRY_RUN: true`), no se toca nada.
- `respuesta de la baja: HTTP 200`: el remitente aceptó la baja.
- `respuesta de la baja: HTTP 302`: el remitente redirige a una página de confirmación. El script no sigue redirecciones a propósito, así que no se puede confirmar la baja; suele estar aceptada. Si sigues recibiendo correo de ese remitente, ya va a Spam igualmente.

## Créditos y agradecimientos

La idea de **darse de baja de boletines desde Gmail con una etiqueta y Google Apps Script** viene del
proyecto **"Gmail Unsubscribe"** de **[Amit Agarwal](https://github.com/labnol)**
([Digital Inspiration / labnol.org](https://www.labnol.org)), que lleva años ayudando a miles de
personas con sus guías y scripts de Google Workspace. **¡Gracias, Amit!**

Este repositorio es una **reescritura independiente** (código propio, sin hoja de cálculo, con
enfoque conservador para spam), no una copia ni un fork del original. Si buscas la herramienta
original, visita su sitio y su GitHub.

## Licencia

[MIT](LICENSE). Úsalo, modifícalo y compártelo; mantén los créditos de arriba si lo redistribuyes.
