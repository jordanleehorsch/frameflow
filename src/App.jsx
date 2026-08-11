import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Pencil, MessageSquare, 
  Check, Plus, RefreshCw, Upload, Folder, Send, Trash2, Sparkles, 
  Clock, Share2, Download, X, RotateCcw, Loader2, Home, BarChart2, 
  Search, Video, Layers, ArrowLeft, Eye, Users, MoreVertical, Filter, ArrowUpDown, Bell, Undo
} from 'lucide-react';

// ==========================================
// 🚨 BUNNY.NET HARDCODED CREDENTIALS 🚨
// ==========================================
const BUNNY_STORAGE_ZONE = "thrive";
const BUNNY_ACCESS_KEY = "d620773b-3709-413d-819288b64563-df1d-4b55";
const BUNNY_STORAGE_API_URL = `https://la.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}`;
const BUNNY_PULL_ZONE_URL = "https://jordanhorsch.b-cdn.net/";

const INITIAL_BRANDS = ['Carlos', 'HomeGrown', 'Modern Market', 'QDOBA', 'Thrive'];

// Latest App Update Information
const LATEST_APP_UPDATE = {
  version: "v2.4",
  title: "Scrubber Pinpoint Highlighting & Clean Replaces",
  description: "Clicking a pinpoint on the video timeline now highlights and scrolls to the comment! Replaced videos clear scrubber pinpoints automatically."
};

// Safe Deterministic ID Generator
const getDeterministicId = (filenameOrUrl) => {
  if (!filenameOrUrl) return '';
  const str = String(filenameOrUrl);
  if (str.startsWith('vid-') || str.startsWith('vid_')) {
    return str.replace(/^vid_/, 'vid-');
  }
  const filename = str.split('/').pop().split('?')[0];
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  return 'vid-' + decodeURIComponent(nameWithoutExt).toLowerCase().replace(/[^a-z0-9]/g, '_');
};

