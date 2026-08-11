import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Pencil, MessageSquare, 
  Check, Plus, RefreshCw, Upload, Folder, Send, Trash2, Sparkles, 
  Clock, Share2, Download, X, RotateCcw, Loader2, Home, BarChart2, 
  Search, Video, Layers, ArrowLeft, Eye, Users, MoreVertical, Filter
} from 'lucide-react';

// ==========================================
// 🚨 BUNNY.NET HARDCODED CREDENTIALS 🚨
// ==========================================
const BUNNY_STORAGE_ZONE = "thrive";
const BUNNY_ACCESS_KEY = "d620773b-3709-413d-819288b64563-df1d-4b55";
const BUNNY_STORAGE_API_URL = `https://la.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}`;
const BUNNY_PULL_ZONE_URL = "https://jordanhorsch.b-cdn.net/";

const INITIAL_BRANDS = ['Carlos', 'HomeGrown', 'Modern Market', 'QDOBA', 'Thrive'];

// Immutable Deterministic ID Generator: Strips extensions & special chars
const getDeterministicId = (filenameOrUrl) => {
  if (!filenameOrUrl) return '';
  const filename = filenameOrUrl.split('/').pop().split('?')[0];
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  return 'vid-' + decodeURIComponent(nameWithoutExt).toLowerCase().replace(/[^a-z0-9]/g, '_');
};

