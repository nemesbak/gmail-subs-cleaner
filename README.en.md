# Gmail Subs Cleaner

Clean up Gmail with **one label**: anything you tag `Subs` is moved to Spam automatically every
hour, and if it is a legitimate newsletter with a standard one-click unsubscribe, the script
unsubscribes first. It is a [Google Apps Script](https://script.google.com) that runs in your own
account — no servers, no dependencies.

> Español: see [README.md](README.md)

## What it does

For every thread labelled `Subs`:

| Case | Action |
| --- | --- |
| **Spam / phishing** (the usual case) | Moves it to **Spam** and removes the label. Gmail learns from it. **It never opens links or replies.** |
| **Legitimate newsletter** with `List-Unsubscribe` + `List-Unsubscribe-Post` headers (RFC 8058 one-click) **and** a valid DKIM signature | Sends the standard `POST` to unsubscribe, then moves it to Spam. |

### Why it does not "click every unsubscribe link"
Following the unsubscribe link of a spammer confirms your address is alive and usually brings
**more** spam. That is why only the *verifiable* one-click unsubscribe (RFC 8058 + DKIM) is used.
Body links are never scraped and no unsubscribe emails are sent.

## Install (5 minutes)

1. **Create the Gmail label** `Subs` (or change `LABEL` in the script).
2. Go to <https://script.google.com> → **New project**.
3. Replace the contents of `Code.gs` with [`subs-cleaner.gs`](subs-cleaner.gs) and save.
4. **Dry run first:** keep `DRY_RUN: true`, pick the `run` function and press **Run**.
   - Google asks for permission: *Review permissions* → your account → if you see *"Google hasn't
     verified this app"*, choose **Advanced → Go to (project) (unsafe)** → **Allow**. That is
     expected for your own unpublished script. Read the code first if you like.
   - Open the **Execution log**: it lists what it *would* do (`[prueba] SPAM: …`,
     `[prueba] BAJA 1-clic: …`). Nothing is touched.
5. **Turn it on:** set `DRY_RUN: false`, save, pick `install` and press **Run** once. This creates an
   hourly trigger.
6. To stop it, run `uninstall`.

Each run handles up to `MAX_THREADS` (40) threads; a backlog of hundreds clears in a few hours. You can
also run `run` manually several times.

## Configuration

```js
var CONFIG = {
  LABEL: 'Subs',      // Gmail label to process
  DRY_RUN: true,      // true = only log what it would do
  MAX_THREADS: 40,    // threads per run (Apps Script time limit)
  UNSUBSCRIBE: true   // one-click unsubscribe for signed, legitimate newsletters
};
```

## Safety and limits

- It requests access to your Gmail (modify labels / move to Spam), external requests (the one-click
  unsubscribe) and triggers. **Review the code before authorising** — it is ~100 lines.
- Anything moved to Spam can be recovered for 30 days.
- Apps Script quotas: 6 min per run and 20,000 external calls per day (consumer accounts).
- A one-click unsubscribe can confirm to a dubious sender that your address exists. Set
  `UNSUBSCRIBE: false` to send everything straight to Spam instead.

## Credits and thanks

The idea of **unsubscribing from newsletters in Gmail through a label and Google Apps Script**
comes from the **"Gmail Unsubscribe"** project by **[Amit Agarwal](https://github.com/labnol)**
([Digital Inspiration / labnol.org](https://www.labnol.org)), whose Google Workspace guides and
scripts have helped thousands of people for years. **Thank you, Amit!**

This repository is an **independent rewrite** (original code, no spreadsheet, conservative handling
of spam), not a copy or fork of his work. For the original tool, visit his site and GitHub.

## License

[MIT](LICENSE). Use it, change it, share it; please keep the credits above if you redistribute it.
