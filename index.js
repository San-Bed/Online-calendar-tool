'use strict';

var http = require('http');
var fs = require('fs');
var urlParse = require('url').parse;
var pathParse = require('path').parse;
var querystring = require('querystring');

var port = 1337;
var hostUrl = 'http://localhost:'+port+'/';
var defaultPage = '/index.html';

var mimes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
};

// --- Helpers ---
var readFile = function (path) {
    return fs.readFileSync(path).toString('utf8');
};

var writeFile = function (path, texte) {
    fs.writeFileSync(path, texte);
};

// --- Server handler ---
var redirect = function (reponse, path, query) {
    var newLocation = path + (query == null ? '' : '?' + query);
    reponse.writeHeader(302, {'Location' : newLocation });
    reponse.end('302 page déplacé');
};

var getDocument = function (url) {
    var pathname = url.pathname;
    var parsedPath = pathParse(url.pathname);
    var result = { data: null, status: 200, type: null };

    if(parsedPath.ext in mimes) {
        result.type = mimes[parsedPath.ext];
    } else {
        result.type = 'text/plain';
    }

    try {
        result.data = readFile('./public' + pathname);
        console.log('['+new Date().toLocaleString('iso') + "] GET " + url.path);
    } catch (e) {
        // File not found.
        console.log('['+new Date().toLocaleString('iso') + "] GET " +
                    url.path + ' not found');
        result.data = readFile('template/error404.html');
        result.type = 'text/html';
        result.status = 404;
    }
    
    return result;
};

var sendPage = function (reponse, page) {
    reponse.writeHeader(page.status, {'Content-Type' : page.type});
    reponse.end(page.data);
};

var indexQuery = function (query) {

    var resultat = { exists: false, id: null };

    if (query !== null) {

        query = querystring.parse(query);
        if ('id' in query && 'titre' in query &&
            query.id.length > 0 && query.titre.length > 0) {

            resultat.exists = creerSondage(
                query.titre, query.id,
                query.dateDebut, query.dateFin,
                query.heureDebut, query.heureFin);
        }

        if (resultat.exists) {
            resultat.id = query.id;
        }
    }

    return resultat;
};

var calQuery = function (id, query) {
    if (query !== null) {
        query = querystring.parse(query);
        // query = { nom: ..., disponibilites: ... }
        ajouterParticipant(id, query.nom, query.disponibilites);
        return true;
    }
    return false;
};

var getIndex = function (replacements) {
    return {
        status: 200,
        data: readFile('template/index.html'),
        type: 'text/html'
    };
};


/************** VARIABLES GLOBALES **********************/

// Informations des sondages
var idListe = [];
var infoListe = [];
var participantListe = [];
var dispoListe = [];
var couleurListe = [];

var MILLIS_PAR_JOUR = (24 * 60 * 60 * 1000);

// Attributs de calendrier
var idTable = "id=\"calendrier\"";
var onMouseDown = "onmousedown=\"onClick(event)\"";
var onMouseOver = "onmouseover=\"onMove(event)\"";

var mois = [
    'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
    'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Dec'
];

/********************** HTML/STRINGS ***********************/

// Retourne une nouvelle balise avec le nom, 
// les attributs et le contenu souhaite
var balise = function (nom, attribut, contenu) {
    return "<" + nom + " " + attribut + ">" 
            + contenu 
            + "</" + nom + ">";
};

// Creer un attribut "id"
var idCase = function (attribut) {
    return "id=\"" + attribut + "\"";
};

// Creer un attribut "style"
var style = function(attribut) {
    return "style=\"" + attribut + "\"";
};

// Creer un attribut "class"
var classAttribut = function(attribut) {
    return "class=\""+ attribut + "\"";
};

// trouve un mot dans un string
var trouverMot = function(texte, mot) {
    for (var i = 0; i < texte.length; i++) {
        if (texte.slice(i, i + mot.length) == mot) {
            return i;
        }
    } 
    return -1;
};

var estUnNombre = function(car) {
    return ("0" <= car) && (car <= "9");
};

var estUneLettre = function(car) {
    return ("A" <= car) && (car <= "Z") || ("a" <= car) && (car <= "z");
};

// Trouve une balise et remplace la balise par le contenu voulu 
// du texte "source"
var remplacerBalise = function (source, nom, contenu) {
    var baliseATrouver = "{{" + nom + "}}";
    var posBalise = trouverMot(source, baliseATrouver);
    var resultat = source.slice(0, posBalise) + 
                    contenu + 
                    source.slice(posBalise + baliseATrouver.length,
                        source.length);
    // Si on trouve une autre fois la balise dans le texte,
    // on le remplace egalement
    if (trouverMot(resultat, baliseATrouver) != -1) {
        resultat = remplacerBalise(resultat, nom, contenu);
    }
    return resultat;
};

