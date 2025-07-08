*User**

# **🎯 MySetlist Development Brief \- Transform Spotify Clone to Concert Setlist Voting Platform**

## **Starting Point**

You are working with the **mrwebwork/spotify** template (Next.js 13.4+, Supabase, TypeScript, Tailwind). This is a fully functional Spotify clone that we will transform into MySetlist \- a concert setlist voting platform. 

---

## **🚨 CRITICAL RULES \- READ FIRST**

### **Rule \#1: DELETE ALL MUSIC PLAYBACK**

* **NO audio streaming functionality**  
* **NO song file uploads**  
* **NO music player components**  
* **NO volume controls or audio hooks**  
* Songs in our app are just TEXT (title \+ artist name)

### **Rule \#2: SEARCH \= ARTISTS ONLY**

* Search functionality finds ARTISTS, not songs/venues/shows  
* Keep the existing search page structure but modify for artists

### **Rule \#3: PRESERVE TEMPLATE PATTERNS**

* **Keep**: Supabase client setup, auth flow, modal system, toast notifications  
* **Keep**: File structure patterns, component naming conventions  
* **Keep**: Server/client component separation patterns  
* **Modify**: Repurpose existing components rather than creating from scratch

### **Rule \#4: DATABASE APPROACH**

* **DELETE** existing music tables first, then create new schema  
* Use Supabase migrations for all changes  
* Follow the template's existing database patterns

### **Rule \#5: NO EXTRA FEATURES**

* **NO** user bios, location data, or attendance tracking  
* **NO** Stripe/payments  
* **NO** song preview/streaming  
* **ONLY** core setlist voting functionality

### **Rule \#6: USE 6 SUB-AGENTS AT THE SAME TIME TO GET THIS IMPLEMENTED. ALWAYS ULTRATHINK AND READ UP TO 2000 LINES OF CODE FOR EACH FILE. REVIEW [PRD.MD](http://PRD.MD) HEAVILY AND ULTRATHINK BEFORE IMPLEMENTING.**

---

## **📁 TEMPLATE STRUCTURE YOU'RE WORKING WITH**

spotify-clone/  
├── app/                      \# Next.js 13 App Router  
│   ├── (site)/              \# Public routes group  
│   ├── account/             \# User account (modify for profile)  
│   ├── api/                 \# API routes  
│   ├── liked/               \# DELETE THIS ENTIRELY  
│   ├── search/              \# MODIFY for artist search only  
│   ├── layout.tsx           \# Has providers \- KEEP structure  
│   └── globals.css          \# Tailwind styles  
├── components/                
│   ├── AuthModal.tsx        \# KEEP \- for authentication  
│   ├── Header.tsx           \# MODIFY \- remove player controls  
│   ├── Library.tsx          \# TRANSFORM to "Following Artists"  
│   ├── ListItem.tsx         \# REPURPOSE for show cards  
│   ├── MediaItem.tsx        \# DELETE  
│   ├── Modal.tsx            \# KEEP \- base modal  
│   ├── Player.tsx           \# DELETE ENTIRELY  
│   ├── PlayerContent.tsx    \# DELETE ENTIRELY  
│   ├── PlayButton.tsx       \# DELETE ENTIRELY  
│   ├── Sidebar.tsx          \# MODIFY navigation items  
│   ├── SidebarItem.tsx      \# KEEP  
│   ├── Slider.tsx           \# DELETE (volume control)  
│   ├── SongItem.tsx         \# DELETE ENTIRELY  
│   └── UploadModal.tsx      \# DELETE ENTIRELY  
├── actions/                 \# Server actions  
│   ├── getSongs\*.ts         \# DELETE all song-related  
│   └── (create new ones)    \# for artists, shows, votes  
├── hooks/  
│   ├── useAuthModal.tsx     \# KEEP  
│   ├── useDebounce.tsx      \# KEEP    
│   ├── useLoadImage.tsx     \# REPURPOSE for artist images  
│   ├── useOnPlay.tsx        \# DELETE  
│   ├── usePlayer.tsx        \# DELETE  
│   ├── useSubscribeModal.tsx \# DELETE  
│   └── useUser.tsx          \# KEEP  
├── libs/  
│   ├── helpers.ts           \# KEEP utility functions  
│   ├── stripe.ts            \# DELETE  
│   ├── stripeClient.ts      \# DELETE  
│   └── supabaseClient.ts    \# KEEP  
├── providers/  
│   ├── ModalProvider.tsx    \# KEEP but remove music modals  
│   ├── SupabaseProvider.tsx \# KEEP  
│   ├── ToasterProvider.tsx  \# KEEP  
│   └── UserProvider.tsx     \# KEEP  
└── types.ts                 \# MODIFY with new types

---

## **🗃️ DATABASE TRANSFORMATION**

### **Step 1: Delete Music Tables**

\-- Run these in Supabase SQL editor  
DROP TABLE IF EXISTS songs CASCADE;  
DROP TABLE IF EXISTS liked\_songs CASCADE;  
DROP TABLE IF EXISTS customers CASCADE;  
DROP TABLE IF EXISTS prices CASCADE;  
DROP TABLE IF EXISTS products CASCADE;  
DROP TABLE IF EXISTS subscriptions CASCADE;

### **Step 2: Create New Schema**

\-- Artists table  
CREATE TABLE artists (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  spotify\_id VARCHAR(255) UNIQUE,  
  name VARCHAR(255) NOT NULL,  
  slug VARCHAR(255) UNIQUE NOT NULL,  
  image\_url TEXT,  
  genres JSONB DEFAULT '\[\]',  
  followers INTEGER DEFAULT 0,  
  verified BOOLEAN DEFAULT FALSE,  
  created\_at TIMESTAMPTZ DEFAULT NOW(),  
  updated\_at TIMESTAMPTZ DEFAULT NOW()  
);

\-- Venues table  
CREATE TABLE venues (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  name VARCHAR(255) NOT NULL,  
  slug VARCHAR(255) UNIQUE NOT NULL,  
  city VARCHAR(255) NOT NULL,  
  state VARCHAR(255),  
  country VARCHAR(255) NOT NULL,  
  capacity INTEGER,  
  created\_at TIMESTAMPTZ DEFAULT NOW()  
);

\-- Shows table    
CREATE TABLE shows (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  artist\_id UUID REFERENCES artists(id) ON DELETE CASCADE,  
  venue\_id UUID REFERENCES venues(id),  
  name VARCHAR(255) NOT NULL,  
  date DATE NOT NULL,  
  start\_time TIME,  
  status VARCHAR(20) DEFAULT 'upcoming',  
  ticket\_url TEXT,  
  created\_at TIMESTAMPTZ DEFAULT NOW(),  
  updated\_at TIMESTAMPTZ DEFAULT NOW()  
);

\-- Songs table (just metadata, NO audio)  
CREATE TABLE songs (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  title VARCHAR(255) NOT NULL,  
  artist\_name VARCHAR(255) NOT NULL,  
  spotify\_id VARCHAR(255),  
  created\_at TIMESTAMPTZ DEFAULT NOW()  
);

\-- Setlists table  
CREATE TABLE setlists (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  show\_id UUID REFERENCES shows(id) ON DELETE CASCADE,  
  type VARCHAR(20) NOT NULL CHECK (type IN ('predicted', 'actual')),  
  is\_locked BOOLEAN DEFAULT FALSE,  
  created\_by UUID REFERENCES auth.users(id),  
  created\_at TIMESTAMPTZ DEFAULT NOW()  
);

\-- Setlist songs with voting  
CREATE TABLE setlist\_songs (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  setlist\_id UUID REFERENCES setlists(id) ON DELETE CASCADE,  
  song\_id UUID REFERENCES songs(id),  
  position INTEGER NOT NULL,  
  upvotes INTEGER DEFAULT 0,  
  downvotes INTEGER DEFAULT 0,  
  created\_at TIMESTAMPTZ DEFAULT NOW(),  
  UNIQUE(setlist\_id, position)  
);

\-- Votes table  
CREATE TABLE votes (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  user\_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  
  setlist\_song\_id UUID REFERENCES setlist\_songs(id) ON DELETE CASCADE,  
  vote\_type VARCHAR(10) CHECK (vote\_type IN ('up', 'down')),  
  created\_at TIMESTAMPTZ DEFAULT NOW(),  
  UNIQUE(user\_id, setlist\_song\_id)  
);

\-- User following artists  
CREATE TABLE user\_artists (  
  user\_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  
  artist\_id UUID REFERENCES artists(id) ON DELETE CASCADE,  
  created\_at TIMESTAMPTZ DEFAULT NOW(),  
  PRIMARY KEY(user\_id, artist\_id)  
);

\-- Create indexes  
CREATE INDEX idx\_shows\_date ON shows(date);  
CREATE INDEX idx\_shows\_artist ON shows(artist\_id);  
CREATE INDEX idx\_artists\_slug ON artists(slug);

### **Step 3: RLS Policies**

\-- Enable RLS  
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;  
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;  
ALTER TABLE setlists ENABLE ROW LEVEL SECURITY;  
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

\-- Public read policies  
CREATE POLICY "Anyone can view artists" ON artists FOR SELECT USING (true);  
CREATE POLICY "Anyone can view shows" ON shows FOR SELECT USING (true);  
CREATE POLICY "Anyone can view setlists" ON setlists FOR SELECT USING (true);

\-- Vote policies  
CREATE POLICY "Users can create votes" ON votes   
  FOR INSERT WITH CHECK (auth.uid() \= user\_id);  
CREATE POLICY "Users can update own votes" ON votes   
  FOR UPDATE USING (auth.uid() \= user\_id);

---

## **🔨 IMPLEMENTATION STEPS**

### **Phase 1: Cleanup (Day 1\)**

**Delete Player Components**

 rm components/Player.tsx  
rm components/PlayerContent.tsx  
rm components/PlayButton.tsx  
rm components/Slider.tsx  
rm components/SongItem.tsx  
rm components/MediaItem.tsx  
rm components/UploadModal.tsx  
rm hooks/usePlayer.tsx  
rm hooks/useOnPlay.tsx

1. 

**Remove from layout.tsx**

 // DELETE this line from app/layout.tsx  
import Player from '@/components/Player';  
// DELETE \<Player /\> component from JSX

2. 

**Update types.ts**

 // DELETE all Song, Subscription, Price, Product types  
// ADD:  
export interface Artist {  
  id: string;  
  spotify\_id?: string;  
  name: string;  
  slug: string;  
  image\_url?: string;  
  genres: string\[\];  
  followers: number;  
  verified: boolean;  
}

