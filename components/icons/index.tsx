import React from 'react';
import { 
  Trash2, 
  Calendar, 
  Pencil, 
  Eye, 
  Search, 
  Gavel, 
  ClipboardList, 
  AlarmClock, 
  FileCheck, 
  PlusCircle, 
  Lightbulb, 
  MinusCircle, 
  ChevronDown, 
  ChevronUp, 
  X, 
  FileDown, 
  CheckCircle, 
  Sparkles, 
  Clock, 
  Tag, 
  Menu,
  AlertTriangle,
  Folder,
  Copy,
  Download,
  Upload,
  Plus,
  Check,
  Zap,
  RefreshCw,
  Loader2
} from 'lucide-react';

type IconProps = { className?: string };

// Wrap and export standard Lucide icons under the same names for complete backwards compatibility
export const PlusIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <Plus className={className} />;
export const TrashIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <Trash2 className={className} />;
export const CalendarIcon: React.FC<IconProps> = ({ className = "h-5 w-5 text-gray-400" }) => <Calendar className={className} />;
export const EditIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <Pencil className={className} />;
export const ViewIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <Eye className={className} />;
export const SearchIcon: React.FC<IconProps> = ({ className = "h-5 w-5 text-gray-400" }) => <Search className={className} />;
export const HammerIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <Gavel className={className} />;
export const FormIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <ClipboardList className={className} />;
export const AlarmClockIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <AlarmClock className={className} />;
export const SummarizeIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <FileCheck className={className} />;
export const PlusCircleIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <PlusCircle className={className} />;
export const LightbulbIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <Lightbulb className={className} />;
export const MinusCircleIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <MinusCircle className={className} />;
export const ChevronDownIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <ChevronDown className={className} />;
export const ChevronUpIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <ChevronUp className={className} />;
export const XMarkIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <X className={className} />;
export const DocumentArrowDownIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <FileDown className={className} />;
export const CheckCircleIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <CheckCircle className={className} />;
export const CheckIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <Check className={className} />;
export const ZapIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <Zap className={className} />;
export const RefreshIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <RefreshCw className={className} />;
export const SparklesIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <Sparkles className={className} />;
export const ClockIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <Clock className={className} />;
export const TagIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <Tag className={className} />;
export const PencilIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <Pencil className={className} />;
export const Bars3Icon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <Menu className={className} />;
export const AlertIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <AlertTriangle className={className} />;
export const FolderIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <Folder className={className} />;
export const CopyIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <Copy className={className} />;
export const DownloadIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <Download className={className} />;
export const UploadIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => <Upload className={className} />;
export const LoaderIcon: React.FC<IconProps> = ({ className = "h-5 w-5 animate-spin" }) => <Loader2 className={className} />;

// We keep only the TCEPR Logo as a custom geometric brand SVG to maintain institutional authenticity
export const TceprLogoIcon: React.FC<IconProps> = ({ className = "h-8 w-8" }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <polygon points="50,10 90,82 10,82" fill="#38a8dd" opacity="0.85" />
    <polygon points="42,15 88,72 25,85" fill="#7cc7ea" opacity="0.9" />
    <polygon points="50,18 78,75 50,60 22,75" fill="#ffffff" />
    <polygon points="50,32 63,58 50,51 37,58" fill="#e0f0f9" />
  </svg>
);
