/**
 * Created by zhangsen on 2015/11/9.
 */

angular.module( "mappedRoutingApp.moveStopDialog", [] )
    .provider( 'moveStopDialog', function () {
        this.$get = [ '$document',
            function ( $document ) {
                var moveStopDiv = angular.element( '<div id="move-stop-div-on-map" >' );
                var btn = angular.element( '<a style="padding-left: 3px;cursor:pointer;">Place selected stops after this stop in sequence</a>' );
                btn[ 0 ].onclick = function () {
                    methods.clickHandler();
                };

                moveStopDiv.append( btn );

                var setPosition = function ( position ) {
                    var btnGroupHeight = $document[ 0 ].getElementById( "btn-group" ).clientHeight;
                    var routeListHeight = $document[ 0 ].getElementById( "route-list" ).clientHeight;
                    var offsetTopPixel = routeListHeight + btnGroupHeight;

                    if ( $document[ 0 ].querySelectorAll( "#move-stop-div-on-map" ).length == 0 ) {
                        angular.element( $document[ 0 ].body ).append( moveStopDiv );
                    }
                    var left = position.x;
                    var top = position.y + offsetTopPixel || 0;
                    $document[ 0 ].getElementById( "move-stop-div-on-map" ).style.left = left.toString() + 'px';
                    $document[ 0 ].getElementById( "move-stop-div-on-map" ).style.top = top.toString() + 'px';
                };

                var remove = function () {
                    var tmpDiv = $document[ 0 ].querySelectorAll( "#move-stop-div-on-map" );
                    if ( tmpDiv.length > 0 ) {
                        angular.element( tmpDiv ).remove();
                    }
                };

                var methods = {
                    setPosition: setPosition,
                    remove: remove,
                    clickHandler: function () {
                    }
                };

                return methods;
            } ];
    } );