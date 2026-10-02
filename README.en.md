# Gmail Subs Cleaner

Clean up Gmail with **one label**: anything you tag `Subs` is unsubscribed from (when possible) and
moved to Trash automatically every hour. It is a [Google Apps Script](https://script.google.com) that
runs in your own account — no servers, no dependencies.

> Español: see [README.md](README.md)

## What it does

For every thread labelled `Subs`, **like the original script did**:

1. Tries to **unsubscribe**, in this order:
   1. the `https` link in the `List-Unsubscribe` header (POST for RFC 8058 one-click, otherwise GET);
   2. an "unsubscribe / opt-out" link inside the message body;
   3. an email to the header's `mailto:` (only if the message has a valid DKIM signature).
2. **Removes the label** and moves the thread to **Trash** (Gmail empties it after 30 days; recoverable
   before that). If the unsubscribe fails (dead domain, invalid address) it is still cleaned up.

Senders in `PROTECT` (default `accounts.google.com`, `groups.google.com`) are **never touched**: only
the label is removed.

## Install (5 minutes)

1. **Create the Gmail label** `Subs` (or change `LABEL`).
2. Go to <https://script.google.com> → **New project**.
3. Replace `Code.gs` with [`subs-cleaner.gs`](subs-cleaner.gs) and save.
4. **Dry run first:** keep `DRY_RUN: true`, pick `run` and press **Run**.
   - Google asks for permission: *Review permissions* → your account → if you see *"Google hasn't
     verified this app"*, choose **Advanced → Go to (project) (unsafe)** → **Allow**. Expected for your
     own unpublished script. Read the code before authorising.
   - Open the **Execution log**: it lists what it *would* do. Nothing is touched.
5. **Turn it on:** set `DRY_RUN: false`, save, press **Run** on `run`, then pick `install` and run it
   **once** to create the hourly trigger.
6. To stop it, run `uninstall`.

A run works for up to `MAX_SECONDS` (270 s); the hourly trigger finishes any backlog. When pasting into
the editor make sure the old content is fully replaced (Ctrl+A first) so no second copy remains.

## Configuration

```js
var CONFIG = {
  LABEL: 'Subs',      // Gmail label to process
  DRY_RUN: true,      // true = only log what it would do (does nothing)
  AFTER: 'trash',     // after unsubscribing: 'trash' | 'spam' | 'archive' | 'none'
  SAFE_ONLY: false,   // true = only unsubscribe when the message has a valid DKIM signature
  PROTECT: ['accounts.google.com', 'groups.google.com'],  // senders that are never touched
  MAX_SECONDS: 270,   // max time per run (Apps Script allows 360 s)
  BATCH: 20           // threads read at a time
};
```

## What to expect in the log

- `[prueba] …`: dry-run mode, nothing is touched.
- `respuesta de la baja: HTTP 200`: the sender accepted the unsubscribe.
- `respuesta de la baja: HTTP 302`: redirect to a confirmation page; usually accepted.
- `la baja falló (…); se limpia igualmente`: non-existent domain or invalid address (typical of spam).
- `SIN BAJA`: no unsubscribe method in the message; it is just cleaned up.
- `Resumen: {…}`: totals for the run.

## Safety and limits

- It requests access to your Gmail (read, label, move, **send** the `mailto:` unsubscribe), external
  requests (link unsubscribes) and triggers. **Review the code before authorising.**
- **With real spam, unsubscribing can confirm your address is alive.** To be cautious set
  `SAFE_ONLY: true` (only DKIM-signed unsubscribes) or use `AFTER: 'spam'`.
- The `mailto:` unsubscribe is only sent to DKIM-signed senders; spam usually carries invented
  addresses and would only bring you bounce emails.
- Apps Script quotas: 6 min per run, 20,000 external calls per day, 100 sent emails per day
  (consumer accounts).

## Credits and thanks

The idea of **unsubscribing from newsletters in Gmail through a label and Google Apps Script** comes
from the **"Gmail Unsubscribe"** project by **[Amit Agarwal](https://github.com/labnol)**
([Digital Inspiration / labnol.org](https://www.labnol.org)), whose Google Workspace guides and scripts
have helped thousands of people for years. **Thank you, Amit!**

This repository is an **independent rewrite** (original code, no spreadsheet), not a copy or fork of
his work: it keeps his unsubscribe order (header → link → email) and adds a dry-run mode, sender
protection, failure handling and a time-budgeted loop. For the original tool, visit his site and GitHub.

## License

[MIT](LICENSE). Use it, change it, share it; please keep the credits above if you redistribute it.
