/**
 * Created by sunxinfei on 2015/12/9.
 */

angular.module( "mappedRoutingApp.geocodeDialog", [] )
    .provider( 'geocodeDialog', function () {
        this.$get = [ '$document', 'ngDialog', "googleMapApi", "mapHelperService", "_",
            function ( $document, ngDialog, googleMapApi, mapHelperService, _ ) {
                var googleMap;
                var markerObj;
                var openDialog = function ( inputValue, senderElement, saveHandler, latLngObj ) {
                    var geoNgDialog = ngDialog.open( {
                        template: 'MappedRouting/app/template/exceptgeocode.html?' + new Date().getTime().toString(),
                        closeByEscape: false,
                        closeByDocument: false,
                        className: "ngdialog-theme-default ngdialog-theme-exception-geocode",
                        controller: [ '$scope', function ( $scope ) {
                            $scope.inputValue = inputValue;

                            $scope.$on( 'ngDialog.opened', function ( event, $dialog ) {
                                googleMap = new googleMapApi.maps.Map( $document[ 0 ].getElementById( "geocede-map" ), {
                                    center: { lat: 40.1451, lng: -99.6680 },
                                    zoom: 13,
                                    mapTypeId: google.maps.MapTypeId.ROADMAP
                                } );
                                markerObj = new googleMapApi.maps.Marker( {
                                    position: { lat: 40.1451, lng: -99.6680 },
                                    map: googleMap,
                                    draggable: true
                                } );

                                if (  _.isUndefined( latLngObj ) ){
                                    $scope.codeAddress( inputValue );
                                }else{
                                    markerObj.setPosition( latLngObj );
                                    googleMap.panTo( latLngObj );
                                }

                            } );

                            $scope.codeAddress = function ( address ) {
                                var address = address || $document[ 0 ].getElementById( "pac-input" ).value;
                                mapHelperService.codeAddress( address ).then( successCallback, failCallback );
                                function successCallback( result ) {
                                    var markerPosition = { lat: result.latlng.lat, lng: result.latlng.lng };
                                    markerObj.setPosition( markerPosition );
                                    googleMap.panTo( markerPosition );
                                }

                                function failCallback( result ) {
                                    alert( result.msg );
                                }
                            };

                            $scope.saveLatLng = function () {
                                var pointLat = markerObj.getPosition().lat().toString();
                                var pointLng = markerObj.getPosition().lng().toString();
                                var latlng = {
                                    lat: pointLat,
                                    lng: pointLng
                                };
                                if ( _.isFunction( saveHandler ) ) {
                                    saveHandler( latlng );
                                }
                                if ( !_.isUndefined( senderElement ) ) {
                                    senderElement.disabled = true;
                                }
                                ngDialog.close( geoNgDialog.id );
                            };
                        } ]
                    } );
                };

                var methods = {
                    openDialog: openDialog
                };

                return methods;
            } ];
    } );