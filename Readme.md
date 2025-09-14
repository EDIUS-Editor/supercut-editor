# Supercut and Marker Video Editor

A professional web-based video editing tool for creating precise video clips, creating or managing video markers, and working with subtitles. Perfect for creating supercuts, highlight reels, montages and for removing or joining to together words or phrasings with frame-accurate timing.
Uploading SRT subtitles or word-level timestamps VTT subtitles will be display on both the video player and the transcript tab for searching a word, phrase, "uhs" or "ums", non-speech sounds e.g. "[applause]" and "[laughter]", or a speaker. 
Click on any word or phrase to seek to that exact moment on the video and it automatically sets IN and OUT to be added to a edit/marker list.
Non-destructive editing, original video files remain untouched. All video files are privately playback directly on the user's computer, no video or data is uploaded to unknown servers. 
Save and restore complete editing sessions to a JSON file on your computer which can be later converted to FCP7XML project file or video markers list. No data is saved on our servers.

## 🎯 **Core Features**

### **Video Playback & Controls**
- **Professional video player** with full playback controls
- **Frame-accurate stepping** (forward/backward by individual frames)
- **SMPTE timecode display** (HH:MM:SS:FF format)
- **Automatic framerate detection** during playback
- **Loop playback** for selected ranges
- **Responsive design** optimized for desktop and mobile devices

### **Dual Timeline System**
- **Main Timeline**: Full video overview with SMPTE timecode markers
- **Waveform Display**: Detailed 10-second audio visualization (when available)
- **Click-to-seek** functionality on both timelines
- **Perfect synchronization** between all playback elements
- **Smart timecode scaling** with appropriate intervals based on video duration

### **Precise Selection Tools**
- **IN/OUT point setting** with visual selection display
- **Custom duration input** (minutes, seconds, frames)
- **Playhead positioning modes**:
  - Set duration with IN point at playhead
  - Set duration with OUT point at playhead  
  - Set duration with MID point at playhead
- **Draggable selection regions** on waveform (when available)

## 📝 **Subtitle & Transcript Support**

### **File Format Support**
- **SRT files** (.srt) - Standard subtitle format
- **WebVTT files** (.vtt) - With word-level timing support
- **Real-time subtitle display** overlaid on video
- **Interactive transcript** with clickable segments

### **Advanced Search Features**
- **Full-text search** across all subtitles
- **Multi-word phrase detection** with intelligent matching
- **Cross-segment phrase recognition** for VTT files
- **Search result highlighting** with navigation (prev/next)
- **Smart search padding** - Apply custom durations to search results
- **Bulk marker creation** from search results

### **Word-Level Precision (VTT)**
- **Individual word timing** support
- **Click any word** to seek to that exact moment
- **Word-level highlighting** during playback
- **Phrase-based marker creation** from multi-word searches

## 🏷️ **Marker Management**

### **Marker Creation**
- **Manual marker creation** from current IN/OUT selection
- **Automatic marker creation** from subtitle segments
- **Bulk creation** from search results
- **Subtitle text integration** with each marker

### **Marker Features**
- **Editable marker text** with inline editing
- **Load marker** to set IN/OUT points and seek to position
- **Remove individual markers**
- **Visual marker list** with timecode display
- **Active marker highlighting**

## 💾 **Project Management**

### **File Import/Export**
- **Drag & drop support** for all file types
- **Video files** - All standard formats
- **Subtitle files** - .srt, .vtt, .txt
- **Project files** - .json with complete project data

### **Project File Structure**
```json
{
  "sequence": { "name": "project_name" },
  "video": {
    "file": {
      "name": "video.mp4",
      "pathurl": "C:/Videos/video.mp4",
      "media": {
        "video": {
          "duration": 2258,
          "timecode": { "rate": { "timebase": 25 } },
          "samplecharacteristics": { "width": 1920, "height": 1080 }
        },
        "audio": {
          "samplecharacteristics": { "depth": 16, "samplerate": "48000" },
          "channelcount": 2
        }
      }
    }
  },
  "clips": [
    {
      "id": "1",
      "start": 90,
      "end": 155,
      "subtitles": [{ "text": "subtitle text", "start": 90, "end": 155 }]
    }
  ],
  "waveform": {
    "version": 2,
    "channels": 1,
    "sample_rate": 48000,
    "samples_per_pixel": 256,
    "bits": 8,
    "length": 16936,
    "data": [1, -1, 3, -8, 16, -10, ...]
  }
}
```

