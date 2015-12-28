// ignore this errormessage:
/*global requirejs cprequire cpdefine chilipeppr THREE*/

requirejs.config({
   paths: {
       Three: 'http://threejs.org/build/three.min'
   },
   shim: {
   }
});

// Test this element. This code is auto-removed by the chilipeppr.load()
cprequire_test(["inline:org-calibrate-widget"], function (calibrate) {
    console.log("test running of " + calibrate.id);
    calibrate.init();

    /*
    calibrate.endmillDiameter    = 3.175;
    calibrate.probeDiameter      = 15;
    calibrate.zdeep              = 0.5;

    calibrate.onCalibrate();

    calibrate.endmillDiameter    = null;
    calibrate.probeDiameter      = null;
    calibrate.zdeep              = null;
    */

    
} /*end_test*/ );


cpdefine("inline:org-calibrate-widget", ["chilipeppr_ready"], function () {
    
    return {
        id: "org-calibrate-widget",
        url: "http://fiddle.jshell.net/xpix/u65oq7up/show/light/",
        fiddleurl: "http://jsfiddle.net/xpix/u65oq7up/",
        name: "Widget / Calibrate",
        desc: "Calibrate the machine via metal ring and touch from every side.",
        options: null,
        calibrate: null,
        gcodeCnt: 0,
        originalSteps: {},
        mySceneGroup: null,
        threedobjects : [],
        publish: {
        },
        subscribe: {},
        foreignPublish: {
        },
        foreignSubscribe: {
        },
        isInitted: false, // keep track of our one-time init
        init: function () {

            this.forkSetup();

            var that = this;
            $('#org-calibrate-widget .calibrate-run').click(function(evt) {
                that.onCalibrate(evt);
            });
            $('#org-calibrate-widget .calibrate-display-probe').unbind('click').bind('click', function(evt) {
                if(Object.keys(that.threedobjects).length == 0){
                    that.drawProbe();
                }
                else{
                    that.removeAll3DObjects();
                }
            });

            $('#org-calibrate-widget .hidebody').click(function(evt) {
                console.log("hide/unhide body");
                if ($('#org-calibrate-widget .panel-body').hasClass('hidden')) {
                    // it's hidden, unhide
                    that.showBody(evt);
                } else {
                    // hide
                    that.hideBody(evt);
                }
            });
            this.setupUiFromLocalStorage();

            this.isInitted = true; // keep track of our one-time init

            console.log(this.name + " done loading.");
        },
        isRunning : false,
        getUserData: function(){
            this.probeDiameter   = parseFloat($('#org-calibrate-widget').find('.probeOD').val());
            this.probeDeep       = parseFloat($('#org-calibrate-widget').find('.probeHOD').val());
            this.endmillDiameter = parseFloat($('#org-calibrate-widget').find('.emillOD').val());
            this.zdeep           = parseFloat($('#org-calibrate-widget-body').find('.zdeep').val());
        },
        onCalibrate : function(evt){
            this.getUserData();

            var endmillDiameter = this.endmillDiameter;
            var zheight = endmillDiameter;
            var that = this;

            if (this.isRunning) {
                // we need to stop
                // swap button to stop
                $('#org-calibrate-widget .calibrate-run').text("In process");
                $('#org-calibrate-widget-probeWidth').html('0.000');
                $('#org-calibrate-widget-probeHeight').html('0.000');
                $('#org-calibrate-widget-probeWidth-result').html(this.originalSteps.X + ' steps/mm');
                $('#org-calibrate-widget-probeHeight-result').html(this.originalSteps.Y + ' steps/mm');
                this.isRunning = false;

            } else {
                this.isRunning = true;

                // Check steps for mm
                this.sendGcode('$$'); 
                
    
                this.sendGcode('F1000'); 
                this.sendGcode('G49 G21 G90'); // use mm and abs coordinates & clear offsets
                this.sendGcode('G92 Z0 Y0 X0'); // Zero out all coordinates

                // wait for z-probe and handle the result in probeResponse()
                this.sendGcodeWait('G38.2 F50 Z-100', function(){
                    // safty height
                    that.sendGcode('G0 Z' + endmillDiameter); 

                    // generate the touche's move for Probe's
                    that.setProbe('X_right');
                    that.setProbe('X_left');
                    that.setProbe('Y_top');
                    that.setProbe('Y_bottom');
                }); 
            }
        },
        setProbe : function(active){
            var probeDiameter   =  this.probeDiameter;
            var probeDeep     =  this.probeDeep || 0;
            var endmillDiameter =  this.endmillDiameter;
            var zdeep           =  this.zdeep;

            var offset =  (probeDiameter/2) + (endmillDiameter*2); // maybe more, we need some for user tolerance :)
            var offsetHeight = ( probeDeep ? (probeDeep/2) + (endmillDiameter*2)  : offset);

            // generate the touch move's for every side
            var axis = null;
            if(active == 'X_right'){
               axis = 'X-100';
               this.sendGcode('G0 Y0 X' + offset); 
            }
            if(active == 'X_left'){
               axis = 'X100';
               this.sendGcode('G0 Y0 X' + (0-offset)); 
            }
            if(active == 'Y_top'){
               axis = 'Y-100';
               this.sendGcode('G0 X0 Y' + offsetHeight); 
            }
            if(active == 'Y_bottom'){
               axis = 'Y100';
               this.sendGcode('G0 X0 Y' + (0-offsetHeight)); 
            }
            this.sendGcode('G0 Z' + zdeep ); 
            this.sendGcode('G38.2 F50 ' + axis); 
            this.sendGcode('G0 Z' + endmillDiameter); 
        },
        probeResponse: function(data) {
            console.log('Calibrate: Data for ', data);

            if(Math.abs(data.x) < 0.5 && Math.abs(data.x) < 0.5 && data.z){
                var gcode = "G43.1 Z" + (data.z).toString() + "\n";
                chilipeppr.publish("/com-chilipeppr-widget-serialport/jsonSend", {Id: 'calibrate_' + this.gcodeCnt++, D: gcode});
            }

            // Read the (machine) position and calculate the real distance between 2 probes
            if(data.x > 0.5 && Math.abs(data.y) < 0.5){ // X_right
               // display the calculated difference between center and touch
                this.probeWith = data.x;
                $('#org-calibrate-widget-probeWidth').html(this.probeWith.toFixed(4));
            }
            if(data.x < -0.5 && Math.abs(data.y) < 0.5){ // X_left
               // display the calculated width
                this.probeWith += Math.abs(data.x);
                $('#org-calibrate-widget-probeWidth').html(this.probeWith.toFixed(4) - this.endmillDiameter);
            }
            if(Math.abs(data.x) < 0.5 && data.y > 0.5){ // Y_top
               // display the calculated difference between center and touch
                this.probeHeigth = data.y;
                $('#org-calibrate-widget-probeHeight').html(this.probeHeigth.toFixed(4));
            }
            if(Math.abs(data.x) < 0.5 && data.y < -0.5){ // Y_bottom
               // display the calculated height
                this.probeHeigth += Math.abs(data.y);
                $('#org-calibrate-widget-probeHeight').html(this.probeHeigth.toFixed(4) - this.endmillDiameter);
                
                this.calculate(this.probeWith, this.probeHeigth);
            }
        },
        calculate: function(width, height){
            console.log('Calibrate: This', this);

            // Calibrate X Axis
            var x_orignalSteps = this.originalSteps.X;
            var x_orignalDistance = this.probeDiameter;
            var x_measuredDistance = width - this.endmillDiameter;
            var x_micron = (x_measuredDistance / (x_orignalSteps * x_orignalDistance));
            var x_realSteps = (x_orignalDistance / x_micron) / x_orignalDistance;
            $('#org-calibrate-widget-probeWith').html(x_measuredDistance.toFixed(4));

            console.log('Calibrate: Calculate with for X', x_orignalDistance, x_orignalSteps, x_measuredDistance, x_micron, x_realSteps);

            // Calibrate Y Axis
            var y_orignalSteps = this.originalSteps.Y;
            var y_orignalDistance = (this.probeDeep ?  this.probeDeep : this.probeDiameter);
            var y_measuredDistance = height - this.endmillDiameter;
            var y_micron = (y_measuredDistance / (y_orignalSteps * y_orignalDistance));
            var y_realSteps = (y_orignalDistance / y_micron) / y_orignalDistance;
            $('#org-calibrate-widget-probeHeight').html(y_measuredDistance.toFixed(4));

            console.log('Calibrate: Calculate with for Y', y_orignalDistance, y_orignalSteps, y_measuredDistance, y_micron, y_realSteps);

            
            var message = 'Old steps/mm for X Axis: ' + x_orignalSteps + '<br>' +
                'Calibrate to ' + x_realSteps.toFixed(4) + ' steps/mm' + '<br>' +
                'Old steps/mm for Y Axis: ' + y_orignalSteps + '<br>' +
                'Calibrate to ' + y_realSteps.toFixed(4) + ' steps/mm' + 
                'Now you can set this result in your serial console:' + '<br>' +
                '<code>' +
                    '$101=' + x_realSteps.toFixed(4) + ' (x, steps/mm)' + '<br>' + 
                    '$102=' + y_realSteps.toFixed(4) + ' (y, steps/mm)' + 
                '</code>';

            $('#org-calibrate-widget-probeWidth-result').html(x_realSteps.toFixed(4) + ' steps/mm');
            $('#org-calibrate-widget-probeHeight-result').html(y_realSteps.toFixed(4) + ' steps/mm');
            chilipeppr.publish("/com-chilipeppr-elem-flashmsg/flashmsg", "Calibrate result ...", message, 15 * 1000);

            this.calibrateComplete();
        },
        calibrateComplete: function(){
            // set Button back                
            $('#org-calibrate-widget .calibrate-run').text("Calibrate");
        },
        sendGcode : function(gcode){
            chilipeppr.publish("/com-chilipeppr-widget-serialport/jsonSend", {Id: 'calibrate_' + this.gcodeCnt++, D: gcode});
        },
        sendGcodeWait : function(gcode, callback){
            if(gcode)
                this.sendGcode(gcode);

            // wait for idle
            var that = this;
            setTimeout(function() {
                if(that.idle != true){
                    that.sendGcodeWait(null, callback);
                }
                else{
                    callback();
                }
            }, 1000);
        },
        receiveLine : function(data){
            if(! data.dataline.match(/\$10/))
                return;
            if(data.dataline.match(/\$100/)){
                var found = data.dataline.match(/(\d+\.\d+)/);
                if(found)
                    this.originalSteps.X = parseFloat(found[0]);
            }
            if(data.dataline.match(/\$101/)){
                var found = data.dataline.match(/(\d+\.\d+)/);
                if(found)
                    this.originalSteps.Y = parseFloat(found[0]);
            }
            if(data.dataline.match(/\$102/)){
                var found = data.dataline.match(/(\d+\.\d+)/);
                if(found)
                    this.originalSteps.Z = parseFloat(found[0]);
            }
            console.log('Calibrate: originalsteps: ', this.originalSteps);
        },


        /* Standard functions ------------------------- */
        setupUiFromLocalStorage: function() {
            this.getUserData();

            // read vals from cookies
            var options = localStorage.getItem('org-calibrate-widget-options');
            
            if (options) {
                options = $.parseJSON(options);
                console.log("just evaled options: ", options);
            } else {
                options = {
                    showBody: true,
                };
            }

            this.options = options;
            console.log("options:", options);

            var el = $('#org-calibrate-widget');
            var that = this;
            el.find('.probeOD').change(function(evt) {
                that.drawProbe();
            });
            el.find('.probeHOD').change(function(evt) {
                that.drawProbe();
            });

            chilipeppr.unsubscribe("/com-chilipeppr-interface-cnccontroller/proberesponse", this, this.probeResponse);
            chilipeppr.unsubscribe("/com-chilipeppr-widget-serialport/recvline", this, this.receiveLine);
            chilipeppr.unsubscribe("/com-chilipeppr-interface-cnccontroller/status", this, this.onChiliPepprStateChanged);


            chilipeppr.subscribe("/com-chilipeppr-interface-cnccontroller/proberesponse", this, this.probeResponse);
            chilipeppr.subscribe("/com-chilipeppr-widget-serialport/recvline", this, this.receiveLine);
            chilipeppr.subscribe("/com-chilipeppr-interface-cnccontroller/status", this, this.onChiliPepprStateChanged);

            // show/hide body
            if (options.showBody) {
                this.showBody();
            } else {
                this.hideBody();
            }
        },
        onChiliPepprStateChanged: function(state){
            console.log("Calibrate: State: ", state);
            this.idle = (state == "Idle");
        },
        drawProbe: function (){
            this.getUserData();
            // get 3dcanvas
            this.get3dObj();

            this.removeAll3DObjects();
            
            // create probe probe3d
            var radius = this.probeDiameter/2;
            var geometry = new THREE.CylinderGeometry( radius, radius, 2, 36 );
            if( this.probeDeep ){
                geometry = new THREE.BoxGeometry( this.probeDiameter, 2, this.probeDeep, 1, 1, 5 );
            }
            var material = new THREE.MeshPhongMaterial( {
                color: 0xaaaaaa, 
                shading: THREE.FlatShading,
                polygonOffset: true,
                polygonOffsetFactor: 1, // positive value pushes polygon further away
                polygonOffsetUnits: 1
            } );
            var probe3d = new THREE.Mesh( geometry, material );
            probe3d.rotateX(Math.PI / 2); // 90 degrees
            probe3d.position.set( 0, 0, -1 );
        
            // wireframe
            var helper = new THREE.EdgesHelper( probe3d, 0xffffff );
            helper.material.linewidth = 1;
            this.sceneAdd( probe3d );
            this.sceneAdd( helper );
            this.threedobjects.push(probe3d, helper);
        },
        get3dObj: function () {
            chilipeppr.subscribe("/com-chilipeppr-widget-3dviewer/recv3dObject", this, this.get3dObjCallback);
            chilipeppr.publish("/com-chilipeppr-widget-3dviewer/request3dObject", "");
            chilipeppr.unsubscribe("/com-chilipeppr-widget-3dviewer/recv3dObject", this.get3dObjCallback);
        },
        get3dObjCallback: function (data, meta) {
            console.log("got 3d obj:", data, meta);
            this.obj3d = data;
            this.obj3dmeta = meta;
        },
        sceneAdd: function (obj) {
            // so that we have it stay while the Gcode 3D Viewer still functions
            if (this.mySceneGroup == null) {
                this.mySceneGroup = new THREE.Group();
                this.obj3d.add(this.mySceneGroup);
            }
            this.mySceneGroup.add(obj);
            this.obj3dmeta.widget.wakeAnimate();
        },
        removeAll3DObjects: function(){
            // remove all own 3d objects
            var that = this;
            this.threedobjects.forEach(function(obj){
                that.sceneRemove(obj);                
            });
            this.threedobjects = [];
        },
        sceneRemove: function (obj) {
            if (this.mySceneGroup != null)
                this.mySceneGroup.remove(obj);
            this.obj3dmeta.widget.wakeAnimate();
        },
        showBody: function(evt) {
            $('#org-calibrate-widget .panel-body').removeClass('hidden');
            $('#org-calibrate-widget .panel-footer').removeClass('hidden');
            $('#org-calibrate-widget .hidebody span').addClass('glyphicon-chevron-up');
            $('#org-calibrate-widget .hidebody span').removeClass('glyphicon-chevron-down');
            if (!(evt == null)) {
                this.options.showBody = true;
                this.saveOptionsLocalStorage();
            }
        },
        hideBody: function(evt) {
            $('#org-calibrate-widget .panel-body').addClass('hidden');
            $('#org-calibrate-widget .panel-footer').addClass('hidden');
            $('#org-calibrate-widget .hidebody span').removeClass('glyphicon-chevron-up');
            $('#org-calibrate-widget .hidebody span').addClass('glyphicon-chevron-down');
            if (!(evt == null)) {
                this.options.showBody = false;
                this.saveOptionsLocalStorage();
            }
        },
        saveOptionsLocalStorage: function() {
            var options = this.options;
            var optionsStr = JSON.stringify(options);
            console.log("saving options:", options, "json.stringify:", optionsStr);
            localStorage.setItem('org-calibrate-widget-options', optionsStr);
        },
        forkSetup: function () {
            var topCssSelector = '#' + this.id;
            
            $(topCssSelector + ' .panel-title').popover({
                title: this.name,
                content: this.desc,
                html: true,
                delay: 200,
                animation: true,
                trigger: 'hover',
                placement: 'auto'
            });
            
            var that = this;
            chilipeppr.load("http://fiddle.jshell.net/chilipeppr/zMbL9/show/light/", function () {
                require(['inline:com-chilipeppr-elem-pubsubviewer'], function (pubsubviewer) {
                    pubsubviewer.attachTo($(topCssSelector + ' .panel-heading .dropdown .dropdown-menu'), that);
                });
            });
            
        },
    }
});