export default function App() {
  // Capture deep-link parameter immediately at component mount
  const initialVideoParamRef = useRef(
    new URLSearchParams(window.location.search).get('v') || 
    new URLSearchParams(window.location.search).get('video')
  );

  // Navigation State ('dashboard' or 'review')
  const [currentView, setCurrentView] = useState(() => {
    return initialVideoParamRef.current ? 'review' : 'dashboard';
  });
  
  // Cloud Database Sync State
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const isInitialLoadRef = useRef(true);

  // Brand & Video State
  const [brands] = useState(INITIAL_BRANDS);
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState([]);
  const [activeVideoId, setActiveVideoId] = useState('');

  // Editing Title State
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [tempTitleText, setTempTitleText] = useState('');

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Drawing State
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#EF4444');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [drawings, setDrawings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('frameflow_drawings') || '{}');
    } catch(e) { return {}; }
  });
  const [currentPath, setCurrentPath] = useState([]);
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Comments State & Active Filter ('unresolved', 'resolved', 'all')
  const [comments, setComments] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('frameflow_comments') || '[]');
    } catch(e) { return []; }
  });
  const [commentFilter, setCommentFilter] = useState('unresolved');
  const [commentText, setCommentText] = useState('');
  const [authorName, setAuthorName] = useState('Reviewer');

  // Modals & AI State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiOutput, setAiOutput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Upload Form Inputs & CDN Progress State
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoBrand, setNewVideoBrand] = useState('Thrive');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploadingToCdn, setIsUploadingToCdn] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Active Video Object
  const activeVideo = videos.find(v => v.id === activeVideoId) || videos[0] || null;

  // DIRECT CLOUD SAVE FUNCTION (Syncs directly to Bunny Storage API)
  const saveCloudDatabaseDirect = async (vList, dMap, cList) => {
    if (!isDbLoaded || isInitialLoadRef.current) return;
    setIsSyncing(true);
    
    const targetVideos = vList || videos;
    const targetDrawings = dMap || drawings;
    const targetComments = cList || comments;

    try {
      localStorage.setItem('frameflow_videos', JSON.stringify(targetVideos));
      localStorage.setItem('frameflow_drawings', JSON.stringify(targetDrawings));
      localStorage.setItem('frameflow_comments', JSON.stringify(targetComments));
    } catch (e) {}

    const bunnyUploadUrl = `${BUNNY_STORAGE_API_URL}/frameflow_db.json`;

    try {
      await fetch(bunnyUploadUrl, {
        method: 'PUT',
        headers: {
          'AccessKey': BUNNY_ACCESS_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          videos: targetVideos,
          drawings: targetDrawings,
          comments: targetComments
        })
      });
    } catch (err) {
      console.error("Failed to sync database to Bunny CDN:", err);
    } finally {
      setTimeout(() => setIsSyncing(false), 300);
    }
  };

  // 1. INITIAL LOAD FROM BUNNY CDN ON APP START
  useEffect(() => {
    const fetchAllBunnyCloudAssets = async () => {
      setIsSyncing(true);
      try {
        let cloudDb = { videos: [], drawings: {}, comments: [] };
        try {
          const dbStorageUrl = `${BUNNY_STORAGE_API_URL}/frameflow_db.json?t=${Date.now()}`;
          const res = await fetch(dbStorageUrl, {
            headers: { 'AccessKey': BUNNY_ACCESS_KEY }
          });
          if (res.ok) {
            cloudDb = await res.json();
          }
        } catch (e) {
          console.warn("Reading fresh database layout...");
        }

        let localDb = { videos: [], drawings: {}, comments: [] };
        try {
          localDb.videos = JSON.parse(localStorage.getItem('frameflow_videos') || '[]');
          localDb.drawings = JSON.parse(localStorage.getItem('frameflow_drawings') || '{}');
          localDb.comments = JSON.parse(localStorage.getItem('frameflow_comments') || '[]');
        } catch (e) {}

        const storageApiUrl = `${BUNNY_STORAGE_API_URL}/`;
        const storageRes = await fetch(storageApiUrl, {
          method: 'GET',
          headers: {
            'AccessKey': BUNNY_ACCESS_KEY,
            'Accept': 'application/json'
          }
        });

        let bunnyFiles = [];
        if (storageRes.ok) {
          const rawFiles = await storageRes.json();
          const videoExtensions = ['.mp4', '.mov', '.webm', '.m4v', '.avi', '.mkv'];
          bunnyFiles = rawFiles.filter(f => 
            !f.IsDirectory && 
            videoExtensions.some(ext => f.ObjectName.toLowerCase().endsWith(ext))
          );
        }

        const allSavedVideos = [...(cloudDb.videos || []), ...(localDb.videos || [])];
        const metaMap = new Map();
        allSavedVideos.forEach(v => {
          const key = getDeterministicId(v.url || v.filename || v.id);
          if (key) {
            const existing = metaMap.get(key);
            metaMap.set(key, {
              ...existing,
              ...v,
              brand: (v.brand && v.brand !== 'Thrive') ? v.brand : (existing?.brand || v.brand || 'Thrive')
            });
          }
        });

        // Merge Comments across devices
        const allComments = [...(cloudDb.comments || []), ...(localDb.comments || [])];
        const commentMap = new Map();
        allComments.forEach(c => {
          if (c && c.id) {
            const normalizedVideoId = getDeterministicId(c.videoId);
            commentMap.set(c.id, { 
              ...c, 
              videoId: normalizedVideoId || c.videoId 
            });
          }
        });

        const rawDrawings = { ...(localDb.drawings || {}), ...(cloudDb.drawings || {}) };
        const normalizedDrawings = {};
        Object.keys(rawDrawings).forEach(key => {
          const normKey = getDeterministicId(key);
          normalizedDrawings[normKey] = {
            ...(normalizedDrawings[normKey] || {}),
            ...rawDrawings[key]
          };
        });

        const mergedVideoList = bunnyFiles.map(file => {
          const filename = file.ObjectName;
          const publicUrl = `${BUNNY_PULL_ZONE_URL.replace(/\/$/, '')}/${filename}`;
          const id = getDeterministicId(filename);
          const meta = metaMap.get(id);

          let cleanTitle = filename
            .replace(/^\d+_\s*/, '')
            .replace(/\.[^/.]+$/, "")
            .replace(/_/g, ' ');

          return {
            id: id,
            title: meta?.title || cleanTitle || filename,
            brand: meta?.brand || 'Thrive',
            url: publicUrl,
            status: meta?.status || 'In Review',
            createdAt: meta?.createdAt || file.LastChanged || new Date().toISOString(),
            duration: meta?.duration || 30
          };
        });

        setVideos(mergedVideoList);
        setComments(Array.from(commentMap.values()));
        setDrawings(normalizedDrawings);

        if (mergedVideoList.length > 0 && !activeVideoId) {
          setActiveVideoId(mergedVideoList[0].id);
        }
      } catch (err) {
        console.error("Error fetching assets from Bunny CDN:", err);
      } finally {
        setIsDbLoaded(true);
        setIsSyncing(false);
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 500);
      }
    };

    fetchAllBunnyCloudAssets();
  }, []);

  // 2. ⚡ REAL-TIME CLOUD POLLING ENGINE (Heartbeat every 3 seconds for instant multi-device sync)
  useEffect(() => {
    if (!isDbLoaded) return;

    const liveSyncInterval = setInterval(async () => {
      // Don't poll while actively sending a local update to prevent state overwrites
      if (isSyncing) return;

      try {
        const dbStorageUrl = `${BUNNY_STORAGE_API_URL}/frameflow_db.json?t=${Date.now()}`;
        const res = await fetch(dbStorageUrl, {
          headers: { 'AccessKey': BUNNY_ACCESS_KEY }
        });

        if (res.ok) {
          const cloudDb = await res.json();

          // Sync Comments in Real Time
          if (cloudDb.comments && Array.isArray(cloudDb.comments)) {
            setComments(prevComments => {
              const commentMap = new Map();
              prevComments.forEach(c => commentMap.set(c.id, c));
              cloudDb.comments.forEach(c => {
                if (c && c.id) {
                  const normVidId = getDeterministicId(c.videoId);
                  commentMap.set(c.id, { ...c, videoId: normVidId || c.videoId });
                }
              });
              const merged = Array.from(commentMap.values());
              if (JSON.stringify(merged) !== JSON.stringify(prevComments)) {
                return merged;
              }
              return prevComments;
            });
          }

          // Sync Drawings in Real Time
          if (cloudDb.drawings) {
            setDrawings(prevDrawings => {
              const merged = { ...prevDrawings };
              Object.keys(cloudDb.drawings).forEach(vidKey => {
                const normKey = getDeterministicId(vidKey);
                merged[normKey] = {
                  ...(merged[normKey] || {}),
                  ...cloudDb.drawings[vidKey]
                };
              });
              if (JSON.stringify(merged) !== JSON.stringify(prevDrawings)) {
                return merged;
              }
              return prevDrawings;
            });
          }

          // Sync Video Folders / Status in Real Time
          if (cloudDb.videos && Array.isArray(cloudDb.videos)) {
            setVideos(prevVideos => {
              let changed = false;
              const updated = prevVideos.map(v => {
                const cloudVid = cloudDb.videos.find(cv => getDeterministicId(cv.id || cv.url) === v.id);
                if (cloudVid && (cloudVid.brand !== v.brand || cloudVid.status !== v.status || cloudVid.title !== v.title)) {
                  changed = true;
                  return { ...v, brand: cloudVid.brand || v.brand, status: cloudVid.status || v.status, title: cloudVid.title || v.title };
                }
                return v;
              });
              return changed ? updated : prevVideos;
            });
          }
        }
      } catch (e) {
        // Silent catch for background network drops
      }
    }, 3000); // 3-second live pulse

    return () => clearInterval(liveSyncInterval);
  }, [isDbLoaded, isSyncing]);

  // 3. AUTO-SAVE ON LOCAL STATE CHANGES
  useEffect(() => {
    if (!isDbLoaded || isInitialLoadRef.current) return;

    const debounceSync = setTimeout(() => {
      saveCloudDatabaseDirect(videos, drawings, comments);
    }, 300);

    return () => clearTimeout(debounceSync);
  }, [videos, drawings, comments, isDbLoaded]);

  // 4. DEEP LINK RESOLUTION FOR SHARE LINKS
  useEffect(() => {
    const param = initialVideoParamRef.current;
    if (param && videos.length > 0) {
      const decodedParam = decodeURIComponent(param).toLowerCase();
      const found = videos.find(
        vid => vid.id.toLowerCase() === decodedParam || 
        vid.title.toLowerCase() === decodedParam ||
        vid.title.toLowerCase().replace(/\s+/g, '_') === decodedParam
      );
      if (found) {
        setActiveVideoId(found.id);
        setCurrentView('review');
      }
    }
  }, [videos, isDbLoaded]);

  // 5. KEEP URL IN SYNC WITH CURRENT VIEW & VIDEO
  useEffect(() => {
    if (currentView === 'review' && activeVideoId) {
      const newUrl = `${window.location.pathname}?v=${encodeURIComponent(activeVideoId)}`;
      window.history.replaceState(null, '', newUrl);
    } else if (currentView === 'dashboard') {
      initialVideoParamRef.current = null;
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [currentView, activeVideoId]);

  // Move / Change Video Brand Folder Handler
  const handleUpdateBrand = (videoId, newBrand, e) => {
    if (e) e.stopPropagation();
    const updatedVideos = videos.map(v => v.id === videoId ? { ...v, brand: newBrand } : v);
    setVideos(updatedVideos);
    saveCloudDatabaseDirect(updatedVideos, drawings, comments);
  };

  // Start Editing Title
  const startRenameVideo = (videoId, currentTitle, e) => {
    if (e) e.stopPropagation();
    setEditingTitleId(videoId);
    setTempTitleText(currentTitle);
  };

  // Save Renamed Video Title
  const saveRenameVideo = (videoId, e) => {
    if (e) e.stopPropagation();
    if (tempTitleText.trim()) {
      const updatedVideos = videos.map(v => v.id === videoId ? { ...v, title: tempTitleText.trim() } : v);
      setVideos(updatedVideos);
      saveCloudDatabaseDirect(updatedVideos, drawings, comments);
    }
    setEditingTitleId(null);
  };

  // Copy Direct Share Link Function
  const handleCopyLink = (videoIdToCopy, e) => {
    if (e) e.stopPropagation();
    const targetId = videoIdToCopy || activeVideoId;
    const shareUrl = `${window.location.origin}${window.location.pathname}?v=${encodeURIComponent(targetId)}`;

    window.history.replaceState(null, '', shareUrl);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert(`✅ Direct Video Link Copied!\n\n${shareUrl}`);
      }).catch(() => {
        prompt('Copy this direct video link for Hive:', shareUrl);
      });
    } else {
      prompt('Copy this direct video link for Hive:', shareUrl);
    }
  };

  // Delete Video File Function
  const handleDeleteVideo = async (videoIdToDelete, e) => {
    if (e) e.stopPropagation();
    const videoToDelete = videos.find(v => v.id === videoIdToDelete);
    if (!videoToDelete) return;

    if (window.confirm(`Are you sure you want to delete "${videoToDelete.title}"? This will permanently delete the file from Bunny CDN.`)) {
      setIsSyncing(true);

      try {
        const fileName = videoToDelete.url.split('/').pop();
        if (fileName) {
          const deleteUrl = `${BUNNY_STORAGE_API_URL}/${fileName}`;
          await fetch(deleteUrl, {
            method: 'DELETE',
            headers: { 'AccessKey': BUNNY_ACCESS_KEY }
          });
        }
      } catch (err) {
        console.error("Error deleting file from Bunny CDN:", err);
      }

      const updatedVideos = videos.filter(v => v.id !== videoIdToDelete);
      setVideos(updatedVideos);

      if (activeVideoId === videoIdToDelete) {
        if (updatedVideos.length > 0) {
          setActiveVideoId(updatedVideos[0].id);
        } else {
          setActiveVideoId('');
          setCurrentView('dashboard');
        }
      }

      saveCloudDatabaseDirect(updatedVideos, drawings, comments);
      setIsSyncing(false);
    }
  };

  // Direct Bunny.net Video Upload with Real-Time Progress Tracker
  const uploadFileToBunnyCDN = (file) => {
    return new Promise((resolve) => {
      setIsUploadingToCdn(true);
      setUploadProgress(0);

      const cleanFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const bunnyUploadUrl = `${BUNNY_STORAGE_API_URL}/${cleanFileName}`;

      const xhr = new XMLHttpRequest();
      xhr.open('PUT', bunnyUploadUrl, true);
      xhr.setRequestHeader('AccessKey', BUNNY_ACCESS_KEY);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        setIsUploadingToCdn(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          const publicCdnUrl = `${BUNNY_PULL_ZONE_URL.replace(/\/$/, '')}/${cleanFileName}`;
          resolve({ url: publicCdnUrl, fileName: cleanFileName });
        } else {
          console.error("Upload failed with status", xhr.status);
          alert(`⚠️ Cloud upload failed with status ${xhr.status}. Check credentials or CORS.`);
          resolve(null);
        }
      };

      xhr.onerror = () => {
        setIsUploadingToCdn(false);
        console.error("Network error during Bunny CDN upload");
        alert("⚠️ Cloud upload to Bunny CDN failed. Check network or CORS permissions.");
        resolve(null);
      };

      xhr.send(file);
    });
  };

  // Video Time & Status Handlers
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '00:00.0';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  const extractFilenameWithoutExt = (filename) => {
    if (!filename) return '';
    return filename.replace(/\.[^/.]+$/, "");
  };

  const handleUpdateStatus = (status) => {
    const updatedVideos = videos.map(v => v.id === activeVideoId ? { ...v, status } : v);
    setVideos(updatedVideos);
    saveCloudDatabaseDirect(updatedVideos, drawings, comments);
  };

  const openVideoReview = (id) => {
    setActiveVideoId(id);
    setCurrentView('review');
  };

  // Canvas Drawing Coordinate Math
  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  // Touch & Mouse Start - Prevents Mobile Screen Dragging
  const startDrawing = (e) => {
    if (!isDrawingMode) return;
    if (e.cancelable) e.preventDefault();
    setIsMouseDown(true);
    if (isPlaying) {
      videoRef.current?.pause();
      setIsPlaying(false);
    }
    const coords = getCanvasCoordinates(e);
    setCurrentPath([coords]);
  };

  // Touch & Mouse Drag - Locks Canvas to Screen
  const draw = (e) => {
    if (!isDrawingMode || !isMouseDown) return;
    if (e.cancelable) e.preventDefault();
    const coords = getCanvasCoordinates(e);
    setCurrentPath(prev => [...prev, coords]);
    renderCanvas();
  };

  // Stop Drawing
  const stopDrawing = () => {
    if (!isDrawingMode || !isMouseDown || !activeVideo) return;
    setIsMouseDown(false);
    if (currentPath.length > 0) {
      const targetVidId = activeVideo.id;
      const newPathObj = {
        id: 'path-' + Date.now(),
        color: strokeColor,
        width: strokeWidth,
        points: currentPath
      };
      
      const timeKey = currentTime.toFixed(1);
      const updatedVideoDrawings = [...(drawings[targetVidId]?.[timeKey] || []), newPathObj];
      
      const nextDrawings = {
        ...drawings,
        [targetVidId]: {
          ...(drawings[targetVidId] || {}),
          [timeKey]: updatedVideoDrawings
        }
      };
      setDrawings(nextDrawings);

      let nextComments = comments;
      const hasExistingDrawingComment = comments.some(
        c => c.videoId === targetVidId && 
             c.hasDrawing && 
             c.timestamp.toFixed(1) === timeKey
      );

      if (!hasExistingDrawingComment) {
        const newComment = {
          id: 'c-' + Date.now(),
          videoId: targetVidId,
          timestamp: currentTime,
          timeFormatted: formatTime(currentTime),
          author: authorName,
          text: 'Canvas markup / drawing annotation added',
          completed: false,
          createdAt: new Date().toISOString(),
          hasDrawing: true
        };
        nextComments = [...comments, newComment];
        setComments(nextComments);
      }

      const updatedVideos = videos.map(v => v.id === activeVideoId ? { ...v, status: 'Changes Requested' } : v);
      setVideos(updatedVideos);

      saveCloudDatabaseDirect(updatedVideos, nextDrawings, nextComments);
    }
    setCurrentPath([]);
  };

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !activeVideo) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const targetVidId = activeVideo.id;
    const timeKey = currentTime.toFixed(1);
    const existingDrawings = drawings[targetVidId]?.[timeKey] || [];

    [...existingDrawings, ...(currentPath.length ? [{ color: strokeColor, width: strokeWidth, points: currentPath }] : [])].forEach(path => {
      if (!path.points || path.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(path.points[0].x, path.points[0].y);
      path.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    });
  };

  useEffect(() => {
    if (currentView === 'review') {
      renderCanvas();
    }
  }, [currentTime, drawings, activeVideoId, currentPath, currentView]);

  // Comment Handlers (Syncs instantly across devices)
  const handleAddComment = (e) => {
    e.preventDefault();
    if (!commentText.trim() || !activeVideo) return;

    const targetVidId = activeVideo.id;

    const newComment = {
      id: 'c-' + Date.now(),
      videoId: targetVidId,
      timestamp: currentTime,
      timeFormatted: formatTime(currentTime),
      author: authorName,
      text: commentText.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    };

    const updatedComments = [...comments, newComment];
    setComments(updatedComments);
    setCommentText('');

    const updatedVideos = videos.map(v => v.id === activeVideoId ? { ...v, status: 'Changes Requested' } : v);
    setVideos(updatedVideos);

    try {
      localStorage.setItem('frameflow_comments', JSON.stringify(updatedComments));
      localStorage.setItem('frameflow_videos', JSON.stringify(updatedVideos));
    } catch(e) {}

    saveCloudDatabaseDirect(updatedVideos, drawings, updatedComments);
  };

  const toggleCommentComplete = (id) => {
    const updatedComments = comments.map(c => c.id === id ? { ...c, completed: !c.completed } : c);
    setComments(updatedComments);
    try {
      localStorage.setItem('frameflow_comments', JSON.stringify(updatedComments));
    } catch(e) {}
    saveCloudDatabaseDirect(videos, drawings, updatedComments);
  };

  // Upload Handlers
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const cleanName = extractFilenameWithoutExt(file.name);
      setNewVideoTitle(cleanName);

      const result = await uploadFileToBunnyCDN(file);
      if (result && result.url) {
        setNewVideoUrl(result.url);
        setUploadedFileName(result.fileName);
      } else {
        setNewVideoUrl('');
        setUploadedFileName('');
      }
    }
  };

  const handleUploadSubmit = (e) => {
    e.preventDefault();
    if (!newVideoUrl) {
      alert("Please select a video file or enter a valid video URL first.");
      return;
    }

    const fileName = uploadedFileName || newVideoUrl.split('/').pop();
    const deterministicId = getDeterministicId(fileName);

    const newVideo = {
      id: deterministicId,
      title: newVideoTitle || 'Untitled Video',
      brand: newVideoBrand,
      url: newVideoUrl,
      status: 'In Review',
      createdAt: new Date().toISOString(),
      duration: 30
    };

    const updatedVideos = [newVideo, ...videos];
    setVideos(updatedVideos);
    setIsUploadOpen(false);
    resetUploadForm();
    openVideoReview(newVideo.id);

    saveCloudDatabaseDirect(updatedVideos, drawings, comments);
  };

  const handleReplaceSubmit = (e) => {
    e.preventDefault();
    if (!newVideoUrl) {
      alert("Please select a valid video file or enter a direct URL.");
      return;
    }

    const updatedVideos = videos.map(v => {
      if (v.id === activeVideoId) {
        return {
          ...v,
          title: newVideoTitle || v.title,
          url: newVideoUrl || v.url
        };
      }
      return v;
    });

    setVideos(updatedVideos);
    setIsReplaceOpen(false);
    resetUploadForm();

    saveCloudDatabaseDirect(updatedVideos, drawings, comments);
  };

  const resetUploadForm = () => {
    setNewVideoTitle('');
    setNewVideoUrl('');
    setUploadedFileName('');
    setSelectedFile(null);
    setUploadProgress(0);
  };

  const jumpToTime = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const generateAiActionPlan = () => {
    setIsAiLoading(true);
    setIsAiModalOpen(true);
    const targetVidId = activeVideo?.id || activeVideoId;
    const videoComments = comments.filter(c => c.videoId === targetVidId);

    setTimeout(() => {
      if (videoComments.length === 0) {
        setAiOutput("No comments found for this video yet. Add feedback or drawings to generate an action plan!");
      } else {
        const summary = videoComments.map(c => `• [${c.timeFormatted}] ${c.author}: ${c.text}`).join('\n');
        setAiOutput(`### 🎬 Executive Video Action Plan for ${activeVideo?.title || 'Video'}\n\n**Key Revisions Needed:**\n${summary}\n\n**Next Steps for Editor:**\n1. Apply canvas annotations at highlighted keyframes.\n2. Re-render timeline cuts and upload revision to CDN.\n3. Mark status as "In Review" for final approval.`);
      }
      setIsAiLoading(false);
    }, 800);
  };

  const targetVidId = activeVideo?.id || activeVideoId;
  const allVideoComments = comments.filter(c => c.videoId === targetVidId);

  // Filter comments based on active tab selection
  const filteredComments = allVideoComments.filter(c => {
    if (commentFilter === 'unresolved') return !c.completed;
    if (commentFilter === 'resolved') return c.completed;
    return true; // 'all'
  });

  const filteredVideos = videos.filter(v => {
    const matchesBrand = selectedBrand === 'All' || v.brand === selectedBrand;
    const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesBrand && matchesSearch;
  });

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* GLOBAL SIDEBAR (Responsive) */}
      <div className="w-full md:w-60 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between flex-shrink-0 z-30">
        <div>
          {/* Logo Header */}
          <div className="p-3 md:p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-xl text-white font-bold text-base md:text-lg shadow-lg shadow-indigo-950">FF</div>
              <div>
                <div className="font-bold text-sm md:text-base tracking-wide text-white leading-none">FrameFlow</div>
                <div className="text-[10px] text-slate-400 mt-1">Video Studio Pro</div>
              </div>
            </div>

            {/* Cloud Sync Indicator */}
            <div className="text-slate-500" title={isSyncing ? "Syncing with Bunny Cloud..." : "Live Cloud Sync Active"}>
              {isSyncing ? (
                <Loader2 size={14} className="animate-spin text-indigo-400" />
              ) : (
                <Check size={14} className="text-emerald-500" />
              )}
            </div>
          </div>

          {/* Nav Items */}
          <div className="p-2 md:p-3 flex md:flex-col gap-1">
            <button 
              onClick={() => setCurrentView('dashboard')}
              className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentView === 'dashboard' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Home size={15} /> Home
            </button>

            <button 
              onClick={() => {
                if (videos.length > 0) {
                  if (!activeVideoId) setActiveVideoId(videos[0].id);
                  setCurrentView('review');
                } else {
                  setIsUploadOpen(true);
                }
              }}
              className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentView === 'review' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Video size={15} /> Review Player
            </button>
          </div>

          {/* Brand Workspace Filters */}
          <div className="hidden md:block px-4 py-3 border-t border-slate-800/80">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Brand Workspace</label>
            <select 
              value={selectedBrand} 
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Concepts ({videos.length})</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>

        {/* Bottom Upload Button */}
        <div className="hidden md:block p-3 border-t border-slate-800">
          <button 
            onClick={() => setIsUploadOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-4 rounded-lg transition text-xs shadow-lg shadow-indigo-950"
          >
            <Plus size={16} /> Upload Asset
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VIEW 1: DASHBOARD HUB                                     */}
      {/* ========================================================= */}
      {currentView === 'dashboard' && (
        <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950">
          
          {/* Top Search Bar */}
          <div className="h-16 border-b border-slate-800 px-4 md:px-8 flex items-center justify-between bg-slate-900/40 sticky top-0 backdrop-blur z-20 gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search videos, brands..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <button 
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 px-4 rounded-xl transition shadow-md whitespace-nowrap"
            >
              <Plus size={16} /> Upload
            </button>
          </div>

          <div className="p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
            
            {/* Recents Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-200 tracking-wide">Recents</h2>
                <span className="text-xs text-slate-500">{filteredVideos.length} Assets</span>
              </div>

              {filteredVideos.length === 0 ? (
                <div className="p-12 border border-dashed border-slate-800 rounded-2xl text-center text-slate-500 text-xs">
                  No assets found in Bunny CDN. Click Upload to add your first video!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredVideos.map((vid) => (
                    <div 
                      key={vid.id}
                      onClick={() => openVideoReview(vid.id)}
                      className="group bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:border-indigo-500/50 transition hover:shadow-xl hover:shadow-indigo-950/30 relative"
                    >
                      <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center">
                        <video src={vid.url} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition" />
                        
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <div className="p-3 bg-indigo-600 rounded-full text-white shadow-lg">
                            <Play size={20} fill="white" />
                          </div>
                        </div>

                        <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-300">
                          {formatTime(vid.duration)}
                        </div>

                        <div className="absolute top-2 left-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium shadow ${
                            vid.status === 'Approved' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                            vid.status === 'Changes Requested' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                            'bg-indigo-950 text-indigo-400 border border-indigo-800'
                          }`}>
                            {vid.status}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 flex items-start justify-between gap-2">
                        <div className="overflow-hidden flex-1">
                          {editingTitleId === vid.id ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="text" 
                                value={tempTitleText} 
                                onChange={(e) => setTempTitleText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && saveRenameVideo(vid.id, e)}
                                autoFocus
                                className="w-full bg-slate-800 border border-indigo-500 rounded text-xs px-1.5 py-0.5 text-white focus:outline-none"
                              />
                              <button onClick={(e) => saveRenameVideo(vid.id, e)} className="text-emerald-400 p-0.5 hover:bg-slate-800 rounded">
                                <Check size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group/title">
                              <div className="font-semibold text-xs text-slate-200 truncate group-hover:text-indigo-400 transition">
                                {vid.title}
                              </div>
                              <button 
                                onClick={(e) => startRenameVideo(vid.id, vid.title, e)} 
                                title="Rename Video"
                                className="opacity-0 group-hover/title:opacity-100 text-slate-400 hover:text-white transition p-0.5"
                              >
                                <Pencil size={11} />
                              </button>
                            </div>
                          )}

                          <div className="mt-1 flex items-center gap-1">
                            <select
                              value={vid.brand}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleUpdateBrand(vid.id, e.target.value, e)}
                              className="text-[10px] bg-slate-800 border border-slate-700/80 text-indigo-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-indigo-500 cursor-pointer font-medium hover:bg-slate-700 transition"
                            >
                              {brands.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                            <span className="text-[10px] text-slate-500">• {new Date(vid.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button 
                            onClick={(e) => handleCopyLink(vid.id, e)}
                            title="Copy Hive Link"
                            className="text-slate-500 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition"
                          >
                            <Share2 size={13} />
                          </button>
                          <button 
                            onClick={(e) => handleDeleteVideo(vid.id, e)}
                            title="Delete Asset"
                            className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: FRAMEFLOW VIDEO REVIEW PLAYER STUDIO              */}
      {/* ========================================================= */}
      {currentView === 'review' && activeVideo && (
        <div className="flex-1 flex flex-col lg:flex-row bg-slate-950 min-w-0 overflow-y-auto lg:overflow-hidden">
          
          <div className="flex-1 flex flex-col min-w-0">
            {/* Responsive Top Controls Header */}
            <div className="p-3 lg:px-6 lg:py-3 border-b border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <button 
                  onClick={() => setCurrentView('dashboard')}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                
                <div className="flex items-center gap-2">
                  <h1 
                    onClick={(e) => startRenameVideo(activeVideoId, activeVideo.title, e)}
                    className="text-xs md:text-sm font-bold text-white hover:text-indigo-300 cursor-pointer transition truncate max-w-[180px] md:max-w-xs"
                    title="Click to rename"
                  >
                    {activeVideo?.title}
                  </h1>

                  <select
                    value={activeVideo?.brand || 'Thrive'}
                    onChange={(e) => handleUpdateBrand(activeVideoId, e.target.value)}
                    className="text-[11px] bg-slate-800 border border-slate-700 text-indigo-300 rounded-lg px-2 py-1 focus:outline-none cursor-pointer font-medium hover:bg-slate-700 transition"
                  >
                    {brands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              {/* Action Buttons Wrap */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[10px]">
                  {['In Review', 'Changes Requested', 'Approved'].map((status) => (
                    <button
                      key={status}
                      onClick={() => handleUpdateStatus(status)}
                      className={`px-2 py-1 rounded font-medium transition ${
                        activeVideo?.status === status 
                          ? status === 'Approved' ? 'bg-emerald-600 text-white' 
                            : status === 'Changes Requested' ? 'bg-amber-600 text-white' 
                            : 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={(e) => handleCopyLink(activeVideoId, e)}
                  className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium py-1 px-2.5 rounded-lg border border-slate-700 transition"
                >
                  <Share2 size={12} /> Share
                </button>

                <a 
                  href={activeVideo?.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  download 
                  className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium py-1 px-2.5 rounded-lg border border-slate-700 transition"
                >
                  <Download size={12} />
                </a>

                <button 
                  onClick={() => setIsReplaceOpen(true)}
                  className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium py-1 px-2.5 rounded-lg border border-slate-700 transition"
                >
                  <RotateCcw size={12} />
                </button>

                <button 
                  onClick={(e) => handleDeleteVideo(activeVideoId, e)}
                  className="flex items-center gap-1 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800/80 text-xs font-medium py-1 px-2.5 rounded-lg transition"
                >
                  <Trash2 size={12} />
                </button>

                <button 
                  onClick={generateAiActionPlan}
                  className="flex items-center gap-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-medium py-1 px-2.5 rounded-lg transition shadow"
                >
                  <Sparkles size={12} /> AI
                </button>
              </div>
            </div>

            {/* Video Canvas Container */}
            <div className="flex-1 flex flex-col justify-center items-center p-3 md:p-6 bg-slate-950 relative overflow-hidden min-h-[50vh]">
              <div className="relative max-h-[60vh] lg:max-h-[70vh] w-full max-w-5xl bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center">
                
                <video
                  ref={videoRef}
                  src={activeVideo?.url}
                  className="max-h-[60vh] lg:max-h-[70vh] w-full object-contain"
                  onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                  onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                  onClick={() => {
                    if (isPlaying) {
                      videoRef.current?.pause();
                      setIsPlaying(false);
                    } else {
                      videoRef.current?.play();
                      setIsPlaying(true);
                    }
                  }}
                />

                {/* Drawing Canvas Overlay */}
                <canvas
                  ref={canvasRef}
                  width={1280}
                  height={720}
                  style={{ touchAction: 'none' }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className={`absolute inset-0 w-full h-full object-contain ${
                    isDrawingMode ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
                  }`}
                />

                {/* Drawing Toolbar Overlay */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-700 p-1 rounded-lg shadow-lg z-20">
                  <button
                    onClick={() => setIsDrawingMode(!isDrawingMode)}
                    className={`p-1.5 rounded transition ${
                      isDrawingMode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Toggle Drawing Tool"
                  >
                    <Pencil size={16} />
                  </button>

                  {isDrawingMode && (
                    <>
                      <div className="h-3 w-px bg-slate-700 mx-0.5" />
                      {['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#FFFFFF'].map(color => (
                        <button
                          key={color}
                          onClick={() => setStrokeColor(color)}
                          className={`w-4 h-4 rounded-full border border-slate-600 transition ${
                            strokeColor === color ? 'scale-125 ring-2 ring-indigo-500' : ''
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Custom Video Timeline Controls & Pinpoints */}
              <div className="w-full max-w-5xl mt-3 bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="relative w-full h-3 bg-slate-800 rounded-lg cursor-pointer flex items-center">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={(e) => jumpToTime(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
                  />
                  
                  <div 
                    className="h-full bg-indigo-600 rounded-lg relative z-10"
                    style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                  />

                  {allVideoComments.map(c => {
                    const percent = (c.timestamp / (duration || 1)) * 100;
                    return (
                      <button
                        key={c.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          jumpToTime(c.timestamp);
                        }}
                        style={{ left: `${percent}%` }}
                        className={`absolute z-30 w-2.5 h-4 -top-0.5 rounded-sm transform -translate-x-1/2 border border-slate-900 transition hover:scale-125 ${
                          c.hasDrawing ? 'bg-amber-400' : 'bg-indigo-400'
                        }`}
                        title={`[${c.timeFormatted}] ${c.author}: ${c.text}`}
                      />
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (isPlaying) {
                          videoRef.current?.pause();
                          setIsPlaying(false);
                        } else {
                          videoRef.current?.play();
                          setIsPlaying(true);
                        }
                      }}
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
                    >
                      {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                    </button>

                    <div className="font-mono text-slate-300 text-[11px]">
                      <span>{formatTime(currentTime)}</span> / <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => setIsMuted(!isMuted)}
                    className="text-slate-400 hover:text-white"
                  >
                    {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* COMMENTS PANEL WITH RETENTION TABS & TOP TYPE-IN BAR */}
          <div className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col flex-shrink-0 min-h-[300px] lg:min-h-0">
            <div className="p-3 border-b border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-white text-xs flex items-center gap-2 uppercase tracking-wider">
                  <MessageSquare size={14} /> Comments ({filteredComments.length})
                </h2>
              </div>

              {/* Resolved / Unresolved Filter Tabs */}
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-[10px] font-medium">
                <button
                  onClick={() => setCommentFilter('unresolved')}
                  className={`flex-1 py-1 rounded transition text-center ${
                    commentFilter === 'unresolved' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setCommentFilter('resolved')}
                  className={`flex-1 py-1 rounded transition text-center ${
                    commentFilter === 'resolved' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Resolved ({allVideoComments.filter(c => c.completed).length})
                </button>
                <button
                  onClick={() => setCommentFilter('all')}
                  className={`flex-1 py-1 rounded transition text-center ${
                    commentFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({allVideoComments.length})
                </button>
              </div>
            </div>

            {/* INPUT FORM (POSITIONED AT TOP) */}
            <form onSubmit={handleAddComment} className="p-3 border-b border-slate-800 space-y-2 bg-slate-900">
              <input 
                type="text" 
                placeholder="Your Name"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-xs rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Add feedback at frame..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 text-xs rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <button 
                  type="submit"
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
                >
                  <Send size={14} />
                </button>
              </div>
            </form>

            {/* COMMENTS LIST (POSITIONED BELOW INPUT FORM) */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[350px] lg:max-h-none">
              {filteredComments.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  {commentFilter === 'resolved' 
                    ? 'No resolved comments yet.' 
                    : 'No active comments. Add feedback above or draw on the video!'}
                </div>
              ) : (
                filteredComments.map(c => (
                  <div 
                    key={c.id} 
                    className={`p-2.5 rounded-lg border transition ${
                      c.completed ? 'bg-slate-900/40 border-slate-800 opacity-60' : 'bg-slate-800/60 border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-indigo-400">{c.author}</span>
                      <button 
                        onClick={() => jumpToTime(c.timestamp)}
                        className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 hover:bg-indigo-600 hover:text-white transition"
                      >
                        {c.timeFormatted}
                      </button>
                    </div>
                    <p className="text-xs text-slate-200">{c.text}</p>
                    <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-slate-700/50">
                      <button 
                        onClick={() => toggleCommentComplete(c.id)}
                        className={`flex items-center gap-1 text-[10px] font-medium transition ${
                          c.completed ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Check size={11} /> {c.completed ? 'Resolved' : 'Mark Resolved'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* UPLOAD MODAL */}
      {isUploadOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm">Upload New Video Asset</h3>
              <button onClick={() => setIsUploadOpen(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Select File (Auto-Uploads to Bunny CDN)</label>
                <input 
                  type="file" 
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-300"
                  disabled={isUploadingToCdn}
                />

                {isUploadingToCdn && (
                  <div className="space-y-1.5 mt-2.5">
                    <div className="flex items-center justify-between text-xs text-indigo-400">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Loader2 size={13} className="animate-spin" /> Uploading to Bunny CDN...
                      </span>
                      <span className="font-mono font-bold text-white">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                      <div 
                        className="bg-indigo-600 h-full rounded-full transition-all duration-150 ease-out shadow-lg shadow-indigo-500/50" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-2 text-slate-500 text-[10px] uppercase">Or Paste Direct Web URL</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Direct Video URL (.mp4 / CDN Link)</label>
                <input 
                  type="text" 
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  placeholder="https://your-cdn-host.com/video.mp4"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Video Title</label>
                <input 
                  type="text" 
                  value={newVideoTitle}
                  onChange={(e) => setNewVideoTitle(e.target.value)}
                  placeholder="e.g. QDOBA_Summer_Campaign"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Brand Folder</label>
                <select 
                  value={newVideoBrand}
                  onChange={(e) => setNewVideoBrand(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                >
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isUploadingToCdn}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  Add Video
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPLACE VIDEO MODAL */}
      {isReplaceOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm">Replace Video Asset</h3>
              <button onClick={() => setIsReplaceOpen(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReplaceSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Upload New Cut File (Auto-Uploads to CDN)</label>
                <input 
                  type="file" 
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-300"
                  disabled={isUploadingToCdn}
                />

                {isUploadingToCdn && (
                  <div className="space-y-1.5 mt-2.5">
                    <div className="flex items-center justify-between text-xs text-indigo-400">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Loader2 size={13} className="animate-spin" /> Uploading new cut...
                      </span>
                      <span className="font-mono font-bold text-white">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                      <div 
                        className="bg-indigo-600 h-full rounded-full transition-all duration-150 ease-out shadow-lg shadow-indigo-500/50" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-2 text-slate-500 text-[10px] uppercase">Or Paste Direct Web URL</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Direct Video URL (.mp4 / CDN Link)</label>
                <input 
                  type="text" 
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  placeholder="https://your-cdn-host.com/video_v2.mp4"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Updated Title</label>
                <input 
                  type="text" 
                  value={newVideoTitle}
                  onChange={(e) => setNewVideoTitle(e.target.value)}
                  placeholder="Asset Title"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsReplaceOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isUploadingToCdn}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  Replace Video
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI ACTION PLAN MODAL */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                <Sparkles size={16} className="text-indigo-400" /> AI Executive Revision Plan
              </h3>
              <button onClick={() => setIsAiModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {isAiLoading ? (
              <div className="py-12 text-center text-slate-400 text-xs">Generating Action Plan...</div>
            ) : (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-300 whitespace-pre-line max-h-80 overflow-y-auto">
                {aiOutput}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}