// Convertit un nombre decimal en notation hexadecimal
var decToHex = function(nbDecimal) {
    
    var n = Math.abs(nbDecimal); // assurer nombre non-negatif
    var facteur = "";
    var e = ""; // accumuler l'encodage

    if (n == 0) { return e = "00"; } // si nombre dans input est 0

    do {
        switch (n % 16) {
            case 10: facteur = "a"; break;
            case 11: facteur = "b"; break;
            case 12: facteur = "c"; break;
            case 13: facteur = "d"; break;
            case 14: facteur = "e"; break;
            case 15: facteur = "f"; break;
            default: facteur = (n % 16); break;
        }
        e = facteur + e; // accumuler un chiffre
        n = Math.floor(n/16); // passer aux autres chiffres
    } while (n > 0);
    
    return e;
};

/*********************** GET FUNCTIONS ********************************/

// Retourne le texte HTML à afficher à l'utilisateur pour répondre au
// sondage demandé.
//
// Retourne false si le calendrier demandé n'existe pas
var getCalendar = function (sondageId) {
    var idPos = trouverIdPos(sondageId);
    
    if (idPos > -1) {
        var calendrierHTML = remplacerBalise(readFile(
                                                "template/calendar.html"),
                                            "titre",
                                            infoListe[idPos].titre);
        calendrierHTML = remplacerBalise(
                            calendrierHTML,
                            "table",
                            balise(
                                "table",
                                creerData(infoListe[idPos]),
                                creerTableau(infoListe[idPos])
                            )
                        );
        calendrierHTML = remplacerBalise(
                            calendrierHTML,
                            "url",
                            hostUrl + sondageId);
        return calendrierHTML;
    } else {
    return false;   
    }
};

// Retourne le texte HTML à afficher à l'utilisateur pour voir les
// résultats du sondage demandé
//
// Retourne false si le calendrier demandé n'existe pas
var getResults = function (sondageId) {
    var idPos = trouverIdPos(sondageId);
    var resultatsHTML = remplacerBalise(readFile(
                                        "template/results.html"),
                                        "titre",
                                        infoListe[idPos].titre);

    resultatsHTML = remplacerBalise(resultatsHTML,
                                    "table",
                                    balise("table","",creerResultats(sondageId)));

    resultatsHTML = remplacerBalise(
        resultatsHTML,
        "url",
        hostUrl + sondageId);
    
    return resultatsHTML;
};

/**************************** CREER *****************************/
// Crée un sondage à partir des informations entrées
//
// Doit retourner false si les informations ne sont pas valides, ou
// true si le sondage a été créé correctement.
var creerSondage = function(titre, id, dateDebut, dateFin, heureDebut, 
                            heureFin) {
    if (titre != "" &&
        idValide(id) &&
        dateValide(dateDebut, dateFin) &&
        heureValide(heureDebut, heureFin)) {
            enregistrerInfo(titre, id, dateDebut, dateFin, heureDebut, heureFin);
                return true;
    }
    return false;
};

// Creer les attribut du calendrier dans getCalendar
var creerData = function (info) {
    var nbHeures = calculerNbHeures(info.heureDebut, info.heureFin) + 1;
    var nbJours = differenceDate(info.dateDebut, info.dateFin) + 1;

    var resultat = idTable + " " + onMouseDown + " " + onMouseOver + " ";
    return resultat + "data-nbjours=\"" + nbJours + "\" " + "data-nbheures=\"" + nbHeures + "\"";
};

// Creer la table de getCalendar
var creerTableau = function (info) {
    var dates = listerDates(info.dateDebut, info.dateFin);
    var nbHeures = calculerNbHeures(info.heureDebut, info.heureFin);
    var heures = listerHeures(nbHeures, info.heureDebut);

    // Headers de la table
    var resultat = balise("tr","", dates.map(function (date) {
        return balise("th","", date);
    }).join(""));

    // Tableau avec heures
    for (var i = 0; i < heures.length; i++) {
        var row = "";
        for (var j = -1; j < dates.length -1; j++) {
            if (j == -1) {
                row += balise("th","", heures[i]);
            } else {
                row += balise("td", idCase(j + "-" + i), "");
            }
        }
        resultat += balise("tr","", row);
    }
    return resultat;
};

