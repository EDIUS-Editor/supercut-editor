// ============================================
// OPTIMIZED SUPERCUT AND MARKER VIDEO EDITOR
// Complete rewrite with performance improvements
// Subtitle support removed
// ENHANCED SILENCE DETECTION - CORRECTED
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    $(function() {
        
        // ============================================
        // VIDEO TIMELINE CONTROLLER CLASS
        // ============================================
        class VideoTimelineController {
            constructor(config) {
                // DOM elements
                this.video = config.video;
                this.mainTimeline = config.mainTimeline;
                this.mainTimelineSelection = config.mainTimelineSelection;
                this.mainTimelinePlayhead = config.mainTimelinePlayhead;
                this.currentTimeDisplay = config.currentTimeDisplay;
                this.durationTimeDisplay = config.durationTimeDisplay;
                this.selectionTimeDisplay = config.selectionTimeDisplay;
                this.selectionDurationDisplay = config.selectionDurationDisplay;
                this.detectedFpsDisplay = config.detectedFpsDisplay;
                this.framerateSelect = config.framerateSelect;
                
                // State management
                this.state = {
                    frameRate: 29.97,
                    duration: 0,
                    currentTime: 0,
                    selection: { start: 0, end: 0 },
                    isWaveformReady: false,
                    isSeeking: false,
                    isLooping: false,
                    isDragging: false,
                    markers: [],
                    activeMarkerIndex: -1,
                    silentRegions: [], // This will hold the raw data from detection
                    silenceRegionsPlugin: null
                };
                
                // Performance optimization
                this.rafId = null;
                this.lastUpdateTime = 0;
                this.updateThrottle = 1000 / 60; // 60fps max
                
                // WaveSurfer instance
                this.wavesurfer = null;
                this.selectionRegion = null;
                
                // FPS detection
                this.fpsDetector = {
                    lastMediaTime: 0,
                    lastFrameNum: 0,
                    fpsRounder: [],
                    frameNotSeeked: true,
                    detectedFps: 0,
                    isComplete: false  // Stop after detection
                };
                
                // SMPTE cache
                this.smpteCache = new Map();
                this.lastCacheTime = -1;
                this.lastScaleUpdate = -1;
                
                // Bind methods
                this.updatePlayhead = this.updatePlayhead.bind(this);
                this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
                this.ticker = this.ticker.bind(this);
                
                this.init();
            }
            
            init() {
                // Ensure video controls are always visible
                this.video.setAttribute('controls', 'true');
                this.video.setAttribute('controlsList', 'nodownload');
                
                // Video event listeners
                this.video.addEventListener('loadedmetadata', () => this.onVideoLoaded());
                this.video.addEventListener('timeupdate', this.handleTimeUpdate);
                this.video.addEventListener('seeking', () => { 
                    this.state.isSeeking = true;
                });
                this.video.addEventListener('seeked', () => { 
                    this.state.isSeeking = false;
                    this.fpsDetector.fpsRounder.pop();
                    this.fpsDetector.frameNotSeeked = false;
                    // Force update after seek completes
                    this.updatePlayhead(true);
                });
                this.video.addEventListener('play', () => this.onPlayStateChange(true));
                this.video.addEventListener('pause', () => this.onPlayStateChange(false));
                
                // Handle native video control seeking
                this.video.addEventListener('input', (e) => {
                    // Update our playhead when using native controls
                    this.updatePlayhead(true);
                    this.updateTimeDisplaysCached(this.video.currentTime);
                });
                
                // Timeline interaction
                this.setupTimelineInteraction();
                
                // Frame rate change handler
                this.framerateSelect.addEventListener('change', (e) => {
                    this.state.frameRate = parseFloat(e.target.value);
                    // Clear cache when frame rate changes
                    this.smpteCache.clear();
                    this.updateTimeDisplaysCached();
                });
            }
            
            onVideoLoaded() {
                this.state.duration = this.video.duration;
                this.state.selection = { start: 0, end: this.video.duration };
                
                this.updateSelection();
                this.updateTimeDisplaysCached();
                
                // Only start animation if playing
                if (!this.video.paused) {
                    this.startPlayheadAnimation();
                }
                
                // Reset FPS detection
                this.fpsDetector.isComplete = false;
                this.fpsDetector.fpsRounder = [];
                
                // Start FPS detection
                this.video.requestVideoFrameCallback(this.ticker);
            }
            
            onPlayStateChange(isPlaying) {
                document.getElementById('play-pause').textContent = isPlaying ? 'Pause' : 'Play';
                
                // Start or stop animation loop based on play state
                if (isPlaying) {
                    this.startPlayheadAnimation();
                } else {
                    this.stopPlayheadAnimation();
                    // Force update when paused to ensure current position is shown
                    this.updatePlayhead(true);
                }
            }
            
            // ============================================
            // FPS DETECTION (OPTIMIZED - STOPS AFTER DETECTION)
            // ============================================
            ticker(useless, metadata) {
                // Stop if already detected
                if (this.fpsDetector.isComplete) return;
                
                const mediaTimeDiff = Math.abs(metadata.mediaTime - this.fpsDetector.lastMediaTime);
                const frameNumDiff = Math.abs(metadata.presentedFrames - this.fpsDetector.lastFrameNum);
                const diff = mediaTimeDiff / frameNumDiff;
                
                if (diff && diff < 1 && this.fpsDetector.frameNotSeeked && 
                    this.fpsDetector.fpsRounder.length < 50 && 
                    this.video.playbackRate === 1 && document.hasFocus()) {
                    
                    this.fpsDetector.fpsRounder.push(diff);
                    const avgFps = this.fpsDetector.fpsRounder.reduce((a, b) => a + b) / this.fpsDetector.fpsRounder.length;
                    this.fpsDetector.detectedFps = Math.round(1 / avgFps);
                    
                    const certainty = this.fpsDetector.fpsRounder.length * 2;
                    this.detectedFpsDisplay.textContent = `${this.fpsDetector.detectedFps} fps (${certainty}%)`;
                    
                    if (certainty >= 50) {
                        const closestRate = this.findClosestFrameRate(this.fpsDetector.detectedFps);
                        this.framerateSelect.value = closestRate.toString();
                        this.state.frameRate = closestRate;
                        this.updateTimeDisplaysCached();
                    }
                    
                    // Stop detection after 50 samples
                    if (this.fpsDetector.fpsRounder.length >= 50) {
                        this.fpsDetector.isComplete = true;
                        this.detectedFpsDisplay.textContent += ' ✓';
                        return; // Stop requesting frames
                    }
                }
                
                this.fpsDetector.frameNotSeeked = true;
                this.fpsDetector.lastMediaTime = metadata.mediaTime;
                this.fpsDetector.lastFrameNum = metadata.presentedFrames;
                
                // Continue detection
                if (!this.fpsDetector.isComplete) {
                    this.video.requestVideoFrameCallback(this.ticker);
                }
            }
            
            findClosestFrameRate(detectedFps) {
                const frameRates = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
                return frameRates.reduce((prev, curr) => 
                    Math.abs(curr - detectedFps) < Math.abs(prev - detectedFps) ? curr : prev
                );
            }
            
            // ============================================
            // UNIFIED SEEK FUNCTION
            // ============================================
            seekTo(time, source = 'user') {
                if (!this.state.duration) return;
                
                // Prevent circular updates
                if (this.state.isSeeking && source === 'sync') return;
                
                // Clamp time
                time = Math.max(0, Math.min(this.state.duration, time));
                
                // Update state
                this.state.currentTime = time;
                
                // Single source of truth
                if (this.state.isWaveformReady && this.wavesurfer) {
                    // Use seekAndCenter to both seek and center the view
                    if (Math.abs(this.wavesurfer.getCurrentTime() - time) > 0.001) {
                        const progress = time / this.state.duration;
                        this.wavesurfer.seekAndCenter(progress);
                    }
                } else {
                    if (Math.abs(this.video.currentTime - time) > 0.001) {
                        this.video.currentTime = time;
                    }
                }
                
                // Force immediate visual update regardless of play state
                this.updatePlayhead(true);
                this.updateTimeDisplaysCached();
                
                // Reset seeking flag after a short delay to allow updates
                setTimeout(() => { this.state.isSeeking = false; }, 50);
            }
            
            // ============================================
            // OPTIMIZED PLAYHEAD UPDATE
            // ============================================
            updatePlayhead(force = false) {
                const now = performance.now();
                
                // Throttle updates only when playing
                if (!force && !this.video.paused && now - this.lastUpdateTime < this.updateThrottle) {
                    return;
                }
                
                this.lastUpdateTime = now;
                
                // Get current time from appropriate source
                const currentTime = this.state.isWaveformReady && this.wavesurfer
                    ? this.wavesurfer.getCurrentTime()
                    : this.video.currentTime;
                
                // Always update playhead position
                if (this.state.duration > 0) {
                    const position = (currentTime / this.state.duration) * 100;
                    this.mainTimelinePlayhead.style.left = `${position}%`;
                }
                
                // Update time displays with caching
                this.updateTimeDisplaysCached(currentTime);
            }
            
            // ============================================
            // ANIMATION LOOP (OPTIMIZED - RUNS ONLY WHEN PLAYING)
            // ============================================
            startPlayheadAnimation() {
                // Only start if not already running
                if (this.rafId) return;
                
                const animate = () => {
                    if (!this.video.paused && !this.state.isSeeking) {
                        this.updatePlayhead();
                    }
                    
                    // Continue only if video is playing
                    if (!this.video.paused) {
                        this.rafId = requestAnimationFrame(animate);
                    } else {
                        this.rafId = null;
                    }
                };
                
                // Start only if playing
                if (!this.video.paused) {
                    animate();
                }
            }
            
            stopPlayheadAnimation() {
                if (this.rafId) {
                    cancelAnimationFrame(this.rafId);
                    this.rafId = null;
                }
            }
            
            // ============================================
            // TIMELINE INTERACTION (OPTIMIZED WITH TIMESTAMP THROTTLING)
            // ============================================
            setupTimelineInteraction() {
                let lastDragTime = 0;
                const dragThrottle = 16; // ~60fps
                
                const getTimeFromPosition = (e) => {
                    const rect = this.mainTimeline.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const percent = Math.max(0, Math.min(1, x / rect.width));
                    return percent * this.state.duration;
                };
                
                const handleDrag = (e) => {
                    if (!this.state.isDragging || !this.state.duration) return;
                    
                    // Timestamp-based throttling
                    const now = performance.now();
                    if (now - lastDragTime < dragThrottle) return;
                    lastDragTime = now;
                    
                    const time = getTimeFromPosition(e);
                    this.seekTo(time, 'timeline');
                    e.preventDefault();
                };
                
                // Mouse events
                this.mainTimeline.addEventListener('mousedown', (e) => {
                    if (!this.state.duration) return;
                    this.state.isDragging = true;
                    const time = getTimeFromPosition(e);
                    this.seekTo(time, 'timeline');
                    e.preventDefault();
                });
                
                document.addEventListener('mousemove', handleDrag);
                document.addEventListener('mouseup', () => {
                    if (this.state.isDragging) {
                        this.state.isDragging = false;
                        // Final update after drag ends
                        this.updatePlayhead(true);
                    }
                });
                
                // Touch events with timestamp throttling
                let lastTouchTime = 0;
                
                this.mainTimeline.addEventListener('touchstart', (e) => {
                    if (!this.state.duration) return;
                    this.state.isDragging = true;
                    const touch = e.touches[0];
                    const rect = this.mainTimeline.getBoundingClientRect();
                    const x = touch.clientX - rect.left;
                    const percent = Math.max(0, Math.min(1, x / rect.width));
                    const time = percent * this.state.duration;
                    this.seekTo(time, 'timeline');
                    e.preventDefault();
                }, { passive: false });
                
                document.addEventListener('touchmove', (e) => {
                    if (!this.state.isDragging || !this.state.duration) return;
                    
                    // Timestamp-based throttling for touch
                    const now = performance.now();
                    if (now - lastTouchTime < dragThrottle) return;
                    lastTouchTime = now;
                    
                    const touch = e.touches[0];
                    const rect = this.mainTimeline.getBoundingClientRect();
                    const x = touch.clientX - rect.left;
                    const percent = Math.max(0, Math.min(1, x / rect.width));
                    const time = percent * this.state.duration;
                    this.seekTo(time, 'timeline');
                    e.preventDefault();
                }, { passive: false });
                
                document.addEventListener('touchend', () => {
                    if (this.state.isDragging) {
                        this.state.isDragging = false;
                        // Final update after touch drag ends
                        this.updatePlayhead(true);
                    }
                });
            }
            
            // ============================================
            // WAVEFORM MANAGEMENT
            // ============================================
            initWaveform(waveformData = null) {
                if (this.wavesurfer) {
                    this.wavesurfer.destroy();
                    this.wavesurfer = null;
                }
                
                const waveformContainer = document.getElementById('waveform-scroll-container');
                const loadingIndicator = document.getElementById('loading-indicator');
                const waveformMessage = document.getElementById('waveform-message');
                
                loadingIndicator.style.display = 'block';
                waveformMessage.style.display = 'none';
                
                this.wavesurfer = WaveSurfer.create({
                    container: '#waveform',
                    waveColor: '#2a5298',
                    progressColor: '#1e3c72',
                    backend: 'MediaElement',
                    media: this.video,
                    height: 128,
                    responsive: true,
                    interact: true,
                    dragToSeek: false,
                    cursorColor: '#ff0000',
                    cursorWidth: 2,
                    partialRender: true,
                    pixelRatio: 1,
                    fillParent: true,
                    scrollParent: false,
                    normalize: true,
                    plugins: [
                        WaveSurfer.regions.create({
                            regionsMinLength: 0.1,
                            dragSelection: false,
                            maxRegions: 1000
                        })
                    ]
                });
                
                this.wavesurfer.on('ready', () => {
                    this.state.isWaveformReady = true;
                    loadingIndicator.style.display = 'none';
                    waveformContainer.style.display = 'block';
                    
                    // Zoom to show ~5 seconds
                    const pxPerSec = waveformContainer.clientWidth / 5;
                    this.wavesurfer.zoom(pxPerSec);
                    
                    this.setupWaveformRegion();
                    
                    waveformMessage.textContent = 'Waveform loaded successfully! 🎵 Click anywhere to seek.';
                    waveformMessage.style.color = '#28a745';
                    waveformMessage.style.display = 'block';
                    setTimeout(() => { waveformMessage.style.display = 'none'; }, 6000);
                });
                
                this.wavesurfer.on('seeking', (time) => {
                    // Prevent circular seeks
                    if (Math.abs(this.video.currentTime - time) > 0.01) {
                        this.seekTo(time, 'waveform');
                    }
                });
                
                this.wavesurfer.on('audioprocess', () => {
                    if (!this.video.paused) {
                        this.updatePlayhead();
                    }
                });
                
                this.wavesurfer.on('error', (err) => {
                    console.error('WaveSurfer error:', err);
                    this.state.isWaveformReady = false;
                    loadingIndicator.style.display = 'none';
                    waveformMessage.textContent = `Failed: ${err}`;
                    waveformMessage.style.color = '#e74c3c';
                    waveformMessage.style.display = 'block';
                });
                
                // Load peaks if provided
                if (waveformData) {
                    this.loadPeaksData(waveformData);
                }
            }
            
            loadPeaksData(jsonData) {
                if (!jsonData || !jsonData.data || !jsonData.bits) {
                    console.error('Invalid waveform data');
                    return;
                }
                
                setTimeout(() => {
                    try {
                        const bits = jsonData.bits;
                        const divisor = 2 ** (bits - 1);
                        const data = Array.isArray(jsonData.data[0]) ? jsonData.data[0] : jsonData.data;
                        const peaks = data.map(p => p / divisor);
                        
                        this.wavesurfer.load(this.video, peaks);
                    } catch (err) {
                        console.error('Error loading peaks:', err);
                    }
                }, 100);
            }
            
            // ============================================
            // SELECTION MANAGEMENT
            // ============================================
            setSelection(start, end) {
                if (start === undefined || end === undefined || start > end) return;
                
                this.state.selection = { start, end };
                this.updateSelection();
                
                if (this.selectionRegion) {
                    this.selectionRegion.update({ start, end });
                }
            }
            
            updateSelection() {
                if (!this.state.duration) return;
                
                const { start, end } = this.state.selection;
                const startPercent = (start / this.state.duration) * 100;
                const endPercent = (end / this.state.duration) * 100;
                
                this.mainTimelineSelection.style.left = `${startPercent}%`;
                this.mainTimelineSelection.style.width = `${endPercent - startPercent}%`;
                
                this.updateTimeDisplaysCached();
            }
            
            setupWaveformRegion() {
                if (!this.wavesurfer || !this.wavesurfer.regions) return;
                
                // Clear only the selection region, preserve silence regions
                const regions = Object.values(this.wavesurfer.regions.list);
                regions.forEach(region => {
                    if (!region.id || !region.id.startsWith('silence-')) {
                        region.remove();
                    }
                });
                
                this.selectionRegion = this.wavesurfer.regions.add({
                    start: this.state.selection.start,
                    end: this.state.selection.end,
                    color: 'rgba(33, 150, 243, 0.2)',
                    drag: true,
                    resize: true,
                });
                
                this.selectionRegion.on('update-end', () => {
                    this.setSelection(this.selectionRegion.start, this.selectionRegion.end);
                });
            }
            
            // ============================================
            // SILENCE DETECTION
            // ============================================
            detectSilence(thresholdDb, minSilenceDuration, mergeDistance) {
                if (!this.wavesurfer || !this.state.isWaveformReady) {
                    console.error('Waveform not ready');
                    return [];
                }
                
                // Try to get decoded data or peaks data
                let audioData;
                const duration = this.state.duration;
                
                // Try different methods to get audio data
                if (this.wavesurfer.getDecodedData) {
                    const decodedData = this.wavesurfer.getDecodedData();
                    if (decodedData) {
                        audioData = decodedData.getChannelData(0);
                    }
                }
                
                // Fallback to peaks if decoded data not available
                if (!audioData && this.wavesurfer.backend && this.wavesurfer.backend.peaks) {
                    audioData = this.wavesurfer.backend.peaks[0] || this.wavesurfer.backend.peaks;
                }
                
                // Another fallback - use exported peaks
                if (!audioData && this.wavesurfer.exportPeaks) {
                    const peaks = this.wavesurfer.exportPeaks();
                    audioData = peaks[0] || peaks;
                }
                
                if (!audioData) {
                    console.error('No audio data available for silence detection');
                    return [];
                }
                
                // Convert dB threshold to linear amplitude (0-1)
                const thresholdLinear = Math.pow(10, thresholdDb / 20);
                
                const scale = duration / audioData.length;
                const silentRegions = [];
                
                // Find all silent regions longer than minSilenceDuration
                let start = 0;
                let isSilent = false;
                
                for (let i = 0; i < audioData.length; i++) {
                    const amplitude = Math.abs(audioData[i]);
                    
                    if (amplitude < thresholdLinear) {
                        if (!isSilent) {
                            start = i;
                            isSilent = true;
                        }
                    } else if (isSilent) {
                        const end = i;
                        isSilent = false;
                        const silenceDuration = scale * (end - start);
                        
                        if (silenceDuration >= minSilenceDuration) {
                            silentRegions.push({
                                start: scale * start,
                                end: scale * end,
                                duration: silenceDuration
                            });
                        }
                    }
                }
                
                // Handle if audio ends with silence
                if (isSilent) {
                    const silenceDuration = scale * (audioData.length - start);
                    if (silenceDuration >= minSilenceDuration) {
                        silentRegions.push({
                            start: scale * start,
                            end: duration,
                            duration: silenceDuration
                        });
                    }
                }
                
                // Merge silent regions that are close together
                if (mergeDistance > 0 && silentRegions.length > 1) {
                    const mergedRegions = [];
                    let lastRegion = silentRegions[0];
                    
                    for (let i = 1; i < silentRegions.length; i++) {
                        if (silentRegions[i].start - lastRegion.end <= mergeDistance) {
                            // Merge with previous region
                            lastRegion.end = silentRegions[i].end;
                            lastRegion.duration = lastRegion.end - lastRegion.start;
                        } else {
                            // Add previous region and start new one
                            mergedRegions.push(lastRegion);
                            lastRegion = silentRegions[i];
                        }
                    }
                    mergedRegions.push(lastRegion);
                    
                    return mergedRegions;
                }
                
                return silentRegions;
            }
            
            clearSilenceRegions() {
                if (!this.wavesurfer || !this.wavesurfer.regions) return;
                
                // Remove all silence regions from waveform
                const regions = Object.values(this.wavesurfer.regions.list);
                regions.forEach(region => {
                    if (region.id && region.id.startsWith('silence-')) {
                        region.remove();
                    }
                });
                
                this.state.silentRegions = [];
            }
            
            displaySilenceRegions(regions) {
                this.clearSilenceRegions();
                
                if (!regions || !this.wavesurfer || !this.wavesurfer.regions) return;
                
                this.state.silentRegions = regions;
                
                // Add visual regions for each silent part
                regions.forEach((region, index) => {
                    this.wavesurfer.regions.add({
                        id: `silence-${index}`,
                        content: `silence-${index}`,
                        start: region.start,
                        end: region.end,
                        color: 'rgba(255, 0, 0, 0.3)',
                        drag: false,
                        resize: false
                    });
                });
            }

            // ============================================
            // PLAYBACK CONTROL
            // ============================================
            play() {
                if (this.state.isWaveformReady && this.wavesurfer) {
                    this.wavesurfer.play();
                } else {
                    this.video.play().catch(e => console.log('Play failed:', e));
                }
                this.startPlayheadAnimation();
            }
            
            pause() {
                if (this.state.isWaveformReady && this.wavesurfer) {
                    this.wavesurfer.pause();
                } else {
                    this.video.pause();
                }
                this.stopPlayheadAnimation();
                // Force update when pausing
                this.updatePlayhead(true);
            }
            
            playPause() {
                if (this.state.isWaveformReady && this.wavesurfer) {
                    this.wavesurfer.playPause();
                } else {
                    if (this.video.paused) {
                        this.play();
                    } else {
                        this.pause();
                    }
                }
            }
            
            stop() {
                this.pause();
                this.seekTo(0);
            }
            
            stepFrame(direction) {
                const frameStep = 1 / this.state.frameRate;
                const currentTime = this.video.currentTime;
                const newTime = direction > 0 
                    ? Math.min(this.state.duration, (Math.round(currentTime * this.state.frameRate) + 1) / this.state.frameRate)
                    : Math.max(0, (Math.round(currentTime * this.state.frameRate) - 1) / this.state.frameRate);
                this.seekTo(newTime);
                // Force immediate update for frame stepping
                this.updatePlayhead(true);
                this.updateTimeDisplaysCached(newTime);
            }
            
            // ============================================
            // TIME UPDATE HANDLING
            // ============================================
            handleTimeUpdate() {
                // Handle looping
                if (this.state.isLooping) {
                    const currentTime = this.video.currentTime;
                    if (currentTime >= this.state.selection.end) {
                        this.seekTo(this.state.selection.start);
                        this.play();
                        return;
                    }
                }
                
                // Update displays only when playing
                if (!this.video.paused && !this.state.isSeeking && !this.state.isDragging) {
                    this.updatePlayhead();
                }
            }
            
            // ============================================
            // TIME DISPLAY UTILITIES WITH CACHING
            // ============================================
            toSMPTE(seconds) {
                if (isNaN(seconds) || isNaN(this.state.frameRate)) {
                    return "00:00:00:00";
                }
                
                // Check cache
                const cacheKey = `${seconds.toFixed(3)}_${this.state.frameRate}`;
                if (this.smpteCache.has(cacheKey)) {
                    return this.smpteCache.get(cacheKey);
                }
                
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                const secs = Math.floor(seconds % 60);
                const frames = Math.floor((seconds * this.state.frameRate) % this.state.frameRate);
                
                const result = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
                
                // Cache result (limit cache size)
                if (this.smpteCache.size > 1000) {
                    this.smpteCache.clear();
                }
                this.smpteCache.set(cacheKey, result);
                
                return result;
            }
            
            updateTimeDisplaysCached(forceTime = null) {
                if (!this.video.duration || !isFinite(this.video.duration)) return;
                
                const currentTime = forceTime !== null ? forceTime : this.video.currentTime;
                
                // Skip if time hasn't changed significantly
                if (Math.abs(currentTime - this.lastCacheTime) < 0.01 && !forceTime) {
                    return;
                }
                this.lastCacheTime = currentTime;
                
                const duration = this.video.duration;
                const { start, end } = this.state.selection;
                const selectionDuration = end - start;
                
                // Batch DOM updates
                this.currentTimeDisplay.textContent = this.toSMPTE(currentTime);
                this.durationTimeDisplay.textContent = this.toSMPTE(duration);
                this.selectionTimeDisplay.textContent = 
                    `IN: ${this.toSMPTE(start)} - OUT: ${this.toSMPTE(end)}`;
                this.selectionDurationDisplay.textContent = 
                    `Duration: ${this.toSMPTE(selectionDuration)}`;
                
                // Update timeline scale only if needed
                if (window.updateTimelineScale && this.state.duration !== this.lastScaleUpdate) {
                    window.updateTimelineScale();
                    this.lastScaleUpdate = this.state.duration;
                }
            }
            
            updateTimeDisplays() {
                // Redirect to cached version
                this.updateTimeDisplaysCached();
            }
            
            // ============================================
            // CLEANUP
            // ============================================
            destroy() {
                this.stopPlayheadAnimation();
                
                if (this.wavesurfer) {
                    this.wavesurfer.destroy();
                    this.wavesurfer = null;
                }
                
                this.video.removeEventListener('timeupdate', this.handleTimeUpdate);
            }
        }
        
        // ============================================
        // APPLICATION CONTROLLER
        // ============================================
        class AppController {
            constructor() {
                // Cache DOM elements
                this.initDOMElements();
                
                // Initialize state
                this.state = {
                    originalFileName: '',
                    originalFilePath: '',
                    currentVideoUrl: null,
                    audioContext: null,
                    audioInfo: { samplerate: null, channelcount: null },
                    importedWaveformData: null
                };
                
                // Initialize video controller
                this.videoController = null;
                
                // Initialize app
                this.init();
            }
            
            initDOMElements() {
                // Video elements
                this.video = document.getElementById('my_video');
                this.fileInput = document.getElementById('video-upload');
                this.jsonInput = document.getElementById('json-upload');
                this.playPauseBtn = document.getElementById('play-pause');
                this.stopBtn = document.getElementById('stop');
                this.frameBackBtn = document.getElementById('frame-back');
                this.frameForwardBtn = document.getElementById('frame-forward');
                this.framerateSelect = document.getElementById('framerate-select');
                this.currentTimeDisplay = document.getElementById('current-time-value');
                this.durationTimeDisplay = document.getElementById('duration-time-value');
                this.selectionTimeDisplay = document.getElementById('selection-time');
                this.selectionDurationDisplay = document.getElementById('selection-duration');
                this.resetZoomBtn = document.getElementById('reset-zoom');
				this.jumpToInBtn = document.getElementById('jump-to-in');
				this.jumpToOutBtn = document.getElementById('jump-to-out');
                this.markersList = document.getElementById('markers-list');
                this.addMarkerBtn = document.getElementById('add-marker');
                this.saveJsonBtn = document.getElementById('save-json');
                this.dropZone = document.getElementById('file-drop-zone');
                this.customPathInput = document.getElementById('custom-path');
                this.savePathBtn = document.getElementById('save-path');
                this.savedPathsSelect = document.getElementById('saved-paths');
                this.detectedFpsDisplay = document.getElementById('detected-fps');
                this.markerSearchInput = document.getElementById('marker-search');
                this.markerSearchClearBtn = document.getElementById('marker-search-clear-btn');
                
                // Main timeline elements
                this.mainTimeline = document.getElementById('main-timeline');
                this.mainTimelineSelection = document.getElementById('main-timeline-selection');
                this.mainTimelinePlayhead = document.getElementById('main-timeline-playhead');
                
                // New elements
                this.repeatBtn = document.getElementById('repeat-play');
            }
            
            init() {
                // Initialize video controller
                this.videoController = new VideoTimelineController({
                    video: this.video,
                    mainTimeline: this.mainTimeline,
                    mainTimelineSelection: this.mainTimelineSelection,
                    mainTimelinePlayhead: this.mainTimelinePlayhead,
                    currentTimeDisplay: this.currentTimeDisplay,
                    durationTimeDisplay: this.durationTimeDisplay,
                    selectionTimeDisplay: this.selectionTimeDisplay,
                    selectionDurationDisplay: this.selectionDurationDisplay,
                    detectedFpsDisplay: this.detectedFpsDisplay,
                    framerateSelect: this.framerateSelect
                });
                
                // Set up event listeners
                this.setupEventListeners();
                
                // Initialize UI
                this.updatePathDropdown();
                
                // Set up global functions for backward compatibility
                this.setupGlobalFunctions();
            }
            
            setupEventListeners() {
                // Playback controls
                this.playPauseBtn.addEventListener('click', () => this.videoController.playPause());
                this.stopBtn.addEventListener('click', () => this.videoController.stop());
                this.frameBackBtn.addEventListener('click', () => this.videoController.stepFrame(-1));
                this.frameForwardBtn.addEventListener('click', () => this.videoController.stepFrame(1));
                
                // Repeat button
                this.repeatBtn.addEventListener('click', () => {
                    this.videoController.state.isLooping = !this.videoController.state.isLooping;
                    this.repeatBtn.classList.toggle('active', this.videoController.state.isLooping);
                    if (this.videoController.state.isLooping && this.video.paused) {
                        this.videoController.seekTo(this.videoController.state.selection.start);
                        this.videoController.play();
                    }
                });
                
                // IN/OUT controls
                document.getElementById('set-in-point')?.addEventListener('click', () => this.setInPoint());
                document.getElementById('set-out-point')?.addEventListener('click', () => this.setOutPoint());

                // Silence detection main buttons
				document.getElementById('detect-silence')?.addEventListener('click', () => this.performSilenceDetection());
				document.getElementById('clear-all-silence')?.addEventListener('click', () => this.clearAllSilentRegions());
				document.getElementById('load-all-silence')?.addEventListener('click', () => this.loadAllSilentRegions());

				// Setup +/- and global fine-tune controls
				this.setupEnhancedSilenceControls();
				
                
                // Reset zoom
                this.resetZoomBtn.addEventListener('click', () => {
                    if (this.video.duration) {
                        this.videoController.setSelection(0, this.video.duration);
                        this.videoController.seekTo(0);
                    }
                });
				
				// Jump to Previous/Next Region buttons
				this.jumpToInBtn.addEventListener('click', () => this.jumpToPreviousRegion());
				this.jumpToOutBtn.addEventListener('click', () => this.jumpToNextRegion());
                
                // File inputs
                this.fileInput.addEventListener('change', e => {
                    if (e.target.files[0]) this.loadVideo(e.target.files[0]);
                    e.target.blur();
                });
                this.jsonInput.addEventListener('change', e => {
                    if (e.target.files[0]) this.handleJSONImport(e.target.files[0]);
                    e.target.blur();
                });
                
                // Marker controls
                this.addMarkerBtn.addEventListener('click', () => this.addMarker());
                this.saveJsonBtn.addEventListener('click', () => this.saveJSON());
                
                // Marker search
                this.markerSearchInput.addEventListener('input', () => {
                    this.updateMarkerSearchClearButton();
                    this.updateMarkersList(this.markerSearchInput.value);
                });
                this.markerSearchClearBtn.addEventListener('click', () => this.clearMarkerSearch());
                
                // Path management
                this.savePathBtn.addEventListener('click', () => {
                    const path = this.customPathInput.value.trim();
                    if (path) this.saveCustomPath(path);
                });
                
                this.savedPathsSelect.addEventListener('change', function() {
                    if (this.value) this.customPathInput.value = this.value;
                }.bind(this));
                
                // Drag and drop
                this.setupDragAndDrop();
                
                // Keyboard shortcuts
                this.setupKeyboardShortcuts();
                
                // Frame rate change
                this.framerateSelect.addEventListener('change', () => {
                    // Clear SMPTE cache when frame rate changes
                    if (this.videoController && this.videoController.smpteCache) {
                        this.videoController.smpteCache.clear();
                    }
                    this.updateMarkersList();
                });
            }
            
            setupDragAndDrop() {
                const handleDragOver = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropZone.classList.add('drag-over');
                };
                
                const handleDragLeave = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropZone.classList.remove('drag-over');
                };
                
                const handleDrop = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropZone.classList.remove('drag-over');
                    
                    const files = Array.from(e.dataTransfer.files);
                    const videoFiles = files.filter(f => f.type.startsWith('video/'));
                    const jsonFiles = files.filter(f => f.name.endsWith('.json'));
                    
                    if (videoFiles.length > 0) this.loadVideo(videoFiles[0]);
                    if (jsonFiles.length > 0) this.handleJSONImport(jsonFiles[0]);
                };
                
                this.dropZone.addEventListener('dragover', handleDragOver);
                this.dropZone.addEventListener('dragleave', handleDragLeave);
                this.dropZone.addEventListener('drop', handleDrop);
                
                ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                    document.body.addEventListener(eventName, e => {
                        e.preventDefault();
                        e.stopPropagation();
                    });
                });
            }
            
            setupKeyboardShortcuts() {
                document.addEventListener('keydown', (e) => {
                    // Skip if typing in input
                    if (e.target.tagName === 'INPUT' || 
                        e.target.tagName === 'SELECT' || 
                        e.target.tagName === 'TEXTAREA') {
                        return;
                    }
                    
                    // Prevent Enter on buttons
                    if (e.key === 'Enter' && e.target.tagName === 'BUTTON') {
                        e.preventDefault();
                        return;
                    }
                    
                    switch(e.code) {
                        case 'Space':
                            e.preventDefault();
                            e.stopPropagation();
                            if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
                                document.activeElement.blur();
                            }
                            this.videoController.playPause();
                            break;
                            
                        case 'ArrowLeft':
                            if (e.ctrlKey || e.metaKey) {
                                e.preventDefault();
                                this.videoController.stepFrame(-1);
                            }
                            break;
                            
                        case 'ArrowRight':
                            if (e.ctrlKey || e.metaKey) {
                                e.preventDefault();
                                this.videoController.stepFrame(1);
                            }
                            break;
                            
                        case 'KeyI':
                            e.preventDefault();
                            this.setInPoint();
                            break;
                            
                        case 'KeyO':
                            e.preventDefault();
                            this.setOutPoint();
                            break;
                            
                        case 'BracketLeft':
                            e.preventDefault();
                            this.addMarker();
                            break;
							
						case 'KeyX':
						    e.preventDefault();
						    if (this.video.duration) {
							   this.videoController.setSelection(0, this.video.duration);
							   this.videoController.seekTo(0);
						    }
						    break;							
                            
                        case 'KeyQ':
                            e.preventDefault();
                            this.jumpToPreviousRegion();
                            break;
                            
                        case 'KeyW':
                            e.preventDefault();
                            this.jumpToNextRegion();
                            break;
                    }
                });
            }
            
            setupGlobalFunctions() {
                // Global functions for backward compatibility
                window.seekTo = (time) => this.videoController.seekTo(time);
                window.setSelectionRange = (start, end) => this.videoController.setSelection(start, end);
                window.loadMarker = (index) => this.loadMarker(index);
                window.addMarker = () => this.addMarker();
                window.removeMarker = (index) => this.removeMarker(index);
                window.updateTimelineScale = () => this.updateTimelineScale();
            }

            // ============================================
            // VIDEO LOADING
            // ============================================
            loadVideo(file) {
                if (file && file.type.startsWith('video/')) {
                    if (this.state.currentVideoUrl) {
                        URL.revokeObjectURL(this.state.currentVideoUrl);
                    }
                    
                    this.state.originalFileName = file.name;
                    this.state.originalFilePath = file.path || file.webkitRelativePath || `C:/Videos/${file.name}`;
                    
                    this.state.currentVideoUrl = URL.createObjectURL(file);
                    this.video.src = this.state.currentVideoUrl;
                    
                    // Reset state
                    this.state.audioInfo = { samplerate: null, channelcount: null };
                    this.resetWaveform();
                    
                    this.video.onerror = () => {
                        console.error('Error loading video:', this.video.error);
                        alert('Error loading video. Please try another file.');
                    };
                } else {
                    alert('Please upload a valid video file.');
                }
            }
            
            // ============================================
            // SELECTION MANAGEMENT
            // ============================================
            setInPoint() {
                if (!this.video.duration) return;
                const currentTime = this.video.currentTime;
                const { end } = this.videoController.state.selection;
                if (currentTime < end) {
                    this.videoController.setSelection(currentTime, end);
                } else {
                    this.videoController.setSelection(currentTime, currentTime);
                }
            }
            
            setOutPoint() {
                if (!this.video.duration) return;
                const currentTime = this.video.currentTime;
                const { start } = this.videoController.state.selection;
                if (currentTime > start) {
                    this.videoController.setSelection(start, currentTime);
                } else {
                    this.videoController.setSelection(currentTime, currentTime);
                }
            }
            
            // ============================================
            // MARKER MANAGEMENT
            // ============================================
            addMarker() {
                if (!this.video.duration) return;
                
                const { start, end } = this.videoController.state.selection;
                
                const newMarker = {
                    start: start,
                    end: end,
                    duration: end - start,
                    comments: []
                };
                
                this.videoController.state.markers.push(newMarker);
                this.videoController.state.activeMarkerIndex = this.videoController.state.markers.length - 1;
                this.updateMarkersList();
                
                setTimeout(() => {
                    const newMarkerElement = document.querySelector(`.marker-item[data-index="${this.videoController.state.activeMarkerIndex}"]`);
                    if (newMarkerElement) {
                        newMarkerElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }, 100);
            }
            
            loadMarker(index) {
                if (!this.video.duration || !this.videoController.state.markers[index]) return;
                
                const marker = this.videoController.state.markers[index];
                this.videoController.setSelection(marker.start, marker.end);
                this.videoController.seekTo(marker.start);
                this.videoController.state.activeMarkerIndex = index;
                this.updateMarkersList();
            }
            
            removeMarker(index) {
                const { markers, activeMarkerIndex } = this.videoController.state;
                if (index < 0 || index >= markers.length) return;

                const markerToRemove = markers[index];

                if (index === activeMarkerIndex) {
                    this.videoController.state.activeMarkerIndex = -1;
                } else if (index < activeMarkerIndex) {
                    this.videoController.state.activeMarkerIndex--;
                }
                
                markers.splice(index, 1);
                
                // If it was a silent marker, refresh the waveform regions
                if (markerToRemove.isSilent) {
                    this.refreshSilentWaveformRegions();
                }

                this.updateMarkersList();
            }
            
            updateMarkersList(searchTerm = '') {
                const { markers, activeMarkerIndex } = this.videoController.state;
                const lowerCaseSearchTerm = searchTerm.toLowerCase();
            
                const filteredMarkers = markers
                    .map((marker, index) => ({ marker, originalIndex: index }))
                    .filter(({ marker }) => {
                        if (!lowerCaseSearchTerm) return true;
                        const commentObj = marker.comments && marker.comments.length > 0 ? marker.comments[0] : null;
                        const displayText = commentObj ? commentObj.text : "";
                        return displayText.toLowerCase().includes(lowerCaseSearchTerm);
                    });
            
                this.markersList.innerHTML = markers.length ? '' : '<p class="text-muted mt-3">No markers added yet.</p>';
            
                filteredMarkers.forEach(({ marker, originalIndex }) => {
                    const div = document.createElement('div');
                    div.className = 'marker-item';
                    div.setAttribute('data-index', originalIndex);
            
                    if (originalIndex === activeMarkerIndex) {
                        div.classList.add('active');
                    }
            
                    const commentObj = marker.comments && marker.comments.length > 0 ? marker.comments[0] : null;
                    const displayText = commentObj ? commentObj.text : "";
            
                    const headerDiv = document.createElement('div');
                    headerDiv.className = 'marker-header';
            
                    if (marker.isSilent) {
                        div.classList.add('silent-region');
                        headerDiv.innerHTML = `
                            <span class="marker-label">🔇 ${displayText}: ${this.videoController.toSMPTE(marker.start)} - ${this.videoController.toSMPTE(marker.end)} (${this.videoController.toSMPTE(marker.duration)})</span>
                            <div class="marker-actions">
                                <button class="btn btn-sm btn-primary load-marker" title="Load this silent region">Load</button>
                                <button class="btn btn-sm btn-danger remove-marker" title="Remove this silent region">Delete</button>
                            </div>
                        `;
                    } else {
                        headerDiv.innerHTML = `
                            <span class="marker-label">Marker ${originalIndex + 1}: ${this.videoController.toSMPTE(marker.start)} - ${this.videoController.toSMPTE(marker.end)} (${this.videoController.toSMPTE(marker.duration)})</span>
                            <div class="marker-actions">
                                <button class="btn btn-sm btn-primary me-1 load-marker" title="Load this marker">Load</button>
                                <button class="btn btn-sm btn-info me-1 edit-marker" title="Edit comment text">Edit</button>
                                <button class="btn btn-sm btn-danger remove-marker" title="Remove this marker">X</button>
                            </div>
                        `;
                    }
            
                    div.appendChild(headerDiv);
                    
                    // Attach event listeners
                    headerDiv.querySelector('.load-marker').addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.loadMarker(originalIndex);
                    });
            
                    headerDiv.querySelector('.remove-marker').addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.removeMarker(originalIndex);
                    });
            
                    const editBtn = headerDiv.querySelector('.edit-marker');
                    if (editBtn) {
                        editBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.editMarkerText(originalIndex, div);
                        });
                    }
            
                    this.markersList.appendChild(div);
                });
            }

            editMarkerText(index, markerElement) {
                const marker = this.videoController.state.markers[index];
                
                const existingForm = markerElement.querySelector('.marker-edit-form');
                if (existingForm) {
                    markerElement.removeChild(existingForm);
                    return;
                }
                
                const commentObj = marker.comments && marker.comments.length > 0 ? marker.comments[0] : null;
                const currentText = commentObj ? commentObj.text : "";
                
                const editForm = document.createElement('div');
                editForm.className = 'marker-edit-form mt-2 w-100';
                editForm.innerHTML = `
                    <div class="mb-2">
                        <label for="marker-text-${index}" class="form-label small">Comment Text</label>
                        <textarea class="form-control form-control-sm" id="marker-text-${index}" rows="3" placeholder="Enter comment text...">${currentText}</textarea>
                    </div>
                    <div class="d-flex justify-content-end">
                        <button class="btn btn-sm btn-secondary me-2 cancel-edit">Cancel</button>
                        <button class="btn btn-sm btn-primary save-edit">Save Changes</button>
                    </div>
                `;
                
                markerElement.appendChild(editForm);
                
                const textArea = document.getElementById(`marker-text-${index}`);
                textArea.focus();
                textArea.setSelectionRange(textArea.value.length, textArea.value.length);
                
                editForm.querySelector('.cancel-edit').addEventListener('click', () => {
                    markerElement.removeChild(editForm);
                });
                
                editForm.querySelector('.save-edit').addEventListener('click', () => {
                    const newText = document.getElementById(`marker-text-${index}`).value;
                    const frameRate = this.videoController.state.frameRate;
                    
                    if (newText.trim()) {
                        if (marker.comments && marker.comments.length > 0) {
                            marker.comments[0].text = newText;
                        } else {
                            marker.comments = [{
                                text: newText,
                                start: Math.round(marker.start * frameRate),
                                end: Math.round(marker.end * frameRate)
                            }];
                        }
                    } else {
                        marker.comments = [];
                    }
                    
                    this.updateMarkersList();
                });
            }
            
            updateMarkerSearchClearButton() {
                this.markerSearchClearBtn.style.display = this.markerSearchInput.value.trim() ? 'block' : 'none';
            }
            
            clearMarkerSearch() {
                this.markerSearchInput.value = '';
                this.updateMarkerSearchClearButton();
                this.updateMarkersList();
            }
            
            // ============================================
            // ENHANCED SILENCE DETECTION & REGION NAVIGATION
            // ============================================
            jumpToPreviousRegion() {
                if (!this.videoController || !this.video.duration) return;
            
                const currentTime = this.video.currentTime;
                const silentMarkers = this.videoController.state.markers
                    .filter(m => m.isSilent)
                    .sort((a, b) => a.start - b.start);
            
                if (silentMarkers.length === 0) return;
            
                let previousMarker = null;
                // Find the last marker that starts before the current time (with a small buffer to avoid self-selection)
                for (let i = silentMarkers.length - 1; i >= 0; i--) {
                    if (silentMarkers[i].start < currentTime - 0.1) {
                        previousMarker = silentMarkers[i];
                        break;
                    }
                }
            
                // If no marker is strictly before (e.g., playhead is before the first marker), wrap around to the last one.
                if (!previousMarker) {
                    previousMarker = silentMarkers[silentMarkers.length - 1];
                }
                
                if (previousMarker) {
                    this.videoController.seekTo(previousMarker.start);
                }
            }
            
            jumpToNextRegion() {
                if (!this.videoController || !this.video.duration) return;
            
                const currentTime = this.video.currentTime;
                const silentMarkers = this.videoController.state.markers
                    .filter(m => m.isSilent)
                    .sort((a, b) => a.start - b.start);
            
                if (silentMarkers.length === 0) return;
            
                let nextMarker = null;
                // Find the first marker that starts after the current time
                for (let i = 0; i < silentMarkers.length; i++) {
                    if (silentMarkers[i].start > currentTime) {
                        nextMarker = silentMarkers[i];
                        break;
                    }
                }
                
                // If no marker is after the current time, wrap around to the first one.
                if (!nextMarker) {
                    nextMarker = silentMarkers[0];
                }
            
                if (nextMarker) {
                    this.videoController.seekTo(nextMarker.start);
                }
            }

            setupEnhancedSilenceControls() {
                // Threshold +/- controls
                document.getElementById('threshold-minus')?.addEventListener('click', () => {
                    const input = document.getElementById('silence-threshold');
                    input.value = Math.max(-60, parseFloat(input.value) - 1);
                });
                
                document.getElementById('threshold-plus')?.addEventListener('click', () => {
                    const input = document.getElementById('silence-threshold');
                    input.value = Math.min(-10, parseFloat(input.value) + 1);
                });
                
                // Duration +/- controls
                document.getElementById('duration-minus')?.addEventListener('click', () => {
                    const input = document.getElementById('silence-duration');
                    input.value = Math.max(0.1, parseFloat(input.value) - 0.1).toFixed(1);
                });
                
                document.getElementById('duration-plus')?.addEventListener('click', () => {
                    const input = document.getElementById('silence-duration');
                    input.value = Math.min(5, parseFloat(input.value) + 0.1).toFixed(1);
                });
                
                // Padding +/- controls
                document.getElementById('padding-minus')?.addEventListener('click', () => {
                    const input = document.getElementById('padding-amount');
                    input.value = Math.max(0.01, parseFloat(input.value) - 0.01).toFixed(2);
                });
                
                document.getElementById('padding-plus')?.addEventListener('click', () => {
                    const input = document.getElementById('padding-amount');
                    input.value = Math.min(1, parseFloat(input.value) + 0.01).toFixed(2);
                });
                
                // Global fine-tune controls
                this.setupGlobalFineTuneControls();
            }

            setupGlobalFineTuneControls() {
                const paddingAmount = () => parseFloat(document.getElementById('padding-amount').value);
                
                document.getElementById('global-start-minus')?.addEventListener('click', () => this.adjustAllSilentRegions('start', -paddingAmount()));
                document.getElementById('global-start-plus')?.addEventListener('click', () => this.adjustAllSilentRegions('start', paddingAmount()));
                document.getElementById('global-end-minus')?.addEventListener('click', () => this.adjustAllSilentRegions('end', -paddingAmount()));
                document.getElementById('global-end-plus')?.addEventListener('click', () => this.adjustAllSilentRegions('end', paddingAmount()));
                
                document.getElementById('global-add-padding')?.addEventListener('click', () => {
                    const padding = paddingAmount();
                    this.adjustAllSilentRegions('start', -padding);
                    this.adjustAllSilentRegions('end', padding);
                    this.showStatus(`Added ${padding}s padding to all regions`, 'success');
                });
                
                document.getElementById('global-remove-padding')?.addEventListener('click', () => {
                    const padding = paddingAmount();
                    this.adjustAllSilentRegions('start', padding);
                    this.adjustAllSilentRegions('end', -padding);
                    this.showStatus(`Removed ${padding}s padding from all regions`, 'success');
                });
            }
            
            performSilenceDetection() {
				if (!this.video.duration || !this.videoController.state.isWaveformReady) {
					this.showStatus('Please load a video with a waveform first.', 'danger');
					return;
				}
				
				const threshold = parseFloat(document.getElementById('silence-threshold').value);
				const minDuration = parseFloat(document.getElementById('silence-duration').value);
				const mergeDistance = 0.1; // Merge silences less than 100ms apart
				
				const detectBtn = document.getElementById('detect-silence');
				detectBtn.disabled = true;
				detectBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Detecting...';
				this.showStatus('Analyzing audio for silence...', 'info');
				
				setTimeout(() => {
					try {
                        // Clear previous silent regions before detecting new ones
                        this.clearAllSilentRegions(false); // silent clear

						const silentRegions = this.videoController.detectSilence(threshold, minDuration, mergeDistance);
						
						if (silentRegions.length > 0) {
							// Automatically add all regions as special markers
							const frameRate = this.videoController.state.frameRate;
							silentRegions.forEach((region, index) => {
								const marker = {
									start: region.start,
									end: region.end,
									duration: region.duration,
									isSilent: true, // Special flag for silent markers
									comments: [{
										text: `Silent region ${index + 1}`,
										start: Math.round(region.start * frameRate),
										end: Math.round(region.end * frameRate)
									}]
								};
								this.videoController.state.markers.push(marker);
							});
							
							this.refreshSilentWaveformRegions();
							this.updateMarkersList();
							
							// Enable controls
							document.getElementById('clear-all-silence').disabled = false;
							document.getElementById('load-all-silence').disabled = false;
							document.getElementById('global-fine-tune').style.display = 'block';
							
							this.showStatus(`Found ${silentRegions.length} silent region${silentRegions.length > 1 ? 's' : ''}.`, 'success');
						} else {
							this.showStatus('No silent regions found with the current settings.', 'warning');
						}
					} catch (error) {
						console.error('Error detecting silence:', error);
						this.showStatus('Error detecting silence. Please try again.', 'danger');
					} finally {
						detectBtn.disabled = false;
						detectBtn.innerHTML = '<span class="detect-icon">🔍</span> Detect Silence';
					}
				}, 100);
			}

			adjustAllSilentRegions(boundary, delta) {
				const silentMarkers = this.videoController.state.markers.filter(m => m.isSilent);
				if (silentMarkers.length === 0) return;

				silentMarkers.forEach(marker => {
					if (boundary === 'start') {
						marker.start = Math.max(0, Math.min(marker.end - 0.01, marker.start + delta));
					} else { // 'end'
						marker.end = Math.max(marker.start + 0.01, Math.min(this.video.duration, marker.end + delta));
					}
					marker.duration = marker.end - marker.start;
					
					// Update comment frames
					if (marker.comments && marker.comments[0]) {
						const frameRate = this.videoController.state.frameRate;
						marker.comments[0].start = Math.round(marker.start * frameRate);
						marker.comments[0].end = Math.round(marker.end * frameRate);
					}
				});
				
				this.refreshSilentWaveformRegions();
				this.updateMarkersList();
			}

			clearAllSilentRegions(showMsg = true) {
				// Remove all silent markers from the array
				this.videoController.state.markers = this.videoController.state.markers.filter(m => !m.isSilent);
				
				// Clear visual regions from the waveform
				this.videoController.clearSilenceRegions();
				
				// Hide/disable controls
				document.getElementById('global-fine-tune').style.display = 'none';
				document.getElementById('clear-all-silence').disabled = true;
				document.getElementById('load-all-silence').disabled = true;
				
				this.updateMarkersList();
                if (showMsg) {
				    this.showStatus('All silent regions have been cleared.', 'info');
                }
			}

			loadAllSilentRegions() {
				const silentMarkers = this.videoController.state.markers.filter(m => m.isSilent);
				if (silentMarkers.length === 0) return;
				
				let currentIndex = 0;
				
				const playNext = () => {
					if (currentIndex < silentMarkers.length) {
						const marker = silentMarkers[currentIndex];
						this.videoController.setSelection(marker.start, marker.end);
						this.videoController.seekTo(marker.start);
						this.videoController.play();
						
						const checkEnd = setInterval(() => {
							if (this.video.currentTime >= marker.end || this.video.paused) {
								clearInterval(checkEnd);
								currentIndex++;
								if (currentIndex < silentMarkers.length) {
									setTimeout(playNext, 500); // 0.5s pause between regions
								} else {
                                    this.videoController.pause();
                                }
							}
						}, 50);
					}
				};
				
				playNext();
				this.showStatus(`Playing all ${silentMarkers.length} silent regions sequentially.`, 'info');
			}

			showStatus(message, type = 'info') {
				const statusDiv = document.getElementById('detection-status');
				const statusText = document.getElementById('status-text');
				
				if (statusDiv && statusText) {
					statusDiv.className = `alert alert-${type} mt-3`;
					statusText.textContent = message;
					statusDiv.style.display = 'block';
					
					setTimeout(() => {
						statusDiv.style.display = 'none';
					}, 5000);
				}
			}

			refreshSilentWaveformRegions() {
				if (this.videoController.wavesurfer) {
					const silentMarkers = this.videoController.state.markers.filter(m => m.isSilent);
					const regions = silentMarkers.map(marker => ({
						start: marker.start,
						end: marker.end,
					}));
					
					this.videoController.displaySilenceRegions(regions);
				}
			}			
            
            // ============================================
            // JSON HANDLING
            // ============================================
            async handleJSONImport(file) {
                try {
                    const text = await file.text();
                    const jsonData = JSON.parse(text);
                    
                    if (jsonData.video && jsonData.clips) {
                        if (jsonData.video.file.media.video.timecode.rate.timebase) {
                            const jsonFrameRate = parseFloat(jsonData.video.file.media.video.timecode.rate.timebase);
                            this.framerateSelect.value = jsonFrameRate.toString();
                            this.videoController.state.frameRate = jsonFrameRate;
                        }
                        
                        this.videoController.state.markers = jsonData.clips.map(clip => ({
                            start: clip.start / this.videoController.state.frameRate,
                            end: clip.end / this.videoController.state.frameRate,
                            duration: (clip.end - clip.start) / this.videoController.state.frameRate,
                            comments: clip.comments || []
                        }));
                        
                        this.updateMarkersList();
                        
                        if (jsonData.waveform) {
                            this.state.importedWaveformData = jsonData.waveform;
                            this.videoController.initWaveform(jsonData.waveform);
                        }
                    } else {
                        throw new Error('Invalid JSON format. Expected a project file with video and clips data.');
                    }
                } catch (error) {
                    console.error('Error importing JSON:', error);
                    alert('Error importing project file. Please check the file format.');
                }
            }
            
            async saveJSON() {
                if (!this.video.duration) {
                    alert('Please load a video first.');
                    return;
                }
                
                if (!this.state.audioInfo.samplerate) {
                    this.state.audioInfo = await this.detectAudioInfo(this.video);
                }
                
                const customPath = this.customPathInput.value.trim();
                if (customPath) this.saveCustomPath(customPath);
                const pathUrl = customPath || `C:/Videos/`;
                
                const frameRate = this.videoController.state.frameRate;
                const videoData = {
                    "sequence": { "name": this.state.originalFileName.split('.')[0] },
                    "video": {
                        "file": {
                            "name": this.state.originalFileName,
                            "pathurl": pathUrl + this.state.originalFileName,
                            "media": {
                                "video": {
                                    "duration": Math.round(this.video.duration * frameRate),
                                    "timecode": {
                                        "rate": {
                                            "ntsc": [29.97, 59.94, 23.976].includes(frameRate) ? "TRUE" : "FALSE",
                                            "timebase": frameRate
                                        },
                                        "displayformat": "NDF",
                                        "first_timecode": "00:00:00:00"
                                    },
                                    "samplecharacteristics": {
                                        "width": this.video.videoWidth,
                                        "height": this.video.videoHeight,
                                        "anamorphic": "FALSE",
                                        "pixelaspectratio": "Square"
                                    }
                                },
                                "audio": {
                                    "samplecharacteristics": {
                                        "depth": 16,
                                        "samplerate": this.state.audioInfo.samplerate.toString()
                                    },
                                    "channelcount": this.state.audioInfo.channelcount
                                }
                            }
                        }
                    },
                    "clips": this.videoController.state.markers.map((marker, index) => ({
                        "id": (index + 1).toString(),
                        "start": Math.round(marker.start * frameRate),
                        "end": Math.round(marker.end * frameRate),
                        "comments": marker.comments ? marker.comments.map(sub => ({
                            text: sub.text,
                            start: Math.round(marker.start * frameRate),
                            end: Math.round(marker.end * frameRate)
                        })) : []
                    }))
                };
                
                if (this.state.importedWaveformData) {
                    videoData.waveform = this.state.importedWaveformData;
                }
                
                const blob = new Blob([JSON.stringify(videoData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${this.state.originalFileName.split('.')[0]}-project.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
            
            // ============================================
            // UTILITY FUNCTIONS
            // ============================================
            debounce(func, wait) {
                let timeout;
                return function(...args) {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => func.apply(this, args), wait);
                };
            }
            
            updatePathDropdown() {
                const savedPaths = JSON.parse(localStorage.getItem('customPaths') || '[]');
                
                while (this.savedPathsSelect.options.length > 1) {
                    this.savedPathsSelect.remove(1);
                }
                
                savedPaths.forEach(path => {
                    const option = document.createElement('option');
                    option.value = path;
                    option.textContent = path;
                    this.savedPathsSelect.appendChild(option);
                });
            }
            
            saveCustomPath(path) {
                const savedPaths = JSON.parse(localStorage.getItem('customPaths') || '[]');
                const existingIndex = savedPaths.indexOf(path);
                if (existingIndex !== -1) savedPaths.splice(existingIndex, 1);
                savedPaths.unshift(path);
                if (savedPaths.length > 5) savedPaths.pop();
                localStorage.setItem('customPaths', JSON.stringify(savedPaths));
                this.updatePathDropdown();
            }
            
            updateTimelineScale() {
                const timelineScale = document.getElementById('timeline-scale');
                if (!this.video.duration || !timelineScale) return;
                
                timelineScale.innerHTML = '';
                const viewDuration = this.video.duration;
                const frameRate = this.videoController.state.frameRate;
                
                let interval;
                const containerWidth = this.mainTimeline.offsetWidth;
                const minSpacing = 80;
                
                if (viewDuration <= 10) interval = 1;
                else if (viewDuration <= 60) interval = 5;
                else if (viewDuration <= 300) interval = 15;
                else if (viewDuration <= 900) interval = 30;
                else if (viewDuration <= 1800) interval = 60;
                else if (viewDuration <= 3600) interval = 120;
                else if (viewDuration <= 7200) interval = 300;
                else interval = 600;
                
                const expectedLabels = Math.floor(viewDuration / interval);
                const expectedSpacing = containerWidth / expectedLabels;
                
                while (expectedSpacing < minSpacing && interval < 3600) {
                    interval *= 2;
                }
                
                const startTime = Math.ceil(0 / interval) * interval;
                
                for (let t = startTime; t <= viewDuration; t += interval) {
                    const position = (t / viewDuration) * 100;
                    
                    if (position >= 0 && position <= 100) {
                        const tick = document.createElement('div');
                        tick.className = 'tick';
                        tick.style.left = `${position}%`;
                        
                        const label = document.createElement('span');
                        label.className = 'tick-label';
                        label.style.left = `${position}%`;
                        label.textContent = this.videoController.toSMPTE(t);
                        
                        timelineScale.appendChild(tick);
                        timelineScale.appendChild(label);
                    }
                }
                
                if (startTime > 0) {
                    const tick = document.createElement('div');
                    tick.className = 'tick';
                    tick.style.left = '0%';
                    
                    const label = document.createElement('span');
                    label.className = 'tick-label';
                    label.style.left = '0%';
                    label.textContent = this.videoController.toSMPTE(0);
                    
                    timelineScale.appendChild(tick);
                    timelineScale.appendChild(label);
                }
                
                const endTick = document.createElement('div');
                endTick.className = 'tick';
                endTick.style.left = '100%';
                
                const endLabel = document.createElement('span');
                endLabel.className = 'tick-label';
                endLabel.style.left = '100%';
                endLabel.textContent = this.videoController.toSMPTE(this.video.duration);
                
                timelineScale.appendChild(endTick);
                timelineScale.appendChild(endLabel);
            }
            
            async detectAudioInfo(video) {
                try {
                    if (!this.state.audioContext) {
                        this.state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        const source = this.state.audioContext.createMediaElementSource(video);
                        source.connect(this.state.audioContext.destination);
                    }
                    return {
                        samplerate: this.state.audioContext.sampleRate,
                        channelcount: (video.mozChannels || video.webkitAudioChannelCount || 2)
                    };
                } catch (e) {
                    console.warn('Could not detect audio info:', e);
                    return { samplerate: 48000, channelcount: 2 };
                }
            }
            
            resetWaveform() {
                const waveformContainer = document.getElementById('waveform-scroll-container');
                const waveformMessage = document.getElementById('waveform-message');
                const loadingIndicator = document.getElementById('loading-indicator');
                
                this.state.importedWaveformData = null;
                this.videoController.state.isWaveformReady = false;
                
                // Clear any silence detection
                if (this.videoController) {
                    this.clearAllSilentRegions(false);
                }
                
                if (waveformContainer) waveformContainer.style.display = 'none';
                if (waveformMessage) waveformMessage.style.display = 'none';
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                
                if (this.videoController.wavesurfer) {
                    this.videoController.wavesurfer.destroy();
                    this.videoController.wavesurfer = null;
                    this.videoController.selectionRegion = null;
                }
            }
            
            // ============================================
            // CLEANUP
            // ============================================
            destroy() {
                // Clean up video controller
                if (this.videoController) {
                    this.videoController.destroy();
                }
                
                // Clean up video URL
                if (this.state.currentVideoUrl) {
                    URL.revokeObjectURL(this.state.currentVideoUrl);
                }
                
                // Close audio context
                if (this.state.audioContext && this.state.audioContext.state !== 'closed') {
                    this.state.audioContext.close();
                }
            }
        }
        
        // ============================================
        // INITIALIZE APPLICATION
        // ============================================
        const app = new AppController();
        
        // Ensure video controls are always visible
        const style = document.createElement('style');
        style.textContent = `
            video::-webkit-media-controls-panel {
                display: flex !important;
                opacity: 1 !important;
                visibility: visible !important;
            }
            video::-webkit-media-controls-timeline {
                display: flex !important;
                opacity: 1 !important;
                visibility: visible !important;
            }
            video::-webkit-media-controls {
                display: flex !important;
                opacity: 1 !important;
                visibility: visible !important;
            }
            video::-webkit-media-controls-enclosure {
                display: flex !important;
                opacity: 1 !important;
                visibility: visible !important;
            }
            video {
                /* Ensure controls are always shown */
                controls: true;
            }
            /* Firefox */
            video::-moz-media-controls-panel {
                opacity: 1 !important;
                visibility: visible !important;
            }
            /* Ensure the video element always has controls */
            #my_video {
                controls: true;
            }
            /* Prevent controls from being hidden on hover out */
            video:hover::-webkit-media-controls-panel,
            video::-webkit-media-controls-panel {
                opacity: 1 !important;
                transition: none !important;
            }
            .marker-item.silent-region {
                background-color: rgba(255, 0, 0, 0.1);
                border-left: 4px solid #dc3545;
            }
            region[id^="silence-"] .wavesurfer-region-content {
                display: block;
                position: absolute;
                top: 2px;
                left: 5px;
                background-color: rgba(0, 0, 0, 0.6);
                color: white;
                padding: 1px 4px;
                font-size: 10px;
                border-radius: 3px;
                pointer-events: none;
                white-space: nowrap;
                z-index: 10;
            }
        `;
        document.head.appendChild(style);
        
        // Ensure the video element always has controls attribute
        const video = document.getElementById('my_video');
        if (video) {
            video.setAttribute('controls', 'true');
            video.setAttribute('controlsList', 'nodownload');
        }
        
        // Handle page unload
        window.addEventListener('beforeunload', function() {
            app.destroy();
        });
        
        // Handle window resize
        window.addEventListener('resize', app.debounce(function() {
            if (app.video.duration) {
                app.videoController.updateTimeDisplaysCached();
                app.updateTimelineScale();
            }
            
            // Adjust waveform zoom on resize
            if (app.videoController.state.isWaveformReady && app.videoController.wavesurfer) {
                const waveformContainer = document.getElementById('waveform-scroll-container');
                const isMobile = window.innerWidth <= 768;
                const pxPerSec = waveformContainer.clientWidth / (isMobile ? 15 : 5);
                app.videoController.wavesurfer.zoom(pxPerSec);
            }
        }, 250));
        
        // Prevent buttons from staying focused
        document.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', function() {
                if (this !== app.playPauseBtn) {
                    setTimeout(() => this.blur(), 100);
                }
            });
        });
    });
});

