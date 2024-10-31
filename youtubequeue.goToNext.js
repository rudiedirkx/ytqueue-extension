(function() {
	const p = new URLSearchParams(document.currentScript.src.split('?')[1]);
	const vid = p.get('vid');

	try {
		if (window.ytQueueNavigateTo(vid) === true) return;
	} catch (ex) {}

	try {
		function searchForValueInObject(root, value, replacer) {
			const paths = [];
			const searched = [root];

			const matcher = typeof value == 'function' ? value : el => el === value;

			const iterable = (val) => {
				return val instanceof Object && typeof val != 'function' && !(val instanceof Node);
			};
			const search = (obj, path = []) => {
				for (let k in obj) {
					if (Object.hasOwn(obj, k)) {
						if (matcher(obj[k], k)) {
							paths.push(path.concat(k));
							if (replacer) {
								obj[k] = replacer(obj[k]);
							}
						}
						else if (iterable(obj[k])) {
							if (!searched.includes(obj[k])) {
								searched.push(obj[k]);
								search(obj[k], path.concat(k));
							}
						}
					}
				}
			};

			search(root);
			return paths;
		}

		const nexts = document.querySelectorAll('ytd-watch-next-secondary-results-renderer ytd-compact-video-renderer, ytd-watch-next-secondary-results-renderer .yt-lockup-view-model-wiz');
// console.log(nexts);
		const next = nexts[2];
		const curNextId = next.data.videoId || next.data.contentId;
		const matches = searchForValueInObject(next.data, v => typeof v == 'string' && v.includes(curNextId), v => v.replaceAll(curNextId, vid));
// console.log(matches, next.data);

		if ((next.data.videoId || next.data.contentId) !== vid) {
			throw new Error('`searchForValueInObject` replacement of `data.videoId` or `data.contentId` failed!?');
		}

		next.querySelector('a').click();
		return;
	} catch (ex) {
		console.warn('[YTQ] goToNext() failed', ex);
	}

	debugger;
	location.href = `https://www.youtube.com/watch?v=${vid}`;
})();
