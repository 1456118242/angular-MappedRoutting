(function () {
    "use strict";



    angular
        .module( "mappedRoutingApp", [
            "mappedRoutingApp.globals",
            "mappedRoutingApp.services",
            "mappedRoutingApp.controller",
            "mappedRoutingApp.directives",
            "mappedRoutingApp.filters",
            "mappedRoutingApp.loading",
            "mappedRoutingApp.moveStopDialog",
            "mappedRoutingApp.geocodeDialog",
            "uiGmapgoogle-maps",
            "dndLists",
            "ngDialog",
            "ngSanitize",
            "pascalprecht.translate"
        ] )
        .config( function ( uiGmapGoogleMapApiProvider ) {
            var key="en";
            switch ( userLanguage.toLowerCase() ) {
                case "zh":
                    key = "zh-CN";
                    break;
                case "au":
                    key = "en";
                    break;
                case "es":
                    key = "es";
                    break;
                case "de":
                    key = "de";
                    break;
                case "pt":
                    key = "pt";
                    break;
                case "fr":
                    key = "fr";
                    break;
                default :
                    key = "en"
            }

            uiGmapGoogleMapApiProvider.configure( {
                client: googleMapApiClientID,
                v: '3.26',
                libraries: 'weather,geometry,visualization,drawing',
                isGoogleMapsForWork: true,
                china: false,
                //key: '',
                //transport: 'http',
                language: key
            } );
        } )
        .config( function ( $httpProvider, globalFunction ) {
            $httpProvider.defaults.headers.post[ 'Content-Type' ] = 'application/x-www-form-urlencoded;charset=utf-8';

            $httpProvider.defaults.transformRequest = [ function ( data ) {
                return angular.isObject( data ) && String( data ) !== '[object File]' ? globalFunction.convertParam( data ) : data;
            } ];
        } )
        .config( ['$translateProvider',function($translateProvider){
            $translateProvider.preferredLanguage('en');
            $translateProvider.useStaticFilesLoader({
                prefix: 'MappedRouting/app/i18n/',
                suffix: '.json'
            });
        }] )
        .config(['$httpProvider', function($httpProvider){
             $httpProvider.interceptors.push("httpInterceptorService");
    }])
    ;
})();