export interface Show {  
  id: string;  
  artist\_id: string;  
  venue\_id: string;  
  name: string;  
  date: string;  
  start\_time?: string;  
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';  
  artist?: Artist;  
  venue?: Venue;  
}

export interface SetlistSong {  
  id: string;  
  setlist\_id: string;  
  song\_id: string;  
  position: number;  
  upvotes: number;  
  downvotes: number;  
  song?: Song;  
}

3. 

### **Phase 2: Core Components (Day 2-3)**

**Transform Header.tsx**

 // REMOVE all player controls  
// KEEP search functionality but update placeholder  
// REMOVE upload button  
// ADD link to logo:  
\<Link href="/"\>  
  \<h1 className="text-xl font-bold"\>MySetlist\</h1\>  
\</Link\>

1. 

**Create VoteButton.tsx**

 'use client';

import { FaThumbsUp, FaThumbsDown } from 'react-icons/fa';  
import { twMerge } from 'tailwind-merge';

interface VoteButtonProps {  
  upvotes: number;  
  downvotes: number;  
  onVote: (type: 'up' | 'down') \=\> void;  
  disabled?: boolean;  
  userVote?: 'up' | 'down' | null;  
}

const VoteButton: React.FC\<VoteButtonProps\> \= ({  
  upvotes,  
  downvotes,  
  onVote,  
  disabled,  
  userVote  
}) \=\> {  
  const score \= upvotes \- downvotes;

  return (  
    \<div className="flex items-center gap-2"\>  
      \<button  
        onClick={() \=\> onVote('up')}  
        disabled={disabled}  
        className={twMerge(  
          "text-neutral-400 hover:text-white transition",  
          userVote \=== 'up' && "text-green-500",  
          disabled && "opacity-50 cursor-not-allowed"  
        )}  
      \>  
        \<FaThumbsUp size={20} /\>  
      \</button\>  
        
      \<span className={twMerge(  
        "min-w-\[40px\] text-center font-semibold",  
        score \> 0 && "text-green-500",  
        score \< 0 && "text-red-500",  
        score \=== 0 && "text-neutral-400"  
      )}\>  
        {score \> 0 ? \`+${score}\` : score}  
      \</span\>  
        
      \<button  
        onClick={() \=\> onVote('down')}  
        disabled={disabled}  
        className={twMerge(  
          "text-neutral-400 hover:text-white transition",  
          userVote \=== 'down' && "text-red-500",  
          disabled && "opacity-50 cursor-not-allowed"  
        )}  
      \>  
        \<FaThumbsDown size={20} /\>  
      \</button\>  
    \</div\>  
  );  
};

export default VoteButton;

2. 

**Update Sidebar.tsx**

 // Update navigation items:  
const routes \= useMemo(() \=\> \[  
  {  
    icon: HiHome,  
    label: 'Home',  
    active: pathname \=== '/',  
    href: '/',  
  },  
  {  
    icon: BiSearch,  
    label: 'Search Artists',  
    active: pathname \=== '/search',  
    href: '/search',  
  },  
  {  
    icon: RiCalendarLine, // Add this import  
    label: 'Shows',  
    active: pathname?.startsWith('/shows'),  
    href: '/shows',  
  },  
\], \[pathname\]);

3. 

### **Phase 3: New Pages (Day 4-5)**

**Artist Page Structure**

 app/artists/\[slug\]/  
├── page.tsx              \# Artist detail page  
├── loading.tsx           \# Loading skeleton  
└── components/  
    ├── ArtistHeader.tsx  \# Artist info \+ follow button  
    └── ShowsList.tsx     \# Upcoming shows for artist

1. 

**Shows Page Structure**

 app/shows/  
├── page.tsx              \# All upcoming shows  
├── \[id\]/  
│   ├── page.tsx          \# Show detail with setlist  
│   └── components/  
│       ├── ShowInfo.tsx  \# Date, venue, ticket link  
│       └── SetlistVoting.tsx \# Main voting interface  
└── loading.tsx

2. 

### **Phase 4: API Routes (Day 6\)**

**Vote Submission** \- `app/api/votes/route.ts`  
 import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';import { cookies } from 'next/headers';import { NextResponse } from 'next/server';export async function POST(request: Request) {  const supabase \= createRouteHandlerClient({ cookies });    // Get user  const { data: { user } } \= await supabase.auth.getUser();  if (\!user) {    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });  }  const { setlistSongId, voteType } \= await request.json();  // Check existing vote  const { data: existingVote } \= await supabase    .from('votes')    .select()    .eq('user\_id', user.id)    .eq('setlist\_song\_id', setlistSongId)    .single();  if (existingVote) {    if (existingVote.vote\_type \=== voteType) {      // Remove vote if clicking same button      await supabase        .from('votes')        .delete()        .eq('id', existingVote.id);    } else {      // Update vote type      await supabase        .from('votes')        .update({ vote\_type: voteType })        .eq('id', existingVote.id);    }  } else {    // Create new vote    await supabase      .from('votes')      .insert({        user\_id: user.id,        setlist\_song\_id: setlistSongId,        vote\_type: voteType      });  }  // Update vote counts (use Supabase function)  await supabase.rpc('update\_vote\_counts', {    song\_id: setlistSongId  });  return NextResponse.json({ success: true });}

1. 

---

## **🎨 STYLING GUIDELINES**

### **Use Template's Existing Patterns**

* **Colors**: Keep dark theme with `bg-neutral-900`, `bg-neutral-800`  
* **Hover States**: Use `hover:bg-neutral-800/50` pattern  
* **Gradients**: Use template's gradient classes  
* **Spacing**: Follow template's padding conventions

### **New Color Accents**

/\* Add to globals.css \*/  
.text-upvote {  
  @apply text-green-500;  
}

.text-downvote {  
  @apply text-red-500;  
}

.bg-show-card {  
  @apply bg-gradient-to-b from-neutral-800/50 to-neutral-900;  
}

---

## **⚡ PERFORMANCE REQUIREMENTS**

1. **Use Template's Image Pattern**

   * Keep using `useLoadImage` hook for artist images  
   * Follow same loading states as template  
2. **Server Components**

   * Keep pages as server components (like template)  
   * Only use 'use client' for interactive components  
3. **Data Fetching**

   * Follow template's action pattern for data fetching  
   * Create actions in `/actions` folder

---

## **🚫 DO NOT ADD**

1. **No Additional Features**

   * No user profiles beyond basic auth  
   * No social features  
   * No comments/reviews  
   * No direct messaging  
2. **No External Services** (in MVP)

   * No email notifications  
   * No push notifications  
   * No analytics  
3. **No Complex UI**

   * No maps for venues  
   * No data visualizations  
   * No advanced filters

---

## **✅ DEFINITION OF DONE**

The project is complete when:

1. **All music features removed** \- No trace of audio playback  
2. **Core pages working**:  
   * Home shows upcoming concerts  
   * Search finds artists only  
   * Artist pages show their upcoming shows  
   * Show pages display voting interface  
3. **Voting functional** \- Users can upvote/downvote predicted songs  
4. **Auth working** \- Sign up, login, logout via Supabase  
5. **Mobile responsive** \- Works on all screen sizes  
6. **No TypeScript errors** \- Clean build  
7. **Database migrated** \- New schema active

---

## **🎯 FINAL CHECKLIST**

Before considering any task complete:

* \[ \] Removed all audio/streaming code?  
* \[ \] Following template's component patterns?  
* \[ \] Using template's styling conventions?  
* \[ \] Server/client components used correctly?  
* \[ \] Database queries use template's patterns?  
* \[ \] No extra features added?  
* \[ \] Mobile responsive?  
* \[ \] TypeScript types updated?

---

**Remember**: You're TRANSFORMING an existing Spotify clone, not building from scratch. Reuse and repurpose wherever possible. The template's patterns are your guide.




# **MySetlist \- Master Product Requirements Document**

## **Building on Spotify Clone Template Architecture**

---

## **Executive Summary**

This PRD outlines the development of MySetlist, a focused concert setlist voting platform, built by modifying the existing Spotify clone template. The application allows users to search for artists, view upcoming shows, and vote on predicted setlists. **All music streaming/playback features must be removed from the template.**

---

## **Project Overview**

### **Vision**

Transform the Spotify clone into MySetlist \- a platform where music fans can:

* Search for artists (artist search only)  
* View artist tour dates and upcoming shows  
* Vote on predicted setlists before concerts  
* View actual setlists after shows  
* Follow artists to track their tours

### **Technical Foundation \- What to Keep**

From the existing Spotify clone:

* ✅ Next.js 13.4+ App Router structure  
* ✅ Supabase authentication and database  
* ✅ TypeScript implementation  
* ✅ Tailwind CSS \+ responsive design  
* ✅ Authentication system  
* ✅ Modal system  
* ✅ Toast notifications

### **What MUST Be Removed**

* ❌ **ALL music player components**  
* ❌ **Song/track playback functionality**  
* ❌ **Audio file uploads**  
* ❌ **Liked songs system**  
* ❌ **Playlists functionality**  
* ❌ **Song library features**  
* ❌ **Any streaming-related code**  
* ❌ **Stripe integration (not needed)**

---

## **Database Schema Changes**

### **Tables to DELETE from Spotify Clone**

\-- Remove these tables entirely  
DROP TABLE IF EXISTS songs CASCADE;  
DROP TABLE IF EXISTS liked\_songs CASCADE;  
DROP TABLE IF EXISTS playlists CASCADE;  
DROP TABLE IF EXISTS playlist\_songs CASCADE;

### **Tables to CREATE**

\-- Artists table  
CREATE TABLE artists (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  spotify\_id VARCHAR(255) UNIQUE,  
  name VARCHAR(255) NOT NULL,  
  slug VARCHAR(255) UNIQUE NOT NULL,  
  image\_url TEXT,  
  genres TEXT\[\],   
  popularity INTEGER DEFAULT 0,  
  followers INTEGER DEFAULT 0,  
  verified BOOLEAN DEFAULT FALSE,  
  created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  
  updated\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  
);

\-- Venues table  
CREATE TABLE venues (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  name VARCHAR(255) NOT NULL,  
  slug VARCHAR(255) UNIQUE NOT NULL,  
  city VARCHAR(255) NOT NULL,  
  state VARCHAR(255),  
  country VARCHAR(255) NOT NULL,  
  capacity INTEGER,  
  created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  
);

\-- Shows table  
CREATE TABLE shows (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  artist\_id UUID REFERENCES artists(id) ON DELETE CASCADE,  
  venue\_id UUID REFERENCES venues(id) ON DELETE SET NULL,  
  name VARCHAR(255) NOT NULL,  
  date DATE NOT NULL,  
  start\_time TIME,  
  status VARCHAR(20) DEFAULT 'upcoming',  
  ticket\_url TEXT,  
  created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  
  updated\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  
);

\-- Songs table (for setlist songs only \- NO audio data)  
CREATE TABLE songs (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  spotify\_id VARCHAR(255),  
  title VARCHAR(255) NOT NULL,  
  artist\_name VARCHAR(255) NOT NULL,  
  created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  
);

\-- Setlists table  
CREATE TABLE setlists (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  show\_id UUID REFERENCES shows(id) ON DELETE CASCADE,  
  type VARCHAR(20) NOT NULL, \-- 'predicted' or 'actual'  
  is\_locked BOOLEAN DEFAULT FALSE,  
  created\_by UUID REFERENCES users(id),  
  created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  
);

\-- Setlist songs table  
CREATE TABLE setlist\_songs (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  setlist\_id UUID REFERENCES setlists(id) ON DELETE CASCADE,  
  song\_id UUID REFERENCES songs(id),  
  position INTEGER NOT NULL,  
  upvotes INTEGER DEFAULT 0,  
  downvotes INTEGER DEFAULT 0,  
  created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  
  UNIQUE(setlist\_id, position)  
);

\-- Votes table  
CREATE TABLE votes (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  user\_id UUID REFERENCES users(id) ON DELETE CASCADE,  
  setlist\_song\_id UUID REFERENCES setlist\_songs(id) ON DELETE CASCADE,  
  vote\_type VARCHAR(10) NOT NULL,  
  created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  
  UNIQUE(user\_id, setlist\_song\_id)  
);

\-- User follows artists  
CREATE TABLE user\_artists (  
  user\_id UUID REFERENCES users(id) ON DELETE CASCADE,  
  artist\_id UUID REFERENCES artists(id) ON DELETE CASCADE,  
  created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  
  PRIMARY KEY(user\_id, artist\_id)  
);

---

## **Components to REMOVE**

### **Delete These Files/Folders Entirely:**

DELETE:  
├── components/  
│   ├── Player.tsx                 ❌ DELETE  
│   ├── PlayerContent.tsx          ❌ DELETE  
│   ├── PlayButton.tsx             ❌ DELETE  
│   ├── LikeButton.tsx             ❌ DELETE (replace with FollowButton)  
│   ├── MediaItem.tsx              ❌ DELETE (if music-specific)  
│   ├── Library.tsx                ❌ DELETE (replace with Following)  
│   ├── SongItem.tsx               ❌ DELETE  
│   ├── UploadModal.tsx            ❌ DELETE  
│   └── Slider.tsx                 ❌ DELETE (if for volume)  
├── hooks/  
│   ├── usePlayer.tsx              ❌ DELETE  
│   ├── useOnPlay.tsx              ❌ DELETE  
│   ├── useLoadImage.tsx           ❌ DELETE (if for songs)  
│   └── useGetSongById.tsx         ❌ DELETE  
├── actions/  
│   ├── getSongs.ts                ❌ DELETE  
│   ├── getLikedSongs.ts           ❌ DELETE  
│   ├── getSongsByUserId.ts        ❌ DELETE  
│   └── getSongsByTitle.ts         ❌ DELETE

---

## **New Application Structure**

mysetlist/  
├── app/  
│   ├── (site)/                      
│   │   ├── page.tsx              \# Homepage \- trending shows  
│   │   └── components/  
│   │       ├── ShowList.tsx        
│   │       └── TrendingShows.tsx  
│   ├── search/                      
│   │   └── page.tsx              \# ARTIST SEARCH ONLY  
│   ├── artists/                     
│   │   ├── \[slug\]/  
│   │   │   ├── page.tsx            
│   │   │   └── components/  
│   │   │       ├── ArtistHeader.tsx  
│   │   │       └── ShowsList.tsx  
│   ├── shows/                       
│   │   ├── \[id\]/  
│   │   │   ├── page.tsx            
│   │   │   └── components/  
│   │   │       ├── SetlistVoting.tsx  
│   │   │       └── ShowDetails.tsx  
│   ├── account/                     
│   │   └── page.tsx              \# User profile, following  
│   ├── api/  
│   │   ├── artists/  
│   │   ├── shows/  
│   │   ├── setlists/  
│   │   └── votes/  
│   └── layout.tsx                  
├── components/  
│   ├── Header.tsx                \# Simplify \- remove player controls  
│   ├── Sidebar.tsx               \# Update navigation items  
│   ├── Modal.tsx                 \# Keep for general use  
│   ├── Button.tsx                \# Keep  
│   ├── Input.tsx                 \# Keep  
│   ├── ArtistCard.tsx            \# NEW  
│   ├── ShowCard.tsx              \# NEW  
│   ├── VoteButton.tsx            \# NEW  
│   └── FollowButton.tsx          \# NEW  
├── hooks/  
│   ├── useUser.tsx               \# Keep  
│   ├── useSupabaseClient.tsx     \# Keep  
│   ├── useDebounce.tsx           \# Keep  
│   └── useVoting.tsx             \# NEW  
├── types/  
│   └── index.ts                  \# Update with new types  
└── lib/  
    ├── supabaseClient.ts         \# Keep  
    └── helpers.ts                \# Keep utilities

---

## **Core Features Implementation**

### **1\. Homepage \- Trending Shows**

// app/(site)/page.tsx  
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';  
import { cookies } from 'next/headers';  
import ShowList from './components/ShowList';

export default async function Home() {  
  const supabase \= createServerComponentClient({ cookies });  
    
  // Get upcoming shows  
  const { data: shows } \= await supabase  
    .from('shows')  
    .select(\`  
      \*,  
      artist:artists(\*),  
      venue:venues(\*)  
    \`)  
    .gte('date', new Date().toISOString())  
    .order('date', { ascending: true })  
    .limit(20);

  return (  
    \<div className="bg-neutral-900 rounded-lg h-full w-full overflow-hidden overflow-y-auto"\>  
      \<div className="mb-2 px-6"\>  
        \<h1 className="text-white text-3xl font-semibold mt-4"\>  
          Upcoming Shows  
        \</h1\>  
        \<ShowList shows={shows || \[\]} /\>  
      \</div\>  
    \</div\>  
  );  
}

### **2\. Artist Search (ONLY Search Feature)**

// app/search/page.tsx  
'use client';

import { useState, useEffect } from 'react';  
import { useSupabaseClient } from '@/hooks/useSupabaseClient';  
import { useDebounce } from '@/hooks/useDebounce';  
import Input from '@/components/Input';  
import ArtistCard from '@/components/ArtistCard';

export default function Search() {  
  const \[searchTerm, setSearchTerm\] \= useState('');  
  const \[artists, setArtists\] \= useState(\[\]);  
  const \[loading, setLoading\] \= useState(false);  
  const debouncedSearch \= useDebounce(searchTerm, 500);  
  const supabase \= useSupabaseClient();

  useEffect(() \=\> {  
    if (\!debouncedSearch) {  
      setArtists(\[\]);  
      return;  
    }

    const searchArtists \= async () \=\> {  
      setLoading(true);  
      const { data } \= await supabase  
        .from('artists')  
        .select('\*')  
        .ilike('name', \`%${debouncedSearch}%\`)  
        .limit(20);  
        
      setArtists(data || \[\]);  
      setLoading(false);  
    };

    searchArtists();  
  }, \[debouncedSearch, supabase\]);

  return (  
    \<div className="bg-neutral-900 rounded-lg h-full w-full overflow-hidden overflow-y-auto"\>  
      \<div className="mb-2 px-6"\>  
        \<h1 className="text-white text-3xl font-semibold mt-4"\>  
          Search Artists  
        \</h1\>  
        \<Input  
          placeholder="Search for artists..."  
          value={searchTerm}  
          onChange={(e) \=\> setSearchTerm(e.target.value)}  
          className="mt-4"  
        /\>  
          
        {loading && \<p className="text-neutral-400 mt-4"\>Searching...\</p\>}  
          
        \<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mt-6"\>  
          {artists.map((artist) \=\> (  
            \<ArtistCard key={artist.id} artist={artist} /\>  
          ))}  
        \</div\>  
      \</div\>  
    \</div\>  
  );  
}

### **3\. Setlist Voting Component**

// app/shows/\[id\]/components/SetlistVoting.tsx  
'use client';

import { useState, useEffect } from 'react';  
import { useUser } from '@/hooks/useUser';  
import { useSupabaseClient } from '@/hooks/useSupabaseClient';  
import VoteButton from '@/components/VoteButton';  
import toast from 'react-hot-toast';

interface SetlistVotingProps {  
  setlistId: string;  
  initialSongs: any\[\];  
  isLocked: boolean;  
}

export default function SetlistVoting({   
  setlistId,   
  initialSongs,  
  isLocked   
}: SetlistVotingProps) {  
  const \[songs, setSongs\] \= useState(initialSongs);  
  const { user } \= useUser();  
  const supabase \= useSupabaseClient();

  // Real-time subscription  
  useEffect(() \=\> {  
    const channel \= supabase  
      .channel(\`setlist-${setlistId}\`)  
      .on(  
        'postgres\_changes',  
        {  
          event: '\*',  
          schema: 'public',  
          table: 'setlist\_songs',  
          filter: \`setlist\_id=eq.${setlistId}\`  
        },  
        (payload: any) \=\> {  
          // Update vote counts in real-time  
          setSongs(current \=\>   
            current.map(song \=\>   
              song.id \=== payload.new.id   
                ? { ...song, ...payload.new }  
                : song  
            )  
          );  
        }  
      )  
      .subscribe();

    return () \=\> {  
      supabase.removeChannel(channel);  
    };  
  }, \[setlistId, supabase\]);

  const handleVote \= async (songId: string, voteType: 'up' | 'down') \=\> {  
    if (\!user) {  
      toast.error('Please sign in to vote');  
      return;  
    }

    if (isLocked) {  
      toast.error('Voting is closed for this show');  
      return;  
    }

    try {  
      const response \= await fetch('/api/votes', {  
        method: 'POST',  
        headers: { 'Content-Type': 'application/json' },  
        body: JSON.stringify({  
          setlistSongId: songId,  
          voteType,  
          userId: user.id  
        })  
      });

      if (\!response.ok) throw new Error('Vote failed');  
      toast.success('Vote recorded\!');  
    } catch (error) {  
      toast.error('Failed to submit vote');  
    }  
  };

  return (  
    \<div className="space-y-2"\>  
      \<h3 className="text-xl font-semibold text-white mb-4"\>  
        Predicted Setlist  
      \</h3\>  
      {songs  
        .sort((a, b) \=\> (b.upvotes \- b.downvotes) \- (a.upvotes \- a.downvotes))  
        .map((song, index) \=\> (  
          \<div  
            key={song.id}  
            className="flex items-center gap-4 p-4 bg-neutral-800 rounded-lg"  
          \>  
            \<span className="text-neutral-400 w-8"\>{index \+ 1}\</span\>  
            \<div className="flex-1"\>  
              \<p className="text-white font-medium"\>{song.song.title}\</p\>  
              \<p className="text-neutral-400 text-sm"\>{song.song.artist\_name}\</p\>  
            \</div\>  
            \<VoteButton  
              songId={song.id}  
              upvotes={song.upvotes}  
              downvotes={song.downvotes}  
              onVote={handleVote}  
              disabled={isLocked || \!user}  
            /\>  
          \</div\>  
        ))}  
    \</div\>  
  );  
}

### **4\. Updated Navigation (Remove Music Features)**

// components/Sidebar.tsx  
'use client';

import { usePathname } from 'next/navigation';  
import { useMemo } from 'react';  
import { HiHome } from 'react-icons/hi';  
import { BiSearch } from 'react-icons/bi';  
import { FaCalendarAlt } from 'react-icons/fa';  
import Box from './Box';  
import SidebarItem from './SidebarItem';

interface SidebarProps {  
  children: React.ReactNode;  
}

const Sidebar: React.FC\<SidebarProps\> \= ({ children }) \=\> {  
  const pathname \= usePathname();

  const routes \= useMemo(() \=\> \[  
    {  
      icon: HiHome,  
      label: 'Home',  
      active: pathname \=== '/',  
      href: '/'  
    },  
    {  
      icon: BiSearch,  
      label: 'Search Artists',  
      active: pathname \=== '/search',  
      href: '/search'  
    },  
    {  
      icon: FaCalendarAlt,  
      label: 'Shows',  
      active: pathname \=== '/shows',  
      href: '/shows'  
    }  
  \], \[pathname\]);

  return (  
    \<div className="flex h-full"\>  
      \<div className="hidden md:flex flex-col gap-y-2 bg-black h-full w-\[300px\] p-2"\>  
        \<Box\>  
          \<div className="flex flex-col gap-y-4 px-5 py-4"\>  
            {routes.map((item) \=\> (  
              \<SidebarItem key={item.label} {...item} /\>  
            ))}  
          \</div\>  
        \</Box\>  
        \<Box className="overflow-y-auto h-full"\>  
          {/\* Following artists list \*/}  
          \<div className="px-5 py-4"\>  
            \<h2 className="text-neutral-400 font-medium"\>Following\</h2\>  
            {/\* Artist list component here \*/}  
          \</div\>  
        \</Box\>  
      \</div\>  
      \<main className="h-full flex-1 overflow-y-auto py-2"\>  
        {children}  
      \</main\>  
    \</div\>  
  );  
};

export default Sidebar;

### **5\. Remove Player from Layout**

// app/layout.tsx  
// REMOVE ALL PLAYER IMPORTS AND USAGE  
import './globals.css';  
import { Figtree } from 'next/font/google';  
import Sidebar from '@/components/Sidebar';  
import SupabaseProvider from '@/providers/SupabaseProvider';  
import UserProvider from '@/providers/UserProvider';  
import ModalProvider from '@/providers/ModalProvider';  
import ToasterProvider from '@/providers/ToasterProvider';  
// ❌ REMOVE: import Player from '@/components/Player';

const font \= Figtree({ subsets: \['latin'\] });

export default function RootLayout({  
  children,  
}: {  
  children: React.ReactNode;  
}) {  
  return (  
    \<html lang="en"\>  
      \<body className={font.className}\>  
        \<ToasterProvider /\>  
        \<SupabaseProvider\>  
          \<UserProvider\>  
            \<ModalProvider /\>  
            \<Sidebar\>  
              {children}  
            \</Sidebar\>  
            {/\* ❌ REMOVE: \<Player /\> \*/}  
          \</UserProvider\>  
        \</SupabaseProvider\>  
      \</body\>  
    \</html\>  
  );  
}

---

## **API Routes**

### **Vote Submission**

// app/api/votes/route.ts  
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';  
import { cookies } from 'next/headers';  
import { NextResponse } from 'next/server';

export async function POST(request: Request) {  
  const { setlistSongId, voteType, userId } \= await request.json();  
  const supabase \= createRouteHandlerClient({ cookies });

  // Check existing vote  
  const { data: existingVote } \= await supabase  
    .from('votes')  
    .select()  
    .eq('user\_id', userId)  
    .eq('setlist\_song\_id', setlistSongId)  
    .single();

  if (existingVote) {  
    // Update existing vote  
    await supabase  
      .from('votes')  
      .update({ vote\_type: voteType })  
      .eq('id', existingVote.id);  
  } else {  
    // Create new vote  
    await supabase  
      .from('votes')  
      .insert({   
        user\_id: userId,   
        setlist\_song\_id: setlistSongId,   
        vote\_type: voteType   
      });  
  }

  // Update vote counts  
  const updateField \= voteType \=== 'up' ? 'upvotes' : 'downvotes';  
  await supabase.rpc(\`increment\_${updateField}\`, {   
    song\_id: setlistSongId   
  });

  return NextResponse.json({ success: true });  
}

---

## **Components to Create**

### **VoteButton Component**

// components/VoteButton.tsx  
'use client';

import { FaThumbsUp, FaThumbsDown } from 'react-icons/fa';

interface VoteButtonProps {  
  songId: string;  
  upvotes: number;  
  downvotes: number;  
  onVote: (songId: string, type: 'up' | 'down') \=\> void;  
  disabled?: boolean;  
}

const VoteButton: React.FC\<VoteButtonProps\> \= ({  
  songId,  
  upvotes,  
  downvotes,  
  onVote,  
  disabled  
}) \=\> {  
  const netVotes \= upvotes \- downvotes;

  return (  
    \<div className="flex items-center gap-2"\>  
      \<button  
        onClick={() \=\> onVote(songId, 'up')}  
        disabled={disabled}  
        className="text-neutral-400 hover:text-white transition disabled:opacity-50"  
      \>  
        \<FaThumbsUp size={16} /\>  
      \</button\>  
      \<span className={\`text-sm font-medium ${  
        netVotes \> 0 ? 'text-green-500' :   
        netVotes \< 0 ? 'text-red-500' :   
        'text-neutral-400'  
      }\`}\>  
        {netVotes \> 0 ? \`+${netVotes}\` : netVotes}  
      \</span\>  
      \<button  
        onClick={() \=\> onVote(songId, 'down')}  
        disabled={disabled}  
        className="text-neutral-400 hover:text-white transition disabled:opacity-50"  
      \>  
        \<FaThumbsDown size={16} /\>  
      \</button\>  
    \</div\>  
  );  
};

export default VoteButton;

### **ArtistCard Component**

// components/ArtistCard.tsx  
'use client';

import Image from 'next/image';  
import { useRouter } from 'next/navigation';  
import FollowButton from './FollowButton';

interface ArtistCardProps {  
  artist: {  
    id: string;  
    name: string;  
    image\_url?: string;  
    slug: string;  
    followers: number;  
  };  
}

const ArtistCard: React.FC\<ArtistCardProps\> \= ({ artist }) \=\> {  
  const router \= useRouter();

  return (  
    \<div   
      onClick={() \=\> router.push(\`/artists/${artist.slug}\`)}  
      className="relative group flex flex-col items-center justify-center rounded-md overflow-hidden gap-x-4 bg-neutral-400/5 cursor-pointer hover:bg-neutral-400/10 transition p-3"  
    \>  
      \<div className="relative aspect-square w-full h-full rounded-md overflow-hidden"\>  
        \<Image  
          className="object-cover"  
          src={artist.image\_url || '/images/placeholder.png'}  
          fill  
          alt={artist.name}  
        /\>  
      \</div\>  
      \<div className="flex flex-col items-start w-full pt-4 gap-y-1"\>  
        \<p className="font-semibold truncate w-full"\>{artist.name}\</p\>  
        \<p className="text-neutral-400 text-sm pb-2 truncate w-full"\>  
          {artist.followers.toLocaleString()} followers  
        \</p\>  
      \</div\>  
      \<div className="absolute bottom-24 right-5"\>  
        \<FollowButton artistId={artist.id} /\>  
      \</div\>  
    \</div\>  
  );  
};

export default ArtistCard;

---

## **Performance & Security**

### **Database Indexes**

\-- Performance indexes  
CREATE INDEX idx\_shows\_date ON shows(date);  
CREATE INDEX idx\_shows\_artist\_id ON shows(artist\_id);  
CREATE INDEX idx\_artists\_slug ON artists(slug);  
CREATE INDEX idx\_venues\_city ON venues(city);  
CREATE INDEX idx\_setlist\_songs\_setlist\_id ON setlist\_songs(setlist\_id);  
CREATE INDEX idx\_votes\_user\_id ON votes(user\_id);

### **Row Level Security**

\-- Users can only vote once per song  
CREATE POLICY "Users can create their own votes" ON votes  
  FOR INSERT WITH CHECK (auth.uid() \= user\_id);

\-- Anyone can read votes  
CREATE POLICY "Votes are public" ON votes  
  FOR SELECT USING (true);

\-- Users can update their own votes  
CREATE POLICY "Users can update own votes" ON votes  
  FOR UPDATE USING (auth.uid() \= user\_id);

---

## **Deployment Checklist**

1. **Remove ALL Music Features**

   * Delete player components  
   * Remove audio upload functionality  
   * Delete song streaming code  
   * Remove playlist features  
2. **Database Migration**

   * Drop music-related tables  
   * Create new schema  
   * Set up indexes and RLS

**Environment Variables**

 NEXT\_PUBLIC\_SUPABASE\_URL=  
NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=  
SUPABASE\_SERVICE\_ROLE\_KEY=  
SPOTIFY\_CLIENT\_ID=  
SPOTIFY\_CLIENT\_SECRET=  
TICKETMASTER\_API\_KEY=

3.   
4. **External APIs**

   * Spotify: Artist data only (no playback)  
   * Ticketmaster: Show information  
   * Setlist.fm: Historical setlist data

---

## **Critical Implementation Notes**

1. **DO NOT include any music playback features**  
2. **Search is for ARTISTS ONLY \- not songs, venues, or shows**  
3. **Focus on the voting mechanism as the core feature**  
4. **Keep the UI simple and focused on show discovery and voting**  
5. **Remove all Stripe/payment integration**  
6. **No audio file handling or storage**

This PRD provides a clear path to transform the Spotify clone into a focused concert setlist voting application by removing all unnecessary features and adding only the core functionality needed for MySetlist.

**🏗️ TECHNICAL FOUNDATION**

### **Base Template: mrwebwork/spotify**

**Existing Stack:**

* **Frontend**: Next.js 13.4 \+ React \+ TypeScript \+ Tailwind CSS  
* **Backend**: Supabase \+ PostgreSQL  
* **Auth**: Supabase Auth \+ GitHub OAuth  
* **Payments**: Stripe integration  
* **Storage**: Supabase Storage for file uploads  
* **Forms**: react-hook-form \+ react-toast

### **🚫 FEATURES TO COMPLETELY REMOVE**

**Critical**: Strip out ALL music-related functionality:

#### **Remove from Components:**

* ✅ **Player Component**: Delete entire music player  
* ✅ **Audio Playback**: Remove all useSound/audio hooks  
* ✅ **Song Upload**: Delete song upload modals/forms  
* ✅ **Music Library**: Remove "Your Music" sections  
* ✅ **Playlists**: Delete playlist creation/management  
* ✅ **Like Songs**: Remove heart/like functionality for songs  
* ✅ **Premium/Subscription**: Remove Stripe subscription features

#### **Remove from Database:**

* ✅ **Delete Tables**: songs, playlists, playlist\_songs, user\_songs (likes)  
* ✅ **Remove Audio Fields**: song\_path, image\_path from any remaining tables  
* ✅ **Strip Subscriptions**: Remove all Stripe subscription tables

#### **Remove from API Routes:**

* ✅ **Delete Routes**: /api/songs, /api/playlists, /api/likes, /api/subscribe  
* ✅ **Remove Upload Logic**: Delete all file upload for audio

#### **Remove from UI:**

* ✅ **Player Bar**: Delete bottom music player completely  
* ✅ **Upload Modals**: Remove song/playlist upload modals  
* ✅ **Playback Controls**: Delete play/pause/skip buttons  
* ✅ **Volume Controls**: Remove audio controls  
* ✅ **Progress Bars**: Delete song progress indicators

### **✅ FEATURES TO KEEP & ADAPT**

* **Auth System**: Keep Supabase authentication  
* **Layout Structure**: Sidebar \+ main content area  
* **Search Interface**: Adapt for artist search only  
* **Card Components**: Reuse for artists/shows  
* **Form Handling**: Keep react-hook-form for setlist forms  
* **Toast Notifications**: Keep for voting feedback  
* **Responsive Design**: Maintain mobile-first approach\# 🎵 MySetlist \- Product Requirements Document

## **Concert Setlist Voting Platform Built on Spotify Clone Template**

---

## **📋 PROJECT OVERVIEW**

### **Vision Statement**

Transform the existing Spotify clone template into **MySetlist** \- a focused concert setlist voting platform. Users search for artists, find their upcoming shows, and vote on predicted setlists. **NO MUSIC STREAMING OR PLAYBACK** \- purely setlist prediction and voting.

### **Core Concept**

* **Search**: Find artists to see their upcoming shows  
* **Discover**: View artist tour dates and show details  
* **Predict**: Add songs to predicted setlists for upcoming shows  
* **Vote**: Upvote/downvote songs on community-created setlists

### **User Discovery Flow**

1. **Search Artists**: Users search for their favorite artists  
2. **Artist Profile**: Click artist to see all upcoming shows  
3. **Show Details**: Click specific show to see venue info \+ setlist voting  
4. **Vote & Predict**: Add songs to predicted setlist and vote on others' predictions

### **Target Users**

* **Music Fans**: Discover concerts and predict setlists for their favorite artists  
* **Concert Goers**: Engage with setlist predictions and share experiences  
* **Artists**: Share show announcements and engage with fan predictions  
* **Venue Operators**: Manage venue information and show listings

---

## **🏗️ TECHNICAL FOUNDATION**

### **Base Template: mrwebwork/spotify**

**Existing Stack:**

* **Frontend**: Next.js 13.4 \+ React \+ TypeScript \+ Tailwind CSS  
* **Backend**: Supabase \+ PostgreSQL  
* **Auth**: Supabase Auth \+ GitHub OAuth  
* **Payments**: Stripe integration  
* **Storage**: Supabase Storage for file uploads  
* **Forms**: react-hook-form \+ react-toast

**Template Features to Leverage:**

* ✅ Sleek Spotify-like UI/UX design patterns  
* ✅ Supabase authentication system  
* ✅ Audio playback components (adapt for song previews)  
* ✅ File upload system (adapt for artist images)  
* ✅ Responsive mobile-first design  
* ✅ Form validation and error handling

### **Required Adaptations**

* **Database Schema**: Extend beyond songs/playlists to include shows, venues, setlists, votes  
* **API Integration**: Add Spotify Web API, Ticketmaster API, Setlist.fm API  
* **UI Components**: Adapt music player components for setlist voting interface  
* **Real-time Features**: Add live voting updates during shows  
* **Authentication**: Extend to include Spotify OAuth for music data access

---

## **🗄️ DATABASE ARCHITECTURE**

### **Core Tables (Extend Existing Spotify Schema)**

#### **Keep Existing Tables (Adapted)**

\-- Create new songs table (replace existing) \- NO AUDIO FIELDS  
CREATE TABLE songs (  
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  spotify\_id VARCHAR UNIQUE,  
  title VARCHAR NOT NULL,  
  artist VARCHAR NOT NULL, \-- Primary artist name  
  album VARCHAR,  
  album\_art\_url VARCHAR,  
  release\_date DATE,  
  duration\_ms INTEGER,  
  popularity INTEGER DEFAULT 0,  
  is\_explicit BOOLEAN DEFAULT false,  
  created\_at TIMESTAMP DEFAULT NOW(),  
  updated\_at TIMESTAMP DEFAULT NOW()  
);

\-- Extend users table    
ALTER TABLE users ADD COLUMN role user\_role DEFAULT 'user';  
ALTER TABLE users ADD COLUMN spotify\_id VARCHAR;  
ALTER TABLE users ADD COLUMN last\_login\_at TIMESTAMP;

#### **New MySetlist-Specific Tables**

\-- Artists (independent from songs)  
CREATE TABLE artists (  
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  spotify\_id VARCHAR UNIQUE,  
  name VARCHAR NOT NULL,  
  slug VARCHAR UNIQUE NOT NULL,  
  image\_url VARCHAR,  
  small\_image\_url VARCHAR,  
  genres JSONB,  
  popularity INTEGER DEFAULT 0,  
  followers INTEGER DEFAULT 0,  
  monthly\_listeners INTEGER,  
  verified BOOLEAN DEFAULT false,  
  external\_urls JSONB,  
  last\_synced\_at TIMESTAMP,  
  trending\_score DECIMAL DEFAULT 0,  
  created\_at TIMESTAMP DEFAULT NOW(),  
  updated\_at TIMESTAMP DEFAULT NOW()  
);

\-- Venues  
CREATE TABLE venues (  
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  name VARCHAR NOT NULL,  
  slug VARCHAR UNIQUE NOT NULL,  
  address VARCHAR,  
  city VARCHAR NOT NULL,  
  state VARCHAR,  
  country VARCHAR NOT NULL,  
  postal\_code VARCHAR,  
  latitude DECIMAL,  
  longitude DECIMAL,  
  timezone VARCHAR NOT NULL,  
  capacity INTEGER,  
  venue\_type VARCHAR,  
  website VARCHAR,  
  image\_url VARCHAR,  
  description TEXT,  
  amenities JSONB,  
  created\_at TIMESTAMP DEFAULT NOW(),  
  updated\_at TIMESTAMP DEFAULT NOW()  
);

\-- Shows  
CREATE TABLE shows (  
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  headliner\_artist\_id UUID REFERENCES artists(id) NOT NULL,  
  venue\_id UUID REFERENCES venues(id),  
  name VARCHAR NOT NULL,  
  slug VARCHAR UNIQUE NOT NULL,  
  date DATE NOT NULL,  
  start\_time TIME,  
  doors\_time TIME,  
  status show\_status DEFAULT 'upcoming',  
  description TEXT,  
  ticket\_url VARCHAR,  
  min\_price INTEGER,  
  max\_price INTEGER,  
  currency VARCHAR DEFAULT 'USD',  
  view\_count INTEGER DEFAULT 0,  
  attendee\_count INTEGER DEFAULT 0,  
  setlist\_count INTEGER DEFAULT 0,  
  vote\_count INTEGER DEFAULT 0,  
  trending\_score DECIMAL DEFAULT 0,  
  is\_featured BOOLEAN DEFAULT false,  
  is\_verified BOOLEAN DEFAULT false,  
  ticketmaster\_id VARCHAR,  
  setlistfm\_id VARCHAR,  
  created\_at TIMESTAMP DEFAULT NOW(),  
  updated\_at TIMESTAMP DEFAULT NOW()  
);

\-- Setlists (predicted vs actual)  
CREATE TABLE setlists (  
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  show\_id UUID REFERENCES shows(id) NOT NULL,  
  artist\_id UUID REFERENCES artists(id) NOT NULL,  
  type setlist\_type NOT NULL, \-- 'predicted' | 'actual'  
  name VARCHAR DEFAULT 'Main Set',  
  order\_index INTEGER DEFAULT 0,  
  is\_locked BOOLEAN DEFAULT false,  
  total\_votes INTEGER DEFAULT 0,  
  accuracy\_score INTEGER DEFAULT 0, \-- 0-100  
  imported\_from VARCHAR, \-- 'setlist.fm', 'manual', 'api'  
  external\_id VARCHAR,  
  imported\_at TIMESTAMP,  
  created\_by UUID REFERENCES users(id),  
  created\_at TIMESTAMP DEFAULT NOW(),  
  updated\_at TIMESTAMP DEFAULT NOW()  
);

\-- Setlist Songs (many-to-many)  
CREATE TABLE setlist\_songs (  
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  setlist\_id UUID REFERENCES setlists(id) NOT NULL,  
  song\_id UUID REFERENCES songs(id) NOT NULL,  
  position INTEGER NOT NULL,  
  notes VARCHAR, \-- "acoustic", "cover", "new song"  
  is\_played BOOLEAN, \-- For actual setlists  
  play\_time TIMESTAMP,  
  upvotes INTEGER DEFAULT 0,  
  downvotes INTEGER DEFAULT 0,  
  net\_votes INTEGER DEFAULT 0,  
  created\_at TIMESTAMP DEFAULT NOW(),  
  updated\_at TIMESTAMP DEFAULT NOW(),  
  UNIQUE(setlist\_id, position)  
);

\-- Votes  
CREATE TABLE votes (  
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  user\_id UUID REFERENCES users(id) NOT NULL,  
  setlist\_song\_id UUID REFERENCES setlist\_songs(id) NOT NULL,  
  vote\_type vote\_type NOT NULL, \-- 'up' | 'down'  
  created\_at TIMESTAMP DEFAULT NOW(),  
  updated\_at TIMESTAMP DEFAULT NOW(),  
  UNIQUE(user\_id, setlist\_song\_id)  
);

\-- User Follows Artists  
CREATE TABLE user\_artist\_follows (  
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  user\_id UUID REFERENCES users(id) NOT NULL,  
  artist\_id UUID REFERENCES artists(id) NOT NULL,  
  created\_at TIMESTAMP DEFAULT NOW(),  
  UNIQUE(user\_id, artist\_id)  
);

\-- Show Attendees   
CREATE TABLE show\_attendees (  
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  user\_id UUID REFERENCES users(id) NOT NULL,  
  show\_id UUID REFERENCES shows(id) NOT NULL,  
  attendance\_type VARCHAR DEFAULT 'going', \-- 'going', 'interested'  
  created\_at TIMESTAMP DEFAULT NOW(),  
  UNIQUE(user\_id, show\_id)  
);

\-- Enums  
CREATE TYPE user\_role AS ENUM ('user', 'moderator', 'admin');  
CREATE TYPE show\_status AS ENUM ('upcoming', 'ongoing', 'completed', 'cancelled');  
CREATE TYPE setlist\_type AS ENUM ('predicted', 'actual');  
CREATE TYPE vote\_type AS ENUM ('up', 'down');

### **Database Triggers & Functions**

\-- Update vote counts automatically  
CREATE OR REPLACE FUNCTION update\_setlist\_song\_votes()  
RETURNS TRIGGER AS $$  
BEGIN  
  IF TG\_OP \= 'INSERT' THEN  
    UPDATE setlist\_songs   
    SET   
      upvotes \= upvotes \+ CASE WHEN NEW.vote\_type \= 'up' THEN 1 ELSE 0 END,  
      downvotes \= downvotes \+ CASE WHEN NEW.vote\_type \= 'down' THEN 1 ELSE 0 END,  
      net\_votes \= upvotes \- downvotes  
    WHERE id \= NEW.setlist\_song\_id;  
  END IF;  
  RETURN COALESCE(NEW, OLD);  
END;  
$$ LANGUAGE plpgsql;

CREATE TRIGGER setlist\_song\_vote\_trigger  
  AFTER INSERT OR UPDATE OR DELETE ON votes  
  FOR EACH ROW EXECUTE FUNCTION update\_setlist\_song\_votes();

---

## **🎨 UI/UX ARCHITECTURE**

### **Adapt Spotify Template Components**

#### **Core Layout (Modify Existing)**

// app/layout.tsx \- Extend existing layout (REMOVE PLAYER)  
export default function RootLayout({  
  children,  
}: {  
  children: React.ReactNode;  
}) {  
  return (  
    \<html lang="en"\>  
      \<body\>  
        \<SupabaseProvider\>  
          \<UserProvider\>  
            \<ModalProvider /\>  
            \<ToasterProvider /\>  
            {/\* Add new providers \*/}  
            \<RealtimeProvider\>  
              \<div className="h-full flex"\>  
                \<Sidebar /\> {/\* Adapt existing sidebar \*/}  
                \<main className="flex-1 h-full overflow-y-auto"\>  
                  \<Header /\> {/\* Adapt existing header \*/}  
                  {children}  
                \</main\>  
              \</div\>  
              {/\* NO PLAYER COMPONENT \- REMOVED \*/}  
            \</RealtimeProvider\>  
          \</UserProvider\>  
        \</SupabaseProvider\>  
      \</body\>  
    \</html\>  
  );  
}

#### **Navigation Structure (Adapt Sidebar)**

// components/Sidebar.tsx \- Modify existing sidebar  
export const Sidebar \= () \=\> {  
  return (  
    \<div className="flex flex-col gap-y-2 bg-black h-full w-\[300px\] p-2"\>  
      \<Box\>  
        \<div className="flex flex-col gap-y-4 px-5 py-4"\>  
          {/\* Keep existing home/search \- search focused on artists \*/}  
          \<SidebarItem icon={HiHome} label="Home" href="/" /\>  
          \<SidebarItem icon={BiSearch} label="Search Artists" href="/search" /\>  
            
          {/\* Add MySetlist-specific navigation \*/}  
          \<SidebarItem icon={Calendar} label="Upcoming Shows" href="/shows" /\>  
          \<SidebarItem icon={Users} label="Browse Artists" href="/artists" /\>  
        \</div\>  
      \</Box\>  
        
      \<Box className="overflow-y-auto h-full"\>  
        \<Library /\> {/\* Adapt to show followed artists & their upcoming shows \*/}  
      \</Box\>  
    \</div\>  
  );  
};

### **New Page Components**

#### **Show Discovery Page**

// app/(site)/shows/page.tsx  
export default function ShowsPage() {  
  return (  
    \<div className="bg-neutral-900 rounded-lg h-full w-full overflow-hidden overflow-y-auto"\>  
      \<Header\>  
        \<div className="mb-2"\>  
          \<h1 className="text-white text-3xl font-semibold"\>  
            Upcoming Shows  
          \</h1\>  
        \</div\>  
      \</Header\>  
        
      \<div className="px-6 pb-6"\>  
        {/\* Featured Shows Section \*/}  
        \<div className="mb-8"\>  
          \<h2 className="text-white text-2xl font-semibold mb-4"\>  
            Featured Shows  
          \</h2\>  
          \<FeaturedShowsGrid /\>  
        \</div\>  
          
        {/\* Trending Shows \*/}  
        \<div className="mb-8"\>  
          \<h2 className="text-white text-2xl font-semibold mb-4"\>  
            Trending This Week  
          \</h2\>  
          \<TrendingShowsList /\>  
        \</div\>  
          
        {/\* Shows by Location \*/}  
        \<div\>  
          \<h2 className="text-white text-2xl font-semibold mb-4"\>  
            Shows Near You  
          \</h2\>  
          \<NearbyShowsList /\>  
        \</div\>  
      \</div\>  
    \</div\>  
  );  
}

#### **Show Detail Page**

// app/(site)/shows/\[id\]/page.tsx  
export default async function ShowDetailPage({   
  params   
}: {   
  params: { id: string }   
}) {  
  const show \= await getShow(params.id);  
    
  return (  
    \<div className="bg-neutral-900 rounded-lg h-full w-full overflow-hidden overflow-y-auto"\>  
      \<Header className="from-bg-neutral-900"\>  
        \<div className="mt-20"\>  
          \<div className="flex flex-col md:flex-row items-center gap-x-5"\>  
            \<div className="relative h-32 w-32 lg:h-44 lg:w-44"\>  
              \<Image  
                className="object-cover"  
                fill  
                src={show.artist.image\_url || "/images/music-placeholder.png"}  
                alt="Show image"  
              /\>  
            \</div\>  
            \<div className="flex flex-col gap-y-2 mt-4 md:mt-0"\>  
              \<p className="hidden md:block font-semibold text-sm"\>Concert\</p\>  
              \<h1 className="text-white text-4xl sm:text-5xl lg:text-7xl font-bold"\>  
                {show.name}  
              \</h1\>  
              \<div className="flex items-center gap-x-2 text-sm"\>  
                \<p className="text-neutral-400"\>  
                  {show.artist.name} • {format(new Date(show.date), 'PPP')}  
                \</p\>  
              \</div\>  
            \</div\>  
          \</div\>  
        \</div\>  
      \</Header\>  
        
      \<div className="px-6 pb-6"\>  
        \<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8"\>  
          {/\* Main Content \- Predicted Setlist \*/}  
          \<div className="lg:col-span-2"\>  
            \<SetlistVotingInterface showId={show.id} /\>  
          \</div\>  
            
          {/\* Sidebar \*/}  
          \<div className="space-y-6"\>  
            \<ShowInfo show={show} /\>  
            \<AttendeesList showId={show.id} /\>  
            \<VenueInfo venue={show.venue} /\>  
          \</div\>  
        \</div\>  
      \</div\>  
    \</div\>  
  );  
}

### **Setlist Voting Interface (New Core Component)**

// components/SetlistVotingInterface.tsx  
export const SetlistVotingInterface \= ({ showId }: { showId: string }) \=\> {  
  const { user } \= useUser();  
  const \[setlist, setSetlist\] \= useState\<SetlistWithSongs | null\>(null);  
  const \[userVotes, setUserVotes\] \= useState\<Record\<string, 'up' | 'down'\>\>({});  
  const \[newSongQuery, setNewSongQuery\] \= useState('');

  return (  
    \<div className="space-y-6"\>  
      {/\* Add Song to Setlist \*/}  
      {user && (  
        \<div className="bg-neutral-800 rounded-lg p-6"\>  
          \<h3 className="text-white text-xl font-semibold mb-4"\>  
            Predict a Song  
          \</h3\>  
          \<SongSearch   
            onSelect={(song) \=\> addSongToSetlist(song)}  
            placeholder="Search for a song to add to this setlist..."  
          /\>  
        \</div\>  
      )}  
        
      {/\* Current Predicted Setlist \*/}  
      \<div className="bg-neutral-800 rounded-lg p-6"\>  
        \<div className="flex items-center justify-between mb-6"\>  
          \<h3 className="text-white text-xl font-semibold"\>  
            Predicted Setlist  
          \</h3\>  
          \<Badge variant="secondary"\>  
            {setlist?.songs.length || 0} songs  
          \</Badge\>  
        \</div\>  
          
        \<div className="space-y-3"\>  
          {setlist?.songs.map((song, index) \=\> (  
            \<SetlistSongCard  
              key={song.id}  
              song={song}  
              position={index \+ 1}  
              userVote={userVotes\[song.id\]}  
              onVote={(voteType) \=\> handleVote(song.id, voteType)}  
              canVote={\!\!user}  
            /\>  
          )) || (  
            \<p className="text-neutral-400 text-center py-8"\>  
              No songs predicted yet. Be the first to add one\!  
            \</p\>  
          )}  
        \</div\>  
      \</div\>  
        
      {/\* Actual Setlist (if show completed) \*/}  
      {show.status \=== 'completed' && (  
        \<div className="bg-neutral-800 rounded-lg p-6"\>  
          \<h3 className="text-white text-xl font-semibold mb-6"\>  
            Actual Setlist  
          \</h3\>  
          \<ActualSetlistDisplay showId={showId} /\>  
        \</div\>  
      )}  
    \</div\>  
  );  
};

---

## **🔌 API INTEGRATIONS**

### **External API Services**

#### **Spotify Web API Integration**

// lib/spotify-api.ts  
export class SpotifyAPI {  
  private accessToken: string;

  constructor(accessToken: string) {  
    this.accessToken \= accessToken;  
  }

  async searchArtists(query: string, limit \= 20\) {  
    const response \= await fetch(  
      \`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}\&type=artist\&limit=${limit}\`,  
      {  
        headers: {  
          'Authorization': \`Bearer ${this.accessToken}\`  
        }  
      }  
    );  
    return response.json();  
  }

  async getArtist(artistId: string) {  
    const response \= await fetch(  
      \`https://api.spotify.com/v1/artists/${artistId}\`,  
      {  
        headers: {  
          'Authorization': \`Bearer ${this.accessToken}\`  
        }  
      }  
    );  
    return response.json();  
  }

  async getArtistTopTracks(artistId: string, market \= 'US') {  
    const response \= await fetch(  
      \`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=${market}\`,  
      {  
        headers: {  
          'Authorization': \`Bearer ${this.accessToken}\`  
        }  
      }  
    );  
    return response.json();  
  }

  async searchTracks(query: string, artist?: string, limit \= 20\) {  
    const searchQuery \= artist   
      ? \`track:${query} artist:${artist}\`  
      : query;  
      
    const response \= await fetch(  
      \`https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}\&type=track\&limit=${limit}\`,  
      {  
        headers: {  
          'Authorization': \`Bearer ${this.accessToken}\`  
        }  
      }  
    );  
    return response.json();  
  }  
}

#### **Ticketmaster API Integration**

// lib/ticketmaster-api.ts  
export class TicketmasterAPI {  
  private apiKey: string;

  constructor(apiKey: string) {  
    this.apiKey \= apiKey;  
  }

  async searchEvents(options: {  
    keyword?: string;  
    city?: string;  
    stateCode?: string;  
    countryCode?: string;  
    startDateTime?: string;  
    endDateTime?: string;  
    size?: number;  
  }) {  
    const params \= new URLSearchParams({  
      apikey: this.apiKey,  
      ...options  
    });

    const response \= await fetch(  
      \`https://app.ticketmaster.com/discovery/v2/events.json?${params}\`  
    );  
    return response.json();  
  }

  async getEvent(eventId: string) {  
    const response \= await fetch(  
      \`https://app.ticketmaster.com/discovery/v2/events/${eventId}.json?apikey=${this.apiKey}\`  
    );  
    return response.json();  
  }

  async searchVenues(options: {  
    keyword?: string;  
    city?: string;  
    stateCode?: string;  
    countryCode?: string;  
  }) {  
    const params \= new URLSearchParams({  
      apikey: this.apiKey,  
      ...options  
    });

    const response \= await fetch(  
      \`https://app.ticketmaster.com/discovery/v2/venues.json?${params}\`  
    );  
    return response.json();  
  }  
}

### **API Routes (Extend Existing)**

#### **Artist Search API (Simplify Existing)**

// app/api/search/artists/route.ts  
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';  
import { cookies } from 'next/headers';  
import { NextResponse } from 'next/server';

export async function GET(request: Request) {  
  const { searchParams } \= new URL(request.url);  
  const query \= searchParams.get('q');  
  const limit \= parseInt(searchParams.get('limit') || '20');

  if (\!query || query.length \< 2\) {  
    return NextResponse.json({ artists: \[\] });  
  }

  const supabase \= createRouteHandlerClient({ cookies });

  // Search artists by name and genres  
  const { data: artists, error } \= await supabase  
    .from('artists')  
    .select(\`  
      id,  
      name,  
      slug,  
      image\_url,  
      small\_image\_url,  
      genres,  
      followers,  
      verified,  
      \_count\_shows:shows(count)  
    \`)  
    .or(\`name.ilike.%${query}%,genres.cs."${query}"\`)  
    .order('popularity', { ascending: false })  
    .limit(limit);

  if (error) {  
    console.error('Search error:', error);  
    return NextResponse.json({ error: error.message }, { status: 500 });  
  }

  return NextResponse.json({ artists: artists || \[\] });  
}

#### **Voting API**

// app/api/votes/route.ts  
export async function POST(request: Request) {  
  const { setlistSongId, voteType } \= await request.json();  
  const supabase \= createRouteHandlerClient({ cookies });

  // Get current user  
  const { data: { user }, error: userError } \= await supabase.auth.getUser();  
    
  if (userError || \!user) {  
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });  
  }

  // Upsert vote (insert or update)  
  const { data, error } \= await supabase  
    .from('votes')  
    .upsert({  
      user\_id: user.id,  
      setlist\_song\_id: setlistSongId,  
      vote\_type: voteType,  
      updated\_at: new Date().toISOString(),  
    }, {  
      onConflict: 'user\_id,setlist\_song\_id'  
    });

  if (error) {  
    console.error('Vote error:', error);  
    return NextResponse.json({ error: error.message }, { status: 500 });  
  }

  return NextResponse.json({ success: true });  
}

---

## **⚙️ CORE FEATURES IMPLEMENTATION**

### **1\. Artist Discovery & Following**

#### **Artist-Only Search (Adapt Existing Search)**

// components/SearchContent.tsx \- Simplify existing search to artists only  
export const SearchContent \= () \=\> {  
  const \[artists, setArtists\] \= useState(\[\]);  
  const \[isLoading, setIsLoading\] \= useState(false);

  const handleSearch \= async (query: string) \=\> {  
    if (query.length \< 2\) {  
      setArtists(\[\]);  
      return;  
    }

    setIsLoading(true);  
    try {  
      const response \= await fetch(\`/api/search/artists?q=${encodeURIComponent(query)}\`);  
      const data \= await response.json();  
      setArtists(data.artists || \[\]);  
    } catch (error) {  
      console.error('Search failed:', error);  
      setArtists(\[\]);  
    } finally {  
      setIsLoading(false);  
    }  
  };

  return (  
    \<div className="flex flex-col gap-y-6"\>  
      \<SearchInput   
        onSearch={handleSearch}  
        placeholder="Search for artists..."  
        isLoading={isLoading}  
      /\>  
        
      {/\* Artist Results \*/}  
      {artists.length \> 0 && (  
        \<div\>  
          \<h2 className="text-white text-2xl font-semibold mb-4"\>Artists\</h2\>  
          \<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"\>  
            {artists.map((artist) \=\> (  
              \<ArtistCard   
                key={artist.id}   
                artist={artist}  
                href={\`/artists/${artist.slug}\`}  
              /\>  
            ))}  
          \</div\>  
        \</div\>  
      )}  
        
      {/\* Empty State \*/}  
      {\!isLoading && artists.length \=== 0 && (  
        \<div className="text-center py-12"\>  
          \<Music className="w-16 h-16 text-neutral-400 mx-auto mb-4" /\>  
          \<p className="text-neutral-400 text-lg"\>  
            Search for your favorite artists to see their upcoming shows  
          \</p\>  
        \</div\>  
      )}  
    \</div\>  
  );  
};

#### **Artist Following System**

// hooks/useFollowArtist.ts  
export const useFollowArtist \= () \=\> {  
  const { user } \= useUser();  
  const \[followedArtists, setFollowedArtists\] \= useState\<string\[\]\>(\[\]);

  const followArtist \= async (artistId: string) \=\> {  
    if (\!user) return;

    const supabase \= createClientComponentClient();  
    const { error } \= await supabase  
      .from('user\_artist\_follows')  
      .insert({  
        user\_id: user.id,  
        artist\_id: artistId,  
      });

    if (\!error) {  
      setFollowedArtists(prev \=\> \[...prev, artistId\]);  
      toast.success('Artist followed\!');  
    }  
  };

  const unfollowArtist \= async (artistId: string) \=\> {  
    if (\!user) return;

    const supabase \= createClientComponentClient();  
    const { error } \= await supabase  
      .from('user\_artist\_follows')  
      .delete()  
      .eq('user\_id', user.id)  
      .eq('artist\_id', artistId);

    if (\!error) {  
      setFollowedArtists(prev \=\> prev.filter(id \=\> id \!== artistId));  
      toast.success('Artist unfollowed');  
    }  
  };

  return {  
    followedArtists,  
    followArtist,  
    unfollowArtist,  
    isFollowing: (artistId: string) \=\> followedArtists.includes(artistId),  
  };  
};

### **2\. Setlist Voting System**

#### **Real-time Voting Component**

// components/SetlistSongCard.tsx  
export const SetlistSongCard \= ({  
  song,  
  position,  
  userVote,  
  onVote,  
  canVote  
}: SetlistSongCardProps) \=\> {  
  const \[isVoting, setIsVoting\] \= useState(false);

  const handleVote \= async (voteType: 'up' | 'down') \=\> {  
    if (\!canVote || isVoting) return;  
      
    setIsVoting(true);  
    try {  
      const newVote \= userVote \=== voteType ? null : voteType;  
      await onVote(newVote);  
    } finally {  
      setIsVoting(false);  
    }  
  };

  return (  
    \<div className="flex items-center gap-4 p-4 bg-neutral-700 rounded-lg hover:bg-neutral-600 transition"\>  
      {/\* Position \*/}  
      \<div className="w-8 h-8 rounded-full bg-neutral-600 flex items-center justify-center text-sm font-medium"\>  
        {position}  
      \</div\>  
        
      {/\* Song Info \*/}  
      \<div className="flex-1"\>  
        \<h4 className="text-white font-medium"\>{song.song.title}\</h4\>  
        \<p className="text-neutral-400 text-sm"\>{song.song.artist}\</p\>  
        {song.notes && (  
          \<span className="inline-block mt-1 px-2 py-1 bg-neutral-600 text-xs rounded"\>  
            {song.notes}  
          \</span\>  
        )}  
      \</div\>  
        
      {/\* Voting \*/}  
      {canVote && (  
        \<div className="flex items-center gap-2"\>  
          \<button  
            onClick={() \=\> handleVote('up')}  
            disabled={isVoting}  
            className={\`p-2 rounded-full transition ${  
              userVote \=== 'up'   
                ? 'bg-green-600 text-white'   
                : 'hover:bg-neutral-600 text-neutral-400'  
            }\`}  
          \>  
            \<ChevronUp className="w-5 h-5" /\>  
          \</button\>  
            
          \<span className={\`text-sm font-medium min-w-\[2rem\] text-center ${  
            song.net\_votes \> 0 ? 'text-green-400' :  
            song.net\_votes \< 0 ? 'text-red-400' : 'text-neutral-400'  
          }\`}\>  
            {song.net\_votes \> 0 ? \`+${song.net\_votes}\` : song.net\_votes}  
          \</span\>  
            
          \<button  
            onClick={() \=\> handleVote('down')}  
            disabled={isVoting}  
            className={\`p-2 rounded-full transition ${  
              userVote \=== 'down'   
                ? 'bg-red-600 text-white'   
                : 'hover:bg-neutral-600 text-neutral-400'  
            }\`}  
          \>  
            \<ChevronDown className="w-5 h-5" /\>  
          \</button\>  
        \</div\>  
      )}  
        
      {/\* Vote Count \*/}  
      \<div className="flex items-center gap-1 text-sm text-neutral-400"\>  
        \<Users className="w-4 h-4" /\>  
        {song.upvotes \+ song.downvotes}  
      \</div\>  
    \</div\>  
  );  
};

### **3\. Real-time Updates**

#### **Supabase Realtime Integration**

// hooks/useRealtimeSetlist.ts  
export const useRealtimeSetlist \= (showId: string) \=\> {  
  const \[setlist, setSetlist\] \= useState\<SetlistWithSongs | null\>(null);  
  const supabase \= createClientComponentClient();

  useEffect(() \=\> {  
    // Subscribe to setlist changes  
    const channel \= supabase  
      .channel(\`setlist:${showId}\`)  
      .on(  
        'postgres\_changes',  
        {  
          event: '\*',  
          schema: 'public',  
          table: 'setlist\_songs',  
          filter: \`setlist\_id=eq.${showId}\`  
        },  
        (payload) \=\> {  
          if (payload.eventType \=== 'UPDATE') {  
            setSetlist(prev \=\> {  
              if (\!prev) return prev;  
              return {  
                ...prev,  
                songs: prev.songs.map(song \=\>  
                  song.id \=== payload.new.id   
                    ? { ...song, ...payload.new }  
                    : song  
                )  
              };  
            });  
          }  
        }  
      )  
      .subscribe();

    return () \=\> {  
      supabase.removeChannel(channel);  
    };  
  }, \[showId, supabase\]);

  return { setlist, setSetlist };  
};

### **4\. Data Synchronization**

#### **Background Sync Jobs (Extend Existing)**

// app/api/sync/shows/route.ts  
export async function POST(request: Request) {  
  const { searchParams } \= new URL(request.url);  
  const secret \= searchParams.get('secret');

  // Verify cron secret  
  if (secret \!== process.env.CRON\_SECRET) {  
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });  
  }

  try {  
    const ticketmaster \= new TicketmasterAPI(process.env.TICKETMASTER\_API\_KEY\!);  
      
    // Fetch upcoming shows  
    const events \= await ticketmaster.searchEvents({  
      countryCode: 'US',  
      size: 200,  
      startDateTime: new Date().toISOString(),  
    });

    const supabase \= createRouteHandlerClient({ cookies });  
      
    for (const event of events.\_embedded?.events || \[\]) {  
      // Sync artist  
      let artist \= await syncArtist(event.\_embedded?.attractions?.\[0\]);  
        
      // Sync venue  
      let venue \= await syncVenue(event.\_embedded?.venues?.\[0\]);  
        
      // Sync show  
      await supabase  
        .from('shows')  
        .upsert({  
          ticketmaster\_id: event.id,  
          headliner\_artist\_id: artist.id,  
          venue\_id: venue?.id,  
          name: event.name,  
          slug: slugify(event.name),  
          date: event.dates.start.localDate,  
          start\_time: event.dates.start.localTime,  
          ticket\_url: event.url,  
          min\_price: event.priceRanges?.\[0\]?.min,  
          max\_price: event.priceRanges?.\[0\]?.max,  
        }, {  
          onConflict: 'ticketmaster\_id'  
        });  
    }

    return NextResponse.json({   
      message: 'Shows synced successfully',  
      count: events.\_embedded?.events?.length || 0   
    });  
  } catch (error) {  
    console.error('Sync error:', error);  
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });  
  }  
}

---

## **🚀 DEPLOYMENT & CONFIGURATION**

### **Environment Variables (Simplify Existing)**

\# Core Supabase vars (keep existing)  
NEXT\_PUBLIC\_SUPABASE\_URL=  
NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=  
SUPABASE\_SERVICE\_ROLE\_KEY=  
DATABASE\_URL=

\# REMOVE STRIPE VARS \- No payments needed  
\# STRIPE\_API\_KEY= (DELETE)  
\# STRIPE\_WEBHOOK\_SECRET= (DELETE)

\# Add MySetlist-specific vars  
SPOTIFY\_CLIENT\_ID=  
SPOTIFY\_CLIENT\_SECRET=  
TICKETMASTER\_API\_KEY=  
SETLISTFM\_API\_KEY=  
CRON\_SECRET=

\# App configuration  
NEXT\_PUBLIC\_APP\_URL=https://mysetlist.app  
NEXT\_PUBLIC\_APP\_ENV=production

### **Vercel Deployment Configuration**

// vercel.json  
{  
  "buildCommand": "npm run build",  
  "outputDirectory": ".next",  
  "framework": "nextjs",  
  "functions": {  
    "app/api/sync/\*\*": {  
      "maxDuration": 300  
    },  
    "app/api/search/\*\*": {  
      "maxDuration": 30  
    }  
  },  
  "crons": \[  
    {  
      "path": "/api/sync/shows?secret=$CRON\_SECRET",  
      "schedule": "0 \*/6 \* \* \*"  
    },  
    {  
      "path": "/api/sync/artists?secret=$CRON\_SECRET",  
      "schedule": "0 2 \* \* \*"  
    }  
  \]  
}

---

## **📋 DEVELOPMENT ROADMAP**

### **Phase 1: Foundation (Week 1-2)**

* \[ \] **Database Migration**: Extend Spotify template schema with MySetlist tables  
* \[ \] **Authentication**: Add Spotify OAuth to existing Supabase auth  
* \[ \] **Basic UI**: Adapt sidebar navigation and create show/artist pages  
* \[ \] **API Integration**: Set up Spotify, Ticketmaster, and Setlist.fm APIs

### **Phase 2: Core Features (Week 3-4)**

* \[ \] **Show Discovery**: Implement show listing and search  
* \[ \] **Artist Following**: Add follow/unfollow functionality  
* \[ \] **Setlist Creation**: Build predicted setlist interface  
* \[ \] **Basic Voting**: Implement up/down voting on songs

### **Phase 3: Advanced Features (Week 5-6)**

* \[ \] **Real-time Updates**: Add live voting updates during shows  
* \[ \] **Data Sync**: Implement background sync jobs  
* \[ \] **Advanced Search**: Cross-content search functionality  
* \[ \] **Mobile Optimization**: Ensure responsive design

### **Phase 4: Polish & Launch (Week 7-8)**

* \[ \] **Performance**: Optimize queries and caching  
* \[ \] **Testing**: Add comprehensive test coverage  
* \[ \] **Analytics**: Implement user tracking and metrics  
* \[ \] **SEO**: Add metadata and search optimization

---

## **🎯 SUCCESS METRICS**

### **Technical Targets**

* ✅ **Page Load Speed**: \<2 seconds LCP  
* ✅ **Database Performance**: \<100ms query response  
* ✅ **Real-time Updates**: \<500ms vote propagation  
* ✅ **Mobile Experience**: 90+ Lighthouse mobile score  
* ✅ **Uptime**: 99.9% availability

### **User Engagement Targets**

* ✅ **Active Users**: 10,000+ monthly active users  
* ✅ **Setlist Predictions**: 100+ predictions per week  
* ✅ **Vote Engagement**: 80% of logged-in users vote  
* ✅ **Artist Following**: Average 5+ followed artists per user  
* ✅ **Show Discovery**: 70% of users discover new shows

---

## **🔧 TECHNICAL IMPLEMENTATION NOTES**

### **Key Adaptations from Spotify Template**

1. **Audio Player → REMOVED**: Completely delete music player and audio functionality  
2. **Playlists → Setlists**: Transform playlist concepts to concert setlists  
3. **Library → Following**: Change "Your Music" to "Followed Artists"  
4. **Upload → Prediction**: Replace song upload with setlist song prediction  
5. **Subscriptions → REMOVED**: Delete Stripe integration entirely

### **Database Schema Migrations**

\-- Step-by-step migration plan  
\-- 1\. Add new tables (artists, venues, shows, setlists, etc.)  
\-- 2\. Extend existing users table with MySetlist fields  
\-- 3\. Modify songs table to include Spotify metadata  
\-- 4\. Create foreign key relationships  
\-- 5\. Add indexes for performance  
\-- 6\. Set up RLS policies for security

### **File Structure Adaptations**

├── app/  
│   ├── (site)/  
│   │   ├── page.tsx                 \# Home → Show discovery  
│   │   ├── search/                  \# Adapt to artist-only search  
│   │   ├── shows/                   \# New: Show pages  
│   │   ├── artists/                 \# New: Artist pages    
│   │   └── setlists/               \# New: Setlist pages  
│   ├── account/                     \# Keep existing (remove subscription)  
│   ├── liked/                       \# DELETE \- no song likes  
│   └── api/  
│       ├── webhook/                 \# DELETE \- no Stripe webhooks  
│       ├── shows/                   \# New: Show APIs  
│       ├── artists/                 \# New: Artist APIs  
│       ├── votes/                   \# New: Voting APIs  
│       └── sync/                    \# New: Background sync  
├── components/  
│   ├── Sidebar.tsx                  \# Adapt navigation  
│   ├── Header.tsx                   \# Keep existing  
│   ├── Player.tsx                   \# DELETE \- no music player  
│   ├── UploadModal.tsx             \# DELETE \- no uploads  
│   ├── LikeButton.tsx              \# DELETE \- no song likes  
│   └── setlist/                     \# New: Setlist components  
├── hooks/  
│   ├── useLoadSong.ts              \# DELETE \- no music loading  
│   ├── usePlayer.ts                \# DELETE \- no music player  
│   ├── useOnPlay.ts                \# DELETE \- no music playback  
│   ├── useFollowArtist.ts          \# New: Following system  
│   └── useRealtimeSetlist.ts       \# New: Real-time updates  
└── lib/  
    ├── supabaseClient.ts           \# Keep existing  
    ├── spotify-api.ts              \# New: Spotify integration (metadata only)  
    ├── ticketmaster-api.ts         \# New: Ticketmaster integration  
    └── setlistfm-api.ts            \# New: Setlist.fm integration

This PRD provides a comprehensive roadmap for transforming the Spotify clone template into MySetlist while leveraging all existing functionality and maintaining the clean, modern UI/UX patterns that make Spotify's interface so effective.
