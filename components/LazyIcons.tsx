'use client';

import { lazy, Suspense } from 'react';

// Lazy load icon sets to reduce initial bundle size
export const LazyReactIcons = lazy(() => 
  import('react-icons/bi').then(mod => ({
    default: {
      BiSearch: mod.BiSearch,
      BiX: mod.BiX,
      BiFilter: mod.BiFilter,
      BiMicrophone: mod.BiMicrophone,
      BiHistory: mod.BiHistory,
      BiTrendingUp: mod.BiTrendingUp,
      BiChevronDown: mod.BiChevronDown,
      BiHome: mod.BiHome,
      BiCalendar: mod.BiCalendar,
      BiUser: mod.BiUser,
      BiHeart: mod.BiHeart,
      BiPlay: mod.BiPlay,
      BiPause: mod.BiPause,
      BiSkipNext: mod.BiSkipNext,
      BiSkipPrevious: mod.BiSkipPrevious,
      BiVolume: mod.BiVolume,
      BiVolumeMute: mod.BiVolumeMute,
      BiShuffle: mod.BiShuffle,
      BiRepeat: mod.BiRepeat,
      BiPlus: mod.BiPlus,
      BiMinus: mod.BiMinus,
      BiCheck: mod.BiCheck,
      BiError: mod.BiError,
      BiInfoCircle: mod.BiInfoCircle,
      BiWarning: mod.BiWarning,
      BiLoader: mod.BiLoader,
      BiChevronLeft: mod.BiChevronLeft,
      BiChevronRight: mod.BiChevronRight,
      BiChevronUp: mod.BiChevronUp,
      BiMenu: mod.BiMenu,
      BiClose: mod.BiClose,
      BiSettings: mod.BiSettings,
      BiLogOut: mod.BiLogOut,
      BiLogIn: mod.BiLogIn
    }
  }))
);

export const LazyFaIcons = lazy(() => 
  import('react-icons/fa').then(mod => ({
    default: {
      FaSpotify: mod.FaSpotify,
      FaCalendar: mod.FaCalendar,
      FaMapMarkerAlt: mod.FaMapMarkerAlt,
      FaUserAlt: mod.FaUserAlt,
      FaMusic: mod.FaMusic,
      FaTicketAlt: mod.FaTicketAlt,
      FaThumbsUp: mod.FaThumbsUp,
      FaThumbsDown: mod.FaThumbsDown,
      FaFire: mod.FaFire,
      FaStar: mod.FaStar,
      FaRegStar: mod.FaRegStar,
      FaHeart: mod.FaHeart,
      FaRegHeart: mod.FaRegHeart,
      FaShare: mod.FaShare,
      FaExternalLinkAlt: mod.FaExternalLinkAlt,
      FaInstagram: mod.FaInstagram,
      FaTwitter: mod.FaTwitter,
      FaFacebook: mod.FaFacebook,
      FaYoutube: mod.FaYoutube,
      FaApple: mod.FaApple,
      FaGoogle: mod.FaGoogle,
      FaGithub: mod.FaGithub
    }
  }))
);

export const LazyHiIcons = lazy(() => 
  import('react-icons/hi').then(mod => ({
    default: {
      HiHome: mod.HiHome,
      HiSearch: mod.HiSearch,
      HiLibrary: mod.HiLibrary,
      HiPlus: mod.HiPlus,
      HiHeart: mod.HiHeart,
      HiUser: mod.HiUser,
      HiCog: mod.HiCog,
      HiLogout: mod.HiLogout,
      HiMenu: mod.HiMenu,
      HiX: mod.HiX,
      HiPlay: mod.HiPlay,
      HiPause: mod.HiPause,
      HiVolumeUp: mod.HiVolumeUp,
      HiVolumeOff: mod.HiVolumeOff,
      HiRefresh: mod.HiRefresh,
      HiExternalLink: mod.HiExternalLink,
      HiInformationCircle: mod.HiInformationCircle,
      HiExclamation: mod.HiExclamation,
      HiCheckCircle: mod.HiCheckCircle,
      HiXCircle: mod.HiXCircle
    }
  }))
);

export const LazyRxIcons = lazy(() => 
  import('react-icons/rx').then(mod => ({
    default: {
      RxCaretLeft: mod.RxCaretLeft,
      RxCaretRight: mod.RxCaretRight,
      RxCaretUp: mod.RxCaretUp,
      RxCaretDown: mod.RxCaretDown,
      RxChevronLeft: mod.RxChevronLeft,
      RxChevronRight: mod.RxChevronRight,
      RxChevronUp: mod.RxChevronUp,
      RxChevronDown: mod.RxChevronDown,
      RxCross1: mod.RxCross1,
      RxCross2: mod.RxCross2,
      RxPlus: mod.RxPlus,
      RxMinus: mod.RxMinus,
      RxDot: mod.RxDot,
      RxDotsHorizontal: mod.RxDotsHorizontal,
      RxDotsVertical: mod.RxDotsVertical
    }
  }))
);

