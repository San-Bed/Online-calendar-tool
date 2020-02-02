// Auteur : Justin Michaud et Sandrine Bédard
// Date : 14 Decembre 2018

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

    var resultat = { exists: -1, id: null, data: "" };

    if (query !== null) {

        query = querystring.parse(query);

        resultat.exists = creerSondage(
            query.titre, query.id,
            query.dateDebut, query.dateFin,
            query.heureDebut, query.heureFin);

        if (resultat.exists == 0) {
            resultat.id = query.id;
        } else {
            switch (resultat.exists) {
                case 1: resultat.data = "Le titre du sondage est vide."; break;
                case 2: resultat.data = "Le ID existe déjà."; break;
                case 3: resultat.data = "Le ID ne respecte pas les critères.";
                        break;
                case 4: resultat.data = "Le sondage ne peut pas se terminer "
                                        + "avant la date de départ.";
                        break;
                case 5: resultat.data = "Le sondage ne peut pas dépasser "
                                        + "30 jours.";
                        break;
                case 6: resultat.data = "Le sondage ne peut pas débuter à une "
                                        + "date déjà passée.";
                        break;
                case 7: resultat.data = "Le sondage ne peut pas se terminer "
                                        + "avant l'heure de départ.";
                        break;
                case 8: resultat.data = "Le ID du sondage est vide."; break;
                default: resultat.data = "Erreur inconnue"; break;
            }
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
    var html = remplacerBalise(readFile("template/index.html"),
                                        "error", replacements);
    return {
        status: 200,
        data: html,
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
var maxMinListe = [];

var MILLIS_PAR_JOUR = (24 * 60 * 60 * 1000);

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
var classer = function(attribut) {
    return "class=\""+ attribut + "\"";
};

// Verifie si le caractere est un nombre
var estUnNombre = function(car) {
    return ("0" <= car) && (car <= "9");
};

// Verifie si le caractere est une lettre
var estUneLettre = function(car) {
    return ("A" <= car) && (car <= "Z") || ("a" <= car) && (car <= "z");
};

// Trouve une balise et remplace la balise par le contenu voulu 
// du texte "source"
var remplacerBalise = function (source, nom, contenu) {
    var baliseATrouver = "{{" + nom + "}}";
    var posBalise = source.indexOf(baliseATrouver);
    // On echange le contenu de la balise pour le contenu souhaite
    var resultat = source.slice(0, posBalise) +
                    contenu +
                    source.slice(posBalise + baliseATrouver.length,
                        source.length);
    // Si on trouve une autre fois la balise dans le texte,
    // on le remplace egalement
    if (resultat.indexOf(baliseATrouver) != -1) {
        resultat = remplacerBalise(resultat, nom, contenu);
    }
    return resultat;
};

// Convertit un nombre decimal en notation hexadecimal
var decToHex = function(nbDecimal) {

    var n = Math.abs(nbDecimal); // On s'assurer  que le nombre est positif
    var facteur = "";
    var e = ""; // Accumuler l'encodage

    if (n == 0) { return e = "00"; } // Si nombre dans input est 0

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
        e = facteur + e; // Accumuler un chiffre
        n = Math.floor(n/16); // Passer aux autres chiffres
    } while (n > 0);

    return e;
};

/*********************** GET FUNCTIONS ********************************/

// Retourne le texte HTML à afficher à l'utilisateur pour répondre au
// sondage demandé.
//
// Retourne false si le calendrier demandé n'existe pas
var getCalendar = function (sondageId) {
    // Position du sondage dans nos sauvegarde
    var idPos = trouverIdPos(sondageId);

    if (idPos > -1) { // Le calendrier existe
        // On remplace les {{titre}}
        var calendrierHTML = remplacerBalise(readFile(
                                                "template/calendar.html"),
                                            "titre",
                                            infoListe[idPos].titre);
        // On remplace la {{table}}
        calendrierHTML = remplacerBalise(
                            calendrierHTML,
                            "table",
                            balise(
                                "table",
                                creerData(infoListe[idPos]),
                                creerTableau(infoListe[idPos])
                            )
                        );
        // On remplace le {{url}}
        calendrierHTML = remplacerBalise(
                            calendrierHTML,
                            "url",
                            hostUrl + sondageId);
        return calendrierHTML;
    } else { // Le calendrier n'existe pas
        return false;
    }
};

// Retourne le texte HTML à afficher à l'utilisateur pour voir les
// résultats du sondage demandé
//
// Retourne false si le calendrier demandé n'existe pas
var getResults = function (sondageId) {
    var idPos = trouverIdPos(sondageId);
    // On remplaces les balises {{titre}}
    var resultatsHTML = remplacerBalise(readFile("template/results.html"),
                                        "titre", infoListe[idPos].titre);

    // On cree la table avec les resultats
    var tableResultats = balise("table", "", creerResultats(sondageId));

    // On remplace la balise {{table}}
    resultatsHTML = remplacerBalise(resultatsHTML, "table", tableResultats);

    // On remplace la balise {{url}}
    resultatsHTML = remplacerBalise(resultatsHTML, "url",
                                    hostUrl + sondageId);

    // On remplace la balise {{legende}}
    resultatsHTML = remplacerBalise(resultatsHTML, "legende",
                                    creerLegende(idPos));

    return resultatsHTML;
};

/**************************** CREER *****************************/
// Crée un sondage à partir des informations entrées
//
// Doit retourner false si les informations ne sont pas valides, ou
// true si le sondage a été créé correctement.
var creerSondage = function(titre, id, dateDebut, dateFin, heureDebut, 
                            heureFin) {
    var errId = idValide(id); // Erreure du ID, = 0 si aucun probleme
    var errDate = dateValide(dateDebut, dateFin); // Erreure de la date

    if (titre == "") {
        return 1;
    } else if (errId != 0){
        switch (errId) {
            case (1): return 2;
            case (2): return 3;
            case (3): return 8;
        }
    } else if (errDate != 0) {
        switch (errDate) {
            case (1): return 4;
            case (2): return 5;
            case (3): return 6;
        }
    } else if (!heureValide(heureDebut, heureFin)) {
        return 7;
    } else {
        enregistrerInfo(titre, id, dateDebut,
                            dateFin, heureDebut, heureFin);
        return 0;
    }
};

// Creer les attribut du calendrier dans getCalendar
var creerData = function (info) {
    // Attributs de calendrier
    var idTable = "id=\"calendrier\"";
    var onMouseDown = "onmousedown=\"onClick(event)\"";
    var onMouseOver = "onmouseover=\"onMove(event)\"";

    var nbHeures = calculerNbHeures(info.heureDebut, info.heureFin) + 1;
    var nbJours = differenceDate(info.dateDebut, info.dateFin) + 1;

    var resultat = idTable + " " + onMouseDown + " " + onMouseOver + " ";
    return resultat + "data-nbjours=\"" + nbJours + "\" " + 
           "data-nbheures=\"" + nbHeures + "\"";
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
        resultat += balise("tr","", row) + "\n";
    }

    return resultat;
};

// Creer un liste contenant la popularite de chaque cellules
var creerMaxMin = function(info) {
    var nbHeures = calculerNbHeures(info.heureDebut, info.heureFin) + 1;
    var nbJours = differenceDate(info.dateDebut, info.dateFin) + 1;

    var resultat = [];
    for (var i = 0; i < nbHeures; i++) {
        resultat.push(new Array(nbJours).fill(0));
    }

    return resultat;
};

// Creer la legende avec les noms des participant et leur couleur assigne
var creerLegende = function(idPos) {
    var resultat = "";
    var participants = participantListe[idPos];

    for (var i = 0; i < participants.length; i++) {
        var couleur = couleurListe[idPos][i];
        resultat += balise("li", style("background-color: " + couleur), 
                           participants[i]) + "\n";
    }
    return resultat;
};

// Trouve la valeur minimum et maximum des disponibilites du sondage.
var trouverMinMax = function(idPos) {
    var tableau = maxMinListe[idPos];

    // Trouver le min
    var min = tableau.reduce(function (x,y) {
        var yMin = y.reduce(function(w,z) {
            return (w < z) ? w : z;
        }, Infinity);
        return (x < yMin ) ? x : yMin;
    }, Infinity);

    // Trouver le max
    var max = tableau.reduce(function (x,y) {
        var yMin = y.reduce(function(w,z) {
            return (w > z) ? w : z;
        }, -Infinity);
        return (x > yMin ) ? x : yMin;
    }, -Infinity);

    return {
        max : max,
        min : min
    };
};

// Creer le tableau resultat
var creerResultats = function (sondageId) {
    // On va chercher les infos du sondage
    var idPos = trouverIdPos(sondageId);
    var info = infoListe[idPos];

    // On en ressort les informations pertinantes
    var dates = listerDates(info.dateDebut, info.dateFin);
    var nbHeures = calculerNbHeures(info.heureDebut, info.heureFin);
    var heures = listerHeures(nbHeures, info.heureDebut);

    var minMax = trouverMinMax(idPos);

    // Headers de chaque colonne
    var resultat = balise("tr","", dates.map(function (date) {
        return balise("th","", date);
    }).join("")) + "\n";

    // On affiche les cases les moins/plus populaires
    var charPos = 0;
    for (var i = 0; i < heures.length; i++) {
        var row = "";
        for (var j = -1; j < dates.length -1; j++) {
            if (j == -1) { // Position des heures
                row += balise("th","", heures[i]);
            } else { // Cases de disponibilités
                // Si c'est un max
                if (maxMinListe[idPos][i][j] == minMax.max) {
                    row += balise("td",
                    classer("max"),
                    couleursCase(charPos + j, sondageId));
                // Si c'est un min
                } else if (maxMinListe[idPos][i][j] == minMax.min) {
                    row += balise("td",
                    classer("min"),
                    couleursCase(charPos + j, sondageId));
                // Si ce n'est ni un max, ni un min
                } else {
                    row += balise("td",
                    "",
                    couleursCase(charPos + j, sondageId));
                }
            }
        }
        charPos += dates.length-1;
        resultat += balise("tr","", row + "\n");
    }
    return resultat;
};

/********************** INFO ********************/
var enregistrerInfo = function (titre, id, dateDebut, dateFin, heureDebut, 
                                heureFin) {

    idListe.push(id); // On garde le ID en memoire
    infoListe.push({ // On enregistre les infos a la position correspondant
        titre : titre,
        dateDebut : dateDebut,
        dateFin : dateFin,
        heureDebut : heureDebut,
        heureFin : heureFin
    });
    participantListe.push([]); // On creer une espace pour les participants
    dispoListe.push([]); // On creer une espace pour les dipos des participants
    couleurListe.push([]); // Ainsi que leur couleur

    var idPos = trouverIdPos(id);
    maxMinListe.push(creerMaxMin(infoListe[idPos]));

    // On creer le tableau qui calcul les plages horaire les plus optimal
};

/********************** HEURE ********************/
// Creer un liste contenant tous les heures voulu du sondage
var listerHeures = function(nbHeures, heureDebut) {
    var resultat = [];
    for (var i = heureDebut; resultat.length <= nbHeures; i++) {
        resultat.push(i);
    }
    // On rajoute un h a chaque nombre
    resultat = resultat.map(function(heure) {
        return heure + "h";
    });
    return resultat;
};

// Determine si l'heure est valide
var heureValide = function (heureDebut, heureFin) {
    return +heureDebut <= +heureFin;
};

// Retourne le nombre d'heures entre l'heure de depart et de fin
var calculerNbHeures = function (heureDebut, heureFin) {
    return heureFin - heureDebut;
};

/********************** DATE ********************/

// Creer une liste contenant tous les dates du sondage
var listerDates = function (dateDebut, dateFin) {
    var nbJours = differenceDate(dateDebut, dateFin);
    var debutSepare = separerDate(dateDebut);
    var moisNb = debutSepare[1]-1;
    var joursDebut = debutSepare[2];
    var joursFin = separerDate(dateFin)[2];

    var resultatDebut = [];
    var resultatFin = [];
    var resultat = [];
    // Tant que le nombre dans les deux listes ensemble 
    // ne contiennent pas tous les jours
    while (resultatFin.length + resultatDebut.length <= nbJours) {
        if (joursFin > 0) { // On commence par les jours de fin
            resultatFin.unshift(joursFin--);
        } else { // Quand on arrive a 0, on monte les jours de debut
            resultatDebut.push(joursDebut++);
        }
    }
    // On concatise les deux liste pour n'en faire qu'une
    var listeJours = resultatDebut.concat(resultatFin);

    // On rajoute les mois à la fin des nombres
    resultat = listeJours.map(function(jour, i) {
        if (jour == 1 && i != 0) {
            moisNb++;
        }
        return jour + " " + mois[moisNb%12];
    });
    resultat.unshift("");
    return resultat;
};

// Separe les nombre dans les strings des dates
var separerDate = function(date) {
    var AnMoisJours = date.split("-");
    return AnMoisJours;
};

// Permet la comparaison des dates
var dateToMillis = function (date) {
    return new Date(date[0], date[1] - 1, date[2]);
};

// Retourne le nombre de date 
var differenceDate = function (premiere, deuxieme) {
    var premiereMillis = dateToMillis(separerDate(premiere));
    var deuxiemeMillis = dateToMillis(separerDate(deuxieme));

    return Math.floor((deuxiemeMillis-premiereMillis)/MILLIS_PAR_JOUR);
};

// Retourne la date d'hier pour la fonction dateValide
var hier = function() {
    var auj = new Date();

    var jour = auj.getDate() - 1;
    var mois = auj.getMonth() + 1;
    var an = auj.getFullYear();

    return an + "-" + mois + "-" + jour;
};

// Retourne si la date est valide
var dateValide = function(dateDebut, dateFin) {
    var limiteAv = hier();
    var diffJours = differenceDate(dateDebut, dateFin);

    // Determine si le jour de depart est deja passe
    var diffLimite = differenceDate(limiteAv, dateDebut);
    
    if (diffJours < 0) {
        return 1; // La fin du sondage est avant le debut
    } else if (diffJours > 30) {
        return 2; // Le sondage depasse les 30 jours
    } else if (diffLimite < 0) {
        return 3; // Le sondage commence a une date deja passe
    } else {
        return 0; // Le sondage respecte les criteres
    }
};

/********************** ID ********************/
//Verifie si le ID respecte les restrictions
var idValide = function(id) {
    // Si l'ID est vide
    if (id == "") {return 3;}

    if (idListe.indexOf(id) == -1) { // Le ID n'existe pas

        for (var i = 0; i <= id.length; i++) {
            if (i == id.length) { // Le ID restecte les criteres
                return 0;
            }
            // Le ID ne respecte pas les criteres
            if (!estUnNombre(id.charAt(i)) &&
                !estUneLettre(id.charAt(i)) &&
                id.charAt(i) != "-") {
                    return 2;
            }
        }
    } else { // Le ID existe deja
        return 1;
    }
};

// Trouve la position du ID "sondageId"
var trouverIdPos = function(sondageId) {
    return idListe.indexOf(sondageId);
};

/********************* COULEURS ******************/
// Mets a jour les couleurs de chaque personnes 
// lorsque l'on ajoute un nouveau participant
var updateCouleurs = function (sondageId) {
    var idPos = trouverIdPos(sondageId);
    var nbPartcipant = participantListe[idPos].length;

    for (var i = 0; i < nbPartcipant; i++) {
        couleurListe[idPos][i] = genColor(i, nbPartcipant);
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
        case 2 : couleur = "#00" + c + x; break;// aucun rouge
        case 3 : couleur = "#00" + x + c; break;// aucun rouge
        case 4 : couleur = "#" + x + "00" + c; break;// aucun vert
        case 5 : couleur = "#" + c + "00" + x; break;// aucun vert
        default : couleur = "#000000"; break;// blanc
    }
    return couleur;
};

var couleursCase = function(charPos, sondageId) {
    var idPos = trouverIdPos(sondageId);
    var resultat = "";
    for (var i = 0; i < participantListe[idPos].length; i++) {
        var couleur = couleurListe[idPos][i];
        if (dispoListe[idPos][i].charAt(charPos) == 1) {
            resultat += balise("span", style("background-color: " + couleur + "; " + "color:" + couleur), ".");
        }
    }
    return resultat;
};

/********************** PARTICIPANT ***********************/

// Mets a jour les cases les plus populaires pour le tableau resultat
var updateMaxMin = function(sondageId, disponibilites){
    var idPos = trouverIdPos(sondageId);
    var nbJours = differenceDate(infoListe[idPos].dateDebut, 
                                 infoListe[idPos].dateFin) + 1;

    for (var i = 0; i < disponibilites.length; i++) {
        var jour = Math.floor(i/nbJours);
        var heure = i%nbJours;
        if (disponibilites[i] == 1) {
            maxMinListe[idPos][jour][heure]++;
        }
    }
};

// Ajoute un participant et ses disponibilités aux résultats d'un
// sondage. Les disponibilités sont envoyées au format textuel
// fourni par la fonction compacterDisponibilites() de public/calendar.js
//
// Cette fonction ne retourne rien
var ajouterParticipant = function(sondageId, nom, disponibilites) {

    updateMaxMin(sondageId, disponibilites);
    // On trouve la position du sondage dans les sauvegardes
    var idPos = trouverIdPos(sondageId);

    participantListe[idPos].push(nom);
    dispoListe[idPos].push(disponibilites);
    couleurListe[idPos].push("#000000");
    updateCouleurs(sondageId);
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

        if (res.exists == 0) {
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
