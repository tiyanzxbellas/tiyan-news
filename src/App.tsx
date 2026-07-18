import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Moon, Sun, TrendingUp, ExternalLink, ArrowLeft, Home, Tv, X } from 'lucide-react';
import { NewsItem } from './types';

const CATEGORIES = [
  { id: 'utama', label: 'Utama' },
  { id: 'berita', label: 'Berita' },
  { id: 'daerah', label: 'Daerah' },
  { id: 'keuangan', label: 'Keuangan' },
  { id: 'sport', label: 'Sport' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'travel', label: 'Travel' },
  { id: 'otomotif', label: 'Otomotif' },
  { id: 'techno', label: 'Techno' },
  { id: 'multimedia', label: 'Multimedia' }
];

const TV_CHANNELS = [
  { id: 'trans7', name: 'Trans 7', url: 'https://20.detik.com/watch/livestreaming-trans7?smartautoplay=true' },
  { id: 'detiktv', name: 'Detik TV', url: 'https://20.detik.com/embed/playlist/1' },
  { id: 'cnbc', name: 'CNBC', url: 'https://www.cnbcindonesia.com/embed/tv?ref=transmedia&smartautoplay=true' }
];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('utama');
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        return savedTheme === 'dark';
      }
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });
  const [activeTab, setActiveTab] = useState<'home'|'search'|'livetv'>('home');
  const [selectedTvChannel, setSelectedTvChannel] = useState(TV_CHANNELS[0].id);
  
  // Detail view states
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null);
  const [articleDetail, setArticleDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');

  // Sync state from URL
  useEffect(() => {
    const path = location.pathname;
    
    if (path.startsWith('/read/')) {
      const slug = path.substring(6); // remove '/read/'
      let originalUrl = '';
      if (slug.includes('.inews.id/')) {
         originalUrl = `https://${slug}`;
      } else {
         originalUrl = `https://www.inews.id/${slug}`;
      }
      if (!selectedArticle || selectedArticle.link !== originalUrl) {
        loadArticleFromUrl(originalUrl);
      }
    } else if (path === '/livetv') {
      setActiveTab('livetv');
      if (selectedArticle) setSelectedArticle(null);
    } else if (path === '/search') {
      setActiveTab('search');
      if (selectedArticle) setSelectedArticle(null);
    } else if (path === '/' || path === '/home') {
      setActiveTab('home');
      setSelectedCategory('utama');
      if (selectedArticle) setSelectedArticle(null);
    } else {
      const cat = path.substring(1).toLowerCase();
      const isValidCat = CATEGORIES.some(c => c.id === cat);
      if (isValidCat) {
        setActiveTab('home');
        setSelectedCategory(cat);
        if (selectedArticle) setSelectedArticle(null);
      }
    }
  }, [location.pathname]);

  const loadArticleFromUrl = async (url: string, baseItem?: Partial<NewsItem>) => {

    // Generate a temporary news item just to show in the modal while loading
    setSelectedArticle({
      id: baseItem?.id || 'temp-' + Date.now(),
      title: baseItem?.title || 'Memuat Artikel...',
      link: url,
      image: baseItem?.image || '',
      category: baseItem?.category || 'BERITA',
      source: baseItem?.source || 'External',
      publishedAt: baseItem?.publishedAt || ''
    });
    setArticleDetail(null);
    setDetailError('');
    setLoadingDetail(true);
    
    try {
      const res = await fetch(`/api/news/detail?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error('Gagal memuat detail berita. Berita mungkin tidak dapat di-scrape.');
      const data = await res.json();
      
      if (data.status === 'success') {
        setArticleDetail(data.data);
        // Update the title if it was missing or generic
        setSelectedArticle(prev => prev ? { ...prev, title: data.data.title || prev.title } : null);
      } else {
        throw new Error(data.message || 'Gagal memuat detail berita');
      }
    } catch (err: any) {
      setDetailError(err.message || 'Terjadi kesalahan saat memuat artikel');
    } finally {
      setLoadingDetail(false);
    }
  };

  const navigateToArticle = (url: string) => {
    if (url.startsWith('/read/')) {
      navigate(url);
      return;
    }
    try {
      const urlObj = new URL(url, window.location.origin);
      if (urlObj.hostname.includes('inews.id')) {
        let slug = urlObj.pathname.substring(1); // remove leading slash
        if (urlObj.hostname !== 'www.inews.id') {
          slug = `${urlObj.hostname}/${slug}`;
        }
        navigate(`/read/${slug}`);
      } else {
        window.open(url, '_blank');
      }
    } catch {
      window.open(url, '_blank');
    }
  };

  const closeArticle = () => {
    if (activeTab === 'search') navigate('/search');
    else if (activeTab === 'livetv') navigate('/livetv');
    else navigate(`/${selectedCategory === 'utama' ? 'home' : selectedCategory}`);
  };

  const handleArticleClick = (e: React.MouseEvent, item: NewsItem) => {
    e.preventDefault();
    navigateToArticle(item.link);
  };

  const handleArticleContentClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href) {
      const url = anchor.href;
      if (url.startsWith('http')) {
        e.preventDefault();
        navigateToArticle(url);
      }
    }
  };

  // Initialize dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Debounce search query
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch news
  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      setError('');
      try {
        const queryParams = new URLSearchParams();
        if (debouncedSearch) {
          queryParams.append('q', debouncedSearch);
        } else {
          queryParams.append('category', selectedCategory);
        }
        
        const res = await fetch(`/api/news?${queryParams.toString()}`);
        if (!res.ok) throw new Error('Gagal mengambil berita');
        const data = await res.json();
        
        if (data.status === 'success') {
          setNews(data.data);
        } else {
          throw new Error('Format data tidak valid');
        }
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan');
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [debouncedSearch, selectedCategory]);

  // Filter news based on search locally (if needed) but API does search
  const filteredNews = useMemo(() => {
    return news; // API handles search and category now
  }, [news]);

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Baru Saja';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Probably relative time like "3 jam lalu"
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50 dark:bg-[#0a0a0c] text-slate-900 dark:text-[#e2e8f0]">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white dark:bg-[#111114] border-b border-slate-200 dark:border-[#2d2d33] shrink-0 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex justify-between items-center h-12">
            
            {/* Logo */}
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-red-600 hidden sm:block" />
              <h1 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white flex items-center gap-1 uppercase">
                <span className="bg-red-600 text-white px-2 py-0.5 rounded-sm">We</span>News
              </h1>
            </div>

            {/* Desktop Search & Controls */}
            <div className="hidden md:flex items-center gap-6">
              <nav className="flex items-center gap-4">
                <button
                  onClick={() => navigate('/home')}
                  className={`text-sm font-bold uppercase tracking-widest transition-colors ${activeTab === 'home' ? 'text-red-600' : 'text-slate-600 hover:text-red-500'}`}
                >
                  Home
                </button>
                <button
                  onClick={() => navigate('/livetv')}
                  className={`text-sm font-bold uppercase tracking-widest flex items-center gap-1 transition-colors ${activeTab === 'livetv' ? 'text-red-600' : 'text-slate-600 hover:text-red-500'}`}
                >
                  <Tv className="w-4 h-4"/> Live TV
                </button>
              </nav>

              <div className="relative group">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-500" />
                </div>
                <input
                  type="text"
                  placeholder="Cari berita..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (activeTab === 'livetv') navigate('/home');
                  }}
                  className="bg-slate-100 dark:bg-[#1c1c21] border border-slate-200 dark:border-[#2d2d33] rounded-full py-1.5 pl-10 pr-4 text-sm w-72 focus:outline-none focus:border-red-500 text-slate-900 dark:text-slate-200 placeholder:text-slate-500 transition-colors"
                />
              </div>
              
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#1c1c21] p-1 rounded-lg border border-slate-200 dark:border-[#2d2d33]">
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="p-1.5 rounded bg-white dark:bg-[#2d2d33] text-slate-700 dark:text-white shadow-sm hover:opacity-80 transition-opacity"
                  aria-label="Toggle Dark Mode"
                >
                  {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Mobile menu button (Dark mode only) */}
            <div className="md:hidden flex items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#1c1c21] p-1 rounded-lg border border-slate-200 dark:border-[#2d2d33]">
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="p-1.5 rounded bg-white dark:bg-[#2d2d33] text-slate-700 dark:text-white shadow-sm"
                >
                  {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          
          {/* Mobile Search - only visible when activeTab is search */}
          {activeTab === 'search' && (
            <div className="pt-4 pb-2 md:hidden animate-in slide-in-from-top-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-500" />
                </div>
                <input
                  type="text"
                  placeholder="Cari berita..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-[#1c1c21] border border-slate-200 dark:border-[#2d2d33] rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-red-500 text-slate-900 dark:text-slate-200 placeholder:text-slate-500 transition-colors"
                  autoFocus
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6 pb-20 md:pb-6 overflow-hidden">
        <AnimatePresence mode="wait">
        {activeTab === 'livetv' ? (
          <motion.div 
            key="livetv"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col gap-4"
          >
            {/* TV Channel Navigation */}
            <nav className="flex items-center gap-4 overflow-x-auto pb-2 border-b border-slate-200 dark:border-[#2d2d33] text-xs font-bold uppercase tracking-widest shrink-0 hide-scrollbar">
              <span className="text-slate-500 shrink-0">Channel:</span>
              {TV_CHANNELS.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => setSelectedTvChannel(channel.id)}
                  className={`shrink-0 transition-colors pb-2 border-b-2 whitespace-nowrap ${
                    selectedTvChannel === channel.id
                      ? 'text-red-500 border-red-500'
                      : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  {channel.name}
                </button>
              ))}
            </nav>
            <div className="flex-1 w-full min-h-[60vh] md:min-h-[70vh] rounded-xl overflow-hidden border border-slate-200 dark:border-[#2d2d33]">
              <iframe 
                src={TV_CHANNELS.find(c => c.id === selectedTvChannel)?.url} 
                className="w-full h-full min-h-[60vh] md:min-h-[70vh] border-0"
                allowFullScreen
                title={`Live TV ${TV_CHANNELS.find(c => c.id === selectedTvChannel)?.name}`}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="news-view"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-6"
          >
            {/* Categories Navigation */}
            <nav className="flex items-center gap-6 overflow-x-auto pb-2 border-b border-slate-200 dark:border-[#2d2d33] text-xs font-bold uppercase tracking-widest shrink-0 hide-scrollbar">
              <span className="text-slate-500 shrink-0">Kategori:</span>
              {CATEGORIES.map((cat) => (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  key={cat.id}
                  onClick={() => navigate(`/${cat.id}`)}
                  className={`relative shrink-0 transition-colors pb-2 border-b-2 whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? 'text-red-500 border-red-500'
                      : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  {cat.label}
                </motion.button>
              ))}
            </nav>

            {/* State Management Views */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 flex-1">
                <div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
                <p className="mt-4 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">Memuat berita...</p>
              </div>
            )}

            {error && !loading && (
              <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 p-6 rounded-xl text-center flex-1">
                <p className="font-bold text-sm uppercase tracking-widest mb-2">Gagal memuat berita</p>
                <p className="text-xs opacity-80">{error}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-4 px-6 py-2 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 rounded text-xs font-bold transition-colors uppercase tracking-widest"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {!loading && !error && filteredNews.length === 0 && (
              <div className="text-center py-20 text-slate-500 dark:text-slate-400 flex-1">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="font-bold text-sm uppercase tracking-widest">Tidak ada berita yang ditemukan.</p>
                <p className="text-xs mt-2">Coba gunakan kata kunci pencarian atau kategori lain.</p>
              </div>
            )}

            {/* News Grid */}
            {!loading && !error && filteredNews.length > 0 && (
              <motion.div 
                key={selectedCategory + activeTab}
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
                }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              >
            {filteredNews.map((item) => (
              <motion.a 
                variants={{
                  hidden: { opacity: 0, x: -50 },
                  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" } }
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                href={item.link} 
                onClick={(e) => handleArticleClick(e, item)}
                key={item.id} 
                className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-[#2d2d33] rounded-xl p-4 flex gap-4 hover:border-red-500/50 transition-colors group cursor-pointer"
              >
                <div className="w-24 h-24 sm:w-28 sm:h-28 bg-slate-200 dark:bg-slate-800 rounded-lg shrink-0 overflow-hidden relative">
                  <img 
                    src={item.image} 
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&q=80';
                    }}
                  />
                </div>
                
                <div className="flex flex-col flex-1 min-w-0 py-0.5">
                  <span className="text-red-600 dark:text-red-500 text-[10px] font-bold uppercase tracking-wider mb-1.5 block truncate">
                    {item.category}
                  </span>
                  
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug mb-2 group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors line-clamp-2">
                    {item.title}
                  </h3>
                  
                  {item.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2 flex-1">
                      {item.description.replace(/<[^>]+>/g, '')}
                    </p>
                  )}
                  
                  <div className="mt-auto flex items-center justify-between text-[10px] font-medium text-slate-500 dark:text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3 text-red-500 hidden sm:block" />
                      {formatDate(item.publishedAt)}
                    </span>
                    <span className="border-l border-slate-200 dark:border-slate-700 pl-3 hidden sm:block truncate">
                      Oleh {item.source === 'inews.id' ? 'iNews' : item.source}
                    </span>
                  </div>
                </div>
              </motion.a>
            ))}
          </motion.div>
        )}
        </motion.div>
        )}
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-[#111114] border-t border-slate-200 dark:border-[#2d2d33] z-50 px-6 py-2 flex justify-between items-center transition-colors">
        <button 
          onClick={() => navigate('/home')}
          className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'home' ? 'text-red-600 dark:text-red-500' : 'text-slate-500 dark:text-slate-400'}`}
        >
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Home</span>
        </button>
        <button 
          onClick={() => navigate('/search')}
          className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'search' ? 'text-red-600 dark:text-red-500' : 'text-slate-500 dark:text-slate-400'}`}
        >
          <Search className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Cari</span>
        </button>
        <button 
          onClick={() => navigate('/livetv')}
          className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'livetv' ? 'text-red-600 dark:text-red-500' : 'text-slate-500 dark:text-slate-400'}`}
        >
          <Tv className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Live TV</span>
        </button>
      </nav>
      
      {/* Footer */}
      <footer className="hidden md:flex bg-white dark:bg-[#111114] border-t border-slate-200 dark:border-[#2d2d33] px-4 sm:px-6 lg:px-8 py-4 flex-col sm:flex-row items-center justify-between text-[10px] text-slate-500 shrink-0 mt-auto gap-4">
        <div className="flex flex-wrap justify-center sm:justify-start gap-4 items-center">
          <span>&copy; {new Date().getFullYear()} WeNews Media Group</span>
          <span className="hidden sm:inline">|</span>
          <a href="#" className="hover:text-slate-800 dark:hover:text-slate-300 transition-colors font-bold uppercase tracking-wider">Tentang Kami</a>
          <a href="#" className="hover:text-slate-800 dark:hover:text-slate-300 transition-colors font-bold uppercase tracking-wider">Redaksi</a>
          <a href="#" className="hover:text-slate-800 dark:hover:text-slate-300 transition-colors font-bold uppercase tracking-wider">Pedoman Media Siber</a>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          <span className="font-bold uppercase tracking-wider">Berita-API Siputzx</span>
        </div>
      </footer>

      {/* Article Detail Modal */}
      <AnimatePresence>
        {selectedArticle && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-[#111114] w-full max-w-4xl max-h-full rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-[#2d2d33]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-[#2d2d33] shrink-0 bg-white dark:bg-[#111114] z-10 sticky top-0">
              <button 
                onClick={closeArticle}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1c1c21] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali
              </button>
              <div className="flex items-center gap-3">
                <a 
                  href={selectedArticle.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 text-slate-500 hover:text-red-500 transition-colors"
                  title="Buka di tab baru"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button 
                  onClick={closeArticle}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#1c1c21] transition-colors text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content Area */}
            <div id="modal-scroll-area" className="flex-1 overflow-y-auto p-4 sm:p-8 relative scroll-smooth">
              
              <div className="max-w-3xl mx-auto">
                <div className="mb-6 flex flex-col items-center text-center">
                  <span className="text-red-600 dark:text-red-500 text-xs font-bold uppercase tracking-widest mb-3 inline-block bg-red-50 dark:bg-red-900/10 px-3 py-1 rounded-full border border-red-200 dark:border-red-900/30">
                    {selectedArticle.category}
                  </span>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-tight mb-4">
                    {selectedArticle.title}
                  </h2>
                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    <span>
                      {formatDate(articleDetail?.publishedTime || selectedArticle.publishedAt)}
                    </span>
                    <span>•</span>
                    <span>{selectedArticle.source === 'inews.id' ? 'iNews' : selectedArticle.source}</span>
                  </div>
                </div>

                <div className="relative aspect-[16/9] w-full rounded-xl overflow-hidden mb-8 bg-slate-100 dark:bg-[#1c1c21] border border-slate-200 dark:border-[#2d2d33]">
                  <img 
                    src={selectedArticle.image || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&q=80'} 
                    alt={selectedArticle.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&q=80';
                    }}
                  />
                </div>

                {loadingDetail && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-500 font-bold text-xs uppercase tracking-widest animate-pulse">Menyiapkan artikel...</p>
                  </div>
                )}

                {detailError && !loadingDetail && (
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 p-6 rounded-xl text-center">
                    <p className="font-bold text-sm uppercase tracking-widest mb-2">Gagal memuat detail artikel</p>
                    <p className="text-xs opacity-80 mb-4">{detailError}</p>
                    <a 
                      href={selectedArticle.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition-colors uppercase tracking-widest"
                    >
                      Baca di sumber asli <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {articleDetail && !loadingDetail && !detailError && (
                  <article 
                    onClick={handleArticleContentClick}
                    className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-black prose-a:text-red-600 hover:prose-a:text-red-500 prose-img:rounded-xl cursor-pointer"
                  >
                    <div dangerouslySetInnerHTML={{ __html: articleDetail.content }} />
                  </article>
                )}
              </div>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global styles for hide-scrollbar */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
