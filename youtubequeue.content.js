const CHANNEL_OUT = new BroadcastChannel('youtubequeue');
const CHANNEL_IN = new BroadcastChannel('youtubequeue');

const VIDEO_ELEMENT_SELECTOR = 'ytd-video-renderer, ytd-compact-video-renderer, ytd-item-section-renderer, ytd-grid-video-renderer';

var stopNav = true;
var addedGlobalListeners = false;
var lastNextedTime = 0;
var lastNextedVid = null;
var currentVid = null;

function tick(callback) {
	var state, ticker, control, t1s, t2s;
	state = {active: true, iteration: 0};
	ticker = function(extra) {
		state.iteration++;
		callback(control);
		state.active && extra !== true && requestAnimationFrame(ticker);
	};
	requestAnimationFrame(ticker);
	t1s = setTimeout(ticker, 1000, true);
	t2s = setTimeout(ticker, 2000, true);
	control = {
		state: state,
		stop: function() {
			state.active = false;
			clearTimeout(t1s);
			clearTimeout(t2s);
		}
	};
	return control;
}

function execScript( script ) {
	var el = document.createElement('script');
	el.textContent = script;
	document.head.appendChild(el);
}

function getVid(uri) {
	return (uri.match(/[&?]v=([^&]+)/) || '')[1];
}

function getCurrentVid() {
	return getVid(document.location.href) || null;
}

function evalCurrentVid() {
	const newCurVid = getCurrentVid();
	// console.log('[YTQ] vid ', currentVid, 'vs', newCurVid);
	if ( currentVid != newCurVid ) {
		console.log('[YTQ] NEW VID: ' + newCurVid + ' (was ' + currentVid + ')');
		currentVid = newCurVid;

		removeCurrentVideo();
		setTimeout(addPlaylistClass, 200);
		setTimeout(addPlaylistClass, 1200);
		setQueueSize();
	}
}

function removeCurrentVideo() {
	const vid = getCurrentVid();
	if ( vid ) {
		removeQueue(vid);
	}
}

function addPlaylistClass() {
	const playlistPanels = [...document.querySelectorAll('ytd-playlist-panel-renderer > *')];
	document.body.classList.toggle('yt-queue-in-playlist', playlistPanels.filter(el => el.offsetHeight > 0).length > 0);
}

function currentVideoIsQueued() {
	const vid = getCurrentVid();
	return getQueue().some(item => item.vid == vid);
}

function getQueue() {
	return JSON.parse(localStorage.ytQueue || '[]');
}

function setQueue(queue) {
	localStorage.ytQueue = JSON.stringify(queue);

	CHANNEL_OUT.postMessage({command: 'size'});
}

function setQueueSize() {
	const size = getQueue().length;
	document.querySelectorAll('.yt-queue-size').forEach((el) => el.textContent = size);
	document.body.classList.toggle('yt-queue-non-empty', size > 0);
}

function getQueueNext() {
	const queue = getQueue();
	return queue[0] || null;
}

function addQueue(vid, title, duration) {
	if ( !vid || itemExists(vid) >= 0 ) return;

	const queue = getQueue();
	queue.push({vid, title, duration});
	setQueue(queue);
}

function removeQueue(vid) {
	const i = itemExists(vid);
	if ( i >= 0 ) {
		const queue = getQueue();
		queue.splice(i, 1);
		setQueue(queue);
	}
}

function itemExists(vid) {
	return getQueue().findIndex(item => item.vid == vid);
}

function goToNext(vid) {
	stopNav = false;
	setTimeout(() => stopNav = true, 1000);

	const s = document.createElement('script');
	const u = chrome.runtime.getURL(`youtubequeue.goToNext.js?vid=${vid}`);
	s.src = u;
	s.onload = function() {
		this.remove();
	};
	(document.head || document.documentElement).appendChild(s);
}

