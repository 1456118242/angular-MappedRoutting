(function () {
    "use strict";

    // todo xiao lv wen ti
    angular
        .module( "mappedRoutingApp.filters", [ "mappedRoutingApp.services", "mappedRoutingApp.globals" ] )
        .filter( "calculateSumOfNumUnitByStops", calculateSumOfNumUnitByStops )
        .filter( "calculateSumOfTimeByStops", calculateSumOfTimeByStops )
        .filter( "calculateSumOfFieldByStops", calculateSumOfFieldByStops )
        .filter( "convertMeterToMiles", convertMeterToMiles )
        .filter( "calculateSumOfStop", calculateSumOfStop )
        .filter( "calculateSumOfNumUnitByStopsByRoutes", calculateSumOfNumUnitByStopsByRoutes )
        .filter( "calculateSumOfFieldByStopsByRoutes", calculateSumOfFieldByStopsByRoutes )
        .filter( "calculateSumOfTimeByStopsByRoutes", calculateSumOfTimeByStopsByRoutes )
        .filter( "formatRequenceOption", formatRequenceOption )
        .filter( "timeFormat", timeFormat )
        .filter( "dateFormat", dateFormat )
        .filter( "dateAndTimeFormat", dateAndTimeFormat )
        .filter("calculateSumOfPalletsByRoutes", calculateSumOfPalletsByRoutes)
        .filter("calculateSumOfRouteCost", calculateSumOfRouteCost)
    ;

    calculateSumOfNumUnitByStops.$inject = [ "_", "utilService", "$filter" ];
    function calculateSumOfNumUnitByStops( _, utilService, $filter ) {
        return calculateSumOfNumUnitByStops;

        function calculateSumOfNumUnitByStops( stops, field, isNotFormat ) {
            var result = 0;
            _.forEach( stops, function ( stop ) {
                var unmUnitObj = _.find( stop.numUnitFieldList, function ( numUnitObj ) {
                    return numUnitObj.field == field;
                } );

                result = result + Number( unmUnitObj.value );
            } );

            return isNotFormat ? result : $filter( "number" )( result );//utilService.formatNumber( result );
        }
    }

    calculateSumOfTimeByStops.$inject = [ "_", "utilService" ];
    function calculateSumOfTimeByStops( _, utilService ) {
        return calculateTotalTimeByStops;

        function calculateTotalTimeByStops( route, timeField, isNotFormat ) {
            var sum = 0;

            var sumOfTravelTime = function () {
                _.forEach( route.Stops, function ( stop ) {
                    sum += Number( stop.Duration );
                } );

                sum += Number( route.Duration );
            };

            var sumOfServiceTime = function () {
                _.forEach( route.Stops, function ( stop ) {
                    sum += (isNaN( stop.CustomerDuration ) ? 0.0 : stop.CustomerDuration) * ( route.Helper ? Number( route.helperPercent ) : 1 ) + stop.Fsm;
                } );

                sum = sum.toFixed( 2 );
            };

            switch ( timeField ) {
                case "travelTime":
                    sumOfTravelTime();
                    break;
                case "serviceTime":
                    sumOfServiceTime();
                    break;
                case "totalTime":
                    var showBreakTimeFlag = _.any( route.Stops, function( s ){ return s.isShowBreakTime});
                    if ( showBreakTimeFlag ){
                        var breakStartTime = utilService.convertTimeStrToNumber( route.BreakStartTime );
                        var breakEndTime = utilService.convertTimeStrToNumber( route.BreakEndTime );
                        var tmpDuration = breakEndTime - breakStartTime;
                        sum = sum + tmpDuration;
                    }

                    sumOfTravelTime();
                    sumOfServiceTime();

                    break;
            }

            return isNotFormat ? sum : utilService.convertTimeNumberToStr( sum );
        }

    }

    calculateSumOfFieldByStops.$inject = [ "_", "utilService", "$filter" ];
    function calculateSumOfFieldByStops( _, utilService, $filter ) {
        return calculateSumOfFieldByStops;

        function calculateSumOfFieldByStops( route, field, isNotFormat ) {
            var sum = 0;

            switch ( field ) {
                case "distance":
                    _.forEach( route.Stops, function ( stop ) {
                        sum += Number( stop.Distance );
                    } );

                    sum += Number( route.Distance );

                    sum = utilService.convertMeterToMiles( sum );

                    if ( isNaN( sum ) ) {
                        sum = 0;
                    }

                    break;
                case "weight":
                    _.forEach( route.Stops, function ( stop ) {
                        sum += Number( stop.Weight );
                    } );
                    break;
                case "receipt":
                    _.forEach( route.Stops, function ( stop ) {
                        sum += stop.CustomerReceipt;
                    } );
                    break;

                case "routeCost":
                    sum = (route.CostPerMile * route.sumOfDistance).toFixed(2);
                    break;
            }

            return isNotFormat ? Number( sum.toFixed( 2 ) ) : $filter( "number" )( sum );//utilService.formatNumber( sum );
        }
    }

    convertMeterToMiles.$inject = [ "utilService" ];
    function convertMeterToMiles( utilService ) {
        return convertMeterToMiles;

        function convertMeterToMiles( value ) {
            return utilService.convertMeterToMiles( value );
        }
    }

    calculateSumOfStop.$inject = [ "_" ];
    function calculateSumOfStop( _ ) {
        return calculateSumOfStop;

        function calculateSumOfStop( routes ) {
            var sum = 0;

            _.forEach( routes, function ( route ) {
                sum += route.Stops.length;
            } );

            return sum;
        }
    }

    calculateSumOfNumUnitByStopsByRoutes.$inject = [ "_", "$filter", "utilService" ];
    function calculateSumOfNumUnitByStopsByRoutes( _, $filter, utilService ) {
        return calculateSumOfNumUnitByStopsByRoutes;

        function calculateSumOfNumUnitByStopsByRoutes( routes, field ) {
            var result = 0;
            _.forEach( routes, function ( route ) {
                result = result + Number( $filter( 'calculateSumOfNumUnitByStops' )( route.Stops, field, true ) );
            } );

            return $filter( "number" )( result ); //utilService.formatNumber( result );
        }
    }

    calculateSumOfFieldByStopsByRoutes.$inject = [ "_", "$filter", "utilService" ];
    function calculateSumOfFieldByStopsByRoutes( _, $filter, utilService ) {
        return calculateSumOfFieldByStopsByRoutes;

        function calculateSumOfFieldByStopsByRoutes( routes, field ) {
            var result = 0;
            _.forEach( routes, function ( route ) {
                // todo  yao shan chu de dai ma
                result = result + Number( $filter( 'calculateSumOfFieldByStops' )( route, field, true ) );
            } );

            return $filter( "number" )( result ); //utilService.formatNumber( result );
        }
    }

    calculateSumOfTimeByStopsByRoutes.$inject = [ "_", "$filter", "utilService" ];
    function calculateSumOfTimeByStopsByRoutes( _, $filter, utilService ) {
        return calculateSumOfTimeByStopsByRoutes;

        function calculateSumOfTimeByStopsByRoutes( routes, field, hpercent ) {
            var result = 0;
            _.forEach( routes, function ( route ) {
                result = result + Number( $filter( 'calculateSumOfTimeByStops' )( route, field, true ) );
            } );

            return utilService.convertTimeNumberToStr( result );
        }
    }

    function formatRequenceOption() {
        return formatRequenceOption;
        function formatRequenceOption( flag, value ) {
            return flag == value ? "*" : "";
        }
    }

    timeFormat.$inject = [ "globalSetting", "_" ];
    function timeFormat( globalSetting, _ ) {
        return function ( timeString ) {
            var timeFormatedString = "";
            if ( globalSetting.rootJson.TimeFormat.toString() == "2" ) {//24hour
                if ( timeString.indexOf( ":" ) > -1 ) { //4:30 PM
                    var hourNum = Number( timeString.split( ":" )[ 0 ] );
                    var tmpStr = timeString.split( ":" )[ 1 ];
                    var minuteNum = tmpStr.split( " " )[ 0 ];
                    var amPmStr = tmpStr.split( " " )[ 1 ];
                    if ( !_.isUndefined( amPmStr ) && amPmStr.toUpperCase() == "PM" && hourNum != 12 ) {
                        hourNum += 12;
                    }
                    timeFormatedString = hourNum + ":" + minuteNum;
                } else {//4 PM
                    var tmpStr = timeString.split( " " );
                    var amPmStr = tmpStr[ 1 ];
                    var hourNum = Number( tmpStr[ 0 ] );
                    if ( !_.isUndefined( amPmStr ) && amPmStr.toUpperCase() == "PM" && hourNum != 12 ) {
                        hourNum += 12;
                    }

                    timeFormatedString = hourNum.toString();
                }

                return timeFormatedString;
            } else {
                return timeString;
            }

        };
    }

    dateFormat.$inject = [ "globalSetting" ];
    function dateFormat( globalSetting ) {
        return function ( dateString ) {
            var dateFormatedString = "";
            try {
                var dateStringSplitList = dateString.split( "/" );
                var yearString = dateStringSplitList[ 0 ];
                if ( yearString.length == 4 ) {
                    var monthString = dateStringSplitList[ 1 ];
                    var dayString = dateStringSplitList[ 2 ];
                    switch ( globalSetting.rootJson.DateFormat.toString() ) {
                        case "1":
                            dateFormatedString = monthString + "/" + dayString + "/" + yearString;
                            break;
                        case "2":
                            dateFormatedString = yearString + "-" + monthString + "-" + dayString;
                            break;
                        case "3":
                            dateFormatedString = dayString + "." + monthString + "." + yearString;
                            break;
                        default :
                            dateFormatedString = monthString + "/" + dayString + "/" + yearString;
                    }
                    return dateFormatedString;
                } else {
                    return dateString;
                }
            } catch ( e ) {
                return dateString;
            }
        };
    }

    dateAndTimeFormat.$inject = [ "globalSetting" ];
    function dateAndTimeFormat( globalSetting ) {
        return function ( dateString ) {
            var date = new Date();
            var yearString = date.getFullYear();
            var monthString = Number( date.getMonth() ) + 1;
            var dayString = date.getDate();
            var hourString = date.getHours();
            var minuteString = date.getMinutes();
            var dateFormatedString = "";
            var amPmString = "";
            switch ( globalSetting.rootJson.DateFormat.toString() ) {
                case "1":
                    dateFormatedString = monthString + "/" + dayString + "/" + yearString;
                    break;
                case "2":
                    dateFormatedString = yearString + "-" + monthString + "-" + dayString;
                    break;
                case "3":
                    dateFormatedString = dayString + "." + monthString + "." + yearString;
                    break;
                default :
                    dateFormatedString = monthString + "/" + dayString + "/" + yearString;
            }
            switch ( globalSetting.rootJson.TimeFormat.toString() ) {
                case "1":
                    if ( Number( hourString ) >= 12 ) {
                        amPmString = "PM";
                        if ( Number( hourString ) > 12 ) {
                            hourString = Number( hourString ) - 12;
                        }
                    } else {
                        amPmString = "AM";
                    }
                    dateFormatedString += " " + hourString + ":" + minuteString + amPmString;
                    break;
                case "2":
                    dateFormatedString += " " + hourString + ":" + minuteString;
                    break;
            }
            return dateFormatedString;
        }
    }

    calculateSumOfPalletsByRoutes.$inject = [ "_", "$filter" ];
    function calculateSumOfPalletsByRoutes( _, $filter ) {
        return calculateSumOfPalletsByRoutes;

        function calculateSumOfPalletsByRoutes( routes ) {
            var result = 0;
            _.forEach( routes, function ( r ) {
                result = result + Number( r.PalletCount );
            } );

            return $filter( "number" )( result );
        }
    }

    calculateSumOfRouteCost.$inject = ["_", "$filter"];
    function calculateSumOfRouteCost(_, $filter) {
        return calculateSumOfRouteCost;

        function calculateSumOfRouteCost(routes) {
            var result = 0;
            _.forEach(routes, function (r) {
                result = result + Number(r.routeCost);
            });

            result = result.toFixed(2);

            return $filter("number")(result);
        }
    }

})();
