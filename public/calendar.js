'use strict';

var cal = document.getElementById("calendrier");
var checkMark = "&#10003";
var symbole = "";

document.addEventListener('DOMContentLoaded', function() {

    // TODO: Ajoutez ici du code qui doit s'exécuter au chargement de
    // la page
});

function onClick(event) {

    /* La variable t contient l'élément HTML sur lequel le clic a été
       fait. Notez qu'il ne s'agit pas forcément d'une case <td> du
       tableau */
    var t = event.target;

    // Attribut id de l'élément sur lequel le clic a été fait
    var id = t.id;
    var contenu =  document.getElementById(id).innerHTML;
    if (id[1] == "-") {
        if (contenu == "") {
            symbole = checkMark;
        } else {
            symbole = "";
        }
    }
    document.getElementById(id).innerHTML = symbole;
};

function onMove(event) {
    // TODO

    var t = event.target;
    var id = t.id;

    var contenu =  document.getElementById(id).innerHTML;
    if (event.buttons == 1 && id[1] == "-" && contenu != symbole) {
        document.getElementById(id).innerHTML = symbole;
    }
};

var compacterDisponibilites = function() {
    // TODO

    return '0000000';
};