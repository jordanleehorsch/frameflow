import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Pencil, MessageSquare, 
  Check, Plus, RefreshCw, Upload, Folder, Send, Trash2, Sparkles, 
  Clock, Share2, Download, X, RotateCcw, Loader2, Home, BarChart2, 
  Search, Video, Layers, ArrowLeft, Eye, Users, MoreVertical, Filter, ArrowUpDown, Bell, Undo, MapPin,
  Lock, LogIn, LogOut, ShieldCheck, FolderPlus, Edit3, KeyRound, Clapperboard, Settings, Sliders
} from 'lucide-react';

const BUNNY_STORAGE_ZONE = "thrive";
const BUNNY_ACCESS_KEY = "d620773b-3709-413d-819288b64563-df1d-4b55";
const BUNNY_STORAGE_API_URL = `https://la.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}`;
const BUNNY_PULL_ZONE_URL = "https://jordanhorsch.b-cdn.net/";

const ALLOWED_ADMIN_EMAILS = [
  'jhorsch@thriverg.com',
  'tramsey@thriverg.com',
  'ceidson@thriverg.com'
];

const ADMIN_PASSWORD = "Thrive1234";
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

const INITIAL_BRANDS = ['Carlos', 'HomeGrown', 'Modern Market', 'QDOBA', 'Thrive'];

const LATEST_APP_UPDATE = {
  version: "v5.4",
  title: "Native Path Formatting & Reliable Media Playback",
  description: "Fixed Windows C++ exporter initialization errors and restored direct click-to-play media bindings."
};

