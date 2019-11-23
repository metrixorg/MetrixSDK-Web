if (typeof MetrixAnalytics === 'undefined') {
	/**
	 * Constructs a new MetrixAnalytics Analytics tracker.
	 *
	 * @constructor MetrixAnalytics
	 *
	 * @param options.tracker   The tracker to use for tracking events.
	 *                          Must be: function(collection, event).
	 *
	 */
	var MetrixAnalytics = function(options) {

		if (!(this instanceof MetrixAnalytics)) return new MetrixAnalytics(config);

		this.setChartId(options.appId);

		options = options || {};
		this.options = {
			trackPageView: true
		};

		this.initialize(options);
	};

	(function(MetrixAnalytics) {
		/*
		 url                   : url of the server.
		 timeOut               : time out of sending request.
		 queueUnloadTime       : Queue unload repeatlly in this time.
		 sessionExpireTime     : session get expire after this time.
		 queueCapacity         : queue get unload after this capacity.
		 localQueueCapacity    : maximum capacity of main queue.
		 */
		var metrixSettingAndMonitoring = {

			urlEvents: 'https://analytics.metrix.ir/v2/events', //https://analytics.metrix.ir/v2/
			urlInit: 'https://analytics.metrix.ir/v2/init',
			timeOut: 5000,
			queueUnloadTime: 10000,
			sessionExpireTime: 60000,
			queueCapacity: 15,
			localQueueCapacity: 200,
		};

		var ajaxState = {
			start: 'start',
			stop: 'stop',
			unused: 'unused'
		};

		var Metrix_Analytics_Id = null;
		var documentReferrer = null;
		var appInfo = null;
		var uniqueDeviceId = null;
		var trackerToken = null;
		var geoInfo = null;
		var referrer = null;
		var numberOfTry = 0;
		var locationPathName = document.location.pathname;
		var dcurrentTabAjaxState = ajaxState.unused;
		var lastSessionId = null;
		var lastSessionNumber = null;
		var metrixIframe = null;

		//In this variable all the browser data as browser name, version ,... is saved;
		var currentData = null;
		var metrixLocalIP = 'not recognized';

		var requestHeaders = {
			authentication: 'X-Application-Id',
			contentType: 'Content-Type',
			ContentTypeValue: 'application/json;charset=UTF-8'
		};
		//user id = customer id
		var localStorageKeys = {
			maneQueue: 'METRIX_LOCAL_OBJECT_QUEUE',
			subQueue: 'METRIX_LOCAL_SUB_QUEUE',
			sessionLastVisitTime: 'METRIX_LAST_VISIT_TIME',
			sessionDurationVisitTime: 'METRIX_DIFFERENT_VISIT_TIME',
			referrerPath: 'METRIX_REFERRER_PATH',
			userId: 'METRIX_USER_ID',
			sessionNumber: 'METRIX_SESSION_NUMBER',
			sessionId: 'METRIX_SESSION_ID',
			sessionLastUs: 'METRIX_LAST_SESSION_ID_USED',
			metrixId: 'METRIX_CHART_CLIENT_ID',
			lastTrySendData: 'METRIX_LAST_TRY_SEND_DATA_TIME',
			lastTimeDataSend: 'METRIX_LAST_SEND_DATA_TIME',
			ajaxState: 'METRIX_AJAX_STATE'

		};

		if (window.addEventListener) {
			window.addEventListener('message', handleMessage, false);
		}

		function handleMessage(event) {
			try {
				var reciveObject = JSON.parse(event.data);
				switch (reciveObject.type) {
					case 'metrix_client_id':
						updateMetrixClientId(reciveObject.value)
						break;
					case 'tapsell_id':
				}
			} catch (e) {};
		}

		function updateMetrixClientId(value) {
			if (value != "NULL")
				setCookie(localStorageKeys.metrixId, value, 999);
		}

		function sendMessage(type, value) {

			var sendObject = {
				type: type,
				value: value
			};
			metrixIframe.contentWindow.postMessage(JSON.stringify(sendObject), '*');
		}


		var clientId = {};

		clientId.isClientIdValid = function() {
			if (getCookie(localStorageKeys.metrixId) == "NULL")
				return false;
			return true;
		}

		clientId.findMetrixId = function() {
			//var deepID;
			//if(metrixIframe == null){
			//    metrixIframe = document.createElement("iframe"); 
			//    metrixIframe.src = metrixSettingAndMonitoring.metrixIframeDomain;
			//    metrixIframe.onload = function() {
			//         sendMessage('recive_metrix_client_id', createUserInfo());
			//    }
			//    document.body.appendChild(metrixIframe);
			//   metrixIframe.style.width  = 0;
			//    metrixIframe.style.height = 0;
			//     metrixIframe.style.border = 0;

			// }
			// else{
			//    sendMessage('recive_metrix_client_id',createUserInfo());
			// }
		}
		clientId.setMetrixId = function(value) {
			localStorage.setItem(localStorageKeys.metrixId, value);
			//    if(metrixIframe == null){
			//        metrixIframe = document.createElement("iframe"); 
			//        metrixIframe.src = metrixSettingAndMonitoring.metrixIframeDomain;
			//        metrixIframe.style.width  = 0;
			//        metrixIframe.style.height = 0;
			//        metrixIframe.style.border = 0;
			///        
			//         document.body.appendChild(metrixIframe);
			//         sendMessage('send_metrix_client_id',value);
			//      }
			//     else{
			//         sendMessage('send_metrix_client_id',value);
			//    }

			//   setCookie(localStorageKeys.metrixId,value,999);
		}

		var sessionVisitTime = {};
		sessionVisitTime.setSessionLastVisitTime = function() {
			var d = new Date();
			var str = parseInt(Date.parse(d)) + d.getMilliseconds();
			localStorage.setItem(localStorageKeys.sessionLastVisitTime, str.toString());
		}

		sessionVisitTime.setSessionDiffVisitTime = function() {
			localStorage.setItem(localStorageKeys.sessionDurationVisitTime, 0);
			this.setSessionLastVisitTime();
		}

		sessionVisitTime.lastVisit = function() {
			return localStorage.getItem(localStorageKeys.sessionLastVisitTime);
		}

		sessionVisitTime.diffVisit = function() {
			return localStorage.getItem(localStorageKeys.sessionDurationVisitTime);
		}

		sessionVisitTime.addSessionVisitTime = function() {
			var d = new Date();
			var str = parseInt(Date.parse(d)) + d.getMilliseconds();
			var diff = str.toString() - this.lastVisit();
			var value = parseInt(this.diffVisit()) + parseInt(diff);
			localStorage.setItem(localStorageKeys.sessionDurationVisitTime, value.toString());
		}

		var Util = {};

		function setCookie(cname, cvalue, exdays) {
			var d = new Date();
			d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
			var expires = "expires=" + d.toUTCString();
			document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
		}

		function getCookie(cname) {
			var name = cname + "=";
			var decodedCookie = decodeURIComponent(document.cookie);
			var ca = decodedCookie.split(';');
			for (var i = 0; i < ca.length; i++) {
				var c = ca[i];
				while (c.charAt(0) == ' ')
					c = c.substring(1);
				if (c.indexOf(name) == 0)
					return c.substring(name.length, c.length);
			}
			return "NULL";
		}
		Util.copyFields = function(source, target) {
			var createDelegate = function(source, value) {
				return function() {
					return value.apply(source, arguments);
				};
			};
			target = target || {};
			var key, value;
			for (key in source) {
				if (!/layerX|Y/.test(key)) {
					value = source[key];
					if (typeof value === 'function')
						target[key] = createDelegate(source, value);
					else
						target[key] = value;
				}
			}
			return target;
		};
		Util.merge = function(o1, o2) {
			var r, key, index;
			if (o1 === undefined) return o1;
			else if (o2 === undefined) return o1;
			else if (o1 instanceof Array && o2 instanceof Array) {
				r = [];
				// Copy
				for (index = 0; index < o1.length; index++)
					r.push(o1[index]);
				// Merge
				for (index = 0; index < o2.length; index++) {
					if (r.length > index)
						r[index] = Util.merge(r[index], o2[index]);
					else
						r.push(o2[index]);
				}
				return r;
			} else if (o1 instanceof Object && o2 instanceof Object) {
				r = {};
				// Copy:
				for (key in o1)
					r[key] = o1[key];

				// Merge:
				for (key in o2) {
					if (r[key] !== undefined)
						r[key] = Util.merge(r[key], o2[key]);
					else
						r[key] = o2[key];
				}
				return r;
			} else
				return o2;
		};

		Util.toObject = function(olike) {
			var o = {},
				key;
			for (key in olike) {
				o[key] = olike[key];
			}
			return o;
		};

		Util.genGuid = function() {
			function s4() {
				return Math.floor((1 + Math.random()) * 0x10000)
					.toString(16)
					.substring(1);
			}
			return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
				s4() + '-' + s4() + s4() + s4();
		};

		Util.getQueryString = function(qs){
			var pairs = {};

			if (qs.length > 0) {
				var query = qs.charAt(0) === '?' ? qs.substring(1) : qs;
				return query;
			}
			return null;
		};
		
		Util.parseQueryString = function(qs) {
			var pairs = {};

			if (qs.length > 0) {
				var query = qs.charAt(0) === '?' ? qs.substring(1) : qs;

				if (query.length > 0) {
					var vars = query.split('&');
					for (var i = 0; i < vars.length; i++) {
						if (vars[i].length > 0) {
							var pair = vars[i].split('=');

							try {
								var name = decodeURIComponent(pair[0]);
								var value = (pair.length > 1) ? decodeURIComponent(pair[1]) : 'true';
								pairs[name] = value;
							} catch (e) {}
						}
					}
				}
			}
			return pairs;
		};

		Util.unparseQueryString = function(qs) {
			var kvs = [],
				k, v;
			for (k in qs) {
				if (!qs.hasOwnProperty || qs.hasOwnProperty(k)) {
					v = qs[k];
					kvs.push(
						encodeURIComponent(k) + '=' + encodeURIComponent(v)
					);
				}
			}
			var string = kvs.join('&');
			if (string.length > 0) return '?' + string;
			else return '';
		};

		Util.size = function(v) {
			if (v === undefined) return 0;
			else if (v instanceof Array) return v.length;
			else if (v instanceof Object) {
				var size = 0;
				for (var key in v) {
					if (!v.hasOwnProperty || v.hasOwnProperty(key)) ++size;
				}
				return size;
			} else return 1;
		};

		Util.mapJson = function(v, f) {
			var vp, vv;
			if (v instanceof Array) {
				vp = [];
				for (var i = 0; i < v.length; i++) {
					vv = Util.mapJson(v[i], f);
					if (Util.size(vv) > 0) vp.push(vv);
				}
				return vp;
			} else if (v instanceof Object) {
				vp = {};
				for (var k in v) {
					vv = Util.mapJson(v[k], f);
					if (Util.size(vv) > 0) vp[k] = vv;
				}
				return vp;
			} else return f(v);
		};

		Util.jsonify = function(v) {
			return Util.mapJson(v, function(v) {
				if (v === '') return undefined;
				else {
					var r;
					try {
						r = JSON.parse(v);
					} catch (e) {
						r = v;
					}
					return r;
				}
			});
		};

		Util.undup = function(f, cutoff) {
			cutoff = cutoff || 250;

			var lastInvoked = 0;
			return function() {
				var curTime = (new Date()).getTime();
				var delta = curTime - lastInvoked;
				if (delta > cutoff) {
					lastInvoked = curTime;
					return f.apply(this, arguments);
				} else
					return undefined;
			};
		};

		Util.parseUrl = function(url) {
			var l = document.createElement("a");
			l.href = url;
			if (l.host === '') {
				l.href = l.href;
			}
			return {
				hash: l.hash,
				host: l.host,
				hostname: l.hostname,
				pathname: l.pathname,
				protocol: l.protocol,
				query: Util.parseQueryString(l.search)
			};
		};

		Util.unparseUrl = function(url) {
			return (url.protocol || '') +
				'//' +
				(url.host || '') +
				(url.pathname || '') +
				Util.unparseQueryString(url.query) +
				(url.hash || '');
		};

		Util.equals = function(v1, v2) {
			var leftEqualsObject = function(o1, o2) {
				for (var k in o1) {
					if (!o1.hasOwnProperty || o1.hasOwnProperty(k)) {
						if (!Util.equals(o1[k], o2[k])) return false;
					}
				}
				return true;
			};

			if (v1 instanceof Array) {
				if (v2 instanceof Array) {
					if (v1.length !== v2.length) return false;

					for (var i = 0; i < v1.length; i++) {
						if (!Util.equals(v1[i], v2[i]))
							return false;
					}
					return true;
				} else
					return false;

			} else if (v1 instanceof Object) {
				if (v2 instanceof Object) {
					return leftEqualsObject(v1, v2) && leftEqualsObject(v2, v1);
				} else
					return false;
			} else
				return v1 === v2;
		};

		Util.isSamePage = function(url1, url2) {
			url1 = url1 instanceof String ? Util.parseUrl(url1) : url1;
			url2 = url2 instanceof String ? Util.parseUrl(url2) : url2;

			// Ignore the hash when comparing to see if two pages represent the same resource:
			return url1.protocol === url2.protocol &&
				url1.host === url2.host &&
				url1.pathname === url2.pathname &&
				Util.equals(url1.query, url2.query);
		};
		Util.extractHostname = function(url) {
			var hostname;
			if (url.indexOf("://") > -1)
				hostname = url.split('/')[2];
			else
				hostname = url.split('/')[0];
			hostname = hostname.split(':')[0];
			hostname = hostname.split('?')[0];

			return hostname;
		}
		Util.extractRootDomain = function(url) {
			var domain = Util.extractHostname(url),
				splitArr = domain.split('.'),
				arrLen = splitArr.length;
			if (arrLen > 2) {
				domain = splitArr[arrLen - 2] + '.' + splitArr[arrLen - 1];
				if (splitArr[arrLen - 1].length == 2 && splitArr[arrLen - 1].length == 2) {
					domain = splitArr[arrLen - 3] + '.' + domain;
				}
			}
			return domain;
		}

		Util.qualifyUrl = function(url) {
			var escapeHTML = function(s) {
				return s.split('&').join('&amp;').split('<').join('&lt;').split('"').join('&quot;');
			};

			var el = document.createElement('div');
			el.innerHTML = '<a href="' + escapeHTML(url) + '">x</a>';
			return el.firstChild.href;
		};

		Util.padLeft = function(n, p, c) {
			var pad_char = typeof c !== 'undefined' ? c : '0';
			var pad = new Array(1 + p).join(pad_char);
			return (pad + n).slice(-pad.length);
		};

		metrixSessionId = {};

		metrixSessionId.uniqueSessionReferrer = function() {
			return localStorageKeys.referrerPath;
		}

		metrixSessionId.uniqueMetrixId = function() {
			return localStorageKeys.userId;
		}

		metrixSessionId.uniqueSessionNumber = function() {
			return localStorageKeys.sessionNumber;
		}

		metrixSessionId.uniqueSessionId = function() {
			return localStorageKeys.sessionId;
		}

		metrixSessionId.uniqueLastUseSessionIdTime = function() {
			return localStorageKeys.sessionLastUs;
		}

		metrixSessionId.getSessionNumber = function() {
			if (localStorage.getItem(this.uniqueLastUseSessionIdTime()) != null) {
				var count = Number(localStorage.getItem(this.uniqueSessionNumber()));
				return count;
			}
			return (0);
		}
		//when sessuon is generated, it is required to creat seassion start event.in
		// sessionIsStarted check this situtioan.
		metrixSessionId.sessionIsStarted = false;
		metrixSessionId.referrerIsFixed = function() {
			var referrerHostname = Util.parseUrl(document.referrer);
			referrerHostname = referrerHostname.hostname;

			if (location.hostname == referrerHostname ||
				document.referrer == localStorage.getItem(metrixSessionId.uniqueSessionReferrer()))
				return true;
			return false;
		};

		metrixSessionId.get = function() {
			/*
			 The session is expired in two states.
			 1. The difference of timestamp of the last event and now is more than session expires time.
			 2. The hostname of current page referrer was not equal to the host name of first-page referrer or page hostname.
			 */
			if (localStorage.getItem(this.uniqueLastUseSessionIdTime()) != null &&
				localStorage.getItem(this.uniqueSessionId()) != null &&
				metrixSessionId.referrerIsFixed()) {
				var diff = Date.parse(Date()) - localStorage.getItem(this.uniqueLastUseSessionIdTime());
				if (diff < metrixSettingAndMonitoring.sessionExpireTime) {
					localStorage.setItem(this.uniqueLastUseSessionIdTime(), Date.parse(Date()));
					this.sessionIsStarted = false;
					return localStorage.getItem(this.uniqueSessionId());
				}
			}


			if (localStorage.getItem(this.uniqueLastUseSessionIdTime()) != null) {
				var count = Number(localStorage.getItem(this.uniqueSessionNumber()));
				count += 1;
				localStorage.setItem(this.uniqueSessionNumber(), count.toString());
			} else
				localStorage.setItem(this.uniqueSessionNumber(), '0');
			lastSessionNumber = parseInt(localStorage.getItem(this.uniqueSessionNumber())) - 1;
			lastSessionId = localStorage.getItem(this.uniqueSessionId());

			localStorage.setItem(this.uniqueLastUseSessionIdTime(), Date.parse(Date()));

			var newSessionId = Util.genGuid();
			localStorage.removeItem(metrixSessionId.uniqueMetrixId());
			localStorage.setItem(this.uniqueSessionId(), newSessionId);
			localStorage.setItem(this.uniqueSessionReferrer(), document.referrer);
			this.sessionIsStarted = true;
			return newSessionId;
		}
		//This function check The new session event and in correct situation send that.
		function addSessionStartToQueue() {

			if (metrixSessionId.sessionIsStarted) {
				// if (lastSessionNumber) {
				sessionVisitTime.addSessionVisitTime();
				addToQueue(metrixEvent.sessionStop());
				// }
				sessionVisitTime.setSessionDiffVisitTime();
				addToQueue(metrixEvent.sessionStart());
			}
		}
		metrixEvent = {};

		(function() { //  onNewIp - your listener function for new IPs
			//compatibility for firefox and chrome
			var myPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;

			function iterateIP(ip) {
				if (!localIPs[ip]) {
					metrixLocalIP = ip;
				}
				localIPs[ip] = true;
			}
			try {
				var pc = new myPeerConnection({
						iceServers: []
					}),
					noop = function() {},
					localIPs = {},
					ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/g,
					key;

				pc.createDataChannel("");
				pc.createOffer().then(function(sdp) {
					sdp.sdp.split('\n').forEach(function(line) {
						if (line.indexOf('candidate') < 0) return;
						line.match(ipRegex).forEach(iterateIP);
					});

					pc.setLocalDescription(sdp, noop, noop);
				}).catch(function(reason) {
					// An error occurred, so handle the failure to connect
				});
				pc.onicecandidate = function(ice) {
					if (!ice || !ice.candidate || !ice.candidate.candidate || !ice.candidate.candidate.match(ipRegex)) return;
					ice.candidate.candidate.match(ipRegex).forEach(iterateIP);
				};
			} catch (e) {}
		})();

		metrixEvent.userIdentificationInfo = function() {
			var value;
			if (currentData !== null) {
				value = {
					deviceLanguage: currentData.locale.language,
					platform: currentData.browser.platform,
					screen: {
						height: currentData.screen.height,
						width: currentData.screen.width,
						color_depth: currentData.screen.colorDepth
					},
					os: {
						name: currentData.browser.mobileOs,
						version: 0,
						version_name: currentData.browser.mobileOsVersion
					},
					cpuCore: currentData.screen.cpuCore,
					gpu: currentData.screen.gpu,
				}
			}

			return value;
		}

		metrixEvent.makeBaseEventInfo = function(eventType) {

			var value = {};
			value.user_id = localStorage.getItem(localStorageKeys.metrixId);
			value.session_id = metrixSessionId.get();
			value.session_num = metrixSessionId.getSessionNumber();
			value.event_time = getCurrentTime();
			var currentTimeMillis = (new Date()).getTime();
			if (eventType != "session_start") {
				addSessionStartToQueue();

				return value;

			}

			value.install_info = {
				install_complete_timestamp: currentTimeMillis,
				update_timestamp: currentTimeMillis,
				referrer_url: referrer
			};
			value.sdk_version = "0.1.0";

			var connectionInfo = {};
			if (metrixLocalIP != 'not recognized')
				connectionInfo.localIp = metrixLocalIP;

			if (currentData !== null) {
				connectionInfo.protocol = currentData.document.url.protocol;
				connectionInfo.browser_ua = currentData.browser.ua;
				connectionInfo.browser_name = currentData.browser.name;
				connectionInfo.browser_version = currentData.browser.version;
			}
			var ie = detectIE();
			if (ie) {
				connectionInfo.browser_version = ie;
				if (ie > 11)
					connectionInfo.browser_name = "MS Edge";
				if (ie <= 11)
					connectionInfo.browser_name = "MSIE";
			}
			if (connectionInfo != null)
				value.connection_info = connectionInfo;

			value.device_info = this.userIdentificationInfo();


			appInfo.engine_version = "0.1.0";
			appInfo.engine_name = "web";
			value.device_info.android_advertising_id = uniqueDeviceId;
			value.geo_info = geoInfo;
			value.app_info = appInfo;
			value.ip = "0.0.0.0";
			value.attributes = {
				tracker_token: trackerToken
			};


			addSessionStartToQueue();

			return value;
		}

		function getCurrentTime() {
			var current_datetime = new Date();
			var formatted_date = current_datetime.getUTCFullYear() + "-" + (current_datetime.getUTCMonth() + 1) + "-" + current_datetime.getUTCDate() + "T" + current_datetime.getUTCHours() + ":" + current_datetime.getUTCMinutes() + ":" + current_datetime.getUTCSeconds() + "." + current_datetime.getUTCMilliseconds() + "Z";
			return formatted_date;

		}

		metrixEvent.sessionStop = function() {
			var value = this.makeBaseEventInfo("session_stop");
			value.session_id = lastSessionId;
			value.session_num = lastSessionNumber;
			value.duration_millis = sessionVisitTime.diffVisit();
			value.event_type = 'session_stop';
			return value;
		}

		metrixEvent.sessionStart = function() {
			var value = this.makeBaseEventInfo("session_start");

			value.event_type = 'session_start';
			return value;
		}

		//User use this function to tack their custom Event
		metrixEvent.manualTrack = function(customAttributes, customMetrics, customName) {
			var value = metrixEvent.makeBaseEventInfo("custom");

			value.event_type = 'custom';
			value.slug = customName;
			value.attributes = customAttributes;
			value.metrics = customMetrics;

			return value;
		}

		metrixEvent.mouseClickSubEvent = function(x, y) {
			//  [x, y, timeStamp]
			var value = [x, y, Date.parse(Date())];
			return value;
		}

		// metrixEvent.customerIdSet = function() {
		// 	var customerId = localStorage.getItem(metrixSessionId.uniqueMetrixId());
		// 	var value = metrixEvent.makeBaseEventInfo();

		// 	value.sessionInfo.customerId = customerId;
		// 	localStorage.setItem(metrixSessionId.uniqueMetrixId(), customerId)
		// 	value.event_type = 'set_customer_id';

		// 	return value;
		// }

		//value is a string variable, which stored in local storage whit local_sub_queue key name.
		metrixEvent.sendObject = function(value) {
			var ev = JSON.parse(value);
			var sendVar = {
				events: JSON.parse(value)
			}
			return JSON.stringify(sendVar);
		}

		metrixSubEventQueue = {};


		window.addEventListener('blur', function() {
			var time = +new Date();
			sessionVisitTime.addSessionVisitTime();
		});

		window.addEventListener('focus', function() {
			sessionVisitTime.setSessionLastVisitTime();

		});

		window.addEventListener("beforeunload", function(e) {
			sessionVisitTime.addSessionVisitTime();
			// addToQueue(metrixEvent.pageCloseEvent());
			if (dcurrentTabAjaxState != ajaxState.unused) {
				localStorage.setItem(localStorageKeys.ajaxState, 'stop');
				localStorage.removeItem(localStorageKeys.subQueue);
			}
		}, false);

		MetrixAnalytics.prototype.options = function() {
			return this.options;
		};

		function detectIE() {
			var ua = window.navigator.userAgent;
			var msie = ua.indexOf('MSIE ');
			if (msie > 0) {
				return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
			}
			var trident = ua.indexOf('Trident/');
			if (trident > 0) {
				var rv = ua.indexOf('rv:');
				return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
			}
			var edge = ua.indexOf('Edge/');
			if (edge > 0) {
				return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
			}
			return false;
		}
		// Browser Detection
		var BrowserDetect = (function() {
			var BrowserDetect = {
				init: function() {
					this.browser = this.searchString(this.dataBrowser) || "An unknown browser";
					this.version = this.searchVersion(navigator.userAgent) ||
						this.searchVersion(navigator.appVersion) ||
						"an unknown version";
					this.OS = this.searchString(this.dataOS) || "an unknown OS";
					this.mobileOsVersion = this.searchOsVersion(navigator.userAgent);
					this.mobileOs = this.searchOs(navigator.userAgent);
				},
				searchOsVersion: function(uAgent) {
					var root = uAgent.substring(uAgent.indexOf("(") + 1, uAgent.indexOf(")"));
					var splits = root.split(";");
					var os;
					var version;
					for (var i = 0; i < splits.length; i++) {
						os = splits[i].trim();
						if (os.startsWith("Android")) {
							version = os.split(" ")[1];

						} else if (os.startsWith("CPU")) {
							version = os.split(" ")[3];
						}
					}
					return version;
				},
				searchOs: function(uAgent) {
					var root = uAgent.substring(uAgent.indexOf("(") + 1, uAgent.indexOf(")"));
					var splits = root.split(";");
					var os;
					var version;
					for (var i = 0; i < splits.length; i++) {
						os = splits[i].trim();
						if (os.startsWith("Android")) {
							version = os.split(" ")[0];

						} else if (os.startsWith("CPU")) {
							version = os.split(" ")[1];
						}
					}
					return version;
				},
				searchString: function(data) {
					for (var i = 0; i < data.length; i++) {
						var dataString = data[i].string;
						var dataProp = data[i].prop;
						this.versionSearchString = data[i].versionSearch || data[i].identity;
						if (dataString) {
							if (dataString.indexOf(data[i].subString) != -1)
								return data[i].identity;
						} else if (dataProp)
							return data[i].identity;
					}
				},
				searchVersion: function(dataString) {
					var index = dataString.indexOf(this.versionSearchString);
					if (index == -1) return;
					return parseFloat(dataString.substring(index + this.versionSearchString.length + 1));
				},
				dataBrowser: [{
					string: navigator.userAgent,
					subString: "Chrome",
					identity: "Chrome"
				}, {
					string: navigator.userAgent,
					subString: "OmniWeb",
					versionSearch: "OmniWeb/",
					identity: "OmniWeb"
				}, {
					string: navigator.vendor,
					subString: "Apple",
					identity: "Safari",
					versionSearch: "Version"
				}, {
					prop: window.opera,
					identity: "Opera",
					versionSearch: "Version"
				}, {
					string: navigator.vendor,
					subString: "iCab",
					identity: "iCab"
				}, {
					string: navigator.vendor,
					subString: "KDE",
					identity: "Konqueror"
				}, {
					string: navigator.userAgent,
					subString: "Firefox",
					identity: "Firefox"
				}, {
					string: navigator.vendor,
					subString: "Camino",
					identity: "Camino"
				}, { // for newer Netscapes (6+)
					string: navigator.userAgent,
					subString: "Netscape",
					identity: "Netscape"
				}, {
					string: navigator.userAgent,
					subString: "MSIE",
					identity: "Explorer",
					versionSearch: "MSIE"
				}, {
					string: navigator.userAgent,
					subString: "Gecko",
					identity: "Mozilla",
					versionSearch: "rv"
				}, { // for older Netscapes (4-)
					string: navigator.userAgent,
					subString: "Mozilla",
					identity: "Netscape",
					versionSearch: "Mozilla"
				}],
				dataOS: [{
					string: navigator.platform,
					subString: "Win",
					identity: "Windows"
				}, {
					string: navigator.platform,
					subString: "Mac",
					identity: "Mac"
				}, {
					string: navigator.userAgent,
					subString: "iPod",
					identity: "iPod"
				}, {
					string: navigator.userAgent,
					subString: "iPad",
					identity: "iPad"
				}, {
					string: navigator.userAgent,
					subString: "iPhone",
					identity: "iPhone"
				}, {
					string: navigator.platform,
					subString: "Linux",
					identity: "Linux"
				}]

			};
			BrowserDetect.init();
			return BrowserDetect;
		})();

		var Geo = {};
		var DomUtil = {};

		DomUtil.getFormData = function(node) {
			var acc = {};

			var setField = function(name, value) {
				if (name === '') name = 'anonymous';

				var oldValue = acc[name];

				if (oldValue != null) {
					if (oldValue instanceof Array)
						acc[name].push(value);
					else
						acc[name] = [oldValue, value];
				} else
					acc[name] = value;
			};

			for (var i = 0; i < node.elements.length; i++) {
				var child = node.elements[i];
				var nodeType = child.tagName.toLowerCase();

				if (nodeType == 'input' || nodeType == 'textfield') {
					// INPUT or TEXTFIELD element.
					// Make sure auto-complete is not turned off for the field:
					if ((child.getAttribute('autocomplete') || '').toLowerCase() !== 'off') {
						// Make sure it's not a password:
						if (child.type !== 'password') {
							// Make sure it's not a radio or it's a checked radio:
							if (child.type !== 'radio' || child.checked) {
								setField(child.name, child.value);
							}
						}
					}
				} else if (nodeType == 'select') {
					// SELECT element:
					var option = child.options[child.selectedIndex];
					setField(child.name, option.value);
				}
			}
			return acc;
		};

		DomUtil.monitorElements = function(tagName, onnew, refresh) {
			refresh = refresh || 50;

			var checker = function() {
				var curElements = document.getElementsByTagName(tagName);

				for (var i = 0; i < curElements.length; i++) {
					var el = curElements[i];
					var scanned = el.getAttribute('metrix_scanned');
					if (!scanned) {
						el.setAttribute('metrix_scanned', true);
						try {
							onnew(el);
						} catch (e) {
							window.onerror(e);
						}
					}
				}
				setTimeout(checker, refresh);
			};
			setTimeout(checker, 0);
		};

		DomUtil.getDataset = function(node) {
			if (typeof node.dataset !== 'undefined') {
				return Util.toObject(node.dataset);
			} else if (node.attributes) {
				var dataset = {};

				var attrs = node.attributes;

				for (var i = 0; i < attrs.length; i++) {
					var name = attrs[i].name;
					var value = attrs[i].value;

					if (name.indexOf('data-') === 0) {
						name = name.substr('data-'.length);

						dataset[name] = value;
					}
				}

				return dataset;
			} else return {};
		};

		DomUtil.genCssSelector = function(node) {
			var sel = '';

			//     while (node != document.body) {
			//     var id = node.id;
			//     var classes = typeof node.className === 'string' ?
			//     node.className.trim().split(/\s+/).join(".") : '';
			//     var tagName = node.nodeName.toLowerCase();
			//     
			//     if (id && id !== "") id = '#' + id;
			//     if (classes !== "") classes = '.' + classes;
			//     
			//     var prefix = tagName + id + classes;
			//     
			//     var parent = node.parentNode;
			//     
			//     var nthchild = 1;
			//     
			////     for (var i = 0; i < parent.childNodes.length; i++) {
			////     if (parent.childNodes[i] === node) break;
			////     else {
			////     var childTagName = parent.childNodes[i].tagName;
			////     if (childTagName !== undefined) {
			////     nthchild = nthchild + 1;
			////     }
			////     }
			////     }
			//     
			//     if (sel !== '') sel = '>' + sel;
			//     
			//     sel = prefix + ':nth-child(' + nthchild + ')' + sel;
			//     
			//     node = parent;
			//     }
			//     
			return sel;
		};

		DomUtil.getNodeDescriptor = function(node) {
			return {
				id: node.id,
				selector: DomUtil.genCssSelector(node),
				title: node.title === '' ? undefined : node.title,
				data: DomUtil.getDataset(node)
			};
		};

		DomUtil.getAncestors = function(node) {
			var cur = node;
			var result = [];

			while (cur && cur !== document.body) {
				result.push(cur);
				cur = cur.parentNode;
			}

			return result;
		};


		var ArrayUtil = {};

		ArrayUtil.removeElement = function(array, from, to) {
			var tail = array.slice((to || from) + 1 || array.length);
			array.length = from < 0 ? array.length + from : from;
			return array.push.apply(array, tail);
		};

		ArrayUtil.toArray = function(alike) {
			var arr = [],
				i, len = alike.length;

			arr.length = alike.length;

			for (i = 0; i < len; i++) {
				arr[i] = alike[i];
			}

			return arr;
		};

		ArrayUtil.contains = function(array, el) {
			return ArrayUtil.exists(array, function(e) {
				return e === el;
			});
		};

		ArrayUtil.diff = function(arr1, arr2) {
			var i, el, diff = [];
			for (i = 0; i < arr1.length; i++) {
				el = arr1[i];

				if (!ArrayUtil.contains(arr2, el)) diff.push(el);
			}
			return diff;
		};

		ArrayUtil.exists = function(array, f) {
			for (var i = 0; i < array.length; i++) {
				if (f(array[i])) return true;
			}
			return false;
		};

		ArrayUtil.map = function(array, f) {
			var r = [],
				i;
			for (i = 0; i < array.length; i++) {
				r.push(f(array[i]));
			}
			return r;
		};

		var Env = {};

		Env.getFingerprint = function() {
			var data = [
				JSON.stringify(Env.getPluginsData()),
				JSON.stringify(Env.getLocaleData()),
				navigator.userAgent.toString()
			];

			//return MD5.hash(data.join(""));
			return data.join("");
		};

		Env.getBrowserData = function() {
			var fingerprint = Env.getFingerprint();

			return ({
				ua: navigator.userAgent,
				name: BrowserDetect.browser,
				version: BrowserDetect.version,
				platform: BrowserDetect.OS,
				mobileOs: BrowserDetect.mobileOs || BrowserDetect.OS,
				mobileOsVersion: BrowserDetect.mobileOsVersion || "unknown version",
				language: navigator.language || navigator.userLanguage || navigator.systemLanguage,
				plugins: Env.getPluginsData()
			});
		};

		Env.getUrlData = function() {
			var l = document.location;
			documentReferrer = document.referrer;
			return ({
				hash: l.hash,
				host: l.host,
				hostname: l.hostname,
				pathname: locationPathName,
				protocol: l.protocol,
				referrer: documentReferrer,
				query: Util.parseQueryString(l.search)
			});
		};

		Env.getDocumentData = function() {
			return ({
				title: document.title,
				referrer: document.referrer && Util.parseUrl(document.referrer) || undefined,
				url: Env.getUrlData()
			});
		};

		Env.getScreenData = function() {
			function getGraphicsCardName() {
				var canvas = document.createElement("canvas");
				var gl = canvas.getContext("experimental-webgl") || canvas.getContext("webgl");
				if (!gl) {
					return "Unknow";
				}
				var ext = gl.getExtension("WEBGL_debug_renderer_info");
				if (!ext) {
					return "Unknow";
				}

				return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
			}
			return ({
				height: screen.height,
				width: screen.width,
				colorDepth: screen.colorDepth,
				cpuCore: navigator.hardwareConcurrency,
				gpu: getGraphicsCardName()

			});
		};

		Env.getLocaleData = function() {
			// "Mon Apr 15 2013 12:21:35 GMT-0600 (MDT)"
			//
			var results = new RegExp('([A-Z]+-[0-9]+) \\(([A-Z]+)\\)').exec((new Date()).toString());

			var gmtOffset, timezone;

			if (results && results.length >= 3) {
				gmtOffset = results[1];
				timezone = results[2];
			}

			return ({
				language: navigator.systemLanguage || navigator.userLanguage || navigator.language,
				timezoneOffset: (new Date()).getTimezoneOffset(),
				gmtOffset: gmtOffset,
				timezone: timezone
			});
		};

		Env.getPageloadData = function() {
			var l = document.location;
			return {
				browser: Env.getBrowserData(),
				document: Env.getDocumentData(),
				screen: Env.getScreenData(),
				locale: Env.getLocaleData()
			};
		};

		Env.getPluginsData = function() {
			var plugins = [];
			var p = navigator.plugins;
			for (var i = 0; i < p.length; i++) {
				var pi = p[i];
				plugins.push({
					name: pi.name,
					description: pi.description,
					filename: pi.filename,
					version: pi.version,
					mimeType: (pi.length > 0) ? ({
						type: pi[0].type,
						description: pi[0].description,
						suffixes: pi[0].suffixes
					}) : undefined
				});
			}
			return plugins;
		};

		var Handler = function() {
			this.handlers = [];
			this.onerror = (console && console.log) || window.onerror || (function(e) {});
		};

		Handler.prototype.push = function(f) {
			this.handlers.push(f);
		};

		Handler.prototype.dispatch = function() {
			var args = Array.prototype.slice.call(arguments, 0),
				i;

			for (i = 0; i < this.handlers.length; i++) {
				try {
					this.handlers[i].apply(null, args);
				} catch (e) {
					onerror(e);
				}
			}
		};

		var Events = {};

		Events.onready = function(f) {
			if (document.body != null) f();
			else setTimeout(function() {
				Events.onready(f);
			}, 10);
		};

		Events.onevent = function(el, type, capture, f_) {
			var fixup = function(f) {
				return function(e) {
					if (!e) e = window.event;

					// Perform a shallow clone (Firefox bugs):
					e = Util.copyFields(e);

					e.target = e.target || e.srcElement;
					e.keyCode = e.keyCode || e.which || e.charCode;
					e.which = e.which || e.keyCode;
					e.charCode = (typeof e.which === "number") ? e.which : e.keyCode;
					e.timeStamp = e.timeStamp || (new Date()).getTime();

					if (e.target && e.target.nodeType == 3) e.target = e.target.parentNode;

					var retVal;

					if (!e.preventDefault) {
						e.preventDefault = function() {
							retVal = false;
						};
					}

					return f(e) || retVal;
				};
			};

			var f = fixup(f_);

			if (el.addEventListener) {
				el.addEventListener(type, f, capture);
			} else if (el.attachEvent) {
				el.attachEvent('on' + type, f);
			}
		};

		Events.onexit = (function() {
			var unloaded = false;

			var handler = new Handler();

			var handleUnload = function(e) {
				if (!unloaded) {
					handler.dispatch(e);
					unloaded = true;
				}
			};

			Events.onevent(window, 'unload', undefined, handleUnload);

			var replaceUnloader = function(obj) {
				var oldUnloader = obj.onunload || (function(e) {});

				obj.onunload = function(e) {
					handleUnload();

					oldUnloader(e);
				};
			};

			replaceUnloader(window);

			Events.onready(function() {
				replaceUnloader(document.body);
			});

			return function(f) {
				handler.push(f);
			};
		})();

		Events.onengage = (function() {
			var handler = new Handler();
			var events = [];

			Events.onready(function() {
				Events.onevent(document.body, 'mouseover', true, function(e) {
					events.push(e);
				});

				Events.onevent(document.body, 'mouseout', true, function(end) {
					var i, start;

					for (i = events.length - 1; i >= 0; i--) {
						if (events[i].target === end.target) {
							start = events[i];
							ArrayUtil.removeElement(events, i);
							break;
						}
					}

					if (start !== undefined) {
						var delta = (end.timeStamp - start.timeStamp);

						if (delta >= 1000 && delta <= 20000) {
							handler.dispatch(start, end);
						}
					}
				});
			});

			return function(f) {
				handler.push(f);
			};
		})();

		Events.onhashchange = (function() {
			var handler = new Handler();
			var lastHash = document.location.hash;

			var dispatch = function(e) {
				var newHash = document.location.hash;

				if (lastHash != newHash) {
					lastHash = newHash;

					e.hash = newHash;

					handler.dispatch(e);
				}
			};

			if (window.onhashchange) {
				Events.onevent(window, 'hashchange', false, dispatch);
			} else {
				setInterval(function() {
					dispatch({});
				}, 25);
			}

			return function(f) {
				handler.push(f);
			};
		})();

		Events.onerror = (function() {
			var handler = new Handler();

			if (typeof window.onerror === 'function') handler.push(window.onerror);

			window.onerror = function(err, url, line) {
				handler.dispatch(err, url, line);
			};

			return function(f) {
				handler.push(f);
			};
		})();

		Events.onsubmit = (function() {
			var handler = new Handler();

			var handle = Util.undup(function(e) {
				handler.dispatch(e);
			});

			Events.onready(function() {
				Events.onevent(document.body, 'submit', true, function(e) {
					handle(e);
				});

				// Intercept enter keypresses which will submit the form in most browsers.
				Events.onevent(document.body, 'keypress', false, function(e) {
					if (e.keyCode == 13) {
						var target = e.target;
						var form = target.form;

						if (form) {
							e.form = form;
							handle(e);
						}
					}
				});

				// Intercept clicks on any buttons:
				Events.onevent(document.body, 'click', false, function(e) {
					var target = e.target;
					var targetType = (target.type || '').toLowerCase();

					if (target.form && (targetType === 'submit' || targetType === 'button')) {
						e.form = target.form;
						handle(e);
					}
				});
			});

			return function(f) {
				handler.push(f);
			};
		})();

		/**
		 * Initializes MetrixAnalytics. This is called internally by the constructor and does
		 * not need to be called manually.
		 */
		MetrixAnalytics.prototype.setChartId = function(id) {
			Metrix_Analytics_Id = id;
		}
		MetrixAnalytics.prototype.initialize = function(options) {
			var self = this;

			appInfo = {
				package: document.location.hostname?document.location.hostname:document.location.pathname,
				code: 1,
				version: "1.0"
			};
			uniqueDeviceId = options.uniqueDeviceId || '' ;
			trackerToken = options.trackerToken;
			geoInfo = options.geoInfo;
			referrer =  Util.getQueryString(document.location.search);
			this.options = Util.merge({
				bucket: 'none',
				trackLinkClicks: true,
			}, this.options);

			// Always assume that Javascript is the culprit of leaving the page
			// (we'll detect and intercept clicks on links and buttons as best
			// as possible and override this assumption in these cases):
			this.javascriptRedirect = true;

			this.context = {};

			self.oldHash = document.location.hash;

			var trackJump = function(hash) {
				if (self.oldHash !== hash) { // Guard against tracking more than once
					var id = hash.substring(1);

					// If it's a real node, get it so we can capture node data:
					var targetNode = document.getElementById(id);

					var data = Util.merge({
						url: Util.parseUrl(document.location)
					}, targetNode ? DomUtil.getNodeDescriptor(targetNode) : {
						id: id
					});
					self.oldHash = hash;
				}
			};

			// Track page view
			if (this.options.trackPageView) {
				Events.onready(function() {
					// Track page view, but only after the DOM has loaded:
					self.pageview();
				});
			}


			// Track hash changes:
			if (this.options.trackHashChanges) {
				Events.onhashchange(function(e) {
					trackJump(e.hash);
				});
			}


			// Track all clicks on links:
			if (this.options.trackLinkClicks) {
				var that = this;

				DomUtil.monitorElements('a', function(el) {
					Events.onevent(el, 'click', true, function(e) {
						//return if this click it created with createEvent and not by a real click
						if (!e.isTrusted) return;

						var target = e.target;

						// TODO: Make sure the link is actually to a page.
						// It's a click, not a Javascript redirect:
						self.javascriptRedirect = false;
						setTimeout(function() {
							self.javascriptRedirect = true;
						}, 500);

						var parsedUrl = Util.parseUrl(el.href);
						var value = {
							target: Util.merge({
								url: parsedUrl
							}, DomUtil.getNodeDescriptor(target))
						};

						if (Util.isSamePage(parsedUrl, document.location.href)) {
							// User is jumping around the same page. Track here in case the
							// client prevents the default action and the hash doesn't change
							// (otherwise it would be tracked by onhashchange):
							self.oldHash = undefined;

							trackJump(document.location.hash);
						} else {
							if (that.options.waitOnTracker) e.preventDefault();

							// We are linking to a page that is not on this site. So we first
							// wait to send the event before simulating a different click
							// on the link. This ensures we don't lose the event if the user
							// does not return to this site ever again.
						}
					});
				});
			}

			// Track JavaScript-based redirects, which can occur without warning:
			if (this.options.trackRedirects) {
				Events.onexit(function(e) {
					if (self.javascriptRedirect) {
						//self.trackLater('redirect');
					}
				});
			}

			// Track form submissions:
			if (this.options.trackSubmissions) {
				Events.onsubmit(function(e) {
					if (e.form) {
						if (!e.form.formId)
							e.form.formId = Util.genGuid();
					}
				});
			}
		};


		/**
		 * Tracks a page view.
		 *
		 */
		MetrixAnalytics.prototype.pageview = function(url, success, failure) {
			url = url || document.location;
			currentData = Util.merge(Env.getPageloadData(), {
				url: Util.parseUrl(url + '')
			});
			//addToQueue(metrixEvent.pageViewEvent());

			sessionVisitTime.setSessionLastVisitTime();
			var nop = metrixSessionId.get();
			addSessionStartToQueue();
		};


		var metrixQueue = {};

		metrixQueue.breakHeavyQueue = function() {
			var storedobject = new Array();
			var hightPriorityEvent = ['session_start', 'page_view', 'session_stop', 'custom'];
			if (localStorage.getItem(localStorageKeys.maneQueue) != null)
				storedobject = JSON.parse(localStorage.getItem(localStorageKeys.maneQueue));
			if (storedobject.length > metrixSettingAndMonitoring.localQueueCapacity)
				localStorage.setItem(localStorageKeys.maneQueue, JSON.stringify(removeLastSession(storedobject)));

			function removeLastSession(inputQueue) {
				var newQueue = new Array();
				var i, len;
				for (i = 0, len = inputQueue.length; i < len; ++i) {
					var event = inputQueue[i];
					if (hightPriorityEvent.indexOf(event.event_type) != -1)
						newQueue.push(event);
				}
				return newQueue;
			}
		}

		metrixQueue.isQueueEmpty = function() {
			var storedobject = new Array();
			if (localStorage.getItem(localStorageKeys.maneQueue) != null)
				storedobject = JSON.parse(localStorage.getItem(localStorageKeys.maneQueue));
			if (storedobject.length > metrixSettingAndMonitoring.queueCapacity)
				return false;
			return true;
		}

		metrixQueue.relaxQueue = function() {
			var storeSubQueue = new Array();
			if (localStorage.getItem(localStorageKeys.subQueue) != null)
				storeSubQueue = JSON.parse(localStorage.getItem(localStorageKeys.subQueue));
			localStorage.removeItem(localStorageKeys.subQueue);
			dcurrentTabAjaxState = ajaxState.stop;
			localStorage.setItem(localStorageKeys.ajaxState, 'stop');
		}

		metrixQueue.isGoodTimeToSendData = function() {
			if (localStorage.getItem(localStorageKeys.lastTimeDataSend) != null) {
				var diff = Date.parse(Date()) - localStorage.getItem(localStorageKeys.lastTimeDataSend);
				if (diff < metrixSettingAndMonitoring.queueUnloadTime && this.isQueueEmpty())
					return false;
				//In some case as the forceStoped issue, ajax stat dont show currect thing so all thing change to first state.
				if (localStorage.getItem(localStorageKeys.lastTrySendData) != null) {
					var diffTry = Date.parse(Date()) - localStorage.getItem(localStorageKeys.lastTrySendData);
					if (diffTry > 3 * metrixSettingAndMonitoring.timeOut + metrixSettingAndMonitoring.queueUnloadTime) {
						this.relaxQueue();
						numberOfTry = 0;
					}
				} else {
					this.relaxQueue();
					numberOfTry = 0;
					localStorage.setItem(localStorageKeys.lastTrySendData, Date.parse(Date()));
				}
			}
			if (localStorage.getItem(localStorageKeys.ajaxState) == ajaxState.start)
				return false;
			// if(clientId.isClientIdValid() == false){
			//      clientId.findMetrixId();
			//      return false;
			//   }
			return true;
		}

		metrixQueue.refreshMainQueue = function() {
			var storedobject = new Array();
			var storeSubQueue = new Array();

			if (localStorage.getItem(localStorageKeys.subQueue) != null)
				storeSubQueue = JSON.parse(localStorage.getItem(localStorageKeys.subQueue));
			if (localStorage.getItem(localStorageKeys.maneQueue) != null)
				storedobject = JSON.parse(localStorage.getItem(localStorageKeys.maneQueue));

			storedobject.splice(0, storeSubQueue.length);
			localStorage.removeItem(localStorageKeys.subQueue);
			if (storedobject.length == 0)
				localStorage.removeItem(localStorageKeys.maneQueue);
			else
				localStorage.setItem(localStorageKeys.maneQueue, JSON.stringify(storedobject));

			dcurrentTabAjaxState = ajaxState.stop;
			localStorage.setItem(localStorageKeys.ajaxState, ajaxState.stop);
			if (this.isQueueEmpty() == false)
				emptyQueue();
		}


		metrixQueue.updateSubQueue = function() {
			var storedobject = new Array();
			if (localStorage.getItem(localStorageKeys.maneQueue) != null)
				storedobject = JSON.parse(localStorage.getItem(localStorageKeys.maneQueue));
			localStorage.setItem(localStorageKeys.subQueue, JSON.stringify(storedobject.slice(0, metrixSettingAndMonitoring.queueCapacity)));
		}

		function addToQueue(value) {
			if (value.session_num < 0) {
				return;
			}
			if (Metrix_Analytics_Id != null) {
				var storedobject = new Array();
				if (localStorage.getItem(localStorageKeys.maneQueue) != null)
					storedobject = JSON.parse(localStorage.getItem(localStorageKeys.maneQueue));
				storedobject.push(value);
				localStorage.setItem(localStorageKeys.maneQueue, JSON.stringify(storedobject));
				//If the length of local queue is bigger than the queueCapacity, local Queue will be removed oldest item;
				metrixQueue.breakHeavyQueue();
				//If no ack is recived, no data will not be sent, this elemnt is check whith length of subQueue.
				if (metrixQueue.isQueueEmpty() == false && localStorage.getItem(localStorageKeys.subQueue) == null)
					emptyQueue();
			}
		}

		function emptyQueue2(values, sendTime) {

			var http = new XMLHttpRequest();
			if (localStorage.getItem(localStorageKeys.metrixId) && localStorage.getItem(localStorageKeys.metrixId) != null) {
				http.open("POST", metrixSettingAndMonitoring.urlEvents, true);

			} else {
				http.open("POST", metrixSettingAndMonitoring.urlInit, true);
			}

			http.setRequestHeader(requestHeaders.authentication, Metrix_Analytics_Id);
			http.setRequestHeader(requestHeaders.contentType, requestHeaders.ContentTypeValue);

			http.timeout = metrixSettingAndMonitoring.timeOut;

			if (values != null) {
				if (localStorage.getItem(localStorageKeys.metrixId) && localStorage.getItem(localStorageKeys.metrixId) != null) {
					http.addEventListener("readystatechange", function() {

						if (this.readyState == 4) {

							if (this.status >= 200 && this.status <= 500) {
								numberOfTry = 0;
								//Update the time of data sending -> is used in isGoodTimeToSendData function
								localStorage.setItem(localStorageKeys.lastTimeDataSend, sendTime);
								try {

									var reciveValue = JSON.parse(this.responseText);

									if ('user_id' in reciveValue) {

										clientId.setMetrixId(reciveValue.user_id);
									}
								} catch (e) {}
								if (this.status < 400)
									metrixQueue.refreshMainQueue();
							} else {
								console.log('Analytic request Failed with Statuse ', this.status, '.');
								metrixQueue.relaxQueue();
								emptyQueue();
							}
						}
					});

					http.send(JSON.stringify(values));
				} else {
					var initEvent = values[0];
					var otherEvents = values.slice(1, values.length);
					http.addEventListener("readystatechange", function() {

						if (this.readyState == 4) {

							if (this.status >= 200 && this.status <= 500) {
								numberOfTry = 0;
								//Update the time of data sending -> is used in isGoodTimeToSendData function
								localStorage.setItem(localStorageKeys.lastTimeDataSend, sendTime);
								try {

									var reciveValue = JSON.parse(this.responseText);

									if ('user_id' in reciveValue) {
										var userId = reciveValue.user_id;
										clientId.setMetrixId(userId);
										for (var i = 0; i < otherEvents.length; i++) {
											otherEvents[i].user_id = userId;

										}

									}
								} catch (e) {}
		
								if (this.status < 400)
									metrixQueue.refreshMainQueue();
								if(otherEvents.length > 0)
									emptyQueue2(otherEvents, sendTime);
		
							} else {
								console.log('Analytic request Failed with Statuse ', this.status, '.');
								metrixQueue.relaxQueue();
								emptyQueue();
							}
						}
					});

					http.send(JSON.stringify(initEvent));


				}
			}
		}

		function emptyQueue() {

			if (localStorage.getItem(localStorageKeys.maneQueue) != null && metrixQueue.isGoodTimeToSendData()) {
				localStorage.setItem(localStorageKeys.lastTrySendData, Date.parse(Date()));
				if (numberOfTry < 3) {
					numberOfTry += 1;
					localStorage.setItem(localStorage.ajaxState, ajaxState.start);
					dcurrentTabAjaxState = ajaxState.start;
					metrixQueue.updateSubQueue();
					var sendTime = Date.parse(Date());
					emptyQueue2(JSON.parse(localStorage.getItem(localStorageKeys.subQueue)), sendTime)
					// let wwww = metrixEvent.sendObject(localStorage.getItem(localStorageKeys.subQueue));

					// http.send(wwww);
				} else
					numberOfTry = 0;
			}
		}


		//This function send custom name to the 
		MetrixAnalytics.prototype.sendCustomTrack = function(customName, customAttributes, customMetrics) {
			customMetrics = customMetrics || {};
			customAttributes = customAttributes || {};
			var value = metrixEvent.manualTrack(customAttributes, customMetrics, customName);
			addToQueue(value);
		}
		MetrixAnalytics.prototype.sendRevenue = function(customName, amount, currency, orderId) {
			var customMetrics = {
				_revenue: amount
			};
			var customAttributes = {
				_currency: currency,
				_order_id: orderId
			};
			var value = metrixEvent.manualTrack(customAttributes, customMetrics, customName);
			addToQueue(value);
		}
		MetrixAnalytics.setUserID = function(userID) {
			localStorage.setItem(metrixSessionId.uniqueMetrixId(), userID);
			//addToQueue(metrixEvent.customerIdSet());
		}

		var myTimerVar = setInterval(emptyQueue, metrixSettingAndMonitoring.queueUnloadTime);

		return MetrixAnalytics;
	})(MetrixAnalytics);

}