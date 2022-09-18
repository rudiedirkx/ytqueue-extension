(function() {
	const p = new URLSearchParams(document.currentScript.src.split('?')[1]);
	const vid = p.get('vid');

	try {
		if (window.ytQueueNavigateTo(vid) === true) return;
	} catch (ex) {}

	try {
		document.querySelector('#page-manager > ytd-watch').navigateToVideo_(vid);
		return;
	} catch (ex) {}

	try {
		document.querySelector('ytd-watch-flexy').navigateToVideo_(vid);
		return;
	} catch (ex) {}

	try {
		document.querySelector('#nav').navigate({
			"clickTrackingParams": "x",
			"commandMetadata": {
				"webCommandMetadata": {
					"url": `/watch?v=${vid}`,
					"webPageType":"WEB_PAGE_TYPE_WATCH",
					"rootVe":3832
				}
			},
			"watchEndpoint": {
				"videoId": vid,
				"nofollow": true
			}
		});
		return;
	} catch (ex) {}

	location.href = `https://www.youtube.com/watch?v=${vid}`;
})();
