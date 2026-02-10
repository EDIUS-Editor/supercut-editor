// ============================================
// EDIUS SUPERCUT AND MARKER VIDEO EDITOR
// Complete version with jQuery UI Slider (no WaveSurfer)
// All features integrated from app.min.js
// Visual Marker Regions with Red/Blue Edit Mode and Drag/Resize
// ============================================

$(function() {
    // ============================================
    // STATE MANAGEMENT
    // ============================================
    const state = {
        // Video state
        video: null,
        originalFileName: '',
        originalFilePath: '',
        currentVideoUrl: null,
        
        // Timeline state
        frameRate: 29.97,
        markers: [],
        currentSelection: { start: 0, end: 0 },
        zoomStart: 0,
        zoomEnd: 100,
        activeMarkerIndex: -1,      // Currently loaded/editing marker (shown in blue)
        editingMarkerIndex: -1,     // Marker being text-edited
        
        // Drag states for jQuery slider
        isDraggingRange: false,
        isDraggingInHandle: false,
        isDraggingOutHandle: false,
        isPlayheadDragging: false,
        
        // Marker region drag states
        isMarkerDragging: false,
        isMarkerResizingLeft: false,
        isMarkerResizingRight: false,
        markerDragStartX: 0,
        sliderDragStartedWithActiveMarker: false,
        
        // Playback state
        isRepeating: false,
        
        // Subtitle state
        subtitles: [],
        currentSubtitleIndex: -1,
        subtitleFormat: 'srt',
        wordTimings: [],
        searchMatches: [],
        currentMatchIndex: -1,
        
        // Audio info
        audioContext: null,
        audioInfo: { samplerate: null, channelcount: null },
        
        // FPS detection
        fpsDetector: {
            lastMediaTime: 0,
            lastFrameNum: 0,
            fpsRounder: [],
            frameNotSeeked: true,
            detectedFps: 0,
            isComplete: false
        }
    };
    
    // ============================================
    // DOM REFERENCES
    // ============================================
    const dom = {
        video: document.getElementById('my_video'),
        $timeSlider: $("#time-slider"),
        $mainTimeline: $("#main-timeline"),
        $mainTimelineSelection: $("#main-timeline-selection"),
        $mainPlayhead: $("#main-timeline-playhead"),
        
        // File inputs
        fileInput: document.getElementById('video-upload'),
        jsonInput: document.getElementById('json-upload'),
        subtitleInput: document.getElementById('subtitle-file'),
        
        // Controls
        playPauseBtn: document.getElementById('play-pause'),
        stopBtn: document.getElementById('stop'),
        frameBackBtn: document.getElementById('frame-back'),
        frameForwardBtn: document.getElementById('frame-forward'),
        repeatBtn: document.getElementById('repeat-play'),
        
        // Marker controls
        addMarkerBtn: document.getElementById('add-marker'),
        saveJsonBtn: document.getElementById('save-json'),
        editActiveMarkerBtn: document.getElementById('edit-active-marker'),
        prevMarkerBtn: document.getElementById('prev-marker-btn'),
        nextMarkerBtn: document.getElementById('next-marker-btn'),
        markersList: document.getElementById('markers-list'),
        markerSearchInput: document.getElementById('marker-search'),
        markerSearchClearBtn: document.getElementById('marker-search-clear-btn'),
        
        // Selection controls
        setInBtn: document.getElementById('set-in-point'),
        setOutBtn: document.getElementById('set-out-point'),
        resetZoomBtn: document.getElementById('reset-zoom'),
        jumpToInBtn: document.getElementById('jump-to-in'),
        jumpToOutBtn: document.getElementById('jump-to-out'),
        
        // Precise duration controls
        playheadPositionSelect: document.getElementById('playhead-position'),
        minutesInput: document.getElementById('minutes-input'),
        secondsInput: document.getElementById('seconds-input'),
        framesInput: document.getElementById('frames-input'),
        setPreciseRangeBtn: document.getElementById('set-precise-range'),
        
        // Time displays
        currentTimeDisplay: document.getElementById('current-time-value'),
        durationTimeDisplay: document.getElementById('duration-time-value'),
        selectionTimeDisplay: document.getElementById('selection-time'),
        selectionDurationDisplay: document.getElementById('selection-duration'),
        detectedFpsDisplay: document.getElementById('detected-fps'),
        framerateSelect: document.getElementById('framerate-select'),
        
        // Subtitle elements
        currentSubtitleDisplay: document.getElementById('current-subtitle'),
        searchBox: document.getElementById('search-box'),
        searchClearBtn: document.getElementById('search-clear-btn'),
        subtitleList: document.getElementById('subtitle-list'),
        prevMatchBtn: document.getElementById('prev-match'),
        nextMatchBtn: document.getElementById('next-match'),
        searchNavigation: document.getElementById('search-navigation'),
        addSearchMarkersBtn: document.getElementById('add-search-markers'),
        applySearchPaddingCheckbox: document.getElementById('apply-search-padding'),
        paddingInfoText: document.getElementById('padding-info'),
        
        // Path management
        customPathInput: document.getElementById('custom-path'),
        savePathBtn: document.getElementById('save-path'),
        savedPathsSelect: document.getElementById('saved-paths'),
        
        // Other
        dropZone: document.getElementById('file-drop-zone')
    };
    
    // ============================================
    // JQUERY UI SLIDER SETUP
    // ============================================
    function initializeSlider() {
        dom.$timeSlider.slider({
            range: true,
            min: 0,
            max: 100,
            values: [0, 100],
            step: 0.1,
            
            create: function() {
                $(this).find('.ui-slider-range').on('mousedown touchstart', function(e) {
                    state.isDraggingRange = true;
                    state.sliderDragStartedWithActiveMarker = state.activeMarkerIndex !== -1;
                    const currentValues = dom.$timeSlider.slider('values');
                    state.rangeWidth = currentValues[1] - currentValues[0];
                    state.startOffset = e.pageX || e.originalEvent.touches[0].pageX;
                    e.stopPropagation();
                });
            },
            
            start: function(event, ui) {
                state.isDraggingInHandle = ui.handleIndex === 0;
                state.isDraggingOutHandle = ui.handleIndex === 1;
                state.sliderDragStartedWithActiveMarker = state.activeMarkerIndex !== -1;
                
                if (!state.isDraggingRange) {
                    updateVideoFromSlider(ui.value);
                }
            },
            
            slide: function(event, ui) {
                if (!state.isDraggingRange) {
                    const duration = dom.video.duration || 0;
                    const zoomRange = state.zoomEnd - state.zoomStart;
                    
                    state.currentSelection.start = (ui.values[0] / 100) * (duration * (zoomRange / 100)) + 
                                            (duration * (state.zoomStart / 100));
                    state.currentSelection.end = (ui.values[1] / 100) * (duration * (zoomRange / 100)) + 
                                          (duration * (state.zoomStart / 100));
                    
                    updateTimelineSelection();
                    
                    // Update active marker in real-time if one is selected
                    if (state.activeMarkerIndex !== -1 && state.markers[state.activeMarkerIndex]) {
                        const marker = state.markers[state.activeMarkerIndex];
                        marker.start = state.currentSelection.start;
                        marker.end = state.currentSelection.end;
                        marker.duration = marker.end - marker.start;
                        
                        // Update marker region visual and list in real-time
                        updateMarkerRegionVisual(state.activeMarkerIndex);
                        updateMarkersListRealtime(state.activeMarkerIndex);
                    }
                    
                    if (state.isDraggingInHandle) {
                        dom.video.currentTime = state.currentSelection.start;
                    } else if (state.isDraggingOutHandle) {
                        dom.video.currentTime = state.currentSelection.end;
                    }
                    
                    updateTimeDisplays();
                }
                return !state.isDraggingRange;
            },
            
            stop: function() {
                // If we were editing a marker via slider, finalize changes
                if (state.sliderDragStartedWithActiveMarker && state.activeMarkerIndex !== -1) {
                    finalizeMarkerEdit();
                }
                
                state.isDraggingInHandle = false;
                state.isDraggingOutHandle = false;
                state.sliderDragStartedWithActiveMarker = false;
            }
        });
    }
    
    // ============================================
    // RANGE DRAGGING
    // ============================================
    function setupRangeDragging() {
        $(document).on('mousemove touchmove', function(e) {
            if (state.isDraggingRange) {
                e.preventDefault();
                
                const clientX = e.pageX || e.originalEvent.touches[0].pageX;
                const sliderWidth = dom.$timeSlider.width();
                const delta = ((clientX - state.startOffset) / sliderWidth) * 100;
                state.startOffset = clientX;
                
                let [currentStart, currentEnd] = dom.$timeSlider.slider('values');
                let newStart = currentStart + delta;
                let newEnd = newStart + state.rangeWidth;
                
                if (newStart < 0) {
                    newStart = 0;
                    newEnd = state.rangeWidth;
                }
                if (newEnd > 100) {
                    newEnd = 100;
                    newStart = 100 - state.rangeWidth;
                }
                
                dom.$timeSlider.slider('values', [newStart, newEnd]);
                
                const duration = dom.video.duration || 0;
                const zoomRange = state.zoomEnd - state.zoomStart;
                const previousStart = state.currentSelection.start;
                const previousEnd = state.currentSelection.end;
                
                state.currentSelection.start = (newStart / 100) * (duration * (zoomRange / 100)) + 
                                        (duration * (state.zoomStart / 100));
                state.currentSelection.end = (newEnd / 100) * (duration * (zoomRange / 100)) + 
                                      (duration * (state.zoomStart / 100));
                
                updateTimelineSelection();
                
                // Update active marker in real-time if one is selected
                if (state.activeMarkerIndex !== -1 && state.markers[state.activeMarkerIndex]) {
                    const marker = state.markers[state.activeMarkerIndex];
                    marker.start = state.currentSelection.start;
                    marker.end = state.currentSelection.end;
                    marker.duration = marker.end - marker.start;
                    
                    // Update marker region visual and list in real-time
                    updateMarkerRegionVisual(state.activeMarkerIndex);
                    updateMarkersListRealtime(state.activeMarkerIndex);
                }
                
                const wasWithinSelection = (dom.video.currentTime >= previousStart && 
                                           dom.video.currentTime <= previousEnd);
                
                if (!wasWithinSelection) {
                    dom.video.currentTime = state.currentSelection.start;
                } else {
                    const relativePosition = (dom.video.currentTime - previousStart) / 
                                            (previousEnd - previousStart);
                    dom.video.currentTime = state.currentSelection.start + 
                                       (relativePosition * (state.currentSelection.end - state.currentSelection.start));
                }
                
                updateTimeDisplays();
            }
        });
        
        $(document).on('mouseup touchend', function() {
            // If we were editing a marker via range drag, finalize changes
            if (state.isDraggingRange && state.sliderDragStartedWithActiveMarker && state.activeMarkerIndex !== -1) {
                finalizeMarkerEdit();
            }
            state.isDraggingRange = false;
            state.sliderDragStartedWithActiveMarker = false;
        });
    }
    
    // Finalize marker edit - sort and deselect
    function finalizeMarkerEdit() {
        if (state.activeMarkerIndex === -1) return;
        
        // Store reference to the active marker before sorting
        const activeMarker = state.markers[state.activeMarkerIndex];
        
        // Sort markers by start time
        state.markers.sort((a, b) => a.start - b.start);
        
        // Deselect marker (revert to red)
        state.activeMarkerIndex = -1;
        
        // Update everything
        updateEditMarkerButtonState();
        updateMarkersList();
        renderTimelineMarkers();
    }
    
    // ============================================
    // MARKER MANAGEMENT
    // ============================================
    function addMarker() {
        if (!dom.video.duration) return;
        
        const { start, end } = state.currentSelection;
        
        let subtitleText = "";
        let subtitleItems = [];
        
        if (state.subtitleFormat === "vtt" && state.wordTimings.length > 0) {
            const wordsInRange = state.wordTimings.filter(word => 
                word.startTime >= start && word.endTime <= end
            );
            
            if (wordsInRange.length > 0) {
                subtitleText = wordsInRange.map(word => word.text).join(' ');
                subtitleItems.push({ text: subtitleText });
            }
        } else {
            const overlappingSubtitles = state.subtitles.filter(subtitle => 
                (subtitle.startTime < end && subtitle.endTime > start)
            );
            
            if (overlappingSubtitles.length > 0) {
                subtitleText = overlappingSubtitles.map(sub => sub.text).join(" ");
                subtitleItems.push({ text: subtitleText });
            }
        }
        
        const newMarker = {
            start: start,
            end: end,
            duration: end - start,
            comments: subtitleItems
        };
        
        state.markers.push(newMarker);
        sortMarkers();
        
        const newMarkerIndex = state.markers.indexOf(newMarker);
        state.activeMarkerIndex = newMarkerIndex;
        updateEditMarkerButtonState();
        renderTimelineMarkers();
    }
    
    function sortMarkers() {
        const activeMarker = state.activeMarkerIndex !== -1 ? state.markers[state.activeMarkerIndex] : null;
        
        state.markers.sort((a, b) => a.start - b.start);
        
        if (activeMarker) {
            state.activeMarkerIndex = state.markers.indexOf(activeMarker);
        }
        
        updateMarkersList();
        renderTimelineMarkers();
    }
    
    function loadMarker(index) {
        if (!dom.video.duration || !state.markers[index]) return;
        
        const marker = state.markers[index];
        state.currentSelection.start = marker.start;
        state.currentSelection.end = marker.end;
        state.activeMarkerIndex = index;
        
        const duration = dom.video.duration;
        const startPercent = (marker.start / duration) * 100;
        const endPercent = (marker.end / duration) * 100;
        updateZoom(startPercent, endPercent);
        
        dom.video.currentTime = marker.start;
        updateEditMarkerButtonState();
        updateMarkersList();
        renderTimelineMarkers();
        updateTimeDisplays();
    }
    
    function clearActiveMarker() {
        state.activeMarkerIndex = -1;
        updateEditMarkerButtonState();
        updateMarkersList();
        renderTimelineMarkers();
    }
    
    function removeMarker(index) {
        if (index === state.activeMarkerIndex) {
            state.activeMarkerIndex = -1;
        } else if (index < state.activeMarkerIndex) {
            state.activeMarkerIndex--;
        }
        
        state.markers.splice(index, 1);
        updateEditMarkerButtonState();
        sortMarkers();
    }
    
    function editMarkerText(index, markerElement) {
        const marker = state.markers[index];
        state.editingMarkerIndex = index;
        
        const existingForm = markerElement.querySelector('.marker-edit-form');
        if (existingForm) {
            markerElement.removeChild(existingForm);
            state.editingMarkerIndex = -1;
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
            <div class="mb-2">
                <label class="form-label small">Marker Timing</label>
                <div class="d-flex gap-2">
                    <input type="text" class="form-control form-control-sm marker-in-time" value="${toSMPTE(marker.start)}" placeholder="IN: 00:00:00:00">
                    <input type="text" class="form-control form-control-sm marker-out-time" value="${toSMPTE(marker.end)}" placeholder="OUT: 00:00:00:00">
                </div>
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
            state.editingMarkerIndex = -1;
        });
        
        editForm.querySelector('.save-edit').addEventListener('click', () => {
            const newText = document.getElementById(`marker-text-${index}`).value;
            const newInTime = parseSMPTE(editForm.querySelector('.marker-in-time').value);
            const newOutTime = parseSMPTE(editForm.querySelector('.marker-out-time').value);
            
            if (newText.trim()) {
                if (marker.comments && marker.comments.length > 0) {
                    marker.comments[0].text = newText;
                } else {
                    marker.comments = [{ text: newText }];
                }
            } else {
                marker.comments = [];
            }
            
            if (!isNaN(newInTime) && !isNaN(newOutTime) && newInTime < newOutTime) {
                marker.start = newInTime;
                marker.end = newOutTime;
                marker.duration = newOutTime - newInTime;
            }
            
            state.editingMarkerIndex = -1;
            sortMarkers();
            renderTimelineMarkers();
            markerElement.removeChild(editForm);
        });
    }
    
    function jumpToPreviousMarker() {
        if (!state.markers.length) return;
        
        const currentTime = dom.video.currentTime;
        let prevMarker = null;
        
        for (let i = state.markers.length - 1; i >= 0; i--) {
            if (state.markers[i].start < currentTime - 0.1) {
                prevMarker = state.markers[i];
                break;
            }
        }
        
        if (!prevMarker) {
            prevMarker = state.markers[state.markers.length - 1];
        }
        
        if (prevMarker) {
            const index = state.markers.indexOf(prevMarker);
            loadMarker(index);
        }
    }
    
    function jumpToNextMarker() {
        if (!state.markers.length) return;
        
        const currentTime = dom.video.currentTime;
        let nextMarker = state.markers.find(m => m.start > currentTime + 0.1);
        
        if (!nextMarker) {
            nextMarker = state.markers[0];
        }
        
        if (nextMarker) {
            const index = state.markers.indexOf(nextMarker);
            loadMarker(index);
        }
    }
    
    // ============================================
    // MARKER LIST UI
    // ============================================
    function updateMarkersList(searchTerm = '') {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        
        const filteredMarkers = state.markers
            .map((marker, index) => ({ marker, originalIndex: index }))
            .filter(({ marker }) => {
                if (!lowerCaseSearchTerm) return true;
                const commentObj = marker.comments && marker.comments.length > 0 ? marker.comments[0] : null;
                const displayText = commentObj ? commentObj.text : "";
                return displayText.toLowerCase().includes(lowerCaseSearchTerm);
            });
        
        dom.markersList.innerHTML = state.markers.length ? '<h5 class="mt-3 mb-2">Markers:</h5>' : '';
        
        filteredMarkers.forEach(({ marker, originalIndex }) => {
            const div = document.createElement('div');
            div.className = 'marker-item';
            div.setAttribute('data-index', originalIndex);
            
            if (originalIndex === state.activeMarkerIndex) {
                div.classList.add('editing');
            }
            
            const commentObj = marker.comments && marker.comments.length > 0 ? marker.comments[0] : null;
            const displayText = commentObj ? commentObj.text : "";
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'marker-header';
            headerDiv.innerHTML = `
                <span class="marker-label">Marker ${originalIndex + 1}: ${toSMPTE(marker.start)} - ${toSMPTE(marker.end)} (${toSMPTE(marker.duration)})</span>
                <div class="marker-actions">
                    <button class="btn btn-sm btn-primary me-1 load-marker" title="Load this marker">Load</button>
                    <button class="btn btn-sm btn-info me-1 edit-marker" title="Edit marker">Edit</button>
                    <button class="btn btn-sm btn-danger remove-marker" title="Remove this marker">X</button>
                </div>
            `;
            div.appendChild(headerDiv);
            
            if (displayText) {
                const commentDiv = document.createElement('div');
                commentDiv.className = 'marker-comment';
                commentDiv.textContent = displayText;
                div.appendChild(commentDiv);
            }
            
            headerDiv.querySelector('.marker-label').addEventListener('click', () => {
                loadMarker(originalIndex);
            });
            
            headerDiv.querySelector('.load-marker').addEventListener('click', () => {
                loadMarker(originalIndex);
            });
            
            headerDiv.querySelector('.edit-marker').addEventListener('click', () => {
                editMarkerText(originalIndex, div);
            });
            
            headerDiv.querySelector('.remove-marker').addEventListener('click', () => {
                removeMarker(originalIndex);
            });
            
            dom.markersList.appendChild(div);
        });
    }
    
    // ============================================
    // TIMELINE MARKER REGIONS WITH DRAG/RESIZE
    // ============================================
    function renderTimelineMarkers() {
        const existingMarkers = dom.$mainTimeline[0].querySelectorAll('.timeline-marker-region');
        existingMarkers.forEach(el => el.remove());
        
        if (!dom.video.duration) return;
        
        state.markers.forEach((marker, index) => {
            const startPercent = (marker.start / dom.video.duration) * 100;
            const endPercent = (marker.end / dom.video.duration) * 100;
            const widthPercent = endPercent - startPercent;
            
            const markerRegion = document.createElement('div');
            markerRegion.className = 'timeline-marker-region';
            markerRegion.dataset.markerIndex = index;
            
            markerRegion.style.left = `${startPercent}%`;
            markerRegion.style.width = `${widthPercent}%`;
            
            if (index === state.activeMarkerIndex) {
                markerRegion.classList.add('editing');
            }
            
            // Add resize handles
            const leftHandle = document.createElement('div');
            leftHandle.className = 'resize-handle resize-handle-left';
            markerRegion.appendChild(leftHandle);
            
            const rightHandle = document.createElement('div');
            rightHandle.className = 'resize-handle resize-handle-right';
            markerRegion.appendChild(rightHandle);
            
            // Add marker number label
            const markerNumber = index + 1;
            if (widthPercent > 3) {
                const numberLabel = document.createElement('span');
                numberLabel.className = 'marker-number';
                numberLabel.textContent = markerNumber;
                markerRegion.appendChild(numberLabel);
            }
            
            // Tooltip
            const tooltipText = `Marker ${markerNumber}: ${toSMPTE(marker.start)} - ${toSMPTE(marker.end)}`;
            markerRegion.title = tooltipText;
            
            // Helper function to start left resize
            const startLeftResize = (clientX) => {
                if (index !== state.activeMarkerIndex) {
                    loadMarker(index);
                    // Find the newly rendered element and add dragging class
                    const newMarkerRegion = dom.$mainTimeline[0].querySelector(`.timeline-marker-region[data-marker-index="${index}"]`);
                    if (newMarkerRegion) {
                        newMarkerRegion.classList.add('dragging');
                    }
                } else {
                    markerRegion.classList.add('dragging');
                }
                
                state.isMarkerResizingLeft = true;
                state.markerDragStartX = clientX;
            };
            
            // Helper function to start right resize
            const startRightResize = (clientX) => {
                if (index !== state.activeMarkerIndex) {
                    loadMarker(index);
                    // Find the newly rendered element and add dragging class
                    const newMarkerRegion = dom.$mainTimeline[0].querySelector(`.timeline-marker-region[data-marker-index="${index}"]`);
                    if (newMarkerRegion) {
                        newMarkerRegion.classList.add('dragging');
                    }
                } else {
                    markerRegion.classList.add('dragging');
                }
                
                state.isMarkerResizingRight = true;
                state.markerDragStartX = clientX;
            };
            
            // Helper function to start marker drag
            const startMarkerDrag = (clientX) => {
                state.isMarkerDragging = true;
                state.markerDragStartX = clientX;
                markerRegion.classList.add('dragging');
            };
            
            // Left resize handle - mouse events
            leftHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                startLeftResize(e.clientX);
            });
            
            // Left resize handle - touch events
            leftHandle.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const touch = e.touches[0];
                startLeftResize(touch.clientX);
            }, { passive: false });
            
            // Right resize handle - mouse events
            rightHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                startRightResize(e.clientX);
            });
            
            // Right resize handle - touch events
            rightHandle.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const touch = e.touches[0];
                startRightResize(touch.clientX);
            }, { passive: false });
            
            // Marker region mousedown (for dragging entire marker)
            markerRegion.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('resize-handle')) return;
                
                e.stopPropagation();
                e.preventDefault();
                
                // If not already active, first click selects the marker
                if (index !== state.activeMarkerIndex) {
                    loadMarker(index);
                    return;
                }
                
                // Already active - start dragging
                startMarkerDrag(e.clientX);
            });
            
            // Marker region touchstart (for mobile - selecting and dragging)
            markerRegion.addEventListener('touchstart', (e) => {
                if (e.target.classList.contains('resize-handle')) return;
                
                e.stopPropagation();
                e.preventDefault();
                
                const touch = e.touches[0];
                
                // If not already active, first touch selects the marker
                if (index !== state.activeMarkerIndex) {
                    loadMarker(index);
                    return;
                }
                
                // Already active - start dragging
                startMarkerDrag(touch.clientX);
            }, { passive: false });
            
            dom.$mainTimeline[0].appendChild(markerRegion);
        });
    }
    
    // Handle marker drag/resize mouse move
    function handleMarkerDragMove(e) {
        if (!state.isMarkerDragging && !state.isMarkerResizingLeft && !state.isMarkerResizingRight) return;
        if (state.activeMarkerIndex === -1 || !state.markers[state.activeMarkerIndex]) return;
        if (!dom.video.duration) return;
        
        const marker = state.markers[state.activeMarkerIndex];
        const timelineRect = dom.$mainTimeline[0].getBoundingClientRect();
        const timelineWidth = timelineRect.width;
        const deltaX = e.clientX - state.markerDragStartX;
        const deltaTime = (deltaX / timelineWidth) * dom.video.duration;
        
        state.markerDragStartX = e.clientX;
        
        if (state.isMarkerDragging) {
            // Move entire marker
            const newStart = Math.max(0, Math.min(dom.video.duration - marker.duration, marker.start + deltaTime));
            const newEnd = newStart + marker.duration;
            
            marker.start = newStart;
            marker.end = newEnd;
        } else if (state.isMarkerResizingLeft) {
            // Resize from left (change IN point)
            const minDuration = 0.1;
            const newStart = Math.max(0, Math.min(marker.end - minDuration, marker.start + deltaTime));
            marker.start = newStart;
            marker.duration = marker.end - marker.start;
        } else if (state.isMarkerResizingRight) {
            // Resize from right (change OUT point)
            const minDuration = 0.1;
            const newEnd = Math.max(marker.start + minDuration, Math.min(dom.video.duration, marker.end + deltaTime));
            marker.end = newEnd;
            marker.duration = marker.end - marker.start;
        }
        
        // Update the current selection to match
        state.currentSelection.start = marker.start;
        state.currentSelection.end = marker.end;
        
        // Update visuals in real-time
        updateMarkerRegionVisual(state.activeMarkerIndex);
        updateTimelineSelection();
        updateSliderFromSelection();  // Sync slider handles
        updateTimeDisplays();
        updateMarkersListRealtime(state.activeMarkerIndex);
    }
    
    // Update slider handles to match current selection
    function updateSliderFromSelection() {
        if (!dom.video.duration) return;
        
        const duration = dom.video.duration;
        const zoomRange = state.zoomEnd - state.zoomStart;
        
        // Convert selection times to slider percentages within current zoom
        const startPercent = ((state.currentSelection.start / duration) * 100 - state.zoomStart) / zoomRange * 100;
        const endPercent = ((state.currentSelection.end / duration) * 100 - state.zoomStart) / zoomRange * 100;
        
        // Update slider without triggering events
        dom.$timeSlider.slider('values', [
            Math.max(0, Math.min(100, startPercent)),
            Math.max(0, Math.min(100, endPercent))
        ]);
    }
    
    // Update single marker region visual without full re-render
    function updateMarkerRegionVisual(index) {
        if (!dom.video.duration || !state.markers[index]) return;
        
        const marker = state.markers[index];
        const markerRegion = dom.$mainTimeline[0].querySelector(`.timeline-marker-region[data-marker-index="${index}"]`);
        
        if (markerRegion) {
            const startPercent = (marker.start / dom.video.duration) * 100;
            const widthPercent = ((marker.end - marker.start) / dom.video.duration) * 100;
            
            markerRegion.style.left = `${startPercent}%`;
            markerRegion.style.width = `${widthPercent}%`;
            
            const markerNumber = index + 1;
            markerRegion.title = `Marker ${markerNumber}: ${toSMPTE(marker.start)} - ${toSMPTE(marker.end)}`;
        }
    }
    
    // Update marker list item in real-time during drag
    function updateMarkersListRealtime(index) {
        const marker = state.markers[index];
        if (!marker) return;
        
        const markerItem = dom.markersList.querySelector(`.marker-item[data-index="${index}"]`);
        if (markerItem) {
            const labelSpan = markerItem.querySelector('.marker-label');
            if (labelSpan) {
                labelSpan.textContent = `Marker ${index + 1}: ${toSMPTE(marker.start)} - ${toSMPTE(marker.end)} (${toSMPTE(marker.duration)})`;
            }
        }
    }
    
    // Handle marker drag/resize mouse up
    function handleMarkerDragEnd() {
        if (!state.isMarkerDragging && !state.isMarkerResizingLeft && !state.isMarkerResizingRight) return;
        
        // Remove dragging class
        const draggingRegion = dom.$mainTimeline[0].querySelector('.timeline-marker-region.dragging');
        if (draggingRegion) {
            draggingRegion.classList.remove('dragging');
        }
        
        // Reset drag states
        state.isMarkerDragging = false;
        state.isMarkerResizingLeft = false;
        state.isMarkerResizingRight = false;
        
        // Finalize marker edit (sort and deselect)
        finalizeMarkerEdit();
    }

    // ============================================
    // SUBTITLE PARSING AND MANAGEMENT
    // ============================================
    function parseSRT(srtContent) {
        const srtItems = [];
        const subtitleBlocks = srtContent.trim().split(/\r?\n\r?\n/);
        
        subtitleBlocks.forEach(block => {
            const lines = block.split(/\r?\n/);
            if (lines.length < 3) return;
            
            const timeRange = lines[1];
            const timeMatch = timeRange.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
            
            if (!timeMatch) return;
            
            const startTime = timeToSeconds(timeMatch[1]);
            const endTime = timeToSeconds(timeMatch[2]);
            const textLines = lines.slice(2);
            const text = textLines.join(' ').trim();
            
            srtItems.push({
                startTime,
                endTime,
                text,
                startTimeString: formatTimeForDisplay(startTime)
            });
        });
        
        return srtItems;
    }
    
    function parseWebVTT(vttContent) {
        const vttItems = [];
        const lines = vttContent.split(/\r?\n/);
        
        let inCue = false;
        let currentCueStart = 0;
        let currentCueEnd = 0;
        let currentCueText = "";
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (!line || line === 'WEBVTT') continue;
            
            if (line.includes('-->')) {
                if (inCue && currentCueText) {
                    vttItems.push({
                        startTime: currentCueStart,
                        endTime: currentCueEnd,
                        text: currentCueText.trim(),
                        startTimeString: formatTimeForDisplay(currentCueStart)
                    });
                }
                
                inCue = true;
                currentCueText = "";
                const timestamps = line.split('-->').map(t => t.trim());
                currentCueStart = parseTimestamp(timestamps[0]);
                currentCueEnd = parseTimestamp(timestamps[1]);
                continue;
            }
            
            if (/^\d+$/.test(line)) continue;
            
            if (inCue && line) {
                const cleanLine = line.replace(/<\d\d:\d\d:\d\d\.\d\d\d>|<\/\d\d:\d\d:\d\d\.\d\d\d>/g, '');
                currentCueText += (currentCueText ? " " : "") + cleanLine;
            }
        }
        
        if (inCue && currentCueText) {
            vttItems.push({
                startTime: currentCueStart,
                endTime: currentCueEnd,
                text: currentCueText.trim(),
                startTimeString: formatTimeForDisplay(currentCueStart)
            });
        }
        
        return vttItems;
    }
    
    function extractWordTimings(vttContent) {
        const words = [];
        const lines = vttContent.split(/\r?\n/);
        
        for (const line of lines) {
            const wordMatches = line.matchAll(/<(\d{2}:\d{2}:\d{2}\.\d{3})>([^<]+)<\/?(\d{2}:\d{2}:\d{2}\.\d{3})>/g);
            
            for (const match of wordMatches) {
                const startTime = parseTimestamp(match[1]);
                const text = match[2].trim();
                const endTime = parseTimestamp(match[3]);
                
                if (text) {
                    words.push({ text, startTime, endTime });
                }
            }
        }
        
        return words;
    }
    
    function handleSubtitleFile(file) {
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                
                if (file.name.endsWith('.vtt')) {
                    state.subtitleFormat = "vtt";
                    state.subtitles = parseWebVTT(content);
                    state.wordTimings = extractWordTimings(content);
                    renderTranscript(content);
                } else {
                    state.subtitleFormat = "srt";
                    state.subtitles = parseSRT(content);
                    renderSubtitleList(state.subtitles);
                }
                
                document.getElementById('transcript-tab').click();
            };
            reader.readAsText(file);
        }
    }
    
    function renderSubtitleList(subtitlesToRender) {
        dom.subtitleList.innerHTML = '';
        
        if (subtitlesToRender.length === 0) {
            dom.subtitleList.innerHTML = '<p class="info-text">No subtitles found or match your search.</p>';
            return;
        }
        
        subtitlesToRender.forEach((subtitle, index) => {
            const subtitleItem = document.createElement('div');
            subtitleItem.className = 'subtitle-item';
            subtitleItem.dataset.index = index;
            subtitleItem.dataset.startTime = subtitle.startTime;
            subtitleItem.dataset.endTime = subtitle.endTime;
            
            subtitleItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <span class="time-stamp">${subtitle.startTimeString}</span>
                    <button class="create-marker-from-subtitle" title="Create marker from this subtitle">+</button>
                </div>
                <span class="subtitle-text">${subtitle.text}</span>
            `;
            
            subtitleItem.addEventListener('click', (e) => {
                if (e.target.classList.contains('create-marker-from-subtitle')) return;
                
                const allItems = dom.subtitleList.querySelectorAll('.subtitle-item');
                allItems.forEach(item => item.classList.remove('active'));
                subtitleItem.classList.add('active');
                
                state.currentSelection.start = subtitle.startTime;
                state.currentSelection.end = subtitle.endTime;
                
                const duration = dom.video.duration;
                const startPercent = (subtitle.startTime / duration) * 100;
                const endPercent = (subtitle.endTime / duration) * 100;
                updateZoom(startPercent, endPercent);
                
                dom.video.currentTime = subtitle.startTime;
                dom.video.pause();
            });
            
            subtitleItem.querySelector('.create-marker-from-subtitle').addEventListener('click', (e) => {
                e.stopPropagation();
                createMarkerFromSubtitle(subtitle);
            });
            
            dom.subtitleList.appendChild(subtitleItem);
        });
    }
    
    function renderTranscript(vttContent) {
        dom.subtitleList.innerHTML = '';
        
        if (state.wordTimings.length === 0) {
            renderSubtitleList(state.subtitles);
            return;
        }
        
        const transcriptContainer = document.createElement('div');
        transcriptContainer.className = 'json-transcript';
        
        let currentSegmentIndex = 0;
        let segmentContainer = document.createElement('div');
        segmentContainer.className = 'transcript-segment';
        segmentContainer.dataset.index = currentSegmentIndex;
        
        if (state.subtitles.length > 0) {
            segmentContainer.dataset.startTime = state.subtitles[0].startTime;
            segmentContainer.dataset.endTime = state.subtitles[0].endTime;
            
            const timeStamp = document.createElement('span');
            timeStamp.className = 'time-stamp';
            timeStamp.textContent = formatTimeForDisplay(state.subtitles[0].startTime);
            segmentContainer.appendChild(timeStamp);
            
            const createMarkerBtn = document.createElement('button');
            createMarkerBtn.className = 'create-marker-from-subtitle float-end';
            createMarkerBtn.title = 'Create marker from this segment';
            createMarkerBtn.textContent = '+';
            createMarkerBtn.dataset.segmentIndex = '0';
            createMarkerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const segmentIndex = parseInt(createMarkerBtn.dataset.segmentIndex);
                createMarkerFromSubtitle(state.subtitles[segmentIndex]);
            });
            segmentContainer.appendChild(createMarkerBtn);
        }
        
        state.wordTimings.forEach((word, index) => {
            while (currentSegmentIndex < state.subtitles.length - 1 && 
                    word.startTime >= state.subtitles[currentSegmentIndex + 1].startTime) {
                transcriptContainer.appendChild(segmentContainer);
                
                currentSegmentIndex++;
                segmentContainer = document.createElement('div');
                segmentContainer.className = 'transcript-segment';
                segmentContainer.dataset.index = currentSegmentIndex;
                segmentContainer.dataset.startTime = state.subtitles[currentSegmentIndex].startTime;
                segmentContainer.dataset.endTime = state.subtitles[currentSegmentIndex].endTime;
                
                const timeStamp = document.createElement('span');
                timeStamp.className = 'time-stamp';
                timeStamp.textContent = formatTimeForDisplay(state.subtitles[currentSegmentIndex].startTime);
                segmentContainer.appendChild(timeStamp);
                
                const createMarkerBtn = document.createElement('button');
                createMarkerBtn.className = 'create-marker-from-subtitle float-end';
                createMarkerBtn.title = 'Create marker from this segment';
                createMarkerBtn.textContent = '+';
                createMarkerBtn.dataset.segmentIndex = currentSegmentIndex.toString();
                createMarkerBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const segmentIndex = parseInt(e.target.dataset.segmentIndex);
                    createMarkerFromSubtitle(state.subtitles[segmentIndex]);
                });
                segmentContainer.appendChild(createMarkerBtn);
            }
            
            const wordSpan = document.createElement('span');
            wordSpan.className = 'transcript-word';
            wordSpan.textContent = word.text;
            wordSpan.dataset.start = word.startTime;
            wordSpan.dataset.end = word.endTime;
            
            wordSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                state.currentSelection.start = word.startTime;
                state.currentSelection.end = word.endTime;
                
                const duration = dom.video.duration;
                const startPercent = (word.startTime / duration) * 100;
                const endPercent = (word.endTime / duration) * 100;
                updateZoom(startPercent, endPercent);
                
                dom.video.currentTime = word.startTime;
                dom.video.pause();
            });
            
            segmentContainer.appendChild(wordSpan);
            
            if (index < state.wordTimings.length - 1) {
                segmentContainer.appendChild(document.createTextNode(' '));
            }
        });
        
        transcriptContainer.querySelectorAll('.transcript-segment').forEach(seg => {
            seg.addEventListener('click', (e) => {
                if (e.target.classList.contains('transcript-word') || 
                    e.target.classList.contains('create-marker-from-subtitle')) return;
                
                const start = parseFloat(seg.dataset.startTime);
                const end = parseFloat(seg.dataset.endTime);
                state.currentSelection.start = start;
                state.currentSelection.end = end;
                
                const duration = dom.video.duration;
                const startPercent = (start / duration) * 100;
                const endPercent = (end / duration) * 100;
                updateZoom(startPercent, endPercent);
                
                dom.video.currentTime = start;
                dom.video.pause();
            });
        });
        
        if (segmentContainer.childNodes.length > 0) {
            transcriptContainer.appendChild(segmentContainer);
        }
        
        dom.subtitleList.appendChild(transcriptContainer);
    }
    
    function updateCurrentSubtitle() {
        if (!state.subtitles.length) return;
        
        const currentTime = dom.video.currentTime;
        const index = state.subtitles.findIndex(sub => 
            currentTime >= sub.startTime && currentTime <= sub.endTime
        );
        
        if (index !== state.currentSubtitleIndex) {
            state.currentSubtitleIndex = index;
            const activeItems = dom.subtitleList.querySelectorAll('.active');
            activeItems.forEach(item => item.classList.remove('active'));
            
            if (index !== -1) {
                const currentSubtitle = state.subtitles[index];
                if (state.subtitleFormat === "vtt" && state.wordTimings.length > 0) {
                    const wordsInCue = state.wordTimings.filter(w => 
                        w.startTime >= currentSubtitle.startTime && w.endTime <= currentSubtitle.endTime
                    );
                    let subtitleHTML = "";
                    wordsInCue.forEach(word => {
                        const isActive = currentTime >= word.startTime && currentTime <= word.endTime;
                        subtitleHTML += `<span class="video-subtitle-word ${isActive ? 'word-active' : ''}" data-start="${word.startTime}">${word.text}</span> `;
                    });
                    dom.currentSubtitleDisplay.innerHTML = subtitleHTML.trim();
                } else {
                    dom.currentSubtitleDisplay.textContent = currentSubtitle.text;
                }
                
                const elementToActivate = dom.subtitleList.querySelector(`[data-index='${index}']`);
                if (elementToActivate) {
                    elementToActivate.classList.add('active');
                    if (!dom.video.paused || document.activeElement !== dom.video) {
                        scrollElementIntoViewIfNeeded(elementToActivate, dom.subtitleList);
                    }
                }
                
                if (state.subtitleFormat === "vtt") {
                    updateCurrentWord(currentTime);
                }
            } else {
                dom.currentSubtitleDisplay.textContent = '';
            }
        } else if (state.subtitleFormat === "vtt" && index !== -1) {
            const currentWords = dom.currentSubtitleDisplay.querySelectorAll('.video-subtitle-word');
            currentWords.forEach(word => {
                const start = parseFloat(word.dataset.start);
                const isActive = currentTime >= start && currentTime <= (start + 0.5);
                word.classList.toggle('word-active', isActive);
            });
            
            updateCurrentWord(currentTime);
        }
    }
    
    function updateCurrentWord(currentTime) {
        const activeWords = dom.subtitleList.querySelectorAll('.word-active');
        activeWords.forEach(word => word.classList.remove('word-active'));
        
        const words = dom.subtitleList.querySelectorAll('.transcript-word');
        let activeWordFound = false;
        
        words.forEach(word => {
            const start = parseFloat(word.dataset.start);
            const end = parseFloat(word.dataset.end);
            
            if (currentTime >= start && currentTime <= end) {
                word.classList.add('word-active');
                activeWordFound = true;
                
                const isPlaying = !dom.video.paused;
                if (!isPlaying || document.activeElement !== dom.video) {
                    scrollElementIntoViewIfNeeded(word, dom.subtitleList);
                }
            }
        });
        
        return activeWordFound;
    }
    
    function createMarkerFromSubtitle(subtitle) {
        if (!dom.video.duration) return;
        
        state.currentSelection.start = subtitle.startTime;
        state.currentSelection.end = subtitle.endTime;
        
        const newMarker = {
            start: subtitle.startTime,
            end: subtitle.endTime,
            duration: subtitle.endTime - subtitle.startTime,
            comments: [{
                text: subtitle.text
            }]
        };
        
        state.markers.push(newMarker);
        sortMarkers();
        
        const newMarkerIndex = state.markers.indexOf(newMarker);
        state.activeMarkerIndex = newMarkerIndex;
        updateEditMarkerButtonState();
    }
    
    // ============================================
    // SEARCH FUNCTIONALITY
    // ============================================
    function filterSubtitles() {
        const searchTerm = dom.searchBox.value.toLowerCase().trim();
        
        document.querySelectorAll('.search-match, .current-match').forEach(el => {
            el.classList.remove('search-match', 'current-match');
            const originalText = el.dataset.originalText;
            if (originalText) {
                el.innerHTML = originalText;
            }
        });
        
        state.searchMatches = [];
        state.currentMatchIndex = -1;
        updateSearchResultsUI();
        
        if (!searchTerm) {
            if (state.subtitleFormat === "vtt") {
                dom.subtitleList.querySelectorAll('.transcript-word').forEach(word => {
                    word.classList.remove('search-match', 'current-match');
                });
            }
            return;
        }
        
        let matchesFound = [];
        
        if (state.subtitleFormat === 'vtt' && state.wordTimings.length > 0) {
            const allWords = Array.from(dom.subtitleList.querySelectorAll('.transcript-word'));
            const searchWords = searchTerm.split(/\s+/);
            
            for (let i = 0; i <= allWords.length - searchWords.length; i++) {
                let potentialMatch = [];
                let fullMatch = true;
                
                for (let j = 0; j < searchWords.length; j++) {
                    const wordElement = allWords[i + j];
                    const wordText = wordElement.textContent.toLowerCase();
                    if (wordText.includes(searchWords[j])) {
                        potentialMatch.push(wordElement);
                    } else {
                        fullMatch = false;
                        break;
                    }
                }
                
                if (fullMatch) {
                    let isContiguous = true;
                    for (let k = 0; k < potentialMatch.length - 1; k++) {
                        const end = parseFloat(potentialMatch[k].dataset.end);
                        const start = parseFloat(potentialMatch[k+1].dataset.start);
                        if (start - end > 1.0) {
                            isContiguous = false;
                            break;
                        }
                    }
                    
                    if(isContiguous) {
                        matchesFound.push(potentialMatch);
                        i += potentialMatch.length - 1;
                    }
                }
            }
            
            matchesFound.forEach(phrase => phrase.forEach(word => word.classList.add('search-match')));
        } else {
            const items = dom.subtitleList.querySelectorAll('.subtitle-item, .transcript-segment');
            items.forEach(item => {
                const textElement = item.querySelector('.subtitle-text') || item;
                const originalText = textElement.textContent;
                if (originalText.toLowerCase().includes(searchTerm)) {
                    if(item.classList.contains('subtitle-item')) {
                        const regex = new RegExp(`(${searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
                        textElement.dataset.originalText = originalText;
                        textElement.innerHTML = originalText.replace(regex, '<span class="search-match">$1</span>');
                    } else {
                        item.classList.add('search-match');
                    }
                    matchesFound.push(item);
                }
            });
        }
        
        if (matchesFound.length > 0) {
            state.searchMatches = matchesFound;
            state.currentMatchIndex = 0;
            highlightCurrentMatch();
        }
        
        updateSearchResultsUI();
    }
    
    function navigateToPreviousMatch() {
        if (state.searchMatches.length === 0) return;
        state.currentMatchIndex = (state.currentMatchIndex > 0) 
            ? state.currentMatchIndex - 1 
            : state.searchMatches.length - 1;
        highlightCurrentMatch();
    }
    
    function navigateToNextMatch() {
        if (state.searchMatches.length === 0) return;
        state.currentMatchIndex = (state.currentMatchIndex < state.searchMatches.length - 1) 
            ? state.currentMatchIndex + 1 
            : 0;
        highlightCurrentMatch();
    }
    
    function highlightCurrentMatch() {
        document.querySelectorAll('.current-match').forEach(el => el.classList.remove('current-match'));
        
        if (state.searchMatches.length === 0 || state.currentMatchIndex === -1) return;
        
        const currentMatch = state.searchMatches[state.currentMatchIndex];
        let firstElement;
        let selectionStart, selectionEnd;
        
        if (Array.isArray(currentMatch)) {
            currentMatch.forEach(word => word.classList.add('current-match'));
            firstElement = currentMatch[0];
            selectionStart = parseFloat(firstElement.dataset.start);
            selectionEnd = parseFloat(currentMatch[currentMatch.length - 1].dataset.end);
        } else {
            currentMatch.classList.add('current-match');
            firstElement = currentMatch;
            if (firstElement.classList.contains('transcript-word')) {
                selectionStart = parseFloat(firstElement.dataset.start);
                selectionEnd = parseFloat(firstElement.dataset.end);
            } else {
                const index = parseInt(firstElement.dataset.index);
                if (!isNaN(index) && state.subtitles[index]) {
                    selectionStart = state.subtitles[index].startTime;
                    selectionEnd = state.subtitles[index].endTime;
                }
            }
        }
        
        if (firstElement) {
            scrollElementIntoViewIfNeeded(firstElement, dom.subtitleList);
        }
        
        if(selectionStart !== undefined && selectionEnd !== undefined) {
            state.currentSelection.start = selectionStart;
            state.currentSelection.end = selectionEnd;
            
            const duration = dom.video.duration;
            const startPercent = (selectionStart / duration) * 100;
            const endPercent = (selectionEnd / duration) * 100;
            updateZoom(startPercent, endPercent);
        }
        
        updateSearchResultsUI();
    }
    
    function addSearchResultsAsMarkers() {
        if (!state.searchMatches.length || !dom.video.duration) {
            alert('No search results found or video not loaded.');
            return;
        }
        
        const applyPadding = dom.applySearchPaddingCheckbox.checked;
        let paddingDuration = 0;
        let paddingMode = 'mid';
        
        if (applyPadding) {
            const minutes = parseInt(dom.minutesInput.value) || 0;
            const seconds = parseInt(dom.secondsInput.value) || 0;
            const frames = parseInt(dom.framesInput.value) || 0;
            paddingDuration = minutes * 60 + seconds + (frames / state.frameRate);
            paddingMode = dom.playheadPositionSelect.value;
            
            if(paddingDuration <= 0) {
                alert("Please set a positive duration in the 'Precise Range Duration' controls to use for padding.");
                return;
            }
        }
        
        let newMarkersCount = 0;
        
        state.searchMatches.forEach(match => {
            let originalStart, originalEnd, text;
            
            if(Array.isArray(match)) {
                originalStart = parseFloat(match[0].dataset.start);
                originalEnd = parseFloat(match[match.length-1].dataset.end);
                text = match.map(el => el.textContent).join(' ');
            } else {
                const index = parseInt(match.dataset.index);
                if(!isNaN(index) && state.subtitles[index]) {
                    const sub = state.subtitles[index];
                    originalStart = sub.startTime;
                    originalEnd = sub.endTime;
                    text = sub.text;
                }
            }
            
            if(originalStart !== undefined) {
                let finalStart = originalStart;
                let finalEnd = originalEnd;
                
                if (applyPadding) {
                    switch (paddingMode) {
                        case 'in':
                            finalStart = originalStart;
                            finalEnd = originalStart + paddingDuration;
                            break;
                        case 'out':
                            finalEnd = originalEnd;
                            finalStart = originalEnd - paddingDuration;
                            break;
                        case 'mid':
                            const midpoint = originalStart + (originalEnd - originalStart) / 2;
                            finalStart = midpoint - (paddingDuration / 2);
                            finalEnd = midpoint + (paddingDuration / 2);
                            break;
                    }
                }
                
                finalStart = Math.max(0, finalStart);
                finalEnd = Math.min(dom.video.duration, finalEnd);
                
                if (finalStart < finalEnd) {
                    state.markers.push({
                        start: finalStart,
                        end: finalEnd,
                        duration: finalEnd - finalStart,
                        comments: [{ text: text }]
                    });
                    newMarkersCount++;
                }
            }
        });
        
        if (newMarkersCount > 0) {
            sortMarkers();
            document.getElementById('markers-tab').click();
            alert(`Added ${newMarkersCount} new markers from search results.`);
        }
    }
    
    function updateSearchResultsUI() {
        const hasMatches = state.searchMatches.length > 0;
        
        dom.searchNavigation.style.display = hasMatches ? 'flex' : 'none';
        
        if (dom.addSearchMarkersBtn) {
            dom.addSearchMarkersBtn.style.display = hasMatches ? 'block' : 'none';
        }
        
        if (hasMatches) {
            document.getElementById('search-count').textContent = 
                `${state.currentMatchIndex + 1} of ${state.searchMatches.length}`;
        } else {
            document.getElementById('search-count').textContent = `0 results`;
        }
    }
    
    function updateSearchClearButton() {
        dom.searchClearBtn.style.display = dom.searchBox.value.trim() ? 'block' : 'none';
    }
    
    function clearSearch() {
        dom.searchBox.value = '';
        updateSearchClearButton();
        filterSubtitles();
    }
    
    // ============================================
    // ZOOM WITH PADDING
    // ============================================
    function updateZoom(start, end, withPadding = true) {
        const timelineStart = start;
        const timelineEnd = end;
        
        if (withPadding) {
            const range = end - start;
            const padding = range * 0.1;
            start = Math.max(0, start - padding);
            end = Math.min(100, end + padding);
        }
        
        state.zoomStart = start;
        state.zoomEnd = end;
        
        dom.$mainTimelineSelection.css({
            left: timelineStart + '%',
            width: (timelineEnd - timelineStart) + '%'
        });
        
        const duration = dom.video.duration || 0;
        const currentStartPercent = ((state.currentSelection.start / duration) * 100 - start) / 
                                    (end - start) * 100;
        const currentEndPercent = ((state.currentSelection.end / duration) * 100 - start) / 
                                  (end - start) * 100;
        
        dom.$timeSlider.slider('values', [
            Math.max(0, Math.min(100, currentStartPercent)),
            Math.max(0, Math.min(100, currentEndPercent))
        ]);
    }
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    function updateVideoFromSlider(sliderValue) {
        const duration = dom.video.duration || 0;
        const zoomRange = state.zoomEnd - state.zoomStart;
        const time = (sliderValue / 100) * (duration * (zoomRange / 100)) + 
                    (duration * (state.zoomStart / 100));
        dom.video.currentTime = time;
    }
    
    function toSMPTE(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const frames = Math.floor((seconds * state.frameRate) % state.frameRate);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
    }
    
    function parseSMPTE(smpteString) {
        const parts = smpteString.split(':');
        if (parts.length !== 4) return NaN;
        
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        const seconds = parseInt(parts[2], 10);
        const frames = parseInt(parts[3], 10);
        
        return hours * 3600 + minutes * 60 + seconds + (frames / state.frameRate);
    }
    
    function updateTimeDisplays() {
        if (!dom.video.duration) return;
        
        $('#current-time-value').text(toSMPTE(dom.video.currentTime));
        $('#duration-time-value').text(toSMPTE(dom.video.duration));
        $('#selection-time').text(
            `IN: ${toSMPTE(state.currentSelection.start)} - OUT: ${toSMPTE(state.currentSelection.end)}`
        );
        $('#selection-duration').text(
            `Duration: ${toSMPTE(state.currentSelection.end - state.currentSelection.start)}`
        );
        
        const playheadPercent = (dom.video.currentTime / dom.video.duration) * 100;
        dom.$mainPlayhead.css('left', playheadPercent + '%');
    }
    
    function updateTimelineSelection() {
        if (!dom.video.duration) return;
        
        const startPercent = (state.currentSelection.start / dom.video.duration) * 100;
        const endPercent = (state.currentSelection.end / dom.video.duration) * 100;
        
        dom.$mainTimelineSelection.css({
            left: startPercent + '%',
            width: (endPercent - startPercent) + '%'
        });
    }
    
    function updateEditMarkerButtonState() {
        if (!dom.editActiveMarkerBtn) return;
        
        const hasActiveMarker = state.activeMarkerIndex !== -1 && 
                                state.markers[state.activeMarkerIndex];
        
        dom.editActiveMarkerBtn.disabled = !hasActiveMarker;
    }
    
    function timeToSeconds(timeString) {
        if (typeof timeString === 'number') return timeString;
        
        if (timeString.includes(',')) {
            const [time, milliseconds] = timeString.split(',');
            const [hours, minutes, seconds] = time.split(':').map(Number);
            return hours * 3600 + minutes * 60 + seconds + parseInt(milliseconds) / 1000;
        }
        
        return parseTimestamp(timeString);
    }
    
    function parseTimestamp(timestamp) {
        const match = timestamp.match(/(\d+):(\d+):(\d+)\.(\d+)/);
        if (match) {
            const hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            const seconds = parseInt(match[3], 10);
            const milliseconds = parseInt(match[4], 10);
            return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
        }
        
        const shortMatch = timestamp.match(/(\d+):(\d+)\.(\d+)/);
        if (shortMatch) {
            const minutes = parseInt(shortMatch[1], 10);
            const seconds = parseInt(shortMatch[2], 10);
            const milliseconds = parseInt(shortMatch[3], 10);
            return minutes * 60 + seconds + milliseconds / 1000;
        }
        
        return 0;
    }
    
    function formatTimeForDisplay(timeInSeconds) {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    function scrollElementIntoViewIfNeeded(element, container) {
        if (!element || !container) return;
        
        const containerHeight = container.clientHeight;
        const scrollTop = container.scrollTop;
        const elementTop = element.offsetTop - container.offsetTop;
        const elementHeight = element.offsetHeight;
        
        const isAbove = elementTop < scrollTop;
        const isBelow = (elementTop + elementHeight) > (scrollTop + containerHeight);
        
        if (isAbove || isBelow) {
            const targetScroll = elementTop - (containerHeight / 2) + (elementHeight / 2);
            container.scrollTo({
                top: targetScroll,
                behavior: 'smooth'
            });
        }
    }
    
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    function updateFramesInputMax() {
        const maxFrames = Math.ceil(state.frameRate);
        dom.framesInput.max = maxFrames - 1;
        dom.framesInput.placeholder = `0-${maxFrames - 1}`;
        if (parseInt(dom.framesInput.value) >= maxFrames) {
            dom.framesInput.value = 0;
        }
    }
    
    function updateMarkerSearchClearButton() {
        dom.markerSearchClearBtn.style.display = dom.markerSearchInput.value.trim() ? 'block' : 'none';
    }
    
    function clearMarkerSearch() {
        dom.markerSearchInput.value = '';
        updateMarkerSearchClearButton();
        updateMarkersList();
    }
    
    // ============================================
    // FPS DETECTION
    // ============================================
    function ticker(useless, metadata) {
        if (state.fpsDetector.isComplete) return;
        
        const mediaTimeDiff = Math.abs(metadata.mediaTime - state.fpsDetector.lastMediaTime);
        const frameNumDiff = Math.abs(metadata.presentedFrames - state.fpsDetector.lastFrameNum);
        const diff = mediaTimeDiff / frameNumDiff;
        
        if (diff && diff < 1 && state.fpsDetector.frameNotSeeked && 
            state.fpsDetector.fpsRounder.length < 50 && 
            dom.video.playbackRate === 1 && document.hasFocus()) {
            
            state.fpsDetector.fpsRounder.push(diff);
            const avgFps = state.fpsDetector.fpsRounder.reduce((a, b) => a + b) / state.fpsDetector.fpsRounder.length;
            state.fpsDetector.detectedFps = Math.round(1 / avgFps);
            
            const certainty = state.fpsDetector.fpsRounder.length * 2;
            dom.detectedFpsDisplay.textContent = `${state.fpsDetector.detectedFps} fps (${certainty}%)`;
            
            if (certainty >= 50) {
                const closestRate = findClosestFrameRate(state.fpsDetector.detectedFps);
                dom.framerateSelect.value = closestRate.toString();
                state.frameRate = closestRate;
                updateTimeDisplays();
            }
            
            if (state.fpsDetector.fpsRounder.length >= 50) {
                state.fpsDetector.isComplete = true;
                dom.detectedFpsDisplay.textContent += ' ✓';
                return;
            }
        }
        
        state.fpsDetector.frameNotSeeked = true;
        state.fpsDetector.lastMediaTime = metadata.mediaTime;
        state.fpsDetector.lastFrameNum = metadata.presentedFrames;
        
        if (!state.fpsDetector.isComplete) {
            dom.video.requestVideoFrameCallback(ticker);
        }
    }
    
    function findClosestFrameRate(detectedFps) {
        const frameRates = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
        return frameRates.reduce((prev, curr) => 
            Math.abs(curr - detectedFps) < Math.abs(prev - detectedFps) ? curr : prev
        );
    }
    
    // ============================================
    // VIDEO LOADING AND FILE MANAGEMENT
    // ============================================
    function loadVideo(file) {
        if (file && file.type.startsWith('video/')) {
            state.originalFileName = file.name;
            state.originalFilePath = file.path || file.name;
            
            if (state.currentVideoUrl) {
                URL.revokeObjectURL(state.currentVideoUrl);
            }
            state.currentVideoUrl = URL.createObjectURL(file);
            dom.video.src = state.currentVideoUrl;
            
            state.audioInfo = { samplerate: null, channelcount: null };
            dom.currentSubtitleDisplay.textContent = '';
            
            dom.video.onerror = () => {
                console.error('Error loading video:', dom.video.error);
                alert('Error loading video. Please try another file.');
            };
        } else {
            alert('Please upload a valid video file.');
        }
    }
    
    // ============================================
    // JSON IMPORT/EXPORT
    // ============================================
    async function handleJSONImport(file) {
        try {
            const text = await file.text();
            const jsonData = JSON.parse(text);
            
            if (jsonData.video && jsonData.clips) {
                if (jsonData.video.file.media.video.timecode.rate.timebase) {
                    const jsonFrameRate = parseFloat(jsonData.video.file.media.video.timecode.rate.timebase);
                    dom.framerateSelect.value = jsonFrameRate.toString();
                    state.frameRate = jsonFrameRate;
                }
                
                state.markers = jsonData.clips.map(clip => ({
                    start: clip.start / state.frameRate,
                    end: clip.end / state.frameRate,
                    duration: (clip.end - clip.start) / state.frameRate,
                    comments: clip.comments || []
                }));
                
                // Clear active marker after import
                state.activeMarkerIndex = -1;
                updateEditMarkerButtonState();
                sortMarkers();
                renderTimelineMarkers();
            } else {
                throw new Error('Invalid JSON format. Expected a project file with video and clips data.');
            }
        } catch (error) {
            console.error('Error importing JSON:', error);
            alert('Error importing project file. Please check the file format.');
        }
    }
    
    async function saveJSON() {
        if (!dom.video.duration) {
            alert('Please load a video first.');
            return;
        }
        
        if (!state.audioInfo.samplerate) {
            state.audioInfo = await detectAudioInfo(dom.video);
        }
        
        const customPath = dom.customPathInput.value.trim();
        if (customPath) saveCustomPath(customPath);
        const pathUrl = customPath || `C:/Videos/`;
        
        const videoData = {
            "sequence": { "name": state.originalFileName.split('.')[0] },
            "video": {
                "file": {
                    "name": state.originalFileName,
                    "pathurl": pathUrl + state.originalFileName,
                    "media": {
                        "video": {
                            "duration": Math.round(dom.video.duration * state.frameRate),
                            "timecode": {
                                "rate": {
                                    "ntsc": [29.97, 59.94, 23.976].includes(state.frameRate) ? "TRUE" : "FALSE",
                                    "timebase": state.frameRate
                                },
                                "displayformat": "NDF",
                                "first_timecode": "00:00:00:00"
                            },
                            "samplecharacteristics": {
                                "width": dom.video.videoWidth,
                                "height": dom.video.videoHeight,
                                "anamorphic": "FALSE",
                                "pixelaspectratio": "Square"
                            }
                        },
                        "audio": {
                            "samplecharacteristics": {
                                "depth": 16,
                                "samplerate": state.audioInfo.samplerate.toString()
                            },
                            "channelcount": state.audioInfo.channelcount
                        }
                    }
                }
            },
            "clips": state.markers.map((marker, index) => ({
                "id": (index + 1).toString(),
                "start": Math.round(marker.start * state.frameRate),
                "end": Math.round(marker.end * state.frameRate),
                "comments": marker.comments ? marker.comments.map(sub => ({
                    text: sub.text
                })) : []
            }))
        };
        
        const blob = new Blob([JSON.stringify(videoData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.originalFileName.split('.')[0]}-project.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    async function detectAudioInfo(video) {
        try {
            if (!state.audioContext) {
                state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const source = state.audioContext.createMediaElementSource(video);
                source.connect(state.audioContext.destination);
            }
            return {
                samplerate: state.audioContext.sampleRate,
                channelcount: (video.mozChannels || video.webkitAudioChannelCount || 2)
            };
        } catch (e) {
            console.warn('Could not detect audio info:', e);
            return { samplerate: 48000, channelcount: 2 };
        }
    }
    
    // ============================================
    // PATH MANAGEMENT
    // ============================================
    function updatePathDropdown() {
        const savedPaths = JSON.parse(localStorage.getItem('customPaths') || '[]');
        
        while (dom.savedPathsSelect.options.length > 1) {
            dom.savedPathsSelect.remove(1);
        }
        
        savedPaths.forEach(path => {
            const option = document.createElement('option');
            option.value = path;
            option.textContent = path;
            dom.savedPathsSelect.appendChild(option);
        });
    }
    
    function saveCustomPath(path) {
        const savedPaths = JSON.parse(localStorage.getItem('customPaths') || '[]');
        const existingIndex = savedPaths.indexOf(path);
        if (existingIndex !== -1) savedPaths.splice(existingIndex, 1);
        savedPaths.unshift(path);
        if (savedPaths.length > 5) savedPaths.pop();
        localStorage.setItem('customPaths', JSON.stringify(savedPaths));
        updatePathDropdown();
    }
    
    // ============================================
    // DRAG AND DROP
    // ============================================
    function setupDragAndDrop() {
        const handleDragOver = (e) => {
            e.preventDefault();
            e.stopPropagation();
            dom.dropZone.classList.add('drag-over');
        };
        
        const handleDragLeave = (e) => {
            e.preventDefault();
            e.stopPropagation();
            dom.dropZone.classList.remove('drag-over');
        };
        
        const handleDrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            dom.dropZone.classList.remove('drag-over');
            
            const files = Array.from(e.dataTransfer.files);
            const videoFiles = files.filter(f => f.type.startsWith('video/'));
            const subtitleFiles = files.filter(f => f.name.endsWith('.srt') || f.name.endsWith('.vtt') || f.name.endsWith('.txt'));
            const jsonFiles = files.filter(f => f.name.endsWith('.json'));
            
            if (videoFiles.length > 0) loadVideo(videoFiles[0]);
            if (jsonFiles.length > 0) handleJSONImport(jsonFiles[0]);
            if (subtitleFiles.length > 0) handleSubtitleFile(subtitleFiles[0]);
        };
        
        dom.dropZone.addEventListener('dragover', handleDragOver);
        dom.dropZone.addEventListener('dragleave', handleDragLeave);
        dom.dropZone.addEventListener('drop', handleDrop);
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.body.addEventListener(eventName, e => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
    }
    
    // ============================================
    // KEYBOARD SHORTCUTS
    // ============================================
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || 
                e.target.tagName === 'SELECT' || 
                e.target.tagName === 'TEXTAREA') {
                return;
            }
            
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
                    $('#play-pause').click();
                    break;
                    
                case 'ArrowLeft':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        $('#frame-back').click();
                    }
                    break;
                    
                case 'ArrowRight':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        $('#frame-forward').click();
                    }
                    break;
                    
                case 'KeyI':
                    e.preventDefault();
                    $('#set-in-point').click();
                    break;
                    
                case 'KeyO':
                    e.preventDefault();
                    $('#set-out-point').click();
                    break;
                    
                case 'BracketLeft':
                    e.preventDefault();
                    addMarker();
                    break;
                    
                case 'BracketRight':
                    e.preventDefault();
                    $('#set-precise-range').click();
                    break;
                    
                case 'KeyX':
                    e.preventDefault();
                    $('#reset-zoom').click();
                    break;
                    
                case 'KeyQ':
                    if (e.shiftKey) {
                        e.preventDefault();
                        jumpToPreviousMarker();
                    } else {
                        e.preventDefault();
                        $('#jump-to-in').click();
                    }
                    break;
                    
                case 'KeyW':
                    if (e.shiftKey) {
                        e.preventDefault();
                        jumpToNextMarker();
                    } else {
                        e.preventDefault();
                        $('#jump-to-out').click();
                    }
                    break;
                    
                case 'KeyT':
                    e.preventDefault();
                    const tabs = document.querySelectorAll('[data-bs-toggle="tab"]');
                    const activeTab = document.querySelector('.nav-link.active');
                    const activeIndex = Array.from(tabs).indexOf(activeTab);
                    const nextIndex = (activeIndex + 1) % tabs.length;
                    tabs[nextIndex].click();
                    break;
                    
                case 'Escape':
                    e.preventDefault();
                    state.editingMarkerIndex = -1;
                    // Also clear active marker on Escape
                    clearActiveMarker();
                    if (window.getSelection) {
                        window.getSelection().removeAllRanges();
                    }
                    document.querySelectorAll('.marker-edit-form').forEach(form => form.remove());
                    break;
            }
        });
    }
    
    // ============================================
    // EVENT HANDLERS SETUP
    // ============================================
    function setupEventHandlers() {
        // Playback controls
        $('#play-pause').on('click', function() {
            if (dom.video.paused) {
                dom.video.play();
                $(this).text('Pause');
            } else {
                dom.video.pause();
                $(this).text('Play');
            }
        });
        
        $('#stop').on('click', function() {
            dom.video.pause();
            dom.video.currentTime = 0;
            $('#play-pause').text('Play');
            updateTimeDisplays();
        });
        
        $('#frame-forward').on('click', () => {
            const currentFrame = Math.round(dom.video.currentTime * state.frameRate);
            dom.video.currentTime = Math.min(dom.video.duration, (currentFrame + 1) / state.frameRate);
        });
        
        $('#frame-back').on('click', () => {
            const currentFrame = Math.round(dom.video.currentTime * state.frameRate);
            dom.video.currentTime = Math.max(0, (currentFrame - 1) / state.frameRate);
        });
        
        // Selection controls
        $('#set-in-point').on('click', function() {
            if (!dom.video.duration) return;
            state.currentSelection.start = dom.video.currentTime;
            
            const startPercent = (state.currentSelection.start / dom.video.duration) * 100;
            const endPercent = (state.currentSelection.end / dom.video.duration) * 100;
            updateZoom(startPercent, endPercent);
            updateTimeDisplays();
        });
        
        $('#set-out-point').on('click', function() {
            if (!dom.video.duration) return;
            state.currentSelection.end = dom.video.currentTime;
            
            const startPercent = (state.currentSelection.start / dom.video.duration) * 100;
            const endPercent = (state.currentSelection.end / dom.video.duration) * 100;
            updateZoom(startPercent, endPercent);
            updateTimeDisplays();
        });
        
        $('#reset-zoom').on('click', function() {
            if (!dom.video.duration) return;
            state.currentSelection.start = 0;
            state.currentSelection.end = dom.video.duration;
            // Clear active marker when resetting
            clearActiveMarker();
            updateZoom(0, 100, false);
            updateTimeDisplays();
        });
        
        $('#jump-to-in').on('click', () => {
            dom.video.currentTime = state.currentSelection.start;
            updateTimeDisplays();
        });
        
        $('#jump-to-out').on('click', () => {
            dom.video.currentTime = state.currentSelection.end;
            updateTimeDisplays();
        });
        
        // Repeat toggle
        $('#repeat-play').on('click', function() {
            state.isRepeating = !state.isRepeating;
            $(this).toggleClass('active', state.isRepeating);
        });
        
        // Main timeline click - deselect markers when clicking empty space
        dom.$mainTimeline.on('click', function(e) {
            if (!dom.video.duration) return;
            
            // Check if clicked on a marker region
            if (e.target.closest('.timeline-marker-region')) {
                return; // Marker region handles its own click
            }
            
            // Clicked on empty space - deselect active marker
            if (state.activeMarkerIndex !== -1) {
                clearActiveMarker();
            }
            
            const rect = this.getBoundingClientRect();
            const position = (e.clientX - rect.left) / rect.width;
            dom.video.currentTime = position * dom.video.duration;
            updateTimeDisplays();
        });
        
        // Main timeline touch - deselect markers when tapping empty space (mobile)
        dom.$mainTimeline.on('touchend', function(e) {
            if (!dom.video.duration) return;
            
            // Don't handle if we were dragging
            if (state.isMarkerDragging || state.isMarkerResizingLeft || state.isMarkerResizingRight) {
                return;
            }
            
            // Check if tapped on a marker region
            if (e.target.closest('.timeline-marker-region')) {
                return; // Marker region handles its own touch
            }
            
            // Tapped on empty space - deselect active marker
            if (state.activeMarkerIndex !== -1) {
                clearActiveMarker();
            }
            
            // Get touch position and seek
            const touch = e.originalEvent.changedTouches[0];
            const rect = this.getBoundingClientRect();
            const position = (touch.clientX - rect.left) / rect.width;
            dom.video.currentTime = Math.max(0, Math.min(dom.video.duration, position * dom.video.duration));
            updateTimeDisplays();
        });
        
        // Video events
        dom.video.addEventListener('timeupdate', function() {
            updateTimeDisplays();
            updateCurrentSubtitle();
            
            if (state.isRepeating && dom.video.currentTime >= state.currentSelection.end) {
                dom.video.currentTime = state.currentSelection.start;
                dom.video.play();
            }
        });
        
        dom.video.addEventListener('loadedmetadata', function() {
            state.currentSelection.start = 0;
            state.currentSelection.end = dom.video.duration;
            updateZoom(0, 100, false);
            updateTimeDisplays();
            renderTimelineMarkers();
            
            state.fpsDetector.isComplete = false;
            state.fpsDetector.fpsRounder = [];
            
            if (dom.video.requestVideoFrameCallback) {
                dom.video.requestVideoFrameCallback(ticker);
            }
        });
        
        dom.video.addEventListener('seeking', () => {
            state.fpsDetector.fpsRounder.pop();
            state.fpsDetector.frameNotSeeked = false;
        });
        
        // Marker controls
        $('#add-marker').on('click', addMarker);
        $('#save-json').on('click', saveJSON);
        $('#edit-active-marker').on('click', () => {
            const activeIndex = state.activeMarkerIndex;
            if (activeIndex !== -1 && state.markers[activeIndex]) {
                document.getElementById('markers-tab').click();
                
                const markerElement = document.querySelector(`.marker-item[data-index="${activeIndex}"]`);
                if (markerElement) {
                    editMarkerText(activeIndex, markerElement);
                    
                    setTimeout(() => {
                        markerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                }
            }
        });
        
        // Navigation buttons
        $('#prev-marker-btn').on('click', jumpToPreviousMarker);
        $('#next-marker-btn').on('click', jumpToNextMarker);
        
        // Precise range duration
        $('#set-precise-range').on('click', function() {
            if (!dom.video.duration) return;
            
            const minutes = parseInt(dom.minutesInput.value) || 0;
            const seconds = parseInt(dom.secondsInput.value) || 0;
            const frames = parseInt(dom.framesInput.value) || 0;
            const newDuration = minutes * 60 + seconds + (frames / state.frameRate);
            
            let newStart, newEnd;
            const currentTime = dom.video.currentTime;
            
            switch (dom.playheadPositionSelect.value) {
                case 'in':
                    newStart = currentTime;
                    newEnd = Math.min(dom.video.duration, newStart + newDuration);
                    break;
                case 'out':
                    newEnd = currentTime;
                    newStart = Math.max(0, newEnd - newDuration);
                    break;
                case 'mid':
                    const halfDuration = newDuration / 2;
                    newStart = Math.max(0, currentTime - halfDuration);
                    newEnd = Math.min(dom.video.duration, currentTime + halfDuration);
                    break;
            }
            
            state.currentSelection.start = newStart;
            state.currentSelection.end = newEnd;
            
            const startPercent = (newStart / dom.video.duration) * 100;
            const endPercent = (newEnd / dom.video.duration) * 100;
            updateZoom(startPercent, endPercent);
            updateTimeDisplays();
        });
        
        // File inputs
        dom.fileInput.addEventListener('change', e => {
            if (e.target.files[0]) loadVideo(e.target.files[0]);
            e.target.blur();
        });
        
        dom.jsonInput.addEventListener('change', e => {
            if (e.target.files[0]) handleJSONImport(e.target.files[0]);
            e.target.blur();
        });
        
        dom.subtitleInput.addEventListener('change', e => {
            if (e.target.files[0]) handleSubtitleFile(e.target.files[0]);
            e.target.blur();
        });
        
        // Search functionality
        dom.searchBox.addEventListener('input', () => {
            updateSearchClearButton();
            debounce(filterSubtitles, 300)();
        });
        
        dom.searchClearBtn.addEventListener('click', clearSearch);
        dom.prevMatchBtn.addEventListener('click', navigateToPreviousMatch);
        dom.nextMatchBtn.addEventListener('click', navigateToNextMatch);
        
        // Marker search
        dom.markerSearchInput.addEventListener('input', () => {
            updateMarkerSearchClearButton();
            updateMarkersList(dom.markerSearchInput.value);
        });
        
        dom.markerSearchClearBtn.addEventListener('click', clearMarkerSearch);
        
        // Search padding
        dom.applySearchPaddingCheckbox.addEventListener('change', () => {
            dom.paddingInfoText.style.display = dom.applySearchPaddingCheckbox.checked ? 'inline' : 'none';
        });
        
        // Add search markers
        if (dom.addSearchMarkersBtn) {
            dom.addSearchMarkersBtn.addEventListener('click', addSearchResultsAsMarkers);
        }
        
        // Path management
        dom.savePathBtn.addEventListener('click', () => {
            const path = dom.customPathInput.value.trim();
            if (path) saveCustomPath(path);
        });
        
        dom.savedPathsSelect.addEventListener('change', function() {
            if (this.value) dom.customPathInput.value = this.value;
        });
        
        // Frame rate change
        dom.framerateSelect.addEventListener('change', () => {
            state.frameRate = parseFloat(dom.framerateSelect.value);
            updateFramesInputMax();
            updateMarkersList();
            updateTimeDisplays();
        });
        
        // Document-level mouse events for marker dragging
        $(document).on('mousemove', handleMarkerDragMove);
        $(document).on('mouseup', handleMarkerDragEnd);
        
        // Touch events for marker dragging (mobile support)
        $(document).on('touchmove', function(e) {
            if (state.isMarkerDragging || state.isMarkerResizingLeft || state.isMarkerResizingRight) {
                e.preventDefault();
                const touch = e.originalEvent.touches[0];
                handleMarkerDragMove({ clientX: touch.clientX, clientY: touch.clientY });
            }
        });
        $(document).on('touchend', handleMarkerDragEnd);
        
        // Document-level click to deselect markers when clicking outside
        $(document).on('click', function(e) {
            // Don't deselect if clicking on marker-related elements
            if ($(e.target).closest('.timeline-marker-region, .marker-item, #time-slider, .ui-slider-handle, .ui-slider-range').length > 0) {
                return;
            }
            
            // Don't deselect if clicking on marker control buttons
            if ($(e.target).closest('#add-marker, #edit-active-marker, #prev-marker-btn, #next-marker-btn').length > 0) {
                return;
            }
            
            // Don't deselect during drag operations
            if (state.isMarkerDragging || state.isMarkerResizingLeft || state.isMarkerResizingRight) {
                return;
            }
            
            // Don't deselect if slider was just used
            if (state.isDraggingRange || state.isDraggingInHandle || state.isDraggingOutHandle) {
                return;
            }
            
            // Deselect active marker if clicking elsewhere
            if (state.activeMarkerIndex !== -1) {
                clearActiveMarker();
            }
        });
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    function init() {
        state.video = dom.video;
        
        initializeSlider();
        setupRangeDragging();
        setupEventHandlers();
        setupDragAndDrop();
        setupKeyboardShortcuts();
        
        updatePathDropdown();
        updateFramesInputMax();
    }
    
    // Start the application
    init();
});
