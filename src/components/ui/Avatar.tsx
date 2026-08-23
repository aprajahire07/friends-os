import React, { useState, useEffect } from 'react';
import { Profile } from '../../types';
import { getSyncMediaUrl } from '../../services/storage';

interface AvatarProps {
  profile?: Partial<Profile> | null;
  src?: string | null;
  name?: string;
  username?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
  className?: string;
  onClick?: () => void;
  statusEmoji?: string;
  showStatus?: boolean;
  title?: string;
  alt?: string;
}

const sizeClasses: Record<string, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-20 h-20 text-xl'
};

const getInitials = (text: string): string => {
  if (!text) return 'F';
  const parts = text.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return text.substring(0, 2).toUpperCase();
};

export const Avatar: React.FC<AvatarProps> = ({
  profile,
  src,
  name,
  username,
  size = 'md',
  className = '',
  onClick,
  statusEmoji,
  showStatus = false,
  title,
  alt
}) => {
  const [errorCount, setErrorCount] = useState(0);

  // Extract best identity cues
  const rawUrl = src || profile?.avatar_url;
  const fullName = name || profile?.full_name || 'Friend';
  const uname = username || profile?.username || fullName;
  const emoji = statusEmoji || profile?.status_emoji;

  // Resolve media URL if it's stored in Supabase storage
  const resolvedUrl = React.useMemo(() => {
    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) return null;
    return getSyncMediaUrl('avatars', rawUrl.trim());
  }, [rawUrl]);

  // Generate reliable fallback avatar based on username or initials
  const fallbackUrl = React.useMemo(() => {
    const seed = encodeURIComponent((uname || fullName || 'friend').trim().toLowerCase());
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=0f172a,1e1b4b,172554`;
  }, [uname, fullName]);

  // Reset error status if the input src or profile changes
  useEffect(() => {
    setErrorCount(0);
  }, [resolvedUrl, rawUrl]);

  const sizeClass = typeof size === 'number' ? `w-[${size}px] h-[${size}px]` : (sizeClasses[size] || sizeClasses.md);
  const inlineSize = typeof size === 'number' ? { width: size, height: size } : undefined;

  const currentSrc = errorCount === 0 && resolvedUrl ? resolvedUrl : fallbackUrl;
  const showInitials = errorCount >= 2 || !currentSrc || typeof currentSrc !== 'string' || !currentSrc.trim();

  const initials = getInitials(fullName || uname);

  return (
    <div 
      className={`relative inline-block shrink-0 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      title={title || fullName}
    >
      {showInitials ? (
        <div
          style={inlineSize}
          className={`${sizeClass} rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-extrabold flex items-center justify-center border border-indigo-400/50 shadow-sm select-none ${className}`}
        >
          {initials}
        </div>
      ) : (
        <img
          src={currentSrc}
          alt={alt || fullName}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => {
            setErrorCount((prev) => prev + 1);
          }}
          style={inlineSize}
          className={`${sizeClass} rounded-full object-cover border border-slate-700/80 bg-slate-900 shadow-sm transition-all ${className}`}
        />
      )}

      {showStatus && emoji && (
        <span 
          className="absolute -bottom-1 -right-1 text-[11px] bg-slate-950 px-1 py-0.5 rounded-full border border-slate-800 shadow leading-none pointer-events-none"
        >
          {emoji}
        </span>
      )}
    </div>
  );
};
