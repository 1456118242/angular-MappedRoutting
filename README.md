# Mapped Routing Application

## Application Directory Layout

	app/                					--> all of the files to be used in production
	  css/              					--> css files
	    font-awesome.css
		ngDialog.css						--> ngDialog style
		ngDialog-theme-default.css          --> ngDialog default theme
		MapRouting.less
		MapRouting.css
	  images/              					--> image files
	  fonts/								--> font files
	    FontAwesome.otf                     --> fontawesome fonts
	    fontawesome-webfont.eot
	    fontawesome-webfont.svg
	    fontawesome-webfont.ttf
	    fontawesome-webfont.woff
	    fontawesome-webfont.woff2
	  js/               					--> javascript files
		loading.js
	    controllers.js  					--> application controllers
	    directives.js   					--> application directives
	    filters.js     			    		--> custom angular filters
	    services.js     					--> custom angular services
	    animations.js   					--> animations
		globals.js							--> golbal settings and constant
		geocode-dialog.js                   --> geocode
		move-stop-dialog.js                 --> move stop popup
			lib/						    --> library
				angular.min.js				
				angular-google-maps.min.js
				angular-simple-logger.min.js
				angular-drag-and-drop-lists.min.js
				lodash.min.js
				canvg.js
				ngDialog.min.js
	  template/         					--> angular partial html templates
	    routelist.html
		checkbox.html
		choosemappointdialog.html
        exceptgeocode.html
		exceptionstoplist.html
		moveinvoicedialog.html
		printdialog.html
		printoptiondialog.html
		printsummarydialog.html
		routeinfopanelonmap.html
		sendmessagewindow.html
		stopinfopanelonmap.html
	    routetable.html
	    btnbar.html
		stoplist.html
		toolsbar.html
	  index.html       						--> app layout file (the main html template file of the app)
	  app.js          						--> the main application module

## Link

- [AngularJS](https://angularjs.org/)
- [Angular Google Maps](http://angular-ui.github.io/angular-google-maps/#!/)
- [Angular-simple-logger](https://github.com/nmccready/angular-simple-logger)
- [Lodash](https://lodash.com/)
- [canvg](https://github.com/gabelerner/canvg)
- [angular-drag-and-drop-lists](https://github.com/marceljuenemann/angular-drag-and-drop-lists)
- [ngDialog](https://github.com/likeastore/ngDialog)