export const LazyLucideIcons = lazy(() => 
  import('lucide-react').then(mod => ({
    default: {
      Search: mod.Search,
      Home: mod.Home,
      Library: mod.Library,
      Heart: mod.Heart,
      Play: mod.Play,
      Pause: mod.Pause,
      SkipBack: mod.SkipBack,
      SkipForward: mod.SkipForward,
      Volume: mod.Volume,
      VolumeX: mod.VolumeX,
      Shuffle: mod.Shuffle,
      Repeat: mod.Repeat,
      Plus: mod.Plus,
      Minus: mod.Minus,
      X: mod.X,
      Menu: mod.Menu,
      Settings: mod.Settings,
      User: mod.User,
      Calendar: mod.Calendar,
      MapPin: mod.MapPin,
      ExternalLink: mod.ExternalLink,
      Share: mod.Share,
      Info: mod.Info,
      AlertCircle: mod.AlertCircle,
      CheckCircle: mod.CheckCircle,
      XCircle: mod.XCircle,
      Loader: mod.Loader,
      ChevronLeft: mod.ChevronLeft,
      ChevronRight: mod.ChevronRight,
      ChevronUp: mod.ChevronUp,
      ChevronDown: mod.ChevronDown,
      ArrowLeft: mod.ArrowLeft,
      ArrowRight: mod.ArrowRight,
      ArrowUp: mod.ArrowUp,
      ArrowDown: mod.ArrowDown,
      Filter: mod.Filter,
      Mic: mod.Mic,
      History: mod.History,
      TrendingUp: mod.TrendingUp,
      Star: mod.Star,
      Fire: mod.Fire,
      Users: mod.Users,
      Clock: mod.Clock,
      Ticket: mod.Ticket,
      Music: mod.Music,
      Headphones: mod.Headphones,
      Smartphone: mod.Smartphone,
      Tablet: mod.Tablet,
      Monitor: mod.Monitor,
      Wifi: mod.Wifi,
      WifiOff: mod.WifiOff,
      Download: mod.Download,
      Upload: mod.Upload,
      Eye: mod.Eye,
      EyeOff: mod.EyeOff,
      Lock: mod.Lock,
      Unlock: mod.Unlock,
      Key: mod.Key,
      Shield: mod.Shield,
      AlertTriangle: mod.AlertTriangle,
      HelpCircle: mod.HelpCircle,
      Mail: mod.Mail,
      Phone: mod.Phone,
      Globe: mod.Globe,
      Camera: mod.Camera,
      Image: mod.Image,
      FileText: mod.FileText,
      Folder: mod.Folder,
      Archive: mod.Archive,
      Trash: mod.Trash,
      Edit: mod.Edit,
      Save: mod.Save,
      Copy: mod.Copy,
      Scissors: mod.Scissors,
      Clipboard: mod.Clipboard,
      Link: mod.Link,
      Bookmark: mod.Bookmark,
      Flag: mod.Flag,
      Bell: mod.Bell,
      BellOff: mod.BellOff,
      MessageCircle: mod.MessageCircle,
      MessageSquare: mod.MessageSquare,
      Send: mod.Send,
      ThumbsUp: mod.ThumbsUp,
      ThumbsDown: mod.ThumbsDown,
      Zap: mod.Zap,
      Battery: mod.Battery,
      BatteryLow: mod.BatteryLow,
      Power: mod.Power,
      Refresh: mod.Refresh,
      RotateCcw: mod.RotateCcw,
      RotateCw: mod.RotateCw,
      Maximize: mod.Maximize,
      Minimize: mod.Minimize,
      Square: mod.Square,
      Circle: mod.Circle,
      Triangle: mod.Triangle,
      Diamond: mod.Diamond,
      Hexagon: mod.Hexagon,
      Octagon: mod.Octagon,
      Command: mod.Command,
      Option: mod.Option,
      Shift: mod.Shift,
      Control: mod.Control,
      Alt: mod.Alt,
      Tab: mod.Tab,
      Space: mod.Space,
      Enter: mod.Enter,
      Backspace: mod.Backspace,
      Delete: mod.Delete,
      Escape: mod.Escape,
      ChevronsLeft: mod.ChevronsLeft,
      ChevronsRight: mod.ChevronsRight,
      ChevronsUp: mod.ChevronsUp,
      ChevronsDown: mod.ChevronsDown,
      MoreHorizontal: mod.MoreHorizontal,
      MoreVertical: mod.MoreVertical
    }
  }))
);

// Icon placeholder component
export const IconPlaceholder = ({ size = 20 }: { size?: number }) => (
  <div 
    className="bg-neutral-700 rounded animate-pulse"
    style={{ width: size, height: size }}
  />
);

// Suspense wrapper for icons
export const SuspenseIcon = ({ 
  children, 
  size = 20 
}: { 
  children: React.ReactNode; 
  size?: number; 
}) => (
  <Suspense fallback={<IconPlaceholder size={size} />}>
    {children}
  </Suspense>
);

