// WorkTunes MVP - Main Application Logic

class WorkTunesApp {
    constructor() {
        this.timer = {
            minutes: 25,
            seconds: 0,
            isRunning: false,
            intervalId: null
        };
        
        this.audio = {
            player: document.getElementById('audioPlayer'),
            currentTrack: null,
            currentCategory: null,
            volume: 0.5
        };
        this.youtube = {
            iframe: document.getElementById('youtube-player'),
        };
        
        this.workLog = JSON.parse(localStorage.getItem('workTunesLog') || '[]');
        this.playlists = JSON.parse(localStorage.getItem('workTunesPlaylists') || '[]');
        this.userTracks = JSON.parse(localStorage.getItem('userTracks') || '[]'); // MP3
        this.youtubeTracks = JSON.parse(localStorage.getItem('youtubeTracks') || '[]'); // YouTube links
        this.playback = {
            loop: false,
            shuffle: false,
            queue: [],
            currentIndex: -1,
            filter: 'All' // can be category name or 'playlist:<id>'
        };

        // Session tracking for accurate elapsed time and unload logging
        this.session = {
            initialTotalSec: 25 * 60,
            completed: false,
        };
        
        this.initializeEventListeners();
        this.updateTimerDisplay();
        this.loadWorkLog();
        this.renderFilterOptions();
        this.renderMusicList();
        this.renderPlaylistsList();
    }

