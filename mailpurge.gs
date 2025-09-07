/*
  - - - - - - - - - -
  I S T R U Z I O N I
  - - - - - - - - - -
  
  Passo 1. Immettete i valori desiderati per le variabili GMAIL_LABELS e PURGE_AFTER qui sotto.
           Potete aggiungere quante "label[n]" volete, anche una sola.
  Passo 2. Andate su  Run -> installTriggers     per installare i trigger. Verranno richieste anche le autorizzazioni all'accesso.
  Passo 3  Andate su  Run -> purgeGmail per eseguire lo script ed eliminare le email.
  
  Adesso potete uscire da questa finestra. Ogni messaggio email con l'etichetta selezionata sarà automaticamente 
  eliminato se più vecchio di 'PURGE_AFTER' giorni. Lo script verrà eseguito automaticamente ogni giorno alle ore 01:00.
  
  E' possibile eseguire  Run -> uninstallTriggers  per arrestare le sue schedulazioni in qualsiasi momento.
*/

// Variabili di configurazione
// I nomi delle etichette Gmail da purgare.
// (es., label1: "promotions", label2: "social").
var GMAIL_LABELS = {label0:"updates"};

// Automatically delete messages after this many days.
var PURGE_AFTER_DAYS = 365;

/**
 * Disinstalla tutti i triggers associati allo script, o solo quelli con un nome specifico.
 * Il nome della funzione trigger da disinstallare (opzionale).
 */
function uninstallTriggers(triggerName) {
  var triggers = ScriptApp.getScriptTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var handlerFunctionName = triggers[i].getHandlerFunction();
    if (triggerName && handlerFunctionName === triggerName) {
      ScriptApp.deleteTrigger(triggers[i]);
    } else if (!triggerName && (handlerFunctionName === "purgeGmail" || handlerFunctionName === "purgeGmail_temp")) {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log("Triggers giornalieri e temporanei di purge via etichetta disinstallati.");
    }											 
  }
}

/**
 * Installs i triggers.
 * 1. Uno che viene eseguito dopo due minuti dall'installazione.
 * 2. Uno che viene eseguito quotidianamente.
 */
function installTriggers() {
  // Prima rimuove i trigger per non superare il limite.
  uninstallTriggers("purgeGmail_temp");

  // Questo trigger viene eseguito una tantum per una pulizia istantanea subito dopo l'installazione.
  ScriptApp.newTrigger("purgeGmail_temp")
    .timeBased()
    .at(new Date(new Date().getTime() + 1000 * 60 * 2)) // Runs in 2 minutes
    .create();

  // Questo trigger viene schedulato quotidianamente.
  ScriptApp.newTrigger("purgeGmail")
    .timeBased()
    .everyDays(1)
    .create();

  Logger.log("Triggers giornalieri e temporanei di purge via etichetta installati.");
}

/**
 * Funzione principale che esegue il purging e invia un report.
 */
function purgeGmail() {
  // Calculate the purge date.
  var age = new Date();
  age.setDate(age.getDate() - PURGE_AFTER_DAYS);

  // Formatta la data per la query.
  var purgeDate = Utilities.formatDate(age, Session.getScriptTimeZone(), "yyyy-MM-dd");

  var report = "Report pulizia Gmail:\n\n";
  var totalDeletedMessages = 0;
  
  // Variabili per tenere traccia della data e del soggetto dell'ultima mail purgata
  var latestPurgedDate = null;
  var latestPurgedSubject = null;

  for (var labelName in GMAIL_LABELS) {
    if (GMAIL_LABELS.hasOwnProperty(labelName)) {
      // cerca i messaggi con le etichette, ma li esclude dalla cancellazione se sono importanti.
      var search = "label:" + GMAIL_LABELS[labelName] + " before:" + purgeDate + " -is:important -is:starred";
      var deletedMessagesInLabel = 0;

      try {
        var threads = GmailApp.search(search, 0, 100);
        // Questo trigger viene eseguito (e rischedulato dopo 10 minuti) se ci sono più di 100 mail da pulire.
        if (threads.length === 100) {
          ScriptApp.newTrigger("purgeGmail_temp")
            .timeBased()
            .at(new Date(new Date().getTime() + 1000 * 60 * 10)) // Runs in 10 minutes
            .create();
        }

        // Conta i messaggi e li sposta nel cestino.
        for (var i = 0; i < threads.length; i++) {
          var messages = threads[i].getMessages();
          deletedMessagesInLabel += messages.length;

          // Controlla la data e il soggetto dell'ultima mail in questo thread (la più recente)
          var lastMessageDate = messages[messages.length - 1].getDate();
          var lastMessageSubject = messages[messages.length - 1].getSubject();
          if (latestPurgedDate === null || lastMessageDate > latestPurgedDate) {
            latestPurgedDate = lastMessageDate;
            latestPurgedSubject = lastMessageSubject;
          }

          threads[i].moveToTrash();
        }
        
        report += "Etichetta '" + GMAIL_LABELS[labelName] + "': " + deletedMessagesInLabel + " messaggi eliminati.\n";
        totalDeletedMessages += deletedMessagesInLabel;
        
      } catch (e) {
        Logger.log("Error purging label " + GMAIL_LABELS[labelName] + ": " + e.toString());
        report += "Etichetta '" + GMAIL_LABELS[labelName] + "': Errore durante l'eliminazione dei messaggi.\n";
      }
    }
  }

  // Prepara il corpo dell'email
  var body = "";
  if (totalDeletedMessages > 0) {
    var formattedDate = Utilities.formatDate(latestPurgedDate, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    body = report + "\nUltima mail purgata: " + formattedDate + "\nSoggetto: '" + latestPurgedSubject + "'\nTotale messaggi eliminati: " + totalDeletedMessages + ".";
  } else {
    body = "Nessun messaggio è stato eliminato in questa esecuzione.";
  }

  // Manda il report via email.
  var recipient = Session.getActiveUser().getEmail();
  var subject = "Report pulizia Gmail - " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
  GmailApp.sendEmail(recipient, subject, body);
}

/**
 * Funzione eseguita dai trigger temporanei.
 * previene l'accumulo dei trigger scaduti.
 */
function purgeGmail_temp() {
  try {
    purgeGmail();
  } finally {
    uninstallTriggers("purgeGmail_temp");
  }
}
