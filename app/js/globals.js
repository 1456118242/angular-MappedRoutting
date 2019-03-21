/**
 * Created by zhangsen on 2015/9/30.
 */

(function () {
    "use strict";

    var globalSetting = {
        loadWayPointsEveryTime: 25,
        ajaxPageUrl: "ajax/GMMapRouteAjax.aspx",
        customerLocationSaveUrl : "ajax/Customer_BatchGeo.aspx",
        MilesConversionConstant: 1609.344,
        mapPointJson: null,
        deliverymanList: null,
        rootJson: null,
        customerReceipt: null,
        routeTypeActivityEvents: null,
        isSavedEventTimeOnLoadPage:false,
        linearUnitOfMeasure: linearUnitOfMeasure
    };

    var googleMapObj = {
        mapObj: null,
        overlay: null,
        markerList: [],
        polylineList: [],
        drawManager:null,
        isCancelDrawPolygon: false,
        normalSizeShapeCoords: [16,1.14,  21,2.1, 25,4.2, 28,7.4, 30,11.3,  30.6,15.74, 25.85,26.49, 21.02,31.89, 15.92,43.86, 10.92,31.89, 5.9,26.26, 1.4,15.74, 2.1,11.3, 4,7.4, 7.1,4.2, 11,2.1, 16,1.14],
        bigSizeShapeCoords: [24, 1.71, 31.5, 3.15, 37.5, 6.3, 42, 11.1, 45, 16.95, 45.96, 23.61, 38.775, 39.735, 31.53, 47.835, 23.88, 65.78, 16.38, 47.835, 8.85, 39.39, 2.09, 23.61, 3.15, 16.95, 6, 11.1, 10.64, 6.3, 16.5, 3.15, 24, 1.71]
    };

    var googleMapApi = {
        maps: null
    };

    var oldJson = {
        rootJson: null
    };

    var customEvent = {
        loadRootJsonCompleted: "loadRootJsonCompleted",
        showOrHideRouteOnMap: "showOrHideRouteOnMap",
        changeRouteColor: "changeRouteColor",
        reDrawMap: "reDrawMap",
        reCalculateAllRoutes: "reCalculateAllRoutes",
        initJsonData: "initJsonData",
        drawTimeline: "drawTimeline"
    };

    var reSequenceType = {
        closest_stop_first: 0,
        farthest_stop_first: 1,
        service_windows: 2,
        shortest_distance: 3
    };

    var ajaxRequestType = {
        json: 0,
        empty: 1,
        string: 2,
        ignore:3
    };

    var globalFunction = {
        convertParam: function ( obj ) {
                var query = '', name, value, fullSubName, subName, subValue, innerObj, i;

                for ( name in obj ) {
                    value = obj[ name ];

                    if ( value instanceof Array ) {
                        for ( i = 0; i < value.length; ++i ) {
                            subValue = value[ i ];
                            fullSubName = name + '[' + i + ']';
                            innerObj = {};
                            innerObj[ fullSubName ] = subValue;
                            query += param( innerObj ) + '&';
                        }
                    }
                    else if ( value instanceof Object ) {
                        for ( subName in value ) {
                            subValue = value[ subName ];
                            fullSubName = name + '[' + subName + ']';
                            innerObj = {};
                            innerObj[ fullSubName ] = subValue;
                            query += param( innerObj ) + '&';
                        }
                    }
                    else if ( value !== undefined && value !== null )
                        query += encodeURIComponent( name ) + '=' + encodeURIComponent( value ) + '&';
                }

                return query.length ? query.substr( 0, query.length - 1 ) : query;
        }
    };

    angular.module( "mappedRoutingApp.globals", [] )
        .constant( "globalSetting", globalSetting )
        .constant( "_", window._ )
        .constant( "globalFunction", globalFunction )
        .constant( "reSequenceType", reSequenceType )
        .constant( "ajaxRequestType", ajaxRequestType )
        .value( "customEvent", customEvent )
        .value( "googleMapApi", googleMapApi )
        .value( "oldJson", oldJson )
        .value( "googleMapObj", googleMapObj)
    ;
})();
