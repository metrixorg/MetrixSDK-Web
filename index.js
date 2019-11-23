(function () {
    'use strict';
  
    
var _metrix = new MetrixAnalytics({
	appId: 'zozazzcrpzaptaa',
	uniqueDeviceId: 'your android ad id',
	trackerToken: 'rebhyh',
	geoInfo: {
		country: "Iran",
		admin_area: "Tehran Province",
		sub_admin_area: "Tehran",
		latitude: 35.7658549,
		longitude: 51.4236146
	}
});
    // Internal (demo) stuff, don't touch!
    var _trackEventBtn = document.querySelector('#track-event');

    _trackEventBtn.addEventListener('click', handleTrackEvent);
  
    function handleTrackEvent() {
  
      _metrix.sendCustomTrack("agout");


  
    }
    var _trackRevenueBtn = document.querySelector('#track-revenue');

    _trackRevenueBtn.addEventListener('click', handleTrackRevenue);
  
    function handleTrackRevenue() {
  
        _metrix.sendRevenue("jkfva", 1000, "IRR");


  
    }
  
  })();