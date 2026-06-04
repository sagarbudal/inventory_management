import React, { useState, useEffect, useRef } from 'react';
import { 
  Film, PlusCircle, Download, Search, AlertCircle, CheckCircle, 
  UploadCloud, FileVideo, Folder, FolderClosed, FolderOpen, 
  ChevronDown, ChevronUp, FolderPlus, Trash2, X, Calendar, Move, Check, CheckSquare,
  Lock, Shield, Video, Layers
} from 'lucide-react';
import { Video as VideoType } from '../types';

interface VideoManagerProps {
  videos: VideoType[];
  onRefresh: () => void;
}

interface StagedVideo {
  id: string;
  name: string;
  unique_code: string;
  duration: number; // in minutes
  status: 'uploaded' | 'not uploaded';
  fileName: string;
  sub_category?: string;
  isDuplicate: boolean;
  duplicateAction: 'skip' | 'upload';
}

export default function VideoManager({ videos, onRefresh }: VideoManagerProps) {
  // Authentication validation
  const [currentUser, setCurrentUser] = useState<{ email: string; name: string; role: 'Admin' | 'Supervisor' | 'User' } | null>(() => {
    const raw = localStorage.getItem('currentUser');
    if (raw) {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return null;
  });

  const canDelete = currentUser?.role === 'Admin' || currentUser?.role === 'Supervisor';
  const canManage = canDelete;

  // Custom manual folders loaded from server
  const [customFoldersList, setCustomFoldersList] = useState<{ id: number; category: string; sub_category?: string }[]>([]);

  // Extract dynamical list of populated folders (including custom main folders)
  const existingFolders = Array.from(
    new Set([
      ...videos.map(v => v.category || 'Uploaded Files'),
      ...customFoldersList.map(f => f.category)
    ].filter(Boolean))
  );
  const folderOptions = existingFolders.length > 0 ? existingFolders : ['Uploaded Files', 'Campaigns', 'Social Media', 'Drafts'];

  // Extract dynamical list of populated sub-folders
  const existingSubFolders = Array.from(
    new Set([
      ...videos.map(v => v.sub_category || ''),
      ...customFoldersList.map(f => f.sub_category || '')
    ].filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  // Load custom manual folders from db.json
  const fetchCustomFolders = async () => {
    try {
      const res = await fetch('/api/custom-folders');
      if (res.ok) {
        const data = await res.json();
        setCustomFoldersList(data);
      }
    } catch (err) {
      console.error('Error fetching custom folders:', err);
    }
  };

  useEffect(() => {
    fetchCustomFolders();
  }, [videos]);

  // Staged Bulk Upload Queue State
  const [stagedVideos, setStagedVideos] = useState<StagedVideo[]>([]);

  // Destination subfolder decisions for Ingestion Hub
  const [subFolderChoice, setSubFolderChoice] = useState<'none' | 'existing' | 'new'>('none');
  const [selectedSubFolder, setSelectedSubFolder] = useState('');
  const [newSubFolder, setNewSubFolder] = useState('');
  const [bulkStatus, setBulkStatus] = useState<'uploaded' | 'not uploaded'>('uploaded');

  // Form State (for fallback / manual single-video entries)
  const [name, setName] = useState('');
  const [uniqueCode, setUniqueCode] = useState('');
  const [duration, setDuration] = useState(5.0);
  const [status, setStatus] = useState<'uploaded' | 'not uploaded'>('not uploaded');
  const [category, setCategory] = useState('Uploaded Files');
  const [subCategory, setSubCategory] = useState('');
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [customFolder, setCustomFolder] = useState('');

  // Manual folder structure adding states
  const [manualCategory, setManualCategory] = useState('');
  const [manualSubCategory, setManualSubCategory] = useState('');
  const [manualFolderType, setManualFolderType] = useState<'main' | 'sub'>('main');
  const [manualParentCategory, setManualParentCategory] = useState('');
  const [folderError, setFolderError] = useState<string | null>(null);
  const [folderSuccess, setFolderSuccess] = useState<string | null>(null);

  // Search/Filters logic
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Collapse/Expand toggles
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [collapsedSubFolders, setCollapsedSubFolders] = useState<Record<string, boolean>>({});

  // Multiple selection handlers
  const [selectedVideoIds, setSelectedVideoIds] = useState<number[]>([]);

  // Transfer Workspace Selection Form
  const [multiMoveCategory, setMultiMoveCategory] = useState('');
  const [multiMoveCustomCategory, setMultiMoveCustomCategory] = useState('');
  const [multiMoveCreateFolder, setMultiMoveCreateFolder] = useState(false);
  const [multiMoveSubCategory, setMultiMoveSubCategory] = useState('');
  const [multiMoveSubCategorySelect, setMultiMoveSubCategorySelect] = useState('');

  // Extract dynamical list of sub-folders belonging directly to the active category
  const effectiveCategory = isCreatingNewFolder ? customFolder.trim() : category;
  const subFoldersForCategory = Array.from(
    new Set([
      ...videos.filter(v => v.category === effectiveCategory).map(v => v.sub_category || ''),
      ...customFoldersList.filter(f => f.category === effectiveCategory).map(f => f.sub_category || '')
    ].filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto-dismiss notifications so they don't block the upload panel
  useEffect(() => {
    if (!successMsg && !errorMsg) return;
    const timer = setTimeout(() => {
      setSuccessMsg(null);
      setErrorMsg(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [successMsg, errorMsg]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Auto pre-population support
  useEffect(() => {
    if (existingFolders.length > 0 && !manualParentCategory) {
      setManualParentCategory(existingFolders[0]);
    }
  }, [existingFolders, manualParentCategory]);

  useEffect(() => {
    if (folderOptions.length > 0 && !folderOptions.includes(category)) {
      setCategory(folderOptions[0]);
    }
  }, [customFoldersList, videos]);

  // Handle auto-syncing subfolder choices when category changes
  useEffect(() => {
    setSelectedSubFolder('');
    const matchingSubs = Array.from(
      new Set([
        ...videos.filter(v => v.category === category).map(v => v.sub_category || ''),
        ...customFoldersList.filter(f => f.category === category).map(f => f.sub_category || '')
      ].filter(Boolean))
    );
    if (matchingSubs.length === 0 && subFolderChoice === 'existing') {
      setSubFolderChoice('none');
    }
  }, [category]);

  // Duration parser: converts floating-point minutes to HH:MM:SS format
  const formatHHMMSS = (totalMinutes: number): string => {
    if (isNaN(totalMinutes) || totalMinutes <= 0) return '00:00:00';
    const totalSeconds = Math.round(totalMinutes * 60);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const hh = hrs < 10 ? `0${hrs}` : `${hrs}`;
    const mm = mins < 10 ? `0${mins}` : `${mins}`;
    const ss = secs < 10 ? `0${secs}` : `${secs}`;
    return `${hh}:${mm}:${ss}`;
  };

  const parseVideoFile = (file: File): Promise<StagedVideo> => {
    return new Promise((resolve) => {
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const cleanPrefix = baseName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const generatedCode = `VID-${cleanPrefix || 'GEN'}-${randomSuffix}`;

      // Check client-side for duplicates on name or unique generation code prefix
      const isDuplicate = videos.some(v => 
        v.unique_code.toUpperCase() === generatedCode.toUpperCase() || 
        v.name.toLowerCase() === baseName.toLowerCase()
      );

      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      tempVideo.src = URL.createObjectURL(file);

      const fallback: StagedVideo = {
        id: Math.random().toString(36).substring(2, 11),
        name: baseName,
        unique_code: generatedCode,
        duration: 1.0,
        status: 'uploaded',
        fileName: file.name,
        sub_category: '',
        isDuplicate,
        duplicateAction: 'skip'
      };

      tempVideo.onloadedmetadata = () => {
        const calculatedDurationMin = tempVideo.duration / 60;
        const roundedVal = Math.round(calculatedDurationMin * 10) / 10 || 0.1;
        URL.revokeObjectURL(tempVideo.src);
        resolve({
          ...fallback,
          duration: roundedVal
        });
      };

      tempVideo.onerror = () => {
        URL.revokeObjectURL(tempVideo.src);
        resolve(fallback);
      };
    });
  };

  const processMultipleVideoFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const videoFiles = fileArray.filter(file => file.type.startsWith('video/'));

    if (videoFiles.length === 0) {
      setErrorMsg('Error: Selected files do not contain valid video formats.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const parsedItems = await Promise.all(videoFiles.map(file => parseVideoFile(file)));
      if (parsedItems.length === 1) {
        setName(parsedItems[0].name);
        setUniqueCode(parsedItems[0].unique_code);
        setDuration(parsedItems[0].duration);
        setStatus(parsedItems[0].status);
        if (parsedItems[0].isDuplicate) {
          setSuccessMsg(`⚠️ Staged video "${parsedItems[0].fileName}" matches an existing catalog model. Adjust below.`);
        } else {
          setSuccessMsg(`✓ Extracted metadata from: ${parsedItems[0].fileName}`);
        }
      } else {
        const dupCount = parsedItems.filter(p => p.isDuplicate).length;
        if (dupCount > 0) {
          setSuccessMsg(`✓ Parsed ${parsedItems.length} videos. Detected ${dupCount} potential duplicates. Set policies below.`);
        } else {
          setSuccessMsg(`✓ Parsed ${parsedItems.length} videos successfully into the Bulk Queue.`);
        }
      }
      setStagedVideos(prev => [...prev, ...parsedItems]);
    } catch (err) {
      setErrorMsg('Failed to process staging. Please verify files are correct.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processMultipleVideoFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processMultipleVideoFiles(e.target.files);
    }
  };

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const updateStagedItem = (id: string, updates: Partial<StagedVideo>) => {
    setStagedVideos(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeStagedItem = (id: string) => {
    setStagedVideos(prev => prev.filter(item => item.id !== id));
  };

  const clearStagedQueue = () => {
    setStagedVideos([]);
    setName('');
    setUniqueCode('');
    setDuration(5.0);
    setStatus('not uploaded');
    setBulkStatus('uploaded');
    setSubFolderChoice('none');
    setSelectedSubFolder('');
    setNewSubFolder('');
    setIsCreatingNewFolder(false);
    setCustomFolder('');
    setErrorMsg(null);
    setSuccessMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreateCustomFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFolderError(null);
    setFolderSuccess(null);

    const targetCategory = manualFolderType === 'main' ? manualCategory.trim() : manualParentCategory.trim();
    const targetSubCategory = manualFolderType === 'sub' ? manualSubCategory.trim() : '';

    if (!targetCategory) {
      setFolderError('Folder category name is required.');
      return;
    }

    try {
      const res = await fetch('/api/custom-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: targetCategory,
          sub_category: targetSubCategory
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register folder structure.');
      }
      setFolderSuccess(`✓ Registered folder path: "${targetCategory}${targetSubCategory ? ' ➔ ' + targetSubCategory : ''}"`);
      setManualCategory('');
      setManualSubCategory('');
      fetchCustomFolders();
      onRefresh();
    } catch (err: any) {
      setFolderError(err.message || 'An error occurred.');
    }
  };

  const handleDeleteCustomFolder = async (id: number) => {
    if (!canManage) {
      setFolderError('Permission Denied: Only Administrators and Supervisors can delete folder structures.');
      return;
    }
    setFolderError(null);
    setFolderSuccess(null);
    try {
      const res = await fetch(`/api/custom-folders/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove custom folder.');
      setFolderSuccess('✓ Custom folder reference removed.');
      fetchCustomFolders();
      onRefresh();
    } catch (err: any) {
      setFolderError(err.message || 'An error occurred.');
    }
  };

  // Submit manual single form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim() || !uniqueCode.trim()) {
      setErrorMsg('Please enter both Title and Code.');
      return;
    }

    const folderToSave = (isCreatingNewFolder ? customFolder : category)?.trim();
    if (!folderToSave) {
      setErrorMsg('Please select a folder workspace.');
      return;
    }

    setLoading(true);
    try {
      // Check if code duplicate
      const hasDupCode = videos.some(v => v.unique_code.toUpperCase() === uniqueCode.trim().toUpperCase());
      let finalCode = uniqueCode.trim().toUpperCase();
      if (hasDupCode) {
        // Auto suffix incremental index to keep backend unique key solid
        const sameBasenameCount = videos.filter(v => v.unique_code.toUpperCase().startsWith(finalCode)).length;
        finalCode = `${finalCode}-DUP-${sameBasenameCount + 1}`;
      }

      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          unique_code: finalCode,
          duration,
          status,
          category: folderToSave,
          sub_category: subCategory.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register video metadata.');

      setSuccessMsg(`✓ Successfully registered: "${data.name}" inside folder "${folderToSave}"`);
      setName('');
      setUniqueCode('');
      setDuration(5.0);
      setStatus('not uploaded');
      setSubCategory('');
      setCategory(folderToSave);
      setIsCreatingNewFolder(false);
      setCustomFolder('');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  // Submit staged multiple form
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (stagedVideos.length === 0) {
      setErrorMsg('No staged items in bulk queue.');
      return;
    }

    const folderToSave = (isCreatingNewFolder ? customFolder : category)?.trim();
    if (!folderToSave) {
      setErrorMsg('Please choose/create a Target Folder.');
      return;
    }

    let finalSubCategory = '';
    if (subFolderChoice === 'existing') {
      if (!selectedSubFolder.trim()) {
        setErrorMsg('Please select an existing sub-folder.');
        return;
      }
      finalSubCategory = selectedSubFolder.trim();
    } else if (subFolderChoice === 'new') {
      if (!newSubFolder.trim()) {
        setErrorMsg('Please enter a name for the new sub-folder.');
        return;
      }
      finalSubCategory = newSubFolder.trim();
    }

    // Verify properties
    const incompletedItem = stagedVideos.find(v => !v.name.trim() || !v.unique_code.trim());
    if (incompletedItem) {
      setErrorMsg(`Complete Title and Unique Code credentials for item "${incompletedItem.fileName}".`);
      return;
    }

    setLoading(true);
    let countSuccess = 0;
    try {
      for (let i = 0; i < stagedVideos.length; i++) {
        const item = stagedVideos[i];

        // Process Skip Policy for duplicates
        if (item.isDuplicate && item.duplicateAction === 'skip') {
          console.log(`Omitting repeated file path check: ${item.fileName}`);
          continue; // Seamlessly skip and CONTINUE remainings!
        }

        let assignedCode = item.unique_code.trim().toUpperCase();
        // Suffix to make sure database does not crash if they chose "upload duplicate" or "upload anyway"
        const alreadyExists = videos.some(v => v.unique_code.toUpperCase() === assignedCode);
        if (alreadyExists) {
          const matchingCount = videos.filter(v => v.unique_code.toUpperCase().startsWith(assignedCode)).length;
          assignedCode = `${assignedCode}-${matchingCount + 1}`;
        }

        const res = await fetch('/api/videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name.trim(),
            unique_code: assignedCode,
            duration: item.duration,
            status: bulkStatus,
            category: folderToSave,
            sub_category: finalSubCategory
          })
        });

        if (res.ok) {
          countSuccess++;
        } else {
          const errData = await res.json();
          throw new Error(errData.error || `Failed on bulk registry item "${item.name}"`);
        }
      }

      setSuccessMsg(`✓ Successfully registered ${countSuccess} cataloged videos inside Folder: "${folderToSave}"${finalSubCategory ? ' ➔ Sub-folder: "' + finalSubCategory + '"' : ''}!`);
      setStagedVideos([]);
      setIsCreatingNewFolder(false);
      setCustomFolder('');
      setSubFolderChoice('none');
      setSelectedSubFolder('');
      setNewSubFolder('');
      setBulkStatus('uploaded');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error executing batch pipeline write.');
    } finally {
      setLoading(false);
    }
  };

  // Batch moving selections
  const handleMultiTransfer = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const targetCategory = (multiMoveCreateFolder ? multiMoveCustomCategory : multiMoveCategory)?.trim();
    if (!targetCategory) {
      setErrorMsg('Please select a target category folder.');
      return;
    }

    setLoading(true);
    let movedCount = 0;
    try {
      for (const id of selectedVideoIds) {
        const currentVideo = videos.find(v => v.id === id);
        if (!currentVideo) continue;

        const res = await fetch(`/api/videos/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: targetCategory,
            sub_category: multiMoveSubCategory.trim() || (multiMoveSubCategorySelect === '__NEW_SUB__' ? '' : multiMoveSubCategorySelect)
          })
        });
        if (res.ok) movedCount++;
      }

      setSuccessMsg(`✓ Transferred ${movedCount} selected videos to "${targetCategory}"!`);
      setSelectedVideoIds([]);
      setMultiMoveCategory('');
      setMultiMoveCustomCategory('');
      setMultiMoveCreateFolder(false);
      setMultiMoveSubCategory('');
      setMultiMoveSubCategorySelect('');
      onRefresh();
    } catch (err) {
      setErrorMsg('Could not dispatch transfer routing.');
    } finally {
      setLoading(false);
    }
  };

  // Batch delete selections (Admin/Supervisor validation on frontend + backend)
  const handleBulkDelete = async () => {
    if (!canDelete) {
      setErrorMsg('Permission Denied: Only Administrators and Supervisors can delete videos.');
      return;
    }

    if (!window.confirm(`⚠️ WARNING: Are you sure you want to permanently delete all ${selectedVideoIds.length} selected videos? This is irreversible.`)) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/videos/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedVideoIds })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk delete request failed.');

      setSuccessMsg(`✓ Successfully deleted ${data.count || selectedVideoIds.length} videos from repository.`);
      setSelectedVideoIds([]);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during bulk deletion.');
    } finally {
      setLoading(false);
    }
  };

  // Filtering list
  const filteredVideos = videos.filter(v => {
    const q = searchTerm.toLowerCase();
    const matchesQuery = v.name.toLowerCase().includes(q) || v.unique_code.toLowerCase().includes(q);
    const matchesCategory = selectedCategory === 'All' || v.category === selectedCategory;
    const matchesStatus = selectedStatus === 'All' || v.status === selectedStatus;
    return matchesQuery && matchesCategory && matchesStatus;
  });

  // Calculate Metrics
  const totalVideosCount = videos.length;
  const filteredVideosCount = filteredVideos.length;
  
  // Folders map count
  const totalFoldersCount = folderOptions.length;
  
  // Total sub-folders count
  const totalSubfoldersCount = Array.from(new Set(videos.map(v => v.sub_category).filter(Boolean))).length;

  // Cumulative video durations
  const totalCumulativeDurationMins = videos.reduce((acc, v) => acc + v.duration, 0);

  // Group videos by category
  const foldersGrouped: Record<string, VideoType[]> = {};
  filteredVideos.forEach((v) => {
    const fn = v.category || 'Uploaded Files';
    if (!foldersGrouped[fn]) foldersGrouped[fn] = [];
    foldersGrouped[fn].push(v);
  });
  const groupedFolderNames = Object.keys(foldersGrouped).sort((a, b) => a.localeCompare(b));

  // XLS export mock wrapper
  const handleExportExcel = () => {
    handleExportVideos(filteredVideos, 'complete_filtered_catalog');
  };

  const handleExportVideos = (list: VideoType[], filename: string) => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Display Name,Unique Code,Duration (HH:MM:SS),Status,Category,Sub Category,Added At\n";

    list.forEach(v => {
      const durationFmt = formatHHMMSS(v.duration);
      const csvRow = `${v.id},"${v.name.replace(/"/g, '""')}","${v.unique_code}",${durationFmt},${v.status},"${v.category || 'N/A'}","${v.sub_category || ''}","${v.created_at || 'N/A'}"\n`;
      csvContent += csvRow;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CANTOR_DUST_${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderVideosTable = (vids: VideoType[]) => {
    const tableTotalDuration = vids.reduce((sum, v) => sum + v.duration, 0);

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-850/60 text-left text-xs md:text-sm">
          <thead className="bg-slate-950/40 text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <tr>
              <th scope="col" className="px-4 py-3 text-center w-12 border-b border-slate-800">
                <input
                  type="checkbox"
                  checked={vids.length > 0 && vids.every(v => selectedVideoIds.includes(v.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedVideoIds(prev => {
                        const otherIds = prev.filter(id => !vids.some(v => v.id === id));
                        return [...otherIds, ...vids.map(v => v.id)];
                      });
                    } else {
                      setSelectedVideoIds(prev => prev.filter(id => !vids.some(v => v.id === id)));
                    }
                  }}
                  className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
              </th>
              <th scope="col" className="px-4 py-3 border-b border-slate-800 text-slate-400">ID</th>
              <th scope="col" className="px-4 py-3 border-b border-slate-800 text-slate-400">Video Title</th>
              <th scope="col" className="px-4 py-3 border-b border-slate-800 text-slate-400">Unique Code</th>
              <th scope="col" className="px-4 py-3 border-b border-slate-800 text-slate-400">Duration (HH:MM:SS)</th>
              <th scope="col" className="px-4 py-3 border-b border-slate-800 text-slate-400 hidden md:table-cell">Added At</th>
              <th scope="col" className="px-4 py-3 text-center border-b border-slate-800 text-slate-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850/30 font-sans">
            {vids.map((vid) => {
              const isSelected = selectedVideoIds.includes(vid.id);
              return (
                <tr key={vid.id} className={`${isSelected ? 'bg-indigo-950/20' : 'hover:bg-slate-850/15'} transition-all`}>
                  {/* Row Checkbox selector */}
                  <td className="px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedVideoIds(prev => [...prev, vid.id]);
                        } else {
                          setSelectedVideoIds(prev => prev.filter(id => id !== vid.id));
                        }
                      }}
                      className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                  </td>

                  {/* ID */}
                  <td className="px-4 py-2.5 font-mono text-slate-500 text-[11px]">{vid.id}</td>

                  {/* Title */}
                  <td className="px-4 py-2.5 font-medium text-slate-100">{vid.name}</td>

                  {/* Code */}
                  <td className="px-4 py-2.5 font-mono text-slate-300">
                    <span className="bg-slate-950 border border-slate-800/80 px-2 py-0.5 rounded text-[10px] uppercase">
                      {vid.unique_code}
                    </span>
                  </td>

                  {/* Duration formatted as HH:MM:SS */}
                  <td className="px-4 py-2.5 font-mono text-slate-300 font-bold">{formatHHMMSS(vid.duration)}</td>

                  {/* Date hidden on mobile for visual ratio sizing */}
                  <td className="px-4 py-2.5 text-slate-500 font-mono text-[10px] hidden md:table-cell">
                    {vid.created_at ? new Date(vid.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                  </td>

                  {/* Status Indicator Badges */}
                  <td className="px-4 py-2.5 text-center">
                    {vid.status === 'uploaded' ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                        uploaded
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-wider">
                        not uploaded
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          
          {/* Table Footer total duration summary */}
          <tfoot className="bg-slate-950/20 text-[10px] md:text-xs">
            <tr>
              <td colSpan={3} className="px-4 py-2.5 text-slate-400 font-medium">
                Total Files in cohort: <strong className="text-slate-200">{vids.length}</strong>
              </td>
              <td colSpan={4} className="px-4 py-2.5 text-right font-mono text-slate-400">
                Segment Cumulative Duration: <strong className="text-indigo-400">{formatHHMMSS(tableTotalDuration)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6" id="video-manager-section">
      
      {/* SECTION B: CUMULATIVE TOP SUMMARY METRICS DISPLAY (Videos, folders, sub-folders, sum duration HH:MM:SS) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="video-overall-counter-cards">
        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-xl flex items-center gap-4 shadow shadow-slate-950/40">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Film className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest font-bold">Total Videos</span>
            <p className="text-xl font-extrabold text-white leading-tight">{totalVideosCount}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-xl flex items-center gap-4 shadow shadow-slate-950/40">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest font-bold">Total Folders</span>
            <p className="text-xl font-extrabold text-white leading-tight">{totalFoldersCount}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-xl flex items-center gap-4 shadow shadow-slate-950/40">
          <div className="p-3 bg-amber-500/10 text-amber-550 text-amber-500 rounded-lg">
            <Folder className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest font-bold">Sub-folders</span>
            <p className="text-xl font-extrabold text-white leading-tight">{totalSubfoldersCount}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-xl flex items-center gap-4 shadow shadow-slate-950/40">
          <div className="p-3 bg-indigo-500/10 text-indigo-405 text-indigo-400 rounded-lg">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest font-bold">Total Duration</span>
            <p className="text-base font-black text-indigo-300 leading-tight font-mono mt-0.5">{formatHHMMSS(totalCumulativeDurationMins)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b pb-4 border-slate-850">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Film className="h-6 w-6 text-indigo-400" />
            Video Repository & Directory
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Sign files to category folders, process duplicate staging logic, collapse sequences, and perform batch file operations.
          </p>
        </div>
        {videos.length > 0 && (
          <button
            onClick={handleExportExcel}
            className="mt-4 md:mt-0 inline-flex items-center gap-2 justify-center rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold px-4 py-2.5 transition-all cursor-pointer border border-slate-800"
            id="export-catalog-btn"
          >
            <Download className="h-4 w-4 text-indigo-400" />
            Export Filtered CSV
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: UPLOAD CONTROLS & MANUAL REGISTERS */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col relative">
            <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2 shrink-0">
              <UploadCloud className="h-5 w-5" />
              File Ingestion Hub
            </h3>

            {/* Floating toast — does not push form content down */}
            {(errorMsg || successMsg) && (
              <div className="absolute top-3 right-3 left-3 z-20 flex justify-end pointer-events-none">
                <div
                  className={`pointer-events-auto max-w-sm px-3 py-2 rounded-lg border text-[11px] flex items-start gap-2 shadow-lg ${
                    errorMsg
                      ? 'bg-red-950/95 border-red-900/50 text-red-300'
                      : 'bg-emerald-950/95 border-emerald-900/50 text-emerald-300'
                  }`}
                >
                  {errorMsg ? <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> : <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                  <span className="flex-1">{errorMsg || successMsg}</span>
                  <button
                    type="button"
                    onClick={() => { setErrorMsg(null); setSuccessMsg(null); }}
                    className="text-slate-400 hover:text-white shrink-0 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 1: Upload / drag zone — always visible */}
            <div className="shrink-0 mb-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                Step 1 · Add video files
              </p>
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-indigo-500 bg-indigo-950/20'
                    : 'border-slate-800 bg-slate-950/20 hover:border-slate-700 hover:bg-slate-950/40'
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="video/*"
                  multiple
                  onChange={handleFileChange}
                />
                <UploadCloud className={`h-10 w-10 mb-3 mx-auto transition-colors ${stagedVideos.length > 0 ? 'text-indigo-400' : 'text-slate-500'}`} />
                <p className="text-sm font-bold text-slate-200">Drag & drop video(s) here</p>
                <p className="text-xs text-slate-500 mt-1">or click to browse your computer</p>
                {stagedVideos.length > 0 && (
                  <p className="text-[11px] text-indigo-400 font-bold mt-3 uppercase tracking-wider">
                    {stagedVideos.length} file{stagedVideos.length === 1 ? '' : 's'} ready — configure below
                  </p>
                )}
              </div>
            </div>

          {stagedVideos.length > 0 ? (
            <form onSubmit={handleBulkSubmit} className="flex flex-col space-y-4 min-h-0">
              {/* Staged files list — compact preview */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Staged files ({stagedVideos.length})
                </p>
                <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1 rounded-xl border border-slate-850 bg-slate-950/30 p-2">
                  {stagedVideos.map((item, index) => (
                    <div key={item.id} className="bg-slate-950/60 border border-slate-850 rounded-lg p-2.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-mono text-indigo-400 uppercase font-black">#{index + 1}</span>
                          <p className="text-[11px] text-slate-400 truncate" title={item.fileName}>{item.fileName}</p>
                        </div>
                        <button type="button" onClick={() => removeStagedItem(item.id)} className="text-slate-500 hover:text-red-400 p-0.5 cursor-pointer">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateStagedItem(item.id, { name: e.target.value })}
                          placeholder="Title"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                          required
                        />
                        <input
                          type="text"
                          value={item.unique_code}
                          onChange={(e) => updateStagedItem(item.id, { unique_code: e.target.value })}
                          placeholder="Code"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono uppercase text-indigo-300 focus:outline-none focus:border-indigo-500"
                          required
                        />
                      </div>
                      {item.isDuplicate && (
                        <div className="p-2 bg-amber-950/25 border border-amber-900/30 rounded text-[10px] space-y-1.5">
                          <span className="text-amber-500 font-bold uppercase">Duplicate detected</span>
                          <div className="flex gap-3">
                            <label className="flex items-center gap-1 cursor-pointer text-slate-300">
                              <input type="radio" name={`dupAction_${item.id}`} checked={item.duplicateAction === 'skip'} onChange={() => updateStagedItem(item.id, { duplicateAction: 'skip' })} className="cursor-pointer" />
                              Skip
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer text-slate-300">
                              <input type="radio" name={`dupAction_${item.id}`} checked={item.duplicateAction === 'upload'} onChange={() => updateStagedItem(item.id, { duplicateAction: 'upload' })} className="cursor-pointer" />
                              Upload anyway
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* STEP 2: Folder, subfolder, status — only after files are staged */}
              <div className="bg-slate-950/50 border border-indigo-500/20 rounded-xl p-4 space-y-4">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Folder className="h-3.5 w-3.5" />
                  Step 2 · Save location & status
                </p>

                {/* Main folder */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Main folder</label>
                  {!isCreatingNewFolder ? (
                    <select
                      value={category}
                      onChange={(e) => {
                        if (e.target.value === '__NEW__') {
                          setIsCreatingNewFolder(true);
                          setCustomFolder('');
                        } else {
                          setCategory(e.target.value);
                          setSubFolderChoice('none');
                          setSelectedSubFolder('');
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="">— Select saved folder —</option>
                      {folderOptions.map((fold) => (
                        <option key={fold} value={fold}>{fold}</option>
                      ))}
                      <option value="__NEW__">+ Create new folder...</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customFolder}
                        onChange={(e) => setCustomFolder(e.target.value)}
                        placeholder="Type new folder name..."
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => { setIsCreatingNewFolder(false); setCustomFolder(''); }}
                        className="text-[10px] text-slate-400 hover:text-white px-2 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Sub-folder */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sub-folder (optional)</label>
                  <select
                    value={subFolderChoice === 'new' ? '__NEW__' : subFolderChoice === 'existing' ? selectedSubFolder || '' : 'none'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'none') {
                        setSubFolderChoice('none');
                        setSelectedSubFolder('');
                        setNewSubFolder('');
                      } else if (val === '__NEW__') {
                        setSubFolderChoice('new');
                        setSelectedSubFolder('');
                      } else {
                        setSubFolderChoice('existing');
                        setSelectedSubFolder(val);
                        setNewSubFolder('');
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    disabled={isCreatingNewFolder && !customFolder.trim()}
                  >
                    <option value="none">No sub-folder (save in main folder)</option>
                    {subFoldersForCategory.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                    <option value="__NEW__">+ Create new sub-folder...</option>
                  </select>
                  {subFolderChoice === 'new' && (
                    <input
                      type="text"
                      value={newSubFolder}
                      onChange={(e) => setNewSubFolder(e.target.value)}
                      placeholder="Type new sub-folder name..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      required
                    />
                  )}
                </div>

                {/* Upload status — applies to all staged videos */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Upload status (all files)</label>
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value as 'uploaded' | 'not uploaded')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="uploaded">Uploaded</option>
                    <option value="not uploaded">Not uploaded</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={clearStagedQueue}
                  className="py-2.5 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-lg text-xs font-bold uppercase cursor-pointer"
                >
                  Clear all
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs uppercase cursor-pointer shadow-lg shadow-indigo-950/40"
                >
                  {loading ? 'Saving...' : `Save ${stagedVideos.length} video${stagedVideos.length === 1 ? '' : 's'}`}
                </button>
              </div>
            </form>
          ) : (
            /* MANUAL VIDEO ENTRY FORM */
            <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Video Title / Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Corporate Teaser Q3"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!uniqueCode) {
                      const prefixStr = e.target.value.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '');
                      setUniqueCode(`VID-${prefixStr || 'GEN'}-${Math.floor(100+Math.random()*900)}`);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-805 rounded-lg px-3 py-2 text-sm text-slate-205 focus:outline-none focus:border-indigo-505"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Unique video identifier code
                </label>
                <input
                  type="text"
                  required
                  className="w-full bg-slate-950 border border-slate-805 rounded-lg px-3 py-2 text-sm font-mono text-slate-205 uppercase focus:outline-none focus:border-indigo-505"
                  value={uniqueCode}
                  onChange={(e) => setUniqueCode(e.target.value.toUpperCase())}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-405 mb-1.5 uppercase tracking-wider">
                    Duration (Min)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={duration}
                    onChange={(e) => setDuration(parseFloat(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-805 rounded-lg px-3 py-2 text-sm text-slate-205 focus:outline-none focus:border-indigo-505"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-405 mb-1.5 uppercase tracking-wider">
                    Upload Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-805 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none cursor-pointer"
                  >
                    <option value="not uploaded">Not Uploaded</option>
                    <option value="uploaded">Uploaded</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Folder className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                    Target Folder
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewFolder(!isCreatingNewFolder)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase cursor-pointer"
                  >
                    {isCreatingNewFolder ? 'Existing Folder' : '+ Create folder'}
                  </button>
                </div>
                {isCreatingNewFolder ? (
                  <input
                    type="text"
                    required
                    placeholder="Enter folder title..."
                    value={customFolder}
                    onChange={(e) => setCustomFolder(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-805 rounded-lg px-3 py-2 text-sm text-slate-205 focus:outline-none"
                  />
                ) : (
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-805 rounded-lg px-3 py-2 text-sm text-slate-205 focus:outline-none cursor-pointer"
                  >
                    {folderOptions.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Sub-Folder (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Highlights, Cuts"
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-805 rounded-lg px-3 py-2 text-sm text-slate-205 focus:outline-none focus:border-indigo-505"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs uppercase cursor-pointer shadow-lg shadow-indigo-950/50"
              >
                Catalog Video Unit
              </button>
            </form>
          )}
          </div>

          {/* MANUAL FOLDER REGISTRY SECTION */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <FolderPlus className="h-5 w-5 text-emerald-450 text-emerald-400" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400">
                Manual Folder Registry
              </h3>
            </div>

            <form onSubmit={handleCreateCustomFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-404 uppercase tracking-wider mb-1.5 font-mono">
                  Registry Tier
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualFolderType('main')}
                    className={`py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                      manualFolderType === 'main'
                        ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300 shadow'
                        : 'bg-slate-950 border-slate-850 text-slate-400'
                    }`}
                  >
                    Main Folder
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualFolderType('sub')}
                    className={`py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                      manualFolderType === 'sub'
                        ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300 shadow'
                        : 'bg-slate-950 border-slate-850 text-slate-400'
                    }`}
                  >
                    Sub-folder
                  </button>
                </div>
              </div>

              {manualFolderType === 'main' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 px-1">
                    Main Folder name
                  </label>
                  <input
                    type="text"
                    required
                    value={manualCategory}
                    placeholder="e.g. Q3 Reels, Interviews"
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-805 rounded-lg px-2.5 py-1.5 text-xs text-slate-205 focus:outline-none"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 px-1">
                      Parent Main Folder
                    </label>
                    <select
                      value={manualParentCategory}
                      onChange={(e) => setManualParentCategory(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-805 rounded-lg px-2.5 py-1.5 text-xs text-slate-205 focus:outline-none cursor-pointer"
                    >
                      {existingFolders.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 px-1">
                      Sub-Folder Name
                    </label>
                    <input
                      type="text"
                      required
                      value={manualSubCategory}
                      placeholder="e.g. Rough Drafts, Approved"
                      onChange={(e) => setManualSubCategory(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-805 rounded-lg px-2.5 py-1.5 text-xs text-slate-205 focus:outline-none font-sans"
                    />
                  </div>
                </div>
              )}

              {folderError && (
                <div className="p-2 bg-red-955/20 border border-red-900/30 text-red-400 text-[11px] rounded">
                  {folderError}
                </div>
              )}
              {folderSuccess && (
                <div className="p-2 bg-emerald-955/20 border border-emerald-950/30 text-emerald-400 text-[11px] rounded animate-fade-in font-sans">
                  {folderSuccess}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-555 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow"
              >
                Create Workspace Folders
              </button>
            </form>

            {/* List customized empty folder workspace configs */}
            {customFoldersList.length > 0 && (
              <div className="border-t border-slate-800/80 pt-3 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Registered empty maps ({customFoldersList.length})</span>
                <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1 font-sans text-xs">
                  {customFoldersList.map((cf) => (
                    <div key={cf.id} className="flex justify-between items-center bg-slate-950/40 border border-slate-850 hover:border-slate-800 px-2 py-1.5 rounded-lg text-slate-350 transition-colors">
                      <div className="truncate pr-1">
                        <strong className="text-slate-200">{cf.category}</strong>
                        {cf.sub_category && <span className="text-slate-500 text-[10px] block pl-1.5">➔ sub: {cf.sub_category}</span>}
                      </div>
              {canManage ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomFolder(cf.id)}
                        className="text-slate-500 hover:text-red-400 p-0.5 cursor-pointer transition-colors"
                        title="Remove folder reference"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: SEARCH, BATCH ACTIONS & FOLDER LIST WORKSPACES */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-md">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </span>
                <input
                  type="text"
                  placeholder="Search title, codes, serials..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-805 rounded-lg text-xs text-slate-205 focus:outline-none"
                />
              </div>
              
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-955 border border-slate-805 rounded-lg text-xs text-slate-200 cursor-pointer"
              >
                <option value="All">All Main Folders</option>
                {existingFolders.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-955 border border-slate-805 rounded-lg text-xs text-slate-200 cursor-pointer"
              >
                <option value="All">All Upload Statuses</option>
                <option value="uploaded">Uploaded</option>
                <option value="not uploaded">Not Uploaded</option>
              </select>
            </div>

            {/* Tree Collapse expand controls */}
            {filteredVideos.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-850 pt-2 text-[10px] font-mono">
                <span className="text-slate-500 font-bold uppercase tracking-widest">Workspace Catalog</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCollapsedFolders({});
                      setCollapsedSubFolders({});
                    }}
                    className="px-2 py-0.5 bg-slate-950 hover:bg-slate-805 border border-slate-800 text-slate-400 rounded transition text-[9px] font-bold uppercase cursor-pointer"
                  >
                    Expand Tree
                  </button>
                  <button
                    onClick={() => {
                      const allCollapsed: Record<string, boolean> = {};
                      groupedFolderNames.forEach(k => {
                        allCollapsed[k] = true;
                      });
                      setCollapsedFolders(allCollapsed);
                      
                      // Also collapse all child subfolders
                      const allSubCollapsed: Record<string, boolean> = {};
                      existingSubFolders.forEach(sf => {
                        allSubCollapsed[sf] = true;
                      });
                      setCollapsedSubFolders(allSubCollapsed);
                    }}
                    className="px-2 py-0.5 bg-slate-950 hover:bg-slate-805 border border-slate-800 text-slate-400 rounded transition text-[9px] font-bold uppercase cursor-pointer"
                  >
                    Collapse Tree
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* CHUCK BATCH ACTION SELECT Bar displaying only on video list checkers */}
          {selectedVideoIds.length > 0 && (
            <div className="bg-indigo-950/40 border border-indigo-500/25 rounded-2xl p-5 flex flex-col space-y-3.5 animate-fade-in shadow-xl">
              <div className="flex items-center justify-between border-b border-indigo-500/10 pb-2">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4.5 w-4.5 text-indigo-400 animate-pulse" />
                  <span className="text-xs md:text-sm text-indigo-200 font-extrabold font-mono uppercase tracking-wider">
                    {selectedVideoIds.length} video{selectedVideoIds.length > 1 ? 's' : ''} checked
                  </span>
                </div>
                
                {/* Delete button only appears for Admin / Supervisor roles */}
                {canDelete ? (
                  <button
                    onClick={handleBulkDelete}
                    className="inline-flex items-center gap-1.5 bg-red-950 hover:bg-red-900 border border-red-500/30 hover:border-red-500/60 text-red-400 px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wide cursor-pointer transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    Delete Selected
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-mono italic">
                    <Lock className="h-3 w-3 text-slate-600" />
                    Delete locked for role
                  </span>
                )}
              </div>

              {/* Transfer forms in Batch selected row */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <Move className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-355 font-sans">Transfer Batch Target:</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={multiMoveCategory}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setMultiMoveCreateFolder(true);
                        setMultiMoveCategory('');
                      } else {
                        setMultiMoveCreateFolder(false);
                        setMultiMoveCategory(e.target.value);
                      }
                    }}
                    className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-250 cursor-pointer text-slate-200 focus:outline-none"
                  >
                    <option value="">-- Main Folder --</option>
                    {folderOptions.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                    <option value="__NEW__" className="text-indigo-400 font-semibold">+ Create Category...</option>
                  </select>

                  {multiMoveCreateFolder && (
                    <input
                      type="text"
                      placeholder="Category Title..."
                      value={multiMoveCustomCategory}
                      onChange={(e) => setMultiMoveCustomCategory(e.target.value)}
                      className="bg-slate-955 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none w-32 font-sans"
                    />
                  )}

                  <select
                    value={multiMoveSubCategorySelect}
                    onChange={(e) => {
                      setMultiMoveSubCategorySelect(e.target.value);
                      if (e.target.value !== '__NEW_SUB__') {
                        setMultiMoveSubCategory('');
                      }
                    }}
                    className="bg-slate-955 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 cursor-pointer focus:outline-none"
                  >
                    <option value="">-- Direct main tier (No Sub) --</option>
                    {existingSubFolders.map(sf => (
                      <option key={sf} value={sf}>Sub: {sf}</option>
                    ))}
                    <option value="__NEW_SUB__" className="text-emerald-450 font-semibold">+ Create sub-folder...</option>
                  </select>

                  {multiMoveSubCategorySelect === '__NEW_SUB__' && (
                    <input
                      type="text"
                      placeholder="New sub-folder title..."
                      value={multiMoveSubCategory}
                      onChange={(e) => setMultiMoveSubCategory(e.target.value)}
                      className="bg-slate-955 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none w-36"
                    />
                  )}

                  <button
                    onClick={handleMultiTransfer}
                    disabled={loading}
                    className="bg-indigo-600 hover:bg-indigo-500 font-extrabold text-white text-[11px] uppercase tracking-wider px-4.5 py-1.5 rounded shadow-md transition-all cursor-pointer"
                  >
                    {loading ? 'Processing...' : 'Confirm batch move'}
                  </button>

                  <button
                    onClick={() => setSelectedVideoIds([])}
                    className="text-slate-450 hover:text-slate-300 font-bold uppercase tracking-wider hover:underline py-1 px-2.5 text-[10px] cursor-pointer"
                  >
                    Deselect
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* EXPLORER TREE MAPS - Single responsive table view per category featuring collapsible sub-folders */}
          <div className="space-y-4">
            {groupedFolderNames.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center shadow-inner">
                <FileVideo className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-350">No catalog categories fit your current filters.</p>
                <p className="text-xs text-slate-505 text-slate-500 mt-1">Staging files or creating manual categories will instantiate listings immediately.</p>
              </div>
            ) : (
              groupedFolderNames.map((folderName) => {
                const folderVideos = foldersGrouped[folderName];
                const isCollapsed = !!collapsedFolders[folderName];
                const folderTotalDuration = folderVideos.reduce((sum, v) => sum + v.duration, 0);

                // Filter out videos that belong to subcategories to maintain structured breakdown
                const directVideos = folderVideos.filter(v => !v.sub_category);

                // Discover unique subcategories belonging to this folder tier
                const localSubGroups: Record<string, VideoType[]> = {};
                
                // Backfill from manual custom folder configuration configurations
                customFoldersList.forEach((cf) => {
                  if (cf.category === folderName && cf.sub_category) {
                    const subTrimValue = cf.sub_category.trim();
                    if (!localSubGroups[subTrimValue]) {
                      localSubGroups[subTrimValue] = [];
                    }
                  }
                });

                folderVideos.forEach((vid) => {
                  if (vid.sub_category) {
                    const subTrimValue = vid.sub_category.trim();
                    if (!localSubGroups[subTrimValue]) {
                      localSubGroups[subTrimValue] = [];
                    }
                    localSubGroups[subTrimValue].push(vid);
                  }
                });

                const sortedLocalSubs = Object.keys(localSubGroups).sort((a,b) => a.localeCompare(b));

                return (
                  <div key={folderName} className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40 shadow-xl transition-all">
                    
                    {/* FOLDER LEVEL HEADER ACCORDION */}
                    <div
                      onClick={() => setCollapsedFolders(prev => ({ ...prev, [folderName]: !prev[folderName] }))}
                      className="flex items-center justify-between px-5 py-4 bg-slate-900 hover:bg-slate-850/50 cursor-pointer select-none transition-colors border-b border-transparent"
                    >
                      <div className="flex items-center gap-3">
                        {isCollapsed ? (
                          <FolderClosed className="h-5 w-5 text-indigo-400 shrink-0" />
                        ) : (
                          <FolderOpen className="h-5 w-5 text-indigo-400 shrink-0" />
                        )}
                        <div>
                          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                            {folderName}
                            <span className="text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              {folderVideos.length} {folderVideos.length === 1 ? 'file' : 'files'}
                            </span>
                            {sortedLocalSubs.length > 0 && (
                              <span className="text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {sortedLocalSubs.length} sub-folder{sortedLocalSubs.length === 1 ? '' : 's'}
                              </span>
                            )}
                          </h4>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                            Folder Duration: <strong className="text-slate-300">{formatHHMMSS(folderTotalDuration)}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportVideos(folderVideos, `folder_${folderName}`);
                          }}
                          className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-[10px] uppercase font-bold tracking-wider px-2 py-1 text-slate-300 rounded cursor-pointer transition-colors"
                        >
                          <Download className="h-3.5 w-3.5 text-indigo-400" />
                          CSV export
                        </button>
                        {isCollapsed ? (
                          <ChevronDown className="h-4.5 w-4.5 text-slate-500" />
                        ) : (
                          <ChevronUp className="h-4.5 w-4.5 text-slate-500" />
                        )}
                      </div>
                    </div>

                    {/* FOLDER CONTENTS (Collapse wrapper) */}
                    {!isCollapsed && (
                      <div className="p-4 bg-slate-950/25 border-t border-slate-850/60 p-4 space-y-4">
                        
                        {/* 1. Directly inside parent folder videos rendered in single tables */}
                        {directVideos.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between p-1.5 bg-slate-900/40 rounded border border-slate-850">
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <FolderOpen className="h-3.5 w-3.5 text-indigo-505 text-indigo-400" />
                                Root Category Catalog ({directVideos.length})
                              </span>
                            </div>
                            <div className="border border-slate-854 bg-slate-950/30 rounded-xl overflow-hidden shadow">
                              {renderVideosTable(directVideos)}
                            </div>
                          </div>
                        )}

                        {/* 2. Collapsible sub-folders inside parent folder */}
                        {sortedLocalSubs.map((subName) => {
                          const subVids = localSubGroups[subName];
                          const subKey = `${folderName}_${subName}`;
                          const isSubCollapsed = !!collapsedSubFolders[subKey];
                          const subDurationMins = subVids.reduce((s, v) => s + v.duration, 0);

                          return (
                            <div key={subName} className="ml-3 pl-3 border-l-2 border-indigo-500/20 space-y-2 animate-fade-in text-xs">
                              
                              {/* SUB-FOLDER LEVEL ACCORDION */}
                              <div
                                onClick={() => setCollapsedSubFolders(prev => ({ ...prev, [subKey]: !prev[subKey] }))}
                                className="flex items-center justify-between p-2.5 bg-slate-900/30 hover:bg-slate-900/60 rounded-lg border border-slate-850 cursor-pointer select-none transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  {isSubCollapsed ? (
                                    <FolderClosed className="h-4 w-4 text-emerald-450 text-emerald-400 shrink-0" />
                                  ) : (
                                    <FolderOpen className="h-4 w-4 text-emerald-450 text-emerald-400 shrink-0" />
                                  )}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[11px] font-extrabold uppercase text-slate-300">
                                      Sub-folder: <strong className="text-indigo-400 font-black">{subName}</strong>
                                    </span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                                      {subVids.length} files
                                    </span>
                                    <span className="text-[9px] font-mono text-slate-500">
                                      Duration: <strong className="text-slate-400">{formatHHMMSS(subDurationMins)}</strong>
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExportVideos(subVids, `subfolder_${folderName}_${subName}`);
                                    }}
                                    className="inline-flex items-center gap-1 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 text-[10px] font-bold uppercase rounded py-0.5 px-2 cursor-pointer transition-all shrink-0"
                                    title={`Export CSV index of the sub-folder: ${subName}`}
                                  >
                                    <Download className="h-3 w-3 text-indigo-400 shrink-0" />
                                    CSV Export
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const alreadySelectedAll = subVids.every(v => selectedVideoIds.includes(v.id));
                                      if (alreadySelectedAll) {
                                        setSelectedVideoIds(prev => prev.filter(id => !subVids.some(v => v.id === id)));
                                      } else {
                                        setSelectedVideoIds(prev => {
                                          const filtered = prev.filter(id => !subVids.some(v => v.id === id));
                                          return [...filtered, ...subVids.map(v => v.id)];
                                        });
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-505/10 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase rounded hover:bg-slate-800 cursor-pointer shrink-0"
                                  >
                                    <CheckSquare className="h-3 w-3 shrink-0" />
                                    {subVids.every(v => selectedVideoIds.includes(v.id)) ? 'Deselect sub' : 'Select sub to move'}
                                  </button>
                                  {isSubCollapsed ? (
                                    <ChevronDown className="h-4 w-4 text-slate-500" />
                                  ) : (
                                    <ChevronUp className="h-4 w-4 text-slate-500" />
                                  )}
                                </div>
                              </div>

                              {/* SUB-FOLDER TABLE LIST */}
                              {!isSubCollapsed && (
                                <div className="border border-slate-850/80 rounded-xl overflow-hidden bg-slate-950/20 animate-fade-in pl-1">
                                  {subVids.length > 0 ? (
                                    renderVideosTable(subVids)
                                  ) : (
                                    <div className="py-8 text-center text-slate-500 text-xs font-mono bg-slate-900/10">
                                      This subfolder sequence is currently empty. Direct files here using staging uploads.
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {directVideos.length === 0 && sortedLocalSubs.length === 0 && (
                          <div className="py-6 text-center text-slate-500 text-xs font-mono">
                            No active catalog records. Click "+" to register files.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
