(function () {
    "use strict";

    angular
        .module( "mappedRoutingApp.services", [ "mappedRoutingApp.globals", "mappedRoutingApp.loading" ] )
        .factory( "mainService", mainService )
        .factory( "mapService", mapService )
        .factory( "mappedRoutingService", mappedRoutingService )
        .factory( "mapHelperService", mapHelperService )
        .factory( "mapExceptionService", mapExceptionService )
        .factory( "utilService", utilService )
        .factory( "printService", printService )
        .factory( "repositoryService", repositoryService )
        .factory( "dataService", dataService )
        .factory( "sequenceService", sequenceService )
        .factory( "timelineService", timelineService )
        .factory( "httpInterceptorService", httpInterceptorService )
        .factory( "eventBus", eventBus )
    ;


    mainService.$inject = [ "mapService", "utilService", "_", "loading", "repositoryService", "$q", "timelineService", "mappedRoutingService", "globalSetting" ];
    function mainService( mapService, utilService, _, loading, repositoryService, $q, timelineService, mappedRoutingService, globalSetting ) {
        var service = {
            init: init
        };
        return service;

        function init( rootJson, isSetMapCenter ) {
            addDefaultPropertyToJson( rootJson );
            mapService.clearRoutesOnMap( rootJson.Routes );
            beforeCalculateRoutes( rootJson ).then( function () {
                mapService.calculateRoutes( rootJson.Routes ).then( completedCallBack );
            } );

            function completedCallBack( reCalculateRouteList ) {
                mapService.bindingEvents( rootJson.Routes );
                mapService.showOrHideRouteByRouteList( rootJson.Routes );
                mapService.showOrHideAllPolylineByIsDrawPolylineList();
                timelineService.drawTimeline();

                if ( isSetMapCenter === true ) {
                    mapService.setMapCenter( rootJson.Routes );
                }

                utilService.translate();

                if ( !_.isUndefined( reCalculateRouteList ) && !_.isNull( reCalculateRouteList ) && reCalculateRouteList.length > 0 ) {
                    mapService.reCalculateRoutes( reCalculateRouteList );
                } else {
                    loading.hide();
                }
            }

            function failCallback( result ) {
                console.log( result.msg );
                loading.hide();
            }
        }

        //=============================================== private ====================================================//

        function addDefaultPropertyToJson( rootJson ) {
            try {
                rootJson.showProductPickTypeSettingList = _.trimRight( rootJson.ShowProductPickTypesetting, ";" ).split( ";" );
            } catch ( err ) {
                rootJson.showProductPickTypeSettingList = [ "Total;" ];
            }
            var showFieldNameList = [];
            if ( rootJson.Routes.length > 0 ) {
                var pickUnitNameList = rootJson.Routes[ 0 ].PickUnits.split( "^" );
                _.forEach( pickUnitNameList, function ( p ) {
                    showFieldNameList.push( {
                        fieldName: p,
                        isShow: (p == "Total") ? true : (_.indexOf( rootJson.showProductPickTypeSettingList, p ) == -1 ? false : true),
                        isDisplayOnControlPanel: p != "Total"
                    } );
                } );
                //showFieldNameList = rootJson.Routes[ 0 ].PickUnits.split( "^" );
            }

            rootJson.isSaveLoadSheetOnly = "true";
            rootJson.isShowRouteTable = true;
            rootJson.isAutoRoute = false;
            rootJson.currentShowStopInfoObj = { isShow: false };
            rootJson.currentShowRouteInfoObj = { isShow: false };
            rootJson.isShowAllRouteList = false;
            rootJson.isClickSelectOrDrag = 0;
            rootJson.isDrawPolylineList = rootJson.DrawDirection == "1";
            rootJson.timelineHeaderObjList = [];
            rootJson.isShowMoveToThisLoadSheet = false;
            rootJson.isShowToolsBar = true;


            if ( !_.has( rootJson, "isShowTimeline" ) ) {
                rootJson.isShowTimeline = false;
            }

            _.forEach( rootJson.Routes, function ( route ) {
                route.showFieldNameList = showFieldNameList;
                route.isShowRouteList = route.isShowRouteList || false;

                if ( !_.has( route, "isShowRouteOnMap" ) ) {
                    route.isShowRouteOnMap = true;
                }

                route.helperPercent = rootJson.HelperPercent;
                route.Helper = (route.Helper == "True" || route.Helper === true) ? true : false;
                route.totalTravelTime = "0:00";
                route.totalServiceTime = "0:00";
                route.SumOfTime = "0:00";
                route.sumOfWeight = 0;
                route.sumOfDistance = 0;
                route.isShowSeqOption = false;
                route.isShowColumnOption = false;
                route.showColumnNum = 0;
                route.isShowEditStartTime = false;
                route.editStartTimeText = route.StartTime;
                route.timelineObj = {};
                route.endRouteTypeActivityEventList = [];
                route.routeCost = "0.00"
                
                _.forEach( route.Stops, function ( stop, index ) {
                    stop.numUnitFieldList = buildNumUnitFieldListByStop( stop, showFieldNameList );
                    stop.isShowStopInfo = false;
                    stop.imageIndex = index + 1;
                    stop.Distance = 0;
                    stop.distanceBetween = 0;
                    stop.distanceWarehouse = 0;
                    stop.displayServiceWindow = "";
                    stop.serviceWindowColor = "black";
                    stop.startTimeColor = "black";
                    stop.endTimeColor = "black";
                    stop.isShowBreakTime = false;
                    // stop.routeActivityEventList = [];
                    // stop.minimizeObject= {
                    //     isShow : false,
                    //     fromImageIndex: -1,
                    //     toImageIndex: -1
                    // };

                    if ( !_.has( stop, "autoRouteStr" ) || !_.has( stop, "autoRouteColor" ) ) {
                        stop.autoRouteStr = "";
                        stop.autoRouteColor = "";
                    }

                    try {
                        stop.CustomerReceipt = Number( Number( repositoryService.getReceiptByCustomerIDAndLoadSheetID( stop.CustomerID, route.LoadSheetID ).Receipt ).toFixed( 2 ) );
                    } catch ( e ) {
                        stop.CustomerReceipt = 0;
                    }

                } );
            } );
        }

        function buildNumUnitFieldListByStop( stop, showFieldNameList ) {
            var fieldList = [];

            if ( _( showFieldNameList ).some() ) {
                var numUnitsStr = _.trimRight( stop.NumUnitsStr, "^" ).split( "^" );
                _.forEach( numUnitsStr, function ( numUnit, index ) {
                    var fieldObj = {};
                    fieldObj.isShow = showFieldNameList[ index ].isShow;
                    fieldObj.field = showFieldNameList[ index ].fieldName;
                    fieldObj.value = numUnit;
                    fieldList.push( fieldObj );
                } );
            }
            return fieldList;
        }

        function beforeCalculateRoutes( rootJson ) {
            var q = $q.defer();

            var emptyStopList = repositoryService.getEmptyStopList( rootJson.Routes );
            if ( !_.isEmpty( emptyStopList ) ) {
                emptyStopList = _.flatten( emptyStopList );
                mapService.codeLngLatEmpty( emptyStopList ).then( function () {
                    q.resolve();
                }, function ( result ) {
                    q.resolve( result );
                } );
            } else {
                q.resolve();
            }

            return q.promise;
        }
    }

    mapService.$inject = [ "$q", "_", "mapExceptionService", "googleMapApi", "googleMapObj", "moveStopDialog", "mappedRoutingService", "globalSetting", "mapHelperService", "repositoryService", "loading", "$rootScope", "$filter", "geocodeDialog", "ngDialog", "timelineService", "utilService" ];
    function mapService( $q, _, mapExceptionService, googleMapApi, googleMapObj, moveStopDialog, mappedRoutingService, globalSetting, mapHelperService, repositoryService, loading, $rootScope, $filter, geocodeDialog, ngDialog, timelineService, utilService ) {
        var service = {
            calculateRoutes: calculateRoutes,
            setMapCenter: setMapCenter,
            reCalculateRoutes: reCalculateRoutes,
            updateDurationByDragDrop: updateDurationByDragDrop,
            showOrHideRoute: showOrHideRoute,
            showOrHidePolyline: showOrHidePolyline,
            setRouteColor: setRouteColor,
            bindingEvents: bindingEvents,
            codeLngLatEmpty: codeLngLatEmpty,
            calculateRoutesByReSequence: calculateRoutesByReSequence,
            clearRoutesOnMap: clearRoutesOnMap,
            showOrHideAllPolylineByIsDrawPolylineList: showOrHideAllPolylineByIsDrawPolylineList,
            clearSelectedMarkerOnMap: clearSelectedMarkerOnMap,
            manualGeocoding: manualGeocoding,
            calculateRoutesByPrint: calculateRoutesByPrint,
            moveStopsToOtherRoute: moveStopsToOtherRoute,
            showOrHideRouteByRouteList: showOrHideRouteByRouteList,
            optimizeByGoogle: optimizeByGoogle,

        };
        return service;

        function calculateRoutes( routes, i, deffered ) {
            var deferred = deffered || $q.defer();
            var i = i || 0;
            var route = routes[ i ];
            var oneRouteLatLngList = buildLatLngListByRoute( route );
            var requests = buildRequestList( oneRouteLatLngList );
            var directionsService = new googleMapApi.maps.DirectionsService;
	        route.calculateDirectionsByManual = false;

            if (route.Stops.length >= 100){
                calculateDirectionsByManual( route ).then(successCallback, failedCallback);
            }else{
                setTimeout( function () {
                    calculateDirections( directionsService, requests ).then( successCallback, failedCallback );
                }, i * 10 + 500 );
            }


            function successCallback( responseList ) {
                setDurationAndDistance( responseList, route );
                mappedRoutingService.computeDriveDuration( route );
                drawRoute( responseList, route );

                ++i;
                if ( i < routes.length ) {
                    calculateRoutes( routes, i, deferred );
                } else {
                    calculateDirectionsCompleted( deferred );
                }
            }

            function failedCallback(result) {
                calculateDirectionsByManual( route ).then(successCallback);
                // if (result.status === "ZERO_RESULTS"){
                //     if ( routes[ i ].Stops.length > 0 ) {
                //         mapExceptionService.addExceptionRoute( routes[ i ], oneRouteLatLngList );
                //     }
                //
                //     ++i;
                //     if ( i < routes.length ) {
                //         calculateRoutes( routes, i, deferred );
                //     } else {
                //         calculateDirectionsCompleted( deferred );
                //     }
                // }else {
                //     alert(routes[ i ].RouteID + " " + routes[ i ].Route +"\n " + 'Directions request failed due to ' + result.status);
                // }
            }

            return deferred.promise;
        }

        function calculateDirectionsCompleted( deferred ) {
            var exceptionObjList = mapExceptionService.getExceptionObjList();
            if ( exceptionObjList.length > 0 ) {
                mapExceptionService.handlerExceptionRoute().then( function ( exceptionRouteAndStopList ) {
                    // show dialog
                    showSetLocationDialog( exceptionRouteAndStopList ).then( function ( reRouteList ) {
                        var customerList = [];
                        _.forEach( exceptionRouteAndStopList, function ( exceptionRouteAndStop ) {
                            customerList.push( exceptionRouteAndStop.exceptionStop );
                        } );
                        mappedRoutingService.buildSaveCustomerLocation( customerList );
                        mapExceptionService.clearExceptionObjList();

                        deferred.resolve( reRouteList );
                    }, function () {
                        // click closed icon
                        deferred.resolve();
                    } );

                }, function () {
                    //can not find exception stop
                    var tmpRouteList = _.map( exceptionObjList, 'route' );
                    deferred.resolve( tmpRouteList );
                } );
            } else {
                deferred.resolve();
            }
        }

        function setMapCenter( routes, mapObj ) {
            var routesLatLngList = [];
            _.forEach( routes, function ( route ) {
                if (route.Stops.length > 0) {
                    routesLatLngList.push( buildLatLngListByRoute( route ) );
                }
            } );

            var allRoutesLatLngListFlatten = _.flatten( routesLatLngList );
            mapHelperService.setCenterByLatLngBounds( allRoutesLatLngListFlatten, mapObj );
        }

        function reCalculateRoutes( routes ) {
            if ( routes.length > 0 ) {
                mappedRoutingService.reSetImageIndexByRoutes( routes );
                clearRoutesOnMap( routes );
                calculateRoutes( routes ).then( function ( reCalculateRouteList ) {
                    bindingEvents( routes );
                    //setMapCenter( routes );
                    showOrHideRouteByRouteList( routes );
                    showOrHideAllPolylineByIsDrawPolylineList();
                    timelineService.drawTimeline();

                    if ( !_.isUndefined( reCalculateRouteList ) && !_.isNull( reCalculateRouteList ) && reCalculateRouteList.length > 0 ) {
                        reCalculateRoutes( reCalculateRouteList );
                    } else {
                        loading.hide();
                    }

                } );
            } else {
                loading.hide();
            }
        }

        function updateDurationByDragDrop( stops ) {
            var q = $q.defer();
            var oneRouteLatLngList = buildLatLngListByStops( stops );
            var requests = buildRequestList( oneRouteLatLngList );

            var directionsService = new googleMapApi.maps.DirectionsService;

            calculateDirections( directionsService, requests ).then( function ( responseList ) {
                var response = responseList[ 0 ];
                var legs = response.routes[ 0 ].legs;

                stops[ 1 ].Duration = legs[ 0 ].duration.value;
                stops[ 1 ].Distance = legs[ 0 ].distance.value;

                if ( stops.length > 2 ) {
                    stops[ 2 ].Duration = legs[ 1 ].duration.value;
                    stops[ 2 ].Distance = legs[ 1 ].distance.value;
                }

                q.resolve( stops );
            } );

            return q.promise;
        }

        function showOrHideRoute( loadSheetID, isShow ) {
            showOrHidePolyline( loadSheetID, isShow );

            _.chain( googleMapObj.markerList )
                .filter( function ( m ) {
                    return m.loadSheetID == loadSheetID;
                } )
                .forEach( function ( m ) {
                    mapHelperService.showOrHideMarker( m, isShow );
                } )
                .value();
        }

        function showOrHidePolyline( loadSheetID, isShow ) {
            _.chain( googleMapObj.polylineList )
                .filter( function ( p ) {
                    return p.loadSheetID == loadSheetID;
                } )
                .forEach( function ( p ) {
                    mapHelperService.showOrHidePolyline( p, isShow );
                } )
                .value();
        }

        function setRouteColor( route ) {
            //todo not perfect repeat

            _.chain( googleMapObj.polylineList )
                .filter( function ( p ) {
                    return p.loadSheetID == route.LoadSheetID;
                } )
                .forEach( function ( p ) {
                    mapHelperService.setPolylineColor( p, "#" + route.Color );
                } )
                .value();

            _.chain( googleMapObj.markerList )
                .filter( function ( m ) {
                    return m.loadSheetID == route.LoadSheetID;
                } )
                .forEach( function ( m ) {
                    var color = repositoryService.getMarkerColorByStopID( m.stopID, route);
                    mapHelperService.setMarkerIcon( m, color, m.labelID );
                } )
                .value();
        }

        function bindingEvents( routes ) {
            _.forEach( routes, function ( r ) {
                _.chain( googleMapObj.polylineList )
                    .filter( function ( p ) {
                        return p.loadSheetID == r.LoadSheetID;
                    } )
                    .forEach( function ( p ) {
                        bindingPolylineEvents( p );
                    } )
                    .value();

                _.chain( googleMapObj.markerList )
                    .filter( function ( m ) {
                        return m.loadSheetID == r.LoadSheetID;
                    } )
                    .forEach( function ( m ) {
                        bindingMarkerEvents( m );
                    } )
                    .value();
            } );

            bindingMapEvents();
        }

        function calculateRoutesByReSequence( customerList, route ) {
            var deferred = $q.defer();

            var oneCustomerLatLngList = buildLatLngListByCustomerIDList( customerList, route );
            var requests = buildRequestList( oneCustomerLatLngList );
            var directionsService = new googleMapApi.maps.DirectionsService;

            calculateDirections( directionsService, requests ).then( successCallback, failedCallback );

            function successCallback( responseList ) {
                deferred.resolve( responseList );
            }

            function failedCallback( result ) {
                deferred.reject( result );
            }

            return deferred.promise;
        }

        function clearRoutesOnMap( routes ) {
            _.forEach( routes, function ( r ) {
                _.chain( googleMapObj.polylineList )
                    .filter( function ( p ) {
                        return p.loadSheetID == r.LoadSheetID;
                    } )
                    .forEach( function ( p ) {
                        mapHelperService.removePolyline( p );
                    } )
                    .value();

                _.chain( googleMapObj.markerList )
                    .filter( function ( m ) {
                        return m.loadSheetID == r.LoadSheetID;
                    } )
                    .forEach( function ( m ) {
                        mapHelperService.removeMarker( m );
                    } )
                    .value();

                _.remove( googleMapObj.polylineList, function ( p ) {
                    return p.loadSheetID == r.LoadSheetID;
                } );

                _.remove( googleMapObj.markerList, function ( m ) {
                    return m.loadSheetID == r.LoadSheetID;
                } )
            } );
        }

        function showOrHideAllPolylineByIsDrawPolylineList() {
            _.forEach( googleMapObj.polylineList, function ( p ) {
                var route = repositoryService.getLoadSheetByKey( p.loadSheetID );

                if ( route.isShowRouteOnMap ) {
                    mapHelperService.showOrHidePolyline( p, globalSetting.rootJson.isDrawPolylineList);
                }

            } )
        }

        function clearSelectedMarkerOnMap( isResetMarkerIcon, loadSheetID ) {
            _.forEach( googleMapObj.markerList, function ( marker ) {
                if ( (marker.isSelectedOnMap === true
                    && !_.isUndefined( loadSheetID )
                    && !_.isUndefined( marker.loadSheetID )
                    && marker.loadSheetID == loadSheetID) || (marker.isSelectedOnMap === true && _.isUndefined( loadSheetID ) ) ) {

                    marker.isSelectedOnMap = false;
                    if ( isResetMarkerIcon === true ) {
                        var route = repositoryService.getLoadSheetByKey( marker.loadSheetID );
                        var color = repositoryService.getMarkerColorByStopID( marker.stopID, route);

                        mapHelperService.setMarkerIcon( marker, color, marker.labelID );
                    }
                }

            } );
            var selectedStops = repositoryService.getStopsByIsSelectedOnMap( googleMapObj.markerList );
            if ( selectedStops.length > 0 ) {
                globalSetting.rootJson.isShowMoveToThisLoadSheet = true;
            } else {
                globalSetting.rootJson.isShowMoveToThisLoadSheet = false;
            }
        }

        function manualGeocoding( stop, route ) {
            var inputValue = stop.Address + ", " + stop.City + ", " + stop.State;

            var latLngObj = undefined;
            if ( !_.isEmpty( stop.Latitude ) && !_.isEmpty( stop.Longitude ) ) {
                latLngObj = {};
                latLngObj.lat = Number( stop.Latitude );
                latLngObj.lng = Number( stop.Longitude );
            }

            var saveCallback = function ( latlng ) {
                stop.Latitude = latlng.lat;
                stop.Longitude = latlng.lng;
                loading.show();
                mappedRoutingService.buildSaveCustomerLocation( [ stop ] );
                reCalculateRoutes( [ route ] );
            };

            geocodeDialog.openDialog( inputValue, undefined, saveCallback, latLngObj );
        }

        function calculateRoutesByPrint( routes, mapObj, instructionObjList, i, deffered ) {
            var deferred = deffered || $q.defer();
            var i = i || 0;
            var route = routes[ i ];
            var oneRouteLatLngList = buildLatLngListByRoute( route );
            var requests = buildRequestList( oneRouteLatLngList );
            var directionsService = new googleMapApi.maps.DirectionsService;

            var instructionObjList = instructionObjList || [];

            setTimeout( function () {
                calculateDirections( directionsService, requests ).then( successCallback );
            }, i * 10 + 500 );


            function successCallback( responseList ) {
                drawRoute( responseList, route, mapObj );

                var tmpObj = {
                    title: route.Route,
                    instructionsStr: ""
                };
                instructionObjList.push( tmpObj );
                _.forEach( responseList, function ( r ) {
                    _.forEach( r.routes[ 0 ].legs, function ( l ) {
                        _.forEach( l.steps, function ( s ) {
                            tmpObj.instructionsStr += s.instructions + "</br>";
                        } );
                    } );
                } );

                ++i;
                if ( i < routes.length ) {
                    calculateRoutesByPrint( routes, mapObj, instructionObjList, i, deferred );
                } else {
                    deferred.resolve( instructionObjList );
                }
            }

            return deferred.promise;
        }

        function moveStopsToOtherRoute( loadSheet, stop, selectedStops, isClickPolyline ) {
            loading.show();

            var filterAndSortedStops;
            if ( isClickPolyline ) {
                filterAndSortedStops = _.chain( selectedStops )
                    .filter( function ( selectedStop ) {
                        var fromLoadSheet = repositoryService.getRouteByStopID( selectedStop.StopID );
                        if ( !_.isNull( fromLoadSheet ) ) {
                            return fromLoadSheet.LoadSheetID != loadSheet.LoadSheetID
                        }

                        return true;
                    } )
                    .sortByOrder( function ( selectedStop ) {
                        return Number( selectedStop.DefaultSeq );
                    }, 'desc' )
                    .value();
            } else {
                filterAndSortedStops = _.sortByOrder( selectedStops, function ( selectedStop ) {
                    return Number( selectedStop.DefaultSeq );
                }, 'desc' );
            }


            mappedRoutingService.moveStopsToOtherRouteBySelectedOnMap( loadSheet, stop, filterAndSortedStops ).then( function ( redrawRouteList ) {
                moveStopDialog.remove();
                clearSelectedMarkerOnMap( true );
                reCalculateRoutes( redrawRouteList );
            } );
        }

        function showOrHideRouteByRouteList( RouteList ) {
            _.forEach( RouteList, function ( route ) {
                showOrHideRoute( route.LoadSheetID, route.isShowRouteOnMap );
            } );
        }


        function optimizeByGoogle( route ) {
            var q = $q.defer();

            var oneRouteLatLngList = buildLatLngListByRoute( route );
            var requests = buildRequestList( oneRouteLatLngList );

            var directionsService = new googleMapApi.maps.DirectionsService;

            calculateDirections( directionsService, requests, undefined, undefined, true ).then( function ( responseList ) {
                var response = responseList[ 0 ];
                q.resolve( response.routes[ 0 ].waypoint_order );
            }, function ( result ) {
                alert('Directions request failed due to ' + result.status + ', Please try again.');
                loading.hide();
            });

            return q.promise;
        }

        //=============================================== private ====================================================//

        function setDurationAndDistance( response, route ) {
            var allLegs = [];
            _.forEach( response, function ( responseRoute ) {
                _.forEach( responseRoute.routes[ 0 ].legs, function ( leg ) {
                    allLegs.push( leg );
                } );

            } );

            _.forEach( route.Stops, function ( stop, index ) {
                stop.Duration = allLegs[ index ].duration.value;
                stop.Distance = allLegs[ index ].distance.value;
                stop.distanceBetween = Number( (stop.Distance / globalSetting.MilesConversionConstant).toFixed( 1 ) );

                var tmpDistance = 0;
                for ( var i = index; i >= 0; i-- ) {
                    tmpDistance += route.Stops[ i ].Distance;
                }
                stop.distanceWarehouse = Number( (tmpDistance / globalSetting.MilesConversionConstant).toFixed( 1 ) );
            } );

            var legLength = allLegs.length;
            route.Duration = allLegs[ legLength - 1 ].duration.value;
            route.Distance = allLegs[ legLength - 1 ].distance.value;
        }

        function drawRoute( responseList, route, mapObj ) {
            var tmpMapObj = mapObj || googleMapObj.mapObj;

            var polylineOption = {
                id: "polyline" + route.LoadSheetID,
                color: "#" + route.Color,
                path: [],
                loadSheetID: route.LoadSheetID
            };

            if (route.calculateDirectionsByManual == false) {
                var tmpPath = [];
                _.forEach( responseList, function ( response ) {
                    tmpPath.push( mapHelperService.getPolylinePath( response.routes[ 0 ].legs ) );
                } );
                polylineOption.path = _.flatten( tmpPath, true );
                var polyline = mapHelperService.createPolyline( polylineOption );
                polyline.setMap( tmpMapObj );
                googleMapObj.polylineList.push( polyline );
            }

            var startPointMarker = createMapPointMarker( route, true );
            startPointMarker.setMap( tmpMapObj );
            googleMapObj.markerList.push( startPointMarker );

            var endPointMarker = createMapPointMarker( route, false );
            endPointMarker.setMap( tmpMapObj );
            googleMapObj.markerList.push( endPointMarker );

            _.forEach( route.Stops, function ( stop ) {
                var markerOption = {
                    id: "marker" + stop.StopID,
                    latitude: stop.Latitude,
                    longitude: stop.Longitude,
                    color: "#" + ( stop.CanMove == "1" ? route.Color : 'ccc'),
                    text: stop.imageIndex,
                    loadSheetID: route.LoadSheetID,
                    stopID: stop.StopID,
                    labelID: stop.imageIndex
                };

                var stopMarker = mapHelperService.createMarker( markerOption );
                stopMarker.setMap( tmpMapObj );
                googleMapObj.markerList.push( stopMarker );
            } );
        }

        function calculateDirections( directionsService, requests, responseList, deferred, isOptimizeWaypoints, recursiveCount ) {
            var deferred = deferred || $q.defer();
            var responseList = responseList || [];
            var recursiveCount = recursiveCount || 0;
            var directionRequest = {
                origin: requests[ 0 ].origin,
                destination: requests[ 0 ].destination,
                waypoints: requests[ 0 ].waypoints,
                optimizeWaypoints: isOptimizeWaypoints || false,
                travelMode: googleMapApi.maps.TravelMode.DRIVING
            };

            directionsService.route( directionRequest, function ( response, status ) {
                if ( status === googleMapApi.maps.DirectionsStatus.OK ) {
                    requests.splice( 0, 1 );
                    responseList.push( response );
                    if ( requests.length > 0 ) {
                        setTimeout( function () {
                            recursiveCount++;
                            calculateDirections( directionsService, requests, responseList, deferred, isOptimizeWaypoints, recursiveCount );
                        }, recursiveCount * 10 + 500 );

                    } else {
                        deferred.resolve( responseList );
                    }
                } else {
                    var result = {};
                    // result.msg =  'Directions request failed due to ' + status;
                    result.status = status;
                    deferred.reject( result );
                }

            } );

            return deferred.promise;
        }

        function buildLatLngListByRoute( route ) {
            //Array.prototype.push.apply(arr1, arr2);
            var result = buildLatLngListByStops( route.Stops );

            var startPointLatLng = mappedRoutingService.createMapPointLatLng(route, "StartMapPointID");
            var endPointLatLng = mappedRoutingService.createMapPointLatLng( route,"EndMapPointID" );

            result.splice( 0, 0, [ startPointLatLng.Latitude, startPointLatLng.Longitude ] );
            result.push( [ endPointLatLng.Latitude, endPointLatLng.Longitude ] );

            return result;
        }

        function buildLatLngListByStops( stops ) {
            var result = [];

            _.forEach( stops, function ( stop ) {
                result.push( [ stop.Latitude, stop.Longitude ] );
            } );

            return result;
        }

        function buildLatLngListByCustomerIDList( customerList, route ) {
            var latLngList = [];

            _.forEach( customerList, function ( c ) {
                if ( c.indexOf( "L" ) > -1 ) {
                    var mapPointID = c.substring( 1, c.length );
                    var mapPointLatLng = repositoryService.getLatLngByMapPointID( mapPointID );
                    latLngList.push( [ mapPointLatLng.Latitude, mapPointLatLng.Longitude ] );

                } else {
                    var stop = repositoryService.getStopByCustomerID( c, route );
                    latLngList.push( [ stop.Latitude, stop.Longitude ] );
                }
            } );

            return latLngList;
        }

        function buildRequestList( latLngArr ) {
            var currentRouteLoadTime = computeLoadTimes( latLngArr.length );
            var result = [];
            for ( var j = 0; j < currentRouteLoadTime; j++ ) {
                var fromIndex = j * ( globalSetting.loadWayPointsEveryTime - 1 );
                var toIndex = (globalSetting.loadWayPointsEveryTime - 1 ) * ( j + 1 ) >= latLngArr.length ?
                latLngArr.length - 1 : ( globalSetting.loadWayPointsEveryTime - 1 ) * ( j + 1 );

                var tmpRequest = {};
                tmpRequest.origin = new googleMapApi.maps.LatLng( latLngArr[ fromIndex ][ 0 ], latLngArr[ fromIndex ][ 1 ] );
                tmpRequest.destination = new googleMapApi.maps.LatLng( latLngArr[ toIndex ][ 0 ], latLngArr[ toIndex ][ 1 ] );
                tmpRequest.waypoints = [];
                var tmpWaypoints = latLngArr.slice( fromIndex + 1, toIndex );
                _.forEach( tmpWaypoints, function ( tmpWaypoint ) {
                    var tmpObj = {};
                    tmpObj.location = new googleMapApi.maps.LatLng( tmpWaypoint[ 0 ], tmpWaypoint[ 1 ] );
                    tmpRequest.waypoints.push( tmpObj );
                } );

                result.push( tmpRequest );
            }
            return result;
        }

        function createMapPointMarker( route, isStartPoint ) {
            var pointLatLng = mappedRoutingService.createMapPointLatLng(route, isStartPoint ? "StartMapPointID" : "EndMapPointID");
            var markerOption = {
                id: "loadSheet" + route.LoadSheetID + (isStartPoint ? "s" + route.StartMapPointID : "e" + route.EndMapPointID),
                latitude: pointLatLng.Latitude,
                longitude: pointLatLng.Longitude,
                color: "#" + route.Color,
                text: (isStartPoint ? "S" : "E"),
                loadSheetID: route.LoadSheetID,
                labelID: (isStartPoint ? "S" : "E")
            };

            return mapHelperService.createMarker( markerOption );
        }

        function computeLoadTimes( count ) {
            //var flag = ( ( count / (  globalSetting.loadWayPointsEveryTime - 1 ) ) + ( count - 1 ) )
            //    % globalSetting.loadWayPointsEveryTime == 0;
            //var t1 = parseInt( count / (  globalSetting.loadWayPointsEveryTime - 1 ) );
            //return parseInt( ( t1 + ( count - 1 ) ) / globalSetting.loadWayPointsEveryTime ) + (flag ? 0 : 1);

            var flag = ( (count - 1) % ( globalSetting.loadWayPointsEveryTime - 1 ) == 0 ) ? 0 : 1;
            return parseInt( (count - 1) / ( globalSetting.loadWayPointsEveryTime - 1 ) ) + flag;
        }

        function bindingMarkerEvents( marker ) {
            marker.addListener( 'click', function () {
                var stopID = marker.stopID;
                var loadSheetID = marker.loadSheetID;
                if ( !_.isUndefined( loadSheetID ) && !_.isNull( loadSheetID ) && !_.isUndefined( stopID ) && !_.isNull( stopID ) ) {

                    var loadSheet = repositoryService.getLoadSheetByKey( loadSheetID );
                    var stop = repositoryService.getStopByKey( stopID, loadSheet );

                    if ( stop.CanMove == "1" ) {
                        marker.isSelectedOnMap = !marker.isSelectedOnMap;
                        if ( marker.isSelectedOnMap ) {
                            moveStopDialog.remove();
                        }
                        mapHelperService.setMarkerIcon( marker,  (marker.isSelectedOnMap ? "#EAEE4F" : repositoryService.getMarkerColorByStopID( marker.stopID, loadSheet)), marker.isSelectedOnMap ? "" : stop.imageIndex );

                        var selectedStops = repositoryService.getStopsByIsSelectedOnMap( googleMapObj.markerList );
                        if ( selectedStops.length > 0 ) {
                            globalSetting.rootJson.isShowMoveToThisLoadSheet = true;
                            $rootScope.$digest();
                        } else {
                            globalSetting.rootJson.isShowMoveToThisLoadSheet = false;
                            $rootScope.$digest();
                        }
                    }
                }
            } );

            marker.addListener( 'mouseover', function () {
                var stopID = marker.stopID;
                var loadSheetID = marker.loadSheetID;
                bindingPropOnStopPanel( marker );
                // todo bu hao
                $rootScope.$digest();

                if ( !_.isUndefined( loadSheetID ) && !_.isNull( loadSheetID ) && !_.isUndefined( stopID ) && !_.isNull( stopID ) ) {
                    marker.setOptions( {
                        zIndex: 99
                    } );
                }

                var selectedStops = repositoryService.getStopsByIsSelectedOnMap( googleMapObj.markerList );
                if ( selectedStops.length > 0 ) {
                    if ( !_.isUndefined( loadSheetID ) && !_.isNull( loadSheetID ) && !_.isUndefined( stopID ) && !_.isNull( stopID ) && !marker.isSelectedOnMap ) {
                        var loadSheet = repositoryService.getLoadSheetByKey( loadSheetID );
                        var stop = repositoryService.getStopByKey( stopID, loadSheet );

                        var pixelPositon = mapHelperService.fromLatLngToPoint( marker.getPosition() );
                        moveStopDialog.setPosition( pixelPositon );
                        moveStopDialog.clickHandler = function () {
                            moveStopsToOtherRoute( loadSheet, stop, selectedStops );
                        };
                    }
                }
            } );

            marker.addListener( 'mouseout', function () {
                var stopID = marker.stopID;
                var loadSheetID = marker.loadSheetID;
                if ( !_.isUndefined( loadSheetID ) && !_.isNull( loadSheetID ) && !_.isUndefined( stopID ) && !_.isNull( stopID ) ) {
                    if ( marker.getShape().coords == googleMapObj.normalSizeShapeCoords ) {
                        marker.setOptions( {
                            zIndex: 10
                        } );
                    }
                }
            } );
        }

        function bindingPropOnStopPanel( marker ) {
            var stopID = marker.stopID;
            var loadSheetID = marker.loadSheetID;
            if ( !_.isUndefined( loadSheetID ) && !_.isNull( loadSheetID ) && !_.isUndefined( stopID ) && !_.isNull( stopID ) ) {
                var loadSheet = repositoryService.getLoadSheetByKey( loadSheetID );
                var stop = repositoryService.getStopByKey( stopID, loadSheet );

                var tmpObject = globalSetting.rootJson.currentShowStopInfoObj;
                globalSetting.rootJson.currentShowRouteInfoObj.isShow = false;
                // todo yao gai
                tmpObject.isShow = true;
                tmpObject.loadSheetID = loadSheet.LoadSheetID;
                tmpObject.stopID = stop.StopID;
                tmpObject.CustomerID = stop.CustomerID;
                tmpObject.UserName = stop.UserName;
                tmpObject.Company = stop.Company;
                tmpObject.Address = stop.Address;
                tmpObject.Address2 = stop.Address2;
                tmpObject.RouteName = loadSheet.Route;
                tmpObject.numUnitFieldList = stop.numUnitFieldList;
                tmpObject.Services = stop.Services;
                tmpObject.totalNumUnitFieldList = [];
                _.forEach( stop.numUnitFieldList, function ( o ) {
                    var field = o.field;
                    var value = $filter( "calculateSumOfNumUnitByStops" )( loadSheet.Stops, o.field );
                    var obj1 = { field: field, value: value };
                    tmpObject.totalNumUnitFieldList.push( obj1 );
                } );
            }
        }

        function bindingPropOnRoutePanel( polyline ) {
            var loadSheetID = polyline.loadSheetID;
            if ( !_.isUndefined( loadSheetID ) && !_.isNull( loadSheetID ) ) {
                var loadSheet = repositoryService.getLoadSheetByKey( loadSheetID );
                var tmpObject = globalSetting.rootJson.currentShowRouteInfoObj;

                globalSetting.rootJson.currentShowStopInfoObj.isShow = false;

                tmpObject.isShow = true;
                tmpObject.Route = loadSheet.Route;
                tmpObject.Employee = loadSheet.Employee;
                tmpObject.stopCount = loadSheet.Stops.length;

                tmpObject.totalNumUnitFieldList = [];
                _.forEach( loadSheet.Stops[ 0 ].numUnitFieldList, function ( o ) {
                    var field = o.field;
                    var value = $filter( "calculateSumOfNumUnitByStops" )( loadSheet.Stops, o.field );
                    var obj1 = { field: field, value: value };
                    tmpObject.totalNumUnitFieldList.push( obj1 );
                } );

                tmpObject.TravelTime = $filter( "calculateSumOfTimeByStops" )( loadSheet, "travelTime" );
                tmpObject.ServiceTime = $filter( "calculateSumOfTimeByStops" )( loadSheet, "serviceTime" );
                tmpObject.TotalTime = $filter( "calculateSumOfTimeByStops" )( loadSheet, "totalTime" );

            }
        }

        function bindingPolylineEvents( polyline ) {
            polyline.addListener( 'click', function () {
                var selectedStops = repositoryService.getStopsByIsSelectedOnMap( googleMapObj.markerList );
                if ( selectedStops.length > 0 ) {
                    var loadSheetID = polyline.loadSheetID;
                    if ( !_.isUndefined( loadSheetID ) && !_.isNull( loadSheetID ) ) {
                        var loadSheet = repositoryService.getLoadSheetByKey( loadSheetID );
                        var stop = loadSheet.Stops[ loadSheet.Stops.length - 1 ];
                        moveStopsToOtherRoute( loadSheet, stop, selectedStops, true );
                    }
                }
            } );

            polyline.addListener( 'mouseover', function () {
                polyline.setOptions( { strokeWeight: 10 } );
                bindingPropOnRoutePanel( polyline );
                // todo bu hao
                $rootScope.$digest();
            } );

            polyline.addListener( 'mouseout', function () {
                polyline.setOptions( { strokeWeight: 6 } );
            } );
        }

        function bindingMapEvents() {
            googleMapObj.mapObj.addListener( "click", function () {
                globalSetting.rootJson.currentShowStopInfoObj.isShow = false;
                globalSetting.rootJson.currentShowRouteInfoObj.isShow = false;

                moveStopDialog.remove();

                // todo yao gai
                $rootScope.$digest();

            } );

            googleMapObj.mapObj.addListener( "zoom_changed", function () {
                moveStopDialog.remove();
            } );

            googleMapObj.mapObj.addListener( "drag", function () {
                moveStopDialog.remove();
            } );
        }

        function codeLngLatEmpty( emptyStopsList, i, deferred ) {
            var i = i || 0;
            var deferred = deferred || $q.defer();
            var stop = emptyStopsList[ i ];
            var address = stop.Address + stop.City + stop.State;
            mapHelperService.codeAddress( address ).then( successCallBack, failCallback );

            function successCallBack( result ) {
                stop.Latitude = result.latlng.lat;
                stop.Longitude = result.latlng.lng;
                //var tmpStopStr = stop.CustomerID + "^" + stop.Latitude + "^" + stop.Longitude + "|";
                //dataService.saveCustomerLocation( tmpStopStr, false );
                ++i;
                if ( i < emptyStopsList.length ) {
                    codeLngLatEmpty( emptyStopsList, i, deferred );
                } else {
                    mappedRoutingService.buildSaveCustomerLocation( emptyStopsList );
                    deferred.resolve();
                }
            }

            function failCallback( result ) {
                ++i;
                if ( i < emptyStopsList.length ) {
                    codeLngLatEmpty( emptyStopsList, i, deferred );
                } else {
                    mappedRoutingService.buildSaveCustomerLocation( emptyStopsList );
                    deferred.reject( result );
                }
            }

            return deferred.promise;
        }

        //function clearMarkersSelectedState() {
        //    _.forEach( googleMapObj.markerList, function ( m ) {
        //        m.isSelectedOnMap = false;
        //    } );
        //}

        function showSetLocationDialog( exceptionRouteAndStopList ) {
            loading.hide();
            var exceptionObjList = exceptionRouteAndStopList;
            console.log( exceptionObjList );
            var handerNum = 0;
            var q = $q.defer();
            var dialog = ngDialog.open( {
                template: 'MappedRouting/app/template/exceptionstoplist.html?' + new Date().getTime().toString(),
                closeByEscape: false,
                closeByDocument: false,
                className: "ngdialog-theme-default ngdialog-theme-exception-stoplist",
                controller: [ '$scope', function ( $scope ) {
                    $scope.exceptionObjList = exceptionObjList;
                    $scope.setLocation = function ( exceptionObj, event ) {
                        var inputValue = exceptionObj.exceptionStop.Address + ", " + exceptionObj.exceptionStop.City + ", " + exceptionObj.exceptionStop.State;
                        var saveCallback = function ( latlng ) {
                            handerNum++;
                            exceptionObj.exceptionStop.Latitude = latlng.lat;
                            exceptionObj.exceptionStop.Longitude = latlng.lng;
                            if ( handerNum == exceptionObjList.length ) {
                                loading.show();
                                var tmpRouteList = _.map( exceptionObjList, 'exceptionRoute' );
                                q.resolve( tmpRouteList );
                                ngDialog.closeAll();
                            }
                        };
                        geocodeDialog.openDialog( inputValue, event.currentTarget, saveCallback );
                    }
                } ]
            } );

            dialog.closePromise.then( function ( data ) {
                mapExceptionService.clearExceptionObjList();

                // click closed icon, cancel set location
                q.reject();

            } );
            return q.promise;
        }
        //Task 431013
        function calculateDirectionsByManual( route ){
            var deferred = $q.defer();

            route.calculateDirectionsByManual = true;

            var responseRoute = {
                routes: [{
                    legs:[]
                }]
            };

            var responseList = [];
            responseList.push(responseRoute);

            for(var i = -1; i < route.Stops.length; i++){
                // var stop = route.Stops[i];
                var tmpLeg = {
                    duration:{ value: 120},
                    distance:{ value: 2000}
                };

                responseRoute.routes[ 0 ].legs.push(tmpLeg)
            }

            deferred.resolve(responseList);
            return deferred.promise;
        }
    }

    printService.$inject = [ "$q", "_", "ngDialog", "loading", "globalSetting", "$filter", "utilService", "mapService", "googleMapApi", "$document" ];
    function printService( $q, _, ngDialog, loading, globalSetting, $filter, utilService, mapService, googleMapApi, $document ) {
        var service = {
            printSummaryDialog: printSummaryDialog,
            printOption: printOption
        };
        return service;

        function printSummaryDialog( routes ) {
            ngDialog.open( {
                template: "MappedRouting/app/template/printsummarydialog.html?" + new Date().getTime().toString(),
                closeByEscape: false,
                closeByDocument: false,
                className: "ngdialog-theme-default print-summary-dialog-them",
                controller: [ "$scope", function ( $scope ) {
                    $scope.printData = {};
                    $scope.printData.Routes = routes;
                    $scope.printData.TotalStopCount = $filter( "calculateSumOfStop" )( routes );
                    $scope.printData.TotalWeight = $filter( "calculateSumOfFieldByStopsByRoutes" )( routes, "weight" );
                    $scope.printData.TotalTravelTime = $filter( "calculateSumOfTimeByStopsByRoutes" )( routes, "travelTime" );
                    $scope.printData.TotalServiceTime = $filter( "calculateSumOfTimeByStopsByRoutes" )( routes, "serviceTime" );
                    $scope.printData.TotalTime = $filter( "calculateSumOfTimeByStopsByRoutes" )( routes, "totalTime" );

                    $scope.printHandler = function () {
                        utilService.print( "printSummaryDiv" );
                    }
                } ]
            } );
        }

        function printOption() {
            var dialogObj = ngDialog.open( {
                template: "MappedRouting/app/template/printoptiondialog.html?" + new Date().getTime().toString(),
                closeByEscape: false,
                closeByDocument: false,
                controller: [ "$scope", function ( $scope ) {
                    $scope.listelements = [];
                    $scope.dialogObj = ngDialog;
                    $scope.printOptionList = [ {
                        isSelected: true,
                        selectName: "Customer List"
                    }, {
                        isSelected: false,
                        selectName: "Driving Directions"
                    }, {
                        isSelected: false,
                        selectName: "Map"
                    } ];
                    _.forEach( globalSetting.rootJson.Routes, function ( route ) {
                        var tmpObj = {
                            isSelected: false,
                            selectName: route.Route,
                            route: route
                        };
                        $scope.listelements.push( tmpObj );
                    } );

                    $scope.dialogClose = function () {
                        ngDialog.close( dialogObj.id );
                    };

                    $scope.dialogPrint = function () {
                        var selectedOption = _.find( $scope.printOptionList, function ( element ) {
                            return element.isSelected === true;
                        } );
                        var selectedRoute = _.find( $scope.listelements, function ( element ) {
                            return element.isSelected === true;
                        } );
                        if ( !_.isUndefined( selectedOption ) && !_.isUndefined( selectedRoute ) ) {
                            loading.show();
                            printDialog( $scope.printOptionList, $scope.listelements );
                            ngDialog.close( dialogObj.id );
                        }
                    }
                } ]
            } );
        }

        //=============================================== private ====================================================//

        function printDialog( printOptionList, listelements ) {
            ngDialog.open( {
                template: "MappedRouting/app/template/printdialog.html?" + new Date().getTime().toString(),
                className: "ngdialog-theme-default ngdialog-theme-print",
                closeByEscape: false,
                closeByDocument: false,
                controller: [ "$scope", function ( $scope ) {
                    $scope.printOptionList = printOptionList;
                    $scope.listelements = listelements;
                    var myDate = new Date();
                    $scope.nowTime = myDate.toLocaleString();
                    $scope.fieldLength = listelements[ 0 ].route.showFieldNameList.length + 3;
                    $scope.$on( 'ngDialog.opened', function ( event, $dialog ) {
                        var googleMap = new googleMapApi.maps.Map( $document[ 0 ].getElementById( "print-map" ), {
                            center: { lat: 40.1451, lng: -99.6680 },
                            zoom: 13,
                            mapTypeId: googleMapApi.maps.MapTypeId.ROADMAP
                        } );

                        var tmpList = [];
                        _.forEach( listelements, function ( el ) {
                            if ( el.isSelected ) {
                                tmpList.push( el.route );
                            }
                        } );

                        mapService.calculateRoutesByPrint( tmpList, googleMap ).then( function ( instructionObjList ) {
                            mapService.setMapCenter( globalSetting.rootJson.Routes, googleMap );
                            $scope.instructionObjList = instructionObjList;
                            loading.hide();
                        } );

                    } );

                    $scope.printHandler = function () {
                        if ( $scope.printOptionList[ 2 ].isSelected ) {
                            loading.show();
                            html2canvas( document.getElementById( "print-map" ), {
                                useCORS: true,
                                onrendered: function ( canvas ) {
                                    var tmpPng = canvas.toDataURL( "image/png" );
                                    var imageElment = document.getElementById( "google-map-image" );
                                    document.getElementById( "print-map" ).style.display = "none";
                                    imageElment.style.display = "inline";
                                    imageElment.src = tmpPng;
                                    imageElment.onload = function () {
                                        loading.hide();
                                        utilService.print( "printDiv" );
                                    };

                                    $scope.closeThisDialog();
                                }
                            } );
                        } else {
                            document.getElementById( "print-map" ).style.display = "none";
                            utilService.print( "printDiv" );
                            $scope.closeThisDialog();
                        }


                    }
                } ]
            } );
        }
    }

    sequenceService.$inject = [ "_", "mapService", "reSequenceType", "loading", "dataService", "repositoryService", "googleMapApi" ];
    function sequenceService( _, mapService, reSequenceType, loading, dataService, repositoryService, googleMapApi ) {
        var service = {
            reSequenceRoute: reSequenceRoute
        };
        return service;

        function reSequenceRoute( route, sequenceType ) {
            loading.show();

            if ( sequenceType == reSequenceType.shortest_distance && route.Stops.length > 1 && route.Stops.length <= 23 ) {
                reSeqByGoogle( route )
            } else {
                var sortCustomerIDStr = "";
                var customersIDAndConsumeTime = "";

                var stops = _.filter( route.Stops, function ( s ) {
                    return !_.isEmpty( s.Latitude ) && !_.isEmpty( s.Longitude );
                } );

                if ( sequenceType == reSequenceType.service_windows ) {
                    _.forEach( stops, function ( s ) {
                        var tmpStr = s.CustomerID + "^" + parseInt( ((Number)( s.Fsm + s.CustomerDuration * route.helperPercent )) ) + "|";
                        customersIDAndConsumeTime = customersIDAndConsumeTime + tmpStr;
                    } );
                } else {
                    _.forEach( stops, function ( s ) {
                        sortCustomerIDStr = sortCustomerIDStr + s.CustomerID + "^";
                    } );


                    if ( !_.isEmpty( sortCustomerIDStr ) ) {
                        sortCustomerIDStr = sortCustomerIDStr.substring( 0, sortCustomerIDStr.length - 1 );
                    }
                }

                if ( stops.length > 1 ) {
                    dataService.sequenceRouteFromService( sequenceType, sortCustomerIDStr, route.StartMapPointID, route.LoadSheetID, customersIDAndConsumeTime ).then( function ( result ) {
                        fromServerSuccessCallback( route, sequenceType, result );
                    }, fromServerFailCallback );
                }
                else {
                    loading.hide();
                }
            }

        }

        //=============================================== private ====================================================//

        function fromServerSuccessCallback( route, type, result ) {
            var data = result.data;

            switch ( type ) {
                case reSequenceType.service_windows:
                    serviceWindowSequence( data, route, type );
                    break;
                case reSequenceType.shortest_distance:
                    shortestDistanceSequence( data, route, type );
                    break;
                default:
                    closestOrFarthestSequence( data, route, type );
                    break;
            }
        }

        function fromServerFailCallback() {

        }

        function serviceWindowSequence( data, route, type ) {
            var customerIDStrArr = data.split( '|' );
            if ( customerIDStrArr.length > 1 ) {
                if ( data.indexOf( "^" ) > -1 ) {
                    var tmpCustomerIDStr = customerIDStrArr[ 1 ].substring( 0, customerIDStrArr[ 1 ].length - 1 );
                    var tmpArr = tmpCustomerIDStr.split( "~" );
                    var customerIDList = reBuildCustomerIDList( tmpArr );
                    requestLatLngFromGoogle( customerIDList, route, type );
                }
                else {
                    var tmpStartMapPointID = "L" + route.StartMapPointID;
                    if (route.StartMapPointID == "-1" ){
                        tmpStartMapPointID = route.Stops[0].CustomerID;
                    }

                    requestLatLngFromGoogle( [ tmpStartMapPointID, customerIDStrArr[ 0 ] ], route, type );
                }
            }
            else {
                reSetStopSort( route, data );
            }
        }

        function shortestDistanceSequence( data, route, type ) {
            var customerIDStrArr = data.split( '|' );
            if ( customerIDStrArr.length > 1 ) {
                customerIDStrArr.splice( customerIDStrArr.length - 1, 1 );

                var customerIDList = reBuildCustomerIDList( customerIDStrArr );
                requestLatLngFromGoogle( customerIDList, route, type );
            }
            else {
                reSetStopSort( route, data );
            }
        }

        function closestOrFarthestSequence( data, route, type ) {
            var customerIDStrArr = data.split( "|" );
            if ( customerIDStrArr.length > 1 ) {
                var customerIDList = [];
                var tmpIDArr = customerIDStrArr[ 0 ].split( "^" );

                _.forEach( tmpIDArr, function ( value ) {
                    customerIDList.push( customerIDStrArr[ 1 ] );
                    customerIDList.push( value );
                } );

                requestLatLngFromGoogle( customerIDList, route, type );
            }
            else {
                reSetStopSort( route, data );
            }
        }

        function requestLatLngFromGoogle( customerIDList, route, type ) {
            mapService.calculateRoutesByReSequence( customerIDList, route ).then( function ( responseList ) {
                fromGoogleSuccessCallback( responseList, customerIDList, route, type );
            }, function ( result ) {
                fromGoogleFailCallback(result.status);
            } );
        }

        function fromGoogleSuccessCallback( responseList, customerIDList, route, type ) {
            var allLegs = [];
            _.forEach( responseList, function ( responseRoute ) {
                _.forEach( responseRoute.routes[ 0 ].legs, function ( leg ) {
                    allLegs.push( leg );
                } );

            } );

            var saveDistanceParam = "";
            for ( var i = 0; i < customerIDList.length - 1; i++ ) {
                saveDistanceParam += customerIDList[ i ] + "^" + customerIDList[ i + 1 ]
                    + "^" + allLegs[ i ].distance.value + "^" + allLegs[ i ].duration.value + "|";

            }

            dataService.saveCustomerDistancesAndDuration( saveDistanceParam ).then( function ( r ) {
                reSequenceRoute( route, type );
            }, function () {

            } );
        }
        // Task 397344
        function fromGoogleFailCallback(status) {
            alert('Directions request failed due to ' + status + ', Please try again.');
            loading.hide();
        }

        function reSeqByGoogle( route ) {
            mapService.optimizeByGoogle( route ).then( function ( sortedStops ) {
                var tempStops = [];
                for ( var i = 0; i < sortedStops.length; i++ ) {
                    var stopIndex = sortedStops[ i ];
                    var tempStop = route.Stops[ stopIndex ];
                    tempStops.push( tempStop );
                }

                route.Stops = tempStops;
                mapService.reCalculateRoutes( [ route ] );
            } );
        }

        function reBuildCustomerIDList( customerIDList ) {
            var customerList = [];
            var removeIndex = 0;

            for ( var i = 0; i < customerIDList.length; i++ ) {
                var tmpArr = customerIDList[ i ].split( "^" );
                customerList.push( tmpArr[ 0 ] );
                customerList.push( tmpArr[ 1 ] );

                removeIndex += 2;

                //Remove duplicate elements
                if ( i + 1 < customerIDList.length ) {
                    var nextTmpArr = customerIDList[ i + 1 ].split( "^" );
                    if ( tmpArr[ 1 ] == nextTmpArr[ 0 ] ) {
                        customerList.splice( removeIndex - 1, 1 );
                        removeIndex--;
                    }
                }
            }

            return customerList;
        }

        function reSetStopSort( route, data ) {
            if ( !_.isEmpty( data ) ) {
                var sortedCustomerIDArr = data.split( '^' );

                for ( var i = 0; i < sortedCustomerIDArr.length; i++ ) {
                    var stop = repositoryService.getStopByCustomerID( sortedCustomerIDArr[ i ], route );
                    var index = _.indexOf( route.Stops, stop );
                    if ( index != -1 ) {
                        var temp = route.Stops[ index ];
                        route.Stops[ index ] = route.Stops[ i ];
                        route.Stops[ i ] = temp;
                    }
                }

                mapService.reCalculateRoutes( [ route ] );
            }
        }
    }

    mapHelperService.$inject = [ "$q", "googleMapApi", "utilService", "_", "googleMapObj", "moveStopDialog", "globalSetting", "$rootScope", "repositoryService" ];
    function mapHelperService( $q, googleMapApi, utilService, _, googleMapObj, moveStopDialog, globalSetting, $rootScope, repositoryService ) {
        var service = {
            fromLatLngToPoint: fromLatLngToPoint,
            codeAddress: codeAddress,
            createMarker: createMarker,
            createPolyline: createPolyline,
            createPolygon: createPolygon,
            showOrHidePolyline: showOrHidePolyline,
            showOrHideMarker: showOrHideMarker,
            setMarkerIcon: setMarkerIcon,
            setPolylineColor: setPolylineColor,
            setCenterByLatLngBounds: setCenterByLatLngBounds,
            setCenterByLatLng: setCenterByLatLng,
            setMarkerzIndex: setMarkerzIndex,
            removePolyline: removePolyline,
            removeMarker: removeMarker,
            drawManager: drawManager,
            getPolylinePath: getPolylinePath,
            setMarkerSizeAndZindex: setMarkerSizeAndZindex

        };
        return service;

        function fromLatLngToPoint( latLng ) {
            var scale = Math.pow( 2, googleMapObj.mapObj.getZoom() );
            var topRight = googleMapObj.mapObj.getProjection().fromLatLngToPoint( googleMapObj.mapObj.getBounds().getNorthEast() );
            var bottomLeft = googleMapObj.mapObj.getProjection().fromLatLngToPoint( googleMapObj.mapObj.getBounds().getSouthWest() );

            var worldPoint = googleMapObj.mapObj.getProjection().fromLatLngToPoint( latLng );
            return new googleMapApi.maps.Point( (worldPoint.x - bottomLeft.x) * scale, (worldPoint.y - topRight.y) * scale );
        }

        function codeAddress( address ) {
            var result = {};
            var deferred = $q.defer();
            var geocoder = new googleMapApi.maps.Geocoder();
            geocoder.geocode( { 'address': address }, function ( results, status ) {
                if ( status == google.maps.GeocoderStatus.OK ) {
                    result.latlng = {
                        lat: results[ 0 ].geometry.location.lat(),
                        lng: results[ 0 ].geometry.location.lng()
                    };
                    deferred.resolve( result );
                } else {
                    //ToDo add to dataBase
                    result.msg = 'Geocode was not successful for the following reason: ' + status;
                    deferred.reject( result )
                }
            } );
            return deferred.promise;
        }

        function createMarker( options ) {

            //IE MarkerShape has problem
            var markerObj = new googleMapApi.maps.Marker( {
                id: options.id,
                icon: utilService.createSvgIcon( options.color, options.text ),
                position: {
                    lat: parseFloat( options.latitude ),
                    lng: parseFloat( options.longitude )
                },
                draggable: false,
                visible: true,
                loadSheetID: options.loadSheetID,
                stopID: options.stopID,
                labelID: options.labelID,
                isSelectedOnMap: false,
                zIndex: 10,
                shape: {
                    coords: googleMapObj.normalSizeShapeCoords,
                    type: 'poly'
                }
            } );

            return markerObj;
        }

        function createPolyline( options ) {

            var polylineObj = new googleMapApi.maps.Polyline( {
                id: options.id,
                path: options.path,
                strokeColor: options.color,
                strokeWeight: 6,
                editable: false,
                draggable: false,
                geodesic: false,
                visible: true,
                strokeOpacity: 0.8,
                loadSheetID: options.loadSheetID
                //routeObj: options.routeObj
            } );

            return polylineObj;
        }

        function createPolygon() {

        }

        function showOrHidePolyline( polyline, isShow ) {
            polyline.setVisible( isShow ? true : false );
        }

        function showOrHideMarker( marker, isShow ) {
            marker.setVisible( isShow );
        }

        function setMarkerIcon( marker, color, text ) {
            var sizeTmpObj = marker.getIcon().size;
            var iconTmpObj = utilService.createSvgIcon( color, text );
            iconTmpObj.scaledSize = sizeTmpObj;
            iconTmpObj.size = sizeTmpObj;
            marker.setOptions( {
                icon: iconTmpObj
            } );
        }

        function setPolylineColor( polyline, color ) {
            polyline.setOptions( { strokeColor: color } );
        }

        function setCenterByLatLngBounds( latLngArr, mapObj ) {
            var tmpMapObj = mapObj || googleMapObj.mapObj;
            var latLngBounds = setLatLngBounds( latLngArr );
            if ( latLngBounds ) {
                tmpMapObj.fitBounds( latLngBounds );
                tmpMapObj.panTo( latLngBounds.getCenter() );
                //map.setZoom(11);
            }
        }

        function setCenterByLatLng( lat, lng ) {
            googleMapObj.mapObj.panTo( { lat: lat, lng: lng } );
        }

        function setMarkerzIndex( marker, zIndex ) {
            marker.setZIndex( zIndex );
        }

        function removePolyline( polyline ) {
            polyline.setMap( null );
        }

        function removeMarker( marker ) {
            marker.setMap( null );
        }

        function drawManager() {
            var drawingManager = new googleMapApi.maps.drawing.DrawingManager( {
                drawingMode: null,
                drawingControl: false
            } );

            googleMapApi.maps.event.addListener( drawingManager, 'polygoncomplete', function ( polygon ) {
                var hasMarkerChangeToSelect = false;
                if ( !googleMapObj.isCancelDrawPolygon ) {
                    _.forEach( googleMapObj.markerList, function ( marker ) {
                        if ( marker.getVisible() === true && googleMapApi.maps.geometry.poly.containsLocation( marker.getPosition(), polygon ) ) {
                            var stopID = marker.stopID;
                            var loadSheetID = marker.loadSheetID;
                            if ( !_.isUndefined( loadSheetID ) && !_.isNull( loadSheetID ) && !_.isUndefined( stopID ) && !_.isNull( stopID ) ) {
                                var loadSheet = repositoryService.getLoadSheetByKey( loadSheetID );
                                var stop = repositoryService.getStopByKey( stopID, loadSheet );

                                if ( stop.CanMove == "1" ) {
                                    marker.isSelectedOnMap = true;
                                    hasMarkerChangeToSelect = true;
                                    if ( marker.isSelectedOnMap ) {
                                        moveStopDialog.remove();
                                    }
                                    setMarkerIcon( marker, "#EAEE4F", "" );
                                }
                            }
                        }
                    } );
                }
                if ( hasMarkerChangeToSelect ) {
                    globalSetting.rootJson.isShowMoveToThisLoadSheet = true;
                    $rootScope.$digest();
                }
                googleMapObj.isCancelDrawPolygon = false;
                polygon.setMap( null );
            } );

            googleMapApi.maps.event.addListener( drawingManager, 'rectanglecomplete', function ( rectangle ) {
                var hasMarkerChangeToSelect = false;
                _.forEach( googleMapObj.markerList, function ( marker ) {
                    if ( marker.getVisible() === true && rectangle.getBounds().contains( marker.getPosition() ) ) {
                        var stopID = marker.stopID;
                        var loadSheetID = marker.loadSheetID;
                        if ( !_.isUndefined( loadSheetID ) && !_.isNull( loadSheetID ) && !_.isUndefined( stopID ) && !_.isNull( stopID ) ) {
                            var loadSheet = repositoryService.getLoadSheetByKey( loadSheetID );
                            var stop = repositoryService.getStopByKey( stopID, loadSheet );

                            if ( stop.CanMove == "1" ) {
                                marker.isSelectedOnMap = true;
                                hasMarkerChangeToSelect = true;
                                if ( marker.isSelectedOnMap ) {
                                    moveStopDialog.remove();
                                }
                                setMarkerIcon( marker, "#EAEE4F", "" );
                            }
                        }
                    }
                } );
                if ( hasMarkerChangeToSelect ) {
                    globalSetting.rootJson.isShowMoveToThisLoadSheet = true;
                    $rootScope.$digest();
                }
                rectangle.setMap( null );
            } );

            googleMapApi.maps.event.addListener( googleMapObj.mapObj, 'rightclick', function () {
                if ( drawingManager.getDrawingMode() && drawingManager.getDrawingMode().toString().toLowerCase() == "polygon" ) {
                    googleMapObj.isCancelDrawPolygon = true;
                    drawingManager.setDrawingMode( null );
                    drawingManager.setDrawingMode( googleMapApi.maps.drawing.OverlayType.POLYGON );
                }
            } );
            drawingManager.setMap( googleMapObj.mapObj );
            return drawingManager;
        }

        function getPolylinePath( legs ) {
            var result = [];
            for ( var i = 0; i < legs.length; i++ ) {
                var steps = legs[ i ].steps;
                for ( var j = 0; j < steps.length; j++ ) {
                    var nextSegment = steps[ j ].path;
                    for ( var k = 0; k < nextSegment.length; k++ ) {
                        result.push( nextSegment[ k ] );
                    }
                }
            }
            return result;
        }

        function setMarkerSizeAndZindex( marker, isNormal ) {
            var shapeObj = {
                type: 'poly'
            };
            shapeObj.coords = isNormal ? googleMapObj.normalSizeShapeCoords : googleMapObj.bigSizeShapeCoords;

            var tmpObj = marker.getIcon();
            tmpObj.scaledSize = isNormal ? new googleMapApi.maps.Size( 32, 43 ) : new googleMapApi.maps.Size( 48, 64.5 );
            tmpObj.size = isNormal ? new googleMapApi.maps.Size( 32, 43 ) : new googleMapApi.maps.Size( 48, 64.5 );
            shapeObj.coords = isNormal ? googleMapObj.normalSizeShapeCoords : googleMapObj.bigSizeShapeCoords;

            var markerIndex = isNormal ? 10 : 99;

            marker.setOptions( {
                icon: tmpObj,
                shape: shapeObj,
                zIndex: markerIndex
            } );
        }

        //=============================================== private ====================================================//

        function setLatLngBounds( latLngArr ) {
            var latLngBounds = new googleMapApi.maps.LatLngBounds();

            var tmpLatLngArr = convertToLatLngArr( latLngArr );

            _.each( tmpLatLngArr, function ( value ) {
                latLngBounds.extend( value );
            } );

            return latLngBounds;
        }

        function convertToLatLngArr( latLngArr ) {
            var tmpArr = [];
            for ( var i = 0, latLng;
                  ( latLng = latLngArr[ i ] ) != null; i++ ) {
                var lat = latLng[ 0 ];
                var lng = latLng[ 1 ];
                var LatLng = convertToLatLng( lat, lng );
                tmpArr.push( LatLng );
            }
            return tmpArr;
        }

        function convertToLatLng( lat, lng ) {
            return new googleMapApi.maps.LatLng( parseFloat( lat ), parseFloat( lng ) );
        }
    }

    mappedRoutingService.$inject = [ "utilService", "repositoryService", "oldJson", "dataService", "$q", "ngDialog", "loading", "globalSetting", "$filter" ];
    function mappedRoutingService( utilService, repositoryService, oldJson, dataService, $q, ngDialog, loading, globalSetting, $filter ) {
        var service = {
            buildSaveCustomerLocation: buildSaveCustomerLocation,
            computeDriveDuration: computeDriveDuration,
            reSetImageIndexByRoute: reSetImageIndexByRoute,
            saveChanges: saveChanges,
            bulidSaveDataStr: bulidSaveDataStr,
            initStopSeq: initStopSeq,
            moveStopsToOtherRouteBySelectedOnMap: moveStopsToOtherRouteBySelectedOnMap,
            reSetImageIndexByRoutes: reSetImageIndexByRoutes,
            moveInvoiceDialog: moveInvoiceDialog,
            chooseMapPointDialog: chooseMapPointDialog,
            checkDataChanged: checkDataChanged,
            autoRouteCompareLoadSheetList: autoRouteCompareLoadSheetList,
            clearStopAutoRouteInfo: clearStopAutoRouteInfo,
            closestMatchingServiceWindowByPlannedDeliveryTime: closestMatchingServiceWindowByPlannedDeliveryTime,
            checkIsShowOrHideAllRouteList: checkIsShowOrHideAllRouteList,
            dialogNoMapPointRoute:dialogNoMapPointRoute,
            createMapPointLatLng:createMapPointLatLng,
            checkDragDropStopToTop: checkDragDropStopToTop,
            checkLoadSheetAllStopCanMove: checkLoadSheetAllStopCanMove,
            alertIfStopCountMoreThen100: alertIfStopCountMoreThen100,
            beforeunloadHandler: beforeunloadHandler
        };

        return service;
        function buildSaveCustomerLocation( customerList ) {
            var customerList = customerList;
            _.forEach( customerList, function ( customer ) {
                var tmpStopStr = customer.CustomerID + "^" + customer.Latitude + "^" + customer.Longitude + "|";
                dataService.saveCustomerLocation( tmpStopStr, false );
            } );
        }

        function computeDriveDuration( route ) {
            var assignments = repositoryService.findRouteTypeActivityEventsByLoadSheetID( route.LoadSheetID );
            var staticAssignments = _.filter( assignments, function ( a ) {
                return a.IsDynamic == false;
            } );

            calculateTimeByRouteAndStaticAssignments(route, staticAssignments);

            calculateStartTimeAndEndTimeBaseOnDynamicAssignments(route, true, staticAssignments);

            calculateTimeByRouteAndStaticAssignments( route, staticAssignments );

            calculateStartTimeAndEndTimeBaseOnDynamicAssignments(route, false, staticAssignments);


            calculateTimeByRouteAndStaticAssignments( route, staticAssignments );

            route.totalTravelTime = $filter( "calculateSumOfTimeByStops" )( route, "travelTime" );
            route.totalServiceTime = $filter( "calculateSumOfTimeByStops" )( route, "serviceTime" );
            route.SumOfTime = $filter( "calculateSumOfTimeByStops" )( route, "totalTime" );
            route.sumOfWeight = $filter( "calculateSumOfFieldByStops" )( route, "weight" );
            route.sumOfDistance = $filter("calculateSumOfFieldByStops")(route, "distance", true);
            route.routeCost = $filter("calculateSumOfFieldByStops")(route, "routeCost");


            for ( var j = 0; j < route.Stops.length; j++ ) {
                var stop = route.Stops[ j ];
                var tmp = compareServiceWindow( stop.Services, stop.StartTime, stop.EndTime );
                stop.displayServiceWindow = tmp.serviceWindow;
                stop.serviceWindowColor = utilService.getRedOrBlackColorByServiceWindow( tmp.isRight );
                stop.startTimeColor = utilService.getRedOrBlackColorByServiceWindow( tmp.startTimeIsRight );
                stop.endTimeColor = utilService.getRedOrBlackColorByServiceWindow( tmp.endTimeIsRight );
            }
        }

        function reSetImageIndexByRoute( route ) {
            _.forEach( route.Stops, function ( s, index ) {
                s.imageIndex = index + 1;
            } );
        }

        function saveChanges( rootJson ) {
            var q = $q.defer();
            var tmpMessageFlag = false;
            if ( rootJson.isSaveLoadSheetOnly == "false" && !_.isUndefined( rootJson.RouteEditPermission ) && rootJson.RouteEditPermission.toLowerCase() != "true" ) {
                rootJson.isSaveLoadSheetOnly = "true";
                tmpMessageFlag = true;
            }

            var saveObj = bulidSaveDataStr( rootJson, rootJson.isAutoRoute, rootJson.isSaveLoadSheetOnly );

            if ( saveObj.isChanged ) {
                dataService.saveData( saveObj.postData ).then( function (result) {
                    if ( tmpMessageFlag ) {
                        alert( "Changes saved to load sheet \nChanges not saved to route for the following reasons: \n1. User does not have Route Edit permission" );
                    }

                    changeJsonAfterSuccessSave( rootJson );
                    q.resolve(result.data);
                }, function () {
                    q.reject();
                } );
            } else {
                q.reject();
            }

            return q.promise;
        }

        function bulidSaveDataStr( rootJson, isAutoRoute, isSaveLoadSheetOnly, autoRouteStr ) {
            var
                isChanged = false,
                SequenceLoadSheetIDStr = "",
                EventIDTimeStr = "",
                productPickTypesetting = "",
                DynamicAssignmentTimeStr = "",
                ReSeqPlanIDStr = "",
                EventIDPlanIDStr = "";

            var colorList = [];
            var employeeList = [];

            var reDrawRouteList = [];
            var LoadSheetIDInvoiceIDObjList = [];

            reSequenceForLoadSheets( rootJson );

            //save product pick type
            try {
                var newProductPickTypesettingStr = rootJson.showProductPickTypeSettingList.toString().replace( /,/g, ";" ) + ";";
                if ( newProductPickTypesettingStr != rootJson.ShowProductPickTypesetting ) {
                    productPickTypesetting = newProductPickTypesettingStr;
                }
            } catch ( e ) {
                productPickTypesetting = "Total;";
            }

            for ( var i = 0; i < rootJson.Routes.length; i++ ) {
                var isLoadsheetChange = false;
                var needReSeqPlan = true;
                var isMoveInvoice= false;

                var route = rootJson.Routes[ i ];
                var oldroute = oldJson.rootJson.Routes[ i ];

                if(oldroute.Stops && route.Stops &&  route.Stops.length !==  oldroute.Stops.length ){
                    isLoadsheetChange = true;
                    isMoveInvoice = true;
                }

                if ( route.Color != oldroute.Color ) {
                    var tmpRouteID = route.RouteID;
                    tmpRouteID += "^" + route.Color + "|";

                    if ( colorList.indexOf( tmpRouteID ) == -1 ) {
                        colorList.push( tmpRouteID );
                    }
                }

                if ( route.Employee != oldroute.Employee ) {
                    var tmpLoadSheetId = route.LoadSheetID;
                    tmpLoadSheetId = tmpLoadSheetId + "^" + route.Employee + "|";

                    if ( employeeList.indexOf( tmpLoadSheetId ) == -1 ) {
                        employeeList.push( tmpLoadSheetId );
                    }
                }

                if(route.Stops.length > 0){
                    var firstNewTime = getFirstNewTime(route.PlanDate,  route.Stops[ 0 ].StartTime);
                    var hasDiffDate = checkHasDiffDate(route);
                }
                for ( var j = 0; j < route.Stops.length; j++ ) {
                    var stop = route.Stops[ j ];

                    var l;
                    if ( stop.OldLoadSheetID != route.LoadSheetID ) {
                        isMoveInvoice = true;

                        for(l = 0; l < stop.Invoices.length; l++ ){
                            var tmpInvoiceID = stop.Invoices[ l ];
                            if (tmpInvoiceID != "") {
                                needReSeqPlan = false;
                                var findTmpObj = null;
                                _.forEach(LoadSheetIDInvoiceIDObjList, function ( LoadSheetIDInvoiceIDObj ) {
                                    if (LoadSheetIDInvoiceIDObj.SourceLoadSheetID == stop.OldLoadSheetID && LoadSheetIDInvoiceIDObj.DestLoadSheetID == route.LoadSheetID) {
                                        findTmpObj = LoadSheetIDInvoiceIDObj;
                                    }
                                });
                                if(utilService.isUndefinedOrNull(findTmpObj)){
                                    var tmpLoadSheetIDInvoiceIDObj = {
                                        SourceLoadSheetID: stop.OldLoadSheetID,
                                        DestLoadSheetID: route.LoadSheetID,
                                        InvoiceIDArr: [tmpInvoiceID]
                                    };
                                    LoadSheetIDInvoiceIDObjList.push(tmpLoadSheetIDInvoiceIDObj);
                                }else {
                                    findTmpObj.InvoiceIDArr.push(tmpInvoiceID);
                                }
                            }else{
                                EventIDPlanIDStr += stop.EventID + "^" + route.PlanID + "|";
                            }
                        }


                    }
                    if(hasDiffDate){
                        var tmpDate= new Date(firstNewTime + j*120000);
                        var Y = tmpDate.getFullYear();
                        var M = tmpDate.getMonth() + 1;
                        var D = tmpDate.getDate();
                        var h = tmpDate.getHours();
                        var m = tmpDate.getMinutes();
                        var s = tmpDate.getSeconds();
                        var newTimeStr = Y + "/" + M + "/" + D + " " + h +":" + m + ":" + s;

                        isLoadsheetChange = true;
                        EventIDTimeStr += stop.EventID + "^" + newTimeStr + "^" + route.Status + "|";
                    }else {
                        var startTimeChanged = false;
                        var tmpPlannedDeliveryTimeStr = "";
                        if(stop.StartTimePlanned == "" ){
                            if(stop.StartTimePlanned != stop.StartTime){
                                startTimeChanged = true;
                                tmpPlannedDeliveryTimeStr = route.PlanDate + " " + stop.StartTime
                            }
                        }else {
                            var tmpDate = new Date(stop.StartTimePlanned);
                            var Y = tmpDate.getFullYear();
                            var M = tmpDate.getMonth() + 1;
                            var D = tmpDate.getDate();
                            var newTimeStr = Y + "/" + M + "/" + D + " " + stop.StartTime;
                            if( new Date(stop.StartTimePlanned).getTime() != new Date(newTimeStr).getTime()){
                                startTimeChanged = true;
                                tmpPlannedDeliveryTimeStr = newTimeStr;
                            }

                        }

                        if ( startTimeChanged ) {
                            isLoadsheetChange = true;
                            EventIDTimeStr += stop.EventID + "^" + tmpPlannedDeliveryTimeStr + "^" + route.Status + "|";
                        }
                    }

                    for ( var p = 0; p < stop.routeActivityEventList.length; p++){
                        var tmpAssignment = stop.routeActivityEventList[p];
                        if ( !_.isNull (tmpAssignment.eventID) &&
                            !_.isUndefined(tmpAssignment.eventID) &&
                            !_.isNull(tmpAssignment.isDynamic) &&
                            !_.isUndefined(tmpAssignment.isDynamic) &&
                            tmpAssignment.isDynamic == true ){

                            DynamicAssignmentTimeStr += tmpAssignment.eventID + "^" + route.PlanDate + " " + tmpAssignment.startTimePlanned + "^" + route.Status + "|";
                        }
                    }
                }

                for ( var l = 0; l < route.endRouteTypeActivityEventList.length; l++){
                    var tmpAssignment = route.endRouteTypeActivityEventList[l];
                    if ( !_.isNull (tmpAssignment.eventID) &&
                        !_.isUndefined(tmpAssignment.eventID) &&
                        !_.isNull(tmpAssignment.isDynamic) &&
                        !_.isUndefined(tmpAssignment.isDynamic) &&
                        tmpAssignment.isDynamic == true ){

                        DynamicAssignmentTimeStr += tmpAssignment.eventID + "^" + route.PlanDate + " " + tmpAssignment.startTimePlanned + "^" + route.Status +  "|";
                    }
                }

                if(isLoadsheetChange  && needReSeqPlan){
                    ReSeqPlanIDStr += route.PlanID + "|";
                }

                if(isLoadsheetChange && !isMoveInvoice ){
                    SequenceLoadSheetIDStr += route.LoadSheetID + "|";
                }


            }

            var colorStr = "";

            _.forEach( colorList, function ( c ) {
                colorStr += c;
            } );

            var DeliverymanStr = "";
            _.forEach( employeeList, function ( e ) {
                DeliverymanStr += e;
            } );

            var request = utilService.requestObj( window.location );
            var postData = {
                Action: "0",
                LoadSheetIDInvoiceIDObjList: JSON.stringify(LoadSheetIDInvoiceIDObjList),
                EventIDPlanIDStr: EventIDPlanIDStr,
                SequenceLoadSheetIDStr: SequenceLoadSheetIDStr,
                ColorStr: colorStr,
                DeliverymanStr: DeliverymanStr,
                EventIDTimeStr: EventIDTimeStr,
                ProductPickTypesetting: productPickTypesetting,
                IsAutoRoute: isAutoRoute,
                LoadSheetList: isAutoRoute ? (autoRouteStr || request.LoadSheetID_List) : "",
                ReSeqPlanIDStr: ReSeqPlanIDStr,
                DynamicAssignmentTimeStr: DynamicAssignmentTimeStr

            };

            if ( isSaveLoadSheetOnly == "false" ) {
                postData.isLoadSheetOnly = "false";
            }

            isChanged = LoadSheetIDInvoiceIDObjList.length != 0 ||
                EventIDPlanIDStr != "" ||
                SequenceLoadSheetIDStr != "" ||
                colorStr != "" ||
                DeliverymanStr != "" ||
                EventIDTimeStr != "" ||
                productPickTypesetting != "" ||
                isAutoRoute;
            return {
                isChanged: isChanged,
                postData: postData,
                reDrawRouteList: reDrawRouteList
            };
        }

        function getFirstNewTime( planDate, startTime ) {
            var tmpDate = new Date(planDate);
            var Y = tmpDate.getFullYear();
            var M = tmpDate.getMonth() + 1;
            var D = tmpDate.getDate();
            var newTimeStr = Y + "/" + M + "/" + D + " " + startTime;
            return new Date(newTimeStr).getTime();
        }

        function checkHasDiffDate( route ) {
            var result = false;
            var stops = route.Stops;
            var tmpPlanDate = new Date( route.PlanDate ).toDateString();

            try {
                for ( var i = 0; i < stops.length; i++ ) {
                    if ( stops[ i ].StartTimePlanned != "" ) {
                        var tmpDate = new Date( stops[ i ].StartTimePlanned ).toDateString();
                        if ( tmpDate != tmpPlanDate ) {
                            result = true;
                            break;
                        }

                        if ( i > 0 ) {
                            var preStartTime = getFirstNewTime( route.PlanDate, stops[ i - 1 ].StartTime );
                            var currentStartTime = getFirstNewTime( route.PlanDate, stops[ i ].StartTime );

                            if ( currentStartTime < preStartTime ) {
                                result = true;
                                break;
                            }
                        }
                    }
                }
            }catch(e){
                result = true;
            }

            return result;
        }

        function initStopSeq( rootJson ) {
            for ( var i = 0; i < rootJson.Routes.length; i++ ) {
                var route = rootJson.Routes[ i ];
                for ( var j = 0; j < route.Stops.length; j++ ) {
                    route.Stops[ j ].DefaultSeq = (j + 1).toString();
                }
            }
        }

        function moveStopsToOtherRouteBySelectedOnMap( toRoute, toStop, selectedStops ) {
            var q = $q.defer();
            var reDrawRouteList = [];
            if ( selectedStops.length > 0 ) {
                reDrawRouteList.push( toRoute );
            }


            _.forEach( selectedStops, function ( s, index ) {
                clearStopAutoRouteInfo( s );

                var insertedIndex = -1;
                if ( !_.isNull( toStop ) && !_.isUndefined( toStop ) ) {
                    insertedIndex = _.findIndex( toRoute.Stops, function ( s1 ) {
                        return s1.StopID == toStop.StopID;
                    } );
                }

                var fromRoute = repositoryService.getRouteByStopID( s.StopID );
                var removedIndex = _.findIndex( fromRoute.Stops, function ( removeStop ) {
                    return removeStop.StopID == s.StopID;
                } );
                insertedIndex = insertedIndex + 1;
                changeStops( toRoute, fromRoute, insertedIndex, removedIndex, selectedStops[ index ] );

                if ( !_.includes( reDrawRouteList, fromRoute ) ) {
                    reDrawRouteList.push( fromRoute );
                }
            } );

            q.resolve( reDrawRouteList );
            return q.promise;
        }

        function reSetImageIndexByRoutes( routes ) {
            _.forEach( routes, function ( r ) {
                _.forEach( r.Stops, function ( s, index ) {
                    s.imageIndex = index + 1;
                } );
            } );
        }

        function moveInvoiceDialog( loadSheet, result, stop ) {
            var q = $q.defer();

            ngDialog.open( {
                template: 'MappedRouting/app/template/moveinvoicedialog.html?' + new Date().getTime().toString(),
                closeByEscape: false,
                closeByDocument: false,
                controller: [ '$scope', function ( $scope ) {
                    $scope.selectedOption = loadSheet;
                    $scope.loadSheetList = result.data.LoadSheetJson;
                    $scope.$on( 'ngDialog.opened', function ( event, $dialog ) {
                        loading.hide();
                    } );
                    $scope.moveInvoiceSave = function ( loadSheetID ) {
                        loading.show();
                        // var newIdArr = "";
                        // _.forEach( stop.Invoices, function ( invoice ) {
                        //     newIdArr += invoice.InvoiceID + "^" + loadSheetID + "|";
                        // } );

                        var LoadSheetIDInvoiceIDObjList = [];
                        var tmpLoadSheetIDInvoiceIDObj = {
                            SourceLoadSheetID: stop.OldLoadSheetID,
                            DestLoadSheetID: loadSheetID,
                            InvoiceIDArr: []
                        };
                        _.forEach( stop.Invoices, function ( invoice ) {
                            tmpLoadSheetIDInvoiceIDObj.InvoiceIDArr.push(invoice);
                        } );
                        LoadSheetIDInvoiceIDObjList.push(tmpLoadSheetIDInvoiceIDObj);

                        dataService.moveInvoiceAndSave( JSON.stringify(LoadSheetIDInvoiceIDObjList) ).then( function ( r ) {
                            q.resolve( r );
                        }, function ( r ) {
                            console.log( r )
                        } );
                    };
                } ]
            } );

            return q.promise;
        }

        function chooseMapPointDialog( mapPointID ) {
            var q = $q.defer();

            ngDialog.open( {
                template: "MappedRouting/app/template/choosemappointdialog.html?" + new Date().getTime().toString(),
                closeByEscape: false,
                closeByDocument: false,
                //className: "",
                controller: [ "$scope", function ( $scope ) {
                    $scope.mapPointObj = {};
                    $scope.mapPointObj.mapPoints = globalSetting.mapPointJson.MapPointsJson;
                    $scope.mapPointObj.selectedMapPointID = mapPointID;

                    $scope.saveMapPointHandler = function () {
                        q.resolve( $scope.mapPointObj.selectedMapPointID );
                        $scope.closeThisDialog();
                    };
                } ]
            } );

            return q.promise;
        }
        function beforeunloadHandler(event){
            var dialoginfo =checkDataChanged(false);
            if( dialoginfo == ""){
            }else {
                event.returnValue = dialoginfo;
            };
        }
        function checkDataChanged(flag) {
            var rootJson = globalSetting.rootJson;
            var saveObj = bulidSaveDataStr( rootJson, rootJson.isAutoRoute, rootJson.isSaveLoadSheetOnly );
            if(flag){
                return saveObj.isChanged;
            }else {
                if ( saveObj.isChanged ) {
                    return "This page has unsaved changes. Are you sure you want to reload?";
                } else {
                    return "";
                }
            }

        }

        function autoRouteCompareLoadSheetList( oldLoadSheetList, newLoadSheetList ) {
            _.forEach( oldLoadSheetList, function ( oldLoadSheet ) {
                _.forEach( oldLoadSheet.Stops, function ( oldStop ) {
                    var tmpLoadSheet = repositoryService.getLoadSheetFromLoadSheetListByStopFlag( oldStop.StopFlag, newLoadSheetList );
                    if ( !_.isNull( tmpLoadSheet ) && !_.isUndefined( tmpLoadSheet ) ) {
                        if ( tmpLoadSheet.LoadSheetID != oldLoadSheet.LoadSheetID && tmpLoadSheet.LSDate == oldLoadSheet.LSDate ) {
                            var tmpStop = repositoryService.getStopByCustomerID( oldStop.CustomerID, tmpLoadSheet );
                            if ( !_.isNull( tmpStop ) && !_.isUndefined( tmpStop ) ) {
                                tmpStop.autoRouteStr = "AutoRouted From " + oldLoadSheet.Route;
                                tmpStop.autoRouteColor = "1px solid #" + oldLoadSheet.Color;
                            }
                        }
                    }
                } );
            } );
        }

        function clearStopAutoRouteInfo( stop ) {
            if ( !_.isNull( stop ) && !_.isUndefined( stop ) ) {
                stop.autoRouteStr = "";
                stop.autoRouteColor = "";
            }
        }

        function closestMatchingServiceWindowByPlannedDeliveryTime( stop ) {
            var plannedDeliveryTime = utilService.convertTimeStrToNumber( stop.StartTime );
            var plannedDeliveryEndTime = utilService.convertTimeStrToNumber( stop.EndTime );

            var closestMatchedServiceWindowID = "";
            var tmpServiceWindowObject = compareServiceWindow( stop.Services, stop.StartTime, stop.EndTime );

            if ( tmpServiceWindowObject.isRight ) {
                closestMatchedServiceWindowID = tmpServiceWindowObject.serviceWindowID;
            } else {
                try {
                    var tmpList = _.filter( stop.Services, function ( s ) {
                        var tmpStartTime = utilService.convertTimeStrToNumber( s.StartTime );
                        var tmpEndTime = utilService.convertTimeStrToNumber( s.EndTime );
                        return (tmpEndTime >= plannedDeliveryTime && tmpEndTime <= plannedDeliveryEndTime) || ( tmpStartTime >= plannedDeliveryTime && tmpStartTime <= plannedDeliveryEndTime );
                    } );

                    // jiaocha
                    if ( tmpList.length > 0 ) {
                        closestMatchedServiceWindowID = computeCrossDuration( tmpList, plannedDeliveryTime, plannedDeliveryEndTime );
                    } else { // xiangli
                        closestMatchedServiceWindowID = computeSeparatedDuration( stop.Services, plannedDeliveryTime, plannedDeliveryEndTime );
                    }
                } catch ( e ) {
                    closestMatchedServiceWindowID = "";
                    console.log( "closestMatchingServiceWindowByPlannedDeliveryTime error" );
                    console.log( e );
                }
            }

            return closestMatchedServiceWindowID;
        }

        function checkIsShowOrHideAllRouteList() {
            var isShow = true;
            var isShowAllRouteList = isShowOrHideAllRouteList( isShow );
            var isHideAllRouteList = isShowOrHideAllRouteList( !isShow );

            if ( isShowAllRouteList == true ) {
                globalSetting.rootJson.isShowAllRouteList = isShowAllRouteList;
            }
            if ( isHideAllRouteList == true ) {
                globalSetting.rootJson.isShowAllRouteList = !isHideAllRouteList;
            }
        }

        function dialogNoMapPointRoute( routeList ) {
            ngDialog.open( {
                template: "MappedRouting/app/template/noMapPointRouteLink.html?" + new Date().getTime().toString(),
                closeByEscape: false,
                closeByDocument: false,
                showClose: false,
                controller: [ "$scope", function ( $scope ) {
                    $scope.routeList = [];

                    _.forEach( routeList, function ( route ) {
                        var tmpObj = {
                            routeID: route.routeID,
                            route: route.route
                        };
                        $scope.routeList.push( tmpObj );
                    } );
                } ]
            } );
        }

        function createMapPointLatLng( route, mapPointProperty ) {
            var pointLatLng = {};

            if ( route[ mapPointProperty ] == -1 ) {
                if ( route.Stops.length > 0) {

                    pointLatLng = mapPointProperty == "StartMapPointID" ? {
                        Latitude: route.Stops[ 0 ].Latitude,
                        Longitude: route.Stops[ 0 ].Longitude
                    } : {
                            Latitude: route.Stops[ route.Stops.length - 1 ].Latitude,
                            Longitude: route.Stops[ route.Stops.length - 1 ].Longitude
                        }
                }
            } else {
                pointLatLng = repositoryService.getLatLngByMapPointID( route[ mapPointProperty ] );
            }

            return pointLatLng;
        }

        function checkDragDropStopToTop( route, toIndex ){
            for( var i = toIndex; i > -1; i--){
                var stop = route.Stops[ i ];
                if (utilService.isUndefinedOrNull(stop)){
                    return false;
                } else if ( stop.CanMove == '1' ){
                    return false;
                }
            }

            return true;
        }

        function checkLoadSheetAllStopCanMove( route ) {
            for (var i = 0; i < route.Stops.length; i++ ){
                var stop = route.Stops[ i ];
                if (stop.CanMove == '0'){
                    return false;
                }
            }

            return true;
        }

        function alertIfStopCountMoreThen100(){
            var stopCountMoreThen100Route = repositoryService.findStopCountMoreThan100Route();

            if (stopCountMoreThen100Route.length == 1){
                alert('Route' + stopCountMoreThen100Route[0] + ' has over 100 stops and cannot be efficiently routed. Only Customer pins will be displayed for this route.')
            }else if (stopCountMoreThen100Route.length > 1){
                alert('Route' + stopCountMoreThen100Route.join(",") + 'have over 100 stops and cannot be efficiently routed. Only Customer pins will be displayed for these routes.')
            }

        }
        //=============================================== private ====================================================//

        function reSequenceForLoadSheets( rootJson ) {
            var routes = rootJson.Routes;
            for ( var i = 0; i < routes.length; i++ ) {
                reSequenceForStops( routes[ i ] );
            }
        }

        function reSequenceForStops( loadSheet ) {
            for ( var i = 0; i < loadSheet.Stops.length; i++ ) {
                loadSheet.Stops[ i ].Seq = (i + 1).toString();
            }
        }

        function changeStops( toRoute, fromRoute, insertedIndex, removedIndex, fromStop ) {
            //var tmpInsertedIndex = insertedIndex + 1;
            var isSameLoadSheet = fromRoute.LoadSheetID == toRoute.LoadSheetID;
            fromRoute.Stops.splice( removedIndex, 1 );
            if ( isSameLoadSheet ) {
                if ( insertedIndex > removedIndex ) {
                    insertedIndex = insertedIndex - 1 < 0 ? 0 : insertedIndex - 1;
                }
            }
            toRoute.Stops.splice( insertedIndex, 0, fromStop );

            if ( isSameLoadSheet ) {
                reSequenceForStops( fromRoute );
                reSetImageIndexByRoute( fromRoute );
            }

            reSequenceForStops( toRoute );
            reSetImageIndexByRoute( toRoute );
        }

        function compareServiceWindow( services, startTime, endTime ) {
            var resultFlag = services.length <= 0;
            var startTimeIsRight = true;
            var endTimeIsRight = true;
            var sTime = utilService.convertTimeStrToNumber( startTime );
            var eTime = utilService.convertTimeStrToNumber( endTime );

            var serviceWindowID = "";
            var serviceWindow = "";
            for ( var k = 0; k < services.length; k++ ) {
                startTimeIsRight = true;
                endTimeIsRight = true;

                serviceWindowID = services[ k ].ServiceWindowID;
                serviceWindow = services[ k ].StartTime + "-" + services[ k ].EndTime;

                var serviceWin = services[ k ];
                var tmpStartTime = utilService.convertTimeStrToNumber( serviceWin.StartTime );
                var tmpEndTime = utilService.convertTimeStrToNumber( serviceWin.EndTime );
                if ( sTime >= tmpStartTime && eTime <= tmpEndTime ) {
                    resultFlag = true;
                    break;
                } else {
                    if ( sTime < tmpStartTime || sTime > tmpEndTime ) {
                        startTimeIsRight = false;
                    }

                    if ( eTime < tmpStartTime || eTime > tmpEndTime ) {
                        endTimeIsRight = false;
                    }
                }
            }

            return {
                serviceWindowID: serviceWindowID,
                serviceWindow: serviceWindow,
                isRight: resultFlag,
                startTimeIsRight: startTimeIsRight,
                endTimeIsRight: endTimeIsRight
            };
        }

        function changeJsonAfterSuccessSave( rootJson ) {
            try {
                rootJson.ShowProductPickTypesetting = rootJson.showProductPickTypeSettingList.toString().replace( /,/g, ";" ) + ";";
            } catch ( e ) {
                rootJson.ShowProductPickTypesetting = "Total;";
            }
            console.log( rootJson.ShowProductPickTypesetting );
            _.forEach( rootJson.Routes, function ( route ) {
                var serviceTimeSecond = utilService.convertTimeStrToNumber( route.totalServiceTime );
                if ( serviceTimeSecond != route.OldServiceTime ) {
                    route.OldServiceTime = serviceTimeSecond;
                }

                if ( route.OldDistance != route.sumOfDistance ) {
                    route.OldDistance = route.sumOfDistance;
                }

                _.forEach( route.Stops, function ( stop ) {
                    if ( stop.OldLoadSheetID != route.LoadSheetID ) {
                        stop.OldLoadSheetID = route.LoadSheetID;
                    }

                    if ( stop.DefaultSeq != stop.Seq ) {
                        stop.DefaultSeq = stop.Seq;
                    }

                    if ( stop.OldStartTime != stop.StartTime ) {
                        stop.OldStartTime = stop.StartTime;
                    }

                    var closestMatchingServiceWindowID = closestMatchingServiceWindowByPlannedDeliveryTime( stop );
                    if ( stop.OldClosestMatchingServiceWindowID != closestMatchingServiceWindowID ) {
                        stop.OldClosestMatchingServiceWindowID = closestMatchingServiceWindowID;
                    }
                } )
            } );
        }

        function computeCrossDuration( crossServiceWindowList, plannedDeliveryTime, plannedDeliveryEndTime ) {
            var durationList = [];

            for ( var i = 0; i < crossServiceWindowList.length; i++ ) {
                var tmpServiceWindow = crossServiceWindowList[ i ];
                var tmpStartTime = utilService.convertTimeStrToNumber( tmpServiceWindow.StartTime );
                var tmpEndTime = utilService.convertTimeStrToNumber( tmpServiceWindow.EndTime );
                var tmpObj = {};
                tmpObj.serviceWindowID = tmpServiceWindow.ServiceWindowID;

                if ( plannedDeliveryTime >= tmpStartTime ) {
                    tmpObj.duration = tmpEndTime - plannedDeliveryTime;
                } else if ( plannedDeliveryEndTime <= tmpEndTime ) {
                    tmpObj.duration = plannedDeliveryEndTime - tmpStartTime;
                } else {
                    tmpObj.duration = tmpEndTime - tmpStartTime;
                }

                durationList.push( tmpObj );
            }

            return _.max( durationList, function ( d ) {
                return d.duration;
            } ).serviceWindowID;
        }

        function computeSeparatedDuration( services, plannedDeliveryTime, plannedDeliveryEndTime ) {
            var durationList = [];

            for ( var j = 0; j < services.length; j++ ) {
                var tmpServiceWindow = services[ j ];
                var tmpStartTime = utilService.convertTimeStrToNumber( tmpServiceWindow.StartTime );
                var tmpEndTime = utilService.convertTimeStrToNumber( tmpServiceWindow.EndTime );
                var tmpObj = {};
                tmpObj.serviceWindowID = tmpServiceWindow.ServiceWindowID;

                if ( plannedDeliveryTime >= tmpEndTime ) {
                    tmpObj.duration = plannedDeliveryTime - tmpEndTime;
                } else {
                    tmpObj.duration = tmpStartTime - plannedDeliveryEndTime;
                }

                durationList.push( tmpObj );
            }

            return _.min( durationList, function ( d ) {
                return d.duration;
            } ).serviceWindowID;
        }

        function calculateTimeByRouteAndStaticAssignments( route, staticAssignments ) {
            var hpercent = 1;
            var lastStop = null;

            var staticAssignmentsSortByStartTimeDesc = sortByRouteTypeActivityEvents(staticAssignments);

            if ( route.Helper ) {
                hpercent = Number( route.helperPercent );
            }

            for ( var i = 0; i < route.Stops.length; i++ ) {
                var stopObj = route.Stops[ i ];
                stopObj.isShowBreakTime = false;
                var currStop;
                if ( lastStop == null ) {
                    lastStop = stopObj;
                    var tmpStartTimeNumber = utilService.convertTimeStrToNumber( route.StartTime ) + Number( lastStop.Duration );
                    var serviceTimeNumber = lastStop.Fsm + lastStop.CustomerDuration * hpercent;
                    var tmpEndTimeNumber = tmpStartTimeNumber + serviceTimeNumber;

                    var obj = calculateStartTimeAndEndTimeBaseOnStaticAssignments( lastStop, staticAssignmentsSortByStartTimeDesc, tmpStartTimeNumber, tmpEndTimeNumber, true );
                    lastStop.StartTime = utilService.convertTimeNumberToAMPMStr( obj.stopStartTimeNumber );
                    lastStop.EndTime = utilService.convertTimeNumberToAMPMStr( obj.stopEndTimeNumber );

                } else {
                    currStop = stopObj;

                    var tmpStartTimeNumber = utilService.convertTimeStrToNumber(lastStop.EndTime) + Number( currStop.Duration );
                    var serviceTimeNumber = currStop.Fsm + currStop.CustomerDuration * hpercent;
                    var tmpEndTimeNumber = tmpStartTimeNumber + serviceTimeNumber;

                    var obj = calculateStartTimeAndEndTimeBaseOnStaticAssignments( currStop, staticAssignmentsSortByStartTimeDesc, tmpStartTimeNumber, tmpEndTimeNumber, false );
                    currStop.StartTime = utilService.convertTimeNumberToAMPMStr( obj.stopStartTimeNumber );
                    currStop.EndTime = utilService.convertTimeNumberToAMPMStr( obj.stopEndTimeNumber );

                    lastStop = currStop;
                }
            }

            route.endRouteTypeActivityEventList = getEndRouteActivityEventTimeList(staticAssignmentsSortByStartTimeDesc);

            var endtimeSec = 0;

            if ( lastStop != null ) {
                var realLastEndTimeNumber = utilService.convertTimeStrToNumber( lastStop.EndTime );
                endtimeSec = Number((realLastEndTimeNumber + Number( route.Duration )).toString());

                if ( route.endRouteTypeActivityEventList.length > 0 ) {


                    var filterEndRouteTypeActivityEventList = _.chain( route.endRouteTypeActivityEventList )
                        .filter(function( ea ){
                            return ea.isBaseOnEndTime == false || typeof ea.isBaseOnEndTime == "undefined";
                        })
                        .value();

                    if ( filterEndRouteTypeActivityEventList.length > 0 ) {
                        endtimeSec = getRouteEndTimeBaseOnStaticAssignments(filterEndRouteTypeActivityEventList, endtimeSec, Number(route.Duration));
                    }
                }


            }

            route.EndTime = utilService.convertTimeNumberToAMPMStr( endtimeSec );
        }

        function calculateStartTimeAndEndTimeBaseOnStaticAssignments( stop, staticAssignmentsSortByStartTimeDesc, tmpStartTimeNumber, tmpEndTimeNumber, isFirstPoint ) {
            var stopStartTimeNumber = tmpStartTimeNumber;
            var stopEndTimeNumber = tmpEndTimeNumber;
            var stopDurationNumber = tmpEndTimeNumber - tmpStartTimeNumber;

            stop.routeActivityEventList = [];

            var isCalculated  = false;
            for (var i = staticAssignmentsSortByStartTimeDesc.length - 1; i > -1; i--) {
                var tmpEvent = staticAssignmentsSortByStartTimeDesc[i];
                var tmpEventStartTimePlannedNumber = utilService.convertTimeStrToNumberByDateTime(tmpEvent.StartTimePlanned);
                var tmpEventEndTimePlannedNumber = utilService.convertTimeStrToNumberByDateTime(tmpEvent.EndTimePlanned);


                if (isFirstPoint && tmpEventEndTimePlannedNumber <= (tmpStartTimeNumber - stop.Duration)) {
                    var tmpObject = {
                        objective: tmpEvent.Objective,
                        startTimePlanned: utilService.convertTimeNumberToAMPMStr(tmpEventStartTimePlannedNumber),
                        endTimePlanned: utilService.convertTimeNumberToAMPMStr(tmpEventEndTimePlannedNumber),
                        startTimePlannedNumber: tmpEventStartTimePlannedNumber,
                        endTimePlannedNumber:tmpEventEndTimePlannedNumber,
                        isDynamic: tmpEvent.IsDynamic,
                        eventID: tmpEvent.EventID
                    };

                    stop.routeActivityEventList.push(tmpObject);

                    staticAssignmentsSortByStartTimeDesc.splice(i, 1);

                    continue;
                }

                if (tmpEventStartTimePlannedNumber < stopStartTimeNumber){
                    var tmpObject = {
                        objective: tmpEvent.Objective,
                        startTimePlanned: utilService.convertTimeNumberToAMPMStr( tmpEventStartTimePlannedNumber ),
                        endTimePlanned: utilService.convertTimeNumberToAMPMStr( tmpEventEndTimePlannedNumber ),
                        startTimePlannedNumber: tmpEventStartTimePlannedNumber,
                        endTimePlannedNumber:tmpEventEndTimePlannedNumber,
                        isDynamic: tmpEvent.IsDynamic,
                        eventID: tmpEvent.EventID
                    };

                    stop.routeActivityEventList.push( tmpObject );

                    staticAssignmentsSortByStartTimeDesc.splice( i, 1 );

                    // 2:00 - 7:00, 5:00 - 6:00

                    // stop time: 2:30 - 4:00
                    // 1.assignment time:
                    //    1). 2:20 - 3:25
                    //    2). 2:50 - 2:55
                    // 2.assignment time:
                    //    1). 2:40 - 3:00
                    //    2). 2:50 - 2:55
                    stopStartTimeNumber = Math.max(stopStartTimeNumber, tmpEventEndTimePlannedNumber + (!isCalculated ? stop.Duration : 0));

                    stopEndTimeNumber = stopStartTimeNumber + stopDurationNumber;

                    if (!isCalculated) {
                        isCalculated = true;
                    }

                }else if (tmpEventStartTimePlannedNumber >= stopStartTimeNumber && tmpEventStartTimePlannedNumber < stopEndTimeNumber){
                    var tmpObject = {
                        objective: tmpEvent.Objective,
                        startTimePlanned: utilService.convertTimeNumberToAMPMStr( tmpEventStartTimePlannedNumber ),
                        endTimePlanned: utilService.convertTimeNumberToAMPMStr( tmpEventEndTimePlannedNumber ),
                        startTimePlannedNumber: tmpEventStartTimePlannedNumber,
                        endTimePlannedNumber:tmpEventEndTimePlannedNumber,
                        isDynamic: tmpEvent.IsDynamic,
                        eventID: tmpEvent.EventID
                    };

                    stop.routeActivityEventList.push( tmpObject );

                    staticAssignmentsSortByStartTimeDesc.splice( i, 1 );

                    stopStartTimeNumber = tmpEventEndTimePlannedNumber;

                    stopEndTimeNumber = stopStartTimeNumber + stopDurationNumber;

                    if (!isCalculated){
                        isCalculated = true;
                    }
                }

            }
            return {
                stopStartTimeNumber: stopStartTimeNumber,
                stopEndTimeNumber: stopEndTimeNumber
            }

        }

        function calculateStartTimeAndEndTimeBaseOnDynamicAssignments( route, byStartTime, staticAssignments) {
            var assignments = repositoryService.findRouteTypeActivityEventsByLoadSheetID( route.LoadSheetID );

            var dynamicAssignments = _.chain( assignments ).filter(function ( a ) {
                return a.IsDynamic == true;
            }).sortBy(function(a){
                return a.Timing;
            }).value();

            var routeStartTimeNumber = utilService.convertTimeStrToNumber( route.StartTime );

            var preDynamicAssignmentEndTimeNumber = 0;

            for ( var i = 0; i < dynamicAssignments.length; i++ ) {
                var dynamicAssignment = dynamicAssignments[ i ];

                if ( byStartTime === true && dynamicAssignment.DynamicStartTime == 2 ) {
                    continue;
                }

                if ( byStartTime === false && dynamicAssignment.DynamicStartTime == 1 ) {
                    continue;
                }

                var timingSecondNumber = dynamicAssignment.Timing;
                if ( byStartTime ) {
                    var dynamicAssignmentStartTimeNumber = routeStartTimeNumber + timingSecondNumber;
                } else {
                    var dynamicAssignmentStartTimeNumber = utilService.convertTimeStrToNumber( route.EndTime ) + timingSecondNumber;
                }

                dynamicAssignment.startTimePlannedNumber = dynamicAssignmentStartTimeNumber;
                dynamicAssignment.endTimePlannedNumber = dynamicAssignment.startTimePlannedNumber + dynamicAssignment.DurationSeconds;

                if (dynamicAssignment.startTimePlannedNumber < preDynamicAssignmentEndTimeNumber) {
                    dynamicAssignment.endTimePlannedNumber += preDynamicAssignmentEndTimeNumber - dynamicAssignment.startTimePlannedNumber;
                    dynamicAssignment.startTimePlannedNumber = preDynamicAssignmentEndTimeNumber;

                }

                compareDynamicAssignmentAndStaticAssignment(dynamicAssignment, staticAssignments);

                dynamicAssignment.StartTimePlanned = route.PlanDate + " " + utilService.convertTimeNumberToAMPMStr(dynamicAssignment.startTimePlannedNumber);
                dynamicAssignment.EndTimePlanned = route.PlanDate + " " + utilService.convertTimeNumberToAMPMStr(dynamicAssignment.endTimePlannedNumber);

                if (byStartTime === false){
                    dynamicAssignment.isBaseOnEndTime = true;
                }

                staticAssignments.push(dynamicAssignment);

                preDynamicAssignmentEndTimeNumber = dynamicAssignment.endTimePlannedNumber;

            }

        }

        function compareDynamicAssignmentAndStaticAssignment( dynamicAssignment, staticAssignmentList){
            staticAssignmentList = _.sortBy( staticAssignmentList, function ( sa ) {
                return utilService.convertTimeStrToNumberByDateTime( sa.StartTimePlanned );
            } );

            for(var i = 0; i < staticAssignmentList.length; i++){
                var staticAssignment = staticAssignmentList[i];

                var staticAssignmentStartTimeNumber = staticAssignment.startTimePlannedNumber,
                    staticAssignmentEndTimeNumber = staticAssignment.endTimePlannedNumber;

                if ( (dynamicAssignment.endTimePlannedNumber > staticAssignmentStartTimeNumber  && dynamicAssignment.endTimePlannedNumber <= staticAssignmentEndTimeNumber) || (dynamicAssignment.startTimePlannedNumber >= staticAssignmentStartTimeNumber && dynamicAssignment.startTimePlannedNumber < staticAssignmentEndTimeNumber) ){

                    dynamicAssignment.startTimePlannedNumber = staticAssignmentEndTimeNumber;
                    dynamicAssignment.endTimePlannedNumber = dynamicAssignment.startTimePlannedNumber + dynamicAssignment.DurationSeconds;
                }
            }
        }

        function getEndRouteActivityEventTimeList( routeTypeActivityEvents ){
            var tmpRouteTypeActivityEvents = _.sortBy(routeTypeActivityEvents, function( r ){
                return utilService.convertTimeStrToNumberByDateTime( r.StartTimePlanned );
            });

            var tmpList = [];

            _.forEach(tmpRouteTypeActivityEvents, function( r ){
                    var tmpEventStartTimePlannedNumber = utilService.convertTimeStrToNumberByDateTime( r.StartTimePlanned );
                    var tmpEventEndTimePlannedNumber = utilService.convertTimeStrToNumberByDateTime( r.EndTimePlanned );

                    var tmpObject = {
                        objective: r.Objective,
                        startTimePlanned: utilService.convertTimeNumberToAMPMStr( tmpEventStartTimePlannedNumber ),
                        endTimePlanned: utilService.convertTimeNumberToAMPMStr( tmpEventEndTimePlannedNumber ),
                        startTimePlannedNumber: tmpEventStartTimePlannedNumber,
                        endTimePlannedNumber: tmpEventEndTimePlannedNumber,
                        eventID: r.EventID,
                        isDynamic: r.IsDynamic,
                        isBaseOnEndTime: r.isBaseOnEndTime
                    };

                    tmpList.push( tmpObject );
            });

            return tmpList;
        }

        function getRouteEndTimeBaseOnStaticAssignments( staticAssignmentsSortByStartTimeDesc, routeEndTimeNumber, driverDuration) {
            var isCalculated  = false;

            for (var i = staticAssignmentsSortByStartTimeDesc.length - 1; i > -1; i--) {
                var tmpEvent = staticAssignmentsSortByStartTimeDesc[i];
                var tmpEventStartTimePlannedNumber = tmpEvent.startTimePlannedNumber;
                var tmpEventEndTimePlannedNumber = tmpEvent.endTimePlannedNumber;

                if (tmpEventStartTimePlannedNumber < routeEndTimeNumber){

                    // 2:00 - 7:00, 5:00 - 6:00

                    // stop time: 2:30 - 4:00
                    // 1.assignment time:
                    //    1). 2:20 - 3:25
                    //    2). 2:50 - 2:55
                    // 2.assignment time:
                    //    1). 2:40 - 3:00
                    //    2). 2:50 - 2:55
                    routeEndTimeNumber = Math.max(routeEndTimeNumber, tmpEventEndTimePlannedNumber + (!isCalculated ? driverDuration : 0));

                    if (!isCalculated) {
                        isCalculated = true;
                    }

                }

            }

            return routeEndTimeNumber;

        }

        function sortByRouteTypeActivityEvents( routeTypeActivityEvents ){
             return _.sortByOrder(routeTypeActivityEvents, function( r ){
                return utilService.convertTimeStrToNumberByDateTime( r.StartTimePlanned );
            }, "desc")
        }

        function isShowOrHideAllRouteList( isShow ) {
            var tmpList = _.filter( globalSetting.rootJson.Routes, function ( r ) {
                return r.isShowRouteList == isShow;
            } );
            if ( tmpList.length === globalSetting.rootJson.Routes.length ) {
                return true;
            } else {
                return false;
            }
        }

        function clearStopMinimizeObjectByRoutes( route ){
            for (var j = 0; j < route.Stops.length; j++ ){
                var stop = route.Stops[j];
                stop.minimizeObject.isShow = false;
                stop.minimizeObject.fromImageIndex = -1;
                stop.minimizeObject.toImageIndex = -1;
            }
        }

        function buildStopMinimizeObject( route ){
            var fromImageIndex  = 0;
            var isResetIndex = true;

            for (var i = 0; i < route.Stops.length; i++){
                var stop = route.Stops[ i ];
                if ( stop.CanMove == "0" && isResetIndex ){
                    fromImageIndex = stop.imageIndex;

                    isResetIndex = false;
                }else if (stop.CanMove == "1"){
                    if ( !isResetIndex ){
                        var preStop = route.Stops[i - 1];
                        preStop.minimizeObject.isShow = true;
                        preStop.minimizeObject.fromImageIndex = fromImageIndex;
                        preStop.minimizeObject.toImageIndex = preStop.imageIndex;

                        isResetIndex = true;
                    }

                }
            }

            if ( !isResetIndex ){
                route.Stops[route.Stops.length - 1].minimizeObject.isShow = true;
                route.Stops[route.Stops.length - 1].minimizeObject.fromImageIndex = fromImageIndex;
                route.Stops[route.Stops.length - 1].minimizeObject.toImageIndex = route.Stops[route.Stops.length - 1].imageIndex;
            }

        }
    }

    mapExceptionService.$inject = [ "$q", "googleMapApi" ];
    function mapExceptionService( $q, googleMapApi ) {
        var service = {
            clearExceptionObjList: clearExceptionObjList,
            getExceptionObjList: getExceptionObjList,
            handlerExceptionRoute: handlerExceptionRoute,
            addExceptionRoute: addExceptionRoute
        };

        var needHandlerRouteObj = [];
        var exceptionRouteAndStopList = [];

        function clearExceptionObjList() {
            exceptionRouteAndStopList.length = 0;
            needHandlerRouteObj.length = 0;
        }

        function getExceptionObjList() {
            return needHandlerRouteObj;
        }

        function handlerExceptionRoute() {
            console.log( needHandlerRouteObj );
            var defer = $q.defer();
            addExceptionStop().then( successCallBack, failCallBack );

            function successCallBack() {
                defer.resolve( exceptionRouteAndStopList );
            }

            function failCallBack() {
                defer.reject();
            }

            return defer.promise;
        }

        function addExceptionRoute( route, oneRouteLatLngList ) {
            needHandlerRouteObj.push( {
                route: route,
                oneRouteLatLngList: oneRouteLatLngList
            } )
        }

        function addExceptionStop( i, deferred ) {
            var deferred = deferred || $q.defer();
            var i = i || 0;
            var route = needHandlerRouteObj[ i ].route;
            var oneRouteLatLngList = needHandlerRouteObj[ i ].oneRouteLatLngList;
            var requestList = bulidExceptionRequest( oneRouteLatLngList );
            var directionsService = new googleMapApi.maps.DirectionsService;
            // add time out
            setTimeout( function () {
                calculateExceptionDirections( directionsService, requestList ).then( successCallback, failCallback );
            }, i * 10 + 700 );


            function failCallback() {
                ++i;
                if ( i < needHandlerRouteObj.length ) {
                    addExceptionStop( i, deferred );
                } else {
                    deferred.reject();
                }
            }

            function successCallback( exceptionResult ) {
                console.log( exceptionResult );
                if (exceptionResult.status === "ZERO_RESULTS"){
                    var exceptionStopListIndex = exceptionResult.expectionStopIndex;
                    if ( exceptionStopListIndex >= route.Stops.length ) {
                        exceptionStopListIndex = route.Stops.length - 1
                    }
                    var exceptionStop = route.Stops[ exceptionStopListIndex ];
                    var exceptionRoute = route;
                    var exceptionObj = {
                        exceptionStop: exceptionStop,
                        exceptionRoute: exceptionRoute
                    };
                    exceptionRouteAndStopList.push( exceptionObj );
                    ++i;
                    if ( i < needHandlerRouteObj.length ) {
                        addExceptionStop( i, deferred );
                    } else {
                        deferred.resolve();
                    }
                }else{
                    alert(route.RouteID + " " + route.Route +"\n " + 'Directions request failed due to ' + exceptionResult.status);
                }
            }

            return deferred.promise;
        }

        //=============================================== private ====================================================//


        function bulidExceptionRequest( oneRouteLatLngList ) {
            var requestList = [];
            for ( var i = 0; i < oneRouteLatLngList.length - 1; i++ ) {
                var tmpRequest = {};
                tmpRequest.origin = new googleMapApi.maps.LatLng( oneRouteLatLngList[ i ][ 0 ], oneRouteLatLngList[ i ][ 1 ] );
                tmpRequest.destination = new googleMapApi.maps.LatLng( oneRouteLatLngList[ i + 1 ][ 0 ], oneRouteLatLngList[ i + 1 ][ 1 ] );
                requestList.push( tmpRequest );
            }
            return requestList;
        }

        function calculateExceptionDirections( directionsService, requestList, i, deferred ) {
            var i = i || 0;
            var deferred = deferred || $q.defer();
            var directionRequest = {
                origin: requestList[ i ].origin,
                destination: requestList[ i ].destination,
                optimizeWaypoints: false,
                travelMode: googleMapApi.maps.TravelMode.DRIVING
            };

            directionsService.route( directionRequest, function ( response, status ) {
                if ( status === googleMapApi.maps.DirectionsStatus.OK ) {
                    ++i;
                    if ( i < requestList.length ) {
                        setTimeout( function () {
                            calculateExceptionDirections( directionsService, requestList, i, deferred );
                        }, i * 10 + 700 );

                    } else {
                        deferred.reject();
                    }
                } else {
                    var result = {};
                    result.expectionStopIndex = i;
                    result.status = status;
                    deferred.resolve( result );
                }

            } );
            return deferred.promise;
        }

        return service;

    }

    utilService.$inject = [ "globalSetting", "$window", "$translate", "googleMapApi" ,"_" ];
    function utilService( globalSetting, $window, $translate, googleMapApi, _ ) {
        var service = {
            requestObj: requestObj,
            convertTimeNumberToAMPMStr: convertTimeNumberToAMPMStr,
            convertTimeStrToNumber: convertTimeStrToNumber,
            convertTimeStrToNumberByDateTime: convertTimeStrToNumberByDateTime,
            convertTimeNumberToStr: convertTimeNumberToStr,
            convertMeterToMiles: convertMeterToMiles,
            createSvgIcon: createSvgIcon,
            convertTimeStrToServerFormateNumber: convertTimeStrToServerFormateNumber,
            convertValidTimeNumStr: convertValidTimeNumStr,
            formatNumber: formatNumber,
            formatTime: formatTime,
            print: print,
            translate: translate,
            getStartTimeMin: getStartTimeMin,
            getEndTimeMax: getEndTimeMax,
            getRedOrBlackColorByServiceWindow: getRedOrBlackColorByServiceWindow,
            isUndefinedOrNull: isUndefinedOrNull

        };
        return service;

        function requestObj( location ) {
            var url = location.search;
            if ( url.indexOf( "?" ) != -1 ) {
                var search = url.substr( 1 );
                var requestStrArr = search.split( "&" );
                var requestObj = {};
                for ( var i = 0; i < requestStrArr.length; i++ ) {
                    var requestArr = requestStrArr[ i ].split( "=" );
                    requestObj[ requestArr[ 0 ] ] = unescape( requestArr[ 1 ] );
                }
                return requestObj;
            }

            return null;
        }

        function convertTimeNumberToAMPMStr( timeNum ) {
            var timeStr = "";
            if ( timeNum != 0 ) {
                var hour = Math.abs( parseInt( timeNum / 3600 ) );
                var minutes = Math.abs( parseInt( (timeNum - hour * 3600) / 60 ) );
                var seconds = parseInt( (timeNum - hour * 3600 - minutes * 60) );

                if ( seconds > 30 ) {
                    minutes++;
                }

                if ( minutes == 60 ) {
                    hour++;
                    minutes = 0;
                }

                hour = hour % 24;

                if ( hour > 12 ) {
                    timeStr = (hour - 12) + ":" + (minutes >= 10 ? minutes.toString() : "0" + minutes) + " PM";
                } else if ( hour == 12 ) {
                    timeStr = "12:" + (minutes >= 10 ? minutes.toString() : "0" + minutes) + " PM";
                } else {
                    timeStr = hour + ":" + (minutes >= 10 ? minutes.toString() : "0" + minutes) + " AM";
                }
            }
            return timeStr;
        }

        function convertTimeStrToNumber( timeStr ) {
            var resultTime = 0;

            if ( timeStr != "" && !_.isUndefined( timeStr ) && !_.isNull( timeStr ) ) {
                var timeArr = timeStr.split( " " );
                var hour = parseInt( timeArr[ 0 ].split( ":" )[ 0 ] );
                var minutes = parseInt( timeArr[ 0 ].split( ":" )[ 1 ] );
                if ( timeArr.length > 1 ) {
                    var myAMPM = timeArr[ 1 ];
                    if ( myAMPM == "PM" && hour != 12 ) {
                        hour = 12 + hour;
                    }
                }

                resultTime = hour * 3600 + minutes * 60;
            }

            return resultTime;
        }

        function convertTimeStrToNumberByDateTime( timeStr ) {
            //2016/11/16 15:30:00
            //2016/11/16 3:30:00 PM
            var resultTime = 0;

            if ( timeStr != "" && !_.isUndefined( timeStr ) && !_.isNull( timeStr ) ) {
                var timeArr = timeStr.split( " " );
                var tmpArg = timeArr[ 1 ];

                if (!_.isNull(timeArr[2]) && !_.isUndefined(timeArr[2]) && timeArr[2].toUpperCase() == "PM"){
                    tmpArg = tmpArg + " " + timeArr[2];
                }

                resultTime = convertTimeStrToNumber( tmpArg );
            }

            return resultTime;
        }

        function convertTimeNumberToStr( timeNum ) {
            var hour = parseInt( timeNum / 3600 );
            var minutes = parseInt( (timeNum - hour * 3600) / 60 );
            var seconds = parseInt( timeNum - hour * 3600 - minutes * 60 );

            if ( seconds > 30 ) {
                minutes++;
            }
            if ( minutes == 60 ) {
                hour++;
                minutes = 0;
            }
            return hour + ":" + (minutes < 10 ? "0" + minutes.toString() : minutes.toString());
        }

        function convertMeterToMiles( value ) {
            var result = Number( value );

            try {
                result = Number( (value / globalSetting.MilesConversionConstant).toFixed( 2 ) );
            } catch ( err ) {

            }

            return result;
        }

        function createSvgIcon( color, text ) {
            var div = angular.element( '<div>' );
            var svg = angular.element(
                '<svg width="32px" height="43px"  viewBox="0 0 32 43" xmlns="http://www.w3.org/2000/svg">'
                + '<path style="fill:#FFFFFF;stroke:#020202;stroke-width:1;stroke-miterlimit:10;" d="M30.6,15.737c0-8.075-6.55-14.6-14.6-14.6c-8.075,0-14.601,6.55-14.601,14.6c0,4.149,1.726,7.875,4.5,10.524c1.8,1.801,4.175,4.301,5.025,5.625c1.75,2.726,5,11.976,5,11.976s3.325-9.25,5.1-11.976c0.825-1.274,3.05-3.6,4.825-5.399C28.774,23.813,30.6,20.012,30.6,15.737z"/>'
                + '<circle style="fill:' + color + ';" cx="16" cy="16" r="11"/>'
                + '<text x="16" y="20" text-anchor="middle" style="font-size:10px;fill:#FFFFFF;">' + text + '</text>'
                + '</svg>'
            );
            div.append( svg );

            var dd = angular.element( '<canvas>' ).attr( { 'height': '50px', 'width': '50px' } );
            var svgHtml = div[ 0 ].innerHTML;

            //todo yao gai bu dui
            canvg( dd[ 0 ], svgHtml );

            var imgSrc = dd[ 0 ].toDataURL( "image/png" );
            //"scaledSize" and "optimized: false" together seems did the tricky ---IE11  &&  viewBox influent IE scaledSize
            //var svg = '<svg width="32px" height="43px"  viewBox="0 0 32 43" xmlns="http://www.w3.org/2000/svg">'
            //    + '<path style="fill:#FFFFFF;stroke:#020202;stroke-width:1;stroke-miterlimit:10;" d="M30.6,15.737c0-8.075-6.55-14.6-14.6-14.6c-8.075,0-14.601,6.55-14.601,14.6c0,4.149,1.726,7.875,4.5,10.524c1.8,1.801,4.175,4.301,5.025,5.625c1.75,2.726,5,11.976,5,11.976s3.325-9.25,5.1-11.976c0.825-1.274,3.05-3.6,4.825-5.399C28.774,23.813,30.6,20.012,30.6,15.737z"/>'
            //    + '<circle style="fill:' + color + ';" cx="16" cy="16" r="11"/>'
            //    + '<text x="16" y="20" text-anchor="middle" style="font-size:10px;fill:#FFFFFF;">' + text + '</text>'
            //    + '</svg>';
            //var imgSrc = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);

            var iconObj = {
                size: new googleMapApi.maps.Size( 32, 43 ),
                url: imgSrc,
                scaledSize: new googleMapApi.maps.Size( 32, 43 )
            };

            return iconObj;
        }

        function convertTimeStrToServerFormateNumber( timeStr ) {
            var resultTime = convertTimeStrToNumber( timeStr );
            var formatResult = "";
            if ( resultTime != 0 ) {
                var tmpMinutesNum = (resultTime % 3600) / 60;
                formatResult = Math.floor( (resultTime / 3600) ) + "" + (tmpMinutesNum >= 10 ? tmpMinutesNum : "0" + tmpMinutesNum);
            }

            return formatResult;
        }

        function convertValidTimeNumStr( timeValue ) {
            var result = "0";
            try {
                var tmpArr = timeValue.split( " " );
                var myAMPM = "";

                if ( tmpArr.length > 1 ) {
                    myAMPM = tmpArr[ 1 ].toUpperCase();
                }

                tmpArr = tmpArr[ 0 ].split( ":" );

                var hour = parseFloat( tmpArr[ 0 ] );
                if ( myAMPM == "PM" && hour < 12 ) {
                    hour = 12 + hour;
                }

                var minute = tmpArr[ 1 ] || "";
                result = hour + "" + minute;
            } catch ( ex ) {
                console.log( ex );
            }

            return isNaN( result ) ? 0 : result;
        }

        function formatNumber( value ) {
            var value = value.toString();
            var value1, value2;

            if ( !_.isUndefined( value ) && value.indexOf( "." ) > 0 ) {
                var tmpValue = value.split( "." );
                value1 = tmpValue[ 0 ];
                value2 = tmpValue[ 1 ];
            } else {
                value1 = value.toString();
                value2 = "";
            }

            if ( value1.length <= 3 ) {
                return value1 + (value2 == "" ? "" : "." + value2);
            } else {
                return formatNumber( value1.substr( 0, value1.length - 3 ) ) + ',' + value1.substr( value1.length - 3 ) + (value2 == "" ? "" : "." + value2);
            }
        }

        function formatTime( value ) {
            var IsPM = value.toUpperCase().indexOf( "PM" ) > 0;
            var Hour, Minute;
            value = value.match( /[0-9:]/ig );
            if ( value === null || value === "" ) {
                return "";
            } else if ( value.length > 0 ) {
                value = value.join( "" );
            }

            if ( value.indexOf( ":" ) < 0 ) {
                var len = value.length;
                if ( len < 3 ) {
                    Hour = value;
                    Minute = "00";
                } else if ( len == 3 ) {
                    Hour = value.substr( 0, 1 );
                    Minute = value.substr( 1, 3 );
                } else {
                    Hour = value.substr( 0, 2 );
                    Minute = value.substr( 2, 2 );
                }
            } else {
                var TimeComponents = [];
                TimeComponents = value.split( " " );
                var Time = value;
                var HoursMinutes = [];
                HoursMinutes = Time.split( ":" );
                Hour = HoursMinutes[ 0 ];
                Minute = HoursMinutes[ 1 ];
            }

            if ( IsPM ) {
                if ( Hour > 12 && Hour < 24 ) {
                    Hour -= 12;
                } else if ( Hour == 24 && UserTimeFormat != 2 ) {
                    Hour = 12;
                    IsPM = false;
                } else if ( Hour == 24 && UserTimeFormat == 2 ) {
                    Hour = 0;
                    IsPM = false;
                }
            } else {
                if ( Hour > 12 && Hour < 24 ) {
                    Hour -= 12;
                    IsPM = true;
                } else if ( Hour == 12 && UserTimeFormat != 2 ) {
                    Hour = 12;
                    IsPM = true;
                } else if ( (Hour == 0 || Hour == 24) && UserTimeFormat != 2 ) {
                    Hour = 12;
                } else if ( Hour == 24 && UserTimeFormat == 2 ) {
                    Hour = 0;
                }
            }

            if ( Hour > 24 ) {
                return "";
            } else {
                Hour = parseInt( Hour );
            }

            if ( Minute == "" || Minute == undefined ) {
                Minute = "00";
            } else if ( Minute > 59 ) {
                return "";
            }

            if ( Minute.length < 2 ) {
                Minute = "0" + Minute;
            }
            //
            //switch (UserTimeFormat) {
            //    case 2:
            //        if (IsPM) {
            //            value = (Hour + 12) + ":" + Minute;
            //        } else {
            //            value = Hour + ":" + Minute;
            //        }
            //        break;
            //    default:
            if ( IsPM ) {
                value = Hour + ":" + Minute + " PM";
            } else {
                value = Hour + ":" + Minute + " AM";
            }
            //break;
            //}

            return value;
        }

        function print( id ) {
            var printContents = document.getElementById( id ).cloneNode( true ).innerHTML;
            //var printContents = document.getElementById( id ).innerHTML;
            var popupWin = $window.open( '', '_blank', 'width=' + window.screen.availWidth + ',height=' + window.screen.availHeight );
            //popupWin.document.open();
            //popupWin.className = "print-summary-dialog";
            popupWin.document.write( '<html><head></head><body onload="window.print()" >' + printContents + '</html>' );
            popupWin.document.close();
        }

        function translate() {
            var key = "en";
            switch ( globalSetting.rootJson.Language.toLowerCase() ) {
                case "zh":
                    key = "zh-cn";
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
            $translate.use( key );
        }

        function getStartTimeMin() {
            var hourArr = [];

            _.forEach( globalSetting.rootJson.Routes, function ( route ) {
                hourArr.push( getTimeObj( route.StartTime ).hour );
            } );

            return Math.min.apply( null, hourArr );
        }

        function getEndTimeMax() {
            var hourArr = [];

            _.forEach( globalSetting.rootJson.Routes, function ( route ) {
                if ( route.Stops.length > 0 && route.EndTime != "" ) {
                    hourArr.push( getTimeObj( route.EndTime ).hour );
                }
            } );

            return Math.max.apply( null, hourArr );
        }

        function getRedOrBlackColorByServiceWindow( flag ) {
            return flag ? "black" : "red";
        }

        function isUndefinedOrNull( value ){
            return _.isUndefined( value ) || _.isNull( value );
        }

        //=============================================== private ====================================================//

        function getTimeObj( timeStr ) {
            var timeArr = timeStr.split( " " );
            var hour = parseInt( timeArr[ 0 ].split( ":" )[ 0 ] );
            var minutes = parseInt( timeArr[ 0 ].split( ":" )[ 1 ] );
            if ( timeArr.length > 1 ) {
                var myAMPM = timeArr[ 1 ];
                if ( myAMPM == "PM" && hour != 12 ) {
                    hour = 12 + hour;
                }
            }

            return {
                hour: hour,
                minutes: minutes
            };
        }
    }

    repositoryService.$inject = [ "globalSetting", "_", "utilService" ];
    function repositoryService( globalSetting, _, utilService ) {
        var service = {
            getLatLngByMapPointID: getLatLngByMapPointID,
            getStopByKey: getStopByKey,
            getLoadSheetByKey: getLoadSheetByKey,
            getStopsByIsSelectedOnMap: getStopsByIsSelectedOnMap,
            getRouteByStopID: getRouteByStopID,
            getEmptyStopList: getEmptyStopList,
            getEmptyStopListByRoute: getEmptyStopListByRoute,
            getStopByCustomerID: getStopByCustomerID,
            getReceiptByCustomerIDAndLoadSheetID: getReceiptByCustomerIDAndLoadSheetID,
            getLoadSheetFromLoadSheetListByStopFlag: getLoadSheetFromLoadSheetListByStopFlag,
            findRouteTypeActivityEventsByLoadSheetID: findRouteTypeActivityEventsByLoadSheetID,
            getRouteIDIfMapPointIDIsNull:getRouteIDIfMapPointIDIsNull,
            getMarkerColorByStopID: getMarkerColorByStopID,
            findStopCountMoreThan100Route: findStopCountMoreThan100Route

        };
        return service;

        /**
         * @param mapPointID
         * @returns
         * {Latitude: "40.6255415"
         *  Longitude: "-103.207709"
         *  MapPoint: "Sterling Warehouse"
         *  MapPointID: "1"}
         */
        function getLatLngByMapPointID( mapPointID ) {
            return _.find( globalSetting.mapPointJson.MapPointsJson, function ( mapPoint ) {
                return mapPoint.MapPointID == mapPointID;
            } );
        }

        function getStopByKey( stopID, route ) {
            if (utilService.isUndefinedOrNull(route)){
                return null;
            }

            return _.find( route.Stops, function ( s ) {
                return s.StopID == stopID;
            } );
        }

        function getLoadSheetByKey( loadSheetID, routes ) {
            routes = routes || globalSetting.rootJson.Routes;

            return _.find( routes, function ( r ) {
                return r.LoadSheetID == loadSheetID;
            } );
        }

        function getStopsByIsSelectedOnMap( markers, routes ) {
            routes = routes || globalSetting.rootJson.Routes;

            var list = [];
            _.forEach( routes, function ( r ) {
                var tmpStopList = _.filter( r.Stops, function ( s ) {
                    var some = _.some( markers, function ( m ) {
                        return m.isSelectedOnMap && m.stopID == s.StopID;
                    } );
                    return some;
                } );

                Array.prototype.push.apply( list, tmpStopList );
            } );

            //_.forEach( routes, function ( r ) {
            //    var tmpStopList = _.filter( r.Stops, function ( s ) {
            //        return s.isSelectedOnMap;
            //    } );
            //
            //    Array.prototype.push.apply( list, tmpStopList );
            //} );

            return list;
        }

        function getRouteByStopID( stopID, routes ) {
            routes = routes || globalSetting.rootJson.Routes;

            for ( var i = 0; i < routes.length; i++ ) {
                var route = routes[ i ];
                for ( var j = 0; j < route.Stops.length; j++ ) {
                    var stop = route.Stops[ j ];
                    if ( stop.StopID == stopID ) {
                        return route;
                    }
                }
            }

            return null;
        }

        function getEmptyStopList( routes ) {
            routes = routes || globalSetting.rootJson.Routes;

            var emptyStopList = [];
            _.forEach( routes, function ( route ) {
                var EmptyStops = getEmptyStopListByRoute( route );
                if ( !_.isEmpty( EmptyStops ) ) {
                    emptyStopList.push( EmptyStops );
                }
            } );
            return emptyStopList;
        }

        function getEmptyStopListByRoute( route ) {
            var emptyStopList = [];
            _.forEach( route.Stops, function ( stop ) {
                if ( stop.Latitude === "" || stop.Longitude === "" ) {
                    emptyStopList.push( stop );
                }
            } );
            return emptyStopList;
        }

        function getStopByCustomerID( customerID, route ) {
            return _.find( route.Stops, function ( s ) {
                return s.CustomerID == customerID;
            } );
        }

        function getReceiptByCustomerIDAndLoadSheetID( customerID, loadSheetID ) {
            var receipts = globalSetting.customerReceipt;
            return _.find( receipts, function ( r ) {
                return r.CustomerID == customerID && r.LoadSheetID == loadSheetID;
            } );
        }

        function getLoadSheetFromLoadSheetListByStopFlag( stopFlag, loadSheetList ) {
            for ( var i = 0; i < loadSheetList.length; i++ ) {
                var loadSheet = loadSheetList[ i ];
                for ( var j = 0; j < loadSheet.Stops.length; j++ ) {
                    var stop = loadSheet.Stops[ j ];
                    if ( stop.StopFlag == stopFlag ) {
                        return loadSheet;
                    }
                }
            }

            return null;
        }

        function findRouteTypeActivityEventsByLoadSheetID( loadSheetID ) {
            var routeTypeActivityEvents = globalSetting.routeTypeActivityEvents;
            return _.filter( routeTypeActivityEvents, function ( r ) {
                return r.LoadSheetID == loadSheetID;
            } );
        }

        function getRouteIDIfMapPointIDIsNull() {
            var tmpList = [];
            _.forEach( globalSetting.rootJson.Routes, function ( r ) {
                if ( r.StartMapPointID == -1 || r.EndMapPointID == -1 ) {
                    var tmpFlag = _.some( tmpList, function ( t ) {
                        return t.routeID == r.RouteID;
                    } );

                    if ( !tmpFlag ) {
                        tmpList.push( {
                            routeID: r.RouteID,
                            route: r.Route
                        } );
                    }

                }
            } );

            return tmpList;
        }

        function getMarkerColorByStopID( stopID, route ){
            var color = "#" + route.Color;
            var stop = getStopByKey( stopID, route );
            if ( !utilService.isUndefinedOrNull(stop) ){
                if ( stop.CanMove == "0"){
                    color = '#ccc';
                }
            }

            return color;
        }

        function findStopCountMoreThan100Route(routes){
            routes = routes || globalSetting.rootJson.Routes;

            var result = _.chain(routes)
                .filter(function( r ){
                    return r.Stops.length >= 100;
                })
                .map("Route")
                .value();

            return result;
        }

    }

    timelineService.$inject = [ "globalSetting", "_", "utilService", "$filter" ];
    function timelineService( globalSetting, _, utilService, $filter ) {
        var service = {
            drawTimeline: drawTimeline
        };

        return service;

        function drawTimeline() {
            if ( globalSetting.rootJson.isShowTimeline ) {
                drawTimelineHeader();
                drawTimelineContent();
            }
        }

        //=============================================== private ====================================================//

        function drawTimelineHeader() {
            //var count = Math.max(endTimeHour, RouteOptimizer.GlobalSetting.lastMaxEndTime || 0) - startTimeHour + 1;
            //RouteOptimizer.GlobalSetting.lastMaxEndTime = Math.max(endTimeHour, RouteOptimizer.GlobalSetting.lastMaxEndTime || 0);

            var minStartTime = utilService.getStartTimeMin();
            var maxEndTime = utilService.getEndTimeMax();

            var count = maxEndTime - minStartTime + 1;
            var timelinePercent = getPercentByMinServiceTime();

            globalSetting.rootJson.timelineHeaderObjList = [];
            var timeText = minStartTime;
            for ( var i = 0; i < count; i++ ) {//
                var tmpText = (timeText > 12 ? (timeText - 12) + " PM" : timeText == 12 ? timeText + " PM" : timeText + " AM");

                var tmpObj = {
                    hourText: $filter( "timeFormat" )( tmpText ),
                    width: 3600 / timelinePercent
                };

                globalSetting.rootJson.timelineHeaderObjList.push( tmpObj );

                timeText = timeText + 1;
            }
        }

        function drawTimelineContent() {
            var routes = globalSetting.rootJson.Routes;

            var timelinePercent = getPercentByMinServiceTime();
            var minStartTime = utilService.getStartTimeMin();
            var maxEndTime = utilService.getEndTimeMax();

            _.forEach( routes, function ( route ) {
                if ( route.Stops.length > 0 ) {
                    var hpercent = route.Helper ? Number( route.helperPercent ) : 1;

                    var minStartTimeSec = utilService.convertTimeStrToNumber( (minStartTime > 12 ? (minStartTime - 12) + ":00 PM" : minStartTime + ":00 AM") );
                    var loadSheetStartSec = utilService.convertTimeStrToNumber( route.StartTime );
                    var marginLeft = (loadSheetStartSec - minStartTimeSec) / timelinePercent;

                    route.timelineObj.isShow = true;
                    route.timelineObj.startPointOffsetLeft = marginLeft;
                    route.timelineObj.startTimeRailWayWidth = route.Stops[ 0 ].Duration / timelinePercent; // - start point width 20
                    route.timelineObj.endTimeRailWayWidth = route.Duration / timelinePercent;
                    route.timelineObj.timelineList = [];

                    for ( var i = 0; i < route.Stops.length; i++ ) {
                        var tmpStop = route.Stops[ i ];
                        var serviceTimeSec = tmpStop.Fsm + tmpStop.CustomerDuration * hpercent;
                        var nextStop = null;
                        if ( i + 1 < route.Stops.length ) {
                            nextStop = route.Stops[ i + 1 ];
                        }

                        var tmpServiceTimeWidth = serviceTimeSec / timelinePercent;

                        var tmpObj = {
                            RailWayWidth: nextStop ? nextStop.Duration / timelinePercent : 0,
                            RectWidth: tmpServiceTimeWidth,
                            RectText: i + 1,
                            RectBorderColor: "#" + route.Color, //rgb(34, 139, 34);
                            RectFillColor: tmpStop.serviceWindowColor == "red" ? "#FF6446" : "white"
                        };

                        route.timelineObj.timelineList.push( tmpObj );
                    }

                } else {
                    route.timelineObj = {};
                }
            } );
        }

        function getPercentByMinServiceTime() {
            var tmpArr = [];
            for ( var j = 0; j < globalSetting.rootJson.Routes.length; j++ ) {
                var route = globalSetting.rootJson.Routes[ j ];
                var hpercent = route.Helper == "True" ? Number( rootJson.HelperPercent ) : 1;

                for ( var i = 0; i < route.Stops.length; i++ ) {
                    var tmpStop = route.Stops[ i ];
                    var serviceTimeSec = tmpStop.Fsm + tmpStop.CustomerDuration * hpercent;
                    if ( serviceTimeSec > 0 ) {
                        tmpArr.push( serviceTimeSec );
                    }
                }
            }

            var peri = Math.min.apply( null, tmpArr );
            var result = peri / 35;

            return result;
        }

    }

    dataService.$inject = [ "$http", "$window", "utilService", "globalSetting", "reSequenceType", "ajaxRequestType" ];
    function dataService( $http, $window, utilService, globalSetting, reSequenceType, ajaxRequestType ) {

        var service = {
            loadJson: loadJson,
            loadInitialJson: loadInitialJson,
            loadDurationAndDistanceByLoadSheet: loadDurationAndDistanceByLoadSheet,
            loadMapPointData: loadMapPointData,
            loadDeliverymanJson: loadDeliverymanJson,
            getAllLoadSheet: getAllLoadSheet,
            moveInvoiceAndSave: moveInvoiceAndSave,
            sendMessage: sendMessage,
            setHelper: setHelper,
            getCustomerReceipt: getCustomerReceipt,
            saveData: saveData,
            sequenceRouteFromService: sequenceRouteFromService,
            saveCustomerDistancesAndDuration: saveCustomerDistancesAndDuration,
            saveSequenceOption: saveSequenceOption,
            saveCustomerLocation: saveCustomerLocation,
            saveZeroInvoicesOption: saveZeroInvoicesOption,
            saveMapPoint: saveMapPoint,
            saveStartTime: saveStartTime,
            saveDirectionsOption: saveDirectionsOption,
            getRouteTypeActivityEvents: getRouteTypeActivityEvents,
            addLoadSheet:addLoadSheet,
            loadRoutes:loadRoutes,
            loadDeliverymans:loadDeliverymans,
        };

        var RouteOptimizer = {
            Actions: {
                SET_DRIECTIONOPTION: 27,
                GET_ALL_LOADSHEET: 38,
                MOVE_INVOICE: 39,
                GET_CUSTOMER_RECIPET: 95,
                SAVE_LOADGROUP_SETTING: 37

            }
        };

        return service;

        function loadJson( loadSheetIdStr, productPickTypeId, loadGroupId, showColumn, units ) {
            return $http.get( globalSetting.ajaxPageUrl + '?Action=4&LoadSheetID_List=' + loadSheetIdStr
                + '&isBingMap=true&Columns=' + ( showColumn || "" ) + '&ProductPickTypeID='
                + ( productPickTypeId || "" ) + '&LoadGroupID=' + ( loadGroupId || "" )
                + '&Units=' + (units || ""),
                buildHttpRequestConfig(ajaxRequestType.json, "Load root json"));
        }

        function loadInitialJson() {
            var request = utilService.requestObj( $window.location );
            return loadJson( request.LoadSheetID_List, request.ProductPickTypeID, request.LoadGroupID, request.Columns, request.Units );
        }

        function loadDurationAndDistanceByLoadSheet( customerIdStr ) {
            return $http.get( globalSetting.ajaxPageUrl + "?Action=96&customerIdStr=" + customerIdStr,
                buildHttpRequestConfig(ajaxRequestType.ignore, "Load duration and distance by load sheet ") );
        }

        function loadMapPointData() {
            return $http.get( globalSetting.ajaxPageUrl + '?Action=19',
                buildHttpRequestConfig(ajaxRequestType.json, "Load map point data json") );
        }

        function loadDeliverymanJson() {
            return $http.get( globalSetting.ajaxPageUrl + "?Action=18",
                buildHttpRequestConfig(ajaxRequestType.json, "Load deliveryman json") )
        }

        function getAllLoadSheet( loadSheetId ) {
            return $http.get( globalSetting.ajaxPageUrl + "?Action=" + RouteOptimizer.Actions.GET_ALL_LOADSHEET + "&LoadSheetID=" + loadSheetId,
                buildHttpRequestConfig(ajaxRequestType.json, "Get all load sheet") );
        }

        function moveInvoiceAndSave( newIdArr ) {
            var request = utilService.requestObj( $window.location );
            return $http.post( globalSetting.ajaxPageUrl, {
                Action: RouteOptimizer.Actions.MOVE_INVOICE,
                LoadSheetIDInvoiceIDObjList: newIdArr,
                ProductPickTypeID: request.ProductPickTypeID,
                LoadGroupID: request.LoadGroupID,
                Columns: request.Columns,
                Units: request.Units
            },
            buildHttpRequestConfig(ajaxRequestType.empty, "Move invoice in customer list"));
        }

        function sendMessage( employee, route, startTime ) {
            return $http.post( globalSetting.ajaxPageUrl, {
                Action: 3,
                TextMessageStr: employee + "^" + route + "^" + startTime + "|"
            },
                buildHttpRequestConfig(ajaxRequestType.ignore, "Send message"));
        }

        function setHelper( loadSheetID, helper ) {
            return $http.post( globalSetting.ajaxPageUrl, {
                Action: 2,
                Helper: loadSheetID + "^" + helper
            },
            buildHttpRequestConfig(ajaxRequestType.empty, "Set helper"));
        }

        function getCustomerReceipt( loadSheetIDList ) {
            var request = utilService.requestObj( $window.location );
            return $http.get( globalSetting.ajaxPageUrl
                    + "?Action=" + RouteOptimizer.Actions.GET_CUSTOMER_RECIPET
                + "&LoadSheetID_List=" + request.LoadSheetID_List,
                buildHttpRequestConfig(ajaxRequestType.json, "Get customer receipt"));
        }

        function saveData( postData ) {
            return $http.post( globalSetting.ajaxPageUrl, postData,
                buildHttpRequestConfig(ajaxRequestType.json, 'Save data'));
        }

        function sequenceRouteFromService( type, sortCustomerIdStr, locationId, loadSheetId, customersIdAndConsumeTime ) {
            var url = "";
            switch ( type ) {
                case reSequenceType.farthest_stop_first:
                    url = globalSetting.ajaxPageUrl + "?Action=7" + "&SortCustomerIDStr=" + sortCustomerIdStr + "&LocationID=" + locationId + "&isBingMap=1";
                    break;
                case reSequenceType.closest_stop_first:
                    url = globalSetting.ajaxPageUrl + "?Action=6" + "&SortCustomerIDStr=" + sortCustomerIdStr + "&LocationID=" + locationId + "&isBingMap=1";
                    break;
                case reSequenceType.shortest_distance:
                    url = globalSetting.ajaxPageUrl + "?Action=9" + "&SortCustomerIDStr=" + sortCustomerIdStr + "&LocationID=" + locationId + "&isBingMap=1";
                    break;
                case reSequenceType.service_windows:
                    url = globalSetting.ajaxPageUrl + "?Action=8" + "&SortCustomerIDStr=" + customersIdAndConsumeTime + "&SortLoadSheetID=" + loadSheetId + "&isBingMap=1";
                    break;
            }
            return $http.get( url,
                buildHttpRequestConfig(ajaxRequestType.ignore, "Sequence route, type: " + type));
        }

        function saveCustomerDistancesAndDuration( saveDistanceParam ) {
            return $http.post( globalSetting.ajaxPageUrl, {
                Action: 28,
                distanceList: saveDistanceParam,
                isBingMap: 1
            },
            buildHttpRequestConfig(ajaxRequestType.ignore, "Save customer distance and duration"));
        }

        function saveSequenceOption( sequenceOption ) {
            return $http.post( globalSetting.ajaxPageUrl, {
                Action: 20,
                ReSeqSetting: sequenceOption
            },
                buildHttpRequestConfig(ajaxRequestType.empty, "Save sequence option"));
        }

        function saveCustomerLocation( customerIdStr, isWarehouse ) {
            var uriStr = isWarehouse ? {
                LocationType: 1,
                action: 'save',
                accuracy: 3,
                list: customerIdStr
            } : {
                action: 'save',
                accuracy: 3,
                list: customerIdStr
            };
            return $http.post( globalSetting.customerLocationSaveUrl, uriStr,
                buildHttpRequestConfig(ajaxRequestType.ignore, "Save customer location") );
        }

        function saveZeroInvoicesOption( option ) {
            var url = globalSetting.ajaxPageUrl + "?Action=1" + "&ShowZeroInvoices=" + option.toString();

            return $http.get( url,
                buildHttpRequestConfig(ajaxRequestType.empty, "Save zero invoice option"));
        }

        function saveMapPoint( routeID, mapPointID, isStartMapPoint ) {
            return $http.post( globalSetting.ajaxPageUrl, {
                Action: 32,
                MapPointsStr: routeID + "^" + mapPointID,
                IsStartMapPoint: isStartMapPoint
            },
                buildHttpRequestConfig(ajaxRequestType.empty, "Save map point"));
        }

        function saveStartTime( routeID, startTime ) {
            return $http.post( globalSetting.ajaxPageUrl, {
                Action: 31,
                RouteStartTime: routeID + "^" + startTime
            },
                buildHttpRequestConfig(ajaxRequestType.empty, "Save start time"));
        }

        function saveDirectionsOption( isDrawDirection ) {
            return $http.post( globalSetting.ajaxPageUrl, {
                Action: RouteOptimizer.Actions.SET_DRIECTIONOPTION,
                DrawDirectionOption: isDrawDirection ? "1" : "0",
                isBingMap: true
            },
                buildHttpRequestConfig(ajaxRequestType.empty , "Save directions option"));
        }

        function getRouteTypeActivityEvents() {
            var request = utilService.requestObj( $window.location );
            return $http.get( globalSetting.ajaxPageUrl + "?Action=53&LoadSheetID_List=" + request.LoadSheetID_List,
                buildHttpRequestConfig(ajaxRequestType.json, "Get assignment"));
        }
        function addLoadSheet(RouteID,Deliveryman,LSDate) {
            return $http.get(globalSetting.ajaxPageUrl+'?Action=59&RouteID='+RouteID+'&Deliveryman='+Deliveryman+'&LSDate='+LSDate)
        }
        function loadRoutes(type) {
            if(type==""){
                return $http.get(globalSetting.ajaxPageUrl+'?Action=57');
            }
            return $http.get(globalSetting.ajaxPageUrl+'?Action=57&Search='+type);


        }
        function loadDeliverymans(type) {
            if(type==""){
                return $http.get(globalSetting.ajaxPageUrl+'?Action=58');
            }
            return $http.get(globalSetting.ajaxPageUrl+'?Action=58&Search='+type);
        }

        //=========================//

        function buildHttpRequestConfig(ajaxRequestType, action, reponseText){

            var configObj = {
                ajaxRequestType: ajaxRequestType,
                action: action
            };

            if (!utilService.isUndefinedOrNull(reponseText)){
                configObj.reponseText = reponseText;
            }

            return configObj;
        }
    }

    httpInterceptorService.$inject = ["$q", "utilService", "loading", "ajaxRequestType","$injector"];
    function httpInterceptorService( $q, utilService, loading, ajaxRequestType,$injector ){
        function showErrorDialog(error,action) {
            var errorInfo = escapeHtmlstr(error);
            var ngDialog = $injector.get('ngDialog');
            function escapeHtmlstr(olddata) {
                var htmlArr = olddata.replace(/\\/g, "\\\\").replace(/\\/g, "\\/").replace(/\'/g, "\\\'").split('\n');
                var len = htmlArr.length;
                var outArr = [];
                for (var i = 0; i < htmlArr.length; i++) {
                    if (htmlArr[i] !== '') {
                        if (i === len - 1) {
                            outArr.push("\'" + htmlArr[i] + "\'");
                        } else {
                            outArr.push("\'" + htmlArr[i] + "\',\n");
                        }
                    }
                }
                return outArr.join("");
            };
            ngDialog.open({
                template: "Action:"+action+"</br>"+errorInfo,
                className: "ngdialog-theme-default ngdialog-theme-print",
                closeByEscape: true,
                plain: true,
                closeByDocument: true,
                showClose: true,
                controller: ['$scope', function ($scope) {
                    var tag = 0;
                    $scope.$on('ngDialog.opened', function () {
                        tag++;
                        // window.Init_Page();
                        document.querySelector('#ngdialog' + tag).scrollTop = 0;
                    });
                    $scope.$on('ngDialog.closed', function () {
                        tag--;
                        document.querySelector('#ngdialog' + tag).scrollTop = 0;
                    });
                }]

            });
        }

        return {
            response: function ( res ) {

                if ( !utilService.isUndefinedOrNull( res.config.ajaxRequestType ) ) {
                    var isError = false;

                    switch(res.config.ajaxRequestType)
                    {
                        case ajaxRequestType.json:
                            if ( !_.isObject( res.data ) ) {
                                isError = true;
                            }

                            break;
                        case ajaxRequestType.empty:
                            if ( !_.isEmpty( res.data ) ) {
                                isError = true;
                            }

                            break;
                        case ajaxRequestType.string:
                            if ( res.config.reponseText != res.data ) {
                                isError = true;
                            }

                            break;
                        case ajaxRequestType.ignore:
                            if ( res.data.indexOf( "<html" ) > -1 ) {
                                isError = true;
                            }

                            break;
                        default:
                            isError = false;
                    }

                    if ( isError ) {

                        //alert( "Action: " + res.config.action + "        " + res.data );
                        showErrorDialog(res.data,res.config.action);
                        loading.hide();
                    }

                }

                return res;
            },
            responseError: function(err){
                alert("Error code: " + err.status + err.message +" ,please try again.");
                loading.hide();

                return $q.reject(err);
            }
        };
    }

    function eventBus() {
        var eventMap = {};

        var EventBus = {
            on: function ( eventType, handler ) {
                if ( !eventMap[ eventType ] ) {
                    eventMap[ eventType ] = [];
                }
                eventMap[ eventType ].push( handler );
            },

            off: function ( eventType, handler ) {
                for ( var i = 0; i < eventMap[ eventType ].length; i++ ) {
                    if ( eventMap[ eventType ][ i ] === handler ) {
                        eventMap[ eventType ].splice( i, 1 );
                        break;
                    }
                }
            },

            fire: function ( event ) {
                var eventType = event.type;
                if ( eventMap && eventMap[ eventType ] ) {
                    for ( var i = 0; i < eventMap[ eventType ].length; i++ ) {
                        eventMap[ eventType ][ i ]( event );
                    }
                }
            }
        };

        return EventBus;
    }
})();