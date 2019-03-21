/**
 * Created by 123zs on 2015/10/12.
 */

angular.module( "mappedRoutingApp.loading", [] )
    .provider( 'loading', function () {
        this.$get = [ '$document', '$injector', '$timeout',
            function ( $document, $injector, $timeout ) {
                var $animate,
                    incTimeout,
                    completeTimeout,
                    started = false,
                    status = 0,
                    autoIncrement = true,
                    includeBar = true,
                    startSize = 0.02;

                var loadingBarContainer = angular.element( '<div id="loading-bar"><div class="bar"></div></div>' );
                var loadingBar = loadingBarContainer.find( 'div' ).eq( 0 );
                var maskLayer = angular.element( '<div  id="mapped-routing-loading" class="mapped-routing-loading"></div>' );
                var $parentSelector = angular.element( '<div id="loadingbar-wrapper" class="loadingbar-wrapper"></div>' );
                var loadText = angular.element( '<span class="load-text">1%</span>' );
                maskLayer.append( $parentSelector );
                $parentSelector.append( loadText );

                function _start() {
                    if ( !$animate ) {
                        $animate = $injector.get( '$animate' );
                    }

                    $timeout.cancel( completeTimeout );

                    if ( started ) {
                        return;
                    }

                    started = true;

                    if ( includeBar ) {
                        $animate.enter( loadingBarContainer, $parentSelector.eq( 0 ) );//, angular.element( $parent[ 0 ] )
                        $animate.enter( loadText, $parentSelector.eq( 0 ) );
                    }

                    _set( startSize );
                }

                function _set( n ) {
                    if ( !started ) {
                        return;
                    }
                    var pct = (n * 100) + '%';
                    loadingBar.css( 'width', pct );
                    var tmpText = parseInt( (n * 100) ) + "%";
                    loadText.text( tmpText );
                    status = n;

                    if ( autoIncrement ) {
                        $timeout.cancel( incTimeout );
                        incTimeout = $timeout( function () {
                            _inc();
                        }, 250 );
                    }
                }

                function _inc() {
                    if ( _status() >= 1 ) {
                        return;
                    }

                    var rnd = 0;

                    // TODO: do this mathmatically instead of through conditions

                    var stat = _status();
                    if ( stat >= 0 && stat < 0.25 ) {
                        // Start out between 3 - 6% increments
                        rnd = (Math.random() * (5 - 3 + 1) + 3) / 100;
                    } else if ( stat >= 0.25 && stat < 0.65 ) {
                        // increment between 0 - 3%
                        rnd = (Math.random() * 3) / 100;
                    } else if ( stat >= 0.65 && stat < 0.75 ) {
                        // increment between 0 - 2%
                        rnd = (Math.random() * 2) / 100;
                    } else if ( stat >= 0.75 && stat < 0.99 ) {
                        // finally, increment it .5 %
                        rnd = 0.005;
                    } else {
                        // after 99%, don't increment:
                        rnd = 0;
                    }

                    var pct = _status() + rnd;
                    _set( pct );
                }

                function _status() {
                    return status;
                }

                function _completeAnimation() {
                    status = 0;
                    started = false;
                    angular.element( document.querySelectorAll("#mapped-routing-loading") ).remove();
                }

                function _complete() {
                    if ( !$animate ) {
                        $animate = $injector.get( '$animate' );
                    }
                    _set( 1 );

                    $timeout.cancel( completeTimeout );
                    completeTimeout = $timeout( function () {
                        var promise = $animate.leave( loadingBarContainer, _completeAnimation );
                        if ( promise && promise.then ) {
                            promise.then( _completeAnimation );
                        }
                    }, 500 );
                }

                var show = function () {
                    if ( document.querySelectorAll("#mapped-routing-loading").length == 0 ) {
                        angular.element( $document[ 0 ].body ).append( maskLayer );
                        _start();
                        _inc();
                        _set( 0.05 )
                    }
                };

                var hide = function () {
                    if ( document.querySelectorAll("#mapped-routing-loading").length > 0 ) {
                        _complete();
                    }
                };

                var methods = {
                    show: show,
                    hide: hide
                };

                return methods;
            } ];
    } );