const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds === null || seconds === undefined) return '00:00.0';
  const cleanSecs = Math.max(0, seconds);
  const mins = Math.floor(cleanSecs / 60);
  const secs = Math.floor(cleanSecs % 60);
  const ms = Math.floor((cleanSecs % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
};

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

const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

const moveVideoToTopWithStatus = (videoList, targetId, newStatus) => {
  const target = videoList.find(v => v.id === targetId);
  if (!target) return videoList;
  const remaining = videoList.filter(v => v.id !== targetId);
  return [{ ...target, status: newStatus }, ...remaining];
};

export default function App() {
  const initialVideoParamRef = useRef(
    new URLSearchParams(window.location.search).get('v') || 
    new URLSearchParams(window.location.search).get('video')
  );

  const [isPremiereEnv] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('cep') === '1' || params.get('premiere') === 'true';
  });

  const [currentView, setCurrentView] = useState(() => {
    return initialVideoParamRef.current ? 'review' : 'dashboard';
  });
  
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const isInitialLoadRef = useRef(true);
  const isRemoteSyncRef = useRef(false);
  const lastUserActionRef = useRef(0);

  const emailDebounceTimersRef = useRef({});
  const sessionCommentsRef = useRef({});

  const [showUpdateBanner, setShowUpdateBanner] = useState(true);
  const [copiedStatus, setCopiedStatus] = useState(false);
  const [isVideoProcessing, setIsVideoProcessing] = useState(true);

  const [isRenderModalOpen, setIsRenderModalOpen] = useState(false);
  const [exportRange, setExportRange] = useState('1');

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('frameflow_google_user') || 'null');
    } catch(e) { return null; }
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [manualEmailInput, setManualEmailInput] = useState('');
  const [manualPasswordInput, setManualPasswordInput] = useState('');

  const isAdmin = isPremiereEnv || Boolean(
    user && 
    user.email && 
    ALLOWED_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(user.email.toLowerCase())
  );

  const [brands, setBrands] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('frameflow_brands') || 'null') || INITIAL_BRANDS;
    } catch(e) { return INITIAL_BRANDS; }
  });
  const [selectedBrand, setSelectedBrand] = useState('All');

  const [isAddFolderModalOpen, setIsAddFolderModalOpen] = useState(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState('');
  const [isRenameFolderModalOpen, setIsRenameFolderModalOpen] = useState(false);
  const [renameFolderTarget, setRenameFolderTextTarget] = useState('');
  const [renameFolderInput, setRenameFolderInput] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState([]);
  const [activeVideoId, setActiveVideoId] = useState('');

  const videosRef = useRef(videos);
  const authorNameRef = useRef('Reviewer');

  useEffect(() => {
    videosRef.current = videos;
  }, [videos]);

  const [editingTitleId, setEditingTitleId] = useState(null);
  const [tempTitleText, setTempTitleText] = useState('');

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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

  const [activePin, setActivePin] = useState(null);
  const [inlinePinText, setInlinePinText] = useState('');

  const [comments, setComments] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('frameflow_comments') || '[]');
    } catch(e) { return []; }
  });
  const [commentFilter, setCommentFilter] = useState('unresolved');
  const [commentSort, setCommentSort] = useState('timestamp');
  const [commentText, setCommentText] = useState('');

  const [highlightedCommentId, setHighlightedCommentId] = useState(null);

  const [authorName, setAuthorName] = useState(() => {
    try {
      return user?.name || localStorage.getItem('frameflow_author_name') || 'Reviewer';
    } catch(e) { return 'Reviewer'; }
  });

  useEffect(() => {
    authorNameRef.current = authorName;
  }, [authorName]);

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

  useEffect(() => {
    setIsVideoProcessing(true);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    const safetyTimer = setTimeout(() => {
      setIsVideoProcessing(false);
    }, 1800);

    return () => clearTimeout(safetyTimer);
  }, [activeVideoId, activeVideo?.url]);

  useEffect(() => {
    const handlePremiereMessage = async (event) => {
      if (event.data && event.data.type === 'PREMIERE_SEQUENCE_EXPORTED') {
        const { fileUrl, fileName, sequenceName } = event.data;
        if (fileUrl) {
          const deterministicId = getDeterministicId(fileName || fileUrl);
          const cleanTitle = sequenceName || fileName || 'Premiere Timeline Cut';

          const newVidObj = {
            id: deterministicId,
            title: cleanTitle,
            brand: selectedBrand !== 'All' ? selectedBrand : 'Thrive',
            url: fileUrl,
            status: 'In Review',
            createdAt: new Date().toISOString(),
            duration: 30
          };

          lastUserActionRef.current = Date.now();
          setVideos(prev => [newVidObj, ...prev.filter(v => v.id !== deterministicId)]);
          setActiveVideoId(deterministicId);
          setCurrentView('review');
        }
      }
    };

    window.addEventListener('message', handlePremiereMessage);
    return () => window.removeEventListener('message', handlePremiereMessage);
  }, [selectedBrand]);

  const handleStartPremiereRenderSubmit = (e) => {
    e.preventDefault();
    setIsRenderModalOpen(false);
    if (window.parent) {
      window.parent.postMessage({ 
        type: 'RENDER_PREMIERE_ACTIVE_SEQUENCE',
        settings: {
          exportRange: parseInt(exportRange, 10)
        }
      }, '*');
    }
  };

  const togglePlayPlayback = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
          setIsVideoProcessing(false);
        }).catch(err => {
          console.error("Playback failed:", err);
          setIsPlaying(false);
        });
      }
    }
  };

  const handleCopyLink = (videoIdToCopy, e) => {
    if (e) e.stopPropagation();
    const targetId = videoIdToCopy || activeVideoId;
    const shareUrl = `${window.location.origin}${window.location.pathname}?v=${encodeURIComponent(targetId)}`;

    window.history.replaceState(null, '', shareUrl);

    const fallbackCopy = (text) => {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {}
      document.body.removeChild(textArea);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopiedStatus(true);
        setTimeout(() => setCopiedStatus(false), 2500);
      }).catch(() => {
        fallbackCopy(shareUrl);
        setCopiedStatus(true);
        setTimeout(() => setCopiedStatus(false), 2500);
      });
    } else {
      fallbackCopy(shareUrl);
      setCopiedStatus(true);
      setTimeout(() => setCopiedStatus(false), 2500);
    }
  };

  const sendConsolidatedRevisionEmail = (videoId) => {
    const pendingList = sessionCommentsRef.current[videoId] || [];
    if (pendingList.length === 0) return;

    const targetVid = videosRef.current.find(v => v.id === videoId) || activeVideo;
    const shareUrl = `${window.location.origin}${window.location.pathname}?v=${encodeURIComponent(videoId)}`;

    fetch('/api/notify-revisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoTitle: targetVid?.title || 'Video Asset',
        videoUrl: shareUrl,
        authorName: authorNameRef.current || 'Reviewer',
        comments: pendingList
      })
    })
    .then(res => res.json())
    .then(data => {
      if (!data.success) {
        console.warn("Revision Email Note:", data.error || data.message);
      }
    })
    .catch(err => console.error("Failed to trigger revision email:", err));

    delete sessionCommentsRef.current[videoId];
    delete emailDebounceTimersRef.current[videoId];
  };

  const queueCommentForEmailDigest = (commentObj, vidId) => {
    const vId = vidId || activeVideoId;
    if (!vId) return;

    if (!sessionCommentsRef.current[vId]) {
      sessionCommentsRef.current[vId] = [];
    }
    sessionCommentsRef.current[vId].push(commentObj);

    if (emailDebounceTimersRef.current[vId]) {
      clearTimeout(emailDebounceTimersRef.current[vId]);
    }

    emailDebounceTimersRef.current[vId] = setTimeout(() => {
      sendConsolidatedRevisionEmail(vId);
    }, 60000);
  };

  useEffect(() => {
    const handleUnload = () => {
      Object.keys(sessionCommentsRef.current).forEach(vId => {
        sendConsolidatedRevisionEmail(vId);
      });
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  useEffect(() => {
    const handleGoogleResponse = (response) => {
      const payload = parseJwt(response.credential);
      if (payload && payload.email) {
        authenticateEmail(payload.email, payload.name, payload.picture, true);
      }
    };

    if (GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes("YOUR_GOOGLE_CLIENT_ID")) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleResponse
          });
        }
      };
      document.body.appendChild(script);

      return () => {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      };
    }
  }, []);

  useEffect(() => {
    if (isLoginModalOpen && window.google && GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes("YOUR_GOOGLE_CLIENT_ID")) {
      setTimeout(() => {
        const btnContainer = document.getElementById('googleSignInBtnModal');
        if (btnContainer) {
          btnContainer.innerHTML = '';
          window.google.accounts.id.renderButton(btnContainer, {
            theme: 'outline',
            size: 'large',
            width: 280,
            text: 'signin_with'
          });
        }
      }, 100);
    }
  }, [isLoginModalOpen]);

  const authenticateEmail = (email, name, picture, isGoogle = false) => {
    const emailLower = email.trim().toLowerCase();
    if (ALLOWED_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(emailLower)) {
      const authUser = {
        name: name || emailLower.split('@')[0],
        email: emailLower,
        picture: picture || null
      };
      setUser(authUser);
      setAuthorName(authUser.name);
      setIsLoginModalOpen(false);
      setManualEmailInput('');
      setManualPasswordInput('');
      try {
        localStorage.setItem('frameflow_google_user', JSON.stringify(authUser));
        localStorage.setItem('frameflow_author_name', authUser.name);
      } catch (e) {}
    } else {
      alert(`🔒 Access Restricted:\n\n"${email}" is not in the authorized admin list.`);
    }
  };

  const handleManualEmailLogin = (e) => {
    e.preventDefault();
    if (!manualEmailInput.trim()) {
      alert("Please enter your email address.");
      return;
    }
    if (manualPasswordInput !== ADMIN_PASSWORD) {
      alert("❌ Incorrect Password. Please enter the correct admin password.");
      return;
    }
    authenticateEmail(manualEmailInput, manualEmailInput.split('@')[0]);
  };

  const handleSignOut = () => {
    setUser(null);
    try {
      localStorage.removeItem('frameflow_google_user');
    } catch(e) {}
  };

  const handleCreateFolder = (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    const cleanName = newFolderNameInput.trim();
    if (!cleanName) return;

    if (brands.some(b => b.toLowerCase() === cleanName.toLowerCase())) {
      alert("A folder with this name already exists!");
      return;
    }

    lastUserActionRef.current = Date.now();
    const updatedBrands = [...brands, cleanName];
    setBrands(updatedBrands);
    setSelectedBrand(cleanName);
    setNewFolderNameInput('');
    setIsAddFolderModalOpen(false);
  };

  const handleRenameFolderSubmit = (e) => {
    e.preventDefault();
    if (!isAdmin || !renameFolderTarget) return;
    const cleanNewName = renameFolderInput.trim();
    if (!cleanNewName) return;

    if (brands.some(b => b !== renameFolderTarget && b.toLowerCase() === cleanNewName.toLowerCase())) {
      alert("A folder with this name already exists!");
      return;
    }

    lastUserActionRef.current = Date.now();
    const updatedBrands = brands.map(b => b === renameFolderTarget ? cleanNewName : b);
    const updatedVideos = videos.map(v => v.brand === renameFolderTarget ? { ...v, brand: cleanNewName } : v);

    setBrands(updatedBrands);
    setVideos(updatedVideos);
    if (selectedBrand === renameFolderTarget) {
      setSelectedBrand(cleanNewName);
    }
    setIsRenameFolderModalOpen(false);
  };

  const handleUpdateBrand = (videoId, newBrand, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!isAdmin) {
      alert("🔒 Admin Permission Required:\nOnly authorized admins can change brand folders.");
      return;
    }

    lastUserActionRef.current = Date.now();
    const updatedVideos = videos.map(v => v.id === videoId ? { ...v, brand: newBrand } : v);
    setVideos(updatedVideos);
  };

  const startRenameVideo = (videoId, currentTitle, e) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    setEditingTitleId(videoId);
    setTempTitleText(currentTitle);
  };

  const saveRenameVideo = (videoId, e) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    if (tempTitleText.trim()) {
      lastUserActionRef.current = Date.now();
      const updatedVideos = videos.map(v => v.id === videoId ? { ...v, title: tempTitleText.trim() } : v);
      setVideos(updatedVideos);
    }
    setEditingTitleId(null);
  };

  useEffect(() => {
    if (highlightedCommentId) {
      const el = document.getElementById(`comment-${highlightedCommentId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [highlightedCommentId]);

  const saveCloudDatabaseDirect = async (vList, dMap, cList, bList) => {
    if (!isDbLoaded || isInitialLoadRef.current) return;
    setIsSyncing(true);
    
    const targetVideos = vList || videos;
    const targetDrawings = dMap || drawings;
    const targetComments = cList || comments;
    const targetBrands = bList || brands;

    try {
      localStorage.setItem('frameflow_videos', JSON.stringify(targetVideos));
      localStorage.setItem('frameflow_drawings', JSON.stringify(targetDrawings));
      localStorage.setItem('frameflow_comments', JSON.stringify(targetComments));
      localStorage.setItem('frameflow_brands', JSON.stringify(targetBrands));
    } catch (e) {}

    try {
      await fetch('/api/db', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videos: targetVideos,
          drawings: targetDrawings,
          comments: targetComments,
          brands: targetBrands
        })
      });
    } catch (err) {
      console.error("Failed to sync database:", err);
    } finally {
      setTimeout(() => setIsSyncing(false), 300);
    }
  };

  useEffect(() => {
    const fetchAllBunnyCloudAssets = async () => {
      setIsSyncing(true);
      try {
        let cloudDb = { videos: [], drawings: {}, comments: [], brands: [] };
        try {
          const res = await fetch('/api/db');
          if (res.ok) {
            cloudDb = await res.json();
          }
        } catch (e) {
          console.warn("Reading fresh database layout...");
        }

        let localDb = { videos: [], drawings: {}, comments: [], brands: [] };
        try {
          localDb.videos = JSON.parse(localStorage.getItem('frameflow_videos') || '[]');
          localDb.drawings = JSON.parse(localStorage.getItem('frameflow_drawings') || '{}');
          localDb.comments = JSON.parse(localStorage.getItem('frameflow_comments') || '[]');
          localDb.brands = JSON.parse(localStorage.getItem('frameflow_brands') || '[]');
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

        const mergedBrands = Array.from(new Set([
          ...INITIAL_BRANDS,
          ...(cloudDb.brands || []),
          ...(localDb.brands || [])
        ]));

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

        const bunnyVideoMap = new Map();
        bunnyFiles.forEach(file => {
          const filename = file.ObjectName;
          const publicUrl = `${BUNNY_PULL_ZONE_URL.replace(/\/$/, '')}/${filename}`;
          const id = getDeterministicId(filename);
          const meta = metaMap.get(id);

          let cleanTitle = filename
            .replace(/^\d+_\s*/, '')
            .replace(/\.[^/.]+$/, "")
            .replace(/_/g, ' ');

          bunnyVideoMap.set(id, {
            id: id,
            title: meta?.title || cleanTitle || filename,
            brand: meta?.brand || 'Thrive',
            url: meta?.url || publicUrl,
            status: meta?.status || 'In Review',
            createdAt: meta?.createdAt || file.LastChanged || new Date().toISOString(),
            duration: meta?.duration || 30
          });
        });

        const mergedVideoList = [];
        if (cloudDb.videos && Array.isArray(cloudDb.videos)) {
          cloudDb.videos.forEach(cv => {
            const normId = getDeterministicId(cv.id || cv.url);
            if (normId && bunnyVideoMap.has(normId)) {
              mergedVideoList.push(bunnyVideoMap.get(normId));
              bunnyVideoMap.delete(normId);
            }
          });
        }
        bunnyVideoMap.forEach(v => mergedVideoList.push(v));

        setBrands(mergedBrands);
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

  useEffect(() => {
    if (!isDbLoaded) return;

    const liveSyncInterval = setInterval(async () => {
      if (isSyncing || (Date.now() - lastUserActionRef.current < 4000)) return;

      try {
        const res = await fetch('/api/db');
        if (res.ok) {
          const cloudDb = await res.json();
          let stateUpdated = false;

          if (cloudDb.brands && Array.isArray(cloudDb.brands)) {
            setBrands(prevBrands => {
              const merged = Array.from(new Set([...prevBrands, ...cloudDb.brands]));
              if (JSON.stringify(prevBrands) !== JSON.stringify(merged)) {
                stateUpdated = true;
                return merged;
              }
              return prevBrands;
            });
          }

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
              const cloudVidMap = new Map();
              cloudDb.videos.forEach(cv => {
                const normId = getDeterministicId(cv.id || cv.url);
                if (normId) cloudVidMap.set(normId, cv);
              });

              const cloudIds = Array.from(cloudVidMap.keys());
              const prevIds = prevVideos.map(v => v.id);

              let isDifferent = cloudIds.length !== prevIds.length || cloudIds.some((id, idx) => id !== prevIds[idx]);

              if (!isDifferent) {
                isDifferent = prevVideos.some(v => {
                  const cv = cloudVidMap.get(v.id);
                  return cv && (v.title !== cv.title || v.brand !== cv.brand || v.status !== cv.status || v.url !== cv.url);
                });
              }

              if (isDifferent) {
                stateUpdated = true;
                const updatedList = [];
                cloudVidMap.forEach((cv, normId) => {
                  const existing = prevVideos.find(pv => pv.id === normId);
                  updatedList.push({
                    id: normId,
                    title: cv.title || existing?.title || 'Untitled Video',
                    brand: cv.brand || existing?.brand || 'Thrive',
                    url: cv.url || existing?.url,
                    status: cv.status || existing?.status || 'In Review',
                    createdAt: cv.createdAt || existing?.createdAt || new Date().toISOString(),
                    duration: cv.duration || existing?.duration || 30
                  });
                });
                prevVideos.forEach(pv => {
                  if (!cloudVidMap.has(pv.id)) {
                    updatedList.push(pv);
                  }
                });
                return updatedList;
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

  useEffect(() => {
    if (!isDbLoaded || isInitialLoadRef.current) return;

    if (isRemoteSyncRef.current) {
      isRemoteSyncRef.current = false;
      return;
    }

    const debounceSync = setTimeout(() => {
      saveCloudDatabaseDirect(videos, drawings, comments, brands);
    }, 300);

    return () => clearTimeout(debounceSync);
  }, [videos, drawings, comments, brands, isDbLoaded]);

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

  useEffect(() => {
    if (currentView === 'review' && activeVideoId) {
      const newUrl = `${window.location.pathname}?v=${encodeURIComponent(activeVideoId)}`;
      window.history.replaceState(null, '', newUrl);
    } else if (currentView === 'dashboard') {
      initialVideoParamRef.current = null;
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [currentView, activeVideoId]);

  const handleDeleteVideo = async (videoIdToDelete, e) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;

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

      lastUserActionRef.current = Date.now();
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

      setIsSyncing(false);
    }
  };

  const handleUpdateStatus = (status) => {
    lastUserActionRef.current = Date.now();
    let updatedVideos;
    if (status === 'Changes Requested') {
      updatedVideos = moveVideoToTopWithStatus(videos, activeVideoId, status);
    } else {
      updatedVideos = videos.map(v => v.id === activeVideoId ? { ...v, status } : v);
    }
    setVideos(updatedVideos);
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

    if (window.parent) {
      window.parent.postMessage({
        type: 'SEEK_PREMIERE_TIMELINE',
        seconds: time
      }, '*');
    }
  };

  const handlePinpointClick = (comment, e) => {
    if (e) e.stopPropagation();
    jumpToTime(comment.timestamp);
    setHighlightedCommentId(comment.id);
  };

  const handleCommentCardClick = (comment) => {
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
      return new Date(a.createdAt || 0) - new Date(a.createdAt || 0);
    }
    return 0;
  });

  const activeFramePins = filteredComments.filter(c => 
    c.pinLocation && 
    !isPlaying && 
    Math.abs(c.timestamp - currentTime) < 0.25
  );

  const filteredVideos = videos.filter(v => {
    const matchesBrand = selectedBrand === 'All' || v.brand === selectedBrand;
    const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesBrand && matchesSearch;
  });

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* 🚨 FORCED CSS OVERRIDES FOR ADOBE CEP CHROMIUM EMBEDDED PANELS 🚨 */}
      <style>{`
        body, div, span, p, label, select, input, button {
          color-scheme: dark !important;
        }
        .cep-bright-label {
          color: #F8FAFC !important;
        }
        .cep-subtext {
          color: #CBD5E1 !important;
        }
        select, input {
          color: #FFFFFF !important;
          background-color: #1E293B !important;
        }
        select option {
          background-color: #0F172A !important;
          color: #FFFFFF !important;
        }
        input::placeholder {
          color: #94A3B8 !important;
          opacity: 1 !important;
        }
      `}</style>
      
      {/* GLOBAL SIDEBAR */}
      <div className="w-full md:w-60 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between flex-shrink-0 z-30">
        <div>
          <div className="p-3 md:p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-xl text-white font-bold text-base md:text-lg shadow-lg shadow-indigo-950">FF</div>
              <div>
                <div className="font-bold text-sm md:text-base tracking-wide text-white leading-none">FrameFlow</div>
                <div className="text-[10px] cep-subtext mt-1 font-semibold">Video Studio Pro</div>
              </div>
            </div>

            <div className="text-slate-200" title={isSyncing ? "Syncing..." : "Live Relay Active"}>
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
                  : 'text-slate-200 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Home size={15} /> Home
            </button>
          </div>

          {/* 📂 BRAND WORKSPACE & ADMIN FOLDER MANAGEMENT */}
          <div className="px-3 py-2 md:px-4 md:py-3 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] md:text-[11px] font-bold text-white uppercase tracking-wider block cep-bright-label">Brand Workspace</label>
              
              {isAdmin && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsAddFolderModalOpen(true)}
                    title="Add New Brand Folder"
                    className="text-xs text-indigo-300 hover:text-indigo-200 flex items-center gap-0.5 hover:bg-slate-800 px-1.5 py-0.5 rounded transition font-bold"
                  >
                    <FolderPlus size={13} /> <span className="text-[10px]">+ Folder</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <select 
                value={selectedBrand} 
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 text-white font-semibold text-[16px] md:text-xs rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="All">All Concepts ({videos.length})</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>

              {isAdmin && selectedBrand !== 'All' && (
                <button
                  onClick={() => {
                    setRenameFolderTextTarget(selectedBrand);
                    setRenameFolderInput(selectedBrand);
                    setIsRenameFolderModalOpen(true);
                  }}
                  title={`Rename "${selectedBrand}" Folder`}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
                >
                  <Edit3 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* SIDEBAR BUTTONS */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          {user ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  {user.picture ? (
                    <img src={user.picture} alt={user.name} className="w-7 h-7 rounded-full border border-indigo-400 flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                      {user.name.charAt(0)}
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-white truncate">{user.name}</div>
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                      <ShieldCheck size={11} /> Admin Active
                    </div>
                  </div>
                </div>
                <button 
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="text-slate-300 hover:text-red-400 p-1 rounded hover:bg-slate-700 transition flex-shrink-0"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-indigo-200 font-bold py-2 px-3 rounded-lg border border-slate-700 text-xs transition"
            >
              <LogIn size={14} /> Admin Sign-In
            </button>
          )}

          {/* 🎬 PREMIERE RENDER BUTTON */}
          {isPremiereEnv && (
            <button
              onClick={() => setIsRenderModalOpen(true)}
              className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wide transition shadow-xl shadow-purple-950/80 border border-purple-400/40"
              title="Render active sequence directly from Premiere Pro timeline"
            >
              <Clapperboard size={18} /> Render Premiere Timeline
            </button>
          )}

          <button 
            onClick={() => {
              if (!isAdmin) {
                setIsLoginModalOpen(true);
              } else {
                setIsUploadOpen(true);
              }
            }}
            className={`w-full flex items-center justify-center gap-2 font-bold py-2.5 px-4 rounded-lg transition text-xs shadow-lg ${
              isAdmin 
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950' 
                : 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            {isAdmin ? <Plus size={16} /> : <Lock size={14} />} Upload Asset
          </button>
        </div>
      </div>

      {/* VIEW 1: DASHBOARD HUB */}
      {currentView === 'dashboard' && (
        <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950">
          
          <div className="h-auto md:h-16 border-b border-slate-800 p-3 md:px-8 flex flex-col sm:flex-row items-center justify-between bg-slate-900 sticky top-0 backdrop-blur z-20 gap-2 sm:gap-4">
            <div className="flex items-center gap-2 w-full max-w-lg">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                <input 
                  type="text" 
                  placeholder="Search videos, brands..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-[16px] md:text-xs text-white placeholder-slate-300 focus:outline-none focus:border-indigo-500 transition font-medium"
                />
              </div>

              <select 
                value={selectedBrand} 
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-indigo-200 text-[16px] md:text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-indigo-500 cursor-pointer font-bold"
              >
                <option value="All">All Folders</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <button 
              onClick={() => {
                if (!isAdmin) {
                  setIsLoginModalOpen(true);
                } else {
                  setIsUploadOpen(true);
                }
              }}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 text-xs font-bold py-2 px-4 rounded-xl transition shadow-md whitespace-nowrap ${
                isAdmin 
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white' 
                  : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {isAdmin ? <Plus size={16} /> : <Lock size={14} />} Upload
            </button>
          </div>

          <div className="p-3 md:p-8 max-w-7xl mx-auto w-full space-y-4">
            
            {showUpdateBanner && (
              <div className="bg-indigo-950 border border-indigo-500/60 rounded-xl p-3 flex items-start justify-between gap-3 text-xs shadow-lg relative overflow-hidden">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 bg-indigo-600 rounded-lg text-white flex-shrink-0 mt-0.5 shadow-md">
                    <Sparkles size={14} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-xs">{LATEST_APP_UPDATE.title}</span>
                      <span className="bg-indigo-600 text-white text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold">{LATEST_APP_UPDATE.version}</span>
                    </div>
                    <p className="text-slate-200 mt-0.5 text-[11px] leading-relaxed font-medium">
                      {LATEST_APP_UPDATE.description}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowUpdateBanner(false)}
                  className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-indigo-900 transition flex-shrink-0"
                  title="Dismiss Announcement"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-white tracking-wide uppercase">Recents</h2>
                <span className="text-[11px] text-slate-300 font-bold">{filteredVideos.length} Assets</span>
              </div>

              {filteredVideos.length === 0 ? (
                <div className="p-8 border border-dashed border-slate-700 rounded-2xl text-center text-slate-300 text-xs font-semibold">
                  No assets found in Bunny CDN. Click Upload to add your first video!
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {filteredVideos.map((vid) => (
                    <div 
                      key={vid.id}
                      onClick={() => openVideoReview(vid.id)}
                      className="group bg-slate-900 border border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:border-indigo-500/50 transition hover:shadow-xl hover:shadow-indigo-950/30 relative flex flex-col"
                    >
                      <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center pointer-events-none">
                        <video 
                          key={vid.url}
                          src={`${vid.url}#t=0.5`} 
                          playsInline 
                          preload="metadata"
                          crossOrigin="anonymous"
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300 pointer-events-none" 
                        />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition pointer-events-none" />
                        
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition pointer-events-none">
                          <div className="p-2 bg-indigo-600 rounded-full text-white shadow-lg pointer-events-none">
                            <Play size={16} fill="white" />
                          </div>
                        </div>

                        <div className="absolute bottom-1.5 right-1.5 bg-black/80 px-1 py-0.5 rounded text-[9px] font-mono text-white font-bold pointer-events-none">
                          {formatTime(vid.duration)}
                        </div>

                        <div className="absolute top-1.5 left-1.5 pointer-events-none">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shadow ${
                            vid.status === 'Approved' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                            vid.status === 'Changes Requested' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                            'bg-indigo-950 text-indigo-300 border border-indigo-800'
                          }`}>
                            {vid.status}
                          </span>
                        </div>
                      </div>

                      <div className="p-2 flex items-start justify-between gap-1.5">
                        <div className="overflow-hidden flex-1">
                          {editingTitleId === vid.id && isAdmin ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="text" 
                                value={tempTitleText} 
                                onChange={(e) => setTempTitleText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && saveRenameVideo(vid.id, e)}
                                autoFocus
                                className="w-full bg-slate-800 border border-indigo-500 rounded text-[11px] px-1 py-0.5 text-white font-bold focus:outline-none"
                              />
                              <button onClick={(e) => saveRenameVideo(vid.id, e)} className="text-emerald-400 p-0.5 hover:bg-slate-800 rounded">
                                <Check size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group/title">
                              <div className="font-bold text-[11px] text-white truncate group-hover:text-indigo-300 transition">
                                {vid.title}
                              </div>
                              {isAdmin && (
                                <button 
                                  onClick={(e) => startRenameVideo(vid.id, vid.title, e)} 
                                  title="Rename Video"
                                  className="opacity-0 group-hover/title:opacity-100 text-slate-300 hover:text-white transition p-0.5"
                                >
                                  <Pencil size={10} />
                                </button>
                              )}
                            </div>
                          )}

                          <div className="mt-0.5 flex items-center gap-1 flex-wrap">
                            <select
                              value={vid.brand}
                              disabled={!isAdmin}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              onChange={(e) => handleUpdateBrand(vid.id, e.target.value, e)}
                              className={`text-[9px] bg-slate-800 border border-slate-700 text-indigo-200 rounded px-1 py-0.5 focus:outline-none font-bold ${
                                isAdmin ? 'cursor-pointer hover:bg-slate-700' : 'cursor-not-allowed opacity-80'
                              }`}
                            >
                              {brands.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button 
                            onClick={(e) => handleCopyLink(vid.id, e)}
                            title="Copy Link"
                            className="text-slate-300 hover:text-white p-1 rounded hover:bg-slate-800 transition"
                          >
                            <Share2 size={12} />
                          </button>
                          
                          {isAdmin && (
                            <button 
                              onClick={(e) => handleDeleteVideo(vid.id, e)}
                              title="Delete Asset"
                              className="text-slate-300 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
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
            <div className="p-3 lg:px-6 lg:py-3 border-b border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button 
                  onClick={() => setCurrentView('dashboard')}
                  className="flex items-center gap-1.5 text-xs text-white font-bold bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition shadow"
                >
                  <ArrowLeft size={14} /> Back
                </button>

                <button 
                  onClick={() => setCurrentView('dashboard')}
                  className="flex items-center gap-1.5 text-xs text-slate-200 hover:text-white font-semibold bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700 transition"
                >
                  <Home size={14} /> Home
                </button>
                
                <div className="flex items-center gap-2 ml-1">
                  <h1 
                    onClick={(e) => startRenameVideo(activeVideoId, activeVideo.title, e)}
                    className={`text-xs md:text-sm font-bold text-white transition truncate max-w-[160px] md:max-w-xs ${
                      isAdmin ? 'hover:text-indigo-300 cursor-pointer' : ''
                    }`}
                    title={isAdmin ? "Click to rename" : "Asset Title"}
                  >
                    {activeVideo?.title}
                  </h1>

                  <select
                    value={activeVideo?.brand || 'Thrive'}
                    disabled={!isAdmin}
                    onChange={(e) => handleUpdateBrand(activeVideoId, e.target.value, e)}
                    className={`text-[16px] md:text-[11px] bg-slate-800 border border-slate-700 text-indigo-200 rounded-lg px-2 py-1 focus:outline-none font-bold ${
                      isAdmin ? 'cursor-pointer hover:bg-slate-700' : 'cursor-not-allowed opacity-80'
                    }`}
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
                      className={`px-2 py-1 rounded font-bold transition ${
                        activeVideo?.status === status 
                          ? status === 'Approved' ? 'bg-emerald-600 text-white' 
                            : status === 'Changes Requested' ? 'bg-amber-600 text-white' 
                            : 'bg-indigo-600 text-white'
                          : 'text-slate-200 hover:text-white'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={(e) => handleCopyLink(activeVideoId, e)}
                  className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-1.5 px-2.5 rounded-lg border border-slate-700 transition"
                >
                  {copiedStatus ? (
                    <>
                      <Check size={12} className="text-emerald-400" /> <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={12} /> Share
                    </>
                  )}
                </button>

                <button 
                  onClick={handleDownloadVideo}
                  disabled={isDownloading}
                  className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-1.5 px-2.5 rounded-lg border border-slate-700 transition disabled:opacity-50"
                  title="Direct Video Download"
                >
                  {isDownloading ? (
                    <Loader2 size={12} className="animate-spin text-indigo-400" />
                  ) : (
                    <Download size={12} />
                  )}
                </button>

                {isAdmin && (
                  <button 
                    onClick={() => {
                      setNewVideoTitle(activeVideo?.title || '');
                      setNewVideoUrl('');
                      setUploadedFileName('');
                      setIsReplaceOpen(true);
                    }}
                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-1.5 px-2.5 rounded-lg border border-slate-700 transition"
                  >
                    <RotateCcw size={12} /> Replace
                  </button>
                )}

                {/* 🗑️ EXPLICIT DELETE VIDEO BUTTON */}
                {isAdmin && (
                  <button 
                    onClick={(e) => handleDeleteVideo(activeVideoId, e)}
                    className="flex items-center gap-1 bg-red-900 hover:bg-red-800 text-red-100 border border-red-700 text-xs font-bold py-1.5 px-3 rounded-lg transition shadow"
                    title="Delete Video Asset"
                  >
                    <Trash2 size={13} /> Delete Video
                  </button>
                )}

                <button 
                  onClick={generateAiActionPlan}
                  className="flex items-center gap-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold py-1.5 px-2.5 rounded-lg transition shadow"
                >
                  <Sparkles size={12} /> AI
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center p-3 md:p-6 bg-slate-950 relative overflow-hidden min-h-[50vh]">
              <div 
                className="relative aspect-video w-full max-w-5xl min-h-[280px] bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center cursor-crosshair"
                onClick={handleCanvasClick}
              >
                {/* ⏳ STREAM LOADING OVERLAY */}
                {isVideoProcessing && (
                  <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <Loader2 size={36} className="animate-spin text-indigo-500" />
                    <div className="font-bold text-white text-sm">Processing & Syncing Video Stream...</div>
                    <div className="text-slate-400 text-xs max-w-xs leading-relaxed">
                      Decoding media stream...
                    </div>
                  </div>
                )}

                <video
                  key={activeVideo?.url}
                  ref={videoRef}
                  src={activeVideo?.url}
                  playsInline
                  preload="auto"
                  crossOrigin="anonymous"
                  className="w-full h-full object-contain"
                  onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                  onLoadedData={() => {
                    setIsVideoProcessing(false);
                  }}
                  onLoadedMetadata={() => {
                    setDuration(videoRef.current?.duration || 0);
                    setIsVideoProcessing(false);
                  }}
                  onCanPlay={() => setIsVideoProcessing(false)}
                  onPlay={() => {
                    setIsPlaying(true);
                    setActivePin(null);
                  }}
                  onPause={() => setIsPlaying(false)}
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

                {!isDrawingMode && activeFramePins.map(pinComment => (
                  <div
                    key={pinComment.id}
                    onClick={(e) => handlePinpointClick(pinComment, e)}
                    style={{
                      left: `${pinComment.pinLocation.x}%`,
                      top: `${pinComment.pinLocation.y}%`
                    }}
                    className={`absolute z-30 transform -translate-x-1/2 -translate-y-1/2 transition-all cursor-pointer group ${
                      highlightedCommentId === pinComment.id ? 'scale-125 z-40' : 'hover:scale-110'
                    }`}
                  >
                    <div className={`p-2 rounded-full shadow-2xl border flex items-center justify-center ${
                      highlightedCommentId === pinComment.id 
                        ? 'bg-indigo-600 text-white border-white ring-4 ring-indigo-500/50 animate-pulse' 
                        : 'bg-slate-900 text-indigo-300 border-indigo-500'
                    }`}>
                      <MapPin size={18} fill="currentColor" />
                    </div>
                  </div>
                ))}

                {activePin && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      left: `${activePin.xPercent}%`,
                      top: `${activePin.yPercent}%`,
                      transform: 'translate(-10%, -50%)'
                    }}
                    className="absolute z-40 max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-indigo-600 rounded-md text-white">
                          <MapPin size={14} />
                        </div>
                        <span className="font-mono bg-indigo-950 text-indigo-200 border border-indigo-800 px-2 py-0.5 rounded-full font-bold text-[10px]">
                          {activePin.timeFormatted}
                        </span>
                        <span className="text-white font-bold text-[11px] truncate max-w-[100px]">{authorName}</span>
                      </div>
                      <button 
                        onClick={() => setActivePin(null)} 
                        className="text-slate-300 hover:text-white p-0.5 rounded hover:bg-slate-800 transition"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <form onSubmit={handlePostInlinePinComment} className="space-y-2">
                      <input 
                        type="text" 
                        autoFocus
                        placeholder="Add a note..." 
                        value={inlinePinText}
                        onChange={(e) => setInlinePinText(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-[16px] md:text-xs text-white placeholder-slate-300 focus:outline-none focus:border-indigo-500 font-medium"
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <button 
                          type="button" 
                          onClick={() => setActivePin(null)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold transition"
                        >
                          Cancel
                        </button>
                        <button 
                          type="submit" 
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[11px] shadow transition"
                        >
                          Post
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                <div 
                  onClick={(e) => e.stopPropagation()} 
                  className="absolute top-3 left-3 flex items-center gap-1.5 bg-slate-900 border border-slate-700 p-1.5 rounded-lg shadow-lg z-20"
                >
                  <button
                    onClick={() => setIsDrawingMode(!isDrawingMode)}
                    className={`p-1.5 rounded transition ${
                      isDrawingMode ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:text-white'
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
                        className="p-1.5 text-slate-200 hover:text-white hover:bg-slate-800 rounded transition"
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
                            strokeWidth === w ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:text-white bg-slate-800'
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
                            ? 'ring-2 ring-white scale-150 z-40 bg-white border-indigo-600 shadow-lg' 
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
                      onClick={togglePlayPlayback}
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition cursor-pointer"
                    >
                      {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                    </button>

                    <div className="font-mono text-white text-[11px] font-bold">
                      <span>{formatTime(currentTime)}</span> / <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => setIsMuted(!isMuted)}
                    className="text-slate-200 hover:text-white"
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
                  <ArrowUpDown size={12} className="text-slate-300" />
                  <select
                    value={commentSort}
                    onChange={(e) => setCommentSort(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-indigo-300 text-[16px] md:text-[10px] font-bold rounded px-1.5 py-0.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="timestamp">Timecode</option>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
              </div>

              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-[10px] font-bold">
                <button
                  onClick={() => setCommentFilter('unresolved')}
                  className={`flex-1 py-1 rounded transition text-center ${
                    commentFilter === 'unresolved' ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:text-white'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setCommentFilter('resolved')}
                  className={`flex-1 py-1 rounded transition text-center ${
                    commentFilter === 'resolved' ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:text-white'
                  }`}
                >
                  Resolved ({allVideoComments.filter(c => c.completed).length})
                </button>
                <button
                  onClick={() => setCommentFilter('all')}
                  className={`flex-1 py-1 rounded transition text-center ${
                    commentFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:text-white'
                  }`}
                >
                  All ({allVideoComments.length})
                </button>
              </div>
            </div>

            <form onSubmit={handleAddComment} className="p-3 border-b border-slate-800 space-y-2 bg-slate-900">
              <input 
                type="text" 
                placeholder="Your Name"
                value={authorName}
                onChange={(e) => handleAuthorNameChange(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-[16px] md:text-xs rounded-lg p-2 text-white font-medium focus:outline-none focus:border-indigo-500"
              />
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Add feedback at frame..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 text-[16px] md:text-xs rounded-lg p-2 text-white font-medium focus:outline-none focus:border-indigo-500"
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
                <div className="text-center py-8 text-slate-300 text-xs font-semibold">
                  {commentFilter === 'resolved' 
                    ? 'No resolved comments yet.' 
                    : 'No active comments. Add feedback above, click video screen, or draw!'}
                </div>
              ) : (
                sortedComments.map(c => {
                  const isHighlighted = highlightedCommentId === c.id;
                  return (
                    <div 
                      key={c.id} 
                      id={`comment-${c.id}`}
                      onClick={() => handleCommentCardClick(c)}
                      className={`p-2.5 rounded-lg border transition-all duration-300 cursor-pointer ${
                        isHighlighted
                          ? 'bg-indigo-900 border-indigo-400 ring-2 ring-indigo-500 shadow-lg scale-[1.02]'
                          : c.completed 
                          ? 'bg-slate-900/80 border-slate-800 opacity-60' 
                          : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-indigo-300">{c.author}</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            jumpToTime(c.timestamp);
                          }}
                          className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-white font-bold hover:bg-indigo-600 transition"
                        >
                          {c.timeFormatted}
                        </button>
                      </div>
                      <p className="text-xs text-white font-medium">{c.text}</p>
                      
                      {c.hasDrawing && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-300 bg-amber-950 border border-amber-800 px-2 py-0.5 rounded-md w-fit font-bold">
                          <Pencil size={11} /> Drawing Markup Attached
                        </div>
                      )}

                      {c.pinLocation && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-indigo-200 bg-indigo-950 border border-indigo-800 px-2 py-0.5 rounded-md w-fit font-bold">
                          <MapPin size={11} /> Spatial Pinpoint Attached
                        </div>
                      )}

                      <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-slate-700">
                        <button 
                          onClick={(e) => toggleCommentComplete(c.id, e)}
                          className={`flex items-center gap-1 text-[10px] font-bold transition ${
                            c.completed ? 'text-emerald-400' : 'text-slate-200 hover:text-white'
                          }`}
                        >
                          <Check size={11} /> {c.completed ? 'Resolved' : 'Mark Resolved'}
                        </button>

                        <button 
                          onClick={(e) => handleDeleteComment(c.id, e)}
                          className="flex items-center gap-1 text-[10px] font-bold text-slate-300 hover:text-red-400 transition"
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

      {/* 🎬 PREMIERE RENDER SETTINGS MODAL */}
      {isRenderModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Sliders size={16} className="text-purple-400" /> Export Premiere Timeline
              </h3>
              <button onClick={() => setIsRenderModalOpen(false)} className="text-slate-300 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleStartPremiereRenderSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-white font-bold mb-1.5">Export Range</label>
                <select 
                  value={exportRange} 
                  onChange={(e) => setExportRange(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white font-bold rounded-lg p-2.5 focus:outline-none focus:border-purple-500"
                >
                  <option value="1">In to Out Range (Work Area)</option>
                  <option value="0">Entire Sequence</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsRenderModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-white font-bold rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-lg shadow-lg"
                >
                  Start Export & Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔐 AUTHENTICATION MODAL */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <ShieldCheck size={16} className="text-indigo-400" /> Admin Authentication
              </h3>
              <button onClick={() => setIsLoginModalOpen(false)} className="text-slate-300 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-100 font-medium leading-relaxed">
              Sign in with an authorized account to upload videos, delete assets, or create/rename project folders.
            </p>

            {GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes("YOUR_GOOGLE_CLIENT_ID") && (
              <div className="py-1 flex justify-center min-h-[44px]">
                <div id="googleSignInBtnModal"></div>
              </div>
            )}

            <form onSubmit={handleManualEmailLogin} className="space-y-3 text-left bg-slate-950 p-4 border border-slate-800 rounded-xl">
              <div>
                <label className="text-[10px] text-white font-bold uppercase block mb-1.5">Authorized Email Address</label>
                <input 
                  type="email" 
                  placeholder="e.g. jhorsch@thriverg.com"
                  value={manualEmailInput}
                  onChange={(e) => setManualEmailInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-300 font-medium text-xs rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-white font-bold uppercase block mb-1.5 flex items-center gap-1">
                  <KeyRound size={11} className="text-indigo-400" /> Admin Password
                </label>
                <input 
                  type="password" 
                  placeholder="Enter Password"
                  value={manualPasswordInput}
                  onChange={(e) => setManualPasswordInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-300 font-bold text-xs rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition shadow-md mt-1"
              >
                Sign In as Admin
              </button>
            </form>

            <button 
              onClick={() => setIsLoginModalOpen(false)}
              className="w-full py-1.5 text-slate-200 hover:text-white text-[11px] font-bold transition"
            >
              Continue as Guest Reviewer
            </button>
          </div>
        </div>
      )}

      {/* 📂 ADD BRAND FOLDER MODAL */}
      {isAddFolderModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <FolderPlus size={16} className="text-indigo-400" /> Create Brand Folder
              </h3>
              <button onClick={() => setIsAddFolderModalOpen(false)} className="text-slate-300 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-4 text-xs">
              <div>
                <label className="block text-white font-bold mb-1.5">Folder / Brand Name</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  placeholder="e.g. Modern Market" 
                  value={newFolderNameInput}
                  onChange={(e) => setNewFolderNameInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white placeholder-slate-300 font-bold text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsAddFolderModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-white font-bold rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ RENAME BRAND FOLDER MODAL */}
      {isRenameFolderModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Edit3 size={16} className="text-indigo-400" /> Rename Folder
              </h3>
              <button onClick={() => setIsRenameFolderModalOpen(false)} className="text-slate-300 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRenameFolderSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-white font-bold mb-1.5">Rename "{renameFolderTarget}" To:</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  value={renameFolderInput}
                  onChange={(e) => setRenameFolderInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white font-bold text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsRenameFolderModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-white font-bold rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD MODAL */}
      {isUploadOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm">Upload New Video Asset</h3>
              <button onClick={() => setIsUploadOpen(false)} className="text-slate-300 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-white font-bold mb-1.5">Select File (Auto-Uploads to Bunny CDN)</label>
                <input 
                  type="file" 
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-medium text-[16px] md:text-xs"
                  disabled={isUploadingToCdn}
                />

                {isUploadingToCdn && (
                  <div className="space-y-1.5 mt-2.5">
                    <div className="flex items-center justify-between text-xs text-indigo-300 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Loader2 size={13} className="animate-spin text-indigo-400" /> Uploading to Bunny CDN...
                      </span>
                      <span className="font-mono text-white">{uploadProgress}%</span>
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
                <span className="flex-shrink mx-2 text-slate-300 text-[10px] uppercase font-bold">Or Paste Direct Web URL</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <div>
                <label className="block text-white font-bold mb-1.5">Direct Video URL (.mp4 / CDN Link)</label>
                <input 
                  type="text" 
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  placeholder="https://your-cdn-host.com/video.mp4"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white placeholder-slate-300 font-medium text-[16px] md:text-xs"
                />
              </div>

              <div>
                <label className="block text-white font-bold mb-1.5">Video Title</label>
                <input 
                  type="text" 
                  value={newVideoTitle}
                  onChange={(e) => setNewVideoTitle(e.target.value)}
                  placeholder="e.g. QDOBA_Summer_Campaign"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white placeholder-slate-300 font-medium text-[16px] md:text-xs"
                />
              </div>

              <div>
                <label className="block text-white font-bold mb-1.5">Brand Folder</label>
                <select 
                  value={newVideoBrand}
                  onChange={(e) => setNewVideoBrand(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-bold text-[16px] md:text-xs"
                >
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-white font-bold rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isUploadingToCdn}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold disabled:opacity-50"
                >
                  Add Video
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPLACE VIDEO MODAL */}
      {isReplaceOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm">Replace Video Asset</h3>
              <button onClick={() => setIsReplaceOpen(false)} className="text-slate-300 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReplaceSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-white font-bold mb-1.5">Upload New Cut File (Auto-Uploads to CDN)</label>
                <input 
                  type="file" 
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-medium text-[16px] md:text-xs"
                  disabled={isUploadingToCdn}
                />

                {isUploadingToCdn && (
                  <div className="space-y-1.5 mt-2.5">
                    <div className="flex items-center justify-between text-xs text-indigo-300 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Loader2 size={13} className="animate-spin text-indigo-400" /> Uploading new cut...
                      </span>
                      <span className="font-mono text-white">{uploadProgress}%</span>
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
                <span className="flex-shrink mx-2 text-slate-300 text-[10px] uppercase font-bold">Or Paste Direct Web URL</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <div>
                <label className="block text-white font-bold mb-1.5">Direct Video URL (.mp4 / CDN Link)</label>
                <input 
                  type="text" 
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  placeholder="https://your-cdn-host.com/video_v2.mp4"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white placeholder-slate-300 font-medium text-[16px] md:text-xs"
                />
              </div>

              <div>
                <label className="block text-white font-bold mb-1.5">Updated Title</label>
                <input 
                  type="text" 
                  value={newVideoTitle}
                  onChange={(e) => setNewVideoTitle(e.target.value)}
                  placeholder="Asset Title"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white placeholder-slate-300 font-medium text-[16px] md:text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsReplaceOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-white font-bold rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isUploadingToCdn}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold disabled:opacity-50"
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
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                <Sparkles size={16} className="text-indigo-400" /> AI Executive Revision Plan
              </h3>
              <button onClick={() => setIsAiModalOpen(false)} className="text-slate-300 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {isAiLoading ? (
              <div className="py-12 text-center text-white text-xs font-bold">Generating Action Plan...</div>
            ) : (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-100 whitespace-pre-line max-h-80 overflow-y-auto">
                {aiOutput}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold"
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