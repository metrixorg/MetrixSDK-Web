if (typeof MetrixAnalytics === 'undefined') {

	/**
	 * Constructs a new MetrixAnalytics
	 * @constructor MetrixAnalytics
	 * @param options.appId Metrix ApplicationID
	 */
	var MetrixAnalytics = function(options) {
		this.setAppId(options.appId);
		this.initialize(options);
	};

	(function (MetrixAnalytics) {
		const metrixSettingAndMonitoring = {
			urlEvents: 'https://analytics.metrix.ir/v2/events',
			urlInit: 'https://analytics.metrix.ir/v2/init',
			timeOut: 5000,
			queueUnloadInterval: 10000,
			sessionExpirationTime: 60000,
			updateChunkNumber: 15,
			localQueueCapacity: 200
		};

		const ajaxState = {
			start: 'start',
			stop: 'stop',
			unused: 'unused'
		};

		let MetrixAppId = null;
		let documentReferrer = null;
		let appInfo = null;
		let uniqueDeviceId = null;
		let trackerToken = null;
		let geoInfo = null;
		let referrer = null;
		let numberOfTries = 0;
		let locationPathName = document.location.pathname;
		let currentTabAjaxState = ajaxState.unused;
		let lastSessionId = null;
		let lastSessionNumber = null;
		let browserPageInfo = null;
		// TODO: get this value from user
		let logEnabled = true;

		const requestHeaders = {
			authentication: 'X-Application-Id',
			contentType: 'Content-Type',
			ContentTypeValue: 'application/json;charset=UTF-8'
		};

		const localStorageKeys = {
			mainQueue: 'METRIX_LOCAL_OBJECT_QUEUE',
			sendingQueue: 'METRIX_LOCAL_SENDING_QUEUE',
			lastVisitTime: 'METRIX_LAST_VISIT_TIME',
			sessionDuration: 'METRIX_SESSION_DURATION',
			referrerPath: 'METRIX_REFERRER_PATH',
			sessionNumber: 'METRIX_SESSION_NUMBER',
			sessionId: 'METRIX_SESSION_ID',
			sessionIdLastReadTime: 'METRIX_LAST_SESSION_ID_READ_TIME',
			metrixId: 'METRIX_CHART_CLIENT_ID',
			lastDataSendTryTime: 'METRIX_LAST_DATA_SEND_TRY_TIME',
			lastDataSendTime: 'METRIX_LAST_DATA_SEND_TIME',
			ajaxState: 'METRIX_AJAX_STATE'
		};

		MetrixAnalytics.prototype.setAppId = function(id) {
			metrixLogger.info("Setting metrix AppID", {"appID": id});
			MetrixAppId = id;
		};

		/**
		 * Initializes MetrixAnalytics. This is called internally by the constructor and does
		 * not need to be called manually.
		 */
		MetrixAnalytics.prototype.initialize = function(options) {
			
			appInfo = {
				package: document.location.hostname ? document.location.hostname : document.location.pathname,
				// TODO: get these values from the user
				code: 1,
				version: "1.0"
			};

			if (typeof options.uniqueDeviceId === 'string' || options.uniqueDeviceId instanceof String) {
				uniqueDeviceId = options.uniqueDeviceId;
			} else {
				uniqueDeviceId = '';
			}

			trackerToken = options.trackerToken;
			geoInfo = options.geoInfo;
			referrer = Utils.getQueryString(document.location.search);

			metrixLogger.info("ّInitializing Metrix SDK", 
					{"appInfo": appInfo, 
					 "uniqueDeviceId": uniqueDeviceId, 
					 "trackerToken": trackerToken,
					 "geoInfo": geoInfo, 
					 "referrer": referrer});

			// Always assume that Javascript is the culprit of leaving the page
			// (we'll detect and intercept clicks on links and buttons as best
			// as possible and override this assumption in these cases):
			this.javascriptRedirect = true;

			Utils.onDomLoaded(function() {
				retrieveBrowserData();
				metrixSession.updateLastVisitTime();
				metrixLogger.debug("ّcalling to generate new session from initialize"), 
				metrixSession.generateNewSessionIfExpired();
			});
		};

		MetrixAnalytics.prototype.sendCustomTrack = function(customName, customAttributes, customMetrics) {
			metrixLogger.debug("ّsendCustomTrack was called"); 

			customMetrics = customMetrics || {};
			customAttributes = customAttributes || {};
			let value = metrixEvent.manualTrack(customAttributes, customMetrics, customName);
			addToQueue(value);
		};

		MetrixAnalytics.prototype.sendRevenue = function(customName, amount, currency, orderId) {
			metrixLogger.debug("ّsendRevenue was called"); 

			let customMetrics = {
				_revenue: amount
			};
			let customAttributes = {
				_currency: currency,
				_order_id: orderId
			};
			let value = metrixEvent.manualTrack(customAttributes, customMetrics, customName);
			addToQueue(value);
		};

		let clientId = {};

		clientId.setMetrixId = function(value) {
			metrixLogger.debug("ّsetting metrix id", value); 

			localStorage.setItem(localStorageKeys.metrixId, value);
		};

		clientId.getMetrixId = function() {
			return localStorage.getItem(localStorageKeys.metrixId);
		};

		let metrixEvent = {};

		metrixEvent.userIdentificationInfo = function() {
			let value;
			if (browserPageInfo !== null) {
				value = {
					deviceLanguage: browserPageInfo.locale.language,
					platform: browserPageInfo.browser.platform,
					screen: {
						height: browserPageInfo.screen.height,
						width: browserPageInfo.screen.width,
						color_depth: browserPageInfo.screen.colorDepth
					},
					os: {
						name: browserPageInfo.browser.mobileOs,
						version: 0,
						version_name: browserPageInfo.browser.mobileOsVersion
					},
					cpuCore: browserPageInfo.screen.cpuCore,
					gpu: browserPageInfo.screen.gpu
				}
			}

			return value;
		};

		metrixEvent.makeBaseEventInfo = function(eventType) {
			let value = {};
			metrixSession.generateNewSessionIfExpired();
			value.user_id = clientId.getMetrixId();
			value.session_id = metrixSession.getSessionId();
			value.session_num = metrixSession.getSessionNumber();
			value.event_time = Utils.getFormattedCurrentTime();
			let currentTimeMillis = (new Date()).getTime();

			if (eventType !== "session_start") {
				return value;
			}

			value.install_info = {
				install_complete_timestamp: currentTimeMillis,
				update_timestamp: currentTimeMillis,
				referrer_url: referrer
			};
			value.sdk_version = "0.1.0";

			let connectionInfo = {};

			if (browserPageInfo !== null) {
				connectionInfo.protocol = browserPageInfo.document.url.protocol;
				connectionInfo.browser_ua = browserPageInfo.browser.ua;
				connectionInfo.browser_name = browserPageInfo.browser.name;
				connectionInfo.browser_version = browserPageInfo.browser.version;
			}

			let ie = Utils.detectIE();
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

			return value;
		};

		metrixEvent.sessionStop = function() {
			let value = this.makeBaseEventInfo("session_stop");
			value.session_id = lastSessionId;
			value.session_num = lastSessionNumber;
			value.duration_millis = metrixSession.getSessionDuration();
			value.event_type = 'session_stop';
			return value;
		};

		metrixEvent.sessionStart = function() {
			let value = this.makeBaseEventInfo("session_start");
			value.event_type = 'session_start';
			return value;
		};

		metrixEvent.manualTrack = function(customAttributes, customMetrics, customName) {
			let value = metrixEvent.makeBaseEventInfo("custom");

			value.event_type = 'custom';
			value.slug = customName;
			value.attributes = customAttributes;
			value.metrics = customMetrics;

			return value;
		};

		let metrixQueue = {};

		metrixQueue.getMainQueue = function() {
			return JSON.parse(localStorage.getItem(localStorageKeys.mainQueue));
		};

		metrixQueue.setMainQueue = function(newQueue) {
			metrixLogger.debug("ّsetting mainQueue", newQueue); 

			localStorage.setItem(localStorageKeys.mainQueue, newQueue);
		};

		metrixQueue.getSendingQueue = function() {
			return JSON.parse(localStorage.getItem(localStorageKeys.sendingQueue));
		};

		metrixQueue.setSendingQueue = function(newQueue) {
			metrixLogger.debug("ّsetting sendingQueue", newQueue); 

			localStorage.setItem(localStorageKeys.sendingQueue, newQueue);
		};

		metrixQueue.getLastDataSendTime = function() {
			let time = localStorage.getItem(localStorageKeys.lastDataSendTime);
			if (time != null) {
				return Number(time);
			}
			return null;
		};

		metrixQueue.setLastDataSendTime = function(time) {
			metrixLogger.debug("ّsetting lastDataSendTime", time); 

			localStorage.setItem(localStorageKeys.lastDataSendTime, time);
		};

		metrixQueue.getLastDataSendTryTime = function() {
			let time = localStorage.getItem(localStorageKeys.lastDataSendTryTime);
			if (time != null) {
				return Number(time);
			}
			return null;
		};

		metrixQueue.setLastDataSendTryTime = function() {
			let time = Utils.getCurrentTime();
			metrixLogger.debug("ّsetting lastDataSendTryTime", time); 

			localStorage.setItem(localStorageKeys.lastDataSendTryTime, time);
		};

		// TODO: WTF??
		metrixQueue.breakHeavyQueue = function() {			
			let storedQueue = this.getMainQueue() || [];
			const eventPriorities = ['session_start', 'session_stop', 'custom'];
			
			metrixLogger.debug("ّbreakHeavyQueue was called", storedQueue); 

			if (storedQueue.length > metrixSettingAndMonitoring.localQueueCapacity)
				this.setMainQueue(JSON.stringify(removeLastSession(storedQueue)));
			else {
				metrixLogger.debug("ّmain queue was not large enough to break"); 
			}

			function removeLastSession(inputQueue) {
				let newQueue = [];
				let i, len;
				for (i = 0, len = inputQueue.length; i < len; ++i) {
					let event = inputQueue[i];
					if (eventPriorities.indexOf(event.event_type) !== -1)
						newQueue.push(event);
				}
				return newQueue;
			}
		};

		metrixQueue.isQueueNotLargeEnoughToSend = function() {
			let storedQueue = this.getMainQueue() || [];
			return storedQueue.length <= metrixSettingAndMonitoring.updateChunkNumber;
		};

		metrixQueue.removeSendingState = function() {
			metrixLogger.debug("ّremoving sending queue"); 
			
			localStorage.removeItem(localStorageKeys.sendingQueue);
			currentTabAjaxState = ajaxState.stop;
			localStorage.setItem(localStorageKeys.ajaxState, 'stop');
		};

		metrixQueue.isGoodTimeToSendData = function() {

			let lastSendTime = this.getLastDataSendTime();
			metrixLogger.debug("ّchecking for right time to send data", {'lastSendTime': lastSendTime, "numberOfTries": numberOfTries}); 

			if (lastSendTime != null) {
				let diff = Utils.getCurrentTime() - lastSendTime;
				if (diff < metrixSettingAndMonitoring.queueUnloadInterval && this.isQueueNotLargeEnoughToSend()){
					metrixLogger.debug("returning false", {'time since lastSendTime': diff}); 
					return false;
				}

				// In some cases, (for example when the app is force-stopped), ajax state resets
				let lastSendTryTime = this.getLastDataSendTryTime();
				if (lastSendTryTime != null) {
					let diffTry = Utils.getCurrentTime() - lastSendTryTime;
					if (diffTry > 3 * metrixSettingAndMonitoring.timeOut + metrixSettingAndMonitoring.queueUnloadInterval) {
						this.removeSendingState();
						numberOfTries = 0;
					}
				} else {
					this.removeSendingState();
					numberOfTries = 0;
				}
			}
			
			let result = localStorage.getItem(localStorageKeys.ajaxState) !== ajaxState.start.toString();
			metrixLogger.debug("returning " + result, {"numberOfTries": numberOfTries}); 
			return result;
		};

		metrixQueue.refreshQueues = function() {
			let storedQueue = this.getMainQueue() || [];
			let storedSendingQueue = this.getSendingQueue() || [];

			metrixLogger.debug("refreshing the queues", {"oldMainQueue": storedQueue, "oldSendingQueue": storedSendingQueue}); 

			storedQueue.splice(0, storedSendingQueue.length);
			if (storedQueue.length === 0) {
				localStorage.removeItem(localStorageKeys.mainQueue);
			}
			else {
				this.setMainQueue(JSON.stringify(storedQueue));
			}

			this.removeSendingState();

			if (this.isQueueNotLargeEnoughToSend() === false)
				initDataSending();
		};

		metrixQueue.updateSendingQueue = function() {
			let storedQueue = metrixQueue.getMainQueue() || [];
			metrixQueue.setSendingQueue(JSON.stringify(storedQueue.slice(0, metrixSettingAndMonitoring.updateChunkNumber)));
		};

		function addToQueue(value) {
			metrixLogger.debug("addToQueue was called", value); 

			if (value.session_num < 0) {
				return;
			}
			if (MetrixAppId != null) {
				let storedQueue = metrixQueue.getMainQueue() || [];
				storedQueue.push(value);
				metrixQueue.setMainQueue(JSON.stringify(storedQueue));
				
				metrixLogger.info("new Event was added to main queue", value); 

				// If our queue is larger than the queueCapacity, it's oldest items will be removed
				metrixQueue.breakHeavyQueue();

				// If no ack is received, no data will be sent, which is checked with the length of sendingQueue.
				if (metrixQueue.isQueueNotLargeEnoughToSend() === false && metrixQueue.getSendingQueue() == null)
					initDataSending();
			}
		}

		// This function is called before attempting to send data to set time, check numberOfTries and set SendingQueue
		function initDataSending() {
			metrixLogger.debug("initDataSending was called", {"numberOfTries": numberOfTries}); 

			if (metrixQueue.getMainQueue() != null && metrixQueue.isGoodTimeToSendData()) {
				metrixQueue.setLastDataSendTryTime();
				if (numberOfTries < 3) {
					numberOfTries += 1;
					localStorage.setItem(localStorage.ajaxState, ajaxState.start);
					currentTabAjaxState = ajaxState.start;
					metrixQueue.updateSendingQueue();
					let sendTime = Utils.getCurrentTime();
					attemptDataSending(metrixQueue.getSendingQueue(), sendTime)
				} else {
					numberOfTries = 0;
				}
			}
		}

		function attemptDataSending(values, sendTime) {
			let http = new XMLHttpRequest();
			let metrixId = clientId.getMetrixId();

			metrixLogger.info("attemptDataSending called", {"metrixId": metrixId, "session number": metrixSession.getSessionNumber(), "values": values}); 

			if (metrixId) {
				http.open("POST", metrixSettingAndMonitoring.urlEvents, true);
			} else {
				http.open("POST", metrixSettingAndMonitoring.urlInit, true);
			}

			http.setRequestHeader(requestHeaders.authentication, MetrixAppId);
			http.setRequestHeader(requestHeaders.contentType, requestHeaders.ContentTypeValue);
			http.timeout = metrixSettingAndMonitoring.timeOut;

			if (values != null) {
				if (metrixId) {
					http.addEventListener("readystatechange", function() {
						if (this.readyState === 4) {
							metrixLogger.debug("response received", {"status code": this.status}); 

							if (this.status >= 200 && this.status <= 500) {
								numberOfTries = 0;
								// Update the time of data sending -> is used in isGoodTimeToSendData function
								metrixQueue.setLastDataSendTime(sendTime);

								if (this.status < 400){
									metrixLogger.debug("calling to refresh queues"); 
									metrixQueue.refreshQueues();
								}

							} else {
								metrixLogger.error("request failed", {"status code": this.status});
								metrixQueue.removeSendingState();
								initDataSending();
							}
						}
					});
					http.send(JSON.stringify(values));
				} else {
					let initEvent = values[0];
					let otherEvents = values.slice(1, values.length);
					metrixLogger.debug("null metrixId. sending first event to init", {"first event": initEvent, "other events": otherEvents}); 

					http.addEventListener("readystatechange", function() {
						if (this.readyState === 4) {
							metrixLogger.debug("response received", {"status code": this.status}); 

							if (this.status >= 200 && this.status <= 500) {
								numberOfTries = 0;
								// Update the time of data sending -> is used in isGoodTimeToSendData function
								metrixQueue.setLastDataSendTime(sendTime);
								try {
									let receivedValue = JSON.parse(this.responseText);
									if ('user_id' in receivedValue) {
										let userId = receivedValue.user_id;
										clientId.setMetrixId(userId);
										for (let i = 0; i < otherEvents.length; i++) {
											otherEvents[i].user_id = userId;
										}
									}
									metrixLogger.debug("response received", {"status code": this.status, "response": receivedValue}); 

								} catch (e) {
									metrixLogger.error("error parsing http response", {"status code": this.status, "error": e}); 
								}

								if (this.status < 400){
									metrixLogger.debug("calling to refresh queues"); 
									metrixQueue.refreshQueues();
								}
								if (otherEvents.length > 0) {
									metrixLogger.debug("calling to send other events");
									// TODO: there is a bug here. If this attempt fails, the so-called "other events" will be lost.
									attemptDataSending(otherEvents, sendTime);
								}

							} else {
								metrixLogger.error("request failed", {"status code": this.status});
								metrixQueue.removeSendingState();
								initDataSending();
							}
						}
					});
					http.send(JSON.stringify(initEvent));
				}
			}
		}

		let metrixSession = {};

		metrixSession.updateLastVisitTime = function() {
			metrixLogger.debug("updating lastVisitTime");

			localStorage.setItem(localStorageKeys.lastVisitTime, Utils.getCurrentTime());
		};

		metrixSession.getLastVisitTime = function() {
			return Number(localStorage.getItem(localStorageKeys.lastVisitTime));
		};

		metrixSession.resetSessionDuration = function() {
			metrixLogger.debug("reseting session duration");

			localStorage.setItem(localStorageKeys.sessionDuration, "0");
			this.updateLastVisitTime();
		};

		metrixSession.getSessionDuration = function() {
			return Number(localStorage.getItem(localStorageKeys.sessionDuration));
		};

		metrixSession.updateSessionDuration = function() {
			let addedTime = Utils.getCurrentTime() - this.getLastVisitTime();
			let newDuration = this.getSessionDuration() + addedTime;

			metrixLogger.debug("updating session duration", {"new duration": newDuration});

			localStorage.setItem(localStorageKeys.sessionDuration, newDuration.toString());
		};

		metrixSession.getSessionIdLastReadTime = function() {
			let value = localStorage.getItem(localStorageKeys.sessionIdLastReadTime);
			if (value != null) return Number(value);
			else return null
		};

		metrixSession.setSessionIdLastReadTime = function() {
			metrixLogger.debug("setting sessionIdLastReadTime");

			localStorage.setItem(localStorageKeys.sessionIdLastReadTime, Utils.getCurrentTime().toString());
		};

		metrixSession.sessionIdHasBeenRead = function() {
			return (this.getSessionIdLastReadTime() != null);
		};

		metrixSession.getSessionId = function() {
			return localStorage.getItem(localStorageKeys.sessionId);
		};

		metrixSession.renewSessionId = function() {
			let newSessionId = Utils.genGuid();
			localStorage.setItem(localStorageKeys.sessionId, newSessionId);
		
			metrixLogger.debug("sessionID was renewed", {"new sessionID": newSessionId});
		};

		metrixSession.getSessionNumber = function() {
			if (this.sessionIdHasBeenRead()) {
				return Number(localStorage.getItem(localStorageKeys.sessionNumber));
			}
			return 0;
		};

		metrixSession.incrementSessionNumber = function() {
			if (this.sessionIdHasBeenRead()) {
				let count = this.getSessionNumber();
				count += 1;
				localStorage.setItem(localStorageKeys.sessionNumber, count.toString());
				metrixLogger.debug("session number was set to " + count);

			} else {
				localStorage.setItem(localStorageKeys.sessionNumber, '0');
				metrixLogger.debug("session number was set to 0");
			}
		};

		metrixSession.getDocumentReferrer = function() {
			return localStorage.getItem(localStorageKeys.referrerPath);
		};

		metrixSession.setDocumentReferrer = function() {
			localStorage.setItem(localStorageKeys.referrerPath, document.referrer);

			metrixLogger.debug("document referrer was set to " + document.referrer);
		};

		metrixSession.referrerHasNotChanged = function() {
			let referrerHostname = Utils.parseUrl(document.referrer).hostname;
			return location.hostname === referrerHostname ||
				document.referrer === this.getDocumentReferrer();
		};

		metrixSession.generateNewSessionIfExpired = function() {
			/**
			 * The session is expired in two states.
			 * 1. The difference of timestamp of the last event and now is more than session expireTime.
			 * 2. The hostname of current page referrer was not equal to the host name of first-page referrer or page hostname.
			 */
			
			metrixLogger.debug("generateNewSessionIfExpired called", {"session number": metrixSession.getSessionNumber()});

			if (this.sessionIdHasBeenRead() && this.getSessionId() != null && metrixSession.referrerHasNotChanged()) {
				let timeSinceLastEvent = Utils.getCurrentTime() - this.getSessionIdLastReadTime();
				if (timeSinceLastEvent < metrixSettingAndMonitoring.sessionExpirationTime) {
					this.setSessionIdLastReadTime();
					metrixLogger.debug("session not expired");
					return;
				}
			}

			// If we are here, new session should be generated
			metrixLogger.debug("new session should be generated. generating...");

			this.incrementSessionNumber();

			lastSessionNumber = this.getSessionNumber() - 1;
			lastSessionId = this.getSessionId();

			this.setSessionIdLastReadTime();
			this.renewSessionId();
			this.setDocumentReferrer();

			// TODO: check whether this if statement is actually necessary
			// if (lastSessionNumber) {
			metrixSession.updateSessionDuration();
			addToQueue(metrixEvent.sessionStop());
			// }
			metrixSession.resetSessionDuration();
			addToQueue(metrixEvent.sessionStart());
		};

		function retrieveBrowserData() {
			browserPageInfo = Env.getPageLoadData();
			browserPageInfo.url =  Utils.parseUrl(document.location + '');
		}

		window.addEventListener('blur', function() {
			metrixLogger.debug("'blur' event was detected. calling to update session duration");
			metrixSession.updateSessionDuration();
		});

		window.addEventListener('focus', function() {
			metrixLogger.debug("'focus' event was detected. calling to update lastVisitTime");
			metrixSession.updateLastVisitTime();
		});

		window.addEventListener("beforeunload", function() {
			metrixLogger.debug("'beforeunload' event was detected. calling to update session duration");
			metrixSession.updateSessionDuration();
			if (currentTabAjaxState !== ajaxState.unused) {
				metrixQueue.removeSendingState();
			}
		}, false);

		// Browser Detection
		let BrowserDetect = (function () {
			let BrowserDetect = {
				init: function () {
					this.browser = this.searchString(this.dataBrowser) || "An unknown browser";
					this.version = this.searchVersion(navigator.userAgent) ||
						this.searchVersion(navigator.appVersion) ||
						"an unknown version";
					this.OS = this.searchString(this.dataOS) || "an unknown OS";
					this.mobileOsVersion = this.searchOsVersion(navigator.userAgent);
					this.mobileOs = this.searchOs(navigator.userAgent);
				},
				searchOsVersion: function (uAgent) {
					let root = uAgent.substring(uAgent.indexOf("(") + 1, uAgent.indexOf(")"));
					let splits = root.split(";");
					let os;
					let version;
					for (let i = 0; i < splits.length; i++) {
						os = splits[i].trim();
						if (os.startsWith("Android")) {
							version = os.split(" ")[1];

						} else if (os.startsWith("CPU")) {
							version = os.split(" ")[3];
						}
					}
					return version;
				},
				searchOs: function (uAgent) {
					let root = uAgent.substring(uAgent.indexOf("(") + 1, uAgent.indexOf(")"));
					let splits = root.split(";");
					let os;
					let version;
					for (let i = 0; i < splits.length; i++) {
						os = splits[i].trim();
						if (os.toString().startsWith("Android")) {
							version = os.split(" ")[0];

						} else if (os.startsWith("CPU")) {
							version = os.split(" ")[1];
						}
					}
					return version;
				},
				searchString: function (data) {
					for (let i = 0; i < data.length; i++) {
						let dataString = data[i].string;
						let dataProp = data[i].prop;
						this.versionSearchString = data[i].versionSearch || data[i].identity;
						if (dataString) {
							if (dataString.indexOf(data[i].subString) !== -1)
								return data[i].identity;
						} else if (dataProp)
							return data[i].identity;
					}
				},
				searchVersion: function (dataString) {
					let index = dataString.indexOf(this.versionSearchString);
					if (index === -1) return;
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
				}, { // for newer Netscape (6+)
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
				}, { // for older Netscape (4-)
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

		let Env = {};

		Env.getPageLoadData = function() {
			return {
				browser: Env.getBrowserData(),
				document: Env.getDocumentData(),
				screen: Env.getScreenData(),
				locale: Env.getLocaleData()
			};
		};

		Env.getBrowserData = function() {
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

		Env.getDocumentData = function() {
			return ({
				title: document.title,
				referrer: document.referrer && Utils.parseUrl(document.referrer) || undefined,
				url: Env.getUrlData()
			});
		};

		Env.getScreenData = function() {
			function getGraphicsCardName() {
				let canvas = document.createElement("canvas");
				let gl = canvas.getContext("experimental-webgl") || canvas.getContext("webgl");
				if (!gl) {
					return "Unknown";
				}
				let ext = gl.getExtension("WEBGL_debug_renderer_info");
				if (!ext) {
					return "Unknown";
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
			let results = new RegExp('([A-Z]+-[0-9]+) \\(([A-Z]+)\\)').exec((new Date()).toString());
			let gmtOffset, timezone;

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

		Env.getUrlData = function() {
			let l = document.location;
			documentReferrer = document.referrer;
			return ({
				hash: l.hash,
				host: l.host,
				hostname: l.hostname,
				pathname: locationPathName,
				protocol: l.protocol,
				referrer: documentReferrer,
				query: Utils.parseQueryString(l.search)
			});
		};

		Env.getPluginsData = function() {
			let plugins = [];
			let p = navigator.plugins;
			for (let i = 0; i < p.length; i++) {
				let pi = p[i];
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

		let Utils = {};

		Utils.onDomLoaded = function(f) {
			if (document.body != null) f();
			else setTimeout(function() {
				this.onDomLoaded(f);
			}, 10);
		};

		Utils.getCurrentTime = function() {
			let d = new Date();
			return Date.parse(d.toString()) + d.getMilliseconds();
		};

		Utils.getFormattedCurrentTime = function () {
			let current_datetime = new Date();
			return current_datetime.getUTCFullYear() + "-" + (current_datetime.getUTCMonth() + 1) + "-" + current_datetime.getUTCDate() + "T" + current_datetime.getUTCHours() + ":" + current_datetime.getUTCMinutes() + ":" + current_datetime.getUTCSeconds() + "." + current_datetime.getUTCMilliseconds() + "Z";
		};

		Utils.genGuid = function() {
			function s4() {
				return Math.floor((1 + Math.random()) * 0x10000)
					.toString(16)
					.substring(1);
			}
			return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
				s4() + '-' + s4() + s4() + s4();
		};

		Utils.getQueryString = function(qs) {
			if (qs.length > 0) {
				return qs.charAt(0) === '?' ? qs.substring(1) : qs;
			}
			return null;
		};

		Utils.parseQueryString = function(qs) {
			let pairs = {};

			if (qs.length > 0) {
				let query = qs.charAt(0) === '?' ? qs.substring(1) : qs;

				if (query.length > 0) {
					let vars = query.split('&');
					for (let i = 0; i < vars.length; i++) {
						if (vars[i].length > 0) {
							let pair = vars[i].split('=');
							try {
								let name = decodeURIComponent(pair[0]);
								pairs[name] = (pair.length > 1) ? decodeURIComponent(pair[1]) : 'true';
							} catch (e) {}
						}
					}
				}
			}
			return pairs;
		};

		Utils.parseUrl = function(url) {
			let l = document.createElement("a");
			l.href = url;
			return {
				hash: l.hash,
				host: l.host,
				hostname: l.hostname,
				pathname: l.pathname,
				protocol: l.protocol,
				query: Utils.parseQueryString(l.search)
			};
		};

		Utils.detectIE = function () {
			let ua = window.navigator.userAgent;
			let msie = ua.indexOf('MSIE ');
			if (msie > 0) {
				return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
			}
			let trident = ua.indexOf('Trident/');
			if (trident > 0) {
				let rv = ua.indexOf('rv:');
				return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
			}
			let edge = ua.indexOf('Edge/');
			if (edge > 0) {
				return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
			}
			return false;
		};

		let metrixLogger = {};

		metrixLogger.log = function(message, ...optionalParams) {
			if (logEnabled) {
				console.log(message, optionalParams);
			}
		}

		metrixLogger.info = function(message, ...optionalParams) {
			if (logEnabled) {
				console.info(message, optionalParams);
			}
		}

		metrixLogger.debug = function(message, ...optionalParams) {
			if (logEnabled) {
				console.debug(message, optionalParams);
			}
		}

		metrixLogger.warn = function(message, ...optionalParams) {
			if (logEnabled) {
				console.warn(message, optionalParams);
			}
		}

		metrixLogger.error = function(message, ...optionalParams) {
			if (logEnabled) {
				console.error(message, optionalParams);
			}
		}

		metrixLogger.trace = function(message, ...optionalParams) {
			if (logEnabled) {
				console.trace(message, optionalParams);
			}
		}

		var myTimerVar = setInterval(initDataSending, metrixSettingAndMonitoring.queueUnloadInterval);

		return MetrixAnalytics;
	})(MetrixAnalytics);
}