    initializeEventListeners() {
        // Timer presets
        document.querySelectorAll('.timer-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const minutes = parseInt(target.dataset.minutes);
                this.setTimer(minutes, 0);
            });
        });

        // Work Log modal open/close
        const openWL = document.getElementById('openWorkLogBtn');
        const wlModal = document.getElementById('workLogModal');
        const wlClose = document.getElementById('workLogCloseBtn');
        if (openWL && wlModal) {
            openWL.addEventListener('click', () => this.openWorkLogModal());
        }
        if (wlModal) {
            wlModal.addEventListener('click', (e) => {
                if (e.target && e.target.getAttribute('data-close') === '1') {
                    this.closeWorkLogModal();
                }
            });
        }
        if (wlClose) wlClose.addEventListener('click', () => this.closeWorkLogModal());

        // Custom timer
        document.getElementById('setCustom').addEventListener('click', () => {
            const customMinutes = parseInt(document.getElementById('customMinutes').value);
            if (customMinutes && customMinutes > 0 && customMinutes <= 120) {
                this.setTimer(customMinutes, 0);
            }
        });

        // Play/Pause button
        document.getElementById('playPauseBtn').addEventListener('click', () => {
            this.toggleTimer();
        });

        // Complete (early finish) button with confirmation
        const completeBtn = document.getElementById('completeSessionBtn');
        if (completeBtn) {
            completeBtn.addEventListener('click', () => {
                if (!this.hasWorkInput()) {
                    alert('Please enter what you are working on');
                    return;
                }
                const ok = confirm('Finish this session now and log the elapsed time?');
                if (ok) {
                    this.completeEarly();
                }
            });
        }

        // Music filter (All/lofi/nature/jazz/user)
        const filterSelect = document.getElementById('musicFilter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                const val = e.target.value;
                this.playback.filter = val;
                this.renderMusicList();
            });
        }

        // Loop / Shuffle controls
        const loopBtn = document.getElementById('loopBtn');
        const shuffleBtn = document.getElementById('shuffleBtn');
        if (loopBtn) {
            loopBtn.addEventListener('click', () => {
                this.playback.loop = !this.playback.loop;
                loopBtn.setAttribute('aria-pressed', String(this.playback.loop));
                loopBtn.classList.toggle('bg-blue-600', this.playback.loop);
                loopBtn.classList.toggle('border-blue-600', this.playback.loop);
            });
        }
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => {
                this.playback.shuffle = !this.playback.shuffle;
                shuffleBtn.setAttribute('aria-pressed', String(this.playback.shuffle));
                shuffleBtn.classList.toggle('bg-blue-600', this.playback.shuffle);
                shuffleBtn.classList.toggle('border-blue-600', this.playback.shuffle);
            });
        }

        // Music play/pause buttons
        const musicPlayBtn = document.getElementById('musicPlayBtn');
        const musicPauseBtn = document.getElementById('musicPauseBtn');
        if (musicPlayBtn) {
            musicPlayBtn.addEventListener('click', () => {
                if (!this.audio.currentTrack) {
                    const tracks = this.getFilteredTracks();
                    if (tracks.length > 0) {
                        this.playTrack(tracks[0]);
                    }
                } else {
                    if (this.audio.currentTrack.type === 'youtube') {
                        this.loadYouTubeVideo(this.audio.currentTrack.url);
                    } else {
                        this.audio.player.play().catch(() => {});
                    }
                }
            });
        }
        if (musicPauseBtn) {
            musicPauseBtn.addEventListener('click', () => {
                if (this.audio.currentTrack && this.audio.currentTrack.type === 'youtube') {
                    this.stopYouTube();
                } else {
                    this.audio.player.pause();
                }
            });
        }

        // Music list click (event delegation)
        const musicList = document.getElementById('musicList');
        if (musicList) {
            musicList.addEventListener('click', (e) => {
                // Playlist header actions when a playlist is selected in filter
                const header = e.target.closest('[data-selected-pl-id]');
                if (header) {
                    const pid = header.getAttribute('data-selected-pl-id');
                    if (e.target.closest('[data-action="edit"]')) {
                        this.openPlaylistModal(pid);
                        return;
                    }
                    if (e.target.closest('[data-action="delete"]')) {
                        this.deletePlaylist(pid);
                        return;
                    }
                }

                // Track click
                const item = e.target.closest('[data-track-id]');
                if (item) {
                    const trackId = item.getAttribute('data-track-id');
                    this.playTrackById(trackId);
                }
            });
        }

        // Volume control (bottom bar)
        const volumeSliderBottom = document.getElementById('volumeSliderBottom');
        if (volumeSliderBottom) {
            volumeSliderBottom.addEventListener('input', (e) => {
                this.setVolume(e.target.value / 100);
            });
            // initialize UI to current volume
            volumeSliderBottom.value = Math.round(this.audio.volume * 100);
            const vd = document.getElementById('volumeDisplayBottom');
            if (vd) vd.textContent = Math.round(this.audio.volume * 100);
        }

        // Bottom player: play/pause/shuffle/loop
        const playerPlayBtn = document.getElementById('playerPlayBtn');
        const playerPauseBtn = document.getElementById('playerPauseBtn');
        const playerShuffleBtn = document.getElementById('playerShuffleBtn');
        const playerLoopBtn = document.getElementById('playerLoopBtn');
        if (playerPlayBtn) {
            playerPlayBtn.addEventListener('click', () => {
                if (!this.audio.currentTrack) {
                    const tracks = this.getFilteredTracks();
                    if (tracks.length > 0) this.playTrack(tracks[0]);
                } else {
                    if (this.audio.currentTrack.type === 'youtube') {
                        this.loadYouTubeVideo(this.audio.currentTrack.url);
                    } else {
                        this.audio.player.play().catch(() => {});
                    }
                }
            });
        }
        if (playerPauseBtn) {
            playerPauseBtn.addEventListener('click', () => {
                if (this.audio.currentTrack && this.audio.currentTrack.type === 'youtube') {
                    this.stopYouTube();
                } else {
                    this.audio.player.pause();
                }
            });
        }
        if (playerShuffleBtn) {
            playerShuffleBtn.addEventListener('click', () => {
                this.playback.shuffle = !this.playback.shuffle;
                playerShuffleBtn.setAttribute('aria-pressed', String(this.playback.shuffle));
                playerShuffleBtn.classList.toggle('bg-blue-600', this.playback.shuffle);
                playerShuffleBtn.classList.toggle('border-blue-600', this.playback.shuffle);
            });
        }
        if (playerLoopBtn) {
            playerLoopBtn.addEventListener('click', () => {
                this.playback.loop = !this.playback.loop;
                playerLoopBtn.setAttribute('aria-pressed', String(this.playback.loop));
                playerLoopBtn.classList.toggle('bg-blue-600', this.playback.loop);
                playerLoopBtn.classList.toggle('border-blue-600', this.playback.loop);
            });
        }

        // Seek slider
        const seekSlider = document.getElementById('seekSlider');
        if (seekSlider) {
            seekSlider.addEventListener('input', (e) => {
                const pct = Number(e.target.value) / 100;
                // Seek is only supported for MP3 audio element
                if (this.audio.currentTrack && this.audio.currentTrack.type === 'youtube') return;
                const dur = this.audio.player.duration || 0;
                if (dur > 0) this.audio.player.currentTime = pct * dur;
            });
        }

        // MP3 upload
        document.getElementById('uploadBtn').addEventListener('click', () => {
            document.getElementById('mp3Upload').click();
        });

        document.getElementById('mp3Upload').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });

        // Add YouTube URL
        const ytInput = document.getElementById('youtubeUrlInput');
        const ytAddBtn = document.getElementById('addYoutubeBtn');
        if (ytAddBtn && ytInput) {
            ytAddBtn.addEventListener('click', () => this.handleAddYouTube(ytInput.value.trim()));
            ytInput.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') this.handleAddYouTube(ytInput.value.trim());
            });
        }

        // Audio player events
        this.audio.player.addEventListener('ended', () => this.handleTrackEnd());
        this.audio.player.addEventListener('timeupdate', () => this.updateTimeUI());
        this.audio.player.addEventListener('loadedmetadata', () => this.updateTimeUI(true));

        // Persist partial progress on unexpected close
        window.addEventListener('beforeunload', () => {
            const elapsedSec = this.getElapsedSeconds();
            if (elapsedSec > 0 && this.hasWorkInput() && !this.session.completed) {
                const minutes = Math.max(1, Math.round(elapsedSec / 60));
                this.logWorkSession(minutes);
                this.session.completed = true; // prevent duplicate
            }
        });

        // Playlists: open modal
        const createPlBtn = document.getElementById('createPlaylistBtn');
        if (createPlBtn) {
            createPlBtn.addEventListener('click', () => this.openPlaylistModal());
        }

        // Playlist modal buttons
        const plClose = document.getElementById('playlistCloseBtn');
        const plCancel = document.getElementById('playlistCancelBtn');
        const plSave = document.getElementById('playlistSaveBtn');
        if (plClose) plClose.addEventListener('click', () => this.closePlaylistModal());
        if (plCancel) plCancel.addEventListener('click', () => this.closePlaylistModal());
        if (plSave) plSave.addEventListener('click', () => this.savePlaylistFromModal());

        // Playlist list actions (play/edit/delete via delegation)
        const plList = document.getElementById('playlistsList');
        if (plList) {
            plList.addEventListener('click', (e) => {
                const item = e.target.closest('[data-pl-id]');
                if (!item) return;
                const id = item.getAttribute('data-pl-id');
                if (e.target.closest('[data-action="play"]')) {
                    this.loadPlaylistToQueue(id, true);
                } else if (e.target.closest('[data-action="edit"]')) {
                    this.openPlaylistModal(id);
                } else if (e.target.closest('[data-action="delete"]')) {
                    this.deletePlaylist(id);
                } else {
                    // default click: load playlist (no auto-play)
                    this.loadPlaylistToQueue(id, false);
                }
            });
        }
    }

    setTimer(minutes, seconds) {
        if (!this.timer.isRunning) {
            this.timer.minutes = minutes;
            this.timer.seconds = seconds;
            this.updateTimerDisplay();
            this.session.initialTotalSec = (minutes * 60) + seconds;
            this.session.completed = false;
        }
    }

    updateTimerDisplay() {
        const display = document.getElementById('timerDisplay');
        const mins = String(this.timer.minutes).padStart(2, '0');
        const secs = String(this.timer.seconds).padStart(2, '0');
        display.textContent = `${mins}:${secs}`;
    }

    toggleTimer() {
        if (this.timer.isRunning) {
            this.pauseTimer();
        } else {
            if (!this.hasWorkInput()) {
                alert('Please enter what you are working on');
                return;
            }
            this.startTimer();
        }
    }

    hasWorkInput() {
        const el = document.getElementById('workInput');
        return !!(el && el.value.trim().length > 0);
    }

    startTimer() {
        this.timer.isRunning = true;
        this.updatePlayPauseButton();
        this.timer.intervalId = setInterval(() => {
            if (this.timer.seconds === 0) {
                if (this.timer.minutes === 0) {
                    this.completeTimer();
                    return;
                }
                this.timer.minutes--;
                this.timer.seconds = 59;
            } else {
                this.timer.seconds--;
            }
            this.updateTimerDisplay();
        }, 1000);
    }

    pauseTimer() {
        this.timer.isRunning = false;
        clearInterval(this.timer.intervalId);
        this.updatePlayPauseButton();
    }

    completeTimer() {
        this.timer.isRunning = false;
        clearInterval(this.timer.intervalId);
        this.updatePlayPauseButton();
        const plannedMinutes = Math.round(this.session.initialTotalSec / 60);
        this.logWorkSession(plannedMinutes);
        this.session.completed = true;
        this.setTimer(25, 0);
        const input = document.getElementById('workInput');
        if (input) input.value = '';
        alert('Work session completed! Great job!');
    }

    completeEarly() {
        if (this.timer.isRunning) {
            this.pauseTimer();
        }
        const elapsed = this.getElapsedSeconds();
        const minutes = Math.max(1, Math.round(elapsed / 60));
        this.logWorkSession(minutes);
        this.session.completed = true;
        this.setTimer(25, 0);
        const input = document.getElementById('workInput');
        if (input) input.value = '';
        alert('Session logged as completed. Nice work!');
    }

    getElapsedSeconds() {
        const remaining = (this.timer.minutes * 60) + this.timer.seconds;
        const elapsed = Math.max(0, this.session.initialTotalSec - remaining);
        return elapsed;
    }

    updatePlayPauseButton() {
        const btn = document.getElementById('playPauseBtn');
        const icon = document.getElementById('playPauseIcon');
        if (!btn || !icon) return;
        if (this.timer.isRunning) {
            icon.className = 'fas fa-pause';
            btn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
            btn.classList.add('bg-red-500', 'hover:bg-red-600');
        } else {
            icon.className = 'fas fa-play';
            btn.classList.remove('bg-red-500', 'hover:bg-red-600');
            btn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        }
    }

    // Build flattened library array (user MP3 + YouTube)
    getAllTracks() {
        const user = (this.userTracks || []).map(t => ({ ...t, category: 'mp3', type: 'mp3' }));
        const yt = (this.youtubeTracks || []).map(t => ({ ...t, category: 'youtube', type: 'youtube' }));
        return [...user, ...yt];
    }

    getFilteredTracks() {
        const all = this.getAllTracks();
        const f = this.playback.filter || 'All';
        if (f === 'All') return all;
        if (f.startsWith('playlist:')) {
            const pid = f.slice('playlist:'.length);
            const pl = this.playlists.find(p => p.id === pid);
            if (!pl) return [];
            const map = Object.fromEntries(all.map(t => [t.id, t]));
            return pl.tracks.map(id => map[id]).filter(Boolean);
        }
        return all.filter(t => t.category === f);
    }

    renderMusicList() {
        const listEl = document.getElementById('musicList');
        if (!listEl) return;
        const tracks = this.getFilteredTracks();
        this.playback.queue = tracks.map(t => t.id);

        const trackHtml = tracks.map(t => {
            const isActive = this.audio.currentTrack && this.audio.currentTrack.id === t.id;
            return `
                <div data-track-id="${t.id}" class="flex items-center justify-between px-2 py-1 rounded ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700'} cursor-pointer border border-gray-700">
                    <div class="truncate text-sm">
                        <span class="uppercase text-xs mr-2 text-gray-400">${t.category}</span>${t.name}
                    </div>
                    <i class="fas ${isActive ? 'fa-volume-up' : 'fa-play'} text-xs"></i>
                </div>
            `;
        }).join('');

        // When a playlist is selected, prepend a header with Edit/Delete (no Play)
        let headerSection = '';
        if (this.playback.filter && this.playback.filter.startsWith('playlist:')) {
            const pid = this.playback.filter.slice('playlist:'.length);
            const pl = this.playlists.find(p => p.id === pid);
            if (pl) {
                headerSection = `
                    <div class="mb-2 flex items-center justify-between px-2 py-1 rounded bg-gray-900 border border-gray-700" data-selected-pl-id="${pl.id}">
                        <div class="truncate text-sm"><i class="fas fa-list mr-2 text-gray-400"></i>${pl.name} <span class="text-xs text-gray-500">(${pl.tracks.length})</span></div>
                        <div class="flex items-center gap-2">
                            <button class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded" data-action="edit">Edit</button>
                            <button class="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 rounded" data-action="delete">Delete</button>
                        </div>
                    </div>
                `;
            }
        }

        listEl.innerHTML = headerSection + trackHtml;
    }

    renderFilterOptions() {
        const sel = document.getElementById('musicFilter');
        if (!sel) return;
        const current = this.playback.filter || 'All';
        // Base options
        const base = [
            { value: 'All', label: 'All' },
            { value: 'mp3', label: 'MP3' },
            { value: 'youtube', label: 'YouTube' },
        ];
        const baseHtml = base.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
        let playlistsHtml = '';
        if (this.playlists.length > 0) {
            const plOpts = this.playlists.map(pl => `<option value="playlist:${pl.id}">${pl.name}</option>`).join('');
            playlistsHtml = `<optgroup label="Playlists">${plOpts}</optgroup>`;
        }
        sel.innerHTML = baseHtml + playlistsHtml;
        // Restore selection if possible; fallback to All if missing
        const values = new Set(Array.from(sel.querySelectorAll('option')).map(o => o.value));
        sel.value = values.has(current) ? current : 'All';
        this.playback.filter = sel.value;
    }

    // ===== Playlists =====
    renderPlaylistsList() {
        const list = document.getElementById('playlistsList');
        const count = document.getElementById('playlistsCount');
        if (!list) return;
        if (count) count.textContent = this.playlists.length ? `${this.playlists.length}` : '';
        if (this.playlists.length === 0) {
            list.innerHTML = '<div class="text-xs text-gray-500">No playlists</div>';
            return;
        }
        list.innerHTML = this.playlists.map(pl => `
            <div data-pl-id="${pl.id}" class="flex items-center justify-between px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 cursor-pointer">
                <div class="truncate text-sm"><i class="fas fa-list mr-2 text-gray-400"></i>${pl.name} <span class="text-xs text-gray-400">(${pl.tracks.length})</span></div>
                <div class="flex items-center gap-2">
                    <button class="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded" data-action="play">Play</button>
                    <button class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded" data-action="edit">Edit</button>
                    <button class="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 rounded" data-action="delete">Delete</button>
                </div>
            </div>
        `).join('');
    }

    openPlaylistModal(playlistId = null) {
        this.editingPlaylistId = playlistId;
        const modal = document.getElementById('playlistModal');
        const nameInput = document.getElementById('playlistNameInput');
        const leftList = document.getElementById('playlistAllTracksList');
        const rightList = document.getElementById('playlistSelectedList');
        const searchInput = document.getElementById('plSearchInput');
        const sortSelect = document.getElementById('plSortSelect');
        const clearBtn = document.getElementById('plClearBtn');
        if (!modal || !nameInput || !leftList || !rightList || !searchInput || !sortSelect || !clearBtn) return;

        let selectedOrder = [];
        if (playlistId) {
            const pl = this.playlists.find(p => p.id === playlistId);
            if (pl) {
                nameInput.value = pl.name;
                selectedOrder = [...pl.tracks];
            }
        } else {
            nameInput.value = '';
        }

        this.playlistModalState = {
            selectedIds: [...selectedOrder],
            search: '',
            sort: 'name'
        };

        // Bind controls
        searchInput.value = '';
        sortSelect.value = 'name';
        searchInput.oninput = () => {
            this.playlistModalState.search = searchInput.value.trim().toLowerCase();
            this.renderPlaylistModalLeft();
        };
        sortSelect.onchange = () => {
            this.playlistModalState.sort = sortSelect.value;
            this.renderPlaylistModalLeft();
        };
        clearBtn.onclick = () => {
            this.playlistModalState.selectedIds = [];
            this.renderPlaylistModalLeft();
            this.renderPlaylistModalRight();
        };

        // Left list events (add/remove)
        leftList.onclick = (e) => {
            const row = e.target.closest('[data-track-id]');
            if (!row) return;
            const id = row.getAttribute('data-track-id');
            const cb = row.querySelector('input[type="checkbox"]');
            if (!cb) return;
            cb.checked = !cb.checked;
            const idx = this.playlistModalState.selectedIds.indexOf(id);
            if (cb.checked) {
                if (idx === -1) this.playlistModalState.selectedIds.push(id);
            } else {
                if (idx !== -1) this.playlistModalState.selectedIds.splice(idx, 1);
            }
            this.renderPlaylistModalRight();
            this.renderPlaylistModalLeft(); // update checkbox states
        };

        // Right list events (remove)
        rightList.onclick = (e) => {
            const rmBtn = e.target.closest('[data-remove-id]');
            if (!rmBtn) return;
            const id = rmBtn.getAttribute('data-remove-id');
            this.playlistModalState.selectedIds = this.playlistModalState.selectedIds.filter(x => x !== id);
            this.renderPlaylistModalRight();
            this.renderPlaylistModalLeft();
        };

        this.renderPlaylistModalLeft();
        this.renderPlaylistModalRight();
        modal.classList.remove('hidden');
    }

    renderPlaylistModalLeft() {
        const leftList = document.getElementById('playlistAllTracksList');
        if (!leftList || !this.playlistModalState) return;
        const term = this.playlistModalState.search || '';
        const sort = this.playlistModalState.sort || 'name';
        let items = this.getAllTracks();
        if (term) {
            items = items.filter(t => `${t.name} ${t.category}`.toLowerCase().includes(term));
        }
        items.sort((a, b) => {
            if (sort === 'category') return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
            return a.name.localeCompare(b.name);
        });
        const sel = new Set(this.playlistModalState.selectedIds);
        leftList.innerHTML = items.map(t => `
            <div data-track-id="${t.id}" class="flex items-center gap-2 px-2 py-1 rounded bg-gray-800 border border-gray-700 cursor-pointer">
                <input type="checkbox" ${sel.has(t.id) ? 'checked' : ''}>
                <span class="uppercase text-xs text-gray-400">${t.category}</span>
                <span class="truncate text-sm">${t.name}</span>
            </div>
        `).join('');
    }

    renderPlaylistModalRight() {
        const rightList = document.getElementById('playlistSelectedList');
        if (!rightList || !this.playlistModalState) return;
        const all = this.getAllTracks();
        const byId = Object.fromEntries(all.map(t => [t.id, t]));
        const rows = this.playlistModalState.selectedIds.map(id => byId[id]).filter(Boolean);
        rightList.innerHTML = rows.map(t => `
            <div class="flex items-center justify-between px-2 py-1 rounded bg-gray-800 border border-gray-700" draggable="true" data-track-id="${t.id}">
                <div class="flex items-center gap-2 truncate text-sm">
                    <i class="fas fa-grip-lines text-gray-500 cursor-move"></i>
                    <span class="uppercase text-xs text-gray-400">${t.category}</span>
                    <span class="truncate">${t.name}</span>
                </div>
                <button class="text-xs px-2 py-1 bg-red-700 hover:bg-red-600 rounded" data-remove-id="${t.id}">Remove</button>
            </div>
        `).join('');
        this.enableDnDSelected(rightList);
    }

    enableDnDSelected(container) {
        let dragEl = null;
        container.querySelectorAll('[draggable="true"]').forEach(row => {
            row.addEventListener('dragstart', (e) => {
                dragEl = row;
                row.classList.add('opacity-60');
                e.dataTransfer.effectAllowed = 'move';
            });
            row.addEventListener('dragend', () => {
                if (dragEl) dragEl.classList.remove('opacity-60');
                dragEl = null;
            });
            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                const target = e.currentTarget;
                if (!dragEl || dragEl === target) return;
                const rect = target.getBoundingClientRect();
                const before = (e.clientY - rect.top) < rect.height / 2;
                if (before) {
                    target.parentNode.insertBefore(dragEl, target);
                } else {
                    target.parentNode.insertBefore(dragEl, target.nextSibling);
                }
            });
        });
    }

    closePlaylistModal() {
        const modal = document.getElementById('playlistModal');
        if (modal) modal.classList.add('hidden');
        this.editingPlaylistId = null;
    }

    enableDnD(container) {
        let dragEl = null;
        container.querySelectorAll('[draggable="true"]').forEach(row => {
            row.addEventListener('dragstart', (e) => {
                dragEl = row;
                row.classList.add('opacity-60');
                e.dataTransfer.effectAllowed = 'move';
            });
            row.addEventListener('dragend', () => {
                if (dragEl) dragEl.classList.remove('opacity-60');
                dragEl = null;
            });
            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                const target = e.currentTarget;
                if (!dragEl || dragEl === target) return;
                const rect = target.getBoundingClientRect();
                const before = (e.clientY - rect.top) < rect.height / 2;
                if (before) {
                    target.parentNode.insertBefore(dragEl, target);
                } else {
                    target.parentNode.insertBefore(dragEl, target.nextSibling);
                }
            });
        });
    }

    savePlaylistFromModal() {
        const nameInput = document.getElementById('playlistNameInput');
        const right = document.getElementById('playlistSelectedList');
        if (!nameInput || !right) return;
        const name = nameInput.value.trim() || 'Untitled';
        const rows = Array.from(right.querySelectorAll('[data-track-id]'));
        const selectedIds = rows.map(r => r.getAttribute('data-track-id'));
        if (selectedIds.length === 0) {
            alert('Select at least one track');
            return;
        }
        if (this.editingPlaylistId) {
            const idx = this.playlists.findIndex(p => p.id === this.editingPlaylistId);
            if (idx !== -1) {
                this.playlists[idx] = { id: this.editingPlaylistId, name, tracks: selectedIds };
            }
        } else {
            const id = 'pl_' + Date.now();
            this.playlists.unshift({ id, name, tracks: selectedIds });
        }
        localStorage.setItem('workTunesPlaylists', JSON.stringify(this.playlists));
        this.renderPlaylistsList();
        this.renderFilterOptions();
        // If currently viewing this playlist, refresh list to reflect name/order changes
        if (this.playback.filter && this.playback.filter.startsWith('playlist:')) {
            const curPid = this.playback.filter.slice('playlist:'.length);
            const changedId = this.editingPlaylistId ? this.editingPlaylistId : null;
            if (!changedId || curPid === changedId) {
                this.renderMusicList();
            }
        } else if (this.playback.filter === 'All') {
            this.renderMusicList();
        }
        this.closePlaylistModal();
    }

    deletePlaylist(playlistId) {
        const pl = this.playlists.find(p => p.id === playlistId);
        if (!pl) return;
        if (!confirm(`Delete playlist "${pl.name}"?`)) return;
        this.playlists = this.playlists.filter(p => p.id !== playlistId);
        localStorage.setItem('workTunesPlaylists', JSON.stringify(this.playlists));
        this.renderPlaylistsList();
        // If the deleted playlist is currently selected, switch to All
        if (this.playback.filter === `playlist:${playlistId}`) {
            this.playback.filter = 'All';
        }
        this.renderFilterOptions();
        this.renderMusicList();
    }

    loadPlaylistToQueue(playlistId, autoPlay = false) {
        const pl = this.playlists.find(p => p.id === playlistId);
        if (!pl) return;
        this.playback.queue = [...pl.tracks];
        // renderRight list selection state remains independent; start playing first track if requested
        if (autoPlay && this.playback.queue.length > 0) {
            this.playTrackById(this.playback.queue[0]);
        }
    }

    playTrack(track) {
        this.audio.currentTrack = track;
        // update current index in queue
        const idx = this.playback.queue.indexOf(track.id);
        this.playback.currentIndex = idx;
        const titleEl = document.getElementById('playerTrackTitle');
        if (titleEl) titleEl.textContent = track.name;
        const infoEl = document.getElementById('currentTrack');
        if (track.type === 'youtube') {
            // stop audio element
            this.audio.player.pause();
            this.audio.player.src = '';
            this.loadYouTubeVideo(track.url);
            if (infoEl) infoEl.textContent = `Playing (YouTube): ${track.name}`;
            this.updateSourceUi();
        } else {
            // stop youtube iframe
            this.stopYouTube();
            this.audio.player.src = track.url;
            this.audio.player.volume = this.audio.volume;
            this.audio.player.play().catch(e => {
                console.log('Audio play failed:', e);
                if (infoEl) infoEl.textContent = 'Audio unavailable';
            });
            if (infoEl) infoEl.textContent = `Playing: ${track.name}`;
            this.updateSourceUi();
        }
        this.renderMusicList();
    }

    // YouTube helpers (no API)
    extractVideoId(url) {
        const regex = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&\n?#]+)/;
        const match = (url || '').match(regex);
        return match ? match[1] : null;
    }

    loadYouTubeVideo(url) {
        const videoId = this.extractVideoId(url);
        if (!this.youtube || !this.youtube.iframe) return;
        if (videoId) {
            this.youtube.iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1`;
        }
    }

    stopYouTube() {
        if (this.youtube && this.youtube.iframe) {
            // Navigating to about:blank effectively stops playback
            if (!this.youtube.iframe.src || this.youtube.iframe.src === 'about:blank') return;
            this.youtube.iframe.src = 'about:blank';
        }
    }

    updateTimeUI(force = false) {
        // For YouTube (no API), display N/A and disable seek
        if (this.audio.currentTrack && this.audio.currentTrack.type === 'youtube') {
            const curEl = document.getElementById('playerCurrentTime');
            const durEl = document.getElementById('playerDuration');
            if (curEl) curEl.textContent = '--:--';
            if (durEl) durEl.textContent = '--:--';
            const seek = document.getElementById('seekSlider');
            if (seek) seek.value = '0';
            return;
        }
        const cur = this.audio.player.currentTime || 0;
        const dur = this.audio.player.duration || 0;
        const fmt = (t) => {
            const m = Math.floor(t / 60);
            const s = Math.floor(t % 60).toString().padStart(2, '0');
            return `${m}:${s}`;
        };
        const curEl = document.getElementById('playerCurrentTime');
        const durEl = document.getElementById('playerDuration');
        if (curEl) curEl.textContent = fmt(cur);
        if (durEl && (force || durEl.textContent === '0:00')) durEl.textContent = fmt(dur);
        const seek = document.getElementById('seekSlider');
        if (seek && dur > 0) seek.value = String(Math.round((cur / dur) * 100));
        if (seek && dur === 0) seek.value = '0';
    }

    updateSourceUi() {
        const isYT = this.audio.currentTrack && this.audio.currentTrack.type === 'youtube';
        const seek = document.getElementById('seekSlider');
        const vol = document.getElementById('volumeSliderBottom');
        const curEl = document.getElementById('playerCurrentTime');
        const durEl = document.getElementById('playerDuration');
        const ytNotice = document.getElementById('ytNotice');
        if (seek) {
            seek.disabled = !!isYT;
            seek.classList.toggle('opacity-50', !!isYT);
            seek.classList.toggle('cursor-not-allowed', !!isYT);
            if (isYT) seek.value = '0';
        }
        if (vol) {
            vol.disabled = !!isYT;
            vol.classList.toggle('opacity-50', !!isYT);
            vol.classList.toggle('cursor-not-allowed', !!isYT);
        }
        if (ytNotice) {
            ytNotice.classList.toggle('hidden', !isYT);
        }
        if (isYT) {
            if (curEl) curEl.textContent = '--:--';
            if (durEl) durEl.textContent = '--:--';
        } else {
            // When switching back to MP3, refresh time UI
            this.updateTimeUI(true);
        }
    }

    playTrackById(trackId) {
        const track = this.getAllTracks().find(t => t.id === trackId);
        if (track) this.playTrack(track);
    }

    handleTrackEnd() {
        // Loop current
        if (this.playback.loop && this.audio.currentTrack) {
            this.audio.player.currentTime = 0;
            this.audio.player.play();
            return;
        }
        // Shuffle next
        if (this.playback.shuffle) {
            const tracks = this.getFilteredTracks();
            if (tracks.length > 0) {
                const next = tracks[Math.floor(Math.random() * tracks.length)];
                this.playTrack(next);
            }
            return;
        }
        // Sequential next
        const nextIndex = this.playback.currentIndex + 1;
        if (nextIndex < this.playback.queue.length) {
            const nextId = this.playback.queue[nextIndex];
            this.playTrackById(nextId);
        } else {
            // Reached end: wrap to first track in current queue
            if (this.playback.queue.length > 0) {
                const firstId = this.playback.queue[0];
                this.playTrackById(firstId);
            } else {
                this.audio.currentTrack = null;
                document.getElementById('currentTrack').textContent = 'No music selected';
                this.renderMusicList();
            }
        }
    }

    setVolume(volume) {
        this.audio.volume = volume;
        this.audio.player.volume = volume;
        const vd = document.getElementById('volumeDisplayBottom');
        if (vd) vd.textContent = Math.round(volume * 100);
    }

    handleFileUpload(files) {
        if (this.userTracks.length >= 5) {
            alert('Maximum 5 files allowed');
            return;
        }

        Array.from(files).forEach(file => {
            const isAudio = file.type && file.type.startsWith('audio/');
            const isMp3Name = /\.mp3$/i.test(file.name || '');
            if (!(isAudio || isMp3Name)) {
                alert('Only MP3 files are allowed');
                return;
            }
            
            if (file.size > 10 * 1024 * 1024) {
                alert('File size must be less than 10MB');
                return;
            }

            if (this.userTracks.length >= 5) {
                alert('Maximum 5 files allowed');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const track = {
                    id: 'user_' + Date.now(),
                    name: file.name.replace(/\.mp3$/i, ''),
                    url: e.target.result,
                    isUserTrack: true,
                    type: 'mp3'
                };
                
                this.userTracks.push(track);
                localStorage.setItem('userTracks', JSON.stringify(this.userTracks));
                this.renderMusicList();
            };
            reader.readAsDataURL(file);
        });
    }

    handleAddYouTube(url) {
        if (!url) return;
        const vid = this.extractVideoId(url);
        if (!vid) {
            alert('Valid YouTube URL is required');
            return;
        }
        if (this.youtubeTracks.length >= 20) {
            alert('Maximum 20 YouTube links allowed');
            return;
        }
        const name = `YouTube ${vid}`;
        const track = { id: 'yt_' + Date.now(), name, url, type: 'youtube' };
        this.youtubeTracks.unshift(track);
        localStorage.setItem('youtubeTracks', JSON.stringify(this.youtubeTracks));
        const input = document.getElementById('youtubeUrlInput');
        if (input) input.value = '';
        // Auto switch filter to YouTube so user sees the added track immediately
        this.playback.filter = 'youtube';
        this.renderFilterOptions();
        this.renderMusicList();
    }

    // Deprecated UI functions kept for compatibility; now operate on music list
    loadUserTracks() {
        this.renderMusicList();
    }

    playUserTrack(trackId) {
        const track = this.userTracks.find(t => t.id === trackId);
        if (track) {
            this.playTrack(track);
        }
    }

    removeUserTrack(trackId) {
        this.userTracks = this.userTracks.filter(t => t.id !== trackId);
        localStorage.setItem('userTracks', JSON.stringify(this.userTracks));
        this.renderMusicList();
    }
    

    // (no-op)

logWorkSession(durationMinutes) {
    const workContent = document.getElementById('workInput').value.trim();
    const now = new Date();
    const today = now.toDateString();

    const logEntry = {
        id: Date.now(),
        date: today,
        time: now.toLocaleTimeString(),
        content: workContent,
        duration: durationMinutes && durationMinutes > 0 ? durationMinutes : 25,
        music: this.audio.currentTrack ? this.audio.currentTrack.name : 'No music'
    };
    
    // Keep all-time history
    this.workLog.unshift(logEntry);

    localStorage.setItem('workTunesLog', JSON.stringify(this.workLog));
    this.loadWorkLog();
}

loadWorkLog() {
    // Update compact summary only
    const summary = document.getElementById('workLogSummary');
    if (!summary) return;
    const entries = this.workLog || [];
    if (entries.length === 0) {
        summary.textContent = 'No work logged yet';
        return;
    }
    const totalMinutes = entries.reduce((sum, e) => sum + (Number(e.duration) || 0), 0);
    summary.textContent = `${entries.length} sessions • ${totalMinutes} min total`;
}

openWorkLogModal() {
    const modal = document.getElementById('workLogModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    this.renderWorkLogModalChart();
}

closeWorkLogModal() {
    const modal = document.getElementById('workLogModal');
    if (!modal) return;
    modal.classList.add('hidden');
}

renderWorkLogModalChart() {
    const container = document.getElementById('workLogChartModal');
    const totalLabel = document.getElementById('workLogTotalLabel');
    const tooltip = document.getElementById('workLogTooltip');
    if (!container || !totalLabel || !tooltip) return;
    const entries = this.workLog || [];
    if (entries.length === 0) {
        container.innerHTML = '<div class="text-gray-500 text-center py-10">No work logged yet</div>';
        totalLabel.textContent = '';
        return;
    }
    // Build stacked bar
    const totalMinutes = entries.reduce((sum, e) => sum + (Number(e.duration) || 0), 0);
    const chartHeight = 360; // px
    const scale = totalMinutes > 0 ? chartHeight / totalMinutes : 0;
    const colors = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#f87171', '#22d3ee'];
    container.innerHTML = `
        <div class="flex items-end justify-center" style="height:${chartHeight}px">
            <div id="workLogStack" class="w-16 bg-gray-800 border border-gray-700 rounded overflow-hidden flex flex-col-reverse"></div>
        </div>`;
    const stack = document.getElementById('workLogStack');
    stack.innerHTML = '';
    entries.forEach((e, idx) => {
        const h = Math.max(4, Math.round((Number(e.duration) || 0) * scale));
        const color = colors[idx % colors.length];
        const seg = document.createElement('div');
        seg.className = 'w-full';
        seg.style.height = `${h}px`;
        seg.style.background = color;
        seg.dataset.info = `${e.date} ${e.time} • ${e.duration}m\n${e.content || ''}`;
        seg.addEventListener('mousemove', (ev) => {
            tooltip.textContent = seg.dataset.info;
            tooltip.classList.remove('hidden');
            const pad = 12;
            tooltip.style.left = `${ev.clientX + pad}px`;
            tooltip.style.top = `${ev.clientY + pad}px`;
        });
        seg.addEventListener('mouseleave', () => {
            tooltip.classList.add('hidden');
        });
        stack.appendChild(seg);
    });
    totalLabel.textContent = `Total: ${totalMinutes} min`;
}

}

// Initialize the app
const app = new WorkTunesApp();

// Make app globally available for onclick handlers
window.app = app;
