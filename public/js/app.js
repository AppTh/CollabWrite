// public/core.js
var app = angular.module('nodeAngularDemo', ['ui.router'])

// Config of app (ui-router)
.config([

    '$locationProvider',
    '$stateProvider',
    '$urlRouterProvider',

    function($locationProvider, $stateProvider, $urlRouterProvider) {

        // For any unmatched url, redirect to /stat
        $urlRouterProvider.otherwise("/stat");
        // Allow HTML5 style url
        $locationProvider.html5Mode({
            enabled: true,
            requireBase: false
        });
        // Set up the states for pages
        $stateProvider
            .state('chat', makeRoute('chat'))
            .state('stat', makeRoute('stat'));
}]);

// Rudimentary route maker
function makeRoute(name){
    return {
        url: "/" + name + '?id',
        templateUrl: "html/" + name + ".html",
        controller: name + 'Ctrl',
        controllerAs: name
    }
}