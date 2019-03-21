/**
 * Created by 123zs on 2015/10/12.
 */

angular.module("mappedRoutingApp.loading",[])
    .provider('loading', function(){
        this.$get = ['$document',
            function ($document) {
                var template = angular.element('<div  id="mapped-routing-loading"  style="position: fixed; z-index:9999999; background: rgba(0, 0, 0, 0.4);top: 0;right: 0;bottom: 0;left: 0;">');
                template.append('<div class="spinner"></div>')
                var showLoading = function(){
                    if (angular.element("#mapped-routing-loading" ).length == 0) {
                        angular.element( $document[ 0 ].body ).append( template );
                    }
                };

                var hideLoading = function(){
                    var lodingDiv = angular.element("#mapped-routing-loading");
                    if(lodingDiv.length > 0){
                        lodingDiv.remove();
                    }
                };

                var methods = {
                    showLoading:showLoading,
                    hideLoading:hideLoading
                };

                return methods;
            }];
    });