function addQueueListWindow() {
	var div = document.querySelector('#yt-queue-list');
	if ( div ) return div;

	div = document.createElement('div');
	div.id = 'yt-queue-list';
	document.body.appendChild(div);

	div.addEventListener('click', function(e) {
		if ( e.target.closest('a.delete') ) {
			e.preventDefault();
			const row = e.target.closest('li');
			removeQueue(row.dataset.vid);
		}
	}, true);

	div.addEventListener('click', function(e) {
		if ( e.target.closest('a.move') ) {
			e.preventDefault();

			const moving = div.querySelector('li.moving');
			const row = e.target.closest('li');
			if (moving === row) {
				row.classList.remove('moving');
			}
			else if (moving) {
				const queue = getQueue();
				const movingIndex = queue.findIndex(item => item.vid == moving.dataset.vid);
				const toIndex = queue.findIndex(item => item.vid == row.dataset.vid);
				const movingItem = queue.splice(movingIndex, 1);
				queue.splice(toIndex, 0, ...movingItem);

				setQueue(queue);
			}
			else {
				row.classList.add('moving');
			}
		}
	}, true);

	div.addEventListener('wheel', function(e) {
		if ( this.scrollHeight == this.offsetHeight ) {
			e.preventDefault();
			return;
		}

		if ( this.scrollTop == 0 ) {
			if ( e.deltaY < 0 ) {
				e.preventDefault();
			}
		}
		else if ( Math.abs(this.scrollTop + this.offsetHeight - this.scrollHeight) <= 1 ) {
			if ( e.deltaY > 0 ) {
				e.preventDefault();
			}
		}
	}, true);

	return div;
}

function makeQueueListItem(item) {
	const uri = 'https://www.youtube.com/watch?v=' + item.vid;
	return `<li data-vid="${item.vid}">
		<a href="#" class="delete">x</a>
		<a class="video thumb" href="${uri}">
			<img src="https://i.ytimg.com/vi/${item.vid}/hqdefault.jpg" />
		</a>
		<a class="video title" href="${uri}">
			${item.title} ${item.duration ? `(<span class="duration">${item.duration}</span>)` : ''}
		</a>
		<a href="#" class="move">⇕</a>
	</li>`;
}

function refreshQueueListWindow() {
	const div = addQueueListWindow();
	const queue = getQueue();

	const htmls = queue.map(makeQueueListItem);
	div.innerHTML = '<ul>' + htmls.join('') + '</ul>';

	// @todo Sorting
}

function toggleQueueListWindow(show) {
	const div = addQueueListWindow();
	div.classList.toggle('open', show);
}

function addGlobalListeners() {
	if ( addedGlobalListeners ) return;
	addedGlobalListeners = true;

	document.addEventListener('click', function(e) {
		if ( !e.target.closest('#yt-queue-open') && !e.path.includes(addQueueListWindow()) ) {
			toggleQueueListWindow(false);
		}
	});

	document.addEventListener('keydown', function(e) {
		if ( e.code === 'Escape' ) {
			toggleQueueListWindow(false);
		}
	});
}

function addQueueOpenButton($buttons) {
	const $btn = document.createElement('button');
	$btn.id = 'yt-queue-open';
	$btn.className = 'style-scope ytd-masthead style-default';
	$btn.innerHTML = 'Q <span class="yt-queue-size"></span>';
	$buttons.insertBefore($btn, $buttons.firstChild);

	setQueueSize();

	$btn.addEventListener('click', function(e) {
		e.preventDefault();

		refreshQueueListWindow();
		toggleQueueListWindow();
	});

	addGlobalListeners();
}

function addQueueAddButton($buttons) {
	const $btn = document.createElement('button');
	$btn.id = 'yt-queue-add';
	$btn.className = 'ytp-button';
	$btn.innerHTML = 'Q <span class="yt-queue-size"></span>';
	$buttons.appendChild($btn);

	setTimeout(setQueueSize);

	$btn.addEventListener('click', function(e) {
		e.preventDefault();

		const vid = getCurrentVid();
		if ( this.classList.contains('yt-queue-exists') ) {
			removeQueue(vid);
		}
		else {
			const title = document.querySelector('#container h1.title').innerText.trim();
			const duration = document.querySelector('.ytp-time-duration').innerText.trim();
			addQueue(vid, title, duration);
		}
	});
}

function addVideoToQueue($video) {
	const $link = $video.querySelector('a.yt-simple-endpoint.ytd-compact-video-renderer, a#video-title');
	const $title = $video.querySelector('#video-title');
	const $duration = $video.querySelector('ytd-thumbnail-overlay-time-status-renderer, span.ytd-thumbnail-overlay-time-status-renderer');
	addQueue(getVid($link.href), $title.innerText.trim(), $duration ? $duration.innerText.trim() : '');
}

