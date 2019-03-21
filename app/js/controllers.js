(function () {
    "use strict";

    angular
        .module( "mappedRoutingApp.controller", [ "mappedRoutingApp.services", "mappedRoutingApp.loading", "mappedRoutingApp.globals","autocomplete" ] )
        .controller( "mappedRoutingController", MappedRoutingController )
        .controller( "GoogleMapController", GoogleMapController )
    ;

    MappedRoutingController.$inject = [ "$scope", "$q", "dataService", "loading", "uiGmapGoogleMapApi", "googleMapApi", "customEvent", "globalSetting", "oldJson", "mappedRoutingService", "mapService", "timelineService", "$document", "repositoryService"
    ];

    function MappedRoutingController( $scope, $q, dataService, loading, uiGmapGoogleMapApi, googleMapApi, customEvent, globalSetting, oldJson, mappedRoutingService, mapService, timelineService, $document, repositoryService ) {
        loading.show();
        var vm = this;

        uiGmapGoogleMapApi.then( function ( map ) {
            googleMapApi.maps = map;

            $q.all( [ dataService.loadInitialJson(), dataService.loadMapPointData(), dataService.loadDeliverymanJson(), dataService.getCustomerReceipt(), dataService.getRouteTypeActivityEvents()] ).then( successCallback );
        } );

        function successCallback( result ) {
            //Task 364710
            if(result[ 0 ].data == ""){
                loading.hide();
                return;
            }
            globalSetting.rootJson = result[ 0 ].data;
            globalSetting.mapPointJson = result[ 1 ].data;
            globalSetting.deliverymanList = result[ 2 ].data.DeliveryManJson;
            globalSetting.customerReceipt = result[ 3 ].data.C;
            globalSetting.routeTypeActivityEvents = result[ 4 ].data.RouteTypeActivityEventJson;
            if(globalSetting.linearUnitOfMeasure == '2'){
                globalSetting.MilesConversionConstant = 1000;
            }
            // var emptyMapPointRouteList = repositoryService.getRouteIDIfMapPointIDIsNull();
            // if (emptyMapPointRouteList.length > 0) {
            //     mappedRoutingService.dialogNoMapPointRoute( emptyMapPointRouteList );
            //     loading.hide()
            // }else{

            mappedRoutingService.alertIfStopCountMoreThen100();

            initData();
            bindEvents( $scope );
            addWatcher( $scope );
            $scope.$broadcast( customEvent.loadRootJsonCompleted, vm.rootJson, true );
            // }

        }

        function bindEvents( $scope ) {
            $scope.$on( customEvent.reCalculateAllRoutes, function(){
                mapService.reCalculateRoutes( vm.rootJson.Routes );
            });

            $scope.$on( customEvent.initJsonData, function( event, data, isAutoRouted ){
                // deep copy current(old) rootJson
                var previousRootJson = angular.copy( globalSetting.rootJson );
                globalSetting.rootJson = data;

                keepPropertyStatusByPreviousRootJson( previousRootJson, isAutoRouted );
                initData();

                $scope.$broadcast( customEvent.loadRootJsonCompleted, vm.rootJson, false );
            });

            $scope.$on( customEvent.drawTimeline, function() {
                if ( globalSetting.rootJson.isShowTimeline ){
                    timelineService.drawTimeline();
                }
            });
        }

        function addWatcher( $scope ) {

        }

        function initData(){
            vm.rootJson = globalSetting.rootJson;
            vm.rootJson.deliverymanList = globalSetting.deliverymanList;
            mappedRoutingService.initStopSeq( vm.rootJson );

            // deep copy new rootJson to oldJson
            oldJson.rootJson = angular.copy( vm.rootJson );
        }

        function keepPropertyStatusByPreviousRootJson( previousRootJson, isAutoRouted ) {
            globalSetting.rootJson.isShowTimeline = previousRootJson.isShowTimeline;

            for( var i = 0; i < previousRootJson.Routes.length; i++){
                globalSetting.rootJson.Routes[ i ].isShowRouteList = previousRootJson.Routes[ i ].isShowRouteList;
                globalSetting.rootJson.Routes[ i ].isShowRouteOnMap = previousRootJson.Routes[ i ].isShowRouteOnMap;

            }

            if ( isAutoRouted ) {
                try {
                    mappedRoutingService.autoRouteCompareLoadSheetList( previousRootJson.Routes, globalSetting.rootJson.Routes );
                } catch ( e ) {
                    console.log( "auto route color and text error" );
                    console.log( e );
                }
            }
        }
        window.addEventListener('beforeunload',mappedRoutingService.beforeunloadHandler);
        // window.onbeforeunload = mappedRoutingService.beforeunloadHandler;
    }

    GoogleMapController.$inject = [ "$scope", "mainService", "customEvent", "mapService", "googleMapObj", "uiGmapIsReady", "mapHelperService" ];

    function GoogleMapController( $scope, mainService, customEvent, mapService, googleMapObj, uiGmapIsReady, mapHelperService ) {
        var vm = this;
        $scope.$on( customEvent.loadRootJsonCompleted, function ( eve, rootJson, isReSetMap ) {
            if ( isReSetMap ){
                vm.map = {
                    center: { latitude: 40.1451, longitude: -99.6680 },
                    zoom: 5,
                    control: {},
                    overlay: null,
                    options:{
                        //mapTypeControl: true,
                        //mapTypeControlOptions: {
                        //    position: google.maps.ControlPosition.RIGHT_CENTER
                        //},
                        zoomControl: true,
                        zoomControlOptions: {
                            style:google.maps.ZoomControlStyle.SMALL,
                            position: google.maps.ControlPosition.RIGHT_CENTER//RIGHT_TOP
                        },
                        panControl: true,
                        panControlOptions: {
                            position: google.maps.ControlPosition.RIGHT_CENTER//RIGHT_TOP
                        }
                    }
                };

                uiGmapIsReady.promise( 1 ).then( function ( instances ) {
                    googleMapObj.mapObj = instances[ 0 ].map;
                    googleMapObj.drawManager = mapHelperService.drawManager();
                    mainService.init( rootJson, true );
                } );
            }else{
                mainService.init( rootJson, false );
            }
        } );
    }
})();