### **Custom Path Management**
- **Save custom file paths** for project organization
- **Path dropdown** with recently used locations
- **Automatic path suggestions** based on usage

## 🎵 **Waveform Integration**

### **Audio Visualization**
- **Professional waveform display** when available
- **Embedded waveform data** support in project files
- **Click-to-seek** on waveform for precise navigation
- **Mouse wheel zooming** for detailed audio editing
- **Visual selection regions** synchronized with main timeline

### **Waveform Data Support**
- **Audiowaveform JSON format** compatibility
- **Multi-channel audio** support
- **Configurable sample rates** and bit depths
- **Automatic waveform loading** from project files

## ⌨️ **Keyboard Shortcuts**

| Key Combination | Function |
|---|---|
| **Space** | Play/Pause video |
| **I** | Set IN point at current position |
| **O** | Set OUT point at current position |
| **Q** | Jump to selection start (IN point) |
| **W** | Jump to selection end (OUT point) |
| **Ctrl/Cmd + ←** | Step backward one frame |
| **Ctrl/Cmd + →** | Step forward one frame |
| **T** | Toggle between Markers and Transcript tabs |

## 🔍 **Advanced Search Features**

### **Search Modes**
- **Simple text search** - Find any text in subtitles
- **Multi-word phrases** - Intelligent phrase matching
- **Cross-segment matching** - Find phrases spanning multiple subtitle segments

### **Search Navigation**
- **Previous/Next match** navigation
- **Current match highlighting** with distinct colors
- **Match counter** showing position (X of Y results)
- **Automatic scrolling** to keep current match visible

### **Search-to-Markers**
- **Add all search results** as markers with one click
- **Configurable padding** - Extend markers beyond exact match timing
- **Padding modes**:
  - IN point at match start
  - OUT point at match end
  - MID point centered on match
- **Bulk processing** with progress feedback

## 🛠️ **Technical Features**

### **Frame-Accurate Editing**
- **Professional SMPTE timecode** throughout the interface
- **Frame-perfect positioning** and timing
- **Multiple framerate support** with automatic detection
- **Precise frame stepping** controls

### **Responsive Design**
- **Mobile-optimized** interface with touch-friendly controls
- **Adaptive timeline scaling** based on screen size
- **Responsive typography** and spacing
- **Touch gesture support** for mobile devices

### **Performance Optimization**
- **Efficient video rendering** with MediaElement backend
- **Optimized waveform processing** for large files
- **Smart UI updates** to prevent performance issues
- **Memory management** for long editing sessions

## 📱 **Platform Support**

### **Browser Compatibility**
- **Modern browsers** with HTML5 video support
- **Chrome/Edge** - Full feature support
- **Firefox** - Full feature support  
- **Safari** - Full feature support
- **Mobile browsers** - Optimized experience

### **File Format Support**
- **Video**: MP4, WebM, OGV, and all HTML5-supported formats
- **Subtitles**: SRT, VTT, TXT files
- **Projects**: JSON format with complete project data
- **Waveform**: Audiowaveform JSON format

## 🚀 **Getting Started**

1. **Load a video** - Drag & drop or use file picker
2. **Add subtitles** (optional) - Drag & drop .srt or .vtt files  
3. **Set IN/OUT points** - Use I/O keys or click timeline
4. **Create markers** - Add marker button or search results
5. **Save project** - Export complete project as JSON
6. **Load project** - Import JSON to restore complete session

## 🎬 **Use Cases**

- **Supercut creation** - Compile specific moments from long videos
- **Highlight reels** - Create sports or event highlights  
- **Content analysis** - Analyze video content with precise timing
- **Subtitle editing** - Work with timed text and subtitles
- **Educational content** - Create clips for teaching materials
- **Social media clips** - Extract short segments for social platforms
- **Podcast editing** - Audio-visual editing with waveform support

## 🔧 **Advanced Features**

### **Project Workflow**
- **Non-destructive editing** - Original files remain untouched
- **Session persistence** - Save and restore complete editing sessions
- **Metadata preservation** - Maintain video and audio information
- **Cross-platform compatibility** - Projects work across different systems

### **Professional Tools**
- **Frame-rate conversion** handling
- **Timecode synchronization** 
- **Multi-format subtitle support**
- **Audio waveform analysis**
- **Precision timing controls**

---

**Built with modern web technologies for professional video editing workflows.**