var creerResultats = function (sondageId) {
    // On va chercher les infos du sondage
    var idPos = trouverIdPos(sondageId);
    var info = infoListe[idPos];

    // On en ressort les informations pertinantes
    var dates = listerDates(info.dateDebut, info.dateFin);
    var nbHeures = calculerNbHeures(info.heureDebut, info.heureFin);
    var heures = listerHeures(nbHeures, info.heureDebut);

    // Headers de chaque colonne
    var resultat = balise("tr","", dates.map(function (date) {
        return balise("th","", date);
    }).join(""));

    // Pour chaque participant
    for (var i = 0; i < heures.length; i++) {
        var row = "";
        for (var j = -1; j < dates.length -1; j++) {
            if (j == -1) {
                row += balise("th","", heures[i]);
            } else {
                row += balise("td",
                              "",
                              couleursCase(i, j, sondageId)
                       );
            }
        }
        resultat += balise("tr","", row);
    }
    return resultat;
};

/********************** INFO ********************/
var enregistrerInfo = function (titre, id, dateDebut, dateFin, heureDebut, heureFin) {
    idListe.push(id);
    infoListe.push({
        titre : titre,
        dateDebut : dateDebut,
        dateFin : dateFin,
        heureDebut : heureDebut,
        heureFin : heureFin,
    });
    participantListe.push([]);
    dispoListe.push([]);
    couleurListe.push([]);
};

/********************** HEURE ********************/
var listerHeures = function(nbHeures, heureDebut) {
    var resultat = [];
    for (var i = heureDebut; resultat.length <= nbHeures; i++) {
        resultat.push(i);
    }
    resultat = resultat.map(function(heure) {
        return heure + "h";
    });
    return resultat;
};

var heureValide = function (heureDebut, heureFin) {
    return +heureDebut <= +heureFin;
};

var calculerNbHeures = function (heureDebut, heureFin) {
    return heureFin - heureDebut;
};

/********************** DATE ********************/
var listerDates = function (dateDebut, dateFin) {
    var nbJours = differenceDate(dateDebut, dateFin);
    var debutSepare = separerDate(dateDebut);
    var moisNb = debutSepare[1]-1;
    var joursDebut = debutSepare[2];
    var joursFin = separerDate(dateFin)[2];

    var resultatDebut = [];
    var resultatFin = [];
    var resultat = [];
    while (resultatFin.length + resultatDebut.length <= nbJours) {
        if (joursFin > 0) {
            resultatFin.unshift(joursFin--);
        } else {
            resultatDebut.push(joursDebut++);
        }
    }

    var listeJours = resultatDebut.concat(resultatFin);
    resultat = listeJours.map(function(jour, i) {
        if (jour == 1 && i != 0) {
            moisNb++;
        }
        return jour + " " + mois[moisNb%12];
    });
    resultat.unshift("");
    return resultat;
};

var separerDate = function(date) {
    var AnMoisJours = date.split("-");
    return AnMoisJours;
};

var dateToMillis = function (date) {
    return new Date(date[0], date[1], date[2]);
};

var differenceDate = function (premiere, deuxieme) {
    var premiereMillis = dateToMillis(separerDate(premiere));
    var deuxiemeMillis = dateToMillis(separerDate(deuxieme));

    return Math.round((deuxiemeMillis-premiereMillis)/MILLIS_PAR_JOUR);
};

var dateValide = function(dateDebut, dateFin) {
    var diffJours = differenceDate(dateDebut, dateFin);
    if (diffJours < 0 || diffJours > 30){
        return false;
    }
    return true;
};

/********************** ID ********************/
//Verifie si le ID respecte les restrictions
var idValide = function(id) {
    for (var i = 0; i <= id.length; i++) {
        if (i == id.length) {
            return true;
        }

        if (!estUnNombre(id.charAt(i)) &&
            !estUneLettre(id.charAt(i)) &&
            id.charAt(i) != "-") {
                return false;
        }
    }
};

// Trouve la position du ID "sondageId"
var trouverIdPos = function(sondageId) {
    var idPos = -1;
    for (var i = 0; i < idListe.length; i++) {
        if (sondageId == idListe[i]) {
            idPos = i;
        }
    }
    return idPos;
};
/********************* COULEURS ******************/
// Mets a jour les couleurs de chaque personnes 
// lorsque l'on ajoute un nouveau participant
var updateCouleurs = function (sondageId) {
    var idPos = trouverIdPos(sondageId);
    var nbPartcipant = participantListe[idPos].length

    for (var i = 0; i < nbPartcipant; i++) {
        participantListe[idPos][i] = genColor(i, nbPartcipant);
    }
};