// Optimized icon component with lazy loading
export const OptimizedIcon = ({ 
  iconSet, 
  iconName, 
  size = 20, 
  className = '',
  ...props 
}: {
  iconSet: 'bi' | 'fa' | 'hi' | 'rx' | 'lucide';
  iconName: string;
  size?: number;
  className?: string;
  [key: string]: any;
}) => {
  const IconComponent = () => {
    switch (iconSet) {
      case 'bi':
        return (
          <LazyReactIcons>
            {({ BiSearch, BiX, BiFilter, BiMicrophone, BiHistory, BiTrendingUp, BiChevronDown, BiHome, BiCalendar, BiUser, BiHeart, BiPlay, BiPause, BiSkipNext, BiSkipPrevious, BiVolume, BiVolumeMute, BiShuffle, BiRepeat, BiPlus, BiMinus, BiCheck, BiError, BiInfoCircle, BiWarning, BiLoader, BiChevronLeft, BiChevronRight, BiChevronUp, BiMenu, BiClose, BiSettings, BiLogOut, BiLogIn }) => {
              const Icon = (({ BiSearch, BiX, BiFilter, BiMicrophone, BiHistory, BiTrendingUp, BiChevronDown, BiHome, BiCalendar, BiUser, BiHeart, BiPlay, BiPause, BiSkipNext, BiSkipPrevious, BiVolume, BiVolumeMute, BiShuffle, BiRepeat, BiPlus, BiMinus, BiCheck, BiError, BiInfoCircle, BiWarning, BiLoader, BiChevronLeft, BiChevronRight, BiChevronUp, BiMenu, BiClose, BiSettings, BiLogOut, BiLogIn } as any)[iconName]);
              return Icon ? <Icon size={size} className={className} {...props} /> : <IconPlaceholder size={size} />;
            }}
          </LazyReactIcons>
        );
      case 'fa':
        return (
          <LazyFaIcons>
            {({ FaSpotify, FaCalendar, FaMapMarkerAlt, FaUserAlt, FaMusic, FaTicketAlt, FaThumbsUp, FaThumbsDown, FaFire, FaStar, FaRegStar, FaHeart, FaRegHeart, FaShare, FaExternalLinkAlt, FaInstagram, FaTwitter, FaFacebook, FaYoutube, FaApple, FaGoogle, FaGithub }) => {
              const Icon = (({ FaSpotify, FaCalendar, FaMapMarkerAlt, FaUserAlt, FaMusic, FaTicketAlt, FaThumbsUp, FaThumbsDown, FaFire, FaStar, FaRegStar, FaHeart, FaRegHeart, FaShare, FaExternalLinkAlt, FaInstagram, FaTwitter, FaFacebook, FaYoutube, FaApple, FaGoogle, FaGithub } as any)[iconName]);
              return Icon ? <Icon size={size} className={className} {...props} /> : <IconPlaceholder size={size} />;
            }}
          </LazyFaIcons>
        );
      case 'hi':
        return (
          <LazyHiIcons>
            {({ HiHome, HiSearch, HiLibrary, HiPlus, HiHeart, HiUser, HiCog, HiLogout, HiMenu, HiX, HiPlay, HiPause, HiVolumeUp, HiVolumeOff, HiRefresh, HiExternalLink, HiInformationCircle, HiExclamation, HiCheckCircle, HiXCircle }) => {
              const Icon = (({ HiHome, HiSearch, HiLibrary, HiPlus, HiHeart, HiUser, HiCog, HiLogout, HiMenu, HiX, HiPlay, HiPause, HiVolumeUp, HiVolumeOff, HiRefresh, HiExternalLink, HiInformationCircle, HiExclamation, HiCheckCircle, HiXCircle } as any)[iconName]);
              return Icon ? <Icon size={size} className={className} {...props} /> : <IconPlaceholder size={size} />;
            }}
          </LazyHiIcons>
        );
      case 'rx':
        return (
          <LazyRxIcons>
            {({ RxCaretLeft, RxCaretRight, RxCaretUp, RxCaretDown, RxChevronLeft, RxChevronRight, RxChevronUp, RxChevronDown, RxCross1, RxCross2, RxPlus, RxMinus, RxDot, RxDotsHorizontal, RxDotsVertical }) => {
              const Icon = (({ RxCaretLeft, RxCaretRight, RxCaretUp, RxCaretDown, RxChevronLeft, RxChevronRight, RxChevronUp, RxChevronDown, RxCross1, RxCross2, RxPlus, RxMinus, RxDot, RxDotsHorizontal, RxDotsVertical } as any)[iconName]);
              return Icon ? <Icon size={size} className={className} {...props} /> : <IconPlaceholder size={size} />;
            }}
          </LazyRxIcons>
        );
      case 'lucide':
        return (
          <LazyLucideIcons>
            {(icons) => {
              const Icon = (icons as any)[iconName];
              return Icon ? <Icon size={size} className={className} {...props} /> : <IconPlaceholder size={size} />;
            }}
          </LazyLucideIcons>
        );
      default:
        return <IconPlaceholder size={size} />;
    }
  };

  return (
    <SuspenseIcon size={size}>
      <IconComponent />
    </SuspenseIcon>
  );
};