function removeHilites() {
	document.querySelectorAll('.yt-queue-exists').forEach(el => el.classList.remove('yt-queue-exists'));
}

// Listen for tab changes or NEXT
CHANNEL_IN.addEventListener('message', function(e) {
	if ( e.data.command == 'size' ) {
console.log('[YTQ] incoming message', e.data);
		removeHilites();
		setQueueSize();
		refreshQueueListWindow();
		return;
	}

	if ( e.data.command == 'next' ) {
console.log('[YTQ] incoming message', e.data);
		var vid = getCurrentVid();
		if ( vid && e.data.from == vid ) {
			if ( document.querySelector('.ad-interrupting') ) {
				console.log('[YTQ] NO next, because ad');
				return;
			}

			const next = getQueueNext();
			console.log('[YTQ] next', next);
			if ( next ) {
				vid = next.vid;
				if ( lastNextedVid != vid ) {
					console.log('[YTQ] now nexting (' + vid + ' is not "' + lastNextedVid + '")');
					lastNextedVid = vid;

					goToNext(next.vid);
				}
				else {
					console.log('[YTQ] already nexted (' + vid + ')');
				}
			}
		}
		return;
	}
});

// Add OPEN QUEUE button & PLAYLIST class
tick(function() {
	const $button = document.querySelector('#yt-queue-open');
	if ( !$button ) {
		const $buttons = document.querySelector('#buttons, #yt-masthead-user');
		if ( $buttons ) {
			addQueueOpenButton($buttons);
			setTimeout(evalCurrentVid, 100);
		}
	}
});

// Add ADD TO QUEUE button
tick(function() {
	const $button = document.querySelector('#yt-queue-add');
	if ( !$button ) {
		const $buttons = document.querySelector('.html5-video-player .ytp-chrome-controls');
		if ( $buttons ) {
			addQueueAddButton($buttons);
			setTimeout(evalCurrentVid, 100);
		}
	}
});

// ADD TO QUEUE listener
document.addEventListener('click', function(e) {
	const $el = e.target.closest('[aria-label="Watch later"], [aria-label="Watch Later"]');
	if ( $el ) {
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();

		const $vidEl = $el.closest(VIDEO_ELEMENT_SELECTOR);
		if ( $vidEl ) {
			addVideoToQueue($vidEl);
		}
	}
}, true);

// END OF VIDEO listener
tick(function() {
	var endElement = document.querySelector('.ytp-endscreen-content a');
	if ( endElement && endElement.offsetHeight ) {
		if ( lastNextedTime + 1000 < Date.now() ) {
			lastNextedTime = Date.now();
			console.log('[YTQ] video endscreen');
			CHANNEL_OUT.postMessage({command: 'next', from: getCurrentVid()});
		}
	}
});

// NEW VIDEO listener
document.addEventListener('loadedmetadata', function(e) {
	console.log('[YTQ] loadedmetadata');
	setTimeout(evalCurrentVid, 100);
}, true);

// NEXT VIDEO listener
document.addEventListener('click', function(e) {
	const $el = e.target.closest('.ytp-next-button');
	if ( $el ) {
		var next = getQueueNext();
		if ( next ) {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();

			goToNext(next.vid);
		}
	}
}, true);

// HIGHLIGHT queue items
tick(function() {
	const curVid = getCurrentVid();

	getQueue().forEach(function(item) {
		const vid = item.vid;

		// Current video
		if ( curVid == vid ) {
			document.querySelector('#yt-queue-add').classList.add('yt-queue-exists');
		}

		// Links on page
		const links = document.querySelectorAll('a[href*="v=' + vid + '"]');
		links.forEach(el => {
			const box = el.closest(VIDEO_ELEMENT_SELECTOR);
			box && box.classList.add('yt-queue-exists');
		})
	});
});

window.addEventListener('beforeunload', function(e) {
	if ( stopNav ) {
		if ( getCurrentVid() ) {
			if ( getQueue().length && !currentVideoIsQueued() ) {
				e.preventDefault();
				return e.returnValue = 'stop';
			}
		}
	}
});