// Génère la `i`ème couleur parmi un nombre total `total` au format
// hexadécimal HTML
//
// Notez que pour un grand nombre de couleurs (ex.: 250), générer
// toutes les couleurs et les afficher devrait donner un joli dégradé qui
// commence en rouge, qui passe par toutes les autres couleurs et qui
// revient à rouge.
var genColor = function(i, nbTotal) {
    
    var teinte = i / nbTotal * 360;
    var h = teinte/60;
    var c = 0.7;
    var x = c * (1 - Math.abs(h % 2 - 1));
    var couleur = "";
    
    c = decToHex(Math.floor(c * 256)); 
    x = decToHex(Math.floor(x * 256));
    
    // Suivant modele #RRGGBB
    switch(Math.floor(h)) {
        case 0 : couleur = "#" + c + x + "00"; break;// aucun bleu
        case 1 : couleur = "#" + x + c + "00"; break;// aucun bleu
        case 2 : couleur = "#00" + c + x; break; // aucun rouge
        case 3 : couleur = "#00" + x + c; break;// aucun rouge
        case 4 : couleur = "#" + x + "00" + c; break; // aucun vert
        case 5 : couleur = "#" + c + "00" + x; break;// aucun vert
        default : couleur = "#000000"; break; // blanc
    }
    return couleur;
};
var couleursCase = function(x, y, sondageId) {
    
    var idPos = trouverIdPos(sondageId);
    var resultat = "";
    
    for (var i = 0; i < participantListe[idPos].length; i++) {
        if (dispoListe[idPos][i].charAt(x + y) == 1) {
            
            var couleur = couleurListe[idPos][i];
            
            resultat += balise("span", style("background-color: " + genColor(couleur) + ";" + "color:" + genColor(couleur)), ".");
        }
    }
    console.log(resultat);
    return resultat;
};c

/********************** PARTICIPANT ***********************/
// Retourne la position du participant
// Retourne -1 si le participant est nouveau
var trouverParticipantPos = function(nom, idPos) {
    if (participantListe[idPos] == []) {
        return -1;
    }

    for (var i = 0; i <= participantListe[idPos].length; i++) {
        if (i == participantListe[idPos].length) {
            return -1;
        }
        if (participantListe[idPos][i] == nom) {
            return i;
        }
    }
};

// Ajoute un participant et ses disponibilités aux résultats d'un
// sondage. Les disponibilités sont envoyées au format textuel
// fourni par la fonction compacterDisponibilites() de public/calendar.js
//
// Cette fonction ne retourne rien
var ajouterParticipant = function(sondageId, nom, disponibilites) {
    
    // On trouve la position du sondage dans les sauvegardes
    var idPos = trouverIdPos(sondageId);

    // On cherche si le participant a deja repondu
    var participantPos = trouverParticipantPos(nom, idPos);
    
    if (participantPos == -1) { // S'il n'est pas dans la liste, on le rajoute
        participantListe[idPos].push(nom);
        dispoListe[idPos].push(disponibilites);
        couleurListe[idPos].push("#000000");
        updateCouleurs(sondageId);
    } else { // Sinon, on change ses dispos
        dispoListe[idPos][participantPos] = disponibilites;
    }
};

/*
 * Création du serveur HTTP
 * Note : pas besoin de toucher au code ici (sauf peut-être si vous
 * faites les bonus)
 */
http.createServer(function (requete, reponse) {
    var url = urlParse(requete.url);

    // Redirect to index.html
    if (url.pathname == '/') {
        redirect(reponse, defaultPage, url.query);
        return;
    }

    var doc;

    if (url.pathname == defaultPage) {
        var res = indexQuery(url.query);

        if (res.exists) {
            redirect(reponse, res.id);
            return;
        } else {
            doc = getIndex(res.data);
        }
    } else {
        var parsedPath = pathParse(url.pathname);

        if (parsedPath.ext.length == 0) {
            var id;

            if (parsedPath.dir == '/') {
                id = parsedPath.base;

                if (calQuery(id, url.query)) {
                    redirect(reponse, '/'+ id + '/results')
                    return ;
                }

                var data = getCalendar(id);

                if(data === false) {
                    redirect(reponse, '/error404.html');
                    return;
                }

                doc = {status: 200, data: data, type: 'text/html'};
            } else {
                if (parsedPath.base == 'results') {
                    id = parsedPath.dir.slice(1);
                    var data = getResults(id);

                    if(data === false) {
                        redirect(reponse, '/error404.html');
                        return;
                    }

                    doc = {status: 200, data: data, type: 'text/html'};
                } else {
                    redirect(reponse, '/error404.html');
                    return;
                }
            }
        } else {
            doc = getDocument(url);
        }
    }

    sendPage(reponse, doc);

}).listen(port);