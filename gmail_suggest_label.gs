// Costanti di configurazione
// Limite per il numero di thread da elaborare per ogni esecuzione.
var MAX_THREADS_TO_PROCESS = 500;

/**
 * Installa un trigger per eseguire lo script di etichettatura.
 * Il trigger verrà eseguito una volta al giorno.
 */
function installLabelingTrigger() {
  // Rimuove prima i trigger esistenti per evitare duplicati.
  uninstallLabelingTrigger();

  ScriptApp.newTrigger("suggestLabelsBasedOnSenders")
    .timeBased()
    .everyDays(7)
    .create();

  Logger.log("Trigger di suggerimento etichettatura installato. Lo script verrà eseguito una volta a settimana.");
}

/**
 * Rimuove tutti i trigger associati a questa funzione.
 */
function uninstallLabelingTrigger() {
  var triggers = ScriptApp.getScriptTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() == "suggestLabelsBasedOnSenders") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/**
 * La funzione principale per suggerire etichette basate sui mittenti.
 * Invia un'email di report anziché creare etichette automaticamente.
 */
function suggestLabelsBasedOnSenders() {
  Logger.log("Avvio del processo di suggerimento etichette per i mittenti.");
  
  // Cerca gli ultimi 1000 messaggi non letti e senza etichette già applicate dall'utente.
  var threads = GmailApp.search("is:unread -has:userlabels", 0, MAX_THREADS_TO_PROCESS);
  
  var sendersCounts = {};
  
  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var sender = thread.getMessages()[0].getFrom();
    
    // Estrae il nome pulito del mittente (es. "John Doe" <john.doe@example.com> -> "John Doe")
    var senderName = "";
    var match = sender.match(/"(.*)"\s*<.*>/);
    if (match && match[1]) {
      senderName = match[1];
    } else {
      senderName = sender;
    }
    
    // Sanifica il nome per l'uso in un'etichetta, sostituendo i caratteri speciali.
    var sanitizedName = senderName.replace(/[<>:"\/\\|?*]/g, '_');
    
    if (sendersCounts[sanitizedName]) {
      sendersCounts[sanitizedName]++;
    } else {
      sendersCounts[sanitizedName] = 1;
    }
  }
  
  // Costruisce il corpo dell'email di report.
  var report = "Report Suggerimenti Etichette Gmail\n\n";
  report += "Basato sugli ultimi " + MAX_THREADS_TO_PROCESS + " messaggi non letti e senza etichetta:\n\n";
  
  var suggestions = [];
  for (var sender in sendersCounts) {
    suggestions.push({
      name: sender,
      count: sendersCounts[sender]
    });
  }
  
  // Ordina i suggerimenti per numero di occorrenze, dal più frequente.
  suggestions.sort(function(a, b) {
    return b.count - a.count;
  });
  
  if (suggestions.length === 0) {
    report += "Nessun mittente trovato che richieda una nuova etichetta.";
  } else {
    report += "Ecco i mittenti da cui hai ricevuto più messaggi non etichettati. Potrebbe essere utile creare un'etichetta per loro:\n\n";
    for (var j = 0; j < suggestions.length; j++) {
      report += "- '" + suggestions[j].name + "': " + suggestions[j].count + " messaggi\n";
    }
  }
  
  // Invia il report via email.
  var recipient = Session.getActiveUser().getEmail();
  var subject = "Report Suggerimenti Etichette - " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
  
  GmailApp.sendEmail(recipient, subject, report);
  
  Logger.log("Report di suggerimenti inviato con successo.");
}
