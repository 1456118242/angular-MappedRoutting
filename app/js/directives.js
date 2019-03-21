(function () {
    "use strict";

    angular
        .module( "mappedRoutingApp.directives", [ "mappedRoutingApp.services" ] )
        .directive( "routeList", routeList )
        .directive( "stopList", stopList )
        .directive( "routeTable", routeTable )
        .directive( "buttonBar", buttonBar )
        .directive( "stopInfoPanelOnMap", stopInfoPanelOnMap )
        .directive( "routeInfoPanelOnMap", routeInfoPanelOnMap )
        .directive( "myControlPanel", myControlPanel )
        .directive( "selectCheckbox", selectCheckbox )
    ;

    routeList.$inject = [ "mapService", "mappedRoutingService", "loading", "_", "mapHelperService", "sequenceService", "dataService", "utilService", "customEvent", "googleMapObj", "googleMapApi", "globalSetting" ];
    function routeList( mapService, mappedRoutingService, loading, _, mapHelperService, sequenceService, dataService, utilService, customEvent, googleMapObj, googleMapApi, globalSetting ) {
        var currentScope = {
            route: "=",
            rootjson: "="
        };

        var insertedIndex = null;
        var toRoute = {};

        var directive = {
            restrict: "E",
            scope: currentScope,
            templateUrl: "MappedRouting/app/template/routelist.html?" + new Date().getTime().toString(),
            replace: true,
            link: linkFunc
        };

        return directive;

        function linkFunc( scope, el, attr, ctrl ) {
            scope.linearUnitOfMeasure = globalSetting.linearUnitOfMeasure;

            // scope.insertedCallback = function ( index, event ) {
            //     loading.show();
            //     reDrawRouteList = [];
            //     var route = scope.route;
            //
            //     mappedRoutingService.clearStopAutoRouteInfo( route.Stops[ index ] );
            //
            //     reDrawRouteList.push( route );
            //     console.log("sdfsd")
            // };

            scope.dragEndCallback = function ( index, event ) {
                if ( !_.isNull( toRoute ) && !_.isUndefined( toRoute ) ) {
                    var toStops = toRoute.Stops;//toStops

                    var fromRoute = scope.route;//oldRoute
                    var oldStops = fromRoute.Stops;//oldStops
                    var fromIndex = index;

                    var dragStop = oldStops[ fromIndex ];

                    //Task 413181
                    if(dragStop.InvoiceLocked == "1" && dragStop.OldLoadSheetID != toRoute.LoadSheetID ){
                        alert( "Invoice is locked and cannot be moved" );
                        return false;
                    }

                    if ( _.isNull( insertedIndex ) || (insertedIndex == index && toRoute.LoadSheetID == fromRoute.LoadSheetID ) ) {
                        toRoute = null;
                        insertedIndex = null;
                        return;
                    }

                    if ( fromRoute.LoadSheetID == toRoute.LoadSheetID && insertedIndex > fromIndex ) {
                        insertedIndex = insertedIndex - 1 < 0 ? 0 : insertedIndex - 1;
                    }

                    //delete stop in fromRoute.Stops
                    _.remove( oldStops, function ( o ) {
                        return o.StopID == dragStop.StopID;
                    } );

                    //insert stop to toRoute.Stops
                    toStops.splice( insertedIndex, 0, dragStop );

                    mappedRoutingService.clearStopAutoRouteInfo( fromRoute.Stops[ insertedIndex ] );

                    loading.show();

                    mapService.reCalculateRoutes( toRoute.LoadSheetID == fromRoute.LoadSheetID ? [toRoute] : [toRoute, fromRoute]);

                }

                toRoute = null;
                insertedIndex = null;
            };

            scope.dropCallback = function(event, index, item, external, type){
                toRoute = scope.route;
                insertedIndex = index;
                return false;
            };

            scope.stopDivClickHandler = function (stop, route) {
                stop.isShowStopInfo = !stop.isShowStopInfo;
                mapHelperService.setCenterByLatLng(Number(stop.Latitude), Number(stop.Longitude));

                _.forEach(googleMapObj.markerList, function (m) {

                    // Task 354789: Marker expansion/reduction correlates to stop info panel
                    if (!_.isUndefined(m.loadSheetID) && !_.isNull(m.loadSheetID) && !_.isUndefined(m.stopID) && !_.isNull(m.stopID)) {
                        if ((m.loadSheetID == route.LoadSheetID && m.stopID == stop.StopID && stop.isShowStopInfo) || (m.isShowStopInfo && m.stopID != stop.StopID)) {
                            m.isShowStopInfo = true;
                        }
                        else {
                            m.isShowStopInfo = false;
                        }
                    }
                    var isNormal = !m.isShowStopInfo;
                    mapHelperService.setMarkerSizeAndZindex(m, isNormal);
                });
            };

            scope.reSequenceHandler = function ( route, type ) {
                if ( !_.isUndefined( type ) && scope.rootjson.ReSeqSetting != type.toString() ) {
                    scope.rootjson.ReSeqSetting = type.toString();
                    dataService.saveSequenceOption( scope.rootjson.ReSeqSetting );
                }

                sequenceService.reSequenceRoute( route, Number( scope.rootjson.ReSeqSetting ) );
                route.isShowSeqOption = false;
            };

            scope.showColumn = function ( route, type ) {
                switch ( type ) {
                    case 0:
                        route.showColumnNum = 0;
                        route.isShowColumnOption = !route.isShowColumnOption;
                        break;
                    case 1:
                        route.showColumnNum = 1;
                        route.isShowColumnOption = !route.isShowColumnOption;
                        break;
                    case 2:
                        route.showColumnNum = 2;
                        route.isShowColumnOption = !route.isShowColumnOption;
                        break;
                    case 3:
                        route.showColumnNum = 3;
                        route.isShowColumnOption = !route.isShowColumnOption;
                        break;
                }
            };

            scope.routeListClickHandler = function ( route ) {
                route.isShowSeqOption = false;
                route.isShowColumnOption = false;
                route.isShowEditStartTime = false;
                route.editStartTimeText = route.StartTime;
            };

            scope.changeMapPointHandler = function ( route, isStartMapPoint ) {

                mappedRoutingService.chooseMapPointDialog( isStartMapPoint ? route.StartMapPointID : route.EndMapPointID ).then( function ( mapPointID ) {
                    loading.show();
                    if ( route[ isStartMapPoint ? "StartMapPointID" : "EndMapPointID" ] == mapPointID ) {
                        loading.hide();
                    } else {
                        route[ isStartMapPoint ? "StartMapPointID" : "EndMapPointID" ] = mapPointID;

                        dataService.saveMapPoint( route.RouteID, mapPointID, isStartMapPoint == 1 );

                        mapService.reCalculateRoutes( [ route ] );
                    }
                } );

            };

            scope.formatTime = function ( event ) {
                event.currentTarget.value = utilService.formatTime( event.currentTarget.value );
            };

            scope.saveStartTimeHandler = function ( event, route ) {
                var formatedTime = utilService.formatTime( event.currentTarget.previousSibling.value );
                if ( _.isEmpty( formatedTime ) ) {
                    alert( "Start Time is a required field.It muset contain a valid value." );
                } else {
                    event.currentTarget.previousSibling.value = formatedTime;
                    route.isShowEditStartTime = false;
                    route.StartTime = event.currentTarget.previousSibling.value;

                    dataService.saveStartTime( route.RouteID, utilService.convertValidTimeNumStr( route.StartTime ) );
                    mappedRoutingService.computeDriveDuration( route );
                    route.editStartTimeText = route.StartTime;

                    scope.$emit( customEvent.drawTimeline );

                }
            };

            scope.showOrHideRouteList = function(route){
                route.isShowRouteList = !route.isShowRouteList;
                mappedRoutingService.checkIsShowOrHideAllRouteList();
            }
        }
    }

    stopList.$inject = [ "loading", "mapService", "dataService", "ngDialog", "customEvent", "mappedRoutingService" ];
    function stopList( loading, mapService, dataService, ngDialog, customEvent, mappedRoutingService ) {
        var directive = {
            restrict: "E",
            replace: true,
            templateUrl: "MappedRouting/app/template/stoplist.html?" + new Date().getTime().toString(),
            link: linkFunc
        };

        return directive;

        function linkFunc( scope, el, attr, ctrl ) {
            scope.geocodeStop = function ( stop, route ) {
                mapService.manualGeocoding( stop, route );
            };

            scope.moveInvoice = function ( stop, route ) {
                loading.show();
                dataService.getAllLoadSheet( route.LoadSheetID ).then( function ( result ) {
                    if ( result.statusText.toLowerCase() === "ok" ) {
                        _.forEach( result.data.LoadSheetJson, function ( loadSheet ) {
                            loadSheet.dateAndRoute = loadSheet.Date + " " + loadSheet.Route;
                        } );

                        var loadSheetFilted = _.find( result.data.LoadSheetJson, function ( loadSheet ) {
                            return loadSheet.LoadSheetID === route.LoadSheetID;
                        } );
                        if ( _.isUndefined( loadSheetFilted ) ) {
                            loadSheetFilted = result.data.LoadSheetJson[ 0 ];
                        }

                        mappedRoutingService.moveInvoiceDialog( loadSheetFilted, result, stop ).then( function ( r ) {
                            if ( r.statusText.toLowerCase() === "ok" ) {
                                ngDialog.closeAll();
                                dataService.loadInitialJson().then( function ( initJson ) {
                                    scope.$emit( customEvent.initJsonData, initJson.data );
                                } );
                            } else {
                            }
                        } );
                    }
                }, function () {
                } );
            };

            scope.getBackgroundColor = function ( stop ) {
                if(stop.CanMove=='0'){
                    return {'background':'#ccc' ,'cursor': 'not-allowed'}
                }
            };
        }
    }

    routeTable.$inject = [ "dataService", "ngDialog", "customEvent", "mapService", "mappedRoutingService", "moveStopDialog", "repositoryService", "googleMapObj", "loading", "globalSetting" ];
    function routeTable( dataService, ngDialog, customEvent, mapService, mappedRoutingService, moveStopDialog, repositoryService, googleMapObj, loading, globalSetting ) {
        var directive = {
            restrict: "E",
            replace: true,
            templateUrl: "MappedRouting/app/template/routeTable.html?" + new Date().getTime().toString(),
            link: linkFunc
        };

        return directive;

        function linkFunc( scope, el, attr, ctrl ) {
            scope.sendMessageHandler = function ( route ) {
                ngDialog.open( {
                    template: 'MappedRouting/app/template/sendmessagewindow.html?' + new Date().getTime().toString(),
                    closeByEscape: false,
                    closeByDocument: false,
                    className: "ngdialog-theme-default ngdialog-theme-sendMessage",
                    controller: [ '$scope', function ( $scope ) {
                        $scope.route = route.Route;
                        $scope.startTime = route.StartTime;
                        $scope.sendMessage = function () {
                            dataService.sendMessage( route.Employee, route.Route, route.StartTime );
                            $scope.closeThisDialog();

                        }
                    } ]
                } );
            };

            scope.changeRouteColorHandler = function ( route ) {
                mapService.setRouteColor( route );
                mapService.clearSelectedMarkerOnMap( false, route.LoadSheetID );

                scope.$emit( customEvent.drawTimeline );
            };

            scope.hideOrShowRouteHandler = function ( route ) {
                route.isShowRouteOnMap = !route.isShowRouteOnMap;
                mapService.showOrHideRoute( route.LoadSheetID, route.isShowRouteOnMap );
                mapService.showOrHideAllPolylineByIsDrawPolylineList();
            };

            scope.helperChangedHandler = function ( route ) {
                mappedRoutingService.computeDriveDuration( route );
                dataService.setHelper( route.LoadSheetID, route.Helper );
            };

            el.bind( 'click', function () {
                moveStopDialog.remove();
            } );

            scope.moveToThisLoadSheet = function ( route ) {
                var loadSheet = route;
                var selectedStops = repositoryService.getStopsByIsSelectedOnMap( googleMapObj.markerList );
                var stop = _.last( loadSheet.Stops );
                if ( selectedStops.length > 0 ) {
                    mapService.moveStopsToOtherRoute( loadSheet, stop, selectedStops, true );
                }
            };

            scope.showOrHideAllRoute = function(){
                mappedRoutingService.checkIsShowOrHideAllRouteList();
            }
        }
    }

    buttonBar.$inject = [ "loading", "mappedRoutingService", "customEvent", "mapService", "dataService", "$window", "printService", "globalSetting", "timelineService", "moveStopDialog" ,"ngDialog","$q"];
    function buttonBar( loading, mappedRoutingService, customEvent, mapService, dataService, $window, printService, globalSetting, timelineService, moveStopDialog,ngDialog,$q) {
        var directive = {
            restrict: "E",
            replace: true,
            templateUrl: "MappedRouting/app/template/btnbar.html?" + new Date().getTime().toString(),
            link: linkFunc
        };

        return directive;

        function linkFunc( scope, el, attr, ctrl ) {
            scope.saveChangesHandler = function ( data ) {
                loading.show();
                mappedRoutingService.saveChanges( data ).then( function (result) {
                    if (!_.isNull (result) && !_.isUndefined(result) &&  result.MessageCode == 2){
                        alert(result.ErrorMessage);
                    }

                    dataService.getCustomerReceipt().then( function ( receiptJson ) {
                        globalSetting.customerReceipt = receiptJson.data.C;
                        // if ( data.isAutoRoute ) {
                            dataService.loadInitialJson().then( function ( r2 ) {
                                scope.$emit( customEvent.initJsonData, r2.data, data.isAutoRoute );
                            } );
                        // } else {
                        //     //todo bu xu yao zheng ge chong hua
                        //     scope.$emit( customEvent.initJsonData, data );
                        // }
                    } );

                }, function () {
                    loading.hide();
                } );
            };

            scope.reCalculateHandler = function ( data ) {
                loading.show();
                mapService.reCalculateRoutes( data.Routes );
            };

            // scope.showOrHideZeroInvoice = function (data) {
            //     loading.show();
            //
            //     // mappedRoutingService.buildStopMinimizeObjectByRoutes();
            //     //
            //     // mapService.showOrHideRouteByRouteList( globalSetting.rootJson.Routes );
            //     // mapService.showOrHideAllPolylineByIsDrawPolylineList();
            //
            //     var isSaveZeroInvoice = true;
            //     var tmpChangedFlag = mappedRoutingService.checkDataChanged();
            //     if (!_.isNull(tmpChangedFlag) && !_.isUndefined(tmpChangedFlag)) {
            //         isSaveZeroInvoice = confirm("This page has unsaved changes. Are you sure you want to reload?");
            //     }
            //
            //     if (isSaveZeroInvoice) {
            //         data.ShowZeroInvoices = data.ShowZeroInvoices == "1" ? "0" : "1";
            //         dataService.saveZeroInvoicesOption(data.ShowZeroInvoices).then(function (result) {
            //             window.onbeforeunload = '';
            //             $window.location.reload();
            //         });
            //     } else {
            //         loading.hide();
            //     }
            //
            // };

            scope.printSummaryHandler = function ( routes ) {
                printService.printSummaryDialog( routes );
            };

            scope.backOptimizerHandler = function () {
                $window.location.href = "LoadSheetOptimizer.aspx" + $window.location.search;
            };

            scope.printHandler = function () {
                printService.printOption()
            };

            scope.showTimelineHandler = function ( rootJson ) {
                rootJson.isShowTimeline = !rootJson.isShowTimeline;
                if ( rootJson.isShowTimeline ) {
                    timelineService.drawTimeline();
                }
            };
            scope.showLoadSheetAdd =function (rootJson) {
                ngDialog.open({
                    template:"MappedRouting/app/template/loadsheetadddialog.html",
                    lassName: "ngdialog-theme-default",
                    closeByEscape:false,
                    showClose: true,
                    closeByDocument: false,
                    controller:['$scope',function ($scope) {
                        $scope.route = "";
                        $scope.deliveryman = "";
                        $scope.routes = [];
                        $scope.tmpData = [];
                        $scope.deliverymen = [];
                        var Deliveryman = "";
                        var routeID="";
                        getRoute("",$scope);
                        getDeliverymen("", $scope);
                        $scope.typingRoutesHandler = function(type){
                            getRoute(type, $scope);
                        };
                        $scope.typingDeliverymenHandler = function(type){
                            getDeliverymen(type, $scope);
                        };
                        $scope.selectValue = function(value){
                            _.filter($scope.tmpData,function (item) {
                                if(item.display == value){
                                    routeID =item.value;
                                    console.log(routeID);
                                }
                            });
                        };
                        var IsAddLoadSheet = false,isNull = true;
                        $scope.LoadSheetAdd = function () {
                            var alertInfo = "The Following Fields are Required\n\n";
                            var date = $("#Date").attr("value");
                            if(!$scope.route){
                                alertInfo += "RouteID\n"
                            }
                            if(!$scope.deliveryman){
                                alertInfo += "Deliveryman"
                            }
                            if(!$scope.route||!$scope.deliveryman){
                                alert(alertInfo);
                            }else {
                                isNull = false;
                            }
                            if(routeID == ""){
                                return ;
                            }
                            function addSheet() {
                                dataService.addLoadSheet(routeID,$scope.deliveryman,date).then(function (result) {
                                    var href = $window.location.href;
                                    var str = href.match(/LoadSheetID_List=(\S*)&PicksheetID_List/)[1]+result.data+"|";
                                    var newhref =href.replace(/LoadSheetID_List=(\S*)&PicksheetID_List/,"LoadSheetID_List="+str+"&PicksheetID_List");
                                    window.location.href = newhref;
                                });
                            }
                            if(!IsAddLoadSheet && !isNull){
                                if(mappedRoutingService.checkDataChanged(true)){
                                    var truthBeTold = window.confirm("This page has unsaved changes.Are you sure want to continue?");
                                    if (truthBeTold) {
                                        window.removeEventListener("beforeunload",mappedRoutingService.beforeunloadHandler);
                                        addSheet();
                                        IsAddLoadSheet = true;
                                        ngDialog.close(ngDialog.id);
                                        loading.show();
                                    }
                                }else {
                                    window.removeEventListener("beforeunload",mappedRoutingService.beforeunloadHandler);
                                    addSheet();
                                    IsAddLoadSheet = true;
                                    ngDialog.close(ngDialog.id);
                                    loading.show();
                                }

                            }
                        };
                        $scope.dialogClose = function () {
                            ngDialog.close(ngDialog.id);
                        };
                        $scope.$on("ngDialog.opened",function () {
                            $("#inputs").append($("#inputDate"));
                            $("#inputDate").css("display","table-cell");
                            $window.document.querySelector(".ngdialog-overlay").addEventListener("click",function () {
                                $window.document.querySelector("#DateInputCalendar").style.display = "none";
                            },true);
                            $window.document.querySelector(".ngdialog-content").addEventListener("click",function () {
                                if($window.document.querySelector("#DateInputCalendar")){
                                    $window.document.querySelector("#DateInputCalendar").style.display = "none";
                                }
                            },true);
                        });
                        $scope.$on("ngDialog.closing", function () {
                            $("#inputDate").css("display","none");
                            $(document.body).append($("#inputDate"));
                        });
                    }]
                });
            };
            function getRoute(type,$scope) {
                dataService.loadRoutes(type).then(function (result) {
                            $scope.tmpData = result.data.result;
                            $scope.routes = [];
                            _.forEach($scope.tmpData,function(t){
                                $scope.routes.push( t.display );
                            });
                })
            }
            function getDeliverymen(type,$scope) {
                dataService.loadDeliverymans(type).then(function (result) {
                    $scope.tmpData = result.data.result;
                    $scope.deliverymen = [];
                    _.forEach($scope.tmpData,function(t){
                        $scope.deliverymen.push( t.display );
                    });
                })
            }

            el.bind( 'click', function () {
                moveStopDialog.remove();
            } );
        }
    }

    stopInfoPanelOnMap.$inject = [ "repositoryService", "mapService" ];
    function stopInfoPanelOnMap( repositoryService, mapService ) {
        var currentScope = {
            stopinfo: "="
        };

        var directive = {
            restrict: "EA",
            scope: currentScope,
            replace: true,
            templateUrl: "MappedRouting/app/template/stopinfopanelonmap.html?" + new Date().getTime().toString(),
            link: linkFunc
        };

        return directive;

        function linkFunc( scope, el, attr, ctrl ) {
            scope.editGeocodeHandler = function ( stopID, loadSheetID ) {
                var route = repositoryService.getLoadSheetByKey( loadSheetID );
                var stop = repositoryService.getStopByKey( stopID, route );
                mapService.manualGeocoding( stop, route );
            }
        }
    }

    function routeInfoPanelOnMap() {
        var currentScope = {
            routeinfo: "="
        };

        var directive = {
            restrict: "EA",
            scope: currentScope,
            replace: true,
            templateUrl: "MappedRouting/app/template/routeinfopanelonmap.html?" + new Date().getTime().toString(),
            link: linkFunc
        };

        return directive;

        function linkFunc( scope, el, attr, ctrl ) {
        }
    }

    myControlPanel.$inject = [ "$document", "_", "mapService", "googleMapObj", "dataService", "googleMapApi", "moveStopDialog" ];
    function myControlPanel( $document, _, mapService, googleMapObj, dataService, googleMapApi, moveStopDialog ) {
        var currentScope = {
            rootjson: "="
        };

        var directive = {
            restrict: "E",
            scope: currentScope,
            replace: true,
            templateUrl: "MappedRouting/app/template/toolsbar.html?" + new Date().getTime().toString(),
            link: linkFunc
        };

        return directive;

        function linkFunc( scope, element, attr, ctrl ) {
            var startX = 0, startY = 0, x = 0, y = 66;

            element.css( { "z-index": "100", "top": "66px" } );
            element.on( 'mousedown', function ( event ) {
                // Prevent default dragging of selected content
                event.preventDefault();
                startX = event.pageX - x;
                startY = event.pageY - y;
                $document.on( 'mousemove', mousemove );
                $document.on( 'mouseup', mouseup );
            } );

            function mousemove( event ) {
                y = event.pageY - startY;
                x = event.pageX - startX;
                element.css( {
                    top: y + 'px',
                    left: x + 'px'
                } );
            }

            function mouseup() {
                $document.off( 'mousemove', mousemove );
                $document.off( 'mouseup', mouseup );
            }

            scope.hideOrShowAllRouteList = function () {
                scope.rootjson.isShowAllRouteList = !scope.rootjson.isShowAllRouteList;
                _.forEach( scope.rootjson.Routes, function ( route ) {
                    route.isShowRouteList = scope.rootjson.isShowAllRouteList;
                } );
            };

            scope.hideOrShowAllPolylineList = function () {
                scope.rootjson.isDrawPolylineList = !scope.rootjson.isDrawPolylineList;
                mapService.showOrHideAllPolylineByIsDrawPolylineList();
                dataService.saveDirectionsOption( scope.rootjson.isDrawPolylineList );
            };

            scope.hideOrShowProductPickType = function ( fieldName, isShow ) {
                _.forEach( scope.rootjson.Routes, function ( route ) {
                    _.forEach( route.Stops, function ( stop ) {
                        var unmUnitObj = _.find( stop.numUnitFieldList, function ( numUnitObj ) {
                            return numUnitObj.field == fieldName;
                        } );
                        unmUnitObj.isShow = isShow;
                    } );
                } );


                var isIncludes = _.includes(scope.rootjson.showProductPickTypeSettingList,fieldName);
                if(!isIncludes && isShow){
                    scope.rootjson.showProductPickTypeSettingList.push(fieldName);
                }
                if(isIncludes && !isShow){
                    _.remove(scope.rootjson.showProductPickTypeSettingList,function(s){ return s == fieldName });
                }
                console.log(scope.rootjson.showProductPickTypeSettingList);
            };

            scope.selectStops = function () {
                googleMapObj.isCancelDrawPolygon = false;
                scope.rootjson.isClickSelectOrDrag = 2;
                googleMapObj.drawManager.setDrawingMode( googleMapApi.maps.drawing.OverlayType.POLYGON );
            };

            scope.selectStopsByRect = function () {
                scope.rootjson.isClickSelectOrDrag = 1;
                googleMapObj.drawManager.setDrawingMode( googleMapApi.maps.drawing.OverlayType.RECTANGLE );
            };

            scope.moveMap = function () {
                googleMapObj.isCancelDrawPolygon = true;
                scope.rootjson.isClickSelectOrDrag = 0;
                googleMapObj.drawManager.setDrawingMode( null );
            };

            scope.unselect = function () {
                mapService.clearSelectedMarkerOnMap( true );
            };

            scope.resetMapCenter = function () {
                mapService.setMapCenter( scope.rootjson.Routes );
            };

            element.bind( 'click', function () {
                moveStopDialog.remove();
            } );
        }
    }

    selectCheckbox.$inject = [ "_", "ngDialog" ];
    function selectCheckbox( _, ngDialog ) {
        var currentScope = {
            listelements: '=',
            dialogObj: '='
        };

        var directive = {
            restrict: "E",
            scope: currentScope,
            replace: true,
            templateUrl: "MappedRouting/app/template/checkbox.html?" + new Date().getTime().toString(),
            link: linkFunc
        };

        return directive;

        function linkFunc( scope, el, attr, ctrl ) {
            scope.masterChange = function () {
                _.forEach( scope.listelements, function ( cb ) {
                    cb.isSelected = scope.master;
                } );
            };

            scope.cbChange = function () {
                var hasUnselectCheckbox = true;
                var cbFalseSelect = _.find( scope.listelements, function ( cb ) {
                    return cb.isSelected === false;
                } );

                if ( !_.isUndefined( cbFalseSelect ) ) {
                    hasUnselectCheckbox = true;
                    scope.master = false;
                } else {
                    hasUnselectCheckbox = false;
                    scope.master = true;
                }
            };
            scope.cbChange();
        }
    }
})();