export default function App() {
  const initialVideoParamRef = useRef(
    new URLSearchParams(window.location.search).get('v') || 
    new URLSearchParams(window.location.search).get('video')
  );

  const [currentView, setCurrentView] = useState(() => {
    return initialVideoParamRef.current ? 'review' : 'dashboard';
  });
  
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const isInitialLoadRef = useRef(true);
  const isRemoteSyncRef = useRef(false);

  const [showUpdateBanner, setShowUpdateBanner] = useState(true);

  const [brands] = useState(INITIAL_BRANDS);
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState([]);
  const [activeVideoId, setActiveVideoId] = useState('');

  const [editingTitleId, setEditingTitleId] = useState(null);
  const [tempTitleText, setTempTitleText] = useState('');

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#EF4444');
  const [strokeWidth, setStrokeWidth] = useState(8);
  const [drawings, setDrawings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('frameflow_drawings') || '{}');
    } catch(e) { return {}; }
  });
  const [currentPath, setCurrentPath] = useState([]);
  const [isMouseDown, setIsMouseDown] = useState(false);

  const [comments, setComments] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('frameflow_comments') || '[]');
    } catch(e) { return []; }
  });
  const [commentFilter, setCommentFilter] = useState('unresolved');
  const [commentSort, setCommentSort] = useState('timestamp');
  const [commentText, setCommentText] = useState('');

  // 📌 HIGHLIGHTED COMMENT STATE
  const [highlightedCommentId, setHighlightedCommentId] = useState(null);

  // 💾 DEVICE-SPECIFIC REVIEWER NAME
  const [authorName, setAuthorName] = useState(() => {
    try {
      return localStorage.getItem('frameflow_author_name') || 'Reviewer';
    } catch(e) { return 'Reviewer'; }
  });

  const handleAuthorNameChange = (newName) => {
    setAuthorName(newName);
    try {
      localStorage.setItem('frameflow_author_name', newName);
    } catch(e) {}
  };

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiOutput, setAiOutput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoBrand, setNewVideoBrand] = useState('Thrive');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploadingToCdn, setIsUploadingToCdn] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const activeVideo = videos.find(v => v.id === activeVideoId) || videos[0] || null;

  // Auto-scroll to highlighted comment in list
  useEffect(() => {
    if (highlightedCommentId) {
      const el = document.getElementById(`comment-${highlightedCommentId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [highlightedCommentId]);

  // DIRECT CLOUD SAVE FUNCTION
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

    try {
      await fetch('/api/db', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videos: targetVideos,
          drawings: targetDrawings,
          comments: targetComments
        })
      });
    } catch (err) {
      console.error("Failed to sync database:", err);
    } finally {
      setTimeout(() => setIsSyncing(false), 300);
    }
  };

  // 1. INITIAL LOAD FROM VERCEL API RELAY
  useEffect(() => {
    const fetchAllBunnyCloudAssets = async () => {
      setIsSyncing(true);
      try {
        let cloudDb = { videos: [], drawings: {}, comments: [] };
        try {
          const res = await fetch('/api/db');
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

        const storageApiUrl = `https://la.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/`;
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
            url: meta?.url || publicUrl,
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
        console.error("Error fetching assets:", err);
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

  // 2. ⚡ 3-SECOND REAL-TIME POLLING via API RELAY
  useEffect(() => {
    if (!isDbLoaded) return;

    const liveSyncInterval = setInterval(async () => {
      if (isSyncing) return;

      try {
        const res = await fetch('/api/db');
        if (res.ok) {
          const cloudDb = await res.json();
          let stateUpdated = false;

          if (cloudDb.comments && Array.isArray(cloudDb.comments)) {
            const normalizedCloudComments = cloudDb.comments.map(c => ({
              ...c,
              videoId: getDeterministicId(c.videoId) || c.videoId
            }));

            setComments(prevComments => {
              if (JSON.stringify(prevComments) !== JSON.stringify(normalizedCloudComments)) {
                stateUpdated = true;
                return normalizedCloudComments;
              }
              return prevComments;
            });
          }

          if (cloudDb.drawings) {
            setDrawings(prevDrawings => {
              const normalizedDrawings = {};
              Object.keys(cloudDb.drawings).forEach(vidKey => {
                const normKey = getDeterministicId(vidKey);
                normalizedDrawings[normKey] = cloudDb.drawings[vidKey];
              });
              if (JSON.stringify(prevDrawings) !== JSON.stringify(normalizedDrawings)) {
                stateUpdated = true;
                return normalizedDrawings;
              }
              return prevDrawings;
            });
          }

          if (cloudDb.videos && Array.isArray(cloudDb.videos)) {
            setVideos(prevVideos => {
              const vidMap = new Map();
              prevVideos.forEach(v => vidMap.set(v.id, v));

              let hasChange = false;

              cloudDb.videos.forEach(cv => {
                const normId = getDeterministicId(cv.id || cv.url);
                if (normId) {
                  const existing = vidMap.get(normId);
                  if (existing) {
                    const newTitle = cv.title || existing.title;
                    const newBrand = cv.brand || existing.brand;
                    const newStatus = cv.status || existing.status;
                    const newUrl = cv.url || existing.url;

                    if (existing.title !== newTitle || existing.brand !== newBrand || existing.status !== newStatus || existing.url !== newUrl) {
                      hasChange = true;
                      vidMap.set(normId, { ...existing, title: newTitle, brand: newBrand, status: newStatus, url: newUrl });
                    }
                  } else {
                    hasChange = true;
                    vidMap.set(normId, {
                      id: normId,
                      title: cv.title || 'Untitled Video',
                      brand: cv.brand || 'Thrive',
                      url: cv.url,
                      status: cv.status || 'In Review',
                      createdAt: cv.createdAt || new Date().toISOString(),
                      duration: cv.duration || 30
                    });
                  }
                }
              });

              if (hasChange) {
                stateUpdated = true;
                return Array.from(vidMap.values());
              }
              return prevVideos;
            });
          }

          if (stateUpdated) {
            isRemoteSyncRef.current = true;
          }
        }
      } catch (e) {}
    }, 3000);

    return () => clearInterval(liveSyncInterval);
  }, [isDbLoaded, isSyncing]);

  // 3. AUTO-SAVE ON STATE CHANGE
  useEffect(() => {
    if (!isDbLoaded || isInitialLoadRef.current) return;

    if (isRemoteSyncRef.current) {
      isRemoteSyncRef.current = false;
      return;
    }

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

  // 5. KEEP URL IN SYNC
  useEffect(() => {
    if (currentView === 'review' && activeVideoId) {
      const newUrl = `${window.location.pathname}?v=${encodeURIComponent(activeVideoId)}`;
      window.history.replaceState(null, '', newUrl);
    } else if (currentView === 'dashboard') {
      initialVideoParamRef.current = null;
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [currentView, activeVideoId]);

  const handleUpdateBrand = (videoId, newBrand, e) => {
    if (e) e.stopPropagation();
    const updatedVideos = videos.map(v => v.id === videoId ? { ...v, brand: newBrand } : v);
    setVideos(updatedVideos);
    saveCloudDatabaseDirect(updatedVideos, drawings, comments);
  };

  const startRenameVideo = (videoId, currentTitle, e) => {
    if (e) e.stopPropagation();
    setEditingTitleId(videoId);
    setTempTitleText(currentTitle);
  };

  const saveRenameVideo = (videoId, e) => {
    if (e) e.stopPropagation();
    if (tempTitleText.trim()) {
      const updatedVideos = videos.map(v => v.id === videoId ? { ...v, title: tempTitleText.trim() } : v);
      setVideos(updatedVideos);
      saveCloudDatabaseDirect(updatedVideos, drawings, comments);
    }
    setEditingTitleId(null);
  };

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

  const handleDeleteVideo = async (videoIdToDelete, e) => {
    if (e) e.stopPropagation();
    const videoToDelete = videos.find(v => v.id === videoIdToDelete);
    if (!videoToDelete) return;

    if (window.confirm(`Are you sure you want to delete "${videoToDelete.title}"? This will permanently delete the file from Bunny CDN.`)) {
      setIsSyncing(true);

      try {
        const fileName = videoToDelete.url.split('/').pop();
        if (fileName) {
          const deleteUrl = `https://la.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/${fileName}`;
          await fetch(deleteUrl, {
            method: 'DELETE',
            headers: { 'AccessKey': BUNNY_ACCESS_KEY }
          });
        }
      } catch (err) {
        console.error("Error deleting file:", err);
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

  const uploadFileToBunnyCDN = (file) => {
    return new Promise((resolve) => {
      setIsUploadingToCdn(true);
      setUploadProgress(0);

      const cleanFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const bunnyUploadUrl = `https://la.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/${cleanFileName}`;

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
          alert(`⚠️ Upload failed with status ${xhr.status}.`);
          resolve(null);
        }
      };

      xhr.onerror = () => {
        setIsUploadingToCdn(false);
        alert("⚠️ Cloud upload to Bunny CDN failed.");
        resolve(null);
      };

      xhr.send(file);
    });
  };

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

  // 🎯 ACCURATE TOUCH & MOUSE CANVAS COORDINATE CALCULATOR
  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX = e.clientX;
    let clientY = e.clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    }

    const elementWidth = rect.width;
    const elementHeight = rect.height;
    const nativeWidth = canvas.width;
    const nativeHeight = canvas.height;

    if (elementWidth === 0 || elementHeight === 0) return { x: 0, y: 0 };

    const elementRatio = elementWidth / elementHeight;
    const nativeRatio = nativeWidth / nativeHeight;

    let renderWidth, renderHeight, offsetX, offsetY;

    if (elementRatio > nativeRatio) {
      renderHeight = elementHeight;
      renderWidth = elementHeight * nativeRatio;
      offsetX = (elementWidth - renderWidth) / 2;
      offsetY = 0;
    } else {
      renderWidth = elementWidth;
      renderHeight = elementWidth / nativeRatio;
      offsetX = 0;
      offsetY = (elementHeight - renderHeight) / 2;
    }

    const clickX = clientX - rect.left - offsetX;
    const clickY = clientY - rect.top - offsetY;

    return {
      x: Math.max(0, Math.min(nativeWidth, (clickX / renderWidth) * nativeWidth)),
      y: Math.max(0, Math.min(nativeHeight, (clickY / renderHeight) * nativeHeight))
    };
  };

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

  const draw = (e) => {
    if (!isDrawingMode || !isMouseDown) return;
    if (e.cancelable) e.preventDefault();
    const coords = getCanvasCoordinates(e);
    setCurrentPath(prev => [...prev, coords]);
    renderCanvas();
  };

  const stopDrawing = () => {
    if (!isDrawingMode || !isMouseDown || !activeVideo) return;
    setIsMouseDown(false);
    if (currentPath.length > 0) {
      const targetVidId = activeVideo.id;
      const timeKey = currentTime.toFixed(1);

      const newPathObj = {
        id: 'path-' + Date.now(),
        author: authorName,
        color: strokeColor,
        width: strokeWidth,
        points: currentPath
      };
      
      const updatedVideoDrawings = [...(drawings[targetVidId]?.[timeKey] || []), newPathObj];
      
      const nextDrawings = {
        ...drawings,
        [targetVidId]: {
          ...(drawings[targetVidId] || {}),
          [timeKey]: updatedVideoDrawings
        }
      };
      setDrawings(nextDrawings);

      let nextComments = [...comments];
      const existingSameAuthorIndex = nextComments.findIndex(
        c => c.videoId === targetVidId && 
             c.timestamp.toFixed(1) === timeKey && 
             c.author === authorName
      );

      if (existingSameAuthorIndex !== -1) {
        nextComments[existingSameAuthorIndex] = {
          ...nextComments[existingSameAuthorIndex],
          hasDrawing: true
        };
      } else {
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
        nextComments.push(newComment);
      }

      setComments(nextComments);

      const updatedVideos = videos.map(v => v.id === activeVideoId ? { ...v, status: 'Changes Requested' } : v);
      setVideos(updatedVideos);

      saveCloudDatabaseDirect(updatedVideos, nextDrawings, nextComments);
    }
    setCurrentPath([]);
  };

  // ↩️ UNDO LAST DRAWING STROKE
  const handleUndoDrawing = () => {
    if (!activeVideo) return;
    const targetVidId = activeVideo.id;
    const timeKey = currentTime.toFixed(1);
    const currentFrameDrawings = drawings[targetVidId]?.[timeKey] || [];

    if (currentFrameDrawings.length === 0) return;

    const updatedFrameDrawings = currentFrameDrawings.slice(0, -1);
    
    const nextDrawings = {
      ...drawings,
      [targetVidId]: {
        ...(drawings[targetVidId] || {}),
        [timeKey]: updatedFrameDrawings
      }
    };

    const authorHasMoreDrawings = updatedFrameDrawings.some(d => (d.author ? d.author === authorName : true));

    let nextComments = comments;
    if (!authorHasMoreDrawings) {
      nextComments = comments.map(c => {
        if (c.videoId === targetVidId && c.timestamp.toFixed(1) === timeKey && c.author === authorName) {
          return { ...c, hasDrawing: false };
        }
        return c;
      }).filter(c => !(c.videoId === targetVidId && c.timestamp.toFixed(1) === timeKey && c.author === authorName && c.text === 'Canvas markup / drawing annotation added'));
    }

    setDrawings(nextDrawings);
    setComments(nextComments);
    saveCloudDatabaseDirect(videos, nextDrawings, nextComments);
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
      ctx.lineWidth = path.width || 8;
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

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!commentText.trim() || !activeVideo) return;

    const targetVidId = activeVideo.id;
    const timeKey = currentTime.toFixed(1);
    const frameDrawings = drawings[targetVidId]?.[timeKey] || [];
    const hasAuthorDrawingAtFrame = frameDrawings.some(d => d.author ? d.author === authorName : false);

    let nextComments = [...comments];

    const placeholderIndex = nextComments.findIndex(
      c => c.videoId === targetVidId &&
           c.timestamp.toFixed(1) === timeKey &&
           c.author === authorName &&
           c.text === 'Canvas markup / drawing annotation added'
    );

    if (placeholderIndex !== -1) {
      nextComments[placeholderIndex] = {
        ...nextComments[placeholderIndex],
        author: authorName,
        text: commentText.trim(),
        hasDrawing: true
      };
    } else {
      const existingAuthorCommentIndex = nextComments.findIndex(
        c => c.videoId === targetVidId && c.timestamp.toFixed(1) === timeKey && c.author === authorName
      );

      if (existingAuthorCommentIndex !== -1) {
        nextComments[existingAuthorCommentIndex] = {
          ...nextComments[existingAuthorCommentIndex],
          author: authorName,
          text: commentText.trim(),
          hasDrawing: nextComments[existingAuthorCommentIndex].hasDrawing || hasAuthorDrawingAtFrame
        };
      } else {
        const newComment = {
          id: 'c-' + Date.now(),
          videoId: targetVidId,
          timestamp: currentTime,
          timeFormatted: formatTime(currentTime),
          author: authorName,
          text: commentText.trim(),
          completed: false,
          createdAt: new Date().toISOString(),
          hasDrawing: hasAuthorDrawingAtFrame
        };
        nextComments.push(newComment);
      }
    }

    setComments(nextComments);
    setCommentText('');

    const updatedVideos = videos.map(v => v.id === activeVideoId ? { ...v, status: 'Changes Requested' } : v);
    setVideos(updatedVideos);

    try {
      localStorage.setItem('frameflow_comments', JSON.stringify(nextComments));
      localStorage.setItem('frameflow_videos', JSON.stringify(updatedVideos));
    } catch(e) {}

    saveCloudDatabaseDirect(updatedVideos, drawings, nextComments);
  };

  const toggleCommentComplete = (id) => {
    const updatedComments = comments.map(c => c.id === id ? { ...c, completed: !c.completed } : c);
    setComments(updatedComments);
    try {
      localStorage.setItem('frameflow_comments', JSON.stringify(updatedComments));
    } catch(e) {}
    saveCloudDatabaseDirect(videos, drawings, updatedComments);
  };

  // 🗑️ DELETE COMMENT & CANVAS MARKUP SYNCHRONIZED HANDLER
  const handleDeleteComment = async (commentId, e) => {
    if (e) e.stopPropagation();

    const commentToDelete = comments.find(c => c.id === commentId);
    const updatedComments = comments.filter(c => c.id !== commentId);

    let nextDrawings = { ...drawings };

    if (commentToDelete) {
      const vidId = commentToDelete.videoId;
      const timeKey = commentToDelete.timestamp.toFixed(1);

      if (nextDrawings[vidId]?.[timeKey]) {
        const remainingStrokes = nextDrawings[vidId][timeKey].filter(
          d => d.author ? d.author !== commentToDelete.author : false
        );

        if (remainingStrokes.length > 0) {
          nextDrawings[vidId] = {
            ...nextDrawings[vidId],
            [timeKey]: remainingStrokes
          };
        } else {
          const updatedVidDrawings = { ...nextDrawings[vidId] };
          delete updatedVidDrawings[timeKey];
          nextDrawings[vidId] = updatedVidDrawings;
        }
      }
    }

    if (highlightedCommentId === commentId) {
      setHighlightedCommentId(null);
    }

    setComments(updatedComments);
    setDrawings(nextDrawings);

    try {
      localStorage.setItem('frameflow_comments', JSON.stringify(updatedComments));
      localStorage.setItem('frameflow_drawings', JSON.stringify(nextDrawings));
    } catch(e) {}

    await saveCloudDatabaseDirect(videos, nextDrawings, updatedComments);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const cleanName = extractFilenameWithoutExt(file.name);
      if (!isReplaceOpen || !newVideoTitle) {
        setNewVideoTitle(cleanName);
      }

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

  // 🔄 REPLACE VIDEO HANDLER: AUTO-RESOLVES COMMENTS & CLEARS MARKUPS
  const handleReplaceSubmit = async (e) => {
    e.preventDefault();
    if (!newVideoUrl) {
      alert("Please select a valid video file or enter a direct URL.");
      return;
    }

    setIsSyncing(true);

    const oldId = activeVideoId;
    const newId = getDeterministicId(newVideoUrl) || oldId;
    const oldVideo = videos.find(v => v.id === oldId);

    // Delete old file from Bunny CDN storage
    if (oldVideo && oldVideo.url && oldVideo.url !== newVideoUrl) {
      try {
        const oldFileName = oldVideo.url.split('/').pop();
        if (oldFileName && oldVideo.url.includes('b-cdn.net')) {
          const deleteUrl = `https://la.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/${oldFileName}`;
          await fetch(deleteUrl, {
            method: 'DELETE',
            headers: { 'AccessKey': BUNNY_ACCESS_KEY }
          });
        }
      } catch (err) {
        console.error("Error deleting old replaced file:", err);
      }
    }

    const updatedVideos = videos.map(v => {
      if (v.id === oldId) {
        return {
          ...v,
          id: newId,
          title: newVideoTitle || v.title,
          url: newVideoUrl || v.url
        };
      }
      return v;
    });

    // 🧹 Remove all canvas markups for this video
    let nextDrawings = { ...drawings };
    delete nextDrawings[oldId];
    delete nextDrawings[newId];
    setDrawings(nextDrawings);

    // 📁 Move previous comments to Resolved tab
    let nextComments = comments.map(c => {
      if (c.videoId === oldId || c.videoId === newId) {
        return { 
          ...c, 
          videoId: newId, 
          completed: true, 
          hasDrawing: false 
        };
      }
      return c;
    });
    setComments(nextComments);

    setHighlightedCommentId(null);
    setVideos(updatedVideos);
    setActiveVideoId(newId);
    setIsReplaceOpen(false);
    resetUploadForm();

    await saveCloudDatabaseDirect(updatedVideos, nextDrawings, nextComments);
    setIsSyncing(false);
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

  // 📌 PINPOINT CLICK HANDLER: Jumps to frame and highlights comment
  const handlePinpointClick = (comment, e) => {
    if (e) e.stopPropagation();
    jumpToTime(comment.timestamp);
    setHighlightedCommentId(comment.id);
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

  const filteredComments = allVideoComments.filter(c => {
    if (commentFilter === 'unresolved') return !c.completed;
    if (commentFilter === 'resolved') return c.completed;
    return true;
  });

  const sortedComments = [...filteredComments].sort((a, b) => {
    if (commentSort === 'timestamp') {
      return (a.timestamp || 0) - (b.timestamp || 0);
    } else if (commentSort === 'newest') {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    } else if (commentSort === 'oldest') {
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    }
    return 0;
  });

  const filteredVideos = videos.filter(v => {
    const matchesBrand = selectedBrand === 'All' || v.brand === selectedBrand;
    const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesBrand && matchesSearch;
  });

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* GLOBAL SIDEBAR */}
      <div className="w-full md:w-60 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between flex-shrink-0 z-30">
        <div>
          <div className="p-3 md:p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-xl text-white font-bold text-base md:text-lg shadow-lg shadow-indigo-950">FF</div>
              <div>
                <div className="font-bold text-sm md:text-base tracking-wide text-white leading-none">FrameFlow</div>
                <div className="text-[10px] text-slate-400 mt-1">Video Studio Pro</div>
              </div>
            </div>

            <div className="text-slate-500" title={isSyncing ? "Syncing..." : "Live Relay Active"}>
              {isSyncing ? (
                <Loader2 size={14} className="animate-spin text-indigo-400" />
              ) : (
                <Check size={14} className="text-emerald-500" />
              )}
            </div>
          </div>

          <div className="p-2 md:p-3 flex md:flex-col gap-1">
            <button 
              onClick={() => setCurrentView('dashboard')}
              className={`w-full flex items-center justify-center md:justify-start gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentView === 'dashboard' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Home size={15} /> Home
            </button>
          </div>

          <div className="px-3 py-2 md:px-4 md:py-3 border-t border-slate-800/80">
            <label className="text-[10px] md:text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 md:mb-2 block">Brand Workspace</label>
            <select 
              value={selectedBrand} 
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-[16px] md:text-xs rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="All">All Concepts ({videos.length})</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>

        <div className="hidden md:block p-3 border-t border-slate-800">
          <button 
            onClick={() => setIsUploadOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-4 rounded-lg transition text-xs shadow-lg shadow-indigo-950"
          >
            <Plus size={16} /> Upload Asset
          </button>
        </div>
      </div>

      {/* VIEW 1: DASHBOARD HUB */}
      {currentView === 'dashboard' && (
        <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950">
          
          <div className="h-auto md:h-16 border-b border-slate-800 p-3 md:px-8 flex flex-col sm:flex-row items-center justify-between bg-slate-900/40 sticky top-0 backdrop-blur z-20 gap-2 sm:gap-4">
            <div className="flex items-center gap-2 w-full max-w-lg">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search videos, brands..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-[16px] md:text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <select 
                value={selectedBrand} 
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-indigo-300 text-[16px] md:text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
              >
                <option value="All">All Folders</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <button 
              onClick={() => setIsUploadOpen(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 px-4 rounded-xl transition shadow-md whitespace-nowrap"
            >
              <Plus size={16} /> Upload
            </button>
          </div>

          <div className="p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
            
            {showUpdateBanner && (
              <div className="bg-indigo-950/80 border border-indigo-500/40 rounded-xl p-4 flex items-start justify-between gap-3 text-xs shadow-lg relative overflow-hidden">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-600 rounded-lg text-white flex-shrink-0 mt-0.5 shadow-md">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">{LATEST_APP_UPDATE.title}</span>
                      <span className="bg-indigo-600/60 text-indigo-200 text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold">{LATEST_APP_UPDATE.version}</span>
                    </div>
                    <p className="text-slate-300 mt-1 leading-relaxed">
                      {LATEST_APP_UPDATE.description}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowUpdateBanner(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-indigo-900/50 transition flex-shrink-0"
                  title="Dismiss Announcement"
                >
                  <X size={16} />
                </button>
              </div>
            )}

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
                        <video src={vid.url} playsInline className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
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
                                className="w-full bg-slate-800 border border-indigo-500 rounded text-[16px] md:text-xs px-1.5 py-0.5 text-white focus:outline-none"
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
                              className="text-[16px] md:text-[10px] bg-slate-800 border border-slate-700/80 text-indigo-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-indigo-500 cursor-pointer font-medium hover:bg-slate-700 transition"
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

      {/* VIEW 2: FRAMEFLOW VIDEO REVIEW PLAYER STUDIO */}
      {currentView === 'review' && activeVideo && (
        <div className="flex-1 flex flex-col lg:flex-row bg-slate-950 min-w-0 overflow-y-auto lg:overflow-hidden">
          
          <div className="flex-1 flex flex-col min-w-0">
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
                    className="text-[16px] md:text-[11px] bg-slate-800 border border-slate-700 text-indigo-300 rounded-lg px-2 py-1 focus:outline-none cursor-pointer font-medium hover:bg-slate-700 transition"
                  >
                    {brands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

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
                  onClick={() => {
                    setNewVideoTitle(activeVideo?.title || '');
                    setNewVideoUrl('');
                    setUploadedFileName('');
                    setIsReplaceOpen(true);
                  }}
                  className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium py-1 px-2.5 rounded-lg border border-slate-700 transition"
                >
                  <RotateCcw size={12} /> Replace
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

            <div className="flex-1 flex flex-col justify-center items-center p-3 md:p-6 bg-slate-950 relative overflow-hidden min-h-[50vh]">
              <div className="relative max-h-[60vh] lg:max-h-[70vh] w-full max-w-5xl bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={activeVideo?.url}
                  playsInline
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

                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-700 p-1.5 rounded-lg shadow-lg z-20">
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

                      <button
                        onClick={handleUndoDrawing}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                        title="Undo last drawing stroke"
                      >
                        <Undo size={15} />
                      </button>

                      <div className="h-3 w-px bg-slate-700 mx-0.5" />

                      {[4, 8, 14].map(w => (
                        <button
                          key={w}
                          onClick={() => setStrokeWidth(w)}
                          className={`px-1.5 py-0.5 text-[10px] font-mono rounded font-bold transition ${
                            strokeWidth === w ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white bg-slate-800'
                          }`}
                          title={`Line width ${w}px`}
                        >
                          {w === 4 ? 'S' : w === 8 ? 'M' : 'L'}
                        </button>
                      ))}

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

              {/* VIDEO SCRUBBER TIMELINE & DYNAMIC ACTIVE PINPOINTS */}
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

                  {/* Pinpoints render filteredComments (clears on video replace and highlights on click) */}
                  {filteredComments.map(c => {
                    const percent = (c.timestamp / (duration || 1)) * 100;
                    const isHighlighted = highlightedCommentId === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={(e) => handlePinpointClick(c, e)}
                        style={{ left: `${percent}%` }}
                        className={`absolute z-30 w-2.5 h-4 -top-0.5 rounded-sm transform -translate-x-1/2 border transition-all ${
                          isHighlighted 
                            ? 'ring-2 ring-white scale-150 z-40 bg-white border-indigo-600' 
                            : c.hasDrawing ? 'bg-amber-400 border-slate-900' : 'bg-indigo-400 border-slate-900'
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

          <div className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col flex-shrink-0 min-h-[300px] lg:min-h-0">
            <div className="p-3 border-b border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-white text-xs flex items-center gap-2 uppercase tracking-wider">
                  <MessageSquare size={14} /> Comments ({filteredComments.length})
                </h2>

                <div className="flex items-center gap-1">
                  <ArrowUpDown size={12} className="text-slate-400" />
                  <select
                    value={commentSort}
                    onChange={(e) => setCommentSort(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-indigo-300 text-[16px] md:text-[10px] font-medium rounded px-1.5 py-0.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="timestamp">Timecode</option>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
              </div>

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

            {/* INPUT FORM */}
            <form onSubmit={handleAddComment} className="p-3 border-b border-slate-800 space-y-2 bg-slate-900">
              <input 
                type="text" 
                placeholder="Your Name"
                value={authorName}
                onChange={(e) => handleAuthorNameChange(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-[16px] md:text-xs rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Add feedback at frame..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 text-[16px] md:text-xs rounded-lg p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <button 
                  type="submit"
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
                >
                  <Send size={14} />
                </button>
              </div>
            </form>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[350px] lg:max-h-none">
              {sortedComments.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  {commentFilter === 'resolved' 
                    ? 'No resolved comments yet.' 
                    : 'No active comments. Add feedback above or draw on the video!'}
                </div>
              ) : (
                sortedComments.map(c => {
                  const isHighlighted = highlightedCommentId === c.id;
                  return (
                    <div 
                      key={c.id} 
                      id={`comment-${c.id}`}
                      className={`p-2.5 rounded-lg border transition-all duration-300 ${
                        isHighlighted
                          ? 'bg-indigo-900/90 border-indigo-400 ring-2 ring-indigo-500/80 shadow-lg scale-[1.02]'
                          : c.completed 
                          ? 'bg-slate-900/40 border-slate-800 opacity-60' 
                          : 'bg-slate-800/60 border-slate-700'
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
                      
                      {c.hasDrawing && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/40 border border-amber-800/50 px-2 py-0.5 rounded-md w-fit font-medium">
                          <Pencil size={11} /> Drawing Markup Attached
                        </div>
                      )}

                      <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-slate-700/50">
                        <button 
                          onClick={() => toggleCommentComplete(c.id)}
                          className={`flex items-center gap-1 text-[10px] font-medium transition ${
                            c.completed ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Check size={11} /> {c.completed ? 'Resolved' : 'Mark Resolved'}
                        </button>

                        <button 
                          onClick={(e) => handleDeleteComment(c.id, e)}
                          className="flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-red-400 transition"
                          title="Delete Comment"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    </div>
                  );
                })
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
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-300 text-[16px] md:text-xs"
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
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-[16px] md:text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Video Title</label>
                <input 
                  type="text" 
                  value={newVideoTitle}
                  onChange={(e) => setNewVideoTitle(e.target.value)}
                  placeholder="e.g. QDOBA_Summer_Campaign"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-[16px] md:text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Brand Folder</label>
                <select 
                  value={newVideoBrand}
                  onChange={(e) => setNewVideoBrand(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-[16px] md:text-xs"
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
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-300 text-[16px] md:text-xs"
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
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-[16px] md:text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Updated Title</label>
                <input 
                  type="text" 
                  value={newVideoTitle}
                  onChange={(e) => setNewVideoTitle(e.target.value)}
                  placeholder="Asset Title"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-[16px] md:text-xs"
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