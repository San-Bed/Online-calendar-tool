'use strict';

// Variables globales
var nbHeures = "";
var nbJours = "";

// Unicode du symbole
var checkMark = "&#10003";

// Variable utilise pour le onMove
// Si on a cliqué sur une case vide, onMove cherche a mettre des checkmarks
// sur les autres cases vide, autrement, si on click sur un checkmark,
// on cherche a enlever les checkmarks avec onMove.
var symbole = ""; 

document.addEventListener('DOMContentLoaded', function() {
    // Variables fournis dans l'ennonce
    var cal = document.getElementById("calendrier");
    nbHeures = cal.dataset.nbheures;
    nbJours = cal.dataset.nbjours;
});

function onClick(event) {
    // La variable t contient l'élément HTML sur lequel le clic a été fait
    var t = event.target;

    // Id de l'élément sur lequel le clic a été fait
    var id = t.id;
    // Le nom de la balise qui contient le html
    var localName = t.localName;

    // S'il s'agit d'une cellule
    if (localName == "td") {
        // On regarde ce que contient la cellule
        var contenu =  document.getElementById(id).innerHTML;
        if (contenu == "") {
            // Si le contenu est vide, on cherche a mettre des checkMarks
            symbole = checkMark;
        } else {
            // Autrement on cherche a vider les cellules
            symbole = "";
        }
        // On change le contenu pour le symbole
        document.getElementById(id).innerHTML = symbole;
    }

};

function onMove(event) {
    // La variable t contient l'élément HTML sur lequel le clic a été fait
    var t = event.target;

    // Id de l'élément sur lequel le clic a été fait
    var id = t.id;
    // Le nom de la balise qui contient le html
    var localName = t.localName;

    // Si le contenu de la cellule n'est pas le symbole, on y insert le symbole
    var contenu =  document.getElementById(id).innerHTML;
    if (event.buttons == 1 && localName == "td" && contenu != symbole) {
        document.getElementById(id).innerHTML = symbole;
    }
};

// Encode en binaire les positions disponibles du participant
var compacterDisponibilites = function() {
    var dispo = "";

    // On regarde tous les cases de disponibilité
    for (var i = 0; i < nbHeures; i++) {
        for (var j = 0; j < nbJours; j++) {
            var id = j + "-" + i;
            if (document.getElementById(id).innerHTML != "") {
                dispo += "1"; // 1 si le participant a coche la case
            } else {
                dispo += "0"; // 0 si pas disponible
            }
        }
    }
    
    return dispo;
};
